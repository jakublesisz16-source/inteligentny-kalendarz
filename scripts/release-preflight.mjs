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
const isSyncPreview = !isPrivate && channelSurface === 'sync-preview';
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
  if (!isSyncPreview && !isPublicStable) failures.push(`unknown or missing release channel surface: ${channelSurface ?? 'none'}`);
}

if (isSyncPreview) {
  for (const path of ['SYNC_PREVIEW_INFO.json', 'firebase.sync-lab.json', '.github/workflows/firebase-sync-preview.yml']) requireFile(path);
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
    : isSyncPreview
      ? [...PUBLIC_PACKAGE_SCRIPTS, 'security:sync-preview']
      : [...PUBLIC_PACKAGE_SCRIPTS];
  for (const script of requiredScripts) if (!packageJson.scripts?.[script]) failures.push(`package.json missing script: ${script}`);

  if (!isPrivate) {
    const allowedChannelScripts = new Set(PUBLIC_PACKAGE_SCRIPTS);
    if (isSyncPreview) allowedChannelScripts.add('security:sync-preview');
    for (const script of Object.keys(packageJson.scripts ?? {})) {
      if (!allowedChannelScripts.has(script)) failures.push(`${isSyncPreview ? 'SYNC PREVIEW' : 'PUBLIC'} package.json exposes non-channel script: ${script}`);
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
  requireText(ci, 'CHANNEL_BUILD_INFO.json', 'CI must route repository safety from the exact channel identity');
  requireText(ci, 'npm run security:public', 'CI must retain PUBLIC STABLE repository safety');
  requireText(ci, 'npm run security:sync-preview', 'CI must route Sync Preview through its bounded package safety gate');
  requireText(ci, 'Unknown channel surface', 'CI channel safety routing must fail closed for unknown surfaces');
  requireText(ci, 'npm run check:public', 'CI must run the public typecheck/tests/build');
  requireText(ci, 'npm run security:dependencies', 'CI must run production dependency audit');

  const pages = source('.github/workflows/pages.yml');
  requireText(pages, 'branches: ["main"]', 'GitHub Pages deployment must be triggered by pushes to main');
  requireText(pages, 'npm run check', 'GitHub Pages build must execute the full public project check');
  requireText(pages, 'path: ./dist', 'GitHub Pages workflow must publish the production dist directory');


  if (isSyncPreview) {
    const syncWorkflow = source('.github/workflows/firebase-sync-preview.yml');
    requireText(syncWorkflow, 'branches: ["feature/cloud-sync-poc"]', 'Sync Preview deploy must trigger only from feature/cloud-sync-poc');
    requireText(syncWorkflow, 'npm run security:sync-preview', 'Sync Preview deploy must run sync-preview package safety');
    requireText(syncWorkflow, 'npm run check:public', 'Sync Preview deploy must run public typecheck/tests/build');
    requireText(syncWorkflow, 'FIREBASE_SERVICE_ACCOUNT_INTELIGENTNY_KALENDARZ_S_2CFC9', 'Sync Preview deploy must use the bounded Firebase service-account secret');
    requireText(syncWorkflow, 'projectId: inteligentny-kalendarz-s-2cfc9', 'Sync Preview deploy must target the staging Firebase project');
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`RELEASE_PREFLIGHT_PREP_FAIL: ${failure}`);
  process.exit(1);
}
console.log(`RELEASE_PREFLIGHT_PREP_OK mode=${isPrivate ? 'PRIVATE' : isSyncPreview ? 'SYNC_PREVIEW' : 'PUBLIC'}`);
