-- ====================================================================================================
-- DIEZ Outsource Management System (OMS) — Database Migration Script
-- Domain 2: Organization Structure
--
-- Target Database : OMS_DB_Prod
-- Target Schema   : org
-- Reference Specs : docs/DOMAIN-2-ORGANIZATION-STRUCTURE.md
-- Reconciliation  : docs/DOMAIN-2-RECONCILIATION.md
--
-- SUBSTITUTED VALUES (Verified against live auth tables):
--   * Seed System / Admin User ID : 1053433E-F36B-1410-85ED-009A959FB122 (Username: 'admin')
--   * Role ID - SYSTEM_ADMIN      : 2B850D65-CBC0-4071-9B90-694042F7338F
--   * Role ID - HR                : 6B2E9347-3D18-4F74-B46B-A0AF4D442F02
--   * Role ID - FINANCE           : F9FD28DA-1C14-4699-B5FA-0DA983A9A3A2
--   * Role ID - HOD               : D8C2BD36-6047-4E77-8290-055BE5D4C8FC
--
-- EXECUTION INSTRUCTIONS:
--   Run manually in SQL Server Management Studio (SSMS) or sqlcmd against OMS_DB_Prod.
--   Each block is guarded with existence checks and separated by GO batches for idempotent execution.
--
-- SCRIPT STRUCTURE:
--   [BLOCK 1] Schema Creation ('org')
--   [BLOCK 2] auth.UserOrganizationScopes Reconciliation (Add OrgUnitId + Index)
--   [BLOCK 3] Core Tables DDL (Types, Rules, Units, Closure, Managers, ChangeLog, Assignments)
--   [BLOCK 4] Non-Clustered & Filtered Performance Indexes
--   [BLOCK 5] Inline TVF: org.fn_VisibleOrgUnits (Layer 3 Scope Resolution)
--   [BLOCK 6] Permissions & Role Grants (auth.Permissions, auth.RolePermissions)
--   [BLOCK 7] Seed Data (Unit Types, Hierarchy Rules, Root DIEZ Node, Closure Root)
--   [BLOCK 8] Integrity Verification Query (Must return 0 rows)
-- ====================================================================================================

USE [OMS_DB_Prod];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ====================================================================================================
-- [BLOCK 1] Schema Creation ('org')
-- ====================================================================================================
PRINT '>>> [BLOCK 1] Initializing schema [org]...';
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'org')
BEGIN
    EXEC('CREATE SCHEMA org AUTHORIZATION dbo;');
    PRINT '    [+] Created schema [org].';
END
ELSE
BEGIN
    PRINT '    [-] Schema [org] already exists.';
END
GO


-- ====================================================================================================
-- [BLOCK 2] auth.UserOrganizationScopes Reconciliation (§11.2 Option a)
-- Adds unified OrgUnitId column, backfills from legacy columns, and builds seek index.
-- ====================================================================================================
PRINT '>>> [BLOCK 2] Reconciling [auth].[UserOrganizationScopes]...';

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'auth' 
      AND TABLE_NAME = 'UserOrganizationScopes' 
      AND COLUMN_NAME = 'OrgUnitId'
)
BEGIN
    ALTER TABLE [auth].[UserOrganizationScopes]
    ADD [OrgUnitId] UNIQUEIDENTIFIER NULL;
    PRINT '    [+] Added column [OrgUnitId] to [auth].[UserOrganizationScopes].';
END
ELSE
BEGIN
    PRINT '    [-] Column [OrgUnitId] already exists in [auth].[UserOrganizationScopes].';
END
GO

-- Backfill OrgUnitId from legacy columns where available
UPDATE [auth].[UserOrganizationScopes]
SET [OrgUnitId] = COALESCE([SectionID], [DepartmentID], [BusinessUnitID], [OrganizationID])
WHERE [OrgUnitId] IS NULL 
  AND COALESCE([SectionID], [DepartmentID], [BusinessUnitID], [OrganizationID]) IS NOT NULL;
GO

-- Create optimized index for Layer 3 Scope Resolution
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_UserOrganizationScopes_User_OrgUnit' 
      AND object_id = OBJECT_ID('auth.UserOrganizationScopes')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_UserOrganizationScopes_User_OrgUnit]
    ON [auth].[UserOrganizationScopes] ([UserID], [OrgUnitId])
    INCLUDE ([ScopeDefinitionID])
    WHERE [OrgUnitId] IS NOT NULL;
    PRINT '    [+] Created index [IX_UserOrganizationScopes_User_OrgUnit].';
END
ELSE
BEGIN
    PRINT '    [-] Index [IX_UserOrganizationScopes_User_OrgUnit] already exists.';
END
GO


-- ====================================================================================================
-- [BLOCK 3] Core Tables DDL
-- ====================================================================================================
PRINT '>>> [BLOCK 3] Creating Domain 2 tables...';

