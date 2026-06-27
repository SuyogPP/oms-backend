import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AuditRepository {
    constructor(
        private readonly dataSource: DataSource,
    ) {}

    async ensureDevice(data: {
        deviceFingerprint: string;
        ipAddress: string;
        deviceType?: string | null;
        browserName?: string | null;
        osName?: string | null;
        userAgentRaw?: string | null;
    }) {
        const existingDevice = await this.dataSource.query(
            `
            SELECT DeviceID
            FROM [OMS_Audit_DB].[audit].[Devices]
            WHERE DeviceFingerprint = @0
            `,
            [data.deviceFingerprint],
        );

        if (existingDevice.length > 0) {
            const deviceId = existingDevice[0].DeviceID;

            await this.dataSource.query(
                `
                UPDATE [OMS_Audit_DB].[audit].[Devices]
                SET
                    LastSeenAt = SYSUTCDATETIME(),
                    LastKnownIP = @1,
                    SeenCount = SeenCount + 1,
                    DeviceType = @2,
                    BrowserName = @3,
                    OSName = @4,
                    UserAgentRaw = @5
                WHERE DeviceID = @0
                `,
                [
                    deviceId,
                    data.ipAddress,
                    data.deviceType ?? 'UNKNOWN',
                    data.browserName ?? null,
                    data.osName ?? null,
                    data.userAgentRaw ?? null,
                ],
            );

            return deviceId;
        }

        const result = await this.dataSource.query(
            `
            INSERT INTO [OMS_Audit_DB].[audit].[Devices]
            (
                DeviceFingerprint,
                IPAddress,
                LastKnownIP,
                DeviceType,
                BrowserName,
                OSName,
                UserAgentRaw
            )
            OUTPUT INSERTED.DeviceID
            VALUES
            (
                @0,
                @1,
                @1,
                @2,
                @3,
                @4,
                @5
            )
            `,
            [
                data.deviceFingerprint,
                data.ipAddress,
                data.deviceType ?? 'UNKNOWN',
                data.browserName ?? null,
                data.osName ?? null,
                data.userAgentRaw ?? null,
            ],
        );

        return result[0].DeviceID;
    }

    async logAuthApiCall(data: {
        sessionId?: string | null;
        deviceId: string;
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
        const result = await this.dataSource.query(
            `
            INSERT INTO [OMS_Audit_DB].[audit].[ApiCallLog_Auth]
            (
                SessionID,
                DeviceID,
                IPAddress,
                DeviceFingerprint,
                DeviceType,
                BrowserName,
                OSName,
                UserAgentRaw,
                UserID,
                Username,
                HttpMethod,
                Endpoint,
                ControllerName,
                ActionName,
                AuthEventType,
                TargetUserID,
                HttpStatusCode,
                IsSuccess,
                FailureReason
            )
            OUTPUT INSERTED.ApiCallID
            VALUES
            (
                @0,
                @1,
                @2,
                @3,
                @4,
                @5,
                @6,
                @7,
                @8,
                @9,
                @10,
                @11,
                @12,
                @13,
                @14,
                @15,
                @16,
                @17,
                @18
            )
            `,
            [
                data.sessionId ?? null,
                data.deviceId,
                data.ipAddress,
                data.deviceFingerprint,
                data.deviceType ?? null,
                data.browserName ?? null,
                data.osName ?? null,
                data.userAgentRaw ?? null,
                data.userId ?? null,
                data.username ?? null,
                data.httpMethod,
                data.endpoint,
                data.controllerName ?? null,
                data.actionName ?? null,
                data.authEventType ?? null,
                data.targetUserId ?? null,
                data.httpStatusCode,
                data.isSuccess ? 1 : 0,
                data.failureReason ?? null,
            ],
        );

        return result[0].ApiCallID;
    }

    async logAuthChange(data: {
        sessionId?: string | null;
        deviceId: string;
        deviceFingerprint: string;
        ipAddress: string;
        deviceType?: string | null;
        browserName?: string | null;
        osName?: string | null;
        userAgentRaw?: string | null;
        apiCallId?: string | null;
        changedByUserId?: string | null;
        changedByUsername?: string | null;
        tableName: string;
        entityType: string;
        entityId: string;
        affectedUserId?: string | null;
        operationType: string;
        fieldName?: string | null;
        oldValue?: string | null;
        newValue?: string | null;
        rowSnapshotBefore?: string | null;
        rowSnapshotAfter?: string | null;
        changeCategory?: string | null;
        changeReason?: string | null;
        isSystemChange?: boolean;
    }) {
        await this.dataSource.query(
            `
            INSERT INTO [OMS_Audit_DB].[audit].[ChangeLog_Auth]
            (
                SessionID,
                DeviceID,
                IPAddress,
                DeviceFingerprint,
                DeviceType,
                BrowserName,
                OSName,
                UserAgentRaw,
                ApiCallID,
                ChangedByUserID,
                ChangedByUsername,
                TableName,
                EntityType,
                EntityID,
                AffectedUserID,
                OperationType,
                FieldName,
                OldValue,
                NewValue,
                RowSnapshotBefore,
                RowSnapshotAfter,
                ChangeCategory,
                ChangeReason,
                IsSystemChange
            )
            VALUES
            (
                @0,
                @1,
                @2,
                @3,
                @4,
                @5,
                @6,
                @7,
                @8,
                @9,
                @10,
                @11,
                @12,
                @13,
                @14,
                @15,
                @16,
                @17,
                @18,
                @19,
                @20,
                @21,
                @22,
                @23
            )
            `,
            [
                data.sessionId ?? null,
                data.deviceId,
                data.ipAddress,
                data.deviceFingerprint,
                data.deviceType ?? null,
                data.browserName ?? null,
                data.osName ?? null,
                data.userAgentRaw ?? null,
                data.apiCallId ?? null,
                data.changedByUserId ?? null,
                data.changedByUsername ?? null,
                data.tableName,
                data.entityType,
                data.entityId,
                data.affectedUserId ?? null,
                data.operationType,
                data.fieldName ?? null,
                data.oldValue ?? null,
                data.newValue ?? null,
                data.rowSnapshotBefore ?? null,
                data.rowSnapshotAfter ?? null,
                data.changeCategory ?? null,
                data.changeReason ?? null,
                data.isSystemChange ? 1 : 0,
            ],
        );
    }
}