const fs = require('fs');

const path = 'src/modules/organization/domain-2-specification.spec.ts';
let content = fs.readFileSync(path, 'utf8');
let lines = content.split('\n');

// 1. Add countSubtreeDescendants to mockOrgUnitsRepo #1 (around line 63)
// Look for findActiveRoot: jest.fn(),
for(let i=55; i<70; i++) {
  if (lines[i].includes('findActiveRoot: jest.fn(),')) {
    lines.splice(i+1, 0, '        countSubtreeDescendants: jest.fn().mockResolvedValue(1),');
    break;
  }
}

// 2. Add countSubtreeDescendants to mockOrgUnitsRepo #2 (around line 345)
// Look for findById: jest.fn(),
for(let i=335; i<360; i++) {
  if (lines[i].includes('findById: jest.fn(),')) {
    lines.splice(i+1, 0, '        countSubtreeDescendants: jest.fn().mockResolvedValue(1),');
    break;
  }
}

// 3. Fix properties in deptScopeRows (around 922)
for(let i=918; i<955; i++) {
  if (lines[i].includes('orgUnitTypeId: 3') || lines[i].includes('orgUnitTypeId: 4') || lines[i].includes('orgUnitTypeId: 2')) {
    lines[i] = lines[i].replace('orgUnitTypeId', 'unitTypeId');
  }
  if (lines[i].includes('code: \'IT\'') || lines[i].includes('code: \'IT_INFRA\'') || lines[i].includes('code: \'IT_APPS\'') || lines[i].includes('code: \'BU_TECH\'') || lines[i].includes('code: \'ENGINEERING\'') || lines[i].includes('code: \'ENG_QA\'')) {
    lines[i] = lines[i].replace('code:', 'orgCode:');
  }
}

// 4. Update the test that expects the array of orgCodes
for(let i=925; i<935; i++) {
  if (lines[i].includes('expect(visible.map((v) => v.code))')) {
    lines[i] = lines[i].replace('v.code', 'v.orgCode');
  }
}

// 5. Add missing providers
for(let i=965; i<985; i++) {
  if (lines[i].includes('OrgScopeResolverService')) {
    lines.splice(i+1, 0, '          { provide: OrgManagersRepository, useValue: {} },');
    lines.splice(i+2, 0, '          { provide: ORG_UNIT_REFERENCE_CHECKS, useValue: [] },');
    break;
  }
}

fs.writeFileSync(path, lines.join('\n'), 'utf8');
console.log('Fixed logical errors.');
