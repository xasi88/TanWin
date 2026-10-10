// Страницы для поисковиков: обычные HTML-страницы рядом с приложением (у приложения все экраны за «#», поисковик их не видит).
// Тексты не пишутся заново — они берутся из тех же данных, что и уроки (js/letters.js, js/course.js, data/bank.json),
// поэтому при правке урока страница обновится сама. Запускается из tools/build.mjs; руками папки /alfavit, /tajvid и /kak-nauchitsya-chitat-koran не править.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LETTERS, POINTS, ZONES, byId, forms, SHAPE_FAMILIES, SOUND_PAIRS } from "../js/letters.js";
import { BASE_LETTER, LEVELS, glue, isMarkCh, stripStops } from "../js/arabic.js";
import { RULES, parseMarkup, plain as rulesPlain } from "../js/rules.js";
import { UNITS } from "../js/course.js";
import { METRIKA_ID } from "../js/version.js";

const SITE = "https://tanwin.xasi88.ru";
const DIR = "alfavit";
const FORM_NAMES = [["iso", "отдельно"], ["ini", "в начале"], ["med", "в середине"], ["fin", "в конце"]];
const HARAKAT = [["a", "َ", "с фатхой"], ["i", "ِ", "с касрой"], ["u", "ُ", "с даммой"]];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Арабский текст. Разметка таджвида «[код текст]» становится цветной; only — раскрасить только одно правило.
 *  Границы цвета всегда ставим между целыми буквами и склеиваем ZWJ (glue): иначе на части iPhone буквы «рассыпаются». */
