import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const coworkerList = readFileSync('src/work/CoworkerOverlapList.tsx', 'utf8');
const consistency = readFileSync('src/planning/consistency.ts', 'utf8');

describe('1.2.0.18 work roster and commute consistency', () => {
  it('shows the complete coworker list without expand/collapse controls', () => {
    expect(coworkerList).toContain('sorted.map((person)');
    expect(coworkerList).not.toContain('Pokaż wszystkich');
    expect(coworkerList).not.toContain("'Zwiń'");
  });

  it('only reports commute warnings when locations are known', () => {
    expect(consistency).toContain('if (!workLocationId || !other.locationId) return 0');
    expect(consistency).not.toContain('insufficientTravel || touching');
  });
});
