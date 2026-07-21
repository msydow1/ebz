/* Zeiterfassung Service Worker – Offline-Cache.
   Navigation: network-first (Updates kommen an), Assets: cache-first. */
const CACHE = "zeiterfassung-v2.6.0";
const ASSETS = [
  "./",
  "manifest.json",
  "icon-180.png",
  "icon-512.png",
  "vendor/inter.css",
  "vendor/inter-1.woff2",
  "vendor/inter-2.woff2",
  "vendor/inter-3.woff2",
  "vendor/inter-4.woff2",
  "vendor/inter-5.woff2",
  "vendor/inter-6.woff2",
  "vendor/inter-7.woff2",
  "vendor/pdf.min.js",
  "vendor/pdf.worker.min.js",
  "vendor/jspdf.umd.min.js"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    // App-Seite: erst Netz (frische Version), sonst Cache
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put("./", copy));
        return res;
      }).catch(() => caches.match("./"))
    );
    return;
  }
  // Assets: erst Cache, sonst Netz (und merken)
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    }))
  );
});
