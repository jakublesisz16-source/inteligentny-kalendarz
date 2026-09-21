import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const navigation = read('src/ui/Navigation.tsx');
const responsive = read('src/styles/responsive.css');
const styles = read('src/styles/interface-consistency.css');
const version = read('src/core/version.ts');
const checks = [
  ['Build186 marker exists', styles.includes('1.2.0.186 - startup-safe mobile nav rollback')],
  ['Navigation has no visualViewport runtime hook', !navigation.includes('window.visualViewport') && !navigation.includes('getBoundingClientRect')],
  ['Navigation has no startup effect/ref for bottom nav', !navigation.includes('useEffect') && !navigation.includes('useRef') && !navigation.includes('bottomNavRef')],
  ['No dynamic viewport-lift CSS variable remains', !styles.includes('--mobile-nav-viewport-lift')],
  ['Proven responsive fixed nav safe edge remains', responsive.includes('bottom: max(8px, env(safe-area-inset-bottom));')],
  ['Proven six-column nav grid remains', responsive.includes('grid-template-columns: repeat(6, minmax(0, 1fr));')],
  ['Proven mobile nav height remains in responsive CSS', responsive.includes('height: 70px;')],
  ['Hotfix keeps labels single-line', styles.includes('white-space: nowrap;')],
  ['Hotfix keeps nav above ordinary content', styles.includes('.bottom-nav { z-index: 240; }')],
  ['Database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14')],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) { console.error(`Build186 mobile nav proof failed: ${failed.map(([n])=>n).join(', ')}`); process.exit(1); }
console.log(`Build186 mobile nav proof PASS (${checks.length}/${checks.length})`);