-- 3.1 org.OrgUnitTypes
IF OBJECT_ID('org.OrgUnitTypes', 'U') IS NULL
BEGIN
    CREATE TABLE org.OrgUnitTypes (
        OrgUnitTypeId       TINYINT             NOT NULL,
        Code                VARCHAR(30)         NOT NULL,
        Name                NVARCHAR(100)       NOT NULL,
        NameAr              NVARCHAR(100)       NULL,
        Description         NVARCHAR(500)       NULL,
        CanonicalLevel      TINYINT             NOT NULL,
        ScopeLevelCode      VARCHAR(30)         NOT NULL,
        AllowsBudget        BIT                 NOT NULL CONSTRAINT DF_OrgUnitTypes_AllowsBudget      DEFAULT (0),
        AllowsRequisition   BIT                 NOT NULL CONSTRAINT DF_OrgUnitTypes_AllowsRequisition DEFAULT (0),
        AllowsManager       BIT                 NOT NULL CONSTRAINT DF_OrgUnitTypes_AllowsManager     DEFAULT (1),
        IsRootType          BIT                 NOT NULL CONSTRAINT DF_OrgUnitTypes_IsRootType        DEFAULT (0),
        SortOrder           SMALLINT            NOT NULL CONSTRAINT DF_OrgUnitTypes_SortOrder         DEFAULT (0),
        IsActive            BIT                 NOT NULL CONSTRAINT DF_OrgUnitTypes_IsActive          DEFAULT (1),
        IsDeleted           BIT                 NOT NULL CONSTRAINT DF_OrgUnitTypes_IsDeleted         DEFAULT (0),
        CreatedBy           UNIQUEIDENTIFIER    NULL,
        CreatedAt           DATETIME2(3)        NOT NULL CONSTRAINT DF_OrgUnitTypes_CreatedAt         DEFAULT (SYSUTCDATETIME()),
        UpdatedBy           UNIQUEIDENTIFIER    NULL,
        UpdatedAt           DATETIME2(3)        NULL,

        CONSTRAINT PK_OrgUnitTypes      PRIMARY KEY CLUSTERED (OrgUnitTypeId),
        CONSTRAINT UQ_OrgUnitTypes_Code UNIQUE (Code)
    );
    PRINT '    [+] Created table [org].[OrgUnitTypes].';
END
ELSE
BEGIN
    PRINT '    [-] Table [org].[OrgUnitTypes] already exists.';
END
GO

-- 3.2 org.OrgUnitTypeHierarchyRules
IF OBJECT_ID('org.OrgUnitTypeHierarchyRules', 'U') IS NULL
BEGIN
    CREATE TABLE org.OrgUnitTypeHierarchyRules (
        ChildOrgUnitTypeId  TINYINT             NOT NULL,
        ParentOrgUnitTypeId TINYINT             NOT NULL,
        IsActive            BIT                 NOT NULL CONSTRAINT DF_OUTHR_IsActive  DEFAULT (1),
        CreatedBy           UNIQUEIDENTIFIER    NULL,
        CreatedAt           DATETIME2(3)        NOT NULL CONSTRAINT DF_OUTHR_CreatedAt DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT PK_OrgUnitTypeHierarchyRules PRIMARY KEY CLUSTERED (ChildOrgUnitTypeId, ParentOrgUnitTypeId),
        CONSTRAINT FK_OUTHR_Child  FOREIGN KEY (ChildOrgUnitTypeId)  REFERENCES org.OrgUnitTypes (OrgUnitTypeId),
        CONSTRAINT FK_OUTHR_Parent FOREIGN KEY (ParentOrgUnitTypeId) REFERENCES org.OrgUnitTypes (OrgUnitTypeId)
    );
    PRINT '    [+] Created table [org].[OrgUnitTypeHierarchyRules].';
END
ELSE
BEGIN
    PRINT '    [-] Table [org].[OrgUnitTypeHierarchyRules] already exists.';
END
GO

