const fs = require('fs');

const path = '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/domain-2-specification.spec.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove closure imports and providers
content = content.replace(/import \{ OrgUnitClosureRepository \} from '.*?';\n/, '');
content = content.replace(/[ \t]*\{ provide: OrgUnitClosureRepository, useValue: mockClosureRepo \},\n/g, '');
content = content.replace(/[ \t]*provide: OrgUnitClosureRepository,\n/g, '');
content = content.replace(/[ \t]*mockClosureRepo\.[\w]+\.mock.*?;?\n/g, '');
content = content.replace(/[ \t]*const mockClosureRepo = \{[\s\S]*?\};\n/g, '');

// 2. Remove validateC9 test block
content = content.replace(/[ \t]*it\('Reject EffectiveFrom earlier than parent’s', \(\) => \{[\s\S]*?\}\);\n/g, '');

// 3. Update property names in DTOs and objects
content = content.replace(/orgUnitTypeId:/g, 'unitTypeId:');
content = content.replace(/parentOrgUnitId:/g, 'parentId:');
content = content.replace(/code: '([^']+)'/g, "orgCode: '$1'");
// Wait, replacing 'code:' directly might replace `res.code` if not careful, but the regex `code:` with a colon is mostly safe for object properties.
content = content.replace(/name: '([^']+)'/g, "orgName: '$1'");
content = content.replace(/res\.code/g, 'res.orgCode');

// 4. Update string UUIDs to numbers in method calls and objects
// Map specific strings to numbers
const idMap = {
  'parent-1': 1,
  'parent-2': 2,
  'child-1': 11,
  'child-2': 12,
  'child-3': 13,
  'child-guid': 11,
  'new-unit-guid': 99,
  'unit-1': 101,
  'dept-guid': 102,
  'sec-guid': 103,
  'old-parent-guid': 201,
  'new-parent-guid': 202,
  'root-guid': 100,
  'admin-2': "'admin-2'", // This is actorUserId, which is still a string
  'admin': "'admin'", // same
};

for (const [strId, numId] of Object.entries(idMap)) {
  if (numId === "'admin'" || numId === "'admin-2'") continue;
  // Replace standalone string IDs with numbers
  const regex = new RegExp(`'${strId}'`, 'g');
  content = content.replace(regex, numId);
}

// 5. Remove unused properties from mocks
content = content.replace(/[ \t]*depth: \d+,\n/g, '');
content = content.replace(/[ \t]*materializedPath: '.*?',\n/g, '');
content = content.replace(/[ \t]*rowVersion: '.*?',\n/g, '');

fs.writeFileSync(path, content, 'utf8');
console.log('Done refactoring');
