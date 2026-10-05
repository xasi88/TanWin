// Страницы для поисковиков: обычные HTML-страницы рядом с приложением (у приложения все экраны за «#», поисковик их не видит).
// Тексты не пишутся заново — они берутся из тех же данных, что и уроки (js/letters.js, js/course.js, data/bank.json),
// поэтому при правке урока страница обновится сама. Запускается из tools/build.mjs; руками папку /alfavit не править.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LETTERS, POINTS, ZONES, byId, forms, SHAPE_FAMILIES, SOUND_PAIRS } from "../js/letters.js";
import { BASE_LETTER, LEVELS } from "../js/arabic.js";
import { METRIKA_ID } from "../js/version.js";

const SITE = "https://tanwin.xasi88.ru";
const DIR = "alfavit";
const FORM_NAMES = [["iso", "отдельно"], ["ini", "в начале"], ["med", "в середине"], ["fin", "в конце"]];
const HARAKAT = [["a", "َ", "с фатхой"], ["i", "ِ", "с касрой"], ["u", "ُ", "с даммой"]];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ar = (s, cls = "") => `<span class="ar${cls ? " " + cls : ""}" lang="ar" dir="rtl">${esc(s)}</span>`;
/** Разметка из уроков: {арабский} и **жирный**. */
const rich = (s) => esc(s).replace(/\{([^}]+)\}/g, (_, a) => ar(a)).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
/** Тот же текст без разметки — для описания страницы. */
const plain = (s) => s.replace(/[{}]/g, "").replace(/\*\*/g, "");
const title = (l) => `Буква ${l.name} (${l.ch})`;

const LOGO = `<svg class="logo" viewBox="0 0 64 64" width="34" height="34" aria-hidden="true"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd97a"/><stop offset="1" stop-color="#d49a24"/></linearGradient></defs><path d="M32 2l6.9 13.4 14.3-4.6-4.6 14.3L62 32l-13.4 6.9 4.6 14.3-14.3-4.6L32 62l-6.9-13.4-14.3 4.6 4.6-14.3L2 32l13.4-6.9-4.6-14.3 14.3 4.6Z" fill="url(#lg)"/><circle cx="32" cy="33.5" r="17" fill="#0b3b30"/><path d="M32 27.5c-3.6-2.5-8.6-3.3-13.2-2.8v16.8c4.6-.5 9.6.3 13.2 2.8Z" fill="#ffd97a"/><path d="M32 27.5c3.6-2.5 8.6-3.3 13.2-2.8v16.8c-4.6-.5-9.6.3-13.2 2.8Z" fill="#f2c257"/></svg>`;
const PLAY = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>`;

// Звук по нажатию и анонимная статистика. Статистику ученик мог отключить в приложении («Ещё → Данные») — тогда не считаем и здесь.
const SCRIPT = `<script>
(function () {
  var a = new Audio();
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-play]");
    if (b) { a.src = b.getAttribute("data-play"); a.play().catch(function () {}); }
    if (e.target.closest("[data-app]") && window.ym) ym(${METRIKA_ID}, "reachGoal", "page_to_app", { "Страница": location.pathname });
  });
  var off = false;
  try { off = JSON.parse(localStorage.getItem("tanwin.v2")).settings.analytics === false; } catch (e) {}
  if (off || !${METRIKA_ID} || /^(localhost|127\\.)/.test(location.hostname)) return;
  window.ym = window.ym || function () { (ym.a = ym.a || []).push(arguments); }; ym.l = Date.now();
  var s = document.createElement("script"); s.async = true; s.src = "https://mc.yandex.ru/metrika/tag.js"; document.head.appendChild(s);
  ym(${METRIKA_ID}, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
})();
</script>`;

function page({ path, head, desc, crumbs = [], body }) {
  const url = `${SITE}/${path}`;
  const ld = crumbs.length ? `\n  <script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: crumbs.map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE}/${p}` })) })}</script>` : "";
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(head)}</title>
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="TanWin">
  <meta property="og:title" content="${esc(head)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:image" content="${SITE}/icons/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#fbf7ef">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" href="/icons/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/icons/icon-192.png">
  <link rel="preload" href="/fonts/hafs.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/nunito.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/css/pages.css">${ld}
</head>
<body>
  <header class="top">
    <a class="brand" href="/" data-app>${LOGO}<span>TanWin</span></a>
    <a class="btn small" href="/" data-app>Открыть приложение</a>
  </header>
  <main>
