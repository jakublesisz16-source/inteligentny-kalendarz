import type { PdfDocumentSnapshot } from './pdf-reader';
import type { WorkScheduleParseResult } from '../../work/work.types';

export interface WorkAdapterMatch {
  confidence: number;
  reasons: string[];
}

export interface WorkScheduleAdapter {
  id: string;
  label: string;
  detect: (document: PdfDocumentSnapshot) => WorkAdapterMatch;
  parse: (document: PdfDocumentSnapshot) => WorkScheduleParseResult;
}
