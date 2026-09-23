import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Build205 Work streamline', () => {
  it('removes repeated Grafik framing while preserving team details', () => {
    const work = read('src/work/WorkView.tsx');
    expect(work).toContain('work-roster-direct');
    expect(work).not.toContain('work-roster-minimal-heading"><h2>Grafik</h2>');
    expect(work).toContain('<CoworkerOverlapList people={coworkers} compact />');
  });

  it('makes weekly availability linear and removes a redundant title', () => {
    const availability = read('src/availability/AvailabilityView.tsx');
    const css = read('src/styles/interface-refinement.css');
    expect(availability).toContain('availability-week-editor-clean');
    expect(availability).not.toContain('<h3>Plan tygodnia</h3>');
    expect(css).toContain('.availability-week-editor-clean .availability-week-days');
    expect(css).toContain('grid-template-columns: 1fr !important;');
  });

  it('moves rhythm facts into the main monthly summary', () => {
    const summary = read('src/work/WorkSummaryView.tsx');
    expect(summary).toContain('work-summary-rhythm-inline');
    expect(summary).toContain('work-summary-recent-only');
    expect(summary).not.toContain('<h3>Rytm pracy</h3>');
    expect(summary).toContain('<h3>Godziny w tygodniach</h3>');
    expect(summary).toContain('<h3>Ostatnie miesiące</h3>');
    expect(summary).toContain('<h3>Dyspozycyjność</h3>');
  });

  it('keeps Build205 compact without shrinking away mobile actions', () => {
    const css = read('src/styles/interface-refinement.css');
    expect(css).toContain('/* Build205 - Work screens: less repetition, straighter scanning, less vertical travel. */');
    expect(css).toContain("grid-template-areas: 'name full shared';");
    expect(css).toContain('min-height: 44px !important;');
    expect(css).toContain('grid-template-rows: auto 42px auto;');
  });
});
