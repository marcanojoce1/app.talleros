// Service worker mínimo: permite instalar la app y cachear el shell.
const CACHE = 'talleros-v1';
const SHELL = ['./index.html', './manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  // Network-first para la API; cache-first para el shell
  if (e.request.url.includes('/api/')) return;
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
