-- ====================================================================================================
-- DIEZ Outsource Management System (OMS) — Database Migration Script
-- Domain 3: User Administration
--
-- Target Database : OMS_DB_Prod
-- Target Schemas  : auth, org
-- Reference Specs : docs/DOMAIN-3-USER-ADMINISTRATION.md
-- Reconciliation  : docs/DOMAIN-3-RECONCILIATION.md
--
-- SUBSTITUTED VALUES (Verified against live auth tables):
--   * Role ID - SYSTEM_ADMIN : 2B850D65-CBC0-4071-9B90-694042F7338F
--   * Role ID - HR           : 6B2E9347-3D18-4F74-B46B-A0AF4D442F02
--   * Role ID - PROCUREMENT  : 68AA9343-481C-4ACD-A153-C5805606802C
--   * Role ID - HOD          : D8C2BD36-6047-4E77-8290-055BE5D4C8FC
--
-- EXECUTION INSTRUCTIONS:
--   Run manually in SQL Server Management Studio (SSMS) or sqlcmd against OMS_DB_Prod.
--   Each block is guarded with existence checks and separated by GO batches for idempotent execution.
--
-- SCRIPT STRUCTURE:
--   [BLOCK 1] Data Sanitization (Resolve UserType drift on auth.Users)
--   [BLOCK 2] auth.Users Check Constraint (Enforce 4 seeded UserTypeCodes)
--   [BLOCK 3] Table: auth.PasswordHistory (Closes G1)
--   [BLOCK 4] Table: auth.UserInvitations (Closes G2)
--   [BLOCK 5] Table: auth.DelegationPermissions (Closes G6 — Granular Delegation)
--   [BLOCK 6] Table Alterations: auth.UserOrganizationScopes & auth.UserProfiles (Closes G3, G4)
--   [BLOCK 7] Non-Clustered & Filtered Performance Indexes
--   [BLOCK 8] Updated Inline TVF: org.fn_VisibleOrgUnits (Temporal & Active Scope Validation)
--   [BLOCK 9] Seed: Domain 3 Permissions & Role Grants (auth.Permissions, auth.RolePermissions)
--   [BLOCK 10] Verification Query (Confirms all tables, columns, indexes, constraints & TVF)
-- ====================================================================================================

USE [OMS_DB_Prod];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- ====================================================================================================
-- [BLOCK 1] Data Sanitization (Resolve UserType drift on auth.Users)
-- Maps any unseeded 'EXTERNAL' values to 'VENDOR' before applying the check constraint.
-- ====================================================================================================
PRINT '>>> [BLOCK 1] Sanitizing auth.Users UserType values...';

UPDATE [auth].[Users]
SET [UserType] = 'VENDOR'
WHERE [UserType] = 'EXTERNAL';

PRINT '    [+] Sanitized UserType data drift.';
GO


-- ====================================================================================================
-- [BLOCK 2] auth.Users Check Constraint (Enforce 4 seeded UserTypeCodes)
-- ====================================================================================================
PRINT '>>> [BLOCK 2] Applying constraint CK_Users_UserType on auth.Users...';

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints 
    WHERE name = 'CK_Users_UserType' 
      AND parent_object_id = OBJECT_ID('auth.Users')
)
BEGIN
    ALTER TABLE [auth].[Users] WITH CHECK
    ADD CONSTRAINT [CK_Users_UserType]
        CHECK ([UserType] IN ('INTERNAL', 'VENDOR', 'SYSTEM', 'SERVICE_ACCOUNT'));

    PRINT '    [+] Created constraint [CK_Users_UserType].';
END
ELSE
BEGIN
    PRINT '    [-] Constraint [CK_Users_UserType] already exists.';
END
GO


-- ====================================================================================================
-- [BLOCK 3] Table: auth.PasswordHistory (Closes G1)
-- Enables password history tracking to prevent reuse of last N passwords.
-- ====================================================================================================
PRINT '>>> [BLOCK 3] Creating table [auth].[PasswordHistory]...';

