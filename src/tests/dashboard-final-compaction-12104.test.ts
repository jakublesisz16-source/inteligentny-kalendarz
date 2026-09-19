import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('1.2.0.104 dashboard compaction', () => {
  it('uses a real desktop availability dashboard with a mobile fallback', () => {
    const view = source('../availability/AvailabilityView.tsx');
    const css = source('../styles/interface-consistency.css');
    expect(view).toContain('availability-dashboard-layout');
    expect(css).toContain('grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr)');
    expect(css).toContain('grid-template-areas: "week" "automation" "conflict"');
  });

  it('does not duplicate active Study group chips above the permanent selectors', () => {
    const profile = source('../study/StudyProfileSettings.tsx');
    expect(profile).toContain('study-profile-plan-summary');
    expect(profile).not.toContain('Grupy aktywnego planu');
    expect(profile).toContain('StudyGroupChoiceFields');
  });

  it('keeps Calendar Study context compact until the user expands group details', () => {
    const calendar = source('../calendar/CalendarView.tsx');
    const css = source('../styles/interface-consistency.css');
    expect(calendar).toContain('<details className="calendar-study-context-wrap');
    expect(calendar).toContain('calendar-study-context-details');
    expect(css).toContain('.calendar-study-context-details[open] > summary i');
    expect(css).toContain('.calendar-side-column.is-empty .selected-day-panel .empty-state');
  });

  it('uses short accessible switches for optional calendar layers', () => {
    const settings = source('../settings/SettingsView.tsx');
    const css = source('../styles/interface-consistency.css');
    expect(settings).toContain('Święta PL');
    expect(settings).toContain('WUM 26/27');
    expect(settings).toContain('Święta i dni ustawowo wolne w Polsce');
    expect(css).toContain('.settings-layer-switch input:checked');
  });
});
