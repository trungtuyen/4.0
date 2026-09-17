import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  getPwaInstallationInstructions,
  hasPwaInstallationPrompt,
  isInstalledPwa,
  promptPwaInstallation,
  readRequestedPlickerSection,
  selectApplicationManifest,
} from '../src/lib/plickerPwa';

let checks = 0;

assert.equal(readRequestedPlickerSection('?app=plicker'), null);
assert.equal(readRequestedPlickerSection('?app=plicker&section=overview'), 'overview');
assert.equal(readRequestedPlickerSection('?app=plicker&section=classes'), 'classes');
assert.equal(readRequestedPlickerSection('?app=plicker&section=library'), 'library');
assert.equal(readRequestedPlickerSection('?app=plicker&section=session'), 'session');
assert.equal(readRequestedPlickerSection('?app=plicker&section=reports'), 'reports');
assert.equal(readRequestedPlickerSection('?app=plicker&section=cards'), 'cards');
assert.equal(readRequestedPlickerSection('?app=plicker&section=invalid'), null);
checks += 8;

assert.equal(selectApplicationManifest('plicker', '/4.0/'), '/4.0/plicker.webmanifest');
assert.equal(selectApplicationManifest('ecosystem', '/4.0/'), '/4.0/smartclass.webmanifest');
assert.equal(selectApplicationManifest('plicker', '/'), '/plicker.webmanifest');
assert.equal(selectApplicationManifest('ecosystem', '/'), '/smartclass.webmanifest');
assert.doesNotThrow(() => selectApplicationManifest('plicker', '/4.0/'));
assert.doesNotThrow(() => selectApplicationManifest('ecosystem', '/4.0/'));
checks += 6;

const chromeInstructions = getPwaInstallationInstructions('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36');
assert.match(chromeInstructions.title, /Android|Chrome/u);
assert.ok(chromeInstructions.steps.length >= 2);
const iosInstructions = getPwaInstallationInstructions('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1');
assert.match(iosInstructions.title, /iPhone|iPad|Safari/u);
assert.ok(iosInstructions.steps.length >= 2);
const desktopInstructions = getPwaInstallationInstructions('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36');
assert.ok(desktopInstructions.steps.length >= 2);
checks += 5;

const originalWindow = globalThis.window;
const originalNavigator = globalThis.navigator;

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    matchMedia: () => ({ matches: false }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  },
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: { userAgent: 'Mozilla/5.0' },
});
assert.equal(isInstalledPwa(), false);
assert.equal(hasPwaInstallationPrompt(), false);
const installResultWithoutPrompt = await promptPwaInstallation();
assert.equal(installResultWithoutPrompt.available, false);
checks += 3;

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: originalWindow,
});
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: originalNavigator,
});

const smartManifest = JSON.parse(readFileSync(new URL('../public/smartclass.webmanifest', import.meta.url), 'utf8')) as {
  name: string;
  short_name: string;
  display: string;
  start_url: string;
  icons: Array<{ src: string; sizes: string; purpose?: string }>;
};
assert.equal(smartManifest.display, 'standalone');
assert.match(smartManifest.start_url, /source=installed/);
assert.ok(smartManifest.icons.some(icon => icon.sizes.includes('192x192')));
assert.ok(smartManifest.icons.some(icon => icon.sizes.includes('512x512')));
checks += 4;

const plickerManifest = JSON.parse(readFileSync(new URL('../public/plicker.webmanifest', import.meta.url), 'utf8')) as {
  name: string;
  short_name: string;
  display: string;
  start_url: string;
  icons: Array<{ src: string; sizes: string; purpose?: string }>;
};
assert.equal(plickerManifest.display, 'standalone');
assert.match(plickerManifest.start_url, /app=plicker/);
assert.match(plickerManifest.start_url, /role=scanner/);
assert.ok(plickerManifest.icons.some(icon => icon.sizes.includes('192x192')));
assert.ok(plickerManifest.icons.some(icon => icon.sizes.includes('512x512')));
assert.ok(plickerManifest.icons.some(icon => icon.purpose?.includes('maskable')));
checks += 6;

assert.equal(selectApplicationManifest('plicker', '/4.0/'), '/4.0/plicker.webmanifest');
assert.equal(selectApplicationManifest('ecosystem', '/4.0/'), '/4.0/smartclass.webmanifest');
assert.doesNotThrow(() => selectApplicationManifest('plicker', '/4.0/'));
assert.doesNotThrow(() => selectApplicationManifest('ecosystem', '/4.0/'));
checks += 8;

const worker = readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8');
assert.match(worker, /self\.addEventListener\('install'/);
assert.match(worker, /self\.addEventListener\('activate'/);
assert.match(worker, /self\.addEventListener\('fetch'/);
assert.match(worker, /request\.method !== 'GET'/);
assert.match(worker, /url\.origin !== self\.location\.origin/);
assert.match(worker, /url\.pathname\.includes\('\/api\/'\)/);
assert.match(worker, /url\.pathname\.includes\('\/\/__\/auth\/'\)|url\.pathname\.includes\('\/__\/auth\/'\)/);
assert.match(worker, /offline\.html/);
assert.match(worker, /smartclass\.webmanifest/);
assert.match(worker, /platform-stats\.json/);
assert.match(worker, /gestureclass\/styles\.css/);
assert.match(worker, /\$\{CACHE_PREFIX\}v22/);
assert.match(worker, /projector-readable-v1/);
assert.match(worker, /fetch\(request, \{ cache: 'no-store' \}\)/);

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/components/AdminDashboard.tsx', import.meta.url), 'utf8');
const classroom = readFileSync(new URL('../src/components/PlickerClassroom.tsx', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8');

assert.match(app, /requestedApplication === 'plicker'\) return 'admin'/);
assert.match(app, /initialApplication=\{requestedApplication\}/);
assert.match(dashboard, /PlickerClassroom/);
assert.match(classroom, /Plicker installable PWA|Cài ứng dụng|Cài Plicker/u);
assert.match(main, /serviceWorker/);
assert.match(main, /register/);
checks += 20;

console.info(`Plicker installable PWA: ${checks} checks passed.`);
