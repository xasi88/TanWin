// Мелкие строительные блоки интерфейса: создание DOM, арабский текст, иконки, всплывающие окна.
import { parseMarkup } from "./rules.js";
import { playWord, playingId, onPlay, stop } from "./audio.js";
import { store } from "./store.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/** h("div.card#id", {attrs}, ...children) */
export function h(tag, attrs, ...kids) {
  const [, t = "div", rest = ""] = tag.match(/^([a-z0-9-]*)(.*)$/i);
  const el = t === "svg" || attrs?.svg ? document.createElementNS("http://www.w3.org/2000/svg", t) : document.createElement(t);
  for (const m of rest.matchAll(/([.#])([\w-]+)/g)) m[1] === "." ? el.classList.add(m[2]) : (el.id = m[2]);
  if (attrs && (typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false || k === "svg") continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "style" && typeof v === "object") for (const [sk, sv] of Object.entries(v)) sk.startsWith("--") ? el.style.setProperty(sk, sv) : (el.style[sk] = sv);
    else if (k === "class") el.classList.add(...String(v).split(/\s+/).filter(Boolean));
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

/** Арабский текст. Разметка таджвида [код…] раскрашивается, если colors=true. */
export function ar(text, { cls = "", colors = true, tag = "span", size } = {}) {
  const el = h(`${tag}.ar`, { dir: "rtl", lang: "ar", class: cls, style: size ? { "--s": size } : null });
  if (text.includes("[")) arParts(el, parseMarkup(text).map(([t, code]) => [t, code && colors ? `tj r-${code}` : ""]));
  else el.textContent = text;
  return el;
}

/** Слово из кусочков [текст, класс]: кусочки с классом — в <span> (цвет правила, подсветка). */
export function arParts(el, parts) {
  for (const [t, c] of splitShaping ? glue(parts) : parts) el.append(c ? h("span", { class: c }, t) : t);
  return el;
}

// ---------- Связность букв ----------
// Современные браузеры соединяют арабские буквы через границу <span>, а часть версий Safari (iPhone, iPad) — нет:
// буквы «рассыпаются», огласовка в отдельном span отрывается от своей буквы. Для таких движков границы span
// переносим между целыми буквами (с их огласовками) и склеиваем соседей невидимым соединителем ZWJ.
const ZWJ = "‍";
const isMarkCh = (c) => /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/.test(c);
const JOIN_NEXT = /[ئبت-خس-غـ-هىيٮٯ]/; // ب ت … ي, татвиль: соединяются и со следующей буквой
const JOIN_PREV = /[آ-إاةد-زوٱ]/; // ا د ذ ر ز و ة ٱ: только с предыдущей
export let splitShaping = false;

/** Проверяет, соединяет ли браузер буквы через границу span (вызывается после загрузки шрифта). */
export function checkShaping() {
  const width = (html) => {
    const s = h("span.ar", { style: { position: "absolute", visibility: "hidden", whiteSpace: "nowrap", fontSize: "40px" }, html });
    document.body.append(s);
    const w = s.getBoundingClientRect().width;
    s.remove();
    return w;
  };
  splitShaping = Math.abs(width("سعين") - width('سع<span style="color:red">ي</span>ن')) > 1;
}

function glue(parts) {
  const cl = []; // буква со знаками → класс: своей буквы, а если его нет — цветного знака
  for (const [t, c] of parts) for (const ch of t) {
    const last = cl[cl.length - 1];
    if (last && (isMarkCh(ch) || ch === ZWJ || (last.t[0] === "ل" && /[آأإاٱ]/.test(ch)))) { last.t += ch; last.c ||= c; }
    else cl.push({ t: ch, c });
  }
  const runs = [];
  for (const x of cl) {
    const r = runs[runs.length - 1];
    if (r && r.c === x.c) { r.t += x.t; r.last = x.t[0]; } else runs.push({ t: x.t, c: x.c, first: x.t[0], last: x.t[0] });
  }
  for (let i = 1; i < runs.length; i++) {
    if (JOIN_NEXT.test(runs[i - 1].last) && (JOIN_NEXT.test(runs[i].first) || JOIN_PREV.test(runs[i].first))) { runs[i - 1].t += ZWJ; runs[i].t = ZWJ + runs[i].t; }
  }
  return runs.map((r) => [r.t, r.c]);
}

// ---------- Арабский текст не выходит за рамки ----------
// Крупное слово (или крупный масштаб в настройках) на узком экране может не поместиться в карточку или кнопку.
// Такие слова уменьшаются ровно настолько, чтобы влезть: множитель --fit в формуле размера .ar.
const FIT_EL = ".ar:not(.inline):not(.verses .ar):not(.uh-ar .ar)";
const FIT_STOP = ".card, .modal, .lp-content, .sheet-in, .page, #view";
const px = (v) => parseFloat(v) || 0;
export function fitArabic(root = document.body) {
  const els = [...root.querySelectorAll(FIT_EL)];
  for (const el of els) el.style.removeProperty("--fit");
  const fit = new Map();
  for (let pass = 0; pass < 4; pass++) {
    const todo = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      let over = 0, box = r; // box — самый широкий «облегающий» слово блок (кнопка-чип растёт вместе со словом)
      for (let a = el.parentElement; a; a = a.parentElement) {
        const cs = getComputedStyle(a), ar = a.getBoundingClientRect();
        const left = ar.left + px(cs.borderLeftWidth) + px(cs.paddingLeft), right = ar.right - px(cs.borderRightWidth) - px(cs.paddingRight);
        over = Math.max(over, Math.max(0, left - box.left) + Math.max(0, box.right - right));
        if (a.matches(FIT_STOP)) break;
        if (cs.display.startsWith("inline")) box = ar;
      }
      if (over > 0.5) todo.push([el, r.width, over]);
    }
    if (!todo.length) break;
    for (const [el, w, over] of todo) {
      const f = Math.max(0.4, (fit.get(el) || 1) * Math.max(0.1, w - over - 2) / w);
      fit.set(el, f);
      el.style.setProperty("--fit", f.toFixed(3));
    }
  }
}
let fitQueued = 0;
export const queueFit = () => { if (!fitQueued) fitQueued = requestAnimationFrame(() => { fitQueued = 0; fitArabic(); }); };

/** Обычный текст, в котором арабские фрагменты выводятся арабским шрифтом. */
export function mixed(text) {
  const frag = document.createDocumentFragment();
  const re = /[؀-ۿ][؀-ۿً-ٰٟۖ-ۭ ]*/g;
  let i = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > i) frag.append(text.slice(i, m.index));
    frag.append(ar(m[0].trim(), { cls: "inline" }), m[0].endsWith(" ") ? " " : "");
    i = re.lastIndex;
  }
  if (i < text.length) frag.append(text.slice(i));
  return frag;
}

/** Текст урока: {арабский}, **жирный**. Арабские буквы и без скобок выводятся арабским шрифтом. */
export function rich(text) {
  const frag = document.createDocumentFragment();
  const re = /\{([^}]+)\}|\*\*([^*]+)\*\*/g;
  let i = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > i) frag.append(mixed(text.slice(i, m.index)));
    if (m[1]) frag.append(ar(m[1], { cls: "inline" }));
    else frag.append(h("b", null, mixed(m[2])));
    i = re.lastIndex;
  }
  if (i < text.length) frag.append(mixed(text.slice(i)));
  return frag;
}

