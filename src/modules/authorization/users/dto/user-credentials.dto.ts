import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteUserDto {
  @ApiProperty({
    example: true,
    required: false,
    description: 'Whether to force revocation of existing active invitation and reissue a new token',
  })
  @IsOptional()
  resend?: boolean;
}

export class AcceptInvitationDto {
  @ApiProperty({
    example: 'Str0ngP@ssw0rd2026!',
    description: 'Password satisfying complexity rules (minimum 8 chars, mixed case, number, symbol)',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.',
    },
  )
  password!: string;
}

export class ValidateInvitationResponseDto {
  @ApiProperty({ example: true })
  valid!: boolean;

  @ApiProperty({ example: 'INVITE', enum: ['INVITE', 'PASSWORD_RESET'] })
  purpose!: string;

  @ApiProperty({ example: 'tariq.hashimi' })
  username!: string;

  @ApiProperty({ example: 'tariq.hashimi@diez.ae' })
  email!: string;
}

export class GenericSuccessResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Action completed successfully' })
  message!: string;
}

export class InvitationDispatchResultDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'Invitation sent successfully' })
  message!: string;

  @ApiProperty({
    example: 'abc123def456...',
    required: false,
    description: 'Transient raw token returned for local email dispatch / automated testing',
  })
  rawToken?: string;

  @ApiProperty({ example: '2026-08-31T00:00:00.000Z', required: false })
  expiresAt?: Date;
}
