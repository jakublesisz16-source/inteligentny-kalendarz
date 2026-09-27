import { describe, expect, it } from 'vitest';
import { candidatesForSelectedGroups, findStudyScheduleConflicts, findStudyUpdateDecisionConflicts, validateStudyGroupSelection } from '../study/study.service';
import type { ScheduleAnalysis, ScheduleDiffItem, StudyScheduleCandidate } from '../study/study.types';
import type { CalendarEvent } from '../events/event.types';

function candidate(id: string, groups: string[], scope: StudyScheduleCandidate['groupScope'] = 'SPECIFIC'): StudyScheduleCandidate {
  return {
    id,
    adapterId: 'test',
    sourceSheet: 'PRAKTYKI',
    sourceRange: id,
    sourceKey: id,
    originalText: id,
    subject: `Przedmiot ${id}`,
    date: '2026-02-16',
    startTime: '08:00',
    endTime: '09:00',
    groupScope: scope,
    groupTags: groups,
    status: 'READY',
    warnings: [],
    include: true,
  };
}

const analysis: ScheduleAnalysis = {
  adapterId: 'test',
  sheetNames: ['PRAKTYKI'],
  groups: ['1', '10', '13A'],
  candidates: [
    candidate('a', ['1']),
    candidate('b', ['10']),
    candidate('c', ['13A']),
    candidate('all', [], 'ALL'),
    { ...candidate('unknown', [], 'UNKNOWN'), status: 'REVIEW_REQUIRED', include: false },
  ],
  information: [],
  warnings: [],
};

describe('candidatesForSelectedGroups', () => {
  it('wybiera dokładną grupę i zajęcia wspólne', () => {
    const result = candidatesForSelectedGroups(analysis, ['1']);
    expect(result.map((item) => item.id).sort()).toEqual(['a', 'all', 'unknown']);
  });

  it('łączy wiele wybranych grup bez substring matching', () => {
    const result = candidatesForSelectedGroups(analysis, ['10', '13A']);
    expect(result.map((item) => item.id).sort()).toEqual(['all', 'b', 'c', 'unknown']);
  });
});


describe('validateStudyGroupSelection', () => {
  const structured = [
    'MAIN:13',
    'G12:13A', 'G12:13B',
    'G8:13A', 'G8:13B', 'G8:13C',
    'G4:13A1', 'G4:13A2', 'G4:13B1', 'G4:13B2',
    'MAIN:14', 'G12:14A', 'G4:14A1',
  ];

  it('wymaga każdego podziału, który istnieje w Excelu dla wybranej grupy głównej', () => {
    const incomplete = validateStudyGroupSelection(structured, ['MAIN:13', 'G12:13B', 'G4:13A1']);
    expect(incomplete.valid).toBe(false);
    expect(incomplete.errors.join(' ')).toContain('grupa 8-osobowa');

    expect(validateStudyGroupSelection(structured, ['MAIN:13', 'G12:13B', 'G8:13C', 'G4:13A1'])).toEqual({ valid: true, errors: [], mainNumber: 13 });
  });

  it('odrzuca mieszanie różnych grup głównych', () => {
    const result = validateStudyGroupSelection(structured, ['MAIN:13', 'G12:14A', 'G8:13C', 'G4:13A1']);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('różnych grup głównych');
  });

  it('akceptuje niezależny przydział G8 i G4 nawet gdy litery się różnią', () => {
    expect(validateStudyGroupSelection(structured, ['MAIN:13', 'G12:13A', 'G8:13C', 'G4:13A1'])).toEqual({ valid: true, errors: [], mainNumber: 13 });
  });

  it('wymaga dokładnie jednego wyboru w każdym dostępnym podziale', () => {
    const result = validateStudyGroupSelection(structured, ['MAIN:13', 'G12:13A', 'G8:13A', 'G8:13B', 'G4:13A1']);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('więcej niż jedną grupę 8-osobową');
  });

  it('nie wymaga G8 dla planu, który rzeczywiście nie ma podziału G8', () => {
    expect(validateStudyGroupSelection(structured, ['MAIN:14', 'G12:14A', 'G4:14A1'])).toEqual({ valid: true, errors: [], mainNumber: 14 });
  });
});

