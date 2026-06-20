/* Training Tracker service worker — makes the app installable + work offline.
   Strategy: stale-while-revalidate for same-origin GETs (instant load from cache,
   refresh in the background), so published updates land within a visit or two.
   Bump CACHE on each release to evict the old shell. */
"use strict";
var CACHE = "training-2026-06-20";
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

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;   // don't touch cross-origin
  e.respondWith(
    caches.match(req).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
        return res;
      }).catch(function () { return cached; });   // offline → fall back to cache
      return cached || network;                    // cache-first for speed, revalidating in the background
    })
  );
});
