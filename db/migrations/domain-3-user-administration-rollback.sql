-- ====================================================================================================
-- DIEZ Outsource Management System (OMS) — Database Rollback Script
-- Domain 3: User Administration Rollback
--
-- Target Database : OMS_DB_Prod
-- Target Schemas  : auth, org
--
-- Purpose: Safely rolls back all Domain 3 tables, columns, indexes, constraints, permissions,
--          and restores org.fn_VisibleOrgUnits to its pre-Domain 3 baseline in reverse dependency order.
-- ====================================================================================================

USE [OMS_DB_Prod];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT '>>> Starting Domain 3 User Administration Rollback...';
GO

-- ====================================================================================================
-- 1. Remove Domain 3 Role Permissions & Permissions
-- ====================================================================================================
PRINT '    [-] Removing Domain 3 Role Permissions...';

DELETE rp
FROM [auth].[RolePermissions] rp
INNER JOIN [auth].[Permissions] p ON p.PermissionID = rp.PermissionID
WHERE p.ModuleName = 'USER_ADMIN' 
   OR p.PermissionCode LIKE 'USER.%' 
   OR p.PermissionCode LIKE 'VENDORUSER.%';
GO

PRINT '    [-] Removing Domain 3 Permissions...';

DELETE FROM [auth].[Permissions]
WHERE ModuleName = 'USER_ADMIN' 
   OR PermissionCode LIKE 'USER.%' 
   OR PermissionCode LIKE 'VENDORUSER.%';
GO


-- ====================================================================================================
-- 2. Restore org.fn_VisibleOrgUnits (Pre-Domain 3 Baseline)
-- ====================================================================================================
PRINT '    [-] Reverting function [org].[fn_VisibleOrgUnits] to Domain 2 baseline...';
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
      AND u.IsDeleted = 0
      AND u.IsActive = 1
);
GO


-- ====================================================================================================
-- 3. Drop Performance Indexes
-- ====================================================================================================
PRINT '    [-] Dropping Domain 3 performance indexes...';

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Delegations_Active' AND object_id = OBJECT_ID('auth.Delegations'))
    DROP INDEX [IX_Delegations_Active] ON [auth].[Delegations];
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserProfiles_Dept' AND object_id = OBJECT_ID('auth.UserProfiles'))
    DROP INDEX [IX_UserProfiles_Dept] ON [auth].[UserProfiles];
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UOS_User' AND object_id = OBJECT_ID('auth.UserOrganizationScopes'))
    DROP INDEX [IX_UOS_User] ON [auth].[UserOrganizationScopes];
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserRoles_Role' AND object_id = OBJECT_ID('auth.UserRoles'))
    DROP INDEX [IX_UserRoles_Role] ON [auth].[UserRoles];
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserRoles_User_Active' AND object_id = OBJECT_ID('auth.UserRoles'))
    DROP INDEX [IX_UserRoles_User_Active] ON [auth].[UserRoles];
GO


-- ====================================================================================================
-- 4. Revert auth.UserProfiles Added Columns
-- ====================================================================================================
PRINT '    [-] Reverting [auth].[UserProfiles] added columns...';

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_UP_CreatedAt' AND parent_object_id = OBJECT_ID('auth.UserProfiles'))
    ALTER TABLE [auth].[UserProfiles] DROP CONSTRAINT [DF_UP_CreatedAt];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserProfiles' AND COLUMN_NAME = 'CreatedAt')
    ALTER TABLE [auth].[UserProfiles] DROP COLUMN [CreatedAt];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserProfiles' AND COLUMN_NAME = 'CreatedBy')
    ALTER TABLE [auth].[UserProfiles] DROP COLUMN [CreatedBy];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserProfiles' AND COLUMN_NAME = 'UpdatedAt')
    ALTER TABLE [auth].[UserProfiles] DROP COLUMN [UpdatedAt];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserProfiles' AND COLUMN_NAME = 'UpdatedBy')
    ALTER TABLE [auth].[UserProfiles] DROP COLUMN [UpdatedBy];
GO


-- ====================================================================================================
-- 5. Revert auth.UserOrganizationScopes Added Columns
-- ====================================================================================================
PRINT '    [-] Reverting [auth].[UserOrganizationScopes] temporal & audit columns...';

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_UOS_EffFrom' AND parent_object_id = OBJECT_ID('auth.UserOrganizationScopes'))
    ALTER TABLE [auth].[UserOrganizationScopes] DROP CONSTRAINT [DF_UOS_EffFrom];
GO

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_UOS_IsActive' AND parent_object_id = OBJECT_ID('auth.UserOrganizationScopes'))
    ALTER TABLE [auth].[UserOrganizationScopes] DROP CONSTRAINT [DF_UOS_IsActive];
GO

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_UOS_AssignedAt' AND parent_object_id = OBJECT_ID('auth.UserOrganizationScopes'))
    ALTER TABLE [auth].[UserOrganizationScopes] DROP CONSTRAINT [DF_UOS_AssignedAt];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'EffectiveFrom')
    ALTER TABLE [auth].[UserOrganizationScopes] DROP COLUMN [EffectiveFrom];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'EffectiveTo')
    ALTER TABLE [auth].[UserOrganizationScopes] DROP COLUMN [EffectiveTo];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'IsActive')
    ALTER TABLE [auth].[UserOrganizationScopes] DROP COLUMN [IsActive];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'AssignedBy')
    ALTER TABLE [auth].[UserOrganizationScopes] DROP COLUMN [AssignedBy];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'AssignedAt')
    ALTER TABLE [auth].[UserOrganizationScopes] DROP COLUMN [AssignedAt];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'Reason')
    ALTER TABLE [auth].[UserOrganizationScopes] DROP COLUMN [Reason];
GO


-- ====================================================================================================
-- 6. Drop Tables (Reverse FK Dependency Order)
-- ====================================================================================================
PRINT '    [-] Dropping table [auth].[DelegationPermissions]...';
IF OBJECT_ID('auth.DelegationPermissions', 'U') IS NOT NULL
    DROP TABLE [auth].[DelegationPermissions];
GO

PRINT '    [-] Dropping table [auth].[UserInvitations]...';
IF OBJECT_ID('auth.UserInvitations', 'U') IS NOT NULL
    DROP TABLE [auth].[UserInvitations];
GO

PRINT '    [-] Dropping table [auth].[PasswordHistory]...';
IF OBJECT_ID('auth.PasswordHistory', 'U') IS NOT NULL
    DROP TABLE [auth].[PasswordHistory];
GO


-- ====================================================================================================
-- 7. Drop auth.Users CHECK Constraint
-- ====================================================================================================
PRINT '    [-] Dropping constraint [CK_Users_UserType] on [auth].[Users]...';

IF EXISTS (
    SELECT 1 FROM sys.check_constraints 
    WHERE name = 'CK_Users_UserType' 
      AND parent_object_id = OBJECT_ID('auth.Users')
)
BEGIN
    ALTER TABLE [auth].[Users] DROP CONSTRAINT [CK_Users_UserType];
    PRINT '    [-] Dropped constraint [CK_Users_UserType].';
END
GO

PRINT '>>> Domain 3 Rollback completed successfully.';
GO
