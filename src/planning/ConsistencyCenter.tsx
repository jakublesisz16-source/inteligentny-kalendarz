import { useMemo, useState } from 'react';
import type { CalendarEvent } from '../events/event.types';
import type { CalendarConsistencyIssue } from './planning.types';
import type { Location } from '../locations/location.types';

interface ConsistencyCenterProps {
  issues: CalendarConsistencyIssue[];
  events: CalendarEvent[];
  locations: Location[];
  onEdit: (event: CalendarEvent) => void;
  onAcknowledge: (issue: CalendarConsistencyIssue) => Promise<void>;
  onStudySeriesCorrect: (event: CalendarEvent) => void;
}

type Filter = 'ALL' | 'STUDY' | 'WORK' | 'PERSONAL' | 'OVERLAP' | 'TOUCHING';
function timeLabel(value: string): string { return value.slice(11, 16); }
function dateLabel(value: string): string { return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' }); }

export function ConsistencyCenter({ issues, events, locations, onEdit, onAcknowledge, onStudySeriesCorrect }: ConsistencyCenterProps) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const eventMap = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const locationMap = useMemo(() => new Map(locations.map((location) => [location.id, location])), [locations]);
  const visible = issues.filter((issue) => {
    if (!showAcknowledged && issue.acknowledged) return false;
    if (filter === 'ALL') return true;
    if (filter === 'OVERLAP') return issue.type === 'HARD_OVERLAP' || issue.type === 'SOURCE_INCONSISTENCY' || issue.type === 'ALL_DAY_CONFLICT';
    if (filter === 'TOUCHING') return issue.type === 'TOUCHING';
    return issue.categories.includes(filter);
  });
  const unresolved = issues.filter((issue) => !issue.acknowledged);
  const openBlocking = unresolved.filter((issue) => issue.planningImpact === 'BLOCKING').length;
  const openWarnings = unresolved.filter((issue) => issue.planningImpact === 'WARNING').length;
  const openInfo = unresolved.filter((issue) => issue.planningImpact === 'INFO').length;

  if (!unresolved.length && !showAcknowledged) return null;

  if (!showAcknowledged && !openBlocking && !openWarnings && openInfo) {
    const infoItems = unresolved.filter((issue) => issue.planningImpact === 'INFO');
    return <section className="panel consistency-center info-only" id="consistency-center" aria-label="Informacje pomocnicze kalendarza">
      <div className="consistency-info-only-head"><span className="section-kicker">Spójność kalendarza</span><strong>{infoItems.length === 1 ? infoItems[0]!.title : `${infoItems.length} informacje o dojeździe`}</strong></div>
      <div className="consistency-info-only-list">{infoItems.slice(0, 3).map((issue) => <div className="consistency-info-only-item" key={issue.fingerprint}><span>{dateLabel(issue.startDateTime)} · {timeLabel(issue.startDateTime)}-{timeLabel(issue.endDateTime)}</span><p>{issue.description}</p></div>)}{infoItems.length > 3 ? <small>+{infoItems.length - 3} kolejnych informacji</small> : null}</div>
    </section>;
  }

  return <section className="panel consistency-center" id="consistency-center">
    <div className="panel-heading"><div><span className="section-kicker">Spójność kalendarza</span><h2>Do sprawdzenia</h2><p>{openBlocking ? `${openBlocking} problemów blokujących wymaga sprawdzenia.` : openWarnings ? `${openWarnings} ostrzeżeń do sprawdzenia.` : `Informacje pomocnicze: ${openInfo}.`}</p></div></div>
    <div className="consistency-toolbar">
      <div className="consistency-filters consistency-filters-desktop">{(['ALL','STUDY','WORK','PERSONAL','OVERLAP','TOUCHING'] as Filter[]).map((item) => <button type="button" key={item} className={filter === item ? 'choice-button active' : 'choice-button'} onClick={() => setFilter(item)}>{({ALL:'Wszystkie',STUDY:'Zajęcia',WORK:'Praca',PERSONAL:'Prywatne',OVERLAP:'Nakładanie',TOUCHING:'Dojazd'} as Record<Filter,string>)[item]}</button>)}</div>
      <label className="consistency-filter-select"><span>Filtr</span><select value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>{(['ALL','STUDY','WORK','PERSONAL','OVERLAP','TOUCHING'] as Filter[]).map((item) => <option key={item} value={item}>{({ALL:'Wszystkie',STUDY:'Zajęcia',WORK:'Praca',PERSONAL:'Prywatne',OVERLAP:'Nakładanie',TOUCHING:'Dojazd'} as Record<Filter,string>)[item]}</option>)}</select></label>
      <label className="compact-check"><input type="checkbox" checked={showAcknowledged} onChange={(e) => setShowAcknowledged(e.target.checked)} /><span>Pokaż zaakceptowane</span></label>
    </div>
    {visible.length ? <div className="consistency-list">{visible.map((issue) => {
      const related = issue.eventIds.map((id) => eventMap.get(id)).filter(Boolean) as CalendarEvent[];
      return <article className={`consistency-card impact-${issue.planningImpact.toLowerCase()}${issue.acknowledged ? ' acknowledged' : ''}`} key={issue.fingerprint}>
        <div className="consistency-card-top"><div><span className="consistency-impact">{issue.planningImpact === 'BLOCKING' ? 'WYMAGA SPRAWDZENIA' : issue.planningImpact === 'WARNING' ? 'OSTRZEŻENIE' : 'INFORMACJA'}</span><h3>{issue.title}</h3><p>{dateLabel(issue.startDateTime)} · {timeLabel(issue.startDateTime)}-{timeLabel(issue.endDateTime)}{issue.overlapMinutes ? ` · ${issue.overlapMinutes} min` : ''}</p></div>{issue.acknowledged ? <span className="ack-badge">Zaakceptowane</span> : null}</div>
        <p className="consistency-description">{issue.description}</p>
        {related.length ? <div className="consistency-events">{related.map((event) => {
          const location = event.locationId ? locationMap.get(event.locationId) : undefined;
          const address = location?.address?.trim() || event.locationText?.trim() || '';
          return <div key={event.id}><span className={`category-dot category-${event.category.toLowerCase()}`} aria-hidden="true"/><div className="consistency-event-main"><strong>{event.title}</strong><small className="consistency-event-time">{event.startDateTime.slice(11,16)}-{event.endDateTime.slice(11,16)}</small>{address ? <small className="consistency-event-address">{address}</small> : null}</div><div className="consistency-event-actions"><button type="button" className="text-button" onClick={() => onEdit(event)}>Edytuj</button>{event.source === 'UNIVERSITY_XLSX' && event.seriesKey ? <button type="button" className="text-button consistency-series-action" onClick={() => onStudySeriesCorrect(event)}>Edytuj serię</button> : null}</div></div>;
        })}</div> : null}
        {!issue.acknowledged && issue.planningImpact !== 'INFO' ? <div className="consistency-actions"><button type="button" className="button button-secondary button-small" onClick={() => void onAcknowledge(issue)}>Zostaw bez zmian</button></div> : null}
      </article>;
    })}</div> : <div className="diff-empty">Brak niespójności dla wybranego filtra.</div>}
  </section>;
}
