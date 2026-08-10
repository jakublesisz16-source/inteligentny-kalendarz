import type { ScheduleAnalysis } from '../../study/study.types';
import type { WorkbookSnapshot } from './xlsx.types';

export interface ScheduleAdapterMatch {
  adapterId: string;
  score: number;
  handled: boolean;
  sheetName?: string;
  reasons: string[];
  detectedDays: string[];
  timeGridCount: number;
  detectedAcademicYear?: string;
  detectedGroupCount: number;
}

export interface ScheduleAdapter {
  id: string;
  match(workbook: WorkbookSnapshot): ScheduleAdapterMatch;
  canHandle(workbook: WorkbookSnapshot): boolean;
  analyze(workbook: WorkbookSnapshot): ScheduleAnalysis;
}
