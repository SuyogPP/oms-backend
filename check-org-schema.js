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
  const tables = await ds.query(`
    SELECT COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'masters' AND TABLE_NAME = 'tbl_Org_Unit'
  `);
  console.log('\n=== tbl_Org_Unit schema ===');
  console.table(tables);
  await ds.destroy();
}
run().catch(console.error);
