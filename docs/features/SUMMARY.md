# DIEZ OMS — Implementation Summary & Feature Catalog

**Date:** August 20, 2026  
**Module / Scope:** Domain 2 (Organization Structure) & Core System Verification  
**Repository:** `DIEZ-OMS` (`oms-backend` & `oms-prod-dev`)

---

## Executive Summary

Today's implementation accomplished the end-to-end delivery of **Domain 2: Organization Structure & Tree Management**, spanning pre-implementation database reconciliation, database migration scripting, pure architectural layering, high-performance tree and closure table maintenance, comprehensive business rule validation (Sections 7.1–7.4), hierarchical manager assignments, workflow resolution helpers (approval chains & budget owners), SQL-level security scoping, Excel export reporting, the complete frontend data layer, and the enterprise Next.js user interface.

All implementations strictly adhere to [`CLAUDE.md`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/docs/CLAUDE.md) layering standards, feature complete Swagger schemas, enforce dual audit logging (`org.OrgUnitChangeLog` and `OMS_Audit_DB.audit.Changes`), and are covered by **12 backend test suites (121 passing tests)** and **26 frontend E2E scenarios (100% passing)**.

---

## Categorized Feature Catalog

```
├── 1. Core Architecture & Migration Reconciliation
├── 2. Database Schema & Migration Engineering
├── 3. Transitive Closure & Materialized Path Engine
├── 4. Domain Validation & Business Rules Engine
├── 5. Organization Units Management
├── 6. Organization Unit Types & Hierarchy Matrix
├── 7. Manager Assignment & Temporal Lifecycle
├── 8. Cross-Domain Workflow Resolution Helpers
├── 9. Dual Audit Logging & Concurrency Protection
├── 10. Layer 3 Scope Security & Fine-Grained Authorization
├── 11. High-Performance Excel Export Engine
├── 12. Section 12 Specification Test Plan & Performance Benchmarks
├── 13. Domain 2 Frontend Data Layer (oms-prod-dev)
└── 14. Domain 2 Enterprise Frontend User Interface (oms-prod-dev)
```

---

### 1. Core Architecture & Migration Reconciliation

* **Live Database Introspection & Discrepancy Reconciliation**:
  * Performed read-only database analysis on `auth.ScopeDefinitions`, `auth.UserOrganizationScopes`, `auth.Users`, `auth.UserProfiles`, `auth.DataAccessRules`, `auth.Permissions`, and `auth.Roles`.
  * Produced [`docs/DOMAIN-2-RECONCILIATION.md`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/docs/DOMAIN-2-RECONCILIATION.md) detailing schema reconciliation, actual GUID mappings for system roles, and corrected SQL statements.
* **Strict Layering Enforcement**:
  * Architecture follows `Request → Guard → ValidationPipe → Controller → Service → Repository → SQL Server`.
  * Controllers handle HTTP concerns and Swagger metadata only.
  * Services contain business orchestration and transaction boundaries (zero SQL).
  * Repositories contain 100% parameterized TypeORM `DataSource` queries with optional `QueryRunner` for atomic transaction enlisting.

---

### 2. Database Schema & Migration Engineering

* **Idempotent SQL Migration Script** ([`db/migrations/domain-2-organization.sql`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/db/migrations/domain-2-organization.sql)):
  * **Block 1**: Schema creation (`org`).
  * **Block 2**: Permission definitions (`ORG.VIEW`, `ORG.CREATE`, `ORG.UPDATE`, `ORG.MOVE`, `ORG.DELETE`, `ORG.MANAGER.ASSIGN`, `ORG.TYPE.MANAGE`, `ORG.EXPORT`) and role grants.
  * **Block 3**: Core tables (`OrgUnitTypes`, `OrgUnitTypeHierarchyRules`, `OrgUnits`, `OrgUnitClosure`, `OrgUnitManagers`, `OrgUnitChangeLog`).
  * **Block 4**: Performance indexes & unique constraints (Filtered unique code indexes among active siblings).
  * **Block 5**: Type seeds & permitted hierarchy rules matrix (ORGANIZATION → BUSINESS_UNIT → DEPARTMENT → SECTION).
  * **Block 6**: Corrected visible units TVF (`org.fn_VisibleOrgUnits(@UserId)`).
  * **Block 7**: Initial seed data (DIEZ Root Holding Organization).
  * **Block 8**: Verification query for schema integrity.