// Транскрипция: особые знаки выделяются цветом (тяжёлые, межзубные, горловые)
export function tr(text, { hidden = false } = {}) {
  const el = h("span.tr", { class: hidden ? "hid" : "" });
  for (const ch of text.match(/.[̀-ͯ]*/gu) || []) {
    if (/̣/.test(ch)) el.append(h("span.tr-heavy", null, ch));
    else if (/̱/.test(ch)) el.append(h("span.tr-inter", null, ch));
    else if (/[ʿʼх̣һғҡ]/.test(ch)) el.append(h("span.tr-throat", null, ch));
    else el.append(ch);
  }
  return el;
}

// ---------- Иконки ----------
const P = {
  path: "M5 19c3-1 3-5 7-6s4-5 7-6M5 19a2 2 0 1 1-.01 0M19 7a2 2 0 1 1-.01 0M12 13a2 2 0 1 1-.01 0",
  repeat: "M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5M20 12a8 8 0 0 1-13.7 5.6L4 15M4 20v-5h5",
  book: "M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5v-13Z",
  chart: "M4 20h16M7 16v-5M12 16V6M17 16v-8",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  play: "M8 5.5v13l11-6.5-11-6.5Z",
  pause: "M8 5v14M16 5v14",
  mic: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 11a7 7 0 0 0 14 0M12 18v3",
  stop: "M7 7h10v10H7z",
  check: "m5 12.5 4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6 6 18",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  star: "m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8L12 3Z",
  flame: "M12 21c-4 0-7-2.7-7-6.5C5 10 9 8 9.5 4c2.5 1.5 4 3.5 4 6 1-.7 1.6-1.8 1.8-3 2 1.7 3.7 4.3 3.7 7.4 0 3.9-3 6.6-7 6.6Z",
  nur: "M12 2l2.2 4.6 4.9-1.5-1.5 4.9L22 12l-4.4 2 1.5 4.9-4.9-1.5L12 22l-2.2-4.6-4.9 1.5 1.5-4.9L2 12l4.4-2-1.5-4.9 4.9 1.5L12 2Z",
  right: "m9 5 7 7-7 7",
  left: "m15 5-7 7 7 7",
  close: "M6 6l12 12M18 6 6 18",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-1.7-1L15 3.5h-4L10.7 6a7.6 7.6 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7.6 7.6 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6Z",
  vol: "M4 9v6h4l5 4V5L8 9H4ZM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
  trophy: "M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8M9 17h6",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  down: "M12 4v12M6 11l6 6 6-6M5 20h14",
  down2: "m6 9 6 6 6-6",
  page: "M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h7",
  up: "M12 20V8M6 13l6-6 6 6M5 4h14",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01",
  sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  ear: "M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0M10 9a2 2 0 0 1 4 0",
  loop: "M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3",
  slow: "M3 17h13a5 5 0 0 0 5-5V9M8 17v-3a5 5 0 0 1 10 0M3 17l2-4",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  palette: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.7 1.5-1.5 0-1.2-1-1.3-1-2.5 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.1-4-7.5-9-7.5ZM7.5 11h.01M10 7.5h.01M14.5 7.5h.01",
  chat: "M21 11.5a8.4 8.4 0 0 1-12.2 7.5L3 21l2-5.5A8.4 8.4 0 1 1 21 11.5ZM8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  shrink: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z",
};
export function icon(name, { size = 22, sw = 2, fill = false, cls = "" } = {}) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", size); s.setAttribute("height", size);
  s.setAttribute("aria-hidden", "true"); s.setAttribute("class", "ic " + cls);
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", P[name] || P.info);
  p.setAttribute("fill", fill ? "currentColor" : "none");
  p.setAttribute("stroke", "currentColor"); p.setAttribute("stroke-width", sw);
  p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round");
  s.append(p);
  return s;
}

