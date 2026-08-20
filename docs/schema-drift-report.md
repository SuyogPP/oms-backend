# Schema Drift Report: Auth Tables vs. readme.md

**Report Date:** 2026-08-20  
**Source:** Live SQL Server `OMS_DB_Prod`.`auth` schema  
**Reference:** `/Users/aait/Documents/Development/DIEZ-OMS/oms-tables/auth/readme.md`

---

## Executive Summary

**Overall Status:** ⚠️ **MINOR DRIFT** — 28 documented tables vs. **29 live tables**.

The `auth` schema has evolved beyond the documentation in `readme.md`. All documented tables exist and are correctly structured. The schema has **gained one undocumented table** (`SecuritySettings`) and **extended two tables with additional columns** for enhanced session tracking and device fingerprinting.

**Key Findings:**
- ✅ All 28 documented tables exist in the live database
- ✅ No documented tables are missing
- ✅ All documented columns are present
- ⚠️ +1 undocumented table: `SecuritySettings`
- ⚠️ +11 undocumented columns spread across 2 tables

---

## Detailed Findings

### 1. Extra Tables Not in readme.md

#### `SecuritySettings` (+1 undocumented table)

**Status:** ⚠️ UNDOCUMENTED  
**Purpose:** Centralized configuration storage for security policies.

**Live Schema:**
```sql
CREATE TABLE [auth].[SecuritySettings](
    [SecuritySettingID] [uniqueidentifier] NOT NULL PRIMARY KEY,
    [SettingCode] [nvarchar](200) NOT NULL UNIQUE,
    [SettingValue] [nvarchar](MAX) NOT NULL,
    [SettingType] [nvarchar](100) NOT NULL,
    [Description] [nvarchar](2000) NULL,
    [IsEditable] [bit] NOT NULL,
    [UpdatedAt] [datetime2](3) NOT NULL,
    [UpdatedBy] [uniqueidentifier] NULL
)
```

**Inference:** This table stores the security settings config UI that exists at `/app/administration/security/settings` in the frontend. It maps to the `SecuritySettingsService` and security settings update endpoints in `oms-prod-dev`.

**Recommendation:** Document this table in `readme.md` Section 8️⃣, add it to the table count claim (should be **29**, not 28), and include in the authorization architecture diagram as a configuration layer.

---

### 2. Column-Level Drift (Existing Tables Enhanced)

#### Table: `LoginSessions`

**Documented Columns (readme.md):**
```
LoginSessionID, UserID, RefreshTokenHash, IPAddress, UserAgent, 
DeviceInfo, LoginAt, ExpiresAt, RevokedAt, IsActive
```

**Live Columns (actual schema):**
```
LoginSessionID, UserID, RefreshTokenHash, IPAddress, UserAgent,
DeviceInfo, LoginAt, ExpiresAt, RevokedAt, IsActive,
RefreshTokenExpiresAt, RefreshTokenRevokedAt, BrowserName,
DeviceType, LastActivityAt, Fingerprint, DeviceFingerprint
```

**New Columns (7 additions):**
| Column | Type | Purpose |
|--------|------|---------|
| `RefreshTokenExpiresAt` | `datetime2(3)` | Separate expiry for refresh token (not just access token) |
| `RefreshTokenRevokedAt` | `datetime2(3)` | Track when refresh token was specifically revoked |
| `BrowserName` | `nvarchar(200)` | User-agent derived browser identifier |
| `DeviceType` | `nvarchar(200)` | User-agent derived device type (Desktop/Mobile/Tablet) |
| `LastActivityAt` | `datetime2(3)` | Session last-access timestamp for idle detection |
| `Fingerprint` | `nvarchar(1000)` | Browser fingerprint hash (user-agent, screen, plugins) |
| `DeviceFingerprint` | `uniqueidentifier` | Device fingerprint ID for cross-session binding |

**Analysis:** These additions support **device fingerprinting, refresh token lifecycle separation, and session activity tracking** — all mentioned in frontend `proxy.ts` middleware and the Cybersecurity architecture doc. The frontend code validates device fingerprints and tracks last-activity for idle timeouts.

**Recommendation:** Update `readme.md` `LoginSessions` section with these 7 columns. Add a note that browser/device fields derive from user-agent parsing and fingerprint fields enable device binding.

---

#### Table: `LoginHistory`

**Documented Columns (readme.md):**
```
LoginHistoryID, UserID, Username, IPAddress, UserAgent,
LoginResult, LoginAt, FailureReason
```

**Live Columns (actual schema):**
```
LoginHistoryID, UserID, Username, IPAddress, UserAgent,
LoginResult, LoginAt, FailureReason, LoginSessionID,
DeviceType, BrowserName, IsSSOLogin
```

**New Columns (4 additions):**
| Column | Type | Purpose |
|--------|------|---------|
| `LoginSessionID` | `uniqueidentifier` | Foreign key to `LoginSessions` (audit trail linkage) |
| `DeviceType` | `nvarchar(200)` | Device category at login time |
| `BrowserName` | `nvarchar(200)` | Browser name at login time |
| `IsSSOLogin` | `bit` | Flag indicating SSO/AD login vs. local credential |

**Analysis:** These columns enable **audit trail traceability** (each login history row can be joined to its session) and **SSO distinction** (important for compliance reporting — e.g., "How many logins were via AD vs. local?"). The frontend already records these fields (see `app/api/auth/login/route.ts`).

