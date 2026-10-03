const { DataSource } = require('typeorm');
require('dotenv').config();

const dataSource = new DataSource({
  type: 'mssql',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433'),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: true,
  },
});

async function run() {
  await dataSource.initialize();
  
  // Ensure schema exists
  await dataSource.query(`
    IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'org')
    BEGIN
        EXEC('CREATE SCHEMA org AUTHORIZATION dbo;');
    END
  `);

  // Create or alter the function
  await dataSource.query(`
    CREATE OR ALTER FUNCTION org.fn_VisibleOrgUnits (@UserId UNIQUEIDENTIFIER)
    RETURNS TABLE
    AS
    RETURN
    (
        WITH OrgRoots AS (
            SELECT org_unit_id FROM [auth].[tbl_User_Org_Unit_Assignment] WHERE user_id = @UserId AND is_active = 1
            UNION
            SELECT org_unit_id FROM [auth].[tbl_User_Roles] WHERE user_id = @UserId AND IsActive = 1 AND org_unit_id IS NOT NULL
        ),
        OrgHierarchy AS (
            -- Base case: The units the user is directly assigned to
            SELECT 
                u.org_unit_id AS OrgUnitId
            FROM OrgRoots r
            INNER JOIN [masters].[tbl_Org_Unit] u ON u.org_unit_id = r.org_unit_id
            WHERE u.is_active = 1

            UNION ALL

            -- Recursive case: Children of the visible units
            SELECT 
                u.org_unit_id AS OrgUnitId
            FROM [masters].[tbl_Org_Unit] u
            INNER JOIN OrgHierarchy h ON u.parent_id = h.OrgUnitId
            WHERE u.is_active = 1
        )
        SELECT DISTINCT OrgUnitId FROM OrgHierarchy
    );
  `);
  
  console.log("Function org.fn_VisibleOrgUnits created successfully!");
  await dataSource.destroy();
}
run().catch(console.error);
