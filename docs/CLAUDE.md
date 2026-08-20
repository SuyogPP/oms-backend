# CLAUDE.md — oms-backend

NestJS API for the DIEZ Outsource Management System (OMS). This is the
**authoritative owner of the database**. All business logic, all SQL, all
token issuance, and all authorization decisions live here.

---

## Project Context

| Item | Value |
| :--- | :--- |
| Client | Dubai Integrated Economic Zones (DIEZ) |
| Framework | NestJS (modular monolith, microservice-ready) |
| Language | TypeScript 5 |
| Database | Microsoft SQL Server |
| Data access | Raw parameterized SQL via TypeORM `DataSource` |
| Docs | Swagger / OpenAPI |
| Package manager | npm |
| Companion repo | `oms-prod-dev` (Next.js) — presentation only, **no DB access** |

A migration is in progress: API routes are moving out of the Next.js app
into this repo. See `MIGRATION.md` for the ordered plan. Do not add new
database access to the frontend repo under any circumstances.

---

## Architecture Rules — Non-Negotiable

### Layering

```
Request → Guard → ValidationPipe → Controller → Service → Repository → SQL Server
```

1. **Controllers** contain HTTP concerns only. Receive request, call
   service, return response. **No business logic. No SQL.**
2. **Services** contain business logic. They orchestrate rules and call
   repositories. **They never write SQL and never import `DataSource`.**
3. **Repositories** contain SQL only. They are the only layer permitted to
   touch the database.
4. **Mappers** convert database rows to API models. Services and
   controllers must not hand raw DB rows to the client.

### Module Folder Structure

Every feature module follows this layout exactly:

```
src/modules/<domain>/<module>/
├── controllers/         # HTTP endpoints only
├── services/            # Business logic
├── repositories/        # SQL queries
├── dto/                 # Request validation (class-validator)
├── entities/            # API response models
├── interfaces/          # TypeScript contracts
├── <module>.mapper.ts   # Row → model transformation
├── <module>.constants.ts
├── index.ts
└── <module>.module.ts
```

`mapper` and `constants` may be folders instead of single files when the
module is large. Nothing else may live at the module root.

Reference implementation: `src/modules/authorization/users/`.

---

## Database Conventions

The `auth` schema contains **28 security tables**. The authoritative schema
reference is `readme.md`. **`OMS-RBAC-Architecture.md` is outdated (it
describes 24 tables) — do not use it for schema decisions.**

### Hard rules

- **Parameterized queries always.** String concatenation into SQL is
  forbidden. This is a security requirement, not a style preference.
- **Primary keys** are `uniqueidentifier` using `newsequentialid()`.
  Ensure UUID formats are correct in queries and DTOs.
- **Soft deletes.** Never hard-delete. Always filter with
  `IsActive = 1 AND IsDeleted = 0`.
- **Audit columns.** Every write must populate `CreatedBy` / `UpdatedBy`.
  Audit log writes must record `IPAddress` and `UserAgent`.
- **Temporal access.** `UserRoles` and `UserPermissionOverrides` carry
  `EffectiveFrom` / `EffectiveTo`. Always check the current date falls
  within these boundaries when resolving access.

---

## Authorization Model

Five layers. A request must pass every applicable layer.

| Layer | Question | Components |
| :--- | :--- | :--- |
| 1. Authentication | Who are you? | `AuthService`, `SessionService`, `auth.LoginSessions` |
| 2. RBAC | What can you do? | `Roles`, `Permissions`, `RolePermissions`, `UserRoles` |
| 3. Scope | What can you see? | `ScopeDefinitions`, `UserOrganizationScopes`, `DataAccessRules` |
| 4. Workflow | What can you do *right now*? | `WorkflowStates`, `WorkflowPermissionMatrix` |
| 5. Visibility | Which fields can you see? | `VisibilityPolicies`, `FieldVisibilityRules` |

Layer 5 is **required before the Candidate module ships** — blind candidate
review (masking vendor identity and quotes from the requesting department,
with conditional HOD unmasking during bypass approval) is a contractual
requirement, not a future enhancement.

