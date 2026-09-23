import { useEffect, useMemo, useRef, useState } from 'react';
import { addDaysToDateKey, localDateFromKey } from '../calendar/date.utils';
import { getConfirmedWorkMinutes, getDayPlanningProfile, listConfirmedWorkBlocks } from '../storage/database';
import { Modal } from '../ui/Modal';
import { DayAvailabilityEditor } from './DayAvailabilityEditor';
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
import type { ConfirmedWorkBlock } from '../work/work.types';

interface AvailabilityViewProps { onDataChanged: () => Promise<void>; onOpenSettings: () => void; }
function minutesLabel(value: number): string { const h = Math.floor(value / 60); const m = value % 60; return m ? `${h ? `${h} h ` : ''}${m} min` : `${h} h`; }
function weekLabel(start: string): string { const end = addDaysToDateKey(start, 6); const f = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short' }).format(localDateFromKey(start)); const l = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }).format(localDateFromKey(end)); return `${f} - ${l}`; }
function dateLabel(date: string): string { return new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }).format(localDateFromKey(date)); }
function fullDateLabel(date: string): string { return new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(localDateFromKey(date)); }
function activeBlocks(plan?: AvailabilityPlan): AvailabilityBlock[] { return (plan?.blocks ?? []).filter((block) => block.status !== 'REJECTED').sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)); }
function acceptedBlocks(plan?: AvailabilityPlan): AvailabilityBlock[] { return activeBlocks(plan).filter((block) => (block.status === 'ACCEPTED' || block.status === 'EDITED') && block.validationState !== 'CONFLICT'); }

