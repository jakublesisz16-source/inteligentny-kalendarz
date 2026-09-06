import type { ScheduleAnalysis } from '../../study/study.types';
import { nursingPlanV1Adapter } from './adapters/nursing-plan-v1.adapter';
import { nursingWeekMatrixV2Adapter } from './adapters/nursing-week-matrix-v2.adapter';
import type { ScheduleAdapterMatch } from './adapter.types';
import type { WorkbookSnapshot } from './xlsx.types';
import { parseStudyGroupKey } from './group-normalizer';
import { foldPolishText } from './parser-normalization';

const adapters = [nursingWeekMatrixV2Adapter, nursingPlanV1Adapter];

export interface ScheduleAnalysisIntegrity {
  safe: boolean;
  reasons: string[];
}

function ratio(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

export function assessScheduleAnalysisIntegrity(analysis: ScheduleAnalysis, workbook?: WorkbookSnapshot): ScheduleAnalysisIntegrity {
  // Stary adapter siatki czasu ma osobne, historycznie zweryfikowane bramki.
  // FIX4 dotyczy szerokiej macierzy tygodniowej, w której częściowo rozpoznany
  // układ jest groźniejszy niż jawne odrzucenie pliku.
  if (analysis.adapterId !== 'nursing-week-matrix-v2') return { safe: true, reasons: [] };

  const specific = analysis.candidates.filter((candidate) => candidate.groupScope === 'SPECIFIC');
  const reasons: string[] = [];

  // Diagnostyka rozpadu macierzy musi działać także wtedy, gdy uszkodzenie
  // spowodowało utratę wszystkich kandydatów grupowych. Wcześniejszy early
  // return dla planu zawierającego wyłącznie wykłady mógł w takiej sytuacji
  // przepuścić same wykłady i po cichu zgubić praktyki/seminaria z macierzy.
  if ((analysis.diagnostics?.unparsedAssignmentCellCount ?? 0) > 0) {
    const samples = analysis.diagnostics?.unparsedAssignmentSamples?.slice(0, 4).join('; ');
    reasons.push(`Wykryto ${analysis.diagnostics?.unparsedAssignmentCellCount} nieprzetworzonych przypisań grupowych w rozpoznanych tygodniach${samples ? ` (${samples})` : ''}.`);
  }
  if ((analysis.diagnostics?.suspiciousUnparsedWeekRows?.length ?? 0) > 0) {
    reasons.push(`Wykryto wiersze z przypisaniami grup, ale bez rozpoznanego zakresu tygodnia: ${analysis.diagnostics?.suspiciousUnparsedWeekRows?.join(', ')}.`);
  }
  if (!specific.length) {
    if ((analysis.diagnostics?.weekRowCount ?? 0) > 0) {
      reasons.push('Rozpoznano macierz tygodniową, ale nie udało się utworzyć żadnych kandydatów zajęć grupowych.');
    }
    return { safe: reasons.length === 0, reasons }; // prawdziwy plan zawierający wyłącznie wykłady ma weekRowCount = 0
  }

  const missingDate = specific.filter((candidate) => !candidate.date).length;
  const missingTime = specific.filter((candidate) => !candidate.startTime || !candidate.endTime).length;
  const suspiciousSubject = specific.filter((candidate) => {
    const folded = foldPolishText(candidate.subject);
    return /\bplan\s+zajec\b|\brok\s+pielegniar|\bsemestr\s+(zimowy|letni)\b/.test(folded);
  }).length;

  const parsedGroups = analysis.groups.map(parseStudyGroupKey);
  const encodedCount = parsedGroups.filter((group) => group.encoded).length;
  const genericCount = parsedGroups.filter((group) => group.kind === 'GENERIC').length;

  const matchedSheet = workbook && analysis.diagnostics?.matchedSheet
    ? workbook.sheets.find((sheet) => sheet.name === analysis.diagnostics?.matchedSheet)
    : undefined;
  if (matchedSheet && matchedSheet.merges.length === 0) {
    reasons.push('Macierz grupowa nie zawiera żadnych scaleń, od których zależy interpretacja wspólnych nagłówków kolumn.');
  }

  // Progi są celowo szerokie. Nie służą do oceniania jakości planu uczelni,
  // tylko do wykrycia rozpadu struktury po zmianie układu arkusza. Obecny realny
  // plan ma ok. 3.6% wpisów bez dnia i 7.1% bez pełnych godzin.
  if (specific.length >= 20 && ratio(missingDate, specific.length) > 0.25) {
    reasons.push(`Ponad 25% wpisów grupowych nie ma rozpoznanej daty (${missingDate}/${specific.length}).`);
  }
  if (specific.length >= 20 && ratio(missingTime, specific.length) > 0.25) {
    reasons.push(`Ponad 25% wpisów grupowych nie ma pełnego zakresu godzin (${missingTime}/${specific.length}).`);
  }
  if (specific.length >= 20 && ratio(suspiciousSubject, specific.length) > 0.10) {
    reasons.push(`Nagłówek całego planu został błędnie odczytany jako przedmiot w ${suspiciousSubject}/${specific.length} wpisach.`);
  }
  if ((encodedCount >= 8 && ratio(genericCount, parsedGroups.length) > 0.10)
    || (parsedGroups.length >= 4 && genericCount >= 2 && ratio(genericCount, parsedGroups.length) > 0.25)) {
    reasons.push(`Wykryto niespójny model grup - ${genericCount}/${parsedGroups.length} etykiet pozostało bez rozpoznanego poziomu podziału.`);
  }

  if (analysis.completeness && !analysis.completeness.safe) {
    reasons.push(...analysis.completeness.reasons.map((reason) => `Kompletność planu: ${reason}`));
  }

  return { safe: reasons.length === 0, reasons };
}

export function inspectScheduleWorkbook(workbook: WorkbookSnapshot): ScheduleAdapterMatch[] {
  return adapters.map((adapter) => adapter.match(workbook)).sort((a, b) => b.score - a.score);
}

export function analyzeScheduleWorkbook(workbook: WorkbookSnapshot): ScheduleAnalysis | null {
  const match = inspectScheduleWorkbook(workbook).find((candidate) => candidate.handled);
  if (!match) return null;
  const adapter = adapters.find((candidate) => candidate.id === match.adapterId);
  if (!adapter) return null;
  const analysis = adapter.analyze(workbook);
  return assessScheduleAnalysisIntegrity(analysis, workbook).safe ? analysis : null;
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

    if (best.handled) {
      const adapter = adapters.find((candidate) => candidate.id === best.adapterId);
      if (adapter) {
        const integrity = assessScheduleAnalysisIntegrity(adapter.analyze(workbook), workbook);
        if (!integrity.safe) {
          lines.push('Import został zatrzymany przez bramkę integralności - układ jest podobny do obsługiwanego planu, ale wynik odczytu jest zbyt niespójny.');
          lines.push(...integrity.reasons.map((reason) => `Integralność: ${reason}`));
        }
      }
    }
  }
  return lines;
}
