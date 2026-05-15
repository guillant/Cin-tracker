const SHELL_CACHE_NAME = "cinetracker-shell-v31";
const RUNTIME_IMAGE_CACHE_NAME = "cinetracker-runtime-images-v1";
const TMDB_IMAGE_CACHE_LIMIT = 120;
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/config.js",
  "./js/stats.js",
  "./js/tmdb.js",
  "./js/ui.js",
  "./assets/icon-192.svg",
  "./assets/icon-512.svg",
  "./assets/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key !== SHELL_CACHE_NAME && key !== RUNTIME_IMAGE_CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  if (keys.length <= maxEntries) return;

  const toDelete = keys.slice(0, keys.length - maxEntries);
  await Promise.all(toDelete.map((request) => cache.delete(request)));
}

function isSameOrigin(requestUrl) {
  return new URL(requestUrl).origin === self.location.origin;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("./index.html")));
    return;
  }

  if (isSameOrigin(request.url)) {
    const isStaticAsset = [
      "style",
      "script",
      "manifest",
      "font",
      "image",
    ].includes(request.destination);

    if (isStaticAsset) {
      event.respondWith(
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches
                .open(SHELL_CACHE_NAME)
                .then((cache) => cache.put(request, responseClone));
            }

            return networkResponse;
          })
          .catch(() => caches.match(request)),
      );
      return;
    }

    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          const responseClone = networkResponse.clone();
          caches
            .open(SHELL_CACHE_NAME)
            .then((cache) => cache.put(request, responseClone));
          return networkResponse;
        });
      }),
    );
    return;
  }

  if (url.origin.includes("image.tmdb.org")) {
    event.respondWith(
      caches.open(RUNTIME_IMAGE_CACHE_NAME).then((runtimeCache) =>
        runtimeCache.match(request).then((cachedResponse) => {
          const networkFetch = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const responseClone = networkResponse.clone();
                runtimeCache.put(request, responseClone).then(() => {
                  trimCache(RUNTIME_IMAGE_CACHE_NAME, TMDB_IMAGE_CACHE_LIMIT);
                });
              }

              return networkResponse;
            })
            .catch(() => cachedResponse);

          return cachedResponse || networkFetch;
        }),
      ),
    );
  }
});
