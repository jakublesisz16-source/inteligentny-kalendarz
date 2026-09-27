import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const statePath = join(root, 'CURRENT_STATE.json');
if (!existsSync(statePath)) {
  console.error('STUDY_CURRENT_SOURCE_AUDIT_FAIL: CURRENT_STATE.json is required. Run this from a PRIVATE checkpoint.');
  process.exit(1);
}
const state = JSON.parse(readFileSync(statePath, 'utf8'));
const fixture = join(root, 'private-fixtures', 'study', state.activeStudySource);
if (!existsSync(fixture)) {
  console.error(`STUDY_CURRENT_SOURCE_AUDIT_FAIL: missing ${fixture}`);
  process.exit(1);
}
const bytes = readFileSync(fixture);
const hash = createHash('sha256').update(bytes).digest('hex');
if (hash !== String(state.activeStudySourceFingerprint?.sha256 ?? '').toLowerCase()) {
  console.error(`STUDY_CURRENT_SOURCE_AUDIT_FAIL: SHA-256 mismatch ${hash}`);
  process.exit(1);
}
const vitestEntry = join(root, 'node_modules', 'vitest', 'vitest.mjs');
if (!existsSync(vitestEntry)) {
  console.error('STUDY_CURRENT_SOURCE_AUDIT_FAIL: node_modules/vitest is missing. Run npm ci first.');
  process.exit(1);
}
const result = spawnSync(process.execPath, [
  vitestEntry,
  'run', '--config', 'vitest.public.config.ts',
  'src/tests/study-source-audit.optional.test.ts', '--reporter=verbose',
], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit',
  env: {
    ...process.env,
    IK_STUDY_XLS_PATH: fixture,
    IK_STUDY_XLS_SHA256: hash,
  },
});
process.exit(result.status ?? 1);
