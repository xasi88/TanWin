// Кино-режим (ветка kino): картинки сцен. Буква ба собрана из частей («лодочка», точки, огласовки),
// поэтому каждая часть двигается сама: точки прыгают и превращают ба в та и са, огласовки падают на букву.
// Настоящий вид букв всегда показывает шрифт мусхафа (ar() из ui.js); рисунок здесь: учебная модель.
import { h, ar } from "../ui.js";
import { playAyah, playWord } from "../audio.js";
import { loadSurah, wordKey, RECITERS, reciterOf } from "../data.js";
import { store } from "../store.js";

const NS = "http://www.w3.org/2000/svg";
export function svg(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.append(...kids);
  return el;
}

// «Лодочка» ба: перо идёт справа налево, от зубца к хвостику (так и пишут)
const BODY = "M256 120C262 152 250 175 220 177C180 180 130 180 100 177C70 174 52 161 52 134";
const DOT = "M0 -15L15 0L0 15L-15 0Z";
/** Где стоят точки: 1 снизу (ба), 2 сверху (та), 3 сверху (са). */
export const DOTS = { 1: [[154, 226]], 2: [[139, 126], [171, 126]], 3: [[139, 128], [171, 128], [155, 97]] };
const HARAKA = {
  fatha: "M190 70L140 92",
  kasra: "M190 252L140 274",
  damma: "M168 92C186 80 180 56 163 59C148 62 149 82 166 83C163 98 151 106 135 108",
};

/** Учебная модель ба. Возвращает { el, body, dots: [3], marks: { fatha, kasra, damma } }. */
export function boat({ cls = "" } = {}) {
  const body = svg("path", { d: BODY, class: "kb-body k-part", pathLength: "1" });
  const dots = [0, 1, 2].map(() => svg("path", { d: DOT, class: "kb-dot", transform: "translate(-99 -99)" }));
  const marks = Object.fromEntries(Object.entries(HARAKA).map(([k, d]) => [k, svg("path", { d, class: `kb-mark k-part m-${k}`, pathLength: "1" })]));
  const el = svg("svg", { viewBox: "0 0 320 300", class: `k-boat ${cls}`.trim(), "aria-hidden": "true" },
    svg("path", { d: BODY, class: "kb-shade", transform: "translate(6 7)" }), body, ...dots, ...Object.values(marks));
  return { el, body, dots, marks };
}
/** Поставить точки сразу (без движения): n штук на свои места, остальные спрятать. */
export function placeDots(b, n) {
  b.dots.forEach((d, i) => {
    const at = DOTS[n]?.[i];
    d.style.transform = at ? `translate(${at[0]}px, ${at[1]}px)` : "translate(155px, 160px) scale(0)";
  });
}
export const dotT = (x, y, s = 1) => `translate(${x}px, ${y}px) scale(${s})`;

/** Наклейка: светлая карточка с контуром и жёсткой тенью. tone: lime | yellow | pink | sky | paper | ink. */
export const sticker = (kids, { tone = "paper", tilt = 0, cls = "", tag = "div", ...attrs } = {}) =>
  h(`${tag}.k-st`, { class: `t-${tone} ${cls}`.trim(), style: { "--tilt": `${tilt}deg` }, ...attrs }, kids);

/** Плашка-подпись на наклейке. */
export const badge = (text, { tone = "yellow", tilt = -4, cls = "" } = {}) =>
  h("span.k-badge", { class: `t-${tone} ${cls}`.trim(), style: { "--tilt": `${tilt}deg` } }, text);

/** Арабская буква или слово крупно на наклейке (шрифт мусхафа). */
export const arSticker = (text, { tone = "paper", tilt = 0, size = "6rem", cls = "", tag = "div", ...attrs } = {}) =>
  sticker(ar(text, { colors: false, size }), { tone, tilt, cls: `k-ar ${cls}`.trim(), tag, ...attrs });

