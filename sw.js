// sw.js - Service Worker for DBI Learning Platform
const CACHE_NAME = 'dbi-learn-v1.0.0';
const OFFLINE_URL = '/offline.html';

// Assets to cache immediately on install - ONLY local assets
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/offline.html',
  '/login.html',
  '/signup.html',
  '/css/style.css',
  '/icon/favicon.png',
  '/manifest.json'
  // REMOVED external CDNs - they will be handled differently
];

// External resources that need special handling (no-cors mode)
const EXTERNAL_RESOURCES = [
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://unpkg.com/aos@2.3.1/dist/aos.css',
  'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css',
  'https://unpkg.com/aos@2.3.1/dist/aos.js',
  'https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js'
];

// Install event - cache core assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching preloaded assets');
        // Cache local assets normally
        return cache.addAll(PRECACHE_ASSETS).catch(err => {
          console.error('[SW] Failed to cache some assets:', err);
          // Continue even if some assets fail
          return Promise.resolve();
        });
      })
      .then(() => {
        // Cache external resources with no-cors mode
        return caches.open(CACHE_NAME).then(cache => {
          return Promise.allSettled(
            EXTERNAL_RESOURCES.map(url => {
              return fetch(url, { mode: 'no-cors' })
                .then(response => {
                  // With no-cors, response is opaque but we can still cache it
                  return cache.put(url, response);
                })
                .catch(err => {
                  console.warn('[SW] Failed to cache external resource:', url, err);
                });
            })
          );
        });
      })
      .then(() => {
        return self.skipWaiting();
      })
  );
});

// Helper: Should we cache this request?
function shouldCache(request) {
  const url = new URL(request.url);
  
  // Don't cache non-GET requests
  if (request.method !== 'GET') return false;
  
  // Don't cache chrome-extension requests
  if (url.protocol === 'chrome-extension:') return false;
  
  // Don't cache analytics or tracking
  if (url.pathname.includes('analytics') || url.pathname.includes('tracking')) return false;
  
  // Cache our own domain
  if (url.origin === self.location.origin) return true;
  
  // Cache CDNs but handle them differently
  const cdnDomains = [
    'cdn.tailwindcss.com',
    'cdnjs.cloudflare.com',
    'unpkg.com',
    'cdn.jsdelivr.net'
  ];
  
  return cdnDomains.some(domain => url.hostname.includes(domain));
}

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Handle external resources differently (no-cors mode)
  if (EXTERNAL_RESOURCES.some(resource => url.href.includes(resource))) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fetch with no-cors to avoid CORS errors
          return fetch(request, { mode: 'no-cors' })
            .then((response) => {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
              return response;
            })
            .catch(() => {
              // If fetch fails, return a simple response
              return new Response('Resource unavailable offline', {
                status: 200,
                statusText: 'OK',
                headers: new Headers({
                  'Content-Type': 'text/plain'
                })
              });
            });
        })
    );
    return;
  }
  
  // Handle HTML navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response
          const responseToCache = response.clone();
          
          // Cache the new page
          caches.open(CACHE_NAME).then((cache) => {
            if (shouldCache(request)) {
              cache.put(request, responseToCache);
            }
          });
          
          return response;
        })
        .catch(async () => {
          // If network fails, try cache then offline page
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          return caches.match(OFFLINE_URL);
        })
    );
    return;
  }
  
  // Handle static assets (CSS, JS, images)
  if (shouldCache(request)) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached version and update in background
            fetch(request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse.clone());
                });
              }
            }).catch(() => {
              // Silent fail for background update
            });
            return cachedResponse;
          }
          
          // Not in cache, fetch from network
          return fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          });
        })
    );
    return;
  }
  
  // For everything else, try network first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for dynamic content patterns
        if (response && response.status === 200) {
          const dynamicPatterns = [
            '/student/',
            '/admin/',
            '/dashboard.html',
            '/resources.html'
          ];
          
          if (dynamicPatterns.some(pattern => url.pathname.includes(pattern))) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});