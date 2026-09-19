import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const manifestName = 'CHECKPOINT_MANIFEST.sha256';
const failures = [];
const unix = (value) => value.split(sep).join('/');

const stateGate = spawnSync(process.execPath, ['scripts/checkpoint-state-gate.mjs'], { cwd: root, encoding: 'utf8' });
if (stateGate.status !== 0) failures.push((stateGate.stderr || stateGate.stdout || 'checkpoint state gate failed').trim());

const forbiddenDirs = new Set(['node_modules', 'dist', 'coverage', '.git', '.benchmark-dist', '_PRIVATE_HISTORY', '_LOCAL_ONLY']);
const forbiddenExt = new Set(['.zip', '.7z', '.rar', '.xls', '.xlsx', '.pdf', '.ikbackup', '.tsbuildinfo', '.log', '.tmp', '.orig', '.rej']);

function filesUnder(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = unix(relative(root, full));
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (forbiddenDirs.has(name)) failures.push(`forbidden checkpoint directory: ${rel}`);
      else result.push(...filesUnder(full));
    } else {
      const dot = name.lastIndexOf('.');
      const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
      if (forbiddenExt.has(ext)) failures.push(`forbidden checkpoint file: ${rel}`);
      result.push(full);
    }
  }
  return result;
}

const files = filesUnder(root).map((full) => ({ full, rel: unix(relative(root, full)) }));
const handoffs = files.filter(({ rel }) => /^HANDOFF_NEW_CHAT(?:_.*)?\.md$/u.test(rel));
const privateNotes = files.filter(({ rel }) => /^PRIVATE(?:_.*)?\.md$/u.test(rel));
if (handoffs.length !== 1 || handoffs[0]?.rel !== 'HANDOFF_NEW_CHAT.md') failures.push('root must contain exactly one HANDOFF_NEW_CHAT.md');
if (privateNotes.length !== 1 || privateNotes[0]?.rel !== 'PRIVATE.md') failures.push('root must contain exactly one PRIVATE.md');

if (!existsSync(join(root, manifestName))) failures.push(`missing ${manifestName}`);
else {
  const manifestLines = readFileSync(join(root, manifestName), 'utf8').split(/\r?\n/u).filter(Boolean);
  const expectedFiles = files.filter(({ rel }) => rel !== manifestName).sort((a, b) => a.rel.localeCompare(b.rel, 'en'));
  const entries = new Map();
  for (const line of manifestLines) {
    const match = /^([a-f0-9]{64})\s{2}\.\/(.+)$/u.exec(line);
    if (!match) { failures.push(`invalid manifest line: ${line}`); continue; }
    entries.set(match[2], match[1]);
  }
  if (entries.size !== expectedFiles.length) failures.push(`manifest file count ${entries.size} differs from checkpoint file count ${expectedFiles.length}`);
  for (const { full, rel } of expectedFiles) {
    const expected = entries.get(rel);
    if (!expected) { failures.push(`manifest missing file: ${rel}`); continue; }
    const actual = createHash('sha256').update(readFileSync(full)).digest('hex');
    if (actual !== expected) failures.push(`manifest hash mismatch: ${rel}`);
  }
  for (const rel of entries.keys()) if (!expectedFiles.some((item) => item.rel === rel)) failures.push(`manifest contains missing/extra file: ${rel}`);
}

if (failures.length) {
  for (const failure of [...new Set(failures)]) console.error(`PRIVATE_CHECKPOINT_GATE_FAIL: ${failure}`);
  process.exit(1);
}
console.log(`PRIVATE_CHECKPOINT_GATE_OK files=${files.length - 1}`);