* **Idempotent Rollback Script** ([`db/migrations/domain-2-organization-rollback.sql`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/db/migrations/domain-2-organization-rollback.sql)):
  * Drops all objects in strict reverse dependency order.

---

### 3. Transitive Closure & Materialized Path Engine

* **Exclusive Ownership Engine** ([`OrgUnitTreeService`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/services/org-unit-tree.service.ts)):
  * Holds exclusive write ownership over `org.OrgUnitClosure` and `org.OrgUnits.MaterializedPath`.
* **Atomic Node Insertion (`createNode`)**:
  * Generates formatted `MaterializedPath` using uppercase GUID segments without dashes (e.g. `/11111111222233334444555555555555/22222222333344445555666666666666/`).
  * Computes tree `Depth` (`0` for root, `parent.depth + 1` for child).
  * Generates transitive closure links at `Depth + 1` plus self-edge at `Depth = 0` in a single transaction.
* **Subtree Reorganization Protocol (`moveSubtree`)**:
  * Implements atomic Section 6.2 & 11.1 reorganization sequence:
    1. **Subtree Row Locking (§11.1)**: `SELECT 1 FROM org.OrgUnitClosure WITH (UPDLOCK, HOLDLOCK)` to eliminate concurrent race conditions.
    2. **Optimistic Concurrency Verification (§11.1)**: Validates `RowVersion` hex tokens (`ORG_CONCURRENCY_CONFLICT`).
    3. **Root Node Protection (§7.3 D5)**: Strictly blocks moving the root holding organization (`ORG_ROOT_PROTECTED`).
    4. **Closure Detachment (§6.2 Step 1)**: Deletes links between the moving subtree and old ancestors while preserving internal subtree edges.
    5. **Closure Attachment (§6.2 Step 2)**: Cross-joins new parent ancestors with subtree descendants.
    6. **Adjacency & Depth Updates (§6.2)**: Updates `ParentOrgUnitId` and batch-recomputes `Depth` across the entire subtree from the closure table.
    7. **Materialized Path Reconstruction (§6.2)**: Recomputes `MaterializedPath` across the subtree using a recursive CTE with `OPTION (MAXRECURSION 0)` to support subtrees with 500+ nodes.
    8. **Audit Change Logging**: Records `MOVED` event with `AffectedNodeCount`, old parent, new parent, and business reason.
    9. **Debug Tree Integrity Guard (§6.3)**: Executes 4-part union query in debug/test environments to guarantee zero tree anomalies.

---

### 4. Domain Validation & Business Rules Engine

Implemented in [`OrgUnitValidationService`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/services/org-unit-validation.service.ts) with isolated test coverage:

* **Creation Rules (Section 7.1 C1 – C10)**:
  * `C1`: Unit type exists and is active (`ORG_TYPE_INVALID`).
  * `C2`: Non-root units require parent (`ORG_PARENT_REQUIRED`).
  * `C3`: Root units cannot have parent (`ORG_ROOT_CANNOT_HAVE_PARENT`).
  * `C4`: Only one active root organization allowed (`ORG_ROOT_EXISTS`).
  * `C5`: Child and parent type combination permitted in hierarchy rules (`ORG_HIERARCHY_RULE_VIOLATION`).
  * `C6`: Parent unit exists, active, and not deleted (`ORG_PARENT_INVALID` / `ORG_PARENT_INACTIVE`).
  * `C7`: Code uniqueness among live siblings (`ORG_CODE_DUPLICATE`).
  * `C8`: Code format regex check `^[A-Z0-9][A-Z0-9_-]{1,49}$` (`ORG_CODE_FORMAT`).
  * `C9`: `EffectiveFrom` must be on or after parent's `EffectiveFrom` (`ORG_EFFECTIVE_BEFORE_PARENT`).
  * `C10`: Creator scope authorization over target parent (`ORG_SCOPE_DENIED`).
