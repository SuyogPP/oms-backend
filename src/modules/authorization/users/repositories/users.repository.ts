import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';

@Injectable()
export class UsersRepository {
    constructor(
        private readonly dataSource: DataSource,
    ) {}

    async findAll() {
        return [];
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
                OUTPUT INSERTED.UserID
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

            const userId = userResult[0].UserID;

            await queryRunner.query(
                `
                INSERT INTO auth.UserProfiles
                (
                    UserProfileID,
                    UserID,
                    FirstName,
                    LastName
                )
                VALUES
                (
                    NEWID(),
                    @0,
                    @1,
                    @2
                )
                `,
                [
                    userId,
                    dto.firstName,
                    dto.lastName,
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
}