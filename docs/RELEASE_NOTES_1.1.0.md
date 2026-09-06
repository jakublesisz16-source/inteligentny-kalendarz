# Inteligentny Kalendarz 1.1.0

`1.1.0` to stabilne wydanie local-first PWA z rozbudowanym importem planów Studiów, lokalnym OCR paragonów, dopracowanym Kalendarzem i dodatkowymi bramkami bezpieczeństwa wydania.

## Najważniejsze zmiany

- import planów Studiów `.xls` i `.xlsx` z obsługą szerokich macierzy tygodniowych, wielopoziomowych grup i bloków `pon.-pt.`,
- bramka kompletności planu sprawdzająca źródłowe bloki i godziny bez zgadywania brakujących danych,
- niepełne wpisy źródłowe pozostają widoczne jako niepełne zamiast tworzyć fikcyjne wydarzenia,
- bezpieczna aktualizacja aktywnego planu oraz zmiana grup bez duplikowania wydarzeń i bez utraty ręcznych korekt,
- czytelny miesięczny Kalendarz z aktywnymi grupami Studiów i osobnym oznaczeniem wpisów niepełnych,
- lokalny moduł paragonów i wydatków z OCR wykonywanym na urządzeniu,
- nowa ikona PWA i finalny cache Service Workera `v1.1.0`.

## Bezpieczeństwo i prywatność

- dane aplikacji pozostają w IndexedDB na urządzeniu użytkownika,
- prywatne PDF/XLS/XLSX/JSON nie są cache'owane przez Service Workera,
- PDF grafiku Pracy jest ograniczony do 32 MB i sprawdzany po sygnaturze pliku przed pełnym odczytem,
- produkcyjne sourcemapy są wyłączone,
- paczka publiczna jest skanowana pod kątem sekretów, prywatnych plików, archiwów, logów i artefaktów developerskich.

## Aktualizacja

- APP_VERSION: `1.1.0`
- DATABASE_SCHEMA_VERSION: `13`
- aktualizacja z ostatniego RC nie wymaga dodatkowej migracji bazy,
- poprzednim stabilnym wydaniem publicznym było `1.0.2`.
