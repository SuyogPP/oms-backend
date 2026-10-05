const fs = require('fs');
const { execSync } = require('child_process');

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

replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/dto/list-org-units.dto.ts', [
    ['unitTypeId?: number', 'unitTypeId?: string'],
    ['parentId?: number', 'parentId?: string'],
    ['@IsNumber()', '@IsUUID()'],
    ['import { IsOptional, IsString, IsBoolean, IsNumber }', 'import { IsOptional, IsString, IsBoolean, IsUUID }']
]);

replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/org-units.mapper.ts', [
    ['typesMap: Map<number, IOrgUnitType>', 'typesMap: Map<string, IOrgUnitType>'],
    ['id: number', 'id: string'],
    ['depth: number', 'depth: string']
]);

replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-managers/services/org-managers.service.ts', [
    ['orgUnitId: number', 'orgUnitId: string']
]);

replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/services/org-unit-validation.service.ts', [
    ['orgUnitId: number', 'orgUnitId: string'],
    ['parentId: number | null', 'parentId: string | null'],
    ['newParentId: number | null', 'newParentId: string | null'],
    ['unitTypeId: number', 'unitTypeId: string']
]);

replaceInFile('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/services/org-units.service.ts', [
    ['Map<number, IOrgUnitType>', 'Map<string, IOrgUnitType>'],
    ['orgUnitId: number', 'orgUnitId: string'],
    ['unitTypeId: number', 'unitTypeId: string'],
    ['parentId: number', 'parentId: string']
]);

