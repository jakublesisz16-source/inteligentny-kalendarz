import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EventCard } from '../events/EventCard';
import { studyEventDisplay } from '../events/study-event-display';
import type { CalendarEvent } from '../events/event.types';
import type { Location } from '../locations/location.types';

function studyEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'study-event',
    title: 'Pediatria',
    startDateTime: '2026-08-11T08:00:00',
    endDateTime: '2026-08-11T14:00:00',
    allDay: false,
    spanType: 'SINGLE_DAY',
    category: 'STUDY',
    source: 'UNIVERSITY_XLSX',
    description: 'Wykład - Grupa 12A - aula A',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function render(event: CalendarEvent, location?: Location): string {
  return renderToStaticMarkup(createElement(EventCard, {
    event,
    ...(location ? { location } : {}),
    timeFormat: '24h',
    onEdit: () => undefined,
  }));
}

describe('DEV4-STUDY-CALENDAR-UI-FIX2 group visibility', () => {
  it('shows an explicit study group next to the event time and removes duplicate group text from description', () => {
    const markup = render(studyEvent({ studyGroupTags: ['12A'], studyGroupScope: 'SPECIFIC' }));
    expect(markup).toContain('class="event-study-group">Grupa 12A</span>');
    expect(markup).toContain('Wykład - aula A');
    expect((markup.match(/Grupa 12A/g) ?? []).length).toBe(1);
  });

  it('uses a plural label for multiple groups', () => {
    const display = studyEventDisplay(studyEvent({ studyGroupTags: ['12A', '12B'], studyGroupScope: 'SPECIFIC' }));
    expect(display.groupLabel).toBe('Grupy 12A, 12B');
  });

  it('labels group-wide lectures as shared only when scope is explicitly ALL', () => {
    expect(studyEventDisplay(studyEvent({ studyGroupTags: [], studyGroupScope: 'ALL', description: 'Wykład - aula A' })).groupLabel).toBe('Wspólne');
    expect(studyEventDisplay(studyEvent({ studyGroupTags: [], studyGroupScope: 'UNKNOWN', description: 'Wykład - aula A' })).groupLabel).toBeUndefined();
  });

  it('keeps legacy imported events readable by extracting only the generated Grupa segment', () => {
    const display = studyEventDisplay(studyEvent({ description: 'Ćwiczenia - Grupa 13B - sala 205' }));
    expect(display.groupLabel).toBe('Grupa 13B');
    expect(display.description).toBe('Ćwiczenia - sala 205');
  });

  it('does not guess a group from arbitrary study text', () => {
    const display = studyEventDisplay(studyEvent({ description: 'Pediatria grupy 8-osobowe' }));
    expect(display.groupLabel).toBeUndefined();
    expect(display.description).toBe('Pediatria grupy 8-osobowe');
  });

  it('does not repeat the same location name and address in a narrow study card', () => {
    const location: Location = {
      id: 'location-a',
      name: 'ul. Trojdena 2a',
      type: 'UNIVERSITY',
      address: 'ul. Trojdena 2a',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };
    const markup = render(studyEvent({ locationId: location.id }), location);
    expect((markup.match(/class=\"event-location\">ul\. Trojdena 2a<\/p>/g) ?? []).length).toBe(1);
    expect(markup).not.toContain('class=\"event-location\">ul. Trojdena 2a - ul. Trojdena 2a</p>');
    expect(markup).toContain('aria-label=\"Wyznacz trasę do ul. Trojdena 2a w Mapach Google\"');
  });
});
