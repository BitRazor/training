/* Training Tracker service worker — makes the app installable + work offline.
   Strategy: NETWORK-FIRST for the app shell (HTML/JS/CSS) so published updates land
   immediately when online (cache is only the offline fallback); CACHE-FIRST for images
   /manifest (rarely change → fast, saves data). Bump CACHE on each release. */
"use strict";
var CACHE = "training-2026-06-20d";   /* bump on every release so returning phones evict the old shell */
var CORE = [
  "./", "./index.html", "./tracker.css",
  "./tracker-seed.js", "./tracker-desc.js", "./tracker-views.js", "./tracker-plan.js", "./tracker.js",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE).catch(function () {}); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromNet(req, bypassHttpCache) {
  /* bypassHttpCache → force revalidation against the server (ETag), so a freshly-published
     shell lands immediately instead of waiting out the browser's max-age. */
  var input = bypassHttpCache ? new Request(req.url, { cache: "no-cache" }) : req;
  return fetch(input).then(function (res) {
    if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
    return res;
  });
}
self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;   // don't touch cross-origin
  if (/\.(gif|jpg|jpeg|png|svg|webmanifest)$/i.test(url.pathname)) {
    e.respondWith(caches.match(req).then(function (c) { return c || fromNet(req); }));        // images: cache-first
  } else {
    e.respondWith(fromNet(req, true).catch(function () { return caches.match(req); }));       // shell: network-first + bypass HTTP cache; cache = offline fallback
  }
});
