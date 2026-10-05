const fs = require('fs');
const path = 'src/modules/authorization/vendor-users/repositories/vendor-users.repository.ts';
let content = fs.readFileSync(path, 'utf8');

// Replace mapping 1
content = content.replace(/profile: \{\s*userProfileId: r\.userProfileId,\s*userId: r\.userId,\s*firstName: r\.firstName,\s*lastName: r\.lastName,\s*displayName: r\.displayName,\s*phoneNumber: r\.phoneNumber,\s*jobTitle: r\.jobTitle,\s*vendorId: r\.vendorId,\s*mustChangePassword: false,\s*createdAt: new Date\(r\.createdAt\),\s*updatedAt: new Date\(r\.updatedAt\),\s*\}/g, 'firstName: r.firstName, lastName: r.lastName, mobileNo: r.phoneNumber, jobTitle: r.jobTitle');

// Remove isDeleted
content = content.replace(/isDeleted: r\.isDeleted === 1 \|\| r\.isDeleted === true,/g, '');

fs.writeFileSync(path, content, 'utf8');
