import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CalendarView } from '../calendar/CalendarView';
import { EventCard } from '../events/EventCard';
import type { CalendarEvent } from '../events/event.types';
import type { CoworkerOverlap } from '../work/work.types';

const workEvent: CalendarEvent = {
  id: 'work-event',
  title: 'Zmiana',
  startDateTime: '2026-08-11T07:00:00',
  endDateTime: '2026-08-11T15:00:00',
  allDay: false,
  spanType: 'SINGLE_DAY',
  category: 'WORK',
  source: 'WORK_PDF',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function coworkers(count: number): CoworkerOverlap[] {
  return Array.from({ length: count }, (_, index) => ({
    displayName: `Osoba ${index + 1}`,
    coworkerStartTime: `0${7 + (index % 2)}:00`.slice(-5),
    coworkerEndTime: '15:00',
    overlapStartTime: index % 2 ? '08:00' : '07:00',
    overlapEndTime: '15:00',
    overlapMinutes: index % 2 ? 420 : 480,
  }));
}

function render(workCoworkers: CoworkerOverlap[], showAllWorkCoworkers = false): string {
  return renderToStaticMarkup(createElement(EventCard, {
    event: workEvent,
    timeFormat: '24h',
    onEdit: () => undefined,
    workCoworkers,
    showAllWorkCoworkers,
  }));
}

function coworkerLineCount(markup: string): number {
  return (markup.match(/class="event-coworker-line"/g) ?? []).length;
}

describe('1.0.1 coworkers on Today event card', () => {
  it('shows all coworkers when full-list mode is enabled', () => {
    const markup = render(coworkers(6), true);
    expect(coworkerLineCount(markup)).toBe(6);
    expect(markup).not.toContain('+2 więcej');
    expect(markup).toContain('razem 07:00-15:00');
    expect(markup).toContain('razem 08:00-15:00');
  });

  it('keeps the default compact card limited to four coworkers', () => {
    const markup = render(coworkers(6));
    expect(coworkerLineCount(markup)).toBe(4);
    expect(markup).toContain('+2 więcej');
  });

  it('keeps zero, one and four coworker states unchanged', () => {
    const emptyMarkup = render([]);
    const oneMarkup = render(coworkers(1));
    const fourMarkup = render(coworkers(4));

    expect(emptyMarkup).not.toContain('Z Tobą na zmianie');
    expect(coworkerLineCount(oneMarkup)).toBe(1);
    expect(oneMarkup).not.toContain('więcej');
    expect(coworkerLineCount(fourMarkup)).toBe(4);
    expect(fourMarkup).not.toContain('więcej');
  });
});


afterEach(() => {
  vi.useRealTimers();
});

describe('1.0.1 selected calendar day coworkers', () => {
  it('shows the full coworker list in the selected-day detail while preserving names and overlap times', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T12:00:00'));
    const selectedDayCoworkers: CoworkerOverlap[] = [
      ...coworkers(5),
      {
        displayName: 'ALEKSANDRA PRZYKŁADOWSKA',
        coworkerStartTime: '16:00',
        coworkerEndTime: '21:00',
        overlapStartTime: '16:00',
        overlapEndTime: '18:00',
        overlapMinutes: 120,
      },
    ];
    const selectedDayEvent: CalendarEvent = {
      ...workEvent,
      startDateTime: '2026-08-11T16:00:00',
      endDateTime: '2026-08-11T21:00:00',
    };

    const markup = renderToStaticMarkup(createElement(CalendarView, {
      events: [selectedDayEvent],
      locations: [],
      timeFormat: '24h',
      dayConstraints: [],
      dayAttributes: [],
      consistencyIssues: [],
      onToggleWorkAvailabilityExclusion: async () => undefined,
      onToggleTradingSunday: async () => undefined,
      onAcknowledgeConsistency: async () => undefined,
      onAdd: () => undefined,
      onAddMany: () => undefined,
      onEdit: () => undefined,
      onStudyCorrect: () => undefined,
      onStudySeriesCorrect: () => undefined,
      availabilityPlans: [],
      coworkersByEvent: { [selectedDayEvent.id]: selectedDayCoworkers },
      onOpenAvailability: () => undefined,
    }));

    expect((markup.match(/class="event-coworker-line"/g) ?? []).length).toBe(6);
    expect(markup).toContain('ALEKSANDRA PRZYKŁADOWSKA');
    expect(markup).toContain('razem 16:00-18:00');
    expect(markup).not.toContain('+2 więcej');
  });
});
