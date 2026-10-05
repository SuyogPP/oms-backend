const fs = require('fs');

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

const files = [
    '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/services/org-unit-validation.service.ts',
    '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-managers/services/org-managers.service.ts',
    '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-managers/controllers/org-managers.controller.ts',
    '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/org-units.spec.ts',
    '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-managers/org-managers.spec.ts',
    '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/authorization/users/services/user-validation.service.spec.ts',
    '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/authorization/users/services/users.service.spec.ts',
    '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/authorization/vendor-users/controllers/vendor-users.controller.spec.ts',
    '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/authorization/vendor-users/services/vendor-users.service.spec.ts',
    '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/authorization/vendor-users/vendor-user-rejection.spec.ts',
    '/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/modules/organization/org-units/dto/list-org-units.dto.ts'
];

for (const file of files) {
    replaceInFile(file, [
        ['orgUnitId: number', 'orgUnitId: string'],
        ['parentId: number', 'parentId: string'],
        ['parentId?: number', 'parentId?: string'],
        ['unitTypeId: number', 'unitTypeId: string'],
        ['newParentId: number', 'newParentId: string'],
        ['newParentId?: number', 'newParentId?: string'],
        ['oldParentId: number', 'oldParentId: string'],
        ['oldParentId?: number', 'oldParentId?: string'],
        ['subtreeIds: number[]', 'subtreeIds: string[]'],
        ['(33,', "('33',"],
        ['(33)', "('33')"],
        [' 33,', " '33',"],
        ['unitTypeId: 3,', "unitTypeId: '3',"],
        ['newParentId: 4,', "newParentId: '4',"],
        ['newParentId: 5,', "newParentId: '5',"],
        ['unitTypeId: 2,', "unitTypeId: '2',"],
        ['unitTypeId: 1,', "unitTypeId: '1',"],
        ['unitTypeId: 4,', "unitTypeId: '4',"],
        ['unitTypeId: 5,', "unitTypeId: '5',"],
        ['(4)', "('4')"],
        [' 4,', " '4',"],
        [' 5,', " '5',"],
        ['ParseIntPipe', 'ParseUUIDPipe']
    ]);
}

