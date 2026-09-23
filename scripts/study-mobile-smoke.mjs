import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

const args = new Map(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=') || 'true'];
}));

const url = args.get('url') || 'http://127.0.0.1:5174';
const studyFileArg = args.get('file') || process.env.STUDY_FILE || '';
const studyFile = studyFileArg ? resolve(studyFileArg) : '';
const outputDir = resolve(args.get('out') || 'artifacts/visual-qa/study-mobile-smoke');
const browserOverride = process.env.BROWSER_BIN || args.get('browser');
const debugPort = Number(args.get('port') || 9444);
const expectedGroups = {
  main: args.get('main') || process.env.STUDY_MAIN || '',
  g12: args.get('g12') || process.env.STUDY_G12 || '',
  g4: args.get('g4') || process.env.STUDY_G4 || '',
};
const expectedImportableRaw = args.get('events') || process.env.STUDY_EVENTS || '';
const expectedIncompleteRaw = args.get('incomplete') || process.env.STUDY_INCOMPLETE || '';
const expectedImportable = Number(expectedImportableRaw);
const expectedIncomplete = Number(expectedIncompleteRaw);
const origin = new URL(url).origin;

function fail(message) {
  throw new Error(`STUDY_MOBILE_SMOKE_FAIL: ${message}`);
}

function waitForProcessExit(child, timeoutMs = 4000) {
  if (!child || child.exitCode !== null || child.signalCode) return Promise.resolve(true);
  return new Promise((resolveWait) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.off('exit', onExit);
      resolveWait(value);
    };
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);
    child.once('exit', onExit);
  });
}

async function shutdownBrowser(browserProcess, cdp, profile) {
  if (cdp) {
    try {
      await cdp.send('Browser.close');
    } catch {
      // The browser may close the websocket before acknowledging Browser.close.
    }
    try {
      cdp.close();
    } catch {
      // Cleanup must never mask the actual smoke-test result.
    }
  }

  let exited = await waitForProcessExit(browserProcess, 4000);
  if (!exited && browserProcess?.pid) {
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(browserProcess.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      try {
        browserProcess.kill('SIGTERM');
      } catch {
        // Best effort; SIGKILL fallback below.
      }
    }
    exited = await waitForProcessExit(browserProcess, 2500);
  }

  if (!exited && process.platform !== 'win32') {
    try {
      browserProcess.kill('SIGKILL');
    } catch {
      // Process may already be gone.
    }
    await waitForProcessExit(browserProcess, 1500);
  }

  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.warn(`STUDY_MOBILE_SMOKE_CLEANUP_WARN: nie udało się usunąć profilu tymczasowego ${profile}: ${detail}`);
  }
}

if (!studyFile) fail('podaj --file=... albo ustaw STUDY_FILE na aktywny XLS/XLSX');
if (!existsSync(studyFile)) fail(`nie znaleziono pliku planu: ${studyFile}`);
if (!expectedGroups.main || !expectedGroups.g12 || !expectedGroups.g4) fail('podaj --main=..., --g12=... i --g4=... (lub STUDY_MAIN/STUDY_G12/STUDY_G4)');
if (!expectedImportableRaw || !Number.isFinite(expectedImportable) || expectedImportable < 1) fail('podaj prawidłowe --events=... albo STUDY_EVENTS');
if (!expectedIncompleteRaw || !Number.isFinite(expectedIncomplete) || expectedIncomplete < 0) fail('podaj prawidłowe --incomplete=... albo STUDY_INCOMPLETE');

function browserCandidates() {
  if (browserOverride) return [browserOverride];
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    return roots.flatMap((root) => [
      join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]);
  }
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  return ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable'];
}

function resolveBrowser() {
  for (const candidate of browserCandidates()) {
    if (!candidate) continue;
    if (candidate.includes('/') || candidate.includes('\\')) {
      if (existsSync(candidate)) return candidate;
      continue;
    }
    const probe = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
  }
  fail('nie znaleziono Chromium/Chrome/Edge. Ustaw BROWSER_BIN i uruchom ponownie');
}