* **Move Rules (Section 7.2 M1 – M8)**:
  * `M1`: Target parent valid, active, and not deleted (`ORG_PARENT_INVALID`).
  * `M2`: Cannot move unit beneath itself (`ORG_MOVE_TO_SELF`).
  * `M3`: **Cycle Detection via Closure Table**: `closureRepo.isDescendantOf(newParentId, nodeId)` (`ORG_MOVE_CYCLE`).
  * `M4`: Hierarchy rule compatibility between node type and new parent type (`ORG_HIERARCHY_RULE_VIOLATION`).
  * `M5`: Code uniqueness under new parent (`ORG_CODE_DUPLICATE`).
  * `M6`: Scope authorization over old and new parent (`ORG_SCOPE_DENIED`).
  * `M7`: **Downstream Reference Blocker**: Dynamic iteration of injected `OrgUnitReferenceCheck` implementations (`ORG_MOVE_BLOCKED_BUDGET`).
  * `M8`: Optimistic concurrency check on `RowVersion` (`ORG_CONCURRENCY_CONFLICT`).
* **Deactivate & Delete Rules (Section 7.3 D1 – D5)**:
  * `D1`: Cannot deactivate unit with active children (`ORG_HAS_ACTIVE_CHILDREN`).
  * `D2`: Cannot delete unit with existing children (`ORG_HAS_CHILDREN`).
  * `D3`: Cannot delete unit with assigned users in `UserProfiles` or `UserOrgUnitAssignments` (`ORG_HAS_ASSIGNED_USERS`).
  * `D4`: Cannot delete unit referenced in downstream modules (`ORG_REFERENCED`).
  * `D5`: Root holding organization protected from deletion (`ORG_ROOT_PROTECTED`).

---

### 5. Organization Units Management

Implemented in [`OrgUnitsService`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/services/org-units.service.ts) and [`OrgUnitsController`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/controllers/org-units.controller.ts):

* **API Endpoints**:
  * `GET /api/v1/organization/units`: Paginated list supporting filtering by type, parent, active status, search term, and sorting (`ORG.VIEW`).
  * `GET /api/v1/organization/units/tree`: Nested N-ary tree hierarchy structure (`ORG.VIEW`).
  * `GET /api/v1/organization/me/visible-units`: Org units within authenticated user scope.
  * `GET /api/v1/organization/units/:id`: Detail view with ancestral breadcrumb path (`ORG.VIEW`).
  * `GET /api/v1/organization/units/:id/children`: Direct children (`ORG.VIEW`).
  * `GET /api/v1/organization/units/:id/ancestors`: Ordered ancestor chain from root to parent (`ORG.VIEW`).
  * `GET /api/v1/organization/units/:id/descendants`: Flat descendants list (`ORG.VIEW`).
  * `GET /api/v1/organization/units/export`: Excel `.xlsx` report export with 12 structured columns, identical SQL scope filtering, Rate Limit Tier 7 (5 req/min), automated background queuing for large datasets (> 5,000 rows), and audit logging (`ORG.EXPORT`).
  * `POST /api/v1/organization/units`: Unit creation with validation and audit logging (`ORG.CREATE`).
  * `PATCH /api/v1/organization/units/:id`: Attribute updates. **Strictly rejects `parentOrgUnitId` with 400 Bad Request** (`ORG.UPDATE`).
  * `POST /api/v1/organization/units/:id/move`: Subtree move with validation and audit logging (`ORG.MOVE`).
  * `POST /api/v1/organization/units/:id/activate`: Lifecycle activation (`ORG.UPDATE`).
  * `POST /api/v1/organization/units/:id/deactivate`: Lifecycle deactivation (`ORG.UPDATE`).
  * `DELETE /api/v1/organization/units/:id`: Soft deletion (`ORG.DELETE`).
* **Layer 3 Scope Enforcement**:
  * 100% of read queries join `org.fn_VisibleOrgUnits(@UserId)` directly in SQL Server.
  * Out-of-scope requests return `404 NOT_FOUND` to prevent existence probing.
  * Outright rejection of `VENDOR` users via `InternalUserGuard`.

---

### 6. Organization Unit Types & Hierarchy Matrix

Implemented in [`OrgUnitTypesService`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/services/org-unit-types.service.ts) and [`OrgUnitTypesController`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/controllers/org-unit-types.controller.ts):

* **API Endpoints**:
  * `GET /api/v1/organization/unit-types`: Returns all unit types along with their permitted child types (`allowedChildTypeIds`).
  * `GET /api/v1/organization/unit-types/:id/allowed-parents`: Returns permitted parent unit types for dynamic UI form selection.
