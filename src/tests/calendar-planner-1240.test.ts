import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const form = readFileSync('src/events/EventForm.tsx', 'utf8');
const card = readFileSync('src/events/EventCard.tsx', 'utf8');
const types = readFileSync('src/events/event.types.ts', 'utf8');
const database = readFileSync('src/storage/database.ts', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.40 minimal week planner', () => {
  it('uses a neutral today state while preserving pink for selected days', () => {
    expect(css).toContain('/* 1.2.0.40 - clearer week planner and minimal event form */');
    expect(css).toContain('.calendar-day.today .day-number');
    expect(css).toContain('.calendar-week-day-heading.today strong');
    expect(css).toContain('.calendar-week-day-heading.selected');
    expect(css).not.toContain('.calendar-week-column.today:not(.selected) {\n  background-color:');
  });

  it('shows a live current-time marker in the weekly planner', () => {
    expect(calendar).toContain('const [currentTime, setCurrentTime]');
    expect(calendar).toContain('calendar-week-now-line');
    expect(calendar).toContain('setInterval(() => setCurrentTime(new Date()), 60_000)');
  });

  it('keeps the new-event form focused on title, date, time and place', () => {
    expect(form).toContain('event-form-minimal');
    expect(form).toContain('Więcej opcji');
    expect(form).toContain('event-advanced-options');
    expect(form).toContain('placeholder="Wpisz dowolne miejsce, np. Louvre albo Hotel Central"');
    expect(form).toContain('<datalist id="event-location-suggestions">');
  });

  it('stores free-text places without turning them into required saved locations', () => {
    expect(types).toContain('locationText?: string;');
    expect(database).toContain('draft.locationText?.trim()');
    expect(card).toContain('event.locationText?.trim()');
    expect(card).toContain("buildGoogleMapsDirectionsUrl({ name: '', address: event.locationText.trim() })");
  });

  it('does not require a database schema migration', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
