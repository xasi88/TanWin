// Мусхаф: список сур и читалка с таджвидом, пословным аудио и синхронной подсветкой.
import { h, ar, icon, tr, modal, toast, plural, rich, sizeButton } from "../ui.js";
import { loadSurahs, loadSurah, surahMeta, wordKey, RECITERS, pad } from "../data.js";
import { RULES, LEGEND, parseMarkup, plain, rulesIn } from "../rules.js";
import { translit, stripStops } from "../arabic.js";
import { playWord, playAyah, stop, onPlay, playingId } from "../audio.js";
import { store, surahDone } from "../store.js";
import { SURAH_PATH } from "../course.js";
import { go } from "../app.js";
import { enterFullscreen, exitFullscreen, isFullscreen, wantFullscreen, onFullscreenChange } from "../fullscreen.js";

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
  const r = store.get().reading;
  return h("div.page.quran-page", null,
    h("header.page-head", null, h("h1", null, "Коран"), h("p.muted", null, "Мусхаф Мадины, риваят Хафса от Асыма. Цветной таджвид, пословное аудио, чтецы аль-Хусари и Мишари аль-Афаси.")),
    continueReading(),
    h("button.card.pages-card", { type: "button", onclick: () => r?.p ? go(`/page/${r.p}`) : pagePicker(1) },
      h("span.rc-ic", null, icon("page", { size: 24 })),
      h("div", null, h("b", null, "Мусхаф по страницам"), h("div.muted", null, "604 страницы и 30 джузов — как в печатном мусхафе Мадины")),
      icon("right")),
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
 * pages — отметки страниц мусхафа Мадины; hifz — заучивание: 0 все слова видны, 1…3 — скрыта треть / две трети / все;
 * bare — без рамки (для страницы мусхафа). Возвращает { el, highlight(a, ms), scrollTo(a) }.
 */
export function renderVerses(s, data, meta, { mode = "mushaf", colors = true, translation = true, from = 1, to = data.v.length, onAyah, pages = false, hifz = 0, bare = false } = {}) {
  const el = h("div.verses", { class: `${mode}${bare ? " bare" : ""}${hifz ? " hifz" : ""}`, dir: "rtl" });
  const ayahEls = [];
  let lastPage = null;
  for (let a = from; a <= to; a++) {
    const v = data.v[a - 1];
    const page = v[4]?.[0];
    if (pages && page && page !== lastPage) el.append(pageMark(page, v[5], s, a));
    lastPage = page;
    const words = v[0].map((w, wi) => {
      const hide = hifz && (hifz >= 3 || (a * 5 + wi * 2) % 3 < hifz);
      const b = h("span.qw", { role: "button", tabindex: "0", "data-wi": wi, class: hide ? "hid" : "" }, ar(w, { colors, tag: "span" }));
      // скрытое слово: первое нажатие открывает его, следующее — карточку слова
      const open = () => { if (b.classList.contains("hid") && !b.classList.contains("shown")) { b.classList.add("shown"); return; } wordPop(s, a, wi, w, meta); };
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
    scrollTo(a, behavior = "smooth") { ayahEls[a]?.scrollIntoView({ block: "center", behavior }); },
    ayahEls,
  };
}

// Отметка начала страницы мусхафа Мадины (604 страницы). Нажатие — открыть эту страницу целиком.
function pageMark(p, juz, s, a) {
  return h("a.page-mark", { href: `#/page/${p}`, dir: "ltr", title: "Открыть страницу мусхафа" },
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
/** Запоминает место чтения (сура, аят, страница): «Продолжить чтение» в списке сур и на главной. */
function saveReading(s, a, page, mode) {
  const r = store.get().reading;
  if (r && r.s === s && r.a === a && r.mode === mode) return;
  store.set((st) => { st.reading = { s, a, p: page || null, mode, at: Date.now() }; });
}
/** Следит за верхним видимым аятом и сохраняет его (с задержкой, чтобы не писать на каждый пиксель прокрутки). */
function trackReading(s, data, view, mode) {
  let tm = 0;
  const seen = new Map();
  const io = new IntersectionObserver((es) => {
    if (!view.el.isConnected) { io.disconnect(); return; }
    for (const e of es) seen.set(+e.target.dataset.a, e.isIntersecting);
    clearTimeout(tm);
    tm = setTimeout(() => {
      const vis = [...seen].filter(([, v]) => v).map(([a]) => a);
      if (!vis.length || !view.el.isConnected) return;
      const a = Math.min(...vis);
      saveReading(s, a, data.v[a - 1][4]?.[0], mode);
    }, 900);
  }, { rootMargin: "-20% 0px -50% 0px" });
  view.ayahEls.forEach((el) => el && io.observe(el));
}
/** Карточка «Продолжить чтение Корана» (или null, если читатель ещё не открывал мусхаф). */
export function continueReading() {
  const r = store.get().reading;
  const m = r && surahMeta(r.s);
  if (!m) return null;
  const href = r.mode === "page" && r.p ? `#/page/${r.p}` : `#/quran/${r.s}/${r.a}`;
  return h("a.card.reading-card", { href },
    h("span.rc-ic", null, icon("book", { size: 24 })),
    h("div", null, h("b", null, "Продолжить чтение Корана"), h("div.muted", null, `Сура ${m.ru}, аят ${r.a}${r.p ? ` · страница ${r.p}` : ""}`)),
    icon("right"));
}

// ---------- Заучивание ----------
const HIFZ = ["Выкл.", "Треть", "Две трети", "Все слова"];
const hifzLevel = () => { try { return +localStorage.getItem("tanwin.hifz") || 0; } catch { return 0; } };
function hifzBtn(redraw) {
  const lv = hifzLevel();
  return h("button.tool", { type: "button", class: lv ? "on" : "", title: "Заучивание: скрыть часть слов", onclick: () => {
    const next = (hifzLevel() + 1) % HIFZ.length;
    try { localStorage.setItem("tanwin.hifz", next); } catch {}
    toast(next ? `Заучивание: скрыто — ${HIFZ[next].toLowerCase()}. Читайте по памяти; нажмите на слово, чтобы подсмотреть. Слушая чтеца, слова открываются по ходу.` : "Заучивание выключено — все слова видны.", 4200);
    redraw();
  } }, icon("eye", { size: 18 }), h("span", null, lv ? `Заучивание: ${HIFZ[lv].toLowerCase()}` : "Заучивание"));
}

// ---------- Читалка ----------
export async function Reader(n, startA = 0) {
  const [list, data] = await Promise.all([loadSurahs(), loadSurah(n)]);
  const meta = list[n - 1];
  let mode = localStorage.getItem("tanwin.readerMode") || "mushaf";
  const body = h("div.reader-body");
  let view, player;
  const draw = () => {
    stop();
    view = renderVerses(n, data, meta, { mode, pages: true, hifz: hifzLevel(), colors: store.get().settings.tajweed, translation: store.get().settings.translation, onAyah: (a) => player.playFrom(a) });
    player = surahPlayer(n, data, view, { onFinish: () => toast("Сура прослушана. Прочитайте её сами — вслух!") });
    toolbar.replaceChildren(player.btn, player.repBtn, readBtn(n, () => (store.get().reading?.s === n ? store.get().reading.a : 1)), sizeButton({ cls: "tool" }), hifzBtn(draw), pagesBtn(), reciterBtn(), rateBtn(), modeBtn(), colorBtn(), h("button.tool", { type: "button", title: "Цвета таджвида", onclick: legendModal }, icon("info", { size: 18 })));
    body.replaceChildren(
      n !== 1 && n !== 9 ? h("div.bismillah", null, ar(BISMILLAH, { colors: store.get().settings.tajweed })) : "",
      view.el,
      h("div.reader-end", null,
        h("button.btn.secondary", { type: "button", onclick: () => { store.set((s) => { s.reads = s.reads || {}; s.reads[n] = (s.reads[n] || 0) + 1; }); toast("Отмечено: сура прочитана ✓"); } }, icon("check", { size: 18 }), "Я прочитал(а) эту суру"),
        n < 114 ? h("a.btn.ghost", { href: `#/quran/${n + 1}` }, "Следующая сура", icon("right", { size: 18 })) : null,
        h("button.btn.ghost", { type: "button", onclick: () => cacheSurah(n, data) }, icon("down", { size: 18 }), "Скачать аудио для офлайна")));
    trackReading(n, data, view, mode);
  };
  const toolbar = h("div.reader-tools");
  const reciterBtn = () => h("button.tool", { type: "button", title: "Чтец", onclick: () => {
    store.set((s) => { s.settings.reciter = s.settings.reciter === "husary" ? "afasy" : "husary"; });
    toast("Чтец: " + RECITERS[store.get().settings.reciter].name + " — " + RECITERS[store.get().settings.reciter].note); draw();
  } }, icon("ear", { size: 18 }), h("span", null, store.get().settings.reciter === "husary" ? "Хусари" : "Афаси"));
  const rateBtn = () => h("button.tool", { type: "button", title: "Скорость", onclick: () => {
    store.set((s) => { const r = s.settings.rate || 1; s.settings.rate = r === 1 ? 0.8 : r === 0.8 ? 1.2 : 1; }); draw();
  } }, icon("slow", { size: 18 }), h("span", null, (store.get().settings.rate || 1) + "×"));
  const modeBtn = () => h("button.tool", { type: "button", title: "Вид", onclick: () => { mode = mode === "mushaf" ? "ayat" : "mushaf"; try { localStorage.setItem("tanwin.readerMode", mode); } catch {} draw(); } }, icon(mode === "mushaf" ? "list" : "book", { size: 18 }), h("span", null, mode === "mushaf" ? "По аятам" : "Сплошной текст"));
  // страницы: открываем ту, на которой сейчас читатель
  const pagesBtn = () => h("button.tool", { type: "button", title: "Страницы мусхафа Мадины", onclick: () => {
    const r = store.get().reading;
    const a = r?.s === n ? r.a : 1;
    go(`/page/${data.v[a - 1][4][0]}`);
  } }, icon("page", { size: 18 }), h("span", null, "Страницы"));
  const colorBtn = () => h("button.tool", { type: "button", class: store.get().settings.tajweed ? "on" : "", title: "Цвета таджвида", onclick: () => { store.set((s) => { s.settings.tajweed = !s.settings.tajweed; }); draw(); } }, icon("palette", { size: 18 }), h("span", null, "Таджвид"));
  draw();
  if (startA > 1 && startA <= data.v.length) requestAnimationFrame(() => requestAnimationFrame(() => view.scrollTo(startA, "auto")));
  return h("div.page.reader", null,
    h("header.reader-head", null,
      h("a.icon-btn", { href: "#/quran", "aria-label": "К списку сур" }, icon("left")),
      h("div.rh-title", null, h("h1", null, meta.ru), h("div.muted", null, `${meta.meaning} · ${meta.verses} ${plural(meta.verses, "аят", "аята", "аятов")} · с. ${data.v[0][4][0]}`)),
      h("div.rh-ar", null, ar(meta.ar))),
    toolbar, body);
}

// ---------- Режим чтения: только арабский текст на весь экран, с автопрокруткой ----------
const SPEED = { min: 1, max: 20, def: 4, px: 3 }; // скорость 1…20; одно деление — 3 px/с при обычном размере арабского текста
const readSpeed = () => { try { return Math.min(SPEED.max, Math.max(SPEED.min, Math.round(+localStorage.getItem("tanwin.readSpeed")) || SPEED.def)); } catch { return SPEED.def; } };

/** Кнопка «Чтение» в читалке. Полный экран включается здесь же: браузер разрешает это только по нажатию. */
function readBtn(s, ayah) {
  return h("button.tool", { type: "button", title: "Режим чтения: только арабский текст на весь экран, автопрокрутка", onclick: () => { enterFullscreen(); go(`/read/${s}/${ayah()}`); } },
    icon("expand", { size: 18 }), h("span", null, "Чтение"));
}

export async function ReadMode(n, startA = 0) {
  const [list, data] = await Promise.all([loadSurahs(), loadSurah(n)]);
  const meta = list[n - 1];
  const colors = store.get().settings.tajweed;
  const view = renderVerses(n, data, meta, { mode: "mushaf", bare: true, colors });
  const scroller = h("div.focus-scroll", { tabindex: "-1" },
    h("div.focus-text", null,
      h("div.surah-banner", null, ar(meta.ar), h("small", null, `Сура ${meta.ru}`)),
      n !== 1 && n !== 9 ? h("div.bismillah", null, ar(BISMILLAH, { colors })) : null,
      view.el));
  const prog = h("i.focus-prog");

  // --- автопрокрутка ---
  let speed = readSpeed(), running = false, raf = 0, last = 0, pos = 0, touching = false, holdUntil = 0, wake = null;
  const maxTop = () => scroller.scrollHeight - scroller.clientHeight;
  const pxPerSec = () => speed * SPEED.px * (store.get().settings.arScale || 1); // крупнее текст — выше строка: темп в строках тот же
  const tick = (t) => {
    if (!running) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(100, t - last);
    last = t;
    // палец на экране, колесо мыши, клавиши — читатель листает сам; продолжаем с нового места
    if (touching || t < holdUntil || Math.abs(scroller.scrollTop - pos) > 3) { pos = scroller.scrollTop; return; }
    pos += pxPerSec() * dt / 1000;
    scroller.scrollTop = pos;
    if (pos >= maxTop() - 1) setRunning(false);
  };
  const lockScreen = async () => { try { wake = await navigator.wakeLock?.request("screen"); } catch {} }; // экран не гаснет, пока текст идёт
  const setRunning = (on) => {
    if (on && scroller.scrollTop >= maxTop() - 1) scroller.scrollTop = 0; // дочитали до конца — начинаем сначала
    running = on;
    cancelAnimationFrame(raf);
    if (on) { pos = scroller.scrollTop; last = performance.now(); raf = requestAnimationFrame(tick); lockScreen(); }
    else { wake?.release?.().catch(() => {}); wake = null; }
    playB.replaceChildren(icon(on ? "pause" : "play", { size: 22, fill: !on, sw: on ? 3 : 1.5 }));
    playB.setAttribute("aria-label", on ? "Остановить прокрутку" : "Включить автопрокрутку");
    playB.classList.toggle("playing", on);
    show();
  };
  const hold = (ms) => { holdUntil = performance.now() + ms; };
  const setSpeed = (d) => {
    speed = Math.min(SPEED.max, Math.max(SPEED.min, speed + d));
    try { localStorage.setItem("tanwin.readSpeed", speed); } catch {}
    val.textContent = speed; slower.disabled = speed <= SPEED.min; faster.disabled = speed >= SPEED.max;
    show();
  };

  // --- панель управления: прячется, пока текст идёт; возвращается по нажатию ---
  const playB = h("button.play-btn", { type: "button", onclick: () => setRunning(!running) });
  const val = h("b.focus-speed", { title: "Скорость прокрутки" }, speed);
  const slower = h("button.sp-btn", { type: "button", "aria-label": "Медленнее", title: "Медленнее", disabled: speed <= SPEED.min, onclick: () => setSpeed(-1) }, "−");
  const faster = h("button.sp-btn", { type: "button", "aria-label": "Быстрее", title: "Быстрее", disabled: speed >= SPEED.max, onclick: () => setSpeed(1) }, "+");
  const bar = h("div.focus-bar", { role: "toolbar", "aria-label": "Автопрокрутка" },
    h("button.icon-btn", { type: "button", "aria-label": "Выйти из режима чтения", title: "Выйти", onclick: () => close() }, icon("close")),
    playB, slower, val, faster, sizeButton());
  const root = h("div.focus", null, prog, scroller, bar);
  let hideTm = 0;
  const show = () => {
    root.classList.remove("quiet");
    clearTimeout(hideTm);
    hideTm = setTimeout(() => { if (!running) return; if (document.querySelector(".size-pop")) show(); else root.classList.add("quiet"); }, 2600);
  };
  // нажатие на текст не открывает карточку слова, а показывает или прячет панель
  scroller.addEventListener("click", (e) => { e.stopPropagation(); if (root.classList.contains("quiet") || !running) show(); else root.classList.add("quiet"); }, true);
  scroller.addEventListener("touchstart", () => { touching = true; }, { passive: true });
  const touchEnd = () => { touching = false; hold(900); }; // даём докатиться прокрутке по инерции
  scroller.addEventListener("touchend", touchEnd, { passive: true });
  scroller.addEventListener("touchcancel", touchEnd, { passive: true });
  scroller.addEventListener("wheel", () => hold(500), { passive: true });
  scroller.addEventListener("scroll", () => { prog.style.width = (maxTop() > 0 ? Math.min(1, scroller.scrollTop / maxTop()) * 100 : 0) + "%"; }, { passive: true });
  root.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" && root.classList.contains("quiet")) show(); });

  // --- выход: кнопка, Esc, «назад»; место чтения запоминается ---
  const curAyah = () => {
    const top = scroller.getBoundingClientRect().top + scroller.clientHeight * 0.25;
    for (let a = 1; a < view.ayahEls.length; a++) if (view.ayahEls[a].getBoundingClientRect().bottom > top) return a;
    return data.v.length;
  };
  let closed = false;
  const close = () => location.replace(`#/quran/${n}/${curAyah()}`);
  const keys = (e) => {
    if (e.target.closest?.("input, .size-pop")) return;
    if (e.key === " ") { if (e.target.closest?.("button")) return; e.preventDefault(); setRunning(!running); } // на кнопке пробел и так её нажимает
    else if (e.key === "+" || e.key === "=") setSpeed(1);
    else if (e.key === "-") setSpeed(-1);
    else if (e.key === "Escape") close();
    else if (/^(Arrow|Page|Home|End)/.test(e.key)) hold(500);
  };
  // выход из полного экрана (Esc на компьютере, «назад» на телефоне) закрывает и режим чтения
  let wasFull = isFullscreen();
  const offFs = onFullscreenChange(() => { if (wasFull && !isFullscreen() && !closed) close(); wasFull = isFullscreen(); });
  const vis = () => { if (running && document.visibilityState === "visible") lockScreen(); }; // блокировка сна снимается, когда приложение свёрнуто
  const cleanup = () => {
    closed = true;
    if (view.el.isConnected) { const a = curAyah(); saveReading(n, a, data.v[a - 1][4]?.[0], "mushaf"); }
    running = false; cancelAnimationFrame(raf); clearTimeout(hideTm);
    wake?.release?.().catch(() => {});
    removeEventListener("keydown", keys); document.removeEventListener("visibilitychange", vis); offFs();
    if (!wantFullscreen()) exitFullscreen();
  };
  addEventListener("keydown", keys);
  document.addEventListener("visibilitychange", vis);
  addEventListener("hashchange", cleanup, { once: true });

  trackReading(n, data, view, "mushaf");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (startA > 1 && startA <= data.v.length) scroller.scrollTop += view.ayahEls[startA].getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientHeight * 0.2;
    scroller.focus({ preventScroll: true });
  }));
  setRunning(false);
  return root;
}

// ---------- Страница мусхафа Мадины ----------
export const PAGES = 604;
const JUZ_PAGE = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];

/** Аяты страницы p: [{ s, meta, data, from, to }] — на одной странице может быть конец одной суры и начало другой. */
async function pageContent(p) {
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

/** Переход к странице / джузу. */
function pagePicker(cur) {
  modal((close) => {
    const inp = h("input.text-in.big", { type: "number", min: 1, max: PAGES, value: cur, inputmode: "numeric", "aria-label": "Номер страницы" });
    const goTo = () => { const v = Math.round(+inp.value); if (v >= 1 && v <= PAGES) { close(); go(`/page/${v}`); } else toast(`Номер страницы — от 1 до ${PAGES}`); };
    inp.addEventListener("keydown", (e) => e.key === "Enter" && goTo());
    return h("div.page-picker", null,
      h("h2", null, "Перейти"),
      h("div.row.gap", null, inp, h("button.btn.primary", { type: "button", onclick: goTo }, "Открыть")),
      h("div.label", null, "Начало джуза"),
      h("div.juz-grid", null, ...JUZ_PAGE.map((jp, i) => h("button.juz-btn", { type: "button", class: jp <= cur && (JUZ_PAGE[i + 1] || 605) > cur ? "on" : "", onclick: () => { close(); go(`/page/${jp}`); } }, h("b", null, i + 1), h("small", null, `с. ${jp}`)))));
  });
}

export async function MushafPage(p) {
  p = Math.min(PAGES, Math.max(1, p));
  const parts = await pageContent(p);
  const colors = store.get().settings.tajweed;
  const juz = parts[0]?.data.v[parts[0].from - 1][5];
  const views = [];
  const frame = h("div.mushaf-page", { dir: "rtl" });
  const draw = () => {
    stop();
    views.length = 0;
    frame.replaceChildren();
    for (const part of parts) {
      if (part.from === 1) {
        frame.append(h("div.surah-banner", null, ar(part.meta.ar), h("small", { dir: "ltr" }, `Сура ${part.meta.ru}`)));
        if (part.s !== 1 && part.s !== 9) frame.append(h("div.bismillah", null, ar(BISMILLAH, { colors: store.get().settings.tajweed })));
      }
      const view = renderVerses(part.s, part.data, part.meta, { mode: "mushaf", bare: true, hifz: hifzLevel(), colors: store.get().settings.tajweed, from: part.from, to: part.to, onAyah: (a) => player.playFrom(part.s, a) });
      views.push({ part, view });
      frame.append(view.el);
    }
    toolbar.replaceChildren(player.btn, parts[0] ? readBtn(parts[0].s, () => parts[0].from) : null, sizeButton({ cls: "tool" }), hifzBtn(draw),
      h("button.tool", { type: "button", class: store.get().settings.tajweed ? "on" : "", title: "Цвета таджвида", onclick: () => { store.set((s) => { s.settings.tajweed = !s.settings.tajweed; }); draw(); } }, icon("palette", { size: 18 }), h("span", null, "Таджвид")),
      h("button.tool", { type: "button", title: "Цвета таджвида", onclick: legendModal }, icon("info", { size: 18 })));
  };
  // проигрыватель страницы: аяты подряд, через границу сур
  const player = (() => {
    let queue = [], i = -1, playing = false;
    const btn = h("button.btn.primary.play-all", { type: "button" });
    const sync = () => btn.replaceChildren(icon(playing ? "pause" : "play", { size: 20, fill: !playing, sw: playing ? 3 : 1.5 }), playing ? "Пауза" : "Слушать страницу");
    const run = () => {
      const { s, a, view } = queue[i];
      view.scrollTo(a);
      playAyah(s, a, {
        onTime: (ms) => view.highlight(a, ms),
        onEnd: () => { view.highlight(a, -1); if (++i < queue.length) run(); else { playing = false; i = -1; sync(); } },
        onError: () => { playing = false; sync(); toast("Не удалось загрузить аудио. Проверьте интернет."); },
        onStop: () => { view.highlight(a, -1); playing = false; sync(); },
      });
    };
    const playFrom = (s, a) => {
      queue = views.flatMap(({ part, view }) => Array.from({ length: part.to - part.from + 1 }, (_, k) => ({ s: part.s, a: part.from + k, view })));
      i = Math.max(0, queue.findIndex((x) => x.s === s && x.a === a));
      playing = true; sync(); run();
    };
    btn.addEventListener("click", () => { if (playing) stop(); else playFrom(parts[0].s, parts[0].from); });
    sync();
    return { btn, playFrom };
  })();
  const toolbar = h("div.reader-tools");
  draw();
  if (parts[0]) saveReading(parts[0].s, parts[0].from, p, "page");

  const nav = (to) => to >= 1 && to <= PAGES && go(`/page/${to}`);
  // в мусхафе следующая страница — слева: свайп вправо или стрелка ←
  const keys = (e) => { if (!frame.isConnected) return removeEventListener("keydown", keys); if (e.target.closest("input")) return; if (e.key === "ArrowLeft") nav(p + 1); if (e.key === "ArrowRight") nav(p - 1); };
  addEventListener("keydown", keys);
  let x0 = null, y0 = null;
  frame.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  frame.addEventListener("touchend", (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) nav(dx > 0 ? p + 1 : p - 1);
  });
  const names = parts.map((x) => x.meta.ru).join(" · ");
  const pager = () => h("div.page-nav", null,
    h("button.btn.secondary", { type: "button", "aria-label": "Следующая страница", disabled: p >= PAGES, onclick: () => nav(p + 1) }, icon("left", { size: 18 }), h("span", null, "Следующая")),
    h("button.page-no", { type: "button", onclick: () => pagePicker(p), title: "Перейти к странице или джузу" }, arNum(p)),
    h("button.btn.secondary", { type: "button", "aria-label": "Предыдущая страница", disabled: p <= 1, onclick: () => nav(p - 1) }, h("span", null, "Предыдущая"), icon("right", { size: 18 })));
  return h("div.page.reader.page-view", null,
    h("header.reader-head", null,
      h("a.icon-btn", { href: parts[0] ? `#/quran/${parts[0].s}/${parts[0].from}` : "#/quran", "aria-label": "К тексту суры" }, icon("left")),
      h("div.rh-title", null, h("h1", null, `Страница ${p}`), h("div.muted", null, `${names}${juz ? ` · джуз ${juz}` : ""}`)),
      h("button.btn.ghost.small-btn", { type: "button", onclick: () => pagePicker(p) }, icon("list", { size: 18 }), "Перейти")),
    toolbar, frame, pager(),
    h("p.muted.small.center", null, "Страницы — как в мусхафе Мадины (604 страницы). Следующая — слева: листайте вправо или нажмите «Следующая»."));
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