// Отписка слушателя, когда элемент убран со страницы
export function gone(el, off) {
  if (el.isConnected) { el._seen = true; return false; }
  if (el._seen) off?.();
  return true;
}

// ---------- Арабский шрифт ----------
// Семейства объявлены в css/app.css; выбранное попадает в переменную --ar-font (см. applySettings в app.js).
export const AR_FONTS = {
  amiri: { name: "Амири", css: '"Amiri Quran"' },
  hafs: { name: "Мадина", css: '"TW Hafs"' },
  scheherazade: { name: "Шехерезада", css: '"TW Scheherazade"' },
  noto: { name: "Ното", css: '"TW Noto Naskh"' },
};
export const arFont = () => (AR_FONTS[store.get().settings.arFont] ? store.get().settings.arFont : "hafs");

// ---------- Цвета таджвида при чтении Корана ----------
/** Включает или выключает цвета правил в читалке, на странице мусхафа и в режиме чтения (без перерисовки — через класс tj-off). */
export function setTajweed(on) {
  store.set((s) => { s.settings.tajweed = on; });
  for (const b of document.querySelectorAll("[data-tj-btn]")) { b.classList.toggle("on", on); if (b.matches(".switch")) b.setAttribute("aria-checked", on ? "true" : "false"); }
}

