import { Injectable } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  IUserProfile,
  ICreateUserProfileData,
  IUpdateUserProfileData,
} from '../interfaces/users.interface';

@Injectable()
export class UserProfilesRepository {
  constructor(private readonly dataSource: DataSource) {}

  private getExecutor(qr?: QueryRunner) {
    return qr ? qr : this.dataSource;
  }

  /**
   * Finds user profile by UserID.
   */
  async findByUserId(
    userId: string,
    qr?: QueryRunner,
  ): Promise<IUserProfile | null> {
    const rows = await this.getExecutor(qr).query(
      `
      SELECT 
          p.UserProfileID AS userProfileId,
          p.UserID AS userId,
          p.FirstName AS firstName,
          p.LastName AS lastName,
          p.DisplayName AS displayName,
          p.PhoneNumber AS phoneNumber,
          p.JobTitle AS jobTitle,
          p.OrganizationID AS organizationId,
          p.BusinessUnitID AS businessUnitId,
          p.DepartmentID AS departmentId,
          p.SectionID AS sectionId,
          p.VendorID AS vendorId,
          p.MustChangePassword AS mustChangePassword,
          p.PasswordChangedAt AS passwordChangedAt,
          p.CreatedAt AS createdAt,
          p.UpdatedAt AS updatedAt
      FROM [auth].[UserProfiles] p
      WHERE p.UserID = @0;
      `,
      [userId],
    );

    if (!rows || rows.length === 0) {
      return null;
    }

    const r = rows[0];
    return {
      userProfileId: r.userProfileId,
      userId: r.userId,
      firstName: r.firstName,
      lastName: r.lastName,
      displayName: r.displayName,
      phoneNumber: r.phoneNumber,
      jobTitle: r.jobTitle,
      organizationId: r.organizationId,
      businessUnitId: r.businessUnitId,
      departmentId: r.departmentId,
      sectionId: r.sectionId,
      vendorId: r.vendorId,
      mustChangePassword:
        r.mustChangePassword === 1 || r.mustChangePassword === true,
      passwordChangedAt: r.passwordChangedAt
        ? new Date(r.passwordChangedAt)
        : null,
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
    };
  }

  /**
   * Creates a new user profile record in auth.UserProfiles.
   */
  async create(
    userId: string,
    profile: ICreateUserProfileData,
    qr?: QueryRunner,
  ): Promise<string> {
    const displayName =
      profile.displayName || `${profile.firstName} ${profile.lastName}`.trim();

    const rows = await this.getExecutor(qr).query(
      `
      INSERT INTO [auth].[UserProfiles] (
          UserProfileID,
          UserID,
          FirstName,
          LastName,
          DisplayName,
          PhoneNumber,
          JobTitle,
          OrganizationID,
          BusinessUnitID,
          DepartmentID,
          SectionID,
          VendorID,
          MustChangePassword,
          CreatedAt,
          UpdatedAt
      )
      OUTPUT INSERTED.UserProfileID AS userProfileId
      VALUES (
          NEWID(),
          @0,
          @1,
          @2,
          @3,
          @4,
          @5,
          @6,
          @7,
          @8,
          @9,
          @10,
          1,
          SYSUTCDATETIME(),
          SYSUTCDATETIME()
      );
      `,
      [
        userId,
        profile.firstName,
        profile.lastName,
        displayName,
        profile.phoneNumber || null,
        profile.jobTitle || null,
        profile.organizationId || null,
        profile.businessUnitId || null,
        profile.departmentId || null,
        profile.sectionId || null,
        profile.vendorId || null,
      ],
    );

    return rows[0].userProfileId;
  }

  /**
   * Updates an existing user profile record.
   */
  async update(
    userId: string,
    profile: IUpdateUserProfileData,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[UserProfiles]
      SET 
          FirstName = COALESCE(@1, FirstName),
          LastName = COALESCE(@2, LastName),
          DisplayName = COALESCE(@3, DisplayName),
          PhoneNumber = COALESCE(@4, PhoneNumber),
          JobTitle = COALESCE(@5, JobTitle),
          OrganizationID = CASE WHEN @6 IS NOT NULL THEN @6 ELSE OrganizationID END,
          BusinessUnitID = CASE WHEN @7 IS NOT NULL THEN @7 ELSE BusinessUnitID END,
          DepartmentID = CASE WHEN @8 IS NOT NULL THEN @8 ELSE DepartmentID END,
          SectionID = CASE WHEN @9 IS NOT NULL THEN @9 ELSE SectionID END,
          VendorID = CASE WHEN @10 IS NOT NULL THEN @10 ELSE VendorID END,
          UpdatedAt = SYSUTCDATETIME()
      WHERE UserID = @0;
      `,
      [
        userId,
        profile.firstName || null,
        profile.lastName || null,
        profile.displayName || null,
        profile.phoneNumber || null,
        profile.jobTitle || null,
        profile.organizationId !== undefined ? profile.organizationId : null,
        profile.businessUnitId !== undefined ? profile.businessUnitId : null,
        profile.departmentId !== undefined ? profile.departmentId : null,
        profile.sectionId !== undefined ? profile.sectionId : null,
        profile.vendorId !== undefined ? profile.vendorId : null,
      ],
    );
  }

  /**
   * Sets MustChangePassword flag.
   */
  async setMustChangePassword(
    userId: string,
    mustChange: boolean,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[UserProfiles]
      SET 
          MustChangePassword = @1,
          PasswordChangedAt = CASE WHEN @1 = 0 THEN SYSUTCDATETIME() ELSE PasswordChangedAt END,
          UpdatedAt = SYSUTCDATETIME()
      WHERE UserID = @0;
      `,
      [userId, mustChange ? 1 : 0],
    );
  }
}
