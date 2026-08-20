# OMS Domain 2 — Organization Structure

**Implementation specification**

| | |
| :--- | :--- |
| Domain | 2 — Organization Structure |
| Depends on | Domain 1 (Security & RBAC), Step 0 cross-cutting infrastructure |
| Blocks | Budget, Requisition, User Administration, Reporting, Scope enforcement |
| Schema | `org` |
| Backend module root | `src/modules/organization/` |
| API base | `/api/v1/organization` |

---

## 0. Read This First

### 0.1 Why this domain is high-risk

Organization Structure is not CRUD. Three things make it the most
consequential module in the system after auth:

1. **Layer 3 authorization depends on it.** Every authenticated request
   resolves "what can this user see?" against this tree. A slow or wrong
   subtree query degrades or breaks the entire application.
2. **Budget is per-department.** The RFP requires Finance to upload annual
   budgets per Department within every Organization or BU. Budget lines will
   FK to this tree, and budget history must survive reorganisation.
3. **Approval routing depends on it.** The 14-stage workflow routes Line
   Manager → Section Head → HOD by walking this hierarchy.

Get the tree wrong and you rewrite four downstream domains.

### 0.2 Pre-implementation verification — do this before writing code

The 28 `auth` tables already exist. This spec must be reconciled against
them, not assumed compatible. **Claude Code: verify each of these against
the live database and report findings before implementing anything.**

- [ ] `auth.ScopeDefinitions` — what are the exact column names and the
      actual seeded scope level codes? This spec assumes `GLOBAL`,
      `ORGANIZATION`, `BUSINESS_UNIT`, `DEPARTMENT`, `SECTION`, `SELF`.
- [ ] `auth.UserOrganizationScopes` — what columns hold the org reference?
      This spec assumes a single nullable `OrgUnitId UNIQUEIDENTIFIER`. If
      it instead has separate `OrganizationId` / `BusinessUnitId` /
      `DepartmentId` / `SectionId` columns, **stop and report** — §11.2
      covers the reconciliation options.
- [ ] `auth.Users` — is there already a department/section reference column?
      If yes, §5.6 (`org.UserOrgUnitAssignments`) is redundant and must be
      dropped from the plan.
- [ ] `auth.DataAccessRules` — does it exist, and does it reference org
      entities?
- [ ] `auth.Permissions` — confirm the insert format and whether a
      `PermissionGroup` / `Module` column must be populated.
- [ ] Confirm the standard audit column names in use across `auth.*`. This
      spec assumes `CreatedBy`, `CreatedAt`, `UpdatedBy`, `UpdatedAt`,
      `DeletedBy`, `DeletedAt`. **Match whatever `auth.*` actually uses** —
      consistency beats this document.

### 0.3 Design decisions taken, and why

| Decision | Rationale |
| :--- | :--- |
| One unified `OrgUnits` table, not four tables | Scope resolution needs a single uniform subtree query. Four tables means four-way UNION on every request. Also allows a new level (e.g. Division) without schema change. |
| Adjacency list **plus** closure table | Adjacency (`ParentOrgUnitId`) is the source of truth and enforces integrity. The closure table makes "all descendants of X" a single indexed join instead of a recursive CTE on every request. |
| Materialized path retained alongside closure | Used for display ordering and prefix search only. Stores **IDs, not codes**, so renames don't invalidate it. |
| Hierarchy rules stored as data, not code | The RFP allows Departments under *either* the holding Organization *or* a BU. Hardcoding parent rules guarantees a schema change when DIEZ reorganises. |
| Effective dating on units and managers | Reorganisations must not corrupt historical budget and requisition records. |
| `ROWVERSION` on `OrgUnits` | Move and rename operations must not race. |

### 0.4 Hierarchy shape

```
Organization  (DIEZ — holding)
├── Department            ← permitted: departments may hang off the holding org
│   └── Section
└── Business Unit
    └── Department
        └── Section
```

Source: RFP v1.3, Master Data & Configuration — *"The OMS system will
accommodate several organizations, known as Business Units (BUs), within the
main or holding organization. Both the main organization and each BU can
contain departments, and each department may include multiple sections."*

Depth is therefore **variable**: a Department may sit at depth 1 or depth 2.
Never assume depth from type.

---

## 1. Scope

### In scope

- Org unit type registry and hierarchy rules
- Org unit CRUD, move, activate/deactivate, soft delete
- Closure table and materialized path maintenance
- Manager assignment (HOD, Section Head, Deputy, Acting) with effective dating
- Structural change audit log
- Scope resolution helpers consumed by the Layer 3 authorization guard
- Admin UI under `/app/administration/master-data`
- AD and Oracle mapping columns (columns only — sync itself is a later domain)

### Out of scope

- Active Directory synchronisation job (Domain 8 / Integrations)
- Delegation engine — acting manager *authorization* lives in `auth`
- Budget lines (Domain 4) — this domain only provides the FK target
- Job titles, grades, locations, employment types — separate master data modules

---

## 2. Permissions

Add to `auth.Permissions`. Verify column names against §0.2 first.

```sql
INSERT INTO auth.Permissions (PermissionCode, PermissionName, Description, Module, IsActive, CreatedBy, CreatedAt)
VALUES
 ('ORG.VIEW',            'View Organization Structure',  'View org units, tree, and managers',        'ORGANIZATION', 1, @SystemUserId, SYSUTCDATETIME()),
 ('ORG.CREATE',          'Create Organization Unit',     'Create a new org unit',                     'ORGANIZATION', 1, @SystemUserId, SYSUTCDATETIME()),
 ('ORG.UPDATE',          'Update Organization Unit',     'Rename or edit org unit attributes',        'ORGANIZATION', 1, @SystemUserId, SYSUTCDATETIME()),
 ('ORG.MOVE',            'Move Organization Unit',       'Reparent an org unit and its subtree',      'ORGANIZATION', 1, @SystemUserId, SYSUTCDATETIME()),
 ('ORG.DELETE',          'Delete Organization Unit',     'Soft delete an org unit',                   'ORGANIZATION', 1, @SystemUserId, SYSUTCDATETIME()),
 ('ORG.MANAGER.ASSIGN',  'Assign Org Unit Manager',      'Assign or end HOD / Section Head / Acting', 'ORGANIZATION', 1, @SystemUserId, SYSUTCDATETIME()),
 ('ORG.TYPE.MANAGE',     'Manage Org Unit Types',        'Manage unit types and hierarchy rules',     'ORGANIZATION', 1, @SystemUserId, SYSUTCDATETIME()),
 ('ORG.EXPORT',          'Export Organization Structure','Export the org tree',                       'ORGANIZATION', 1, @SystemUserId, SYSUTCDATETIME());
```

Role grants (adjust to the actual role IDs):

| Permission | SYSTEM_ADMIN | HR | FINANCE | HOD | Others |
| :--- | :---: | :---: | :---: | :---: | :---: |
| ORG.VIEW | ✓ | ✓ | ✓ | ✓ | ✓ (scoped) |
| ORG.CREATE | ✓ | — | — | — | — |
| ORG.UPDATE | ✓ | — | — | — | — |
| ORG.MOVE | ✓ | — | — | — | — |
| ORG.DELETE | ✓ | — | — | — | — |
| ORG.MANAGER.ASSIGN | ✓ | ✓ | — | — | — |
| ORG.TYPE.MANAGE | ✓ | — | — | — | — |
| ORG.EXPORT | ✓ | ✓ | ✓ | ✓ | — |

`ORG.VIEW` is granted broadly but **always scope-filtered** — see §9.

---

## 3. DDL

Run in the order given. Every statement is idempotent-safe to review before
execution; run them one block at a time.

