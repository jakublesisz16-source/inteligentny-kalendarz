import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('study import readability contract', () => {
  it('keeps import selection compact and treats schedule-conflict warnings as information without extra consent clicks', () => {
    const view = source('../study/StudyView.tsx');
    const profile = source('../study/StudyProfileSettings.tsx');
    const diff = source('../study/ScheduleDiffView.tsx');
    const css = source('../styles/components.css');

    expect(view).not.toContain('className="decision-toggle"');
    expect(profile).not.toContain('className="decision-toggle"');
    expect(diff).not.toContain('className="decision-toggle"');
    expect(view).toContain('Konflikty pozostają widoczne, ale nie wymagają dodatkowego potwierdzenia');
    expect(profile).toContain('bez dodatkowego checkboxa');
    expect(diff).toContain('zapisze wybrane zmiany także wtedy, gdy część zajęć się nakłada');
    expect(css).toMatch(/\.candidate-toggle\s*\{[^}]*width:\s*28px/);
  });

  it('renders schedule conflicts as structured rows that collapse cleanly on narrow screens', () => {
    const view = source('../study/StudyView.tsx');
    const css = source('../styles/components.css');
    const responsive = source('../styles/responsive.css');

    expect(view).toContain('className="study-conflict-list"');
    expect(view).toContain('className="conflict-separator"');
    expect(css).toContain('.study-conflict-list li');
    expect(responsive).toContain('.study-conflict-list li { grid-template-columns: 1fr;');
  });

  it('does not dim an entire unselected candidate card and keeps correction actions readable', () => {
    const view = source('../study/StudyView.tsx');
    const css = source('../styles/components.css');

    expect(css).toContain('.candidate-card.unselected { opacity: 1;');
    expect(view).toContain('className="text-button candidate-edit-action"');
    expect(view).toContain("review.state === 'INCOMPLETE' ? 'Uzupełnij ręcznie'");
  });


  it('keeps source-incomplete Study blocks visible without turning them into invented calendar events', () => {
    const app = source('../app/App.tsx');
    const calendar = source('../calendar/CalendarView.tsx');
    const view = source('../study/StudyView.tsx');
    const css = source('../styles/components.css');

    expect(app).toContain('loadIncompleteStudyEntries');
    expect(app).toContain('incompleteStudyEntries={incompleteStudyEntries}');
    expect(calendar).toContain('study-incomplete-marker');
    expect(calendar).toContain('to nie jest potwierdzone wydarzenie');
    expect(calendar).toContain('Niepełne dane z planu studiów');
    expect(view).toContain('Kontrola kompletności');
    expect(view).toContain('Bloki i godziny źródłowe');
    expect(view).toContain('nie są zamieniane na fikcyjne wydarzenia');
    expect(css).toContain('.study-completeness-panel');
    expect(css).toContain('.study-incomplete-marker');
  });

  it('keeps active Study groups obvious in Calendar and Study history without confusing future-only choices', () => {
    const app = source('../app/App.tsx');
    const calendar = source('../calendar/CalendarView.tsx');
    const profile = source('../study/StudyProfileSettings.tsx');
    const view = source('../study/StudyView.tsx');
    const css = source('../styles/components.css');

    expect(app).toContain('getActiveUniversityImport()');
    expect(app).toContain('activeStudyGroups={activeStudyGroups}');
    expect(calendar).toContain('className="calendar-study-context"');
    expect(calendar).toContain('Plan dla grup');
    expect(profile).toContain('Grupy aktywnego planu');
    expect(profile).toContain('study-future-groups-note');
    expect(view).toContain('className="import-history-group-list"');
    expect(css).toContain('.calendar-study-context');
    expect(css).toContain('.import-history-group-list');
  });

});
