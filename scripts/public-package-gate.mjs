import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';

const target = resolve(process.argv[2] ?? '.');
const forbiddenDirs = new Set(['_PRIVATE_HISTORY', '_LOCAL_ONLY', 'project-skills', '.git', 'node_modules', 'dist', 'coverage', '.benchmark-dist']);
const forbiddenExtensions = new Set(['.xls', '.xlsx', '.pdf', '.ikbackup', '.zip', '.7z', '.rar', '.bak', '.tmp', '.log', '.map', '.pem', '.key', '.p12', '.pfx', '.jks', '.keystore']);
const privateMediaExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.heic', '.avif', '.gif', '.bmp', '.tif', '.tiff', '.mp4', '.mov', '.m4v', '.webm', '.mp3', '.wav', '.m4a', '.ogg']);
const allowedPublicImages = new Set([
  'public/apple-touch-icon-v1203.png',
  'public/icon-192-v1203.png',
  'public/icon-512-v1203.png',
]);
const forbiddenPrivateDocPatterns = [/^PRIVATE(?:_.*)?\.md$/u, /^HANDOFF_NEW_CHAT(?:_.*)?\.md$/u, /^CLEAN_CHECKPOINT_CONTENTS\.md$/u, /^CURRENT_PROJECT_RULES\.md$/u, /^CURRENT_STATE\.json$/u, /^BUILD_INFO\.json$/u, /^CHECKPOINT_MANIFEST\.sha256$/u];
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.html', '.css', '.svg', '.webmanifest', '.ps1', '.yml', '.yaml']);
const secretPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u],
  ['GitHub token', /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/u],
  ['OpenAI-style API key', /\bsk-[A-Za-z0-9_-]{20,}\b/u],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/u],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/u],
];

const failures = [];
const unix = (value) => value.split(sep).join('/');

function recursiveFiles(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = unix(relative(target, full));
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (forbiddenDirs.has(name)) failures.push(`forbidden directory: ${rel}`);
      else result.push(...recursiveFiles(full));
    } else result.push(full);
  }
  return result;
}

function gitTrackedFiles() {
  if (!existsSync(join(target, '.git'))) return null;
  const result = spawnSync('git', ['-C', target, 'ls-files', '-z'], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.split('\0').filter(Boolean).map((rel) => join(target, rel));
}

const tracked = gitTrackedFiles();
const files = tracked ?? recursiveFiles(target);

for (const file of files) {
  const rel = unix(relative(target, file));
  const parts = rel.split('/');
  const name = basename(file);
  const lower = name.toLocaleLowerCase('en-US');
  const extension = extname(lower);

  if (parts.some((part) => forbiddenDirs.has(part))) failures.push(`forbidden directory: ${rel}`);
  if (forbiddenPrivateDocPatterns.some((pattern) => pattern.test(name))) failures.push(`private checkpoint document: ${rel}`);
  if (lower === '.env' || lower.startsWith('.env.') || lower.endsWith('.env') || lower === '.envrc' || lower === '.dev.vars') failures.push(`environment/secrets file: ${rel}`);
  if (forbiddenExtensions.has(extension)) failures.push(`forbidden private/generated file: ${rel}`);
  if (privateMediaExtensions.has(extension) && !allowedPublicImages.has(rel)) failures.push(`unapproved image/media file: ${rel}`);
  if (!textExtensions.has(extension) || name === 'public-package-gate.mjs') continue;

  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  for (const [label, pattern] of secretPatterns) if (pattern.test(text)) failures.push(`${label} pattern: ${rel}`);
}

if (failures.length) {
  for (const failure of [...new Set(failures)]) console.error(`PUBLIC_PACKAGE_GATE_FAIL: ${failure}`);
  process.exit(1);
}

console.log(tracked ? 'PUBLIC_PACKAGE_GATE_OK (tracked files)' : 'PUBLIC_PACKAGE_GATE_OK');
