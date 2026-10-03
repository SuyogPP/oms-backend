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

async function clear() {
  await dataSource.initialize();
  await dataSource.query(`DELETE FROM [auth].[tbl_Login_Sessions]`);
  console.log("All sessions cleared!");
  await dataSource.destroy();
}
clear().catch(console.error);
