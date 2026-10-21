// Service worker TanWin: офлайн-режим. Список файлов и версия обновляются командой: node tools/build.mjs
const VERSION = "cde65daddc";
const CORE = `tanwin-core-${VERSION}`;
const AUDIO = "tanwin-audio";
const ROOT = new URL("./", self.location).pathname;
// Страницы самого приложения
const APP_PAGES = [ROOT, ROOT + "index.html"];
/*FILES*/
const FILES = [
  "./",
  "audio/letters/SOURCE.md",
  "audio/letters/alif.mp3",
  "audio/letters/ayn-a.mp3",
  "audio/letters/ayn-i.mp3",
  "audio/letters/ayn-u.mp3",
  "audio/letters/ayn.mp3",
  "audio/letters/ba-a.mp3",
  "audio/letters/ba-i.mp3",
  "audio/letters/ba-u.mp3",
  "audio/letters/ba.mp3",
  "audio/letters/dad-a.mp3",
  "audio/letters/dad-i.mp3",
  "audio/letters/dad-u.mp3",
  "audio/letters/dad.mp3",
  "audio/letters/dal-a.mp3",
  "audio/letters/dal-i.mp3",
  "audio/letters/dal-u.mp3",
  "audio/letters/dal.mp3",
  "audio/letters/dhal-a.mp3",
  "audio/letters/dhal-i.mp3",
  "audio/letters/dhal-u.mp3",
  "audio/letters/dhal.mp3",
  "audio/letters/fa-a.mp3",
  "audio/letters/fa-i.mp3",
  "audio/letters/fa-u.mp3",
  "audio/letters/fa.mp3",
  "audio/letters/ghayn-a.mp3",
  "audio/letters/ghayn-i.mp3",
  "audio/letters/ghayn-u.mp3",
  "audio/letters/ghayn.mp3",
  "audio/letters/ha-a.mp3",
  "audio/letters/ha-i.mp3",
  "audio/letters/ha-u.mp3",
  "audio/letters/ha.mp3",
  "audio/letters/hamza-a.mp3",
  "audio/letters/hamza-i.mp3",
  "audio/letters/hamza-u.mp3",
  "audio/letters/hamza.mp3",
  "audio/letters/hha-a.mp3",
  "audio/letters/hha-i.mp3",
  "audio/letters/hha-u.mp3",
  "audio/letters/hha.mp3",
  "audio/letters/jim-a.mp3",
  "audio/letters/jim-i.mp3",
  "audio/letters/jim-u.mp3",
  "audio/letters/jim.mp3",
  "audio/letters/kaf-a.mp3",
  "audio/letters/kaf-i.mp3",
  "audio/letters/kaf-u.mp3",
  "audio/letters/kaf.mp3",
  "audio/letters/kha-a.mp3",
  "audio/letters/kha-i.mp3",
  "audio/letters/kha-u.mp3",
  "audio/letters/kha.mp3",
  "audio/letters/lam-a.mp3",
  "audio/letters/lam-i.mp3",
  "audio/letters/lam-u.mp3",
  "audio/letters/lam.mp3",
  "audio/letters/mim-a.mp3",
  "audio/letters/mim-i.mp3",
  "audio/letters/mim-u.mp3",
  "audio/letters/mim.mp3",
  "audio/letters/nun-a.mp3",
  "audio/letters/nun-i.mp3",
  "audio/letters/nun-u.mp3",
  "audio/letters/nun.mp3",
  "audio/letters/qaf-a.mp3",
  "audio/letters/qaf-i.mp3",
  "audio/letters/qaf-u.mp3",
  "audio/letters/qaf.mp3",
  "audio/letters/ra-a.mp3",
  "audio/letters/ra-i.mp3",
  "audio/letters/ra-u.mp3",
  "audio/letters/ra.mp3",
  "audio/letters/sad-a.mp3",
  "audio/letters/sad-i.mp3",
  "audio/letters/sad-u.mp3",
  "audio/letters/sad.mp3",
  "audio/letters/shin-a.mp3",
  "audio/letters/shin-i.mp3",
  "audio/letters/shin-u.mp3",
  "audio/letters/shin.mp3",
  "audio/letters/sin-a.mp3",
  "audio/letters/sin-i.mp3",
  "audio/letters/sin-u.mp3",
  "audio/letters/sin.mp3",
  "audio/letters/ta-a.mp3",
  "audio/letters/ta-i.mp3",
  "audio/letters/ta-u.mp3",
  "audio/letters/ta.mp3",
  "audio/letters/tha-a.mp3",
  "audio/letters/tha-i.mp3",
  "audio/letters/tha-u.mp3",
  "audio/letters/tha.mp3",
  "audio/letters/tta-a.mp3",
  "audio/letters/tta-i.mp3",
  "audio/letters/tta-u.mp3",
  "audio/letters/tta.mp3",
  "audio/letters/waw-a.mp3",
  "audio/letters/waw-i.mp3",
  "audio/letters/waw-u.mp3",
  "audio/letters/waw.mp3",
  "audio/letters/ya-a.mp3",
  "audio/letters/ya-i.mp3",
  "audio/letters/ya-u.mp3",
  "audio/letters/ya.mp3",
  "audio/letters/zay-a.mp3",
  "audio/letters/zay-i.mp3",
  "audio/letters/zay-u.mp3",
  "audio/letters/zay.mp3",
  "audio/letters/zza-a.mp3",
  "audio/letters/zza-i.mp3",
  "audio/letters/zza-u.mp3",
  "audio/letters/zza.mp3",
  "css/app.css",
  "css/pages.css",
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
  "fonts/amiri-quran.woff2",
  "fonts/hafs.woff2",
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
  "js/env.js",
  "js/exercises.js",
  "js/feedback.js",
  "js/fullscreen.js",
  "js/install.js",
  "js/lesson.js",
  "js/letters.js",
  "js/path.js",
  "js/posthog-loader.js",
  "js/rules.js",
  "js/speech.js",
  "js/store.js",
  "js/syllables.js",
  "js/tour.js",
  "js/tutor.js",
  "js/ui.js",
  "js/usage.js",
  "js/version.js",
  "js/views/author.js",
  "js/views/bookmarks.js",
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
  "js/wake.js",
  "manifest.webmanifest",
];
/*END*/
const AUDIO_HOSTS = ["audio.qurancdn.com", "everyayah.com", "verses.quran.com", "mirrors.quranicaudio.com"];
const WORDS_HOST = "audio.qurancdn.com"; // записи слов: сохраняются сами при первом прослушивании
const WORDS_LIMIT = 150 * 1024 * 1024; // предел для них. Суры, скачанные кнопкой, в предел не входят и не удаляются

