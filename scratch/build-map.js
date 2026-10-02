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
        console.log("Connected successfully.");

        // 1. Confirm tables exist
        let checkResult = await pool.request().query(`
            SELECT s.name as schema_name, t.name as table_name, t.object_id 
            FROM sys.tables t 
            JOIN sys.schemas s ON t.schema_id = s.schema_id 
            WHERE s.name IN ('auth','masters') AND t.name LIKE 'tbl\_%' ESCAPE '\\'
        `);
        
        if (checkResult.recordset.length === 0) {
            console.log("ZERO_ROWS");
            process.exit(0);
        }
        
        console.log(`Found ${checkResult.recordset.length} renamed tables.`);

        // 2. Check Extended Properties
        let epResult = await pool.request().query(`
            SELECT 
                s.name as schema_name, 
                t.name as table_name,
                c.name as column_name,
                ep.name as ep_name,
                CAST(ep.value AS NVARCHAR(MAX)) as ep_value
            FROM sys.extended_properties ep
            LEFT JOIN sys.tables t ON ep.major_id = t.object_id
            LEFT JOIN sys.schemas s ON t.schema_id = s.schema_id
            LEFT JOIN sys.columns c ON ep.major_id = c.object_id AND ep.minor_id = c.column_id
            WHERE ep.name IN ('OriginalTableName', 'OriginalColumnName', 'OldName')
        `);
        
        if (epResult.recordset.length > 0) {
            console.log(`Found ${epResult.recordset.length} extended properties.`);
            // Output a sample
            console.log("Sample EP:");
            console.log(epResult.recordset.slice(0, 5));
        } else {
            console.log("NO_EXTENDED_PROPERTIES_FOUND. We might need to derive old names from sys.columns directly?");
            
            // Just select a sample of tables and columns to see what they look like
            let colResult = await pool.request().query(`
                SELECT TOP 10 s.name as schema_name, t.name as table_name, c.name as column_name
                FROM sys.columns c
                JOIN sys.tables t ON c.object_id = t.object_id
                JOIN sys.schemas s ON t.schema_id = s.schema_id
                WHERE s.name = 'auth' AND t.name LIKE 'tbl\_%' ESCAPE '\\'
            `);
            console.log(colResult.recordset);
        }

    } catch (err) {
        console.error("DB Error:", err.message);
    }
    process.exit(0);
}
run();
