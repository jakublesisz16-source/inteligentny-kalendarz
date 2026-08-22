import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EventCard } from '../events/EventCard';
import { studyEventDisplay, type StudyEventGroupMetadata } from '../events/study-event-display';
import type { CalendarEvent } from '../events/event.types';
import type { Location } from '../locations/location.types';
import { studyEventGroupMetadataFromEntries } from '../study/use-study-event-groups';
import type { UniversityImportEntry } from '../study/study.types';

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
    sourceImportId: 'import-1',
    sourceEntryId: 'entry-1',
    description: 'Wykład - Grupa 12A - aula A',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function render(event: CalendarEvent, metadata?: StudyEventGroupMetadata, location?: Location): string {
  return renderToStaticMarkup(createElement(EventCard, {
    event,
    ...(metadata ? { studyGroupMetadata: metadata } : {}),
    ...(location ? { location } : {}),
    timeFormat: '24h',
    onEdit: () => undefined,
  }));
}

function entry(overrides: Partial<UniversityImportEntry> = {}): UniversityImportEntry {
  return {
    id: 'entry-1',
    importId: 'import-1',
    sourceKey: 'source-1',
    sourceOnly: true,
    sourceSheet: 'WYKŁADY',
    sourceRange: 'A1:B1',
    originalText: 'test',
    subject: 'Pediatria',
    groupScope: 'ALL',
    groupTags: [],
    warnings: [],
    eventId: 'study-event',
    ...overrides,
  };
}

describe('1.0.2 Study group visibility', () => {
  it('shows an explicit study group next to the event time and removes duplicate group text from description', () => {
    const markup = render(studyEvent(), { groupTags: ['12A'], groupScope: 'SPECIFIC' });
    expect(markup).toContain('class="event-study-group">Grupa 12A</span>');
    expect(markup).toContain('Wykład - aula A');
    expect((markup.match(/Grupa 12A/g) ?? []).length).toBe(1);
  });

  it('uses a plural label for multiple groups', () => {
    const display = studyEventDisplay(studyEvent(), { groupTags: ['12A', '12B'], groupScope: 'SPECIFIC' });
    expect(display.groupLabel).toBe('Grupy 12A, 12B');
  });

  it('labels group-wide lectures as shared only when stored source metadata explicitly says ALL', () => {
    expect(studyEventDisplay(studyEvent({ description: 'Wykład - aula A' }), { groupTags: [], groupScope: 'ALL' }).groupLabel).toBe('Wspólne');
    expect(studyEventDisplay(studyEvent({ description: 'Wykład - aula A' }), { groupTags: [], groupScope: 'UNKNOWN' }).groupLabel).toBeUndefined();
  });

  it('maps persisted import-entry metadata back to its calendar event without changing the database schema', () => {
    const event = studyEvent();
    const metadata = studyEventGroupMetadataFromEntries(event, [entry()]);
    expect(metadata).toEqual({ groupTags: [], groupScope: 'ALL' });
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

  it('does not repeat the same location name and address in the visible location row', () => {
    const location: Location = {
      id: 'location-a',
      name: 'ul. Akademicka 7',
      type: 'UNIVERSITY',
      address: 'ul. Akademicka 7',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };
    const markup = render(studyEvent({ locationId: location.id }), undefined, location);
    expect((markup.match(/class="event-location">ul\. Akademicka 7<\/p>/g) ?? []).length).toBe(1);
    expect(markup).not.toContain('class="event-location">ul. Akademicka 7 - ul. Akademicka 7</p>');
    expect(markup).toContain('aria-label="Wyznacz trasę do ul. Akademicka 7 w Mapach Google"');
  });
});
