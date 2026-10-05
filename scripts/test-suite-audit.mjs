import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const TEST_ROOT = join(ROOT, 'src', 'tests');
const LEGACY_BUILD_NAMED_MAX = 97;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) return walk(absolute);
    return [absolute];
  });
}

const tests = walk(TEST_ROOT)
  .filter((path) => path.endsWith('.test.ts'))
  .map((path) => ({
    absolute: path,
    rel: relative(ROOT, path).replaceAll('\\', '/'),
    text: readFileSync(path, 'utf8').replaceAll('\r\n', '\n'),
    size: statSync(path).size,
  }));

const duplicateGroups = new Map();
for (const test of tests) {
  const sha = createHash('sha256').update(test.text).digest('hex');
  const group = duplicateGroups.get(sha) ?? [];
  group.push(test.rel);
  duplicateGroups.set(sha, group);
}
const exactDuplicates = [...duplicateGroups.values()].filter((group) => group.length > 1);
const focused = tests.filter((test) => /\b(?:describe|it|test)\.only\s*\(/u.test(test.text));
const buildNamed = tests.filter((test) => /(?:^|[-_.])build\d+(?:[-_.]|$)/iu.test(test.rel));
const sourceShape = tests.filter((test) => test.text.includes('readFileSync('));
const oversized = tests.filter((test) => test.size > 60_000);
const largest = [...tests].sort((a, b) => b.size - a.size).slice(0, 10);

console.log(`TEST_SUITE_AUDIT files=${tests.length} buildNamed=${buildNamed.length} sourceShape=${sourceShape.length} exactDuplicates=${exactDuplicates.length} focused=${focused.length} oversized=${oversized.length}`);
console.log('TEST_SUITE_LARGEST');
for (const item of largest) console.log(`${item.size}\t${item.rel}`);

let failed = false;
if (exactDuplicates.length) {
  failed = true;
  console.error('Exact duplicate test files are not allowed:');
  for (const group of exactDuplicates) console.error(`- ${group.join(', ')}`);
}
if (focused.length) {
  failed = true;
  console.error('Focused test markers are not allowed in committed tests:');
  for (const item of focused) console.error(`- ${item.rel}`);
}
if (buildNamed.length > LEGACY_BUILD_NAMED_MAX) {
  failed = true;
  console.error(`Legacy build-named test count regressed: ${buildNamed.length} > ${LEGACY_BUILD_NAMED_MAX}. New tests should use semantic domain names.`);
}
if (oversized.length) {
  failed = true;
  console.error('Test files above 60 kB must be split by behavior:');
  for (const item of oversized) console.error(`- ${item.rel} (${item.size} B)`);
}

if (failed) process.exit(1);
console.log('TEST_SUITE_AUDIT_OK');
