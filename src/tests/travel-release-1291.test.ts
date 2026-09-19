import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const financeRates = readFileSync('src/finance/exchange-rates.ts', 'utf8');
const quickExpense = readFileSync('src/finance/FinanceQuickExpenseModal.tsx', 'utf8');
const settings = readFileSync('src/settings/SettingsView.tsx', 'utf8');
const safety = readFileSync('src/safety/SafetyCenter.tsx', 'utf8');
const work = readFileSync('src/work/WorkView.tsx', 'utf8');
const study = readFileSync('src/study/StudyView.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');

describe('1.2.0.92 travel-ready hardening', () => {
  it('keeps foreign expense conversion completely local', () => {
    expect(financeRates).toContain('LOCAL_CURRENT_PLN_RATES');
    expect(financeRates).not.toContain('fetch(');
    expect(financeRates).not.toMatch(/https?:\/\//u);
    expect(quickExpense).toContain('inputMode="decimal"');
    expect(quickExpense).toContain('<span>Waluta</span>');
  });

  it('keeps Settings direct and avoids a second backup UI', () => {
    expect(settings).toContain('Backup i przenoszenie');
    expect(settings).toContain('Dane i historia');
    expect(settings).not.toContain('<details');
    expect(safety).not.toContain("tab === 'backup'");
    expect(safety).not.toContain('Utwórz kopię zapasową');
  });

  it('keeps daily Work use ahead of repeated imports', () => {
    expect(work).toContain("activeWorkEvents.length ? 'Aktualizuj PDF' : 'Importuj PDF'");
    expect(responsive).toContain('.work-header-actions .work-import-button');
  });

  it('keeps Study copy short while preserving direct access', () => {
    expect(study).toContain('Wczytaj Excel. Przed zapisem zobaczysz zmiany i wybierzesz tylko potrzebne grupy.');
    expect(study).toContain('Grupy i podgląd');
    expect(study).not.toContain('Grupy i dodatkowe opcje');
  });
});