export function AvailabilityView({ onDataChanged, onOpenSettings }: AvailabilityViewProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeekKey(new Date()));
  const [plan, setPlan] = useState<AvailabilityPlan | undefined>();
  const [targetMinutes, setTargetMinutes] = useState(0);
  const [confirmedMinutes, setConfirmedMinutes] = useState(0);
  const [confirmedWorkBlocks, setConfirmedWorkBlocks] = useState<ConfirmedWorkBlock[]>([]);
  const [missingConfiguration, setMissingConfiguration] = useState<'target' | 'hours' | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState(''); const [editStart, setEditStart] = useState(''); const [editEnd, setEditEnd] = useState('');
  const [dayEditor, setDayEditor] = useState<{ date: string; blockId?: string; mode: 'manual' | 'automation' } | null>(null);
  const refreshRequestRef = useRef(0);

  useEffect(() => { void refresh(); }, [weekStart]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 3500);
    return () => window.clearTimeout(timer);
  }, [message]);
  async function refresh() {
    const requestId = ++refreshRequestRef.current;
    const requestedWeek = weekStart;
    setError('');
    try {
      const weekEnd = addDaysToDateKey(requestedWeek, 6);
      const [profile, refreshedPlan, confirmed, workBlocks] = await Promise.all([getDayPlanningProfile(), refreshAvailabilityPlanStatus(requestedWeek), getConfirmedWorkMinutes(requestedWeek, weekEnd), listConfirmedWorkBlocks(requestedWeek, weekEnd)]);
      if (requestId !== refreshRequestRef.current) return;
      const missing = !profile?.targetWeeklyWorkMinutes ? 'target' : !profile.allowedWorkStart || !profile.allowedWorkEnd ? 'hours' : null;
      const target = profile?.targetWeeklyWorkMinutes ?? 0;
      let currentPlan = refreshedPlan;
      const required = Math.max(0, target - confirmed.totalConfirmedWorkMinutes);
      const acceptedCoverage = currentPlan?.acceptedAvailabilityMinutes ?? 0;
      const hasProposal = currentPlan?.blocks.some((block) => block.status === 'PROPOSED') ?? false;
      const userRejectedAutomaticProposal = currentPlan?.blocks.some((block) => block.status === 'REJECTED' && (block.origin ?? 'OPTIMIZER') === 'OPTIMIZER') ?? false;
      if (!missing && required > acceptedCoverage && (!currentPlan || currentPlan.status === 'STALE' || (!hasProposal && !userRejectedAutomaticProposal))) {
        currentPlan = await generateAvailabilityPlan(requestedWeek);
        if (requestId !== refreshRequestRef.current) return;
      }
      setPlan(currentPlan); setTargetMinutes(target); setConfirmedMinutes(confirmed.totalConfirmedWorkMinutes); setConfirmedWorkBlocks(workBlocks);
      setMissingConfiguration(missing);
    } catch (reason) {
      if (requestId !== refreshRequestRef.current) return;
      setError(reason instanceof Error ? reason.message : 'Nie udało się odczytać dyspozycyjności.');
    }
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
    try { const next = await updateAvailabilityBlock(weekStart, block.id, action); setPlan(next); await onDataChanged(); setMessage(action === 'ACCEPT' ? 'Zaakceptowano propozycję.' : block.origin === 'MANUAL' ? 'Usunięto dyspozycyjność.' : 'Odrzucono propozycję.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać decyzji.'); }
  }
  async function acceptAll() { try { const next = await acceptAvailabilityPlan(weekStart); setPlan(next); await onDataChanged(); setMessage('Zaakceptowano propozycję uzupełnienia.'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się zaakceptować propozycji.'); } }
  function beginEdit(block: AvailabilityBlock) { setEditId(block.id); setEditDate(block.date); setEditStart(block.startTime); setEditEnd(block.endTime); }
  async function saveEdit(mergeOverlaps = false) {
    if (!editId) return;
    try { const next = await updateAvailabilityBlock(weekStart, editId, 'EDIT', { date: editDate, startTime: editStart, endTime: editEnd, mergeOverlaps }); setPlan(next); setEditId(null); await onDataChanged(); setMessage(next.remainingMinutes ? `Zmieniono dyspozycyjność. Brakuje jeszcze ${minutesLabel(next.remainingMinutes)}.` : 'Zmieniono dyspozycyjność.'); }
    catch (reason) {
      if (reason instanceof AvailabilityOverlapError && window.confirm(`${reason.message}\n\nScalić?`)) { await saveEdit(true); return; }
      setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać zmian.');
    }
  }
  async function copySummary() {
    const blocks = acceptedBlocks(plan);
    if (!blocks.length) { setError('Najpierw zapisz lub zaakceptuj dyspozycyjność.'); return; }
    const text = [`Dyspozycyjność ${weekLabel(weekStart)}`, '', ...blocks.map((block) => `${dateLabel(block.date)}: ${block.startTime}-${block.endTime}`), '', `Łącznie: ${minutesLabel(blocks.reduce((sum, block) => sum + block.minutes, 0))}`].join('\n');
    setError('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Schowek nie jest dostępny w tym środowisku.');
      await navigator.clipboard.writeText(text);
      setMessage('Skopiowano dyspozycyjność.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Nie udało się skopiować dyspozycyjności.');
    }
  }
  async function markSent() { try { const next = await markAvailabilitySent(weekStart); setPlan(next); setMessage(`Zapisano wysłaną wersję ${next.sentSnapshots.length}.`); await onDataChanged(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Nie udało się zapisać wysłanej wersji.'); } }
  async function savedFromDayEditor() { await onDataChanged(); await refresh(); }

  const blocks = useMemo(() => activeBlocks(plan), [plan]);
  const accepted = useMemo(() => acceptedBlocks(plan), [plan]);
  const proposals = blocks.filter((block) => block.status === 'PROPOSED');
  const conflicts = blocks.filter((block) => block.validationState === 'CONFLICT');
  const requiredMinutes = Math.max(0, targetMinutes - confirmedMinutes);
  const acceptedMinutes = plan?.acceptedAvailabilityMinutes ?? accepted.reduce((sum, block) => sum + block.minutes, 0);
  const remainingMinutes = Math.max(0, requiredMinutes - acceptedMinutes);
  const overMinutes = Math.max(0, acceptedMinutes - requiredMinutes);
  const configured = missingConfiguration === null;
  const noSafeProposal = Boolean(configured && remainingMinutes > 0 && plan && proposals.length === 0 && plan.diagnostics?.reasons.length);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, offset) => addDaysToDateKey(weekStart, offset)), [weekStart]);
  const acceptedByDate = useMemo(() => {
    const map = new Map<string, AvailabilityBlock[]>();
    for (const block of accepted) map.set(block.date, [...(map.get(block.date) ?? []), block]);
    return map;
  }, [accepted]);
  const proposalsByDate = useMemo(() => {
    const map = new Map<string, AvailabilityBlock[]>();
    for (const block of proposals.filter((item) => item.validationState !== 'CONFLICT')) map.set(block.date, [...(map.get(block.date) ?? []), block]);
    return map;
  }, [proposals]);
  const workByDate = useMemo(() => {
    const map = new Map<string, ConfirmedWorkBlock[]>();
    for (const block of confirmedWorkBlocks) map.set(block.date, [...(map.get(block.date) ?? []), block]);
    return map;
  }, [confirmedWorkBlocks]);
  const rulesByDate = useMemo(() => new Map((plan?.dayRules ?? []).map((rule) => [rule.date, rule])), [plan]);

  function renderBlock(block: AvailabilityBlock) {
    const isProposal = block.status === 'PROPOSED';
    return <article key={block.id} className={`availability-block status-${block.status.toLowerCase()}${block.validationState === 'CONFLICT' ? ' has-conflict' : ''}`}>
      <div className="availability-block-main"><strong>{dateLabel(block.date)}</strong><span>{block.startTime}-{block.endTime}</span><small>{minutesLabel(block.minutes)} · {block.validationState === 'CONFLICT' ? 'Wymaga poprawy' : isProposal ? 'Propozycja aplikacji' : block.origin === 'MANUAL' ? 'Twoja dyspozycyjność' : block.status === 'EDITED' ? 'Zmieniona ręcznie' : 'Zaakceptowana'}</small></div>
      {editId === block.id ? <div className="availability-inline-edit"><input aria-label="Data dyspozycyjności" type="date" min={weekStart} max={addDaysToDateKey(weekStart, 6)} value={editDate} onChange={(e) => setEditDate(e.target.value)} /><input aria-label="Początek dyspozycyjności" type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} /><input aria-label="Koniec dyspozycyjności" type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} /><button type="button" className="button button-primary button-small" onClick={() => void saveEdit()}>Zapisz</button><button type="button" className="text-button" onClick={() => setEditId(null)}>Anuluj</button></div> : <div className="availability-block-actions">{isProposal ? <button type="button" className="text-button" onClick={() => void blockAction(block, 'ACCEPT')}>Akceptuj</button> : null}<button type="button" className="text-button" onClick={() => beginEdit(block)}>Edytuj</button><button type="button" className="text-button warning-text" onClick={() => void blockAction(block, 'REJECT')}>{block.origin === 'MANUAL' ? 'Usuń' : 'Odrzuć'}</button></div>}
      {block.validationState === 'CONFLICT' ? <div className="availability-conflict-note" role="alert">{block.validationMessage ?? 'Ta dyspozycyjność nie pasuje już do aktualnego kalendarza.'}</div> : null}
      {(isProposal || block.origin !== 'MANUAL') && block.explanationFacts.length ? <div className="availability-why">{block.explanationFacts.map((fact) => <p key={fact.code}>{fact.text}</p>)}</div> : null}
    </article>;
  }

  return <section className="availability-view">
    <div className="availability-week-toolbar"><button type="button" className="icon-button soft" aria-label="Poprzedni tydzień" onClick={() => setWeekStart(addDaysToDateKey(weekStart, -7))}>‹</button><div><h2>{weekLabel(weekStart)}</h2></div><button type="button" className="icon-button soft" aria-label="Następny tydzień" onClick={() => setWeekStart(addDaysToDateKey(weekStart, 7))}>›</button></div>
    {error ? <div className="study-message error-message" role="alert">{error}</div> : null}{message ? <div className="study-message success-message availability-flash-message" role="status">{message}</div> : null}

    <div className="availability-dashboard-layout">
    <section className="panel availability-week-editor" aria-label="Dyspozycyjność na dni tygodnia">
      <div className="panel-heading compact-heading"><div><h3>Plan tygodnia</h3></div></div>
      <div className="availability-week-days">
        {weekDates.map((date) => {
          const dayBlocks = acceptedByDate.get(date) ?? [];
          const dayProposals = proposalsByDate.get(date) ?? [];
          const dayWork = workByDate.get(date) ?? [];
          const rule = rulesByDate.get(date);
          const hasAny = dayBlocks.length > 0 || dayProposals.length > 0 || dayWork.length > 0;
          const totalShown = dayBlocks.reduce((sum, block) => sum + block.minutes, 0) + dayWork.reduce((sum, block) => sum + block.minutes, 0);
          return <article key={date} className={`availability-week-day${hasAny ? ' has-hours' : ''}`}>
            <div className="availability-week-day-date"><strong>{dateLabel(date)}</strong>{totalShown ? <span>{minutesLabel(totalShown)} stałe</span> : rule?.excluded ? <span>Automat: wyłączony</span> : null}</div>
            <div className="availability-week-day-times">
              {dayWork.map((block) => <span key={block.eventId} className="availability-fixed-work-chip">Praca {block.startDateTime.slice(11, 16)}-{block.endDateTime.slice(11, 16)}</span>)}
              {dayBlocks.map((block) => <button key={block.id} type="button" className="availability-time-chip" onClick={() => setDayEditor({ date, blockId: block.id, mode: 'manual' })}>{block.startTime}-{block.endTime}</button>)}
              {dayProposals.map((block) => <button key={block.id} type="button" className="availability-proposal-chip" aria-label={`Akceptuj propozycję ${block.startTime}-${block.endTime}`} onClick={() => void blockAction(block, 'ACCEPT')}>Propozycja {block.startTime}-{block.endTime}</button>)}
              {!hasAny ? <span className="availability-empty-hours">Wolne</span> : null}
            </div>
            <button type="button" className="button button-secondary button-small" onClick={() => setDayEditor({ date, mode: 'manual' })}>{dayBlocks.length ? '+ Dodaj zakres' : 'Ustaw ręcznie'}</button>
          </article>;
        })}
      </div>
    </section>

    {conflicts.length ? <section className="panel availability-plan-panel availability-conflict-panel"><div className="panel-heading compact-heading"><div><span className="section-kicker">Do poprawy</span><h3>Te godziny kolidują z kalendarzem</h3></div></div><div className="availability-block-list">{conflicts.map(renderBlock)}</div></section> : null}

    <section className="panel availability-automation-panel" aria-label="Automatyczne propozycje dyspozycyjności">
      <div className="availability-automation-heading">
        <div><h3>Automat</h3></div>
        <button type="button" className="button button-secondary button-small" onClick={onOpenSettings}>Ustawienia automatu</button>
      </div>

      {!configured ? <div className="availability-config-note availability-config-note-inline"><div><strong>Automat nie jest jeszcze skonfigurowany</strong><span>{missingConfiguration === 'target' ? 'Ustaw tygodniowy cel pracy, jeśli chcesz otrzymywać propozycje brakujących godzin.' : 'Ustaw standardowe ramy pracy, jeśli chcesz otrzymywać automatyczne propozycje.'}</span></div><button type="button" className="button button-secondary button-small" onClick={onOpenSettings}>{missingConfiguration === 'target' ? 'Ustaw cel' : 'Ustaw ramy'}</button></div> : <>
        <div className="availability-summary-grid minimal-summary automation-summary-grid"><div><span>Cel tygodnia</span><strong>{minutesLabel(targetMinutes)}</strong></div><div><span>Zaplanowana praca</span><strong>{minutesLabel(confirmedMinutes)}</strong></div><div><span>Twoja dyspozycyjność</span><strong>{minutesLabel(acceptedMinutes)}</strong></div><div><span>{overMinutes ? 'Ponad potrzebę' : 'Do uzupełnienia'}</span><strong>{minutesLabel(overMinutes || remainingMinutes)}</strong></div></div>

        <div className="availability-day-rules">
          <div className="availability-day-rules-heading"><strong>Wyjątki</strong></div>
          <div className="availability-day-rule-grid">
            {weekDates.map((date) => {
              const rule = rulesByDate.get(date);
              const hasRule = Boolean(rule && (rule.excluded || rule.earliestTime || rule.latestTime || rule.blockedIntervals.length));
              const summary = rule?.excluded ? 'Wyłączony' : hasRule ? [rule?.earliestTime && `od ${rule.earliestTime}`, rule?.latestTime && `do ${rule.latestTime}`, rule?.blockedIntervals.length ? `${rule.blockedIntervals.length} blok.` : ''].filter(Boolean).join(' · ') : 'Bez wyjątków';
              return <button key={date} type="button" className={`availability-day-rule-button${hasRule ? ' has-rule' : ''}`} onClick={() => setDayEditor({ date, mode: 'automation' })}><strong>{dateLabel(date)}</strong><span>{summary}</span></button>;
            })}
          </div>
        </div>

        {plan?.status === 'STALE' ? <div className="availability-stale availability-stale-inline" role="alert"><strong>Kalendarz się zmienił.</strong><span>Ręczne godziny zostają, a propozycje zostaną przeliczone z aktualnego planu.</span>{remainingMinutes > 0 ? <button className="button button-secondary button-small" type="button" onClick={() => void generate()}>Przelicz teraz</button> : null}</div> : null}

        {remainingMinutes > 0 ? <div className="availability-generate-row availability-auto-status"><span>{loading ? 'Przeliczam kalendarz...' : proposals.length ? 'Propozycje są już pokazane przy odpowiednich dniach powyżej.' : 'Automat nie znalazł jeszcze bezpiecznego uzupełnienia.'}</span><button type="button" className="button button-secondary button-small" disabled={loading} onClick={() => void generate()}>{loading ? 'Przeliczam...' : 'Przelicz'}</button></div> : <div className="availability-automation-complete"><strong>Cel tygodnia osiągnięty</strong></div>}

        {noSafeProposal ? <section className="availability-no-safe" aria-label="Brak bezpiecznych godzin"><div><strong>Nie znaleziono bezpiecznych godzin do uzupełnienia.</strong><span>Plan zajęć, praca, wydarzenia i Twoje wyjątki pozostają nadrzędne.</span></div><div className="availability-limit-reasons"><strong>Co ogranicza ten tydzień</strong><div>{plan?.diagnostics?.reasons.slice(0, 6).map((reason) => <span key={reason}>{reason}</span>)}</div></div></section> : null}

        {proposals.length ? <section className="availability-plan-panel availability-proposal-inline availability-proposal-summary"><div><h3>Propozycje: {minutesLabel(proposals.reduce((sum, block) => sum + block.minutes, 0))}</h3></div><button type="button" className="button button-primary button-small" onClick={() => void acceptAll()}>Akceptuj wszystko</button></section> : null}
      </>}
    </section>
    </div>

    {accepted.length ? <div className="availability-copy-row"><button type="button" className="button button-secondary" onClick={() => void copySummary()}>Kopiuj dyspozycyjność</button><button type="button" className="button button-secondary" onClick={() => void markSent()}>Oznacz jako wysłane</button>{plan?.sentSnapshots.length ? <span>Wysłane wersje: {plan.sentSnapshots.length}</span> : null}</div> : null}

    {dayEditor ? <Modal title={dayEditor.mode === 'automation' ? `Automat - ${fullDateLabel(dayEditor.date)}` : `Dyspozycyjność - ${fullDateLabel(dayEditor.date)}`} onClose={() => setDayEditor(null)}><DayAvailabilityEditor date={dayEditor.date} mode={dayEditor.mode} {...(dayEditor.blockId ? { blockId: dayEditor.blockId } : {})} onSaved={savedFromDayEditor} onClose={() => setDayEditor(null)} /></Modal> : null}
  </section>;
}