/** Стрелка «справа налево»: контур, заливка и тень, как у наклейки. Древко рисуется справа налево (fx.draw на .ka-shaft). */
export function arrowRTL() {
  const SHAFT = "M282 40H44", HEAD = "M74 12L36 40L74 68";
  return h("div.k-arrow", { "aria-hidden": "true" },
    svg("svg", { viewBox: "0 0 300 80" },
      svg("g", { class: "ka-shade" }, svg("path", { d: SHAFT, transform: "translate(5 6)" }), svg("path", { d: HEAD, transform: "translate(5 6)" })),
      svg("path", { d: SHAFT, class: "ka-shaft ka-o", pathLength: "1" }),
      svg("path", { d: SHAFT, class: "ka-shaft ka-f", pathLength: "1" }),
      svg("g", { class: "ka-head" }, svg("path", { d: HEAD, class: "ka-o" }), svg("path", { d: HEAD, class: "ka-f" }))));
}

/** Таймер-кольцо «10 мин»: { el, ring }, кольцо рисуется через fx.draw. */
export function timerSticker(label = "10", unit = "мин") {
  const ring = svg("circle", { cx: 60, cy: 60, r: 46, class: "kt-ring", pathLength: "1", transform: "rotate(-90 60 60)" });
  const el = h("div.k-timer", null,
    svg("svg", { viewBox: "0 0 120 120", "aria-hidden": "true" }, svg("circle", { cx: 60, cy: 60, r: 46, class: "kt-bg" }), ring),
    h("div.kt-txt", null, h("b", null, label), h("small", null, unit)));
  return { el, ring };
}

// ---------- Первый аят Корана ----------
// Слова 1:1 с разметкой таджвида, как в data/q/001.json (цвета здесь не нужны: ar(…, { colors: false })).
export const BASMALA = ["بِسۡمِ", "[wٱ]للَّهِ", "[wٱ][lل]رَّحۡمَ[nـٰ]نِ", "[wٱ][lل]رَّح[pِي]مِ"];
/** Слова аята 1:1 наклейками. Нажатое слово звучит голосом чтеца. Порядок в массиве: порядок чтения (первое справа). */
export function ayahWords({ tilts = [-3, 2, -2, 3] } = {}) {
  const words = BASMALA.map((w, i) => {
    const b = h("button.k-st.k-word.k-hide", { type: "button", class: "t-paper", style: { "--tilt": `${tilts[i]}deg` }, "aria-label": "Послушать слово" }, ar(w, { colors: false }));
    b.addEventListener("click", () => playWord(wordKey(1, 1, i + 1)));
    return b;
  });
  return { row: h("div.k-ayah", { dir: "rtl" }, ...words), words };
}
/** Чтец читает аят 1:1, а слово, которое звучит, горит. Нет звука (нет сети): слова загораются по очереди сами. */
export function readAyahLit(words, alive) {
  let got = false;
  const lit = (i) => words.forEach((w, j) => w.classList.toggle("lit", j === i));
  loadSurah(1).then((d) => {
    const seg = d.v[0][RECITERS[reciterOf(store.get().settings.reciter)].seg] || []; // время слов выбранного чтеца (у Шатри своё, разбор 2026-10-25)
    playAyah(1, 1, {
      onTime: (ms) => { got = true; if (!alive()) return; lit(words.findIndex((_, i) => ms >= seg[i * 2] && ms < seg[i * 2 + 1] + 60)); },
      onEnd: () => lit(-1),
    });
  }).catch(() => {});
  setTimeout(() => { if (got || !alive()) return; words.forEach((_, i) => setTimeout(() => alive() && lit(i), i * 800)); setTimeout(() => alive() && lit(-1), words.length * 800); }, 2600);
}

/** Искры вокруг наклейки. */
export function sparks(n = 6) {
  return [...Array(n)].map((_, i) => h("i.k-spark", { style: { "--a": `${(360 / n) * i + 15}deg`, "--d": `${70 + (i % 3) * 18}px`, "--c": ["var(--k-lime)", "var(--k-yellow)", "var(--k-pink)", "var(--k-sky)"][i % 4] } }));
}
