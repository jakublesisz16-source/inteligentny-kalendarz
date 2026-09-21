import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const build = read('src/core/build.ts');
const settings = read('src/settings/SettingsView.tsx');
const version = read('src/core/version.ts');
const checks = [
  ['APP_BUILD export exists', /export const APP_BUILD\s*=\s*'\d+';/u.test(build)],
  ['BUILD_NUMBER aliases APP_BUILD', /export const BUILD_NUMBER\s*=\s*APP_BUILD;/u.test(build)],
  ['Settings imports BUILD_NUMBER', /import\s*\{\s*BUILD_NUMBER\s*\}\s*from\s*['"]\.\.\/core\/build['"];?/u.test(settings)],
  ['Settings displays BUILD_NUMBER', settings.includes('Build {BUILD_NUMBER}')],
  ['Settings does not import technical APP_BUILD', !/import\s*\{[^}]*APP_BUILD[^}]*\}\s*from\s*['"]\.\.\/core\/build['"]/u.test(settings)],
  ['APP_VERSION build suffix matches APP_BUILD', (() => { const appBuild = /APP_BUILD\s*=\s*'(\d+)'/u.exec(build)?.[1]; const appVersion = /APP_VERSION\s*=\s*'([0-9.]+)'/u.exec(version)?.[1]; return Boolean(appBuild && appVersion && appVersion.endsWith(`.${appBuild}`)); })()],
  ['Database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`Build187 runtime build export proof failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`Build187 runtime build export proof PASS (${checks.length}/${checks.length})`);
