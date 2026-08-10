import { useMemo, useState } from 'react';
import { formatWorkMinutes, sortCoworkerOverlaps } from './work.service';
import type { CoworkerOverlap } from './work.types';

interface CoworkerOverlapListProps {
  people: CoworkerOverlap[];
  limit?: number;
  compact?: boolean;
}

export function CoworkerOverlapList({ people, limit = 4, compact = false }: CoworkerOverlapListProps) {
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => sortCoworkerOverlaps(people), [people]);
  const visible = expanded ? sorted : sorted.slice(0, limit);

  if (!sorted.length) {
    return <p className="work-team-empty">Brak zapisanych osób pracujących z Tobą w tym samym czasie.</p>;
  }

  return (
    <div className={`coworker-overlap-list${compact ? ' compact' : ''}`}>
      {visible.map((person) => (
        <div className="coworker-overlap-row" key={`${person.displayName}-${person.coworkerStartTime}-${person.coworkerEndTime}`}>
          <strong>{person.displayName}</strong>
          <span className="coworker-full-shift">Zmiana: {person.coworkerStartTime}-{person.coworkerEndTime}</span>
          <span className="coworker-shared-time">Razem z Tobą: <b>{person.overlapStartTime}-{person.overlapEndTime}</b><small>{formatWorkMinutes(person.overlapMinutes)}</small></span>
        </div>
      ))}
      {sorted.length > limit ? (
        <button type="button" className="text-button coworker-list-toggle" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Zwiń' : `Pokaż wszystkich - ${sorted.length}`}
        </button>
      ) : null}
    </div>
  );
}
