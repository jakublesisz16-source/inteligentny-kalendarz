# UX audit 0.3.7

## Zakres

Audit domyka serię 0.3.x bez dodawania nowej domeny danych. Sprawdzono źródła głównych widoków, ważne stany blokad, układ mobile, trwałość danych, PWA oraz regresję przez porównanie kluczowych modułów z 0.3.6.

## Zablokowane akcje i empty states

- Praca / Import PDF: wcześniej główny przycisk był po prostu nieaktywny przy braku `WorkProfile`. Teraz UI pokazuje powód i akcję `Ustaw profil pracy`; przy istniejącym profilu bez `employeeMatchName` pokazuje `Uzupełnij profil`. Po zapisaniu poprawnej nazwy `Importuj PDF` jest aktywny.
- Podsumowanie pracy: jego CTA importu korzysta z tej samej kontroli profilu, więc nie omija wymaganego kroku.
- Porównanie dyspozycyjności z grafikiem: CTA importu również przechodzi przez ten sam mechanizm readiness.
- Studia: pusty stan wyraźnie mówi, że nie ma jeszcze planu zajęć i prowadzi do `Importuj XLSX`.
- Dyspozycyjność: brak celu godzin i brak standardowych ram mają osobne komunikaty oraz CTA. Stan bez bezpiecznych godzin wyjaśnia, że hard constraints nie są łamane i pozwala rozwinąć najważniejsze ograniczenia.
- Zakupy, Podsumowanie pracy i Data Transfer zachowują istniejące czytelne empty/error states.

## Przenoszenie danych

Zgodnie z decyzją użytkownika `Przenoszenie danych` nie jest już schowane w zwijanym `Dane i bezpieczeństwo`. `DataTransferPanel` jest osobną, widoczną sekcją Ustawień. Centrum bezpieczeństwa obejmuje osobno trwałość lokalnej pamięci, historię, Kosz, punkty przywracania i zaawansowany backup.

Sam silnik transferu 0.3.6 nie został zmieniony: checksum, preview, replace import i restore point przed importem pozostają takie same.

## Mobile

Source-level audit obejmuje 320/390 px i reguły do 620/820 px:

- główna dolna nawigacja jest poziomo przewijalna i nie ściska siedmiu pozycji do bardzo wąskich kolumn,
- `Grafik / Dyspozycyjność / Podsumowanie` używa przewijalnego, jednowierszowego układu zamiast siatki 2+1,
- guidance importu pracy, trwałość danych i transfer przechodzą do jednej kolumny,
- istniejące reguły dla Calendar, Study Preview, Work Team, Work Summary, Shopping i Data Transfer pozostają aktywne.

Realny test wizualny w uruchomionej przeglądarce nie został wykonany w środowisku roboczym, ponieważ `npm install` jest blokowany przez registry i aplikacji nie można tu uruchomić przez Vite. Te punkty wymagają krótkiej kontroli na urządzeniu użytkownika.

## Trwałość danych

Dodano lekką warstwę `storage/persistence.ts`:

- `navigator.storage.persisted()` odczytuje status,
- `navigator.storage.persist()` jest wywoływane dopiero po świadomym kliknięciu `Wzmocnij ochronę`,
- brak API lub odmowa nie blokują działania aplikacji,
- nie powstaje nowy store ani wpis w IndexedDB.

Runtime helper test: 9/9 asercji PASS dla braku profilu pracy, odblokowania PDF oraz scenariuszy Persistent Storage: unsupported, standard, denied i granted.

## PWA

- `beforeinstallprompt` jest przechwytywany globalnie, ale CTA instalacji pojawia się tylko, gdy przeglądarka rzeczywiście udostępnia prompt,
- nie ma agresywnego bannera instalacji,
- iOS Safari dostaje tylko krótką instrukcję systemową,
- cache shell został oznaczony wersją 0.3.7,
- runtime cache omija `.pdf`, `.xls`, `.xlsx` i `.json`, aby nie cache'ować surowych dokumentów ani plików transferu.

Realnej instalacji PWA i realnego trybu offline nie oznaczono jako PASS bez uruchomionej przeglądarki.

## Regresja modułów

Byte-for-byte bez zmian względem 0.3.6 pozostały kluczowe pliki:

- `src/storage/database.ts`,
- `src/availability/optimizer.ts`,
- `src/availability/availability.service.ts`,
- parser PDF i adapter grafiku,
- `src/data-transfer/DataTransferPanel.tsx`,
- `src/shopping/ShoppingView.tsx`,
- `src/work/work-summary.ts`,
- Study Preview calendar i helpery.

Dzięki temu 0.3.7 nie zmienia algorytmu dyspozycyjności, parsera, modelu transferu, Shopping CRUD ani agregacji Podsumowania pracy.

## Kontrole techniczne

- source assertions UX: 16/16 PASS,
- pure runtime assertions: 9/9 PASS,
- TypeScript transpile wszystkich plików `.ts/.tsx` poza deklaracjami: PASS,
- strict `tsc` dla nowych czystych helperów: PASS,
- `npm install`: FAIL z powodu wewnętrznego registry - `@types/react@^19.1.10` E404,
- oficjalne `npm run typecheck/test/build/check`: niezaliczone z powodu braku zależności; `vitest` nie jest dostępny.

## Znane ograniczenia

- Persistent Storage API zależy od polityki konkretnej przeglądarki i nie gwarantuje ochrony przed ręcznym wyczyszczeniem danych lub awarią urządzenia.
- PWA install prompt zależy od platformy i spełnienia warunków instalowalności.
- Ostateczna kontrola 320/390 px wymaga uruchomienia aplikacji na realnym buildzie.
