import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeScheduleWorkbook } from '../imports/xlsx/adapter-registry';
import { readSpreadsheetFile } from '../imports/xlsx/spreadsheet-reader';
import { formatStudyGroupList } from '../imports/xlsx/group-normalizer';
import {
  buildStudyGroupPreview,
  deleteStudyPreviewProfile,
  listStudyPreviewProfiles,
  saveStudyPreviewProfile,
} from '../storage/database';
import { reviewCandidate } from './import-review';
import { identifyCandidate } from './study-identity';
import { StudyPreviewCalendar } from './StudyPreviewCalendar';
import { StudyGroupSelector } from './StudyGroupSelector';
import { candidatesForSelectedGroups, validateStudyGroupSelection } from './study.service';
import type { ScheduleAnalysis, StudyGroupPreview, StudyPreviewProfile, StudyScheduleCandidate, UniversityScheduleImport } from './study.types';

interface StudyGroupPreviewPanelProps {
  activeImport: UniversityScheduleImport;
  primaryGroups: string[];
}

function dateLabel(value: string | undefined): string {
  if (!value) return 'Bez pewnej daty';
  return new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function candidateTime(candidate: StudyScheduleCandidate): string {
  return candidate.startTime && candidate.endTime ? `${candidate.startTime}-${candidate.endTime}` : 'Brak pewnych godzin';
}

export function StudyGroupPreviewPanel({ activeImport, primaryGroups }: StudyGroupPreviewPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'CALENDAR' | 'LIST'>('CALENDAR');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<StudyPreviewProfile[]>([]);
  const [profileName, setProfileName] = useState('');
  const [preview, setPreview] = useState<StudyGroupPreview | null>(null);
  const [localAnalysis, setLocalAnalysis] = useState<ScheduleAnalysis | null>(null);
  const [localFileName, setLocalFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { void refreshProfiles(); }, []);

  async function refreshProfiles() {
    setProfiles(await listStudyPreviewProfiles());
  }

  function toggleGroup(group: string) {
    setSelectedGroups((current) => current.includes(group) ? current.filter((item) => item !== group) : [...current, group]);
    setPreview(null);
    setMessage('');
    setError('');
  }

  async function runPreview(groups = selectedGroups) {
    const sourceGroups = localAnalysis?.groups ?? activeImport.availableGroups ?? activeImport.selectedGroups;
    const groupValidation = validateStudyGroupSelection(sourceGroups, groups);
    if (!groupValidation.valid) {
      setError(groupValidation.errors.join(' '));
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (localAnalysis) {
        const candidates = candidatesForSelectedGroups(localAnalysis, groups).map(identifyCandidate);
        setPreview({
          activeImportId: activeImport.id,
          sourceFileName: localFileName || 'Plik Excel wskazany tylko do podglądu',
          selectedGroups: [...groups],
          availableGroups: [...localAnalysis.groups],
          candidates,
          sourceDataComplete: true,
          requiresReupload: false,
        });
      } else {
        const result = await buildStudyGroupPreview(groups);
        setPreview(result);
        if (result.requiresReupload) setError(result.reason ?? 'Do podglądu potrzebny jest ponowny wybór pliku Excel.');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się przygotować podglądu grup.');
    } finally {
      setLoading(false);
    }
  }


  async function loadPreviewSpreadsheet(file: File) {
    if (!/\.xlsx?$/i.test(file.name)) {
      setError('Wybierz plik programu Excel w formacie .xlsx albo .xls.');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    setPreview(null);
    try {
      const workbook = await readSpreadsheetFile(file);
      const result = analyzeScheduleWorkbook(workbook);
      if (!result) throw new Error('Nie rozpoznano formatu planu. Plik nie został zapisany ani użyty do zmiany kalendarza.');
      setLocalAnalysis(result);
      setLocalFileName(file.name);
      setSelectedGroups((current) => current.filter((group) => result.groups.includes(group)));
      setMessage('Plik Excel wczytano wyłącznie do tego podglądu. Aktywny plan i kalendarz pozostają bez zmian.');
    } catch (cause) {
      setLocalAnalysis(null);
      setLocalFileName('');
      setError(cause instanceof Error ? cause.message : 'Nie udało się przeanalizować pliku Excel.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function clearLocalPreviewSource() {
    setLocalAnalysis(null);
    setLocalFileName('');
    setPreview(null);
    setSelectedGroups([]);
    setMessage('Wrócono do danych źródłowych aktywnego planu.');
    setError('');
  }

  async function saveProfile() {
    const sourceGroups = localAnalysis?.groups ?? activeImport.availableGroups ?? activeImport.selectedGroups;
    const groupValidation = validateStudyGroupSelection(sourceGroups, selectedGroups);
    if (!groupValidation.valid) {
      setError(groupValidation.errors.join(' '));
      return;
    }
    try {
      await saveStudyPreviewProfile(profileName, selectedGroups);
      setProfileName('');
      await refreshProfiles();
      setMessage('Profil podglądowy zapisano. Nie zmieniono Twojego aktywnego planu ani wydarzeń.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać profilu podglądowego.');
    }
  }

  async function removeProfile(id: string) {
    await deleteStudyPreviewProfile(id);
    await refreshProfiles();
  }

  const grouped = useMemo(() => {
    const map = new Map<string, StudyScheduleCandidate[]>();
    for (const candidate of preview?.candidates ?? []) {
      const key = candidate.date ?? 'unknown';
      const list = map.get(key) ?? [];
      list.push(candidate);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, candidates]) => ({
      date,
      candidates: candidates.sort((a, b) => `${a.startTime ?? ''}${a.subject}`.localeCompare(`${b.startTime ?? ''}${b.subject}`, 'pl')),
    }));
  }, [preview]);

  const availableGroups = localAnalysis?.groups ?? activeImport.availableGroups ?? activeImport.selectedGroups;
  const groupSelectionValidation = useMemo(() => validateStudyGroupSelection(availableGroups, selectedGroups), [availableGroups, selectedGroups]);

  return (
    <section className="panel study-preview-sandbox">
      <div className="panel-heading preview-sandbox-heading">
        <div>
          <p className="section-kicker">Bezpieczny podgląd</p>
          <h2>Sprawdź plan innej grupy</h2>
          <p className="panel-copy">To oddzielny, tylko do odczytu podgląd. Nie zmienia Twoich grup, aktywnego importu, wydarzeń, diffu ani ręcznych poprawek.</p>
        </div>
        <div className="preview-sandbox-actions">
          <span className="read-only-pill">TYLKO PODGLĄD</span>
          <button type="button" className="button button-secondary" onClick={() => setOpen((value) => !value)}>{open ? 'Zamknij podgląd' : 'Otwórz podgląd'}</button>
        </div>
      </div>

      {open ? (
        <div className="study-preview-sandbox-body">
          <div className="primary-group-note">Twój aktywny plan pozostaje bez zmian: <strong>{formatStudyGroupList(primaryGroups) || 'brak zapisanych grup'}</strong>.</div>

          <div className="preview-source-box">
            <div>
              <strong>Źródło podglądu</strong>
              <span>{localAnalysis ? `${localFileName} - tylko w pamięci tego podglądu` : `${activeImport.fileName} - zapisane dane aktywnego importu`}</span>
            </div>
            <div className="safety-item-actions">
              <input ref={fileInputRef} className="visually-hidden" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadPreviewSpreadsheet(file); }} />
              <button type="button" className="button button-secondary button-small" disabled={loading} onClick={() => fileInputRef.current?.click()}>Wskaż Excel tylko do podglądu</button>
              {localAnalysis ? <button type="button" className="text-button" onClick={clearLocalPreviewSource}>Użyj aktywnego planu</button> : null}
            </div>
          </div>

          {profiles.length ? (
            <div className="saved-preview-profiles">
              <strong>Zapisane profile podglądowe</strong>
              <div className="saved-preview-profile-list">
                {profiles.map((profile) => (
                  <div key={profile.id} className="saved-preview-profile">
                    <button type="button" className="preview-profile-main" onClick={() => { setSelectedGroups(profile.selectedGroups); void runPreview(profile.selectedGroups); }}>
                      <strong>{profile.name}</strong><span>{formatStudyGroupList(profile.selectedGroups)}</span>
                    </button>
                    <button type="button" className="text-button danger-text" onClick={() => void removeProfile(profile.id)}>Usuń</button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <div className="settings-groups-heading"><strong>{availableGroups.length ? 'Grupy do sprawdzenia' : 'Zakres podglądu'}</strong>{availableGroups.length ? <span>{selectedGroups.length} wybranych</span> : null}</div>
            {availableGroups.length ? <StudyGroupSelector groups={availableGroups} selectedGroups={selectedGroups} onToggle={toggleGroup} compact /> : <p className="muted-copy">Ten plan nie rozróżnia grup. Podgląd pokaże wpisy wspólne dla wszystkich.</p>}
            {!groupSelectionValidation.valid ? <div className="study-information warning-info"><strong>Niepełny wybór grup.</strong> {groupSelectionValidation.errors.join(' ')}</div> : null}
          </div>

          <div className="preview-profile-save-row">
            <label className="field"><span>Nazwa profilu podglądowego <em>opcjonalnie</em></span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder={selectedGroups.length ? `Np. ${formatStudyGroupList(selectedGroups)}` : 'Np. Plan koleżanki'} /></label>
            <button type="button" className="button button-secondary" disabled={!groupSelectionValidation.valid} onClick={() => void saveProfile()}>Zapisz profil</button>
            <button type="button" className="button button-primary" disabled={!groupSelectionValidation.valid || loading} onClick={() => void runPreview()}>{loading ? 'Przygotowuję...' : 'Pokaż plan'}</button>
          </div>

          {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
          {message ? <div className="study-message success-message" role="status">{message}</div> : null}
          {preview?.requiresReupload && !localAnalysis ? <p className="muted-copy">Możesz użyć przycisku „Wskaż Excel tylko do podglądu”. Plik zostanie przeanalizowany lokalnie i nie zostanie zapisany jako aktywny import.</p> : null}

          {preview && !preview.requiresReupload ? (
            <div className="read-only-preview-results">
              <div className="preview-results-meta" aria-label="Podsumowanie podglądu">
                <span>Grupy: <strong>{formatStudyGroupList(preview.selectedGroups) || 'Wspólne / bez grup'}</strong></span>
                <span>{preview.candidates.length} {preview.candidates.length === 1 ? 'wpis' : 'wpisów'}</span>
                <span className="preview-results-source">Źródło: {preview.sourceFileName}</span>
              </div>
              <div className="read-only-notice"><strong>Nic stąd nie trafia do głównego kalendarza.</strong> To wyłącznie szybki podgląd planu wybranej grupy.</div>
              <div className="preview-view-toolbar">
                <div className="preview-view-switch" role="group" aria-label="Sposób wyświetlania planu innej grupy">
                  <button type="button" className={viewMode === 'CALENDAR' ? 'filter-button active' : 'filter-button'} aria-pressed={viewMode === 'CALENDAR'} onClick={() => setViewMode('CALENDAR')}>Kalendarz</button>
                  <button type="button" className={viewMode === 'LIST' ? 'filter-button active' : 'filter-button'} aria-pressed={viewMode === 'LIST'} onClick={() => setViewMode('LIST')}>Lista</button>
                </div>
                <span className="preview-view-context">Grupy: <strong>{formatStudyGroupList(preview.selectedGroups) || 'Wspólne / bez grup'}</strong></span>
              </div>
              {viewMode === 'CALENDAR' ? <StudyPreviewCalendar candidates={preview.candidates} /> : (
                <div className="preview-agenda">
                  {grouped.map(({ date, candidates }) => (
                    <section key={date} className="preview-agenda-day">
                      <h3>{dateLabel(date === 'unknown' ? undefined : date)}</h3>
                      <div className="preview-agenda-events">
                        {candidates.map((candidate) => {
                          const review = reviewCandidate(candidate);
                          return (
                            <article key={candidate.id} className="preview-agenda-event">
                              <div className="preview-agenda-time">{candidateTime(candidate)}</div>
                              <div>
                                <strong>{candidate.subject || 'Nieustalony przedmiot'}</strong>
                                <span>{[candidate.activityType, candidate.groupTags.length ? `Grupy: ${formatStudyGroupList(candidate.groupTags)}` : '', candidate.clinic, candidate.room, candidate.address ?? candidate.locationLabel].filter(Boolean).join(' - ')}</span>
                              </div>
                              <span className={`status-pill ${review.state.toLowerCase()}`}>{review.state === 'READY' ? 'GOTOWE' : review.state === 'WARNING' ? 'DO SPRAWDZENIA' : review.state === 'INCOMPLETE' ? 'NIEPEŁNE' : 'WYMAGA POPRAWY'}</span>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
