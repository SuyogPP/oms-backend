/**
 * ============================================================================
 * !!!!!!!!!!!!!!!!!!!!!!!!!!!!!! WARNING !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
 * ============================================================================
 * THIS SCRIPT CONTAINS HARDCODED DEMO CREDENTIALS ("Demo@2026!") INTENDED
 * EXCLUSIVELY FOR LOCAL DEMONSTRATION AND TESTING PURPOSES.
 *
 * NEVER REUSE THIS PATTERN, PASSWORD, OR SEED SCRIPT IN A PRODUCTION
 * ENVIRONMENT OR ACCESSIBLE STAGING ENVIRONMENT.
 *
 * In production:
 * 1. Passwords must never be shared or hardcoded across accounts.
 * 2. User onboarding must proceed via the cryptographically secure invitation
 *    token flow specified in DOMAIN-3-USER-ADMINISTRATION.md.
 * 3. MustChangePassword must default to true on invitation acceptance.
 * 4. Password complexity, salt rounds, and individual credential lifecycles
 *    must adhere to enterprise security policy.
 * ============================================================================
 *
 * Specification: docs/PORTAL-SEPARATION-AND-USERS.md Parts 3 and 4
 *
 * Requirements:
 * 1. Same hashing: bcrypt (12 salt rounds), identical to UserCredentialsService.
 * 2. Idempotent: safe to run multiple times without duplicating or failing.
 * 3. Foreign key insert order: Users -> UserProfiles -> LocalCredentials -> UserRoles -> UserOrganizationScopes.
 * 4. 16 demo users from Part 3.1 with password Demo@2026!, MustChangePassword = false, IsActive = true.
 * 5. Layla Hassan: UserType = VENDOR, NO auth.UserOrganizationScopes row (Domain 3 Rule V4).
 * 6. Internal users: exactly one auth.UserOrganizationScopes row matching their org scope.
 * 7. Role assignments: auth.UserRoles with EffectiveFrom = today, EffectiveTo = null, IsActive = true.
 * 8. Strict dependency check: if any role or org unit is missing from the database, STOP and report
 *    exactly what's missing rather than silently skipping that user.
 *    (Use --allow-partial to seed only users whose prerequisites are met).
 *    Do NOT touch org.OrgUnits, auth.Roles, or auth.Permissions structurally in this script.
 * 9. Loud demo-only header block.
 * 10. Print credential table: Username | Email | Role | Password.
 */

import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as sql from 'mssql';

// Load environment variables from oms-backend root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DEMO_PASSWORD = 'Demo@2026!';
const BCRYPT_SALT_ROUNDS = 12;

interface DemoUserDefinition {
  name: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  roleCode: string;
  displayRole: string;
  userType: 'INTERNAL' | 'VENDOR';
  scopeType: 'ORGANIZATION' | 'GLOBAL' | 'DEPARTMENT' | 'NONE';
  scopeTargetName: string; // e.g. "Digital Security", "DIEZ", "PMO"
  jobTitle: string;
}

/**
 * 16 Canonical Demo Users per docs/PORTAL-SEPARATION-AND-USERS.md Part 3.1
 */
