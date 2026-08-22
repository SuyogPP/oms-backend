# OMS Domain 3 — User Administration

**Implementation specification**

| | |
| :--- | :--- |
| Domain | 3 — User Administration |
| Depends on | Domain 1 (Security & RBAC), Domain 2 (Organization Structure), Step 0 |
| Blocks | Every subsequent domain — all of them assign work to users |
| Schema | `auth` (existing) + minimal additions |
| Backend module root | `src/modules/authorization/` |
| API base | `/api/v1/authorization` |

---

## 0. Grounding

This spec is written against the **actual** `auth` schema in `readme.md`, not
assumed structures. Column names below are real. Where I propose new tables,
they're marked as additions.

### 0.1 Tables this domain owns

| Table | Role in this domain |
| :--- | :--- |
| `auth.Users` | Core identity. `UserID`, `EmployeeID`, `ADObjectID`, `Username`, `Email`, `UserType`, `IsActive`, `FailedLoginCount`, `LockedUntil` |
| `auth.UserProfiles` | `FirstName`, `LastName`, `MobileNo`, `JobTitle`, `DepartmentID`, `BusinessUnitID`, `SectionID` |
| `auth.UserTypes` | Lookup — INTERNAL / VENDOR |
| `auth.LocalCredentials` | `PasswordHash`, `PasswordChangedAt`, `MustChangePassword` |
| `auth.UserRoles` | Temporal role assignment — `EffectiveFrom`, `EffectiveTo`, `AssignedBy` |
| `auth.UserPermissionOverrides` | Per-user grant/revoke — temporal, with `ApprovedBy` |
| `auth.UserOrganizationScopes` | Scope assignment |
| `auth.Delegations` | Temporary authority transfer |

Read-only from this domain: `auth.Roles`, `auth.Permissions`,
`auth.RolePermissions`, `auth.RoleHierarchy`, `auth.PermissionConditions`,
`auth.ScopeDefinitions`. Those belong to a Role & Permission Administration
module, which is **out of scope here** — see §1.

### 0.2 Verification before coding

**Claude Code: run these and report before implementing anything.**

- [ ] What did Domain 2's reconciliation (`docs/DOMAIN-2-RECONCILIATION.md`)
      decide for `auth.UserOrganizationScopes`? Option (a) added `OrgUnitID`,
      (b) a coalescing view, or (c) altered the table? **Everything in §6
      depends on this answer.**
- [ ] `auth.UserTypes` — what rows are seeded? Exact `UserTypeCode` values.
- [ ] `auth.Users.UserType` is `nvarchar(50)`, not an FK to `auth.UserTypes`.
      Confirm whether values match `UserTypeCode`, and whether any constraint
      enforces it. If not, §5.1 adds one.
- [ ] `auth.ScopeDefinitions` — exact seeded `ScopeCode` values.
- [ ] `auth.Roles` — all seeded rows, with `RoleCode` and `IsSystemRole`.
- [ ] `auth.PermissionConditions` — is anything seeded, and is `Expression`
      actually evaluated anywhere today? If unused, §4.3 treats it as inert.
- [ ] Does any password-history table exist? `readme.md` shows none.
- [ ] Does any invitation or activation-token table exist? `readme.md` shows
      none.
- [ ] Confirm how a user is created today. Is there a working path at all, or
      were the existing users seeded by script?

### 0.3 Schema gaps found

These are real weaknesses in the existing schema. Each needs a decision.

| # | Gap | Impact | Recommendation |
| :--- | :--- | :--- | :--- |
| G1 | **No password history table** | Cannot enforce "don't reuse the last N passwords" — a standard control and an almost-certain pen-test finding | Add `auth.PasswordHistory` (§2.1) |
| G2 | **No invitation / activation token table** | No way to create a user who sets their own password. Admin-set passwords are worse practice and worse UX | Add `auth.UserInvitations` (§2.2) |
| G3 | **`auth.UserOrganizationScopes` has no `IsActive`, no effective dating, no audit columns** | Scope grants can't be time-boxed or audited. For a system whose whole point is financial control, that's a hole | Add columns (§2.3) |
| G4 | **`auth.UserProfiles` has no audit columns** | Profile changes are untraceable | Add columns (§2.3) |
| G5 | **`auth.Roles`, `auth.RolePermissions`, `auth.ScopeDefinitions` have only `CreatedAt`** — no `UpdatedAt`/`UpdatedBy` | Role and permission changes are untraceable at row level | Rely on `auth.SecurityEvents` for now; flag for the Role Admin module |
| G6 | **`auth.Delegations` is all-or-nothing** | A delegating HOD hands over *everything*, including permissions they may hold for unrelated reasons. Cannot delegate "just requisition approvals" | Flag as a client decision (§9.3). Do not silently ship all-or-nothing delegation for a financial approval system |
| G7 | **`auth.UserRoles` has no `IsDeleted`** | Revocation is `IsActive = 0` or setting `EffectiveTo`. Two mechanisms for one concept | Standardise on `EffectiveTo` (§4.2) |