// ---------- Размер текста ----------
export const SIZES = {
  arScale: { label: "Арабский", min: 0.8, max: 2.4, step: 0.1 },
  uiScale: { label: "Текст", min: 0.9, max: 1.4, step: 0.05 },
};
/** Меняет размер на шаг (d = +1 / −1) в пределах настройки. */
export function stepSize(key, d) {
  const { min, max, step } = SIZES[key];
  store.set((s) => { s.settings[key] = Math.round(Math.min(max, Math.max(min, (s.settings[key] || 1) + d * step)) * 100) / 100; });
}
/** Кнопка «Aa»: панель «−/+» для арабского и остального текста и выбор арабского шрифта прямо в уроке или читалке. */
export function sizeButton({ cls = "icon-btn" } = {}) {
  const b = h("button.size-btn", { type: "button", class: cls, "aria-label": "Размер текста и шрифт", title: "Размер текста и шрифт", "aria-haspopup": "dialog" }, h("b.aa", null, "Aa"));
  b.addEventListener("click", () => sizePanel(b));
  return b;
}
let sizePop = null;
function sizePanel(anchor) {
  if (sizePop) { const same = sizePop.anchor === anchor; sizePop.close(); if (same) return; }
  const row = (key) => {
    const { label, min, max } = SIZES[key];
    const val = h("b.sp-val");
    const less = h("button.sp-btn", { type: "button", "aria-label": `${label}: меньше`, onclick: () => { stepSize(key, -1); upd(); } }, "−");
    const more = h("button.sp-btn", { type: "button", "aria-label": `${label}: больше`, onclick: () => { stepSize(key, 1); upd(); } }, "+");
    const upd = () => { const v = store.get().settings[key] || 1; val.textContent = Math.round(v * 100) + "%"; less.disabled = v <= min + 1e-6; more.disabled = v >= max - 1e-6; };
    upd();
    return h("div.sp-row", null, h("span", null, label), less, val, more);
  };
  const fonts = h("div.sp-fonts", { role: "radiogroup", "aria-label": "Арабский шрифт" });
  const updFonts = () => [...fonts.children].forEach((b) => { const on = b.dataset.k === arFont(); b.classList.toggle("on", on); b.setAttribute("aria-checked", on ? "true" : "false"); });
  for (const [k, f] of Object.entries(AR_FONTS)) fonts.append(h("button.seg-btn", { type: "button", role: "radio", "data-k": k, onclick: () => { store.set((s) => { s.settings.arFont = k; }); updFonts(); } }, f.name));
  updFonts();
  const tjOn = !!store.get().settings.tajweed;
  const tj = h("button.switch", { type: "button", role: "switch", "data-tj-btn": true, "aria-label": "Цвета таджвида", "aria-checked": tjOn ? "true" : "false", class: tjOn ? "on" : "", onclick: () => setTajweed(!store.get().settings.tajweed) }, h("i"));
  const el = h("div.size-pop", { role: "dialog", "aria-label": "Размер текста и шрифт" }, row("arScale"), row("uiScale"), h("div.sp-font", null, h("span", null, "Арабский шрифт"), fonts),
    h("div.sp-row.sp-tj", null, h("span", null, "Цвета таджвида"), tj));
  document.body.append(el);
  // панель — под кнопкой, а если снизу нет места (кнопка внизу экрана) — над ней
  const place = () => { const r = anchor.getBoundingClientRect(), ph = el.offsetHeight; el.style.top = Math.round(r.bottom + 8 + ph > innerHeight ? Math.max(8, r.top - 8 - ph) : r.bottom + 8) + "px"; el.style.right = Math.max(8, Math.round(innerWidth - r.right)) + "px"; };
  place();
  const outside = (e) => { if (!el.contains(e.target) && !anchor.contains(e.target)) close(); };
  const esc = (e) => e.key === "Escape" && close();
  const close = () => { el.remove(); sizePop = null; document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", esc); removeEventListener("hashchange", close); removeEventListener("resize", place); };
  document.addEventListener("pointerdown", outside, true);
  document.addEventListener("keydown", esc);
  addEventListener("hashchange", close);
  addEventListener("resize", place);
  sizePop = { anchor, close };
}

// ---------- Кнопка «послушать слово» ----------
/** Слово Корана с кнопкой звука. key — «SSS_AAA_WWW». */
export function wordChip(w, { showTr = store.get().settings.translit === "show", size, big = false, onplay } = {}) {
  const trEl = w.tr ? tr(w.tr, { hidden: !showTr }) : null;
  const b = h("button.word-chip", { type: "button", class: big ? "big" : "", "aria-label": "Послушать слово" + (w.tr ? " " + w.tr : "") },
    ar(w.d, { size }), trEl, h("span.wc-ico", null, icon("vol", { size: 16 })));
  const id = "w:" + w.a;
  const sync = () => { if (gone(b, off)) return; b.classList.toggle("playing", playingId() === id); };
  b.addEventListener("click", () => {
    if (playingId() === id) { stop(); return; }
    playWord(w.a); trEl?.classList.remove("hid"); onplay?.();
  });
  const off = onPlay(sync);
  return b;
}

/** Круглая кнопка воспроизведения для произвольного действия. */
export function playBtn(id, fn, { label = "Слушать", size = "md", cls = "" } = {}) {
  const b = h("button.play-btn", { type: "button", class: `${size} ${cls}`, "aria-label": label }, icon("play", { size: size === "lg" ? 34 : 22, fill: true, sw: 1.5 }));
  const sync = () => {
    if (gone(b, off)) return;
    const on = playingId() === id;
    b.classList.toggle("playing", on);
    b.replaceChildren(icon(on ? "pause" : "play", { size: size === "lg" ? 34 : 22, fill: !on, sw: on ? 3 : 1.5 }));
  };
  b.addEventListener("click", () => (playingId() === id ? stop() : fn()));
  const off = onPlay(sync);
  return b;
}

// ---------- Всплывающие элементы ----------
export function toast(msg, ms = 2600) {
  const t = $("#toast");
  t.replaceChildren(msg instanceof Node ? msg : document.createTextNode(msg));
  t.classList.add("show");
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove("show"), ms);
}

