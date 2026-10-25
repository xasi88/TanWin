// Уроки в кино-режиме (ветка kino). Образец: урок 1.1 «Справа налево» (решение автора 2026-10-24: «пролог и один урок»).
// Карточки теории стали фильмами, упражнения и вопросы те же, что в js/course.js: они проверены.
// Содержание урока прежнее: буква ба, справа налево, согласные и огласовки, буквы соединяются, 10 минут в день.
import { h, icon } from "../ui.js";
import { playLetter, playSyll, playWord, sfx } from "../audio.js";
import { byId, forms } from "../letters.js";
import { harakatTiles } from "../syllables.js";
import { film, SPRING, OUT } from "./engine.js";
import { svg, boat, placeDots, dotT, sticker, badge, arSticker, ayahWords, readAyahLit, arrowRTL, timerSticker } from "./art.js";

const q = (qq, a, why) => ({ t: "quiz", q: qq, a, why });
const ex = (k, n, o = {}) => ({ t: "ex", k, n, ...o });
const scene = (shots) => ({ t: "film", film: ({ done }) => film({ shots, onDone: done, cls: "ls" }) });
const pulseDot = (fx, d, [x, y], delay = 0) => fx.animate(d, [{ transform: dotT(x, y) }, { transform: dotT(x, y, 1.7) }, { transform: dotT(x, y) }], { dur: 620, ease: "ease-in-out", delay });

// ---------- 1. Буква ба ----------
const meetBa = {
  tone: "blue",
  build(layer) {
    const b = boat();
    placeDots(b, 0);
    const card = sticker(b.el, { tone: "paper", cls: "k-boat-card", tilt: -2, tag: "button", type: "button", "aria-label": "Послушать букву ба" });
    card.addEventListener("click", () => { playLetter("ba"); card.animate([{ rotate: "0deg" }, { rotate: "-6deg" }, { rotate: "5deg" }, { rotate: "0deg" }], { duration: 500, easing: "ease-in-out" }); });
    const name = badge("Ба", { tone: "lime", tilt: -6, cls: "k-name k-hide" });
    const hint = badge("1 точка снизу", { tone: "yellow", tilt: 4, cls: "k-hint k-hide" });
    const real = arSticker("ب", { size: "4.2rem", cls: "k-hide", tilt: 3 });
    const eq = h("span.k-eq.k-hide", null, "в Коране:");
    layer.append(h("div.ls-meet", null, h("div.k-boat-wrap", null, card, name, hint), h("div.ls-real", null, eq, real)));
    return { b, card, name, hint, real, eq };
  },
  beats: [
    { say: "Первая буква: **ба**.",
      run: (r, fx) => {
        fx.pop(r.card, { rot: 10 }); fx.draw(r.b.body, { delay: 350, dur: 1100 }); fx.fadeIn(r.b.el.querySelector(".kb-shade"), { delay: 1300 });
        fx.animate(r.b.dots[0], [{ transform: dotT(154, 330, 0.4), opacity: 0 }, { transform: dotT(154, 226), opacity: 1 }], { dur: 700, delay: 1250 });
        fx.pop(r.name, { delay: 1600 }); fx.sound(() => playLetter("ba"), 1650);
      } },
    { say: "Её легко узнать: одна точка **снизу**.",
      run: (r, fx) => { pulseDot(fx, r.b.dots[0], [154, 226]); pulseDot(fx, r.b.dots[0], [154, 226], 700); fx.pop(r.hint, { delay: 200, rot: 18 }); fx.sound(sfx.pop, 200); } },
    { say: "Нажмите на букву и послушайте её ещё раз.",
      gate: (r, fx, open) => { r.card.classList.add("k-call"); r.card.addEventListener("click", () => { r.card.classList.remove("k-call"); fx.later(open, 900); }, { once: true }); } },
    { say: "А так ба печатают в Коране.",
      run: (r, fx) => { fx.rise(r.eq); fx.pop(r.real, { delay: 200 }); fx.sound(sfx.pop, 200); } },
  ],
};

