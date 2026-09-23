import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const view = read('src/study/StudyView.tsx');
const css = read('src/styles/interface-refinement.css');
const expenses = read('src/shopping/expenses.utils.ts');
const receiptTest = read('src/tests/receipt-parser-build207-biedronka.test.ts');
const uiTest = read('src/tests/ui-study-import-quiet-build207.test.ts');
const version = read('src/core/version.ts');
const build = read('src/core/build.ts');
const sw = read('public/service-worker.js');
const checks = [];
const check = (name, ok) => { if (!ok) throw new Error(`FAIL: ${name}`); checks.push(name); };

check('Study preview default surface is compact', view.includes('study-import-summary-v207') && view.includes('study-import-summary-line-v207') && view.includes("'Plan gotowy'"));
check('Study review is progressive disclosure', view.includes('<details className="panel study-review-details study-review-details-v207"') && view.includes('<strong>Szczegóły</strong>'));
check('Source notes are secondary details', view.includes('study-source-notes-v207') && view.includes('<strong>Informacje z planu</strong>'));
check('Source audit is secondary but preserved', view.includes('study-source-audit-v207') && view.includes('<strong>Kontrola źródła</strong>'));
check('Zero-count filters are hidden', view.includes('{warningPreviewCount ? <button') && view.includes('{incompletePreviewCount ? <button') && view.includes('{blockingPreviewCount ? <button'));
check('Redundant import bulk controls are gone', !view.includes('Odznacz wszystkie') && !view.includes('Zaznacz wszystkie możliwe') && view.includes('Przywróć wybór'));
check('Study import CTA is shorter and does not duplicate the header cancel action', view.includes('`Dodaj ${importable.length}`') && !view.includes('study-import-other-file-v207'));
check('Build207 compact styling exists', css.includes('Build207 - quiet Study import review') && css.includes('.study-import-summary-v207') && css.includes('.study-review-details-v207'));
check('Finance display cleanup is narrow and presentation-only', expenses.includes(".replace(/\\s*(?:[|¦]\\s*)?[©®]\\s*;?\\s*$/gu, '')") && expenses.includes('Presentation-only cleanup for compact OCR names'));
check('Sanitized Biedronka regression exists without raw card data', receiptTest.includes('BIEDRONKA_LAYOUT_23092026') && receiptTest.includes('expect(parsed.items).toHaveLength(6)') && receiptTest.includes('expect(parsed.declaredTotalMinor).toBe(4285)') && !receiptTest.includes('99547'));
check('UI regression guard exists', uiTest.includes('Build207 quiet Study import review'));
const versionMatch = version.match(/APP_VERSION = '(\d+\.\d+\.\d+\.(\d+))'/);
const buildMatch = build.match(/APP_BUILD = '(\d+)'/);
check('Build207-or-newer metadata is synchronized', Boolean(versionMatch && buildMatch && Number(versionMatch[2]) >= 207 && versionMatch[2] === buildMatch[1] && sw.includes(`v${versionMatch[1]}`)));
check('database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));

console.log(`Build207 import review quality proof PASS ${checks.length}/${checks.length}`);
