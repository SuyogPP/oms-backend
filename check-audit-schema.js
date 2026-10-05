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
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'audit'
  `);
  console.log('\n=== audit tables ===');
  console.table(tables);
  await ds.destroy();
}
run().catch(console.error);
