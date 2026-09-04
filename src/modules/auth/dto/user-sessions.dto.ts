import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserActiveSessionDto {
  @ApiProperty({ description: 'Unique identifier of the login session' })
  loginSessionId: string;

  @ApiPropertyOptional({ description: 'PascalCase compatibility alias' })
  LoginSessionID?: string;

  @ApiProperty({ description: 'IP address from which the session originated' })
  ipAddress: string;

  @ApiPropertyOptional({
    description: 'Browser name extracted from user agent',
  })
  browserName?: string | null;

  @ApiPropertyOptional({
    description: 'Device type (e.g. Desktop, Mobile, Tablet)',
  })
  deviceType?: string | null;

  @ApiProperty({ description: 'Timestamp when session was created' })
  createdAt: string;

  @ApiPropertyOptional({ description: 'Timestamp of last activity' })
  lastActivityAt?: string | null;

  @ApiProperty({ description: 'Session expiration timestamp' })
  expiresAt: string;

  @ApiProperty({
    description: 'Whether this session matches the current caller session',
  })
  isCurrentSession: boolean;
}

export class UserSessionsListResponseDto {
  @ApiProperty({ default: true })
  success: boolean;

  @ApiProperty({ type: [UserActiveSessionDto] })
  sessions: UserActiveSessionDto[];
}

export class SessionActionResponseDto {
  @ApiProperty({ default: true })
  success: boolean;

  @ApiProperty({ description: 'Status or confirmation message' })
  message: string;
}
