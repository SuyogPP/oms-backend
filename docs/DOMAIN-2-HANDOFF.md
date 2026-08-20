# Domain 2: Organization Structure & Tree Management — Integration Handoff Guide

> **Target Audience**: Engineers building **Domain 4 (Budget & Financial Control)** and **Domain 5 (Requisitions & Outsource Workflow)**.  
> **Source Module**: `oms-backend/src/modules/organization`  
> **Source Schema**: `org` in Microsoft SQL Server (`OMS_DB_Prod`)

---

## 1. Executive Summary

Domain 2 provides the core organizational backbone for the DIEZ Outsource Management System (OMS). It manages the hierarchical tree of business units, departments, and sections, leadership tenures (Heads of Department, Cost Center Managers), security scope resolution, and workflow routing resolution.

This handoff guide explains how downstream domains (Budget, Requisitions, Contracts, and Purchase Orders) must interact with Domain 2 services, SQL functions, reference registries, and resolution contracts.

---

## 2. Consuming Security Scoping (`org.fn_VisibleOrgUnits`)

### 2.1 The Security Requirement
Per **Section 9.3** of the architecture specification:
1. **Scope filtering MUST happen in SQL** by joining `org.fn_VisibleOrgUnits(@UserID)`.
2. **NEVER fetch all rows into Node.js memory and filter post-hoc** — doing so leaks row counts through pagination metadata and degrades performance.
3. If a user requests a specific entity (e.g. `GET /requisitions/:id` or `GET /budgets/:id`) that belongs to an organization unit outside their scope, return **`404 Not Found`**, not `403 Forbidden`. (A 403 confirms the entity exists).

### 2.2 SQL Signature
```sql
org.fn_VisibleOrgUnits(@UserID UNIQUEIDENTIFIER)
RETURNS TABLE (OrgUnitID UNIQUEIDENTIFIER)
```
*Note: This is an inline Table-Valued Function (iTVF) optimized to run in < 1ms on 5,000-unit trees using index `IX_OrgUnitClosure_Descendant`.*

### 2.3 SQL Pattern for Domain 4 (Budget) & Domain 5 (Requisitions)

#### Raw SQL Query Pattern
```sql
SELECT 
    r.RequisitionID,
    r.RequisitionNumber,
    r.OrgUnitID,
    ou.Code AS OrgUnitCode,
    ou.Name AS OrgUnitName,
    r.TotalAmount,
    r.Status
FROM req.Requisitions r
INNER JOIN org.fn_VisibleOrgUnits(@CallerUserID) v ON r.OrgUnitID = v.OrgUnitID
INNER JOIN org.OrgUnits ou ON r.OrgUnitID = ou.OrgUnitID
WHERE r.IsDeleted = 0
  AND (@Status IS NULL OR r.Status = @Status)
ORDER BY r.CreatedAt DESC
OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY;
```

#### TypeORM QueryBuilder Pattern (NestJS Repository)
```typescript
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class RequisitionRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findPaginated(
    callerUserId: string,
    page: number,
    pageSize: number,
  ): Promise<[RequisitionEntity[], number]> {
    const qb = this.dataSource
      .createQueryBuilder(RequisitionEntity, 'r')
      .innerJoin(
        'org.fn_VisibleOrgUnits(:callerUserId)',
        'visible',
        'r.OrgUnitID = visible.OrgUnitID',
        { callerUserId },
      )
      .innerJoinAndSelect('r.orgUnit', 'ou')
      .where('r.isDeleted = :isDeleted', { isDeleted: false })
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    return qb.getManyAndCount();
  }
}
```

---

## 3. Registering `OrgUnitReferenceCheck`

### 3.1 Why It Exists
Before an administrator can **delete** or **move** an organization unit, Domain 2 runs a reference check across all foreign domains to guarantee referential and business integrity:
- An organization unit cannot be deleted if it has historical budget allocations, active requisitions, or active vendor contracts.
- An organization unit subtree move can be conditionally inspected if active financial allocations exist.