---

## 1. Scope

### In scope

- User CRUD: create, read, update, activate, deactivate, soft delete
- Invitation and first-password flow
- Password reset, force change, unlock
- Role assignment with effective dating
- Scope assignment
- Per-user permission overrides
- Delegation management
- Effective-permission resolution and preview
- Vendor user management (separate lifecycle — see §7)
- Bulk import
- Admin UI under `/app/administration/users`

### Out of scope

- **Role & Permission Administration** — creating roles, editing role
  permissions, role hierarchy. Separate module. This domain *assigns* existing
  roles; it does not define them.
- Authentication itself (Domain 1, complete)
- Azure AD synchronisation (Integrations)
- MFA enrolment (Domain 1 remaining work)
- Field-level visibility (Visibility Engine)

---

## 2. Schema additions

Run manually, in order. **Only after §0.2 verification.**

### 2.1 `auth.PasswordHistory` — closes G1

```sql
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
GO
```

Write a row on every password change, including the first. Compare new
passwords against the most recent N (default 5, configurable). Prune beyond 24
rows per user.

### 2.2 `auth.UserInvitations` — closes G2

```sql
CREATE TABLE auth.UserInvitations (
    UserInvitationID    UNIQUEIDENTIFIER NOT NULL CONSTRAINT DF_UserInv_ID DEFAULT (NEWSEQUENTIALID()),
    UserID              UNIQUEIDENTIFIER NOT NULL,

    -- SHA-256 of the token. The raw token is emailed and never stored.
    TokenHash           VARBINARY(32)    NOT NULL,

    -- INVITE | PASSWORD_RESET
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
GO
```

- Token: 32 random bytes, base64url, emailed once. **Only the hash is stored.**
- Invite expiry 7 days; reset expiry 1 hour.
- Single use — set `ConsumedAt`.
- Issuing a new token of the same purpose revokes outstanding ones.

### 2.3 Audit and lifecycle columns — closes G3, G4

```sql
-- auth.UserOrganizationScopes
ALTER TABLE auth.UserOrganizationScopes ADD
    EffectiveFrom   DATETIME2(3)     NOT NULL CONSTRAINT DF_UOS_EffFrom DEFAULT (SYSUTCDATETIME()),
    EffectiveTo     DATETIME2(3)     NULL,
    IsActive        BIT              NOT NULL CONSTRAINT DF_UOS_IsActive DEFAULT (1),
    AssignedBy      UNIQUEIDENTIFIER NULL,
    AssignedAt      DATETIME2(3)     NOT NULL CONSTRAINT DF_UOS_AssignedAt DEFAULT (SYSUTCDATETIME()),
    Reason          NVARCHAR(500)    NULL;
GO

-- auth.UserProfiles
ALTER TABLE auth.UserProfiles ADD
    CreatedAt   DATETIME2(3)     NOT NULL CONSTRAINT DF_UP_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CreatedBy   UNIQUEIDENTIFIER NULL,
    UpdatedAt   DATETIME2(3)     NULL,
    UpdatedBy   UNIQUEIDENTIFIER NULL;
GO
```

> **`EffectiveFrom` / `IsActive` on `UserOrganizationScopes` changes scope
> resolution.** `org.fn_VisibleOrgUnits` from Domain 2 must be updated to
> filter on them, or every existing scope row silently keeps working while new
> time-boxed ones don't. Update it in the same migration.

### 2.4 Index additions

```sql
CREATE NONCLUSTERED INDEX IX_UserRoles_User_Active
    ON auth.UserRoles (UserID, EffectiveFrom, EffectiveTo)
    INCLUDE (RoleID) WHERE IsActive = 1;

CREATE NONCLUSTERED INDEX IX_UserRoles_Role
    ON auth.UserRoles (RoleID) INCLUDE (UserID) WHERE IsActive = 1;

CREATE NONCLUSTERED INDEX IX_UOS_User
    ON auth.UserOrganizationScopes (UserID)
    INCLUDE (ScopeDefinitionID, OrganizationID, BusinessUnitID, DepartmentID, SectionID);

CREATE NONCLUSTERED INDEX IX_UserProfiles_Dept
    ON auth.UserProfiles (DepartmentID) INCLUDE (UserID, FirstName, LastName);

CREATE NONCLUSTERED INDEX IX_Delegations_Active
    ON auth.Delegations (ToUserID, StartDate, EndDate) WHERE IsActive = 1;
GO
```

---

## 3. Permissions

`auth.Permissions` uses `ModuleName` and `ActionName` and has **no `IsActive`
column**. Insert accordingly:

