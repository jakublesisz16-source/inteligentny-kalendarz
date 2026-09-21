import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const failures = [];
const source = (path) => readFileSync(join(root, path), 'utf8');
const json = (path) => JSON.parse(source(path));
const requireFile = (path) => { if (!existsSync(join(root, path))) failures.push(`missing required checkpoint file: ${path}`); };
const assert = (condition, message) => { if (!condition) failures.push(message); };

for (const path of [
  'CURRENT_PROJECT_RULES.md', 'CURRENT_STATE.json', 'BUILD_INFO.json', 'HANDOFF_NEW_CHAT.md', 'PRIVATE.md',
  'CLEAN_CHECKPOINT_CONTENTS.md', 'package.json', 'package-lock.json', 'src/core/version.ts', 'src/core/build.ts',
  'project-skills/ik-development/SKILL.md', 'project-skills/ik-build-lifecycle/SKILL.md', 'project-skills/ik-private-checkpoint/SKILL.md'
]) requireFile(path);

if (!failures.length) {
  const versionSource = source('src/core/version.ts');
  const buildSource = source('src/core/build.ts');
  const appVersion = /APP_VERSION\s*=\s*'([^']+)'/u.exec(versionSource)?.[1];
  const appBuild = /APP_BUILD\s*=\s*'([^']+)'/u.exec(buildSource)?.[1];
  const schema = Number(/DATABASE_SCHEMA_VERSION\s*=\s*(\d+)/u.exec(versionSource)?.[1]);
  const buildInfo = json('BUILD_INFO.json');
  const state = json('CURRENT_STATE.json');
  const pkg = json('package.json');
  const lock = json('package-lock.json');
  const allowedStatuses = new Set(['candidate', 'source-verified-candidate', 'verified']);
  const versionParts = appVersion?.split('.') ?? [];
  const numericVersion = versionParts.length === 4 && versionParts.every((part) => /^\d+$/u.test(part));
  const expectedReleaseVersion = numericVersion ? versionParts.slice(0, 3).join('.') : undefined;
  const expectedPackageVersion = numericVersion ? `${expectedReleaseVersion}-private.${versionParts[3]}` : undefined;
  const expectedZip = `IK_${appVersion.replace(/\.([0-9]+)$/u, '_BUILD$1')}_PRIVATE.zip`;

  assert(Boolean(appVersion), 'cannot determine APP_VERSION');
  assert(Boolean(appBuild), 'cannot determine APP_BUILD');
  assert(/export const BUILD_NUMBER\s*=\s*APP_BUILD;/u.test(buildSource), 'src/core/build.ts must export BUILD_NUMBER = APP_BUILD for runtime UI imports');
  assert(numericVersion, 'APP_VERSION must use numeric MAJOR.MINOR.STAGE.BUILD');
  assert(versionParts[3] === appBuild, 'APP_VERSION build suffix differs from APP_BUILD');
  assert(buildInfo.appVersion === appVersion && buildInfo.build === appBuild, 'BUILD_INFO identity differs from source');
  assert(buildInfo.versionScheme === 'MAJOR.MINOR.STAGE.BUILD', 'BUILD_INFO versionScheme missing or invalid');
  assert(buildInfo.releaseVersion === expectedReleaseVersion, 'BUILD_INFO releaseVersion differs from MAJOR.MINOR.STAGE');
  assert(buildInfo.packageVersion === pkg.version, 'BUILD_INFO packageVersion differs from package.json');
  assert(pkg.version === expectedPackageVersion, 'package.json version must follow <release>-private.<build>');
  assert(lock.version === pkg.version && lock.packages?.['']?.version === pkg.version, 'package-lock root version differs from package.json');
  assert(buildInfo.status === state.status, 'BUILD_INFO status differs from CURRENT_STATE');
  assert(allowedStatuses.has(state.status), `unsupported checkpoint status: ${state.status}`);
  assert(state.version === appVersion && String(state.build) === appBuild, 'CURRENT_STATE version/build differs from source');
  assert(state.versionScheme === 'MAJOR.MINOR.STAGE.BUILD', 'CURRENT_STATE versionScheme missing or invalid');
  assert(state.releaseVersion === expectedReleaseVersion, 'CURRENT_STATE releaseVersion differs from MAJOR.MINOR.STAGE');
  assert(state.versionPolicy?.normalUpdate === 'increment-build', 'CURRENT_STATE normal version policy missing');
  assert(state.versionPolicy?.stageUpdate === 'increment-stage-reset-build-0', 'CURRENT_STATE stage version policy missing');
  assert(state.versionPolicy?.minorUpdate === 'increment-minor-reset-stage-build-0', 'CURRENT_STATE minor version policy missing');
  assert(state.versionPolicy?.majorUpdate === 'increment-major-reset-minor-stage-build-0', 'CURRENT_STATE major version policy missing');
  assert(state.versionPolicy?.noFileChange === 'keep-version', 'CURRENT_STATE no-file-change version policy missing');
  assert(state.workflowPolicy?.developmentSource === 'private-only', 'CURRENT_STATE workflowPolicy developmentSource missing');
  assert(state.workflowPolicy?.testCadence === 'impact-based-during-development-full-once-before-release', 'CURRENT_STATE workflowPolicy testCadence missing');
  assert(state.workflowPolicy?.publicGeneration === 'clean-from-frozen-private', 'CURRENT_STATE workflowPolicy publicGeneration missing');
  assert(state.workflowPolicy?.publicHandoff === 'final-only-after-fresh-public-validation', 'CURRENT_STATE workflowPolicy publicHandoff missing');
  assert(state.workflowPolicy?.userPublish === 'fetch-sync-copy-stage-commit-push', 'CURRENT_STATE workflowPolicy userPublish missing');
  assert(state.workflowPolicy?.repeatLocalFullPublicCheck === 'skip-if-exact-validated-public-unchanged', 'CURRENT_STATE workflowPolicy repeatLocalFullPublicCheck missing');
  assert(state.workflowPolicy?.githubCi === 'independent-final-validation', 'CURRENT_STATE workflowPolicy githubCi missing');
  assert(Number(state.schema) === schema, 'CURRENT_STATE schema differs from source');
  assert(state.channel === 'private', 'CURRENT_STATE channel must be private');
  assert(state.continuationArtifact === expectedZip, `CURRENT_STATE continuationArtifact must be ${expectedZip}`);
  assert(typeof state.verifiedBaseline === 'string' && state.verifiedBaseline.length > 0, 'CURRENT_STATE verifiedBaseline missing');
  assert(typeof state.scope === 'string' && state.scope.trim().length >= 3, 'CURRENT_STATE scope missing');
  assert(typeof state.nextAction === 'string' && state.nextAction.trim().length >= 8, 'CURRENT_STATE nextAction missing');
  assert(Array.isArray(state.completedGates), 'CURRENT_STATE completedGates must be an array');
  assert(Array.isArray(state.pendingGates), 'CURRENT_STATE pendingGates must be an array');
  assert(Array.isArray(state.deferredReleaseGates), 'CURRENT_STATE deferredReleaseGates must be an array');
  assert(Array.isArray(state.pendingFiles), 'CURRENT_STATE pendingFiles must be an array');
  if (state.status === 'verified') {
    assert(state.pendingGates.length === 0, 'VERIFIED checkpoint cannot have pending build-scope gates');
    assert(state.pendingFiles.length === 0, 'VERIFIED checkpoint cannot have pending files');
    assert(state.verifiedBaseline === state.continuationArtifact, 'VERIFIED checkpoint must be its own verified baseline');
  }
  assert(source('HANDOFF_NEW_CHAT.md').includes(`1.2.0 Build ${appBuild}`), 'HANDOFF_NEW_CHAT is not synchronized with APP_BUILD');
  assert(source('PRIVATE.md').includes(`Build ${appBuild}`), 'PRIVATE.md is not synchronized with APP_BUILD');
  assert(source('CURRENT_PROJECT_RULES.md').includes(`prywatny ${appVersion}`), 'CURRENT_PROJECT_RULES current version heading is not synchronized');
}

if (failures.length) {
  for (const failure of failures) console.error(`CHECKPOINT_STATE_GATE_FAIL: ${failure}`);
  process.exit(1);
}
console.log('CHECKPOINT_STATE_GATE_OK');