### 3.2 The Interface (`org-unit-reference-check.interface.ts`)
```typescript
export interface OrgUnitReferenceCheckResult {
  hasReferences: boolean;
  domain: string;
  details?: string;
  referenceCount?: number;
}

export interface OrgUnitReferenceCheck {
  domainName: string;
  hasReferences(
    orgUnitId: string,
    options?: { checkSubtree?: boolean },
  ): Promise<OrgUnitReferenceCheckResult>;
}
```

### 3.3 How Domain 4 & 5 Register Reference Checks

In your domain module (e.g. `BudgetModule` or `RequisitionModule`):

```typescript
import { Module, OnModuleInit } from '@nestjs/common';
import { OrgUnitReferenceCheckRegistry } from '../organization/org-units/services/org-unit-reference-check.registry';
import { BudgetReferenceCheckService } from './services/budget-reference-check.service';

@Injectable()
export class BudgetReferenceCheckService implements OrgUnitReferenceCheck {
  readonly domainName = 'BUDGET';

  constructor(private readonly budgetRepo: BudgetRepository) {}

  async hasReferences(
    orgUnitId: string,
    options?: { checkSubtree?: boolean },
  ): Promise<OrgUnitReferenceCheckResult> {
    const count = await this.budgetRepo.countActiveBudgetsForUnit(orgUnitId, options?.checkSubtree);
    return {
      hasReferences: count > 0,
      domain: this.domainName,
      details: count > 0 ? `Unit has ${count} active budget line(s)` : undefined,
      referenceCount: count,
    };
  }
}

@Module({
  providers: [BudgetReferenceCheckService],
})
export class BudgetModule implements OnModuleInit {
  constructor(
    private readonly registry: OrgUnitReferenceCheckRegistry,
    private readonly budgetCheck: BudgetReferenceCheckService,
  ) {}

  onModuleInit() {
    this.registry.register(this.budgetCheck);
  }
}
```

---

## 4. Hierarchical Approval Chain Contract

### 4.1 Purpose in Domain 5 (14-Stage Approval Workflow)
Domain 5 routes requisitions through ascending levels of authority (e.g. Section Head $\to$ Department Head $\to$ Business Unit Head $\to$ CEO).

### 4.2 Endpoint & Service API
- **HTTP Endpoint**: `GET /api/v1/organization/units/:id/approval-chain?asOfDate=YYYY-MM-DD`
- **NestJS Service**: `OrgManagersService.getApprovalChain(unitId: string, asOfDate?: string): Promise<ApprovalChainNodeDto[]>`

### 4.3 Response Contract (`ApprovalChainNodeDto`)
```typescript
export interface ApprovalChainNodeDto {
  orgUnitId: string;
  code: string;
  name: string;
  nameAr?: string | null;
  depth: number;
  orgUnitTypeCode: string;
  orgUnitTypeName: string;
  head: {
    userId: string;
    displayName: string;
    email: string;
    effectiveFrom: string;
  } | null;
}
```

### 4.4 Stability Guarantees (Rule G7)
1. **Read-Decoupled**: The approval chain **never reads `OrgUnits.HeadUserId` directly**. It dynamically joins `org.OrgUnitManagers` to find the exact primary HEAD manager (`IsPrimary = 1`) active on `asOfDate` (`EffectiveFrom <= asOfDate` AND (`EffectiveTo IS NULL` OR `EffectiveTo >= asOfDate`)).
2. **Missing Head Handling**: If an ancestor unit currently has no active primary HEAD assigned, `head` will be returned as `null`. Domain 5 workflows should handle `head: null` by escalating to the next parent in the chain or flagging an administrative review.
3. **Ascending Order Guarantee**: Nodes are strictly ordered ascending from the target unit (`idx = 0`) up to the root Organization node (`idx = N`).

---

## 5. Budget Owner Resolution

### 5.1 Purpose in Domain 4 (Budget) & Domain 5 (Requisitions)
In the DIEZ organizational matrix, Sections do not manage independent budget lines; budget authority is held at the Department or Business Unit level (`org.OrgUnitTypes.AllowsBudget = 1`).

