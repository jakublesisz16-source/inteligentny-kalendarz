import { useEffect, useState } from 'react';
import type { CalendarEvent } from '../events/event.types';
import type { StudyEventGroupMetadata } from '../events/study-event-display';
import { listUniversityImportEntries } from '../storage/database';
import type { UniversityImportEntry } from './study.types';

export function studyEventGroupMetadataFromEntries(event: CalendarEvent, entries: UniversityImportEntry[]): StudyEventGroupMetadata | undefined {
  if (event.source !== 'UNIVERSITY_XLSX') return undefined;
  const entry = entries.find((candidate) => candidate.id === event.sourceEntryId)
    ?? entries.find((candidate) => candidate.eventId === event.id);
  if (!entry) return undefined;
  return {
    groupTags: [...entry.groupTags],
    groupScope: entry.groupScope ?? (entry.groupTags.length ? 'SPECIFIC' : 'UNKNOWN'),
  };
}

export function useStudyEventGroupMetadata(event: CalendarEvent): StudyEventGroupMetadata | undefined {
  const [metadata, setMetadata] = useState<StudyEventGroupMetadata | undefined>();

  useEffect(() => {
    let cancelled = false;
    if (event.source !== 'UNIVERSITY_XLSX' || !event.sourceImportId) {
      setMetadata(undefined);
      return () => { cancelled = true; };
    }

    void listUniversityImportEntries(event.sourceImportId)
      .then((entries) => {
        if (!cancelled) setMetadata(studyEventGroupMetadataFromEntries(event, entries));
      })
      .catch(() => {
        if (!cancelled) setMetadata(undefined);
      });

    return () => { cancelled = true; };
  }, [event.id, event.source, event.sourceImportId, event.sourceEntryId]);

  return metadata;
}
