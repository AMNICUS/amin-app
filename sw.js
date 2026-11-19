/* Service Worker von AMIN (Cache-Namen mit dua- bleiben, damit gespeicherte Aufnahmen erhalten bleiben) (Vorlage, web_bauen.py setzt Version und Namen ein).
   Shell (index.html, Manifest, Icons) wird sofort gecacht. Audio wird beim ersten Abspielen gecacht (cache-first, mit Range-Antworten fuer Safari)
   oder ueber den Knopf "Alles offline speichern". Alte Caches werden beim Aktivieren geloescht. */
var VERSION = "d16171683f";
var SHELL = "dua-shell-" + VERSION;
var AUDIO = "dua-audio-v1";
var SHELL_DATEIEN = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-192.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(SHELL_DATEIEN); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("dua-") === 0 && k !== SHELL && k !== AUDIO; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (/\.mp3$/i.test(url.pathname)) { e.respondWith(audio(req)); return; }
  e.respondWith(shell(req));
});
function shell(req) {
  return caches.open(SHELL).then(function (c) {
    var ziel = req.mode === "navigate" ? new URL("index.html", self.registration.scope).href : req;
    return c.match(ziel, { ignoreSearch: req.mode === "navigate" }).then(function (r) {
      if (r) return r;
      return fetch(req).then(function (n) { if (n && n.ok && n.type === "basic") c.put(req, n.clone()); return n; });
    });
  });
}
function audio(req) {
  return caches.open(AUDIO).then(function (c) {
    return c.match(req.url).then(function (r) {
      if (r) return r;
      return fetch(req.url).then(function (n) {
        if (n && n.status === 200) { c.put(req.url, n.clone()); return n; }
        return n;
      });
    });
  }).then(function (r) {
    var range = req.headers.get("range");
    if (!range || !r || r.status !== 200) return r;
    return r.clone().blob().then(function (b) {
      var m = /bytes=(\d*)-(\d*)/.exec(range), size = b.size, s, en;
      if (!m) return r;
      if (m[1] === "") { s = Math.max(0, size - parseInt(m[2], 10)); en = size - 1; }
      else { s = parseInt(m[1], 10); en = m[2] === "" ? size - 1 : Math.min(parseInt(m[2], 10), size - 1); }
      if (s >= size || s > en) return new Response("", { status: 416, headers: { "Content-Range": "bytes */" + size } });
      return new Response(b.slice(s, en + 1), { status: 206, headers: { "Content-Type": "audio/mpeg", "Content-Range": "bytes " + s + "-" + en + "/" + size, "Content-Length": String(en - s + 1), "Accept-Ranges": "bytes" } });
    });
  }).catch(function () { return new Response("", { status: 504 }); });
}
