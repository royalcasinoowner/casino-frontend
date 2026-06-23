const CACHE_NAME = 'royal-casino-assets-v2';

// Caching local entry points and core CDN dependencies
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/pixi.min.js',
  '/images/royal-spinner.webp',
  '/images/matka-poker.webp',
  '/images/mines.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Add precache assets; continue even if some CDN calls fail
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url => 
          cache.add(new Request(url, { mode: url.startsWith('http') ? 'cors' : 'same-origin' }))
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests and skip socket.io or api calls
  const url = event.request.url;
  if (
    event.request.method !== 'GET' ||
    url.includes('/socket.io/') ||
    url.includes('/api/')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Offline-first strategy for static assets
      if (cachedResponse) {
        // If it's a font, image, or JS/CSS chunk, just return it instantly without revalidating
        if (
          url.endsWith('.woff2') || 
          url.endsWith('.webp') || 
          url.endsWith('.jpg') || 
          url.endsWith('.svg') ||
          url.includes('/assets/') ||
          url.includes('pixi.min.js')
        ) {
          return cachedResponse;
        }

        // Return cached response instantly, then update cache in the background (stale-while-revalidate for html)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      // Network fallback
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        
        // Cache new assets dynamically
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        
        return networkResponse;
      });
    })
  );
});