* **Pre-Seeded Hierarchy Types**:
  * Level 1: `ORGANIZATION` (`isRootType = 1`, `allowsBudget = 1`, `allowsRequisition = 1`)
  * Level 2: `BUSINESS_UNIT` (`allowsBudget = 1`, `allowsRequisition = 1`)
  * Level 3: `DEPARTMENT` (`allowsBudget = 1`, `allowsRequisition = 1`)
  * Level 4: `SECTION` (`allowsBudget = 0`, `allowsRequisition = 1`)

---

### 7. Manager Assignment & Temporal Lifecycle

Implemented in [`OrgManagersService`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-managers/services/org-managers.service.ts), [`OrgManagersRepository`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-managers/repositories/org-managers.repository.ts), and [`OrgManagersController`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-managers/controllers/org-managers.controller.ts):

* **Business Rules (Section 7.4 G1 – G7)**:
  * `G1 & G2`: Assigning a new primary `HEAD` automatically terminates the tenure of the previous primary HEAD by setting `EffectiveTo = DATEADD(DAY, -1, CAST(@NewEffectiveFrom AS DATE))` in the **same transaction**.
  * `G3`: Overlap detection using exact parameterized SQL.
  * `G4`: Only active, `INTERNAL` employee users permitted as managers.
  * `G5`: Unit type must have `AllowsManager = 1`.
  * `G6`: Automatically synchronizes `org.OrgUnits.HeadUserId` upon primary HEAD assignment, promotion, demotion, or removal.
* **API Endpoints**:
  * `GET /api/v1/organization/units/:id/managers`: Historical and active manager assignments (`ORG.VIEW`).
  * `GET /api/v1/organization/units/:id/managers/current`: Current active primary head (`ORG.VIEW`).
  * `GET /api/v1/organization/users/:userId/managed-units`: Units managed by a user (`ORG.VIEW`).
  * `POST /api/v1/organization/units/:id/managers`: Assigns manager (`ORG.MANAGER.ASSIGN`).
  * `PATCH /api/v1/organization/managers/:managerId`: Updates assignment tenure or primary status (`ORG.MANAGER.ASSIGN`).
  * `DELETE /api/v1/organization/managers/:managerId`: Removes manager assignment and refreshes `HeadUserId` (`ORG.MANAGER.ASSIGN`).

---

### 8. Cross-Domain Workflow Resolution Helpers

* **Hierarchical Approval Chain Resolution (`GET /units/:id/approval-chain`)**:
  * Traverses the hierarchy from the target unit up to the root holding entity via `org.OrgUnitClosure`.
  * Resolves the active primary `HEAD` manager at each level with effective-date filtering (`EffectiveFrom <= @Date AND (EffectiveTo IS NULL OR EffectiveTo >= @Date)`).
  * **Rule G7 Compliance**: Directly queries `org.OrgUnitManagers` rather than reading denormalized fields.
  * **Domain 5 Contract Notice**: Formatted specifically for multi-tier requisition approval workflows.
* **Budget Owner Resolution (`GET /units/:id/budget-owner`)**:
  * Traverses nearest ancestors via closure table and returns the closest ancestor unit whose type has `AllowsBudget = 1`.

---

### 9. Dual Audit Logging & Concurrency Protection

* **Dual Audit Logging Strategy**:
  * **Domain Change Log**: Every mutation records a before/after snapshot, `AffectedNodeCount`, and reason to `org.OrgUnitChangeLog`.
  * **Enterprise Security Audit Log**: Every mutation simultaneously calls `AuditService.logOrgUnitChange` to emit structured audit records to `OMS_Audit_DB.audit.Changes`.
### 10. Layer 3 Scope Security & Fine-Grained Authorization

Implemented in [`OrgScopeResolverService`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-scope/services/org-scope-resolver.service.ts) and [`OrgScopeRepository`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-scope/repositories/org-scope.repository.ts):

* **SQL-Level Scope Filtering**:
  * Scope filtering is strictly performed in the database engine via `INNER JOIN org.fn_VisibleOrgUnits(@UserId) v ON v.OrgUnitId = u.OrgUnitId`.
  * Guarantees that pagination row counts and metadata never leak invisible records to restricted users.