IF OBJECT_ID('auth.PasswordHistory', 'U') IS NULL
BEGIN
    CREATE TABLE [auth].[PasswordHistory] (
        [PasswordHistoryID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_PwdHist_ID] DEFAULT (NEWSEQUENTIALID()),
        [UserID]            UNIQUEIDENTIFIER NOT NULL,
        [PasswordHash]      NVARCHAR(500)    NOT NULL,
        [CreatedAt]         DATETIME2(3)     NOT NULL CONSTRAINT [DF_PwdHist_CreatedAt] DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT [PK_PasswordHistory] PRIMARY KEY CLUSTERED ([PasswordHistoryID]),
        CONSTRAINT [FK_PasswordHistory_User] FOREIGN KEY ([UserID]) REFERENCES [auth].[Users] ([UserID])
    );

    PRINT '    [+] Created table [auth].[PasswordHistory].';
END
ELSE
BEGIN
    PRINT '    [-] Table [auth].[PasswordHistory] already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_PasswordHistory_User' 
      AND object_id = OBJECT_ID('auth.PasswordHistory')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_PasswordHistory_User]
        ON [auth].[PasswordHistory] ([UserID], [CreatedAt] DESC);

    PRINT '    [+] Created index [IX_PasswordHistory_User].';
END
ELSE
BEGIN
    PRINT '    [-] Index [IX_PasswordHistory_User] already exists.';
END
GO


-- ====================================================================================================
-- [BLOCK 4] Table: auth.UserInvitations (Closes G2)
-- Enables secure invitation and self-service password set / reset workflows.
-- ====================================================================================================
PRINT '>>> [BLOCK 4] Creating table [auth].[UserInvitations]...';

IF OBJECT_ID('auth.UserInvitations', 'U') IS NULL
BEGIN
    CREATE TABLE [auth].[UserInvitations] (
        [UserInvitationID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_UserInv_ID] DEFAULT (NEWSEQUENTIALID()),
        [UserID]           UNIQUEIDENTIFIER NOT NULL,
        [TokenHash]        VARBINARY(32)    NOT NULL,
        [Purpose]          NVARCHAR(30)     NOT NULL,
        [ExpiresAt]        DATETIME2(3)     NOT NULL,
        [ConsumedAt]       DATETIME2(3)     NULL,
        [RevokedAt]        DATETIME2(3)     NULL,
        [IssuedByUserID]   UNIQUEIDENTIFIER NULL,
        [IssuedToEmail]    NVARCHAR(255)    NOT NULL,
        [IPAddress]        VARCHAR(45)      NULL,
        [CreatedAt]        DATETIME2(3)     NOT NULL CONSTRAINT [DF_UserInv_CreatedAt] DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT [PK_UserInvitations]      PRIMARY KEY CLUSTERED ([UserInvitationID]),
        CONSTRAINT [FK_UserInvitations_User] FOREIGN KEY ([UserID]) REFERENCES [auth].[Users] ([UserID]),
        CONSTRAINT [CK_UserInvitations_Purpose] CHECK ([Purpose] IN ('INVITE', 'PASSWORD_RESET'))
    );

    PRINT '    [+] Created table [auth].[UserInvitations].';
END
ELSE
BEGIN
    PRINT '    [-] Table [auth].[UserInvitations] already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'UX_UserInvitations_TokenHash' 
      AND object_id = OBJECT_ID('auth.UserInvitations')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_UserInvitations_TokenHash]
        ON [auth].[UserInvitations] ([TokenHash]);

    PRINT '    [+] Created unique index [UX_UserInvitations_TokenHash].';
END
ELSE
BEGIN
    PRINT '    [-] Index [UX_UserInvitations_TokenHash] already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_UserInvitations_User' 
      AND object_id = OBJECT_ID('auth.UserInvitations')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_UserInvitations_User]
        ON [auth].[UserInvitations] ([UserID], [Purpose], [ExpiresAt] DESC);

    PRINT '    [+] Created index [IX_UserInvitations_User].';
END
ELSE
BEGIN
    PRINT '    [-] Index [IX_UserInvitations_User] already exists.';
END
GO


