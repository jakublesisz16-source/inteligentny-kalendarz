import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';

const root = process.cwd();
const failures = [];
const unix = (value) => value.split(sep).join('/');
const fail = (message) => failures.push(message);

const removedLegacyPlayerFiles = [
  'src/shopping/ShoppingView.tsx',
  'src/shopping/ExpensesView.tsx',
  'src/cycle/CycleView.tsx',
  'src/cycle/CycleJournalEditor.tsx',
  'src/cycle/CyclePeriodEditor.tsx',
  'src/locations/LocationsView.tsx',
  'src/ui/AppBackgroundDecor.tsx',
  'src/ui/FloralAccent.tsx',
];
for (const path of removedLegacyPlayerFiles) {
  if (existsSync(join(root, path))) fail(`superseded player-facing file returned: ${path}`);
}

const removedLegacyWorkflowPaths = [
  'sync-preview',
  'SYNC_PREVIEW_INFO.json',
  'firebase.sync-lab.json',
  '.github/workflows/firebase-sync-preview.yml',
  'scripts/prepare-sync-preview.mjs',
];
for (const path of removedLegacyWorkflowPaths) {
  if (existsSync(join(root, path))) fail(`obsolete Sync Preview artifact returned: ${path}`);
}

const workspaceGeneratedDirs = new Set(['.git', 'node_modules', 'dist', 'coverage', '.benchmark-dist', '.cache', '.vite', 'test-results', 'playwright-report']);
const workspaceGeneratedFiles = new Set(['tsconfig.app.tsbuildinfo', 'tsconfig.node.tsbuildinfo']);
const forbiddenExtensions = new Set(['.zip', '.7z', '.rar', '.bak', '.old', '.orig', '.rej', '.tmp', '.log']);
const forbiddenNames = [/^windows powershell(?:\..+)?$/iu, /^vitest-public\.json$/iu, /^screenshot[_ -]/iu, /~$/u];

function scanArtifacts(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = unix(relative(root, full));
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (!workspaceGeneratedDirs.has(name)) scanArtifacts(full);
      continue;
    }
    if (workspaceGeneratedFiles.has(rel) || workspaceGeneratedFiles.has(name)) continue;
    if (forbiddenExtensions.has(extname(name).toLocaleLowerCase('en-US'))) fail(`temporary/archive file in source tree: ${rel}`);
    if (forbiddenNames.some((pattern) => pattern.test(name))) fail(`temporary/debug file in source tree: ${rel}`);
  }
}
scanArtifacts(root);

const sourceRoot = join(root, 'src');
const sourceFiles = [];
function collectSources(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (name !== 'tests') collectSources(full);
    } else if (/\.tsx?$/u.test(name)) sourceFiles.push(full);
  }
}
collectSources(sourceRoot);

const importPattern = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/gu;
const sourceSet = new Set(sourceFiles.map((path) => resolve(path)));
const graph = new Map([...sourceSet].map((path) => [path, new Set()]));

function resolveLocalImport(from, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = resolve(join(from, '..', specifier));
  const candidates = [
    base,
    `${base}.ts`, `${base}.tsx`,
    join(base, 'index.ts'), join(base, 'index.tsx'),
  ];
  return candidates.find((path) => sourceSet.has(resolve(path))) ?? null;
}

for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(importPattern)) {
    const target = resolveLocalImport(file, match[1] ?? match[2]);
    if (target) graph.get(resolve(file))?.add(resolve(target));
  }
}

const roots = [join(root, 'src/main.tsx')];
for (const file of sourceFiles) {
  if (unix(relative(root, file)).startsWith('src/benchmarks/')) roots.push(file);
}
const reachable = new Set(roots.filter((path) => existsSync(path)).map((path) => resolve(path)));
const stack = [...reachable];
while (stack.length) {
  const current = stack.pop();
  for (const next of graph.get(current) ?? []) {
    if (!reachable.has(next)) { reachable.add(next); stack.push(next); }
  }
}

const intentionalNonRuntime = new Set([
  'src/app/devServiceWorkerRecovery.ts', // loaded directly from index.html, outside TS module graph
  'src/cycle/cycle-ovulation.ts',        // retained domain logic with regression coverage
  'src/cycle/cycle-patterns.ts',         // retained domain logic with regression coverage
  'src/notifications/notification-planner.ts', // retained domain logic with regression coverage
  'src/vite-env.d.ts',                   // ambient Vite declarations
  'src/sync/index.ts',                    // provider boundary prepared before cloud provider activation
  'src/sync/provider-registry.ts',        // provider boundary prepared before cloud provider activation
  'src/sync/providers/local-only.ts',     // provider boundary prepared before cloud provider activation
  'src/sync/sync-config.ts',              // provider boundary prepared before cloud provider activation
  'src/sync/sync-service.ts',             // provider boundary prepared before cloud provider activation
  'src/sync/sync.types.ts',               // provider boundary prepared before cloud provider activation
]);
const orphans = [...sourceSet]
  .filter((path) => !reachable.has(path))
  .map((path) => unix(relative(root, path)))
  .sort();
for (const rel of orphans) if (!intentionalNonRuntime.has(rel)) fail(`unexpected non-runtime source module: ${rel}`);
for (const rel of intentionalNonRuntime) {
  if (!orphans.includes(rel)) fail(`source hygiene allowlist is stale; module is no longer an intentional orphan: ${rel}`);
}

const indexHtml = existsSync(join(root, 'index.html')) ? readFileSync(join(root, 'index.html'), 'utf8') : '';
if (!indexHtml.includes('/src/app/devServiceWorkerRecovery.ts')) fail('index.html no longer loads devServiceWorkerRecovery.ts directly');

if (failures.length) {
  for (const message of [...new Set(failures)]) console.error(`SOURCE_HYGIENE_FAIL: ${message}`);
  process.exit(1);
}
console.log(`SOURCE_HYGIENE_OK runtime=${reachable.size} intentionalNonRuntime=${orphans.length} removedLegacy=${removedLegacyPlayerFiles.length}`);
