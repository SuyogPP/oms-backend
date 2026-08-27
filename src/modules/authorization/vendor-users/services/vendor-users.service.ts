import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VendorUsersRepository } from '../repositories/vendor-users.repository';
import { UsersRepository } from '../../users/repositories/users.repository';
import { UserValidationService } from '../../users/services/user-validation.service';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import {
  CreateVendorUserDto,
  UpdateVendorUserDto,
} from '../dto/create-vendor-user.dto';
import { IVendorUser } from '../interfaces/vendor-users.interface';
import { USER_ERROR_CODES, USER_TYPES } from '../../users/users.constants';

@Injectable()
export class VendorUsersService {
  private readonly logger = new Logger(VendorUsersService.name);

  constructor(
    private readonly vendorUsersRepository: VendorUsersRepository,
    private readonly usersRepository: UsersRepository,
    private readonly userValidationService: UserValidationService,
    private readonly securityEventsService: SecurityEventsService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Lists all active vendor users (Rule V9: strictly isolated from internal users).
   */
  async findAll(operatorUserId?: string): Promise<IVendorUser[]> {
    return this.vendorUsersRepository.findAll();
  }

  /**
   * Finds a vendor user by UserID.
   */
  async findById(id: string): Promise<IVendorUser> {
    const user = await this.vendorUsersRepository.findById(id);
    if (!user) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `Vendor user [${id}] not found.`,
      });
    }
    return user;
  }

  /**
   * Creates a new vendor user per Specification Section 7 (Rules V1–V10).
   *
   * Enforced Rules:
   * - V1: UserType is strictly VENDOR.
   * - V2: Linked to valid Vendor ID (TODO: Domain 6 verification).
   * - V3: Never assigned internal roles (enforced during role assignment).
   * - V4: Never assigned organizational scope (enforced during scope assignment).
   * - V5: Never assigned org unit FKs on profile.
   * - V6: Managed under VENDORUSER.MANAGE by Procurement.
   * - V9: Stored and listed separately from internal users.
   */
  async create(
    dto: CreateVendorUserDto,
    operatorUserId?: string,
  ): Promise<IVendorUser> {
    // 1. Validate V1 User Type
    this.userValidationService.validateV1_VendorUserType(USER_TYPES.VENDOR);

    // 2. Validate V2 Vendor Link shape
    this.userValidationService.validateV2_VendorLink(dto.vendorId);
    this.validateVendorIdShape(dto.vendorId);

    // TODO(domain-6): validate against vendor.Vendors
    // Once Domain 6 is implemented, query [vendor].[Vendors] to assert vendor exists and is active.

    // 3. Unique email and username validation
    await this.userValidationService.validateU1_EmailUnique(dto.email);
    await this.userValidationService.validateU2_UsernameUnique(dto.username);

    // 4. Validate V5 Org Unit constraint
    this.userValidationService.validateV5_VendorOrgUnitProfile(
      USER_TYPES.VENDOR,
      {},
    );

    // 5. Persist vendor user atomically
    const userId = await this.vendorUsersRepository.create({
      username: dto.username.trim(),
      email: dto.email.toLowerCase().trim(),
      vendorId: dto.vendorId,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      phoneNumber: dto.phoneNumber?.trim(),
      jobTitle: dto.jobTitle?.trim(),
    });

    const created = await this.vendorUsersRepository.findById(userId);
    if (!created) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: 'Created vendor user record not found.',
      });
    }

    // 6. Security Event & Audit Logging
    await this.securityEventsService.log('VENDOR_USER_CREATED', {
      userId,
      description: `Vendor user [${dto.username}] created and linked to Vendor [${dto.vendorId}] by [${operatorUserId || 'SYSTEM'}].`,
    });

    await this.auditService.logUserCreated({
      userId,
      username: dto.username,
      email: dto.email,
    });

    return created;
  }

  /**
   * Updates vendor user profile fields.
   */
  async update(
    id: string,
    dto: UpdateVendorUserDto,
    operatorUserId?: string,
  ): Promise<IVendorUser> {
    const existing = await this.vendorUsersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `Vendor user [${id}] not found.`,
      });
    }

    if (dto.email && dto.email.toLowerCase().trim() !== existing.email) {
      await this.userValidationService.validateU1_EmailUnique(dto.email, id);
    }

    await this.vendorUsersRepository.update(id, {
      email: dto.email ? dto.email.toLowerCase().trim() : undefined,
      firstName: dto.firstName?.trim(),
      lastName: dto.lastName?.trim(),
      phoneNumber: dto.phoneNumber?.trim(),
      jobTitle: dto.jobTitle?.trim(),
    });

    const updated = await this.vendorUsersRepository.findById(id);

    await this.securityEventsService.log('VENDOR_USER_UPDATED', {
      userId: id,
      description: `Vendor user [${existing.username}] updated by [${operatorUserId || 'SYSTEM'}].`,
    });

    await this.auditService.logUserUpdated({
      userId: id,
      updatedFields: {
        ...dto,
        updatedBy: operatorUserId,
      },
    });

    return updated!;
  }

  /**
   * Deactivates a single vendor user account.
   */
  async deactivate(id: string, operatorUserId?: string): Promise<void> {
    const existing = await this.vendorUsersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: USER_ERROR_CODES.USER_NOT_FOUND,
        message: `Vendor user [${id}] not found.`,
      });
    }

    await this.vendorUsersRepository.deactivate(id);

    await this.securityEventsService.log('VENDOR_USER_DEACTIVATED', {
      userId: id,
      description: `Vendor user [${existing.username}] deactivated by [${operatorUserId || 'SYSTEM'}].`,
    });

    await this.auditService.logUserUpdated({
      userId: id,
      updatedFields: {
        isActive: false,
        deactivatedBy: operatorUserId,
        deactivatedAt: new Date(),
      },
    });
  }

  /**
   * Deactivates all users associated with a specific vendor (Rule V10).
   * Called when a vendor organization is deactivated/suspended.
   */
  async deactivateAllByVendorId(
    vendorId: string,
    operatorUserId?: string,
  ): Promise<void> {
    this.validateVendorIdShape(vendorId);

    // TODO(domain-6): validate against vendor.Vendors
    await this.vendorUsersRepository.deactivateAllByVendorId(vendorId);

    await this.securityEventsService.log('VENDOR_DEACTIVATED_CASCADE', {
      description: `All vendor users for Vendor [${vendorId}] deactivated by [${operatorUserId || 'SYSTEM'}].`,
    });
  }

  /**
   * Validates the UUID format of a vendor reference.
   */
  private validateVendorIdShape(vendorId: string): void {
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(vendorId)) {
      throw new BadRequestException({
        code: USER_ERROR_CODES.VENDOR_REQUIRED,
        message: `Invalid vendor ID shape [${vendorId}]. Must be a valid UUID.`,
      });
    }
  }
}
