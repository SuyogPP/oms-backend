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
        
        // Check if renamed tables exist
        let checkResult = await pool.request().query(`
            SELECT s.name as schema_name, t.name as table_name 
            FROM sys.tables t 
            JOIN sys.schemas s ON t.schema_id = s.schema_id 
            WHERE s.name IN ('auth','masters') AND t.name LIKE 'tbl\_%' ESCAPE '\\'
        `);
        console.log("Renamed tables count:", checkResult.recordset.length);
        if (checkResult.recordset.length === 0) {
            console.log("NO_RENAMED_TABLES_FOUND");
            process.exit(0);
        }

        // Check extended properties
        let epResult = await pool.request().query(`
            SELECT 
                s.name as schema_name, 
                t.name as table_name,
                c.name as column_name,
                ep.name as ep_name,
                ep.value as ep_value
            FROM sys.extended_properties ep
            LEFT JOIN sys.tables t ON ep.major_id = t.object_id
            LEFT JOIN sys.schemas s ON t.schema_id = s.schema_id
            LEFT JOIN sys.columns c ON ep.major_id = c.object_id AND ep.minor_id = c.column_id
            WHERE ep.name IN ('OriginalTableName', 'OriginalColumnName')
        `);
        console.log("Extended properties count:", epResult.recordset.length);
        if (epResult.recordset.length > 0) {
            console.log(epResult.recordset.slice(0, 5));
        }

    } catch (err) {
        console.error(err);
    }
    process.exit(0);
}
run();