```sql
INSERT INTO auth.Permissions (PermissionID, PermissionCode, ModuleName, ActionName, Description, CreatedAt)
VALUES
 (NEWID(), 'USER.VIEW',              'USER_ADMIN', 'VIEW',              'View users and their assignments',        SYSUTCDATETIME()),
 (NEWID(), 'USER.CREATE',            'USER_ADMIN', 'CREATE',            'Create a new user',                       SYSUTCDATETIME()),
 (NEWID(), 'USER.UPDATE',            'USER_ADMIN', 'UPDATE',            'Edit user profile details',               SYSUTCDATETIME()),
 (NEWID(), 'USER.DEACTIVATE',        'USER_ADMIN', 'DEACTIVATE',        'Activate or deactivate a user',           SYSUTCDATETIME()),
 (NEWID(), 'USER.DELETE',            'USER_ADMIN', 'DELETE',            'Soft delete a user',                      SYSUTCDATETIME()),
 (NEWID(), 'USER.INVITE',            'USER_ADMIN', 'INVITE',            'Send or resend an invitation',            SYSUTCDATETIME()),
 (NEWID(), 'USER.PASSWORD.RESET',    'USER_ADMIN', 'PASSWORD_RESET',    'Trigger a password reset',                SYSUTCDATETIME()),
 (NEWID(), 'USER.UNLOCK',            'USER_ADMIN', 'UNLOCK',            'Clear a lockout and failed login count',  SYSUTCDATETIME()),
 (NEWID(), 'USER.ROLE.ASSIGN',       'USER_ADMIN', 'ROLE_ASSIGN',       'Assign or revoke roles',                  SYSUTCDATETIME()),
 (NEWID(), 'USER.SCOPE.ASSIGN',      'USER_ADMIN', 'SCOPE_ASSIGN',      'Assign or revoke organizational scope',   SYSUTCDATETIME()),
 (NEWID(), 'USER.OVERRIDE.MANAGE',   'USER_ADMIN', 'OVERRIDE_MANAGE',   'Grant or revoke individual permissions',  SYSUTCDATETIME()),
 (NEWID(), 'USER.DELEGATION.MANAGE', 'USER_ADMIN', 'DELEGATION_MANAGE', 'Manage delegations for any user',         SYSUTCDATETIME()),
 (NEWID(), 'USER.IMPORT',            'USER_ADMIN', 'IMPORT',            'Bulk import users',                       SYSUTCDATETIME()),
 (NEWID(), 'USER.EXPORT',            'USER_ADMIN', 'EXPORT',            'Export the user list',                    SYSUTCDATETIME()),
 (NEWID(), 'VENDORUSER.MANAGE',      'USER_ADMIN', 'VENDOR_MANAGE',     'Manage vendor portal users',              SYSUTCDATETIME());
GO
```

Grants:

| Permission | SYSTEM_ADMIN | HR | PROCUREMENT | HOD |
| :--- | :---: | :---: | :---: | :---: |
| `USER.VIEW` | ✓ | ✓ | — | ✓ (scoped) |
| `USER.CREATE` / `UPDATE` | ✓ | ✓ | — | — |
| `USER.DEACTIVATE` | ✓ | ✓ | — | — |
| `USER.DELETE` | ✓ | — | — | — |
| `USER.INVITE` | ✓ | ✓ | — | — |
| `USER.PASSWORD.RESET` / `UNLOCK` | ✓ | ✓ | — | — |
| `USER.ROLE.ASSIGN` | ✓ | — | — | — |
| `USER.SCOPE.ASSIGN` | ✓ | — | — | — |
| `USER.OVERRIDE.MANAGE` | ✓ | — | — | — |
| `USER.DELEGATION.MANAGE` | ✓ | ✓ | — | — |
| `USER.IMPORT` / `EXPORT` | ✓ | ✓ | — | — |
| `VENDORUSER.MANAGE` | ✓ | — | ✓ | — |

Role and scope assignment are **SYSTEM_ADMIN only**. Letting HR grant roles
means HR can grant themselves `BUDGET.LOCK`. Separation of duties matters more
here than convenience.

---

## 4. Effective permission resolution 🔴

The most consequential piece of this domain. It runs on every request and is
the thing that decides whether the financial controls hold.

### 4.1 Resolution order

```
1. Roles active for the user today          (auth.UserRoles, temporal)
2. + Roles inherited via role hierarchy     (auth.RoleHierarchy, transitive)
3. → Permissions granted to those roles     (auth.RolePermissions)
4. + User overrides where IsGranted = 1     (auth.UserPermissionOverrides)
5. − User overrides where IsGranted = 0     (revoke wins)
6. + Permissions from an active delegation  (auth.Delegations)
```

**Rules that must not be negotiated away:**

- **Revoke beats grant.** If a user has a permission from a role and an
  override with `IsGranted = 0`, they do not have it. Always.
