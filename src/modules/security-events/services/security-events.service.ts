import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';
import { RequestContextService } from '../../../common/services/request-context.service';
import { SecurityEventsRepository } from '../repositories/security-events.repository';

export interface LogSecurityEventOptions {
  userId?: string | null;
  loginSessionId?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface SecurityEventEmitted {
  eventType: string;
  timestamp: Date;
  userId?: string | null;
}

@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger(SecurityEventsService.name);
  public readonly events$ = new Subject<SecurityEventEmitted>();

  constructor(
    private readonly securityEventsRepository: SecurityEventsRepository,
    private readonly requestContextService: RequestContextService,
  ) {}

  async log(
    eventType: string,
    options?: LogSecurityEventOptions,
  ): Promise<void> {
    const userId = options?.userId ?? this.requestContextService.getUserId();
    const loginSessionId =
      options?.loginSessionId ?? this.requestContextService.getLoginSessionId();
    const ipAddress =
      options?.ipAddress ?? this.requestContextService.getIpAddress();
    const userAgent =
      options?.userAgent ?? this.requestContextService.getUserAgent();
    const eventDescription = options?.description ?? null;

    this.logger.log(
      `SecurityEvent: ${eventType} | User: ${userId || 'ANONYMOUS'} | IP: ${ipAddress}`,
    );

    await this.securityEventsRepository.createSecurityEvent({
      userId,
      loginSessionId,
      eventType,
      eventDescription,
      ipAddress,
      userAgent,
    });

    this.events$.next({
      eventType,
      timestamp: new Date(),
      userId,
    });
  }
}
