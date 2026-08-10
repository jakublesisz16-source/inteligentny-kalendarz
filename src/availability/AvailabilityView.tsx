import { useEffect, useMemo, useState } from 'react';
import { addDaysToDateKey, localDateFromKey } from '../calendar/date.utils';
import { getConfirmedWorkMinutes, getDayPlanningProfile } from '../storage/database';
import {
  acceptAvailabilityPlan,
  AvailabilityOverlapError,
  generateAvailabilityPlan,
  markAvailabilitySent,
  refreshAvailabilityPlanStatus,
  startOfWeekKey,
  updateAvailabilityBlock,
} from './availability.service';
import type { AvailabilityBlock, AvailabilityPlan } from './availability.types';

interface AvailabilityViewProps { onDataChanged: () => Promise<void>; onOpenSettings: () => void; }
function minutesLabel(value: number): string { const h = Math.floor(value / 60); const m = value % 60; return m ? `${h ? `${h} h ` : ''}${m} min` : `${h} h`; }
function weekLabel(start: string): string { const end = addDaysToDateKey(start, 6); const f = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' }).format(localDateFromKey(start)); const l = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }).format(localDateFromKey(end)); return `${f} - ${l}`; }
function dateLabel(date: string): string { return new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }).format(localDateFromKey(date)); }
function activeBlocks(plan?: AvailabilityPlan): AvailabilityBlock[] { return (plan?.blocks ?? []).filter((block) => block.status !== 'REJECTED').sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)); }
function acceptedBlocks(plan?: AvailabilityPlan): AvailabilityBlock[] { return activeBlocks(plan).filter((block) => (block.status === 'ACCEPTED' || block.status === 'EDITED') && block.validationState !== 'CONFLICT'); }

