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
            SELECT 
                (SELECT COUNT(*) FROM auth.tbl_Local_Credentials) AS LocalCredentialsRows,
                (SELECT COUNT(*) FROM auth.tbl_Users WHERE password_hash IS NOT NULL) AS UsersWithPasswordHash,
                (SELECT COUNT(*) FROM auth.tbl_Users) AS TotalUsers
        `);
        console.log(JSON.stringify(result.recordset[0], null, 2));
    } catch(err) {
        // Try old table names if the tbl_ ones don't exist
        try {
            let pool2 = await sql.connect(config);
            let result2 = await pool2.request().query(`
                SELECT 
                    (SELECT COUNT(*) FROM auth.LocalCredentials) AS LocalCredentialsRows,
                    (SELECT COUNT(*) FROM auth.Users WHERE PasswordHash IS NOT NULL) AS UsersWithPasswordHash,
                    (SELECT COUNT(*) FROM auth.Users) AS TotalUsers
            `);
            console.log(JSON.stringify(result2.recordset[0], null, 2));
        } catch(err2) {
            console.error('Both failed:', err.message, err2.message);
        }
    }
    process.exit(0);
}
run();
