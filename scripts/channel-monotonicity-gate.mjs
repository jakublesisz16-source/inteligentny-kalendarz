import { compareAppVersions } from './version-identity.mjs';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const event = process.env.GITHUB_EVENT_NAME ?? '';
if (event && event !== 'push') {
  console.log(`CHANNEL_MONOTONICITY_GATE_SKIP event=${event}`);
  process.exit(0);
}
if (!existsSync('.git') || !existsSync('CHANNEL_BUILD_INFO.json')) {
  console.log('CHANNEL_MONOTONICITY_GATE_SKIP no-git-or-channel-info');
  process.exit(0);
}

const current = JSON.parse(readFileSync('CHANNEL_BUILD_INFO.json', 'utf8'));
const currentVersion = current.appVersion;

function gitShow(path) {
  const result = spawnSync('git', ['show', `HEAD^:${path}`], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout : null;
}

let previousVersion = null;
let previousBuildId = null;
const previousInfoRaw = gitShow('CHANNEL_BUILD_INFO.json');
if (previousInfoRaw) {
  const previousInfo = JSON.parse(previousInfoRaw);
  previousVersion = previousInfo.appVersion ?? null;
  previousBuildId = previousInfo.buildId ?? null;
} else {
  const previousPackageRaw = gitShow('package.json');
  if (previousPackageRaw) {
    const previousPackage = JSON.parse(previousPackageRaw);
    previousVersion = /^(\d+\.\d+\.\d+)(?:-private\.\d+)?$/u.exec(previousPackage.version ?? '')?.[1] ?? null;
  }
}

// Historical releases may use four-part strings. Map them only for ordering across the format change:
// 1.2.0.350 < 1.2.501; do not silently accept unparsable unknown revisions.
function normalizeLegacyVersion(value) {
  if (typeof value === 'string' && /^\d+\.\d+\.\d+\.\d+$/u.test(value)) {
    const [major, minor, , build] = value.split('.');
    return `${major}.${minor}.${build}`;
  }
  return value;
}
if (!previousVersion) {
  console.log('CHANNEL_MONOTONICITY_GATE_SKIP no-readable-parent-version');
  process.exit(0);
}
const previousNormalized = normalizeLegacyVersion(previousVersion);
const order = compareAppVersions(currentVersion, previousNormalized);
if (order <= 0) {
  const detail = order === 0 && previousBuildId && previousBuildId !== current.buildId
    ? `duplicate version ${currentVersion} has different buildId`
    : `current version ${currentVersion} must exceed parent ${previousVersion}`;
  console.error(`CHANNEL_MONOTONICITY_GATE_FAIL: ${detail}`);
  process.exit(1);
}
console.log(`CHANNEL_MONOTONICITY_GATE_OK ${previousVersion}->${currentVersion}`);
