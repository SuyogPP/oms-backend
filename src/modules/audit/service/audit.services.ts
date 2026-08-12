import { Injectable } from '@nestjs/common';
import { AuditRepository } from '../repositories/audit.repository';

@Injectable()
export class AuditService {
    constructor(
        private readonly auditRepository: AuditRepository,
    ) {}
    async logApiCall(data: {
    sessionId?: string | null;
    deviceFingerprint: string;
    ipAddress: string;
    deviceType?: string | null;
    browserName?: string | null;
    osName?: string | null;
    userAgentRaw?: string | null;
    userId?: string | null;
    username?: string | null;
    httpMethod: string;
    endpoint: string;
    controllerName?: string | null;
    actionName?: string | null;
    authEventType?: string | null;
    targetUserId?: string | null;
    httpStatusCode: number;
    isSuccess: boolean;
    failureReason?: string | null;
}) {

    const deviceId = await this.auditRepository.ensureDevice({
        deviceFingerprint: data.deviceFingerprint,
        ipAddress: data.ipAddress,
        deviceType: data.deviceType,
        browserName: data.browserName,
        osName: data.osName,
        userAgentRaw: data.userAgentRaw,
    });

    return this.auditRepository.logAuthApiCall({
        ...data,
        deviceId,
    });
}

    async logUserCreated(data: {
        userId: string;
        username: string;
        email: string;
        ipAddress?: string;
        userAgent?: string;
    }) {
        const deviceFingerprint = data.userAgent ?? 'UNKNOWN_DEVICE';
        const ipAddress = data.ipAddress ?? '0.0.0.0';

        const deviceId = await this.auditRepository.ensureDevice({
            deviceFingerprint,
            ipAddress,
            deviceType: 'UNKNOWN',
            browserName: null,
            osName: null,
            userAgentRaw: data.userAgent ?? null,
        });

        const apiCallId = await this.auditRepository.logAuthApiCall({
            sessionId: null,
            deviceId,
            deviceFingerprint,
            ipAddress,
            deviceType: 'UNKNOWN',
            browserName: null,
            osName: null,
            userAgentRaw: data.userAgent ?? null,
            userId: null,
            username: null,
            httpMethod: 'POST',
            endpoint: '/api/authorization/users',
            controllerName: 'UsersController',
            actionName: 'create',
            authEventType: 'USER_CREATED',
            targetUserId: data.userId,
            httpStatusCode: 201,
            isSuccess: true,
        });

        await this.auditRepository.logAuthChange({
            sessionId: null,
            deviceId,
            deviceFingerprint,
            ipAddress,
            deviceType: 'UNKNOWN',
            browserName: null,
            osName: null,
            userAgentRaw: data.userAgent ?? null,
            apiCallId,
            changedByUserId: null,
            changedByUsername: null,
            tableName: 'Users',
            entityType: 'USER',
            entityId: data.userId,
            affectedUserId: data.userId,
            operationType: 'INSERT',
            fieldName: null,
            oldValue: null,
            newValue: null,
            rowSnapshotBefore: null,
            rowSnapshotAfter: JSON.stringify({
                userId: data.userId,
                username: data.username,
                email: data.email,
            }),
            changeCategory: 'IDENTITY_CHANGE',
            changeReason: 'User created',
            isSystemChange: false,
        });
    }