-- 3.3 org.OrgUnits
IF OBJECT_ID('org.OrgUnits', 'U') IS NULL
BEGIN
    CREATE TABLE org.OrgUnits (
        OrgUnitId           UNIQUEIDENTIFIER    NOT NULL CONSTRAINT DF_OrgUnits_OrgUnitId DEFAULT (NEWSEQUENTIALID()),
        OrgUnitTypeId       TINYINT             NOT NULL,
        ParentOrgUnitId     UNIQUEIDENTIFIER    NULL,

        Code                VARCHAR(50)         NOT NULL,
        Name                NVARCHAR(200)       NOT NULL,
        NameAr              NVARCHAR(200)       NULL,
        ShortName           NVARCHAR(50)        NULL,
        Description         NVARCHAR(1000)      NULL,

        MaterializedPath    VARCHAR(900)        NOT NULL,
        Depth               TINYINT             NOT NULL CONSTRAINT DF_OrgUnits_Depth DEFAULT (0),

        -- Integration keys
        CostCenterCode      VARCHAR(50)         NULL,
        ADObjectGuid        UNIQUEIDENTIFIER    NULL,
        ADDistinguishedName NVARCHAR(500)       NULL,
        OracleOrgCode       VARCHAR(50)         NULL,

        HeadUserId          UNIQUEIDENTIFIER    NULL,

        EmailAddress        NVARCHAR(256)       NULL,
        PhoneNumber         VARCHAR(30)         NULL,

        SortOrder           SMALLINT            NOT NULL CONSTRAINT DF_OrgUnits_SortOrder DEFAULT (0),

        EffectiveFrom       DATE                NOT NULL CONSTRAINT DF_OrgUnits_EffectiveFrom DEFAULT (CAST(SYSUTCDATETIME() AS DATE)),
        EffectiveTo         DATE                NULL,

        IsActive            BIT                 NOT NULL CONSTRAINT DF_OrgUnits_IsActive  DEFAULT (1),
        IsDeleted           BIT                 NOT NULL CONSTRAINT DF_OrgUnits_IsDeleted DEFAULT (0),

        CreatedBy           UNIQUEIDENTIFIER    NULL,
        CreatedAt           DATETIME2(3)        NOT NULL CONSTRAINT DF_OrgUnits_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedBy           UNIQUEIDENTIFIER    NULL,
        UpdatedAt           DATETIME2(3)        NULL,
        DeletedBy           UNIQUEIDENTIFIER    NULL,
        DeletedAt           DATETIME2(3)        NULL,

        RowVersion          ROWVERSION          NOT NULL,

        CONSTRAINT PK_OrgUnits            PRIMARY KEY CLUSTERED (OrgUnitId),
        CONSTRAINT FK_OrgUnits_Type       FOREIGN KEY (OrgUnitTypeId)   REFERENCES org.OrgUnitTypes (OrgUnitTypeId),
        CONSTRAINT FK_OrgUnits_Parent     FOREIGN KEY (ParentOrgUnitId) REFERENCES org.OrgUnits (OrgUnitId),
        CONSTRAINT FK_OrgUnits_HeadUser   FOREIGN KEY (HeadUserId)      REFERENCES auth.Users (UserID),
        CONSTRAINT CK_OrgUnits_NoSelf     CHECK (ParentOrgUnitId IS NULL OR ParentOrgUnitId <> OrgUnitId),
        CONSTRAINT CK_OrgUnits_Effective  CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
    );
    PRINT '    [+] Created table [org].[OrgUnits].';
END
ELSE
BEGIN
    PRINT '    [-] Table [org].[OrgUnits] already exists.';
END
GO

-- 3.4 org.OrgUnitClosure
IF OBJECT_ID('org.OrgUnitClosure', 'U') IS NULL
BEGIN
    CREATE TABLE org.OrgUnitClosure (
        AncestorOrgUnitId   UNIQUEIDENTIFIER    NOT NULL,
        DescendantOrgUnitId UNIQUEIDENTIFIER    NOT NULL,
        Depth               TINYINT             NOT NULL,

        CONSTRAINT PK_OrgUnitClosure PRIMARY KEY CLUSTERED (AncestorOrgUnitId, DescendantOrgUnitId),
        CONSTRAINT FK_OrgUnitClosure_Ancestor   FOREIGN KEY (AncestorOrgUnitId)   REFERENCES org.OrgUnits (OrgUnitId),
        CONSTRAINT FK_OrgUnitClosure_Descendant FOREIGN KEY (DescendantOrgUnitId) REFERENCES org.OrgUnits (OrgUnitId)
    );
    PRINT '    [+] Created table [org].[OrgUnitClosure].';
END
ELSE
BEGIN
    PRINT '    [-] Table [org].[OrgUnitClosure] already exists.';
END
GO

-- 3.5 org.OrgUnitManagers
IF OBJECT_ID('org.OrgUnitManagers', 'U') IS NULL
BEGIN
    CREATE TABLE org.OrgUnitManagers (
        OrgUnitManagerId    UNIQUEIDENTIFIER    NOT NULL CONSTRAINT DF_OrgUnitManagers_Id DEFAULT (NEWSEQUENTIALID()),
        OrgUnitId           UNIQUEIDENTIFIER    NOT NULL,
        UserId              UNIQUEIDENTIFIER    NOT NULL,

        -- HEAD | DEPUTY | ACTING
        ManagerRoleCode     VARCHAR(30)         NOT NULL,
        IsPrimary           BIT                 NOT NULL CONSTRAINT DF_OrgUnitManagers_IsPrimary DEFAULT (0),

        EffectiveFrom       DATE                NOT NULL,
        EffectiveTo         DATE                NULL,

        AssignmentReason    NVARCHAR(500)       NULL,

        IsActive            BIT                 NOT NULL CONSTRAINT DF_OrgUnitManagers_IsActive  DEFAULT (1),
        IsDeleted           BIT                 NOT NULL CONSTRAINT DF_OrgUnitManagers_IsDeleted DEFAULT (0),

        CreatedBy           UNIQUEIDENTIFIER    NULL,
        CreatedAt           DATETIME2(3)        NOT NULL CONSTRAINT DF_OrgUnitManagers_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedBy           UNIQUEIDENTIFIER    NULL,
        UpdatedAt           DATETIME2(3)        NULL,
        DeletedBy           UNIQUEIDENTIFIER    NULL,
        DeletedAt           DATETIME2(3)        NULL,

        CONSTRAINT PK_OrgUnitManagers      PRIMARY KEY CLUSTERED (OrgUnitManagerId),
        CONSTRAINT FK_OrgUnitManagers_Unit FOREIGN KEY (OrgUnitId) REFERENCES org.OrgUnits (OrgUnitId),
        CONSTRAINT FK_OrgUnitManagers_User FOREIGN KEY (UserId)    REFERENCES auth.Users (UserID),
        CONSTRAINT CK_OrgUnitManagers_Role CHECK (ManagerRoleCode IN ('HEAD','DEPUTY','ACTING')),
        CONSTRAINT CK_OrgUnitManagers_Eff  CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
    );
    PRINT '    [+] Created table [org].[OrgUnitManagers].';
