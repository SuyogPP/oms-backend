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
    
    // Check what scope-related tables exist in auth
    let result = await pool.request().query(`
        SELECT s.name as schema_name, t.name as table_name
        FROM sys.tables t
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE s.name = 'auth'
        ORDER BY t.name
    `);
    console.log("All auth tables:", result.recordset.map(r => r.table_name));

    // Check tbl_User_Roles columns
    let urCols = await pool.request().query(`
        SELECT c.name FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'tbl_User_Roles'
    `);
    console.log("tbl_User_Roles cols:", urCols.recordset.map(r => r.name));

    // Check tbl_User_Org_Unit_Assignment columns  
    let uoaCols = await pool.request().query(`
        SELECT c.name FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'tbl_User_Org_Unit_Assignment'
    `);
    console.log("tbl_User_Org_Unit_Assignment cols:", uoaCols.recordset.map(r => r.name));

    // tbl_Login_Sessions cols
    let lsCols = await pool.request().query(`
        SELECT c.name FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'tbl_Login_Sessions'
    `);
    console.log("tbl_Login_Sessions cols:", lsCols.recordset.map(r => r.name));

    // tbl_Failed_Login_Attempts cols
    let flaCols = await pool.request().query(`
        SELECT c.name FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'tbl_Failed_Login_Attempts'
    `);
    console.log("tbl_Failed_Login_Attempts cols:", flaCols.recordset.map(r => r.name));

    // tbl_Login_History cols
    let lhCols = await pool.request().query(`
        SELECT c.name FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'tbl_Login_History'
    `);
    console.log("tbl_Login_History cols:", lhCols.recordset.map(r => r.name));

    // tbl_Logout_History cols
    let logCols = await pool.request().query(`
        SELECT c.name FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'tbl_Logout_History'
    `);
    console.log("tbl_Logout_History cols:", logCols.recordset.map(r => r.name));

    // tbl_Local_Credentials cols
    let lcCols = await pool.request().query(`
        SELECT c.name FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        WHERE t.name = 'tbl_Local_Credentials'
    `);
    console.log("tbl_Local_Credentials cols:", lcCols.recordset.map(r => r.name));

    process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
