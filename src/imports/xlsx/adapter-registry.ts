import type { ScheduleAnalysis } from '../../study/study.types';
import { nursingPlanV1Adapter } from './adapters/nursing-plan-v1.adapter';
import { nursingWeekMatrixV2Adapter } from './adapters/nursing-week-matrix-v2.adapter';
import type { ScheduleAdapterMatch } from './adapter.types';
import type { WorkbookSnapshot } from './xlsx.types';

const adapters = [nursingWeekMatrixV2Adapter, nursingPlanV1Adapter];

export function inspectScheduleWorkbook(workbook: WorkbookSnapshot): ScheduleAdapterMatch[] {
  return adapters.map((adapter) => adapter.match(workbook)).sort((a, b) => b.score - a.score);
}

export function analyzeScheduleWorkbook(workbook: WorkbookSnapshot): ScheduleAnalysis | null {
  const match = inspectScheduleWorkbook(workbook).find((candidate) => candidate.handled);
  if (!match) return null;
  const adapter = adapters.find((candidate) => candidate.id === match.adapterId);
  return adapter ? adapter.analyze(workbook) : null;
}

export function diagnoseUnrecognizedWorkbook(workbook: WorkbookSnapshot): string[] {
  const lines: string[] = [];
  for (const sheet of workbook.sheets) {
    lines.push(`${sheet.name}: ${sheet.usedRange ?? 'brak używanego zakresu'}`);
  }
  const best = inspectScheduleWorkbook(workbook)[0];
  if (best) {
    lines.push(`Najbliższy format: ${best.adapterId} - wynik ${best.score}.`);
    lines.push(`Dni: ${best.detectedDays.length ? best.detectedDays.join(', ') : 'nie wykryto'}.`);
    if (best.layoutKind === 'WEEK_MATRIX') {
      lines.push(`Macierz tygodniowa: ${best.weekRowCount ?? 0} wierszy tygodni. Wykłady z godzinami: ${best.lectureEntryCount ?? 0}. Siatki czasu: ${best.timeGridCount}. Grupy w kontekście: ${best.detectedGroupCount}.`);
    } else {
      lines.push(`Siatki czasu: ${best.timeGridCount}. Grupy w kontekście: ${best.detectedGroupCount}.`);
    }
    lines.push(...best.reasons.map((reason) => `Diagnostyka: ${reason}`));
  }
  return lines;
}
