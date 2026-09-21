import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const checks = [];
const check = (name, condition) => {
  if (!condition) throw new Error(`FAIL: ${name}`);
  checks.push(name);
};

const receiptJson = read('src/shopping/receipt-ocr/receipt-json.ts');
check('structured JSON item/fiscal reconciliation is exact', receiptJson.includes('if (detectedItemsTotalMinor !== fiscalTotalMinor)'));
check('structured JSON fiscal/deposit/final reconciliation is exact', receiptJson.includes('if (fiscalTotalMinor + depositTotalMinor !== finalTotalMinor)'));
check('structured JSON payment/final reconciliation is exact', receiptJson.includes('if (hasPayment && paymentTotalMinor !== finalTotalMinor)'));
check('structured JSON discount reconciliation is exact', receiptJson.includes('declaredDiscountMinor !== detectedDiscountMinor'));
check('structured JSON no longer uses OCR-style 1-cent tolerance for final cross-field sums', !receiptJson.includes('Math.abs(detectedItemsTotalMinor - fiscalTotalMinor) > 1'));

const calendar = read('src/calendar/CalendarView.tsx');
const calendarPolish = read('src/tests/calendar-1213-polish.test.ts');
check('Calendar empty-day guard follows current + Dodaj label', calendar.includes('actionLabel="+ Dodaj"') && calendarPolish.includes('actionLabel="+ Dodaj"'));

const finance = read('src/finance/FinanceDashboardView.tsx');
check('Finance scan control remains reachable with split responsive copy', finance.includes('finance-scan-receipt-short">Skanuj') && finance.includes('finance-scan-receipt-long">paragon'));
check('Finance review queue uses current categoryReviewRows split', finance.includes('Do poprawy <strong>{categoryReviewRows.length}</strong>'));
check('Finance necessity summary keeps semantic labels and amount wiring', finance.includes('<span>Niezbędne</span>') && finance.includes('formatMoneyMinor(necessityTotals.essential)') && finance.includes('<span>Zbędne</span>') && finance.includes('formatMoneyMinor(necessityTotals.nonessential)'));
check('Finance product modal retains unit-price history', finance.includes('Historia ceny jednostkowej'));

const category169 = read('src/tests/finance-category-robustness-build169.test.ts');
check('technical oil regression guard follows Build171 Transport disambiguation', category169.includes("['OlejSilnikowy5W30', 'transport']"));

const work = read('src/work/WorkView.tsx');
const workTest = read('src/tests/work-coworker-visibility-1297.test.ts');
check('Work person-count guard follows centralized Polish formatter', work.includes('formatPersonCount(nearestCoworkers.length)') && workTest.includes('formatPersonCount(nearestCoworkers.length)'));

const flow = read('src/shopping/receipt-ocr/ReceiptScanFlow.tsx');
const pdfTest = read('src/tests/receipt-ocr-fix1m-test-contract.test.ts');
check('PDF OCR aggregation uses selected page candidate', flow.includes('pageTexts.push(selectedPageAssessment.text)') && pdfTest.includes('pageTexts.push(selectedPageAssessment.text)'));

const parserBytes = read('src/shopping/receipt-ocr/receipt-parser.ts').replace(/\r\n?/g, '\n');
const parserHash = createHash('sha256').update(Buffer.from(parserBytes, 'utf8')).digest('hex');
const freeze = read('src/tests/receipt-final-parser-freeze.test.ts');
check('parser freeze records current reviewed source without changing parser', freeze.includes(`BUILD191_PARSER_EXPECTED = '${parserHash}'`));

const version = read('src/core/version.ts');
const build = read('src/core/build.ts');
const versionMatch = /APP_VERSION = '1\.2\.0\.(\d+)'/u.exec(version);
const buildMatch = /APP_BUILD = '(\d+)'/u.exec(build);
check('post-Build191 metadata remains synchronized', Boolean(versionMatch && buildMatch && versionMatch[1] === buildMatch[1]));
check('database schema remains 14', version.includes('DATABASE_SCHEMA_VERSION = 14'));

console.log(`Build191 release-test reconciliation proof PASS ${checks.length}/${checks.length}`);
