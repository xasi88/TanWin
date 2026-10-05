// Мой Коран: список сур и джузов и чтение на весь экран (сплошной текст, по аятам с переводом, постранично) —
// с таджвидом, пословным аудио, чтецом и автопрокруткой.
import { h, ar, icon, tr, modal, toast, plural, rich, sizeButton, keep, confetti } from "../ui.js";
import { g } from "../speech.js";
import { loadSurahs, loadSurah, surahMeta, wordKey, RECITERS } from "../data.js";
import { RULES, LEGEND, plain, rulesIn } from "../rules.js";
import { translit, stripStops } from "../arabic.js";
import { playWord, playAyah, stop, onPlay, playingId } from "../audio.js";
import { store, surahDone, readTick, readPage, readGoalDone } from "../store.js";
import { go } from "../app.js";
import { wakeWhile } from "../wake.js";
import { marks, addMark, marksSheet, planText, doneToday, setMark } from "./bookmarks.js";
import { enterFullscreen, exitFullscreen, isFullscreen, wantFullscreen, onFullscreenChange } from "../fullscreen.js";

export const arNum = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const BISMILLAH = "بِسۡمِ [wٱ]للَّهِ [wٱ][lل]رَّحۡمَ[nـٰ]نِ [wٱ][lل]رَّح[pِي]مِ";

// ---------- Мусхаф Мадины: страницы и джузы ----------
export const PAGES = 604;
export const JUZ_PAGE = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];
// с какого аята начинается каждый джуз: [сура, аят]
const JUZ_START = [[1, 1], [2, 142], [2, 253], [3, 93], [4, 24], [4, 148], [5, 82], [6, 111], [7, 88], [8, 41], [9, 93], [11, 6], [12, 53], [15, 1], [17, 1], [18, 75], [21, 1], [23, 1], [25, 21], [27, 56], [29, 46], [33, 31], [36, 28], [39, 32], [41, 47], [46, 1], [51, 31], [58, 1], [67, 1], [78, 1]];
const juzOfPage = (p) => { let j = 0; while (j < 29 && JUZ_PAGE[j + 1] <= p) j++; return j + 1; };
/** Суры джуза j: [{ s, from, to }]; to = 0 — до конца суры. */
function juzParts(j) {
  const [s0, a0] = JUZ_START[j - 1], nx = JUZ_START[j];
  const s1 = !nx ? 114 : nx[1] > 1 ? nx[0] : nx[0] - 1;
  return Array.from({ length: s1 - s0 + 1 }, (_, i) => ({ s: s0 + i, from: i ? 1 : a0, to: nx && s0 + i === nx[0] ? nx[1] - 1 : 0 }));
}

export function legendModal() {
  modal(h("div.legend", null,
    h("h2", null, "Цвета таджвида"),
    h("p.muted", null, "Цвет показывает правило чтения. Нажмите на любое слово в мусхафе — увидите, какие правила в нём есть."),
    h("div.legend-list", null, ...LEGEND.map((c) => h("div.lg-row", null, h("span.lg-sw", { style: { background: `var(--r-${c})` } }), h("div", null, h("b", null, RULES[c].name), h("small.muted", null, rich(RULES[c].short)))))),
    h("a.btn.secondary.wide", { href: "#/rules" }, "Подробно о правилах")));
}

// ---------- «Мой Коран»: последнее место, 30 джузов, все суры ----------
let mqView = 0; // что открыто: 0 — главный список, -1 — 30 джузов, 1…30 — суры джуза; помним до перезагрузки
export async function MyQuran() {
  const list = await loadSurahs();
  const reads = store.get().reads || {};
  const ayahs = (n) => `${n} ${plural(n, "аят", "аята", "аятов")}`;
  // from > 1 — сура открывается с аята, с которого начинается джуз
  const row = (s, from = 1, page = s.page) => h("a.surah-row", { href: `#/read/${s.id}${from > 1 ? `/${from}` : ""}`, onclick: () => enterFullscreen() },
    h("span.sr-num", null, h("span", null, s.id)),
    h("div.sr-main", null, h("b", null, s.ru), h("small.muted", null, s.meaning), h("small.muted", null, `${from > 1 ? `с аята ${from} · ` : ""}${ayahs(s.verses)} · ${s.place === "м" ? "мекканская" : "мединская"} · стр. ${page}`)),
    surahDone(s.id) || reads[s.id] ? h("span.sr-done", { title: "Прочитана" }, icon("check", { size: 16, sw: 3 })) : null,
    h("span.sr-ar", null, ar(s.ar)));
  const juzSub = (j) => {
    const parts = juzParts(j), first = list[parts[0].s - 1], last = list[parts[parts.length - 1].s - 1];
    return `стр. ${JUZ_PAGE[j - 1]}–${(JUZ_PAGE[j] || PAGES + 1) - 1} · ${first.ru}${last !== first ? ` — ${last.ru}` : ""}`;
  };
  const body = h("div.mq-body");
  let scrub = null;
  const open = (v) => { mqView = v; draw(); window.scrollTo(0, 0); };
  const back = (label, to) => h("button.btn.ghost.mq-back", { type: "button", onclick: () => open(to) }, icon("left", { size: 18 }), label);
  const draw = () => {
    scrub?.off();
    scrub = null;
    if (mqView > 0) { // суры одного джуза — и ничего больше
      const j = mqView;
      body.replaceChildren(
        back("30 джузов", -1),
        h("h2.mq-h", null, `Джуз ${j}`), h("p.muted.mq-sub", null, juzSub(j)),
        h("a.btn.primary.wide", { href: `#/juz/${j}`, onclick: () => enterFullscreen() }, icon("book", { size: 18 }), `Читать джуз ${j} целиком`),
        h("div.surah-list", null, ...juzParts(j).map((p, i) => row(list[p.s - 1], p.from, i ? list[p.s - 1].page : JUZ_PAGE[j - 1]))));
    } else if (mqView < 0) { // только 30 джузов
      body.replaceChildren(
        back("Мой Коран", 0),
        h("h2.mq-h", null, "30 джузов"),
        h("div.surah-list", null, ...JUZ_START.map((_, i) => h("button.surah-row.juz-row", { type: "button", onclick: () => open(i + 1) },
          h("span.sr-num", null, h("span", null, i + 1)),
          h("div.sr-main", null, h("b", null, `Джуз ${i + 1}`), h("small.muted", null, juzSub(i + 1))),
          icon("right", { size: 20 })))));
    } else {
      const surahs = h("div.surah-list", null, ...list.map((s) => row(s)));
      body.replaceChildren(
        continueReading() || "",
        h("button.card.pages-card.mq-juz", { type: "button", onclick: () => open(-1) },
          h("span.rc-ic", null, icon("page", { size: 24 })),
          h("div", null, h("b", null, "30 джузов"), h("div.muted", null, "Прочесть джуз целиком или выбрать суру внутри джуза")),
          icon("right")),
        h("h2.mq-h", null, "Все суры"),
        surahs);
      scrub = surahScrub(surahs, list);
    }
  };
  draw();
  return h("div.page.quran-page.my-quran", null,
    h("header.page-head", null, h("h1", null, "Мой Коран"), h("p.muted", null, "Мусхаф Мадины, риваят Хафса от Асыма. Выберите суру или джуз — текст откроется на весь экран.")),
    body);
}

/**
 * Ручка справа от списка сур: потянули вниз — список летит к последней суре, вверх — к первой. Рядом — номер и название суры.
 * Живёт в body, а не в странице: у #view есть transform (анимация появления), внутри него position: fixed не держится за экран.
 */
