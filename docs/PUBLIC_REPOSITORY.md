# Publiczne repozytorium - zasady bezpieczeństwa

Ten projekt jest przygotowany do publicznego repo GitHub bez publikowania prywatnych danych użytkownika lub sekretów infrastruktury.

## Co może być publiczne

- kod `src/`, `worker/` i testy,
- `package.json` i `package-lock.json`,
- manifest, ikony i Service Worker,
- konfiguracja CI/GitHub Pages,
- `wrangler.jsonc` wyłącznie z placeholderami i niesekretnymi wartościami development,
- `.env.example` i `.dev.vars.example` wyłącznie z pustymi lub przykładowymi wartościami.

## Czego nie publikować

- `.env`, `.dev.vars`, `.wrangler/`,
- VAPID private key,
- Cloudflare API token,
- tokenów npm/GitHub,
- prywatnych PDF/XLS/XLSX,
- backupów i Data Transfer użytkownika,
- logów terminala,
- wewnętrznych promptów, handoffów i release auditów zawierających lokalną historię pracy.

## Historia Git

Secret usunięty dopiero po commit/push nadal istnieje w historii. Jeżeli prawdziwy sekret kiedykolwiek trafi do publicznego repo, należy go unieważnić/obrócić i dopiero potem oczyścić historię.

Najbezpieczniejszy pierwszy push to nowo utworzone repo z czystym pierwszym commitem z tej przygotowanej paczki.

## GitHub Pages

Repo powinno mieć Pages ustawione na `GitHub Actions`. Workflow `pages.yml` wdraża wyłącznie `dist/` po pełnym `npm run check`.

`VITE_PUSH_WORKER_URL` może być ustawione jako GitHub Actions repository variable. Nie jest sekretem.

## Wiele aplikacji na GitHub Pages

Project sites tego samego konta, np. `https://user.github.io/app-a/` i `https://user.github.io/app-b/`, mają ten sam web origin `https://user.github.io`. Service Workery są rozdzielone scope ścieżki, ale uprawnienia przeglądarkowe, np. Notifications, są origin-level. Jeżeli w przyszłości potrzebna będzie silna izolacja aplikacji, można nadać im osobne custom domains/subdomains bez zmiany kodu produktu.
