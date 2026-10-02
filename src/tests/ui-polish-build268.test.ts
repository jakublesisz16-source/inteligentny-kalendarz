import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync(new URL('../calendar/CalendarView.tsx', import.meta.url), 'utf8');
const eventCard = readFileSync(new URL('../events/EventCard.tsx', import.meta.url), 'utf8');
const availability = readFileSync(new URL('../availability/AvailabilityView.tsx', import.meta.url), 'utf8');
const study = readFileSync(new URL('../study/StudyView.tsx', import.meta.url), 'utf8');
const refinement = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');
const consistency = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');
const work = readFileSync(new URL('../work/WorkView.tsx', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('Build268 bounded UI polish', () => {
  it('keeps academic meaning in day surfaces without requiring a persistent month legend', () => {
    expect(calendar).not.toContain('calendar-academic-legend');
    expect(consistency).not.toContain('.calendar-academic-legend');
    expect(calendar).toContain('dayToneClass');
    expect(calendar).toContain('overlayMarkers.map((marker) => marker.label)');
  });

  it('compacts desktop empty Today without changing the mobile contract', () => {
    expect(refinement).toContain('Build268 - bounded polish after real-screen QA');
    expect(refinement).toContain('grid-template-columns: minmax(240px, .72fr) minmax(0, 1.28fr);');
    expect(refinement).toContain('min-height: 112px;');
    expect(refinement).toContain('> .today-future-preview');
  });

  it('removes the routine technical Study source badge but preserves manual-change provenance', () => {
    expect(eventCard).not.toContain('>Plan studiów{');
    expect(eventCard).toContain("event.source === 'UNIVERSITY_XLSX' && event.userModified");
    expect(eventCard).toContain('Zmieniono ręcznie');
  });

  it('shows the active Study group profile next to the active plan', () => {
    expect(study).toContain('study-current-plan-groups');
    expect(study).toContain("activeImport.selectedGroups.map(studyGroupCompactLabel).join(' / ')");
    expect(refinement).toContain('.study-current-plan-groups');
  });

  it('uses natural Work goal wording and retains stable coworker expansion geometry', () => {
    expect(availability).toContain('Cel godzin pracy osiągnięty');
    expect(availability).not.toContain('<strong>Cel tygodnia osiągnięty</strong>');
    expect(work).toContain('className="work-shift-row-trigger"');
    expect(refinement).toContain('--work-team-control-width: 104px;');
    expect(refinement).toContain('grid-template-columns: minmax(0, 1fr) var(--work-team-control-width);');
  });

  it('advances the normal build while keeping schema 14', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'1\.2\.0\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
