import { toLocalDateKey } from '../calendar/date.utils';
import type { EventDraft, ManualMultiDateDraft } from './event.types';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

// Validate local calendar dates without letting Date silently normalize 31 February.
// This is for manual event drafts; the XLS importer has its own source gates.
function isRealLocalDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// Manual drafts store wall-clock time, not timestamps with offsets. Date.parse() also
// accepts 24:00 as midnight of the next day, so check the input before comparing it.
function isRealLocalDateTime(value: string): boolean {
  const match = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d$/.exec(value);
  return Boolean(match && isRealLocalDateKey(match[1] ?? ''));
}

function isValidAllDayDateTime(value: string): boolean {
  return isRealLocalDateKey(value) || isRealLocalDateTime(value);
}

function isRealLocalTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function validateEventDraft(draft: EventDraft): ValidationResult {
  const errors: Record<string, string> = {};
  const title = draft.title.trim();
  const allDay = draft.allDay ?? false;

  if (!title) errors.title = 'Podaj tytuł wydarzenia.';
  if (!draft.startDateTime) errors.startDateTime = allDay ? 'Podaj datę rozpoczęcia.' : 'Podaj datę i godzinę rozpoczęcia.';
  if (!draft.endDateTime) errors.endDateTime = allDay ? 'Podaj datę zakończenia.' : 'Podaj datę i godzinę zakończenia.';

  if (draft.startDateTime && draft.endDateTime) {
    if (allDay) {
      const startDate = toLocalDateKey(draft.startDateTime);
      const endDate = toLocalDateKey(draft.endDateTime);
      if (!isValidAllDayDateTime(draft.startDateTime) || !isValidAllDayDateTime(draft.endDateTime)
        || !startDate || !endDate) errors.timeRange = 'Nieprawidłowy zakres dat.';
      else if (endDate < startDate) errors.timeRange = 'Data zakończenia nie może być wcześniejsza od rozpoczęcia.';
    } else {
      if (!isRealLocalDateTime(draft.startDateTime) || !isRealLocalDateTime(draft.endDateTime)) {
        errors.timeRange = 'Nieprawidłowa data lub godzina.';
      } else if (draft.endDateTime <= draft.startDateTime) {
        errors.timeRange = 'Godzina zakończenia musi być późniejsza od rozpoczęcia.';
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateManualMultiDateDraft(draft: ManualMultiDateDraft): ValidationResult {
  const errors: Record<string, string> = {};
  if (!draft.title.trim()) errors.title = 'Podaj tytuł wydarzenia.';
  const uniqueDates = [...new Set(draft.dates)];
  if (!uniqueDates.length) errors.dates = 'Wybierz co najmniej jeden dzień.';
  if (uniqueDates.length !== draft.dates.length) errors.dates = 'Lista dni zawiera duplikaty.';
  if (draft.dates.some((date) => !isRealLocalDateKey(date))) errors.dates = 'Lista zawiera nieprawidłową datę.';
  if (!draft.allDay) {
    if (!isRealLocalTime(draft.startTime) || !isRealLocalTime(draft.endTime)) errors.timeRange = 'Podaj poprawne godziny.';
    else if (draft.endTime <= draft.startTime) errors.timeRange = 'Godzina zakończenia musi być późniejsza od rozpoczęcia.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
