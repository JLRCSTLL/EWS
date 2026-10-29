'use strict';

const PRODUCTION_URL = 'https://ews-kappa.vercel.app/';
const SHELL_URL = 'tanoviq://desktop/';
const TOOLBAR_HEIGHT = 48;

function parseUrl(value) {
  try { return new URL(value); } catch { return null; }
}
function commandUrl(args, packaged) {
  // Installed builds always use the official service. Only local source builds
  // may connect to a loopback test server, never an arbitrary supplied hostname.
  const flag = args.indexOf('--dev-url');
  if (packaged || flag < 0) return PRODUCTION_URL;
  const url = parseUrl(args[flag + 1]);
  if (!url || url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.username || url.password) {
    throw new Error('--dev-url must be an HTTP loopback address.');
  }
  return `${url.origin}/`;
}
function isCommandUrl(value, base = PRODUCTION_URL) {
  const url = parseUrl(value), target = parseUrl(base);
  return !!url && !!target && url.origin === target.origin && !url.username && !url.password &&
    url.pathname === '/' && !url.hash.startsWith('#/public');
}
function isExternalUrl(value) {
  const url = parseUrl(value);
  return !!url && url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
}
function shellAsset(value) {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'tanoviq:' || url.host !== 'desktop' || url.username || url.password || url.search) return null;
  return ({ '/': 'shell/index.html', '/shell.css': 'shell/shell.css', '/shell.js': 'shell/shell.js', '/logo.png': 'assets/tanoviq-dark.png' })[url.pathname] || null;
}
function canNotify(permission, origin, base = PRODUCTION_URL) {
  return permission === 'notifications' && origin === new URL(base).origin;
}
function canRecord(permission, origin, details = {}, base = PRODUCTION_URL) {
  const requested = details.mediaTypes || (details.mediaType ? [details.mediaType] : []);
  return permission === 'media' && origin === new URL(base).origin &&
    requested.length === 1 && requested[0] === 'audio' && details.isMainFrame !== false;
}
function canSaveActivityLog({ url, filename, mimeType, bytes, pageUrl }, base = PRODUCTION_URL) {
  const download = parseUrl(url);
  return isCommandUrl(pageUrl, base) && !!download && download.protocol === 'blob:' && download.origin === new URL(base).origin &&
    /^TANOVIQ-(activity|demo)-logs-\d{4}-\d{2}-\d{2}\.csv$/.test(filename) &&
    typeof mimeType === 'string' && mimeType.split(';')[0].trim().toLowerCase() === 'text/csv' &&
    Number.isSafeInteger(bytes) && bytes > 0 && bytes <= 2 * 1024 * 1024;
}
function windowBounds(saved, areas) {
  const primary = areas[0] || { x: 0, y: 0, width: 1440, height: 900 };
  const width = Math.min(primary.width, Math.max(960, Number(saved?.width) || 1440));
  const height = Math.min(primary.height, Math.max(640, Number(saved?.height) || 940));
  const x = Number(saved?.x), y = Number(saved?.y);
  const visible = Number.isFinite(x) && Number.isFinite(y) && areas.some(a => x >= a.x && y >= a.y && x + width <= a.x + a.width && y + height <= a.y + a.height);
  return { x: visible ? x : primary.x + Math.round((primary.width - width) / 2), y: visible ? y : primary.y + Math.round((primary.height - height) / 2), width, height };
}
module.exports = { PRODUCTION_URL, SHELL_URL, TOOLBAR_HEIGHT, commandUrl, isCommandUrl, isExternalUrl, shellAsset, canNotify, canRecord, canSaveActivityLog, windowBounds };