**Recommendation:** Update `readme.md` `LoginHistory` section with these 4 columns. Note the addition of `IsSSOLogin` flag and the linkage to `LoginSessions`.

---

### 3. All Documented Tables Verified ✅

All 28 tables listed in `readme.md` exist in the live database with their documented primary structures intact:

- ✅ Identity & Profiles (4/4): Users, UserProfiles, UserTypes, LocalCredentials
- ✅ RBAC (3/3): Roles, UserRoles, RoleHierarchy
- ✅ Permissions (5/5): Permissions, RolePermissions, PermissionConditions, RolePermissionConditions, UserPermissionOverrides
- ✅ Data Access (4/4): DataAccessPolicies, DataAccessRules, ScopeDefinitions, UserOrganizationScopes
- ✅ Visibility (3/3): VisibilityPolicies, VisibilityTypes, FieldVisibilityRules
- ✅ Workflow (2/2): WorkflowStates, WorkflowPermissionMatrix
- ✅ Delegation (1/1): Delegations
- ✅ Session & Security (6/6): LoginSessions, LoginHistory, FailedLoginAttempts, LogoutHistory, RateLimitEvents, SecurityEvents

**No documented columns are missing from any table.**

---

## Recommendations

### Priority 1: Update Table Count & SecuritySettings Documentation

**File:** `oms-tables/auth/readme.md` (line 78)

**Current:**
> The OMS RBAC is backed by 28 security tables in the `auth` schema.

**Change to:**
> The OMS RBAC is backed by 29 security tables in the `auth` schema.

**Add new section in "8️⃣ Session & Security Auditing" or create "9️⃣ Configuration":**

```markdown
### 9️⃣ Security Configuration
* **[`auth.SecuritySettings`](./SecuritySettings.sql)**: Centralized security policy configuration (token lifetimes, rate limits, replay detection, account lockout, retention durations). Updated via admin security settings UI.
```

---

### Priority 2: Update LoginSessions & LoginHistory Columns

**File:** `oms-tables/auth/readme.md`

**LoginSessions update (lines 568–586):** Add 7 new columns:
```sql
[RefreshTokenExpiresAt] [datetime2](3) NULL,
[RefreshTokenRevokedAt] [datetime2](3) NULL,
[BrowserName] [nvarchar](200) NULL,
[DeviceType] [nvarchar](200) NULL,
[LastActivityAt] [datetime2](3) NULL,
[Fingerprint] [nvarchar](1000) NULL,
[DeviceFingerprint] [uniqueidentifier] NULL
```

Add note:
> **Device Tracking:** `BrowserName`, `DeviceType`, `Fingerprint`, and `DeviceFingerprint` enable device binding and multi-factor auth. Derived from user-agent and device fingerprint hash.

**LoginHistory update (lines 590–605):** Add 4 new columns:
```sql
[LoginSessionID] [uniqueidentifier] NULL,
[DeviceType] [nvarchar](200) NULL,
[BrowserName] [nvarchar](200) NULL,
[IsSSOLogin] [bit] NOT NULL
```

Add note:
> **Audit Linkage:** `LoginSessionID` joins to `LoginSessions` for full session audit trail. `IsSSOLogin` distinguishes Azure AD/LDAP logins from local credentials.

---

### Priority 3: Link to Implementation

Add cross-reference in `readme.md` pointing to:
- Frontend middleware: `oms-prod-dev/proxy.ts` (device fingerprint validation)
- Frontend login: `oms-prod-dev/app/api/auth/login/route.ts` (device tracking capture)
- Backend auth controller: `oms-backend/src/modules/auth/` (where JWT includes device claims)

---

## Data Consistency Checks (Future Audits)

When next verifying schema drift, also check:

1. **Foreign key integrity:** Confirm all documented FKs are indexed and no orphaned rows exist.
2. **Index coverage:** Verify indexes on high-query columns (`UserID`, `RoleID`, `PermissionID`, `UserAgent`, `IsSSOLogin`).
3. **Temporal columns:** Ensure `EffectiveFrom`/`EffectiveTo` queries in `UserRoles` and `UserPermissionOverrides` account for NULL `EffectiveTo` (meaning "no end date").
4. **Audit columns:** Check that `CreatedBy`, `UpdatedBy`, `CreatedAt`, `UpdatedAt` are populated consistently (vs. NULL in current state).

---

## Impact on Code

**No breaking changes required.** The new columns are all `NULL`-able or `bit` defaults, so:
- Existing queries remain valid (new columns ignored)
- New code can opt-in to device tracking features
- Session management is backward-compatible

**Files that should be aware of the new columns:**
- `oms-backend/src/modules/auth/services/session.service.ts` (if it queries LoginSessions)
- `oms-prod-dev/lib/repositories/SessionRepository.ts` (if it reads LoginSessions)
- `oms-prod-dev/lib/services/SecurityEventService.ts` (if it logs device info)
- Audit/compliance reports that export `LoginHistory` should now include SSO flag

---

## Conclusion

The live schema is **evolutionarily ahead of the documentation**. The additions are sensible, backward-compatible, and aligned with the security requirements stated in the Cybersecurity document. Update `readme.md` to reflect the current state, and consider version-controlling the schema doc alongside DB migration scripts.