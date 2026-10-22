const CACHE='frauen-app-0.1.9.3-build17';
const CORE=[
  './',
  './index.html',
  './style.css',
  './app.js',
  './lessons.js',
  './deep_lessons.js',
  './self_guides.js',
  './anatomy-vulva.svg',
  './anatomy-cervix.svg',
  './anatomy-breast.svg',
  './speculum-types.svg',
  './speculum-application.svg',
  './speculum-period-view.svg',
  './period-hygiene-products.svg',
  './cervical-mucus-nfp.svg',
  './discharge-types.svg',
  './speculum-prep-tray.svg',
  './vaginal-palpation-technique.svg',
  './speculum-cleaning-aftercare.svg',
  './cervix-cycle-comparison.svg',
  './cycle-hormones-chart.svg',
  './postpartum-fundus.svg',
  './version.json',
  './icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(CORE))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k.startsWith('frauen-app-') && k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // version.json und sw.js niemals aus Cache
  if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/sw.js')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }));
    return;
  }

  // Network-First für Skripte, HTML und CSS damit Updates sofort sichtbar sind
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(response => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});