async function waitForJson(pathname, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}${pathname}`);
      if (response.ok) return await response.json();
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 180));
  }
  throw lastError || new Error(`CDP timeout: ${pathname}`);
}

function createCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let counter = 0;
  const pending = new Map();
  const listeners = new Map();
  const ready = new Promise((resolveReady, rejectReady) => {
    socket.addEventListener('open', resolveReady, { once: true });
    socket.addEventListener('error', rejectReady, { once: true });
  });
  socket.addEventListener('message', (event) => {
    const payload = JSON.parse(String(event.data));
    if (payload.id && pending.has(payload.id)) {
      const { resolve: resolvePending, reject } = pending.get(payload.id);
      pending.delete(payload.id);
      if (payload.error) reject(new Error(payload.error.message));
      else resolvePending(payload.result);
      return;
    }
    if (payload.method && listeners.has(payload.method)) {
      for (const listener of listeners.get(payload.method)) listener(payload.params);
    }
  });
  return {
    ready,
    send(method, params = {}) {
      const id = ++counter;
      return new Promise((resolvePending, reject) => {
        pending.set(id, { resolve: resolvePending, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    once(method, timeoutMs = 10000) {
      return new Promise((resolveEvent, reject) => {
        const set = listeners.get(method) || new Set();
        const listener = (params) => {
          clearTimeout(timer);
          set.delete(listener);
          resolveEvent(params);
        };
        const timer = setTimeout(() => {
          set.delete(listener);
          reject(new Error(`Timeout waiting for ${method}`));
        }, timeoutMs);
        set.add(listener);
        listeners.set(method, set);
      });
    },
    close() { socket.close(); },
  };
}

async function navigate(cdp, targetUrl) {
  const loaded = cdp.once('Page.loadEventFired').catch(() => null);
  await cdp.send('Page.navigate', { url: targetUrl });
  await loaded;
  await new Promise((resolveWait) => setTimeout(resolveWait, 500));
}

async function evaluate(cdp, expression, { awaitPromise = false, returnByValue = true } = {}) {
  const response = await cdp.send('Runtime.evaluate', { expression, awaitPromise, returnByValue });
  if (response.exceptionDetails) fail(response.exceptionDetails.text || 'błąd JavaScript w przeglądarce');
  return response.result?.value;
}

async function waitFor(cdp, expression, label, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await evaluate(cdp, expression);
    if (value) return value;
    await new Promise((resolveWait) => setTimeout(resolveWait, 180));
  }
  fail(`timeout: ${label}`);
}

async function setViewport(cdp, width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: true,
    screenWidth: width,
    screenHeight: height,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await cdp.send('Network.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
  });
}

async function clearOrigin(cdp) {
  await cdp.send('Storage.clearDataForOrigin', { origin, storageTypes: 'all' });
  await navigate(cdp, url);
}

async function waitForAppShell(cdp, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let splashSkipRequested = false;
  let lastState = null;

  while (Date.now() < deadline) {
    const state = await evaluate(cdp, `(() => ({
      appShell: Boolean(document.querySelector('.app-shell')),
      splash: Boolean(document.querySelector('.app-splash')),
      splashReady: document.querySelector('.app-splash')?.getAttribute('data-ready') || '',
      startupError: document.querySelector('.startup-screen .error-card p')?.textContent?.trim() || '',
      bodyText: (document.body?.innerText || '').trim().slice(0, 400),
    }))()`);
    lastState = state;

    if (state?.appShell) return state;
    if (state?.startupError) fail(`aplikacja nie uruchomiła się: ${state.startupError}`);

    if (state?.splash && state.splashReady === 'true' && !splashSkipRequested) {
      splashSkipRequested = true;
      await evaluate(cdp, `(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return true;
      })()`);
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 180));
  }

  const detail = lastState?.splash
    ? `splash data-ready=${lastState.splashReady || 'brak'}`
    : lastState?.bodyText
      ? `widok: ${lastState.bodyText.replace(/\s+/g, ' ').slice(0, 180)}`
      : 'brak treści aplikacji';
  fail(`timeout: start aplikacji (${detail})`);
}

async function clickMobileNav(cdp, label) {
  const selectorExpression = `(() => {
    const candidates = [...document.querySelectorAll('.bottom-nav-item, .nav-item')];
    const button = candidates.find((item) => item.textContent?.trim() === ${JSON.stringify(label)});
    return Boolean(button);
  })()`;
  await waitFor(cdp, selectorExpression, `nawigacja: ${label}`);
  const clicked = await evaluate(cdp, `(() => {
    const candidates = [...document.querySelectorAll('.bottom-nav-item, .nav-item')];
    const button = candidates.find((item) => item.textContent?.trim() === ${JSON.stringify(label)});
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked) fail(`nie znaleziono zakładki nawigacji: ${label}`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 450));
}

