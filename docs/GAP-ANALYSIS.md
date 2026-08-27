# OMS — Gap Analysis

State of the build after Domains 1–3, the Next.js → NestJS migration, and the
UI work.

**Caveat:** this is derived from specs and status documents, not from reading
the codebase. Run §7 first to establish what's actually true.

---

## Part 1 — Blocking the next domain

### 1.1 The org path snapshot decision 🔴

Domain 2 spec §11.3, raised three times, still open.

> When a department is reorganised, should last year's budget-versus-cost
> report reflect the old structure or the new one?

Finance almost always wants point-in-time, which means budget lines need an
`OrgUnitPathSnapshot` column **from the first row written**. Retrofitting it
after budget data exists means reconstructing history that no longer exists.

**Budget cannot start until this is answered.** This is the single most
time-critical item in this document.

### 1.2 No email or notification service 🔴

Domain 3 ships invitations, password resets, and lockout notices. All of them
send email. **No notification service has been specced or built.**

If Domain 3's invitation flow is complete, either it's calling something
undocumented, or it isn't actually working end to end.

Beyond Domain 3, the RFP requires:

- Configurable notification templates, not hardcoded strings
- SLA reminders at configurable intervals (1 / 3 / 7 days)
- Approval pending, clarification requested, auto-closure warnings
- Interview scheduling invitations with calendar attachments
- Document expiry reminders
- Bilingual templates, if §2.8 of the process analysis is confirmed

`auth.NotificationTemplates` appears in the older RBAC document's table list.
Whether it survived into the 28-table schema needs checking.

**Every remaining domain depends on this.** It should be built before Budget,
not after.

### 1.3 No file storage service 🔴

The architecture calls for S3 or Azure Blob for CVs and compliance documents.
Nothing has been built.

This blocks Vendor, Candidate, and Onboarding entirely. The cybersecurity
document also commits to controls that need designing in, not bolting on:

- Format restriction to PDF, DOCX, XLSX, PNG, JPG
- **Server-side malware scanning** — an external dependency someone has to
  procure
- Renaming on ingestion to prevent traversal
- Storage outside the web root
- Size limits
- Encryption at rest

Malware scanning in particular has procurement lead time. Raise it now.

### 1.4 No background job runner

The System Hygiene Daemon is a contractual commitment:

- 60-day draft deletion
- 30-day auto-closure with fund release
- Configurable approval reminders

Migration Step 5 moved the retention job into NestJS scheduling, so *something*
exists. Whether it's a general job framework or a single cron is the question.

---

## Part 2 — Contractual, not yet built

Committed in the RFP or the cybersecurity document. All need to exist before
UAT.

| # | Commitment | Source | Status |
| :--- | :--- | :--- | :--- |
| C1 | **MFA for administrative roles** — stated as mandatory | Cybersecurity §6 | Not built |
| C2 | **Single Sign-On / Azure AD** | RFP System Requirements | Not built |
| C3 | **Anti-forgery tokens on all state-changing operations** | Cybersecurity §9 | Verify — `SameSite=Strict` alone doesn't satisfy the wording |
| C4 | **8-tier rate limiting** with a central `RATE_LIMITS` provider | Cybersecurity §11 | Was in Step 0 — verify all eight tiers exist |
| C5 | **SIEM log forwarding** | Cybersecurity §10 | Not built |
| C6 | **Admin full data export for backup** | RFP System Requirements | Not built |
| C7 | **18+ report formats with Excel export** | RFP | Planned, Domain 11 |
| C8 | **Penetration testing before deployment** (ZAP, Burp) | Proposal §9 | Not started |
| C9 | **TDE on SQL Server** | Cybersecurity §8 | Infrastructure — confirm with client |
| C10 | **Encrypted backups, 30–90 day retention** | Cybersecurity §13 | Infrastructure — client-owned |

**C1 and C2 are the notable ones.** MFA is described as mandatory for admin
roles, and SSO is a stated system requirement. Both are authentication work —
they belong with Domain 1, and Domain 1 is nominally complete.

---

## Part 3 — Cross-cutting infrastructure

`backend-status.md` listed these as "pending before the first business module".
Step 0 covered most. Verify each actually landed:

- [ ] API versioning (`/api/v1`)
- [ ] Standard response envelope, including through the exception filter
- [ ] Pagination, sorting, filtering framework
- [ ] Correlation ID middleware
- [ ] Request context service
- [ ] Audit logging interceptor
- [ ] Security event logging
- [ ] Rate limiting — all 8 tiers
- [ ] Role Guard, Scope Guard, Workflow Guard, Delegation Guard, Feature Flag
      Guard

That last line matters. `backend-status.md` promised the architecture was ready
for Scope and Workflow guards with no controller changes. Domain 2 and 3
implement scope filtering **inside services**. If there's no Scope Guard,
scope enforcement is per-endpoint discipline rather than a framework
guarantee — and the first endpoint someone forgets is a data leak.

**Worth deciding now:** is scope a guard or a service-layer responsibility?
Both work. Mixing them doesn't.

---

## Part 4 — Open decisions

| # | Decision | Blocks | Raised |
| :--- | :--- | :--- | :--- |
| D1 | Org path snapshot — point-in-time vs current-state | **Budget** | 3× |
| D2 | Delegation scoping (G6) — all-or-nothing or per-permission | Domain 3 sign-off | 2× |
| D3 | Full Arabic UI or Arabic data fields only | Everything | 1× |
| D4 | Resource self-service portal in scope | Domain 3 addendum | 1× |
| D5 | Panel evaluation or single evaluator | Candidate | 1× |
| D6 | Expired documents — consequence or report only | Onboarding | 1× |
| D7 | Who operates the reconciliation exception queue | Integration Ops | 1× |
| D8 | Hosting — client cloud tenancy vs on-premise | DR, backup, WAF ownership | 2× |

