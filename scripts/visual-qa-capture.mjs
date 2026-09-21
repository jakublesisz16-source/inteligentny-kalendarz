import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = new Map(process.argv.slice(2).map((value) => {
  const [key, ...rest] = value.replace(/^--/, '').split('=');
  return [key, rest.join('=') || 'true'];
}));
const url = args.get('url') || 'http://127.0.0.1:5174';
const outputDir = resolve(args.get('out') || 'artifacts/visual-qa');
const browserOverride = process.env.BROWSER_BIN || args.get('browser');
const debugPort = Number(args.get('port') || 9333);

function candidates() {
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
  for (const candidate of candidates()) {
    if (!candidate) continue;
    if (candidate.includes('/') || candidate.includes('\\')) {
      if (existsSync(candidate)) return candidate;
    } else {
      const probe = spawnSync('which', [candidate], { encoding: 'utf8' });
      if (probe.status === 0 && probe.stdout.trim()) return probe.stdout.trim();
    }
  }
  throw new Error('Nie znaleziono Chromium/Chrome/Edge. Ustaw BROWSER_BIN i uruchom ponownie.');
}

async function waitForJson(pathname, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}${pathname}`);
      if (response.ok) return await response.json();
    } catch (error) { lastError = error; }
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
      if (payload.error) reject(new Error(payload.error.message)); else resolvePending(payload.result);
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
  await new Promise((resolveWait) => setTimeout(resolveWait, 700));
}

async function setWeekMode(cdp) {
  await cdp.send('Runtime.evaluate', {
    expression: `(() => { try { localStorage.setItem('ik.calendar.display-mode', 'WEEK'); localStorage.setItem('ik.calendar.filter', 'ALL'); return true; } catch { return false; } })()`,
    returnByValue: true,
  });
  const loaded = cdp.once('Page.loadEventFired').catch(() => null);
  await cdp.send('Page.reload', { ignoreCache: true });
  await loaded;
  await new Promise((resolveWait) => setTimeout(resolveWait, 900));
}


async function captureMobileView(cdp, filename, label, calendarMode) {
  const width = 390;
  const height = 844;
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: true, screenWidth: width, screenHeight: height,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await cdp.send('Network.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
  });
  await navigate(cdp, url);
  if (calendarMode) {
    await cdp.send('Runtime.evaluate', {
      expression: `localStorage.setItem('ik.calendar.display-mode', '${calendarMode}');`,
    });
  }
  const clicked = await cdp.send('Runtime.evaluate', {
    expression: `(() => { const button = [...document.querySelectorAll('.bottom-nav-item')].find((item) => item.getAttribute('aria-label') === ${JSON.stringify(label)}); if (!button) return false; button.click(); return true; })()`,
    returnByValue: true,
  });
  if (!clicked.result?.value) throw new Error(`Nie znaleziono mobilnej zakładki: ${label}`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 600));
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  const filepath = join(outputDir, filename);
  writeFileSync(filepath, Buffer.from(result.data, 'base64'));
  console.log(`VISUAL_QA: ${filepath}`);
}


async function captureDesktopView(cdp, filename, label) {
  const width = 1440;
  const height = 1000;
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: false, screenWidth: width, screenHeight: height,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 });
  await cdp.send('Network.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  });
  await navigate(cdp, url);
  const clicked = await cdp.send('Runtime.evaluate', {
    expression: `(() => { const button = [...document.querySelectorAll('.sidebar .nav-item, .desktop-nav .nav-item, .sidebar button, .sidebar a')].find((item) => item.textContent?.trim() === ${JSON.stringify(label)}); if (!button) return false; button.click(); return true; })()`,
    returnByValue: true,
  });
  if (!clicked.result?.value) throw new Error(`Nie znaleziono desktopowej zakładki: ${label}`);
  await new Promise((resolveWait) => setTimeout(resolveWait, 600));
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  const filepath = join(outputDir, filename);
  writeFileSync(filepath, Buffer.from(result.data, 'base64'));
  console.log(`VISUAL_QA: ${filepath}`);
}

async function capture(cdp, preset) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: preset.width,
    height: preset.height,
    deviceScaleFactor: 1,
    mobile: preset.mobile,
    screenWidth: preset.width,
    screenHeight: preset.height,
  });
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: preset.mobile, maxTouchPoints: preset.mobile ? 5 : 1 });
  await cdp.send('Network.setUserAgentOverride', {
    userAgent: preset.mobile
      ? 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36'
      : 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
  });
  await navigate(cdp, url);
  await setWeekMode(cdp);
  const result = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
  const filepath = join(outputDir, preset.filename);
  writeFileSync(filepath, Buffer.from(result.data, 'base64'));
  console.log(`VISUAL_QA: ${filepath}`);

  if (preset.quickAddFilename) {
    const opened = await cdp.send('Runtime.evaluate', {
      expression: `(() => { const slots = [...document.querySelectorAll('.calendar-week-column.selected .calendar-week-slot')]; const slot = slots[3] || slots[0]; if (!slot) return false; slot.click(); return true; })()`,
      returnByValue: true,
    });
    if (!opened.result?.value) throw new Error(`Nie udało się otworzyć szybkiego dodawania dla ${preset.filename}.`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 350));
    const visible = await cdp.send('Runtime.evaluate', {
      expression: preset.mobile
        ? `Boolean(document.querySelector('#event-editor-form'))`
        : `Boolean(document.querySelector('.calendar-week-quick-add'))`,
      returnByValue: true,
    });
    if (!visible.result?.value) throw new Error(`Szybkie dodawanie nie pojawiło się dla ${preset.filename}.`);
    const quickAddResult = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
    const quickAddPath = join(outputDir, preset.quickAddFilename);
    writeFileSync(quickAddPath, Buffer.from(quickAddResult.data, 'base64'));
    console.log(`VISUAL_QA: ${quickAddPath}`);
  }
}

try {
  const health = await fetch(url);
  if (!health.ok) throw new Error(`HTTP ${health.status}`);
} catch (error) {
  throw new Error(`Aplikacja nie odpowiada pod ${url}. Najpierw uruchom Vite, potem visual:qa. (${error instanceof Error ? error.message : String(error)})`);
}

const browser = resolveBrowser();
mkdirSync(outputDir, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'ik-visual-qa-'));
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

try {
  const pages = await waitForJson('/json/list');
  const page = pages.find((item) => item.type === 'page') || pages[0];
  if (!page?.webSocketDebuggerUrl) throw new Error('Chromium nie udostępnił strony CDP.');
  const cdp = createCdp(page.webSocketDebuggerUrl);
  await cdp.ready;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Network.enable');

  await capture(cdp, { filename: 'calendar-week-desktop-1440x1000.png', quickAddFilename: 'calendar-week-quick-add-desktop-1440x1000.png', width: 1440, height: 1000, mobile: false });
  await capture(cdp, { filename: 'calendar-week-mobile-390x844.png', quickAddFilename: 'calendar-week-quick-add-mobile-390x844.png', width: 390, height: 844, mobile: true });
  await capture(cdp, { filename: 'calendar-week-mobile-360x800.png', quickAddFilename: 'calendar-week-quick-add-mobile-360x800.png', width: 360, height: 800, mobile: true });
  await captureDesktopView(cdp, 'today-desktop-1440x1000.png', 'Dzisiaj');
  await captureMobileView(cdp, 'today-mobile-390x844.png', 'Dzisiaj');
  await captureMobileView(cdp, 'calendar-month-mobile-390x844.png', 'Kalendarz', 'MONTH');
  const openedDaySheet = await cdp.send('Runtime.evaluate', {
    expression: `(() => { const day = document.querySelector('.calendar-day.today') || document.querySelector('.calendar-day'); if (!day) return false; day.click(); return true; })()`,
    returnByValue: true,
  });
  if (openedDaySheet.result?.value) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 350));
    const daySheetResult = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, fromSurface: true });
    const daySheetPath = join(outputDir, 'calendar-month-day-sheet-mobile-390x844.png');
    writeFileSync(daySheetPath, Buffer.from(daySheetResult.data, 'base64'));
    console.log(`VISUAL_QA: ${daySheetPath}`);
  }
  await captureMobileView(cdp, 'finance-mobile-390x844.png', 'Finanse');
  await captureMobileView(cdp, 'work-mobile-390x844.png', 'Praca');
  await captureMobileView(cdp, 'settings-mobile-390x844.png', 'Ustawienia');
  cdp.close();
} finally {
  browserProcess.kill('SIGTERM');
  rmSync(profile, { recursive: true, force: true });
}
