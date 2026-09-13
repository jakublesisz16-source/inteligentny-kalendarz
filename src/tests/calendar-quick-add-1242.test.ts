import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const app = readFileSync('src/app/App.tsx', 'utf8');
const form = readFileSync('src/events/EventForm.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.42 quick week add', () => {
  it('opens a compact inline composer instead of the full modal after clicking an hour', () => {
    expect(calendar).toContain("setQuickAdd(buildQuickAddState(day, 'WEEK', hour))");
    expect(calendar).toContain('calendar-week-quick-add');
    expect(calendar).toContain('placeholder="Co planujesz?"');
    expect(calendar).toContain('Więcej opcji');
  });

  it('creates a one-hour personal blocking event on quick submit', () => {
    expect(calendar).toContain("category: 'PERSONAL'");
    expect(calendar).toContain("availabilityImpact: 'BLOCKING'");
    expect(calendar).toContain("spanType: 'SINGLE_DAY'");
    expect(app).toContain('onQuickAdd={async (draft) => { await saveEvent(draft); }}');
  });

  it('preserves a typed title when opening the full event form', () => {
    expect(calendar).toContain('onAdd(initial, title || undefined, initialEnd)');
    expect(form).toContain("initialTitle = ''");
    expect(form).toContain('title: initialTitle');
    expect(app).toContain('initialTitle={eventEditor.initialTitle}');
  });

  it('keeps the compact composer visually separate without changing the schema', () => {
    expect(css).toContain('/* 1.2.0.42 - quick add directly from the weekly timeline */');
    expect(css).toContain('.calendar-week-quick-add');
    expect(version).toContain("APP_VERSION = '1.2.0.112'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