- **Every layer is temporal.** `UserRoles`, `UserPermissionOverrides`, and
  `Delegations` all carry date windows. A row outside its window contributes
  nothing.
- **Inactive users resolve to zero permissions**, regardless of assignments.
- **`SYSTEM_ADMIN` bypasses permission checks but not scope.** Scope must be
  explicitly granted, including GLOBAL.

### 4.2 Temporal predicate

`auth.UserRoles` has both `IsActive` and `EffectiveTo` (gap G7). Standardise:

```sql
-- The canonical "is this assignment live" predicate
IsActive = 1
AND EffectiveFrom <= SYSUTCDATETIME()
AND (EffectiveTo IS NULL OR EffectiveTo > SYSUTCDATETIME())
```

Revocation sets `EffectiveTo = SYSUTCDATETIME()`. It does **not** set
`IsActive = 0` — that's reserved for administrative suspension of an assignment
that should later resume. Document this in the repository.

### 4.3 Role hierarchy

`auth.RoleHierarchy` is parent/child and can nest. Resolve transitively with a
recursive CTE, and **guard against cycles** — nothing in the schema prevents
someone making role A a parent of B and B a parent of A.

```sql
WITH RoleClosure AS (
    SELECT ur.RoleID, 0 AS Depth
    FROM auth.UserRoles ur
    WHERE ur.UserID = @UserID
      AND ur.IsActive = 1
      AND ur.EffectiveFrom <= SYSUTCDATETIME()
      AND (ur.EffectiveTo IS NULL OR ur.EffectiveTo > SYSUTCDATETIME())

    UNION ALL

    SELECT rh.ChildRoleID, rc.Depth + 1
    FROM auth.RoleHierarchy rh
    INNER JOIN RoleClosure rc ON rc.RoleID = rh.ParentRoleID
    WHERE rh.IsActive = 1 AND rc.Depth < 10
)
SELECT DISTINCT RoleID FROM RoleClosure
OPTION (MAXRECURSION 10);
```

The `Depth < 10` guard is deliberate. Remove it and a cycle takes the server
down.

> **Confirm the direction of inheritance.** This CTE assumes a parent role
> *confers* its children's permissions. If the intent is the reverse — a child
> inherits from its parent — swap the join. Verify against seeded data in §0.2
> before shipping, because getting this backwards silently grants or denies
> permissions across the whole system.

### 4.4 Permission conditions

`auth.PermissionConditions.Expression` holds a logical expression, attached to
role-permission grants via `auth.RolePermissionConditions`.

**If nothing is seeded and no evaluator exists** (check §0.2), treat conditions
as inert for now and document it. Do not build an expression evaluator
speculatively — an unspecified DSL evaluated against live financial permissions
is a bad thing to invent under time pressure.

If conditions *are* in use, they must be evaluated server-side only, never in
the resolution cache, and the expression language needs its own spec.

### 4.5 Caching

Permissions are resolved fresh per request by design — that's what makes
revocation immediate.

If profiling shows this is hot, cache **per request** only, keyed by
`loginSessionId`, in the request-context service from Step 0. Never cache
across requests. The immediate-revocation property is a security control, not
a performance detail.

### 4.6 The preview endpoint

`GET /users/:id/effective-permissions` returns each permission **with its
source**:

```jsonc
{
  "permissions": [
    { "code": "REQUISITION.APPROVE", "source": "ROLE", "via": "HOD" },
    { "code": "BUDGET.LOCK", "source": "ROLE_INHERITED", "via": "HOD ← FINANCE_APPROVER" },
    { "code": "CANDIDATE.UNMASK", "source": "OVERRIDE_GRANT", "reason": "Temporary — audit review", "until": "2026-09-30" },
    { "code": "INTERVIEW.BYPASS", "source": "DELEGATION", "via": "Ahmed Al Mansouri", "until": "2026-09-05" }
  ],
  "revoked": [
    { "code": "REQUISITION.CREATE", "source": "OVERRIDE_REVOKE", "reason": "Under investigation" }
  ]
}
```

This is the single most useful screen in the module. "Why can this person
approve budgets?" is the question auditors ask, and without this endpoint the
answer takes an afternoon of SQL.

---

## 5. User lifecycle

### 5.1 Creation

