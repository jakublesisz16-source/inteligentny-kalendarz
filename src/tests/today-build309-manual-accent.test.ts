import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('Build309/315 Today compact preview contract', () => {
  it('keeps Today free of manual-source color dots', () => {
    const today = source('../calendar/TodayView.tsx');
    expect(today).not.toContain('accentManualSource />');
    expect(today).not.toContain('today-source-dot');
    expect(today).not.toContain('manual-source-accent');
  });

  it('keeps tomorrow preview dense on desktop', () => {
    const styles = source('../styles/interface-refinement.css');
    expect(styles).toContain('compact Today tomorrow preview; no extra source-dot');
    expect(styles).toContain('.today-view .today-future-preview');
    expect(styles).toContain('.today-view .today-tomorrow-row');
  });
});
