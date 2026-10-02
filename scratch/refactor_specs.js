const fs = require('fs');

let specPath = 'src/modules/authorization/users/services/users.service.spec.ts';
let content = fs.readFileSync(specPath, 'utf8');

// Remove UserProfilesRepository import and mock
content = content.replace(/import \{ UserProfilesRepository \} from '\.\.\/repositories\/user-profiles\.repository';\n/, '');
content = content.replace(/\s*const mockUserProfilesRepository = \{\n\s*create: jest\.fn\(\),\n\s*update: jest\.fn\(\),\n\s*\};\n/, '');
content = content.replace(/\s*\{\n\s*provide: UserProfilesRepository,\n\s*useValue: mockUserProfilesRepository,\n\s*\},\n/, '');

// Remove dto.profile usage in test mocks
content = content.replace(/profile: \{\n\s*firstName: 'Test',\n\s*lastName: 'User',\n\s*\},\n/g, "firstName: 'Test',\n      lastName: 'User',\n");
content = content.replace(/profile: \{\n\s*jobTitle: 'Manager',\n\s*\},\n/g, "jobTitle: 'Manager',\n");
content = content.replace(/expect\(mockUserProfilesRepository\.create\)[\s\S]*?\);\n/, '');
content = content.replace(/expect\(mockUserProfilesRepository\.update\)[\s\S]*?\);\n/, '');
content = content.replace(/mockUserProfilesRepository\.create\.mockResolvedValueOnce\('prof-123'\);\n/, '');
content = content.replace(/mockUserProfilesRepository\.create\.mockRejectedValueOnce\([\s\S]*?\);\n/, '');
content = content.replace(/isDeleted: false,\n/g, '');

fs.writeFileSync(specPath, content);
console.log('users.service.spec.ts updated');
