import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const work = readFileSync(new URL('../work/WorkView.tsx', import.meta.url), 'utf8');
const consistency = readFileSync(new URL('../styles/interface-consistency.css', import.meta.url), 'utf8');
const responsive = readFileSync(new URL('../styles/responsive.css', import.meta.url), 'utf8');

describe('Build 179 nearest/current Work team visibility', () => {
  it('keeps all coworkers visible without an expand control', () => {
    expect(work).toContain('className="work-next-team-static"');
    expect(work).toContain('nearestCoworkers.map((person)');
    expect(work).not.toContain('<details className="work-next-team-details"');
    expect(work).not.toContain('nearestCoworkers.slice(');
  });

  it('keeps the visible team compact below the nearest shift summary', () => {
    expect(consistency).toContain('.work-next-team-static {');
    expect(consistency).toContain('grid-column: 1 / -1;');
    expect(consistency).toContain('.work-next-team-count {');
  });

  it('keeps the same full-team hierarchy on phones', () => {
    expect(responsive).toContain('.work-next-team-static { justify-self: stretch; width: 100%; }');
    expect(responsive).toContain('.work-next-team-static > .coworker-inline { justify-content: flex-start; }');
  });
});