When a requisition is raised by an employee in Section A, Domain 5 must resolve which Department owns the budget to check available funds.

### 5.2 Endpoint & Service API
- **HTTP Endpoint**: `GET /api/v1/organization/units/:id/budget-owner`
- **NestJS Service**: `OrgManagersService.getBudgetOwner(unitId: string): Promise<BudgetOwnerDto | null>`

### 5.3 Response Contract (`BudgetOwnerDto`)
```typescript
export interface BudgetOwnerDto {
  orgUnitId: string;
  code: string;
  name: string;
  nameAr?: string | null;
  orgUnitTypeCode: string;
  orgUnitTypeName: string;
  depth: number;
  head: {
    userId: string;
    displayName: string;
    email: string;
    effectiveFrom: string;
  } | null;
}
```

### 5.4 Resolution Algorithm
1. Inspects the unit itself. If its `OrgUnitType.AllowsBudget = 1`, it is its own budget owner.
2. If `AllowsBudget = 0`, it queries `org.OrgUnitClosure` traversing ascending ancestors ordered by `Depth DESC` to select the nearest ancestor unit having `AllowsBudget = 1`.
3. Returns `null` if no ancestor unit has budget authority.

---

## 6. Point-in-Time Snapshotting (`OrgUnitPathSnapshot`)

### 6.1 Historical Reporting Rule (§11.3)
When an organization unit moves to a new parent in the tree:
- **Reports for today** reflect today's tree.
- **Historical financial accounting** (e.g. Budget vs Actuals for Financial Year 2025) must remain tied to the organizational structure **as it existed when the expenditure was approved**.

### 6.2 Implementation Mandate for Domain 4 & 5 Tables
When inserting new rows into `budget.BudgetLines` or `req.Requisitions`:
1. Store the primary foreign key `OrgUnitID`.
2. Also snapshot and persist the unit's `LineagePath` into column `OrgUnitPathSnapshot NVARCHAR(1000)`:

```sql
INSERT INTO req.Requisitions (
    RequisitionID,
    OrgUnitID,
    OrgUnitPathSnapshot, -- e.g. '/DIEZ/BU_TECH/DEPT_ENG/SEC_FE'
    TotalAmount,
    CreatedBy
) VALUES (
    @ReqId,
    @OrgUnitId,
    (SELECT LineagePath FROM org.OrgUnits WHERE OrgUnitID = @OrgUnitId),
    @TotalAmount,
    @UserId
);
```

---

## 7. Quick Reference: Permissions & Error Codes

### 7.1 Key Permissions
| Permission Code | Description | Recommended Usage |
| :--- | :--- | :--- |
| `ORG.READ` | Read organization units and hierarchy | Standard read access |
| `ORG.EXPORT` | Export units to Excel | Restricted reporting access |
| `ORG.CREATE` | Create units | Org Admin |
| `ORG.UPDATE` | Edit unit attributes | Org Admin |
| `ORG.MOVE` | Move unit subtree | Super Admin / HR Executive |
| `ORG.DELETE` | Soft delete unit | Super Admin |
| `ORG.MANAGE_MANAGERS` | Assign leadership tenures | HR / Executive Admin |

### 7.2 Key Error Codes
| Error Code | HTTP Status | Meaning |
| :--- | :---: | :--- |
| `ORG_NOT_FOUND` | 404 | Unit does not exist or is outside caller's scope |
| `ORG_CYCLE_DETECTED` | 400 | Attempted to reparent a node under its own descendant |
| `ORG_CONCURRENCY_CONFLICT` | 409 | `RowVersion` token mismatch during update/move |
| `ORG_HAS_ACTIVE_CHILDREN` | 400 | Cannot delete unit with live child units |
| `ORG_HAS_EXTERNAL_REFERENCES` | 400 | Blocked by an `OrgUnitReferenceCheck` in Budget/Requisition |
| `ORG_MANAGER_OVERLAP` | 409 | Conflicting leadership tenure for same user/unit/role |
| `ORG_VENDOR_USER_REJECTED` | 400 | VENDOR users cannot be assigned as unit managers |
