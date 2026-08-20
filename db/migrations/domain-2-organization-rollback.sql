-- ====================================================================================================
-- DIEZ Outsource Management System (OMS) — Database Rollback Script
-- Domain 2: Organization Structure Rollback
--
-- Target Database : OMS_DB_Prod
-- Target Schema   : org
--
-- Purpose: Drops all Domain 2 tables, indexes, functions, permissions, and schema in reverse dependency order.
-- ====================================================================================================

USE [OMS_DB_Prod];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT '>>> Starting Domain 2 Organization Structure Rollback...';

-- ====================================================================================================
-- 1. Remove Role Permissions & Permissions
-- ====================================================================================================
PRINT '    [-] Removing Domain 2 Role Permissions...';
DELETE rp
FROM [auth].[RolePermissions] rp
INNER JOIN [auth].[Permissions] p ON p.PermissionID = rp.PermissionID
WHERE p.ModuleName = 'Organization' OR p.PermissionCode LIKE 'ORG.%';
GO

PRINT '    [-] Removing Domain 2 Permissions...';
DELETE FROM [auth].[Permissions]
WHERE ModuleName = 'Organization' OR PermissionCode LIKE 'ORG.%';
GO

-- ====================================================================================================
-- 2. Drop Functions
-- ====================================================================================================
PRINT '    [-] Dropping function [org].[fn_VisibleOrgUnits]...';
IF OBJECT_ID('org.fn_VisibleOrgUnits', 'IF') IS NOT NULL
    DROP FUNCTION org.fn_VisibleOrgUnits;
GO

-- ====================================================================================================
-- 3. Drop Tables (Reverse FK Dependency Order)
-- ====================================================================================================
PRINT '    [-] Dropping table [org].[UserOrgUnitAssignments]...';
IF OBJECT_ID('org.UserOrgUnitAssignments', 'U') IS NOT NULL
    DROP TABLE org.UserOrgUnitAssignments;
GO

PRINT '    [-] Dropping table [org].[OrgUnitChangeLog]...';
IF OBJECT_ID('org.OrgUnitChangeLog', 'U') IS NOT NULL
    DROP TABLE org.OrgUnitChangeLog;
GO

PRINT '    [-] Dropping table [org].[OrgUnitManagers]...';
IF OBJECT_ID('org.OrgUnitManagers', 'U') IS NOT NULL
    DROP TABLE org.OrgUnitManagers;
GO

PRINT '    [-] Dropping table [org].[OrgUnitClosure]...';
IF OBJECT_ID('org.OrgUnitClosure', 'U') IS NOT NULL
    DROP TABLE org.OrgUnitClosure;
GO

PRINT '    [-] Dropping table [org].[OrgUnits]...';
IF OBJECT_ID('org.OrgUnits', 'U') IS NOT NULL
    DROP TABLE org.OrgUnits;
GO

PRINT '    [-] Dropping table [org].[OrgUnitTypeHierarchyRules]...';
IF OBJECT_ID('org.OrgUnitTypeHierarchyRules', 'U') IS NOT NULL
    DROP TABLE org.OrgUnitTypeHierarchyRules;
GO

PRINT '    [-] Dropping table [org].[OrgUnitTypes]...';
IF OBJECT_ID('org.OrgUnitTypes', 'U') IS NOT NULL
    DROP TABLE org.OrgUnitTypes;
GO

-- ====================================================================================================
-- 4. Drop Schema 'org'
-- ====================================================================================================
PRINT '    [-] Dropping schema [org]...';
IF EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'org')
BEGIN
    EXEC('DROP SCHEMA org;');
    PRINT '    [-] Dropped schema [org].';
END
GO

-- ====================================================================================================
-- 5. Revert auth.UserOrganizationScopes Changes
-- ====================================================================================================
PRINT '    [-] Reverting [auth].[UserOrganizationScopes] alterations...';

IF EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_UserOrganizationScopes_User_OrgUnit' 
      AND object_id = OBJECT_ID('auth.UserOrganizationScopes')
)
BEGIN
    DROP INDEX [IX_UserOrganizationScopes_User_OrgUnit] ON [auth].[UserOrganizationScopes];
    PRINT '    [-] Dropped index [IX_UserOrganizationScopes_User_OrgUnit].';
END
GO

IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'auth' 
      AND TABLE_NAME = 'UserOrganizationScopes' 
      AND COLUMN_NAME = 'OrgUnitId'
)
BEGIN
    ALTER TABLE [auth].[UserOrganizationScopes]
    DROP COLUMN [OrgUnitId];
    PRINT '    [-] Dropped column [OrgUnitId] from [auth].[UserOrganizationScopes].';
END
GO

PRINT '====================================================================================================';
PRINT '>>> DOMAIN 2 ROLLBACK COMPLETED SUCCESSFULLY.';
PRINT '====================================================================================================';
GO
