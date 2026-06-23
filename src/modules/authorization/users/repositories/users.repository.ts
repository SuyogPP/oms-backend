import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';

@Injectable()
export class UsersRepository {
    constructor(
        private readonly dataSource: DataSource,
    ) {}

    async findAll() {
    const users = await this.dataSource.query(
        `
        SELECT
            u.UserID AS userId,
            u.EmployeeID AS employeeId,
            CONCAT(p.FirstName, ' ', p.LastName) AS employeeName,
            u.Email AS email,
            p.DepartmentID AS department,
            p.JobTitle AS role,
            u.UserType AS userType,
            CASE
                WHEN u.IsActive = 1 THEN 'Active'
                ELSE 'Inactive'
            END AS status,
            u.LastLoginAt AS lastLogin
        FROM auth.Users u
        LEFT JOIN auth.UserProfiles p
            ON u.UserID = p.UserID
        WHERE u.IsDeleted = 0
        ORDER BY u.CreatedAt DESC
        `
    );

    return {
        success: true,
        data: users,
    };
}

    async create(dto: CreateUserDto) {
        const queryRunner = this.dataSource.createQueryRunner();

        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const existingUsers = await queryRunner.query(
                `
                SELECT
                    UserID,
                    Username,
                    Email
                FROM auth.Users
                WHERE Username = @0
                   OR Email = @1
                `,
                [
                    dto.username,
                    dto.email,
                ],
            );

            if (existingUsers.length > 0) {
                await queryRunner.rollbackTransaction();

                return {
                    success: false,
                    message: 'Username or email already exists',
                };
            }

            const userResult = await queryRunner.query(
                `
                INSERT INTO auth.Users
                (
                    UserID,
                    EmployeeID,
                    Username,
                    Email,
                    UserType,
                    IsActive,
                    CreatedAt,
                    IsDeleted,
                    FailedLoginCount
                )
                OUTPUT INSERTED.UserID AS userId
                VALUES
                (
                    NEWID(),
                    @0,
                    @1,
                    @2,
                    @3,
                    1,
                    SYSUTCDATETIME(),
                    0,
                    0
                )
                `,
                [
                    dto.employeeId ?? null,
                    dto.username,
                    dto.email,
                    dto.userType,
                ],
            );

            const userId = userResult[0].userId;

            await queryRunner.query(
                `
                INSERT INTO auth.UserProfiles
                (
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
                VALUES
                (
                    NEWID(),
                    @0,
                    @1,
                    @2,
                    @3,
                    @4,
                    @5,
                    @6,
                    @7
                )
                `,
                [
                    userId,
                    dto.firstName,
                    dto.lastName,
                    dto.mobileNo ?? null,
                    dto.jobTitle ?? null,
                    dto.departmentId ?? null,
                    dto.businessUnitId ?? null,
                    dto.sectionId ?? null,
                ],
            );

            await queryRunner.commitTransaction();

            return {
                success: true,
                message: 'User created successfully',
                data: {
                    userId,
                },
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();

            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async remove(id: string) {
        const existingUser = await this.dataSource.query(
            `
            SELECT
                UserID,
                IsDeleted
            FROM auth.Users
            WHERE UserID = @0
            `,
            [
                id,
            ],
        );

        if (existingUser.length === 0) {
            return {
                success: false,
                message: 'User not found',
            };
        }

        if (existingUser[0].IsDeleted === true || existingUser[0].IsDeleted === 1) {
            return {
                success: false,
                message: 'User is already deleted',
            };
        }

        await this.dataSource.query(
            `
            UPDATE auth.Users
            SET
                IsDeleted = 1,
                DeletedAt = SYSUTCDATETIME(),
                IsActive = 0
            WHERE UserID = @0
            `,
            [
                id,
            ],
        );

        return {
            success: true,
            message: 'User deleted successfully',
        };
    }
}