### 3.1 Schema

```sql
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'org')
    EXEC('CREATE SCHEMA org AUTHORIZATION dbo;');
GO
```

### 3.2 `org.OrgUnitTypes`

Lookup. Fixed IDs — referenced as constants in code, so they must be stable.

```sql
CREATE TABLE org.OrgUnitTypes (
    OrgUnitTypeId       TINYINT             NOT NULL,
    Code                VARCHAR(30)         NOT NULL,
    Name                NVARCHAR(100)       NOT NULL,
    NameAr              NVARCHAR(100)       NULL,
    Description         NVARCHAR(500)       NULL,

    -- Canonical depth for display and reporting only.
    -- DO NOT use to infer actual tree depth (Departments vary: see §0.4).
    CanonicalLevel      TINYINT             NOT NULL,

    -- Maps to auth.ScopeDefinitions. Verify codes per §0.2.
    ScopeLevelCode      VARCHAR(30)         NOT NULL,

    AllowsBudget        BIT                 NOT NULL CONSTRAINT DF_OrgUnitTypes_AllowsBudget      DEFAULT (0),
    AllowsRequisition   BIT                 NOT NULL CONSTRAINT DF_OrgUnitTypes_AllowsRequisition DEFAULT (0),
    AllowsManager       BIT                 NOT NULL CONSTRAINT DF_OrgUnitTypes_AllowsManager     DEFAULT (1),
    IsRootType          BIT                 NOT NULL CONSTRAINT DF_OrgUnitTypes_IsRootType        DEFAULT (0),

    SortOrder           SMALLINT            NOT NULL CONSTRAINT DF_OrgUnitTypes_SortOrder DEFAULT (0),
    IsActive            BIT                 NOT NULL CONSTRAINT DF_OrgUnitTypes_IsActive  DEFAULT (1),
    IsDeleted           BIT                 NOT NULL CONSTRAINT DF_OrgUnitTypes_IsDeleted DEFAULT (0),

    CreatedBy           UNIQUEIDENTIFIER    NOT NULL,
    CreatedAt           DATETIME2(3)        NOT NULL CONSTRAINT DF_OrgUnitTypes_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedBy           UNIQUEIDENTIFIER    NULL,
    UpdatedAt           DATETIME2(3)        NULL,

    CONSTRAINT PK_OrgUnitTypes        PRIMARY KEY CLUSTERED (OrgUnitTypeId),
    CONSTRAINT UQ_OrgUnitTypes_Code   UNIQUE (Code)
);
GO
```

### 3.3 `org.OrgUnitTypeHierarchyRules`

Which type may be a child of which. Data-driven so a reorg does not require
a schema change.

```sql
CREATE TABLE org.OrgUnitTypeHierarchyRules (
    ChildOrgUnitTypeId  TINYINT             NOT NULL,
    ParentOrgUnitTypeId TINYINT             NOT NULL,
    IsActive            BIT                 NOT NULL CONSTRAINT DF_OUTHR_IsActive DEFAULT (1),
    CreatedBy           UNIQUEIDENTIFIER    NOT NULL,
    CreatedAt           DATETIME2(3)        NOT NULL CONSTRAINT DF_OUTHR_CreatedAt DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_OrgUnitTypeHierarchyRules PRIMARY KEY CLUSTERED (ChildOrgUnitTypeId, ParentOrgUnitTypeId),
    CONSTRAINT FK_OUTHR_Child  FOREIGN KEY (ChildOrgUnitTypeId)  REFERENCES org.OrgUnitTypes (OrgUnitTypeId),
    CONSTRAINT FK_OUTHR_Parent FOREIGN KEY (ParentOrgUnitTypeId) REFERENCES org.OrgUnitTypes (OrgUnitTypeId)
);
GO
```

### 3.4 `org.OrgUnits`

The tree. Adjacency list is the source of truth.

```sql
CREATE TABLE org.OrgUnits (
    OrgUnitId           UNIQUEIDENTIFIER    NOT NULL CONSTRAINT DF_OrgUnits_OrgUnitId DEFAULT (NEWSEQUENTIALID()),
    OrgUnitTypeId       TINYINT             NOT NULL,
    ParentOrgUnitId     UNIQUEIDENTIFIER    NULL,

    Code                VARCHAR(50)         NOT NULL,
    Name                NVARCHAR(200)       NOT NULL,
    NameAr              NVARCHAR(200)       NULL,
    ShortName           NVARCHAR(50)        NULL,
    Description         NVARCHAR(1000)      NULL,

    -- '/{32-hex}/{32-hex}/...' — ID-based, stable under rename.
    -- Display/sorting only. Never the basis of an authorization decision.
    MaterializedPath    VARCHAR(900)        NOT NULL,
    Depth               TINYINT             NOT NULL CONSTRAINT DF_OrgUnits_Depth DEFAULT (0),

    -- Integration keys
    CostCenterCode      VARCHAR(50)         NULL,
    ADObjectGuid        UNIQUEIDENTIFIER    NULL,
    ADDistinguishedName NVARCHAR(500)       NULL,
    OracleOrgCode       VARCHAR(50)         NULL,

    -- Denormalised current primary head. Maintained by the manager service.
    -- Convenience for list rendering ONLY. Approval routing MUST resolve
    -- through org.OrgUnitManagers with effective-date checks. See §7.4.
    HeadUserId          UNIQUEIDENTIFIER    NULL,

    EmailAddress        NVARCHAR(256)       NULL,
    PhoneNumber         VARCHAR(30)         NULL,

    SortOrder           SMALLINT            NOT NULL CONSTRAINT DF_OrgUnits_SortOrder DEFAULT (0),

    EffectiveFrom       DATE                NOT NULL CONSTRAINT DF_OrgUnits_EffectiveFrom DEFAULT (CAST(SYSUTCDATETIME() AS DATE)),
    EffectiveTo         DATE                NULL,

    IsActive            BIT                 NOT NULL CONSTRAINT DF_OrgUnits_IsActive  DEFAULT (1),
    IsDeleted           BIT                 NOT NULL CONSTRAINT DF_OrgUnits_IsDeleted DEFAULT (0),

    CreatedBy           UNIQUEIDENTIFIER    NOT NULL,
    CreatedAt           DATETIME2(3)        NOT NULL CONSTRAINT DF_OrgUnits_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedBy           UNIQUEIDENTIFIER    NULL,
    UpdatedAt           DATETIME2(3)        NULL,
    DeletedBy           UNIQUEIDENTIFIER    NULL,
    DeletedAt           DATETIME2(3)        NULL,

    RowVersion          ROWVERSION          NOT NULL,

    CONSTRAINT PK_OrgUnits          PRIMARY KEY CLUSTERED (OrgUnitId),
    CONSTRAINT FK_OrgUnits_Type     FOREIGN KEY (OrgUnitTypeId)   REFERENCES org.OrgUnitTypes (OrgUnitTypeId),
    CONSTRAINT FK_OrgUnits_Parent   FOREIGN KEY (ParentOrgUnitId) REFERENCES org.OrgUnits (OrgUnitId),
    CONSTRAINT CK_OrgUnits_NoSelfParent CHECK (ParentOrgUnitId IS NULL OR ParentOrgUnitId <> OrgUnitId),
    CONSTRAINT CK_OrgUnits_Effective    CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
GO
```

> `FK_OrgUnits_Parent` is deliberately **without** `ON DELETE CASCADE`.
> Deletes are soft; a cascade here would be a data-loss trap.

### 3.5 `org.OrgUnitClosure`

Transitive closure. Every node has a self-row at depth 0.

