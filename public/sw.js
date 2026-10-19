// Cache only the offline notice. Never store accounts, locations or API responses.
const CACHE = 'eligtas-offline-v1';
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.add('/offline.html')).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('eligtas-offline-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')));
});
self.addEventListener('push', event => {
  let message = { title: 'E-Ligtas alert', body: 'Open your inbox for a new command-center message.' };
  try { message = { ...message, ...event.data.json() }; } catch { /* Keep a useful generic notification. */ }
  event.waitUntil(self.registration.showNotification(message.title, { body: message.body, icon: '/app-icon-192.png', badge: '/app-icon-192.png', tag: message.id || 'eligtas-alert', data: { url: '/#/public/alerts' } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin && client.url.includes('#/public'));
    if (existing) { await existing.navigate('/#/public/alerts'); return existing.focus(); }
    return self.clients.openWindow('/#/public/alerts');
  }));
});