function surahScrub(box, list) {
  const THUMB = 56; // высота ручки, px — как в стилях .ss-thumb
  const rows = [...box.children];
  const thumb = h("div.ss-thumb", null, icon("grip", { size: 18, sw: 3 }));
  const tip = h("div.ss-tip");
  const el = h("div.sura-scrub", { "aria-hidden": "true" }, thumb, tip);
  const off = () => { el.remove(); removeEventListener("scroll", place); removeEventListener("hashchange", off); };
  const max = () => document.documentElement.scrollHeight - innerHeight;
  let seen = false;
  const place = () => {
    if (!box.isConnected) { if (seen) off(); return; }
    seen = true;
    const f = max() > 0 ? Math.min(1, Math.max(0, scrollY / max())) : 0;
    el.style.setProperty("--f", f.toFixed(4));
  };
  /** Сура у верхнего края экрана. */
  const cur = () => {
    let lo = 0, hi = rows.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (rows[m].getBoundingClientRect().bottom > 110) hi = m; else lo = m + 1; }
    return list[lo];
  };
  let drag = null;
  const move = (e) => {
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientY - r.top - THUMB / 2) / (r.height - THUMB)));
    window.scrollTo({ top: f * max(), behavior: "instant" });
    place();
    const s = f >= 1 ? list[list.length - 1] : cur();
    tip.replaceChildren(h("b", null, s.id), h("small", null, s.ru));
  };
  thumb.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    drag = e.pointerId;
    try { thumb.setPointerCapture(e.pointerId); } catch {}
    el.classList.add("drag");
    move(e);
  });
  thumb.addEventListener("pointermove", (e) => { if (drag === e.pointerId) move(e); });
  const drop = (e) => { if (drag !== e.pointerId) return; drag = null; el.classList.remove("drag"); };
  thumb.addEventListener("pointerup", drop);
  thumb.addEventListener("pointercancel", drop);
  addEventListener("scroll", place, { passive: true });
  addEventListener("hashchange", off);
  box.classList.add("scrubbed");
  document.body.append(el);
  requestAnimationFrame(place);
  return { el, off };
}

// ---------- Всплывающее окно слова ----------
function wordPop(s, a, wi, w, meta, page) {
  const codes = rulesIn(w);
  const p = plain(w);
  const t = translit(p);
  playWord(wordKey(s, a, wi + 1));
  modal(h("div.word-pop", null,
    h("div.wp-ar", null, ar(stripStops(w), { colors: true })),
    h("div.wp-tr", null, tr(t)),
    h("div.wp-ref", null, `${meta.ru}, аят ${a}, слово ${wi + 1}`),
    h("div.row.center.gap", null,
      h("button.btn.secondary", { type: "button", onclick: () => playWord(wordKey(s, a, wi + 1)) }, icon("vol", { size: 18 }), "Ещё раз"),
      h("button.btn.secondary", { type: "button", onclick: () => playAyah(s, a) }, icon("play", { size: 18 }), "Весь аят")),
    page ? h("button.btn.ghost", { type: "button", onclick: () => addMark(s, a, page) }, icon("bookmark", { size: 18 }), `Закладка на аят ${a}`) : null,
    codes.length ? h("div.wp-rules", null, h("div.label", null, "Правила в этом слове"),
      ...codes.map((c) => h("div.lg-row", null, h("span.lg-sw", { style: { background: `var(--r-${c})` } }), h("div", null, h("b", null, RULES[c].name), h("small.muted", null, rich(RULES[c].text)))))) : h("p.muted.small", null, "Особых правил таджвида в слове нет — читается по огласовкам."),
    h("p.muted.small", null, "Транскрипция — для отдельно прочитанного слова. В слитном чтении начало и конец слова могут звучать иначе (см. правила).")), { cls: "sheet" });
}

// ---------- Отображение аятов ----------
/**
 * Рисует аяты суры. mode: "mushaf" (сплошным текстом) или "ayat" (по аятам с переводом).
 * pages — отметки страниц мусхафа Мадины; hifz — заучивание: 0 все слова видны, 1…3 — скрыта треть / две трети / все;
 * bare — без рамки (для страницы мусхафа). Возвращает { el, highlight(a, ms), scrollTo(a) }.
 */
export function renderVerses(s, data, meta, { mode = "mushaf", colors = true, translation = true, from = 1, to = data.v.length, onAyah, pages = false, prevPage = null, hifz = 0, bare = false } = {}) {
  const el = h("div.verses", { class: `${mode}${bare ? " bare" : ""}${hifz ? " hifz" : ""}`, dir: "rtl" });
  const ayahEls = [];
  let lastPage = prevPage; // страница перед первым аятом: отметка не повторяется, если текст продолжает ту же страницу
  for (let a = from; a <= to; a++) {
    const v = data.v[a - 1];
    const page = v[4]?.[0];
    if (pages && page && page !== lastPage) el.append(pageMark(page, v[5], s, a));
    lastPage = page;
    const words = v[0].map((w, wi) => {
      const hide = hifz && (hifz >= 3 || (a * 5 + wi * 2) % 3 < hifz);
      const b = h("span.qw", { role: "button", tabindex: "0", "data-wi": wi, class: hide ? "hid" : "" }, ar(w, { colors, tag: "span" }));
      // скрытое слово: первое нажатие открывает его, следующее — карточку слова
      const open = () => { if (b.classList.contains("hid") && !b.classList.contains("shown")) { b.classList.add("shown"); return; } wordPop(s, a, wi, w, meta, page); };
      b.addEventListener("click", open);
      b.addEventListener("keydown", (e) => e.key === "Enter" && open());
      return b;
    });
    const mark = h("button.ayah-mark", { type: "button", "aria-label": `Аят ${a}: слушать` , onclick: () => onAyah?.(a) }, h("span", null, arNum(a)));
    if (mode === "mushaf") {
      const span = h("span.ayah", { "data-a": a, "data-p": page || "" }, ...words.flatMap((w) => [w, " "]), mark, " ");
      el.append(span); ayahEls[a] = span;
    } else {
      const row = h("div.ayah-row", { "data-a": a, "data-p": page || "" },
        h("div.ar-line", { dir: "rtl" }, ...words.flatMap((w) => [w, " "]), mark),
        translation && v[1] ? h("p.translation", { dir: "ltr" }, h("b", null, a + ". "), keep(v[1])) : null);
      el.append(row); ayahEls[a] = row;
    }
  }
  const segIdx = () => RECITERS[store.get().settings.reciter]?.seg || 2;
  let lastA = null;
  return {
    el,
    highlight(a, ms) {
      if (lastA && lastA !== a) { ayahEls[lastA]?.classList.remove("cur"); ayahEls[lastA]?.querySelectorAll(".qw.now").forEach((x) => x.classList.remove("now")); }
      lastA = a;
      const ae = ayahEls[a];
      if (!ae) return;
      ae.classList.toggle("cur", ms >= 0);
      const seg = data.v[a - 1][segIdx()] || [];
      ae.querySelectorAll(".qw").forEach((w, i) => w.classList.toggle("now", ms >= 0 && seg[i * 2] >= 0 && ms >= seg[i * 2] && ms < seg[i * 2 + 1] + 80));
    },
    scrollTo(a, behavior = "smooth") { ayahEls[a]?.scrollIntoView({ block: "center", behavior }); },
    ayahEls,
  };
}

// Отметка начала страницы мусхафа Мадины (604 страницы). Нажатие — открыть эту страницу целиком.
function pageMark(p, juz, s, a) {
  return h("a.page-mark", { href: `#/page/${p}`, "data-p": p, dir: "ltr", title: "Открыть страницу мусхафа" },
    h("span", null, `страница ${p}`), juz ? h("span", null, `джуз ${juz}`) : null);
}

// ---------- Проигрыватель суры ----------
export function surahPlayer(s, data, view, { from = 1, to = data.v.length, onFinish } = {}) {
  let cur = null, playing = false, reps = 0;
  const settings = () => store.get().settings;
  const repeat = { n: 1 };
  const playFrom = (a) => {
    cur = a; playing = true; reps = 0; sync();
    view.scrollTo(a);
    const run = () => playAyah(s, cur, {
      onTime: (ms) => view.highlight(cur, ms),
      onEnd: () => {
        view.highlight(cur, -1);
        reps++;
        if (reps < repeat.n) return run();
        reps = 0;
        if (cur < to) { cur++; view.scrollTo(cur); run(); }
        else { playing = false; cur = null; sync(); onFinish?.(); }
      },
      onError: () => { playing = false; sync(); toast("Не удалось загрузить аудио. Проверьте интернет."); },
      onStop: () => { if (cur) view.highlight(cur, -1); playing = false; sync(); },
    });
    run();
  };
  const btn = h("button.btn.primary.play-all", { type: "button" });
  const sync = () => btn.replaceChildren(icon(playing ? "pause" : "play", { size: 20, fill: !playing, sw: playing ? 3 : 1.5 }), playing ? "Пауза" : cur ? "Продолжить" : "Слушать");
  btn.addEventListener("click", () => { if (playing) stop(); else playFrom(cur || from); });
  sync();
  const repBtn = h("button.tool", { type: "button", title: "Повтор каждого аята" }, icon("loop", { size: 18 }), h("span", null, "×1"));
  repBtn.addEventListener("click", () => { repeat.n = repeat.n === 1 ? 3 : repeat.n === 3 ? 5 : 1; repBtn.querySelector("span").textContent = "×" + repeat.n; repBtn.classList.toggle("on", repeat.n > 1); });
  return { btn, repBtn, playFrom, stop: () => stop() };
}