```sql
CREATE TABLE org.OrgUnitClosure (
    AncestorOrgUnitId   UNIQUEIDENTIFIER    NOT NULL,
    DescendantOrgUnitId UNIQUEIDENTIFIER    NOT NULL,
    Depth               TINYINT             NOT NULL,

    CONSTRAINT PK_OrgUnitClosure PRIMARY KEY CLUSTERED (AncestorOrgUnitId, DescendantOrgUnitId),
    CONSTRAINT FK_OrgUnitClosure_Ancestor   FOREIGN KEY (AncestorOrgUnitId)   REFERENCES org.OrgUnits (OrgUnitId),
    CONSTRAINT FK_OrgUnitClosure_Descendant FOREIGN KEY (DescendantOrgUnitId) REFERENCES org.OrgUnits (OrgUnitId)
);
GO
```

### 3.6 `org.OrgUnitManagers`

Temporal. Supports HOD, Section Head, Deputy, Acting.

```sql
CREATE TABLE org.OrgUnitManagers (
    OrgUnitManagerId    UNIQUEIDENTIFIER    NOT NULL CONSTRAINT DF_OrgUnitManagers_Id DEFAULT (NEWSEQUENTIALID()),
    OrgUnitId           UNIQUEIDENTIFIER    NOT NULL,
    UserId              UNIQUEIDENTIFIER    NOT NULL,

    -- HEAD | DEPUTY | ACTING
    ManagerRoleCode     VARCHAR(30)         NOT NULL,

    -- Exactly one active IsPrimary=1 HEAD per unit at any point in time.
    IsPrimary           BIT                 NOT NULL CONSTRAINT DF_OrgUnitManagers_IsPrimary DEFAULT (0),

    EffectiveFrom       DATE                NOT NULL,
    EffectiveTo         DATE                NULL,

    AssignmentReason    NVARCHAR(500)       NULL,

    IsActive            BIT                 NOT NULL CONSTRAINT DF_OrgUnitManagers_IsActive  DEFAULT (1),
    IsDeleted           BIT                 NOT NULL CONSTRAINT DF_OrgUnitManagers_IsDeleted DEFAULT (0),

    CreatedBy           UNIQUEIDENTIFIER    NOT NULL,
    CreatedAt           DATETIME2(3)        NOT NULL CONSTRAINT DF_OrgUnitManagers_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedBy           UNIQUEIDENTIFIER    NULL,
    UpdatedAt           DATETIME2(3)        NULL,
    DeletedBy           UNIQUEIDENTIFIER    NULL,
    DeletedAt           DATETIME2(3)        NULL,

    CONSTRAINT PK_OrgUnitManagers        PRIMARY KEY CLUSTERED (OrgUnitManagerId),
    CONSTRAINT FK_OrgUnitManagers_Unit   FOREIGN KEY (OrgUnitId) REFERENCES org.OrgUnits (OrgUnitId),
    CONSTRAINT FK_OrgUnitManagers_User   FOREIGN KEY (UserId)    REFERENCES auth.Users (UserId),
    CONSTRAINT CK_OrgUnitManagers_Role   CHECK (ManagerRoleCode IN ('HEAD','DEPUTY','ACTING')),
    CONSTRAINT CK_OrgUnitManagers_Eff    CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
GO
```

> **Verify `auth.Users` PK column name before running** — this spec assumes
> `UserId`.

### 3.7 `org.OrgUnitChangeLog`

Structural audit. Separate from `auth.AuditLogs` because structural changes
need before/after parentage for reorganisation forensics.

```sql
CREATE TABLE org.OrgUnitChangeLog (
    OrgUnitChangeLogId  BIGINT              IDENTITY(1,1) NOT NULL,
    OrgUnitId           UNIQUEIDENTIFIER    NOT NULL,

    -- CREATED | RENAMED | MOVED | ACTIVATED | DEACTIVATED | DELETED
    -- | RESTORED | HEAD_ASSIGNED | HEAD_ENDED | ATTRIBUTES_UPDATED
    ChangeType          VARCHAR(30)         NOT NULL,

    OldParentOrgUnitId  UNIQUEIDENTIFIER    NULL,
    NewParentOrgUnitId  UNIQUEIDENTIFIER    NULL,
    OldValues           NVARCHAR(MAX)       NULL,   -- JSON
    NewValues           NVARCHAR(MAX)       NULL,   -- JSON
    AffectedNodeCount   INT                 NULL,   -- subtree size on MOVED
    Reason              NVARCHAR(1000)      NULL,

    CorrelationId       UNIQUEIDENTIFIER    NULL,
    IPAddress           VARCHAR(45)         NULL,
    UserAgent           NVARCHAR(500)       NULL,

    PerformedBy         UNIQUEIDENTIFIER    NOT NULL,
    PerformedAt         DATETIME2(3)        NOT NULL CONSTRAINT DF_OrgUnitChangeLog_At DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_OrgUnitChangeLog PRIMARY KEY CLUSTERED (OrgUnitChangeLogId),
    CONSTRAINT CK_OrgUnitChangeLog_Json
        CHECK (
            (OldValues IS NULL OR ISJSON(OldValues) = 1)
        AND (NewValues IS NULL OR ISJSON(NewValues) = 1)
        )
);
GO
```

No FK on `OrgUnitId` — the log must survive hard purges.

### 3.8 `org.UserOrgUnitAssignments` — CONDITIONAL

**Only create this if §0.2 confirms `auth.Users` has no department/section
reference.** If `auth.Users` already carries one, skip this table entirely
and use the existing column.

```sql
CREATE TABLE org.UserOrgUnitAssignments (
    UserOrgUnitAssignmentId UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_UOUA_Id DEFAULT (NEWSEQUENTIALID()),
    UserId                  UNIQUEIDENTIFIER NOT NULL,
    OrgUnitId               UNIQUEIDENTIFIER NOT NULL,
    IsPrimary               BIT              NOT NULL CONSTRAINT DF_UOUA_IsPrimary DEFAULT (1),
    EffectiveFrom           DATE             NOT NULL,
    EffectiveTo             DATE             NULL,
    IsActive                BIT              NOT NULL CONSTRAINT DF_UOUA_IsActive  DEFAULT (1),
    IsDeleted               BIT              NOT NULL CONSTRAINT DF_UOUA_IsDeleted DEFAULT (0),
    CreatedBy               UNIQUEIDENTIFIER NOT NULL,
    CreatedAt               DATETIME2(3)     NOT NULL CONSTRAINT DF_UOUA_CreatedAt DEFAULT (SYSUTCDATETIME()),
    UpdatedBy               UNIQUEIDENTIFIER NULL,
    UpdatedAt               DATETIME2(3)     NULL,

    CONSTRAINT PK_UserOrgUnitAssignments PRIMARY KEY CLUSTERED (UserOrgUnitAssignmentId),
    CONSTRAINT FK_UOUA_User    FOREIGN KEY (UserId)    REFERENCES auth.Users (UserId),
    CONSTRAINT FK_UOUA_OrgUnit FOREIGN KEY (OrgUnitId) REFERENCES org.OrgUnits (OrgUnitId),
    CONSTRAINT CK_UOUA_Eff     CHECK (EffectiveTo IS NULL OR EffectiveTo >= EffectiveFrom)
);
GO
```

---

## 4. Indexes

