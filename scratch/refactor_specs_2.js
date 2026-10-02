const fs = require('fs');

let specPath = 'src/modules/authorization/users/services/users.service.spec.ts';
let content = fs.readFileSync(specPath, 'utf8');

// Replace profile: null
content = content.replace(/profile: null,/g, '');

// Replace profile: { departmentId: ... }
content = content.replace(/profile: \{\n\s*departmentId: '(.*?)',\n\s*\}/g, "orgUnitId: '$1'");

// Flatten dto profile in create
content = content.replace(/profile: \{\n\s*firstName: 'Layla',\n\s*lastName: 'Al Mansoori',\n\s*departmentId: '(.*?)',\n\s*\}/g, "firstName: 'Layla',\n          lastName: 'Al Mansoori',\n          orgUnitId: '$1'");
content = content.replace(/profile: \{\n\s*firstName: 'Layla',\n\s*lastName: 'Al Mansoori',\n\s*\}/g, "firstName: 'Layla',\n        lastName: 'Al Mansoori'");

// Flatten dto profile in fail create
content = content.replace(/profile: \{ firstName: 'Fail', lastName: 'User' \}/g, "firstName: 'Fail', lastName: 'User'");

// Fix the mock logic in the fail test
content = content.replace(/rolls back transaction if profile insertion fails/, 'rolls back transaction if user creation fails');
content = content.replace(/mockUsersRepository\.create\.mockResolvedValueOnce\(sampleUserId\);\s*await expect/, "mockUsersRepository.create.mockRejectedValueOnce(new Error('DB Constraint Violation'));\n      \n      await expect");
content = content.replace(/'DB Constraint Violation'/, "new Error('DB Constraint Violation')");

// Flatten dto profile in update test
content = content.replace(/profile: \{ jobTitle: 'Chief Financial Officer' \}/g, "jobTitle: 'Chief Financial Officer'");

fs.writeFileSync(specPath, content);
console.log('users.service.spec.ts updated again');
