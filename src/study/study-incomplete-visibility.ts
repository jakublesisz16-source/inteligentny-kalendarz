import type { UniversityImportEntry } from './study.types';

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/u.test(value));
}

function formatIsoDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : value;
}

export function incompleteStudyEntryAppliesOnDate(entry: UniversityImportEntry, dateKey: string): boolean {
  if (entry.date) return entry.date === dateKey;
  if (isIsoDate(entry.sourceWeekStart) && isIsoDate(entry.sourceWeekEnd)) {
    return dateKey >= entry.sourceWeekStart && dateKey <= entry.sourceWeekEnd;
  }
  return false;
}

export function incompleteStudyEntryMarkerAppliesOnDate(entry: UniversityImportEntry, dateKey: string): boolean {
  if (entry.date) return entry.date === dateKey;
  return isIsoDate(entry.sourceWeekStart) && entry.sourceWeekStart === dateKey;
}

export function incompleteStudyEntryOverlapsRange(entry: UniversityImportEntry, rangeStart: string, rangeEnd: string): boolean {
  if (entry.date) return entry.date >= rangeStart && entry.date <= rangeEnd;
  if (isIsoDate(entry.sourceWeekStart) && isIsoDate(entry.sourceWeekEnd)) {
    return entry.sourceWeekEnd >= rangeStart && entry.sourceWeekStart <= rangeEnd;
  }
  return false;
}

export function incompleteStudyEntryRangeLabel(entry: UniversityImportEntry): string {
  if (entry.date) return formatIsoDate(entry.date);
  if (entry.sourceWeekStart && entry.sourceWeekEnd) {
    const start = formatIsoDate(entry.sourceWeekStart);
    const end = formatIsoDate(entry.sourceWeekEnd);
    return `${start} - ${end}`;
  }
  return 'Termin niepodany w planie';
}

export function incompleteStudyEntryDetail(entry: UniversityImportEntry): string {
  if (entry.date) {
    if (entry.startTime && !entry.endTime) return `Plan wskazuje ten dzień i początek zajęć o ${entry.startTime}. Godzina zakończenia nie jest podana.`;
    if (!entry.startTime && entry.endTime) return `Plan wskazuje ten dzień i zakończenie zajęć o ${entry.endTime}. Godzina rozpoczęcia nie jest podana.`;
    return 'Plan wskazuje zajęcia tego dnia, ale nie podaje pełnych godzin.';
  }
  if (entry.sourceWeekStart && entry.sourceWeekEnd) {
    return `Plan wskazuje te zajęcia w tygodniu ${incompleteStudyEntryRangeLabel(entry)}. Nie podaje konkretnego dnia ani pełnych godzin.`;
  }
  return 'Plan zawiera ten wpis, ale nie podaje terminu możliwego do umieszczenia w kalendarzu.';
}

export function incompleteStudyEntrySourceHint(entry: UniversityImportEntry): string | undefined {
  const segment = entry.originalText
    .split('|')
    .map((part) => part.replace(/\s+/gu, ' ').trim())
    .find((part) => /^pierwsze spotkanie\b/iu.test(part));
  return segment || undefined;
}

export function incompleteStudyEntryMarkerLabel(entry: UniversityImportEntry): string {
  const subject = entry.subject.trim();
  const short = subject.length <= 8 ? subject : `${subject.slice(0, 7).trim()}.`;
  if (!short) return 'Plan';
  return entry.date ? short : `${short} · tydz.`;
}