// ---------- Где остановился читатель ----------
/** Запоминает место чтения: сура, аят, страница и как читали — "surah", "juz" (j — номер джуза), "page" или "mark" (id — закладка с целью). */
function saveReading(s, a, page, mode, j = 0, id = "") {
  const r = store.get().reading;
  if (r && r.s === s && r.a === a && r.mode === mode && (r.j || 0) === j && (r.id || "") === id) return;
  store.set((st) => { st.reading = { s, a, p: page || null, mode, j, id, at: Date.now() }; });
}
/** Карточка «Продолжить чтение Корана» (или null, если читатель ещё не открывал мусхаф). */
export function continueReading() {
  const r = store.get().reading;
  const m = r && surahMeta(r.s);
  if (!m) return null;
  const mk = r.mode === "mark" && marks().find((x) => x.id === r.id && x.plan);
  const href = mk ? `#/mark/${mk.id}` : r.mode === "page" && r.p ? `#/page/${r.p}` : r.mode === "juz" && r.j ? `#/juz/${r.j}/${r.s}/${r.a}` : `#/read/${r.s}/${r.a}`;
  return h("a.card.reading-card", { href, onclick: () => enterFullscreen() },
    h("span.rc-ic", null, icon("book", { size: 24 })),
    h("div", null, h("b", null, "Продолжить чтение Корана"), h("div.muted", null, `Сура ${m.ru}, аят ${r.a}${r.p ? ` · страница ${r.p}` : ""}${r.mode === "juz" && r.j ? ` · джуз ${r.j} целиком` : ""}${mk ? ` · цель закладки${mk.name ? ` «${mk.name}»` : ""}` : ""}`)),
    icon("right"));
}

// ---------- Заучивание ----------
const HIFZ = ["нет", "треть", "две трети", "все"]; // сколько слов скрыто
const hifzLevel = () => { try { return +localStorage.getItem("tanwin.hifz") || 0; } catch { return 0; } };

// ---------- Дорожная карта: 30 джузов точками ----------
/** Пройденные джузы закрашены, текущий заполняется по мере чтения, остальные — впереди. set(page) обновляет карту. */
export function juzMap(page) {
  const dots = Array.from({ length: 30 }, () => h("i"));
  const cap = h("small.jm-cap");
  const el = h("div.juz-map", null, h("div.jm-dots", { "aria-hidden": "true" }, dots), cap);
  let shown = 0;
  const set = (p) => {
    if (!p || p === shown) return;
    shown = p;
    let j = 0;
    while (j < 29 && JUZ_PAGE[j + 1] <= p) j++;
    const f = (p - JUZ_PAGE[j]) / ((JUZ_PAGE[j + 1] || PAGES + 1) - JUZ_PAGE[j]);
    dots.forEach((d, i) => { d.className = i < j ? "done" : i === j ? "cur" : ""; d.style.setProperty("--f", i === j ? f.toFixed(3) : 0); });
    cap.textContent = `Джуз ${j + 1} · стр. ${p} · пройдено ${j}, осталось ${29 - j}`;
  };
  set(page);
  return { el, set };
}

// ---------- Колесо страниц: полоска справа ----------
const WHEEL_ROW = 30; // высота строки колеса, px — как в стилях .pw-list i
/**
 * Полоска с номерами всех 604 страниц. Медленное движение пальца — страница за страницей; быстрый взмах — колесо
 * разгоняется и летит дальше, так что до начала или конца Корана можно добраться за пару жестов. Когда колесо
 * остановилось, pick(p) открывает страницу под отметкой. onUse — читатель трогает колесо. set(p) ставит колесо на страницу.
 */
function pageWheel(list, pick, onUse) {
  const rows = Array.from({ length: PAGES }, (_, i) => h("i", { class: JUZ_PAGE.includes(i + 1) ? "juz" : "" }, i + 1));
  const roll = h("div.pw-list", null, rows);
  const tip = h("div.pw-tip", { "aria-hidden": "true" });
  const el = h("div.page-wheel", { role: "group", "aria-label": "Страницы мусхафа: прокрутите полоску, чтобы перейти к странице" }, roll, tip);
  let shown = 0, cur = 0, busy = false, tm = 0, raf = 0, gliding = false, drag = null;
  const at = () => Math.min(PAGES, Math.max(1, Math.round(roll.scrollTop / WHEEL_ROW) + 1));
  const mark = (p) => {
    if (p === cur) return;
    rows[cur - 1]?.classList.remove("on");
    rows[p - 1].classList.add("on");
    cur = p;
    const m = list.findLast((s) => s.page <= p);
    tip.replaceChildren(h("b", null, `Страница ${p}`), h("small", null, `джуз ${juzOfPage(p)} · ${m.ru}`));
  };
  const set = (p) => {
    if (!p) return;
    shown = Math.min(PAGES, p);
    if (busy) return;
    mark(shown);
    roll.scrollTop = (shown - 1) * WHEEL_ROW;
  };
  const begin = () => { busy = true; el.classList.add("busy"); clearTimeout(tm); cancelAnimationFrame(raf); gliding = false; onUse(); };
  const end = () => {
    busy = false; gliding = false; el.classList.remove("busy");
    const p = at();
    roll.scrollTop = (p - 1) * WHEEL_ROW;
    if (p !== shown) pick(p); else set(shown);
  };
  const move = (d) => { roll.scrollTop += d; mark(at()); onUse(); };
  roll.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const wasGliding = gliding;
    begin();
    drag = { id: e.pointerId, y: e.clientY, t: e.timeStamp, v: 0, moved: 0, wasGliding };
    try { roll.setPointerCapture(e.pointerId); } catch {}
  });
  roll.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = drag.y - e.clientY, dt = Math.max(1, e.timeStamp - drag.t);
    const speed = Math.abs(dy) / dt; // px/мс
    const gain = speed < 0.35 ? 1 : Math.min(14, 1 + (speed - 0.35) * 6); // чем быстрее жест, тем больше страниц на то же движение
    drag.v = drag.v * 0.6 + (dy * gain / dt) * 0.4;
    drag.moved += Math.abs(dy); drag.y = e.clientY; drag.t = e.timeStamp;
    move(dy * gain);
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (d.moved < 6) { // нажатие: на номер — сразу к этой странице; по летящему колесу — остановить его
      const p = d.wasGliding ? 0 : rows.indexOf(document.elementFromPoint(e.clientX, e.clientY)) + 1;
      if (p) roll.scrollTop = (p - 1) * WHEEL_ROW;
      return end();
    }
    let v = e.timeStamp - d.t > 80 ? 0 : Math.max(-30, Math.min(30, d.v)), last = performance.now(); // палец замер перед отпусканием — без разгона
    if (Math.abs(v) < 0.15) return end();
    gliding = true;
    const glide = (t) => {
      const dt = Math.min(40, Math.max(0, t - last));
      last = t;
      move(v * dt);
      v *= Math.pow(0.94, dt / 16);
      if (Math.abs(v) < 0.03 || roll.scrollTop <= 0 || roll.scrollTop >= roll.scrollHeight - roll.clientHeight - 1) return end();
      raf = requestAnimationFrame(glide);
    };
    raf = requestAnimationFrame(glide);
  };
  roll.addEventListener("pointerup", release);
  roll.addEventListener("pointercancel", release);
  roll.addEventListener("wheel", () => { begin(); tm = setTimeout(end, 500); }, { passive: true }); // колесо мыши: ждём, пока докрутят
  roll.addEventListener("scroll", () => { if (busy && !drag && !gliding) { mark(at()); onUse(); } }, { passive: true });
  new ResizeObserver(() => { if (!busy) roll.scrollTop = (shown - 1) * WHEEL_ROW; }).observe(roll); // высота полоски изменилась — отметка остаётся на своей странице
  return { el, set };
}

