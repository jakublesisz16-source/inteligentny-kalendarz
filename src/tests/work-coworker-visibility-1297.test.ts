import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workView = readFileSync('src/work/WorkView.tsx', 'utf8');
const eventCard = readFileSync('src/events/EventCard.tsx', 'utf8');
const responsive = readFileSync('src/styles/responsive.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.97 complete coworker visibility', () => {
  it('keeps the entire team visible in the nearest Work shift', () => {
    expect(workView).toContain('nearestCoworkers.map((person)');
    expect(workView).not.toContain('nearestCoworkers.slice(');
    expect(workView).toContain("nearestCoworkers.length === 1 ? 'osoba' : 'osób'");
  });

  it('does not hide full-list coworker rows in the mobile selected-day panel', () => {
    expect(eventCard).not.toContain('event-coworker-mobile-more');
    expect(responsive).not.toContain('.selected-day-panel .event-coworker-line:nth-child(n+5)');
    expect(responsive).not.toContain('.selected-day-panel .event-coworker-mobile-more');
  });

  it('keeps long coworker names wrap-safe on phones', () => {
    expect(responsive).toContain('.work-next-card .coworker-inline > span { max-width: 100%; overflow-wrap: anywhere; }');
  });

  it('does not change the database schema', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
