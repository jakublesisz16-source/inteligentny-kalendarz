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
const currentBuild = Number(current.build);
if (!Number.isInteger(currentBuild)) throw new Error('CHANNEL_MONOTONICITY_GATE_FAIL: current build is not numeric');

function gitShow(path) {
  const result = spawnSync('git', ['show', `HEAD^:${path}`], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout : null;
}

let previousBuild = null;
let previousBuildId = null;
const previousInfoRaw = gitShow('CHANNEL_BUILD_INFO.json');
if (previousInfoRaw) {
  const previousInfo = JSON.parse(previousInfoRaw);
  previousBuild = Number(previousInfo.build);
  previousBuildId = previousInfo.buildId ?? null;
} else {
  const previousPackageRaw = gitShow('package.json');
  if (previousPackageRaw) {
    const previousPackage = JSON.parse(previousPackageRaw);
    const match = /-private\.(\d+)$/u.exec(previousPackage.version ?? '');
    if (match) previousBuild = Number(match[1]);
  }
}

if (!Number.isInteger(previousBuild)) {
  console.log('CHANNEL_MONOTONICITY_GATE_SKIP no-readable-parent-build');
  process.exit(0);
}
if (currentBuild <= previousBuild) {
  const detail = currentBuild === previousBuild && previousBuildId && previousBuildId !== current.buildId
    ? ` duplicate build ${currentBuild} has different buildId (${previousBuildId} -> ${current.buildId})`
    : ` current build ${currentBuild} must be greater than parent build ${previousBuild}`;
  console.error(`CHANNEL_MONOTONICITY_GATE_FAIL:${detail}`);
  process.exit(1);
}
console.log(`CHANNEL_MONOTONICITY_GATE_OK ${previousBuild}->${currentBuild}`);
