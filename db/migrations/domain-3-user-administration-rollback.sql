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
FROM [auth].tbl_Role_Permissions] rp
INNER JOIN [auth].tbl_Permissions] p ON p.permission_id = rp.permission_id
WHERE p.module_name = 'USER_ADMIN' 
   OR p.permission_code LIKE 'USER.%' 
   OR p.permission_code LIKE 'VENDORUSER.%';
GO

PRINT '    [-] Removing Domain 3 Permissions...';

DELETE FROM [auth].tbl_Permissions]
WHERE module_name = 'USER_ADMIN' 
   OR permission_code LIKE 'USER.%' 
   OR permission_code LIKE 'VENDORUSER.%';
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
    WHERE s.user_id = @UserId
      AND u.IsDeleted = 0
      AND u.is_active = 1
);
GO


-- ====================================================================================================
-- 3. Drop Performance Indexes
-- ====================================================================================================
PRINT '    [-] Dropping Domain 3 performance indexes...';

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Delegations_Active' AND object_id = OBJECT_ID('auth.tbl_Delegations'))
    DROP INDEX [IX_Delegations_Active] ON [auth].tbl_Delegations];
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserProfiles_Dept' AND object_id = OBJECT_ID('auth.UserProfiles'))
    DROP INDEX [IX_UserProfiles_Dept] ON [auth].[UserProfiles];
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UOS_User' AND object_id = OBJECT_ID('auth.UserOrganizationScopes'))
    DROP INDEX [IX_UOS_User] ON [auth].[UserOrganizationScopes];
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserRoles_Role' AND object_id = OBJECT_ID('auth.tbl_User_Roles'))
    DROP INDEX [IX_UserRoles_Role] ON [auth].tbl_User_Roles];
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserRoles_User_Active' AND object_id = OBJECT_ID('auth.tbl_User_Roles'))
    DROP INDEX [IX_UserRoles_User_Active] ON [auth].tbl_User_Roles];
GO


-- ====================================================================================================
-- 4. Revert auth.UserProfiles Added Columns
-- ====================================================================================================
PRINT '    [-] Reverting [auth].[UserProfiles] added columns...';

IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_UP_CreatedAt' AND parent_object_id = OBJECT_ID('auth.UserProfiles'))
    ALTER TABLE [auth].[UserProfiles] DROP CONSTRAINT [DF_UP_CreatedAt];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserProfiles' AND COLUMN_NAME = 'created_at')
    ALTER TABLE [auth].[UserProfiles] DROP COLUMN [created_at];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserProfiles' AND COLUMN_NAME = 'created_by')
    ALTER TABLE [auth].[UserProfiles] DROP COLUMN [created_by];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserProfiles' AND COLUMN_NAME = 'updated_at')
    ALTER TABLE [auth].[UserProfiles] DROP COLUMN [updated_at];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserProfiles' AND COLUMN_NAME = 'updated_by')
    ALTER TABLE [auth].[UserProfiles] DROP COLUMN [updated_by];
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

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'effective_from')
    ALTER TABLE [auth].[UserOrganizationScopes] DROP COLUMN [effective_from];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'effective_to')
    ALTER TABLE [auth].[UserOrganizationScopes] DROP COLUMN [effective_to];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'is_active')
    ALTER TABLE [auth].[UserOrganizationScopes] DROP COLUMN [is_active];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'assigned_by')
    ALTER TABLE [auth].[UserOrganizationScopes] DROP COLUMN [assigned_by];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'assigned_at')
    ALTER TABLE [auth].[UserOrganizationScopes] DROP COLUMN [assigned_at];
GO

IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'reason')
    ALTER TABLE [auth].[UserOrganizationScopes] DROP COLUMN [reason];
GO


-- ====================================================================================================
-- 6. Drop Tables (Reverse FK Dependency Order)
-- ====================================================================================================
PRINT '    [-] Dropping table [auth].tbl_Delegation_Permissions]...';
IF OBJECT_ID('auth.tbl_Delegation_Permissions', 'U') IS NOT NULL
    DROP TABLE [auth].tbl_Delegation_Permissions];
GO

PRINT '    [-] Dropping table [auth].tbl_User_Invitations]...';
IF OBJECT_ID('auth.tbl_User_Invitations', 'U') IS NOT NULL
    DROP TABLE [auth].tbl_User_Invitations];
GO

PRINT '    [-] Dropping table [auth].tbl_Password_History]...';
IF OBJECT_ID('auth.tbl_Password_History', 'U') IS NOT NULL
    DROP TABLE [auth].tbl_Password_History];
GO


-- ====================================================================================================
-- 7. Drop auth.tbl_Users CHECK Constraint
-- ====================================================================================================
PRINT '    [-] Dropping constraint [CK_Users_UserType] on [auth].tbl_Users]...';

IF EXISTS (
    SELECT 1 FROM sys.check_constraints 
    WHERE name = 'CK_Users_UserType' 
      AND parent_object_id = OBJECT_ID('auth.tbl_Users')
)
BEGIN
    ALTER TABLE [auth].tbl_Users] DROP CONSTRAINT [CK_Users_UserType];
    PRINT '    [-] Dropped constraint [CK_Users_UserType].';
END
GO

PRINT '>>> Domain 3 Rollback completed successfully.';
GO
