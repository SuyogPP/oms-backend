import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import {
    BadRequestException,
    NotFoundException,
} from '@nestjs/common';

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

    async update(
    userId: string,
    dto: UpdateUserDto,
    ) {

        const queryRunner = this.dataSource.createQueryRunner();

        await queryRunner.connect();

        await queryRunner.startTransaction();

        try {

            const existingUser = await queryRunner.query(
                `
                SELECT
                    UserID
                FROM auth.Users
                WHERE UserID = @0
                `,
                [
                    userId,
                ],
            );

            if (existingUser.length === 0) {

                throw new NotFoundException(
                    'User not found',
                );

            }

            if (Object.keys(dto).length === 0) {

                throw new BadRequestException(
                    'No fields provided for update',
                );

            }

            const updateFields: string[] = [];

            const parameters: any[] = [];

            if (dto.firstName !== undefined) {

                updateFields.push(
                    `FirstName=@${parameters.length}`,
                );

                parameters.push(
                    dto.firstName,
                );

            }

            if (dto.lastName !== undefined) {

                updateFields.push(
                    `LastName=@${parameters.length}`,
                );

                parameters.push(
                    dto.lastName,
                );

            }

            if (dto.mobileNo !== undefined) {

                updateFields.push(
                    `MobileNo=@${parameters.length}`,
                );

                parameters.push(
                    dto.mobileNo,
                );

            }

            if (dto.jobTitle !== undefined) {

                updateFields.push(
                    `JobTitle=@${parameters.length}`,
                );

                parameters.push(
                    dto.jobTitle,
                );

            }

            if (updateFields.length === 0) {

                throw new BadRequestException(
                    'No fields provided for update',
                );

            }


            // Add userId as the last parameter
            parameters.push(
                userId,
            );

            await queryRunner.query(
                `
                UPDATE auth.UserProfiles
                SET
                    ${updateFields.join(',')}
                WHERE UserID=@${parameters.length - 1}
                `,
                parameters,
            );

            await queryRunner.query(
                `
                UPDATE auth.Users
                SET
                    UpdatedAt = SYSUTCDATETIME()
                WHERE UserID = @0
                `,
                [
                    userId,
                ],
            );

            await queryRunner.commitTransaction();

            return {

                success: true,

                message: 'User updated successfully',

            };

        }
        catch (error) {

            await queryRunner.rollbackTransaction();

            throw error;

        }
        finally {

            await queryRunner.release();

        }

    }
}