// ---------- 2. Справа налево ----------
const notLanguage = {
  tone: "violet",
  build(layer) {
    const strike = svg("path", { d: "M8 34C80 22 190 40 292 26", class: "k-strike", pathLength: "1" });
    const lang = sticker([h("span", null, "Знать арабский язык"), svg("svg", { viewBox: "0 0 300 60", class: "k-strike-svg", preserveAspectRatio: "none", "aria-hidden": "true" }, strike)], { tone: "paper", cls: "k-lang k-hide", tilt: -2 });
    const need = [["28 букв", "lime", "ب ت ث"], ["Несколько значков", "yellow", "بَ بِ بُ"], ["Правила чтения: таджвид", "sky", null]].map(([t, tone, a], i) =>
      sticker([icon("check", { size: 22, sw: 3.4 }), h("b", null, t)], { tone, cls: "k-need k-hide", tilt: [3, -2, 2][i] }));
    layer.append(h("div.ls-need", null, lang, h("div.k-need-list", null, ...need)));
    return { strike, lang, need };
  },
  beats: [
    { say: "Чтобы **читать** Коран, не нужно знать арабский язык.",
      run: (r, fx) => { fx.pop(r.lang); fx.draw(r.strike, { delay: 650, dur: 500, ease: OUT }); fx.sound(sfx.whoosh, 650); } },
    { say: "Нужно выучить **28 букв**, несколько значков и правила чтения.",
      run: (r, fx) => { fx.animate(r.lang, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0.55, transform: "scale(.86)" }], { dur: 400, ease: OUT }); fx.each(r.need, (el, o) => fx.rise(el, o), 220, 200); [200, 420, 640].forEach((ms) => fx.sound(sfx.pop, ms)); } },
  ],
};
const rtl = {
  tone: "violet",
  build(layer) {
    const arrow = arrowRTL();
    const start = badge("Начало", { tone: "lime", tilt: 5, cls: "k-start k-hide" });
    const { row, words } = ayahWords();
    const ok = words.map((w) => { const c = h("span.k-ok", null, icon("check", { size: 16, sw: 3.6 })); w.append(c); return c; });
    layer.append(h("div.ls-rtl", null, h("div.k-arrow-wrap", null, arrow, start), row));
    return { arrow, start, words, ok, shaft: arrow.querySelectorAll(".ka-shaft"), head: arrow.querySelector(".ka-head"), shade: arrow.querySelector(".ka-shade") };
  },
  beats: [
    { say: "Арабский читают **справа налево**.",
      run: (r, fx) => {
        fx.pop(r.start, { rot: -20 }); r.shaft.forEach((p) => fx.draw(p, { delay: 300, dur: 900 }));
        fx.animate(r.head, [{ opacity: 0, transform: "translateX(40px)" }, { opacity: 1, transform: "none" }], { dur: 500, delay: 1050 });
        fx.fadeIn(r.shade, { delay: 1150 });
        fx.sound(sfx.whoosh, 300);
      } },
    { say: "Вот первые слова Корана. Чтец читает их справа налево.",
      run: (r, fx) => { fx.each(r.words, (el, o) => fx.pop(el, o), 170); fx.sound(() => readAyahLit(r.words, fx.alive), 1000); } },
    { say: "Нажимайте на слова по очереди, справа налево.",
      gate: (r, fx, open) => {
        let e = 0;
        const call = () => r.words.forEach((w, i) => w.classList.toggle("k-call", i === e));
        call();
        r.words.forEach((w, i) => w.addEventListener("click", () => {
          if (!fx.alive() || e >= r.words.length) return;
          if (i !== e) { fx.shake(w); fx.pulse(r.words[e], { k: 1.12 }); return; }
          w.classList.add("ok"); fx.pop(r.ok[i], { rot: 30 }); e++; call();
          if (e === r.words.length) fx.later(open, 1100);
        }));
      },
      final: (r) => r.words.forEach((w) => w.classList.add("ok")) },
  ],
};