D1, D2, and D3 have all been raised more than once without resolution. Worth
putting them in a single note to DIEZ with a response deadline, rather than
raising them individually again.

---

## Part 5 — Quality and process

### 5.1 Not mentioned anywhere

- **CI/CD.** No pipeline referenced in any document. Manual deploys into a
  government environment are a risk of their own.
- **Environments.** No mention of dev / UAT / production separation.
- **E2E tests.** Unit and integration tests are specced. Nothing covers a full
  user journey.
- **Dependency scanning.** Committed in cybersecurity §14 and §15.
- **Static analysis.** Committed in cybersecurity §15.
- **Database migration tooling.** DDL is being run manually. That works for
  three domains and stops working across three environments.

### 5.2 Documentation drift

- Is `OMS-RBAC-Architecture.md` (24 tables) retired? It contradicts
  `readme.md` (28 tables). A wrong schema document is worse than none.
- Was `readme.md` updated with the five `org.*` tables (Domain 2 E1)?
- Was it updated with `auth.PasswordHistory` and `auth.UserInvitations`
  (Domain 3 G3)?
- Do `backend-status.md` and `frontend-status.md` reflect Domains 2 and 3?

If `readme.md` is stale, every future spec written against it inherits the
error.

### 5.3 The `FTEMS` reference

RFP v1.3 Step 4 says vendors enter cost "into the FTEMS system". Never
clarified. Probably leftover text from another system, but it's in a signed
document.

---

## Part 6 — Schedule

The proposal scoped **10 weeks**, dated 18 May 2026, with 5 weeks of
development. It's now late August.

Delivered: Domain 1, the migration, Domain 2, Domain 3 — plus substantial UI
work.

Remaining: Visibility, Budget, Requisition, Vendor, Candidate, Onboarding,
Engagement Consumption, Reporting, plus §1 infrastructure, §2 contractual
items, four external integrations, and two weeks of testing.

**That is the large majority of the system.** The three domains completed are
foundational — they carry no user-visible business value on their own.

I've raised this once before. It's worth a deliberate conversation with DIEZ
about a revised plan rather than letting the original date pass silently. The
work done is good; the schedule was optimistic from the start.

---

## Part 7 — Verification prompt

Run this in `oms-backend` before acting on anything above.

```
Read docs/GAP-ANALYSIS.md, then CLAUDE.md.

Audit the codebase and report only — write no code. For each item, give
concrete evidence: file paths, class names, table names, or "not found".

INFRASTRUCTURE (Part 3)
1. Is there API versioning? Show a controller route.
2. Is there a standard response envelope? Does it apply through the global
   exception filter, or only on success?
3. Pagination, sorting, filtering framework — where, and which endpoints use it?
4. Correlation ID middleware and request context service — present?
5. Audit logging interceptor — present? Which mutations actually write audit
   rows?
6. Rate limiting — is it implemented, and are all 8 tiers from the
   Cybersecurity doc §11 present? List the configured limits.
7. Do Role Guard, Scope Guard, Workflow Guard, Delegation Guard, or Feature
   Flag Guard exist? If scope filtering happens only in services, list every
   endpoint that returns org-scoped data and confirm each applies the filter.

SERVICES (Part 1)
8. Is there ANY email or notification service? How does Domain 3 send
   invitations today? Trace the actual code path.
9. Does auth.NotificationTemplates exist in the database?
10. Is there any file storage service or S3/Blob integration?
11. Is there a background job framework, or only the single retention cron?

AUTHENTICATION (Part 2)
12. Is MFA implemented in any form?
13. Is there any Azure AD or SSO integration or scaffolding?
14. Are anti-forgery/CSRF tokens implemented on state-changing operations, or
    is the protection only SameSite=Strict cookies?
15. Is there SIEM log forwarding?

DOCUMENTATION (Part 5.2)
16. Does OMS-RBAC-Architecture.md still exist? Does it still claim 24 tables?
17. Does readme.md include the five org.* tables?
18. Does readme.md include auth.PasswordHistory and auth.UserInvitations?
19. Do backend-status.md and frontend-status.md reflect Domains 2 and 3?

PROCESS (Part 5.1)
20. Is there any CI/CD configuration?
21. Is there a database migration tool, or is all DDL manual?
22. Are there E2E tests?
23. Count unit and integration tests by module.

INTEGRITY
24. Run the Domain 2 §6.3 closure integrity check and paste the result.
25. Run the Domain 3 permission resolution tests and report pass/fail.

Output as a table: item | status | evidence. Then list, in priority order, what
you consider the three most serious gaps and why.
```

---

## Part 8 — Suggested order

**Before Budget:**

1. Get D1 answered — it's blocking
2. Run §7 verification
3. Build the notification service — Domain 3 may not actually work without it
4. Resolve the scope guard question (§3)

**Before Vendor:**

5. File storage service with the §1.3 controls
6. Start malware scanning procurement

**Before UAT:**

7. MFA (C1) and SSO (C2)
8. CI/CD and environment separation
9. Penetration testing (C8)

**Ongoing:**

10. Send D1–D8 to DIEZ as one note with a deadline
11. Update `readme.md` and retire `OMS-RBAC-Architecture.md`