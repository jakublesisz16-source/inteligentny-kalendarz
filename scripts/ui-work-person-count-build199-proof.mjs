import { readFileSync } from 'node:fs';

const refinement = readFileSync('src/styles/interface-refinement.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');
const build = readFileSync('src/core/build.ts', 'utf8');

const checks = [];
const check = (name, condition) => {
  if (!condition) throw new Error(`FAIL: ${name}`);
  checks.push(name);
};

const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
check('app metadata remains synchronized after Build199', Boolean(versionMatch && buildMatch && versionMatch[2] === buildMatch[1]));
check('schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));
check('work team details use max-content rows', refinement.includes('grid-auto-rows: max-content;'));
check('work team details align children to start', refinement.includes('align-items: start;'));
check('closed person-count trigger has fixed desktop height', refinement.includes('height: 36px;\n  min-height: 36px;\n  max-height: 36px;'));
check('open person-count trigger stays in its own first row', refinement.includes('.work-shift-team-details[open] > summary') && refinement.includes('grid-row: 1;'));
check('open person-count trigger cannot stretch vertically', refinement.includes('align-self: start;') && refinement.includes('max-height: 36px;'));
check('coworker list remains on the row below', refinement.includes('.work-shift-team-details .coworker-overlap-list.compact') && refinement.includes('grid-row: 2;'));
check('mobile person-count target keeps 40px height', refinement.includes('height: 40px; min-height: 40px; max-height: 40px;'));

console.log(`Build199 Work person-count geometry proof PASS ${checks.length}/${checks.length}`);
