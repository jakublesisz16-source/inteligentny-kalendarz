import type { CalendarEvent } from '../events/event.types';
import type { Location, LocationType } from '../locations/location.types';

export type GlobalSearchResultKind = 'EVENT' | 'STUDY' | 'WORK' | 'LOCATION';

export interface GlobalSearchItem {
  id: string;
  kind: GlobalSearchResultKind;
  title: string;
  searchableText: string;
  titleSearchText: string;
  event?: CalendarEvent;
  location?: Location;
  eventLocation?: Location;
}

export interface GlobalSearchResponse {
  results: GlobalSearchItem[];
  totalCount: number;
  hasMore: boolean;
}

const KIND_LABELS: Record<GlobalSearchResultKind, string> = {
  EVENT: 'Wydarzenie',
  STUDY: 'Studia',
  WORK: 'Praca',
  LOCATION: 'Miejsce',
};

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  HOME_AREA: 'Obszar domowy',
  WORK: 'Praca',
  UNIVERSITY: 'Uczelnia',
  CLINIC: 'Klinika',
  OTHER: 'Inne',
};

export function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase('pl-PL')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function classifySearchEvent(event: CalendarEvent): Exclude<GlobalSearchResultKind, 'LOCATION'> {
  if (event.source === 'UNIVERSITY_XLSX') return 'STUDY';
  if (event.source === 'WORK_PDF') return 'WORK';
  if (event.category === 'STUDY') return 'STUDY';
  if (event.category === 'WORK') return 'WORK';
  return 'EVENT';
}

export function buildGlobalSearchItems(events: CalendarEvent[], locations: Location[]): GlobalSearchItem[] {
  const locationById = new Map(locations.map((location) => [location.id, location]));

  const eventItems = events.map((event): GlobalSearchItem => {
    const kind = classifySearchEvent(event);
    const eventLocation = event.locationId ? locationById.get(event.locationId) : undefined;
    const searchableText = normalizeSearchText([
      event.title,
      event.description ?? '',
      KIND_LABELS[kind],
      eventLocation?.name ?? '',
      eventLocation?.address ?? '',
    ].join(' '));

    return {
      id: `event:${event.id}`,
      kind,
      title: event.title,
      titleSearchText: normalizeSearchText(event.title),
      searchableText,
      event,
      ...(eventLocation ? { eventLocation } : {}),
    };
  });

  const locationItems = locations.map((location): GlobalSearchItem => ({
    id: `location:${location.id}`,
    kind: 'LOCATION',
    title: location.name,
    titleSearchText: normalizeSearchText(location.name),
    searchableText: normalizeSearchText([
      location.name,
      location.address,
      location.note ?? '',
      LOCATION_TYPE_LABELS[location.type],
      KIND_LABELS.LOCATION,
    ].join(' ')),
    location,
  }));

  return [...eventItems, ...locationItems];
}

function parseDateKey(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return Number.POSITIVE_INFINITY;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function eventDistanceFromToday(item: GlobalSearchItem, todayKey: string): number {
  if (!item.event) return Number.POSITIVE_INFINITY;
  const eventKey = item.event.startDateTime.slice(0, 10);
  return Math.abs(parseDateKey(eventKey) - parseDateKey(todayKey));
}

function relevanceRank(item: GlobalSearchItem, normalizedQuery: string): number {
  if (item.titleSearchText === normalizedQuery) return 0;
  if (item.titleSearchText.startsWith(normalizedQuery)) return 1;
  if (item.titleSearchText.includes(normalizedQuery)) return 2;
  return 3;
}

function compareSearchItems(a: GlobalSearchItem, b: GlobalSearchItem, query: string, todayKey: string): number {
  const rankDelta = relevanceRank(a, query) - relevanceRank(b, query);
  if (rankDelta) return rankDelta;

  if (a.event && b.event) {
    const distanceDelta = eventDistanceFromToday(a, todayKey) - eventDistanceFromToday(b, todayKey);
    if (distanceDelta) return distanceDelta;
  } else if (a.location && b.location) {
    const locationDelta = a.title.localeCompare(b.title, 'pl', { sensitivity: 'base' });
    if (locationDelta) return locationDelta;
  }

  const titleDelta = a.title.localeCompare(b.title, 'pl', { sensitivity: 'base' });
  if (titleDelta) return titleDelta;
  const kindDelta = a.kind.localeCompare(b.kind);
  if (kindDelta) return kindDelta;
  return a.id.localeCompare(b.id);
}

export function searchGlobalItems(
  items: GlobalSearchItem[],
  query: string,
  todayKey: string,
  limit = 12,
): GlobalSearchResponse {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length < 2) return { results: [], totalCount: 0, hasMore: false };

  const tokens = normalizedQuery.split(' ').filter(Boolean);
  const matches = items
    .filter((item) => tokens.every((token) => item.searchableText.includes(token)))
    .sort((a, b) => compareSearchItems(a, b, normalizedQuery, todayKey));

  const safeLimit = Math.max(1, Math.floor(limit));
  return {
    results: matches.slice(0, safeLimit),
    totalCount: matches.length,
    hasMore: matches.length > safeLimit,
  };
}

export function searchKindLabel(kind: GlobalSearchResultKind): string {
  return KIND_LABELS[kind];
}