END
ELSE
BEGIN
    PRINT '    [-] Table [org].[OrgUnitManagers] already exists.';
END
GO

-- 3.6 org.OrgUnitChangeLog
IF OBJECT_ID('org.OrgUnitChangeLog', 'U') IS NULL
BEGIN
    CREATE TABLE org.OrgUnitChangeLog (
        OrgUnitChangeLogId  BIGINT              IDENTITY(1,1) NOT NULL,
        OrgUnitId           UNIQUEIDENTIFIER    NOT NULL,
        ChangeType          VARCHAR(30)         NOT NULL,

        OldParentOrgUnitId  UNIQUEIDENTIFIER    NULL,
        NewParentOrgUnitId  UNIQUEIDENTIFIER    NULL,
        OldValues           NVARCHAR(MAX)       NULL,
        NewValues           NVARCHAR(MAX)       NULL,
        AffectedNodeCount   INT                 NULL,
        Reason              NVARCHAR(1000)      NULL,

        CorrelationId       UNIQUEIDENTIFIER    NULL,
        IPAddress           VARCHAR(45)         NULL,
        UserAgent           NVARCHAR(500)       NULL,

        PerformedBy         UNIQUEIDENTIFIER    NULL,
        PerformedAt         DATETIME2(3)        NOT NULL CONSTRAINT DF_OrgUnitChangeLog_At DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT PK_OrgUnitChangeLog PRIMARY KEY CLUSTERED (OrgUnitChangeLogId),
        CONSTRAINT CK_OrgUnitChangeLog_Json CHECK (
            (OldValues IS NULL OR ISJSON(OldValues) = 1) AND
            (NewValues IS NULL OR ISJSON(NewValues) = 1)
        )
    );
    PRINT '    [+] Created table [org].[OrgUnitChangeLog].';
END
ELSE
BEGIN
    PRINT '    [-] Table [org].[OrgUnitChangeLog] already exists.';
END
GO

-- 3.7 org.UserOrgUnitAssignments
IF OBJECT_ID('org.UserOrgUnitAssignments', 'U') IS NULL
BEGIN
    CREATE TABLE org.UserOrgUnitAssignments (
        UserOrgUnitAssignmentId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_UOUA_Id DEFAULT (NEWSEQUENTIALID()),
        UserId                  UNIQUEIDENTIFIER NOT NULL,
        OrgUnitId               UNIQUEIDENTIFIER NOT NULL,
        IsPrimary               BIT              NOT NULL CONSTRAINT DF_UOUA_IsPrimary DEFAULT (1),
        EffectiveFrom           DATE             NOT NULL,
        EffectiveTo             DATE             NULL,
        IsActive                BIT              NOT NULL CONSTRAINT DF_UOUA_IsActive  DEFAULT (1),
        IsDeleted               BIT              NOT NULL CONSTRAINT DF_UOUA_IsDeleted DEFAULT (0),
        CreatedBy               UNIQUEIDENTIFIER NULL,
        CreatedAt               DATETIME2(3)     NOT NULL CONSTRAINT DF_UOUA_CreatedAt DEFAULT (SYSUTCDATETIME()),
        UpdatedBy               UNIQUEIDENTIFIER NULL,
        UpdatedAt               DATETIME2(3)     NULL,
        DeletedBy               UNIQUEIDENTIFIER NULL,
        DeletedAt               DATETIME2(3)     NULL,

        CONSTRAINT PK_UserOrgUnitAssignments PRIMARY KEY CLUSTERED (UserOrgUnitAssignmentId),
        CONSTRAINT FK_UOUA_User    FOREIGN KEY (UserId)    REFERENCES auth.Users (UserID),
        CONSTRAINT FK_UOUA_OrgUnit FOREIGN KEY (OrgUnitId) REFERENCES org.OrgUnits (OrgUnitId),
        CONSTRAINT CK_UOUA_Eff     CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
    );
    PRINT '    [+] Created table [org].[UserOrgUnitAssignments].';
END
ELSE
BEGIN
    PRINT '    [-] Table [org].[UserOrgUnitAssignments] already exists.';
END
GO


-- ====================================================================================================
-- [BLOCK 4] Non-Clustered & Filtered Performance Indexes
-- ====================================================================================================
PRINT '>>> [BLOCK 4] Building performance indexes...';

-- UX_OrgUnits_Parent_Code (Sibling Code Uniqueness)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OrgUnits_Parent_Code' AND object_id = OBJECT_ID('org.OrgUnits'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_OrgUnits_Parent_Code
    ON org.OrgUnits (ParentOrgUnitId, Code)
    WHERE IsDeleted = 0 AND ParentOrgUnitId IS NOT NULL;
    PRINT '    [+] Created index [UX_OrgUnits_Parent_Code].';
