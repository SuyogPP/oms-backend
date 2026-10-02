const sql = require('mssql');
const config = {
    user: 'unisuser',
    password: 'Secure@231',
    server: 'diez-oms.database.windows.net',
    database: 'DIEZ-BUILD-DB',
    options: { encrypt: true, trustServerCertificate: false }
};

async function run() {
    try {
        let pool = await sql.connect(config);
        
        let result = await pool.request().query(`
            SELECT s.name as schema_name, t.name as table_name
            FROM sys.tables t
            JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE t.name LIKE '%OMS%' OR t.name LIKE '%Rename%'
        `);
        console.log("OMS Tables:", result.recordset);

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
run();
