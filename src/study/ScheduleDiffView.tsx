import { useMemo, useState } from 'react';
import { findStudyUpdateDecisionConflicts } from './study.service';
import type { ScheduleDiffItem, ScheduleDiffResolution, ScheduleUpdatePreview } from './study.types';

interface ScheduleDiffViewProps {
  preview: ScheduleUpdatePreview;
  saving: boolean;
  onChange: (preview: ScheduleUpdatePreview) => void;
  onApply: () => void;
  onCancel: () => void;
}

type DiffFilter = 'all' | 'added' | 'changed' | 'removed' | 'conflicts';

function itemTitle(item: ScheduleDiffItem): string {
  return item.newCandidate?.subject ?? item.oldEntry?.subject ?? 'Nieustalone zajęcia';
}

function itemDate(item: ScheduleDiffItem): string {
  const value = item.newCandidate?.date ?? item.oldEntry?.date;
  if (!value) return 'Brak daty';
  return new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function statusLabel(item: ScheduleDiffItem): string {
  if (item.kind === 'ADDED') return 'NOWE';
  if (item.kind === 'REMOVED') return 'USUNIĘTE';
  if (item.kind === 'CHANGED') return 'ZMIENIONE';
  if (item.kind === 'CONFLICT_USER_MODIFIED') return 'KONFLIKT';
  if (item.kind === 'AMBIGUOUS') return 'WYMAGA KONTROLI';
  return 'BEZ ZMIAN';
}

function matchesFilter(item: ScheduleDiffItem, filter: DiffFilter): boolean {
  if (filter === 'added') return item.kind === 'ADDED';
  if (filter === 'changed') return item.kind === 'CHANGED';
  if (filter === 'removed') return item.kind === 'REMOVED';
  if (filter === 'conflicts') return item.kind === 'CONFLICT_USER_MODIFIED' || item.kind === 'AMBIGUOUS';
  return item.kind !== 'UNCHANGED';
}

function setResolution(item: ScheduleDiffItem, resolution: ScheduleDiffResolution): ScheduleDiffItem {
  return { ...item, resolution };
}

export function ScheduleDiffView({ preview, saving, onChange, onApply, onCancel }: ScheduleDiffViewProps) {
  const [filter, setFilter] = useState<DiffFilter>('all');
  const visible = useMemo(() => preview.items.filter((item) => matchesFilter(item, filter)), [preview.items, filter]);
  const actionable = preview.items.filter((item) => item.kind !== 'UNCHANGED' && item.kind !== 'AMBIGUOUS');
  const unresolved = preview.items.filter((item) => item.kind === 'CONFLICT_USER_MODIFIED' && !['KEEP_USER', 'USE_NEW'].includes(item.resolution));

  function updateResolution(id: string, resolution: ScheduleDiffResolution) {
    const items = preview.items.map((item) => item.id === id ? setResolution(item, resolution) : item);
    const scheduleConflicts = findStudyUpdateDecisionConflicts(items);
    const next: ScheduleUpdatePreview = { ...preview, items, allowScheduleConflicts: false };
    if (scheduleConflicts.length) next.scheduleConflicts = scheduleConflicts;
    else delete next.scheduleConflicts;
    onChange(next);
  }

  return (
    <div className="study-stack diff-stack">
      <section className="panel diff-summary-panel">
        <div>
          <p className="section-kicker">Co się zmieniło?</p>
          <h2>Porównanie z aktywnym planem</h2>
          <p className="muted-copy">Baza porównania: {preview.baseImport.fileName}. Kalendarz zmieni się dopiero po zatwierdzeniu.</p>
        </div>
        <div className="diff-summary-grid">
          <div className="diff-metric added"><span>Nowe</span><strong>+{preview.summary.added}</strong></div>
          <div className="diff-metric removed"><span>Usunięte</span><strong>-{preview.summary.removed}</strong></div>
          <div className="diff-metric changed"><span>Zmienione</span><strong>{preview.summary.changed}</strong></div>
          <div className="diff-metric conflict"><span>Konflikty</span><strong>{preview.summary.conflicts + preview.summary.ambiguous}</strong></div>
          <div className="diff-metric unchanged"><span>Bez zmian</span><strong>{preview.summary.unchanged}</strong></div>
        </div>
        {preview.correctionConflicts.length ? (
          <div className="diff-alert warning-info">
            {preview.correctionConflicts.length} zapisanych poprawek serii różni się od jawnych danych w nowym planie. Nowa wartość z planu Excel nie została po cichu zastąpiona starą poprawką.
          </div>
        ) : null}
        {preview.scheduleConflicts?.length ? (
          <div className="diff-alert warning-info">
            <strong>Końcowy wynik bieżących decyzji zawiera {preview.scheduleConflicts.length} konfliktów godzin.</strong>
            <ul className="study-conflict-list">{preview.scheduleConflicts.slice(0, 6).map((conflict) => <li key={conflict.id}><time>{conflict.date}</time><span><strong>{conflict.left.subject}</strong> {conflict.left.startTime}-{conflict.left.endTime}</span><span className="conflict-separator">↔</span><span><strong>{conflict.right.subject}</strong> {conflict.right.startTime}-{conflict.right.endTime}</span></li>)}</ul>
            {preview.scheduleConflicts.length > 6 ? <p>...oraz {preview.scheduleConflicts.length - 6} kolejnych.</p> : null}
            <p>To informacja o wyniku bieżących decyzji. Kliknięcie „Zastosuj aktualizację planu” zapisze wybrane zmiany także wtedy, gdy część zajęć się nakłada.</p>
          </div>
        ) : null}
      </section>

      <section className="panel diff-filter-panel">
        <div className="preview-filters" role="group" aria-label="Filtr zmian planu">
          <button type="button" className={filter === 'all' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('all')}>Wszystkie zmiany</button>
          <button type="button" className={filter === 'added' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('added')}>Nowe ({preview.summary.added})</button>
          <button type="button" className={filter === 'changed' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('changed')}>Zmienione ({preview.summary.changed})</button>
          <button type="button" className={filter === 'removed' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('removed')}>Usunięte ({preview.summary.removed})</button>
          <button type="button" className={filter === 'conflicts' ? 'filter-button active' : 'filter-button'} onClick={() => setFilter('conflicts')}>Konflikty ({preview.summary.conflicts + preview.summary.ambiguous})</button>
        </div>
      </section>

      <div className="diff-list">
        {visible.length ? visible.map((item) => (
          <article key={item.id} className={`panel diff-card diff-${item.kind.toLowerCase()}`}>
            <div className="diff-card-heading">
              <div>
                <span className={`diff-kind ${item.kind.toLowerCase()}`}>{statusLabel(item)}</span>
                <h3>{itemTitle(item)}</h3>
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

            {item.kind === 'ADDED' && item.newCandidate ? (
              <p className="muted-copy">{item.newCandidate.startTime ?? '?'}-{item.newCandidate.endTime ?? '?'}{item.newCandidate.room ? ` - ${item.newCandidate.room}` : ''}{item.newCandidate.address ? ` - ${item.newCandidate.address}` : ''}</p>
            ) : null}
            {item.kind === 'REMOVED' ? <p className="muted-copy">Tego terminu nie znaleziono w nowej wersji planu.</p> : null}
            {item.note ? <div className="diff-alert">{item.note}</div> : null}

            {item.kind === 'CONFLICT_USER_MODIFIED' ? (
              <div className="diff-resolution">
                <strong>Masz ręczną zmianę. Co zrobić?</strong>
                <button type="button" className={item.resolution === 'KEEP_USER' ? 'choice-button active' : 'choice-button'} onClick={() => updateResolution(item.id, 'KEEP_USER')}>Zachowaj moją zmianę</button>
                <button type="button" className={item.resolution === 'USE_NEW' ? 'choice-button active' : 'choice-button'} onClick={() => updateResolution(item.id, 'USE_NEW')}>Użyj danych z nowego planu</button>
              </div>
            ) : null}

            {item.kind === 'AMBIGUOUS' ? (
              <div className="diff-alert">Ten wpis nie zostanie zastosowany automatycznie. Najpierw trzeba uzupełnić dane krytyczne w źródle/importerze.</div>
            ) : null}

            {item.kind === 'ADDED' || item.kind === 'CHANGED' || item.kind === 'REMOVED' ? (
              <label className="diff-apply-toggle">
                <input type="checkbox" checked={item.resolution === 'APPLY'} onChange={(event) => updateResolution(item.id, event.target.checked ? 'APPLY' : 'SKIP')} />
                <span>{item.kind === 'REMOVED' ? 'Usuń z kalendarza przy aktualizacji' : 'Zastosuj tę zmianę'}</span>
              </label>
            ) : null}
          </article>
        )) : (
          <section className="panel diff-empty"><strong>Brak zmian w tym filtrze.</strong></section>
        )}
      </div>

      <footer className="study-actions split-study-actions diff-actions">
        <button type="button" className="button button-secondary" onClick={onCancel}>Anuluj aktualizację</button>
        <div>
          <span className="muted-copy">{actionable.length} zmian do decyzji{unresolved.length ? ` - ${unresolved.length} nierozwiązanych konfliktów` : ''}</span>
          <button type="button" className="button button-primary" disabled={saving || unresolved.length > 0} onClick={onApply}>{saving ? 'Aktualizuję...' : 'Zastosuj aktualizację planu'}</button>
        </div>
      </footer>
    </div>
  );
}