END
GO

-- UX_OrgUnits_Root_Code (Root Level Code Uniqueness)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OrgUnits_Root_Code' AND object_id = OBJECT_ID('org.OrgUnits'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_OrgUnits_Root_Code
    ON org.OrgUnits (Code)
    WHERE IsDeleted = 0 AND ParentOrgUnitId IS NULL;
    PRINT '    [+] Created index [UX_OrgUnits_Root_Code].';
END
GO

-- IX_OrgUnits_Parent
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrgUnits_Parent' AND object_id = OBJECT_ID('org.OrgUnits'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_OrgUnits_Parent
    ON org.OrgUnits (ParentOrgUnitId)
    INCLUDE (OrgUnitTypeId, Name, SortOrder, IsActive)
    WHERE IsDeleted = 0;
    PRINT '    [+] Created index [IX_OrgUnits_Parent].';
END
GO

-- IX_OrgUnits_Type
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrgUnits_Type' AND object_id = OBJECT_ID('org.OrgUnits'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_OrgUnits_Type
    ON org.OrgUnits (OrgUnitTypeId)
    INCLUDE (Name, Code, ParentOrgUnitId)
    WHERE IsDeleted = 0;
    PRINT '    [+] Created index [IX_OrgUnits_Type].';
END
GO

-- IX_OrgUnits_Path
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrgUnits_Path' AND object_id = OBJECT_ID('org.OrgUnits'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_OrgUnits_Path
    ON org.OrgUnits (MaterializedPath)
    WHERE IsDeleted = 0;
    PRINT '    [+] Created index [IX_OrgUnits_Path].';
END
GO

-- IX_OrgUnits_Head
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrgUnits_Head' AND object_id = OBJECT_ID('org.OrgUnits'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_OrgUnits_Head
    ON org.OrgUnits (HeadUserId)
    WHERE IsDeleted = 0 AND HeadUserId IS NOT NULL;
    PRINT '    [+] Created index [IX_OrgUnits_Head].';
END
GO

-- IX_OrgUnits_CostCentre
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrgUnits_CostCentre' AND object_id = OBJECT_ID('org.OrgUnits'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_OrgUnits_CostCentre
    ON org.OrgUnits (CostCenterCode)
    WHERE IsDeleted = 0 AND CostCenterCode IS NOT NULL;
    PRINT '    [+] Created index [IX_OrgUnits_CostCentre].';
END
GO

-- UX_OrgUnits_ADObjectGuid
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_OrgUnits_ADObjectGuid' AND object_id = OBJECT_ID('org.OrgUnits'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_OrgUnits_ADObjectGuid
    ON org.OrgUnits (ADObjectGuid)
    WHERE IsDeleted = 0 AND ADObjectGuid IS NOT NULL;
    PRINT '    [+] Created index [UX_OrgUnits_ADObjectGuid].';
END
GO

-- IX_OrgUnitClosure_Descendant (Reverse Lookup: Ancestors of Node)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrgUnitClosure_Descendant' AND object_id = OBJECT_ID('org.OrgUnitClosure'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_OrgUnitClosure_Descendant
    ON org.OrgUnitClosure (DescendantOrgUnitId, Depth)
    INCLUDE (AncestorOrgUnitId);
    PRINT '    [+] Created index [IX_OrgUnitClosure_Descendant].';
END
GO

-- IX_OrgUnitManagers_Unit
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrgUnitManagers_Unit' AND object_id = OBJECT_ID('org.OrgUnitManagers'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_OrgUnitManagers_Unit
    ON org.OrgUnitManagers (OrgUnitId, ManagerRoleCode, EffectiveFrom, EffectiveTo)
    INCLUDE (UserId, IsPrimary)
    WHERE IsDeleted = 0 AND IsActive = 1;
    PRINT '    [+] Created index [IX_OrgUnitManagers_Unit].';
END
GO

-- IX_OrgUnitManagers_User
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrgUnitManagers_User' AND object_id = OBJECT_ID('org.OrgUnitManagers'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_OrgUnitManagers_User
    ON org.OrgUnitManagers (UserId)
    INCLUDE (OrgUnitId, ManagerRoleCode)
    WHERE IsDeleted = 0 AND IsActive = 1;
    PRINT '    [+] Created index [IX_OrgUnitManagers_User].';
END
GO

-- IX_OrgUnitChangeLog_Unit
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrgUnitChangeLog_Unit' AND object_id = OBJECT_ID('org.OrgUnitChangeLog'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_OrgUnitChangeLog_Unit
    ON org.OrgUnitChangeLog (OrgUnitId, PerformedAt DESC);
    PRINT '    [+] Created index [IX_OrgUnitChangeLog_Unit].';
END
GO

-- IX_OrgUnitChangeLog_At
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrgUnitChangeLog_At' AND object_id = OBJECT_ID('org.OrgUnitChangeLog'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_OrgUnitChangeLog_At
    ON org.OrgUnitChangeLog (PerformedAt DESC);
    PRINT '    [+] Created index [IX_OrgUnitChangeLog_At].';
END
GO

