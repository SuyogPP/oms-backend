-- ============================================================================
-- Domain 2: Performance Seed Script (§12.5)
-- Target: 5,000 Organization Units at Depth 4
-- Distribution: 1 Org (d=0), 8 BUs (d=1), 120 Depts (d=2), 4,871 Sections (d=3)
-- Total Nodes: 5,000 | Total Closure Rows: 19,861
-- ============================================================================

SET NOCOUNT ON;
BEGIN TRANSACTION;

BEGIN TRY
    PRINT '>> [Step 1] Initializing Performance Dataset Generation...';

    -- 1. Locate or Create Root Organization
    DECLARE @RootOrgUnitId UNIQUEIDENTIFIER;
    DECLARE @RootPath VARCHAR(900);
    DECLARE @SystemUserId UNIQUEIDENTIFIER = '1053433E-F36B-1410-85ED-009A959FB122';

    SELECT TOP 1 
        @RootOrgUnitId = OrgUnitId,
        @RootPath = MaterializedPath
    FROM org.OrgUnits 
    WHERE ParentOrgUnitId IS NULL AND IsDeleted = 0;

    IF @RootOrgUnitId IS NULL
    BEGIN
        SET @RootOrgUnitId = NEWID();
        SET @RootPath = '/' + REPLACE(CAST(@RootOrgUnitId AS VARCHAR(36)), '-', '') + '/';

        INSERT INTO org.OrgUnits (
            OrgUnitId, OrgUnitTypeId, ParentOrgUnitId, Code, Name, NameAr, ShortName,
            MaterializedPath, Depth, IsActive, IsDeleted, CreatedBy, CreatedAt, EffectiveFrom
        ) VALUES (
            @RootOrgUnitId, 1, NULL, 'DIEZ', 'Dubai Integrated Economic Zones', N'سلطة دبي للمناطق الاقتصادية المتكاملة', 'DIEZ',
            @RootPath, 0, 1, 0, @SystemUserId, SYSUTCDATETIME(), '2026-01-01'
        );

        INSERT INTO org.OrgUnitClosure (AncestorOrgUnitId, DescendantOrgUnitId, Depth)
        VALUES (@RootOrgUnitId, @RootOrgUnitId, 0);
    END;

    -- Clean up any prior perf-generated nodes
    PRINT '>> [Step 2] Cleaning up previous performance nodes...';
    DELETE c
    FROM org.OrgUnitClosure c
    INNER JOIN org.OrgUnits u ON u.OrgUnitId = c.DescendantOrgUnitId
    WHERE u.OrgUnitId <> @RootOrgUnitId AND (u.Code LIKE 'PERF_%' OR u.Code LIKE 'BU_%' OR u.Code LIKE 'D_%' OR u.Code LIKE 'S_%');

    DELETE FROM org.OrgUnitManagers WHERE OrgUnitId <> @RootOrgUnitId;
    DELETE FROM org.OrgUnits WHERE OrgUnitId <> @RootOrgUnitId;

    -- 2. Create In-Memory Staging Tables for Fast Bulk Generation
    PRINT '>> [Step 3] Staging 8 Business Units (Depth 1)...';
    DECLARE @BUs TABLE (
        BUId UNIQUEIDENTIFIER PRIMARY KEY,
        IndexNo INT,
        Code VARCHAR(50),
        Name NVARCHAR(200),
        Path VARCHAR(900)
    );

    DECLARE @i INT = 1;
    WHILE @i <= 8
    BEGIN
        DECLARE @buId UNIQUEIDENTIFIER = NEWID();
        DECLARE @buCode VARCHAR(50) = 'PERF_BU_' + RIGHT('0' + CAST(@i AS VARCHAR(2)), 2);
        DECLARE @buName NVARCHAR(200) = 'Business Unit ' + CAST(@i AS VARCHAR(2));
        DECLARE @buPath VARCHAR(900) = @RootPath + REPLACE(CAST(@buId AS VARCHAR(36)), '-', '') + '/';

        INSERT INTO @BUs (BUId, IndexNo, Code, Name, Path)
        VALUES (@buId, @i, @buCode, @buName, @buPath);

        SET @i = @i + 1;
    END;

    INSERT INTO org.OrgUnits (
        OrgUnitId, OrgUnitTypeId, ParentOrgUnitId, Code, Name, NameAr, ShortName,
        MaterializedPath, Depth, CostCenterCode, IsActive, IsDeleted, CreatedBy, CreatedAt, EffectiveFrom
    )
    SELECT 
        BUId, 2, @RootOrgUnitId, Code, Name, Name, Code,
        Path, 1, 'CC-BU-' + CAST(IndexNo AS VARCHAR(10)), 1, 0, @SystemUserId, SYSUTCDATETIME(), '2026-01-01'
    FROM @BUs;

    -- Closure for BUs
    INSERT INTO org.OrgUnitClosure (AncestorOrgUnitId, DescendantOrgUnitId, Depth)
    SELECT @RootOrgUnitId, BUId, 1 FROM @BUs
    UNION ALL
    SELECT BUId, BUId, 0 FROM @BUs;

    -- 3. Create 120 Departments (Depth 2, 15 per BU)
    PRINT '>> [Step 4] Staging 120 Departments (Depth 2)...';
    DECLARE @Depts TABLE (
        DeptId UNIQUEIDENTIFIER PRIMARY KEY,
        BUId UNIQUEIDENTIFIER,
        IndexNo INT,
        Code VARCHAR(50),
        Name NVARCHAR(200),
        Path VARCHAR(900)
    );

    DECLARE @deptIdx INT = 1;
    DECLARE bu_cursor CURSOR LOCAL FAST_FORWARD FOR 
        SELECT BUId, Path FROM @BUs ORDER BY IndexNo;
    
    DECLARE @curBUId UNIQUEIDENTIFIER;
    DECLARE @curBUPath VARCHAR(900);

    OPEN bu_cursor;
    FETCH NEXT FROM bu_cursor INTO @curBUId, @curBUPath;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        DECLARE @d INT = 1;
        WHILE @d <= 15
        BEGIN
            DECLARE @dId UNIQUEIDENTIFIER = NEWID();
            DECLARE @dCode VARCHAR(50) = 'PERF_D_' + RIGHT('00' + CAST(@deptIdx AS VARCHAR(3)), 3);
            DECLARE @dName NVARCHAR(200) = 'Department ' + CAST(@deptIdx AS VARCHAR(3));
            DECLARE @dPath VARCHAR(900) = @curBUPath + REPLACE(CAST(@dId AS VARCHAR(36)), '-', '') + '/';

            INSERT INTO @Depts (DeptId, BUId, IndexNo, Code, Name, Path)
            VALUES (@dId, @curBUId, @deptIdx, @dCode, @dName, @dPath);

            SET @deptIdx = @deptIdx + 1;
            SET @d = @d + 1;
        END;
        FETCH NEXT FROM bu_cursor INTO @curBUId, @curBUPath;
    END;
    CLOSE bu_cursor;
    DEALLOCATE bu_cursor;

    INSERT INTO org.OrgUnits (
        OrgUnitId, OrgUnitTypeId, ParentOrgUnitId, Code, Name, NameAr, ShortName,
        MaterializedPath, Depth, CostCenterCode, IsActive, IsDeleted, CreatedBy, CreatedAt, EffectiveFrom
    )
    SELECT 
        DeptId, 3, BUId, Code, Name, Name, Code,
        Path, 2, 'CC-DEPT-' + CAST(IndexNo AS VARCHAR(10)), 1, 0, @SystemUserId, SYSUTCDATETIME(), '2026-01-01'
    FROM @Depts;

    -- Closure for Departments (§6.1)
    INSERT INTO org.OrgUnitClosure (AncestorOrgUnitId, DescendantOrgUnitId, Depth)
    SELECT c.AncestorOrgUnitId, d.DeptId, c.Depth + 1
    FROM org.OrgUnitClosure c
    INNER JOIN @Depts d ON d.BUId = c.DescendantOrgUnitId
    UNION ALL
    SELECT DeptId, DeptId, 0 FROM @Depts;

    -- 4. Create 4,871 Sections (Depth 3) distributed across 120 Departments
    PRINT '>> [Step 5] Staging 4,871 Sections (Depth 3)...';
    CREATE TABLE #Sections (
        SecId UNIQUEIDENTIFIER PRIMARY KEY,
        DeptId UNIQUEIDENTIFIER,
        Code VARCHAR(50),
        Name NVARCHAR(200),
        Path VARCHAR(900)
    );

    DECLARE @secIdx INT = 1;
    DECLARE @totalSectionsTarget INT = 4871;

    DECLARE dept_cursor CURSOR LOCAL FAST_FORWARD FOR 
        SELECT DeptId, Path, IndexNo FROM @Depts ORDER BY IndexNo;

    DECLARE @curDeptId UNIQUEIDENTIFIER;
    DECLARE @curDeptPath VARCHAR(900);
    DECLARE @curDeptIdx INT;

    OPEN dept_cursor;
    FETCH NEXT FROM dept_cursor INTO @curDeptId, @curDeptPath, @curDeptIdx;

    WHILE @@FETCH_STATUS = 0 AND @secIdx <= @totalSectionsTarget
    BEGIN
        -- 71 departments have 41 sections, 49 departments have 40 sections (71*41 + 49*40 = 4871)
        DECLARE @secPerDept INT = CASE WHEN @curDeptIdx <= 71 THEN 41 ELSE 40 END;
        DECLARE @s INT = 1;

        WHILE @s <= @secPerDept AND @secIdx <= @totalSectionsTarget
        BEGIN
            DECLARE @sId UNIQUEIDENTIFIER = NEWID();
            DECLARE @sCode VARCHAR(50) = 'PERF_S_' + RIGHT('000' + CAST(@secIdx AS VARCHAR(4)), 4);
            DECLARE @sName NVARCHAR(200) = 'Section ' + CAST(@secIdx AS VARCHAR(4));
            DECLARE @sPath VARCHAR(900) = @curDeptPath + REPLACE(CAST(@sId AS VARCHAR(36)), '-', '') + '/';

            INSERT INTO #Sections (SecId, DeptId, Code, Name, Path)
            VALUES (@sId, @curDeptId, @sCode, @sName, @sPath);

            SET @secIdx = @secIdx + 1;
            SET @s = @s + 1;
        END;

        FETCH NEXT FROM dept_cursor INTO @curDeptId, @curDeptPath, @curDeptIdx;
    END;
    CLOSE dept_cursor;
    DEALLOCATE dept_cursor;

    INSERT INTO org.OrgUnits (
        OrgUnitId, OrgUnitTypeId, ParentOrgUnitId, Code, Name, NameAr, ShortName,
        MaterializedPath, Depth, CostCenterCode, IsActive, IsDeleted, CreatedBy, CreatedAt, EffectiveFrom
    )
    SELECT 
        SecId, 4, DeptId, Code, Name, Name, Code,
        Path, 3, 'CC-SEC', 1, 0, @SystemUserId, SYSUTCDATETIME(), '2026-01-01'
    FROM #Sections;

    -- Closure for Sections (§6.1)
    PRINT '>> [Step 6] Bulk inserting section closure rows (§6.1)...';
    INSERT INTO org.OrgUnitClosure (AncestorOrgUnitId, DescendantOrgUnitId, Depth)
    SELECT c.AncestorOrgUnitId, s.SecId, c.Depth + 1
    FROM org.OrgUnitClosure c
    INNER JOIN #Sections s ON s.DeptId = c.DescendantOrgUnitId
    UNION ALL
    SELECT SecId, SecId, 0 FROM #Sections;

    DROP TABLE #Sections;

    -- 5. Seed Department & BU Managers for Approval Chain Testing
    PRINT '>> [Step 7] Assigning Primary Heads for Approval Chain & Scope testing...';
    DECLARE @FirstBUId UNIQUEIDENTIFIER = (SELECT TOP 1 BUId FROM @BUs ORDER BY IndexNo);
    DECLARE @FirstDeptId UNIQUEIDENTIFIER = (SELECT TOP 1 DeptId FROM @Depts ORDER BY IndexNo);

    -- BU Head
    INSERT INTO org.OrgUnitManagers (
        OrgUnitId, UserID, ManagerRoleCode, IsPrimary, EffectiveFrom, IsActive, IsDeleted, CreatedBy, CreatedAt
    ) VALUES (
        @FirstBUId, '2053433E-F36B-1410-85ED-009A959FB122', 'HEAD', 1, '2026-01-01', 1, 0, @SystemUserId, SYSUTCDATETIME()
    );

    UPDATE org.OrgUnits SET HeadUserId = '2053433E-F36B-1410-85ED-009A959FB122' WHERE OrgUnitId = @FirstBUId;

    -- Department Head
    INSERT INTO org.OrgUnitManagers (
        OrgUnitId, UserID, ManagerRoleCode, IsPrimary, EffectiveFrom, IsActive, IsDeleted, CreatedBy, CreatedAt
    ) VALUES (
        @FirstDeptId, '1853433E-F36B-1410-85ED-009A959FB122', 'HEAD', 1, '2026-01-01', 1, 0, @SystemUserId, SYSUTCDATETIME()
    );

    UPDATE org.OrgUnits SET HeadUserId = '1853433E-F36B-1410-85ED-009A959FB122' WHERE OrgUnitId = @FirstDeptId;

    -- Assign Scope for finance.manager (1853433E-F36B-1410-85ED-009A959FB122) to FirstDeptId
    DELETE FROM auth.UserOrganizationScopes WHERE UserID = '1853433E-F36B-1410-85ED-009A959FB122';
    INSERT INTO auth.UserOrganizationScopes (
        UserID, ScopeDefinitionID, OrgUnitId
    ) VALUES (
        '1853433E-F36B-1410-85ED-009A959FB122',
        '71135412-8E6B-403B-8669-E037C5BC98A1', -- DEPARTMENT
        @FirstDeptId
    );

    -- Assign Scope for hod.operations (2053433E-F36B-1410-85ED-009A959FB122) to FirstBUId
    DELETE FROM auth.UserOrganizationScopes WHERE UserID = '2053433E-F36B-1410-85ED-009A959FB122';
    INSERT INTO auth.UserOrganizationScopes (
        UserID, ScopeDefinitionID, OrgUnitId
    ) VALUES (
        '2053433E-F36B-1410-85ED-009A959FB122',
        'FD4D587F-8771-4014-8184-7F886C421465', -- BUSINESS_UNIT
        @FirstBUId
    );

    -- Assign GLOBAL scope for admin (1053433E-F36B-1410-85ED-009A959FB122)
    DELETE FROM auth.UserOrganizationScopes WHERE UserID = '1053433E-F36B-1410-85ED-009A959FB122';
    INSERT INTO auth.UserOrganizationScopes (
        UserID, ScopeDefinitionID, OrgUnitId
    ) VALUES (
        '1053433E-F36B-1410-85ED-009A959FB122',
        'F004F0CF-0BA4-4E14-B34F-87E8D0F8A597', -- GLOBAL
        @RootOrgUnitId
    );

    COMMIT TRANSACTION;
    PRINT '>> [SUCCESS] 5,000 Org Units & 19,861 Closure Rows Generated Successfully!';

    -- Summary Check
    SELECT 'SUMMARY: OrgUnits' AS Metric, COUNT(1) AS TotalCount FROM org.OrgUnits WHERE IsDeleted = 0
    UNION ALL
    SELECT 'SUMMARY: Closure Rows', COUNT(1) FROM org.OrgUnitClosure
    UNION ALL
    SELECT 'SUMMARY: Depth 0 (Org)', COUNT(1) FROM org.OrgUnits WHERE Depth = 0 AND IsDeleted = 0
    UNION ALL
    SELECT 'SUMMARY: Depth 1 (BU)', COUNT(1) FROM org.OrgUnits WHERE Depth = 1 AND IsDeleted = 0
    UNION ALL
    SELECT 'SUMMARY: Depth 2 (Dept)', COUNT(1) FROM org.OrgUnits WHERE Depth = 2 AND IsDeleted = 0
    UNION ALL
    SELECT 'SUMMARY: Depth 3 (Section)', COUNT(1) FROM org.OrgUnits WHERE Depth = 3 AND IsDeleted = 0;

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    DECLARE @ErrMsg NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrLine INT = ERROR_LINE();
    RAISERROR('Performance seed failed at line %d: %s', 16, 1, @ErrLine, @ErrMsg);