* **Information Leak Prevention (404 Not Found vs 403 Forbidden)**:
  * Out-of-scope resource lookups throw `404 Not Found` (`ORG_NOT_FOUND`) rather than `403 Forbidden` to prevent probing unit IDs.
* **Non-Bypassable Scope for Administrators**:
  * `ADMINISTRATOR` bypasses RBAC permission checks, but **never** bypasses Layer 3 data scope. `GLOBAL` scope must be explicitly assigned in `auth.UserOrganizationScopes`.
* **Vendor Access Quarantine**:
  * Enforced via `InternalUserGuard`: `VENDOR` users are rejected with `403 Forbidden` (`ORG_VENDOR_RESTRICTED`) across all organization endpoints.

---

### 11. High-Performance Excel Export Engine

Implemented in [`OrgUnitsController.exportToExcel`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/controllers/org-units.controller.ts):

* **Streamlined Multi-Column Workbook**:
  * Columns: `Code`, `Name`, `Name (Arabic)`, `Type`, `Parent Code`, `Parent Name`, `Depth`, `Cost Centre`, `Head`, `Active`, `Effective From`, `Effective To`.
  * Styled with DIEZ corporate blue header palette, bold typography, light borders, and auto-fit column widths.
* **Synchronous vs Asynchronous Background Processing**:
  * Datasets $\le$ 5,000 rows stream directly as `.xlsx` attachments.
  * Datasets $>$ 5,000 rows automatically enqueue for background processing and return `202 Accepted` with a Job ID.
* **Audit & Rate Limiting Guardrails**:
  * Protected by `@RateLimit(RateLimitTier.TIER_7_REPORTS)` (5 req/min/user) and `@RequirePermissions(ORG_PERMISSIONS.EXPORT)`.
  * Emits structured audit event recording exported row count, caller, and applied query filters.

---

### 12. Section 12 Specification Test Plan & Performance Benchmarks

#### Automated Specification Test Suite (§12.1 – §12.4)
Implemented in [`domain-2-specification.spec.ts`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/domain-2-specification.spec.ts):
* **§12.1 Hierarchy Rules & Constraints**: Verified permitted/forbidden unit combinations, code format regex, duplicate code detection with soft-delete reuse, single root protection, and downstream reference check blocking.
* **§12.2 Tree Operations & Closure Integrity**: Verified closure row count formulas ($\sum (depth+1) = 10$ for 4-level trees), atomic leaf/subtree reparenting with automatic §6.3 verification, cycle detection (`ORG_MOVE_CYCLE`), and optimistic concurrency tokens.
* **§12.3 Manager Rules & Temporal Consistency**: Verified auto-ending of previous primary HEAD ($EffectiveTo = EffectiveFrom - 1\text{ day}$), overlap conflict detection, inactive/vendor rejection, and real-time `HeadUserId` synchronization.
* **§12.4 Scope Filtering**: Verified department/BU subtree visibility, sibling invisibility, 404 out-of-scope response, temporal expiration, and vendor exclusion.

#### Performance Validation Matrix (§12.5)
Measured against live Microsoft SQL Server database seeded with **5,000 organization units** and **19,861 closure edges**:

| Operation | Target (§12.5) | Measured (Avg) | Measured (p95) | Status | Details |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`fn_VisibleOrgUnits`** (Department Scope) | $< 10\text{ ms}$ | **$1.37\text{ ms}$** | $1.79\text{ ms}$ | **PASS** | Evaluated via inline TVF; Clustered Index Seek on closure PK. |
| **`GET /units`** (Page 1, 50 rows, 5k dataset) | $< 100\text{ ms}$ | **$58.53\text{ ms}$** | $66.88\text{ ms}$ | **PASS** | Full HTTP request lifecycle including SQL scope join, total count, pagination, and DTO mapping. |
| **`GET /units/tree`** (Full 5,000 node tree) | $< 300\text{ ms}$ | **$73.04\text{ ms}$** | $185.11\text{ ms}$ | **PASS** | Fetched all 5,000 nodes from DB and built in-memory N-ary tree hierarchy. |
| **Move 500-Node Subtree** (§6.2 Reorganization) | $< 2.0\text{ s}$ | **$121.36\text{ ms}$** | $121.36\text{ ms}$ | **PASS** | Full atomic transaction: detach closure $\to$ attach closure $\to$ update parent $\to$ recompute depth $\to$ rebuild 500 paths $\to$ log $\to$ §6.3 check (**0 discrepancies**). |
| **`GET /units/:id/approval-chain`** | $< 50\text{ ms}$ | **$8.14\text{ ms}$** | $20.27\text{ ms}$ | **PASS** | Ancestor closure traversal, active primary HEAD resolution, and date filtering. |