-- IX_UserOrgUnitAssignments_User
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserOrgUnitAssignments_User' AND object_id = OBJECT_ID('org.UserOrgUnitAssignments'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserOrgUnitAssignments_User
    ON org.UserOrgUnitAssignments (UserId, OrgUnitId)
    INCLUDE (IsPrimary, EffectiveFrom, EffectiveTo)
    WHERE IsDeleted = 0 AND IsActive = 1;
    PRINT '    [+] Created index [IX_UserOrgUnitAssignments_User].';
END
GO

-- IX_UserOrgUnitAssignments_Unit
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserOrgUnitAssignments_Unit' AND object_id = OBJECT_ID('org.UserOrgUnitAssignments'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserOrgUnitAssignments_Unit
    ON org.UserOrgUnitAssignments (OrgUnitId)
    INCLUDE (UserId)
    WHERE IsDeleted = 0 AND IsActive = 1;
    PRINT '    [+] Created index [IX_UserOrgUnitAssignments_Unit].';
END
GO


-- ====================================================================================================
-- [BLOCK 5] Inline TVF: org.fn_VisibleOrgUnits
-- Resolves all visible OrgUnitIDs for a user via transitive closure tree with dual-mode fallback.
-- ====================================================================================================
PRINT '>>> [BLOCK 5] Deploying inline TVF [org].[fn_VisibleOrgUnits]...';

IF OBJECT_ID('org.fn_VisibleOrgUnits', 'IF') IS NOT NULL
    DROP FUNCTION org.fn_VisibleOrgUnits;
GO

CREATE FUNCTION org.fn_VisibleOrgUnits (@UserId UNIQUEIDENTIFIER)
RETURNS TABLE
AS
RETURN
(
    SELECT DISTINCT c.DescendantOrgUnitId AS OrgUnitId
    FROM [auth].[UserOrganizationScopes] AS s
    INNER JOIN [org].[OrgUnitClosure] AS c 
        ON c.AncestorOrgUnitId = COALESCE(s.OrgUnitId, s.SectionID, s.DepartmentID, s.BusinessUnitID, s.OrganizationID)
    INNER JOIN [org].[OrgUnits] AS u 
        ON u.OrgUnitId = c.DescendantOrgUnitId
    WHERE s.UserID = @UserId
      AND u.IsDeleted = 0
      AND u.IsActive = 1
);
GO
PRINT '    [+] Created function [org].[fn_VisibleOrgUnits].';
GO


-- ====================================================================================================
-- [BLOCK 6] Permissions & Role Grants
-- ====================================================================================================
PRINT '>>> [BLOCK 6] Seeding Domain 2 Permissions and Role Grants...';

DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

-- 6.1 Insert Permissions (Matches live auth.Permissions schema)
MERGE [auth].[Permissions] AS Target
USING (VALUES
    ('ORG.VIEW',           'Organization', 'View',         'View org units, tree hierarchy, and assigned managers'),
    ('ORG.CREATE',         'Organization', 'Create',       'Create a new organization unit node'),
    ('ORG.UPDATE',         'Organization', 'Update',       'Update organization unit attributes and metadata'),
    ('ORG.MOVE',           'Organization', 'Move',         'Reparent an organization unit and its entire subtree'),
    ('ORG.DELETE',         'Organization', 'Delete',       'Soft delete an organization unit'),
    ('ORG.MANAGER.ASSIGN', 'Organization', 'AssignManager', 'Assign or terminate HOD, Section Head, or Acting Managers'),
    ('ORG.TYPE.MANAGE',    'Organization', 'ManageTypes',  'Manage organization unit types and hierarchy rules'),
    ('ORG.EXPORT',         'Organization', 'Export',       'Export organization structure and trees to Excel/PDF')
) AS Source (PermissionCode, ModuleName, ActionName, Description)
ON Target.PermissionCode = Source.PermissionCode
WHEN MATCHED THEN
    UPDATE SET 
        Target.ModuleName  = Source.ModuleName,
        Target.ActionName  = Source.ActionName,
        Target.Description = Source.Description
WHEN NOT MATCHED THEN
    INSERT (PermissionCode, ModuleName, ActionName, Description, CreatedAt)
    VALUES (Source.PermissionCode, Source.ModuleName, Source.ActionName, Source.Description, @Now);

PRINT '    [+] Seeded 8 Domain 2 Permissions in [auth].[Permissions].';

-- 6.2 Grant Permissions to Roles
DECLARE @SystemAdminRoleId UNIQUEIDENTIFIER = '2B850D65-CBC0-4071-9B90-694042F7338F';
DECLARE @HrRoleId          UNIQUEIDENTIFIER = '6B2E9347-3D18-4F74-B46B-A0AF4D442F02';
DECLARE @FinanceRoleId     UNIQUEIDENTIFIER = 'F9FD28DA-1C14-4699-B5FA-0DA983A9A3A2';
DECLARE @HodRoleId         UNIQUEIDENTIFIER = 'D8C2BD36-6047-4E77-8290-055BE5D4C8FC';

DECLARE @RolePermissions TABLE (
    RoleID UNIQUEIDENTIFIER,
    PermissionCode NVARCHAR(150)
);

