import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'coverage', '.cache', '.vite', '.benchmark-dist']);
const SKIP_FILES = new Set(['CHANNEL_BUILD_INFO.json']);
const unix = (value) => value.split(sep).join('/');

function walk(root, dir = root) {
  const files = [];
  for (const name of readdirSync(dir).sort((a, b) => a.localeCompare(b, 'en'))) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(root, full));
    else {
      const rel = unix(relative(root, full));
      if (!SKIP_FILES.has(rel)) files.push({ full, rel });
    }
  }
  return files;
}

export function calculateChannelFingerprint(targetRoot) {
  const root = resolve(targetRoot);
  const digest = createHash('sha256');
  const files = walk(root);
  for (const { full, rel } of files) {
    const contentHash = createHash('sha256').update(readFileSync(full)).digest('hex');
    digest.update(`${rel}\0${contentHash}\n`);
  }
  return { fingerprint: digest.digest('hex'), fileCount: files.length };
}
