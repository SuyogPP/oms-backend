# OMS Domain 2 — Organization Structure: Pre-Implementation Reconciliation

**Document**: `DOMAIN-2-RECONCILIATION.md`  
**Reference Spec**: `DOMAIN-2-ORGANIZATION-STRUCTURE.md`  
**Target Schema**: `org` / `auth`  
**Database**: Microsoft SQL Server (`OMS_DB_Prod`)  
**Status**: Pre-Implementation Findings & Technical Reconciliation  

---

## 1. Comprehensive Mismatch Matrix

This matrix details every discrepancy between the assumptions in `DOMAIN-2-ORGANIZATION-STRUCTURE.md` and the actual schema and data in the live SQL Server database (`OMS_DB_Prod`), along with its architectural impact and recommended technical fix.

| # | Item | Spec Assumption | Actual Database Reality | Impact | Recommended Fix |
| :- | :--- | :--- | :--- | :--- | :--- |
| **1** | **`auth.UserOrganizationScopes` Column Layout** | Single `OrgUnitId UNIQUEIDENTIFIER` with temporal columns (`EffectiveFrom`, `EffectiveTo`, `IsActive`, `IsDeleted`). | **Four separate nullable columns**: `OrganizationID`, `BusinessUnitID`, `DepartmentID`, `SectionID`. **Zero** temporal/audit columns. | **CRITICAL**: Layer 3 scope queries (`fn_VisibleOrgUnits`) cannot join on `s.OrgUnitId`. | Adopt **Option (a)**: Add a nullable `OrgUnitId UNIQUEIDENTIFIER` column to `auth.UserOrganizationScopes` with an index, backfill from the 4 legacy columns, and support fallback in the TVF. |
| **2** | **`auth.Permissions` Table Schema** | Columns: `(PermissionCode, PermissionName, Description, Module, IsActive, CreatedBy, CreatedAt)`. | Columns: `(PermissionID, PermissionCode, ModuleName, ActionName, Description, CreatedAt)`. `ActionName` is **`NOT NULL`**. `PermissionName`, `IsActive`, `CreatedBy` do **not** exist. | Spec INSERT script will fail immediately with invalid column errors. | Rewrite §2 `auth.Permissions` INSERT statements to map `ModuleName = 'Organization'`, populate mandatory `ActionName`, and omit non-existent columns. |
| **3** | **System Seed User** | `SELECT UserId FROM auth.Users WHERE Username = 'system'` | **No user named `'system'` exists.** The seed administrator is `Username = 'admin'` with `UserID = '1053433E-F36B-1410-85ED-009A959FB122'`. | Seed scripts assigning `@SystemUserId` resolve to `NULL`, causing constraint violations on `NOT NULL` columns. | Update seed scripts to look up `WHERE Username = 'admin'` or use the known static GUID `1053433E-F36B-1410-85ED-009A959FB122`. |
| **4** | **`auth.ScopeDefinitions` Seeded Codes** | Includes `GLOBAL`, `ORGANIZATION`, `BUSINESS_UNIT`, `DEPARTMENT`, `SECTION`, `SELF`. | Exactly **5 rows** exist: `GLOBAL`, `ORGANIZATION`, `BUSINESS_UNIT`, `DEPARTMENT`, `SECTION`. **`SELF` is not present.** | Lookup for `ScopeCode = 'SELF'` returns nothing. | Use only the 5 seeded scope codes. Self-level scoping in Domain 2 is resolved by matching `auth.Users.UserID` directly, without requiring a `ScopeDefinitions` record. |
| **5** | **Audit Column Nullability (`CreatedBy`)** | Spec defined `CreatedBy UNIQUEIDENTIFIER NOT NULL` on all `org.*` tables. | All `auth.*` tables define `CreatedBy UNIQUEIDENTIFIER NULL` and `UpdatedBy UNIQUEIDENTIFIER NULL`. | Rigid `NOT NULL` audit columns prevent unauthenticated system migrations and background job executions. | Change `CreatedBy` from `NOT NULL` to `NULL` across all `org.*` DDLs to match `auth.*` enterprise conventions. |
| **6** | **`auth.Users` vs `auth.UserProfiles` Org Columns** | Spec investigated whether `auth.Users` carries department/section columns to determine if `org.UserOrgUnitAssignments` is redundant. | `auth.Users` has **no** org columns. Companion table `auth.UserProfiles` contains static `BusinessUnitID`, `DepartmentID`, `SectionID` without temporal history. | Static columns in `auth.UserProfiles` cannot support temporal assignment history or multi-unit scopes. | Keep `org.UserOrgUnitAssignments` (§3.8) as the authoritative temporal assignment ledger, while optionally syncing `auth.UserProfiles` for legacy views. |
| **7** | **Schema `org` Existence** | Spec assumed `org` schema might already exist. | Query against `INFORMATION_SCHEMA.SCHEMATA` returned **0 rows**. | `CREATE TABLE org.*` will fail if schema is not initialized. | Execute `CREATE SCHEMA org AUTHORIZATION dbo;` as Step 1 of DDL deployment. |
| **8** | **Role ID References** | Spec used placeholders for Role IDs (`SYSTEM_ADMIN`, `HR`, `FINANCE`, `HOD`). | Fixed UUIDs confirmed in `auth.Roles`. | Manual substitution required before running permission grants. | Substitute the verified GUIDs directly into the `auth.RolePermissions` grant script. |

