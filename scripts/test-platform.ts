import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ECOSYSTEM_APPLICATIONS } from '../src/ecosystem';
import { normalizeApiServer } from '../src/lib/api';
import { isAdministratorAlias, resolveAdministratorLoginEmail } from '../src/lib/adminAuth';
import { describeTeacherAccountError, validateTeacherCredentials } from '../src/lib/teacherAccounts';

assert.equal(ECOSYSTEM_APPLICATIONS.length, 13, 'The catalog exposes all 13 applications.');
assert.equal(new Set(ECOSYSTEM_APPLICATIONS.map((app) => app.id)).size, 13, 'Application IDs are unique.');
assert.ok(ECOSYSTEM_APPLICATIONS.some((app) => app.id === 'gesture-core'));
assert.ok(ECOSYSTEM_APPLICATIONS.some((app) => app.id === 'gesture-class'));
assert.ok(ECOSYSTEM_APPLICATIONS.some((app) => app.id === 'plicker'));

const gestureClassIndex = readFileSync(new URL('../public/gestureclass/index.html', import.meta.url), 'utf8');
assert.match(gestureClassIndex, /href="\.\/styles\.css"/, 'GestureClass styles use the GitHub Pages subdirectory.');
assert.match(gestureClassIndex, /src="\.\/app\.js"/, 'GestureClass scripts use the GitHub Pages subdirectory.');
assert.ok(existsSync(new URL('../public/gestureclass/styles.css', import.meta.url)));
assert.ok(existsSync(new URL('../public/gestureclass/app.js', import.meta.url)));

const gestureClassComponent = readFileSync(new URL('../src/components/GestureClass.tsx', import.meta.url), 'utf8');
assert.match(gestureClassComponent, /import\.meta\.env\.BASE_URL/);
assert.match(gestureClassComponent, /allow="camera; fullscreen"/);
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

console.info('SmartClass ecosystem and GestureClass integration: 29 checks passed.');
