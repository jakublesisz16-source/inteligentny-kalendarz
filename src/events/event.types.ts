export const EVENT_CATEGORIES = ['STUDY', 'WORK', 'PERSONAL', 'OTHER'] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const EVENT_SOURCE_TYPES = ['MANUAL', 'UNIVERSITY_XLSX', 'WORK_PDF'] as const;
export type EventSourceType = (typeof EVENT_SOURCE_TYPES)[number];

export const EVENT_SPAN_TYPES = ['SINGLE_DAY', 'MULTI_DAY'] as const;
export type EventSpanType = (typeof EVENT_SPAN_TYPES)[number];

export const MANUAL_SERIES_TYPES = ['MANUAL_MULTI_DATE'] as const;
export const AVAILABILITY_IMPACTS = ['BLOCKING', 'NON_BLOCKING'] as const;
export type AvailabilityImpact = (typeof AVAILABILITY_IMPACTS)[number];
export type ManualSeriesType = (typeof MANUAL_SERIES_TYPES)[number];

export type UserModifiedEventField = 'title' | 'startDateTime' | 'endDateTime' | 'locationId' | 'description' | 'category' | 'allDay' | 'availabilityImpact';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  allDay: boolean;
  spanType: EventSpanType;
  locationId?: string;
  category: EventCategory;
  source: EventSourceType;
  availabilityImpact?: AvailabilityImpact;
  seriesId?: string;
  seriesType?: ManualSeriesType;
  sourceImportId?: string;
  sourceEntryId?: string;
  sourceWorkImportId?: string;
  sourceWorkEntryId?: string;
  occurrenceKey?: string;
  seriesKey?: string;
  studyIssueCodes?: string[];
  userModified?: boolean;
  userModifiedFields?: UserModifiedEventField[];
  createdAt: string;
  updatedAt: string;
}

export interface EventDraft {
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  allDay?: boolean;
  spanType?: EventSpanType;
  locationId?: string;
  category: EventCategory;
  availabilityImpact?: AvailabilityImpact;
}

export interface ManualMultiDateDraft {
  title: string;
  description?: string;
  dates: string[];
  startTime: string;
  endTime: string;
  allDay: boolean;
  locationId?: string;
  category: EventCategory;
  availabilityImpact?: AvailabilityImpact;
}

export type EventEditScope = 'SINGLE' | 'SERIES';

export interface EventSubmitOptions {
  selectedDates?: string[];
  editScope?: EventEditScope;
}
