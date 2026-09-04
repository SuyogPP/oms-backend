import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { DataSource } from 'typeorm';
import { UsersRepository } from '../repositories/users.repository';
import { UserProfilesRepository } from '../repositories/user-profiles.repository';
import { UserInvitationsRepository } from '../repositories/user-invitations.repository';
import { UserValidationService } from './user-validation.service';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { UsersMapper } from '../users.mapper';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserFilterDto } from '../dto/user-filter.dto';
import {
  UserEntity,
  UserListResponseEntity,
  UserActivityEntity,
} from '../entities/user.entity';
import {
  USER_ERROR_CODES,
  INVITATION_PURPOSES,
  INVITATION_EXPIRY_DAYS,
} from '../users.constants';

export interface ICreateUserResult {
  user: UserEntity;
  invitationToken?: string;
  invitationExpiresAt?: Date;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly userProfilesRepository: UserProfilesRepository,
    private readonly userInvitationsRepository: UserInvitationsRepository,
    private readonly userValidationService: UserValidationService,
    private readonly securityEventsService: SecurityEventsService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Retrieves a paginated, filtered, and scope-restricted list of users (§8 & §9.2).
   */
  async findAll(
    filter: UserFilterDto,
    requesterUserId?: string,
  ): Promise<UserListResponseEntity> {
    const result = await this.usersRepository.findAll({
      ...filter,
      requesterUserId,
    });

    return {
      items: UsersMapper.toEntityList(result.items),
      total: result.total,
      page: result.page,
      limit: result.limit,
      pageSize: result.limit,
      totalPages: result.totalPages,
    };
  }

