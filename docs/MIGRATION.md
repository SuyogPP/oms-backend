# MIGRATION.md — Next.js → NestJS API Consolidation

Move all database access and authorization out of `oms-prod-dev` (Next.js)
and into `oms-backend` (NestJS).

Place a copy of this file at the root of **both** repos.

---

## Why

Today both applications connect to MSSQL independently, through different
stacks (`mssql` in Next.js, TypeORM `DataSource` in NestJS). `AuthService`,
`SessionService`, `PermissionService`, `ScopeService`,
`WorkflowPermissionService` and the repository layer exist **twice**, in two
incompatible implementations.

That is tolerable while the only domain is auth. It becomes unfixable once
requisitions, budget ledgers, and workflow state live in both. It also puts
database credentials in the presentation tier.

---

## Target Architecture

```
Browser
   │  HttpOnly cookie
   ▼
Next.js  ── cookies, SSR, UI, thin proxy handlers
   │  Bearer token, server-side fetch
   ▼
NestJS   ── auth, RBAC, business logic, SQL
   │
   ▼
SQL Server
```

**Next.js keeps:** HttpOnly cookie set/clear, SSR + RSC, route handlers that
proxy, all UI and components.

**Next.js loses:** JWT verification, session DB lookups, RBAC resolution,
device fingerprint validation, every database call.

**NestJS gains:** token issuance and validation, session lifecycle, RBAC
resolution, security events, retention, and all future business modules.

---

## Method

Strangler pattern. Introduce `BACKEND_BASE_URL`, then convert **one route
handler at a time** from "query the database" to "proxy to NestJS." Every
step is independently revertible. Do not batch steps.

After each step: run both apps, exercise the affected screens, confirm
audit/security events still write, then commit.

---

## Step 0 — NestJS Cross-Cutting Foundation

**Nothing else migrates cleanly until this exists.**

- [x] API versioning — all routes under `/api/v1`
- [x] Standard response envelope (success, data, error, meta)
- [x] Pagination framework (page, pageSize, total)
- [x] Sorting framework
- [x] Filtering framework
- [x] Correlation ID middleware
- [x] Request context service (user, IP, user agent, correlation ID)
- [x] Request metadata interceptor
- [x] Audit logging interceptor
- [x] Security event logging service
- [x] Rate limiting — 8 tiers per the Cybersecurity doc, section 11

Gate: a trivial endpoint returns a correctly enveloped, paginated,
correlation-tagged, audit-logged response. (Verified on `/api/v1/auth-test/gate`)

---

## Step 1 — Security Dashboard + Charts (13 endpoints) [COMPLETED]

Read-only. Lowest risk. This is where the pagination and filtering
frameworks get proven against real queries.

Migrated:
- [x] `/api/internal/security/dashboard`
- [x] `/api/internal/security/summary`
- [x] `/api/internal/security/user-summary`
- [x] `/api/internal/security/events`
- [x] `/api/internal/security/failed-logins`
- [x] 7 × `/api/internal/security/charts/*`
- [x] `/api/internal/security/stream` (SSE Server-Sent Events stream)

Gate verified: security dashboard renders identically, live stream updates, proxy passes through data and SSE seamlessly.

---

## Step 2 — Security Settings (6 endpoints) [COMPLETED]

First writes. Exercises the audit interceptor.

Migrated:
- [x] `GET /api/internal/security/settings`
- [x] `PUT /api/internal/security/settings`
- [x] `GET /api/internal/security/settings/users/[userId]/sessions`
- [x] `DELETE /api/internal/security/settings/users/[userId]/sessions/[sessionId]`
- [x] `POST /api/internal/security/settings/users/[userId]/logout-all`
- [x] `POST /api/internal/security/sessions/revoke-all`

Gate verified: requires `SECURITY.ADMIN` / `SECURITY.SESSIONS.VIEW` / `SECURITY.SESSIONS.REVOKE` / `SECURITY.USERS.FORCE_LOGOUT`, settings changes emit granular `SECURITY_SETTING_CHANGED` security events, and audit interceptor records mutations.

---

## Step 3 — Session Management (3 endpoints) [COMPLETED]

- [x] `GET /api/auth/sessions`
- [x] `DELETE /api/auth/sessions/[id]`
- [x] `POST /api/auth/sessions/revoke-all`