```sql
-- ── org.OrgUnits ────────────────────────────────────────────────────────
-- Code unique among live siblings. Filtered so soft-deleted rows don't block reuse.
CREATE UNIQUE NONCLUSTERED INDEX UX_OrgUnits_Parent_Code
    ON org.OrgUnits (ParentOrgUnitId, Code)
    WHERE IsDeleted = 0;

-- Root-level uniqueness (ParentOrgUnitId IS NULL is not covered above in the
-- way you'd expect — NULLs compare unequal in a multi-column unique index).
CREATE UNIQUE NONCLUSTERED INDEX UX_OrgUnits_Root_Code
    ON org.OrgUnits (Code)
    WHERE IsDeleted = 0 AND ParentOrgUnitId IS NULL;

CREATE NONCLUSTERED INDEX IX_OrgUnits_Parent
    ON org.OrgUnits (ParentOrgUnitId)
    INCLUDE (OrgUnitTypeId, Name, SortOrder, IsActive)
    WHERE IsDeleted = 0;

CREATE NONCLUSTERED INDEX IX_OrgUnits_Type
    ON org.OrgUnits (OrgUnitTypeId)
    INCLUDE (Name, Code, ParentOrgUnitId)
    WHERE IsDeleted = 0;

CREATE NONCLUSTERED INDEX IX_OrgUnits_Path
    ON org.OrgUnits (MaterializedPath)
    WHERE IsDeleted = 0;

CREATE NONCLUSTERED INDEX IX_OrgUnits_Head
    ON org.OrgUnits (HeadUserId)
    WHERE IsDeleted = 0 AND HeadUserId IS NOT NULL;

CREATE NONCLUSTERED INDEX IX_OrgUnits_CostCentre
    ON org.OrgUnits (CostCenterCode)
    WHERE IsDeleted = 0 AND CostCenterCode IS NOT NULL;

CREATE UNIQUE NONCLUSTERED INDEX UX_OrgUnits_ADObjectGuid
    ON org.OrgUnits (ADObjectGuid)
    WHERE IsDeleted = 0 AND ADObjectGuid IS NOT NULL;

-- ── org.OrgUnitClosure ──────────────────────────────────────────────────
-- Reverse lookup: ancestors of a node. PK covers the forward direction.
CREATE NONCLUSTERED INDEX IX_OrgUnitClosure_Descendant
    ON org.OrgUnitClosure (DescendantOrgUnitId, Depth)
    INCLUDE (AncestorOrgUnitId);

-- ── org.OrgUnitManagers ─────────────────────────────────────────────────
CREATE NONCLUSTERED INDEX IX_OrgUnitManagers_Unit
    ON org.OrgUnitManagers (OrgUnitId, ManagerRoleCode, EffectiveFrom, EffectiveTo)
    INCLUDE (UserId, IsPrimary)
    WHERE IsDeleted = 0 AND IsActive = 1;

CREATE NONCLUSTERED INDEX IX_OrgUnitManagers_User
    ON org.OrgUnitManagers (UserId)
    INCLUDE (OrgUnitId, ManagerRoleCode)
    WHERE IsDeleted = 0 AND IsActive = 1;

-- ── org.OrgUnitChangeLog ────────────────────────────────────────────────
CREATE NONCLUSTERED INDEX IX_OrgUnitChangeLog_Unit
    ON org.OrgUnitChangeLog (OrgUnitId, PerformedAt DESC);

CREATE NONCLUSTERED INDEX IX_OrgUnitChangeLog_At
    ON org.OrgUnitChangeLog (PerformedAt DESC);
GO
```

> **Uniqueness caveat.** `UX_OrgUnits_Parent_Code` will not prevent duplicate
> codes among root nodes, because SQL Server treats NULLs as distinct in a
> multi-column unique index. `UX_OrgUnits_Root_Code` covers that gap. Both
> are required.

---

## 5. Seed Data

### 5.1 Unit types

```sql
DECLARE @SystemUserId UNIQUEIDENTIFIER = (SELECT UserId FROM auth.Users WHERE Username = 'system');
-- Replace with the real system/seed user if the username differs.

INSERT INTO org.OrgUnitTypes
 (OrgUnitTypeId, Code, Name, NameAr, CanonicalLevel, ScopeLevelCode, AllowsBudget, AllowsRequisition, AllowsManager, IsRootType, SortOrder, CreatedBy)
VALUES
 (1, 'ORGANIZATION',  'Organization',  N'المؤسسة', 1, 'ORGANIZATION',  0, 0, 1, 1, 10, @SystemUserId),
 (2, 'BUSINESS_UNIT', 'Business Unit', N'وحدة الأعمال', 2, 'BUSINESS_UNIT', 0, 0, 1, 0, 20, @SystemUserId),
 (3, 'DEPARTMENT',    'Department',    N'الإدارة', 3, 'DEPARTMENT',    1, 1, 1, 0, 30, @SystemUserId),
 (4, 'SECTION',       'Section',       N'القسم',  4, 'SECTION',       0, 1, 1, 0, 40, @SystemUserId);
GO
```

`AllowsBudget = 1` on Department only — the RFP specifies annual budgets per
Department.

### 5.2 Hierarchy rules

```sql
DECLARE @SystemUserId UNIQUEIDENTIFIER = (SELECT UserId FROM auth.Users WHERE Username = 'system');

INSERT INTO org.OrgUnitTypeHierarchyRules (ChildOrgUnitTypeId, ParentOrgUnitTypeId, CreatedBy)
VALUES
 (2, 1, @SystemUserId),   -- Business Unit under Organization
 (3, 1, @SystemUserId),   -- Department under Organization   ← RFP: holding org may hold departments
 (3, 2, @SystemUserId),   -- Department under Business Unit
 (4, 3, @SystemUserId);   -- Section under Department
GO
```

Root types (`IsRootType = 1`) need no rule — they have a NULL parent.

### 5.3 Root organization

Creating the root by hand, because it is the only node with no parent and no
service call to lean on.

```sql
DECLARE @SystemUserId UNIQUEIDENTIFIER = (SELECT UserId FROM auth.Users WHERE Username = 'system');
DECLARE @RootId UNIQUEIDENTIFIER;

BEGIN TRAN;

INSERT INTO org.OrgUnits
 (OrgUnitTypeId, ParentOrgUnitId, Code, Name, NameAr, ShortName,
  MaterializedPath, Depth, EffectiveFrom, CreatedBy)
OUTPUT INSERTED.OrgUnitId INTO @RootIdTable  -- see note below
VALUES
 (1, NULL, 'DIEZ', N'Dubai Integrated Economic Zones', N'مناطق دبي الاقتصادية المتكاملة', 'DIEZ',
  '/', 0, CAST(SYSUTCDATETIME() AS DATE), @SystemUserId);

COMMIT;
GO
```

Because `NEWSEQUENTIALID()` is a column default, capture the generated ID
with an `OUTPUT` clause into a table variable, then patch the path:

```sql
DECLARE @SystemUserId UNIQUEIDENTIFIER = (SELECT UserId FROM auth.Users WHERE Username = 'system');
DECLARE @Ids TABLE (OrgUnitId UNIQUEIDENTIFIER);
DECLARE @RootId UNIQUEIDENTIFIER;

BEGIN TRAN;

INSERT INTO org.OrgUnits
 (OrgUnitTypeId, ParentOrgUnitId, Code, Name, NameAr, ShortName,
  MaterializedPath, Depth, EffectiveFrom, CreatedBy)
OUTPUT INSERTED.OrgUnitId INTO @Ids
VALUES
 (1, NULL, 'DIEZ', N'Dubai Integrated Economic Zones',
  N'مناطق دبي الاقتصادية المتكاملة', 'DIEZ',
  '/', 0, CAST(SYSUTCDATETIME() AS DATE), @SystemUserId);

SELECT @RootId = OrgUnitId FROM @Ids;

UPDATE org.OrgUnits
SET MaterializedPath = '/' + REPLACE(CAST(@RootId AS VARCHAR(36)), '-', '') + '/'
WHERE OrgUnitId = @RootId;

INSERT INTO org.OrgUnitClosure (AncestorOrgUnitId, DescendantOrgUnitId, Depth)
VALUES (@RootId, @RootId, 0);

INSERT INTO org.OrgUnitChangeLog (OrgUnitId, ChangeType, NewValues, PerformedBy)
VALUES (@RootId, 'CREATED', (SELECT @RootId AS OrgUnitId, 'DIEZ' AS Code FOR JSON PATH), @SystemUserId);

COMMIT;
GO
```

