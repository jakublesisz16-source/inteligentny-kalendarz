import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, relative, sep } from 'node:path';

const root = process.cwd();
const excludedDirs = new Set(['.git', 'node_modules', 'dist', 'coverage', '.benchmark-dist', '_PRIVATE_HISTORY']);
const excludedFiles = new Set(['SHA256SUMS.txt', 'security-release-gate.mjs', 'public-package-gate.mjs']);
const privateExtensions = new Set(['.xls', '.xlsx', '.pdf', '.ikbackup', '.zip', '.7z', '.rar', '.pem', '.key', '.p12', '.pfx', '.jks', '.keystore']);
const textExtensions = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.md', '.txt', '.html', '.css', '.svg', '.webmanifest', '.ps1', '.yml', '.yaml']);

const secretPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u],
  ['GitHub token', /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/u],
  ['OpenAI-style API key', /\bsk-[A-Za-z0-9_-]{20,}\b/u],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/u],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/u],
];

function fail(message) {
  console.error(`SECURITY_RELEASE_GATE_FAIL: ${message}`);
  process.exitCode = 1;
}

function walk(dir) {
  const result = [];
  for (const name of readdirSync(dir)) {
    if (excludedDirs.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) result.push(...walk(full));
    else result.push(full);
  }
  return result;
}

const files = walk(root);
for (const file of files) {
  const rel = relative(root, file).split(sep).join('/');
  const name = basename(file);
  const lower = name.toLocaleLowerCase('en-US');
  const extension = extname(lower);

  if (lower === '.env' || lower.startsWith('.env.') || lower.endsWith('.env') || lower === '.envrc' || lower === '.dev.vars') {
    fail(`environment/secrets file present in release candidate tree: ${rel}`);
    continue;
  }
  if (privateExtensions.has(extension)) {
    fail(`private or archive file present outside _PRIVATE_HISTORY: ${rel}`);
    continue;
  }
  if (excludedFiles.has(name) || !textExtensions.has(extension)) continue;

  let text;
  try { text = readFileSync(file, 'utf8'); } catch { continue; }
  for (const [label, pattern] of secretPatterns) {
    if (pattern.test(text)) fail(`${label} pattern detected in ${rel}`);
  }
}

const viteConfig = readFileSync(join(root, 'vite.config.ts'), 'utf8');
if (!viteConfig.includes('sourcemap: false')) fail('production sourcemaps are not explicitly disabled in vite.config.ts');

const dist = join(root, 'dist');
if (existsSync(dist)) {
  for (const file of walk(dist)) {
    if (file.toLocaleLowerCase('en-US').endsWith('.map')) fail(`source map leaked into production dist: ${relative(root, file)}`);
  }
}

if (!process.exitCode) console.log('SECURITY_RELEASE_GATE_OK');
