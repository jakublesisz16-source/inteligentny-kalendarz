import { readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, resolve, sep } from 'node:path';

const target = resolve(process.argv[2] ?? '');
if (!process.argv[2]) {
  console.error('PUBLIC_PACKAGE_GATE_FAIL: pass the sanitized public package directory as the first argument.');
  process.exit(2);
}

const forbiddenDirs = new Set(['_PRIVATE_HISTORY', '.git', 'node_modules', 'dist', 'coverage', '.benchmark-dist']);
const forbiddenExtensions = new Set(['.xls', '.xlsx', '.pdf', '.ikbackup', '.zip', '.7z', '.rar', '.bak', '.tmp', '.log', '.map', '.pem', '.key', '.p12', '.pfx', '.jks', '.keystore']);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.html', '.css', '.svg', '.webmanifest', '.ps1', '.yml', '.yaml']);
const secretPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u],
  ['GitHub token', /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/u],
  ['OpenAI-style API key', /\bsk-[A-Za-z0-9_-]{20,}\b/u],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/u],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/u],
];

const failures = [];
function walk(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(target, full).split(sep).join('/');
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (forbiddenDirs.has(name)) failures.push(`forbidden directory: ${rel}`);
      else result.push(...walk(full));
    } else result.push(full);
  }
  return result;
}

for (const file of walk(target)) {
  const rel = relative(target, file).split(sep).join('/');
  const name = basename(file);
  const lower = name.toLocaleLowerCase('en-US');
  const extension = extname(lower);
  if (lower === '.env' || lower.startsWith('.env.') || lower.endsWith('.env') || lower === '.envrc' || lower === '.dev.vars') failures.push(`environment/secrets file: ${rel}`);
  if (forbiddenExtensions.has(extension)) failures.push(`forbidden private/generated file: ${rel}`);
  if (!textExtensions.has(extension) || name === 'public-package-gate.mjs') continue;
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  for (const [label, pattern] of secretPatterns) if (pattern.test(text)) failures.push(`${label} pattern: ${rel}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`PUBLIC_PACKAGE_GATE_FAIL: ${failure}`);
  process.exit(1);
}
console.log('PUBLIC_PACKAGE_GATE_OK');
