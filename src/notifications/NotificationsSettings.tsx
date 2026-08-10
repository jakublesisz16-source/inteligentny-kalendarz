import { useEffect, useState, type ReactNode } from 'react';
import type { AppSettings, AppSettingsPatch } from '../settings/settings.types';
import { rebuildAndSyncNotifications } from './notification-storage';
import {
  detectPushSupport,
  disablePushNotifications,
  enablePushNotifications,
  getNotificationSystemStatus,
  notificationWorkerConfigured,
  retryPendingNotificationCleanup,
  sendTestPush,
} from './push-client';
import type { NotificationPreferences, NotificationSystemStatus } from './notification.types';

interface Props {
  settings: AppSettings;
  onChange: (patch: AppSettingsPatch) => Promise<void>;
}

const BEFORE_OPTIONS = [15, 30, 60, 120] as const;
const CYCLE_DAY_OPTIONS = [1, 2, 3, 5, 7] as const;
const BACKUP_DAY_OPTIONS = [14, 30, 60] as const;

function statusLabel(status: NotificationSystemStatus): string {
  if (status === 'ENABLED') return 'Włączone';
  if (status === 'UNSUPPORTED') return 'Niedostępne';
  if (status === 'DENIED') return 'Zablokowane przez system';
  if (status === 'DEGRADED') return 'Problem z synchronizacją';
  return 'Wyłączone';
}