${crumbs.length > 1 ? `    <nav class="crumbs" aria-label="Вы здесь">${crumbs.slice(0, -1).map(([n, p]) => `<a href="/${p}">${esc(n)}</a>`).join(" › ")} › <span>${esc(crumbs.at(-1)[0])}</span></nav>\n` : ""}${body}
  </main>
  <footer class="foot">
    <p><a href="/" data-app>TanWin</a> — бесплатное приложение для тех, кто учится читать Коран: от первой буквы до чтения сур по правилам таджвида.</p>
    <p><a href="/${DIR}/">Арабский алфавит</a> · <a href="/" data-app>Открыть приложение</a></p>
  </footer>
  ${SCRIPT}
</body>
</html>
`;
}

// ---------- Слова Корана с буквой: как в карточке буквы в уроке — сначала самые простые по огласовкам, среди них самые частые ----------
let BANK = null;
function examples(root, l, n = 4) {
  BANK ||= JSON.parse(readFileSync(join(root, "data/bank.json"), "utf8"));
  const lvl = (w) => LEVELS.indexOf(w[3]);
  const letters = (w) => w.replace(/[^ء-ي]/g, "");
  const first = (w) => { const c = letters(w)[0]; return BASE_LETTER[c] || c; };
  const want = l.id === "hamza" ? "ء" : l.ch;
  const pool = BANK.filter((w) => (l.id === "alif" ? w[3] === "madd" && w[0].includes("َا") : lvl(w) >= 0 && lvl(w) <= LEVELS.indexOf("shadda") && first(w[0]) === want))
    .filter((w) => letters(w[0]).length <= 4)
    .sort((a, b) => lvl(a) - lvl(b) || b[2] - a[2]);
  const out = [];
  for (const w of pool) { if (out.length >= n) break; if (!out.some((x) => x[4] === w[4])) out.push(w); }
  return out.map(([w, key, , , tr]) => ({ w, tr, audio: `https://audio.qurancdn.com/wbw/${key}.mp3` }));
}

function lessonFor(root, id) {
  const src = readFileSync(join(root, "js/course.js"), "utf8");
  for (const m of src.matchAll(/\{ id: "(2\.\d+)", title: "([^"]*)", sub: "[^"]*", letters: \[([^\]]*)\]/g)) if (m[3].includes(`"${id}"`)) return { id: m[1], title: m[2] };
  return null;
}

