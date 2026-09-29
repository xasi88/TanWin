// Service worker TanWin: офлайн-режим. Список файлов и версия обновляются командой: node tools/build.mjs
const VERSION = "206b202053";
const CORE = `tanwin-core-${VERSION}`;
const AUDIO = "tanwin-audio";
/*FILES*/
const FILES = [
  "./",
  "css/app.css",
  "data/bank.json",
  "data/pairs.json",
  "data/q/001.json",
  "data/q/078.json",
  "data/q/079.json",
  "data/q/080.json",
  "data/q/081.json",
  "data/q/082.json",
  "data/q/083.json",
  "data/q/084.json",
  "data/q/085.json",
  "data/q/086.json",
  "data/q/087.json",
  "data/q/088.json",
  "data/q/089.json",
  "data/q/090.json",
  "data/q/091.json",
  "data/q/092.json",
  "data/q/093.json",
  "data/q/094.json",
  "data/q/095.json",
  "data/q/096.json",
  "data/q/097.json",
  "data/q/098.json",
  "data/q/099.json",
  "data/q/100.json",
  "data/q/101.json",
  "data/q/102.json",
  "data/q/103.json",
  "data/q/104.json",
  "data/q/105.json",
  "data/q/106.json",
  "data/q/107.json",
  "data/q/108.json",
  "data/q/109.json",
  "data/q/110.json",
  "data/q/111.json",
  "data/q/112.json",
  "data/q/113.json",
  "data/q/114.json",
  "data/rare.json",
  "data/surahs.json",
  "fonts/OFL-Amiri.txt",
  "fonts/OFL.txt",
  "fonts/amiri-quran.woff2",
  "fonts/nunito.woff2",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/icon.svg",
  "index.html",
  "js/app.js",
  "js/arabic.js",
  "js/audio.js",
  "js/course.js",
  "js/data.js",
  "js/diagram.js",
  "js/donors.js",
  "js/exercises.js",
  "js/feedback.js",
  "js/install.js",
  "js/lesson.js",
  "js/letters.js",
  "js/path.js",
  "js/rules.js",
  "js/store.js",
  "js/ui.js",
  "js/version.js",
  "js/views/changelog.js",
  "js/views/home.js",
  "js/views/more.js",
  "js/views/onboard.js",
  "js/views/progress.js",
  "js/views/quran.js",
  "js/views/reference.js",
  "js/views/review.js",
  "js/views/surah.js",
  "js/views/thanks.js",
  "manifest.webmanifest",
];
/*END*/
const AUDIO_HOSTS = ["audio.qurancdn.com", "everyayah.com", "verses.quran.com", "mirrors.quranicaudio.com"];

self.addEventListener("install", (e) => {
  // новая версия ждёт, пока ученик нажмёт «Обновить» (чтобы не перезагружать страницу посреди урока)
  e.waitUntil(caches.open(CORE).then((c) => c.addAll(FILES)));
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("tanwin-core-") && k !== CORE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("message", (e) => { if (e.data?.type === "SKIP_WAITING") self.skipWaiting(); });

// Ответ 206 из закэшированного файла (нужно Safari для <audio>)
async function rangeResponse(req, res) {
  const range = req.headers.get("range");
  if (!range) return res;
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const size = buf.byteLength;
  const start = m && m[1] ? +m[1] : 0;
  const end = m && m[2] ? Math.min(+m[2], size - 1) : size - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206, statusText: "Partial Content",
    headers: { "Content-Type": res.headers.get("Content-Type") || "audio/mpeg", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" },
  });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Аудио чтецов: из кэша, если есть; короткие пословные записи сохраняем при первом прослушивании
  if (AUDIO_HOSTS.includes(url.hostname)) {
    const key = url.origin + url.pathname;
    e.respondWith((async () => {
      const c = await caches.open(AUDIO);
      const hit = await c.match(key);
      if (hit) return rangeResponse(req, hit);
      if (url.hostname === "audio.qurancdn.com") e.waitUntil(fetch(key).then((r) => r.ok && c.put(key, r)).catch(() => {}));
      return fetch(req);
    })());
    return;
  }
  if (url.origin !== location.origin) return;

  // Данные и шрифты: сначала кэш
  if (/\/(data|fonts|icons)\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CORE).then((c) => c.put(req, cp)); } return r; })));
    return;
  }
  // Код и страницы: сначала сеть (чтобы получать обновления), без сети — кэш
  e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CORE).then((c) => c.put(req, cp)); } return r; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