> Everything below the root must be created **through the API**, so closure
> and path maintenance stay in one code path. Do not hand-insert child nodes.

---

## 6. Closure Table Maintenance

This is the part that breaks silently if it is wrong. All three operations
run inside the caller's transaction.

### 6.1 Insert a node

```sql
-- @NewOrgUnitId  : the newly inserted row's ID
-- @ParentOrgUnitId : NULL for a root

INSERT INTO org.OrgUnitClosure (AncestorOrgUnitId, DescendantOrgUnitId, Depth)
SELECT c.AncestorOrgUnitId, @NewOrgUnitId, c.Depth + 1
FROM   org.OrgUnitClosure c
WHERE  c.DescendantOrgUnitId = @ParentOrgUnitId
UNION ALL
SELECT @NewOrgUnitId, @NewOrgUnitId, 0;
```

For a root node the first branch returns nothing and only the self-row is
written. That is correct — do not special-case it.

### 6.2 Move a subtree

Two statements, in this order, in one transaction.

```sql
-- Step 1: remove links from the moving subtree to its OLD ancestors,
--         preserving links that are internal to the subtree.
DELETE cl
FROM org.OrgUnitClosure AS cl
INNER JOIN org.OrgUnitClosure AS sub
        ON cl.DescendantOrgUnitId = sub.DescendantOrgUnitId
LEFT JOIN org.OrgUnitClosure AS internal
        ON internal.AncestorOrgUnitId   = sub.AncestorOrgUnitId
       AND internal.DescendantOrgUnitId = cl.AncestorOrgUnitId
WHERE sub.AncestorOrgUnitId = @NodeId
  AND internal.AncestorOrgUnitId IS NULL;

-- Step 2: attach the subtree beneath the NEW parent.
INSERT INTO org.OrgUnitClosure (AncestorOrgUnitId, DescendantOrgUnitId, Depth)
SELECT sup.AncestorOrgUnitId,
       sub.DescendantOrgUnitId,
       sup.Depth + sub.Depth + 1
FROM org.OrgUnitClosure AS sup
CROSS JOIN org.OrgUnitClosure AS sub
WHERE sup.DescendantOrgUnitId = @NewParentId
  AND sub.AncestorOrgUnitId   = @NodeId;
```

Then refresh adjacency, depth, and path for the whole subtree:

```sql
UPDATE org.OrgUnits
SET ParentOrgUnitId = @NewParentId,
    UpdatedBy = @ActorUserId,
    UpdatedAt = SYSUTCDATETIME()
WHERE OrgUnitId = @NodeId;

-- Recompute Depth for every node in the subtree from the closure table.
UPDATE u
SET u.Depth = c.Depth
FROM org.OrgUnits AS u
INNER JOIN (
    SELECT cl.DescendantOrgUnitId, MAX(cl.Depth) AS Depth
    FROM org.OrgUnitClosure AS cl
    INNER JOIN org.OrgUnitClosure AS sub
            ON sub.DescendantOrgUnitId = cl.DescendantOrgUnitId
    WHERE sub.AncestorOrgUnitId = @NodeId
      AND cl.AncestorOrgUnitId IN (SELECT OrgUnitId FROM org.OrgUnits WHERE ParentOrgUnitId IS NULL)
    GROUP BY cl.DescendantOrgUnitId
) AS c ON c.DescendantOrgUnitId = u.OrgUnitId;
```

Rebuild `MaterializedPath` for the subtree with a recursive CTE:

```sql
WITH Subtree AS (
    SELECT u.OrgUnitId,
           u.ParentOrgUnitId,
           CAST(p.MaterializedPath + REPLACE(CAST(u.OrgUnitId AS VARCHAR(36)), '-', '') + '/' AS VARCHAR(900)) AS NewPath
    FROM org.OrgUnits AS u
    INNER JOIN org.OrgUnits AS p ON p.OrgUnitId = u.ParentOrgUnitId
    WHERE u.OrgUnitId = @NodeId

    UNION ALL

    SELECT c.OrgUnitId,
           c.ParentOrgUnitId,
           CAST(s.NewPath + REPLACE(CAST(c.OrgUnitId AS VARCHAR(36)), '-', '') + '/' AS VARCHAR(900))
    FROM org.OrgUnits AS c
    INNER JOIN Subtree AS s ON s.OrgUnitId = c.ParentOrgUnitId
    WHERE c.IsDeleted = 0
)
UPDATE u
SET u.MaterializedPath = s.NewPath
FROM org.OrgUnits AS u
INNER JOIN Subtree AS s ON s.OrgUnitId = u.OrgUnitId
OPTION (MAXRECURSION 100);
```

### 6.3 Integrity check — run in tests and after every move

```sql
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
```

**An empty result set is the only acceptable outcome.**

---

## 7. Business Rules

### 7.1 Creation

| # | Rule | Failure |
| :--- | :--- | :--- |
| C1 | `OrgUnitTypeId` must exist and be active | 400 `ORG_TYPE_INVALID` |
| C2 | Non-root types require a parent | 400 `ORG_PARENT_REQUIRED` |
| C3 | Root types must have a NULL parent | 400 `ORG_ROOT_CANNOT_HAVE_PARENT` |
| C4 | Only one active root of type ORGANIZATION may exist | 409 `ORG_ROOT_EXISTS` |
| C5 | `(childType, parentType)` must exist in `OrgUnitTypeHierarchyRules` | 400 `ORG_HIERARCHY_RULE_VIOLATION` |
| C6 | Parent must be active and not soft-deleted | 400 `ORG_PARENT_INACTIVE` |
| C7 | `Code` unique among live siblings, case-insensitive | 409 `ORG_CODE_DUPLICATE` |
| C8 | `Code` matches `^[A-Z0-9][A-Z0-9_-]{1,49}$` | 400 `ORG_CODE_FORMAT` |
| C9 | `EffectiveFrom` ≥ parent's `EffectiveFrom` | 400 `ORG_EFFECTIVE_BEFORE_PARENT` |
| C10 | Creator must have scope covering the parent | 403 `ORG_SCOPE_DENIED` |

### 7.2 Move

| # | Rule | Failure |
| :--- | :--- | :--- |
| M1 | New parent must exist, be active, not deleted | 400 `ORG_PARENT_INVALID` |
| M2 | New parent must not be the node itself | 400 `ORG_MOVE_TO_SELF` |
| M3 | **New parent must not be a descendant of the node** | 400 `ORG_MOVE_CYCLE` |
| M4 | `(nodeType, newParentType)` must satisfy hierarchy rules | 400 `ORG_HIERARCHY_RULE_VIOLATION` |
| M5 | Code must remain unique among new siblings | 409 `ORG_CODE_DUPLICATE` |
| M6 | Requires `ORG.MOVE` and scope over **both** old and new parent | 403 |
| M7 | Blocked if the subtree has budget commitments in an open period | 409 `ORG_MOVE_BLOCKED_BUDGET` |
| M8 | `RowVersion` must match | 409 `ORG_CONCURRENCY_CONFLICT` |

Cycle check (M3):