### Decorators

```ts
@Public()                                  // bypass auth (health, swagger)
@CurrentUser() user: CurrentUser           // inject authenticated user
@RequirePermissions("USER.READ")           // single permission
@RequirePermissions("USER.READ", "USER.WRITE")  // AND evaluation
```

`SYSTEM_ADMIN` bypasses permission checks. Scope and workflow checks still
apply.

### Request user shape

```ts
{ userId, username, email, userType, loginSessionId, roles, permissions, scopes }
```

### Roles

Internal: `SYSTEM_ADMIN`, `HR`, `FINANCE`, `PROCUREMENT`, `HOD`,
`REQUESTOR`, `MAIN_INTERVIEWER`
External: `VENDOR` (may only access assigned requisitions)

### Known permission strings

```
REQUISITION.CREATE   REQUISITION.VIEW   REQUISITION.APPROVE   REQUISITION.REJECT
BUDGET.VIEW          BUDGET.LOCK        BUDGET.RELEASE
INTERVIEW.SCHEDULE   INTERVIEW.BYPASS
CANDIDATE.VIEW       CANDIDATE.UNMASK
USER.MANAGE          ROLE.MANAGE
SECURITY.ADMIN       SECURITY.DASHBOARD.VIEW    SECURITY.EVENTS.VIEW
SECURITY.EVENTS.EXPORT   SECURITY.FAILED_LOGINS.VIEW
SECURITY.SESSIONS.VIEW   SECURITY.SESSIONS.REVOKE
SECURITY.USERS.FORCE_LOGOUT
```

Never gate UI or logic on role name. Gate on permission.

---

## Domain Model Notes

### Requisitions are multi-seat

A requisition may request N resources ("5 Engineers"). Budget reservation,
candidate selection, onboarding, no-show replacement, renewal, termination,
and work-completion entry all operate on **an individual seat**, not on the
requisition as a whole.

Model an explicit `RequisitionPosition` entity, and an `Assignment` once a
person joins. Do not attach candidate, onboarding, or termination records
directly to the requisition.

### Budget is an append-only ledger

Distinct states required by the RFP:

- **Reserved** — on submission, before HOD approval. Multiple users may
  concurrently reserve against the same budget line.
- **Locked / Allocated** — on HOD approval.
- **Consumed** — monthly invoice values logged by the Work Completion
  Assignee.
- **Released** — on rejection, closure, termination, or 30-day auto-close.

Implement as immutable ledger entries with a derived balance and optimistic
concurrency on the budget line. **Do not mutate a `RemainingAmount` column** —
that reintroduces the double-spend the system exists to prevent.

### Workflow

14 stages, defined in the RFP (`Outsource_Management_System_-_v1_3_docx.pdf`).
State transitions must be validated against `WorkflowPermissionMatrix`, never
hardcoded in services.

System hygiene rules:
- Drafts auto-delete after **60 days**
- Requests pending approval or clarification auto-close after **30 days**,
  releasing locked funds
- Configurable reminder intervals (1 / 3 / 7 days) before auto-close

---

## Cross-Cutting Infrastructure

Required before further business modules land:

- API versioning (`/api/v1`)
- Standard response envelope
- Pagination / sorting / filtering framework
- Correlation ID middleware + request context service
- Audit logging interceptor
- Rate limiting (8 tiers — see the Cybersecurity doc, section 11)
- Security event logging

---

## Conventions

- Validate every input with a DTO and `class-validator` decorators. Never
  trust client data.
- Document every endpoint with Swagger annotations.
- No hardcoded credentials or API keys — environment variables only.
- Error responses use the global exception filter's standard format.

---

## Do Not

- Put SQL in a service or controller
- Concatenate values into a SQL string
- Hard-delete a row
- Add database access to the Next.js repo
- Use `OMS-RBAC-Architecture.md` as a schema reference
- Gate behaviour on role name instead of permission
- Store permissions inside the JWT (they are resolved fresh per request)
