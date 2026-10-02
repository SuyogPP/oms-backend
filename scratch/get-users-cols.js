const sql = require('mssql');
const config = {
    user: 'unisuser',
    password: 'Secure@231',
    server: 'diez-oms.database.windows.net',
    database: 'DIEZ-BUILD-DB',
    options: { encrypt: true, trustServerCertificate: false }
};
async function run() {
    let pool = await sql.connect(config);
    let result = await pool.request().query(`
        SELECT c.name as col_name 
        FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'tbl_Users'
    `);
    console.log(result.recordset);
    process.exit(0);
}
run();