async function attachStudyFile(cdp) {
  const input = await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('.study-view input[type="file"][accept*=".xls"]')`,
    returnByValue: false,
  });
  const objectId = input.result?.objectId;
  if (!objectId) fail('nie znaleziono pola pliku planu w zakładce Studia');
  await cdp.send('DOM.setFileInputFiles', { files: [studyFile], objectId });
  await evaluate(cdp, `(() => {
    const input = document.querySelector('.study-view input[type="file"][accept*=".xls"]');
    if (!input) return false;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function chooseGroup(cdp, ariaLabel, value) {
  const result = await evaluate(cdp, `(() => {
    const select = document.querySelector('select[aria-label=${JSON.stringify(ariaLabel)}]');
    if (!select) return { ok: false, reason: 'missing-select' };
    const option = [...select.options].find((item) => item.value === ${JSON.stringify(value)});
    if (!option) return { ok: false, reason: 'missing-option', options: [...select.options].map((item) => item.value) };
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    if (setter) setter.call(select, ${JSON.stringify(value)}); else select.value = ${JSON.stringify(value)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, value: select.value };
  })()`);
  if (!result?.ok) fail(`nie udało się wybrać ${ariaLabel}: ${result?.reason ?? 'unknown'}`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 220));
}

async function capture(cdp, filename) {
  await evaluate(cdp, `(() => { document.documentElement.scrollTop = 0; document.body.scrollTop = 0; return true; })()`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 120));
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  const filepath = join(outputDir, filename);
  writeFileSync(filepath, Buffer.from(result.data, 'base64'));
  console.log(`STUDY_MOBILE_SMOKE_SCREENSHOT: ${filepath}`);
}

async function verifyDatabase(cdp) {
  return await evaluate(cdp, `(async () => {
    const db = await new Promise((resolveDb, rejectDb) => {
      const request = indexedDB.open('inteligentny-kalendarz');
      request.onsuccess = () => resolveDb(request.result);
      request.onerror = () => rejectDb(request.error || new Error('IndexedDB open failed'));
    });
    try {
      const stores = ['events', 'universityImports', 'studyProfile'];
      const tx = db.transaction(stores, 'readonly');
      const readAll = (store) => new Promise((resolveRead, rejectRead) => {
        const request = tx.objectStore(store).getAll();
        request.onsuccess = () => resolveRead(request.result);
        request.onerror = () => rejectRead(request.error || new Error('IndexedDB read failed'));
      });
      const [events, imports, profiles] = await Promise.all(stores.map(readAll));
      const studyEvents = events.filter((event) => event?.source === 'UNIVERSITY_XLSX');
      const active = imports.find((item) => item?.lifecycleStatus === 'ACTIVE') || imports[0] || null;
      const profile = profiles[0] || null;
      return {
        studyEventCount: studyEvents.length,
        importCount: imports.length,
        importedEventCount: active?.importedEventCount ?? null,
        selectedGroups: active?.selectedGroups ?? [],
        profileGroups: profile?.selectedGroups ?? [],
      };
    } finally {
      db.close();
    }
  })()`, { awaitPromise: true });
}

async function runStudySmoke(cdp, width, height) {
  console.log(`\n=== STUDY MOBILE SMOKE ${width}x${height} ===`);
  await setViewport(cdp, width, height);
  await clearOrigin(cdp);
  await waitForAppShell(cdp);
  await clickMobileNav(cdp, 'Studia');
  await waitFor(cdp, `Boolean(document.querySelector('.study-upload-primary'))`, 'ekran wczytywania planu');
  await attachStudyFile(cdp);
  await waitFor(cdp, `Boolean(document.querySelector('.study-group-choice-grid'))`, 'wybór grup po analizie XLS', 30000);

  await waitFor(cdp, `Boolean(document.querySelector('select[aria-label="Wybierz: Grupa główna"]'))`, 'select grupy głównej');
  await chooseGroup(cdp, 'Wybierz: Grupa główna', expectedGroups.main);
  await waitFor(cdp, `Boolean(document.querySelector('select[aria-label="Wybierz: Grupa 12-osobowa"]'))`, 'select grupy 12-osobowej');
  await chooseGroup(cdp, 'Wybierz: Grupa 12-osobowa', expectedGroups.g12);
  await waitFor(cdp, `Boolean(document.querySelector('select[aria-label="Wybierz: Grupa 4-osobowa"]'))`, 'select grupy 4-osobowej');
  await chooseGroup(cdp, 'Wybierz: Grupa 4-osobowa', expectedGroups.g4);

  const groupState = await waitFor(cdp, `(() => {
    const progress = document.querySelector('.selection-progress')?.textContent?.trim() || '';
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Pokaż mój plan');
    if (progress !== 'Wybór kompletny' || !button || button.disabled) return false;
    const g8Visible = Boolean(document.querySelector('select[aria-label="Wybierz: Grupa 8-osobowa"]'));
    return { progress, g8Visible, buttonDisabled: button.disabled };
  })()`, 'kompletny wybór grup');
  if (groupState.g8Visible) fail('G8 jest nadal ręcznym wyborem mimo dostępnego G4');
  await capture(cdp, `study-groups-mobile-${width}x${height}.png`);

  const previewClicked = await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === 'Pokaż mój plan');
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!previewClicked) fail('nie udało się przejść do podglądu planu');
  await waitFor(cdp, `Boolean(document.querySelector('.study-import-summary'))`, 'podsumowanie importu', 20000);

  const preview = await evaluate(cdp, `(() => {
    const panel = document.querySelector('.study-import-summary');
    if (!panel) return null;
    const summaryText = panel.querySelector('.study-import-summary-line-v207')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const noteText = [...panel.querySelectorAll('.study-summary-note-v207')].map((item) => item.textContent?.replace(/\s+/g, ' ').trim() || '').join(' ');
    const action = [...panel.querySelectorAll('button')].find((item) => item.textContent?.trim().startsWith('Dodaj '));
    return {
      heading: panel.querySelector('h2')?.textContent?.trim() || '',
      summaryText,
      noteText,
      actionText: action?.textContent?.trim() || '',
      actionDisabled: action?.disabled ?? true,
    };
  })()`);
  if (!preview) fail('brak danych podsumowania planu');
  if (!preview.summaryText.includes(`${expectedImportable} wydarzeń`)) fail(`podgląd nie pokazuje ${expectedImportable} wydarzeń: ${preview.summaryText || 'brak'}`);
  if (expectedIncomplete > 0 && !preview.noteText.includes(`${expectedIncomplete} niepełne`)) fail(`podgląd nie pokazuje ${expectedIncomplete} niepełnych wpisów: ${preview.noteText || 'brak'}`);
  if (preview.actionDisabled || preview.actionText !== `Dodaj ${expectedImportable}`) fail(`nieprawidłowe CTA importu: ${preview.actionText || 'brak'}`);
  await capture(cdp, `study-preview-mobile-${width}x${height}.png`);

  const importClicked = await evaluate(cdp, `(() => {
    const button = [...document.querySelectorAll('.study-import-summary button')].find((item) => item.textContent?.trim() === ${JSON.stringify(`Dodaj ${expectedImportable}`)});
    if (!button || button.disabled) return false;
    button.click();
    return true;
  })()`);
  if (!importClicked) fail('nie udało się uruchomić zapisu planu');
  const successText = await waitFor(cdp, `(() => {
    const message = document.querySelector('.study-message.success-message')?.textContent?.trim() || '';
    return message.includes('Zaimportowano ${expectedImportable} wydarzeń') ? message : false;
  })()`, 'potwierdzenie zapisu planu', 30000);

  const database = await verifyDatabase(cdp);
  if (database.studyEventCount !== expectedImportable) fail(`IndexedDB ma ${database.studyEventCount} wydarzeń STUDY zamiast ${expectedImportable}`);
  if (database.importCount !== 1 || database.importedEventCount !== expectedImportable) fail(`rekord importu nie potwierdza ${expectedImportable} wydarzeń`);
  const expected = [expectedGroups.main, expectedGroups.g12, expectedGroups.g4].sort();
  const stored = [...database.selectedGroups].sort();
  if (JSON.stringify(stored) !== JSON.stringify(expected)) fail(`zapisane grupy różnią się od oczekiwanych: ${stored.join(', ')}`);
  if (database.profileGroups.length && JSON.stringify([...database.profileGroups].sort()) !== JSON.stringify(expected)) fail('profil Studiów nie zachował tego samego wyboru grup');
  await capture(cdp, `study-imported-mobile-${width}x${height}.png`);

  await evaluate(cdp, `(() => { localStorage.setItem('ik.calendar.display-mode', 'MONTH'); localStorage.setItem('ik.calendar.filter', 'STUDY'); return true; })()`);
  await clickMobileNav(cdp, 'Kalendarz');
  await waitFor(cdp, `Boolean(document.querySelector('.calendar-view-shell'))`, 'Kalendarz po imporcie');
  const calendarStudyContext = await evaluate(cdp, `(() => ({
    hasStudyFilter: Boolean([...document.querySelectorAll('.calendar-filter-chip')].find((item) => item.textContent?.trim() === 'Studia' && item.classList.contains('active'))),
    body: document.querySelector('.calendar-view-shell')?.textContent || '',
  }))()`);
  if (!calendarStudyContext?.hasStudyFilter) fail('Kalendarz nie uruchomił się z filtrem Studia po imporcie');
  await capture(cdp, `study-calendar-mobile-${width}x${height}.png`);

  console.log(`STUDY_MOBILE_SMOKE_OK ${width}x${height}: ${successText}`);
}

