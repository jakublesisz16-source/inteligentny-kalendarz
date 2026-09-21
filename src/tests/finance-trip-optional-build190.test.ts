import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard = readFileSync('src/finance/FinanceDashboardView.tsx', 'utf8');

describe('Build190 optional trip editor contract', () => {
  it('removes tripName when detaching instead of assigning undefined', () => {
    expect(dashboard).toContain('if (nextTripName) return { ...current, tripName: nextTripName };');
    expect(dashboard).toContain('delete next.tripName;');
    expect(dashboard).not.toContain('tripName: event.target.value || undefined');
  });

  it('keeps the form property optional under exactOptionalPropertyTypes', () => {
    expect(dashboard).toContain('tripName?: string;');
    expect(dashboard).not.toContain('tripName?: string | undefined;');
  });
});
