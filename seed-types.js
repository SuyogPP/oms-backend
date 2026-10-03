const { DataSource } = require('typeorm');
require('dotenv').config();

const dataSource = new DataSource({
  type: 'mssql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true,
  },
});

async function run() {
  await dataSource.initialize();
  
  // Seed Org Unit Types with UUIDs
  // Organization (Level 1)
  const orgId = '11111111-1111-1111-1111-111111111111';
  // Business Unit (Level 2)
  const buId = '22222222-2222-2222-2222-222222222222';
  // Department (Level 3)
  const deptId = '33333333-3333-3333-3333-333333333333';

  await dataSource.query(`
    INSERT INTO [masters].[tbl_Org_Unit_Types] 
    (unit_type_id, parent_unit_type_id, org_unit_code, org_unit_name, level, allows_budget, allows_requisition, is_active)
    VALUES 
    ('${orgId}', NULL, 'ORGANIZATION', 'Organization', 1, 0, 0, 1),
    ('${buId}', '${orgId}', 'BUSINESS_UNIT', 'Business Unit', 2, 0, 0, 1),
    ('${deptId}', '${buId}', 'DEPARTMENT', 'Department', 3, 1, 1, 1)
  `);

  console.log("Types seeded!");
  await dataSource.destroy();
}
run().catch(console.error);