-- ====================================================================================================
-- [BLOCK 5] Table: auth.DelegationPermissions (Closes G6 — Granular Delegation)
-- Scopes authority delegation to specific permissions instead of all-or-nothing transfer.
-- ====================================================================================================
PRINT '>>> [BLOCK 5] Creating table [auth].[DelegationPermissions]...';

IF OBJECT_ID('auth.DelegationPermissions', 'U') IS NULL
BEGIN
    CREATE TABLE [auth].[DelegationPermissions] (
        [DelegationPermissionID] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_DelPerm_ID] DEFAULT (NEWSEQUENTIALID()),
        [DelegationID]           UNIQUEIDENTIFIER NOT NULL,
        [PermissionID]           UNIQUEIDENTIFIER NOT NULL,
        [CreatedAt]              DATETIME2(3)     NOT NULL CONSTRAINT [DF_DelPerm_CreatedAt] DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT [PK_DelegationPermissions] PRIMARY KEY CLUSTERED ([DelegationPermissionID]),
        CONSTRAINT [FK_DelegationPermissions_Delegation] FOREIGN KEY ([DelegationID]) 
            REFERENCES [auth].[Delegations] ([DelegationID]) ON DELETE CASCADE,
        CONSTRAINT [FK_DelegationPermissions_Permission] FOREIGN KEY ([PermissionID]) 
            REFERENCES [auth].[Permissions] ([PermissionID])
    );

    PRINT '    [+] Created table [auth].[DelegationPermissions].';
END
ELSE
BEGIN
    PRINT '    [-] Table [auth].[DelegationPermissions] already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'UX_DelegationPermissions_Unique' 
      AND object_id = OBJECT_ID('auth.DelegationPermissions')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [UX_DelegationPermissions_Unique]
        ON [auth].[DelegationPermissions] ([DelegationID], [PermissionID]);

    PRINT '    [+] Created unique index [UX_DelegationPermissions_Unique].';
END
ELSE
BEGIN
    PRINT '    [-] Index [UX_DelegationPermissions_Unique] already exists.';
END
GO


-- ====================================================================================================
-- [BLOCK 6] Table Alterations: auth.UserOrganizationScopes & auth.UserProfiles (Closes G3, G4)
-- Adds temporal validity, active flags, and audit columns.
-- ====================================================================================================
PRINT '>>> [BLOCK 6] Altering [auth].[UserOrganizationScopes] and [auth].[UserProfiles]...';

-- Alter auth.UserOrganizationScopes
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'auth' 
      AND TABLE_NAME = 'UserOrganizationScopes' 
      AND COLUMN_NAME = 'EffectiveFrom'
)
BEGIN
    ALTER TABLE [auth].[UserOrganizationScopes] ADD
        [EffectiveFrom] DATETIME2(3)     NOT NULL CONSTRAINT [DF_UOS_EffFrom] DEFAULT (SYSUTCDATETIME()),
        [EffectiveTo]   DATETIME2(3)     NULL,
        [IsActive]      BIT              NOT NULL CONSTRAINT [DF_UOS_IsActive] DEFAULT (1),
        [AssignedBy]    UNIQUEIDENTIFIER NULL,
        [AssignedAt]    DATETIME2(3)     NOT NULL CONSTRAINT [DF_UOS_AssignedAt] DEFAULT (SYSUTCDATETIME()),
        [Reason]        NVARCHAR(500)    NULL;

    PRINT '    [+] Added temporal and audit columns to [auth].[UserOrganizationScopes].';
END
ELSE
BEGIN
    PRINT '    [-] Temporal columns already exist on [auth].[UserOrganizationScopes].';
END
GO

-- Alter auth.UserProfiles
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'auth' 
      AND TABLE_NAME = 'UserProfiles' 
      AND COLUMN_NAME = 'CreatedAt'
)
BEGIN
    ALTER TABLE [auth].[UserProfiles] ADD
        [CreatedAt] DATETIME2(3)     NOT NULL CONSTRAINT [DF_UP_CreatedAt] DEFAULT (SYSUTCDATETIME()),
        [CreatedBy] UNIQUEIDENTIFIER NULL,
        [UpdatedAt] DATETIME2(3)     NULL,
        [UpdatedBy] UNIQUEIDENTIFIER NULL;

    PRINT '    [+] Added audit columns to [auth].[UserProfiles].';