| # | Rule | Failure |
| :--- | :--- | :--- |
| U1 | `Email` unique across all users including deleted (`UX_Users_Email`) | 409 `USER_EMAIL_EXISTS` |
| U2 | `Username` unique (`UX_Users_Username`) | 409 `USER_USERNAME_EXISTS` |
| U3 | `UserType` must match a seeded `auth.UserTypes.UserTypeCode` | 400 `USER_TYPE_INVALID` |
| U4 | INTERNAL users require `EmployeeID` | 400 `USER_EMPLOYEE_ID_REQUIRED` |
| U5 | VENDOR users must not have `EmployeeID`, and must link to a vendor | 400 `USER_VENDOR_INVALID` |
| U6 | `UserProfiles` row created in the same transaction | — |
| U7 | Org unit IDs on the profile must exist and be active | 400 `USER_ORG_UNIT_INVALID` |
| U8 | Creator's scope must cover the assigned department | 403 `USER_SCOPE_DENIED` |
| U9 | AD-linked users (`ADObjectID` set) get no `LocalCredentials` row | — |
| U10 | Non-AD users get an invitation, never an admin-set password | — |

Add the missing constraint if §0.2 confirms it's absent:

```sql
ALTER TABLE auth.Users WITH CHECK
ADD CONSTRAINT CK_Users_UserType
    CHECK (UserType IN ('INTERNAL','VENDOR'));
```

Substitute the real seeded codes.

### 5.2 Invitation flow

```
Create user (IsActive = 0)
   → issue INVITE token, email it
   → user opens link, sets password
   → LocalCredentials created, PasswordHistory written
   → ConsumedAt set, IsActive = 1
   → SecurityEvent written
```

- Expired or consumed token → generic *"This link is no longer valid. Ask an
  administrator to send a new invitation."* **Never** reveal whether the token
  existed.
- Resending revokes outstanding INVITE tokens for that user.
- A user pending invitation shows as **Invited**, not Active or Inactive.

### 5.3 Password rules

- Compare against the last N (default 5) `PasswordHistory` rows.
- Write history on every change, including the initial set.
- `MustChangePassword = 1` forces a change at next login. Admin reset sets it.
- Admins **never** see or set a password directly — they trigger a reset token.
- Reset revokes all active sessions for that user (`auth.LoginSessions`) and
  writes a `LogoutHistory` row with reason `PASSWORD_RESET`.

### 5.4 Lockout

`auth.Users` carries `FailedLoginCount`, `LastFailedLoginAt`, `LockedUntil`.

- Unlock clears all three and writes a `SecurityEvent`.
- Requires `USER.UNLOCK`.
- The list view must expose a "Locked" filter — it's the most common support
  request.

### 5.5 Deactivate and delete

| # | Rule |
| :--- | :--- |
| U11 | Deactivate sets `IsActive = 0` and revokes all active sessions immediately |
| U12 | Deactivation does **not** end role or scope assignments — reactivation restores the user as they were |
| U13 | Delete is soft: `IsDeleted = 1`, `DeletedAt`, `DeletedBy`. No hard delete endpoint exists |
| U14 | Cannot deactivate or delete yourself | 409 `USER_SELF_ACTION` |
| U15 | Cannot deactivate or delete the last active `SYSTEM_ADMIN` | 409 `USER_LAST_ADMIN` |
| U16 | Cannot delete a user who is the current primary head of any org unit | 409 `USER_IS_ORG_HEAD` |
| U17 | Deleting revokes sessions, ends role assignments (`EffectiveTo = now`), and ends active delegations |

**U15 and U16 are the ones that bite.** Locking every administrator out of a
government system is unrecoverable without database access, and deleting an org
unit head silently breaks approval routing for every requisition in that
department.

---

## 6. Scope assignment

**This section depends on the §0.2 answer.** `auth.UserOrganizationScopes` has
four nullable columns — `OrganizationID`, `BusinessUnitID`, `DepartmentID`,
`SectionID` — one of which should be populated according to the chosen
`ScopeDefinitionID`.

### 6.1 Validation — mandatory regardless of the Domain 2 decision

Nothing in the schema stops all four columns being populated, or none. Enforce
in the service layer:

| Scope code | Required column | All others |
| :--- | :--- | :--- |
| `GLOBAL` | none | must be NULL |
| `ORGANIZATION` | `OrganizationID` | must be NULL |
| `BUSINESS_UNIT` | `BusinessUnitID` | must be NULL |
| `DEPARTMENT` | `DepartmentID` | must be NULL |
| `SECTION` | `SectionID` | must be NULL |
| `SELF` | none | must be NULL |

Reject anything else with 400 `SCOPE_ASSIGNMENT_INVALID`. Consider adding a
`CHECK` constraint once the shape is settled.

The referenced ID must be a live `org.OrgUnits` row **of the matching type**.
A `DepartmentID` pointing at a Business Unit passes every FK and breaks scope
resolution silently.

### 6.2 Rules