// ---------- 3. Согласные и огласовки ----------
const VOW = [["fatha", "фатха", "ба"], ["kasra", "касра", "би"], ["damma", "дамма", "бу"]];
const vowels = {
  tone: "blue",
  build(layer) {
    const b = boat({ cls: "drawn" });
    placeDots(b, 1);
    const card = sticker(b.el, { tone: "paper", cls: "k-boat-card", tilt: -2, tag: "button", type: "button", "aria-label": "Послушать букву ба" });
    card.addEventListener("click", () => playLetter("ba"));
    const snd = badge("звук «б»", { tone: "yellow", tilt: -5, cls: "k-name k-hide" });
    const marks = ["ـَ", "ـِ", "ـُ"].map((m, i) => arSticker(m, { tone: ["pink", "lime", "sky"][i], size: "2.4rem", cls: "k-mark k-hide", tilt: [-8, 6, -4][i] }));
    const tiles = harakatTiles("ba");
    tiles.classList.add("k-tiles", "k-hide");
    const wrap = h("div.k-boat-wrap", null, card, snd);
    // плитки слогов встают на место буквы (одна клетка сетки): кадр не растёт в высоту
    layer.append(h("div.ls-vow", null, h("div.k-marks", null, ...marks), h("div.k-merge", null, wrap, tiles)));
    return { b, card, snd, marks, tiles, wrap };
  },
  beats: [
    { say: "Почти все арабские буквы обозначают **согласные** звуки: «б», «т», «с».",
      run: (r, fx) => { fx.pop(r.card, { rot: 8 }); fx.pop(r.snd, { delay: 400, rot: -20 }); fx.sound(sfx.pop, 400); } },
    { say: "Гласные «а», «и», «у» пишут маленькими **значками**: над буквой или под ней.",
      run: (r, fx) => { fx.each(r.marks, (el, o) => fx.drop(el, o), 190); fx.sound(sfx.whoosh); } },
    ...VOW.map(([v, name, syl], i) => ({
      say: `${["Чёрточка сверху", "Чёрточка снизу", "Завиток сверху"][i]}: это **${name}**. Слушайте: «Ба, ${name}, ${syl}».`,
      run: (r, fx) => {
        r.snd.textContent = syl;
        fx.animate(r.marks[i], [{ opacity: 1, transform: "scale(1)" }, { opacity: 1, transform: "scale(1.25)" }, { opacity: 1, transform: "scale(1)" }], { dur: 500, ease: "ease-in-out" });
        r.marks.forEach((m, j) => j !== i && fx.animate(m, [{ opacity: 1 }, { opacity: 0.35 }], { dur: 300, ease: "ease" }));
        if (i) { const prev = r.b.marks[VOW[i - 1][0]]; fx.animate(prev, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: `translateY(${i === 1 ? -110 : 110}px)` }], { dur: 420, ease: OUT }); }
        const m = r.b.marks[v], fromY = v === "kasra" ? 140 : -150;
        fx.animate(m, [{ opacity: 0, transform: `translateY(${fromY}px)`, offset: 0 }, { opacity: 1, transform: "translateY(0)", offset: 0.6, easing: "ease-out" }, { opacity: 1, transform: `translateY(${fromY > 0 ? 12 : -12}px)`, offset: 0.8 }, { opacity: 1, transform: "translateY(0)", offset: 1 }], { dur: 760, delay: 250, ease: "ease-in" });
        fx.pop(r.snd, { delay: 700, rot: 15 });
        fx.sound(() => playSyll("ba", v), 800);
      },
    })),
    { say: "Одна буква, три значка, три слога. Эти значки называются **харакаты**.",
      run: (r, fx) => {
        fx.out(r.wrap, { scale: 0.7, rot: -6 });
        fx.rise(r.tiles, { delay: 250 }); fx.sound(sfx.pop, 250);
      } },
    { say: "В Коране харакаты стоят везде. Поэтому его можно прочитать правильно, даже не зная языка.",
      run: (r, fx) => { fx.each(r.tiles.children, (el, o) => fx.wiggle(el, o), 160); fx.each(r.marks, (el, o) => fx.animate(el, [{ opacity: 0.35 }, { opacity: 1 }], { ...o, dur: 300, ease: "ease" }), 100); } },
  ],
};