/** Выбор суры из списка (в чтении). */
function surahPicker(list, cur, open) {
  modal((close) => {
    const box = h("div.sp-list", null, ...list.map((s) =>
      h("button.surah-row", { type: "button", class: s.id === cur ? "on" : "", onclick: () => { close(); open(s.id); } },
        h("span.sr-num", null, h("span", null, s.id)), h("div.sr-main", null, h("b", null, s.ru), h("small.muted", null, `${s.meaning} · стр. ${s.page}`)), h("span.sr-ar", null, ar(s.ar)))));
    requestAnimationFrame(() => box.querySelector(".on")?.scrollIntoView({ block: "center" }));
    return h("div.surah-picker", null, h("h2", null, "Выберите суру"), box);
  }, { cls: "sheet" });
}

/** Аяты страницы p: [{ s, meta, data, from, to }] — на одной странице может быть конец одной суры и начало другой. */
export async function pageContent(p) {
  const list = await loadSurahs();
  const cand = list.filter((m, i) => m.page <= p && (i === list.length - 1 || list[i + 1].page >= p));
  const parts = [];
  for (const m of cand) {
    const data = await loadSurah(m.id);
    const idx = data.v.map((v, i) => (v[4][0] === p ? i + 1 : 0)).filter(Boolean);
    if (idx.length) parts.push({ s: m.id, meta: m, data, from: idx[0], to: idx[idx.length - 1] });
  }
  return parts;
}

/** Переход к странице / джузу. open(p) — что открыть (по умолчанию — страницу мусхафа). */
function pagePicker(cur, open = (p) => go(`/page/${p}`)) {
  modal((close) => {
    const inp = h("input.text-in.big", { type: "number", min: 1, max: PAGES, value: cur, inputmode: "numeric", "aria-label": "Номер страницы" });
    const goTo = () => { const v = Math.round(+inp.value); if (v >= 1 && v <= PAGES) { close(); open(v); } else toast(`Номер страницы — от 1 до ${PAGES}`); };
    inp.addEventListener("keydown", (e) => e.key === "Enter" && goTo());
    return h("div.page-picker", null,
      h("h2", null, "Перейти"),
      h("div.row.gap", null, inp, h("button.btn.primary", { type: "button", onclick: goTo }, "Открыть")),
      h("div.label", null, "Начало джуза"),
      h("div.juz-grid", null, ...JUZ_PAGE.map((jp, i) => h("button.juz-btn", { type: "button", class: jp <= cur && (JUZ_PAGE[i + 1] || 605) > cur ? "on" : "", onclick: () => { close(); open(jp); } }, h("b", null, i + 1), h("small", null, `с. ${jp}`)))));
  });
}

// ---------- Чтение: текст на весь экран, с автопрокруткой ----------
const SPEED = { min: 1, max: 20, def: 4, px: 3 }; // скорость 1…20; одно деление — 3 px/с при обычном размере арабского текста
const readSpeed = () => { try { return Math.min(SPEED.max, Math.max(SPEED.min, Math.round(+localStorage.getItem("tanwin.readSpeed")) || SPEED.def)); } catch { return SPEED.def; } };
// вид текста: "text" — сплошной, "ayat" — по аятам с переводом; «по страницам» — отдельный адрес (#/page/N)
const readView = () => { try { const v = localStorage.getItem("tanwin.readView"); return v === "ayat" || v === "text" ? v : localStorage.getItem("tanwin.readTr") === "1" ? "ayat" : "text"; } catch { return "text"; } };
const READING = /^#\/(read|juz|page|mark)\b/;
/** Перейти по адресу, даже если он уже открыт (тогда экран просто открывается заново). */
const goHash = (hash) => { if (location.hash === hash) dispatchEvent(new HashChangeEvent("hashchange")); else location.replace(hash); };

let resumeScroll = false; // автопрокрутка дошла до конца — следующая сура или страница продолжает идти сама
let lastPage = 0; // страница, которую читатель видел последней: перешли на следующую за ней — она прочитана
const PAGE_DWELL = 40000; // …или читатель провёл на странице столько времени (мс) — так считаются и разрозненные страницы

/** Продолжить с того места и в том виде, где читатель остановился. */
export function ReadStart() {
  const r = store.get().reading;
  if (r?.mode === "page" && r.p) return ReadPage(r.p);
  if (r?.mode === "juz" && r.j) return ReadJuz(r.j, r.s, r.a);
  return ReadMode(r?.s || 1, r?.a || 0);
}
/** Сура n целиком, с аята startA. */
export async function ReadMode(n, startA = 0) {
  n = Math.min(114, Math.max(1, n));
  const [list, data] = await Promise.all([loadSurahs(), loadSurah(n)]);
  return readSession(list, { kind: "surah", parts: [{ s: n, meta: list[n - 1], data, from: 1, to: data.v.length }], start: startA > 1 ? { s: n, a: startA } : null });
}
/** Джуз j целиком — от его первого аята до последнего, через границы сур. s, a — место, с которого продолжить. */
export async function ReadJuz(j, s = 0, a = 0) {
  j = Math.min(30, Math.max(1, j));
  const list = await loadSurahs();
  const parts = await Promise.all(juzParts(j).map(async (p) => { const data = await loadSurah(p.s); return { s: p.s, meta: list[p.s - 1], data, from: p.from, to: p.to || data.v.length }; }));
  return readSession(list, { kind: "juz", juz: j, parts, start: s ? { s, a: a || 1 } : null });
}
/** Страница p мусхафа Мадины: те же аяты, что на бумажной странице. */
export async function ReadPage(p) {
  p = Math.min(PAGES, Math.max(1, p));
  const [list, parts] = await Promise.all([loadSurahs(), pageContent(p)]);
  return readSession(list, { kind: "page", page: p, parts });
}

/** Место сразу после аята (s, a): следующий аят или начало следующей суры (после конца Корана — его начало). */
async function ayahAfter(list, s, a) {
  const data = await loadSurah(s);
  if (a < data.v.length) return { s, a: a + 1, p: data.v[a][4][0] };
  const n = s < 114 ? s + 1 : 1;
  return { s: n, a: 1, p: list[n - 1].page };
}
/** Что читать сегодня по цели закладки m: части текста [{ s, meta, data, from, to }] — ровно столько, сколько задано. */
async function markParts(list, m) {
  const pl = m.plan, parts = [];
  if (pl.k === "rep") { // отрывок для повтора: суры и аяты, как выбрано
    for (const x of pl.items) {
      const data = await loadSurah(x.s), n = data.v.length, from = Math.min(n, Math.max(1, x.from));
      parts.push({ s: x.s, meta: list[x.s - 1], data, from, to: Math.min(n, Math.max(from, x.to)) });
    }
    return parts;
  }
  if (pl.unit === "a") { // n аятов подряд, через границы сур
    for (let s = m.s, a = m.a, left = pl.n; left > 0 && s <= 114; s++, a = 1) {
      const data = await loadSurah(s);
      if (a > data.v.length) continue;
      const to = Math.min(data.v.length, a + left - 1);
      parts.push({ s, meta: list[s - 1], data, from: a, to });
      left -= to - a + 1;
    }
    return parts;
  }
  // n страниц: с аята закладки до конца n-й страницы
  const d0 = await loadSurah(m.s), p0 = d0.v[Math.min(d0.v.length, m.a) - 1][4][0];
  for (let p = p0; p < p0 + pl.n && p <= PAGES; p++) for (const x of await pageContent(p)) {
    if (x.s < m.s || (x.s === m.s && x.to < m.a)) continue; // то, что до закладки
    const from = x.s === m.s ? Math.max(x.from, m.a) : x.from, prev = parts[parts.length - 1];
    if (prev && prev.s === x.s && prev.to + 1 === from) prev.to = x.to; else parts.push({ s: x.s, meta: x.meta, data: x.data, from, to: x.to });
  }
  return parts;
}
/**
 * Закладка с целью: на экране ровно то, что нужно прочесть сегодня, в конце — «Я прочитал».
 * more — читать дальше после выполненной цели «по порядку»: обычное чтение суры, закладка идёт следом за читателем.
 */
export async function ReadMark(id, more = false) {
  const list = await loadSurahs();
  const get = () => marks().find((x) => x.id === id);
  let m = get();
  if (!m) { location.replace("#/bookmarks"); return h("div"); }
  if (m.byPage) { // место перенесено из старой цели и известно только как страница
    const x = (await pageContent(m.p || 1).catch(() => []))[0];
    setMark(id, (y) => { if (x) Object.assign(y, { s: x.s, a: x.from }); delete y.byPage; });
    m = get();
  }
  if (!m.plan) return ReadMode(m.s, m.a);
  if (m.plan.k === "seq" && (more || doneToday(m))) {
    const data = await loadSurah(m.s);
    return readSession(list, { kind: "surah", parts: [{ s: m.s, meta: list[m.s - 1], data, from: 1, to: data.v.length }], start: m.a > 1 ? { s: m.s, a: m.a } : null, follow: id });
  }
  const parts = await markParts(list, m);
  if (!parts.length) return ReadMode(m.s, m.a);
  return readSession(list, { kind: "mark", parts, mark: m, start: m.cur && !doneToday(m) ? m.cur : null });
}

