import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const failures = [];
const source = (path) => readFileSync(join(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(join(root, path))) failures.push(`missing required release file: ${path}`);
};
const requireText = (text, needle, label) => {
  if (!text.includes(needle)) failures.push(label);
};

function filesUnder(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) result.push(...filesUnder(full));
    else result.push(full);
  }
  return result;
}

for (const path of [
  '.gitignore',
  '.github/workflows/ci.yml',
  '.github/workflows/pages.yml',
  'package.json',
  'src/core/version.ts',
  'public/manifest.webmanifest',
  'public/service-worker.js',
  'scripts/public-package-gate.mjs',
  'scripts/local-release.mjs',
  'scripts/checkpoint-state-gate.mjs',
  'scripts/checkpoint-manifest.mjs',
  'scripts/checkpoint-gate.mjs',
  'scripts/study-mobile-smoke.mjs',
  'vitest.public.config.ts',
  'vitest.private.config.ts',
]) requireFile(path);

if (!failures.length) {
  const gitignore = source('.gitignore');
  for (const pattern of [
    'node_modules/', 'dist/', '*.zip', '*.xlsx', '*.xls', '*.pdf', '*.ikbackup',
    '.env', '.env.*', '*.log', '.vite/', '.cache/', 'test-results/', 'playwright-report/',
    '_LOCAL_ONLY/', '_PRIVATE_HISTORY/', 'PRIVATE.md', 'PRIVATE_*.md', 'HANDOFF_NEW_CHAT.md', 'HANDOFF_NEW_CHAT_*.md',
    'CURRENT_PROJECT_RULES.md', 'CURRENT_STATE.json', 'BUILD_INFO.json', 'CHECKPOINT_MANIFEST.sha256', 'project-skills/'
  ]) requireText(gitignore, pattern, `.gitignore missing release-safety pattern: ${pattern}`);

  const packageJson = JSON.parse(source('package.json'));
  for (const script of [
    'check', 'check:public', 'test:public', 'test:private', 'security:public',
    'security:dependencies', 'release:preflight', 'release:local', 'study:mobile-smoke', 'checkpoint:state', 'checkpoint:manifest', 'checkpoint:gate'
  ]) {
    if (!packageJson.scripts?.[script]) failures.push(`package.json missing script: ${script}`);
  }

  const versionSource = source('src/core/version.ts');
  const version = /APP_VERSION\s*=\s*'([^']+)'/u.exec(versionSource)?.[1];
  if (!version) failures.push('cannot determine APP_VERSION');
  if (version && !source('public/service-worker.js').includes(`v${version}\``)) failures.push('Service Worker cache revision differs from APP_VERSION');

  const publicGate = source('scripts/public-package-gate.mjs');
  requireText(publicGate, 'gitTrackedFiles', 'public package gate must support a live Git working tree');
  requireText(publicGate, '_LOCAL_ONLY', 'public package gate must reject tracked local-only content');
  requireText(publicGate, 'forbiddenPrivateDocPatterns', 'public package gate must reject private checkpoint documents');
  requireText(publicGate, 'allowedPublicImages', 'public package gate must allowlist product images');
  requireText(publicGate, 'unapproved image/media file', 'public package gate must reject accidental screenshots/media');

  const publicTests = source('vitest.public.config.ts');
  const privateTests = source('vitest.private.config.ts');
  requireText(publicTests, '_PRIVATE_HISTORY', 'public test configuration must document private fixture isolation');
  const fixtureDependentTests = filesUnder(join(root, 'src', 'tests'))
    .filter((path) => path.endsWith('.test.ts') && readFileSync(path, 'utf8').includes('_PRIVATE_HISTORY'))
    .map((path) => relative(root, path).split(sep).join('/'));
  for (const testPath of fixtureDependentTests) {
    requireText(publicTests, testPath, `public test configuration does not exclude private fixture suite: ${testPath}`);
    requireText(privateTests, testPath, `private test configuration does not include private fixture suite: ${testPath}`);
  }

  const localRelease = source('scripts/local-release.mjs');
  requireText(localRelease, "branch !== 'main'", 'local release must require the main branch');
  requireText(localRelease, 'working tree is not clean', 'local release must require a clean working tree');
  requireText(localRelease, "['run', 'security:public']", 'local release must run the public repository safety gate');
  requireText(localRelease, "['run', 'check:public']", 'local release must run the complete public check');

  const ci = source('.github/workflows/ci.yml');
  requireText(ci, 'npm ci', 'CI must install the exact lockfile with npm ci');
  requireText(ci, 'npm run release:preflight', 'CI must run release preflight');
  requireText(ci, 'npm run security:public', 'CI must run public repository safety checks');
  requireText(ci, 'npm run check:public', 'CI must run the public typecheck/tests/build');
  requireText(ci, 'npm run security:dependencies', 'CI must run production dependency audit');

  const pages = source('.github/workflows/pages.yml');
  requireText(pages, 'name: Deploy GitHub Pages', 'GitHub Pages deployment workflow has an unexpected identity');
  requireText(pages, 'branches: ["main"]', 'GitHub Pages deployment must be triggered by pushes to main');
  requireText(pages, 'pages: write', 'GitHub Pages deployment must have pages: write permission');
  requireText(pages, 'id-token: write', 'GitHub Pages deployment must have id-token: write permission');
  requireText(pages, 'npm ci', 'GitHub Pages build must install the exact lockfile with npm ci');
  requireText(pages, 'npm run check', 'GitHub Pages build must execute the full project check');
  requireText(pages, 'actions/upload-pages-artifact@v3', 'GitHub Pages workflow must upload a Pages artifact');
  requireText(pages, 'path: ./dist', 'GitHub Pages workflow must publish the production dist directory');
  requireText(pages, 'actions/deploy-pages@v4', 'GitHub Pages workflow must deploy through actions/deploy-pages');
}

if (failures.length) {
  for (const failure of failures) console.error(`RELEASE_PREFLIGHT_PREP_FAIL: ${failure}`);
  process.exit(1);
}
console.log('RELEASE_PREFLIGHT_PREP_OK');
