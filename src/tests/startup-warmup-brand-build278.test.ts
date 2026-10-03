import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync(new URL('../app/App.tsx', import.meta.url), 'utf8');
const warmup = readFileSync(new URL('../finance/finance-warmup.ts', import.meta.url), 'utf8');
const finance = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const appIcon = readFileSync(new URL('../ui/AppIcon.tsx', import.meta.url), 'utf8');
const today = readFileSync(new URL('../calendar/TodayView.tsx', import.meta.url), 'utf8');
const receiptScan = readFileSync(new URL('../finance/FinanceDashboardView.tsx', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('Build278 startup warmup and calendar brand icon', () => {
  it('warms Finance code and data after bootstrap without blocking the splash', () => {
    expect(app).toContain("const loadFinanceView = () => import('../finance/FinanceView')");
    expect(app).toContain('Promise.all([loadFinanceView(), preloadFinanceData()])');
    expect(app).toContain('scheduleIdleWarmup');
    expect(app).toContain('loadStudyView()');
    expect(app).toContain('loadWorkView()');
    expect(warmup).toContain('syncExpenseProductsFromReceipts()');
    expect(warmup).toContain('getFinanceWarmSnapshot');
  });

  it('hydrates Finance from the warmed local snapshot and refreshes it after mutations', () => {
    expect(finance).toContain('initialFinanceWarmData = getFinanceWarmSnapshot()');
    expect(finance).toContain('preloadFinanceData()');
    expect(finance).toContain('refreshFinanceWarmData()');
    expect(finance).toContain('applyFinanceData');
  });

  it('keeps receipt OCR lazy instead of warming the heavy scanner on startup', () => {
    expect(receiptScan).toContain("const ReceiptScanFlow = lazy(async () =>");
    expect(app).not.toContain('ReceiptScanFlow');
  });

  it('uses the current app brand mark everywhere the calendar icon is requested', () => {
    expect(appIcon).toContain("if (name === 'calendar') return <AppBrandMark");
    expect(appIcon).not.toContain('M8 12.5h.01');
    expect(today).toContain('<EmptyState icon="calendar" title="Wolny dzień"');
  });

  it('advances Build278 without changing database schema', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.284'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
