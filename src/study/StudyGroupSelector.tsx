import { parseStudyGroupKey, studyGroupPlainLabel, type StudyGroupKind } from '../imports/xlsx/group-normalizer';

interface StudyGroupSelectorProps {
  groups: string[];
  selectedGroups: string[];
  onToggle: (group: string) => void;
  compact?: boolean;
}

const SECTION_ORDER: Array<{ kind: StudyGroupKind; title: string; description: string }> = [
  { kind: 'MAIN', title: 'Grupa główna', description: 'Zajęcia wspólne dla całej grupy.' },
  { kind: 'G12', title: 'Podgrupa 12-osobowa', description: 'Wybierz ją osobno - nie da się jej bezpiecznie wyliczyć z grupy 8- ani 4-osobowej.' },
  { kind: 'G8', title: 'Podgrupa 8-osobowa', description: 'Jest automatycznie uwzględniana po wyborze odpowiadającej jej grupy 4-osobowej.' },
  { kind: 'G4', title: 'Podgrupa 4-osobowa', description: 'Najdokładniejsze przypisanie - obejmuje też odpowiadającą grupę 8-osobową i grupę główną.' },
  { kind: 'GENERIC', title: 'Pozostałe grupy', description: 'Oznaczenia bez jednoznacznej informacji o wielkości grupy.' },
];

export function StudyGroupSelector({ groups, selectedGroups, onToggle, compact = false }: StudyGroupSelectorProps) {
  const sections = SECTION_ORDER
    .map((section) => ({ ...section, groups: groups.filter((group) => parseStudyGroupKey(group).kind === section.kind) }))
    .filter((section) => section.groups.length > 0);

  return (
    <div className={compact ? 'study-group-selector compact' : 'study-group-selector'}>
      {sections.map((section) => (
        <section key={section.kind} className="study-group-section">
          <div className="study-group-section-heading">
            <div><strong>{section.title}</strong><span>{section.description}</span></div>
            <span>{section.groups.length}</span>
          </div>
          <div className={compact ? 'group-grid compact-group-grid' : 'group-grid'}>
            {section.groups.map((group) => (
              <label key={group} className={selectedGroups.includes(group) ? 'group-chip selected' : 'group-chip'} title={`${section.title}: ${studyGroupPlainLabel(group)}`}>
                <input type="checkbox" checked={selectedGroups.includes(group)} onChange={() => onToggle(group)} />
                <span>{studyGroupPlainLabel(group)}</span>
              </label>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
