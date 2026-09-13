# Prywatność

Inteligentny Kalendarz jest aplikacją local-first. Nie ma własnego backendu synchronizującego dane użytkownika i nie wymaga konta.

## Dane lokalne

W IndexedDB mogą znajdować się m.in. wydarzenia, plan studiów, grafik pracy, ustawienia, finanse, wyjazdy, dane potrzebne do backupu/restore oraz inne dane wprowadzone przez użytkownika.

## Importy dokumentów

- XLS/XLSX planu studiów są analizowane lokalnie.
- PDF grafiku pracy jest analizowany lokalnie.
- zdjęcia i PDF paragonów są przetwarzane lokalnym Tesseract.js/PDF.js.

Surowe dokumenty nie są wysyłane do własnego backendu aplikacji.

## Finanse i waluty

Kursy walut używane w ręcznych wydatkach zagranicznych są orientacyjnym snapshotem zapisanym lokalnie w kodzie aplikacji. Moduł kursów nie wykonuje requestów do zewnętrznego API. Kwota, opis, kategoria, miejsce i nazwa wyjazdu pozostają lokalnie.

## Google Maps

Funkcja `Trasa` tworzy adres Google Maps dopiero po świadomym kliknięciu użytkownika. W takim przypadku przeglądarka otwiera zewnętrzną usługę mapową z wybranym celem podróży.

## Backup i transfer

Eksportowany JSON może zawierać prywatne dane całej aplikacji. Plik nie jest szyfrowany i należy traktować go jak prywatny dokument. Import/restore odbywa się lokalnie.

## PWA i cache

Service Worker służy do offline shell i lokalnych zasobów aplikacji. Pliki użytkownika `.pdf`, `.xls`, `.xlsx` i `.json` są wykluczane z cache'owania jako prywatne dokumenty.

## Telemetria

Aplikacja nie zawiera własnej telemetrii ani analytics.