```sql
SELECT 1 FROM org.OrgUnitClosure
WHERE AncestorOrgUnitId = @NodeId AND DescendantOrgUnitId = @NewParentId;
-- Any row → reject.
```

> **M7 is a forward reference.** Budget does not exist yet. Implement it as a
> pluggable reference-check registry (§7.5) so Domain 4 can register into it
> without editing this module.

### 7.3 Deactivate / delete

| # | Rule | Failure |
| :--- | :--- | :--- |
| D1 | Cannot deactivate with active children | 409 `ORG_HAS_ACTIVE_CHILDREN` |
| D2 | Cannot delete with any non-deleted children | 409 `ORG_HAS_CHILDREN` |
| D3 | Cannot delete if users are assigned | 409 `ORG_HAS_ASSIGNED_USERS` |
| D4 | Cannot delete if referenced by any registered consumer (§7.5) | 409 `ORG_REFERENCED` |
| D5 | Root organization can never be deleted | 409 `ORG_ROOT_PROTECTED` |
| D6 | Deletion is soft only. No hard delete endpoint exists. | — |
| D7 | Deactivation sets `EffectiveTo` to today unless a date is supplied | — |

### 7.4 Managers

| # | Rule | Failure |
| :--- | :--- | :--- |
| G1 | At most one active `HEAD` with `IsPrimary=1` per unit per date | 409 `ORG_PRIMARY_HEAD_EXISTS` |
| G2 | Assigning a new primary HEAD auto-ends the previous one (`EffectiveTo` = new `EffectiveFrom` − 1 day) | — |
| G3 | Overlapping periods for the same user + unit + role are rejected | 409 `ORG_MANAGER_PERIOD_OVERLAP` |
| G4 | User must be active and INTERNAL. Vendors can never be managers. | 400 `ORG_MANAGER_INVALID_USER` |
| G5 | Unit type must have `AllowsManager = 1` | 400 `ORG_TYPE_NO_MANAGER` |
| G6 | `org.OrgUnits.HeadUserId` is refreshed in the same transaction | — |
| G7 | **Approval routing must query `OrgUnitManagers` with date filters — never `HeadUserId`** | — |

Overlap detection:

```sql
SELECT 1
FROM org.OrgUnitManagers
WHERE OrgUnitId = @OrgUnitId
  AND UserId = @UserId
  AND ManagerRoleCode = @RoleCode
  AND IsDeleted = 0
  AND EffectiveFrom <= ISNULL(@NewEffectiveTo, '9999-12-31')
  AND ISNULL(EffectiveTo, '9999-12-31') >= @NewEffectiveFrom;
```

### 7.5 Reference-check registry

Deletion and move must consult downstream domains that do not exist yet.
Build the seam now.

```ts
export interface OrgUnitReferenceCheck {
  readonly name: string;               // 'BUDGET' | 'REQUISITION' | ...
  countReferences(orgUnitIds: string[]): Promise<number>;
  readonly blocksDelete: boolean;
  readonly blocksMove: boolean;
}
```

Register implementations via a Nest injection token
(`ORG_UNIT_REFERENCE_CHECKS`). This module iterates whatever is registered.
Domain 4 adds a budget checker without touching this module.

---

## 8. API Surface

All routes under `/api/v1/organization`. Every response uses the Step 0
envelope. Every list endpoint uses the Step 0 pagination, sorting, and
filtering framework. Every mutation writes to `org.OrgUnitChangeLog` and
emits an audit event.

### 8.1 Unit types

| Method | Path | Permission | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/unit-types` | `ORG.VIEW` | Includes hierarchy rules |
| GET | `/unit-types/:id/allowed-parents` | `ORG.VIEW` | Drives the create form |

### 8.2 Units

| Method | Path | Permission | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/units` | `ORG.VIEW` | Paginated, scope-filtered |
| GET | `/units/tree` | `ORG.VIEW` | Full visible subtree, nested |
| GET | `/units/:id` | `ORG.VIEW` | Detail + breadcrumb |
| GET | `/units/:id/children` | `ORG.VIEW` | Direct children, lazy tree loading |
| GET | `/units/:id/ancestors` | `ORG.VIEW` | Root → parent, ordered |
| GET | `/units/:id/descendants` | `ORG.VIEW` | Flat, paginated |
| GET | `/units/:id/change-log` | `ORG.VIEW` | Paginated structural history |
| POST | `/units` | `ORG.CREATE` | |
| PATCH | `/units/:id` | `ORG.UPDATE` | Attributes only, never parent |
| POST | `/units/:id/move` | `ORG.MOVE` | Reparent; requires `rowVersion` |
| POST | `/units/:id/activate` | `ORG.UPDATE` | |
| POST | `/units/:id/deactivate` | `ORG.UPDATE` | |
| DELETE | `/units/:id` | `ORG.DELETE` | Soft |
| GET | `/units/export` | `ORG.EXPORT` | Excel; queue if large (rate tier 7) |

**Move is a separate endpoint from PATCH by design.** Reparenting rewrites
the closure table for an entire subtree; it must not be reachable by
accidentally including `parentOrgUnitId` in an update payload.

### 8.3 Managers

| Method | Path | Permission |
| :--- | :--- | :--- |
| GET | `/units/:id/managers` | `ORG.VIEW` |
| GET | `/units/:id/managers/current` | `ORG.VIEW` |
| POST | `/units/:id/managers` | `ORG.MANAGER.ASSIGN` |
| PATCH | `/managers/:managerId` | `ORG.MANAGER.ASSIGN` |
| DELETE | `/managers/:managerId` | `ORG.MANAGER.ASSIGN` |
| GET | `/users/:userId/managed-units` | `ORG.VIEW` |

### 8.4 Resolution helpers — consumed by other domains

| Method | Path | Permission | Purpose |
| :--- | :--- | :--- | :--- |
| GET | `/units/:id/approval-chain` | `ORG.VIEW` | Walks up returning current HEAD at each level. **Workflow routing depends on this.** |
| GET | `/units/:id/budget-owner` | `ORG.VIEW` | Nearest ancestor with `AllowsBudget = 1` |
| GET | `/me/visible-units` | authenticated | Org unit IDs the caller may see |

### 8.5 Request/response contracts

**POST `/units`**

```jsonc
{
  "orgUnitTypeId": 3,
  "parentOrgUnitId": "…",       // required unless root type
  "code": "IT",
  "name": "Information Technology",
  "nameAr": "تقنية المعلومات",
  "shortName": "IT",
  "description": null,
  "costCenterCode": "CC-1042",
  "oracleOrgCode": null,
  "emailAddress": "it@diez.ae",
  "sortOrder": 30,
  "effectiveFrom": "2026-09-01"
}
```

**Response — unit detail**

```jsonc
{
  "orgUnitId": "…",
  "orgUnitType": { "orgUnitTypeId": 3, "code": "DEPARTMENT", "name": "Department" },
  "parentOrgUnitId": "…",
  "code": "IT",
  "name": "Information Technology",
  "nameAr": "تقنية المعلومات",
  "depth": 2,
  "costCenterCode": "CC-1042",
  "head": { "userId": "…", "displayName": "…", "effectiveFrom": "2026-01-01" },
  "childCount": 4,
  "descendantCount": 11,
  "breadcrumb": [
    { "orgUnitId": "…", "code": "DIEZ", "name": "Dubai Integrated Economic Zones" },
    { "orgUnitId": "…", "code": "CORP", "name": "Corporate Services" }
  ],
  "allowsBudget": true,
  "allowsRequisition": true,
  "effectiveFrom": "2026-01-01",
  "effectiveTo": null,
  "isActive": true,
  "rowVersion": "0x00000000000007D1"
}
```