// ---------- 4. Буквы соединяются ----------
const join = {
  tone: "violet",
  build(layer) {
    const trio = ["ب", "س", "م"].map((c, i) => arSticker(c, { size: "3.6rem", tone: ["lime", "yellow", "sky"][i], cls: "k-hide", tilt: [-4, 3, -3][i] }));
    const names = ["ба", "син", "мим"].map((n) => h("small.k-cap", null, n));
    trio.forEach((t, i) => t.append(names[i]));
    const joined = arSticker("بسم", { size: "4.4rem", tone: "paper", cls: "k-joined k-hide", tilt: -2 });
    const full = arSticker("بِسۡمِ", { size: "4.4rem", tone: "lime", cls: "k-joined k-hide", tilt: 2, tag: "button", type: "button", "aria-label": "Послушать слово" });
    full.addEventListener("click", () => playWord("001_001_001"));
    const tr = badge("бисми", { tone: "yellow", tilt: -5, cls: "k-tr k-hide" });
    // буквы и слово в одной клетке сетки: буквы съезжаются к середине, и на их месте выскакивает слово
    layer.append(h("div.ls-join", null, h("div.k-merge", null, h("div.k-row3.k-apart", { dir: "rtl" }, ...trio), joined, full), tr));
    return { trio, joined, full, tr };
  },
  beats: [
    { say: "В слове буквы соединяются, как в русском письменном шрифте.",
      run: (r, fx) => { fx.each(r.trio, (el, o) => fx.pop(el, o), 170); r.trio.forEach((el, i) => fx.animate(el, [{ transform: "translateY(0)" }, { transform: "translateY(-10px)" }, { transform: "translateY(0)" }], { dur: 1600, delay: 700 + i * 200, ease: "ease-in-out", iter: Infinity })); } },
    { say: "Смотрите: ба, син и мим берутся за руки.",
      run: (r, fx) => {
        const [ba, sin, mim] = r.trio;
        fx.animate(ba, [{ transform: "none", opacity: 1 }, { transform: "translateX(-108%) scale(.9)", opacity: 1, offset: 0.8 }, { transform: "translateX(-108%) scale(.7)", opacity: 0 }], { dur: 750, ease: "ease-in" });
        fx.animate(mim, [{ transform: "none", opacity: 1 }, { transform: "translateX(108%) scale(.9)", opacity: 1, offset: 0.8 }, { transform: "translateX(108%) scale(.7)", opacity: 0 }], { dur: 750, ease: "ease-in" });
        fx.animate(sin, [{ transform: "none", opacity: 1 }, { transform: "scale(.9)", opacity: 1, offset: 0.8 }, { transform: "scale(.7)", opacity: 0 }], { dur: 750, ease: "ease-in" });
        fx.pop(r.joined, { delay: 650, dur: 650, rot: 10, to: 0 }); fx.sound(sfx.snap, 650);
      } },
    { say: "С огласовками это первое слово Корана: «бисми».",
      run: (r, fx) => { fx.out(r.joined, { scale: 1.1, rot: 0 }); fx.pop(r.full, { delay: 200, rot: -8, to: 0 }); fx.pop(r.tr, { delay: 600 }); fx.sound(() => playWord("001_001_001"), 500); } },
  ],
};
const FORMS = [["iso", "отдельно"], ["ini", "в начале"], ["med", "в середине"], ["fin", "в конце"]];
const fourForms = {
  tone: "pink",
  build(layer) {
    const f = forms(byId.ba);
    const cells = FORMS.map(([k, n], i) => {
      const c = arSticker(f[k], { size: "3rem", tone: ["paper", "lime", "yellow", "sky"][i], cls: "k-form k-hide", tilt: [-3, 2, -2, 3][i], tag: "button", type: "button", "aria-label": `Ба ${n}` });
      c.append(h("small.k-cap", null, n));
      c.addEventListener("click", () => playLetter("ba"));
      return c;
    });
    const same = badge("точка и «лодочка» на месте", { tone: "lime", tilt: -3, cls: "k-hide k-same" });
    layer.append(h("div.ls-forms", null, h("div.k-forms", { dir: "rtl" }, ...cells), same));
    return { cells, same };
  },
  beats: [
    { say: "Поэтому у буквы бывает до **четырёх форм**: отдельно, в начале, в середине и в конце.",
      run: (r, fx) => { fx.each(r.cells, (el, o) => fx.pop(el, o), 260); r.cells.forEach((_, i) => fx.sound(sfx.pop, i * 260)); } },
    { say: "Основа буквы и точки почти не меняются. По ним букву и узнают.",
      run: (r, fx) => { fx.each(r.cells, (el, o) => fx.pulse(el, { ...o, k: 1.1 }), 160); fx.pop(r.same, { delay: 700, rot: 14 }); fx.sound(sfx.pop, 700); } },
  ],
};
const howToLearn = {
  tone: "blue",
  build(layer) {
    const t = timerSticker("10", "мин");
    const clock = sticker(t.el, { tone: "paper", cls: "k-clock k-hide", tilt: -4 });
    const prac = sticker([icon("repeat", { size: 28, sw: 2.6 }), h("b", null, "Практика"), h("small", null, "ошибки вернутся на повторение")], { tone: "lime", cls: "k-who k-hide", tilt: 3 });
    layer.append(h("div.ls-how", null, clock, prac));
    return { t, clock, prac };
  },
  beats: [
    { say: "Учитесь по 10 минут в день. Ошибки вернутся на повторение в «Практике».",
      run: (r, fx) => { fx.pop(r.clock); fx.draw(r.t.ring, { delay: 300, dur: 1400 }); fx.rise(r.prac, { delay: 600 }); fx.sound(sfx.pop); fx.sound(sfx.pop, 600); } },
  ],
};

/** Уроки, у которых есть кино-вид: шаги вместо шагов из js/course.js. */
export const KINO = {
  "1.1": {
    steps: [
      scene([meetBa]),
      ex("letterListen", 1, { letters: ["ba"], pool: ["ba", "mim", "lam"] }),
      scene([notLanguage, rtl]),
      q("С какой стороны начинается арабское слово?", ["Справа", "Слева", "Сверху"], "Арабский читается справа налево, как и весь Коран."),
      scene([vowels]),
      q("Что обозначают маленькие значки над и под буквами?", ["Гласные звуки (огласовки)", "Ударение", "Заглавные буквы"], "Это харакаты: фатха «а», касра «и», дамма «у»."),
      scene([join, fourForms, howToLearn]),
    ],
  },
};
