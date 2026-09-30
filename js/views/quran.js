// Мусхаф: список сур и читалка с таджвидом, пословным аудио и синхронной подсветкой.
import { h, ar, icon, tr, modal, toast, plural, rich } from "../ui.js";
import { loadSurahs, loadSurah, surahMeta, wordKey, RECITERS, pad } from "../data.js";
import { RULES, LEGEND, parseMarkup, plain, rulesIn } from "../rules.js";
import { translit, stripStops } from "../arabic.js";
import { playWord, playAyah, stop, onPlay, playingId } from "../audio.js";
import { store, surahDone } from "../store.js";
import { SURAH_PATH } from "../course.js";
import { go } from "../app.js";

export const arNum = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const BISMILLAH = "بِسۡمِ [wٱ]للَّهِ [wٱ][lل]رَّحۡمَ[nـٰ]نِ [wٱ][lل]رَّح[pِي]مِ";

export function legendModal() {
  modal(h("div.legend", null,
    h("h2", null, "Цвета таджвида"),
    h("p.muted", null, "Цвет показывает правило чтения. Нажмите на любое слово в мусхафе — увидите, какие правила в нём есть."),
    h("div.legend-list", null, ...LEGEND.map((c) => h("div.lg-row", null, h("span.lg-sw", { style: { background: `var(--r-${c})` } }), h("div", null, h("b", null, RULES[c].name), h("small.muted", null, rich(RULES[c].short)))))),
    h("a.btn.secondary.wide", { href: "#/rules" }, "Подробно о правилах")));
}

// ---------- Список сур ----------
export async function QuranList() {
  const list = await loadSurahs();
  const reads = store.get().reads || {};
  let filter = "path", q = "";
  const box = h("div.surah-list");
  const draw = () => {
    const ql = q.trim().toLowerCase();
    const items = list.filter((s) => (filter === "all" || SURAH_PATH.includes(s.id)) &&
      (!ql || String(s.id) === ql || s.ru.toLowerCase().includes(ql) || s.meaning.toLowerCase().includes(ql) || s.ar.includes(q.trim())));
    const ordered = filter === "path" ? SURAH_PATH.map((n) => items.find((s) => s.id === n)).filter(Boolean) : items;
    box.replaceChildren(...ordered.map((s) => h("a.surah-row", { href: `#/quran/${s.id}` },
      h("span.sr-num", null, h("span", null, s.id)),
      h("div.sr-main", null, h("b", null, s.ru), h("small.muted", null, `${s.meaning} · ${s.verses} ${plural(s.verses, "аят", "аята", "аятов")} · ${s.place === "м" ? "мекканская" : "мединская"}`)),
      surahDone(s.id) || reads[s.id] ? h("span.sr-done", { title: "Прочитана" }, icon("check", { size: 16, sw: 3 })) : null,
      h("span.sr-ar", null, ar(s.ar)))));
    if (!ordered.length) box.append(h("p.muted.center", null, "Ничего не найдено"));
  };
  const chips = h("div.seg", null,
    ...[["path", "Суры пути"], ["all", "Все 114"]].map(([k, t]) => h("button.seg-btn", { type: "button", class: k === filter ? "on" : "", onclick: (e) => { filter = k; chips.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.currentTarget)); draw(); } }, t)));
  const search = h("input.search", { type: "search", placeholder: "Поиск: название, номер…", "aria-label": "Поиск суры" });
  search.addEventListener("input", () => { q = search.value; if (q && filter === "path") { filter = "all"; chips.querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", i === 1)); } draw(); });
  draw();
  return h("div.page.quran-page", null,
    h("header.page-head", null, h("h1", null, "Коран"), h("p.muted", null, "Мусхаф Мадины, риваят Хафса от Асыма. Цветной таджвид, пословное аудио, чтецы аль-Хусари и Мишари аль-Афаси.")),
    h("div.list-tools", null, search, chips),
    h("button.link", { type: "button", onclick: legendModal }, icon("palette", { size: 16 }), " Что означают цвета?"),
    box);
}

// ---------- Всплывающее окно слова ----------
function wordPop(s, a, wi, w, meta) {
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
    codes.length ? h("div.wp-rules", null, h("div.label", null, "Правила в этом слове"),
      ...codes.map((c) => h("div.lg-row", null, h("span.lg-sw", { style: { background: `var(--r-${c})` } }), h("div", null, h("b", null, RULES[c].name), h("small.muted", null, rich(RULES[c].text)))))) : h("p.muted.small", null, "Особых правил таджвида в слове нет — читается по огласовкам."),
    h("p.muted.small", null, "Транскрипция — для отдельно прочитанного слова. В слитном чтении начало и конец слова могут звучать иначе (см. правила).")), { cls: "sheet" });
}

// ---------- Отображение аятов ----------
/**
 * Рисует аяты суры. mode: "mushaf" (сплошным текстом) или "ayat" (по аятам с переводом).
 * Возвращает { el, highlight(a, ms), scrollTo(a) }.
 */
