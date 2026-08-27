import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { UserImportRepository } from '../repositories/user-import.repository';
import { SecurityEventsService } from '../../../security-events/services/security-events.service';
import { AuditService } from '../../../audit/service/audit.services';
import { ValidateImportDto, CommitImportDto } from '../dto/validate-import.dto';
import {
  IImportValidationResult,
  IImportCommitResult,
  IRowValidationError,
  IUserImportRow,
} from '../interfaces/user-import.interface';
import { USER_ERROR_CODES, USER_TYPES } from '../../users/users.constants';

interface CachedImportBatch {
  importToken: string;
  operatorUserId?: string;
  rows: Array<{
    rowNumber: number;
    username: string;
    email: string;
    employeeId: string;
    firstName: string;
    lastName: string;
    jobTitle?: string;
    departmentId?: string;
    roleIds: string[];
    scopeDefinitionId?: string;
    scopeOrgUnitId?: string;
    scopeLevel?: string;
  }>;
  createdAt: Date;
  expiresAt: Date;
}

@Injectable()
export class UserImportService {
  private readonly logger = new Logger(UserImportService.name);
  private readonly tokenCache = new Map<string, CachedImportBatch>();
  private readonly TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutes

  constructor(
    private readonly userImportRepository: UserImportRepository,
    private readonly securityEventsService: SecurityEventsService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Phase 1: Validates every row against section 5.1 and 6.2 rules.
   * Generates a 30-minute validation token caching the validated payload server-side.
   */
  async validateImport(
    dto: ValidateImportDto,
    operatorUserId?: string,
  ): Promise<IImportValidationResult> {
    if (!dto.rows || dto.rows.length === 0) {
      throw new BadRequestException({
        code: 'IMPORT_EMPTY',
        message: 'No rows provided for import.',
      });
    }

    if (dto.rows.length > 500) {
      throw new BadRequestException({
        code: 'IMPORT_EXCEEDS_MAX_ROWS',
        message: 'Maximum 500 rows allowed per import.',
      });
    }

    const errors: IRowValidationError[] = [];

    // 1. Gather all identifiers for batch lookups
    const emails = dto.rows
      .map((r) => r.email?.toLowerCase().trim())
      .filter(Boolean);
    const usernames = dto.rows
      .map((r) => r.username?.toLowerCase().trim())
      .filter(Boolean);
    const employeeIds = dto.rows
      .map((r) => r.employeeId?.trim())
      .filter(Boolean) as string[];

    const deptCodes = Array.from(
      new Set(
        dto.rows
          .map((r) => r.departmentCode?.trim())
          .filter(Boolean) as string[],
      ),
    );

    const allRoleCodes = Array.from(
      new Set(
        dto.rows
          .flatMap((r) => r.roles || [])
          .map((rc) => rc.trim())
          .filter(Boolean),
      ),
    );

    const allScopeUnitCodes = Array.from(
      new Set(
        dto.rows
          .map((r) => r.scopeUnitCode?.trim())
          .filter(Boolean) as string[],
      ),
    );

    // 2. Perform Batch DB lookups
    const [
      existingEmails,
      existingUsernames,
      existingEmployeeIds,
      orgUnits,
      roles,
      scopeDefs,
    ] = await Promise.all([
      this.userImportRepository.findExistingEmails(emails),
      this.userImportRepository.findExistingUsernames(usernames),
      this.userImportRepository.findExistingEmployeeIds(employeeIds),
      this.userImportRepository.findOrgUnitsByCodes([
        ...deptCodes,
        ...allScopeUnitCodes,
      ]),
      this.userImportRepository.findRolesByCodes(allRoleCodes),
      this.userImportRepository.findScopeDefinitions(),
    ]);

    const existingEmailSet = new Set(existingEmails);
    const existingUsernameSet = new Set(existingUsernames);
    const existingEmpIdSet = new Set(existingEmployeeIds.map((id) => id.toLowerCase()));

    const orgUnitMap = new Map(orgUnits.map((ou) => [ou.code.toUpperCase(), ou]));
    const roleMap = new Map(roles.map((r) => [r.roleCode.toUpperCase(), r]));
    const scopeDefMap = new Map(
      scopeDefs.map((sd) => [sd.scopeCode.toUpperCase(), sd.scopeDefinitionId]),
    );

    // Track payload duplicates
    const payloadEmailSet = new Set<string>();
    const payloadUsernameSet = new Set<string>();
    const payloadEmpIdSet = new Set<string>();

    const preparedRows: CachedImportBatch['rows'] = [];

    // 3. Row-by-Row Validation
    for (const [index, row] of dto.rows.entries()) {
      const rowNum = row.rowNumber || index + 1;
      let hasRowError = false;

      // Required fields
      if (!row.username || row.username.trim() === '') {
        errors.push({
          rowNumber: rowNum,
          field: 'username',
          errorCode: 'USERNAME_REQUIRED',
          message: 'Username is required.',
        });
        hasRowError = true;
      }

      if (!row.email || row.email.trim() === '') {
        errors.push({
          rowNumber: rowNum,
          field: 'email',
          errorCode: 'EMAIL_REQUIRED',
          message: 'Email address is required.',
        });
        hasRowError = true;
      }

      if (!row.firstName || row.firstName.trim() === '') {
        errors.push({
          rowNumber: rowNum,
          field: 'firstName',
          errorCode: 'FIRST_NAME_REQUIRED',
          message: 'First name is required.',
        });
        hasRowError = true;
      }

      if (!row.lastName || row.lastName.trim() === '') {
        errors.push({
          rowNumber: rowNum,
          field: 'lastName',
          errorCode: 'LAST_NAME_REQUIRED',
          message: 'Last name is required.',
        });
        hasRowError = true;
      }

      // U4: Internal users require employeeId
      if (!row.employeeId || row.employeeId.trim() === '') {
        errors.push({
          rowNumber: rowNum,
          field: 'employeeId',
          errorCode: USER_ERROR_CODES.USER_EMPLOYEE_ID_REQUIRED,
          message: 'Employee ID is required for internal users.',
        });
        hasRowError = true;
      }

      // Email Format & Collision (U1)
      if (row.email) {
        const cleanEmail = row.email.toLowerCase().trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(cleanEmail)) {
          errors.push({
            rowNumber: rowNum,
            field: 'email',
            errorCode: 'EMAIL_INVALID',
            message: `Email format [${row.email}] is invalid.`,
          });
          hasRowError = true;
        } else if (existingEmailSet.has(cleanEmail)) {
          errors.push({
            rowNumber: rowNum,
            field: 'email',
            errorCode: USER_ERROR_CODES.USER_EMAIL_EXISTS,
            message: `Email address [${row.email}] already exists in the system.`,
          });
          hasRowError = true;
        } else if (payloadEmailSet.has(cleanEmail)) {
          errors.push({
            rowNumber: rowNum,
            field: 'email',
            errorCode: USER_ERROR_CODES.USER_EMAIL_EXISTS,
            message: `Duplicate email [${row.email}] found within import file.`,
          });
          hasRowError = true;
        } else {
          payloadEmailSet.add(cleanEmail);
        }
      }

      // Username Collision (U2)
      if (row.username) {
        const cleanUsername = row.username.toLowerCase().trim();
        if (existingUsernameSet.has(cleanUsername)) {
          errors.push({
            rowNumber: rowNum,
            field: 'username',
            errorCode: USER_ERROR_CODES.USER_USERNAME_EXISTS,
            message: `Username [${row.username}] already exists in the system.`,
          });
          hasRowError = true;
        } else if (payloadUsernameSet.has(cleanUsername)) {
          errors.push({
            rowNumber: rowNum,
            field: 'username',
            errorCode: USER_ERROR_CODES.USER_USERNAME_EXISTS,
            message: `Duplicate username [${row.username}] found within import file.`,
          });
          hasRowError = true;
        } else {
          payloadUsernameSet.add(cleanUsername);
        }
      }

      // EmployeeID Collision
      if (row.employeeId) {
        const cleanEmpId = row.employeeId.toLowerCase().trim();
        if (existingEmpIdSet.has(cleanEmpId)) {
          errors.push({
            rowNumber: rowNum,
            field: 'employeeId',
            errorCode: 'EMPLOYEE_ID_EXISTS',
            message: `Employee ID [${row.employeeId}] already exists.`,
          });
          hasRowError = true;
        } else if (payloadEmpIdSet.has(cleanEmpId)) {
          errors.push({
            rowNumber: rowNum,
            field: 'employeeId',
            errorCode: 'EMPLOYEE_ID_EXISTS',
            message: `Duplicate Employee ID [${row.employeeId}] found within import file.`,
          });
          hasRowError = true;
        } else {
          payloadEmpIdSet.add(cleanEmpId);
        }
      }

      // Department Code Validation
      let resolvedDeptId: string | undefined;
      if (row.departmentCode) {
        const dept = orgUnitMap.get(row.departmentCode.toUpperCase());
        if (!dept) {
          errors.push({
            rowNumber: rowNum,
            field: 'departmentCode',
            errorCode: USER_ERROR_CODES.USER_ORG_UNIT_INVALID,
            message: `Department [${row.departmentCode}] not found.`,
          });
          hasRowError = true;
        } else {
          resolvedDeptId = dept.orgUnitId;
        }
      }

      // Role Codes Validation (V3: No vendor roles)
      const resolvedRoleIds: string[] = [];
      if (row.roles && row.roles.length > 0) {
        for (const roleCode of row.roles) {
          const role = roleMap.get(roleCode.toUpperCase());
          if (!role) {
            errors.push({
              rowNumber: rowNum,
              field: 'roles',
              errorCode: USER_ERROR_CODES.ROLE_NOT_FOUND,
              message: `Role [${roleCode}] not found or inactive.`,
            });
            hasRowError = true;
          } else if (role.isVendorRole) {
            errors.push({
              rowNumber: rowNum,
              field: 'roles',
              errorCode: USER_ERROR_CODES.VENDOR_ROLE_INVALID,
              message: `Vendor role [${roleCode}] cannot be assigned to internal user.`,
            });
            hasRowError = true;
          } else {
            resolvedRoleIds.push(role.roleId);
          }
        }
      }

      // Scope Validation (S1, S2, S5)
      let resolvedScopeDefId: string | undefined;
      let resolvedScopeOrgUnitId: string | undefined;
      let resolvedScopeLevel: string | undefined;

      if (row.scopeCode) {
        const upperScope = row.scopeCode.toUpperCase();
        resolvedScopeDefId = scopeDefMap.get(upperScope);

        if (!resolvedScopeDefId) {
          errors.push({
            rowNumber: rowNum,
            field: 'scopeCode',
            errorCode: USER_ERROR_CODES.SCOPE_NOT_FOUND,
            message: `Scope [${row.scopeCode}] not found.`,
          });
          hasRowError = true;
        } else if (upperScope !== 'GLOBAL') {
          if (!row.scopeUnitCode) {
            errors.push({
              rowNumber: rowNum,
              field: 'scopeUnitCode',
              errorCode: USER_ERROR_CODES.SCOPE_ASSIGNMENT_INVALID,
              message: `Scope unit code is required for [${row.scopeCode}] scope.`,
            });
            hasRowError = true;
          } else {
            const scopeUnit = orgUnitMap.get(row.scopeUnitCode.toUpperCase());
            if (!scopeUnit) {
              errors.push({
                rowNumber: rowNum,
                field: 'scopeUnitCode',
                errorCode: USER_ERROR_CODES.USER_ORG_UNIT_INVALID,
                message: `Scope unit [${row.scopeUnitCode}] not found.`,
              });
              hasRowError = true;
            } else {
              resolvedScopeOrgUnitId = scopeUnit.orgUnitId;
              resolvedScopeLevel = upperScope;
            }
          }
        } else {
          resolvedScopeLevel = 'GLOBAL';
        }
      }

      if (!hasRowError) {
        preparedRows.push({
          rowNumber: rowNum,
          username: row.username.trim(),
          email: row.email.toLowerCase().trim(),
          employeeId: (row.employeeId || '').trim(),
          firstName: row.firstName.trim(),
          lastName: row.lastName.trim(),
          jobTitle: row.jobTitle?.trim(),
          departmentId: resolvedDeptId,
          roleIds: resolvedRoleIds,
          scopeDefinitionId: resolvedScopeDefId,
          scopeOrgUnitId: resolvedScopeOrgUnitId,
          scopeLevel: resolvedScopeLevel,
        });
      }
    }

    const invalidRows = errors.length > 0 ? new Set(errors.map((e) => e.rowNumber)).size : 0;
    const validRows = dto.rows.length - invalidRows;

    let importToken = '';
    if (errors.length === 0) {
      importToken = `imp_${crypto.randomBytes(16).toString('hex')}`;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + this.TOKEN_TTL_MS);

      this.tokenCache.set(importToken, {
        importToken,
        operatorUserId,
        rows: preparedRows,
        createdAt: now,
        expiresAt,
      });

      this.logger.log(
        `Import validated cleanly: ${validRows} rows. Token: ${importToken}. Expires: ${expiresAt.toISOString()}`,
      );
    }

