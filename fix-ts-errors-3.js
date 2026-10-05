const fs = require('fs');
const glob = require('glob');

function replaceInFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    for (const [search, replace] of replacements) {
        if (search instanceof RegExp) {
            content = content.replace(search, replace);
        } else {
            content = content.split(search).join(replace);
        }
    }
    
    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

const files = glob.sync('/Users/aait/Documents/Development/DIEZ-OMS/oms-backend/src/**/*.ts');

for (const file of files) {
    replaceInFile(file, [
        ['nodeId: number', 'nodeId: string'],
        ['oldParentId: number', 'oldParentId: string'],
        ['oldParentId?: number', 'oldParentId?: string'],
        ['oldParentId: number | null', 'oldParentId: string | null'],
        ['newParentId: number | null', 'newParentId: string | null'],
        ['unitTypeId: number', 'unitTypeId: string'],
        ['unitTypeId: string | null', 'unitTypeId: string | null'],
        ['parentId: number | null', 'parentId: string | null'],
        ['orgUnitId: number', 'orgUnitId: string'],
        ['orgUnitId: string | null', 'orgUnitId: string | null'],
        ['subtreeIds: number[]', 'subtreeIds: string[]'],
        ['Array<number>', 'Array<string>'],
        [/(?:unitTypeId|orgUnitId|parentId|newParentId|oldParentId):\s*number\b/g, (match) => match.replace('number', 'string')],
        // fix Map<number, IOrgUnitType>
        ['Map<number,', 'Map<string,'],
        // fix tests mocked numbers
        ['findById(999', "findById('999'"],
        ['findChildren(999', "findChildren('999'"],
        ['softDelete(33', "softDelete('33'"],
        ['deactivate(33', "deactivate('33'"],
        ['activate(33', "activate('33'"],
        ['move(33', "move('33'"],
        ['move(\'33\'', "move('33'"],
        ['findById(33', "findById('33'"],
        ['findById(1', "findById('1'"],
        ['findById(2', "findById('2'"],
        ['getAncestors(33', "getAncestors('33'"],
        ['getDescendants(33', "getDescendants('33'"],
        ['unitTypeId: 3,', "unitTypeId: '3',"],
        ['unitTypeId: 2,', "unitTypeId: '2',"],
        ['unitTypeId: 1,', "unitTypeId: '1',"],
        ['parentId: 1,', "parentId: '1',"],
        ['parentId: 2,', "parentId: '2',"],
        ['newParentId: 4,', "newParentId: '4',"],
        ['newParentId: 5,', "newParentId: '5',"],
        ['subtreeIds: [1, 2, 3]', "subtreeIds: ['1', '2', '3']"],
        ['subtreeIds: [4, 5]', "subtreeIds: ['4', '5']"],
        ['subtreeIds: [4, 5, 6]', "subtreeIds: ['4', '5', '6']"],
    ]);
}
