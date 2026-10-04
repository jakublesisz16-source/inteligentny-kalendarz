import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('Build309 Today manual-event accent polish', () => {
  it('adds a mint source dot to manual Today cards and tomorrow preview rows', () => {
    const today = source('../calendar/TodayView.tsx');
    const eventCard = source('../events/EventCard.tsx');
    expect(today).toContain("accentManualSource />");
    expect(today).toContain("today-source-dot");
    expect(today).toContain("manual-source-accent");
    expect(eventCard).toContain("accentManualSource?: boolean");
    expect(eventCard).toContain("event-source-dot event-source-dot-manual");
    expect(eventCard).toContain("showManualSourceAccent ? ' manual-source-accent' : ''");
  });

  it('keeps tomorrow preview denser than before on desktop', () => {
    const styles = source('../styles/interface-refinement.css');
    expect(styles).toContain('Today manual-event mint dot and tighter tomorrow preview');
    expect(styles).toContain('.today-view .today-future-preview');
    expect(styles).toContain('.today-view .today-tomorrow-row');
  });
});
