import { toLocalDateKey } from '../calendar/date.utils';
import type { EventDraft, ManualMultiDateDraft } from './event.types';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
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
      if (!startDate || !endDate) errors.timeRange = 'Nieprawidłowy zakres dat.';
      else if (endDate < startDate) errors.timeRange = 'Data zakończenia nie może być wcześniejsza od rozpoczęcia.';
    } else {
      const start = new Date(draft.startDateTime);
      const end = new Date(draft.endDateTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        errors.timeRange = 'Nieprawidłowa data lub godzina.';
      } else if (end <= start) {
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
  if (!draft.allDay) {
    const start = new Date(`2000-01-01T${draft.startTime}`);
    const end = new Date(`2000-01-01T${draft.endTime}`);
    if (!draft.startTime || !draft.endTime || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) errors.timeRange = 'Podaj poprawne godziny.';
    else if (end <= start) errors.timeRange = 'Godzina zakończenia musi być późniejsza od rozpoczęcia.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}
