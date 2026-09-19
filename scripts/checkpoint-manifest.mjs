import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const manifestName = 'CHECKPOINT_MANIFEST.sha256';
const ignored = new Set([manifestName]);

function unix(value) { return value.split(sep).join('/'); }
function filesUnder(dir) {
  const result = [];
  for (const name of readdirSync(dir).sort((a, b) => a.localeCompare(b, 'en'))) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) result.push(...filesUnder(full));
    else result.push(full);
  }
  return result;
}

const files = filesUnder(root)
  .map((full) => ({ full, rel: unix(relative(root, full)) }))
  .filter(({ rel }) => !ignored.has(rel))
  .sort((a, b) => a.rel.localeCompare(b.rel, 'en'));

const lines = files.map(({ full, rel }) => {
  const hash = createHash('sha256').update(readFileSync(full)).digest('hex');
  return `${hash}  ./${rel}`;
});
writeFileSync(join(root, manifestName), `${lines.join('\n')}\n`, 'utf8');
console.log(`CHECKPOINT_MANIFEST_OK files=${lines.length}`);
