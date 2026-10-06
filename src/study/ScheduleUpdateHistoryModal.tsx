import { useMemo, useState } from 'react';
import { formatStudyGroupList } from '../imports/xlsx/group-normalizer';
import { Modal } from '../ui/Modal';
import type { AppliedScheduleUpdateDetails, ScheduleUpdateHistoryItem } from './study.types';

type HistoryFilter = 'all' | 'added' | 'changed' | 'removed' | 'review';

interface ScheduleUpdateHistoryModalProps {
  details: AppliedScheduleUpdateDetails;
  onClose: () => void;
}

function itemStatus(item: ScheduleUpdateHistoryItem): string {
  if (item.kind === 'ADDED') return 'NOWE';
  if (item.kind === 'REMOVED') return 'USUNIĘTE';
  if (item.kind === 'CHANGED') return 'ZMIENIONE';
  if (item.kind === 'CONFLICT_USER_MODIFIED') return 'KONFLIKT Z RĘCZNĄ ZMIANĄ';
  if (item.kind === 'AMBIGUOUS') return 'DO SPRAWDZENIA';
  return 'BEZ ZMIAN';
}

function itemDate(item: ScheduleUpdateHistoryItem): string {
  if (!item.date) return 'Brak jednoznacznej daty';
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${item.date}T12:00:00`));
}

function appliedAtLabel(value?: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function matchesFilter(item: ScheduleUpdateHistoryItem, filter: HistoryFilter): boolean {
  if (filter === 'added') return item.kind === 'ADDED';
  if (filter === 'changed') return item.kind === 'CHANGED';
  if (filter === 'removed') return item.kind === 'REMOVED';
  if (filter === 'review') return item.kind === 'CONFLICT_USER_MODIFIED' || item.kind === 'AMBIGUOUS';
  return item.kind !== 'UNCHANGED';
}

export function ScheduleUpdateHistoryModal({ details, onClose }: ScheduleUpdateHistoryModalProps) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const visible = useMemo(() => details.changeItems.filter((item) => matchesFilter(item, filter)), [details.changeItems, filter]);
  const reviewCount = details.summary.conflicts + details.summary.ambiguous;
  const baseName = details.baseImport?.fileName ?? 'poprzednia wersja planu';
  const newName = details.appliedImport?.fileName ?? details.session.newFileName;

  return (
    <Modal title="Zmiany w planie" onClose={onClose} wide>
      <div className="study-update-history-modal">
        <section className="study-update-history-head">
          <div>
            <p className="section-kicker">Ostatnia aktualizacja</p>
            <h3>{baseName} → {newName}</h3>
            {details.session.appliedAt ? <span>Zastosowano {appliedAtLabel(details.session.appliedAt)}</span> : null}
          </div>
          <div className="diff-summary-grid study-update-history-summary" aria-label="Podsumowanie zmian planu">
            <div className="diff-metric added"><span>Nowe</span><strong>+{details.summary.added}</strong></div>
            <div className="diff-metric changed"><span>Zmienione</span><strong>{details.summary.changed}</strong></div>
            <div className="diff-metric removed"><span>Usunięte</span><strong>-{details.summary.removed}</strong></div>
            <div className="diff-metric conflict"><span>Konflikty</span><strong>{details.scheduleConflicts.length}</strong></div>
            <div className="diff-metric review"><span>Do sprawdzenia</span><strong>{reviewCount}</strong></div>
          </div>
          <p className="muted-copy study-update-history-unchanged">Bez zmian: {details.summary.unchanged} pozycji.</p>
        </section>

        {details.scheduleConflicts.length ? (
          <section className="diff-alert warning-info study-update-history-conflicts">
            <strong>Konflikty godzin po aktualizacji: {details.scheduleConflicts.length}</strong>
            <ul className="study-conflict-list">
              {details.scheduleConflicts.slice(0, 8).map((conflict) => (
                <li key={conflict.id}>
                  <time>{conflict.date}</time>
                  <span><strong>{conflict.left.subject}</strong> {conflict.left.startTime}-{conflict.left.endTime}</span>
                  <span className="conflict-separator">↔</span>
                  <span><strong>{conflict.right.subject}</strong> {conflict.right.startTime}-{conflict.right.endTime}</span>
                </li>
              ))}
            </ul>
            {details.scheduleConflicts.length > 8 ? <p>...oraz {details.scheduleConflicts.length - 8} kolejnych.</p> : null}
          </section>
        ) : null}

        <div className="preview-filters study-update-history-filters" role="group" aria-label="Filtr historii zmian planu">
          <button type="button" className={filter === 'all' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('all')}>Wszystkie ({details.changeItems.length})</button>
          {details.summary.added ? <button type="button" className={filter === 'added' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('added')}>Nowe ({details.summary.added})</button> : null}
          {details.summary.changed ? <button type="button" className={filter === 'changed' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('changed')}>Zmienione ({details.summary.changed})</button> : null}
          {details.summary.removed ? <button type="button" className={filter === 'removed' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('removed')}>Usunięte ({details.summary.removed})</button> : null}
          {reviewCount ? <button type="button" className={filter === 'review' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('review')}>Do sprawdzenia ({reviewCount})</button> : null}
        </div>

        <div className="diff-list study-update-history-list">
          {visible.length ? visible.map((item) => (
            <article key={item.id} className={`panel diff-card diff-${item.kind.toLowerCase()} study-update-history-card`}>
              <div className="diff-card-heading">
                <div>
                  <span className={`diff-kind ${item.kind.toLowerCase()}`}>{itemStatus(item)}</span>
                  <h3>{item.subject}</h3>
                  <span>{itemDate(item)}</span>
                </div>
              </div>

              {item.changes.length ? (
                <div className="diff-field-list">
                  {item.changes.map((field) => (
                    <div key={`${item.id}-${field.field}`} className="diff-field">
                      <strong>{field.label}</strong>
                      <div><span>było</span><del>{field.before ?? 'brak'}</del></div>
                      <div><span>jest</span><ins>{field.after ?? 'brak'}</ins></div>
                    </div>
                  ))}
                </div>
              ) : null}

              {item.kind === 'ADDED' ? (
                <div className="study-update-history-facts">
                  {item.startTime && item.endTime ? <span><strong>Godzina</strong>{item.startTime}-{item.endTime}</span> : null}
                  {item.activityType ? <span><strong>Rodzaj</strong>{item.activityType}</span> : null}
                  {item.groupTags.length ? <span><strong>Grupa</strong>{formatStudyGroupList(item.groupTags)}</span> : null}
                  {item.room ? <span><strong>Sala</strong>{item.room}</span> : null}
                  {item.clinic || item.locationLabel ? <span><strong>Miejsce</strong>{item.clinic ?? item.locationLabel}</span> : null}
                  {item.address ? <span><strong>Adres</strong>{item.address}</span> : null}
                </div>
              ) : null}

              {item.kind === 'REMOVED' ? <p className="muted-copy">Tego wpisu nie ma w nowej wersji planu.</p> : null}
              {item.note ? <div className="diff-alert">{item.note}</div> : null}
            </article>
          )) : (
            <section className="panel diff-empty"><strong>Brak zmian w tym filtrze.</strong></section>
          )}
        </div>

        {details.reconstructed && !details.changeItems.length && (details.summary.added || details.summary.changed || details.summary.removed || reviewCount) ? (
          <div className="diff-alert">Szczegółowa historia tej starszej aktualizacji nie jest już dostępna, bo usunięto jedną z wersji źródłowych planu.</div>
        ) : null}
      </div>
    </Modal>
  );
}
