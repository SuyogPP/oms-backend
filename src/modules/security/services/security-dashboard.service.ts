import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { Observable, interval, from, merge, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { BaseQueryDto, PaginatedResult } from '../../../common/dto/pagination.dto';
import {
    FailedLoginAttemptDto,
    SecurityDashboardDataDto,
    SecurityDashboardSummaryDto,
    SecurityEventDto,
    SecuritySummaryDto,
} from '../dto/security-dashboard.dto';
import { SecurityRepository } from '../repositories/security.repository';
import { SecurityChartsService } from './security-charts.service';

@Injectable()
export class SecurityDashboardService {
    private readonly logger = new Logger(SecurityDashboardService.name);

    constructor(
        private readonly securityRepository: SecurityRepository,
        private readonly securityChartsService: SecurityChartsService,
    ) {}

    async getDashboardData(): Promise<SecurityDashboardDataDto> {
        const defaultQuery = Object.assign(new BaseQueryDto(), { page: 1, pageSize: 25 });
        const [summary, eventsResult, failedLoginsResult, activeSessions] = await Promise.all([
            this.securityRepository.getDashboardSummary(),
            this.securityRepository.getSecurityEvents(defaultQuery),
            this.securityRepository.getFailedLoginAttempts(defaultQuery),
            this.securityRepository.getActiveSessionsDashboard(),
        ]);

        return {
            summary,
            events: eventsResult.items,
            failedLogins: failedLoginsResult.items,
            activeSessions,
        };
    }

    async getSummary(): Promise<SecurityDashboardSummaryDto> {
        return this.securityRepository.getDashboardSummary();
    }

    async getUserSummary(userId: string): Promise<SecuritySummaryDto> {
        return this.securityRepository.getSecuritySummaryById(userId);
    }

    async getSecurityEvents(query: BaseQueryDto): Promise<PaginatedResult<SecurityEventDto>> {
        return this.securityRepository.getSecurityEvents(query);
    }

    async getFailedLogins(query: BaseQueryDto): Promise<PaginatedResult<FailedLoginAttemptDto>> {
        return this.securityRepository.getFailedLoginAttempts(query);
    }

    async getFullCompositeStreamData(): Promise<any> {
        const [
            dashboard,
            failedLogins,
            securityEventsByType,
            sessionsByDevice,
            sessionsByRole,
            loginTrend,
            replayEvents,
            lockedAccounts,
            sessionsCreatedPerDay,
        ] = await Promise.all([
            this.getDashboardData(),
            this.securityChartsService.getFailedLogins(),
            this.securityChartsService.getSecurityEventsByType(),
            this.securityChartsService.getSessionsByDevice(),
            this.securityChartsService.getSessionsByRole(),
            this.securityChartsService.getLoginTrend(),
            this.securityChartsService.getReplayEvents(),
            this.securityChartsService.getLockedAccounts(),
            this.securityChartsService.getSessionsCreatedPerDay(),
        ]);

        return {
            dashboard,
            failedLogins,
            securityEventsByType,
            sessionsByDevice,
            sessionsByRole,
            loginTrend,
            replayEvents,
            lockedAccounts,
            sessionsCreatedPerDay,
        };
    }

    getEventStream(): Observable<MessageEvent> {
        // Send initial payload immediately, then every 30 seconds
        const initial$ = from(this.getFullCompositeStreamData()).pipe(
            map((data) => ({
                data,
            } as MessageEvent)),
            catchError((err) => {
                this.logger.error(`SSE initial error: ${err.message}`);
                return of({ data: { error: 'Failed to fetch initial security stream data' } } as MessageEvent);
            }),
        );

        const periodic$ = interval(30000).pipe(
            switchMap(() => from(this.getFullCompositeStreamData())),
            map((data) => ({
                data,
            } as MessageEvent)),
            catchError((err) => {
                this.logger.error(`SSE periodic error: ${err.message}`);
                return of({ data: { error: 'Failed to fetch periodic security stream data' } } as MessageEvent);
            }),
        );

        return merge(initial$, periodic$);
    }
}
