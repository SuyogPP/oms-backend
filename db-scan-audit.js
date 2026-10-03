const { DataSource } = require('typeorm');
require('dotenv').config();

const dataSource = new DataSource({
  type: 'mssql',
  host: process.env.AUDIT_DB_HOST,
  port: parseInt(process.env.AUDIT_DB_PORT || '1433'),
  username: process.env.AUDIT_DB_USERNAME,
  password: process.env.AUDIT_DB_PASSWORD,
  database: process.env.AUDIT_DB_DATABASE,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
});

async function scan() {
  await dataSource.initialize();
  const result = await dataSource.query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
  `);
  
  const fs = require('fs');
  fs.writeFileSync('db-schema-audit.json', JSON.stringify(result, null, 2));
  console.log("Audit Schema scanned! Total columns:", result.length);
  await dataSource.destroy();
}
scan().catch(console.error);