export function modal(content, { onClose, cls = "" } = {}) {
  const root = $("#modal-root");
  const close = () => { wrap.classList.add("out"); setTimeout(() => wrap.remove(), 200); document.removeEventListener("keydown", esc); onClose?.(); };
  const esc = (e) => e.key === "Escape" && close();
  const box = h("div.modal", { role: "dialog", "aria-modal": "true", class: cls },
    h("button.modal-x", { type: "button", "aria-label": "Закрыть", onclick: close }, icon("close")),
    typeof content === "function" ? content(close) : content);
  const wrap = h("div.modal-wrap", { onclick: (e) => e.target === wrap && close() }, box);
  root.append(wrap);
  document.addEventListener("keydown", esc);
  requestAnimationFrame(() => box.querySelector("button:not(.modal-x), a")?.focus?.());
  return close;
}

export function confirmBox(title, text, ok = "Да", cancel = "Отмена") {
  return new Promise((res) => {
    let result = false;
    modal((close) => h("div.confirm", null,
      h("h3", null, title), text ? h("p", null, text) : null,
      h("div.row.end", null,
        h("button.btn.ghost", { type: "button", onclick: () => close() }, cancel),
        h("button.btn.primary", { type: "button", onclick: () => { result = true; close(); } }, ok))),
    { onClose: () => res(result) });
  });
}

/** Праздничное конфетти (восьмиконечные звёзды). */
export function confetti(n = 70) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = h("div.confetti");
  const colors = ["var(--gold)", "var(--accent)", "var(--c-rose)", "var(--c-sky)", "var(--c-emerald)", "var(--c-violet)"];
  for (let i = 0; i < n; i++) {
    const s = h("i", { style: { left: Math.random() * 100 + "%", "--d": (Math.random() * 0.6) + "s", "--x": (Math.random() * 2 - 1) * 120 + "px", "--r": Math.random() * 720 + "deg", background: colors[i % colors.length], "--sz": 6 + Math.random() * 8 + "px" } });
    layer.append(s);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 2600);
}

/** Кольцо прогресса (SVG). */
export function ring(pct, { size = 64, stroke = 7, cls = "", label = null } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const s = h("svg", { svg: true, viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: "ring " + cls });
  s.innerHTML = `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" class="ring-bg"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${stroke}" class="ring-fg" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.max(0, Math.min(1, pct)))}" transform="rotate(-90 ${size / 2} ${size / 2})"/>`;
  return label != null ? h("div.ring-wrap", { style: { width: size + "px", height: size + "px" } }, s, h("span.ring-label", null, label)) : s;
}

export const plural = (n, a, b, c) => { const m = n % 100, k = n % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; };
export const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const sample = (a, n) => shuffle(a).slice(0, n);
