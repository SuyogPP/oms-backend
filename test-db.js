const sql = require('mssql');
const config = {
    user: 'unisuser',
    password: 'Secure@231',
    server: 'diez-oms.database.windows.net',
    database: 'DIEZ-BUILD-DB',
    options: {
        encrypt: true,
        trustServerCertificate: false
    }
};
sql.connect(config).then(pool => {
    console.log('Connected to DIEZ-BUILD-DB successfully!');
    process.exit(0);
}).catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
});