export function AvailabilityView({ onDataChanged, onOpenSettings }: AvailabilityViewProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeekKey(new Date()));
  const [plan, setPlan] = useState<AvailabilityPlan | undefined>();
  const [targetMinutes, setTargetMinutes] = useState(0);
  const [confirmedMinutes, setConfirmedMinutes] = useState(0);
  const [missingConfiguration, setMissingConfiguration] = useState<'target' | 'hours' | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState(''); const [editStart, setEditStart] = useState(''); const [editEnd, setEditEnd] = useState('');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null); const [expandedWhy, setExpandedWhy] = useState<string | null>(null);

  useEffect(() => { void refresh(); }, [weekStart]);
  async function refresh() {
    setError('');
    const weekEnd = addDaysToDateKey(weekStart, 6);
    const [profile, currentPlan, confirmed] = await Promise.all([getDayPlanningProfile(), refreshAvailabilityPlanStatus(weekStart), getConfirmedWorkMinutes(weekStart, weekEnd)]);
    setPlan(currentPlan); setTargetMinutes(profile?.targetWeeklyWorkMinutes ?? 0); setConfirmedMinutes(confirmed.totalConfirmedWorkMinutes);
    setMissingConfiguration(!profile?.targetWeeklyWorkMinutes ? 'target' : !profile.allowedWorkStart || !profile.allowedWorkEnd ? 'hours' : null);
  }
  async function generate() {
    setLoading(true); setError(''); setMessage('');
    try {
      const next = await generateAvailabilityPlan(weekStart);
      setPlan(next);
      const hasProposal = next.blocks.some((block) => block.status === 'PROPOSED');
      setMessage(next.deficitMinutes
        ? hasProposal
          ? `Znaleziono bezpieczne godziny, ale nadal brakuje ${minutesLabel(next.deficitMinutes)} do celu.`
          : `Nie znaleziono bezpiecznych godzin dyspozycyjności w tym tygodniu. Brakuje ${minutesLabel(next.deficitMinutes)} do celu.`
        : 'Znaleziono najlepsze uzupełnienie dyspozycyjności.');
      await onDataChanged();
      await refresh();
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się ułożyć dyspozycyjności.'); }
    finally { setLoading(false); }
  }
  async function blockAction(block: AvailabilityBlock, action: 'ACCEPT' | 'REJECT') {
    try { const next = await updateAvailabilityBlock(weekStart, block.id, action); setPlan(next); setSelectedBlockId(null); await onDataChanged(); setMessage(action === 'ACCEPT' ? 'Zaakceptowano propozycję.' : block.origin === 'MANUAL' ? 'Usunięto dyspozycyjność.' : 'Odrzucono propozycję.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać decyzji.'); }
  }
  async function acceptAll() { try { const next = await acceptAvailabilityPlan(weekStart); setPlan(next); await onDataChanged(); setMessage('Zaakceptowano propozycję uzupełnienia.'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się zaakceptować propozycji.'); } }
  function beginEdit(block: AvailabilityBlock) { setEditId(block.id); setEditDate(block.date); setEditStart(block.startTime); setEditEnd(block.endTime); }
  async function saveEdit(mergeOverlaps = false) {
    if (!editId) return;
    try { const next = await updateAvailabilityBlock(weekStart, editId, 'EDIT', { date: editDate, startTime: editStart, endTime: editEnd, mergeOverlaps }); setPlan(next); setEditId(null); setSelectedBlockId(null); await onDataChanged(); setMessage(next.remainingMinutes ? `Zmieniono dyspozycyjność. Brakuje jeszcze ${minutesLabel(next.remainingMinutes)}.` : 'Zmieniono dyspozycyjność. Cel jest pokryty.'); }
    catch (reason) {
      if (reason instanceof AvailabilityOverlapError && window.confirm(`${reason.message}\n\nScalić?`)) { await saveEdit(true); return; }
      setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać zmian.');
    }
  }
  async function copySummary() { const blocks = acceptedBlocks(plan); if (!blocks.length) { setError('Najpierw zapisz lub zaakceptuj dyspozycyjność.'); return; } const text = [`Dyspozycyjność ${weekLabel(weekStart)}`, '', ...blocks.map((block) => `${dateLabel(block.date)}: ${block.startTime}-${block.endTime}`), '', `Łącznie: ${minutesLabel(blocks.reduce((sum, block) => sum + block.minutes, 0))}`].join('\n'); await navigator.clipboard.writeText(text); setMessage('Skopiowano dyspozycyjność.'); }
  async function markSent() { try { const next = await markAvailabilitySent(weekStart); setPlan(next); setMessage(`Zapisano wysłaną wersję ${next.sentSnapshots.length}.`); await onDataChanged(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać wysłanej wersji.'); } }

  const blocks = useMemo(() => activeBlocks(plan), [plan]);
  const accepted = useMemo(() => acceptedBlocks(plan), [plan]);
  const manual = blocks.filter((block) => (block.status === 'ACCEPTED' || block.status === 'EDITED') && block.validationState !== 'CONFLICT');
  const proposals = blocks.filter((block) => block.status === 'PROPOSED');
  const conflicts = blocks.filter((block) => block.validationState === 'CONFLICT');
  const requiredMinutes = Math.max(0, targetMinutes - confirmedMinutes);
  const acceptedMinutes = plan?.acceptedAvailabilityMinutes ?? manual.reduce((sum, block) => sum + block.minutes, 0);
  const remainingMinutes = Math.max(0, requiredMinutes - acceptedMinutes);
  const overMinutes = Math.max(0, acceptedMinutes - requiredMinutes);
  const configured = missingConfiguration === null;
  const noSafeProposal = Boolean(configured && remainingMinutes > 0 && plan && proposals.length === 0 && plan.diagnostics?.reasons.length);

  function renderBlock(block: AvailabilityBlock) {
    const isProposal = block.status === 'PROPOSED';
    return <article key={block.id} className={`availability-block status-${block.status.toLowerCase()}${block.validationState === 'CONFLICT' ? ' has-conflict' : ''}`}>
      <div className="availability-block-main"><strong>{dateLabel(block.date)}</strong><span>{block.startTime}-{block.endTime}</span><small>{minutesLabel(block.minutes)} · {block.validationState === 'CONFLICT' ? 'Wymaga poprawy' : isProposal ? 'Propozycja aplikacji' : block.origin === 'MANUAL' ? 'Twoja dyspozycyjność' : block.status === 'EDITED' ? 'Zmieniona ręcznie' : 'Zaakceptowana'}</small></div>
      {editId === block.id ? <div className="availability-inline-edit"><input aria-label="Data dyspozycyjności" type="date" min={weekStart} max={addDaysToDateKey(weekStart, 6)} value={editDate} onChange={(e) => setEditDate(e.target.value)} /><input aria-label="Początek dyspozycyjności" type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} /><input aria-label="Koniec dyspozycyjności" type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} /><button type="button" className="button button-primary button-small" onClick={() => void saveEdit()}>Zapisz</button><button type="button" className="text-button" onClick={() => setEditId(null)}>Anuluj</button></div> : <button type="button" className="text-button availability-details-toggle" aria-expanded={selectedBlockId === block.id} onClick={() => { setSelectedBlockId(selectedBlockId === block.id ? null : block.id); setExpandedWhy(null); }}>{selectedBlockId === block.id ? 'Ukryj' : 'Szczegóły'}</button>}
      {block.validationState === 'CONFLICT' ? <div className="availability-conflict-note" role="alert">{block.validationMessage ?? 'Ta dyspozycyjność nie pasuje już do aktualnego kalendarza.'}</div> : null}
      {selectedBlockId === block.id && editId !== block.id ? <div className="availability-block-actions">{isProposal ? <button type="button" className="text-button" onClick={() => void blockAction(block, 'ACCEPT')}>Akceptuj</button> : null}<button type="button" className="text-button" onClick={() => beginEdit(block)}>Edytuj</button><button type="button" className="text-button warning-text" onClick={() => void blockAction(block, 'REJECT')}>{block.origin === 'MANUAL' ? 'Usuń' : 'Odrzuć'}</button>{isProposal || block.origin !== 'MANUAL' ? <button type="button" className="text-button" aria-expanded={expandedWhy === block.id} onClick={() => setExpandedWhy(expandedWhy === block.id ? null : block.id)}>Dlaczego?</button> : null}</div> : null}
      {expandedWhy === block.id ? <div className="availability-why">{block.explanationFacts.map((fact) => <p key={fact.code}>{fact.text}</p>)}</div> : null}
    </article>;
  }

  return <section className="availability-view">
    <div className="availability-week-toolbar"><button type="button" className="icon-button soft" aria-label="Poprzedni tydzień" onClick={() => setWeekStart(addDaysToDateKey(weekStart, -7))}>‹</button><div><span className="section-kicker">Dyspozycyjność</span><h2>{weekLabel(weekStart)}</h2></div><button type="button" className="icon-button soft" aria-label="Następny tydzień" onClick={() => setWeekStart(addDaysToDateKey(weekStart, 7))}>›</button></div>
    <div className="availability-settings-row"><button type="button" className="text-button" onClick={onOpenSettings}>⚙ Ustawienia</button><span className="muted-copy">Godziny z kalendarza liczą się automatycznie. W Kalendarzu ustawiasz tylko wyjątki.</span></div>
    {error ? <div className="study-message error-message" role="alert">{error}</div> : null}{message ? <div className="study-message success-message" role="status">{message}</div> : null}
    {plan?.status === 'STALE' ? <div className="availability-stale" role="alert"><strong>Kalendarz się zmienił.</strong><span>Twoje zapisane godziny zostają. Sprawdź konflikty i uzupełnij plan ponownie.</span><button className="button button-secondary button-small" type="button" onClick={() => void generate()}>Przelicz</button></div> : null}
    {!configured ? <div className="availability-config-note"><div><strong>{missingConfiguration === 'target' ? 'Ustaw tygodniowy cel godzin pracy' : 'Ustaw standardowe ramy pracy'}</strong><span>{missingConfiguration === 'target' ? 'Cel jest potrzebny, aby policzyć, ile godzin dyspozycyjności jeszcze brakuje.' : 'Aplikacja używa tych ram tylko jako granic dla całkowicie wolnych części dnia.'}</span></div><button type="button" className="button button-secondary button-small" onClick={onOpenSettings}>{missingConfiguration === 'target' ? 'Ustaw cel' : 'Ustaw ramy'}</button></div> : null}

    <div className="availability-summary-grid minimal-summary hotfix-summary"><div><span>Cel pracy</span><strong>{minutesLabel(targetMinutes)}</strong></div><div><span>Masz już pracę</span><strong>{minutesLabel(confirmedMinutes)}</strong></div><div><span>Twoja dyspozycja</span><strong>{minutesLabel(acceptedMinutes)}</strong></div><div><span>{overMinutes ? 'Ponad potrzebę' : 'Pozostało'}</span><strong>{minutesLabel(overMinutes || remainingMinutes)}</strong></div></div>

    <div className="availability-generate-row"><button type="button" className="button button-primary" disabled={loading || !configured || remainingMinutes === 0} onClick={() => void generate()}>{loading ? 'Szukam...' : acceptedMinutes ? `Znajdź najlepszy czas na ${minutesLabel(remainingMinutes)}` : 'Ułóż dyspozycyjność'}</button>{overMinutes ? <span>Masz {minutesLabel(overMinutes)} więcej dyspozycyjności niż potrzeba. Niczego nie usuwam automatycznie.</span> : requiredMinutes === 0 && targetMinutes > 0 ? <span>Potwierdzona praca już pokrywa tygodniowy cel.</span> : null}</div>

    {noSafeProposal ? <section className="availability-no-safe" aria-label="Brak bezpiecznych godzin"><div><strong>Nie znaleziono bezpiecznych godzin do uzupełnienia.</strong><span>Plan zajęć, praca, wydarzenia i Twoje wyjątki pozostają nadrzędne. Nie łamię tych ograniczeń, aby osiągnąć cel.</span></div><details><summary>Zobacz ograniczenia</summary><div>{plan?.diagnostics?.reasons.slice(0, 6).map((reason) => <span key={reason}>{reason}</span>)}</div></details></section> : null}

    {manual.length ? <section className="panel availability-plan-panel"><div className="panel-heading compact-heading"><div><span className="section-kicker">Twoja dyspozycyjność</span><h3>Zapisane godziny</h3></div></div><div className="availability-block-list">{manual.map(renderBlock)}</div></section> : null}
    {conflicts.length ? <section className="panel availability-plan-panel availability-conflict-panel"><div className="panel-heading compact-heading"><div><span className="section-kicker">Do poprawy</span><h3>Te godziny nie są już bezpieczne</h3></div></div><div className="availability-block-list">{conflicts.map(renderBlock)}</div></section> : null}
    {proposals.length ? <section className="panel availability-plan-panel"><div className="panel-heading compact-heading"><div><span className="section-kicker">Propozycja</span><h3>Uzupełnienie brakujących godzin</h3></div><button type="button" className="button button-primary button-small" onClick={() => void acceptAll()}>Akceptuj propozycję</button></div><div className="availability-block-list">{proposals.map(renderBlock)}</div>{plan?.diagnostics?.reasons.length ? <details className="availability-limit-reasons"><summary>Co ogranicza ten tydzień</summary><div>{plan.diagnostics.reasons.slice(0,4).map((reason) => <span key={reason}>{reason}</span>)}</div></details> : null}</section> : null}

    {accepted.length ? <div className="availability-copy-row"><button type="button" className="button button-secondary" onClick={() => void copySummary()}>Kopiuj</button><button type="button" className="button button-secondary" onClick={() => void markSent()}>Oznacz jako wysłane</button>{plan?.sentSnapshots.length ? <span>Wysłane wersje: {plan.sentSnapshots.length}</span> : null}</div> : null}
  </section>;
}