try {
  const health = await fetch(url);
  if (!health.ok) fail(`aplikacja odpowiada HTTP ${health.status}`);
} catch (error) {
  fail(`aplikacja nie odpowiada pod ${url}. Najpierw uruchom Vite. ${error instanceof Error ? error.message : String(error)}`);
}

const browser = resolveBrowser();
mkdirSync(outputDir, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'ik-study-mobile-smoke-'));
const browserProcess = spawn(browser, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-dev-shm-usage',
  ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  'about:blank',
], { stdio: 'ignore' });

let cdp;
let smokePassed = false;
try {
  const pages = await waitForJson('/json/list');
  const page = pages.find((item) => item.type === 'page') || pages[0];
  if (!page?.webSocketDebuggerUrl) fail('Chromium nie udostępnił strony CDP');
  cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');
  await cdp.send('DOM.enable');

  console.log(`STUDY_MOBILE_SMOKE_SOURCE: ${basename(studyFile)}`);
  console.log(`STUDY_MOBILE_SMOKE_GROUPS: ${expectedGroups.main}, ${expectedGroups.g12}, ${expectedGroups.g4}`);
  await runStudySmoke(cdp, 390, 844);
  await runStudySmoke(cdp, 360, 800);
  smokePassed = true;
} finally {
  await shutdownBrowser(browserProcess, cdp, profile);
}

if (smokePassed) console.log('\nSTUDY_MOBILE_SMOKE_ALL_OK');
