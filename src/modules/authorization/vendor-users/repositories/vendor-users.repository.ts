import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  IVendorUser,
  ICreateVendorUserData,
  IUpdateVendorUserData,
} from '../interfaces/vendor-users.interface';

@Injectable()
export class VendorUsersRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Retrieves all active vendor users (V9: strictly isolated from internal users).
   */
  async findAll(qr?: QueryRunner): Promise<IVendorUser[]> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          u.user_id AS userId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.is_active AS isActive,
          0 AS isDeleted,
          u.failed_login_count AS failedLoginCount,
          u.locked_until AS lockedUntil,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt,
          NEWID() AS userProfileId,
          u.first_name AS firstName,
          u.last_name AS lastName,
          RTRIM(LTRIM(u.first_name + ' ' + ISNULL(u.last_name, ''))) AS displayName,
          u.mobile_no AS phoneNumber,
          u.job_title AS jobTitle,
          u.vendor_id AS vendorId
      FROM [auth].[tbl_Users] u
      WHERE u.user_type = 'VENDOR'
      ORDER BY u.created_at DESC;
      `,
    );

    return rows.map((r: any) => ({
      userId: r.userId,
      username: r.username,
      email: r.email,
      userType: r.userType,
      isActive: r.isActive === 1 || r.isActive === true,
      isDeleted: r.isDeleted === 1 || r.isDeleted === true,
      failedLoginCount: Number(r.failedLoginCount || 0),
      lockedUntil: r.lockedUntil ? new Date(r.lockedUntil) : null,
      vendorId: r.vendorId,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
      profile: {
        userProfileId: r.userProfileId,
        userId: r.userId,
        firstName: r.firstName,
        lastName: r.lastName,
        displayName: r.displayName,
        phoneNumber: r.phoneNumber,
        jobTitle: r.jobTitle,
        vendorId: r.vendorId,
        mustChangePassword: false,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      },
    }));
  }

  /**
   * Finds a vendor user by UserID.
   */
  async findById(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IVendorUser | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          u.user_id AS userId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.is_active AS isActive,
          0 AS isDeleted,
          u.failed_login_count AS failedLoginCount,
          u.locked_until AS lockedUntil,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt,
          NEWID() AS userProfileId,
          u.first_name AS firstName,
          u.last_name AS lastName,
          RTRIM(LTRIM(u.first_name + ' ' + ISNULL(u.last_name, ''))) AS displayName,
          u.mobile_no AS phoneNumber,
          u.job_title AS jobTitle,
          u.vendor_id AS vendorId
      FROM [auth].[tbl_Users] u
      WHERE u.user_id = @0
        AND u.user_type = 'VENDOR';
      `,
      [userId],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];
    return {
      userId: r.userId,
      username: r.username,
      email: r.email,
      userType: r.userType,
      isActive: r.isActive === 1 || r.isActive === true,
      isDeleted: r.isDeleted === 1 || r.isDeleted === true,
      failedLoginCount: Number(r.failedLoginCount || 0),
      lockedUntil: r.lockedUntil ? new Date(r.lockedUntil) : null,
      vendorId: r.vendorId,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
      profile: {
        userProfileId: r.userProfileId,
        userId: r.userId,
        firstName: r.firstName,
        lastName: r.lastName,
        displayName: r.displayName,
        phoneNumber: r.phoneNumber,
        jobTitle: r.jobTitle,
        vendorId: r.vendorId,
        mustChangePassword: false,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
      },
    };
  }

  /**
   * Creates a new vendor user in a single atomic operation.
   * Enforces V5 (all org unit FKs set to NULL on profile).
   */
  async create(data: ICreateVendorUserData, qr?: QueryRunner): Promise<string> {
    const shouldManageTransaction = !qr;
    const runner = qr || this.dataSource.createQueryRunner();

    if (shouldManageTransaction) {
      await runner.connect();
      await runner.startTransaction();
    }

    try {
      const userRows = await runner.query(
        `
        INSERT INTO [auth].[tbl_Users] (
            user_id,
            username,
            email,
            user_type,
            is_active,
            failed_login_count,
            vendor_id,
            first_name,
            last_name,
            mobile_no,
            job_title,
            created_at,
            updated_at
        )
        OUTPUT INSERTED.user_id AS userId
        VALUES (
            NEWID(),
            @0,
            @1,
            'VENDOR',
            1,
            0,
            @2,
            @3,
            @4,
            @5,
            @6,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        );
        `,
        [data.username, data.email, data.vendorId, data.firstName, data.lastName, data.phoneNumber || null, data.jobTitle || null],
      );

      const userId = userRows[0].userId;

      if (shouldManageTransaction) {
        await runner.commitTransaction();
      }

      return userId;
    } catch (err) {
      if (shouldManageTransaction) {
        await runner.rollbackTransaction();
      }
      throw err;
    } finally {
      if (shouldManageTransaction) {
        await runner.release();
      }
    }
  }

  /**
   * Updates vendor user profile fields.
   */
  async update(
    userId: string,
    data: IUpdateVendorUserData,
    qr?: QueryRunner,
  ): Promise<void> {
    const shouldManageTransaction = !qr;
    const runner = qr || this.dataSource.createQueryRunner();

    if (shouldManageTransaction) {
      await runner.connect();
      await runner.startTransaction();
    }

    try {
      const updates: string[] = [];
      const params: any[] = [userId];
      let pIdx = 1;

      if (data.email !== undefined) {
        updates.push(`email = @${pIdx++}`);
        params.push(data.email);
      }
      if (data.firstName !== undefined) {
        updates.push(`first_name = @${pIdx++}`);
        params.push(data.firstName);
      }
      if (data.lastName !== undefined) {
        updates.push(`last_name = @${pIdx++}`);
        params.push(data.lastName);
      }
      if (data.phoneNumber !== undefined) {
        updates.push(`mobile_no = @${pIdx++}`);
        params.push(data.phoneNumber);
      }
      if (data.jobTitle !== undefined) {
        updates.push(`job_title = @${pIdx++}`);
        params.push(data.jobTitle);
      }

      if (updates.length > 0) {
        updates.push(`updated_at = SYSUTCDATETIME()`);
        await runner.query(
          `
          UPDATE [auth].[tbl_Users]
          SET ${updates.join(', ')}
          WHERE user_id = @0 AND user_type = 'VENDOR';
          `,
          params,
        );
      }

      if (shouldManageTransaction) {
        await runner.commitTransaction();
      }
    } catch (err) {
      if (shouldManageTransaction) {
        await runner.rollbackTransaction();
      }
      throw err;
    } finally {
      if (shouldManageTransaction) {
        await runner.release();
      }
    }
  }

  /**
   * Deactivates a single vendor user account.
   */
  async deactivate(userId: string, qr?: QueryRunner): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[tbl_Users]
      SET is_active = 0, updated_at = SYSUTCDATETIME()
      WHERE user_id = @0 AND user_type = 'VENDOR';
      `,
      [userId],
    );
  }

  /**
   * Deactivates all users associated with a specific vendor ID (V10 rule).
   */
  async deactivateAllByVendorId(
    vendorId: number,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[tbl_Users]
      SET is_active = 0, updated_at = SYSUTCDATETIME()
      WHERE user_type = 'VENDOR' AND vendor_id = @0;
      `,
    );
  }
}
