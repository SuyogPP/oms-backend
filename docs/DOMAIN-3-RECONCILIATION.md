# OMS Domain 3 — User Administration: Pre-Implementation Reconciliation

**Document**: `DOMAIN-3-RECONCILIATION.md`  
**Reference Spec**: `DOMAIN-3-USER-ADMINISTRATION.md`  
**Target Schema**: `auth` / `org`  
**Database**: Microsoft SQL Server (`OMS_DB_Prod`)  
**Status**: Pre-Implementation Verification & Schema Reconciliation  

---

## 1. Comprehensive Mismatch Matrix

This matrix details every discrepancy between the assumptions in `DOMAIN-3-USER-ADMINISTRATION.md` and the actual schema and data in the live SQL Server database (`OMS_DB_Prod`), along with its architectural impact and recommended technical fix.

| # | Item | Spec Assumption | Actual Database Reality | Impact | Recommended Fix |
| :- | :--- | :--- | :--- | :--- | :--- |
| **1** | **`auth.UserTypes` Seeded Rows** | Lookup table containing `INTERNAL` / `VENDOR` (2 types). | Exactly **4 rows** exist: `INTERNAL`, `VENDOR`, `SYSTEM`, `SERVICE_ACCOUNT`. | Hardcoded validation assuming only 2 types will reject valid system/service accounts. | Update constants, DTO validators, and constraints to support all 4 seeded user types. |
| **2** | **`auth.Users.UserType` Data Drift & Missing Constraints** | `UserType` is `nvarchar(50)` matching `auth.UserTypes.UserTypeCode`. | Live data contains `INTERNAL` (21), `VENDOR` (1), and **`EXTERNAL` (1)**. **0 CHECK constraints** and **0 FKs** exist. | Spec DDL `CHECK (UserType IN ('INTERNAL', 'VENDOR'))` will fail on migration due to the existing `EXTERNAL` row. | Sanitize/migrate the `EXTERNAL` row, or include all 4 seeded types plus migration mappings before applying `CK_Users_UserType`. |
| **3** | **`auth.ScopeDefinitions` Seeded Rows** | Spec anticipates `GLOBAL`, `ORGANIZATION`, `BUSINESS_UNIT`, `DEPARTMENT`, `SECTION`, `SELF`. | Exactly **5 rows** exist: `GLOBAL`, `ORGANIZATION`, `BUSINESS_UNIT`, `DEPARTMENT`, `SECTION`. **`SELF` is not present.** | Querying for `ScopeCode = 'SELF'` against `auth.ScopeDefinitions` returns NULL / FK violation. | Resolve self-level scoping in application logic by matching `auth.Users.UserID` directly without requiring a lookup record. |
| **4** | **`auth.RoleHierarchy` Population & Direction** | Table is populated and inheritance direction can be determined from data. | Table contains **0 rows** and is referenced by **0 files** in the codebase. | Direction cannot be determined from data or code; guessing risks granting or revoking system-wide permissions. | Formally establish the enterprise RBAC direction: **Senior Role Confers Junior Permissions** (`ParentRole -> ChildRole`), with a recursive CTE depth-guarded at 10. |
| **5** | **`auth.PermissionConditions` Status** | Conditional expressions might be attached to role grants. | Both `auth.PermissionConditions` and `auth.RolePermissionConditions` have **0 rows** and `Expression` is evaluated nowhere. | Speculatively building an unverified DSL evaluator adds risk and latency to hot authorization paths. | Treat `auth.PermissionConditions` as **INERT** for Domain 3. |
| **6** | **`auth.UserOrganizationScopes` Temporal & Audit Columns** | Spec assumes `EffectiveFrom`, `EffectiveTo`, `IsActive`, `AssignedBy`, `AssignedAt`, `Reason` exist or are added. | Table currently contains legacy columns `(OrganizationID, BusinessUnitID, DepartmentID, SectionID)` + `OrgUnitId` from Domain 2, with **0 temporal/audit columns**. | User scopes cannot be time-bounded, and `org.fn_VisibleOrgUnits` does not filter on dates or active state. | Execute Section 2.3 migration DDL to add temporal/audit columns and update `org.fn_VisibleOrgUnits` in the same migration step. |
| **7** | **`auth.UserProfiles` Audit Columns** | Table has audit tracking columns. | Table has **no audit columns** (`CreatedAt`, `CreatedBy`, `UpdatedAt`, `UpdatedBy` do not exist). | User profile changes cannot be audited at the row level. | Apply Section 2.3 migration DDL to add `CreatedAt`, `CreatedBy`, `UpdatedAt`, `UpdatedBy`. |
| **8** | **`auth.Permissions` Columns** | Columns are `(PermissionID, PermissionCode, ModuleName, ActionName, Description, CreatedAt)`. | **CONFIRMED**: Real columns match. `ModuleName` and `ActionName` are `NOT NULL`; **`IsActive` does not exist**. | Unmodified spec scripts without `ActionName` or referencing `IsActive` would fail. | Use the verified schema in all seed statements. |

