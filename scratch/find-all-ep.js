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
        
        let epResult = await pool.request().query(`
            SELECT TOP 50
                s.name as schema_name, 
                t.name as table_name,
                c.name as column_name,
                ep.name as ep_name,
                CAST(ep.value AS NVARCHAR(MAX)) as ep_value
            FROM sys.extended_properties ep
            LEFT JOIN sys.tables t ON ep.major_id = t.object_id
            LEFT JOIN sys.schemas s ON t.schema_id = s.schema_id
            LEFT JOIN sys.columns c ON ep.major_id = c.object_id AND ep.minor_id = c.column_id
            WHERE s.name IN ('auth', 'masters')
        `);
        console.log("All EPs:", epResult.recordset);

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
run();
