import { useMemo, useState } from 'react';
import type { CalendarEvent } from '../events/event.types';
import type { CalendarConsistencyIssue } from './planning.types';

interface ConsistencyCenterProps {
  issues: CalendarConsistencyIssue[];
  events: CalendarEvent[];
  onEdit: (event: CalendarEvent) => void;
  onAcknowledge: (issue: CalendarConsistencyIssue) => Promise<void>;
  onStudySeriesCorrect: (event: CalendarEvent) => void;
}

type Filter = 'ALL' | 'STUDY' | 'WORK' | 'PERSONAL' | 'OVERLAP' | 'TOUCHING';
function timeLabel(value: string): string { return value.slice(11, 16); }
function dateLabel(value: string): string { return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' }); }

export function ConsistencyCenter({ issues, events, onEdit, onAcknowledge, onStudySeriesCorrect }: ConsistencyCenterProps) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const eventMap = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const visible = issues.filter((issue) => {
    if (!showAcknowledged && issue.acknowledged) return false;
    if (filter === 'ALL') return true;
    if (filter === 'OVERLAP') return issue.type === 'HARD_OVERLAP' || issue.type === 'SOURCE_INCONSISTENCY' || issue.type === 'ALL_DAY_CONFLICT';
    if (filter === 'TOUCHING') return issue.type === 'TOUCHING';
    return issue.categories.includes(filter);
  });
  const openBlocking = issues.filter((issue) => issue.planningImpact === 'BLOCKING' && !issue.acknowledged).length;

  return <section className="panel consistency-center" id="consistency-center">
    <div className="panel-heading"><div><span className="section-kicker">Spójność kalendarza</span><h2>Centrum niespójności</h2><p>{openBlocking ? `${openBlocking} problemów blokujących wymaga sprawdzenia.` : 'Brak nierozwiązanych problemów blokujących.'}</p></div></div>
    <div className="consistency-toolbar"><div className="consistency-filters">{(['ALL','STUDY','WORK','PERSONAL','OVERLAP','TOUCHING'] as Filter[]).map((item) => <button type="button" key={item} className={filter === item ? 'choice-button active' : 'choice-button'} onClick={() => setFilter(item)}>{({ALL:'Wszystkie',STUDY:'Zajęcia',WORK:'Praca',PERSONAL:'Prywatne',OVERLAP:'Nakładanie',TOUCHING:'Brak buforu'} as Record<Filter,string>)[item]}</button>)}</div><label className="compact-check"><input type="checkbox" checked={showAcknowledged} onChange={(e) => setShowAcknowledged(e.target.checked)} /><span>Pokaż zaakceptowane</span></label></div>
    {visible.length ? <div className="consistency-list">{visible.map((issue) => {
      const related = issue.eventIds.map((id) => eventMap.get(id)).filter(Boolean) as CalendarEvent[];
      return <article className={`consistency-card impact-${issue.planningImpact.toLowerCase()}${issue.acknowledged ? ' acknowledged' : ''}`} key={issue.fingerprint}>
        <div className="consistency-card-top"><div><span className="consistency-impact">{issue.planningImpact === 'BLOCKING' ? 'WYMAGA SPRAWDZENIA' : issue.planningImpact === 'WARNING' ? 'OSTRZEŻENIE' : 'INFORMACJA'}</span><h3>{issue.title}</h3><p>{dateLabel(issue.startDateTime)} · {timeLabel(issue.startDateTime)}-{timeLabel(issue.endDateTime)}{issue.overlapMinutes ? ` · ${issue.overlapMinutes} min` : ''}</p></div>{issue.acknowledged ? <span className="ack-badge">Zaakceptowane</span> : null}</div>
        <p className="consistency-description">{issue.description}</p>
        {related.length ? <div className="consistency-events">{related.map((event) => <div key={event.id}><span className={`category-dot category-${event.category.toLowerCase()}`} aria-hidden="true"/><div><strong>{event.title}</strong><small>{event.startDateTime.slice(11,16)}-{event.endDateTime.slice(11,16)} · {event.category}</small></div><button type="button" className="text-button" onClick={() => onEdit(event)}>Popraw</button>{event.source === 'UNIVERSITY_XLSX' && event.seriesKey ? <button type="button" className="text-button" onClick={() => onStudySeriesCorrect(event)}>Popraw serię</button> : null}</div>)}</div> : null}
        {!issue.acknowledged ? <div className="consistency-actions"><button type="button" className="button button-secondary button-small" onClick={() => void onAcknowledge(issue)}>Zostaw bez zmian</button></div> : null}
      </article>;
    })}</div> : <div className="diff-empty">Brak niespójności dla wybranego filtra.</div>}
  </section>;
}
