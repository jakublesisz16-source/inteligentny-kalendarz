# Powiadomienia 0.5.0 - deployment

Ten dokument opisuje wdrożenie technicznej warstwy Web Push. Dane Kalendarza, Studiów, Pracy i Cyklu pozostają w IndexedDB urządzenia. Worker przechowuje tylko anonimową subskrypcję Push i terminy obudzenia.

## 1. Wymagania

- Node.js i npm.
- Konto Cloudflare.
- Frontend wdrożony po HTTPS, np. GitHub Pages.
- Worker, D1 i Cron Trigger.
- Para kluczy VAPID.

## 2. Instalacja i lokalne kontrole

```powershell
npm install
npm run check
```

Po pierwszym poprawnym `npm install` zachowaj wygenerowany `package-lock.json`.

## 3. Utworzenie D1

```powershell
npx wrangler login
npx wrangler d1 create inteligentny-kalendarz-push
```

Wstaw zwrócone `database_id` do `wrangler.jsonc` zamiast wartości `00000000-0000-0000-0000-000000000000`.

Migracja lokalna:

```powershell
npm run worker:migrate:local
```

Migracja produkcyjna:

```powershell
npm run worker:migrate:remote
```

## 4. VAPID

Wygeneruj jedną parę kluczy VAPID dla tej instalacji backendu:

```powershell
npx web-push generate-vapid-keys
```

Nie zapisuj prywatnego klucza w repozytorium ani ZIP-ie.

Ustaw sekrety Workera:

```powershell
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
```

`VAPID_SUBJECT` powinien być prawidłowym `mailto:` lub adresem HTTPS administratora.

## 5. Origin frontendu

`ALLOWED_ORIGINS` w produkcji musi zawierać dokładny origin PWA, np.:

```text
https://<uzytkownik>.github.io
```

Dla własnej domeny dodaj ją świadomie. Nie używaj `*`.

## 6. Worker

Lokalnie:

```powershell
npm run worker:dev
```

Testy:

```powershell
npm run worker:typecheck
npm run worker:test
```

Deployment:

```powershell
npm run worker:deploy
```

Po wdrożeniu zapisz URL Workera.

## 7. Frontend

W środowisku builda ustaw publiczną zmienną:

```text
VITE_PUSH_WORKER_URL=https://<worker>.workers.dev
```

To nie jest sekret. Następnie wykonaj produkcyjny build i wdrożenie frontendu.

## 8. Pierwsza aktywacja

Na docelowym urządzeniu:

1. Otwórz wdrożoną PWA po HTTPS.
2. Na iOS/iPadOS dodaj aplikację do ekranu początkowego przed próbą aktywacji Web Push.
3. Wejdź w `Ustawienia -> Powiadomienia`.
4. Kliknij świadomie `Włącz powiadomienia`.
5. Zaakceptuj systemową zgodę.
6. Poczekaj na status `Włączone`.
7. Użyj `Wyślij testowe powiadomienie`.

## 9. Krytyczny test master switcha

Po udanym teście:

1. Kliknij `Wyłącz wszystkie`.
2. Potwierdź status `Wyłączone`.
3. Spróbuj wywołać opóźniony/generic Push z istniejącego harmonogramu, jeśli środowisko testowe na to pozwala.
4. Service Worker nie może pokazać powiadomienia, nawet jeżeli zdalne czyszczenie nie zdążyło się wykonać.

## 10. Co trafia do D1

Tylko dane techniczne:

- losowy `installation_id`,
- hash losowego tokenu instalacji,
- endpoint i klucze subskrypcji Web Push wymagane przez protokół,
- losowy `schedule_id`,
- `trigger_at_utc`,
- techniczne timestamps/licznik prób.

Nie trafiają:

- tytuły wydarzeń,
- lokalizacje,
- Studia,
- Praca,
- Cykl,
- notatki,
- zakupy,
- treść powiadomień.

## 11. Realne testy wymagane przed production-ready

Oznaczaj jako PASS tylko rzeczywiście wykonane:

- Windows + Chrome/Edge - PWA zamknięta, Push dociera,
- Android - PWA w tle/zamknięta, Push dociera,
- iOS/iPadOS - PWA z Home Screen, Push dociera,
- tryb Dyskretny nie ujawnia prywatnych treści,
- master OFF blokuje powiadomienia lokalnie,
- zmiana wydarzenia usuwa stary reminder,
- zmiana prognozy Cyklu usuwa stary reminder,
- aplikacja nadal otwiera się offline,
- migracja schema 10 -> 11 nie zmienia istniejących danych użytkownika.

## 12. Ograniczenia

- Web Push nie gwarantuje idealnej punktualności systemu operacyjnego.
- Harmonogram jest synchronizowany w ograniczonym horyzoncie, domyślnie 90 dni.
- Bez okresowego otwierania aplikacji nie należy obiecywać reminderów poza wcześniej zsynchronizowanym horyzontem.
- Brak internetu może chwilowo dać status `Problem z synchronizacją`; lokalny kill switch nadal działa natychmiast.