    async logUserDeleted(data: {
        userId: string;
        ipAddress?: string;
        userAgent?: string;
    }) {
        const deviceFingerprint = data.userAgent ?? 'UNKNOWN_DEVICE';
        const ipAddress = data.ipAddress ?? '0.0.0.0';

        const deviceId = await this.auditRepository.ensureDevice({
            deviceFingerprint,
            ipAddress,
            deviceType: 'UNKNOWN',
            browserName: null,
            osName: null,
            userAgentRaw: data.userAgent ?? null,
        });

        const apiCallId = await this.auditRepository.logAuthApiCall({
            sessionId: null,
            deviceId,
            deviceFingerprint,
            ipAddress,
            deviceType: 'UNKNOWN',
            browserName: null,
            osName: null,
            userAgentRaw: data.userAgent ?? null,
            userId: null,
            username: null,
            httpMethod: 'DELETE',
            endpoint: `/api/authorization/users/${data.userId}`,
            controllerName: 'UsersController',
            actionName: 'remove',
            authEventType: 'USER_DELETED',
            targetUserId: data.userId,
            httpStatusCode: 200,
            isSuccess: true,
        });

        await this.auditRepository.logAuthChange({
            sessionId: null,
            deviceId,
            deviceFingerprint,
            ipAddress,
            deviceType: 'UNKNOWN',
            browserName: null,
            osName: null,
            userAgentRaw: data.userAgent ?? null,
            apiCallId,
            changedByUserId: null,
            changedByUsername: null,
            tableName: 'Users',
            entityType: 'USER',
            entityId: data.userId,
            affectedUserId: data.userId,
            operationType: 'SOFT_DELETE',
            fieldName: 'IsDeleted',
            oldValue: '0',
            newValue: '1',
            rowSnapshotBefore: null,
            rowSnapshotAfter: null,
            changeCategory: 'IDENTITY_CHANGE',
            changeReason: 'User soft deleted',
            isSystemChange: false,
        });
    }
    async logUserCreatedChange(data: {
    userId: string;
    username: string;
    email: string;
}) {
    const deviceFingerprint = 'SYSTEM_CHANGE';
    const ipAddress = '0.0.0.0';

    const deviceId = await this.auditRepository.ensureDevice({
        deviceFingerprint,
        ipAddress,
        deviceType: 'UNKNOWN',
        browserName: null,
        osName: null,
        userAgentRaw: null,
    });

    await this.auditRepository.logAuthChange({
        sessionId: null,
        deviceId,
        deviceFingerprint,
        ipAddress,
        deviceType: 'UNKNOWN',
        browserName: null,
        osName: null,
        userAgentRaw: null,
        apiCallId: null,
        changedByUserId: null,
        changedByUsername: null,
        tableName: 'Users',
        entityType: 'USER',
        entityId: data.userId,
        affectedUserId: data.userId,
        operationType: 'INSERT',
        fieldName: null,
        oldValue: null,
        newValue: null,
        rowSnapshotBefore: null,
        rowSnapshotAfter: JSON.stringify({
            userId: data.userId,
            username: data.username,
            email: data.email,
        }),
        changeCategory: 'IDENTITY_CHANGE',
        changeReason: 'User created',
        isSystemChange: false,
    });
}

async logUserDeletedChange(data: {
    userId: string;
}) {
    const deviceFingerprint = 'SYSTEM_CHANGE';
    const ipAddress = '0.0.0.0';

    const deviceId = await this.auditRepository.ensureDevice({
        deviceFingerprint,
        ipAddress,
        deviceType: 'UNKNOWN',
        browserName: null,
        osName: null,
        userAgentRaw: null,
    });

    await this.auditRepository.logAuthChange({
        sessionId: null,
        deviceId,
        deviceFingerprint,
        ipAddress,
        deviceType: 'UNKNOWN',
        browserName: null,
        osName: null,
        userAgentRaw: null,
        apiCallId: null,
        changedByUserId: null,
        changedByUsername: null,
        tableName: 'Users',
        entityType: 'USER',
        entityId: data.userId,
        affectedUserId: data.userId,
        operationType: 'SOFT_DELETE',
        fieldName: 'IsDeleted',
        oldValue: '0',
        newValue: '1',
        rowSnapshotBefore: null,
        rowSnapshotAfter: null,
        changeCategory: 'IDENTITY_CHANGE',
        changeReason: 'User soft deleted',
        isSystemChange: false,
    });
}



}