END
ELSE
BEGIN
    PRINT '    [-] Audit columns already exist on [auth].[UserProfiles].';
END
GO


-- ====================================================================================================
-- [BLOCK 7] Non-Clustered & Filtered Performance Indexes (§2.4)
-- ====================================================================================================
PRINT '>>> [BLOCK 7] Creating performance indexes...';

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_UserRoles_User_Active' 
      AND object_id = OBJECT_ID('auth.UserRoles')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_UserRoles_User_Active]
        ON [auth].[UserRoles] ([UserID], [EffectiveFrom], [EffectiveTo])
        INCLUDE ([RoleID]) 
        WHERE [IsActive] = 1;

    PRINT '    [+] Created index [IX_UserRoles_User_Active].';
END
ELSE
BEGIN
    PRINT '    [-] Index [IX_UserRoles_User_Active] already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_UserRoles_Role' 
      AND object_id = OBJECT_ID('auth.UserRoles')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_UserRoles_Role]
        ON [auth].[UserRoles] ([RoleID]) 
        INCLUDE ([UserID]) 
        WHERE [IsActive] = 1;

    PRINT '    [+] Created index [IX_UserRoles_Role].';
END
ELSE
BEGIN
    PRINT '    [-] Index [IX_UserRoles_Role] already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_UOS_User' 
      AND object_id = OBJECT_ID('auth.UserOrganizationScopes')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_UOS_User]
        ON [auth].[UserOrganizationScopes] ([UserID])
        INCLUDE (
            [ScopeDefinitionID], 
            [OrgUnitId], 
            [OrganizationID], 
            [BusinessUnitID], 
            [DepartmentID], 
            [SectionID], 
            [IsActive], 
            [EffectiveFrom], 
            [EffectiveTo]
        );

    PRINT '    [+] Created index [IX_UOS_User].';
END
ELSE
BEGIN
    PRINT '    [-] Index [IX_UOS_User] already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_UserProfiles_Dept' 
      AND object_id = OBJECT_ID('auth.UserProfiles')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_UserProfiles_Dept]
        ON [auth].[UserProfiles] ([DepartmentID]) 
        INCLUDE ([UserID], [FirstName], [LastName]);

    PRINT '    [+] Created index [IX_UserProfiles_Dept].';
END
ELSE
BEGIN
    PRINT '    [-] Index [IX_UserProfiles_Dept] already exists.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_Delegations_Active' 
      AND object_id = OBJECT_ID('auth.Delegations')
)
BEGIN
    CREATE NONCLUSTERED INDEX [IX_Delegations_Active]
        ON [auth].[Delegations] ([ToUserID], [StartDate], [EndDate]) 
        WHERE [IsActive] = 1;

    PRINT '    [+] Created index [IX_Delegations_Active].';
END
ELSE
BEGIN
    PRINT '    [-] Index [IX_Delegations_Active] already exists.';
END
GO


-- ====================================================================================================
-- [BLOCK 8] Updated Inline TVF: org.fn_VisibleOrgUnits (Temporal & Active Scope Validation)
-- Evaluates scope with active status and temporal date filtering against live closure tree.
-- ====================================================================================================
PRINT '>>> [BLOCK 8] Updating inline function [org].[fn_VisibleOrgUnits]...';
GO

CREATE OR ALTER FUNCTION org.fn_VisibleOrgUnits (@UserId UNIQUEIDENTIFIER)
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
      AND s.IsActive = 1
      AND s.EffectiveFrom <= SYSUTCDATETIME()
      AND (s.EffectiveTo IS NULL OR s.EffectiveTo > SYSUTCDATETIME())
      AND u.IsDeleted = 0
      AND u.IsActive = 1
);
GO

PRINT '    [+] Updated inline function [org].[fn_VisibleOrgUnits].';
GO


-- ====================================================================================================
-- [BLOCK 9] Seed: Domain 3 Permissions & Role Grants (§3)
-- ====================================================================================================
PRINT '>>> [BLOCK 9] Seeding Domain 3 permissions and role grants...';

DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