END CATCH;

-- ============================================================================
-- VERIFY: Section 6.3 Integrity Verification (MUST RETURN ZERO ROWS)
-- ============================================================================
SELECT u.OrgUnitId, u.Code, 'MISSING_SELF_ROW' AS Problem
FROM org.OrgUnits AS u
LEFT JOIN org.OrgUnitClosure AS c
       ON c.AncestorOrgUnitId = u.OrgUnitId
      AND c.DescendantOrgUnitId = u.OrgUnitId
      AND c.Depth = 0
WHERE u.IsDeleted = 0 AND c.AncestorOrgUnitId IS NULL

UNION ALL

SELECT u.OrgUnitId, u.Code, 'MISSING_PARENT_EDGE'
FROM org.OrgUnits AS u
LEFT JOIN org.OrgUnitClosure AS c
       ON c.AncestorOrgUnitId = u.ParentOrgUnitId
      AND c.DescendantOrgUnitId = u.OrgUnitId
      AND c.Depth = 1
WHERE u.IsDeleted = 0 AND u.ParentOrgUnitId IS NOT NULL AND c.AncestorOrgUnitId IS NULL

UNION ALL

SELECT c.DescendantOrgUnitId, NULL, 'ORPHAN_CLOSURE_ROW'
FROM org.OrgUnitClosure AS c
LEFT JOIN org.OrgUnits AS u ON u.OrgUnitId = c.DescendantOrgUnitId
WHERE u.OrgUnitId IS NULL

UNION ALL

SELECT u.OrgUnitId, u.Code, 'DEPTH_MISMATCH'
FROM org.OrgUnits AS u
INNER JOIN (
    SELECT DescendantOrgUnitId, MAX(Depth) AS MaxDepth
    FROM org.OrgUnitClosure GROUP BY DescendantOrgUnitId
) AS d ON d.DescendantOrgUnitId = u.OrgUnitId
WHERE u.IsDeleted = 0 AND u.Depth <> d.MaxDepth;
