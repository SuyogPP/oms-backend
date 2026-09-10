/**
 * Demo Prerequisites Seed Script
 *
 * Seeds structural prerequisites required for the 16 demo users per
 * docs/PORTAL-SEPARATION-AND-USERS.md Parts 2, 3, and 4:
 * 1. Missing roles in auth.Roles: LINE_MANAGER, SECTION_HEAD, PANEL_INTERVIEWER
 * 2. Missing permissions in auth.Permissions: WORKFORCE.VIEW, HR_REVIEW.VIEW, REPORTS.VIEW, etc.
 * 3. Role-Permission mappings in auth.RolePermissions aligning with Part 2.2
 * 4. Missing org units in org.OrgUnits under DIEZ:
 *    - Corporate Services (BU)
 *    - Digital Security, Data Management, IT Infrastructure, Finance, HR, Procurement, PMO (Departments)
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as sql from 'mssql';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function seedPrerequisites() {
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

  console.log('Connecting to database for prerequisite seeding...');
  const pool = await sql.connect(config);

  try {
    // ------------------------------------------------------------------------
    // 1. Roles
    // ------------------------------------------------------------------------
    console.log('Ensuring roles in [auth].[Roles]...');
    const rolesToEnsure = [
      { code: 'LINE_MANAGER', name: 'Line Manager', desc: 'Line manager with operational scope' },
      { code: 'SECTION_HEAD', name: 'Section Head', desc: 'Section head with departmental scope' },
      { code: 'PANEL_INTERVIEWER', name: 'Panel Interviewer', desc: 'Technical interviewer panel member' },
    ];

    for (const r of rolesToEnsure) {
      await pool.request()
        .input('code', sql.NVarChar, r.code)
        .input('name', sql.NVarChar, r.name)
        .input('desc', sql.NVarChar, r.desc)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM [auth].[Roles] WHERE UPPER(RoleCode) = UPPER(@code))
          BEGIN
              INSERT INTO [auth].[Roles] (RoleID, RoleCode, RoleName, Description, IsSystemRole, IsActive, CreatedAt)
              VALUES (NEWID(), @code, @name, @desc, 0, 1, SYSUTCDATETIME());
          END
        `);
    }

    // ------------------------------------------------------------------------
    // 2. Permissions
    // ------------------------------------------------------------------------
    console.log('Ensuring permissions in [auth].[Permissions]...');
    const permissionsToEnsure = [
      { code: 'WORKFORCE.VIEW', module: 'Workforce', action: 'View', desc: 'View workforce and onboarding records' },
      { code: 'WORKFORCE.MANAGE', module: 'Workforce', action: 'Manage', desc: 'Manage workforce allocations' },
      { code: 'ONBOARDING.VIEW', module: 'Workforce', action: 'OnboardingView', desc: 'View candidate onboarding' },
      { code: 'HR_REVIEW.VIEW', module: 'HR', action: 'Review', desc: 'Access HR review stage' },
      { code: 'HR.REVIEW', module: 'HR', action: 'ReviewAction', desc: 'Perform HR review approvals' },
      { code: 'REPORTS.VIEW', module: 'Reports', action: 'View', desc: 'View analytics and reports' },
      { code: 'REQUEST.VIEW', module: 'Requisitions', action: 'View', desc: 'View requisition requests' },
      { code: 'REQUEST.CREATE', module: 'Requisitions', action: 'Create', desc: 'Create requisition requests' },
      { code: 'REQUEST.LIST_MINE', module: 'Requisitions', action: 'ListMine', desc: 'List own submitted requests' },
    ];

    for (const p of permissionsToEnsure) {
      await pool.request()
        .input('code', sql.NVarChar, p.code)
        .input('module', sql.NVarChar, p.module)
        .input('action', sql.NVarChar, p.action)
        .input('desc', sql.NVarChar, p.desc)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM [auth].[Permissions] WHERE UPPER(PermissionCode) = UPPER(@code))
          BEGIN
              INSERT INTO [auth].[Permissions] (PermissionID, PermissionCode, ModuleName, ActionName, Description, CreatedAt)
              VALUES (NEWID(), @code, @module, @action, @desc, SYSUTCDATETIME());
          END
        `);
    }

    // ------------------------------------------------------------------------
    // 3. Role Permissions (Aligning with Part 2.2 Navigation Spec)
    // ------------------------------------------------------------------------
    console.log('Aligning role permissions in [auth].[RolePermissions]...');
    const roleGrants: Record<string, string[]> = {
      REQUESTOR: ['REQUISITION.CREATE', 'REQUISITION.VIEW', 'REQUEST.VIEW', 'REQUEST.CREATE', 'REQUEST.LIST_MINE'],
      LINE_MANAGER: ['REQUISITION.VIEW', 'REQUEST.VIEW', 'WORKFORCE.VIEW'],
      SECTION_HEAD: ['REQUISITION.VIEW', 'REQUEST.VIEW', 'WORKFORCE.VIEW'],
      HOD: ['REQUISITION.VIEW', 'REQUEST.VIEW', 'BUDGET.VIEW', 'WORKFORCE.VIEW', 'CANDIDATE.VIEW', 'REPORTS.VIEW'],
      HR: ['REQUISITION.VIEW', 'REQUEST.VIEW', 'HR_REVIEW.VIEW', 'HR.REVIEW', 'CANDIDATE.VIEW', 'WORKFORCE.VIEW', 'REPORTS.VIEW'],
      FINANCE: ['BUDGET.VIEW', 'REQUISITION.VIEW', 'REQUEST.VIEW', 'REPORTS.VIEW'],
      PROCUREMENT: ['REQUISITION.VIEW', 'REQUEST.VIEW', 'CANDIDATE.VIEW', 'VENDOR.VIEW', 'REPORTS.VIEW'],
      MAIN_INTERVIEWER: ['REQUISITION.VIEW', 'REQUEST.VIEW', 'CANDIDATE.VIEW'],
      PANEL_INTERVIEWER: ['CANDIDATE.VIEW'],
    };

    for (const [roleCode, permCodes] of Object.entries(roleGrants)) {
      const roleRow = await pool.request()
        .input('roleCode', sql.NVarChar, roleCode)
        .query('SELECT RoleID FROM [auth].[Roles] WHERE UPPER(RoleCode) = UPPER(@roleCode)');

      if (roleRow.recordset.length === 0) continue;
      const roleId = roleRow.recordset[0].RoleID;

      for (const permCode of permCodes) {
        const permRow = await pool.request()
          .input('permCode', sql.NVarChar, permCode)
          .query('SELECT PermissionID FROM [auth].[Permissions] WHERE UPPER(PermissionCode) = UPPER(@permCode)');

        if (permRow.recordset.length === 0) continue;
        const permId = permRow.recordset[0].PermissionID;

        await pool.request()
          .input('roleId', sql.UniqueIdentifier, roleId)
          .input('permId', sql.UniqueIdentifier, permId)
          .query(`
            IF NOT EXISTS (SELECT 1 FROM [auth].[RolePermissions] WHERE RoleID = @roleId AND PermissionID = @permId)
            BEGIN
                INSERT INTO [auth].[RolePermissions] (RolePermissionID, RoleID, PermissionID, GrantedAt)
                VALUES (NEWID(), @roleId, @permId, SYSUTCDATETIME());
            END
          `);
      }
    }

    // ------------------------------------------------------------------------
    // 4. Organizational Units under DIEZ
    // ------------------------------------------------------------------------
    console.log('Ensuring organizational units in [org].[OrgUnits]...');
    const rootRow = await pool.request().query(`
      SELECT OrgUnitId, MaterializedPath FROM [org].[OrgUnits] WHERE Code = 'DIEZ' OR Depth = 0
    `);

    if (rootRow.recordset.length === 0) {
      throw new Error('Root DIEZ organization not found in org.OrgUnits');
    }
    const rootId = rootRow.recordset[0].OrgUnitId;
    const rootPath = rootRow.recordset[0].MaterializedPath;

    // Corporate Services (Business Unit)
    let corpServicesId: string;
    const corpRow = await pool.request().query(`
      SELECT OrgUnitId FROM [org].[OrgUnits] WHERE Code = 'CORP_SERVICES' OR Name = 'Corporate Services'
    `);

    if (corpRow.recordset.length > 0) {
      corpServicesId = corpRow.recordset[0].OrgUnitId;
    } else {
      const insertBu = await pool.request()
        .input('parentId', sql.UniqueIdentifier, rootId)
        .query(`
          DECLARE @NewBuId UNIQUEIDENTIFIER = NEWID();
          DECLARE @Path VARCHAR(MAX) = '${rootPath}' + REPLACE(CAST(@NewBuId AS VARCHAR(36)), '-', '') + '/';

          INSERT INTO [org].[OrgUnits] (
              OrgUnitId, OrgUnitTypeId, ParentOrgUnitId, Code, Name, ShortName,
              MaterializedPath, Depth, SortOrder, EffectiveFrom, IsActive, IsDeleted, CreatedAt
          )
          OUTPUT INSERTED.OrgUnitId
          VALUES (
              @NewBuId, 2, @parentId, 'CORP_SERVICES', 'Corporate Services', 'CS',
              @Path, 1, 1, '2026-01-01', 1, 0, SYSUTCDATETIME()
          );
        `);
      corpServicesId = insertBu.recordset[0].OrgUnitId;
      console.log('Created Corporate Services BU:', corpServicesId);
    }

    const corpPathRow = await pool.request()
      .input('corpId', sql.UniqueIdentifier, corpServicesId)
      .query('SELECT MaterializedPath FROM [org].[OrgUnits] WHERE OrgUnitId = @corpId');
    const corpPath = corpPathRow.recordset[0].MaterializedPath;

    // Departments under Corporate Services
    const deptsToEnsure = [
      { code: 'DIG_SEC', name: 'Digital Security', shortName: 'Digital Security' },
      { code: 'DATA_MGMT', name: 'Data Management', shortName: 'Data Management' },
      { code: 'IT_INFRA', name: 'IT Infrastructure', shortName: 'IT Infrastructure' },
      { code: 'FINANCE', name: 'Finance', shortName: 'Finance' },
      { code: 'HR', name: 'Human Resources', shortName: 'HR' },
      { code: 'PROCUREMENT', name: 'Procurement', shortName: 'Procurement' },
      { code: 'PMO', name: 'PMO', shortName: 'PMO', desc: 'Project Management Office' },
    ];

    for (const d of deptsToEnsure) {
      const existing = await pool.request()
        .input('code', sql.VarChar, d.code)
        .input('name', sql.NVarChar, d.name)
        .query('SELECT OrgUnitId FROM [org].[OrgUnits] WHERE Code = @code OR Name = @name');

      if (existing.recordset.length === 0) {
        await pool.request()
          .input('parentId', sql.UniqueIdentifier, corpServicesId)
          .input('code', sql.VarChar, d.code)
          .input('name', sql.NVarChar, d.name)
          .input('shortName', sql.NVarChar, d.shortName)
          .input('desc', sql.NVarChar, d.desc || null)
          .query(`
            DECLARE @NewDeptId UNIQUEIDENTIFIER = NEWID();
            DECLARE @Path VARCHAR(MAX) = '${corpPath}' + REPLACE(CAST(@NewDeptId AS VARCHAR(36)), '-', '') + '/';

            INSERT INTO [org].[OrgUnits] (
                OrgUnitId, OrgUnitTypeId, ParentOrgUnitId, Code, Name, ShortName, Description,
                MaterializedPath, Depth, SortOrder, EffectiveFrom, IsActive, IsDeleted, CreatedAt
            )
            VALUES (
                @NewDeptId, 3, @parentId, @code, @name, @shortName, @desc,
                @Path, 2, 1, '2026-01-01', 1, 0, SYSUTCDATETIME()
            );
          `);
        console.log(`Created Department '${d.name}' (${d.code})`);
      }
    }

    console.log('Prerequisite seeding completed successfully!');
  } finally {
    await pool.close();
  }
}

seedPrerequisites().catch((err) => {
  console.error('Failed to seed prerequisites:', err);
  process.exit(1);
});