Gate verified: Profile → Sessions tab lists sessions with active flag, terminates one with self-termination guard and ownership check, writes `auth.LogoutHistory`, logs `auth.SecurityEvents`, and terminates all other sessions.

---

## Step 4 — Auth Core (login, logout, refresh) [COMPLETED]

- [x] Credential validation and token issuance
- [x] Refresh token rotation
- [x] Refresh token replay detection
- [x] Session creation, fingerprinting, max-session enforcement
- [x] Login rate limiting and account lockout
- [x] Login / logout history writes
- [x] Next.js route handlers converted to thin BFF proxies managing HttpOnly cookies
- [x] Next.js middleware cutover (stops touching database; in-memory JWT parsing)

Gate verified: login, silent refresh, token rotation, replay attack detection & rejection (403), logout, session auto-revocation, portal isolation, and audit/history writes.

---

## Step 5 — Retention Job [COMPLETED]

- [x] `@nestjs/schedule` cron registered (`@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)`)
- [x] Manual trigger endpoint `POST /api/v1/internal/jobs/retention` with `SECURITY.ADMIN` RBAC
- [x] Parameterized SQL Server purge queries for `[auth].[SecurityEvents]`, `[auth].[LoginHistory]`, `[auth].[LogoutHistory]`, `[auth].[FailedLoginAttempts]`, and inactive `[auth].[LoginSessions]`
- [x] Dynamic retention policies read from `[auth].[SecuritySettings]`
- [x] Next.js route handler converted to thin BFF proxy
- [x] Retired `CRON_SECRET` dependency in Next.js
- [x] Automated unit and live integration testing passed

---

## Step 6 — Delete the Duplicates [COMPLETED]

All duplicate data access and database dependencies have been permanently removed from `oms-prod-dev`:

- [x] `lib/db.ts` deleted
- [x] `lib/repositories/` (all 9) deleted
- [x] `lib/use-cases/` (all 14) deleted
- [x] `lib/services/` — `AuthService`, `SessionService`,
      `ActiveSessionService`, `PermissionService`, `ScopeService`,
      `SecurityEventService`, `SecuritySettingsService`,
      `FailedLoginService`, `RateLimitService`, `RefreshTokenService`,
      `RetentionService`, `WorkflowPermissionService` deleted
- [x] `mssql` and `@types/mssql` removed from `package.json`
- [x] Database credentials removed from frontend environment config (`.env`)
- [x] `getCurrentSession.ts` and `app/actions/auth.ts` updated to in-memory `jose` (`jwtVerify`)

Gate verified: `grep -r "mssql" app/ lib/ components/` returns 0 matches. Production build and live tests passed with 100% success.

---

## After Migration

Next domain work, in dependency order:

1. **Organization structure** — Organization → BU → Department → Section
2. **User administration** — the reference module for all others
3. **Visibility engine** — required *before* Candidate work (blind review)
4. **Budget** — append-only ledger, reserve / lock / consume / release
5. **Requisition + positions** — multi-seat model, 14-stage workflow
6. **Vendor** — contracts, 5 rate templates, 2-level grading
7. **Candidate lifecycle** — submission, blind review, interviews, bypass
8. **Onboarding & lifecycle** — joining, replacement, renewal, termination
9. **Annual leave tracking** — UAE labour law, paid/unpaid, half-day,
   withdrawal, entitlement deduction, line-manager approval
10. **Reporting** — 18+ formats, Excel export

---

## Open Questions for DIEZ

- **Hosting.** RFP says "fully cloud-hosted, adhering to UAE regulations."
  The Cybersecurity document says on-premise, exclusively within client
  infrastructure. Client-managed hosting reconciles these only if it means
  the client's own cloud tenancy. This determines WAF ownership, backup
  schedule, and the RPO/RTO already committed in section 13.
- **"FTEMS"** appears in RFP v1.3 Step 4 where vendors enter candidate cost.
  Confirm this means OMS and is leftover text from another system.
- **Leave entitlement source.** Annual leave is in the RFP but absent from
  the ERD, UI routes, and domain roadmap. Confirm entitlement rules and
  whether balances are seeded, calculated from joining date, or imported.
