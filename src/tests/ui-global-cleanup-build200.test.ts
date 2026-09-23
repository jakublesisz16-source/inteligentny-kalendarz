import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('Build200 global information cleanup', () => {
  it('turns Today into now -> next -> tomorrow without adding another dashboard', () => {
    const today = source('../calendar/TodayView.tsx');
    const css = source('../styles/interface-refinement.css');
    expect(today).toContain('today-next-strip');
    expect(today).toContain('today-tomorrow');
    expect(today).toContain('tomorrowEvents.map');
    expect(css).toContain('.today-tomorrow-row');
  });

  it('keeps version/build visible while hiding implementation metadata', () => {
    const settings = source('../settings/SettingsView.tsx');
    expect(settings).toContain('APP_RELEASE_VERSION');
    expect(settings).toContain('Build {BUILD_NUMBER}');
    expect(settings).not.toContain('DATABASE_SCHEMA_VERSION');
    expect(settings).not.toContain('>Lokalnie</span>');
  });

  it('removes passive labels and technical copy from default surfaces', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    const study = source('../study/StudyView.tsx');
    const transfer = source('../data-transfer/DataTransferPanel.tsx');
    expect(calendar).not.toContain('Plan studiów aktywny');
    expect(study).not.toContain('<p className="eyebrow">Studia</p>');
    expect(transfer).not.toContain('<span>Schemat danych</span>');
    expect(transfer).not.toContain('<span>Format pliku</span>');
  });

  it('shows finance metrics only when they carry information', () => {
    const finance = source('../finance/FinanceDashboardView.tsx');
    expect(finance).toContain('necessityTotals.essential > 0 ?');
    expect(finance).toContain('necessityTotals.nonessential > 0 ?');
    expect(finance).toContain('categoryAnalytics.length > 1 ?');
  });
});
