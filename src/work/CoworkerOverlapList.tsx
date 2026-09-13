import { useMemo } from 'react';
import { formatWorkMinutes, sortCoworkerOverlaps } from './work.service';
import type { CoworkerOverlap } from './work.types';

interface CoworkerOverlapListProps {
  people: CoworkerOverlap[];
  compact?: boolean;
}

export function CoworkerOverlapList({ people, compact = false }: CoworkerOverlapListProps) {
  const sorted = useMemo(() => sortCoworkerOverlaps(people), [people]);

  if (!sorted.length) {
    return <p className="work-team-empty">Brak zapisanych osób pracujących z Tobą w tym samym czasie.</p>;
  }

  return (
    <div className={`coworker-overlap-list${compact ? ' compact' : ''}`}>
      {sorted.map((person) => (
        <div className="coworker-overlap-row" key={`${person.displayName}-${person.coworkerStartTime}-${person.coworkerEndTime}`}>
          <strong>{person.displayName}</strong>
          <span className="coworker-full-shift">Zmiana: {person.coworkerStartTime}-{person.coworkerEndTime}</span>
          <span className="coworker-shared-time">Razem z Tobą: <b>{person.overlapStartTime}-{person.overlapEndTime}</b><small>{formatWorkMinutes(person.overlapMinutes)}</small></span>
        </div>
      ))}
    </div>
  );
}
