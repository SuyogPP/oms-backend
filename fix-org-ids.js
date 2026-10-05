const fs = require('fs');
const path = require('path');

function replaceInFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    for (const [search, replace] of replacements) {
        content = content.split(search).join(replace);
    }
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

// 1. Interfaces
replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/interfaces/org-unit.interface.ts', [
    ['unitTypeId: number;', 'unitTypeId: string;'],
    ['parentUnitTypeId: number | null;', 'parentUnitTypeId: string | null;'],
    ['childOrgUnitTypeId: number;', 'childOrgUnitTypeId: string;'],
    ['parentOrgUnitTypeId: number;', 'parentOrgUnitTypeId: string;'],
    ['orgUnitId: number;', 'orgUnitId: string;'],
    ['parentId: number | null;', 'parentId: string | null;'],
    ['oldParentId: number | null;', 'oldParentId: string | null;'],
    ['newParentId: number | null;', 'newParentId: string | null;']
]);

// 2. Entities
replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/entities/org-unit.entity.ts', [
    ['orgUnitId: number;', 'orgUnitId: string;'],
    ['unitTypeId: number;', 'unitTypeId: string;'],
    ['parentId: number | null;', 'parentId: string | null;']
]);
replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/entities/org-unit-type.entity.ts', [
    ['unitTypeId: number;', 'unitTypeId: string;'],
    ['parentUnitTypeId: number | null;', 'parentUnitTypeId: string | null;'],
    ['childOrgUnitTypeId: number;', 'childOrgUnitTypeId: string;'],
    ['parentOrgUnitTypeId: number;', 'parentOrgUnitTypeId: string;']
]);

// 3. Repositories
replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/repositories/org-units.repository.ts', [
    ['orgUnitId: number', 'orgUnitId: string'],
    ['parentId: number', 'parentId: string'],
    ['parentId?: number', 'parentId?: string'],
    ['unitTypeId: number', 'unitTypeId: string'],
    ['unitTypeId?: number', 'unitTypeId?: string'],
    ['newParentId: number', 'newParentId: string'],
    ['newParentId?: number', 'newParentId?: string']
]);
replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/repositories/org-unit-types.repository.ts', [
    ['typeId: number', 'typeId: string']
]);
replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/repositories/org-unit-change-log.repository.ts', [
    ['orgUnitId: number', 'orgUnitId: string'],
    ['oldParentId?: number', 'oldParentId?: string'],
    ['newParentId?: number', 'newParentId?: string']
]);

// 4. Services
replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/services/org-units.service.ts', [
    ['orgUnitId: number', 'orgUnitId: string']
]);
replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/services/org-unit-types.service.ts', [
    ['typeId: number', 'typeId: string']
]);
replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/services/org-unit-validation.service.ts', [
    ['orgUnitId: number', 'orgUnitId: string'],
    ['parentId: number', 'parentId: string'],
    ['parentId?: number', 'parentId?: string'],
    ['unitTypeId: number', 'unitTypeId: string'],
    ['newParentId: number', 'newParentId: string'],
    ['newParentId?: number', 'newParentId?: string']
]);

