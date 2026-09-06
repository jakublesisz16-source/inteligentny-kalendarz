import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarView } from '../calendar/CalendarView';
import type { CalendarEvent } from '../events/event.types';

function event(id: string, title: string, start: string, end: string): CalendarEvent {
  return {
    id,
    title,
    startDateTime: start,
    endDateTime: end,
    allDay: false,
    spanType: 'SINGLE_DAY',
    category: 'STUDY',
    source: 'UNIVERSITY_XLSX',
    createdAt: '2026-09-05T00:00:00.000Z',
    updatedAt: '2026-09-05T00:00:00.000Z',
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('1.1.0 compact month grid', () => {
  it('keeps cells compact and exposes full event details through the desktop tooltip and selected-day panel', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00'));

    const events = [
      event('pediatria', 'PEDIATRIA - zajęcia praktyczne', '2026-10-26T08:00:00', '2026-10-26T14:00:00'),
      event('wyklad', 'PEDIATRIA - wykład', '2026-10-26T15:00:00', '2026-10-26T17:15:00'),
    ];

    const markup = renderToStaticMarkup(createElement(CalendarView, {
      events,
      locations: [],
      timeFormat: '24h',
      dayConstraints: [],
      dayAttributes: [],
      consistencyIssues: [],
      activeStudyGroups: ['MAIN:12', 'G12:12A', 'G8:12B', 'G4:12B1'],
      incompleteStudyEntries: [],
      onToggleWorkAvailabilityExclusion: async () => undefined,
      onToggleTradingSunday: async () => undefined,
      onAcknowledgeConsistency: async () => undefined,
      onAdd: () => undefined,
      onAddMany: () => undefined,
      onEdit: () => undefined,
      onStudyCorrect: () => undefined,
      onStudySeriesCorrect: () => undefined,
      availabilityPlans: [],
      coworkersByEvent: {},
      onOpenAvailability: () => undefined,
    }));

    expect(markup).not.toContain('class="calendar-day-events"');
    expect(markup).toContain('class="category-count-row calendar-day-counts"');
    expect(markup).toMatch(/title="08:00-14:00 PEDIATRIA - zajęcia praktyczne\s+15:00-17:15 PEDIATRIA - wykład"/u);
    expect(markup).toContain('12 · główna');
    expect(markup).toContain('12A · 12-os.');
    expect(markup).toContain('12B · 8-os.');
    expect(markup).toContain('12B1 · 4-os.');
  });
});
