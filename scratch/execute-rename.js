const fs = require('fs');
const path = require('path');

const mapData = JSON.parse(fs.readFileSync('scratch/rename-map.json', 'utf8'));
const tables = mapData.tables;
const columns = mapData.columns;

const filesToProcess = [];
function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.sql')) {
            filesToProcess.push(fullPath);
        }
    }
}
walkDir('src');
walkDir('db');

let changedFiles = new Set();
let flaggedLines = [];
let zeroRefs = new Set([...tables.map(t => t[0]), ...columns.map(c => c[0])]);
let typeChanges = [];

function isNumericCheck(line) {
    return line.includes('parseInt') || line.match(/===\s*0/) || line.match(/!==\s*0/) || line.match(/:\s*number/);
}

for (const file of filesToProcess) {
    let content = fs.readFileSync(file, 'utf8');
    let lines = content.split('\n');
    let modified = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        let originalLine = line;

        // Flag dynamic SQL building
        if ((line.includes('SELECT') || line.includes('UPDATE') || line.includes('INSERT') || line.includes('FROM')) && 
            (line.match(/\$\{[^}]+\}/) || line.includes(' + '))) {
            // Check if it looks like we're building a table or column name dynamically
            if (line.match(/(FROM|JOIN|INTO|UPDATE)\s+['"\`]?\s*\$\{[^}]+\}/i) || 
                line.match(/(SELECT|WHERE|AND|OR|SET|ORDER BY)\s+['"\`]?\s*\$\{[^}]+\}/i)) {
                flaggedLines.push({ file, line: i + 1, reason: 'Dynamic table/column name construction detected', content: line.trim() });
            }
        }

        // Tables
        for (const [oldName, newName] of tables) {
            let regex = new RegExp(`\\b(\\[?auth\\]?\\.|\\[?masters\\]?\\.|\\[?dbo\\]?\\.|FROM\\s+|JOIN\\s+|INTO\\s+|UPDATE\\s+|TABLE\\s+)\\[?${oldName}\\]?\\b`, 'g');
            if (regex.test(line)) {
                zeroRefs.delete(oldName);
                line = line.replace(regex, `$1${newName}`);
            }
        }

        // Columns
        for (const [oldName, newName] of columns) {
            // We only replace if it's in a SQL-like context or a decorator or mapping
            // In repo, they do things like: `u.UserID AS userId`, `[UserID]`, `@Column({ name: 'UserID' })`
            // Let's be aggressive but safe: replace if prefixed by table alias (e.g., u.UserID), 
            // inside brackets ([UserID]), inside quotes for decorators ('UserID'), 
            // or preceded by SQL keywords.
            let colRegex = new RegExp(`(\\b[a-zA-Z_]+\\.|\\bAS\\s+|\\bSELECT\\s+|\\bWHERE\\s+|\\bAND\\s+|\\bOR\\s+|\\bSET\\s+|\\bORDER BY\\s+|\\bGROUP BY\\s+|\\bON\\s+|@Column\\(\\{.*name:\\s*['"]|\\[)${oldName}\\b`, 'g');
            
            if (colRegex.test(line)) {
                zeroRefs.delete(oldName);
                
                // Check if it's one of the numeric flagged columns
                if ((newName === 'org_unit_id' || newName === 'vendor_id') && isNumericCheck(line)) {
                    typeChanges.push({ file, line: i + 1, reason: `Numeric operation on UUID column ${newName}`, content: originalLine.trim() });
                    continue; // Do not rename if it's a numeric usage flag
                }
                
                line = line.replace(colRegex, `$1${newName}`);
            }
            
            // Also catch standalone oldName if it's exactly surrounded by quotes (for mappers)
            let quoteRegex = new RegExp(`(['"\`])${oldName}(['"\`])`, 'g');
            if (quoteRegex.test(line)) {
                 zeroRefs.delete(oldName);
                 if ((newName === 'org_unit_id' || newName === 'vendor_id') && isNumericCheck(line)) {
                     typeChanges.push({ file, line: i + 1, reason: `Numeric operation on UUID column ${newName}`, content: originalLine.trim() });
                     continue;
                 }
                 line = line.replace(quoteRegex, `$1${newName}$2`);
            }
        }

        if (line !== originalLine) {
            lines[i] = line;
            modified = true;
        }
    }

    if (modified) {
        fs.writeFileSync(file, lines.join('\n'));
        changedFiles.add(file);
    }
}

fs.writeFileSync('scratch/rename-results.json', JSON.stringify({
    changedFiles: Array.from(changedFiles),
    flaggedLines,
    typeChanges,
    zeroRefs: Array.from(zeroRefs)
}, null, 2));

console.log("Renaming done.");