export function NotificationsSettings({ settings, onChange }: Props) {
  const [status, setStatus] = useState<NotificationSystemStatus>('DISABLED');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const preferences = settings.notificationPreferences;

  useEffect(() => {
    void (async () => {
      await retryPendingNotificationCleanup();
      setStatus(await getNotificationSystemStatus());
    })();
  }, []);

  async function refreshStatus() {
    setStatus(await getNotificationSystemStatus());
  }

  async function changePreferences(next: NotificationPreferences) {
    await onChange({ notificationPreferences: next });
    await refreshStatus();
  }

  async function toggleMaster() {
    setBusy(true); setError(''); setMessage('');
    try {
      if (status === 'ENABLED' || status === 'DEGRADED') {
        await disablePushNotifications();
        setMessage('Wszystkie powiadomienia zostały wyłączone na tym urządzeniu. Szczegółowe ustawienia zachowano.');
      } else {
        await enablePushNotifications();
        const result = await rebuildAndSyncNotifications();
        setMessage(result.sync === 'READY' ? 'Powiadomienia zostały włączone.' : 'Powiadomienia są włączone lokalnie, ale synchronizacja z serwerem wymaga ponowienia.');
      }
      await refreshStatus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zmienić ustawienia powiadomień.');
      await refreshStatus();
    } finally {
      setBusy(false);
    }
  }

  async function testPush() {
    setBusy(true); setError(''); setMessage('');
    try {
      await sendTestPush();
      setMessage('Wysłano test pełną ścieżką Web Push. Powiadomienie powinno pojawić się na tym urządzeniu.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się wysłać testowego powiadomienia.');
    } finally { setBusy(false); }
  }

  const globallyActive = status === 'ENABLED' || status === 'DEGRADED';
  const support = detectPushSupport();
  const configured = notificationWorkerConfigured();

  return (
    <section className="panel settings-notifications-card" aria-labelledby="notifications-settings-title">
      <div className="notifications-master-row">
        <div>
          <p className="section-kicker">Powiadomienia</p>
          <h2 id="notifications-settings-title">Przypomnienia na tym urządzeniu</h2>
          <p className="panel-copy">System może przypominać o wydarzeniach także wtedy, gdy zainstalowana aplikacja nie jest otwarta. Treść pozostaje lokalna - serwer zna tylko anonimowy termin obudzenia urządzenia.</p>
        </div>
        <div className="notifications-master-control">
          <span className={`notification-status ${status.toLowerCase()}`}>{statusLabel(status)}</span>
          <button type="button" className={globallyActive ? 'button button-danger-ghost' : 'button button-primary'} disabled={busy || (!support.supported && !globallyActive) || (!configured && !globallyActive)} onClick={() => void toggleMaster()} aria-label={globallyActive ? 'Wyłącz wszystkie powiadomienia' : 'Włącz powiadomienia'}>
            {globallyActive ? 'Wyłącz wszystkie' : 'Włącz powiadomienia'}
          </button>
        </div>
      </div>

      {!configured ? <div className="study-message">Serwer Web Push nie jest jeszcze skonfigurowany dla tego builda. Pozostałe ustawienia możesz przygotować teraz, a aktywacja będzie możliwa po wdrożeniu.</div> : null}
      {!support.supported ? <div className="study-message">{support.reason === 'IOS_REQUIRES_HOME_SCREEN' ? 'Aby korzystać z powiadomień na iPhonie/iPadzie, dodaj Inteligentny Kalendarz do ekranu początkowego i uruchom go z ikony.' : 'Powiadomienia nie są dostępne na tym urządzeniu lub w tym kontekście przeglądarki.'}</div> : null}
      {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
      {message ? <div className="study-message success-message" role="status">{message}</div> : null}

      <fieldset className="notification-settings-fieldset" disabled={busy}>
        <legend>Treść i pora</legend>
        <div className="notification-settings-grid">
          <label className="field"><span>Treść na ekranie blokady</span><select value={preferences.contentMode} onChange={(event) => void changePreferences({ ...preferences, contentMode: event.target.value as NotificationPreferences['contentMode'] })}><option value="DISCREET">Dyskretna - bez prywatnych szczegółów</option><option value="FULL">Pełna - pokaż lokalne szczegóły</option></select></label>
          <label className="field"><span>Godzina przypomnień dziennych</span><input type="time" value={preferences.dailyReminderTime} onChange={(event) => void changePreferences({ ...preferences, dailyReminderTime: event.target.value || '19:00' })} /></label>
        </div>
      </fieldset>

      <div className={globallyActive ? 'notification-category-list' : 'notification-category-list globally-disabled'} aria-disabled={!globallyActive}>
        <CategorySettings title="Kalendarz" description="Ręczne wydarzenia osobiste i pozostałe." enabled={preferences.calendar.enabled} onEnabled={(enabled) => void changePreferences({ ...preferences, calendar: { ...preferences.calendar, enabled } })}>
          <BeforeSelect value={preferences.calendar.beforeMinutes} onChange={(beforeMinutes) => void changePreferences({ ...preferences, calendar: { ...preferences.calendar, beforeMinutes } })} />
          <Toggle label="Przypomnij dzień wcześniej" checked={preferences.calendar.dayBefore} onChange={(dayBefore) => void changePreferences({ ...preferences, calendar: { ...preferences.calendar, dayBefore } })} />
        </CategorySettings>

        <CategorySettings title="Studia" description="Tylko aktywny główny plan - nigdy Study Preview." enabled={preferences.study.enabled} onEnabled={(enabled) => void changePreferences({ ...preferences, study: { ...preferences.study, enabled } })}>
          <BeforeSelect value={preferences.study.beforeMinutes} onChange={(beforeMinutes) => void changePreferences({ ...preferences, study: { ...preferences.study, beforeMinutes } })} />
          <Toggle label="Przypomnij dzień wcześniej" checked={preferences.study.dayBefore} onChange={(dayBefore) => void changePreferences({ ...preferences, study: { ...preferences.study, dayBefore } })} />
        </CategorySettings>

        <CategorySettings title="Praca" description="Rzeczywiste wpisy i zaimportowany grafik pracy - nie Dyspozycyjność." enabled={preferences.work.enabled} onEnabled={(enabled) => void changePreferences({ ...preferences, work: { ...preferences.work, enabled } })}>
          <BeforeSelect value={preferences.work.beforeMinutes} onChange={(beforeMinutes) => void changePreferences({ ...preferences, work: { ...preferences.work, beforeMinutes } })} />
          <Toggle label="Przypomnij dzień wcześniej" checked={preferences.work.dayBefore} onChange={(dayBefore) => void changePreferences({ ...preferences, work: { ...preferences.work, dayBefore } })} />
        </CategorySettings>

        <CategorySettings title="Cykl" description="Tylko przy statusie READY. Powiadomienie mówi o przewidywanym oknie, nie o pewnej dacie." enabled={preferences.cycle.enabled} onEnabled={(enabled) => void changePreferences({ ...preferences, cycle: { ...preferences.cycle, enabled } })}>
          <label className="field"><span>Przed początkiem głównego okna</span><select value={preferences.cycle.daysBeforeWindow} onChange={(event) => void changePreferences({ ...preferences, cycle: { ...preferences.cycle, daysBeforeWindow: Number(event.target.value) as NotificationPreferences['cycle']['daysBeforeWindow'] } })}>{CYCLE_DAY_OPTIONS.map((value) => <option key={value} value={value}>{value} {value === 1 ? 'dzień' : 'dni'}</option>)}</select></label>
          <Toggle label="Przypomnij w dniu początku przewidywanego okna" checked={preferences.cycle.onWindowStart} onChange={(onWindowStart) => void changePreferences({ ...preferences, cycle: { ...preferences.cycle, onWindowStart } })} />
        </CategorySettings>

        <CategorySettings title="Kopia danych" description="Spokojne przypomnienie o lokalnym eksporcie danych." enabled={preferences.backup.enabled} onEnabled={(enabled) => void changePreferences({ ...preferences, backup: { ...preferences.backup, enabled } })}>
          <label className="field"><span>Przypomnij po</span><select value={preferences.backup.afterDays} onChange={(event) => void changePreferences({ ...preferences, backup: { ...preferences.backup, afterDays: Number(event.target.value) as NotificationPreferences['backup']['afterDays'] } })}>{BACKUP_DAY_OPTIONS.map((value) => <option key={value} value={value}>{value} dni</option>)}</select></label>
        </CategorySettings>
      </div>

      {globallyActive ? <div className="notification-test-row"><button type="button" className="button button-secondary" disabled={busy || status !== 'ENABLED'} onClick={() => void testPush()}>Wyślij testowe powiadomienie</button><small>Test przechodzi przez Worker, usługę Web Push i Service Worker urządzenia.</small></div> : null}
    </section>
  );
}

function BeforeSelect({ value, onChange }: { value: 15 | 30 | 60 | 120; onChange: (value: 15 | 30 | 60 | 120) => void }) {
  return <label className="field"><span>Przed wydarzeniem</span><select value={value} onChange={(event) => onChange(Number(event.target.value) as 15 | 30 | 60 | 120)}>{BEFORE_OPTIONS.map((option) => <option key={option} value={option}>{option} min</option>)}</select></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="notification-toggle"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function CategorySettings({ title, description, enabled, onEnabled, children }: { title: string; description: string; enabled: boolean; onEnabled: (value: boolean) => void; children: ReactNode }) {
  return <section className="notification-category-card"><div className="notification-category-heading"><div><h3>{title}</h3><p>{description}</p></div><label className="notification-toggle category-master"><input type="checkbox" checked={enabled} onChange={(event) => onEnabled(event.target.checked)} /><span>{enabled ? 'Włączone' : 'Wyłączone'}</span></label></div><div className={enabled ? 'notification-category-options' : 'notification-category-options disabled'} aria-disabled={!enabled}>{children}</div></section>;
}
