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
          RTRIM(LTRIM(p.FirstName + ' ' + ISNULL(p.LastName, ''))) AS displayName,
          p.MobileNo AS phoneNumber,
          p.JobTitle AS jobTitle,
          CAST(NULL AS UNIQUEIDENTIFIER) AS organizationId,
          p.BusinessUnitID AS businessUnitId,
          p.DepartmentID AS departmentId,
          p.SectionID AS sectionId,
          CAST(NULL AS UNIQUEIDENTIFIER) AS vendorId,
          ISNULL(lc.MustChangePassword, 0) AS mustChangePassword,
          lc.PasswordChangedAt AS passwordChangedAt,
          CAST(SYSUTCDATETIME() AS DATETIME2) AS createdAt,
          CAST(SYSUTCDATETIME() AS DATETIME2) AS updatedAt
      FROM [auth].[UserProfiles] p
      LEFT JOIN [auth].[LocalCredentials] lc ON lc.UserID = p.UserID
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
    const rows = await this.getExecutor(qr).query(
      `
      INSERT INTO [auth].[UserProfiles] (
          UserProfileID,
          UserID,
          FirstName,
          LastName,
          MobileNo,
          JobTitle,
          DepartmentID,
          BusinessUnitID,
          SectionID
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
          @7
      );
      `,
      [
        userId,
        profile.firstName,
        profile.lastName,
        profile.phoneNumber || null,
        profile.jobTitle || null,
        profile.departmentId || null,
        profile.businessUnitId || null,
        profile.sectionId || null,
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
          MobileNo = COALESCE(@3, MobileNo),
          JobTitle = COALESCE(@4, JobTitle),
          DepartmentID = CASE WHEN @5 IS NOT NULL THEN @5 ELSE DepartmentID END,
          BusinessUnitID = CASE WHEN @6 IS NOT NULL THEN @6 ELSE BusinessUnitID END,
          SectionID = CASE WHEN @7 IS NOT NULL THEN @7 ELSE SectionID END
      WHERE UserID = @0;
      `,
      [
        userId,
        profile.firstName || null,
        profile.lastName || null,
        profile.phoneNumber || null,
        profile.jobTitle || null,
        profile.departmentId !== undefined ? profile.departmentId : null,
        profile.businessUnitId !== undefined ? profile.businessUnitId : null,
        profile.sectionId !== undefined ? profile.sectionId : null,
      ],
    );
  }

  /**
   * Sets MustChangePassword flag in LocalCredentials.
   */
  async setMustChangePassword(
    userId: string,
    mustChange: boolean,
    qr?: QueryRunner,
  ): Promise<void> {
    await this.getExecutor(qr).query(
      `
      UPDATE [auth].[LocalCredentials]
      SET 
          MustChangePassword = @1,
          PasswordChangedAt = CASE WHEN @1 = 0 THEN SYSUTCDATETIME() ELSE PasswordChangedAt END
      WHERE UserID = @0;
      `,
      [userId, mustChange ? 1 : 0],
    );
  }
}
