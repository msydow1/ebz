/* Zeiterfassung Service Worker – Offline-Cache.
   Navigation: network-first (Updates kommen an) mit Zeitgrenze, Assets: cache-first. */
const CACHE = "zeiterfassung-v5.0.0";
const ASSETS = [
  "./",
  "manifest.json",
  "icon-180.png",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-192.png",
  "icon-maskable-512.png",
  "favicon.svg",
  "favicon-32.png",
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
  "vendor/jspdf.umd.min.js",
  "vorlagen/627.jpg"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    // Nur eigene alte Caches loeschen: Cache Storage gilt pro Origin, andere Apps auf msydow1.github.io behalten ihre Caches.
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("zeiterfassung-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* App-Seite holen (V5.0): Netz und eine Zeitgrenze laufen um die Wette.
   Grund: Am Drehort gibt es oft Empfang ohne Durchsatz. Der Abruf scheitert dann nicht, er haengt, und die App startete nicht,
   obwohl die Offline-Kopie da war. Deshalb:
   - Netz antwortet rechtzeitig: Es gilt (frische Version). Scheitert es rechtzeitig, gilt die Kopie, wie bisher.
   - Zeit um und es gibt eine Kopie: Die Kopie wird geliefert. Der Abruf laeuft weiter und erneuert die Kopie fuer den naechsten Start.
   - Zeit um und keine Kopie: weiter auf das Netz warten, etwas anderes gibt es nicht.
   Rueckgabe: antwort fuer respondWith, fertig fuer waitUntil (haelt den Service Worker wach, bis die Kopie geschrieben ist). */
const NETZ_FRIST = 3000;
function seiteHolen(req) {
  let merken = Promise.resolve();
  const netz = fetch(req).then(res => {
    // Nur erfolgreiche Antworten merken, sonst ueberschreibt eine 404/5xx-Seite die App fuer den Offline-Start
    if (res.ok) { const copy = res.clone(); merken = caches.open(CACHE).then(c => c.put("./", copy)); }
    return res;
  });
  const kopie = () => caches.match("./");
  const frist = new Promise(ok => setTimeout(ok, NETZ_FRIST, "frist"));
  const antwort = Promise.race([netz, frist])
    .then(erg => erg === "frist" ? kopie().then(hit => hit || netz) : erg)
    .catch(() => kopie());
  return { antwort, fertig: netz.then(() => merken).catch(() => {}) };
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    // App-Seite: erst Netz (frische Version), nach 3 Sekunden oder ohne Netz die Kopie
    const seite = seiteHolen(req);
    e.respondWith(seite.antwort);
    e.waitUntil(seite.fertig);
    return;
  }
  // Assets: erst Cache, sonst Netz (und merken)
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }))
  );
});
