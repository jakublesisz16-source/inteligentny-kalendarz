import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');

describe('Build197 interface coherence', () => {
  it('flattens remaining nested utility surfaces', () => {
    expect(css).toContain('.availability-dashboard-layout .availability-week-day.has-hours');
    expect(css).toContain('.finance-receipt-edit-item');
    expect(css).toContain('.study-history-compact-grid .import-history-card');
    expect(css).toContain('background: transparent');
  });

  it('keeps mobile Work coworkers visible in a readable text grid', () => {
    expect(css).toContain('.work-next-team-static > .coworker-inline');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
  });

  it('keeps primary mobile actions compact rather than full-width by default', () => {
    expect(css).toContain('min-width: 88px;');
    expect(css).toContain('width: auto !important;');
  });
});
