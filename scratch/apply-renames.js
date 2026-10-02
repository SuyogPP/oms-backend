const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const config = {
    user: 'unisuser',
    password: 'Secure@231',
    server: 'diez-oms.database.windows.net',
    database: 'DIEZ-BUILD-DB',
    options: { encrypt: true, trustServerCertificate: false }
};

function toOldColumnName(col) {
    // Some columns weren't snake cased, e.g. Username
    if (!col.includes('_')) return col;
    
    // snake_case -> PascalCase
    let parts = col.split('_');
    let pascal = parts.map(p => {
        if (p === 'id') return 'ID';
        return p.charAt(0).toUpperCase() + p.slice(1);
    }).join('');
    
    // special cases if needed, but ID is standard
    return pascal;
}

function toOldTableName(tbl) {
    // tbl_Role_Permission_Conditions -> RolePermissionConditions
    let name = tbl.replace(/^tbl_/, '');
    return name.replace(/_/g, '');
}

async function run() {
    let pool;
    try {
        pool = await sql.connect(config);
    } catch (e) {
        console.error("DB Error:", e);
        process.exit(1);
    }

    let result = await pool.request().query(`
        SELECT s.name as schema_name, t.name as table_name, c.name as column_name
        FROM sys.columns c
        JOIN sys.tables t ON c.object_id = t.object_id
        JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE s.name IN ('auth', 'masters') AND t.name LIKE 'tbl\_%' ESCAPE '\\'
    `);

    // Build the map
    let tableMap = new Map(); // oldTable -> newTable
    let colMap = new Map(); // oldCol -> newCol (we might have duplicates if different tables have same col, but the rename is the same)
    
    let dbSchema = {}; // structure

    for (let row of result.recordset) {
        let oldTable = toOldTableName(row.table_name);
        tableMap.set(oldTable, row.table_name);
        
        let oldCol = toOldColumnName(row.column_name);
        // Only map if it actually changed
        if (oldCol !== row.column_name) {
            colMap.set(oldCol, row.column_name);
        }
    }

    console.log(`Found ${tableMap.size} tables and ${colMap.size} unique renamed columns.`);
    
    // We must find all files containing these old names
    // 1. Tables
    // 2. Columns
    
    // This is complex. We will save the map to a JSON file so we can inspect it.
    fs.writeFileSync('scratch/rename-map.json', JSON.stringify({
        tables: Array.from(tableMap.entries()),
        columns: Array.from(colMap.entries())
    }, null, 2));

    process.exit(0);
}
run();
