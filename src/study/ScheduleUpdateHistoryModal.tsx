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
  const itemCounts = useMemo(() => ({
    added: details.changeItems.filter((item) => item.kind === 'ADDED').length,
    changed: details.changeItems.filter((item) => item.kind === 'CHANGED').length,
    removed: details.changeItems.filter((item) => item.kind === 'REMOVED').length,
    review: details.changeItems.filter((item) => item.kind === 'CONFLICT_USER_MODIFIED' || item.kind === 'AMBIGUOUS').length,
  }), [details.changeItems]);
  const reviewCount = details.summary.conflicts + details.summary.ambiguous;
  const baseName = details.baseImport?.fileName ?? 'poprzednia wersja planu';
  const newName = details.appliedImport?.fileName ?? details.session.newFileName;
  const detailCategoryCount = [itemCounts.added, itemCounts.changed, itemCounts.removed, itemCounts.review].filter(Boolean).length;
  const showFilters = details.changeItems.length > 1 && detailCategoryCount > 1;
  const hasDetailedHistory = details.changeItems.length > 0;
  const hasSummaryChange = Boolean(details.summary.added || details.summary.changed || details.summary.removed || details.scheduleConflicts.length || reviewCount);

  return (
    <Modal title="Zmiany w planie" onClose={onClose} wide>
      <div className="study-update-history-modal">
        <section className="study-update-history-head">
          <div>
            <p className="section-kicker">Ostatnia aktualizacja</p>
            <h3>{baseName} → {newName}</h3>
            {details.session.appliedAt ? <span>Zastosowano {appliedAtLabel(details.session.appliedAt)}</span> : null}
          </div>
          <div className="study-update-history-summary-compact" aria-label="Podsumowanie zmian planu">
            {details.summary.added ? <span className="is-added"><strong>+{details.summary.added}</strong> nowe</span> : null}
            {details.summary.changed ? <span className="is-changed"><strong>{details.summary.changed}</strong> zmienione</span> : null}
            {details.summary.removed ? <span className="is-removed"><strong>{details.summary.removed}</strong> usunięte</span> : null}
            {details.scheduleConflicts.length ? <span className="is-conflict"><strong>{details.scheduleConflicts.length}</strong> konflikty</span> : null}
            {reviewCount ? <span className="is-review"><strong>{reviewCount}</strong> do sprawdzenia</span> : null}
            {details.summary.unchanged ? <span className="is-unchanged"><strong>{details.summary.unchanged}</strong> bez zmian</span> : null}
          </div>
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

        {showFilters ? (
          <div className="preview-filters study-update-history-filters" role="group" aria-label="Filtr historii zmian planu">
            <button type="button" className={filter === 'all' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('all')}>Wszystkie ({details.changeItems.length})</button>
            {itemCounts.added ? <button type="button" className={filter === 'added' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('added')}>Nowe ({itemCounts.added})</button> : null}
            {itemCounts.changed ? <button type="button" className={filter === 'changed' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('changed')}>Zmienione ({itemCounts.changed})</button> : null}
            {itemCounts.removed ? <button type="button" className={filter === 'removed' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('removed')}>Usunięte ({itemCounts.removed})</button> : null}
            {itemCounts.review ? <button type="button" className={filter === 'review' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('review')}>Do sprawdzenia ({itemCounts.review})</button> : null}
          </div>
        ) : null}

        {hasDetailedHistory ? (
          <div className="diff-list study-update-history-list">
            {visible.map((item) => (
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
            ))}
          </div>
        ) : null}

        {details.reconstructed && !hasDetailedHistory && hasSummaryChange ? (
          <div className="diff-alert study-update-history-unavailable"><strong>Szczegóły tej aktualizacji nie są już dostępne.</strong><span>Zachowano poprawne podsumowanie zmian, ale starsza wersja źródłowa planu została już wyczyszczona.</span></div>
        ) : null}
      </div>
    </Modal>
  );
}
