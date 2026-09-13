# Model danych

Aktualna wersja schematu IndexedDB: `14`.

## Główne obszary

### Kalendarz

`CalendarEvent` przechowuje wydarzenia ręczne oraz wydarzenia pochodzące z importów Studiów i Pracy. Wydarzenia mogą zawierać kategorię (`STUDY`, `WORK`, `PERSONAL`, `OTHER`), czas, lokalizację i metadane źródła.

### Studia

Import planu zapisuje logiczny rekord importu oraz znormalizowane wydarzenia. Surowy plik XLS/XLSX nie jest przechowywany jako canonical data.

### Praca

Profil pracy, własne zmiany i - opcjonalnie - minimalne dane współpracowników potrzebne do obliczenia wspólnego czasu są lokalne. Surowy PDF nie jest canonical data.

### Finanse

- `expenseCategories` - kategorie wydatków,
- `expenseProducts` - lokalna kartoteka produktów/klasyfikacji,
- `receipts` - transakcje/paragony i ręczne wydatki,
- definicje Wyjazdów są przechowywane w istniejącym lokalnym meta-store.

Kwoty canonical są zapisywane w jednostkach minor (np. grosze). Dla wydatków zagranicznych rekord może zachować oryginalną walutę, oryginalną kwotę i użyty orientacyjny kurs do PLN.

### Bezpieczeństwo danych

Change Journal, Kosz i Restore Points wspierają cofanie operacji i przywracanie stanu. Backup/transfer serializuje logiczny stan aplikacji, a nie surowe dokumenty importowane przez użytkownika.

## Zgodność

Zmiany UI w publicznym `1.2.0` nie podnoszą schematu ponad `14`.