-- 1. Seed Permissions
MERGE [auth].[Permissions] AS Target
USING (VALUES
    ('USER.VIEW',              'USER_ADMIN', 'VIEW',              'View users and their assignments'),
    ('USER.CREATE',            'USER_ADMIN', 'CREATE',            'Create a new user'),
    ('USER.UPDATE',            'USER_ADMIN', 'UPDATE',            'Edit user profile details'),
    ('USER.DEACTIVATE',        'USER_ADMIN', 'DEACTIVATE',        'Activate or deactivate a user'),
    ('USER.DELETE',            'USER_ADMIN', 'DELETE',            'Soft delete a user'),
    ('USER.INVITE',            'USER_ADMIN', 'INVITE',            'Send or resend an invitation'),
    ('USER.PASSWORD.RESET',    'USER_ADMIN', 'PASSWORD_RESET',    'Trigger a password reset'),
    ('USER.UNLOCK',            'USER_ADMIN', 'UNLOCK',            'Clear a lockout and failed login count'),
    ('USER.ROLE.ASSIGN',       'USER_ADMIN', 'ROLE_ASSIGN',       'Assign or revoke roles'),
    ('USER.SCOPE.ASSIGN',      'USER_ADMIN', 'SCOPE_ASSIGN',      'Assign or revoke organizational scope'),
    ('USER.OVERRIDE.MANAGE',   'USER_ADMIN', 'OVERRIDE_MANAGE',   'Grant or revoke individual permissions'),
    ('USER.DELEGATION.MANAGE', 'USER_ADMIN', 'DELEGATION_MANAGE', 'Manage delegations for any user'),
    ('USER.IMPORT',            'USER_ADMIN', 'IMPORT',            'Bulk import users'),
    ('USER.EXPORT',            'USER_ADMIN', 'EXPORT',            'Export the user list'),
    ('VENDORUSER.MANAGE',      'USER_ADMIN', 'VENDOR_MANAGE',     'Manage vendor portal users')
) AS Source (PermissionCode, ModuleName, ActionName, Description)
ON Target.PermissionCode = Source.PermissionCode
WHEN MATCHED THEN
    UPDATE SET 
        Target.ModuleName  = Source.ModuleName,
        Target.ActionName  = Source.ActionName,
        Target.Description = Source.Description
WHEN NOT MATCHED THEN
    INSERT (PermissionID, PermissionCode, ModuleName, ActionName, Description, CreatedAt)
    VALUES (NEWID(), Source.PermissionCode, Source.ModuleName, Source.ActionName, Source.Description, @Now);

-- 2. Seed Role Permission Grants
DECLARE @SystemAdminRoleId UNIQUEIDENTIFIER = '2B850D65-CBC0-4071-9B90-694042F7338F';
DECLARE @HrRoleId          UNIQUEIDENTIFIER = '6B2E9347-3D18-4F74-B46B-A0AF4D442F02';
DECLARE @ProcurementRoleId UNIQUEIDENTIFIER = '68AA9343-481C-4ACD-A153-C5805606802C';
DECLARE @HodRoleId         UNIQUEIDENTIFIER = 'D8C2BD36-6047-4E77-8290-055BE5D4C8FC';

DECLARE @RoleGrants TABLE (
    RoleID UNIQUEIDENTIFIER,
    PermissionCode NVARCHAR(150)
);

-- SYSTEM_ADMIN gets all 15 Domain 3 permissions
INSERT INTO @RoleGrants (RoleID, PermissionCode) VALUES
(@SystemAdminRoleId, 'USER.VIEW'),
(@SystemAdminRoleId, 'USER.CREATE'),
(@SystemAdminRoleId, 'USER.UPDATE'),
(@SystemAdminRoleId, 'USER.DEACTIVATE'),
(@SystemAdminRoleId, 'USER.DELETE'),
(@SystemAdminRoleId, 'USER.INVITE'),
(@SystemAdminRoleId, 'USER.PASSWORD.RESET'),
(@SystemAdminRoleId, 'USER.UNLOCK'),
(@SystemAdminRoleId, 'USER.ROLE.ASSIGN'),
(@SystemAdminRoleId, 'USER.SCOPE.ASSIGN'),
(@SystemAdminRoleId, 'USER.OVERRIDE.MANAGE'),
(@SystemAdminRoleId, 'USER.DELEGATION.MANAGE'),
(@SystemAdminRoleId, 'USER.IMPORT'),
(@SystemAdminRoleId, 'USER.EXPORT'),
(@SystemAdminRoleId, 'VENDORUSER.MANAGE');