-- SYSTEM_ADMIN: All 8 permissions
INSERT INTO @RolePermissions (RoleID, PermissionCode) VALUES
(@SystemAdminRoleId, 'ORG.VIEW'),
(@SystemAdminRoleId, 'ORG.CREATE'),
(@SystemAdminRoleId, 'ORG.UPDATE'),
(@SystemAdminRoleId, 'ORG.MOVE'),
(@SystemAdminRoleId, 'ORG.DELETE'),
(@SystemAdminRoleId, 'ORG.MANAGER.ASSIGN'),
(@SystemAdminRoleId, 'ORG.TYPE.MANAGE'),
(@SystemAdminRoleId, 'ORG.EXPORT');

-- HR: VIEW, MANAGER.ASSIGN, EXPORT
INSERT INTO @RolePermissions (RoleID, PermissionCode) VALUES
(@HrRoleId, 'ORG.VIEW'),
(@HrRoleId, 'ORG.MANAGER.ASSIGN'),
(@HrRoleId, 'ORG.EXPORT');

-- FINANCE: VIEW, EXPORT
INSERT INTO @RolePermissions (RoleID, PermissionCode) VALUES
(@FinanceRoleId, 'ORG.VIEW'),
(@FinanceRoleId, 'ORG.EXPORT');

-- HOD: VIEW, EXPORT
INSERT INTO @RolePermissions (RoleID, PermissionCode) VALUES
(@HodRoleId, 'ORG.VIEW'),
(@HodRoleId, 'ORG.EXPORT');

-- Insert missing grants idempotently
INSERT INTO [auth].[RolePermissions] (RoleID, PermissionID, GrantedAt)
SELECT 
    rp.RoleID,
    p.PermissionID,
    SYSUTCDATETIME()
FROM @RolePermissions rp
INNER JOIN [auth].[Permissions] p ON p.PermissionCode = rp.PermissionCode
LEFT JOIN [auth].[RolePermissions] existing 
    ON existing.RoleID = rp.RoleID 
   AND existing.PermissionID = p.PermissionID
WHERE existing.RolePermissionID IS NULL;

PRINT '    [+] Granted Domain 2 Permissions to SYSTEM_ADMIN, HR, FINANCE, and HOD roles.';
GO


-- ====================================================================================================
-- [BLOCK 7] Seed Data (Unit Types, Hierarchy Rules, Root Node)
-- ====================================================================================================
PRINT '>>> [BLOCK 7] Seeding Unit Types, Hierarchy Rules, and Root DIEZ Node...';

DECLARE @AdminUserId UNIQUEIDENTIFIER = '1053433E-F36B-1410-85ED-009A959FB122';

-- 7.1 Unit Types
MERGE org.OrgUnitTypes AS Target
USING (VALUES
 (1, 'ORGANIZATION',  'Organization',  N'المؤسسة', 1, 'ORGANIZATION',  0, 0, 1, 1, 10),
 (2, 'BUSINESS_UNIT', 'Business Unit', N'وحدة الأعمال', 2, 'BUSINESS_UNIT', 0, 0, 1, 0, 20),
 (3, 'DEPARTMENT',    'Department',    N'الإدارة', 3, 'DEPARTMENT',    1, 1, 1, 0, 30),
 (4, 'SECTION',       'Section',       N'القسم',  4, 'SECTION',       0, 1, 1, 0, 40)
) AS Source (OrgUnitTypeId, Code, Name, NameAr, CanonicalLevel, ScopeLevelCode, AllowsBudget, AllowsRequisition, AllowsManager, IsRootType, SortOrder)
ON Target.OrgUnitTypeId = Source.OrgUnitTypeId
WHEN MATCHED THEN
    UPDATE SET 
        Target.Code = Source.Code,
        Target.Name = Source.Name,
        Target.NameAr = Source.NameAr,
        Target.CanonicalLevel = Source.CanonicalLevel,
        Target.ScopeLevelCode = Source.ScopeLevelCode,
        Target.AllowsBudget = Source.AllowsBudget,
        Target.AllowsRequisition = Source.AllowsRequisition,
        Target.AllowsManager = Source.AllowsManager,
        Target.IsRootType = Source.IsRootType,
        Target.SortOrder = Source.SortOrder
WHEN NOT MATCHED THEN
    INSERT (OrgUnitTypeId, Code, Name, NameAr, CanonicalLevel, ScopeLevelCode, AllowsBudget, AllowsRequisition, AllowsManager, IsRootType, SortOrder, CreatedBy)
    VALUES (Source.OrgUnitTypeId, Source.Code, Source.Name, Source.NameAr, Source.CanonicalLevel, Source.ScopeLevelCode, Source.AllowsBudget, Source.AllowsRequisition, Source.AllowsManager, Source.IsRootType, Source.SortOrder, @AdminUserId);

PRINT '    [+] Seeded 4 OrgUnitTypes.';

-- 7.2 Hierarchy Rules
MERGE org.OrgUnitTypeHierarchyRules AS Target
USING (VALUES
 (2, 1), -- Business Unit under Organization
 (3, 1), -- Department under Organization
 (3, 2), -- Department under Business Unit
 (4, 3)  -- Section under Department
) AS Source (ChildOrgUnitTypeId, ParentOrgUnitTypeId)
ON Target.ChildOrgUnitTypeId = Source.ChildOrgUnitTypeId AND Target.ParentOrgUnitTypeId = Source.ParentOrgUnitTypeId
WHEN MATCHED THEN
    UPDATE SET Target.IsActive = 1