const DEMO_USERS: DemoUserDefinition[] = [
  {
    name: 'Mariam Al Mansoori',
    firstName: 'Mariam',
    lastName: 'Al Mansoori',
    username: 'mariam.almansoori',
    email: 'mariam.almansoori@diez.ae',
    roleCode: 'REQUESTOR',
    displayRole: 'Requestor',
    userType: 'INTERNAL',
    scopeType: 'DEPARTMENT',
    scopeTargetName: 'Digital Security',
    jobTitle: 'Senior Information Security Officer',
  },
  {
    name: 'Ahmed Al Zaabi',
    firstName: 'Ahmed',
    lastName: 'Al Zaabi',
    username: 'ahmed.alzaabi',
    email: 'ahmed.alzaabi@diez.ae',
    roleCode: 'REQUESTOR',
    displayRole: 'Requestor',
    userType: 'INTERNAL',
    scopeType: 'DEPARTMENT',
    scopeTargetName: 'IT Infrastructure',
    jobTitle: 'Lead Systems Engineer',
  },
  {
    name: 'Rashid Al Falasi',
    firstName: 'Rashid',
    lastName: 'Al Falasi',
    username: 'rashid.alfalasi',
    email: 'rashid.alfalasi@diez.ae',
    roleCode: 'REQUESTOR',
    displayRole: 'Requestor',
    userType: 'INTERNAL',
    scopeType: 'DEPARTMENT',
    scopeTargetName: 'PMO',
    jobTitle: 'Senior Project Manager',
  },
  {
    name: 'Hessa Al Qassimi',
    firstName: 'Hessa',
    lastName: 'Al Qassimi',
    username: 'hessa.alqassimi',
    email: 'hessa.alqassimi@diez.ae',
    roleCode: 'REQUESTOR',
    displayRole: 'Requestor',
    userType: 'INTERNAL',
    scopeType: 'DEPARTMENT',
    scopeTargetName: 'Finance',
    jobTitle: 'Financial Analyst',
  },
  {
    name: 'Omar Al Hashmi',
    firstName: 'Omar',
    lastName: 'Al Hashmi',
    username: 'omar.alhashmi',
    email: 'omar.alhashmi@diez.ae',
    roleCode: 'LINE_MANAGER',
    displayRole: 'Line Manager',
    userType: 'INTERNAL',
    scopeType: 'DEPARTMENT',
    scopeTargetName: 'Digital Security',
    jobTitle: 'Information Security Operations Manager',
  },
  {
    name: 'Fatima Al Marri',
    firstName: 'Fatima',
    lastName: 'Al Marri',
    username: 'fatima.almarri',
    email: 'fatima.almarri@diez.ae',
    roleCode: 'SECTION_HEAD',
    displayRole: 'Section Head',
    userType: 'INTERNAL',
    scopeType: 'DEPARTMENT',
    scopeTargetName: 'Digital Security',
    jobTitle: 'Section Head - Cyber Defence',
  },
  {
    name: 'Khalid Al Suwaidi',
    firstName: 'Khalid',
    lastName: 'Al Suwaidi',
    username: 'khalid.alsuwaidi',
    email: 'khalid.alsuwaidi@diez.ae',
    roleCode: 'HOD',
    displayRole: 'HOD',
    userType: 'INTERNAL',
    scopeType: 'DEPARTMENT',
    scopeTargetName: 'Digital Security',
    jobTitle: 'Head of Digital Security Department',
  },
  {
    name: 'Youssef Al Blooshi',
    firstName: 'Youssef',
    lastName: 'Al Blooshi',
    username: 'youssef.alblooshi',
    email: 'youssef.alblooshi@diez.ae',
    roleCode: 'HOD',
    displayRole: 'HOD',
    userType: 'INTERNAL',
    scopeType: 'DEPARTMENT',
    scopeTargetName: 'PMO',
    jobTitle: 'Director of Enterprise PMO',
  },
  {
    name: 'Mona Al Shamsi',
    firstName: 'Mona',
    lastName: 'Al Shamsi',
    username: 'mona.alshamsi',
    email: 'mona.alshamsi@diez.ae',
    roleCode: 'HOD',
    displayRole: 'HOD',
    userType: 'INTERNAL',
    scopeType: 'DEPARTMENT',
    scopeTargetName: 'IT Infrastructure',
    jobTitle: 'Head of IT Infrastructure Department',
  },
  {
    name: 'Aisha Al Nuaimi',
    firstName: 'Aisha',
    lastName: 'Al Nuaimi',
    username: 'aisha.alnuaimi',
    email: 'aisha.alnuaimi@diez.ae',
    roleCode: 'HR',
    displayRole: 'HR Specialist',
    userType: 'INTERNAL',
    scopeType: 'ORGANIZATION',
    scopeTargetName: 'DIEZ',
    jobTitle: 'Senior HR Business Partner & Workforce Specialist',
  },
  {
    name: 'Rashid Al Mansoori',
    firstName: 'Rashid',
    lastName: 'Al Mansoori',
    username: 'rashid.almansoori',
    email: 'rashid.almansoori@diez.ae',
    roleCode: 'FINANCE',
    displayRole: 'Finance Manager',
    userType: 'INTERNAL',
    scopeType: 'ORGANIZATION',
    scopeTargetName: 'DIEZ',
    jobTitle: 'Finance Operations & Budget Manager',
  },
  {
    name: 'Salma Al Ketbi',
    firstName: 'Salma',
    lastName: 'Al Ketbi',
    username: 'salma.alketbi',
    email: 'salma.alketbi@diez.ae',
    roleCode: 'PROCUREMENT',
    displayRole: 'Procurement Officer',
    userType: 'INTERNAL',
    scopeType: 'ORGANIZATION',
    scopeTargetName: 'DIEZ',
    jobTitle: 'Senior Procurement Officer',
  },
  {
    name: 'Noura Al Mazrouei',
    firstName: 'Noura',
    lastName: 'Al Mazrouei',
    username: 'noura.almazrouei',
    email: 'noura.almazrouei@diez.ae',
    roleCode: 'MAIN_INTERVIEWER',
    displayRole: 'Main Interviewer',
    userType: 'INTERNAL',
    scopeType: 'DEPARTMENT',
    scopeTargetName: 'Digital Security',
    jobTitle: 'Lead Security Architect',
  },
  {
    name: 'Yousef Al Falasi',
    firstName: 'Yousef',
    lastName: 'Al Falasi',
    username: 'yousef.alfalasi',
    email: 'yousef.alfalasi@diez.ae',
    roleCode: 'PANEL_INTERVIEWER',
    displayRole: 'Panel Interviewer',
    userType: 'INTERNAL',
    scopeType: 'DEPARTMENT',
    scopeTargetName: 'Digital Security',
    jobTitle: 'Senior SOC Analyst',
  },
  {
    name: 'Ahmed Al Dhaheri',
    firstName: 'Ahmed',
    lastName: 'Al Dhaheri',
    username: 'ahmed.aldhaheri',
    email: 'ahmed.aldhaheri@diez.ae',
    roleCode: 'SYSTEM_ADMIN',
    displayRole: 'System Administrator',
    userType: 'INTERNAL',
    scopeType: 'GLOBAL',
    scopeTargetName: 'DIEZ',
    jobTitle: 'Enterprise Systems Administrator',
  },
  {
    name: 'Layla Hassan',
    firstName: 'Layla',
    lastName: 'Hassan',
    username: 'layla.hassan',
    email: 'layla.hassan@falcontech.ae',
    roleCode: 'VENDOR',
    displayRole: 'Vendor Coordinator',
    userType: 'VENDOR',
    scopeType: 'NONE', // Domain 3 rule V4: vendor users receive NO organizational scope row
    scopeTargetName: 'Falcon Tech Resourcing',
    jobTitle: 'Senior Account Coordinator',
  },
];

