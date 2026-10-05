const { DataSource } = require('typeorm');
require('dotenv').config();

const ds = new DataSource({
  type: 'mssql',
  host: process.env.AUDIT_DB_HOST || process.env.DB_HOST,
  port: parseInt(process.env.AUDIT_DB_PORT || process.env.DB_PORT || '1433'),
  username: process.env.AUDIT_DB_USERNAME || process.env.DB_USERNAME,
  password: process.env.AUDIT_DB_PASSWORD || process.env.DB_PASSWORD,
  database: process.env.AUDIT_DB_DATABASE || 'DIEZ-AUDIT-DB',
  options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: true },
});

async function run() {
  await ds.initialize();
  
  try {
    await ds.query(`CREATE SCHEMA [audit];`);
    console.log('Created audit schema');
  } catch (e) {
    console.log('Audit schema may already exist:', e.message);
  }

  await ds.query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[audit].[Devices]') AND type in (N'U'))
    BEGIN
      CREATE TABLE [audit].[Devices] (
        DeviceID UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        device_fingerprint NVARCHAR(255) NOT NULL,
        ip_address NVARCHAR(50) NOT NULL,
        LastKnownIP NVARCHAR(50) NOT NULL,
        device_type NVARCHAR(50) NULL,
        browser_name NVARCHAR(100) NULL,
        OSName NVARCHAR(100) NULL,
        UserAgentRaw NVARCHAR(MAX) NULL,
        LastSeenAt DATETIME2 DEFAULT SYSUTCDATETIME(),
        SeenCount INT DEFAULT 1,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await ds.query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[audit].[Sessions]') AND type in (N'U'))
    BEGIN
      CREATE TABLE [audit].[Sessions] (
        SessionID UNIQUEIDENTIFIER PRIMARY KEY,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await ds.query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[audit].[ApiCallLog_Auth]') AND type in (N'U'))
    BEGIN
      CREATE TABLE [audit].[ApiCallLog_Auth] (
        ApiCallID UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        SessionID UNIQUEIDENTIFIER NULL,
        DeviceID UNIQUEIDENTIFIER NULL,
        ip_address NVARCHAR(50) NULL,
        device_fingerprint NVARCHAR(255) NULL,
        device_type NVARCHAR(50) NULL,
        browser_name NVARCHAR(100) NULL,
        OSName NVARCHAR(100) NULL,
        UserAgentRaw NVARCHAR(MAX) NULL,
        user_id UNIQUEIDENTIFIER NULL,
        Username NVARCHAR(255) NULL,
        HttpMethod NVARCHAR(10) NULL,
        Endpoint NVARCHAR(500) NULL,
        ControllerName NVARCHAR(100) NULL,
        ActionName NVARCHAR(100) NULL,
        AuthEventType NVARCHAR(100) NULL,
        TargetUserID UNIQUEIDENTIFIER NULL,
        HttpStatusCode INT NULL,
        IsSuccess BIT NULL,
        failure_reason NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await ds.query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[audit].[ApiCallLog_Org]') AND type in (N'U'))
    BEGIN
      CREATE TABLE [audit].[ApiCallLog_Org] (
        ApiCallID UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        SessionID UNIQUEIDENTIFIER NULL,
        DeviceID UNIQUEIDENTIFIER NULL,
        ip_address NVARCHAR(50) NULL,
        device_fingerprint NVARCHAR(255) NULL,
        device_type NVARCHAR(50) NULL,
        browser_name NVARCHAR(100) NULL,
        OSName NVARCHAR(100) NULL,
        UserAgentRaw NVARCHAR(MAX) NULL,
        user_id UNIQUEIDENTIFIER NULL,
        Username NVARCHAR(255) NULL,
        HttpMethod NVARCHAR(10) NULL,
        Endpoint NVARCHAR(500) NULL,
        ControllerName NVARCHAR(100) NULL,
        ActionName NVARCHAR(100) NULL,
        TargetEntityID UNIQUEIDENTIFIER NULL,
        TargetEntityType NVARCHAR(100) NULL,
        ActionType NVARCHAR(100) NULL,
        HttpStatusCode INT NULL,
        IsSuccess BIT NULL,
        failure_reason NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await ds.query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[audit].[ApiCallLog_Business]') AND type in (N'U'))
    BEGIN
      CREATE TABLE [audit].[ApiCallLog_Business] (
        ApiCallID UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        SessionID UNIQUEIDENTIFIER NULL,
        DeviceID UNIQUEIDENTIFIER NULL,
        ip_address NVARCHAR(50) NULL,
        device_fingerprint NVARCHAR(255) NULL,
        device_type NVARCHAR(50) NULL,
        browser_name NVARCHAR(100) NULL,
        OSName NVARCHAR(100) NULL,
        UserAgentRaw NVARCHAR(MAX) NULL,
        user_id UNIQUEIDENTIFIER NULL,
        Username NVARCHAR(255) NULL,
        HttpMethod NVARCHAR(10) NULL,
        Endpoint NVARCHAR(500) NULL,
        ControllerName NVARCHAR(100) NULL,
        ActionName NVARCHAR(100) NULL,
        TargetEntityID UNIQUEIDENTIFIER NULL,
        TargetEntityType NVARCHAR(100) NULL,
        ActionType NVARCHAR(100) NULL,
        HttpStatusCode INT NULL,
        IsSuccess BIT NULL,
        failure_reason NVARCHAR(MAX) NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  await ds.query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[audit].[ChangeLog_Auth]') AND type in (N'U'))
    BEGIN
      CREATE TABLE [audit].[ChangeLog_Auth] (
        ChangeLogID UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
        SessionID UNIQUEIDENTIFIER NULL,
        DeviceID UNIQUEIDENTIFIER NULL,
        ip_address NVARCHAR(50) NULL,
        device_fingerprint NVARCHAR(255) NULL,
        device_type NVARCHAR(50) NULL,
        browser_name NVARCHAR(100) NULL,
        OSName NVARCHAR(100) NULL,
        UserAgentRaw NVARCHAR(MAX) NULL,
        ApiCallID UNIQUEIDENTIFIER NULL,
        ChangedByUserID UNIQUEIDENTIFIER NULL,
        ChangedByUsername NVARCHAR(255) NULL,
        TableName NVARCHAR(150) NULL,
        EntityType NVARCHAR(150) NULL,
        EntityID UNIQUEIDENTIFIER NULL,
        AffectedUserID UNIQUEIDENTIFIER NULL,
        OperationType NVARCHAR(50) NULL,
        field_name NVARCHAR(150) NULL,
        OldValue NVARCHAR(MAX) NULL,
        NewValue NVARCHAR(MAX) NULL,
        RowSnapshotBefore NVARCHAR(MAX) NULL,
        RowSnapshotAfter NVARCHAR(MAX) NULL,
        ChangeCategory NVARCHAR(100) NULL,
        ChangeReason NVARCHAR(500) NULL,
        IsSystemChange BIT NULL,
        CreatedAt DATETIME2 DEFAULT SYSUTCDATETIME()
      );
    END
  `);

  console.log('Created missing audit tables successfully');
  await ds.destroy();
}
run().catch(console.error);