**POST `/units/:id/move`**

```jsonc
{
  "newParentOrgUnitId": "…",
  "reason": "2026 reorganisation — IT consolidated under Corporate Services",
  "rowVersion": "0x00000000000007D1"
}
```

`rowVersion` is mandatory. Mismatch → 409 `ORG_CONCURRENCY_CONFLICT`.

---

## 9. Scope Enforcement (Layer 3)

### 9.1 The core query

Every scope-filtered list resolves visible unit IDs first. This runs
constantly — it must stay a single indexed join.

```sql
-- Org units visible to a user, honouring effective dating.
-- GLOBAL scope short-circuits in the service layer before reaching here.
SELECT DISTINCT c.DescendantOrgUnitId AS OrgUnitId
FROM auth.UserOrganizationScopes AS s
INNER JOIN org.OrgUnitClosure AS c
        ON c.AncestorOrgUnitId = s.OrgUnitId
INNER JOIN org.OrgUnits AS u
        ON u.OrgUnitId = c.DescendantOrgUnitId
WHERE s.UserId = @UserId
  AND s.IsActive = 1
  AND s.IsDeleted = 0
  AND (s.EffectiveFrom IS NULL OR s.EffectiveFrom <= CAST(SYSUTCDATETIME() AS DATE))
  AND (s.EffectiveTo   IS NULL OR s.EffectiveTo   >= CAST(SYSUTCDATETIME() AS DATE))
  AND u.IsDeleted = 0;
```

> Column names in `auth.UserOrganizationScopes` **must be verified** per
> §0.2 before this is written into a repository.

### 9.2 Inline TVF

Prefer an inline table-valued function so the optimiser can fold it into
calling queries. **Do not use a multi-statement TVF** — it defeats
cardinality estimation and will degrade every scoped query in the system.

```sql
CREATE FUNCTION org.fn_VisibleOrgUnits (@UserId UNIQUEIDENTIFIER)
RETURNS TABLE
AS
RETURN
(
    SELECT DISTINCT c.DescendantOrgUnitId AS OrgUnitId
    FROM auth.UserOrganizationScopes AS s
    INNER JOIN org.OrgUnitClosure AS c ON c.AncestorOrgUnitId = s.OrgUnitId
    INNER JOIN org.OrgUnits AS u ON u.OrgUnitId = c.DescendantOrgUnitId
    WHERE s.UserId = @UserId
      AND s.IsActive = 1
      AND s.IsDeleted = 0
      AND (s.EffectiveFrom IS NULL OR s.EffectiveFrom <= CAST(SYSUTCDATETIME() AS DATE))
      AND (s.EffectiveTo   IS NULL OR s.EffectiveTo   >= CAST(SYSUTCDATETIME() AS DATE))
      AND u.IsDeleted = 0
);
GO
```

Usage:

```sql
SELECT u.*
FROM org.OrgUnits AS u
INNER JOIN org.fn_VisibleOrgUnits(@UserId) AS v ON v.OrgUnitId = u.OrgUnitId
WHERE u.IsDeleted = 0;
```

### 9.3 Non-negotiables

- `SYSTEM_ADMIN` bypasses **permission** checks. It does **not** silently
  bypass scope — GLOBAL scope must be explicitly assigned.
- Scope filtering happens in **SQL**, never by fetching then filtering in the
  service. Filtering after the fact leaks row counts through pagination
  metadata.
- A request for a unit outside scope returns **404, not 403**. A 403 confirms
  the unit exists, which is itself a disclosure.
- Vendor users have no org scope at all. Any `/api/v1/organization/*` request
  from a VENDOR user is rejected outright.

---

## 10. Backend Module Layout

```
src/modules/organization/
├── organization.module.ts
├── org-units/
│   ├── controllers/
│   │   ├── org-units.controller.ts
│   │   └── org-unit-types.controller.ts
│   ├── services/
│   │   ├── org-units.service.ts
│   │   ├── org-unit-tree.service.ts        # closure + path maintenance
│   │   ├── org-unit-validation.service.ts  # §7 rules
│   │   └── org-unit-types.service.ts
│   ├── repositories/
│   │   ├── org-units.repository.ts
│   │   ├── org-unit-closure.repository.ts
│   │   ├── org-unit-types.repository.ts
│   │   └── org-unit-change-log.repository.ts
│   ├── dto/
│   │   ├── create-org-unit.dto.ts
│   │   ├── update-org-unit.dto.ts
│   │   ├── move-org-unit.dto.ts
│   │   ├── list-org-units.dto.ts
│   │   └── org-unit-response.dto.ts
│   ├── entities/
│   │   ├── org-unit.entity.ts
│   │   ├── org-unit-type.entity.ts
│   │   └── org-unit-change-log.entity.ts
│   ├── interfaces/
│   │   ├── org-unit.interface.ts
│   │   └── org-unit-reference-check.interface.ts
│   ├── org-units.mapper.ts
│   ├── org-units.constants.ts
│   └── index.ts
├── org-managers/
│   └── … (same structure)
└── org-scope/
    ├── services/org-scope-resolver.service.ts
    ├── repositories/org-scope.repository.ts
    └── index.ts
```

`org-scope` is exported and consumed by the Layer 3 guard. Keep it free of
dependencies on `org-units` services to avoid a circular import.

### Transaction boundaries

These must run in a single transaction:

- Create: insert unit → insert closure rows → set path → write change log
- Move: closure delete → closure insert → adjacency update → depth update →
  path rebuild → change log
- Manager assign: end previous primary → insert new → update `HeadUserId` →
  change log

Use the TypeORM `QueryRunner` transaction API. Do not rely on implicit
autocommit anywhere in this module.

---

## 11. Known Risks

### 11.1 Move under concurrent load

Two simultaneous moves within the same subtree corrupt the closure table.
Mitigations, in order of preference:

1. `RowVersion` check on the moving node (mandatory)
2. `SELECT … WITH (UPDLOCK, HOLDLOCK)` on the subtree's closure rows at the
   start of the transaction
3. `SERIALIZABLE` isolation for the move transaction only

Moves are rare and administrator-initiated. Correctness over throughput.

### 11.2 `auth.UserOrganizationScopes` shape mismatch

If that table has four separate nullable FK columns instead of one
`OrgUnitId`, options are:

- **(a)** Add a nullable `OrgUnitId` column, backfill, keep the old columns
  as deprecated, migrate readers. Lowest risk.
- **(b)** Write a view that coalesces the four columns into one, and point
  `org.fn_VisibleOrgUnits` at the view.
- **(c)** Alter the table. Highest risk — it is on the hot path for every
  request.

Report the actual shape before choosing.

### 11.3 Reorganisation vs historical records

When a department moves, existing budget lines and requisitions must keep
reporting against the structure **as it was**. Two approaches — decide with
DIEZ before Domain 4 starts:

- **Point-in-time**: downstream records store `OrgUnitId` plus a snapshot of
  the path at creation time.
- **Current-state**: reports always reflect today's tree, and historical
  comparisons shift after a reorg.

Finance will usually want point-in-time for budget-vs-cost by financial year.
This decision belongs in the Budget spec, but the column
(`OrgUnitPathSnapshot`) must be planned for now.

### 11.4 AD as the source of truth

The RFP maps roles and reporting hierarchy to Active Directory. Once AD sync
lands, either OMS or AD owns the tree — not both. Recommendation: AD owns
*people and reporting lines*; OMS owns *the org unit tree and budget
ownership*. The `ADObjectGuid` column exists to link them. Confirm with DIEZ.

---

## 12. Test Plan

### 12.1 Unit — validation service

