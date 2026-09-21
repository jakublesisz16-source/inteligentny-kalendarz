import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync('src/styles/interface-consistency.css', 'utf8');
const consistency = readFileSync('src/planning/ConsistencyCenter.tsx', 'utf8');

describe('Build188 real-phone polish', () => {
  it('forces Settings and Study controls into deliberate phone layouts', () => {
    expect(styles).toContain('1.2.0.188 - real-phone polish for Settings, Studies, consistency and Work');
    expect(styles).toContain('.settings-minimal-view .settings-core .settings-essential-grid');
    expect(styles).toContain('.study-profile-group-picker .study-group-choice-grid');
    expect(styles).toContain('grid-template-columns: minmax(122px, .82fr) minmax(0, 1.18fr);');
  });

  it('uses a compact select for consistency filters on phones', () => {
    expect(consistency).toContain('consistency-filters-desktop');
    expect(consistency).toContain('consistency-filter-select');
    expect(styles).toContain('.consistency-filters-desktop { display: none; }');
  });

  it('keeps issue and Work details visible but calmer', () => {
    expect(consistency).toContain('consistency-event-actions');
    expect(styles).toContain('.consistency-event-actions');
    expect(styles).toContain('.work-shift-team-details > summary');
  });
});
