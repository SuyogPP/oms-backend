import { Injectable } from '@nestjs/common';
import { SecurityRepository } from '../repositories/security.repository';
import {
    FailedLoginsChartDto,
    LockedAccountsDto,
    LoginTrendDto,
    ReplayEventsDto,
    SecurityEventsByTypeDto,
    SessionsByDeviceDto,
    SessionsByRoleDto,
    SessionsCreatedPerDayDto,
} from '../dto/security-dashboard.dto';

@Injectable()
export class SecurityChartsService {
    constructor(private readonly securityRepository: SecurityRepository) {}

    async getFailedLogins(): Promise<FailedLoginsChartDto[]> {
        return this.securityRepository.failedLoginChartData();
    }

    async getSecurityEventsByType(): Promise<SecurityEventsByTypeDto[]> {
        return this.securityRepository.securityEventsByTypeChartData();
    }

    async getSessionsByDevice(): Promise<SessionsByDeviceDto[]> {
        return this.securityRepository.sessionsByDeviceChartData();
    }

    async getSessionsByRole(): Promise<SessionsByRoleDto[]> {
        return this.securityRepository.sessionsByRoleChartData();
    }

    async getLoginTrend(): Promise<LoginTrendDto[]> {
        return this.securityRepository.loginTrendChartData();
    }

    async getReplayEvents(): Promise<ReplayEventsDto[]> {
        return this.securityRepository.replayEventsChartData();
    }

    async getLockedAccounts(): Promise<LockedAccountsDto[]> {
        return this.securityRepository.lockedAccountsChartData();
    }

    async getSessionsCreatedPerDay(): Promise<SessionsCreatedPerDayDto[]> {
        return this.securityRepository.sessionsCreatedPerDayChartData();
    }
}