---

## 2. Recommendation for `auth.UserOrganizationScopes` (§11.2)

### Analysis of §11.2 Options

* **Option (a) — Add nullable `OrgUnitId`, backfill, deprecate old columns [RECOMMENDED]**:
  * **Why**: Scope evaluation runs on **every single authenticated request** across the entire application (Layer 3 Authorization Guard). Option (a) allows adding a direct, non-clustered index on `(UserID, OrgUnitId)`. The query planner can execute a direct index seek against `org.OrgUnitClosure(AncestorOrgUnitId)` in under **1 ms**.
  * **Zero Breaking Changes**: Existing legacy code reading `OrganizationID`, `BusinessUnitID`, `DepartmentID`, or `SectionID` continues working undisturbed during migration.
* **Option (b) — Create a View coalescing the 4 columns**:
  * **Why Rejected as Primary**: Using `COALESCE(OrganizationID, BusinessUnitID, DepartmentID, SectionID)` inside an inline TVF or view prevents SQL Server from utilizing index seek arguments (`SARGable` expressions), forcing index scans across `UserOrganizationScopes` and generating poor cardinality estimates.
* **Option (c) — Alter table to drop the 4 columns**:
  * **Why Rejected**: Unnecessarily destructive; breaks any legacy queries or reporting tools currently referencing `auth.UserOrganizationScopes`.

---

### Concrete Migration SQL for Option (a)

```sql
-- =============================================================================
-- Migration: Add Unified OrgUnitId to auth.UserOrganizationScopes
-- =============================================================================

-- Step 1: Add OrgUnitId column if it does not exist
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'auth' 
      AND TABLE_NAME = 'UserOrganizationScopes' 
      AND COLUMN_NAME = 'OrgUnitId'
)
BEGIN
    ALTER TABLE [auth].[UserOrganizationScopes]
    ADD [OrgUnitId] UNIQUEIDENTIFIER NULL;
    
    PRINT 'Added OrgUnitId column to auth.UserOrganizationScopes.';
END
GO

-- Step 2: Backfill OrgUnitId from legacy columns
UPDATE [auth].[UserOrganizationScopes]
SET [OrgUnitId] = COALESCE([SectionID], [DepartmentID], [BusinessUnitID], [OrganizationID])
WHERE [OrgUnitId] IS NULL 
  AND COALESCE([SectionID], [DepartmentID], [BusinessUnitID], [OrganizationID]) IS NOT NULL;
GO

-- Step 3: Create optimized index for Layer 3 Scope Resolution
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
    
    PRINT 'Created index IX_UserOrganizationScopes_User_OrgUnit.';
END
GO
```

---

## 3. Corrected Inline TVF: `org.fn_VisibleOrgUnits` (§9.2)