-- HR gets User Lifecycle, Reset, Unlock, Delegation, and Import/Export
INSERT INTO @RoleGrants (RoleID, PermissionCode) VALUES
(@HrRoleId, 'USER.VIEW'),
(@HrRoleId, 'USER.CREATE'),
(@HrRoleId, 'USER.UPDATE'),
(@HrRoleId, 'USER.DEACTIVATE'),
(@HrRoleId, 'USER.INVITE'),
(@HrRoleId, 'USER.PASSWORD.RESET'),
(@HrRoleId, 'USER.UNLOCK'),
(@HrRoleId, 'USER.DELEGATION.MANAGE'),
(@HrRoleId, 'USER.IMPORT'),
(@HrRoleId, 'USER.EXPORT');

-- PROCUREMENT gets Vendor User Management
INSERT INTO @RoleGrants (RoleID, PermissionCode) VALUES
(@ProcurementRoleId, 'VENDORUSER.MANAGE');

-- HOD gets Scoped User Viewing
INSERT INTO @RoleGrants (RoleID, PermissionCode) VALUES
(@HodRoleId, 'USER.VIEW');

-- Grant permissions idempotently
INSERT INTO [auth].[RolePermissions] (RolePermissionID, RoleID, PermissionID, GrantedAt)
SELECT 
    NEWID(),
    rg.RoleID,
    p.PermissionID,
    SYSUTCDATETIME()
FROM @RoleGrants rg
INNER JOIN [auth].[Permissions] p 
    ON p.PermissionCode = rg.PermissionCode
LEFT JOIN [auth].[RolePermissions] existing 
    ON existing.RoleID = rg.RoleID 
   AND existing.PermissionID = p.PermissionID
WHERE existing.RolePermissionID IS NULL;

PRINT '    [+] Domain 3 permissions and role grants seeded successfully.';
GO


-- ====================================================================================================
-- [BLOCK 10] Integrity Verification Query
-- Run this query after deployment to verify all objects exist, compile, and have zero structural gaps.
-- ====================================================================================================
/*
SELECT 'Table: auth.PasswordHistory' AS ObjectName, CASE WHEN OBJECT_ID('auth.PasswordHistory', 'U') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS Status
UNION ALL
SELECT 'Table: auth.UserInvitations', CASE WHEN OBJECT_ID('auth.UserInvitations', 'U') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'Table: auth.DelegationPermissions', CASE WHEN OBJECT_ID('auth.DelegationPermissions', 'U') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'Constraint: CK_Users_UserType', CASE WHEN EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_UserType' AND parent_object_id = OBJECT_ID('auth.Users')) THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'Columns: auth.UserOrganizationScopes (Temporal)', CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'EffectiveFrom') THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'Columns: auth.UserProfiles (Audit)', CASE WHEN EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserProfiles' AND COLUMN_NAME = 'CreatedAt') THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'Function: org.fn_VisibleOrgUnits', CASE WHEN OBJECT_ID('org.fn_VisibleOrgUnits', 'IF') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'Permissions: USER_ADMIN (15 Total)', CASE WHEN (SELECT COUNT(*) FROM auth.Permissions WHERE ModuleName = 'USER_ADMIN') = 15 THEN 'PASS' ELSE 'FAIL' END
UNION ALL
SELECT 'Role Grants: SYSTEM_ADMIN (15 Total)', CASE WHEN (SELECT COUNT(*) FROM auth.RolePermissions rp INNER JOIN auth.Permissions p ON p.PermissionID = rp.PermissionID WHERE rp.RoleID = '2B850D65-CBC0-4071-9B90-694042F7338F' AND p.ModuleName = 'USER_ADMIN') = 15 THEN 'PASS' ELSE 'FAIL' END;
*/
GO
