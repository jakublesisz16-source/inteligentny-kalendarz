import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('src/app/App.tsx', 'utf8');
const calendar = readFileSync('src/calendar/CalendarView.tsx', 'utf8');
const card = readFileSync('src/events/EventCard.tsx', 'utf8');
const version = readFileSync('src/core/version.ts', 'utf8');

describe('1.2.0.50 quick delete for manual calendar events', () => {
  it('shows a direct delete action on eligible manual events in the selected-day panel', () => {
    expect(card).toContain('onDelete?: ((event: CalendarEvent) => void)');
    expect(card).toContain('>Usuń</button>');
    expect(calendar).toContain("event.source === 'MANUAL' && !event.seriesId");
    expect(calendar).toContain('onQuickDelete(event)');
  });

  it('keeps imported and manual-series events out of the shortcut', () => {
    expect(calendar).toContain("event.source === 'MANUAL' && !event.seriesId");
  });

  it('uses the existing reversible soft-delete path', () => {
    expect(app).toContain('async function quickDeleteEvent(event: CalendarEvent)');
    expect(app).toContain('await deleteEvent(event.id)');
    expect(app).toContain("await showUndoToast('Przeniesiono wydarzenie do Kosza.')");
    expect(app).toContain('onQuickDelete={quickDeleteEvent}');
  });

  it('does not require a schema migration', () => {
    expect(version).toContain("APP_VERSION = '1.2.0.145'");
    expect(version).toContain('DATABASE_SCHEMA_VERSION = 14');
  });
});