function ar(s, cls = "", only = null) {
  s = s.replace(/۟/g, "ْ"); // «кружок — не читается»: в шрифте «Мадина» этого знака нет (как в ui.js)
  if (s.length === 1 && isMarkCh(s)) s = "ـ" + s;
  const inner = s.includes("[")
    ? glue(parseMarkup(s).map(([t, c]) => [t, c && (!only || c === only) ? `tj r-${c}` : ""])).map(([t, c]) => (c ? `<span class="${c}">${esc(t)}</span>` : esc(t))).join("")
    : esc(s);
  return `<span class="ar${cls ? " " + cls : ""}" lang="ar" dir="rtl">${inner}</span>`;
}
/** Обычный текст, в котором встречаются арабские буквы и слова (как mixed() в ui.js). */
const AR_RUN = /[؀-ۿ][؀-ۿ ]*/g;
function mixed(t) {
  let out = "", i = 0;
  for (const m of t.matchAll(AR_RUN)) { out += esc(t.slice(i, m.index)) + ar(m[0].trim()) + (m[0].endsWith(" ") ? " " : ""); i = m.index + m[0].length; }
  return out + esc(t.slice(i));
}
/** Разметка из уроков: {арабский} и **жирный**. */
function rich(s) {
  let out = "", i = 0;
  for (const m of s.matchAll(/\{([^}]+)\}|\*\*([^*]+)\*\*/g)) { out += mixed(s.slice(i, m.index)) + (m[1] ? ar(m[1]) : `<b>${mixed(m[2])}</b>`); i = m.index + m[0].length; }
  return out + mixed(s.slice(i));
}
/** Тот же текст без разметки — для описания страницы. */
const plain = (s) => s.replace(/\[[a-zA-Z]|\]/g, "").replace(/[{}]/g, "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
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

function page({ path, head, desc, keys = "", crumbs = [], body }) {
  const url = `${SITE}/${path}`;
  const ld = crumbs.length ? `\n  <script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: crumbs.map(([name, p], i) => ({ "@type": "ListItem", position: i + 1, name, item: `${SITE}/${p}` })) })}</script>` : "";
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(head)}</title>
  <meta name="description" content="${esc(desc)}">${keys ? `
  <meta name="keywords" content="${esc(keys)}">` : ""}
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
    <p><a href="/kak-nauchitsya-chitat-koran/">Как научиться читать Коран</a> · <a href="/${DIR}/">Арабский алфавит</a> · <a href="/tajvid/">Правила чтения и таджвид</a> · <a href="/" data-app>Открыть приложение</a></p>
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
      <p class="lead">В арабском алфавите 28 букв. Текст пишут и читают справа налево, а буквы в слове соединяются, поэтому у буквы бывает до четырёх форм: отдельно, в начале, в середине и в конце слова. Нажмите на букву — на её странице можно послушать произношение и посмотреть все формы. Огласовки и правила — в разделе <a href="/tajvid/">правила чтения и таджвид</a>.</p>
      <div class="grid">${LETTERS.map((l) => `<a class="cell" href="/${DIR}/${l.id}/">${ar(l.ch)}<b>${esc(l.name)}</b><small>${esc(l.t)}</small></a>`).join("")}</div>
      <section class="card cta">
        <h2>Учите буквы по порядку в TanWin</h2>
        <p>Буквы идут небольшими группами: сначала как выглядят и звучат, потом — как меняются в слове. Короткие уроки с упражнениями и голосом чтеца. Бесплатно и без регистрации.</p>
        <a class="btn" href="/" data-app>Начать учиться</a>
      </section>
    </article>`;
  return page({
    path: `${DIR}/`,
    head: "Арабский алфавит для начинающих: 28 букв с произношением и озвучкой — TanWin",
    desc: "Арабский алфавит для начинающих с нуля, для чтения Корана: как читается и пишется каждая из 28 букв, произношение с озвучкой, формы в начале, середине и конце слова, примеры из Корана. Бесплатно.",
    keys: "арабский алфавит для начинающих, арабский алфавит с произношением, арабский алфавит для чтения Корана, как выучить арабские буквы, арабские буквы с озвучкой",
    crumbs: [["TanWin", ""], ["Арабский алфавит", `${DIR}/`]],
    body,
  });
}

// ================= Правила чтения и таджвид (/tajvid): по странице на урок с теорией =================
const TDIR = "tajvid";
const T_UNITS = [4, 7, 8, 9, 10, 11, 12, 13];
// Адреса страниц. Адрес — навсегда (на него ссылаются поисковики), поэтому он задан здесь, а не выводится из названия урока.
const SLUGS = {
  "4.1": "fatha", "4.2": "kasra", "4.3": "damma", "4.4": "tri-oglasovki", "4.5": "sukun", "4.6": "tanvin",
  "7.1": "dolgoe-aa", "7.2": "dolgie-uu-i-ii", "7.5": "slova-s-sukunom", "7.6": "kalkalya", "7.8": "shadda", "7.9": "gunna",
  "8.1": "ot-slov-k-ayatam", "8.2": "hamzat-al-vasl", "8.3": "lunnye-i-solnechnye-bukvy", "8.4": "imya-allaha", "8.5": "pishetsya-no-ne-chitaetsya", "8.6": "madda",
  "9.1": "mahradzhi", "9.2": "gorlovye-bukvy", "9.3": "yazyk-zadnyaya-chast-i-kraya", "9.4": "yazyk-konchik", "9.5": "guby-i-nos", "9.6": "tyazhelye-i-legkie-bukvy", "9.7": "pohozhie-zvuki",
  "10.1": "nun-sakina-i-tanvin", "10.2": "idgam", "10.3": "iklyab", "10.4": "ihfa", "10.5": "mim-sakina",
  "11.1": "estestvennyy-madd", "11.2": "madd-muttasil-i-munfasil", "11.3": "madd-pri-ostanovke", "11.4": "obyazatelnyy-madd",
  "12.1": "tyazhelaya-i-legkaya-ra", "12.2": "kalkalya-malaya-i-bolshaya", "12.3": "sliyanie-blizkih-bukv",
  "13.1": "vakf-kak-ostanovitsya", "13.2": "znaki-ostanovki",
};
const VOWEL = { fatha: ["a", "َ"], kasra: ["i", "ِ"], damma: ["u", "ُ"] };
const pad = (n) => String(n).padStart(3, "0");
const wbw = (s, a, w) => `https://audio.qurancdn.com/wbw/${pad(s)}_${pad(a)}_${pad(w)}.mp3`;
const isTheory = (l) => l.steps.some((s) => ["card", "rule", "zone"].includes(s.t));
const clean = (s) => s.replace(/\s+/g, " ").trim();

const SUR = {};
const surah = (root, s) => (SUR[s] ||= JSON.parse(readFileSync(join(root, `data/q/${pad(s)}.json`), "utf8")));
// Таблицы, которые урок показывает картинкой (начальные буквы сур, знаки остановки), описаны в js/lesson.js — берём их оттуда же.
function lessonConst(root, name) {
  const m = readFileSync(join(root, "js/lesson.js"), "utf8").match(new RegExp(`^const ${name} = (\\[.*\\]);$`, "m"));
  if (!m) throw new Error(`pages: в js/lesson.js не найден ${name}`);
  return JSON.parse(m[1]);
}

/** Примеры правила из Корана: сначала из учебных сур (Аль-Фатиха, Джуз Амма), короткие слова, без повторов. */
const EX = {};
function ruleExamples(root, code, n = 4) {
  if (EX[code]) return EX[code];
  const out = [], seen = new Set();
  const take = (w, s, a, wi) => {
    const p = rulesPlain(stripStops(w));
    if (!w.includes("[" + code) || seen.has(p) || p.replace(/[^ء-يٱ]/g, "").length > 7) return;
    seen.add(p); out.push({ w: stripStops(w), s, a, wi });
  };
  const order = [1, ...Array.from({ length: 37 }, (_, i) => 114 - i), ...Array.from({ length: 76 }, (_, i) => i + 2)];
  for (const s of order) { if (out.length >= n) break; surah(root, s).v.forEach((v, ai) => v[0].forEach((w, wi) => out.length < n && take(w, s, ai + 1, wi + 1))); }
  if (out.length < n) for (const [s, a, , words] of JSON.parse(readFileSync(join(root, "data/rare.json"), "utf8"))[code] || []) words.forEach((w, wi) => out.length < n && take(w, s, a, wi + 1));
  return (EX[code] = out);
}

const playTile = (file, label, body) => `<button class="play" type="button" data-play="/audio/letters/${file}.mp3" aria-label="${esc(label)}">${PLAY}${body}</button>`;
const wordBtn = (html, audio, small) => `<button class="word" type="button" data-play="${audio}">${html}${small ? `<small>${esc(small)}</small>` : ""}</button>`;

function cardHtml(root, st) {
  const x = [];
  if (st.big) x.push(`<div class="big">${ar(st.big)}</div>`);
  if (st.caption) x.push(`<p class="muted">${rich(st.caption)}</p>`);
  if (st.sounds) x.push(`<div class="plays">${Object.values(VOWEL).map(([k, mark]) => playTile(`${st.sounds}-${k}`, byId[st.sounds].name, ar(byId[st.sounds].ch + mark))).join("")}</div>`);
  if (st.sounds1 && VOWEL[st.vowel]) x.push(`<div class="plays">${st.sounds1.map((id) => playTile(`${id}-${VOWEL[st.vowel][0]}`, byId[id].name, ar(byId[id].ch + VOWEL[st.vowel][1]))).join("")}</div>`);
  if (st.ruleWheel) x.push(`<div class="wheel">${[["Изхар", "ء ه ع ح غ خ", "ясно", ""], ["Идгам", "ي ر م ل و ن", "слияние", "d"], ["Икляб", "ب", "н → м", "i"], ["Ихфа", "15 букв", "скрыто", "f"]]
    .map(([n, l, s, c]) => `<div style="--rc:${c ? `var(--r-${c})` : "var(--ink-2)"}"><b>${n}</b><span>${mixed(l)}</span><small>${s}</small></div>`).join("")}</div>`);
  if (st.stopSigns) x.push(`<div class="stops">${lessonConst(root, "STOP_SIGNS").map(([s, n, m]) => `<div>${ar("ـ" + s + "ـ")}<b>${esc(n)}</b><small>${esc(m)}</small></div>`).join("")}</div>`);
  if (st.muqattaat) x.push(`<div class="words">${lessonConst(root, "MUQ").map(([t, a, tr]) => wordBtn(ar(t), `https://audio.qurancdn.com/wbw/${a}.mp3`, tr)).join("")}</div>`);
  if (st.verse) {
    const [s, a] = st.verse.split(":").map(Number);
    x.push(`<div class="verse" dir="rtl">${surah(root, s).v[a - 1][0].map((w, i) => wordBtn(ar(w), wbw(s, a, i + 1))).join("")}</div><div class="plays"><button class="play" type="button" data-play="https://everyayah.com/data/Husary_Muallim_128kbps/${pad(s)}${pad(a)}.mp3">${PLAY}<span>Послушать аят целиком</span></button></div><p class="muted">Сура ${s}, аят ${a}. Нажмите на слово, чтобы услышать чтеца.</p>`);
  }
  return `      <section class="card theory">
        <h2>${st.icon ? esc(st.icon) + " " : ""}${mixed(st.title)}</h2>
        ${(st.body || []).map((p) => `<p>${rich(p)}</p>`).join("\n        ")}
        ${x.join("\n        ")}
      </section>`;
}
function ruleHtml(root, code) {
  const r = RULES[code], ex = ruleExamples(root, code);
  return `      <section class="card rule" style="--rc:var(--r-${code})">
        <div class="rule-head"><i></i><div><h2>${esc(r.name)}</h2><div class="muted">${rich(r.short)}</div></div></div>
        <p>${rich(r.text)}</p>
        ${ex.length ? `<p class="label">Примеры из Корана — нажмите, чтобы послушать</p>
        <div class="words">${ex.map((e) => wordBtn(ar(e.w, "", code), wbw(e.s, e.a, e.wi), `${e.s}:${e.a}`)).join("")}</div>` : ""}
      </section>`;
}
const zoneHtml = (id) => `      <section class="card theory">
        <h2>${esc(ZONES[id].ru)}</h2>
        <p class="muted">${esc(ZONES[id].name)}</p>
        <p>${rich(ZONES[id].text)}</p>
      </section>`;

function topicPage(root, unit, l, prev, next) {
  const parts = l.steps.map((st) => (st.t === "card" ? cardHtml(root, st) : st.t === "rule" ? ruleHtml(root, st.code) : st.t === "zone" ? zoneHtml(st.id) : "")).filter(Boolean);
  const quiz = l.steps.filter((st) => st.t === "quiz");
  const name = clean(l.title);
  const first = l.steps.find((st) => st.t === "card" && st.body?.length)?.body[0] || RULES[l.rule]?.text || l.sub;
  let desc = plain(first);
  if (desc.length > 170) desc = desc.slice(0, 170).replace(/\s+\S*$/, "") + "…";
  const link = (o, dir) => `<a href="/${TDIR}/${SLUGS[o.id]}/">${dir < 0 ? "← " : ""}${mixed(clean(o.title))}${dir > 0 ? " →" : ""}</a>`;
  const body = `    <article>
      <h1>${mixed(name)}</h1>
      <p class="lead">${mixed(l.sub)}</p>
${parts.join("\n")}
${quiz.length ? `      <section>
        <h2>Проверьте себя</h2>
        ${quiz.map((q) => `<details><summary>${rich(q.q)}</summary><p><b>${rich(q.a[0])}.</b> ${rich(q.why || "")}</p></details>`).join("\n        ")}
      </section>
` : ""}      <section class="card cta">
        <h2>Закрепите на упражнениях</h2>
        <p>В приложении TanWin к этой теме есть упражнения с голосом чтеца: услышать, найти в слове, прочитать самому. Бесплатно и без регистрации.</p>
        <a class="btn" href="/#/learn/${l.id}" data-app>Открыть урок в приложении</a>
      </section>
      <nav class="pager">
        ${prev ? link(prev, -1) : "<span></span>"}
        <a href="/${TDIR}/">Все темы</a>
        ${next ? link(next, 1) : "<span></span>"}
      </nav>
    </article>`;
  return page({
    path: `${TDIR}/${SLUGS[l.id]}/`,
    head: `${name} — ${l.sub.replace(/[.!?]$/, "")} | Таджвид`,
    desc,
    crumbs: [["TanWin", ""], ["Правила чтения и таджвид", `${TDIR}/`], [name, `${TDIR}/${SLUGS[l.id]}/`]],
    body,
  });
}

function topicsIndex(units) {
  const body = `    <article>
      <h1>Правила чтения Корана и таджвид</h1>
      <p class="lead">Темы идут в том же порядке, что и уроки TanWin: от огласовок до правил остановки. На каждой странице — объяснение и примеры из Корана, которые можно послушать. Буквы собраны отдельно: <a href="/${DIR}/">арабский алфавит</a>.</p>
${units.map(([u, ls]) => `      <section>
        <h2>${esc(u.title)}</h2>
        <p class="muted">${mixed(u.sub)}</p>
        <ul class="topics">${ls.map((l) => `<li><a href="/${TDIR}/${SLUGS[l.id]}/"><b>${mixed(clean(l.title))}</b><span>${mixed(l.sub)}</span></a></li>`).join("")}</ul>
      </section>`).join("\n")}
      <section class="card cta">
        <h2>Учитесь по порядку в TanWin</h2>
        <p>К каждой теме в приложении есть упражнения с голосом чтеца. Короткие уроки — от первой буквы до чтения сур. Бесплатно и без регистрации.</p>
        <a class="btn" href="/" data-app>Начать учиться</a>
      </section>
    </article>`;
  return page({
    path: `${TDIR}/`,
    head: "Таджвид для начинающих: правила чтения Корана с нуля простыми словами — TanWin",
    keys: "таджвид для начинающих, таджвид с нуля, таджвид правила чтения Корана, правила чтения Корана для начинающих, таджвид простыми словами",
    desc: "Таджвид с нуля простыми словами. Правила чтения Корана для начинающих: огласовки, сукун, шадда, махраджи, идгам, ихфа, икляб, мадды, калькаля, остановки. С примерами из Корана и голосом чтеца. Бесплатно.",
    crumbs: [["TanWin", ""], ["Правила чтения и таджвид", `${TDIR}/`]],
    body,
  });
}

// ================= Статья «Как научиться читать Коран с нуля» =================
// Единственная страница, текст которой написан отдельно (одобрен автором 2026-10-05), а не взят из уроков: она проводит по всему пути
// и ссылается на страницы букв и правил. Ссылки заданы номерами уроков — если урок исчезнет, сборка остановится.
const ADIR = "kak-nauchitsya-chitat-koran";
function articlePage() {
  const t = (id, name) => { if (!SLUGS[id]) throw new Error(`pages: статья ссылается на урок ${id}, у которого нет страницы`); return `<a class="mini" href="/${TDIR}/${SLUGS[id]}/"><span>${name}</span></a>`; };
  const links = (...a) => `<div class="row">${a.join("")}</div>`;
  const body = `    <article>
      <h1>Как научиться читать Коран с нуля</h1>
      <p class="lead">Читать Коран по-арабски может научиться любой человек, даже если он не знает ни одной арабской буквы. Для этого не нужно учить арабский язык: чтение и понимание языка — разные умения. Нужны порядок, регулярность и возможность слышать правильное произношение.</p>
      <p>Ниже — путь из семи шагов. По этому же пути построены уроки TanWin.</p>
      <section>
        <h2>Шаг 1. Буквы</h2>
        <p>В арабском алфавите 28 букв. Пишут и читают справа налево. Начните с того, как каждая буква выглядит и как звучит. Некоторых звуков в русском языке нет, поэтому букву важно не только увидеть, но и услышать.</p>
        ${links(`<a class="mini" href="/${DIR}/"><span>Арабский алфавит — все буквы с озвучкой</span></a>`)}
      </section>
      <section>
        <h2>Шаг 2. Формы букв в слове</h2>
        <p>Арабские буквы в слове соединяются, и от этого буква меняет вид: в начале, в середине и в конце слова она выглядит по-разному. Шесть букв не соединяются со следующей. Когда вы узнаёте букву в любой форме, слово перестаёт быть сплошной линией.</p>
      </section>
      <section>
        <h2>Шаг 3. Огласовки</h2>
        <p>Буквы в арабском письме — это согласные. Гласные звуки обозначают значки над буквой и под ней: фатха, касра и дамма. Сукун показывает, что гласной нет, а танвин добавляет в конце звук «н».</p>
        ${links(t("4.1", "Фатха"), t("4.2", "Касра"), t("4.3", "Дамма"), t("4.5", "Сукун"), t("4.6", "Танвин"))}
      </section>
      <section>
        <h2>Шаг 4. Слоги и слова</h2>
        <p>Буква с огласовкой — это слог. Слог за слогом складывается слово. На этом шаге появляются долгие гласные и шадда — удвоение буквы. Учиться лучше сразу на настоящих словах Корана.</p>
        ${links(t("7.1", "Долгое «аа»"), t("7.2", "Долгие «уу» и «ии»"), t("7.8", "Шадда"))}
      </section>
      <section>
        <h2>Шаг 5. Аяты</h2>
        <p>Слова, прочитанные подряд на одном дыхании, складываются в аят. Здесь встречаются особенности письма мусхафа: буквы, которые пишутся, но не читаются, и алиф, который произносится только в начале чтения.</p>
        ${links(t("8.1", "От слов к аятам"), t("8.2", "Хамзат-уль-васль"), t("8.3", "Лунные и солнечные буквы"), t("8.5", "Пишется, но не читается"))}
      </section>
      <section>
        <h2>Шаг 6. Таджвид</h2>
        <p>Таджвид — это правила, по которым Коран читают так, как он был ниспослан: где звук тянется, где сливается со следующим, где звучит через нос, где нужно остановиться. К таджвиду переходят, когда чтение по слогам уже не вызывает труда.</p>
        ${links(t("9.1", "Махраджи"), t("10.1", "Нун сакина и танвин"), t("11.1", "Мадды"), t("7.6", "Калькаля"), t("13.1", "Остановка"), `<a class="mini" href="/${TDIR}/"><span>Все правила</span></a>`)}
      </section>
      <section>
        <h2>Шаг 7. Суры</h2>
        <p>Начинают обычно с суры «Аль-Фатиха» и коротких сур в конце Корана. Читайте медленно, слушая чтеца и повторяя за ним.</p>
      </section>
      <section>
        <h2>Что помогает дойти до конца</h2>
        <ul class="tips">
          <li><b>Понемногу, но каждый день.</b> Десять минут ежедневно дают больше, чем час раз в неделю.</li>
          <li><b>Слушайте чтеца.</b> Произношение нельзя выучить по описанию: каждую букву и каждое слово нужно услышать.</li>
          <li><b>Не перескакивайте.</b> Каждый шаг опирается на предыдущий.</li>
          <li><b>Проверяйте себя у знающего человека.</b> Приложение и книга научат читать, но ошибки в произношении лучше всего слышит учитель. Когда начнёте читать суры, прочитайте их тому, кто хорошо читает сам.</li>
        </ul>
      </section>
      <section class="card cta">
        <h2>Учитесь в TanWin — бесплатно</h2>
        <p>В TanWin весь этот путь разбит на короткие уроки с упражнениями. Каждое слово и каждый аят звучат голосом чтеца, а ошибки возвращаются на повторение. Приложение полностью бесплатное, работает без регистрации и без интернета.</p>
        <a class="btn" href="/" data-app>Начать учиться</a>
      </section>
    </article>`;
  return page({
    path: `${ADIR}/`,
    head: "Как научиться читать Коран с нуля самостоятельно: 7 шагов от букв до сур — TanWin",
    desc: "Как научиться читать Коран на арабском с нуля самостоятельно, в домашних условиях. Пошаговый путь для начинающих: буквы, огласовки, слоги, слова, аяты, таджвид и суры. С озвучкой и бесплатным приложением.",
    keys: "как научиться читать Коран, научиться читать Коран с нуля, как научиться читать Коран самостоятельно, читать Коран на арабском, уроки чтения Корана для начинающих, как быстро научиться читать Коран",
    crumbs: [["TanWin", ""], ["Как научиться читать Коран с нуля", `${ADIR}/`]],
    body,
  });
}

/** Создаёт страницы и возвращает их адреса (для карты сайта). */
export function buildPages(root) {
  // рядом с каждой страницей — js/app.js: «спасатель» для тех, у кого ещё старая версия приложения (см. tools/pages-rescue.js)
  const rescue = readFileSync(join(root, "tools/pages-rescue.js"), "utf8");
  const urls = [];
  const put = (path, html) => {
    const dir = join(root, path);
    mkdirSync(join(dir, "js"), { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
    writeFileSync(join(dir, "js/app.js"), rescue);
    urls.push(path);
  };
  for (const d of [DIR, TDIR, ADIR]) rmSync(join(root, d), { recursive: true, force: true });

  put(`${ADIR}/`, articlePage());
  put(`${DIR}/`, indexPage());
  LETTERS.forEach((l, i) => put(`${DIR}/${l.id}/`, letterPage(root, l, i)));

  const units = UNITS.filter((u) => T_UNITS.includes(u.id)).map((u) => [u, u.lessons.filter(isTheory)]);
  const topics = units.flatMap(([u, ls]) => ls.map((l) => [u, l]));
  const noSlug = topics.filter(([, l]) => !SLUGS[l.id]).map(([, l]) => `${l.id} ${l.title}`);
  if (noSlug.length) throw new Error(`pages: у уроков с теорией нет адреса страницы — добавьте в SLUGS (tools/pages.mjs): ${noSlug.join("; ")}`);
  put(`${TDIR}/`, topicsIndex(units));
  topics.forEach(([u, l], i) => put(`${TDIR}/${SLUGS[l.id]}/`, topicPage(root, u, l, topics[i - 1]?.[1], topics[i + 1]?.[1])));
  return urls;
}