  /**
   * Retrieves a user by ID with scope validation (§8 & §9.2).
   * Out-of-scope direct access returns 404 (Not Found), never 403.
   */
  async findById(
    userId: string,
    requesterUserId?: string,
  ): Promise<UserEntity> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${userId}] not found.`,
      });
    }

    // Scope check: verify user is visible to requester
    if (requesterUserId && requesterUserId !== userId) {
      const isVisible = await this.isUserInScope(requesterUserId, user);
      if (!isVisible) {
        throw new NotFoundException({
          code: USER_ERROR_CODES.USER_NOT_FOUND,
          message: `User [${userId}] not found.`,
        });
      }
    }

    return UsersMapper.toEntity(user);
  }

  /**
   * Creates a new user transactionally (§5.1 & §8).
   * Sequence:
   * 1. Validate rules (U1 - U10)
   * 2. Insert auth.Users
   * 3. Insert auth.UserProfiles
   * 4. Generate & insert invitation token in auth.UserInvitations
   * 5. Record SecurityEvent & Audit log
   */
  async create(
    dto: CreateUserDto,
    creatorUserId?: string,
  ): Promise<ICreateUserResult> {
    // 1. Full validation
    await this.userValidationService.validateCreateUser(dto, creatorUserId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let createdUserId: string;
    let rawToken: string | undefined;
    let expiresAt: Date | undefined;

    try {
      // 2. Insert User
      createdUserId = await this.usersRepository.create(
        {
          employeeId: dto.employeeId,
          username: dto.username,
          email: dto.email,
          userType: dto.userType,
          isActive: false, // New users start in INVITED/inactive state
          adObjectId: dto.adObjectId,
        },
        queryRunner,
      );

      // 3. Insert Profile
      await this.userProfilesRepository.create(
        createdUserId,
        {
          firstName: dto.profile.firstName,
          lastName: dto.profile.lastName,
          displayName: dto.profile.displayName,
          phoneNumber: dto.profile.phoneNumber,
          jobTitle: dto.profile.jobTitle,
          organizationId: dto.profile.organizationId,
          businessUnitId: dto.profile.businessUnitId,
          departmentId: dto.profile.departmentId,
          sectionId: dto.profile.sectionId,
          vendorId: dto.profile.vendorId,
          createdBy: creatorUserId,
        },
        queryRunner,
      );

      // 4. Generate invitation token if not AD-linked
      if (!dto.adObjectId) {
        rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto
          .createHash('sha256')
          .update(rawToken)
          .digest('hex');
        expiresAt = new Date(
          Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
        );

        await this.userInvitationsRepository.create(
          createdUserId,
          tokenHash,
          INVITATION_PURPOSES.INVITE,
          expiresAt,
          creatorUserId,
          queryRunner,
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // 5. Audit and Security events
    await this.securityEventsService.log('USER_CREATED', {
      userId: createdUserId,
      description: `User [${dto.username}] created by creator [${creatorUserId || 'SYSTEM'}].`,
    });

    await this.auditService.logUserCreated({
      userId: createdUserId,
      username: dto.username,
      email: dto.email,
    });

    const userWithProfile = await this.usersRepository.findById(createdUserId);
    if (!userWithProfile) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: 'Failed to load created user record.',
      });
    }

    return {
      user: UsersMapper.toEntity(userWithProfile),
      invitationToken: rawToken,
      invitationExpiresAt: expiresAt,
    };
  }

  /**
   * Updates an existing user (§5.2 & §8).
   */
  async update(
    userId: string,
    dto: UpdateUserDto,
    updaterUserId?: string,
  ): Promise<UserEntity> {
    const existing = await this.usersRepository.findById(userId);
    if (!existing || existing.isDeleted) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${userId}] not found.`,
      });
    }

    // Scope check: verify user is visible to updater
    if (updaterUserId && updaterUserId !== userId) {
      const isVisible = await this.isUserInScope(updaterUserId, existing);
      if (!isVisible) {
        throw new NotFoundException({
          code: USER_ERROR_CODES.USER_NOT_FOUND,
          message: `User [${userId}] not found.`,
        });
      }
    }

    // Validate update parameters
    await this.userValidationService.validateUpdateUser(
      userId,
      dto,
      updaterUserId,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Update User core fields
      if (
        dto.email ||
        dto.username ||
        dto.employeeId !== undefined ||
        dto.userType
      ) {
        await this.usersRepository.update(
          userId,
          {
            email: dto.email,
            username: dto.username,
            employeeId: dto.employeeId,
            userType: dto.userType,
          },
          queryRunner,
        );
      }

      // 2. Update Profile fields
      if (dto.profile) {
        await this.userProfilesRepository.update(
          userId,
          {
            ...dto.profile,
            updatedBy: updaterUserId,
          },
          queryRunner,
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // 3. Audit and Security events
    await this.securityEventsService.log('USER_UPDATED', {
      userId,
      description: `User [${existing.username}] updated by [${updaterUserId || 'SYSTEM'}].`,
    });

    await this.auditService.logUserUpdated({
      userId,
      updatedFields: dto,
    });

    const updatedUser = await this.usersRepository.findById(userId);
    return UsersMapper.toEntity(updatedUser!);
  }

  /**
   * Retrieves users for CSV/JSON export (§8).
   */
  async exportUsers(
    filter: UserFilterDto,
    requesterUserId?: string,
  ): Promise<UserEntity[]> {
    const rows = await this.usersRepository.exportUsers({
      ...filter,
      requesterUserId,
    });

    return UsersMapper.toEntityList(rows);
  }

  /**
   * Retrieves security activity trail for a user (§8).
   */
  async getUserActivity(
    userId: string,
    requesterUserId?: string,
    limit: number = 50,
  ): Promise<UserActivityEntity[]> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.isDeleted) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `User [${userId}] not found.`,
      });
    }

    // Scope check: verify user is visible to requester
    if (requesterUserId && requesterUserId !== userId) {
      const isVisible = await this.isUserInScope(requesterUserId, user);
      if (!isVisible) {
        throw new NotFoundException({
          code: USER_ERROR_CODES.USER_NOT_FOUND,
          message: `User [${userId}] not found.`,
        });
      }
    }

    return this.usersRepository.getUserActivity(userId, limit);
  }

  /**
   * Internal helper: Verifies if target user falls within requester's visible scope (§9.2).
   */
  private async isUserInScope(
    requesterUserId: string,
    targetUser: any,
  ): Promise<boolean> {
    // 1. Check if requester holds GLOBAL scope
    const globalRows = await this.dataSource.query(
      `
      SELECT 1 FROM [auth].[UserOrganizationScopes] s
      INNER JOIN [auth].[ScopeDefinitions] sd ON sd.ScopeDefinitionID = s.ScopeDefinitionID
      WHERE s.UserID = @0
        AND sd.ScopeCode = 'GLOBAL'
        AND (s.IsActive = 1 OR s.IsActive IS NULL)
        AND (s.EffectiveFrom IS NULL OR s.EffectiveFrom <= SYSUTCDATETIME())
        AND (s.EffectiveTo IS NULL OR s.EffectiveTo > SYSUTCDATETIME());
      `,
      [requesterUserId],
    );

    if (globalRows && globalRows.length > 0) {
      return true;
    }

    // 2. If target user has no department/bu/section, they are invisible to non-global admins unless self
    const targetDept = targetUser.profile?.departmentId;
    const targetBu = targetUser.profile?.businessUnitId;
    const targetSec = targetUser.profile?.sectionId;

    if (!targetDept && !targetBu && !targetSec) {
      return false;
    }

    // 3. Query visible org units for requester
    const visibleRows = await this.dataSource.query(
      `
      SELECT 1 FROM [org].[fn_VisibleOrgUnits](@0) v
      WHERE (@1 IS NOT NULL AND v.OrgUnitId = @1)
         OR (@2 IS NOT NULL AND v.OrgUnitId = @2)
         OR (@3 IS NOT NULL AND v.OrgUnitId = @3);
      `,
      [
        requesterUserId,
        targetDept || null,
        targetBu || null,
        targetSec || null,
      ],
    );

    return visibleRows && visibleRows.length > 0;
  }
}
