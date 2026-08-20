import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LoginDto {
    @ApiProperty({ description: 'Username of the user' })
    @IsString()
    @IsNotEmpty()
    username: string;

    @ApiProperty({ description: 'Password of the user' })
    @IsString()
    @IsNotEmpty()
    password: string;

    @ApiPropertyOptional({ description: 'Confirm auto-revoking the oldest session if concurrent limit is reached' })
    @IsBoolean()
    @IsOptional()
    confirmRevokeOldest?: boolean;

    @ApiPropertyOptional({ description: 'Unique device fingerprint ID (UUID)' })
    @IsString()
    @IsOptional()
    deviceFingerprint?: string;
}

export class RefreshTokenDto {
    @ApiProperty({ description: 'Opaque refresh token string' })
    @IsString()
    @IsNotEmpty()
    refreshToken: string;

    @ApiPropertyOptional({ description: 'Device fingerprint ID' })
    @IsString()
    @IsOptional()
    deviceFingerprint?: string;
}

export class ScopeItemDto {
    @ApiProperty()
    scopeCode: string;

    @ApiPropertyOptional()
    organizationId?: string | null;

    @ApiPropertyOptional()
    businessUnitId?: string | null;

    @ApiPropertyOptional()
    departmentId?: string | null;

    @ApiPropertyOptional()
    sectionId?: string | null;
}

export class AuthUserDto {
    @ApiProperty({ description: 'Unique identifier of the user' })
    userId: string;

    @ApiProperty({ description: 'Username of the user' })
    username: string;

    @ApiProperty({ description: 'Email address of the user' })
    email: string;

    @ApiProperty({ description: 'User type (INTERNAL or VENDOR)' })
    userType: string;

    @ApiPropertyOptional({ description: 'Employee ID' })
    employeeId?: string | null;

    @ApiProperty({ description: 'Assigned roles', type: [String] })
    roles: string[];

    @ApiProperty({ description: 'Assigned permissions', type: [String] })
    permissions: string[];

    @ApiProperty({ description: 'Assigned organization scopes', type: [ScopeItemDto] })
    scopes: ScopeItemDto[];

    @ApiProperty({ description: 'Created login session ID' })
    loginSessionId: string;
}

export class LoginResponseDto {
    @ApiProperty({ default: true })
    success: boolean;

    @ApiProperty({ description: 'Signed JWT access token' })
    accessToken: string;

    @ApiProperty({ description: 'Opaque refresh token string' })
    refreshToken: string;

    @ApiProperty({ type: AuthUserDto })
    user: AuthUserDto;
}

export class RefreshResponseDto {
    @ApiProperty({ default: true })
    success: boolean;

    @ApiProperty({ description: 'Newly signed JWT access token' })
    accessToken: string;

    @ApiProperty({ description: 'Newly rotated opaque refresh token' })
    refreshToken: string;
}

export class LogoutResponseDto {
    @ApiProperty({ default: true })
    success: boolean;

    @ApiProperty({ description: 'Status message' })
    message: string;
}
