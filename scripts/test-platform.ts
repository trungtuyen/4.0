import assert from 'node:assert/strict';
import { ECOSYSTEM_APPLICATIONS } from '../src/ecosystem';
import { normalizeApiServer } from '../src/lib/api';
import { isAdministratorAlias, resolveAdministratorLoginEmail } from '../src/lib/adminAuth';
import { describeTeacherAccountError, validateTeacherCredentials } from '../src/lib/teacherAccounts';

assert.equal(ECOSYSTEM_APPLICATIONS.length, 12, 'The catalog exposes all 12 applications.');
assert.equal(new Set(ECOSYSTEM_APPLICATIONS.map((app) => app.id)).size, 12, 'Application IDs are unique.');
assert.ok(ECOSYSTEM_APPLICATIONS.some((app) => app.id === 'gesture-core'));
assert.ok(ECOSYSTEM_APPLICATIONS.some((app) => app.id === 'plicker'));
assert.equal(normalizeApiServer('https://example.edu.vn/'), 'https://example.edu.vn');
assert.equal(normalizeApiServer('http://localhost:3000/'), 'http://localhost:3000');
assert.equal(normalizeApiServer('  '), '');
assert.throws(() => normalizeApiServer('http://example.edu.vn'));
assert.throws(() => normalizeApiServer('https://user:secret@example.edu.vn'));
assert.throws(() => normalizeApiServer('https://example.edu.vn/?token=123'));

assert.equal(isAdministratorAlias(' ADMIN '), true);
assert.equal(isAdministratorAlias('teacher@example.edu.vn'), false);
assert.equal(resolveAdministratorLoginEmail('admin', { configuredEmail: ' Owner@Example.edu.vn ' }), 'owner@example.edu.vn');
assert.equal(resolveAdministratorLoginEmail('admin', { rememberedEmail: ' Remembered@Example.edu.vn ' }), 'remembered@example.edu.vn');
assert.equal(resolveAdministratorLoginEmail('admin', { configuredEmail: 'owner@example.edu.vn', rememberedEmail: 'other@example.edu.vn' }), 'owner@example.edu.vn');
assert.equal(resolveAdministratorLoginEmail('admin'), '');
assert.equal(resolveAdministratorLoginEmail('teacher@example.edu.vn'), 'teacher@example.edu.vn');

assert.equal(validateTeacherCredentials('teacher@example.edu.vn', 'password-123', 'password-123'), '');
assert.match(validateTeacherCredentials('teacher@example.edu.vn', 'short', 'short'), /ít nhất 8 ký tự/);
assert.match(validateTeacherCredentials('teacher@example.edu.vn', 'password-123', 'password-456'), /chưa trùng khớp/);
assert.match(describeTeacherAccountError({ code: 'auth/email-already-in-use' }), /đã có tài khoản/);
assert.match(describeTeacherAccountError({ code: 'auth/operation-not-allowed' }), /Email\/Mật khẩu/);

console.info('SmartClass ecosystem: 22 checks passed.');