export function renderVerses(s, data, meta, { mode = "mushaf", colors = true, translation = true, from = 1, to = data.v.length, onAyah } = {}) {
  const el = h("div.verses", { class: mode, dir: "rtl" });
  const ayahEls = [];
  for (let a = from; a <= to; a++) {
    const v = data.v[a - 1];
    const words = v[0].map((w, wi) => {
      const b = h("span.qw", { role: "button", tabindex: "0", "data-wi": wi }, ar(w, { colors, tag: "span" }));
      b.addEventListener("click", () => wordPop(s, a, wi, w, meta));
      b.addEventListener("keydown", (e) => e.key === "Enter" && wordPop(s, a, wi, w, meta));
      return b;
    });
    const mark = h("button.ayah-mark", { type: "button", "aria-label": `Аят ${a}: слушать` , onclick: () => onAyah?.(a) }, h("span", null, arNum(a)));
    if (mode === "mushaf") {
      const span = h("span.ayah", { "data-a": a }, ...words.flatMap((w) => [w, " "]), mark, " ");
      el.append(span); ayahEls[a] = span;
    } else {
      const row = h("div.ayah-row", { "data-a": a },
        h("div.ar-line", { dir: "rtl" }, ...words.flatMap((w) => [w, " "]), mark),
        translation && v[1] ? h("p.translation", { dir: "ltr" }, h("b", null, a + ". "), v[1]) : null);
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
    scrollTo(a) { ayahEls[a]?.scrollIntoView({ block: "center", behavior: "smooth" }); },
  };
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

// ---------- Читалка ----------
export async function Reader(n) {
  const [list, data] = await Promise.all([loadSurahs(), loadSurah(n)]);
  const meta = list[n - 1];
  const st = store.get().settings;
  let mode = localStorage.getItem("tanwin.readerMode") || "mushaf";
  const body = h("div.reader-body");
  let view, player;
  const draw = () => {
    stop();
    view = renderVerses(n, data, meta, { mode, colors: store.get().settings.tajweed, translation: store.get().settings.translation, onAyah: (a) => player.playFrom(a) });
    player = surahPlayer(n, data, view, { onFinish: () => toast("Сура прослушана. Прочитайте её сами — вслух!") });
    toolbar.replaceChildren(player.btn, player.repBtn, reciterBtn(), rateBtn(), modeBtn(), colorBtn(), h("button.tool", { type: "button", title: "Цвета таджвида", onclick: legendModal }, icon("info", { size: 18 })));
    body.replaceChildren(
      n !== 1 && n !== 9 ? h("div.bismillah", null, ar(BISMILLAH, { colors: store.get().settings.tajweed })) : "",
      view.el,
      h("div.reader-end", null,
        h("button.btn.secondary", { type: "button", onclick: () => { store.set((s) => { s.reads = s.reads || {}; s.reads[n] = (s.reads[n] || 0) + 1; }); toast("Отмечено: сура прочитана ✓"); } }, icon("check", { size: 18 }), "Я прочитал(а) эту суру"),
        n < 114 ? h("a.btn.ghost", { href: `#/quran/${n + 1}` }, "Следующая сура", icon("right", { size: 18 })) : null,
        h("button.btn.ghost", { type: "button", onclick: () => cacheSurah(n, data) }, icon("down", { size: 18 }), "Скачать аудио для офлайна")));
  };
  const toolbar = h("div.reader-tools");
  const reciterBtn = () => h("button.tool", { type: "button", title: "Чтец", onclick: () => {
    store.set((s) => { s.settings.reciter = s.settings.reciter === "husary" ? "afasy" : "husary"; });
    toast("Чтец: " + RECITERS[store.get().settings.reciter].name + " — " + RECITERS[store.get().settings.reciter].note); draw();
  } }, icon("ear", { size: 18 }), h("span", null, store.get().settings.reciter === "husary" ? "Хусари" : "Афаси"));
  const rateBtn = () => h("button.tool", { type: "button", title: "Скорость", onclick: () => {
    store.set((s) => { const r = s.settings.rate || 1; s.settings.rate = r === 1 ? 0.8 : r === 0.8 ? 1.2 : 1; }); draw();
  } }, icon("slow", { size: 18 }), h("span", null, (store.get().settings.rate || 1) + "×"));
  const modeBtn = () => h("button.tool", { type: "button", title: "Вид", onclick: () => { mode = mode === "mushaf" ? "ayat" : "mushaf"; try { localStorage.setItem("tanwin.readerMode", mode); } catch {} draw(); } }, icon(mode === "mushaf" ? "list" : "book", { size: 18 }), h("span", null, mode === "mushaf" ? "По аятам" : "Мусхаф"));
  const colorBtn = () => h("button.tool", { type: "button", class: store.get().settings.tajweed ? "on" : "", title: "Цвета таджвида", onclick: () => { store.set((s) => { s.settings.tajweed = !s.settings.tajweed; }); draw(); } }, icon("palette", { size: 18 }), h("span", null, "Таджвид"));
  draw();
  return h("div.page.reader", null,
    h("header.reader-head", null,
      h("a.icon-btn", { href: "#/quran", "aria-label": "К списку сур" }, icon("left")),
      h("div.rh-title", null, h("h1", null, meta.ru), h("div.muted", null, `${meta.meaning} · ${meta.verses} ${plural(meta.verses, "аят", "аята", "аятов")}`)),
      h("div.rh-ar", null, ar(meta.ar))),
    toolbar, body);
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
