import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSixMonthTrend } from '../shopping/expenses.utils';
import type { Receipt } from '../shopping/expenses.types';
import { buildWorkMonthlySummary } from '../work/work-summary';

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

function receipt(id: string, date: string, amountMinor: number): Receipt {
  return {
    id,
    date,
    merchant: 'Sklep testowy',
    items: [{ id: `${id}-1`, name: 'Pozycja testowa', categoryId: 'food', amountMinor }],
    totalMinor: amountMinor,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`,
  };
}

describe('Build225 public-data end-to-end smoke contracts', () => {
  it('keeps Today wired for add, edit and tomorrow preview', () => {
    const today = source('../calendar/TodayView.tsx');
    expect(today).toContain('onClick={() => onAdd(today)}>+ Dodaj</button>');
    expect(today).toContain('onEdit={onEdit}');
    expect(today).toContain('today-tomorrow-title">Jutro');
  });

  it('keeps Calendar month/week navigation and exposes Add on mobile in both modes', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    expect(calendar).toContain("type CalendarDisplayMode = 'MONTH' | 'WEEK'");
    expect(calendar).toContain("onClick={() => setDisplayMode('MONTH')}");
    expect(calendar).toContain("onClick={() => setDisplayMode('WEEK')}");
    expect(calendar).toContain('className="button button-primary button-small calendar-mobile-explicit-add"');
    expect(calendar).not.toContain("displayMode === 'MONTH' ? <button type=\"button\" className=\"button button-primary button-small calendar-mobile-explicit-add\"");
  });

  it('keeps Finance month/trip and transaction/item paths connected', () => {
    const finance = source('../finance/FinanceDashboardView.tsx');
    expect(finance).toContain('>Miesiąc</button>');
    expect(finance).toContain('>Wyjazdy</button>');
    expect(finance).toContain('>Transakcje</button>');
    expect(finance).toContain('Pozycje');
    expect(finance).toContain('finance-manual-expense');
    expect(finance).toContain('finance-scan-receipt');
  });

  it('keeps six-month finance analytics deterministic on public synthetic data', () => {
    const trend = getSixMonthTrend([
      receipt('aug', '2026-08-10', 1200),
      receipt('sep', '2026-09-10', 3400),
    ], '2026-09');
    expect(trend.map((point) => point.monthKey)).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(trend.map((point) => point.totalMinor)).toEqual([0, 0, 0, 0, 1200, 3400]);
  });

  it('keeps Study import and group-preview actions wired', () => {
    const study = source('../study/StudyView.tsx');
    expect(study).toContain("import { readSpreadsheetFile } from '../imports/xlsx/spreadsheet-reader'");
    expect(study).toContain("activeImport ? 'Wczytaj nowy' : 'Wczytaj plan'");
    expect(study).toContain('StudyGroupChoiceFields');
    expect(study).toContain('preparePreview(analysis, selectedGroups)');
  });

  it('keeps Work tabs persistent but resets page scroll when changing the subview', () => {
    const work = source('../work/WorkView.tsx');
    expect(work).toContain("const WORK_TAB_STORAGE_KEY = 'ik.work.tab'");
    expect(work).toContain("function changeWorkTab(nextTab: 'schedule' | 'availability' | 'summary')");
    expect(work).toContain("window.scrollTo({ top: 0, left: 0, behavior: 'auto' })");
    expect(work).toContain("onClick={() => changeWorkTab('availability')}");
    expect(work).toContain("onClick={() => changeWorkTab('summary')}");
  });

  it('keeps Work monthly summaries correct on public synthetic shifts', () => {
    const summary = buildWorkMonthlySummary('2026-09', [
      { id: 'a', startDateTime: '2026-09-22T14:00:00', endDateTime: '2026-09-22T22:00:00', source: 'WORK_PDF' },
      { id: 'b', startDateTime: '2026-09-23T15:00:00', endDateTime: '2026-09-23T22:00:00', source: 'WORK_PDF' },
    ]);
    expect(summary.totalMinutes).toBe(15 * 60);
    expect(summary.shiftCount).toBe(2);
    expect(summary.workDayCount).toBe(2);
    expect(summary.longestWorkStreakDays).toBe(2);
  });

  it('keeps Settings core choices and recovery surfaces connected', () => {
    const settings = source('../settings/SettingsView.tsx');
    expect(settings).toContain('Ekran startowy');
    expect(settings).toContain('Format czasu');
    expect(settings).toContain('Kopia i przenoszenie');
    expect(settings).toContain('Historia i odzyskiwanie');
  });

  it('keeps extra mobile Work clearance above the fixed bottom navigation', () => {
    const styles = source('../styles/interface-refinement.css');
    expect(styles).toContain('.app-main > .view-shell.work-view { padding-bottom: calc(var(--mobile-bottom-nav-clearance) + 38px) !important; }');
  });
});