describe('independent Study group assignment filtering', () => {
  const independent: ScheduleAnalysis = {
    adapterId: 'test', sheetNames: ['PLAN'], information: [], warnings: [],
    groups: ['MAIN:10', 'G12:10A', 'G12:10B', 'G8:10A', 'G8:10B', 'G8:10C', 'G4:10A1', 'G4:10A2', 'G4:10C1'],
    candidates: [
      candidate('main-10', ['MAIN:10']),
      candidate('g12-10a', ['G12:10A']),
      candidate('g12-10b', ['G12:10B']),
      candidate('g8-10a', ['G8:10A']),
      candidate('g8-10c', ['G8:10C']),
      candidate('g4-10a2', ['G4:10A2']),
      candidate('g4-10c1', ['G4:10C1']),
      candidate('common', [], 'ALL'),
    ],
  };

  it('dla 10 / 10A / 10C / 10A2 wybiera dokładnie cztery niezależne przypisania z Excela', () => {
    const result = candidatesForSelectedGroups(independent, ['MAIN:10', 'G12:10A', 'G8:10C', 'G4:10A2']);
    expect(result.map((item) => item.id).sort()).toEqual(['common', 'g12-10a', 'g4-10a2', 'g8-10c', 'main-10']);
  });
});

describe('findStudyScheduleConflicts', () => {
  it('wykrywa nakładające się przedziały tego samego dnia', () => {
    const first = { ...candidate('x', ['MAIN:12']), date: '2027-01-08', startTime: '15:00', endTime: '18:45' };
    const second = { ...candidate('y', ['MAIN:12']), date: '2027-01-08', startTime: '15:15', endTime: '19:00' };
    expect(findStudyScheduleConflicts([first, second])).toHaveLength(1);
  });

  it('ignoruje wpisy bez pełnej godziny i stykające się bez nakładania', () => {
    const first = { ...candidate('x', ['MAIN:12']), startTime: '08:00', endTime: '10:00' };
    const second = { ...candidate('y', ['MAIN:12']), startTime: '10:00', endTime: '12:00' };
    const unresolved = candidate('z', ['MAIN:12']);
    delete unresolved.startTime;
    delete unresolved.endTime;
    unresolved.status = 'REVIEW_REQUIRED';
    expect(findStudyScheduleConflicts([first, second, unresolved])).toEqual([]);
  });
});


describe('findStudyUpdateDecisionConflicts', () => {
  function oldEvent(id: string, start: string, end: string): CalendarEvent {
    return {
      id, title: id, startDateTime: start, endDateTime: end, allDay: false, spanType: 'SINGLE_DAY',
      category: 'STUDY', source: 'UNIVERSITY_XLSX', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      userModified: true, userModifiedFields: ['startDateTime', 'endDateTime'],
    };
  }

  it('liczy konflikt z finalnych decyzji, także gdy zachowano ręcznie zmienioną godzinę', () => {
    const keptOld = oldEvent('old', '2027-01-08T15:15', '2027-01-08T19:00');
    const first: ScheduleDiffItem = {
      id: 'first', kind: 'CONFLICT_USER_MODIFIED', changeTypes: ['CHANGED_TIME'], changes: [],
      newCandidate: { ...candidate('first', ['MAIN:12']), date: '2027-01-08', startTime: '12:00', endTime: '14:00' },
      oldEventSnapshot: keptOld, oldEventUserModified: true, oldEventUserModifiedFields: ['startDateTime', 'endDateTime'], resolution: 'KEEP_USER',
    };
    const second: ScheduleDiffItem = {
      id: 'second', kind: 'ADDED', changeTypes: [], changes: [],
      newCandidate: { ...candidate('second', ['MAIN:12']), date: '2027-01-08', startTime: '15:00', endTime: '18:45' }, resolution: 'APPLY',
    };
    expect(findStudyUpdateDecisionConflicts([first, second])).toHaveLength(1);
  });


  it('przy zmianie daty KEEP_USER zachowuje cały stary dzień, nawet gdy ręcznie zmieniono tylko początek', () => {
    const keptOld = oldEvent('old-date', '2027-01-08T15:15', '2027-01-08T19:00');
    keptOld.userModifiedFields = ['startDateTime'];
    const moved: ScheduleDiffItem = {
      id: 'moved', kind: 'CONFLICT_USER_MODIFIED', changeTypes: ['CHANGED_DATE'],
      changes: [{ field: 'date', label: 'Data', before: '2027-01-08', after: '2027-01-09', changeType: 'CHANGED_DATE' }],
      newCandidate: { ...candidate('moved', ['MAIN:12']), date: '2027-01-09', startTime: '12:00', endTime: '14:00' },
      oldEventSnapshot: keptOld, oldEventUserModified: true, oldEventUserModifiedFields: ['startDateTime'], resolution: 'KEEP_USER',
    };
    const overlapping: ScheduleDiffItem = {
      id: 'overlap', kind: 'ADDED', changeTypes: [], changes: [],
      newCandidate: { ...candidate('overlap', ['MAIN:12']), date: '2027-01-08', startTime: '16:00', endTime: '17:00' }, resolution: 'APPLY',
    };
    expect(findStudyUpdateDecisionConflicts([moved, overlapping])).toHaveLength(1);
  });
});
