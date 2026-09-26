# Inteligentny Kalendarz

Lokalna PWA łącząca kalendarz, plan studiów, grafik pracy, dyspozycyjność, finanse i codzienne zadania. Projekt jest local-first: dane użytkownika są przechowywane głównie w IndexedDB przeglądarki, bez własnego backendu i konta.

## Start dla nowej rozmowy / developera

Czytaj w tej kolejności:

1. `CURRENT_PROJECT_RULES.md` - stałe zasady produktu i pracy,
2. `CURRENT_STATE.json` - maszynowy bieżący stan,
3. `HANDOFF_NEW_CHAT.md` - co dokładnie jest gotowe i co robić dalej,
4. `docs/CURRENT_PRODUCT_STATE.md` - obecne zachowanie modułów,
5. `docs/ROADMAP.md` - przyszłość i priorytety,
6. właściwy `project-skills/*/SKILL.md` dla rodzaju zadania.

Nie rekonstruuj stanu z nazw starych buildów. Aktualny clean checkpoint celowo nie zawiera jednorazowych build-docs ani historycznych proof scripts.

## Najważniejsze funkcje

- Kalendarz Miesiąc/Tydzień + Dzisiaj,
- import planu WUM XLS/XLSX z grupami i bezpiecznym diffem,
- grafik Pracy, współpracownicy, Dyspozycyjność i Podsumowanie,
- Finanse Miesiąc/Wyjazdy, katalog produktów i klasyfikacja wydatków,
- Receipt Scanner 2.0: lokalny OCR zdjęć/PDF i e-paragony JSON,
- lokalny backup/restore i eksport,
- PWA/offline.

Szczegółowy aktualny opis: `docs/CURRENT_PRODUCT_STATE.md`.

## Uruchomienie

Wymagany Node.js 22.

```bash
npm ci
npm run dev
```

Pełna walidacja:

```bash
npm run check:public
npm run security:dependencies
```

Prywatne fixture'y nie są pakowane do checkpointu. `npm run test:private` ma sens tylko w lokalnym środowisku, które posiada wymagane ignorowane dane `_PRIVATE_HISTORY/`; nie jest gate'em czystego recovery ZIP-a. Exact-source QA Studiów uruchamiamy osobno przez `npm run study:audit` po ustawieniu `IK_STUDY_XLS_PATH` i `IK_STUDY_XLS_SHA256`.

## Dokumentacja

Aktualny katalog `docs/` jest celowo mały:

- `ARCHITECTURE.md` - architektura,
- `CURRENT_PRODUCT_STATE.md` - stan produktu,
- `ROADMAP.md` - przyszłość,
- `QA_RELEASE.md` - testy i wydanie,
- `MILESTONES.md` - skondensowana historia,
- `PRIVACY.md` - prywatność,
- `STUDY_PLAN_II_2026_MAPPING.md` - aktywna mapa źródła planu.

## PRIVATE / PUBLIC

PRIVATE jest jedynym źródłem developmentu i nigdy nie trafia bezpośrednio na GitHub. PUBLIC powstaje dopiero z zamrożonego PRIVATE i nie zawiera private-only dokumentacji, `project-skills`, danych użytkownika ani checkpoint manifestu.

Stały katalog publikacyjny użytkownika: `D:\Projekty\inteligentny-kalendarz-publish`. Istniejący `.git` ma pozostać. Szczegóły: `docs/QA_RELEASE.md` i `project-skills/ik-release-final/SKILL.md`.