---

### 13. Domain 2 Frontend Data Layer (`oms-prod-dev`)

Implemented full enterprise data layer in `oms-prod-dev` matching Section 8 & Section 8.5 contracts with Next.js BFF proxy architecture and TanStack React Query cache invalidation:

* **TypeScript Contract Layer** ([`organization.types.ts`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/lib/types/organization.types.ts)):
  * 100% strict contracts matching §8.5: `OrgUnitSummaryDto`, `OrgUnitDetailDto`, `OrgUnitTreeNodeDto`, `OrgUnitTypeDto`, `OrgUnitManagerDto`, `ApprovalChainNodeDto`, `BudgetOwnerDto`, `OrgUnitChangeLogDto`, `CreateOrgUnitDto`, `UpdateOrgUnitDto`, `MoveOrgUnitDto`, `AssignManagerDto`, `UpdateManagerDto`, and `PaginatedResponse<T>`.
* **BFF Proxy Architecture** ([`app/api/organization/...`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/app/api/organization/)):
  * Route handlers under `/api/organization/*` proxy all requests to `http://localhost:4000/api/v1/organization/*` using `proxyToBackend`.
  * Preserves cookie sessions, forwards `Authorization` & `X-User-Id` headers, unwraps API response envelopes, and streams binary Excel files.
  * Portal route protection updated in [`proxy.ts`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/proxy.ts) (`INTERNAL_ROUTES` includes `/api/organization`).
* **Typed API Client** ([`organization.ts`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/lib/api/organization.ts)):
  * Exposes strongly-typed methods across `orgUnitsApi`, `orgUnitTypesApi`, `orgManagersApi`, and `orgResolutionApi`.
* **TanStack React Query Hooks & Invalidation Engine** ([`useOrganization.ts`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/hooks/useOrganization.ts)):
  * Query hooks with hierarchical query keys (`orgKeys`).
  * Mutation hooks with automated **subtree and ancestor invalidation**:
    * **Move / Delete**: Recursively invalidates global tree, affected unit, and all parent/ancestor cache keys.
    * **Create**: Invalidates global tree, units list, and parent's children list.
    * **Update / Activate / Deactivate**: Invalidates unit detail, tree, and units list.
    * **Manager Assignment**: Invalidates managers, current head, approval chain, and syncs unit detail `head`.
* **E2E BFF Test Suite** ([`test-org-data-layer.js`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/scripts/test-org-data-layer.js)):
  * **26 Passing E2E Tests** verifying real end-to-end request/response cycles from Next.js (port 3000) to NestJS (port 4000) to SQL Server.

### 14. Domain 2 Enterprise Frontend User Interface (`oms-prod-dev`)

Implemented full enterprise user interface in `oms-prod-dev` per Section 13 of the specification:

* **Action-Gated Permission System** ([`usePermission.ts`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/hooks/usePermission.ts)):
  * `can(permission)`, `canAny(permissions[])`, and `canAll(permissions[])` reading directly from `AuthContext` (`user.permissions`).
  * Pure action-level gating with wildcard `*` / `ALL` support. Zero role-name branching across all UI components per `CLAUDE.md`.
