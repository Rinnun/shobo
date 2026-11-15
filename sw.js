// Keeps the app's own files on the iPhone so it opens without a connection.
// The writing itself is not here: it lives in IndexedDB and never leaves the phone.
const VERSION = '1.1.14-b842f0ed';
const CORE = 'shobo-core-' + VERSION, FONTS = 'shobo-fonts';
const CORE_FILES = ["./", "./android.css", "./api-android.js", "./base.css", "./boot-guard.js", "./fonts/fonts.css", "./help/cover.jpg", "./help/memo.jpg", "./help/plot.jpg", "./help/plotfield.jpg", "./help/tabmenu.jpg", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./icon.png", "./index.html", "./manifest.webmanifest", "./mdtools.js", "./renderer.js", "./web-boot.js", "./web-cap.js", "./web.css"];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(CORE_FILES.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('shobo-core-') && k !== CORE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== location.origin) return;
  const font = /\.woff2$/.test(url.pathname);
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && font) { const c = await caches.open(FONTS); c.put(req, res.clone()); }
    return res;
  })().catch(async () => (req.mode === 'navigate' && await caches.match('index.html')) || Response.error()));
});