// На компьютере разработчика код всегда берётся из сети — иначе правки не видны, пока не пересобран список файлов.
const DEV = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$/.test(location.hostname);

// Файл для кэша версии: до трёх попыток — на плохой связи один сорвавшийся запрос не должен отменять всю установку.
async function grab(c, f) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(new Request(f, { cache: "reload" })); // с сервера, а не из HTTP-кэша браузера (иначе новая версия могла получить, например, старый шрифт)
      if (!r.ok) throw new Error(r.status + " " + f);
      return await c.put(f, r);
    } catch (err) {
      if (i >= 2) throw err;
      await new Promise((ok) => setTimeout(ok, 1000 * (i + 1)));
    }
  }
}
self.addEventListener("install", (e) => {
  // новая версия ждёт, пока ученик нажмёт «Обновить» (чтобы не перезагружать страницу посреди урока)
  // файлы качаем по восемь, а не все двести разом: так меньше обрывов на медленной связи
  e.waitUntil((async () => {
    const c = await caches.open(CORE);
    for (let i = 0; i < FILES.length; i += 8) await Promise.all(FILES.slice(i, i + 8).map((f) => grab(c, f)));
    await keepFonts(c).catch(() => {});
    // приложение нигде не открыто (открыта только страница для поисковиков или вообще ничего) — прерывать нечего, включаемся сразу
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (!wins.some((w) => APP_PAGES.includes(new URL(w.url).pathname))) self.skipWaiting();
  })());
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("tanwin-core-") && k !== CORE) await caches.delete(k);
    await self.clients.claim();
  })());
  trimWords(); // включение версии чистку не ждёт
});

// Шрифт на выбор («Шехерезада», «Ното») заранее не качаем: он сохраняется, когда ученик его выбрал (обработчик шрифтов ниже).
// Новая версия переносит его из старой копией, без скачивания. Если файл такого шрифта меняется, ему нужно новое имя.
async function keepFonts(c) {
  for (const k of await caches.keys()) {
    if (!k.startsWith("tanwin-core-") || k === CORE) continue;
    const old = await caches.open(k);
    for (const r of await old.keys()) {
      const f = new URL(r.url).pathname.slice(ROOT.length);
      if (f.startsWith("fonts/") && !FILES.includes(f) && !(await c.match(r))) await c.put(r, await old.match(r));
    }
  }
}

