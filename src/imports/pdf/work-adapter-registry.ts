import type { PdfDocumentSnapshot } from './pdf-reader';
import type { WorkScheduleAdapter } from './work-adapter.types';
import { retailRosterV1Adapter } from './adapters/retail-roster-v1.adapter';

const adapters: WorkScheduleAdapter[] = [retailRosterV1Adapter];

export function selectWorkScheduleAdapter(document: PdfDocumentSnapshot): WorkScheduleAdapter {
  const ranked = adapters
    .map((adapter) => ({ adapter, match: adapter.detect(document) }))
    .sort((a, b) => b.match.confidence - a.match.confidence);
  const best = ranked[0];
  if (!best || best.match.confidence < 0.65) {
    throw new Error('Nie rozpoznano formatu grafiku pracy. Sprawdź, czy PDF zawiera tabelę grafiku z warstwą tekstową.');
  }
  return best.adapter;
}

export function parseWorkScheduleDocument(document: PdfDocumentSnapshot) {
  return selectWorkScheduleAdapter(document).parse(document);
}