    return {
      importToken,
      totalRows: dto.rows.length,
      validRows,
      invalidRows,
      errors,
    };
  }

  /**
   * Phase 2: Commits the validated import payload atomically (All or Nothing).
   * Generates invitation tokens for every user (never passwords).
   */
  async commitImport(
    dto: CommitImportDto,
    operatorUserId?: string,
  ): Promise<IImportCommitResult> {
    const cachedBatch = this.tokenCache.get(dto.importToken);
    if (!cachedBatch) {
      throw new BadRequestException({
        code: 'IMPORT_TOKEN_INVALID',
        message: 'Validation token is invalid or does not exist.',
      });
    }

    if (new Date() > cachedBatch.expiresAt) {
      this.tokenCache.delete(dto.importToken);
      throw new BadRequestException({
        code: 'IMPORT_TOKEN_EXPIRED',
        message: 'Validation token has expired. Please re-validate the file.',
      });
    }

    const createdUserIds: string[] = [];
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const row of cachedBatch.rows) {
        // 1. Insert User (IsActive = 0, awaiting invitation accept)
        const userRows = await queryRunner.query(
          `
          INSERT INTO [auth].[Users] (
              UserID,
              Username,
              Email,
              EmployeeID,
              UserType,
              IsActive,
              IsDeleted,
              FailedLoginCount,
              CreatedAt,
              UpdatedAt
          )
          OUTPUT INSERTED.UserID AS userId
          VALUES (
              NEWID(),
              @0,
              @1,
              @2,
              'INTERNAL',
              0,
              0,
              0,
              SYSUTCDATETIME(),
              SYSUTCDATETIME()
          );
          `,
          [row.username, row.email, row.employeeId || null],
        );

        const userId = userRows[0].userId;
        createdUserIds.push(userId);
        const displayName = `${row.firstName} ${row.lastName}`.trim();

        // 2. Insert Profile
        await queryRunner.query(
          `
          INSERT INTO [auth].[UserProfiles] (
              UserProfileID,
              UserID,
              FirstName,
              LastName,
              DisplayName,
              JobTitle,
              DepartmentID,
              CreatedAt,
              UpdatedAt
          )
          VALUES (
              NEWID(),
              @0,
              @1,
              @2,
              @3,
              @4,
              @5,
              SYSUTCDATETIME(),
              SYSUTCDATETIME()
          );
          `,
          [
            userId,
            row.firstName,
            row.lastName,
            displayName,
            row.jobTitle || null,
            row.departmentId || null,
          ],
        );

        // 3. Issue Invitation Token (32-byte crypto, SHA-256 hash storage)
        const rawToken = crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await queryRunner.query(
          `
          INSERT INTO [auth].[UserInvitations] (
              UserInvitationID,
              UserID,
              TokenHash,
              Purpose,
              ExpiresAt,
              CreatedAt
          )
          VALUES (
              NEWID(),
              @0,
              @1,
              'INVITE',
              @2,
              SYSUTCDATETIME()
          );
          `,
          [userId, tokenHash, expiresAt],
        );

        // 4. Assign Roles if specified
        if (row.roleIds && row.roleIds.length > 0) {
          for (const roleId of row.roleIds) {
            await queryRunner.query(
              `
              INSERT INTO [auth].[UserRoles] (
                  UserRoleID,
                  UserID,
                  RoleID,
                  EffectiveFrom,
                  IsActive,
                  AssignedBy,
                  AssignedAt
              )
              VALUES (
                  NEWID(),
                  @0,
                  @1,
                  SYSUTCDATETIME(),
                  1,
                  @2,
                  SYSUTCDATETIME()
              );
              `,
              [userId, roleId, operatorUserId || null],
            );
          }
        }

        // 5. Assign Scopes if specified
        if (row.scopeDefinitionId) {
          const orgUnitId = row.scopeOrgUnitId || null;
          await queryRunner.query(
            `
            INSERT INTO [auth].[UserOrganizationScopes] (
                UserOrganizationScopeID,
                UserID,
                ScopeDefinitionID,
                OrgUnitId,
                DepartmentID,
                EffectiveFrom,
                IsActive,
                CreatedAt,
                UpdatedAt
            )
            VALUES (
                NEWID(),
                @0,
                @1,
                @2,
                @2,
                SYSUTCDATETIME(),
                1,
                SYSUTCDATETIME(),
                SYSUTCDATETIME()
            );
            `,
            [userId, row.scopeDefinitionId, orgUnitId],
          );
        }

        // Individual Security Event per created user
        await this.securityEventsService.log('USER_INVITED_VIA_IMPORT', {
          userId,
          description: `User [${row.username}] (${row.email}) created via bulk import by [${operatorUserId || 'SYSTEM'}]. Invitation token issued.`,
        });

        await this.auditService.logUserCreated({
          userId,
          username: row.username,
          email: row.email,
        });
      }

      // Summary Security Event for the entire batch
      await this.securityEventsService.log('USER_BATCH_IMPORTED', {
        description: `Bulk user import committed successfully: ${createdUserIds.length} users created and invited by [${operatorUserId || 'SYSTEM'}].`,
      });

      await queryRunner.commitTransaction();

      // Invalidate token from cache on successful commit
      this.tokenCache.delete(dto.importToken);

      return {
        importedCount: createdUserIds.length,
        failedCount: 0,
        createdUserIds,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Bulk import commit failed; rolling back all rows: ${err}`);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Provides a downloadable CSV template with required columns and sample data.
   */
  getTemplate(): string {
    const headers = [
      'employeeId',
      'username',
      'email',
      'firstName',
      'lastName',
      'jobTitle',
      'departmentCode',
      'roles',
      'scopeCode',
      'scopeUnitCode',
    ].join(',');

    const sampleRow1 = [
      'EMP-1001',
      'ali.rashid',
      'ali.rashid@diez.ae',
      'Ali',
      'Rashid',
      'Procurement Specialist',
      'DEP-PROC',
      'PROCUREMENT_BUYER',
      'DEPARTMENT',
      'DEP-PROC',
    ].join(',');

    const sampleRow2 = [
      'EMP-1002',
      'sara.ahmed',
      'sara.ahmed@diez.ae',
      'Sara',
      'Ahmed',
      'Financial Analyst',
      'DEP-FIN',
      'FINANCE_ANALYST',
      'DEPARTMENT',
      'DEP-FIN',
    ].join(',');

    return `${headers}\n${sampleRow1}\n${sampleRow2}\n`;
  }
}
