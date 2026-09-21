import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const styles = readFileSync('src/styles/interface-consistency.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');

describe('Build 180 selected-day panel visual polish', () => {
  it('removes the hard accent rail while keeping category tint', () => {
    expect(styles).toContain('.calendar-view-shell .selected-day-panel .event-card::before { display: none; }');
    expect(styles).toContain('.calendar-view-shell .selected-day-panel .event-card.category-work { background: linear-gradient(135deg');
    expect(styles).toContain('box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--line) 18%, transparent);');
  });

  it('adds breathing room around Study group context', () => {
    expect(styles).toContain('margin: 3px 0 15px;');
    expect(styles).toContain('padding: 2px 0 12px;');
    expect(styles).toContain('gap: 9px;');
    expect(responsive).toContain('margin-top: 2px; margin-bottom: 13px; padding-bottom: 11px;');
  });

  it('keeps requested actions and coworkers visible', () => {
    expect(calendar).toContain('>Dodaj wydarzenie</button>');
    expect(calendar).toContain('showAllWorkCoworkers compactTimeRange');
  });
});
