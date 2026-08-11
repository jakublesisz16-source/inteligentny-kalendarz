# Publiczne repozytorium

Finalna architektura `1.0.0` jest GitHub-only. Repo zawiera kod PWA, workflow CI/Pages i dokumentację techniczną, ale nie zawiera prywatnych danych użytkownika ani wewnętrznych materiałów pracy.

## Dozwolone w publicznym repo

- źródła `src/`,
- statyczne PWA `public/`,
- `package.json` i zweryfikowany `package-lock.json`,
- konfiguracja Vite/TypeScript/Vitest,
- workflow GitHub Actions,
- publiczna dokumentacja produktu.

## Nigdy nie commituj

- `.env` i lokalnych sekretów,
- prywatnych PDF/XLS/XLSX,
- backupów i eksportów JSON,
- lokalnych logów,
- archiwów ZIP/7z/rar,
- prywatnej historii projektu, promptów i handoffów,
- kluczy, tokenów ani danych identyfikujących właściciela.

## GitHub Pages

Frontend jest statyczny. Nie ma produkcyjnej zmiennej backendu ani osobnego serwera aplikacji.

Przed push:

```bash
git status
npm run check
```

Po push sprawdź workflow `Deploy GitHub Pages` i dopiero po zielonym deploymentcie wykonaj smoke test produkcyjnej PWA.
