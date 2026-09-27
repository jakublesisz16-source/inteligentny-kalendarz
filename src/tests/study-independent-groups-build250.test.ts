import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { candidatesForSelectedGroups, validateStudyGroupSelection } from '../study/study.service';
import type { ScheduleAnalysis, StudyScheduleCandidate } from '../study/study.types';

function candidate(id: string, groupTags: string[]): StudyScheduleCandidate {
  return { id, adapterId: 'build250', sourceSheet: 'PLAN ZAJĘĆ', sourceRange: id, sourceKey: id, originalText: id, subject: id, date: '2026-10-12', startTime: '08:00', endTime: '09:00', groupScope: 'SPECIFIC', groupTags, status: 'READY', warnings: [], include: true };
}

const groups = ['MAIN:10', 'G12:10A', 'G12:10B', 'G8:10A', 'G8:10B', 'G8:10C', 'G4:10A1', 'G4:10A2', 'G4:10B1', 'G4:10B2', 'G4:10C1', 'G4:10C2'];
const analysis: ScheduleAnalysis = { adapterId: 'build250', sheetNames: ['PLAN ZAJĘĆ'], groups, information: [], warnings: [], candidates: [candidate('main', ['MAIN:10']), candidate('g12a', ['G12:10A']), candidate('g8a', ['G8:10A']), candidate('g8c', ['G8:10C']), candidate('g4a2', ['G4:10A2']), candidate('g4c2', ['G4:10C2'])] };

describe('Build250 independent Study group assignments', () => {
  it('accepts an intentionally non-hierarchical assignment from the official allocation', () => {
    expect(validateStudyGroupSelection(groups, ['MAIN:10', 'G12:10A', 'G8:10C', 'G4:10A2'])).toEqual({ valid: true, errors: [], mainNumber: 10 });
  });

  it('selects only the exact Excel groups and does not derive G8 from G4', () => {
    const result = candidatesForSelectedGroups(analysis, ['MAIN:10', 'G12:10A', 'G8:10C', 'G4:10A2']);
    expect(result.map((item) => item.id).sort()).toEqual(['g12a', 'g4a2', 'g8c', 'main']);
  });

  it('keeps the UI contract explicit about four independent choices', () => {
    const choice = readFileSync(new URL('../study/StudyGroupChoiceFields.tsx', import.meta.url), 'utf8');
    const view = readFileSync(new URL('../study/StudyView.tsx', import.meta.url), 'utf8');
    expect(choice).toContain("{ kind: 'G8', label: 'Grupa 8-osobowa', helper: 'Niezależny przydział z planu' }");
    expect(choice).toContain("{ kind: 'G4', label: 'Grupa 4-osobowa', helper: 'Niezależny przydział z planu' }");
    expect(choice).not.toContain('hasG4ForMain');
    expect(view).toContain('Każdy przydział wybierasz niezależnie.');
  });
});
