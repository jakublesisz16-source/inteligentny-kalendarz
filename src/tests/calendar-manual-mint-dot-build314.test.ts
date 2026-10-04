import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(path: string): string { return readFileSync(new URL(path, import.meta.url), 'utf8'); }

describe('Build314 exact manual mint-dot regression', () => {
  it('targets the actual Calendar root class so an empty dot span has visible dimensions', () => {
    const styles = source('../styles/interface-refinement.css');
    expect(styles).toContain('.calendar-view-shell .calendar-manual-source-dot');
    expect(styles).not.toContain('.calendar-view .calendar-manual-source-dot');
    expect(styles).toContain('--manual-event-mint');
  });

  it('does not show the PERSONAL purple category chip when the Calendar asks for manual-source accent', () => {
    const card = source('../events/EventCard.tsx');
    expect(card).toContain('showManualSourceAccent ? null : <span className="event-category">');
  });

  it('does not add manual-source color to Today', () => {
    const today = source('../calendar/TodayView.tsx');
    expect(today).not.toContain('accentManualSource');
    expect(today).not.toContain('today-source-dot');
  });
});
