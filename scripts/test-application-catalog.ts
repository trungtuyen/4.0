import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { ECOSYSTEM_APPLICATIONS } from '../src/ecosystem';

let checks = 0;

function verify(condition: unknown, message: string): void {
  assert.ok(condition, message);
  checks += 1;
}

function equal(actual: unknown, expected: unknown, message: string): void {
  assert.deepEqual(actual, expected, message);
  checks += 1;
}

const expectedIds = [
  'gesture-class',
  'lucky-draw',
  'lucky-draw-cards',
  'plicker',
  'learning-wall',
  'head-shake-game',
  'chatbot',
  'exam-manager',
  'secret-box',
  'drag-drop-game',
  'excel-merger',
  'pdf-merger',
];

equal(ECOSYSTEM_APPLICATIONS.length, 12, 'The ecosystem displays exactly twelve applications.');
equal(ECOSYSTEM_APPLICATIONS.map(application => application.id), expectedIds, 'The supported applications remain available in their existing order.');
equal(new Set(ECOSYSTEM_APPLICATIONS.map(application => application.id)).size, 12, 'Application identifiers remain unique.');
verify(ECOSYSTEM_APPLICATIONS.every(application => application.name !== 'GestureCore Edu'), 'The removed application cannot appear in the public catalog.');

const application = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/components/AdminDashboard.tsx', import.meta.url), 'utf8');
const footer = readFileSync(new URL('../src/components/PlatformFooter.tsx', import.meta.url), 'utf8');
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../public/service-worker.js', import.meta.url), 'utf8');
const packageManifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  scripts: Record<string, string>;
};

verify(!/GestureCoreEdu|gesture-core/.test(application), 'The public homepage does not load or route to the removed application.');
verify(!/GestureCoreEdu|gesture-core/.test(dashboard), 'The teacher library does not load or display the removed application.');
verify(!/gesture-core/.test(footer), 'The homepage footer never links to the removed application.');
verify(application.includes('ECOSYSTEM_APPLICATIONS.map(application =>'), 'Every remaining application is shown on the public homepage.');
verify(application.includes('isAvailableApplication'), 'Obsolete browser sessions return safely to the homepage.');
verify(dashboard.includes("lazy(() => import('./GestureClass'))"), 'GestureClass continues to load independently.');
verify(dashboard.includes('>GestureClass</h3>'), 'GestureClass remains visible in the teacher library.');
verify(footer.includes("onOpenProduct('gesture-class')"), 'The footer promotes the supported GestureClass application.');
verify(readme.includes('Danh mục 12 ứng dụng'), 'Project documentation reports twelve available applications.');
verify(!readme.includes('GestureCore Edu'), 'Project documentation does not advertise the removed application.');
verify(serviceWorker.includes('${CACHE_PREFIX}v20'), 'Existing installations refresh their obsolete application catalog.');
verify(!existsSync(new URL('../src/components/GestureCoreEdu.tsx', import.meta.url)), 'The removed application source is no longer distributed.');
verify(!packageManifest.scripts['test:gesture'], 'Package scripts no longer point to deleted GestureCore-only tests.');
verify(packageManifest.scripts['test:catalog'] === 'node --import tsx scripts/test-application-catalog.ts', 'The application catalog has a dedicated regression suite.');
verify(ECOSYSTEM_APPLICATIONS.some(application => application.name === 'Tách, gộp file PDF'), 'The existing PDF split-and-merge tool remains available.');
verify(ECOSYSTEM_APPLICATIONS.some(application => application.name === 'Tương tác thẻ Plicker'), 'Plicker remains available.');

console.info(`Twelve-application catalog and preserved GestureClass: ${checks} checks passed.`);
