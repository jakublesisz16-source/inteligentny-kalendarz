import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const consistency = readFileSync('src/styles/interface-consistency.css', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.146 selected day panel polish', () => {
  it('keeps the selected day hierarchy without a redundant Study-plan block', () => {
    expect(calendar).toContain('calendar-selected-day-heading');
    expect(calendar).toContain('calendar-selected-day-heading-actions');
    expect(calendar).toContain('calendar-selected-day-content');
    expect(calendar).not.toContain('calendar-selected-day-study-context');
    expect(calendar).not.toContain("'Wybrany dzień'");
  });

  it('keeps one outer surface while turning the event card into an integrated section', () => {
    expect(consistency).toContain('.calendar-view-shell .calendar-side-column .selected-day-panel {');
    expect(consistency).toContain('background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(252,247,249,.96) 56%, rgba(255,255,255,.97));');
    expect(consistency).toContain('border: 1px solid color-mix(in srgb, var(--line) 84%, white);');
    expect(consistency).toContain('box-shadow: 0 14px 32px rgba(71, 43, 54, .07);');
    expect(consistency).toContain('.calendar-view-shell .selected-day-panel .event-card {');
    expect(consistency).toContain('border: 0;');
    expect(consistency).toContain('box-shadow: none;');
    expect(consistency).toContain('.calendar-view-shell .selected-day-panel .event-card.category-work { background: linear-gradient');
    expect(consistency).toContain('background: transparent;');
    expect(consistency).toContain('.calendar-view-shell .selected-day-panel .event-actions-column {');
    expect(consistency).toContain('grid-column: 1 / -1;');
    expect(consistency).toContain('.calendar-view-shell .selected-day-panel .event-coworker-line {');
  });

  it('keeps the mobile day surfaces aligned with the desktop hierarchy', () => {
    expect(responsive).toContain('.calendar-mobile-day-preview-list { display: grid; gap: 8px; }');
    expect(responsive).toContain('.calendar-view-shell .selected-day-panel .event-card.compact-time-range { grid-template-columns: 72px minmax(0, 1fr);');
    expect(responsive).toContain('background: linear-gradient(180deg, rgba(255,255,255,.99), rgba(252,247,249,.97) 56%, rgba(255,255,255,.98));');
  });

  it('keeps database schema stable', () => {
    expect(version).toMatch(/APP_VERSION\s*=\s*'\d+\.\d+\.\d+\.\d+'/u);
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
