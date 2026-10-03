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

async function check() {
  await dataSource.initialize();
  const result = await dataSource.query(`
    SELECT check_clause
    FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
    WHERE CONSTRAINT_NAME = 'CK_tOUT_level'
  `);
  console.log("Constraint:", result);
  await dataSource.destroy();
}
check().catch(console.error);