async function main() {
  const allowPartial =
    process.argv.includes('--allow-partial') ||
    process.argv.includes('--seed-available');

  const config: sql.config = {
    user: process.env.DB_USERNAME || 'unisuser',
    password: process.env.DB_PASSWORD || 'unisamho',
    server: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 1433,
    database: process.env.DB_DATABASE || 'OMS_DB_Prod',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    },
  };

  console.log('Connecting to database:', `${config.server}:${config.port}/${config.database}`);
  const pool = await sql.connect(config);

  try {
    // ------------------------------------------------------------------------
    // Step 1: Pre-flight Audit of Roles, ScopeDefinitions, and OrgUnits
    // ------------------------------------------------------------------------
    console.log('\nAuditing existing database roles, scope definitions, and org units...');

    // Query Roles
    const rolesResult = await pool.request().query(`
      SELECT RoleID, RoleCode, RoleName, IsActive 
      FROM [auth].[Roles]
    `);
    const roleMap = new Map<string, { roleId: string; roleName: string; isActive: boolean }>();
    for (const row of rolesResult.recordset) {
      roleMap.set(row.RoleCode.toUpperCase(), {
        roleId: row.RoleID,
        roleName: row.RoleName,
        isActive: row.IsActive,
      });
    }

    // Query Scope Definitions
    const scopesResult = await pool.request().query(`
      SELECT ScopeDefinitionID, ScopeCode, ScopeName 
      FROM [auth].[ScopeDefinitions]
    `);
    const scopeDefMap = new Map<string, string>();
    for (const row of scopesResult.recordset) {
      scopeDefMap.set(row.ScopeCode.toUpperCase(), row.ScopeDefinitionID);
    }

    // Query Org Units (search by code, name, and shortname)
    const orgUnitsResult = await pool.request().query(`
      SELECT OrgUnitID, Code, Name, ShortName, Depth, OrgUnitTypeId
      FROM [org].[OrgUnits]
      WHERE IsDeleted = 0
    `);
    const orgUnitMap = new Map<string, { orgUnitId: string; name: string; code: string }>();
    for (const row of orgUnitsResult.recordset) {
      if (row.Code) orgUnitMap.set(row.Code.toUpperCase(), { orgUnitId: row.OrgUnitID, name: row.Name, code: row.Code });
      if (row.Name) orgUnitMap.set(row.Name.toUpperCase(), { orgUnitId: row.OrgUnitID, name: row.Name, code: row.Code });
      if (row.ShortName) orgUnitMap.set(row.ShortName.toUpperCase(), { orgUnitId: row.OrgUnitID, name: row.Name, code: row.Code });
    }

    // Identify DIEZ Root OrgUnit
    const rootDiez =
      orgUnitMap.get('DIEZ') ||
      orgUnitMap.get('DUBAI INTEGRATED ECONOMIC ZONES') ||
      orgUnitMap.get('DUBAI INTEGRATED ECONOMIC ZONES AUTHORITY');

    // ------------------------------------------------------------------------
    // Step 2: Validate Prerequisites for Each User
    // ------------------------------------------------------------------------
    const readyUsers: { user: DemoUserDefinition; roleId: string; orgUnitId?: string; scopeDefId?: string }[] = [];
    const blockedUsers: { user: DemoUserDefinition; reasons: string[] }[] = [];
    const missingRoles = new Set<string>();
    const missingOrgUnits = new Set<string>();

    for (const user of DEMO_USERS) {
      const reasons: string[] = [];
      let roleId: string | undefined;
      let orgUnitId: string | undefined;
      let scopeDefId: string | undefined;

      // Check Role
      const role = roleMap.get(user.roleCode.toUpperCase());
      if (!role) {
        reasons.push(`Missing role '${user.roleCode}' in auth.Roles`);
        missingRoles.add(user.roleCode);
      } else if (!role.isActive) {
        reasons.push(`Role '${user.roleCode}' is inactive in auth.Roles`);
      } else {
        roleId = role.roleId;
      }

      // Check Org Scope (Vendors have NONE per Domain 3 rule V4)
      if (user.scopeType === 'NONE') {
        // No org scope required for VENDOR
      } else if (user.scopeType === 'ORGANIZATION') {
        scopeDefId = scopeDefMap.get('ORGANIZATION');
        if (!scopeDefId) {
          reasons.push(`Missing ScopeDefinition 'ORGANIZATION' in auth.ScopeDefinitions`);
        }
        if (!rootDiez) {
          reasons.push(`Missing root organization 'DIEZ' in org.OrgUnits`);
          missingOrgUnits.add('DIEZ');
        } else {
          orgUnitId = rootDiez.orgUnitId;
        }
      } else if (user.scopeType === 'GLOBAL') {
        scopeDefId = scopeDefMap.get('GLOBAL');
        if (!scopeDefId) {
          reasons.push(`Missing ScopeDefinition 'GLOBAL' in auth.ScopeDefinitions`);
        }
        if (!rootDiez) {
          reasons.push(`Missing root organization 'DIEZ' in org.OrgUnits`);
          missingOrgUnits.add('DIEZ');
        } else {
          orgUnitId = rootDiez.orgUnitId;
        }
      } else if (user.scopeType === 'DEPARTMENT') {
        scopeDefId = scopeDefMap.get('DEPARTMENT');
        if (!scopeDefId) {
          reasons.push(`Missing ScopeDefinition 'DEPARTMENT' in auth.ScopeDefinitions`);
        }

        const dept =
          orgUnitMap.get(user.scopeTargetName.toUpperCase()) ||
          (user.scopeTargetName === 'PMO' ? orgUnitMap.get('PROJECT MANAGEMENT OFFICE') : undefined) ||
          (user.scopeTargetName === 'Finance' ? orgUnitMap.get('FINANCE DEPARTMENT') : undefined);

        if (!dept) {
          reasons.push(`Missing department '${user.scopeTargetName}' in org.OrgUnits`);
          missingOrgUnits.add(user.scopeTargetName);
        } else {
          orgUnitId = dept.orgUnitId;
        }
      }

      if (reasons.length > 0) {
        blockedUsers.push({ user, reasons });
      } else {
        readyUsers.push({ user, roleId: roleId!, orgUnitId, scopeDefId });
      }
    }

    // ------------------------------------------------------------------------
    // Step 3: Handle Missing Dependencies (Requirement 8)
    // ------------------------------------------------------------------------
    if (blockedUsers.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('PREREQUISITE CHECK REPORT: MISSING ROLES OR ORG UNITS IN DATABASE');
      console.log('='.repeat(80));
      console.log('Per Requirement 8: If any role or org unit is missing from the database,');
      console.log('this script stops and reports exactly what is missing rather than silently');
      console.log('skipping those users.');
      console.log('Per specification: Do not touch org.OrgUnits, auth.Roles, or auth.Permissions');
      console.log('structurally in this script.');
      console.log('-'.repeat(80));

      if (missingRoles.size > 0) {
        console.log('Missing Roles in [auth].[Roles]:');
        for (const r of missingRoles) {
          console.log(`  • ${r}`);
        }
      }

      if (missingOrgUnits.size > 0) {
        console.log('\nMissing Departments / Units in [org].[OrgUnits]:');
        for (const o of missingOrgUnits) {
          console.log(`  • ${o}`);
        }
      }

      console.log(`\nBlocked Users (${blockedUsers.length} of ${DEMO_USERS.length}):`);
      for (const b of blockedUsers) {
        console.log(`  ✗ ${b.user.name} (${b.user.email}) [${b.user.displayRole}]:`);
        for (const r of b.reasons) {
          console.log(`      - ${r}`);
        }
      }

      console.log(`\nUsers with Satisfied Prerequisites (${readyUsers.length} of ${DEMO_USERS.length}):`);
      for (const r of readyUsers) {
        console.log(`  ✓ ${r.user.name} (${r.user.email}) [${r.user.displayRole}]`);
      }
      console.log('='.repeat(80));

      if (!allowPartial) {
        console.error('\n[FATAL] Stopping execution due to missing database prerequisites (Requirement 8).');
        console.error('To seed the available users whose prerequisites are satisfied, re-run with:');
        console.error('  npx ts-node db/seeds/demo-users.seed.ts --allow-partial\n');
        process.exit(1);
      } else {
        console.log('\n[INFO] Flag --allow-partial active. Proceeding to seed available users...');
      }
    }

    // ------------------------------------------------------------------------
    // Step 4: Hash Password (Requirement 1: bcrypt with 12 salt rounds)
    // ------------------------------------------------------------------------
    console.log(`\nGenerating bcrypt password hash (salt rounds = ${BCRYPT_SALT_ROUNDS})...`);
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_SALT_ROUNDS);

    // ------------------------------------------------------------------------
    // Step 5: Idempotent Seed Execution (Users -> Profiles -> Credentials -> Roles -> Scopes)
    // ------------------------------------------------------------------------
    console.log(`\nSeeding ${readyUsers.length} user(s) into database...`);
    const seededCredentials: { Username: string; Email: string; Role: string; Password: string }[] = [];

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      for (const item of readyUsers) {
        const u = item.user;
        const roleId = item.roleId;
        const orgUnitId = item.orgUnitId;
        const scopeDefId = item.scopeDefId;

        // 1. auth.Users (Idempotent: check Username before insert, update on rerun)
        let userId: string;
        const existingUserReq = new sql.Request(transaction);
        existingUserReq.input('username', sql.NVarChar, u.username);
        const existingUserResult = await existingUserReq.query(`
          SELECT UserID FROM [auth].[Users] WHERE LOWER(Username) = LOWER(@username)
        `);

        if (existingUserResult.recordset.length > 0) {
          userId = existingUserResult.recordset[0].UserID;
          const updateUserReq = new sql.Request(transaction);
          updateUserReq.input('userId', sql.UniqueIdentifier, userId);
          updateUserReq.input('email', sql.NVarChar, u.email);
          updateUserReq.input('userType', sql.NVarChar, u.userType);
          await updateUserReq.query(`
            UPDATE [auth].[Users]
            SET Email = @email,
                UserType = @userType,
                IsActive = 1,
                IsDeleted = 0,
                FailedLoginCount = 0,
                LockedUntil = NULL,
                UpdatedAt = SYSUTCDATETIME()
            WHERE UserID = @userId
          `);
        } else {
          const insertUserReq = new sql.Request(transaction);
          insertUserReq.input('username', sql.NVarChar, u.username);
          insertUserReq.input('email', sql.NVarChar, u.email);
          insertUserReq.input('userType', sql.NVarChar, u.userType);
          const insertUserResult = await insertUserReq.query(`
            INSERT INTO [auth].[Users] (
                UserID,
                Username,
                Email,
                UserType,
                IsActive,
                IsDeleted,
                FailedLoginCount,
                CreatedAt,
                UpdatedAt
            )
            OUTPUT INSERTED.UserID AS userId
            VALUES (
                NEWID(),
                @username,
                @email,
                @userType,
                1,
                0,
                0,
                SYSUTCDATETIME(),
                SYSUTCDATETIME()
            )
          `);
          userId = insertUserResult.recordset[0].userId;
        }

        // 2. auth.UserProfiles (Idempotent: update or insert)
        const profileReq = new sql.Request(transaction);
        profileReq.input('userId', sql.UniqueIdentifier, userId);
        profileReq.input('firstName', sql.NVarChar, u.firstName);
        profileReq.input('lastName', sql.NVarChar, u.lastName);
        profileReq.input('jobTitle', sql.NVarChar, u.jobTitle);
        profileReq.input('deptId', sql.UniqueIdentifier, orgUnitId || null);
        await profileReq.query(`
          IF EXISTS (SELECT 1 FROM [auth].[UserProfiles] WHERE UserID = @userId)
          BEGIN
              UPDATE [auth].[UserProfiles]
              SET FirstName = @firstName,
                  LastName = @lastName,
                  JobTitle = @jobTitle,
                  DepartmentID = @deptId,
                  UpdatedAt = SYSUTCDATETIME()
              WHERE UserID = @userId;
          END
          ELSE
          BEGIN
              INSERT INTO [auth].[UserProfiles] (
                  UserProfileID,
                  UserID,
                  FirstName,
                  LastName,
                  JobTitle,
                  DepartmentID,
                  CreatedAt,
                  UpdatedAt
              )
              VALUES (
                  NEWID(),
                  @userId,
                  @firstName,
                  @lastName,
                  @jobTitle,
                  @deptId,
                  SYSUTCDATETIME(),
                  SYSUTCDATETIME()
              );
          END
        `);

        // 3. auth.LocalCredentials (Idempotent: update password hash, MustChangePassword = false, IsActive = true)
        const credReq = new sql.Request(transaction);
        credReq.input('userId', sql.UniqueIdentifier, userId);
        credReq.input('passwordHash', sql.NVarChar, passwordHash);
        await credReq.query(`
          IF EXISTS (SELECT 1 FROM [auth].[LocalCredentials] WHERE UserID = @userId)
          BEGIN
              UPDATE [auth].[LocalCredentials]
              SET PasswordHash = @passwordHash,
                  PasswordChangedAt = SYSUTCDATETIME(),
                  MustChangePassword = 0,
                  IsActive = 1
              WHERE UserID = @userId;
          END
          ELSE
          BEGIN
              INSERT INTO [auth].[LocalCredentials] (
                  CredentialID,
                  UserID,
                  PasswordHash,
                  PasswordChangedAt,
                  MustChangePassword,
                  IsActive,
                  CreatedAt
              )
              VALUES (
                  NEWID(),
                  @userId,
                  @passwordHash,
                  SYSUTCDATETIME(),
                  0,
                  1,
                  SYSUTCDATETIME()
              );
          END
        `);

        // 4. auth.UserRoles (Idempotent: EffectiveFrom = today, EffectiveTo = null, IsActive = true)
        const roleAssignReq = new sql.Request(transaction);
        roleAssignReq.input('userId', sql.UniqueIdentifier, userId);
        roleAssignReq.input('roleId', sql.UniqueIdentifier, roleId);
        await roleAssignReq.query(`
          IF EXISTS (SELECT 1 FROM [auth].[UserRoles] WHERE UserID = @userId AND RoleID = @roleId)
          BEGIN
              UPDATE [auth].[UserRoles]
              SET EffectiveFrom = CAST(GETUTCDATE() AS DATE),
                  EffectiveTo = NULL,
                  IsActive = 1
              WHERE UserID = @userId AND RoleID = @roleId;
          END
          ELSE
          BEGIN
              INSERT INTO [auth].[UserRoles] (
                  UserRoleID,
                  UserID,
                  RoleID,
                  EffectiveFrom,
                  EffectiveTo,
                  IsActive,
                  AssignedAt
              )
              VALUES (
                  NEWID(),
                  @userId,
                  @roleId,
                  CAST(GETUTCDATE() AS DATE),
                  NULL,
                  1,
                  SYSUTCDATETIME()
              );
          END
        `);

        // 5. auth.UserOrganizationScopes (Requirement 5 & 6)
        if (u.userType === 'VENDOR' || u.scopeType === 'NONE') {
          // Requirement 5: Layla Hassan gets NO auth.UserOrganizationScopes row
          const delScopeReq = new sql.Request(transaction);
          delScopeReq.input('userId', sql.UniqueIdentifier, userId);
          await delScopeReq.query(`
            DELETE FROM [auth].[UserOrganizationScopes] WHERE UserID = @userId
          `);
        } else if (scopeDefId && orgUnitId) {
          // Requirement 6: Exactly one auth.UserOrganizationScopes row
          const scopeReq = new sql.Request(transaction);
          scopeReq.input('userId', sql.UniqueIdentifier, userId);
          scopeReq.input('scopeDefId', sql.UniqueIdentifier, scopeDefId);
          scopeReq.input('orgUnitId', sql.UniqueIdentifier, orgUnitId);

          const isOrgLevel = u.scopeType === 'ORGANIZATION' || u.scopeType === 'GLOBAL';
          scopeReq.input('organizationId', sql.UniqueIdentifier, isOrgLevel ? orgUnitId : null);
          scopeReq.input('departmentId', sql.UniqueIdentifier, !isOrgLevel ? orgUnitId : null);

          await scopeReq.query(`
            IF EXISTS (SELECT 1 FROM [auth].[UserOrganizationScopes] WHERE UserID = @userId)
            BEGIN
                UPDATE [auth].[UserOrganizationScopes]
                SET ScopeDefinitionID = @scopeDefId,
                    OrganizationID = @organizationId,
                    BusinessUnitID = NULL,
                    DepartmentID = @departmentId,
                    SectionID = NULL,
                    OrgUnitId = @orgUnitId,
                    EffectiveFrom = CAST(GETUTCDATE() AS DATE),
                    EffectiveTo = NULL,
                    IsActive = 1,
                    AssignedAt = SYSUTCDATETIME()
                WHERE UserID = @userId;
            END
            ELSE
            BEGIN
                INSERT INTO [auth].[UserOrganizationScopes] (
                    UserOrganizationScopeID,
                    UserID,
                    ScopeDefinitionID,
                    OrganizationID,
                    BusinessUnitID,
                    DepartmentID,
                    SectionID,
                    OrgUnitId,
                    EffectiveFrom,
                    EffectiveTo,
                    IsActive,
                    AssignedAt
                )
                VALUES (
                    NEWID(),
                    @userId,
                    @scopeDefId,
                    @organizationId,
                    NULL,
                    @departmentId,
                    NULL,
                    @orgUnitId,
                    CAST(GETUTCDATE() AS DATE),
                    NULL,
                    1,
                    SYSUTCDATETIME()
                );
            END
          `);
        }

        seededCredentials.push({
          Username: u.username,
          Email: u.email,
          Role: u.displayRole,
          Password: DEMO_PASSWORD,
        });
      }

      await transaction.commit();
      console.log('Transaction committed successfully.');
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }

    // ------------------------------------------------------------------------
    // Step 6: Console Output (Requirement 10: Credential Sheet Table)
    // ------------------------------------------------------------------------
    console.log('\n' + '='.repeat(80));
    console.log('DEMO CREDENTIAL SHEET (DD9 DEMO REFERENCE)');
    console.log('='.repeat(80));
    console.table(seededCredentials);
    console.log('='.repeat(80));
    console.log(`Successfully processed ${seededCredentials.length} user(s).`);
    console.log('Password for all accounts: Demo@2026!');
    console.log('MustChangePassword: false | IsActive: true');
    console.log('='.repeat(80) + '\n');
  } catch (error) {
    console.error('Error during demo users seed execution:', error);
    process.exit(1);
  } finally {
    await pool.close();
  }
}

main();