---

## 2. Role Hierarchy Inheritance Direction & Corrected Recursive CTE

### 2.1 Definitive Direction Statement
In enterprise Role-Based Access Control (NIST/ANSI INCITS 359-2004), role hierarchy represents **senior-to-junior permission aggregation**:
- **Parent Role (`ParentRoleID`)**: The Senior / Supervisory role (e.g. `SYSTEM_ADMIN`, `HOD`).
- **Child Role (`ChildRoleID`)**: The Junior / Component role (e.g. `REQUESTOR`, `FINANCE`).
- **Direction of Inheritance**: **Parent confers child permissions.** When a user is assigned to a `ParentRoleID`, the user transitively acquires all permissions assigned to that parent role **plus** all permissions assigned to all descendant `ChildRoleID` roles.

### 2.2 Corrected Recursive CTE (Section 4.3)
This CTE resolves all direct and transitively inherited roles for an active user. It includes an explicit `rc.Depth < 10` guard and `MAXRECURSION 10` to prevent infinite loops from cyclic relationships.

```sql
-- =============================================================================
-- Function / Query: Resolve Effective Roles for User (with Hierarchy)
-- =============================================================================
WITH RoleClosure AS (
    -- Anchor: Direct active, temporally valid role assignments
    SELECT 
        ur.RoleID, 
        0 AS Depth
    FROM [auth].[UserRoles] ur
    WHERE ur.UserID = @UserID
      AND ur.IsActive = 1
      AND ur.EffectiveFrom <= SYSUTCDATETIME()
      AND (ur.EffectiveTo IS NULL OR ur.EffectiveTo > SYSUTCDATETIME())

    UNION ALL

    -- Recursive: Parent role confers all permissions of its child roles
    SELECT 
        rh.ChildRoleID AS RoleID, 
        rc.Depth + 1 AS Depth
    FROM [auth].[RoleHierarchy] rh
    INNER JOIN RoleClosure rc 
        ON rc.RoleID = rh.ParentRoleID
    WHERE rh.IsActive = 1 
      AND rc.Depth < 10
)
SELECT DISTINCT RoleID 
FROM RoleClosure
OPTION (MAXRECURSION 10);
```

---

## 3. Corrected Section 3 Permission INSERT & Role Grant Statements

### 3.1 Insert Domain 3 Permissions
Targeted strictly against the real `auth.Permissions` schema: `(PermissionID, PermissionCode, ModuleName, ActionName, Description, CreatedAt)`.

```sql
-- =============================================================================
-- Seed: Domain 3 User Administration Permissions
-- =============================================================================
DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

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
GO
```

---

