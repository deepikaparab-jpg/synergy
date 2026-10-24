/* sw.js - service worker: keeps the app files so Synergy opens offline after the first visit.
   Network first (so updates arrive), cache as the fallback. Only same-site GET requests are cached. */
var CACHE = 'synergy-shell-v1';
var FILES = ['./', 'index.html', 'css/style.css', 'js/config.js', 'js/database.js', 'js/app.js',
             'manifest.webmanifest', 'icons/logo.png', 'icons/favicon.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) {
    return Promise.all(k.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(r).then(function (res) {
    var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, copy); }); return res;
  }).catch(function () { return caches.match(r).then(function (m) { return m || caches.match('index.html'); }); }));
});