function letterPage(root, l, i) {
  const has = (f) => existsSync(join(root, "audio/letters", f));
  const point = POINTS[l.point], zone = ZONES[point.zone], f = forms(l);
  const chips = [l.heavy && "тяжёлая", l.q && "калькаля", l.nc && "не соединяется дальше", l.dots].filter(Boolean);
  const plays = [
    has(`${l.id}.mp3`) && `<button class="play" type="button" data-play="/audio/letters/${l.id}.mp3">${PLAY}<span>Название: «${esc(l.name)}»</span></button>`,
    ...HARAKAT.map(([k, mark, label]) => has(`${l.id}-${k}.mp3`) && `<button class="play" type="button" data-play="/audio/letters/${l.id}-${k}.mp3" aria-label="${esc(l.name)} ${label}">${PLAY}${ar((l.id === "hamza" ? (k === "i" ? "إ" : "أ") : l.ch) + mark)}<small>${label}</small></button>`),
  ].filter(Boolean);
  const pairs = SOUND_PAIRS.filter((p) => p.slice(0, 2).includes(l.id)).map(([a, b, note]) => ({ o: byId[a === l.id ? b : a], note }));
  const family = (SHAPE_FAMILIES.find((g) => g.includes(l.id)) || []).filter((x) => x !== l.id).map((x) => byId[x]);
  const link = (o) => `<a class="mini" href="/${DIR}/${o.id}/">${ar(o.ch)}<span>${esc(o.name)}</span></a>`;
  const ex = examples(root, l);
  const lesson = lessonFor(root, l.id);
  const prev = LETTERS[i - 1], next = LETTERS[i + 1];
  const body = `    <article>
      <h1>${esc(title(l))}: как читается и пишется</h1>
      <div class="card hero">
        <div class="glyph">${ar(l.ch)}</div>
        <div>
          <div class="name">${esc(l.name)} ${ar(l.ar)}</div>
          <div class="sound">Звук: <b>${esc(l.t)}</b></div>
          <div class="chips">${chips.map((c) => `<span>${esc(c)}</span>`).join("")}</div>
        </div>
      </div>
      <section>
        <h2>Как произносится буква ${esc(l.name)}</h2>
        <p>${rich(l.sound)}</p>
        ${plays.length ? `<div class="plays">${plays.join("")}</div>` : ""}
        ${l.tip ? `<p class="tip">${rich(l.tip)}</p>` : ""}
      </section>
      <section>
        <h2>Как пишется: формы в слове</h2>
        <div class="forms">${FORM_NAMES.map(([k, n]) => `<div>${ar(f[k])}<small>${n}</small></div>`).join("")}</div>
      </section>
      <section>
        <h2>Где рождается звук</h2>
        <p><b>${esc(point.label)}.</b> Область: ${esc(zone.ru.toLowerCase())} (${esc(zone.name)}).</p>
        <p>${rich(zone.text)}</p>
      </section>
${pairs.length || family.length ? `      <section>
        <h2>С какими буквами её путают</h2>
        ${pairs.length ? `<ul class="pairs">${pairs.map((p) => `<li>${link(p.o)}<span>${esc(p.note)}</span></li>`).join("")}</ul>` : ""}
        ${family.length ? `<p>Похожи по начертанию и отличаются точками:</p><div class="row">${family.map(link).join("")}</div>` : ""}
      </section>
` : ""}${ex.length ? `      <section>
        <h2>${l.id === "alif" ? "Алиф в словах Корана" : "Слова Корана с этой буквы"}</h2>
        <div class="words">${ex.map((w) => `<button class="word" type="button" data-play="${w.audio}">${ar(w.w)}<small>${esc(w.tr)}</small></button>`).join("")}</div>
        <p class="muted">Нажмите на слово, чтобы услышать чтеца.</p>
      </section>
` : ""}      <section class="card cta">
        <h2>Выучите арабские буквы в TanWin</h2>
        <p>Короткие уроки с упражнениями и голосом чтеца — от алфавита до чтения сур. Бесплатно и без регистрации.</p>
        <a class="btn" href="/${lesson ? `#/learn/${lesson.id}` : ""}" data-app>${lesson ? "Учить эту букву в приложении" : "Открыть приложение"}</a>
      </section>
      <nav class="pager">
        ${prev ? `<a href="/${DIR}/${prev.id}/">← ${esc(prev.name)} ${ar(prev.ch)}</a>` : "<span></span>"}
        <a href="/${DIR}/">Все буквы</a>
        ${next ? `<a href="/${DIR}/${next.id}/">${ar(next.ch)} ${esc(next.name)} →</a>` : "<span></span>"}
      </nav>
    </article>`;
  return page({
    path: `${DIR}/${l.id}/`,
    head: `${title(l)} — как читается и пишется | Арабский алфавит`,
    desc: `${plain(l.sound)} Произношение с озвучкой, формы буквы в слове и примеры из Корана.`,
    crumbs: [["TanWin", ""], ["Арабский алфавит", `${DIR}/`], [title(l), `${DIR}/${l.id}/`]],
    body,
  });
}

function indexPage() {
  const body = `    <article>
      <h1>Арабский алфавит: 28 букв с озвучкой</h1>
      <p class="lead">В арабском алфавите 28 букв. Текст пишут и читают справа налево, а буквы в слове соединяются, поэтому у буквы бывает до четырёх форм: отдельно, в начале, в середине и в конце слова. Нажмите на букву — на её странице можно послушать произношение и посмотреть все формы.</p>
      <div class="grid">${LETTERS.map((l) => `<a class="cell" href="/${DIR}/${l.id}/">${ar(l.ch)}<b>${esc(l.name)}</b><small>${esc(l.t)}</small></a>`).join("")}</div>
      <section class="card cta">
        <h2>Учите буквы по порядку в TanWin</h2>
        <p>Буквы идут небольшими группами: сначала как выглядят и звучат, потом — как меняются в слове. Короткие уроки с упражнениями и голосом чтеца. Бесплатно и без регистрации.</p>
        <a class="btn" href="/" data-app>Начать учиться</a>
      </section>
    </article>`;
  return page({
    path: `${DIR}/`,
    head: "Арабский алфавит: 28 букв с произношением и озвучкой — TanWin",
    desc: "Все буквы арабского алфавита: как читается и пишется каждая, озвучка, формы в начале, середине и конце слова, примеры из Корана. Бесплатно.",
    crumbs: [["TanWin", ""], ["Арабский алфавит", `${DIR}/`]],
    body,
  });
}

/** Создаёт страницы и возвращает их адреса (для карты сайта). */
export function buildPages(root) {
  const out = join(root, DIR);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, "index.html"), indexPage());
  LETTERS.forEach((l, i) => { mkdirSync(join(out, l.id)); writeFileSync(join(out, l.id, "index.html"), letterPage(root, l, i)); });
  return [`${DIR}/`, ...LETTERS.map((l) => `${DIR}/${l.id}/`)];
}
