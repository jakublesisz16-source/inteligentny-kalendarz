import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const refinement = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');
const version = readFileSync(new URL('../core/version.ts', import.meta.url), 'utf8');

describe('Build262 mobile visual readability polish', () => {
  it('separates free-day status from the next-event preview on mobile Today', () => {
    expect(refinement).toContain('Build262 - mobile readability polish');
    expect(refinement).toContain('.today-view.is-empty .today-plan-panel.today-single-surface {');
    expect(refinement).toContain('gap: 11px;');
    expect(refinement).toContain('background: transparent;');
    expect(refinement).toContain('.today-view.is-empty .today-plan-panel.today-single-surface > .empty-state {');
    expect(refinement).toContain('min-height: 150px;');
    expect(refinement).toContain('.today-plan-panel .today-next-strip.today-future-preview {');
  });

  it('keeps next-event content readable instead of forcing it into one compressed line', () => {
    expect(refinement).toContain('.today-plan-panel .today-next-strip.today-future-preview > strong {');
    expect(refinement).toContain('white-space: normal;');
    expect(refinement).toContain('grid-column: 1 / -1;');
    expect(refinement).toContain('.today-plan-panel .today-next-strip.today-future-preview .today-next-when {');
  });

  it('strengthens only existing mobile hierarchy on Finance, Study and Work', () => {
    expect(refinement).toContain('.finance-first-expense-empty,');
    expect(refinement).toContain('.study-import-summary-v207,');
    expect(refinement).toContain('.work-overview-simple .work-comparison-card-empty {');
    expect(refinement).toContain('.study-profile-group-picker .study-group-choice-card {');
    expect(refinement).toContain('.work-roster-direct .work-shift-row-minimal {');
  });

  it('keeps schema 14 while advancing the normal build line', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'1\.2\.0\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