// Записи слов копятся без конца: сверх предела удаляем самые старые (ключи кэша идут в порядке сохранения).
// Слова суры, скачанной кнопкой, не трогаем: у такой суры в кэше есть записи аятов чтеца.
let trimming = null, added = 0;
function trimWords() {
  return trimming ||= (async () => {
    const est = await navigator.storage?.estimate?.().catch(() => null);
    if (est && est.usage < WORDS_LIMIT) return; // всё хранилище меньше предела, значит и слова тоже
    const c = await caches.open(AUDIO);
    const keys = await c.keys();
    const saved = new Set(keys.filter((r) => !r.url.includes(WORDS_HOST)).map((r) => /(\d{3})\d{3}\.mp3$/.exec(r.url)?.[1]));
    const words = [];
    let total = 0;
    for (const r of keys) {
      const s = /\/wbw\/(\d{3})_/.exec(r.url)?.[1];
      if (!s || saved.has(s)) continue;
      const res = await c.match(r);
      const size = +res?.headers.get("content-length") || (await res?.blob())?.size || 0;
      words.push([r, size]);
      total += size;
    }
    for (const [r, size] of words) {
      if (total <= WORDS_LIMIT) break;
      await c.delete(r);
      total -= size;
    }
  })().catch(() => {}).finally(() => { trimming = null; });
}
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

const loading = new Map(); // записи слов, которые сейчас качаются
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
      if (url.hostname !== WORDS_HOST) return fetch(req);
      // запись слова качаем один раз: эта же загрузка и звучит, и ложится в кэш (до 1.34.0 слово скачивалось дважды).
      // Второй запрос того же слова (звук и волна в уроке) ждёт первую загрузку, а не начинает свою
      if (!loading.has(key)) {
        const got = fetch(key);
        loading.set(key, got);
        e.waitUntil(got.then((r) => r.ok && c.put(key, r.clone()).then(() => { if (added++ % 30 === 0) return trimWords(); }))
          .catch(() => {}).finally(() => loading.delete(key)));
      }
      try {
        const r = (await loading.get(key)).clone();
        return r.ok ? rangeResponse(req, r) : r;
      } catch {
        return fetch(req); // сервер не отдал запись для кэша: пусть браузер попробует сам, как раньше
      }
    })());
    return;
  }
  if (url.origin !== location.origin) return;

  // Озвучка букв и слогов: сначала кэш (ответ частями — для Safari)
  if (url.pathname.includes("/audio/")) {
    e.respondWith(caches.match(url.origin + url.pathname).then((hit) => (hit ? rangeResponse(req, hit) : fetch(req))));
    return;
  }
  // Данные и шрифты: сначала кэш
  if (/\/(data|fonts|icons)\//.test(url.pathname)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CORE).then((c) => c.put(req, cp)); } return r; })));
    return;
  }
  // Отдельного приложения «Мой Коран» больше нет (было в 1.22.0–1.22.1): его адрес открывает раздел «Мой Коран» в TanWin
  if (req.mode === "navigate" && url.pathname.startsWith(ROOT + "quran/")) {
    e.respondWith(Response.redirect(ROOT + "#/quran"));
    return;
  }
  // Страницы для поисковиков (/alfavit/…) — не часть приложения: берём из сети, без связи отправляем в приложение
  if (req.mode === "navigate" && !APP_PAGES.includes(url.pathname)) {
    e.respondWith(fetch(req).catch(() => Response.redirect(ROOT)));
    return;
  }
  // Код, стили и страницы: из кэша этой версии — приложение открывается сразу и не зависит от качества связи.
  // Обновление приходит целиком: браузер сам проверяет sw.js, новая версия скачивает все файлы и подменяет старую.
  if (!DEV) {
    e.respondWith((async () => {
      const c = await caches.open(CORE);
      const hit = (await c.match(req, { ignoreSearch: true })) || (req.mode === "navigate" ? await c.match("./") : null);
      return hit || fetch(req);
    })());
    return;
  }
  e.respondWith(fetch(req).then((r) => { if (r.ok) { const cp = r.clone(); caches.open(CORE).then((c) => c.put(req, cp)); } return r; })
    .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
