# Project File Inventory — Build246

Celem inwentarza jest utrzymanie małego, zrozumiałego Source of Truth i uniknięcie powrotu starych ekranów, backupów lub przypadkowych artefaktów.

## Root

| Plik/katalog | Rola |
| --- | --- |
| `src/` | kod produktu, domeny i testy |
| `public/` | PWA, ikony oraz aktywne lokalne zasoby OCR potrzebne offline |
| `scripts/` | tylko aktywne gate'y, release, QA i benchmark runners |
| `docs/` | kanoniczna dokumentacja produktu/QA/decyzji |
| `project-skills/` | prywatne instrukcje kontynuacji projektu; PRIVATE only |
| `.github/workflows/` | CI i GitHub Pages |
| `CURRENT_STATE.json` | maszynowy bieżący stan/checklisty |
| `BUILD_INFO.json` | metadane aktualnego PRIVATE builda |
| `CURRENT_PROJECT_RULES.md` | trwały kontrakt pracy |
| `HANDOFF_NEW_CHAT.md` | bieżący handoff do kolejnej rozmowy |
| `PRIVATE.md` | skrócony opis recovery checkpointu |
| `CHECKPOINT_MANIFEST.sha256` | integralność pełnego PRIVATE |

## Aktywne domeny `src/`

- `app` — shell/nawigacja i recovery SW,
- `calendar`, `events` — kalendarz i edycja wydarzeń,
- `study`, `imports/xlsx` — plan Studiów, diff, parser XLS/XLSX i verified source,
- `work`, `imports/pdf` — grafik i import PDF,
- `finance`, `shopping` — obecny dashboard finansowy, modele wydatków i Receipt Scanner/OCR,
- `availability`, `planning`, `notifications` — planowanie/dyspozycyjność,
- `storage`, `data-transfer`, `safety`, `settings`, `pwa` — persistence, backup, bezpieczeństwo i PWA,
- `cycle` — zachowana domena danych/predykcji; stary player-facing ekran został usunięty,
- `locations` — modele/Google Maps używane przez aktywną aplikację; stary osobny ekran został usunięty,
- `ui`, `styles` — wspólne komponenty i design system,
- `benchmarks` — jawne rooty narzędziowe Receipt,
- `tests` — aktywne regresje publiczne/prywatne zgodnie z konfiguracją Vitest.

## Build246 — usunięte jako superseded/nieosiągalne

- `src/shopping/ShoppingView.tsx`
- `src/shopping/ExpensesView.tsx`
- `src/cycle/CycleView.tsx`
- `src/cycle/CycleJournalEditor.tsx`
- `src/cycle/CyclePeriodEditor.tsx`
- `src/locations/LocationsView.tsx`
- `src/ui/AppBackgroundDecor.tsx`
- `src/ui/FloralAccent.tsx`
- `src/tests/expenses-ui.test.ts`

Testy odnoszące się do dawnych ekranów zostały przeniesione na aktualne kontrakty albo ograniczone do sprawdzenia, że superseded shell nie wrócił.

## Świadomie zachowane poza runtime graphem

Exact allowlista `source:hygiene`:

1. `src/app/devServiceWorkerRecovery.ts` — direct script z `index.html`,
2. `src/cycle/cycle-ovulation.ts` — logika domenowa/regresje,
3. `src/cycle/cycle-patterns.ts` — logika domenowa/regresje,
4. `src/notifications/notification-planner.ts` — logika domenowa/regresje,
5. `src/vite-env.d.ts` — ambient declarations.

Zmiana tej listy wymaga świadomej decyzji: gdy moduł stanie się runtime lub zostanie usunięty, gate ma wymusić aktualizację allowlisty.

## Czego PRIVATE nie zawiera

- `.git`, `node_modules`, `dist`, coverage i cache,
- zagnieżdżonych ZIP/7z/RAR,
- XLS/XLSX/PDF użytkownika,
- screenshotów/filmów/logów PowerShell,
- backupów `.bak/.old/.orig`, plików `.tmp/.rej/.log/.tsbuildinfo`,
- `_PRIVATE_HISTORY`, `_LOCAL_ONLY` i prywatnych fixture'ów Receipt.

Exact źródła uczelni/pracy pozostają poza recovery. Checkpoint przechowuje ich zweryfikowane metadane/hash i dokumentację, nie pliki.

## Czego PUBLIC dodatkowo nie zawiera

- `PRIVATE.md`, `HANDOFF_NEW_CHAT.md`, `CURRENT_PROJECT_RULES.md`, `CURRENT_STATE.json`, `BUILD_INFO.json`, `CHECKPOINT_MANIFEST.sha256`,
- `project-skills/`,
- jakichkolwiek prywatnych mediów lub źródeł użytkownika.

Wspólne pliki PRIVATE/PUBLIC muszą pozostać bitowo identyczne.

## Zasada kolejnych cleanupów

Nie usuwamy pliku tylko dlatego, że nie jest importowany przez `src/main.tsx`. Najpierw ustalamy, czy jest rootem narzędziowym, direct-loaded assetem, warstwą kompatybilności, modelem danych albo unikalną logiką domenową. Usuwamy dopiero wtedy, gdy jest superseded i nie niesie potrzebnej semantyki. Każde takie usunięcie wpisujemy do `PROJECT_LEDGER.md` i tego inwentarza.

## Build247 hygiene ownership clarification

`scripts/source-hygiene-gate.mjs` jest gate'em grafu źródeł i repozytoryjnej higieny kodu. Ignoruje normalne workspace/generated paths (`.git`, `node_modules`, `dist`, coverage/cache, root `tsconfig.*.tsbuildinfo`). Ich nieobecność w PRIVATE/PUBLIC ZIP-ach egzekwują `checkpoint:hygiene`, `checkpoint:gate` i public package/release gates.
