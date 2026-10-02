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
        
        // Let's see if there is a table in auth or masters or dbo that might contain the mapping
        let result = await pool.request().query(`
            SELECT s.name as schema_name, t.name as table_name
            FROM sys.tables t
            JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE t.name LIKE '%map%' OR t.name LIKE '%rename%' OR t.name LIKE '%log%' OR t.name LIKE '%audit%'
               OR t.name = 'MigrationHistory'
        `);
        console.log("Possible mapping tables:", result.recordset);
        
        // Could it be that the OMS_Rename_Live_Auth_Masters_RBAC script created a table to hold the old and new names?
        // Let's look for any user table created recently (in the last 10 days).
        let recentResult = await pool.request().query(`
            SELECT s.name as schema_name, t.name as table_name, t.create_date, t.modify_date
            FROM sys.tables t
            JOIN sys.schemas s ON t.schema_id = s.schema_id
            ORDER BY t.modify_date DESC
        `);
        console.log("Recently modified tables (top 5):", recentResult.recordset.slice(0, 5));

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
run();