WHEN NOT MATCHED THEN
    INSERT (ChildOrgUnitTypeId, ParentOrgUnitTypeId, CreatedBy)
    VALUES (Source.ChildOrgUnitTypeId, Source.ParentOrgUnitTypeId, @AdminUserId);

PRINT '    [+] Seeded 4 OrgUnitTypeHierarchyRules.';

-- 7.3 Root Organization (DIEZ)
IF NOT EXISTS (SELECT 1 FROM org.OrgUnits WHERE Code = 'DIEZ' AND IsDeleted = 0)
BEGIN
    DECLARE @Ids TABLE (OrgUnitId UNIQUEIDENTIFIER);
    DECLARE @RootId UNIQUEIDENTIFIER;

    INSERT INTO org.OrgUnits (
        OrgUnitTypeId, ParentOrgUnitId, Code, Name, NameAr, ShortName,
        MaterializedPath, Depth, EffectiveFrom, CreatedBy
    )
    OUTPUT INSERTED.OrgUnitId INTO @Ids
    VALUES (
        1, NULL, 'DIEZ', N'Dubai Integrated Economic Zones',
        N'مناطق دبي الاقتصادية المتكاملة', 'DIEZ',
        '/', 0, CAST(SYSUTCDATETIME() AS DATE), @AdminUserId
    );

    SELECT @RootId = OrgUnitId FROM @Ids;

    UPDATE org.OrgUnits
    SET MaterializedPath = '/' + REPLACE(CAST(@RootId AS VARCHAR(36)), '-', '') + '/'
    WHERE OrgUnitId = @RootId;

    INSERT INTO org.OrgUnitClosure (AncestorOrgUnitId, DescendantOrgUnitId, Depth)
    VALUES (@RootId, @RootId, 0);

    INSERT INTO org.OrgUnitChangeLog (OrgUnitId, ChangeType, NewValues, PerformedBy)
    VALUES (
        @RootId, 
        'CREATED', 
        (SELECT @RootId AS OrgUnitId, 'DIEZ' AS Code, 'Dubai Integrated Economic Zones' AS Name FOR JSON PATH, WITHOUT_ARRAY_WRAPPER), 
        @AdminUserId
    );

    PRINT '    [+] Seeded Root Organization node [DIEZ] and self-closure edge.';
END
ELSE
BEGIN
    PRINT '    [-] Root Organization [DIEZ] already exists.';
END
GO

PRINT '====================================================================================================';
PRINT '>>> DOMAIN 2 MIGRATION SCRIPT EXECUTED SUCCESSFULLY.';
PRINT '====================================================================================================';
GO


-- ====================================================================================================
-- [BLOCK 8] Integrity Verification Queries (§6.3)
-- VERIFY: All queries in this union must return ZERO rows upon completion.
-- ====================================================================================================
/*
-- VERIFY: must return zero rows

-- A. Every live node must have a self-row at depth 0
SELECT u.OrgUnitId, u.Code, 'MISSING_SELF_ROW' AS Problem
FROM org.OrgUnits AS u
LEFT JOIN org.OrgUnitClosure AS c
       ON c.AncestorOrgUnitId = u.OrgUnitId
      AND c.DescendantOrgUnitId = u.OrgUnitId
      AND c.Depth = 0
WHERE u.IsDeleted = 0 AND c.AncestorOrgUnitId IS NULL

UNION ALL
-- B. Closure must agree with adjacency for direct parents
SELECT u.OrgUnitId, u.Code, 'MISSING_PARENT_EDGE'
FROM org.OrgUnits AS u
LEFT JOIN org.OrgUnitClosure AS c
       ON c.AncestorOrgUnitId = u.ParentOrgUnitId
      AND c.DescendantOrgUnitId = u.OrgUnitId
      AND c.Depth = 1
WHERE u.IsDeleted = 0 AND u.ParentOrgUnitId IS NOT NULL AND c.AncestorOrgUnitId IS NULL

UNION ALL
-- C. No orphan closure rows
SELECT c.DescendantOrgUnitId, NULL, 'ORPHAN_CLOSURE_ROW'
FROM org.OrgUnitClosure AS c
LEFT JOIN org.OrgUnits AS u ON u.OrgUnitId = c.DescendantOrgUnitId
WHERE u.OrgUnitId IS NULL

UNION ALL
-- D. Stored Depth must match closure depth from root
SELECT u.OrgUnitId, u.Code, 'DEPTH_MISMATCH'
FROM org.OrgUnits AS u
INNER JOIN (
    SELECT DescendantOrgUnitId, MAX(Depth) AS MaxDepth
    FROM org.OrgUnitClosure GROUP BY DescendantOrgUnitId
) AS d ON d.DescendantOrgUnitId = u.OrgUnitId
WHERE u.IsDeleted = 0 AND u.Depth <> d.MaxDepth;

*/
GO
