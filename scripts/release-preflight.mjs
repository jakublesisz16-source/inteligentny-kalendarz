import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const privatePrepMode = existsSync(join(root, 'README_GITHUB.md')) || existsSync(join(root, 'RELEASE_CHECKLIST.md'));
const source = (path) => readFileSync(join(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(join(root, path))) failures.push(`missing required release-prep file: ${path}`);
};
const requireText = (text, needle, label) => {
  if (!text.includes(needle)) failures.push(label);
};

for (const path of [
  '.gitignore',
  '.github/workflows/ci.yml',
  'package.json',
  'src/core/version.ts',
  'public/manifest.webmanifest',
  'public/service-worker.js',
  'scripts/public-package-gate.mjs',
]) requireFile(path);

if (privatePrepMode) {
  for (const path of [
    'RELEASE_CHECKLIST.md',
    'BUILD_INFO.json',
    'scripts/prepare-github-source.mjs',
    'README_GITHUB.md',
    'docs/ARCHITECTURE_GITHUB.md',
    'docs/PRIVACY_GITHUB.md',
  ]) requireFile(path);
}

if (!failures.length) {
  const gitignore = source('.gitignore');
  for (const pattern of [
    'node_modules/', 'dist/', '*.zip', '*.xlsx', '*.xls', '*.pdf', '*.ikbackup',
    '.env', '.env.*', '*.log', '.vite/', '.cache/', 'test-results/', 'playwright-report/',
    'PRIVATE_*.md', 'HANDOFF_NEW_CHAT_*.md', 'CURRENT_PROJECT_RULES.md', 'project-skills/'
  ]) requireText(gitignore, pattern, `.gitignore missing release-safety pattern: ${pattern}`);

  const packageJson = JSON.parse(source('package.json'));
  for (const script of ['check', 'security:public', 'security:dependencies', 'release:preflight']) {
    if (!packageJson.scripts?.[script]) failures.push(`package.json missing script: ${script}`);
  }
  if (privatePrepMode && !packageJson.scripts?.['release:github-prep']) failures.push('package.json missing script: release:github-prep');

  const versionSource = source('src/core/version.ts');
  const version = /APP_VERSION\s*=\s*'([^']+)'/u.exec(versionSource)?.[1];
  if (!version) failures.push('cannot determine APP_VERSION');
  if (existsSync(join(root, 'BUILD_INFO.json'))) {
    const buildInfo = JSON.parse(source('BUILD_INFO.json'));
    if (version && buildInfo.appVersion !== version) failures.push('BUILD_INFO.json appVersion differs from APP_VERSION');
  }
  if (version && !source('public/service-worker.js').includes(`v${version}\``)) failures.push('Service Worker cache revision differs from APP_VERSION');

  const publicGate = source('scripts/public-package-gate.mjs');
  requireText(publicGate, 'forbiddenPrivateDocPatterns', 'public package gate must reject private checkpoint documents');
  requireText(publicGate, 'HANDOFF_NEW_CHAT_', 'public package gate must reject handoff documents');
  requireText(publicGate, 'allowedPublicImages', 'public package gate must allowlist product images');
  requireText(publicGate, 'unapproved image/media file', 'public package gate must reject accidental screenshots/media');

  if (privatePrepMode) {
    const githubPrep = source('scripts/prepare-github-source.mjs');
    requireText(githubPrep, 'README_GITHUB.md', 'GitHub prep must replace the private README with the public template');
    requireText(githubPrep, 'project-skills', 'GitHub prep must exclude internal project skills');
    requireText(githubPrep, 'CURRENT_PROJECT_RULES.md', 'GitHub prep must exclude private project rules');
    requireText(githubPrep, 'ARCHITECTURE_GITHUB.md', 'GitHub prep must replace historical architecture docs');
    requireText(githubPrep, 'PRIVACY_GITHUB.md', 'GitHub prep must replace historical privacy docs');
  }

  const ci = source('.github/workflows/ci.yml');
  requireText(ci, 'npm ci', 'CI must install the exact lockfile with npm ci');
  requireText(ci, 'npm run release:preflight', 'CI must run release preflight');
  requireText(ci, 'npm run check', 'CI must run the full project check');
  requireText(ci, 'npm run security:dependencies', 'CI must run production dependency audit');

  if (privatePrepMode) {
    const checklist = source('RELEASE_CHECKLIST.md');
    requireText(checklist, 'GitHub Desktop', 'release checklist must cover GitHub Desktop review');
    requireText(checklist, 'Visual QA', 'release checklist must cover visual QA');
    requireText(checklist, 'SHA256', 'release checklist must cover final SHA256');
    requireText(checklist, 'LICENSE', 'release checklist must require an explicit license decision');
    requireText(checklist, 'release:github-prep', 'release checklist must cover automated GitHub sanitization');
  }

  const rootNames = readdirSync(root);
  if (!privatePrepMode && rootNames.some((name) => /^(?:PRIVATE_|HANDOFF_NEW_CHAT_)/u.test(name) || name === 'CLEAN_CHECKPOINT_CONTENTS.md')) failures.push('sanitized repository contains private checkpoint documents');
  if (rootNames.some((name) => /\.(?:xlsx?|pdf|ikbackup|zip)$/iu.test(name))) failures.push('clean checkpoint root contains a private/generated data file');
}

if (failures.length) {
  for (const failure of failures) console.error(`RELEASE_PREFLIGHT_PREP_FAIL: ${failure}`);
  process.exit(1);
}
console.log('RELEASE_PREFLIGHT_PREP_OK');
