const { DataSource } = require('typeorm');
require('dotenv').config();

const ds = new DataSource({
  type: 'mssql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: true },
});

async function run() {
  await ds.initialize();
  
  // 1. What's in tbl_Org_Unit_Types?
  const types = await ds.query(`SELECT * FROM [masters].[tbl_Org_Unit_Types]`);
  console.log('\n=== tbl_Org_Unit_Types ===');
  console.table(types);
  
  // 2. What does the findAllTypes query return?
  const findAll = await ds.query(`
    SELECT unit_type_id AS unitTypeId, parent_unit_type_id AS parentUnitTypeId, 
           org_unit_code AS orgUnitCode, org_unit_name AS orgUnitName, 
           level, allows_budget AS allowsBudget, allows_requisition AS allowsRequisition, is_active AS isActive
    FROM [masters].[tbl_Org_Unit_Types]
    ORDER BY level ASC, unit_type_id ASC
  `);
  console.log('\n=== findAllTypes result ===');
  console.table(findAll);

  // 3. What's in tbl_Org_Unit? (to get the root org unit's type)
  const units = await ds.query(`SELECT top 5 org_unit_id, parent_id, unit_type_id, org_code, org_name, is_active FROM [masters].[tbl_Org_Unit]`);
  console.log('\n=== tbl_Org_Unit (first 5) ===');
  console.table(units);

  await ds.destroy();
}
run().catch(console.error);
