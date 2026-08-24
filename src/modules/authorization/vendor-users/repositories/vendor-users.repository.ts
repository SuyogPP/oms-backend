import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { IVendorUser } from '../interfaces/vendor-users.interface';

@Injectable()
export class VendorUsersRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Retrieves all active vendor users.
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
          p.DisplayName AS displayName,
          p.PhoneNumber AS phoneNumber,
          p.JobTitle AS jobTitle,
          p.VendorID AS vendorId
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
      WHERE UserID IN (
          SELECT UserID FROM [auth].[UserProfiles] WHERE VendorID = @0
      ) AND IsDeleted = 0;
      `,
      [vendorId],
    );
  }
}
