import { normalizeStudyGroupSelectionForAvailableGroups, parseStudyGroupKey, studyGroupPlainLabel, type StudyGroupKind } from '../imports/xlsx/group-normalizer';
import { StudyGroupSelector } from './StudyGroupSelector';

const STUDY_GROUP_PARTITIONS: Array<{ kind: Exclude<StudyGroupKind, 'GENERIC'>; label: string; helper: string }> = [
  { kind: 'MAIN', label: 'Grupa główna', helper: 'Najpierw wybierz swoją grupę' },
  { kind: 'G12', label: 'Grupa 12-osobowa', helper: 'Niezależny podział zajęć' },
  { kind: 'G8', label: 'Grupa 8-osobowa', helper: 'Tylko gdy plan nie ma podziału 4-os.' },
  { kind: 'G4', label: 'Grupa 4-osobowa', helper: 'Wyznacza też grupę 8-osobową' },
];

interface StudyGroupChoiceFieldsProps {
  availableGroups: string[];
  selectedGroups: string[];
  onChange: (groups: string[]) => void;
  ariaLabel: string;
}

interface StudyGroupChoiceProgress {
  completed: number;
  required: number;
}

function selectedMainNumber(selectedGroups: string[]): number | undefined {
  const parsed = selectedGroups.map(parseStudyGroupKey);
  return parsed.find((group) => group.kind === 'MAIN' && group.number)?.number ?? parsed.find((group) => group.number)?.number;
}

function visiblePartitions(availableGroups: string[], selectedGroups: string[]) {
  const parsedAvailable = availableGroups.map((group) => ({ key: group, parsed: parseStudyGroupKey(group) }));
  const mainNumber = selectedMainNumber(selectedGroups);

  return STUDY_GROUP_PARTITIONS.flatMap((partition) => {
    if (partition.kind !== 'MAIN' && !mainNumber) return [];
    const scopedGroups = parsedAvailable.filter(({ parsed }) => partition.kind === 'MAIN' || parsed.number === mainNumber);
    const hasG4ForMain = scopedGroups.some(({ parsed }) => parsed.kind === 'G4');
    if (partition.kind === 'G8' && hasG4ForMain) return [];
    if (partition.kind === 'G4' && !hasG4ForMain) return [];
    const options = scopedGroups.filter(({ parsed }) => parsed.kind === partition.kind);
    if (!options.length) return [];
    return [{ ...partition, options }];
  });
}

export function studyGroupChoiceProgress(availableGroups: string[], selectedGroups: string[]): StudyGroupChoiceProgress {
  const normalized = normalizeStudyGroupSelectionForAvailableGroups(availableGroups, selectedGroups);
  const partitions = visiblePartitions(availableGroups, normalized);
  const parsedSelected = normalized.map(parseStudyGroupKey);
  const completed = partitions.filter((partition) => parsedSelected.some((group) => group.kind === partition.kind)).length;
  return { completed, required: partitions.length };
}

export function StudyGroupChoiceFields({ availableGroups, selectedGroups, onChange, ariaLabel }: StudyGroupChoiceFieldsProps) {
  const normalized = normalizeStudyGroupSelectionForAvailableGroups(availableGroups, selectedGroups);
  const parsedAvailable = availableGroups.map((group) => ({ key: group, parsed: parseStudyGroupKey(group) }));
  const genericGroups = parsedAvailable.filter(({ parsed }) => parsed.kind === 'GENERIC').map(({ key }) => key);
  const partitions = visiblePartitions(availableGroups, normalized);

  function setPartitionGroup(kind: Exclude<StudyGroupKind, 'GENERIC'>, group: string) {
    const chosen = group ? parseStudyGroupKey(group) : null;
    let next = normalized.filter((item) => parseStudyGroupKey(item).kind !== kind);
    if (chosen?.number) {
      next = next.filter((item) => {
        const parsed = parseStudyGroupKey(item);
        return parsed.kind === 'GENERIC' || !parsed.number || parsed.number === chosen.number;
      });
    }
    onChange(normalizeStudyGroupSelectionForAvailableGroups(availableGroups, group ? [...next, group] : next));
  }

  function toggleGeneric(group: string) {
    const next = normalized.includes(group) ? normalized.filter((item) => item !== group) : [...normalized, group];
    onChange(normalizeStudyGroupSelectionForAvailableGroups(availableGroups, next));
  }

  return <div className="study-group-choice-grid" aria-label={ariaLabel}>
    {partitions.map((partition) => {
      const current = normalized.find((group) => parseStudyGroupKey(group).kind === partition.kind) ?? '';
      return <label key={partition.kind} className="study-group-choice-card">
        <span><strong>{partition.label}</strong><small>{partition.helper}</small></span>
        <select value={current} onChange={(event) => setPartitionGroup(partition.kind, event.target.value)} aria-label={`Wybierz: ${partition.label}`}>
          <option value="">Wybierz grupę</option>
          {partition.options.map(({ key }) => <option key={key} value={key}>{studyGroupPlainLabel(key)}</option>)}
        </select>
      </label>;
    })}
    {genericGroups.length ? <div className="study-group-choice-generic"><span>Pozostałe oznaczenia</span><StudyGroupSelector groups={genericGroups} selectedGroups={normalized} onToggle={toggleGeneric} compact /></div> : null}
  </div>;
}