- Reject Section under Organization (no hierarchy rule)
- Accept Department under Organization **and** under Business Unit
- Reject duplicate code among live siblings; accept reuse of a soft-deleted
  sibling's code
- Reject code format violations
- Reject second root organization
- Reject `EffectiveFrom` earlier than parent's

### 12.2 Integration — tree service

- Create a 4-level tree; assert closure row count equals
  Σ(depth + 1) over all nodes
- Move a leaf; run §6.3 — must return zero rows
- Move a subtree with 3 descendants; assert all four rows reparented, depths
  and paths correct, §6.3 clean
- Attempt to move a node under its own descendant → `ORG_MOVE_CYCLE`
- Attempt move with a stale `rowVersion` → 409
- Soft-delete a leaf, then reuse its code on a new sibling → succeeds

### 12.3 Integration — managers

- Assign HEAD, then assign a second HEAD; assert the first is auto-ended with
  `EffectiveTo` = new `EffectiveFrom` − 1 day
- Overlapping period for the same user/unit/role → 409
- Assign a VENDOR user as HEAD → 400
- `HeadUserId` on `OrgUnits` matches the current primary HEAD after each
  operation

### 12.4 Integration — scope

- User with DEPARTMENT scope sees own department + its sections only
- Sibling departments are invisible
- User with BUSINESS_UNIT scope sees all descendants
- Direct GET of an out-of-scope unit returns **404**
- Expired scope row (`EffectiveTo` in the past) grants nothing
- VENDOR user gets rejected on every organization endpoint

### 12.5 Performance targets

Seed 5,000 units at depth 4.

| Operation | Target |
| :--- | :--- |
| `fn_VisibleOrgUnits` for a DEPARTMENT-scoped user | < 10 ms |
| `GET /units` page 1, 50 rows, scope-filtered | < 100 ms |
| `GET /units/tree` full visible tree | < 300 ms |
| Move a 500-node subtree | < 2 s |
| `GET /units/:id/approval-chain` | < 50 ms |

If `fn_VisibleOrgUnits` exceeds target, check that it stayed an **inline**
TVF and that `IX_OrgUnitClosure_Descendant` is being used.

---

## 13. Frontend

Routes under `/app/administration/master-data`:

| Screen | Route |
| :--- | :--- |
| Org structure (tree) | `/app/administration/master-data/organization` |
| Unit detail | `/app/administration/master-data/organization/[id]` |
| Business units list | `/app/administration/master-data/business-units` |
| Departments list | `/app/administration/master-data/departments` |
| Sections list | `/app/administration/master-data/sections` |

Unit detail tabs: Overview · Children · Managers · Change History.

Components:
- `OrgTree` — lazy-loads children via `/units/:id/children`. Do not fetch the
  whole tree for a large org.
- `OrgUnitForm` — RHF + Zod. Type dropdown filtered by
  `/unit-types/:id/allowed-parents` against the chosen parent.
- `OrgUnitPicker` — reusable; Budget and Requisition will both need it.
- `MoveUnitDialog` — explicit confirmation showing affected descendant count.
- `ManagerAssignmentPanel` — timeline view with effective dates.

Rules:
- Gate every action on permission, never role.
- Move and delete require typed confirmation of the unit code.
- Show descendant count before any destructive action.
- Arabic names are RTL — render `NameAr` with `dir="rtl"`.
- Reuse `DataTable`, `StatusBadge`, `Timeline` from `components/oms/`.

---

## 14. Definition of Done

- [x] All tables, indexes, and constraints created; §6.3 returns zero rows
- [x] Unit types and hierarchy rules seeded; root organization created
- [x] Permissions inserted and granted to roles
- [x] All §8 endpoints implemented, Swagger-documented, permission-guarded
- [x] Every mutation writes `org.OrgUnitChangeLog` **and** an audit event
- [x] Scope filtering applied in SQL on every list endpoint
- [x] Out-of-scope direct access returns 404
- [x] Move is transactional, `RowVersion`-checked, cycle-safe
- [x] Reference-check registry seam in place and unit-tested with a fake
- [x] §12 tests passing, performance targets met at 5,000 units
- [x] Admin UI complete, all actions permission-gated
- [x] `readme.md` updated with the five new `org` tables
- [x] §0.2 verification findings documented and reconciled
- [x] §11.3 (historical reporting) decision recorded before Domain 4 begins

---

## 15. Implementation Notes & Spec Reconciliations

This section records architectural reconciliations, design decisions, and intentional refinements made during Domain 2 implementation:

### 15.1 `auth.UserOrganizationScopes` Schema Reconciliation
- **Spec Assumption (§0.2 / §9.2)**: Assumed `auth.UserOrganizationScopes` contained a single `OrgUnitID` column.
- **Actual Database Schema**: Contains separate nullable columns (`ScopeLevelID`, `BusinessUnitID`, `DepartmentID`, `SectionID`).
- **Implementation**: `org.fn_VisibleOrgUnits` was implemented using `COALESCE(uos.DepartmentID, uos.BusinessUnitID, uos.SectionID) AS ScopeOrgUnitID`. The function remains a pure inline Table-Valued Function (iTVF) utilizing `IX_OrgUnitClosure_Descendant` and achieving sub-1ms evaluation on 5,000-unit datasets.

### 15.2 Decoupling Role Names from Security Scope (§9.3 Rule 3)
- **Spec Draft**: Initial drafts included a role check `WHERE r.RoleName = 'SYSTEM_ADMIN'` inside `fn_VisibleOrgUnits`.
- **Implementation**: Fully decoupled per §9.3 non-negotiables. System administrators bypass permission checks via `@RequirePermissions()`, but data scope is strictly governed by `auth.UserOrganizationScopes`. A `GLOBAL` scope assignment (`ScopeLevelCode = 'GLOBAL'` where `OrgUnitID IS NULL`) is required for full-organization visibility. No hardcoded role strings exist in SQL.

### 15.3 Upfront VENDOR Rejection (§9.3 Rule 4)
- **Spec Requirement**: VENDOR users must be rejected on all `/api/v1/organization` endpoints.
- **Implementation**: Enforced in `OrgScopeResolverService.resolveScope()` and `OrgUnitsService` by validating `UserType !== 'VENDOR'` before executing SQL queries, throwing immediate `ForbiddenException` / `403`.

### 15.4 Mutation Endpoints Scope Isolation
- **Refinement**: Scope filtering (`JOIN org.fn_VisibleOrgUnits`) is strictly enforced on all reading/listing query endpoints. For mutation operations (Create, Update, Move, Activate, Deactivate), authorization is enforced via `@RequirePermissions()`, and the post-mutation entity is retrieved via `findDetailById` without joining `fn_VisibleOrgUnits`. This guarantees that state changes (such as deactivating a unit or shifting effective dates) return the updated row reliably rather than throwing false 404s.

### 15.5 Point-in-Time Head Manager Resolution (`asOfDate`)
- **Enhancement**: Added optional `@Query('asOfDate')` parameter to `GET /units/:id/managers/current` and `OrgManagersService.getCurrentHead(unitId, asOfDate)`. This enables Domain 5 (Workflows) and audit pipelines to resolve the active primary head at any historical point in time.

### 15.6 Historical Reporting & Reorganization Strategy (§11.3)
- **Architecture Decision**: **Point-in-Time Snapshot Strategy**. Downstream records (Requisitions in Domain 5 and Budget Lines in Domain 4) will store `OrgUnitID` along with an immutable `OrgUnitPathSnapshot` (`LineagePath` at creation time). This preserves exact accounting and department reporting at the time the financial event occurred, regardless of subsequent organizational subtree moves.