| # | Rule | Failure |
| :--- | :--- | :--- |
| S1 | Exactly one scope column populated, matching the scope code | 400 `SCOPE_ASSIGNMENT_INVALID` |
| S2 | Referenced org unit must exist, be active, and be the right type | 400 `SCOPE_ORG_UNIT_INVALID` |
| S3 | Granting GLOBAL requires `SYSTEM_ADMIN` | 403 |
| S4 | Cannot grant scope broader than your own | 403 `SCOPE_ESCALATION` |
| S5 | VENDOR users get no organizational scope | 400 `SCOPE_VENDOR_NOT_ALLOWED` |
| S6 | Duplicate active scope for the same unit is rejected | 409 `SCOPE_DUPLICATE` |
| S7 | Revocation sets `EffectiveTo`, never deletes the row | — |
| S8 | Cannot remove your own last scope | 409 `USER_SELF_ACTION` |

**S4 is the important one.** A user with DEPARTMENT scope must not be able to
grant anyone BUSINESS_UNIT scope. Without it, scope is decorative.

### 6.3 Update `org.fn_VisibleOrgUnits`

Adding `EffectiveFrom` / `EffectiveTo` / `IsActive` in §2.3 means the Domain 2
function must filter on them. Ship both changes in the same migration, or
time-boxed scopes will silently never expire.

---

## 7. Vendor users

Vendor users are a genuinely different lifecycle and the single most likely
place for a security mistake.

| # | Rule |
| :--- | :--- |
| V1 | `UserType = 'VENDOR'`, never `INTERNAL` |
| V2 | Must link to a vendor record. Until Domain 6 exists, store the reference and validate the shape |
| V3 | **Never** assigned internal roles. Only vendor-scoped roles |
| V4 | **Never** assigned organizational scope (S5) |
| V5 | **Never** assigned to an org unit on their profile |
| V6 | Never eligible as an org unit manager — Domain 2 rule G4 already enforces this |
| V7 | Access only `/vendor/*` and `/api/v1/vendor/*` |
| V8 | Managed under `VENDORUSER.MANAGE` by Procurement, not HR |
| V9 | Listed separately in the UI, never mixed into the internal user list |
| V10 | Deactivating a vendor deactivates all its users |

Enforce V3 and V4 in the service layer with explicit checks, and cover both
with tests. Do not rely on the UI not offering the option.

---

## 8. API surface

Base `/api/v1/authorization`. Step 0 envelope, pagination, and audit
interceptor throughout.

### Users

| Method | Path | Permission |
| :--- | :--- | :--- |
| GET | `/users` | `USER.VIEW` |
| GET | `/users/:id` | `USER.VIEW` |
| POST | `/users` | `USER.CREATE` |
| PATCH | `/users/:id` | `USER.UPDATE` |
| POST | `/users/:id/activate` | `USER.DEACTIVATE` |
| POST | `/users/:id/deactivate` | `USER.DEACTIVATE` |
| DELETE | `/users/:id` | `USER.DELETE` |
| GET | `/users/:id/activity` | `USER.VIEW` |
| GET | `/users/export` | `USER.EXPORT` |

### Credentials

| Method | Path | Permission |
| :--- | :--- | :--- |
| POST | `/users/:id/invite` | `USER.INVITE` |
| POST | `/users/:id/password-reset` | `USER.PASSWORD.RESET` |
| POST | `/users/:id/unlock` | `USER.UNLOCK` |
| POST | `/users/:id/force-password-change` | `USER.PASSWORD.RESET` |
| POST | `/users/:id/revoke-sessions` | `SECURITY.SESSIONS.REVOKE` |

Public, unauthenticated, rate-limit tier 1:

| Method | Path |
| :--- | :--- |
| GET | `/invitations/:token/validate` |
| POST | `/invitations/:token/accept` |

### Assignments

| Method | Path | Permission |
| :--- | :--- | :--- |
| GET | `/users/:id/roles` | `USER.VIEW` |
| POST | `/users/:id/roles` | `USER.ROLE.ASSIGN` |
| DELETE | `/users/:id/roles/:userRoleId` | `USER.ROLE.ASSIGN` |
| GET | `/users/:id/scopes` | `USER.VIEW` |
| POST | `/users/:id/scopes` | `USER.SCOPE.ASSIGN` |
| DELETE | `/users/:id/scopes/:scopeId` | `USER.SCOPE.ASSIGN` |
| GET | `/users/:id/overrides` | `USER.VIEW` |
| POST | `/users/:id/overrides` | `USER.OVERRIDE.MANAGE` |
| DELETE | `/users/:id/overrides/:overrideId` | `USER.OVERRIDE.MANAGE` |
| **GET** | **`/users/:id/effective-permissions`** | `USER.VIEW` |

### Delegations

| Method | Path | Permission |
| :--- | :--- | :--- |
| GET | `/users/:id/delegations` | `USER.VIEW` |
| POST | `/users/:id/delegations` | own, or `USER.DELEGATION.MANAGE` |
| PATCH | `/delegations/:id` | own, or `USER.DELEGATION.MANAGE` |
| DELETE | `/delegations/:id` | own, or `USER.DELEGATION.MANAGE` |
| GET | `/me/delegations` | authenticated |