This inline Table-Valued Function (TVF) provides **dual-mode compatibility**:
1. It immediately seeks `s.OrgUnitId` when populated.
2. It falls back gracefully to `COALESCE(s.SectionID, s.DepartmentID, s.BusinessUnitID, s.OrganizationID)` if `OrgUnitId` has not yet been populated for a given row.
3. It remains an **Inline TVF** (`RETURNS TABLE AS RETURN (...)`), allowing SQL Server to inline the query plan directly into the calling `SELECT` with zero tempdb / multi-statement overhead.

```sql
-- =============================================================================
-- Function: org.fn_VisibleOrgUnits
-- Purpose: Returns all OrgUnitIDs visible to a given UserID based on closure tree.
-- =============================================================================
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
```

---

## 4. Corrected Permissions & Role Grants (§2)

### A. Insert Domain 2 Permissions

Matches the live `auth.Permissions` schema: `(PermissionCode, ModuleName, ActionName, Description, CreatedAt)`.

```sql
-- =============================================================================
-- Seed: Domain 2 Organization Permissions
-- =============================================================================
DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

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
GO
```

---

### B. Role Grants (`auth.RolePermissions`)

Utilizes the **exact live Role IDs** verified in `auth.Roles`:
* `SYSTEM_ADMIN`: `2B850D65-CBC0-4071-9B90-694042F7338F`
* `HR`: `6B2E9347-3D18-4F74-B46B-A0AF4D442F02`
* `FINANCE`: `F9FD28DA-1C14-4699-B5FA-0DA983A9A3A2`
* `HOD`: `D8C2BD36-6047-4E77-8290-055BE5D4C8FC`

```sql
-- =============================================================================
-- Seed: Domain 2 Role Permissions Mapping
-- =============================================================================
DECLARE @SystemAdminRoleId UNIQUEIDENTIFIER = '2B850D65-CBC0-4071-9B90-694042F7338F';
DECLARE @HrRoleId          UNIQUEIDENTIFIER = '6B2E9347-3D18-4F74-B46B-A0AF4D442F02';
DECLARE @FinanceRoleId     UNIQUEIDENTIFIER = 'F9FD28DA-1C14-4699-B5FA-0DA983A9A3A2';
DECLARE @HodRoleId         UNIQUEIDENTIFIER = 'D8C2BD36-6047-4E77-8290-055BE5D4C8FC';

DECLARE @RolePermissions TABLE (
    RoleID UNIQUEIDENTIFIER,
    PermissionCode NVARCHAR(150)
);

-- SYSTEM_ADMIN gets all 8 permissions
INSERT INTO @RolePermissions (RoleID, PermissionCode) VALUES
(@SystemAdminRoleId, 'ORG.VIEW'),
(@SystemAdminRoleId, 'ORG.CREATE'),
(@SystemAdminRoleId, 'ORG.UPDATE'),
(@SystemAdminRoleId, 'ORG.MOVE'),
(@SystemAdminRoleId, 'ORG.DELETE'),
(@SystemAdminRoleId, 'ORG.MANAGER.ASSIGN'),
(@SystemAdminRoleId, 'ORG.TYPE.MANAGE'),
(@SystemAdminRoleId, 'ORG.EXPORT');

-- HR gets VIEW, MANAGER.ASSIGN, and EXPORT
INSERT INTO @RolePermissions (RoleID, PermissionCode) VALUES
(@HrRoleId, 'ORG.VIEW'),
(@HrRoleId, 'ORG.MANAGER.ASSIGN'),
(@HrRoleId, 'ORG.EXPORT');

-- FINANCE gets VIEW and EXPORT
INSERT INTO @RolePermissions (RoleID, PermissionCode) VALUES
(@FinanceRoleId, 'ORG.VIEW'),
(@FinanceRoleId, 'ORG.EXPORT');

-- HOD gets VIEW and EXPORT
INSERT INTO @RolePermissions (RoleID, PermissionCode) VALUES
(@HodRoleId, 'ORG.VIEW'),
(@HodRoleId, 'ORG.EXPORT');

-- Grant permissions idempotently
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
GO
```

