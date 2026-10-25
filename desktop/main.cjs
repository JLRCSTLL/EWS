'use strict';
const { app, BrowserWindow, WebContentsView, Menu, session, protocol, ipcMain, dialog, shell, nativeTheme, screen, powerSaveBlocker } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { PRODUCTION_URL, SHELL_URL, TOOLBAR_HEIGHT, commandUrl, isCommandUrl, isExternalUrl, shellAsset, canNotify, windowBounds } = require('./policy.cjs');

app.setName('TANOVIQ Command Center');
app.setAppUserModelId('ph.tanoviq.commandcenter');
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{ scheme: 'tanoviq', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const base = commandUrl(process.argv, app.isPackaged);
if (!app.isPackaged && process.env.TANOVIQ_TEST_USER_DATA && path.isAbsolute(process.env.TANOVIQ_TEST_USER_DATA)) app.setPath('userData', process.env.TANOVIQ_TEST_USER_DATA);

let win, view, remoteSession, heartbeat, retryTimer, readyTimer, loadTimer, awakeId;
let ready = false, closing = false, checking = false, externalPrompt = false;
let loadGeneration = 0, loadStarted = 0;
let state = { phase: 'loading', service: 'checking', message: 'Opening your command center…', fullScreen: false, keepAwake: false, version: app.getVersion() };
const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function publish(patch = {}) {
  state = { ...state, ...patch };
  if (win && !win.isDestroyed()) win.webContents.send('desktop:state-changed', state);
}
function layout() {
  if (!win || win.isDestroyed() || !view) return;
  const [width, height] = win.getContentSize();
  view.setBounds({ x: 0, y: TOOLBAR_HEIGHT, width, height: Math.max(0, height - TOOLBAR_HEIGHT) });
}
function restoreWindow() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch {}
  const areas = [screen.getPrimaryDisplay(), ...screen.getAllDisplays().filter(d => d.id !== screen.getPrimaryDisplay().id)].map(d => d.workArea);
  return { bounds: windowBounds(saved, areas), maximized: saved.maximized !== false };
}
function rememberWindow() {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
  } catch { /* Window preferences must not prevent exit. */ }
}
function toggleFullScreen() {
  win.setFullScreen(!win.isFullScreen());
}
function about() {
  return dialog.showMessageBox(win, { type: 'info', title: 'About TANOVIQ', message: 'TANOVIQ Command Center', detail: `See Risk Before It Strikes.\nWindows desktop ${app.getVersion()}\n\nConnected to ${new URL(base).hostname}\nUse Personnel to sign in with your existing account. Approved operator or administrator access is required for live locations and broadcasts.\n\nF11: Full screen • Ctrl+R: Reload • Ctrl+0: Reset zoom\nInternet is required. Web updates appear when you reload. Desktop runtime updates require a new installer.` });
}
async function openExternal(url) {
  if (!isExternalUrl(url) || externalPrompt || closing) return;
  externalPrompt = true;
  try {
    const choice = await dialog.showMessageBox(win, { type: 'question', title: 'Open in your browser?', message: 'This link opens outside TANOVIQ.', detail: url.slice(0, 600), buttons: ['Cancel', 'Open browser'], defaultId: 0, cancelId: 0, noLink: true });
    if (choice.response === 1) await shell.openExternal(url);
  } finally { externalPrompt = false; }
}
function offline(message) {
  if (closing) return;
  ready = false;
  clearTimeout(readyTimer); clearTimeout(loadTimer);
  view.setVisible(false);
  publish({ phase: 'error', service: 'unavailable', message });
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void loadCommand(), 15000);
}
async function checkService() {
  if (checking || closing) return;
  checking = true;
  try {
    const response = await remoteSession.fetch(new URL('api/health', base).href, { cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!response.ok || (await response.json()).ok !== true) throw new Error('Service unavailable');
    publish({ service: 'connected' });
  } catch { publish({ service: 'unavailable' }); }
  finally { checking = false; }
}
function showCommand(generation) {
  if (closing || generation !== loadGeneration || state.phase === 'error' || !isCommandUrl(view.webContents.getURL(), base)) return;
  clearTimeout(loadTimer);
  // Briefly retain the logo on very fast starts; never invent a loading percentage.
  readyTimer = setTimeout(() => {
    if (closing || generation !== loadGeneration || state.phase === 'error') return;
    ready = true; view.setVisible(true); layout(); view.webContents.focus();
    publish({ phase: 'ready', message: '' });
    void checkService();
  }, Math.max(0, 1400 - (Date.now() - loadStarted)));
}
async function loadCommand() {
  if (closing) return;
  clearTimeout(retryTimer); clearTimeout(readyTimer); clearTimeout(loadTimer);
  const generation = ++loadGeneration;
  loadStarted = Date.now(); ready = false; view.setVisible(false);
  publish({ phase: 'loading', service: 'checking', message: 'Opening your command center…' });
  loadTimer = setTimeout(() => { if (generation === loadGeneration && !ready) { view.webContents.stop(); offline('The connection is taking longer than expected. Check your internet connection and try again.'); } }, 45000);
  try {
    await view.webContents.loadURL(base);
    if (generation !== loadGeneration) return;
    // Wait for React's command-center root, not merely the HTML response.
    const mounted = await view.webContents.executeJavaScript(`new Promise(resolve => {
      const check = () => !!document.querySelector('.ops-app');
      if (check()) return resolve(true);
      const observer = new MutationObserver(() => { if (check()) { observer.disconnect(); clearTimeout(timer); resolve(true); } });
      observer.observe(document.documentElement, { childList: true, subtree: true });
      const timer = setTimeout(() => { observer.disconnect(); resolve(false); }, 25000);
    })`);
    if (generation !== loadGeneration) return;
    if (!mounted) throw new Error('Command center did not become ready');
    showCommand(generation);
  } catch {
    if (generation === loadGeneration && !closing) offline('We couldn’t open the command center. Check your internet connection, then retry.');
  }
}
function setAwake(value) {
  if (awakeId !== undefined && powerSaveBlocker.isStarted(awakeId)) powerSaveBlocker.stop(awakeId);
  awakeId = value ? powerSaveBlocker.start('prevent-display-sleep') : undefined;
  publish({ keepAwake: value });
}
function buildMenu() {
  const zoom = delta => { if (ready) view.webContents.setZoomFactor(Math.min(1.6, Math.max(0.7, view.webContents.getZoomFactor() + delta))); };
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Command center', submenu: [
      { label: 'Reload command center', accelerator: 'CmdOrCtrl+R', click: () => void loadCommand() },
      { label: 'Check connection', click: () => void checkService() }, { type: 'separator' },
      { label: 'Exit', accelerator: 'Alt+F4', click: () => app.quit() },
    ] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [
      { label: 'Full screen', accelerator: 'F11', click: toggleFullScreen },
      { label: 'Zoom in', accelerator: 'CmdOrCtrl+Plus', click: () => zoom(0.1) },
      { label: 'Zoom out', accelerator: 'CmdOrCtrl+-', click: () => zoom(-0.1) },
      { label: 'Actual size', accelerator: 'CmdOrCtrl+0', click: () => view.webContents.setZoomFactor(1) },
      { type: 'separator' }, { label: 'Keep display awake', type: 'checkbox', click: item => setAwake(item.checked) },
    ] },
    { label: 'Help', submenu: [{ label: 'About TANOVIQ', click: () => void about() }] },
  ]));
}
function guardContents(contents) {
  contents.setWindowOpenHandler(({ url }) => { void openExternal(url); return { action: 'deny' }; });
  contents.on('will-attach-webview', event => event.preventDefault());
  for (const name of ['will-navigate', 'will-redirect', 'will-frame-navigate']) {
    contents.on(name, (event, url) => {
      const target = typeof url === 'string' ? url : event.url;
      if (!isCommandUrl(target, base)) { event.preventDefault(); if (name === 'will-navigate') void openExternal(target); }
    });
  }
  // Hash routing does not emit will-navigate. Keep the personnel UI outside the
  // workstation client while retaining the site's explicit personnel-app link.
  contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (isMainFrame && !isCommandUrl(url, base)) { void openExternal(url); void loadCommand(); }
  });
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'Escape' && win.isFullScreen()) { event.preventDefault(); win.setFullScreen(false); }
    if (input.key === 'F5') { event.preventDefault(); void loadCommand(); }
  });
  contents.on('render-process-gone', () => offline('The command-center window stopped responding. Retry to reopen it.'));
}
async function createWindow() {
  nativeTheme.themeSource = 'dark';
  const saved = restoreWindow();
  protocol.handle('tanoviq', request => {
    const asset = shellAsset(request.url);
    if (!asset || request.method !== 'GET') return new Response('Not found', { status: 404 });
    const mime = asset.endsWith('.html') ? 'text/html' : asset.endsWith('.css') ? 'text/css' : asset.endsWith('.js') ? 'text/javascript' : 'image/png';
    return new Response(fs.readFileSync(path.join(__dirname, asset)), { headers: { 'Content-Type': mime, 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" } });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  remoteSession = session.fromPartition('persist:tanoviq-command');
  remoteSession.setPermissionRequestHandler((contents, permission, callback, details) => callback(contents === view?.webContents && isCommandUrl(contents.getURL(), base) && canNotify(permission, details.requestingUrl ? new URL(details.requestingUrl).origin : '', base)));
  remoteSession.setPermissionCheckHandler((contents, permission, origin) => contents === view?.webContents && isCommandUrl(contents.getURL(), base) && canNotify(permission, origin, base));
  remoteSession.on('will-download', event => event.preventDefault());
  remoteSession.webRequest.onHeadersReceived({ urls: [`${new URL(base).origin}/*`] }, (details, callback) => {
    const headers = { ...details.responseHeaders };
    if (details.resourceType === 'mainFrame' && base === PRODUCTION_URL) headers['Content-Security-Policy'] = ["default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self' https:; worker-src 'self' blob:; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"];
    callback({ responseHeaders: headers });
  });
  win = new BrowserWindow({ ...saved.bounds, minWidth: 960, minHeight: 640, show: false, backgroundColor: '#181b1f', title: 'TANOVIQ Command Center', icon: path.join(__dirname, 'assets/tanoviq.ico'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, devTools: !app.isPackaged } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  view = new WebContentsView({ webPreferences: { session: remoteSession, nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, devTools: !app.isPackaged } });
  view.setBackgroundColor('#181b1f'); view.setVisible(false); win.contentView.addChildView(view);
  guardContents(view.webContents);
  win.on('resize', layout);
  win.on('enter-full-screen', () => { publish({ fullScreen: true }); layout(); });
  win.on('leave-full-screen', () => { publish({ fullScreen: false }); layout(); });
  win.on('close', () => { rememberWindow(); closing = true; clearTimeout(retryTimer); clearTimeout(loadTimer); clearTimeout(readyTimer); clearInterval(heartbeat); setAwake(false); });
  win.on('closed', () => { if (!view.webContents.isDestroyed()) view.webContents.close(); win = null; });
  win.on('focus', () => { if (ready) void checkService(); });
  buildMenu();
  await win.loadURL(SHELL_URL);
  if (saved.maximized) win.maximize();
  win.show(); layout();
  heartbeat = setInterval(() => { if (ready) void checkService(); }, 30000);
  void loadCommand();
}
function trusted(event) {
  return !!win && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && event.senderFrame.url === SHELL_URL;
}
ipcMain.handle('desktop:state', event => { if (!trusted(event)) throw new Error('Not allowed'); return state; });
ipcMain.handle('desktop:command', async (event, action) => {
  if (!trusted(event) || typeof action !== 'string') throw new Error('Not allowed');
  switch (action) {
    case 'retry': case 'reload': void loadCommand(); break;
    case 'connection': void checkService(); break;
    case 'fullscreen': toggleFullScreen(); break;
    case 'about': await about(); break;
    default: throw new Error('Unknown command');
  }
});
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(createWindow).catch(error => { dialog.showErrorBox('TANOVIQ could not start', error.message); app.quit(); });
}
app.on('window-all-closed', () => app.quit());
