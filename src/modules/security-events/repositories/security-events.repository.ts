import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface CreateSecurityEventInput {
  userId?: string | null;
  loginSessionId?: string | null;
  eventType: string;
  eventDescription?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

@Injectable()
export class SecurityEventsRepository {
  private readonly logger = new Logger(SecurityEventsRepository.name);

  constructor(private readonly dataSource: DataSource) {}

  async createSecurityEvent(data: CreateSecurityEventInput): Promise<void> {
    try {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validUserId = data.userId && UUID_REGEX.test(data.userId) ? data.userId : null;
      const validLoginSessionId = data.loginSessionId && UUID_REGEX.test(data.loginSessionId) ? data.loginSessionId : null;

      await this.dataSource.query(
        `
                INSERT INTO [auth].[SecurityEvents]
                (
                    UserID,
                    LoginSessionID,
                    EventType,
                    EventDescription,
                    IPAddress,
                    UserAgent,
                    CreatedAt
                )
                VALUES
                (
                    @0,
                    @1,
                    @2,
                    @3,
                    @4,
                    @5,
                    SYSUTCDATETIME()
                )
                `,
        [
          validUserId,
          validLoginSessionId,
          data.eventType,
          data.eventDescription ?? null,
          data.ipAddress ?? null,
          data.userAgent ?? null,
        ],
      );
    } catch (error) {
      this.logger.error(
        `Failed to write SecurityEvent (${data.eventType}): ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
