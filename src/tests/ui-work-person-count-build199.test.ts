import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../styles/interface-refinement.css', import.meta.url), 'utf8');

describe('Build199 Work person-count geometry', () => {
  it('keeps the expanded trigger fixed-size instead of stretching with the list', () => {
    expect(css).toContain('grid-auto-rows: max-content;');
    expect(css).toContain('align-items: start;');
    expect(css).toContain('.work-shift-team-details[open] > summary');
    expect(css).toContain('align-self: start;');
    expect(css).toContain('height: 36px;');
    expect(css).toContain('max-height: 36px;');
  });

  it('keeps the expanded coworker list below the trigger', () => {
    expect(css).toContain('.work-shift-team-details .coworker-overlap-list.compact');
    expect(css).toContain('grid-row: 2;');
  });
});
