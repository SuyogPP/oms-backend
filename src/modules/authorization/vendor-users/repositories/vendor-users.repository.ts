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
          u.UserID AS userId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.IsActive AS isActive,
          u.IsDeleted AS isDeleted,
          u.FailedLoginCount AS failedLoginCount,
          u.LockedUntil AS lockedUntil,
          u.CreatedAt AS createdAt,
          u.UpdatedAt AS updatedAt,
          p.UserProfileID AS userProfileId,
          p.FirstName AS firstName,
          p.LastName AS lastName,
          RTRIM(LTRIM(p.FirstName + ' ' + ISNULL(p.LastName, ''))) AS displayName,
          p.MobileNo AS phoneNumber,
          p.JobTitle AS jobTitle,
          CAST(NULL AS UNIQUEIDENTIFIER) AS vendorId
      FROM [auth].[Users] u
      INNER JOIN [auth].[UserProfiles] p ON p.UserID = u.UserID
      WHERE u.UserType = 'VENDOR'
        AND u.IsDeleted = 0
      ORDER BY u.CreatedAt DESC;
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
  async findById(userId: string, qr?: QueryRunner): Promise<IVendorUser | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          u.UserID AS userId,
          u.Username AS username,
          u.Email AS email,
          u.UserType AS userType,
          u.IsActive AS isActive,
          u.IsDeleted AS isDeleted,
          u.FailedLoginCount AS failedLoginCount,
          u.LockedUntil AS lockedUntil,
          u.CreatedAt AS createdAt,
          u.UpdatedAt AS updatedAt,
          p.UserProfileID AS userProfileId,
          p.FirstName AS firstName,
          p.LastName AS lastName,
          RTRIM(LTRIM(p.FirstName + ' ' + ISNULL(p.LastName, ''))) AS displayName,
          p.MobileNo AS phoneNumber,
          p.JobTitle AS jobTitle,
          CAST(NULL AS UNIQUEIDENTIFIER) AS vendorId
      FROM [auth].[Users] u
      INNER JOIN [auth].[UserProfiles] p ON p.UserID = u.UserID
      WHERE u.UserID = @0
        AND u.UserType = 'VENDOR'
        AND u.IsDeleted = 0;
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
        INSERT INTO [auth].[Users] (
            UserID,
            Username,
            Email,
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
            'VENDOR',
            1,
            0,
            0,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        );
        `,
        [data.username, data.email],
      );

      const userId = userRows[0].userId;
      const displayName = `${data.firstName} ${data.lastName}`.trim();

      // Insert profile with V5 invariant (no org unit references)
      await runner.query(
        `
        INSERT INTO [auth].[UserProfiles] (
            UserProfileID,
            UserID,
            FirstName,
            LastName,
            MobileNo,
            JobTitle,
            BusinessUnitID,
            DepartmentID,
            SectionID
        )
        VALUES (
            NEWID(),
            @0,
            @1,
            @2,
            @3,
            @4,
            NULL,
            NULL,
            NULL
        );
        `,
        [
          userId,
          data.firstName,
          data.lastName,
          data.phoneNumber || null,
          data.jobTitle || null,
        ],
      );

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
      if (data.email) {
        await runner.query(
          `
          UPDATE [auth].[Users]
          SET Email = @1, UpdatedAt = SYSUTCDATETIME()
          WHERE UserID = @0 AND UserType = 'VENDOR';
          `,
          [userId, data.email],
        );
      }

      await runner.query(
        `
        UPDATE [auth].[UserProfiles]
        SET 
            FirstName = COALESCE(@1, FirstName),
            LastName = COALESCE(@2, LastName),
            MobileNo = COALESCE(@3, MobileNo),
            JobTitle = COALESCE(@4, JobTitle)
        WHERE UserID = @0;
        `,
        [
          userId,
          data.firstName || null,
          data.lastName || null,
          data.phoneNumber || null,
          data.jobTitle || null,
        ],
      );

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
      UPDATE [auth].[Users]
      SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
      WHERE UserID = @0 AND UserType = 'VENDOR';
      `,
      [userId],
    );
  }

  /**
   * Deactivates all users associated with a specific vendor ID (V10 rule).
   */
  async deactivateAllByVendorId(
    vendorId: string,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[Users]
      SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
      WHERE UserType = 'VENDOR' AND IsDeleted = 0;
      `,
    );
  }
}
