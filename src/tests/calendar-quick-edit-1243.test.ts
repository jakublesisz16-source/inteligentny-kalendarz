import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const editor = readFileSync('src/events/QuickEventEditor.tsx', 'utf8');
const app = readFileSync('src/app/App.tsx', 'utf8');
const css = readFileSync('src/styles/components.css', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.43 selected-day quick edit', () => {
  it('edits simple manual timed events inline in the selected-day panel', () => {
    expect(calendar).toContain("return event.source === 'MANUAL' && !event.allDay && event.spanType === 'SINGLE_DAY'");
    expect(calendar).toContain('<QuickEventEditor');
    expect(calendar).toContain('setQuickEditEventId(event.id)');
  });

  it('keeps the quick editor limited to the planning essentials', () => {
    expect(editor).toContain('Szybka edycja');
    expect(editor).toContain('<span>Nazwa</span>');
    expect(editor).toContain('<span>Od</span>');
    expect(editor).toContain('<span>Do</span>');
    expect(editor).toContain('Miejsce <small>opcjonalnie</small>');
    expect(editor).toContain('Więcej opcji');
  });

  it('accepts free-text places while preserving saved-location suggestions', () => {
    expect(editor).toContain('list="quick-event-location-suggestions"');
    expect(editor).toContain('<datalist id="quick-event-location-suggestions">');
    expect(editor).toContain('return { locationText: value }');
    expect(editor).toContain('return { locationId: matched.id }');
  });

  it('saves through the existing event update path and keeps schema 14', () => {
    expect(app).toContain('async function quickEditEvent(event: CalendarEvent, draft: EventDraft)');
    expect(app).toContain('await updateEvent(event.id, draft)');
    expect(app).toContain('onQuickEdit={quickEditEvent}');
    expect(css).toContain('/* 1.2.0.43 - quick editing from the selected-day panel */');
    expect(version).toContain("APP_VERSION = '1.2.0'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
