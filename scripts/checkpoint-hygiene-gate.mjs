import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const unix = (value) => value.split(sep).join('/');
const failures = [];
const fail = (message) => failures.push(message);

// PUBLIC snapshots intentionally do not contain BUILD_INFO/private docs.
if (!existsSync(join(root, 'BUILD_INFO.json'))) {
  console.log('CHECKPOINT_HYGIENE_SKIPPED_PUBLIC');
  process.exit(0);
}

const allowedDocs = new Set([
  'docs/ARCHITECTURE.md',
  'docs/CURRENT_PRODUCT_STATE.md',
  'docs/MILESTONES.md',
  'docs/PRIVACY.md',
  'docs/QA_RELEASE.md',
  'docs/ROADMAP.md',
  'docs/STUDY_PLAN_II_2026_MAPPING.md',
]);
const allowedScripts = new Set([
  'scripts/build192-production-audit-freeze-proof.mjs',
  'scripts/checkpoint-gate.mjs',
  'scripts/checkpoint-hygiene-gate.mjs',
  'scripts/checkpoint-manifest.mjs',
  'scripts/checkpoint-state-gate.mjs',
  'scripts/local-release.mjs',
  'scripts/mark-benchmark-commonjs.mjs',
  'scripts/production-audit.mjs',
  'scripts/public-package-gate.mjs',
  'scripts/receipt-benchmark-runner.mjs',
  'scripts/receipt-gate2-runner.mjs',
  'scripts/receipt-geometry-benchmark-runner.mjs',
  'scripts/receipt-private-corpus-qa.mjs',
  'scripts/release-contract-current-proof.mjs',
  'scripts/release-preflight.mjs',
  'scripts/release-safety-gate.mjs',
  'scripts/security-release-gate.mjs',
  'scripts/service-worker-gate.mjs',
  'scripts/study-mobile-smoke.mjs',
  'scripts/travel-release-gate.mjs',
  'scripts/tsconfig.receipt-benchmark.json',
  'scripts/visual-qa-capture.mjs',
]);

for (const name of readdirSync(join(root, 'docs'))) {
  const rel = `docs/${name}`;
  if (statSync(join(root, rel)).isFile() && !allowedDocs.has(rel)) fail(`unexpected/superseded docs file: ${rel}`);
}
for (const name of readdirSync(join(root, 'scripts'))) {
  const rel = `scripts/${name}`;
  if (statSync(join(root, rel)).isFile() && !allowedScripts.has(rel)) fail(`unexpected/superseded script file: ${rel}`);
}
for (const forbidden of ['docs/STUDY_PLAN_III_2026_MAPPING.md', 'scripts/release-contract-sync-build216-proof.mjs']) {
  if (existsSync(join(root, forbidden))) fail(`superseded file returned: ${forbidden}`);
}

const nestedArchives = [];
function scan(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = unix(relative(root, full));
    const stat = statSync(full);
    if (stat.isDirectory()) scan(full);
    else if (/\.(?:zip|7z|rar)$/iu.test(name)) nestedArchives.push(rel);
  }
}
scan(root);
for (const rel of nestedArchives) fail(`nested archive in checkpoint: ${rel}`);

if (failures.length) {
  for (const message of failures) console.error(`CHECKPOINT_HYGIENE_FAIL: ${message}`);
  process.exit(1);
}
console.log(`CHECKPOINT_HYGIENE_OK docs=${allowedDocs.size} scripts=${allowedScripts.size}`);
