import { IsUUID, IsOptional, IsInt, Min, Max, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IssueCandidateTokenDto {
  @ApiProperty({
    description: 'Onboarding case UUID',
    example: 'A78229F7-70CE-4011-8C15-EC8E0234B364',
  })
  @IsUUID()
  @IsNotEmpty()
  onboardingId: string;

  @ApiPropertyOptional({
    description: 'Custom expiration days (default 14 days)',
    example: 14,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  expiryDays?: number;
}

export class ValidateCandidateTokenDto {
  @ApiProperty({
    description: 'Raw 32-byte base64url token',
    example: 'uW7a9_xY8...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}

export class CandidateTokenValidationResponseDto {
  @ApiProperty({ example: true })
  valid: boolean;

  @ApiProperty({ example: 'A78229F7-70CE-4011-8C15-EC8E0234B364' })
  onboardingId: string;

  @ApiProperty({ example: '2026-09-26T12:00:00.000Z' })
  expiresAt: Date;

  @ApiProperty({ example: 1 })
  consumedCount: number;
}

export class IssueCandidateTokenResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Candidate access token issued successfully.' })
  message: string;

  @ApiProperty({
    description: 'Raw token (emailed once, never persisted in plain text)',
  })
  rawToken: string;

  @ApiProperty({ example: 'A78229F7-70CE-4011-8C15-EC8E0234B364' })
  onboardingId: string;

  @ApiProperty({ example: '2026-09-26T12:00:00.000Z' })
  expiresAt: Date;
}

export class RevokeCandidateTokenDto {
  @ApiProperty({
    description: 'Onboarding case UUID to revoke all active tokens for',
    example: 'A78229F7-70CE-4011-8C15-EC8E0234B364',
  })
  @IsUUID()
  @IsNotEmpty()
  onboardingId: string;
}