### 3.2 Role Permission Grants (`auth.RolePermissions`)
Uses the exact live Role GUIDs verified in `auth.Roles`:
- `SYSTEM_ADMIN`: `'2B850D65-CBC0-4071-9B90-694042F7338F'`
- `HR`: `'6B2E9347-3D18-4F74-B46B-A0AF4D442F02'`
- `PROCUREMENT`: `'68AA9343-481C-4ACD-A153-C5805606802C'`
- `HOD`: `'D8C2BD36-6047-4E77-8290-055BE5D4C8FC'`

```sql
-- =============================================================================
-- Seed: Domain 3 Role Permissions Grants
-- =============================================================================
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
GO
```

---

## 4. `org.fn_VisibleOrgUnits` Evolution

### 4.1 Current Live Definition
```sql
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
```

### 4.2 Updated Definition (Post-Section 2.3 Migration)
Once Section 2.3 adds `EffectiveFrom`, `EffectiveTo`, and `IsActive` to `auth.UserOrganizationScopes`, the function must filter on scope validity to prevent expired or revoked scopes from granting visibility:

```sql
-- =============================================================================
-- Function: org.fn_VisibleOrgUnits (Updated for Temporal Scope Validation)
-- =============================================================================
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
```

---

## 5. Recommendation on Gap G6 (Delegation Granularity)

### 5.1 Analysis of Options (§9.3)
- **Option (a) — All-or-nothing delegation (`auth.Delegations`)**:
  - *Auditor Assessment*: In a government / public-entity financial management system (DIEZ), an external auditor (e.g. State Audit Authority / Big 4) will issue an **Adverse Finding (Material Weakness / High Severity)** against Option (a).
  - *Why*: Violates **Principle of Least Privilege** and **Separation of Duties (SoD)**. An HOD taking annual leave who delegates to an acting supervisor transfers *every single authority*—including budget locking (`BUDGET.LOCK`), interview bypassing (`INTERVIEW.BYPASS`), and contractual approvals.
- **Option (b) — Permission-Scoped Delegation (`auth.DelegationPermissions`) [RECOMMENDED]**:
  - Allows the delegator/admin to explicitly select which permissions are delegated (e.g. only `REQUISITION.APPROVE`).
- **Option (c) — Role-Scoped Delegation (`auth.DelegationRoles`)**:
  - Better than (a), but coarser than (b) if a role contains bundled financial and administrative powers.

### 5.2 Recommended DDL for Option (b)

```sql
-- =============================================================================
-- Table: auth.DelegationPermissions (Closes Gap G6 via Granular Delegation)
-- =============================================================================
IF OBJECT_ID('auth.DelegationPermissions', 'U') IS NULL
BEGIN
    CREATE TABLE auth.DelegationPermissions (
        DelegationPermissionID UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_DelPerm_ID DEFAULT (NEWSEQUENTIALID()),
        DelegationID           UNIQUEIDENTIFIER NOT NULL,
        PermissionID           UNIQUEIDENTIFIER NOT NULL,
        CreatedAt              DATETIME2(3)     NOT NULL CONSTRAINT DF_DelPerm_CreatedAt DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT PK_DelegationPermissions PRIMARY KEY CLUSTERED (DelegationPermissionID),
        CONSTRAINT FK_DelegationPermissions_Delegation FOREIGN KEY (DelegationID) 
            REFERENCES auth.Delegations (DelegationID) ON DELETE CASCADE,
        CONSTRAINT FK_DelegationPermissions_Permission FOREIGN KEY (PermissionID) 
            REFERENCES auth.Permissions (PermissionID)
    );

    CREATE UNIQUE NONCLUSTERED INDEX UX_DelegationPermissions_Unique
        ON auth.DelegationPermissions (DelegationID, PermissionID);

    PRINT 'Created table auth.DelegationPermissions.';
END
GO
```

---

## 6. Status of `auth.PermissionConditions`

- **Determination**: **Treated as INERT for Domain 3.**
- **Findings**:
  - `auth.PermissionConditions`: **0 rows**.
  - `auth.RolePermissionConditions`: **0 rows**.
  - Search across backend and frontend codebases confirms **zero evaluation logic** exists for `Expression`.
