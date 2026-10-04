import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

describe('Build315 removes the Build314 source-dot workaround', () => {
  it('has no dedicated manual-event dot token or selectors', () => {
    const tokens = source('../styles/tokens.css');
    const styles = source('../styles/interface-refinement.css');
    expect(tokens).not.toContain('--manual-event-mint');
    expect(styles).not.toContain('calendar-manual-source-dot');
    expect(styles).not.toContain('event-source-dot');
  });

  it('keeps Today free of additional source markers', () => {
    const today = source('../calendar/TodayView.tsx');
    expect(today).not.toContain('accentManualSource');
    expect(today).not.toContain('today-source-dot');
  });
});
