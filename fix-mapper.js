const fs = require('fs');
const path = 'src/modules/authorization/user-assignments/user-assignments.mapper.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/IUserScopeAssignment,\n/g, '');
content = content.replace(/export function mapRawUserScopeRowToEntity[\s\S]*?^}/m, '');
fs.writeFileSync(path, content, 'utf8');