- **What Proper Support Would Require**:
  1. A formal grammar and AST parser for secure, injection-free boolean condition evaluation (e.g. `Requisition.Amount <= 50000 AND Unit.CostCenter == User.CostCenter`).
  2. A context provider injecting entity and session parameters into the evaluation engine at runtime.
  3. Dynamic execution on every Layer 4 authorization check.
- **Decision**: In accordance with §4.4 of the specification, do not construct a speculative DSL evaluator. The tables remain in the schema but are inert.

---

## 7. Corrected & Idempotent Section 2 DDL Deployment Script

The following deployment script corrects every DDL statement from Section 2, adding safety guards, idempotent object checks, and ensuring compatibility with existing database constraints.

```sql
-- =============================================================================
-- OMS Domain 3 Schema Migration Script
-- Target: Microsoft SQL Server (OMS_DB_Prod)
-- =============================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- -----------------------------------------------------------------------------
-- 1. Create auth.PasswordHistory (Closes G1)
-- -----------------------------------------------------------------------------
IF OBJECT_ID('auth.PasswordHistory', 'U') IS NULL
BEGIN
    CREATE TABLE auth.PasswordHistory (
        PasswordHistoryID   UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_PwdHist_ID DEFAULT (NEWSEQUENTIALID()),
        UserID              UNIQUEIDENTIFIER NOT NULL,
        PasswordHash        NVARCHAR(500)    NOT NULL,
        CreatedAt           DATETIME2(3)     NOT NULL CONSTRAINT DF_PwdHist_CreatedAt DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT PK_PasswordHistory PRIMARY KEY CLUSTERED (PasswordHistoryID),
        CONSTRAINT FK_PasswordHistory_User FOREIGN KEY (UserID) REFERENCES auth.Users (UserID)
    );

    CREATE NONCLUSTERED INDEX IX_PasswordHistory_User
        ON auth.PasswordHistory (UserID, CreatedAt DESC);

    PRINT 'Created table auth.PasswordHistory.';
END
GO

-- -----------------------------------------------------------------------------
-- 2. Create auth.UserInvitations (Closes G2)
-- -----------------------------------------------------------------------------
IF OBJECT_ID('auth.UserInvitations', 'U') IS NULL
BEGIN
    CREATE TABLE auth.UserInvitations (
        UserInvitationID    UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_UserInv_ID DEFAULT (NEWSEQUENTIALID()),
        UserID              UNIQUEIDENTIFIER NOT NULL,
        TokenHash           VARBINARY(32)    NOT NULL,
        Purpose             NVARCHAR(30)     NOT NULL,
        ExpiresAt           DATETIME2(3)     NOT NULL,
        ConsumedAt          DATETIME2(3)     NULL,
        RevokedAt           DATETIME2(3)     NULL,
        IssuedByUserID      UNIQUEIDENTIFIER NULL,
        IssuedToEmail       NVARCHAR(255)    NOT NULL,
        IPAddress           VARCHAR(45)      NULL,
        CreatedAt           DATETIME2(3)     NOT NULL CONSTRAINT DF_UserInv_CreatedAt DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT PK_UserInvitations       PRIMARY KEY CLUSTERED (UserInvitationID),
        CONSTRAINT FK_UserInvitations_User  FOREIGN KEY (UserID) REFERENCES auth.Users (UserID),
        CONSTRAINT CK_UserInvitations_Purpose CHECK (Purpose IN ('INVITE','PASSWORD_RESET'))
    );

    CREATE UNIQUE NONCLUSTERED INDEX UX_UserInvitations_TokenHash
        ON auth.UserInvitations (TokenHash);

    CREATE NONCLUSTERED INDEX IX_UserInvitations_User
        ON auth.UserInvitations (UserID, Purpose, ExpiresAt DESC);

    PRINT 'Created table auth.UserInvitations.';
END
GO

-- -----------------------------------------------------------------------------
-- 3. Alter auth.UserOrganizationScopes (Closes G3)
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserOrganizationScopes' AND COLUMN_NAME = 'EffectiveFrom')
BEGIN
    ALTER TABLE auth.UserOrganizationScopes ADD
        EffectiveFrom   DATETIME2(3)     NOT NULL CONSTRAINT DF_UOS_EffFrom DEFAULT (SYSUTCDATETIME()),
        EffectiveTo     DATETIME2(3)     NULL,
        IsActive        BIT              NOT NULL CONSTRAINT DF_UOS_IsActive DEFAULT (1),
        AssignedBy      UNIQUEIDENTIFIER NULL,
        AssignedAt      DATETIME2(3)     NOT NULL CONSTRAINT DF_UOS_AssignedAt DEFAULT (SYSUTCDATETIME()),
        Reason          NVARCHAR(500)    NULL;

    PRINT 'Added temporal and audit columns to auth.UserOrganizationScopes.';
END
GO

-- -----------------------------------------------------------------------------
-- 4. Alter auth.UserProfiles (Closes G4)
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'auth' AND TABLE_NAME = 'UserProfiles' AND COLUMN_NAME = 'CreatedAt')
BEGIN
    ALTER TABLE auth.UserProfiles ADD
        CreatedAt   DATETIME2(3)     NOT NULL CONSTRAINT DF_UP_CreatedAt DEFAULT (SYSUTCDATETIME()),
        CreatedBy   UNIQUEIDENTIFIER NULL,
        UpdatedAt   DATETIME2(3)     NULL,
        UpdatedBy   UNIQUEIDENTIFIER NULL;

    PRINT 'Added audit columns to auth.UserProfiles.';
END
GO

-- -----------------------------------------------------------------------------
-- 5. Add UserType Check Constraint on auth.Users
-- -----------------------------------------------------------------------------
-- Ensure existing 'EXTERNAL' drift is mapped to 'VENDOR' before applying constraint
UPDATE auth.Users 
SET UserType = 'VENDOR' 
WHERE UserType = 'EXTERNAL';
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Users_UserType' AND parent_object_id = OBJECT_ID('auth.Users'))
BEGIN
    ALTER TABLE auth.Users WITH CHECK
    ADD CONSTRAINT CK_Users_UserType
        CHECK (UserType IN ('INTERNAL', 'VENDOR', 'SYSTEM', 'SERVICE_ACCOUNT'));

    PRINT 'Created constraint CK_Users_UserType.';
END
GO

-- -----------------------------------------------------------------------------
-- 6. Create Supporting Performance Indexes
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserRoles_User_Active' AND object_id = OBJECT_ID('auth.UserRoles'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserRoles_User_Active
        ON auth.UserRoles (UserID, EffectiveFrom, EffectiveTo)
        INCLUDE (RoleID) WHERE IsActive = 1;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserRoles_Role' AND object_id = OBJECT_ID('auth.UserRoles'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserRoles_Role
        ON auth.UserRoles (RoleID) INCLUDE (UserID) WHERE IsActive = 1;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UOS_User' AND object_id = OBJECT_ID('auth.UserOrganizationScopes'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_UOS_User
        ON auth.UserOrganizationScopes (UserID)
        INCLUDE (ScopeDefinitionID, OrgUnitId, OrganizationID, BusinessUnitID, DepartmentID, SectionID, IsActive, EffectiveFrom, EffectiveTo);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_UserProfiles_Dept' AND object_id = OBJECT_ID('auth.UserProfiles'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_UserProfiles_Dept
        ON auth.UserProfiles (DepartmentID) INCLUDE (UserID, FirstName, LastName);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Delegations_Active' AND object_id = OBJECT_ID('auth.Delegations'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Delegations_Active
        ON auth.Delegations (ToUserID, StartDate, EndDate) WHERE IsActive = 1;
END
GO
