const fs = require('fs');

let content = fs.readFileSync('src/modules/auth/auth-core.spec.ts', 'utf8');

// Replace the admin mock object
content = content.replace(
`            return {
              UserID: '1053433E-F36B-1410-85ED-009A959FB122',
              EmployeeID: 'EMP001',
              Username: 'admin',
              Email: 'admin@oms.local',
              UserType: 'INTERNAL',
              IsActive: true,
              IsDeleted: false,
              FailedLoginCount: 0,
              LastFailedLoginAt: null,
              LockedUntil: null,
            };`,
`            return {
              user_id: '1053433E-F36B-1410-85ED-009A959FB122',
              employee_id: 'EMP001',
              Username: 'admin',
              Email: 'admin@oms.local',
              UserType: 'INTERNAL',
              is_active: true,
              failed_login_count: 0,
              locked_until: null,
            };`
);

// Replace locked_user mock
content = content.replace(
`            return {
              UserID: '2053433E-F36B-1410-85ED-009A959FB122',
              EmployeeID: 'EMP002',
              Username: 'locked_user',
              Email: 'locked@oms.local',
              UserType: 'INTERNAL',
              IsActive: true,
              IsDeleted: false,
              FailedLoginCount: 5,
              LastFailedLoginAt: new Date(),
              LockedUntil: new Date(Date.now() + 3600000), // locked for 1 hour
            };`,
`            return {
              user_id: '2053433E-F36B-1410-85ED-009A959FB122',
              employee_id: 'EMP002',
              Username: 'locked_user',
              Email: 'locked@oms.local',
              UserType: 'INTERNAL',
              is_active: true,
              failed_login_count: 5,
              locked_until: new Date(Date.now() + 3600000), // locked for 1 hour
            };`
);

// Replace inactive_user mock
content = content.replace(
`            return {
              UserID: '3053433E-F36B-1410-85ED-009A959FB122',
              EmployeeID: 'EMP003',
              Username: 'inactive_user',
              Email: 'inactive@oms.local',
              UserType: 'INTERNAL',
              IsActive: false,
              IsDeleted: false,
              FailedLoginCount: 0,
              LastFailedLoginAt: null,
              LockedUntil: null,
            };`,
`            return {
              user_id: '3053433E-F36B-1410-85ED-009A959FB122',
              employee_id: 'EMP003',
              Username: 'inactive_user',
              Email: 'inactive@oms.local',
              UserType: 'INTERNAL',
              is_active: false,
              failed_login_count: 0,
              locked_until: null,
            };`
);

// Replace session mock (valid-token session)
content = content.replace(
`            return {
              LoginSessionID: 'sess-active',
              UserID: '1053433E-F36B-1410-85ED-009A959FB122',
              IsActive: true,
              ExpiresAt: new Date(Date.now() + 86400000),
              RevokedAt: null,
              RefreshTokenHash: validHash,
              RefreshTokenExpiresAt: new Date(Date.now() + 86400000),
              RefreshTokenRevokedAt: null,
              IPAddress: '127.0.0.1',
              UserAgent: 'Jest',
              BrowserName: 'Chrome',
              DeviceType: 'DESKTOP',
              LastActivityAt: new Date(),
            };`,
`            return {
              login_session_id: 'sess-active',
              user_id: '1053433E-F36B-1410-85ED-009A959FB122',
              is_active: true,
              expires_at: new Date(Date.now() + 86400000),
              revoked_at: null,
              refresh_token_hash: validHash,
              refresh_token_expires_at: new Date(Date.now() + 86400000),
              refresh_token_revoked_at: null,
              ip_address: '127.0.0.1',
              user_agent: 'Jest',
              browser_name: 'Chrome',
              device_type: 'DESKTOP',
              last_activity_at: new Date(),
            };`
);

// Replace session mock (replayed-token session)
content = content.replace(
`            return {
              LoginSessionID: 'sess-replayed',
              UserID: '1053433E-F36B-1410-85ED-009A959FB122',
              IsActive: true,
              ExpiresAt: new Date(Date.now() + 86400000),
              RevokedAt: null,
              RefreshTokenHash: replayedHash,
              RefreshTokenExpiresAt: new Date(Date.now() + 86400000),
              RefreshTokenRevokedAt: new Date(Date.now() - 60000), // revoked 60 seconds ago (outside 30s grace)
              IPAddress: '127.0.0.1',
              UserAgent: 'Jest',
              BrowserName: 'Chrome',
              DeviceType: 'DESKTOP',
              LastActivityAt: new Date(),
            };`,
`            return {
              login_session_id: 'sess-replayed',
              user_id: '1053433E-F36B-1410-85ED-009A959FB122',
              is_active: true,
              expires_at: new Date(Date.now() + 86400000),
              revoked_at: null,
              refresh_token_hash: replayedHash,
              refresh_token_expires_at: new Date(Date.now() + 86400000),
              refresh_token_revoked_at: new Date(Date.now() - 60000), // revoked 60 seconds ago (outside 30s grace)
              ip_address: '127.0.0.1',
              user_agent: 'Jest',
              browser_name: 'Chrome',
              device_type: 'DESKTOP',
              last_activity_at: new Date(),
            };`
);

fs.writeFileSync('src/modules/auth/auth-core.spec.ts', content);
console.log('Spec updated');
