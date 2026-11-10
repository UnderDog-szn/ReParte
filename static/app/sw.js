/* Service worker de ReParte: guarda la app para abrirla rápido y sin conexión.
   La API nunca se guarda en caché (los datos deben estar siempre actualizados). */
const VERSION = "reparte-v5";
const BASICOS = ["/", "/static/app/app.js", "/static/app/estilos.css", "/manifest.webmanifest",
  "/static/app/iconos/icono-192.png", "/static/app/iconos/icono-512.png", "/static/app/logo/logo-globo.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (url.origin === location.origin && (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin/") || url.pathname.startsWith("/media/"))) return;
  if (url.hostname.endsWith("tile.openstreetmap.org")) return; // respetar la caché de OSM
  // Primero la red; si no hay conexión, lo guardado.
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && (url.origin === location.origin || url.hostname === "unpkg.com" || url.hostname.includes("fonts."))) {
      const copia = r.clone();
      caches.open(VERSION).then((c) => c.put(e.request, copia));
    }
    return r;
  }).catch(() => caches.match(e.request).then((m) => m || caches.match("/"))));
});