* **Enterprise UI Components** ([`components/organization/`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/components/organization/)):
  1. **[`OrgTree.tsx`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/components/organization/OrgTree.tsx)**:
     - **Scalable Lazy Loading**: Only root nodes load initially. Child nodes are fetched on demand via `useOrgUnitChildren(id)` when expanded. Tested and verified for 5,000+ units.
     - Node depth indentation, hierarchy badges, status indicators, and contextual action menus (`View`, `Add Child`, `Move`, `Toggle Status`, `Delete`).
  2. **[`OrgUnitPicker.tsx`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/components/organization/OrgUnitPicker.tsx)**:
     - Reusable popover combobox selector with live search, hierarchy path breadcrumbs, type filtering pills (`allowsBudgetOnly`, `allowsRequisitionOnly`, `filterByType`), and `excludeUnitId` support (prevents circular move targets).
     - Built for universal reuse across Domain 4 (Budget) and Domain 5 (Requisitions).
  3. **[`OrgUnitForm.tsx`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/components/organization/OrgUnitForm.tsx)**:
     - React Hook Form + Zod validation with Section 7.1 C8 regex: `^[A-Z0-9][A-Z0-9_-]{1,49}$`.
     - Dynamically filters the Unit Type dropdown based on the chosen parent via `/unit-types/:id/allowed-parents`.
     - Arabic name input with `dir="rtl"` styling.
  4. **[`MoveUnitDialog.tsx`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/components/organization/MoveUnitDialog.tsx)**:
     - Subtree reparenting modal displaying live affected descendant count warnings.
     - Requires explicitly typing the target unit's exact `code` to enable confirmation.
     - Optimistic concurrency control via `rowVersion` token.
  5. **[`DeleteUnitDialog.tsx`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/components/organization/DeleteUnitDialog.tsx)**:
     - Pre-condition validation (blocks deletion if child count $> 0$).
     - Requires typing the unit `code` to confirm soft deletion.
  6. **[`ManagerAssignmentPanel.tsx`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/components/organization/ManagerAssignmentPanel.tsx)**:
     - Displays active primary HEAD manager card (Rule G7).
     - Leadership tenure history visualized using [`Timeline.tsx`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/components/oms/Timeline.tsx).
     - Assign Manager modal explaining Rule G2 auto-ending of prior primary HEAD.
* **Master Data Application Routes** ([`app/app/administration/master-data/`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/app/app/administration/master-data/)):
  1. **[`organization/page.tsx`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/app/app/administration/master-data/organization/page.tsx)**: Split-pane Organization Structure tree explorer (`OrgTree` + Quick Inspector), search, Excel export, and "+ New Unit" modal.
  2. **[`organization/[id]/page.tsx`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/app/app/administration/master-data/organization/[id]/page.tsx)**: Comprehensive Unit Detail screen with 4 tabs:
     - **Overview**: Attribute grid, Budget Owner resolution card, Approval Chain resolution stepper, and action buttons.
     - **Children**: `DataTable` of direct child units with "+ Add Child Unit" button and child actions.
     - **Managers**: Embedded `ManagerAssignmentPanel`.
     - **Change History**: Audit log `DataTable` with old/new values diff.
  3. **[`business-units/page.tsx`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/app/app/administration/master-data/business-units/page.tsx)**: Dedicated Business Units list in `DataTable` with search and creation dialog.
  4. **[`departments/page.tsx`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/app/app/administration/master-data/departments/page.tsx)**: Dedicated Departments list in `DataTable` with cost centers, budget authority badges, and creation dialog.
  5. **[`sections/page.tsx`](file:///Users/aait/Documents/Development/DIEZ-OMS/oms-prod-dev/app/app/administration/master-data/sections/page.tsx)**: Dedicated Sections list in `DataTable` with parent departments and creation dialog.

---

## Test Suite & Verification Summary

```
--------------------------------------------------------------------------------
Comprehensive Test & Verification Results
--------------------------------------------------------------------------------
Backend Unit & Spec Tests:  121 passed across 12 test suites (oms-backend)
Frontend BFF Proxy Tests:    26 passed across 26 scenarios (oms-prod-dev)
Total Automated Tests:      147 passed, 0 failed (100%)

Build Status:
- oms-backend:  TypeScript NestJS build exited with Code 0
- oms-prod-dev: Next.js 16.2.6 production build exited with Code 0 (17 static pages, 49 routes)

Performance Benchmarks (5,000 units depth 4):
- fn_VisibleOrgUnits:  1.37 ms  (Target: < 10 ms)   [PASS]
- GET /units (page 1): 58.53 ms (Target: < 100 ms)  [PASS]
- GET /units/tree:     73.04 ms (Target: < 300 ms)  [PASS]
- Move 500-node tree:  121.36 ms(Target: < 2000 ms) [PASS]
- GET approval-chain:  8.14 ms  (Target: < 50 ms)   [PASS]
--------------------------------------------------------------------------------
```

