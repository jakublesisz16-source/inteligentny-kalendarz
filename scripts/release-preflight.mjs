import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { PUBLIC_PACKAGE_SCRIPTS, PUBLIC_SCRIPT_FILES, PUBLIC_WORKFLOW_FILES } from './public-surface-contract.mjs';

const root = process.cwd();
const failures = [];
const source = (path) => readFileSync(join(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(join(root, path))) failures.push(`missing required release file: ${path}`); };
const requireText = (text, needle, label) => { if (!text.includes(needle)) failures.push(label); };
const isPrivate = existsSync(join(root, 'BUILD_INFO.json'));
const channelInfoPath = join(root, 'CHANNEL_BUILD_INFO.json');
const channelInfo = !isPrivate && existsSync(channelInfoPath) ? JSON.parse(source('CHANNEL_BUILD_INFO.json')) : null;
const channelSurface = channelInfo?.surface ?? null;
const isPublicStable = !isPrivate && channelSurface === 'public-stable';

for (const path of [
  ...PUBLIC_WORKFLOW_FILES,
  'package.json', 'package-lock.json', 'index.html', 'vite.config.ts',
  'src/core/version.ts', 'public/manifest.webmanifest', 'public/service-worker.js',
  'vitest.public.config.ts', ...PUBLIC_SCRIPT_FILES,
]) requireFile(path);

if (isPrivate) {
  for (const path of [
    'CURRENT_PROJECT_RULES.md', 'CURRENT_STATE.json', 'HANDOFF_NEW_CHAT.md', 'PRIVATE.md',
    'BUILD_INFO.json', 'CLEAN_CHECKPOINT_CONTENTS.md', 'docs/PROJECT_LEDGER.md',
    'docs/PROJECT_FILE_INVENTORY.md', 'scripts/prepare-public-release.mjs',
    'scripts/checkpoint-state-gate.mjs', 'scripts/checkpoint-manifest.mjs', 'scripts/checkpoint-gate.mjs',
    'vitest.private.config.ts',
  ]) requireFile(path);
}

if (!isPrivate) {
  requireFile('CHANNEL_BUILD_INFO.json');
  if (!isPublicStable) failures.push(`unknown or missing release channel surface: ${channelSurface ?? 'none'}`);
}


if (isPublicStable) {
  for (const path of ['SYNC_PREVIEW_INFO.json', 'firebase.sync-lab.json', '.github/workflows/firebase-sync-preview.yml']) {
    if (existsSync(join(root, path))) failures.push(`PUBLIC STABLE contains Sync Preview-only file: ${path}`);
  }
}

if (!failures.length) {
  const packageJson = JSON.parse(source('package.json'));
  const requiredScripts = isPrivate
    ? [...PUBLIC_PACKAGE_SCRIPTS, 'test:private', 'checkpoint:state', 'checkpoint:hygiene', 'checkpoint:manifest', 'checkpoint:gate', 'release:public:prepare', 'study:current-source:qa']
    : [...PUBLIC_PACKAGE_SCRIPTS];
  for (const script of requiredScripts) if (!packageJson.scripts?.[script]) failures.push(`package.json missing script: ${script}`);

  if (!isPrivate) {
    for (const script of Object.keys(packageJson.scripts ?? {})) {
      if (!PUBLIC_PACKAGE_SCRIPTS.has(script)) failures.push(`PUBLIC package.json exposes non-public script: ${script}`);
    }
  }

  const versionSource = source('src/core/version.ts');
  const version = /APP_VERSION\s*=\s*'([^']+)'/u.exec(versionSource)?.[1];
  if (!version) failures.push('cannot determine APP_VERSION');
  if (version && !source('public/service-worker.js').includes(`v${version}\``)) failures.push('Service Worker cache revision differs from APP_VERSION');

  const publicGate = source('scripts/public-package-gate.mjs');
  requireText(publicGate, 'minimal PUBLIC allowlist', 'public package gate must enforce the minimal PUBLIC allowlist');
  requireText(publicGate, 'forbiddenPrivateDocPatterns', 'public package gate must reject private/informational documents');
  requireText(publicGate, 'allowedPublicImages', 'public package gate must allowlist product images');

  const ci = source('.github/workflows/ci.yml');
  requireText(ci, 'npm ci', 'CI must install the exact lockfile with npm ci');
  requireText(ci, 'npm run release:preflight', 'CI must run release preflight');
  requireText(ci, 'npm run security:public', 'CI must run PUBLIC repository safety');
  requireText(ci, 'npm run check:public', 'CI must run the public typecheck/tests/build');
  requireText(ci, 'npm run security:dependencies', 'CI must run production dependency audit');

  const pages = source('.github/workflows/pages.yml');
  requireText(pages, 'branches: ["main"]', 'GitHub Pages deployment must be triggered by pushes to main');
  requireText(pages, 'npm run check', 'GitHub Pages build must execute the full public project check');
  requireText(pages, 'path: ./dist', 'GitHub Pages workflow must publish the production dist directory');

}

if (failures.length) {
  for (const failure of failures) console.error(`RELEASE_PREFLIGHT_PREP_FAIL: ${failure}`);
  process.exit(1);
}
console.log(`RELEASE_PREFLIGHT_PREP_OK mode=${isPrivate ? 'PRIVATE' : 'PUBLIC'}`);