---

## 5. Determination on `org.UserOrgUnitAssignments` (§3.8)

### Architectural Statement: **`org.UserOrgUnitAssignments` IS MANDATORY AND MUST BE RETAINED.**

#### Technical Justification:
1. **`auth.Users` has zero org unit columns**: The root user entity does not link to departments or sections.
2. **`auth.UserProfiles` is static and non-temporal**: While `auth.UserProfiles` contains `DepartmentID`, `BusinessUnitID`, and `SectionID`, it lacks:
   - `EffectiveFrom` / `EffectiveTo` (temporal validity required for audit/re-org tracking).
   - Primary vs Secondary assignment flags (`IsPrimary`).
   - Audit trail for transfers between departments.
   - Assignment to arbitrary tree depths (e.g. assigning a user directly to a Business Unit or holding Organization).
3. **Enterprise Re-organization Integrity**: When a user transfers from Department A to Department B on `2026-09-01`, historical requisitions and budget approvals created in August must continue referencing the user's historical assignment.
4. **Compatibility Plan**: `org.UserOrgUnitAssignments` serves as the authoritative temporal ledger. The primary active assignment will keep `auth.UserProfiles` updated for backward compatibility with legacy views.

---

## 6. Corrected DDL Specifications (Failure-Proof)

All DDLs below have been adjusted to:
1. Reference exact foreign key column names in `auth` (`[auth].[Users]([UserID])`).
2. Make `CreatedBy` / `UpdatedBy` / `DeletedBy` **`NULL`** to match `auth.*` standards.
3. Ensure exact SQL Server data types and naming conventions.

```sql
-- =============================================================================
-- Schema Initialization
-- =============================================================================
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'org')
BEGIN
    EXEC('CREATE SCHEMA org AUTHORIZATION dbo;');
END
GO

-- =============================================================================
-- 1. org.OrgUnitTypes
-- =============================================================================
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
END
GO

-- =============================================================================
-- 2. org.OrgUnitTypeHierarchyRules
-- =============================================================================
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
END
GO

-- =============================================================================
-- 3. org.OrgUnits
-- =============================================================================
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
END
GO

-- =============================================================================
-- 4. org.OrgUnitClosure
-- =============================================================================
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
END
GO

-- =============================================================================
-- 5. org.OrgUnitManagers
-- =============================================================================
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
END
GO

-- =============================================================================
-- 6. org.OrgUnitChangeLog
-- =============================================================================
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
END
GO

-- =============================================================================
-- 7. org.UserOrgUnitAssignments
-- =============================================================================
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
END
GO
```

---

## 7. Corrected Initial Seed Script (§5)

```sql
-- =============================================================================
-- Seed: Domain 2 Unit Types, Hierarchy Rules, and Root Organization
-- =============================================================================
DECLARE @AdminUserId UNIQUEIDENTIFIER = (SELECT TOP 1 UserID FROM auth.Users WHERE Username = 'admin');
IF @AdminUserId IS NULL
    SET @AdminUserId = '1053433E-F36B-1410-85ED-009A959FB122';

-- 1. Unit Types
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

-- 2. Hierarchy Rules
MERGE org.OrgUnitTypeHierarchyRules AS Target
USING (VALUES
 (2, 1), -- BU under Organization
 (3, 1), -- Department under Organization
 (3, 2), -- Department under BU
 (4, 3)  -- Section under Department
) AS Source (ChildOrgUnitTypeId, ParentOrgUnitTypeId)
ON Target.ChildOrgUnitTypeId = Source.ChildOrgUnitTypeId AND Target.ParentOrgUnitTypeId = Source.ParentOrgUnitTypeId
WHEN MATCHED THEN
    UPDATE SET Target.IsActive = 1
WHEN NOT MATCHED THEN
    INSERT (ChildOrgUnitTypeId, ParentOrgUnitTypeId, CreatedBy)
    VALUES (Source.ChildOrgUnitTypeId, Source.ParentOrgUnitTypeId, @AdminUserId);

-- 3. Root Organization (DIEZ)
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
END
GO
```