### Vendor users

| Method | Path | Permission |
| :--- | :--- | :--- |
| GET | `/vendor-users` | `VENDORUSER.MANAGE` |
| POST | `/vendor-users` | `VENDORUSER.MANAGE` |
| PATCH | `/vendor-users/:id` | `VENDORUSER.MANAGE` |
| POST | `/vendor-users/:id/deactivate` | `VENDORUSER.MANAGE` |

### Bulk

| Method | Path | Permission |
| :--- | :--- | :--- |
| POST | `/users/import/validate` | `USER.IMPORT` |
| POST | `/users/import/commit` | `USER.IMPORT` |

Validate-then-commit, never a single-shot import. Validate returns per-row
errors; commit takes a token from validate and is all-or-nothing.

---

## 9. Business rules — cross-cutting

### 9.1 Self-modification

A user may edit their own profile basics. They may **not**:

- Assign or revoke their own roles
- Change their own scope
- Grant themselves an override
- Deactivate or delete themselves

All → 409 `USER_SELF_ACTION`. These are the lines that stop privilege
escalation.

### 9.2 Scope filtering on the user list

`USER.VIEW` is scoped. An HOD sees users in their department subtree, not
everyone.

Filter in SQL, joining `auth.UserProfiles.DepartmentID` against
`org.fn_VisibleOrgUnits`. Out-of-scope direct access returns **404**, per the
Domain 2 rule — a 403 confirms the user exists.

`SYSTEM_ADMIN` with GLOBAL scope sees everyone.

### 9.3 Delegation — open decision 🔴

`auth.Delegations` transfers **all** of a user's authority (gap G6). There's no
column limiting it to specific roles or permissions.

For a system whose purpose is financial control, that's a significant gap: an
HOD delegating during annual leave hands over budget locking, interview bypass,
and contract termination together.

Three options — **needs a client decision before this ships**:

- **(a)** Accept all-or-nothing, document it prominently, require a reason, and
  show a clear banner when acting under delegation.
- **(b)** Add `auth.DelegationPermissions` to scope a delegation to specific
  permissions.
- **(c)** Add `auth.DelegationRoles` to delegate specific roles.

**(b)** is the most defensible for a financial approval system. Do not ship
(a) silently.

Regardless of the choice:

| # | Rule |
| :--- | :--- |
| D1 | `FromUserID ≠ ToUserID` |
| D2 | `EndDate > StartDate`; maximum 90 days |
| D3 | No overlapping active delegations from the same user |
| D4 | Delegate must be active and INTERNAL |
| D5 | No chained delegation — a delegate cannot re-delegate |
| D6 | Every action taken under delegation records both the acting and the delegating user in the audit log |
| D7 | Expiry is evaluated at request time, not by a job — a delegation that ended an hour ago must already be inert |

D6 is a compliance requirement, not a nicety.

---

## 10. Module layout

```
src/modules/authorization/
├── authorization.module.ts
├── users/
│   ├── controllers/ users.controller.ts, user-credentials.controller.ts
│   ├── services/    users.service.ts
│   │                user-lifecycle.service.ts     # activate/deactivate/delete
│   │                user-credentials.service.ts   # invite/reset/unlock
│   │                user-validation.service.ts    # §5, §6, §7 rules
│   ├── repositories/ users.repository.ts
│   │                 user-profiles.repository.ts
│   │                 user-invitations.repository.ts
│   │                 password-history.repository.ts
│   ├── dto/ entities/ interfaces/
│   ├── users.mapper.ts, users.constants.ts, index.ts
│   └── users.module.ts
├── user-assignments/
│   ├── controllers/ user-roles.controller.ts
│   │                user-scopes.controller.ts
│   │                user-overrides.controller.ts
│   ├── services/    user-roles.service.ts
│   │                user-scopes.service.ts
│   │                user-overrides.service.ts
│   └── repositories/ …
├── permission-resolution/          # §4 — exported, consumed by the auth guard
│   ├── services/    effective-permissions.service.ts
│   │                role-hierarchy.service.ts
│   ├── repositories/ permission-resolution.repository.ts
│   └── index.ts
├── delegations/
├── vendor-users/
└── user-import/
```

`permission-resolution` must not depend on `users` services — the auth guard
consumes it on every request and a circular import will surface as a
boot-order failure.

### Transactions

Single transaction each:

- Create user: `Users` → `UserProfiles` → invitation token → security event
- Accept invitation: `LocalCredentials` → `PasswordHistory` → consume token →
  activate → security event
- Delete user: soft delete → revoke sessions → end roles → end delegations →
  security event
- Password reset: revoke sessions → issue token → `LogoutHistory` → security
  event

---

## 11. UI

Routes under `/app/administration/users`:

| Screen | Route |
| :--- | :--- |
| User list | `/users` |
| User detail | `/users/[id]` |
| Create | `/users/new` |
| Bulk import | `/users/import` |
| Vendor users | `/users/vendors` |
| Accept invitation | `/accept-invitation` (public) |

Detail tabs: **Overview · Roles · Scope · Permissions · Delegations · Activity**

### Screens worth care

**Permissions tab** — renders `/effective-permissions` grouped by module, each
row showing where it came from: role, inherited role, override, or delegation.
Revoked permissions shown struck through with the reason. This is the audit
screen; it's the reason this module exists.

**Scope tab** — an `OrgUnitPicker` from Domain 2, filtered by the chosen scope
level. Show the resulting visible-unit count as immediate feedback: *"This
gives access to 47 departments."* Abstract scope levels mean nothing to people
without that number.

**Roles tab** — a timeline like Domain 2's manager panel, since assignments are
effective-dated. Assigning a role with a future start date must be visibly
different from one active now.

**List** — filters for Status (Active / Inactive / Invited / **Locked**), Type,
Department, Role, and Has no role. "Locked" and "Invited" are the two most
common support queries.

### Conventions

- Plain language, per the Domain 2 vocabulary rules. "Who they are", not
  "identity attributes". "What they can do", not "effective permission set".
- Gate on permission via `can()`, never role name.
- Reuse `DataTable`, `StatusBadge`, `Timeline`, `OrgUnitPicker`.
- Never render a password field for an administrator. Invitation and reset
  flows only.

---

## 12. Tests

### Permission resolution — highest priority

- Role grants a permission → user has it
- Role revoked (`EffectiveTo` in the past) → user does not
- Role with future `EffectiveFrom` → user does not
- Inherited role permission resolves
- **Cyclic role hierarchy does not hang** — assert the depth guard fires
- Override grant adds a permission the user has via no role
- **Override revoke beats a role grant**
- Expired override contributes nothing
- Delegation adds permissions for the window only
- Expired delegation contributes nothing at request time (D7)
- Inactive user resolves to zero permissions regardless of assignments
- `SYSTEM_ADMIN` bypasses permission checks but **not** scope

### Lifecycle

- Duplicate email and username rejected, including against soft-deleted rows
- Invitation: issue, validate, accept, expire, reuse-rejected
- Expired and consumed tokens return the same generic message
- Resending revokes the previous token
- Password reuse within the last 5 rejected
- Password reset revokes all sessions and writes `LogoutHistory`
- Unlock clears `FailedLoginCount`, `LastFailedLoginAt`, `LockedUntil`
- Cannot deactivate or delete yourself
- Cannot deactivate the last active `SYSTEM_ADMIN`
- Cannot delete a current org unit head
- Deactivate then reactivate restores roles and scopes intact

### Scope

- Each scope code accepts only its matching column; every other combination
  rejected
- `DepartmentID` pointing at a Business Unit is rejected
- DEPARTMENT-scoped user cannot grant BUSINESS_UNIT scope (S4)
- User list is scope-filtered; out-of-scope direct access returns 404
- Scope with `EffectiveTo` in the past grants nothing

### Vendor

- Vendor user cannot receive an internal role
- Vendor user cannot receive organizational scope
- Vendor user cannot be an org unit manager
- Vendor user rejected on every internal endpoint
- Deactivating a vendor deactivates its users

### Performance — 2,000 users, 20 roles, 3-level hierarchy

| Operation | Target |
| :--- | ---: |
| Effective permission resolution, one user | < 15 ms |
| `GET /users` page 1, 50 rows, scope-filtered | < 150 ms |
| `GET /users/:id/effective-permissions` | < 100 ms |

---

## 13. Definition of Done

- [ ] §0.2 verification completed and findings documented
- [ ] §0.3 gap decisions taken and recorded — especially **G6 (delegation
      scope)**
- [ ] Schema additions applied; `org.fn_VisibleOrgUnits` updated for the new
      scope columns
- [ ] Permissions inserted with `ModuleName` / `ActionName`, granted per §3
- [ ] Effective permission resolution implemented with the cycle guard, fully
      tested
- [ ] Revoke-beats-grant verified by test
- [ ] Every §5, §6, §7, §9 rule enforced server-side with a test
- [ ] Self-modification and last-admin protections verified
- [ ] Vendor isolation verified at service level, not just in the UI
- [ ] Invitation flow complete; no admin-set-password path exists anywhere
- [ ] Scope filtering in SQL on the user list; out-of-scope returns 404
- [ ] `/effective-permissions` returns source attribution for every permission
- [ ] UI complete, permission-gated, plain language
- [ ] Performance targets met at 2,000 users
- [ ] `readme.md` updated with the new tables and altered columns
- [ ] Handoff doc: how other domains consume effective-permission resolution
