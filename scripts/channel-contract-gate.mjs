import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { calculateChannelFingerprint } from './channel-fingerprint.mjs';

const root = resolve(process.argv[2] ?? '.');
const failures = [];
const read = (path) => readFileSync(join(root, path), 'utf8').replace(/\r\n?/gu, '\n');
const json = (path) => JSON.parse(read(path));
const assert = (condition, message) => { if (!condition) failures.push(message); };

for (const path of ['CHANNEL_BUILD_INFO.json', 'package.json', 'src/core/version.ts', 'src/core/build.ts', 'public/service-worker.js']) {
  assert(existsSync(join(root, path)), `missing required channel file: ${path}`);
}

if (!failures.length) {
  const info = json('CHANNEL_BUILD_INFO.json');
  const pkg = json('package.json');
  const versionSource = read('src/core/version.ts');
  const buildSource = read('src/core/build.ts');
  const serviceWorker = read('public/service-worker.js');
  const appVersion = /APP_VERSION\s*=\s*'([^']+)'/u.exec(versionSource)?.[1];
  const appBuild = /APP_BUILD\s*=\s*'([^']+)'/u.exec(buildSource)?.[1];
  const releaseVersion = appVersion?.split('.').slice(0, -1).join('.');
  const expectedPackageVersion = appVersion ? `${releaseVersion}-private.${appBuild}` : null;
  const { fingerprint, fileCount } = calculateChannelFingerprint(root);

  assert(info.source === 'PRIVATE', 'channel source must be PRIVATE');
  assert(info.surface === 'public-stable', `unknown channel surface: ${info.surface}`);
  assert(typeof info.buildId === 'string' && info.buildId.length >= 12, 'buildId missing or too short');
  assert(info.appVersion === appVersion, 'CHANNEL_BUILD_INFO appVersion differs from source');
  assert(String(info.build) === String(appBuild), 'CHANNEL_BUILD_INFO build differs from source');
  assert(info.releaseVersion === releaseVersion, 'CHANNEL_BUILD_INFO releaseVersion differs from source');
  assert(info.packageVersion === pkg.version, 'CHANNEL_BUILD_INFO packageVersion differs from package.json');
  assert(pkg.version === expectedPackageVersion, 'package.json version differs from source build');
  assert(serviceWorker.includes(`v${appVersion}`), 'service-worker cache version differs from APP_VERSION');
  assert(info.contentFingerprint === fingerprint, 'CHANNEL_BUILD_INFO contentFingerprint differs from exact channel tree');
  assert(Number(info.fileCount) === fileCount, 'CHANNEL_BUILD_INFO fileCount differs from exact channel tree');

}

if (failures.length) {
  for (const failure of [...new Set(failures)]) console.error(`CHANNEL_CONTRACT_GATE_FAIL: ${failure}`);
  process.exit(1);
}
console.log('CHANNEL_CONTRACT_GATE_OK');
