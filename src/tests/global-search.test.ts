import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '../events/event.types';
import type { Location } from '../locations/location.types';
import {
  buildGlobalSearchItems,
  classifySearchEvent,
  normalizeSearchText,
  searchGlobalItems,
} from '../search/global-search';

const todayKey = '2026-08-10';

function event(overrides: Partial<CalendarEvent> & Pick<CalendarEvent, 'id' | 'title'>): CalendarEvent {
  const { id, title, ...rest } = overrides;
  return {
    startDateTime: '2026-08-10T09:00',
    endDateTime: '2026-08-10T10:00',
    allDay: false,
    spanType: 'SINGLE_DAY',
    category: 'PERSONAL',
    source: 'MANUAL',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    ...rest,
    id,
    title,
  };
}

function location(overrides: Partial<Location> & Pick<Location, 'id' | 'name'>): Location {
  const { id, name, ...rest } = overrides;
  return {
    type: 'OTHER',
    address: 'Centrum, Łódź',
    createdAt: '2026-08-01T12:00:00.000Z',
    updatedAt: '2026-08-01T12:00:00.000Z',
    ...rest,
    id,
    name,
  };
}

describe('0.7.0 global search', () => {
  it('normalizes Polish characters, case and whitespace', () => {
    expect(normalizeSearchText('  ŁÓDŹ   Śródmieście  ')).toBe('lodz srodmiescie');
    expect(normalizeSearchText('Zajęcia')).toBe('zajecia');
  });

  it('classifies imported Study and Work before manual category fallbacks', () => {
    expect(classifySearchEvent(event({ id: 'study', title: 'Anatomia', source: 'UNIVERSITY_XLSX', category: 'WORK' }))).toBe('STUDY');
    expect(classifySearchEvent(event({ id: 'work', title: 'Zmiana', source: 'WORK_PDF', category: 'STUDY' }))).toBe('WORK');
    expect(classifySearchEvent(event({ id: 'manual-study', title: 'Nauka', category: 'STUDY' }))).toBe('STUDY');
    expect(classifySearchEvent(event({ id: 'manual-work', title: 'Dyżur', category: 'WORK' }))).toBe('WORK');
    expect(classifySearchEvent(event({ id: 'manual', title: 'Spotkanie', category: 'PERSONAL' }))).toBe('EVENT');
  });

  it('searches event title and description case-insensitively', () => {
    const items = buildGlobalSearchItems([
      event({ id: '1', title: 'Kontrola auta', description: 'Warsztat na Widzewie' }),
    ], []);
    expect(searchGlobalItems(items, 'KONTROLA', todayKey).results.map((item) => item.id)).toEqual(['event:1']);
    expect(searchGlobalItems(items, 'widzewie', todayKey).results.map((item) => item.id)).toEqual(['event:1']);
  });

  it('finds an event by linked location name and address', () => {
    const place = location({ id: 'loc-1', name: 'Centrum Medyczne', address: 'Piotrkowska 10, Łódź' });
    const items = buildGlobalSearchItems([
      event({ id: '1', title: 'Wizyta', locationId: place.id }),
    ], [place]);
    expect(searchGlobalItems(items, 'medyczne', todayKey).results.some((item) => item.id === 'event:1')).toBe(true);
    expect(searchGlobalItems(items, 'piotrkowska', todayKey).results.some((item) => item.id === 'event:1')).toBe(true);
  });

  it('searches locations by name, address and note', () => {
    const place = location({ id: 'loc-1', name: 'Biblioteka', address: 'Narutowicza 17, Łódź', note: 'Wejście od dziedzińca' });
    const items = buildGlobalSearchItems([], [place]);
    expect(searchGlobalItems(items, 'biblioteka', todayKey).results[0]?.kind).toBe('LOCATION');
    expect(searchGlobalItems(items, 'narutowicza', todayKey).results[0]?.kind).toBe('LOCATION');
    expect(searchGlobalItems(items, 'dziedzinca', todayKey).results[0]?.kind).toBe('LOCATION');
  });

  it('requires every query token to match', () => {
    const items = buildGlobalSearchItems([
      event({ id: '1', title: 'Praca centrum', description: 'Zmiana poranna' }),
      event({ id: '2', title: 'Praca zdalna', description: 'Dom' }),
    ], []);
    expect(searchGlobalItems(items, 'praca centrum', todayKey).results.map((item) => item.id)).toEqual(['event:1']);
  });

  it('ranks exact title before prefix, title contains and description-only matches', () => {
    const items = buildGlobalSearchItems([
      event({ id: 'exact', title: 'Dentysta' }),
      event({ id: 'prefix', title: 'Dentysta kontrola' }),
      event({ id: 'contains', title: 'Wizyta dentysta' }),
      event({ id: 'description', title: 'Wizyta', description: 'Dentysta' }),
    ], []);
    expect(searchGlobalItems(items, 'dentysta', todayKey).results.map((item) => item.id)).toEqual([
      'event:exact',
      'event:prefix',
      'event:contains',
      'event:description',
    ]);
  });

  it('uses event date proximity as deterministic tie-break for events', () => {
    const items = buildGlobalSearchItems([
      event({ id: 'far', title: 'Spotkanie A', startDateTime: '2026-09-20T09:00', endDateTime: '2026-09-20T10:00' }),
      event({ id: 'near', title: 'Spotkanie B', startDateTime: '2026-08-11T09:00', endDateTime: '2026-08-11T10:00' }),
    ], []);
    expect(searchGlobalItems(items, 'spotkanie', todayKey).results.map((item) => item.id)).toEqual(['event:near', 'event:far']);
  });

  it('orders tied locations stably by name', () => {
    const items = buildGlobalSearchItems([], [
      location({ id: 'b', name: 'Zoo B', address: 'Adres' }),
      location({ id: 'a', name: 'Zoo A', address: 'Adres' }),
    ]);
    expect(searchGlobalItems(items, 'zoo', todayKey).results.map((item) => item.id)).toEqual(['location:a', 'location:b']);
  });

  it('does not expose the full dataset for empty or one-character queries', () => {
    const items = buildGlobalSearchItems([event({ id: '1', title: 'Test' })], []);
    expect(searchGlobalItems(items, '', todayKey).results).toEqual([]);
    expect(searchGlobalItems(items, 't', todayKey).results).toEqual([]);
  });

  it('limits visible results to 12 and reports more matches', () => {
    const items = buildGlobalSearchItems(
      Array.from({ length: 15 }, (_, index) => event({ id: String(index), title: `Spotkanie ${index}` })),
      [],
    );
    const response = searchGlobalItems(items, 'spotkanie', todayKey);
    expect(response.results).toHaveLength(12);
    expect(response.totalCount).toBe(15);
    expect(response.hasMore).toBe(true);
  });

  it('returns identical ordering for the same input', () => {
    const items = buildGlobalSearchItems([
      event({ id: '1', title: 'Plan dnia' }),
      event({ id: '2', title: 'Plan pracy' }),
    ], [location({ id: '3', name: 'Plan B' })]);
    const first = searchGlobalItems(items, 'plan', todayKey).results.map((item) => item.id);
    const second = searchGlobalItems(items, 'plan', todayKey).results.map((item) => item.id);
    expect(second).toEqual(first);
  });
});