/**
 * Экран чтения. parts — что показано: [{ s, meta, data, from, to }] (сура, части джуза или части страницы).
 * Нажатие на экран показывает или прячет две панели: сверху — полное меню, снизу — автопрокрутка, скорость, чтец и размер текста.
 */
function readSession(list, { kind, parts, juz = 0, page = 0, start = null, mark = null, follow = "" }) {
  if (!parts.length) throw new Error("Текст не загрузился");
  const auto = resumeScroll;
  resumeScroll = false;
  const last = parts[parts.length - 1];
  const endOfQuran = last.s === 114 && last.to === last.data.v.length;
  const pageOf = (x) => x.p.data.v[x.a - 1][4][0];

  // --- текст: его можно перерисовать на ходу (вид, заучивание) — flat всегда описывает текущий ---
  const textBox = h("div.focus-body");
  let flat = []; // все аяты подряд: { p — часть, a — номер аята, el }
  let sel = null; // аят, на котором чтец сейчас или на котором его остановили: { s, a } — с него он продолжит по кнопке в меню
  const build = () => {
    const mode = kind !== "page" && readView() === "ayat" ? "ayat" : "mushaf";
    let prev = null;
    flat = [];
    textBox.replaceChildren(...parts.map((p, i) => {
      p.view = renderVerses(p.s, p.data, p.meta, { mode, bare: true, colors: true, pages: kind !== "page", prevPage: prev, hifz: hifzLevel(), translation: store.get().settings.translation, from: p.from, to: p.to });
      prev = p.data.v[p.to - 1][4][0];
      for (let a = p.from; a <= p.to; a++) flat.push({ p, a, el: p.view.ayahEls[a] });
      return h("div.focus-part", { "data-s": p.s },
        p.from === 1 ? h("div.surah-banner", null, ar(p.meta.ar), h("small", null, `Сура ${p.meta.ru}`)) : i ? null : h("div.part-cap", null, `Сура ${p.meta.ru} · с аята ${p.from}`),
        p.from === 1 && p.s !== 1 && p.s !== 9 ? h("div.bismillah", { role: "button", title: "Слушать суру с начала" }, ar(BISMILLAH, { colors: true })) : null,
        p.view.el);
    }));
    if (sel) flat.find((x) => x.p.s === sel.s && x.a === sel.a)?.el.classList.add("sel");
  };
  build();
  const find = (s, a) => flat.find((x) => x.p.s === s && x.a === a);
  const words = parts.reduce((k, p) => k + p.data.v.slice(p.from - 1, p.to).reduce((n, v) => n + v[0].length, 0), 0);

  // --- что дальше: следующая сура, следующий джуз или следующая страница ---
  const hasNext = kind === "mark" ? false : kind === "page" ? page < PAGES : kind === "juz" ? juz < 30 : last.s < 114;
  const stopAtEnd = kind === "juz" || kind === "mark"; // джуз и цель закладки читают целиком — в конце текст останавливается
  let finished = false, followOff = false;
  const advance = (keepGoing) => {
    resumeScroll = keepGoing;
    if (follow) { // читаем дальше после цели: закладка переходит к следующей суре вместе с читателем
      const n = last.s + 1;
      followOff = true;
      setMark(follow, (y) => Object.assign(y, { s: n, a: 1, p: list[n - 1].page }));
      return goHash(`#/mark/${follow}/more`);
    }
    location.replace(kind === "page" ? `#/page/${page + 1}` : kind === "juz" ? `#/juz/${juz + 1}` : `#/read/${last.s + 1}`);
  };
  // цель закладки: «Я прочитал» — цель выполнена; после цели «по порядку» можно читать дальше
  const markNow = () => marks().find((x) => x.id === mark.id) || mark;
  const markEnd = () => {
    const m = markNow(), done = doneToday(m);
    return [
      h("p.focus-done", { class: done ? "" : "todo" }, icon(done ? "check" : "target", { size: 20, sw: done ? 3 : 2 }), done ? "Сегодняшняя цель выполнена" : `Цель: ${planText(m.plan)}`),
      done ? null : h("button.btn.primary", { type: "button", onclick: () => finish() }, icon("check", { size: 18, sw: 3 }), `Я ${g("прочитал", "прочитала", "прочитал(а)")}`),
      done && m.plan?.k === "seq" ? h("button.btn.primary", { type: "button", onclick: () => goHash(`#/mark/${m.id}/more`) }, "Читать дальше", icon("right", { size: 18 })) : null,
      done && m.plan?.k === "seq" ? h("p.muted.small.center", null, "Читайте, сколько хочется: завтра закладка будет ждать там, где вы остановитесь.") : null,
      done ? h("button.btn.ghost", { type: "button", onclick: () => location.replace("#/bookmarks") }, "К закладкам") : null,
    ].filter(Boolean);
  };
  const finish = async () => {
    setRunning(false);
    if (listening) stop();
    const next = mark.plan.k === "seq" ? await ayahAfter(list, last.s, last.to).catch(() => null) : null; // закладка «по порядку» переезжает за прочитанное
    setMark(mark.id, (y) => { y.done = Date.now(); delete y.cur; if (next) Object.assign(y, next); });
    finished = true;
    readGoalDone();
    confetti();
    endEl.replaceChildren(...markEnd());
  };
  const endEl = h("div.focus-end", null, ...(kind === "mark" ? markEnd() : [
    kind === "juz" ? h("p.focus-done", null, icon("check", { size: 20, sw: 3 }), `Джуз ${juz} прочитан`) : null,
    !hasNext ? h("p.muted", null, "Конец Корана")
      : kind === "page" ? h("button.btn.secondary", { type: "button", onclick: () => advance(running) }, "Следующая страница")
      : h("button.btn.secondary", { type: "button", onclick: () => advance(kind === "surah" && running) }, kind === "juz" ? `Дальше: джуз ${juz + 1}` : `Дальше: сура ${list[last.s].ru}`, icon("right", { size: 18 })),
    kind === "page" && page > 1 ? h("button.btn.ghost", { type: "button", onclick: () => location.replace(`#/page/${page - 1}`) }, "Предыдущая страница") : null]));

  const jm = juzMap(pageOf((start && find(start.s, start.a)) || flat[0]));
  jm.el.classList.add("focus-juz");
  // строка под дорожной картой: «читаем джуз целиком», цель закладки или «читаем дальше — закладка идёт следом»
  const modeCap = kind === "juz" || kind === "mark" || follow ? h("b.focus-mode") : null;
  if (kind === "mark") modeCap.textContent = `${mark.name ? `«${mark.name}» · ` : ""}цель: ${planText(mark.plan)}`;
  if (follow) modeCap.textContent = "Читаем дальше — закладка идёт следом";
  jm.el.append(modeCap || "");
  const scroller = h("div.focus-scroll", { tabindex: "-1" }, h("div.focus-text", null, textBox, endEl));
  const prog = h("i.focus-prog");

  // --- где сейчас читатель ---
  let pin = null; // после перехода к аяту страницей считается его страница, пока читатель не начал листать
  /** Аят у верхней четверти экрана. */
  const here = () => {
    const line = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.25;
    let lo = 0, hi = flat.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (flat[m].el.getBoundingClientRect().bottom > line) hi = m; else lo = m + 1; }
    return flat[lo];
  };
  const place = () => { const x = here(); return { s: x.p.s, a: x.a, p: pageOf(x) }; };
  const jump = (x) => {
    scroller.scrollTop += x.el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight * 0.2;
    pin = { p: pageOf(x), top: scroller.scrollTop };
  };

  // --- автопрокрутка ---
  let speed = readSpeed(), running = false, listening = false, raf = 0, lastT = 0, pos = 0, touching = false, holdUntil = 0, ran = 0;
  const maxTop = () => scroller.scrollHeight - scroller.clientHeight;
  const pxPerSec = () => speed * SPEED.px * (store.get().settings.arScale || 1); // крупнее текст — выше строка: темп в строках тот же
  const tick = (t) => {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(100, t - lastT);
    lastT = t;
    // палец на экране, колесо мыши, клавиши — читатель листает сам; продолжаем с нового места
    if (!scroller.clientHeight || touching || t < holdUntil || Math.abs(scroller.scrollTop - pos) > 3) { pos = scroller.scrollTop; return; }
    ran += dt;
    // конец текста поднялся в верхнюю треть экрана: дальше идёт следующая сура или страница. Короткому тексту, который виден целиком, даём время на чтение
    if (endEl.getBoundingClientRect().top - scroller.getBoundingClientRect().top < scroller.clientHeight * 0.35 || pos >= maxTop() - 1) {
      if (ran >= Math.min(60000, words * 700 * SPEED.def / speed)) {
        if (hasNext && !stopAtEnd) advance(true);
        else { setRunning(false); if (kind === "juz") toast(`Джуз ${juz} прочитан ✓`, 4000); } // джуз читают целиком — в его конце текст останавливается
      }
      return;
    }
    pos += pxPerSec() * dt / 1000;
    scroller.scrollTop = pos;
  };
  const setRunning = (on) => {
    if (on && scroller.scrollTop >= maxTop() - 1) scroller.scrollTop = 0; // дочитали до конца — начинаем сначала
    if (on && listening) stop(); // чтец сам ведёт по тексту — вместе с автопрокруткой они мешают друг другу
    running = on;
    cancelAnimationFrame(raf);
    if (on) { pos = scroller.scrollTop; lastT = performance.now(); raf = requestAnimationFrame(tick); }
    playB.replaceChildren(icon(on ? "pause" : "play", { size: 22, fill: !on, sw: on ? 3 : 1.5 }));
    playB.setAttribute("aria-label", on ? "Остановить прокрутку" : "Включить автопрокрутку");
    playB.classList.toggle("playing", on);
  };
  const hold = (ms) => { holdUntil = performance.now() + ms; };
  const setSpeed = (d) => {
    speed = Math.min(SPEED.max, Math.max(SPEED.min, speed + d));
    try { localStorage.setItem("tanwin.readSpeed", speed); } catch {}
    val.textContent = speed; slower.disabled = speed <= SPEED.min; faster.disabled = speed >= SPEED.max;
  };

  // --- чтец. Нажатие на номер аята — читает подряд с него до конца открытого текста (суры, джуза, страницы, аятов цели).
  // Отметка идёт за чтецом: остановили — плитка в меню продолжит с того же аята; ничего не слушали — с начала суры.
  // «Бисмиллях» — сура с самого начала. ---
  let pi = -1, reps = 0, repeatN = 1;
  const setSel = (x) => {
    textBox.querySelector(".sel")?.classList.remove("sel");
    sel = x ? { s: x.p.s, a: x.a } : null;
    x?.el.classList.add("sel");
  };
  const play = () => {
    const x = flat[pi];
    setSel(x);
    x.p.view.scrollTo(x.a);
    playAyah(x.p.s, x.a, {
      onTime: (ms) => x.p.view.highlight(x.a, ms),
      onEnd: () => {
        x.p.view.highlight(x.a, -1);
        if (++reps < repeatN) return play();
        reps = 0;
        if (pi < flat.length - 1) { pi++; play(); }
        else { pi = -1; setSel(null); syncListen(); toast("Прослушано. Теперь прочитайте сами — вслух!"); }
      },
      onError: () => toast("Не удалось загрузить аудио. Проверьте интернет."),
      onStop: () => x.p.view.highlight(x.a, -1),
    });
  };
  /** Читать подряд с аята x. bism — начать с «Бисмилляхи-р-рахмани-р-рахим» (запись первого аята Аль-Фатихи), если x — первый аят суры. */
  const listenFrom = (x, bism = false) => {
    setRunning(false);
    pi = flat.indexOf(x); reps = 0;
    if (!bism || x.a !== 1 || x.p.s === 1 || x.p.s === 9) return play();
    if (x === flat[0]) scroller.scrollTo({ top: 0, behavior: "smooth" });
    playAyah(1, 1, { onEnd: play, onError: () => toast("Не удалось загрузить аудио. Проверьте интернет.") });
  };
  /** Нажатие на номер аята: читать подряд с него. */
  const listenHere = (x) => {
    listenFrom(x);
    try { if (!localStorage.getItem("tanwin.ayahHint2")) { localStorage.setItem("tanwin.ayahHint2", "1"); toast("Чтец читает с этого аята и дальше. Чтобы остановить, нажмите на экран и выберите «Остановить чтеца» — потом он продолжит с того же места.", 7000); } } catch {}
  };
  /** Плитка «Слушать»: с аята, на котором чтеца остановили, иначе — с начала суры, которая сейчас на экране. */
  const listenAll = () => {
    const x = sel && find(sel.s, sel.a);
    if (x) return listenFrom(x);
    const p = here().p;
    listenFrom(find(p.s, p.from), true);
  };

  // --- нижняя панель: автопрокрутка, её скорость, размер текста ---
  const playB = h("button.play-btn", { type: "button", onclick: () => { setRunning(!running); if (running) hide(); } }); // пошла автопрокрутка — панели уходят: читатель хочет читать
  const val = h("b.focus-speed", { title: "Скорость прокрутки" }, speed);
  const slower = h("button.sp-btn", { type: "button", "aria-label": "Медленнее", title: "Медленнее", disabled: speed <= SPEED.min, onclick: () => setSpeed(-1) }, "−");
  const faster = h("button.sp-btn", { type: "button", "aria-label": "Быстрее", title: "Быстрее", disabled: speed >= SPEED.max, onclick: () => setSpeed(1) }, "+");
  const syncListen = () => {
    listening = (playingId() || "").startsWith("a:");
    if (root.isConnected && !root.classList.contains("quiet")) fillMenu(); // плитка «Слушать / Остановить»
  };
  const offPlay = onPlay(() => syncListen());
  const bar = h("div.focus-bar", { role: "toolbar", "aria-label": "Управление чтением" },
    playB, slower, val, faster, sizeButton());

  // --- переход к странице (колесо справа, окно «Страница, джуз») ---
  const openPage = async (p) => {
    if (kind === "page") { if (p !== page) { resumeScroll = running; location.replace(`#/page/${p}`); } return; }
    const i = flat.findIndex((x) => pageOf(x) === p);
    if (i < 0) { // страницы нет в открытом тексте — открываем её суру (а при чтении джуза — её джуз)
      const part = await pageContent(p).then((x) => x[0], () => null);
      if (!root.isConnected) return;
      if (!part) { wheel.set(shownPage()); return toast("Не удалось открыть страницу. Проверьте интернет."); }
      resumeScroll = running;
      return location.replace(kind === "juz" ? `#/juz/${juzOfPage(p)}/${part.s}/${part.from}` : `#/read/${part.s}/${part.from}`);
    }
    if (listening) stop();
    if (!i) { scroller.scrollTop = 0; pin = { p, top: 0 }; } else jump(flat[i]);
  };
  const wheel = pageWheel(list, openPage, () => {});

  // --- верхняя панель: полное меню, всё на виду ---
  const redraw = () => {
    const { s, a } = place();
    stop();
    build();
    requestAnimationFrame(() => { const x = find(s, a); if (x) jump(x); });
  };
  const setView = (v) => {
    if (v === "page") { if (kind !== "page") location.replace(`#/page/${shownPage()}`); return; }
    try { localStorage.setItem("tanwin.readView", v); } catch {}
    if (kind === "page") { const x = place(); location.replace(`#/read/${x.s}/${x.a}`); } else redraw();
  };
  const info = h("div.fm-info");
  const tiles = h("div.fm-tiles");
  const menu = h("div.focus-menu", { role: "toolbar", "aria-label": "Меню чтения" }, info, tiles);
  const tile = (ic, label, fn, on = false, io = {}, cls = "") => h("button.fm-tile", { type: "button", class: `${on ? "on" : ""} ${cls}`, onclick: () => { fn(); fillMenu(); } }, icon(ic, { size: 20, ...io }), h("span", null, label));
  const fillInfo = () => {
    const x = here(), v = x.p.data.v[x.a - 1];
    info.textContent = `Сура ${x.p.meta.ru} · аят ${x.a} из ${x.p.data.v.length} · стр. ${v[4][0]} · джуз ${v[5]}`;
  };
  const fillMenu = () => {
    const st = store.get().settings, lv = hifzLevel(), view = kind === "page" ? "page" : readView();
    fillInfo();
    tiles.replaceChildren(...[
      tile("left", "Назад в «Мой Коран»", () => close()),
      listening ? tile("stop", "Остановить чтеца", () => stop(), true, { fill: true, sw: 1 }, "fm-go")
        : tile("play", sel ? `Продолжить с аята ${sel.a}` : "Слушать суру", () => { listenAll(); hide(); }, false, { fill: true, sw: 1.5 }, "fm-go"),
      tile("list", "Суры", () => surahPicker(list, here().p.s, (id) => go(`/read/${id}`))),
      tile("more", "Страница, джуз", () => pagePicker(shownPage(), openPage)),
      last.s > 1 ? tile("left", "Пред. сура", () => { const s = here().p.s; if (s > 1) go(`/read/${s - 1}`); }) : null,
      parts[0].s < 114 ? tile("right", "След. сура", () => { const s = here().p.s; if (s < 114) go(`/read/${s + 1}`); }) : null,
      tile("bookmark", "Закладка здесь", () => { const x = place(); addMark(x.s, x.a, x.p); }),
      tile("bookmark", `Закладки${marks().length ? `: ${marks().length}` : ""}`, () => marksSheet(), false, { fill: true, sw: 1 }),
      tile("ear", st.reciter === "husary" ? "Чтец: Хусари" : "Чтец: Афаси", () => { stop(); store.set((s) => { s.settings.reciter = s.settings.reciter === "husary" ? "afasy" : "husary"; }); const r = RECITERS[store.get().settings.reciter]; toast(`Чтец: ${r.name} — ${r.note}`); }),
      tile("slow", `Темп чтеца: ${st.rate || 1}×`, () => { stop(); store.set((s) => { const r = s.settings.rate || 1; s.settings.rate = r === 1 ? 0.8 : r === 0.8 ? 0.6 : r === 0.6 ? 1.2 : 1; }); }, (st.rate || 1) !== 1),
      tile("loop", `Повтор аята: ×${repeatN}`, () => { repeatN = repeatN === 1 ? 3 : repeatN === 3 ? 5 : 1; }, repeatN > 1),
      tile("book", "Сплошной текст", () => setView("text"), view === "text"),
      tile("chat", st.translation ? "По аятам, с переводом" : "По аятам", () => setView("ayat"), view === "ayat"),
      tile("page", "По страницам", () => setView("page"), view === "page"),
      tile("eye", `Скрыть слова: ${HIFZ[lv]}`, () => {
        const next = (hifzLevel() + 1) % HIFZ.length;
        try { localStorage.setItem("tanwin.hifz", next); } catch {}
        if (next === 1) toast("Заучивание: часть слов скрыта. Читайте по памяти; нажмите на слово, чтобы подсмотреть.", 4200);
        redraw();
      }, !!lv),
      tile("palette", "Цвета таджвида", () => legendModal()),
      tile("check", "Сура прочитана", () => { const s = here().p.s; store.set((x) => { x.reads = x.reads || {}; x.reads[s] = (x.reads[s] || 0) + 1; }); toast(`Отмечено: сура ${surahMeta(s).ru} прочитана ✓`); }),
      tile("down", "Скачать аудио суры", () => { const x = here(); cacheSurah(x.p.s, x.p.data); }),
    ].filter(Boolean));
  };
  const head = h("div.focus-head", null, jm.el, menu);
  // при открытии — только текст (quiet); панели появляются по нажатию на экран
  const root = h("div.focus", { class: `kind-${kind} quiet` }, prog, head, scroller, wheel.el, bar);
  new ResizeObserver(() => root.style.setProperty("--head-h", head.offsetHeight + "px")).observe(head); // колесо страниц начинается под меню
  // панели показывает и прячет только нажатие на экран: открылись — остаются, пока не нажмёшь ещё раз.
  // Карточка слова, чтец по номеру аята, колесо страниц и автопрокрутка сами панели не открывают.
  const reveal = () => { if (root.isConnected) fillMenu(); root.classList.remove("quiet"); };
  const hide = () => root.classList.add("quiet");

  // нажатие на текст показывает или прячет панели; на номер аята — чтец читает с него
  // долгое нажатие на слово — карточка слова: его читает чтец, видны транскрипция и правила таджвида
  let pressTm = 0, pressAt = null, pressT = 0, pressW = null, pressed = false, byTouch = false;
  const pressOff = () => { clearTimeout(pressTm); pressAt = null; pressW = null; };
  const ayahAt = (el) => { const a = +el.closest("[data-a]")?.dataset.a, s = +el.closest("[data-s]")?.dataset.s; return a && s ? find(s, a) : null; };
  // палец ещё на экране, когда карточка уже открыта: на Android его отпускание приходит нажатием по затемнению
  // вокруг карточки и тут же её закрывает — такие нажатия гасим, пока палец не поднят
  const eat = (e) => { e.stopPropagation(); e.preventDefault(); };
  // и текст карточки под пальцем Android не выделяет (класс held): палец подняли — выделять и копировать снова можно
  const unhold = () => { document.removeEventListener("click", eat, true); document.removeEventListener("contextmenu", eat, true); document.documentElement.classList.remove("held"); };
  const eatClicks = () => {
    document.addEventListener("click", eat, true);
    document.addEventListener("contextmenu", eat, true);
    document.documentElement.classList.add("held");
    const off = () => setTimeout(unhold, 400);
    for (const ev of ["pointerup", "touchend", "touchcancel"]) addEventListener(ev, off, { once: true, capture: true });
    setTimeout(off, 5000);
  };
  const openWord = (w) => {
    pressOff();
    const x = ayahAt(w), wi = +w.dataset.wi;
    if (!x || !root.isConnected || pressed) return;
    pressed = true; // отпускание пальца после этого не должно прятать или показывать панели
    if (running) setRunning(false);
    if (listening) stop();
    navigator.vibrate?.(12);
    eatClicks();
    wordPop(x.p.s, x.a, wi, x.p.data.v[x.a - 1][0][wi], x.p.meta, pageOf(x));
  };
  scroller.addEventListener("pointerdown", (e) => {
    const w = e.target.closest?.(".qw");
    pressOff(); pressed = false; byTouch = e.pointerType !== "mouse";
    if (!w || (e.pointerType === "mouse" && e.button !== 0)) return;
    pressAt = [e.clientX, e.clientY]; pressT = performance.now(); pressW = w;
    pressTm = setTimeout(() => openWord(w), 480);
  });
  scroller.addEventListener("pointermove", (e) => { if (pressAt && Math.hypot(e.clientX - pressAt[0], e.clientY - pressAt[1]) > 9) pressOff(); });
  for (const ev of ["pointerup", "pointerleave", "touchend"]) scroller.addEventListener(ev, pressOff);
  // Android на долгом нажатии сам отменяет касание (pointercancel) раньше нашего отсчёта: если палец уже держали, отсчёт идёт дальше
  scroller.addEventListener("pointercancel", () => { if (performance.now() - pressT < 300) pressOff(); });
  scroller.addEventListener("scroll", pressOff, { passive: true });
  // на телефоне долгое нажатие иначе открывает меню браузера; для Android это ещё и сигнал «слово держат»
  scroller.addEventListener("contextmenu", (e) => {
    const w = e.target.closest?.(".qw");
    if (!w) return;
    e.preventDefault();
    if (byTouch && !pressed) openWord(pressW || w);
  });
  scroller.addEventListener("click", (e) => {
    if (e.target.closest(".focus-end")) return;
    e.preventDefault(); e.stopPropagation();
    if (pressed) { pressed = false; return; }
    const hid = e.target.closest(".qw.hid:not(.shown)"); // заучивание: скрытое слово открывается нажатием
    if (hid) { hid.classList.add("shown"); return; }
    const am = e.target.closest(".ayah-mark");
    const x = am && ayahAt(am);
    if (x) { if (listening && flat[pi] === x) stop(); else listenHere(x); return; }
    const bs = e.target.closest(".bismillah"); // «Бисмиллях» — чтец читает суру с самого начала
    const x1 = bs && find(+bs.closest("[data-s]").dataset.s, 1);
    if (x1) { if (listening && flat[pi] === x1) stop(); else { setSel(null); listenFrom(x1, true); } return; }
    if (root.classList.contains("quiet")) reveal(); else hide();
  }, true);
  // по страницам: следующая страница — слева, как в мусхафе (листаем вправо или стрелка ←)
  const turn = (d) => { const p = page + d; if (p >= 1 && p <= PAGES) { resumeScroll = running; location.replace(`#/page/${p}`); } };
  let x0 = null, y0 = 0;
  scroller.addEventListener("touchstart", (e) => { touching = true; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  const touchEnd = (e) => {
    touching = false; hold(900); // даём докатиться прокрутке по инерции
    const t = e.changedTouches?.[0];
    if (kind === "page" && x0 != null && t) {
      const dx = t.clientX - x0, dy = t.clientY - y0;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx > 0 ? 1 : -1);
    }
    x0 = null;
  };
  scroller.addEventListener("touchend", touchEnd, { passive: true });
  scroller.addEventListener("touchcancel", touchEnd, { passive: true });
  scroller.addEventListener("wheel", () => hold(500), { passive: true });
  // учёт чтения: время идёт, пока текст движется сам, звучит чтец или читатель недавно листал
  let actAt = performance.now(), spent = 0, dwell = 0;
  const active = () => { actAt = performance.now(); };
  scroller.addEventListener("scroll", active, { passive: true });
  scroller.addEventListener("pointerdown", active, { passive: true });
  const clock = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (running || listening || performance.now() - actAt < 90000) { spent += 5000; dwell += 5000; }
    if (dwell >= PAGE_DWELL && lastPage >= 1 && lastPage <= PAGES) readPage(lastPage);
    if (spent >= 30000) { readTick(spent); spent = 0; }
  }, 5000);
  let jmTm = 0;
  // страница под глазами читателя; 605 — последняя сура дочитана до конца (для цели «до конца Корана»)
  // новая страница начинается, как только её строка «страница N · джуз M» показалась на экране
  const shownPage = () => {
    if (kind === "page") return page;
    if (pin) { if (Math.abs(scroller.scrollTop - pin.top) < 48) return pin.p; pin = null; }
    const bottom = scroller.getBoundingClientRect().bottom - 4;
    let p = pageOf(flat[0]);
    for (const m of textBox.querySelectorAll(".page-mark")) { if (m.getBoundingClientRect().top > bottom) break; p = +m.dataset.p; }
    return p;
  };
  const pageNow = () => (endOfQuran && scroller.scrollTop >= maxTop() - 2 ? PAGES + 1 : shownPage());
  const save = () => {
    const x = place();
    saveReading(x.s, x.a, x.p, kind, juz, mark?.id || "");
    if (follow && !followOff) { const m = marks().find((y) => y.id === follow); if (m && (m.s !== x.s || m.a !== x.a)) setMark(follow, (y) => Object.assign(y, x)); } // закладка идёт следом
    return x;
  };
  const updJuz = () => {
    jmTm = 0;
    if (!root.isConnected) return;
    const p = shownPage(), now = pageNow(), x = save();
    jm.set(p); wheel.set(p);
    if (kind === "juz") { const left = Math.max(1, (JUZ_PAGE[juz] || PAGES + 1) - p); modeCap.textContent = `Читаем джуз ${juz} целиком · до конца ${left} ${plural(left, "страница", "страницы", "страниц")}`; }
    if (!root.classList.contains("quiet")) fillInfo();
    if (now !== lastPage) { // перешли ровно на следующую страницу — предыдущая прочитана
      if (now === lastPage + 1 && lastPage >= 1) readPage(lastPage);
      lastPage = now;
      dwell = 0;
    }
  };
  scroller.addEventListener("scroll", () => {
    const end = endEl.offsetTop - scroller.clientHeight * 0.35; // полоса сверху — доля прочитанного
    prog.style.width = (end > 0 ? Math.min(1, scroller.scrollTop / end) * 100 : 100) + "%";
    if (!jmTm) jmTm = setTimeout(updJuz, 250);
  }, { passive: true });

  // --- выход: кнопка, Esc, «назад»; место чтения запоминается ---
  let closed = false;
  const close = () => location.replace("#/quran");
  // Открытое окно или панель «Aa»: Esc и «назад» закрывают только их, чтение остаётся. Клавиши слушаем на этапе capture —
  // раньше, чем окно закроет само себя: иначе к этому моменту окна уже нет, и тот же Esc закрывал бы ещё и чтение.
  const overlay = () => document.querySelector("#modal-root .modal-wrap:not(.out), .size-pop");
  let escAt = 0; // когда Esc достался окну: выход из полного экрана от того же нажатия чтение не закрывает
  const keys = (e) => {
    if (e.key === "Escape" && overlay()) { escAt = Date.now(); return; }
    if (e.target.closest?.("input, .size-pop") || document.querySelector("#modal-root .modal-wrap:not(.out)")) return;
    if (e.key === " ") { if (e.target.closest?.("button")) return; e.preventDefault(); setRunning(!running); } // на кнопке пробел и так её нажимает
    else if (e.key === "+" || e.key === "=") setSpeed(1);
    else if (e.key === "-") setSpeed(-1);
    else if (e.key === "Escape") close();
    else if (kind === "page" && e.key === "ArrowLeft") turn(1);
    else if (kind === "page" && e.key === "ArrowRight") turn(-1);
    else if (/^(Arrow|Page|Home|End)/.test(e.key)) hold(500);
  };
  // выход из полного экрана (Esc на компьютере, «назад» на телефоне) закрывает и чтение
  let wasFull = isFullscreen();
  const offFs = onFullscreenChange(() => {
    const on = isFullscreen();
    if (root.isConnected) fillMenu();
    if (wasFull && !on && !closed) {
      // в полном экране Esc и «назад» до страницы не доходят — браузер просто выходит из него; открытое окно закрываем сами
      if (overlay()) document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      else if (Date.now() - escAt > 600) close();
    }
    wasFull = on;
  });
  const cleanup = () => {
    closed = true;
    if (root.isConnected) {
      const x = save();
      if (kind === "mark" && !finished && !doneToday(markNow())) setMark(mark.id, (y) => { y.cur = { s: x.s, a: x.a }; }); // не дочитали — в следующий раз продолжим отсюда
    }
    running = false; cancelAnimationFrame(raf); clearTimeout(jmTm);
    clearInterval(clock); readTick(spent); spent = 0;
    wakeWhile(null);
    removeEventListener("keydown", keys, true); offFs(); offPlay();
    if (!wantFullscreen() && !READING.test(location.hash)) exitFullscreen(); // при переходе к следующей суре экран остаётся развёрнутым
  };
  addEventListener("keydown", keys, true);
  wakeWhile(() => running || listening); // пока текст идёт сам или читает чтец, экран не гаснет и без касаний
  addEventListener("hashchange", cleanup, { once: true });

  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (!root.isConnected) return;
    const x = start && find(start.s, start.a);
    if (x && x !== flat[0]) jump(x); else pin = { p: pageOf(flat[0]), top: scroller.scrollTop };
    scroller.focus({ preventScroll: true });
    fillMenu();
    updJuz();
    try { if (!localStorage.getItem("tanwin.readHint")) { localStorage.setItem("tanwin.readHint", "1"); toast("Нажмите на экран — появится меню. Ещё раз — исчезнет.", 5000); } } catch {}
  }));
  syncListen();
  setRunning(auto);
  return root;
}

async function cacheSurah(n, data) {
  if (!("caches" in window)) return toast("Браузер не поддерживает офлайн-хранение.");
  const rec = RECITERS[store.get().settings.reciter];
  const urls = data.v.map((_, i) => rec.url(n, i + 1));
  data.v.forEach((v, ai) => v[0].forEach((_, wi) => urls.push(`https://audio.qurancdn.com/wbw/${wordKey(n, ai + 1, wi + 1)}.mp3`)));
  const c = await caches.open("tanwin-audio");
  let ok = 0;
  toast(`Скачиваю аудио суры: 0 из ${urls.length}…`, 60000);
  for (let i = 0; i < urls.length; i += 6) {
    await Promise.all(urls.slice(i, i + 6).map(async (u) => { try { if (!(await c.match(u))) { const r = await fetch(u); if (r.ok) await c.put(u, r); } ok++; } catch {} }));
    toast(`Скачиваю аудио суры: ${ok} из ${urls.length}…`, 60000);
  }
  toast(ok === urls.length ? "Готово: сура доступна без интернета ✓" : `Скачано ${ok} из ${urls.length}. Попробуйте ещё раз при хорошем интернете.`, 4000);
}
export { BISMILLAH };
