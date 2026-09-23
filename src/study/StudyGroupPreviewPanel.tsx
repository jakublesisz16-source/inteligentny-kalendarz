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
import { StudyGroupChoiceFields } from './StudyGroupChoiceFields';
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
      setMessage('Plik używany tylko w tym podglądzie.');
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
    setMessage('');
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
      setMessage('Zapisano wybór podglądu.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nie udało się zapisać profilu podglądowego.');
    }
  }

  async function removeProfile(id: string) {
    await deleteStudyPreviewProfile(id);
    await refreshProfiles();
  }

  function togglePreviewPanel() {
    const nextOpen = !open;
    if (nextOpen && !selectedGroups.length && primaryGroups.length) setSelectedGroups([...primaryGroups]);
    setOpen(nextOpen);
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
    <section className="study-preview-sandbox">
      <div className="panel-heading preview-sandbox-heading">
        <div>
          <h2>Sprawdź plan innej grupy</h2>
        </div>
        <div className="preview-sandbox-actions">
          <button type="button" className="button button-secondary" onClick={togglePreviewPanel}>{open ? 'Zamknij' : 'Podgląd'}</button>
        </div>
      </div>

      {open ? (
        <div className="study-preview-sandbox-body study-preview-sandbox-body-v206">
          <div className="study-preview-picker-v206">
            <div className="study-preview-picker-heading-v206">
              <strong>Grupy</strong>
              {primaryGroups.length ? <span>Twoje: {formatStudyGroupList(primaryGroups)}</span> : null}
            </div>

            {availableGroups.length ? (
              <StudyGroupChoiceFields
                availableGroups={availableGroups}
                selectedGroups={selectedGroups}
                onChange={(groups) => { setSelectedGroups(groups); setPreview(null); setMessage(''); setError(''); }}
                ariaLabel="Grupy do podglądu"
              />
            ) : <p className="muted-copy">Ten plan nie rozróżnia grup.</p>}

            {!groupSelectionValidation.valid && availableGroups.length ? <div className="inline-validation warning compact"><strong>Uzupełnij wybór</strong><span>{groupSelectionValidation.errors.join(' ')}</span></div> : null}

            <div className="study-preview-picker-actions-v206">
              <div className="study-preview-source-v206">
                <span>Źródło</span>
                <strong title={localAnalysis ? localFileName : activeImport.fileName}>{localAnalysis ? localFileName : activeImport.fileName}</strong>
                <input ref={fileInputRef} className="visually-hidden" type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadPreviewSpreadsheet(file); }} />
                {localAnalysis ? <button type="button" className="text-button" onClick={clearLocalPreviewSource}>Aktywny plan</button> : null}
                <button type="button" className="text-button" disabled={loading} onClick={() => fileInputRef.current?.click()}>Inny Excel</button>
              </div>
              <button type="button" className="button button-primary study-preview-run-v206" disabled={!groupSelectionValidation.valid || loading} onClick={() => void runPreview()}>{loading ? 'Przygotowuję...' : 'Pokaż plan'}</button>
            </div>
          </div>

          {profiles.length ? (
            <details className="study-preview-compact-details-v206">
              <summary><span><strong>Zapisane wybory</strong><small>{profiles.length}</small></span><span className="study-details-action">Pokaż</span></summary>
              <div className="saved-preview-profile-list study-preview-saved-list-v206">
                {profiles.map((profile) => (
                  <div key={profile.id} className="saved-preview-profile">
                    <button type="button" className="preview-profile-main" onClick={() => { setSelectedGroups(profile.selectedGroups); void runPreview(profile.selectedGroups); }}>
                      <strong>{profile.name}</strong><span>{formatStudyGroupList(profile.selectedGroups)}</span>
                    </button>
                    <button type="button" className="text-button danger-text" onClick={() => void removeProfile(profile.id)}>Usuń</button>
                  </div>
                ))}
              </div>
            </details>
          ) : null}

          <details className="study-preview-compact-details-v206 study-preview-save-v206">
            <summary><span><strong>Zapisz ten wybór</strong></span><span className="study-details-action">Otwórz</span></summary>
            <div className="preview-profile-save-row study-preview-save-row-v206">
              <label className="field"><span>Nazwa</span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder={selectedGroups.length ? `Np. ${formatStudyGroupList(selectedGroups)}` : 'Np. Plan koleżanki'} /></label>
              <button type="button" className="button button-secondary" disabled={!groupSelectionValidation.valid} onClick={() => void saveProfile()}>Zapisz</button>
            </div>
          </details>

          {error ? <div className="study-message error-message" role="alert">{error}</div> : null}
          {message ? <div className="study-message success-message" role="status">{message}</div> : null}
          {preview?.requiresReupload && !localAnalysis ? <p className="muted-copy">Wybierz „Inny Excel”, aby sprawdzić tę grupę na innym pliku.</p> : null}

          {preview && !preview.requiresReupload ? (
            <div className="read-only-preview-results study-preview-results-v206">
              <div className="study-preview-result-heading-v206">
                <strong>{formatStudyGroupList(preview.selectedGroups) || 'Wspólne / bez grup'}</strong>
                <span>{preview.candidates.length} {preview.candidates.length === 1 ? 'wpis' : 'wpisów'} · tylko podgląd</span>
              </div>
              <div className="preview-view-toolbar study-preview-view-toolbar-v206">
                <div className="preview-view-switch" role="group" aria-label="Sposób wyświetlania planu innej grupy">
                  <button type="button" className={viewMode === 'CALENDAR' ? 'filter-button active' : 'filter-button'} aria-pressed={viewMode === 'CALENDAR'} onClick={() => setViewMode('CALENDAR')}>Kalendarz</button>
                  <button type="button" className={viewMode === 'LIST' ? 'filter-button active' : 'filter-button'} aria-pressed={viewMode === 'LIST'} onClick={() => setViewMode('LIST')}>Lista</button>
                </div>
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
