import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  createPlickerLaunchPath,
  getPwaInstallationInstructions,
  readRequestedApplication,
  readRequestedPlickerSection,
} from '../src/lib/plickerPwa';

let checks = 0;

assert.equal(readRequestedApplication('?app=plicker'), 'plicker');
assert.equal(readRequestedApplication('?source=installed&app=plicker'), 'plicker');
assert.equal(readRequestedApplication('?app=gesture-class'), null);
assert.equal(readRequestedApplication(''), null);
assert.equal(readRequestedPlickerSection('?app=plicker&section=classes'), 'classes');
assert.equal(readRequestedPlickerSection('?app=plicker&section=session'), 'session');
assert.equal(readRequestedPlickerSection('?app=plicker&section=unexpected'), null);
assert.equal(readRequestedPlickerSection('?section=classes'), null);
assert.equal(createPlickerLaunchPath('/4.0/'), '/4.0/?app=plicker');
assert.equal(createPlickerLaunchPath('/4.0'), '/4.0/?app=plicker');
assert.equal(createPlickerLaunchPath('/4.0/', 'classes'), '/4.0/?app=plicker&section=classes');
assert.match(getPwaInstallationInstructions('Mozilla/5.0 (Linux; Android 14)'), /Chrome.*Cài đặt ứng dụng/);
assert.match(getPwaInstallationInstructions('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), /Safari.*Màn hình chính/);
assert.match(getPwaInstallationInstructions('Mozilla/5.0 (X11; Linux x86_64)'), /menu trình duyệt/);
checks += 14;

const manifest = JSON.parse(readFileSync(new URL('../public/plicker.webmanifest', import.meta.url), 'utf8')) as {
  id: string;
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
  shortcuts: { url: string }[];
};

assert.equal(manifest.id, '/4.0/?app=plicker');
assert.match(manifest.name, /Thẻ tương tác lớp học/);
assert.equal(manifest.short_name, 'Thẻ lớp học');
assert.equal(manifest.scope, '/4.0/');
assert.equal(manifest.display, 'standalone');
assert.equal(readRequestedApplication(new URL(manifest.start_url, 'https://trungtuyen.github.io').search), 'plicker');
assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
assert.ok(manifest.icons.some(icon => icon.purpose === 'maskable'));
assert.ok(manifest.shortcuts.some(shortcut => shortcut.url.includes('section=classes')));
assert.ok(manifest.shortcuts.some(shortcut => shortcut.url.includes('section=session')));
checks += 11;

for (const icon of manifest.icons) {
  assert.equal(icon.type, 'image/png');
  assert.ok(icon.src.startsWith('/4.0/icons/'));
  const iconUrl = new URL(`../public/${icon.src.slice('/4.0/'.length)}`, import.meta.url);
  assert.ok(existsSync(iconUrl), `${icon.src} exists.`);
  const image = readFileSync(iconUrl);
  assert.deepEqual([...image.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const [expectedWidth, expectedHeight] = icon.sizes.split('x').map(Number);
  assert.equal(image.readUInt32BE(16), expectedWidth);
  assert.equal(image.readUInt32BE(20), expectedHeight);
  checks += 6;
}

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert.match(html, /rel="manifest" href="%BASE_URL%plicker\.webmanifest"/);
assert.match(html, /rel="apple-touch-icon"/);

const worker = readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8');
assert.match(worker, /self\.addEventListener\('install'/);
assert.match(worker, /self\.addEventListener\('activate'/);
assert.match(worker, /self\.addEventListener\('fetch'/);
assert.match(worker, /request\.method !== 'GET'/);
assert.match(worker, /url\.origin !== self\.location\.origin/);
assert.match(worker, /url\.pathname\.includes\('\/api\/'\)/);
assert.match(worker, /url\.pathname\.includes\('\/\/__\/auth\/'\)|url\.pathname\.includes\('\/__\/auth\/'\)/);
assert.match(worker, /offline\.html/);

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/components/AdminDashboard.tsx', import.meta.url), 'utf8');
const classroom = readFileSync(new URL('../src/components/PlickerClassroom.tsx', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

assert.match(app, /requestedApplication === 'plicker'\) return 'admin'/);
assert.match(app, /initialApplication=\{requestedApplication\}/);
assert.match(dashboard, /initialApplication === 'plicker' \? 'plicker' : 'main'/);
assert.match(classroom, /Cài ứng dụng/);
assert.match(classroom, /promptPwaInstallation/);
assert.match(classroom, /readRequestedPlickerSection/);
assert.match(main, /initializePwaInstallation\(\)/);
assert.match(main, /registerClassroomServiceWorker\(import\.meta\.env\.BASE_URL\)/);
assert.ok(existsSync(new URL('../public/offline.html', import.meta.url)));
checks += 19;

console.info(`Plicker installable PWA: ${checks} checks passed.`);
