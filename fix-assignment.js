const fs = require('fs');
const path = 'src/modules/organization/org-units/repositories/user-org-unit-assignment.repository.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/newOrgUnitId: number \| null/g, 'newOrgUnitId: string | null');
content = content.replace(/auth\.user_org_unit_assignment/g, 'auth.tbl_User_Org_Unit_Assignment');
fs.writeFileSync(path, content, 'utf8');
