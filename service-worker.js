// Service Worker for offline caching
const CACHE_NAME = 'travel-anastasia-v8';
const TILE_CACHE_NAME = 'map-tiles-v1';

// Static assets to cache immediately
const STATIC_ASSETS = [
    './',
    './index.html',
    './Miguel Copenhagen - Tblisi.pdf',
    './Anastasia_KZN-TBS_Oct18_2025.pdf',
    './Georgii_KZN-TBS_Oct18_2025.pdf',
    './Leonid_KZN-TBS_Oct18_2025.pdf',
    './Stanislav_KZN-TBS_Oct18_2025.pdf',
    './Leonid Tblisi - Kazan.pdf',
    './Tblisi - Istambul.pdf',
    './Istambul - Buenos Aires.pdf'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching static assets');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== TILE_CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Handle map tiles separately (cache them aggressively)
    if (url.hostname.includes('openstreetmap.org')) {
        event.respondWith(
            caches.open(TILE_CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((response) => {
                    if (response) {
                        // Return cached tile
                        return response;
                    }
                    // Fetch and cache new tile
                    return fetch(event.request).then((networkResponse) => {
                        // Cache the tile for offline use
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    }).catch(() => {
                        // If offline and no cache, return empty tile or placeholder
                        return new Response('', { status: 404 });
                    });
                });
            })
        );
        return;
    }

    // Handle external CDN resources (Leaflet, Tailwind)
    if (url.hostname.includes('unpkg.com') ||
        url.hostname.includes('cdn.tailwindcss.com')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((response) => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request).then((networkResponse) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                });
            })
        );
        return;
    }

    // Handle all other requests (HTML, PDFs, etc.)
    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) {
                // Return cached version
                return response;
            }
            // Fetch from network and cache
            return fetch(event.request).then((networkResponse) => {
                // Only cache successful responses
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch((error) => {
                console.log('Fetch failed; returning offline page:', error);
                // Could return a custom offline page here
                return new Response('Offline - content not available', {
                    status: 503,
                    statusText: 'Service Unavailable'
                });
            });
        })
    );
});
