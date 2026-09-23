import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/interface-refinement.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');
const build = readFileSync('src/core/build.ts', 'utf8');
const checks = [];
const check = (name, condition) => {
  if (!condition) throw new Error(`FAIL: ${name}`);
  checks.push(name);
};

const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
check('app metadata remains synchronized after Build197', Boolean(versionMatch && buildMatch && versionMatch[2] === buildMatch[1]));
check('schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));
check('Today add action is compact on phone', css.includes('min-width: 88px') && css.includes('min-height: 36px !important'));
check('Study selected-group action is no longer forced full width', css.includes('.study-profile-group-picker .compact-study-actions .button') && css.includes('width: auto !important'));
check('Work nearest coworkers use a readable two-column text grid', css.includes('grid-template-columns: repeat(2, minmax(0, 1fr))') && css.includes('.work-next-team-static > .coworker-inline'));
check('Work expanded shared-time label is visually de-emphasized', css.includes('font-size: 0 !important') && css.includes("small::before { content: ' · '; }"));
check('Finance edit items are flattened to divider rows', css.includes('.finance-receipt-edit-item') && css.includes('border-bottom: 1px solid color-mix(in srgb, var(--line) 76%, transparent)'));
check('Availability week days are flattened inside their outer surface', css.includes('.availability-dashboard-layout .availability-week-day.has-hours') && css.includes('background: transparent'));
check('Availability rule buttons are flat rows', css.includes('.availability-dashboard-layout .availability-day-rule-button.has-rule') && css.includes('border-radius: 0'));
check('Study history cards become lightweight rows', css.includes('.study-history-compact-grid .import-history-card') && css.includes('background: transparent'));

console.log(`Build197 interface coherence proof PASS ${checks.length}/${checks.length}`);
