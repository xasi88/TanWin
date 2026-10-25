// Кино-режим (проба, ветка kino): объяснение идёт фильмом, а не карточкой с абзацами.
// Фильм состоит из кадров (shots), кадр из тактов (beats). Такт: одна короткая фраза-субтитр и движение картинки.
// Следующий такт открывает нажатие «Дальше» или касание сцены (решение автора 2026-10-24: «по нажатию»).
// «Назад» и «Ещё раз» строят кадр заново и мгновенно проматывают его до нужного такта, поэтому движение повторяется точно.
// Такт «Ваш ход» (gate) ждёт действия ученика: «Дальше» появляется, когда оно сделано.
import { h, ar, icon, keep } from "../ui.js";
import { you } from "../speech.js";
import { stop, sfx } from "../audio.js";

export const SPRING = "cubic-bezier(.34, 1.56, .64, 1)";
export const OUT = "cubic-bezier(.16, 1, .3, 1)";

// шрифты кино-режима грузятся заранее: субтитр первого такта не должен «прыгать» из запасного шрифта
const fontsReady = Promise.race([
  Promise.all(["800 1em Unbounded", "800 1em Manrope", "600 1em Manrope"].map((f) => document.fonts?.load(f).catch(() => {}))),
  new Promise((r) => setTimeout(r, 1200)),
]);

/** Движения сцены. instant: без анимации и без звука (перемотка такта). */
function makeFx(instant, later, alive) {
  const A = (el, kf, o = {}) => {
    if (!el) return null;
    return el.animate(kf, { duration: instant ? 0 : o.dur ?? 520, delay: instant ? 0 : o.delay ?? 0, easing: o.ease || SPRING, fill: "both", iterations: instant ? 1 : o.iter ?? 1 });
  };
  const each = (els, fn, step = 70, delay = 0) => [...els].forEach((el, i) => fn(el, { delay: delay + i * step }));
  return {
    instant,
    later,
    /** Жив ли ещё этот такт (ученик не ушёл дальше): для звука и долгих цепочек. */
    alive,
    animate: A,
    each,
    /** Наклейка выскакивает с пружиной. */
    pop: (el, o = {}) => A(el, [{ opacity: 0, transform: `scale(.2) rotate(${o.rot ?? -12}deg)` }, { opacity: 1, transform: `scale(1) rotate(${o.to ?? 0}deg)` }], { dur: 560, ...o }),
    /** Появляется снизу. */
    rise: (el, o = {}) => A(el, [{ opacity: 0, transform: `translateY(${o.dy ?? 40}px)` }, { opacity: 1, transform: "none" }], { dur: 600, ease: OUT, ...o }),
    /** Падает сверху и подпрыгивает. */
    drop: (el, o = {}) => A(el, [
      { opacity: 0, transform: `translateY(${-(o.from ?? 160)}px)`, offset: 0 },
      { opacity: 1, transform: "translateY(0)", offset: 0.55, easing: "ease-out" },
      { transform: `translateY(${-(o.bounce ?? 18)}px)`, offset: 0.75, easing: "ease-in" },
      { opacity: 1, transform: "translateY(0)", offset: 1 },
    ], { dur: 820, ease: "ease-in", ...o }),
    fadeIn: (el, o = {}) => A(el, [{ opacity: 0 }, { opacity: 1 }], { dur: 400, ease: "ease", ...o }),
    fadeOut: (el, o = {}) => A(el, [{ opacity: 1 }, { opacity: 0 }], { dur: 360, ease: "ease", ...o }),
    /** Сразу показать или спрятать (без движения). */
    show: (el) => A(el, [{ opacity: 1 }, { opacity: 1 }], { dur: 0 }),
    hide: (el) => A(el, [{ opacity: 0 }, { opacity: 0 }], { dur: 0 }),
    /** Уходит: уменьшается и гаснет. */
    out: (el, o = {}) => A(el, [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: `scale(${o.scale ?? 0.6}) rotate(${o.rot ?? 8}deg)` }], { dur: 380, ease: OUT, ...o }),
    /** Перенос: from и to: строки transform. */
    move: (el, from, to, o = {}) => A(el, [{ transform: from }, { transform: to }], { dur: 700, ease: OUT, ...o }),
    /** Линия рисуется по ходу пера (у пути pathLength="1"). */
    draw: (el, o = {}) => A(el, [{ strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, opacity: 1 }], { dur: 1000, ease: "cubic-bezier(.45, .05, .35, 1)", ...o }),
    pulse: (el, o = {}) => A(el, [{ transform: "scale(1)" }, { transform: `scale(${o.k ?? 1.25})` }, { transform: "scale(1)" }], { dur: 520, ease: "ease-in-out", ...o }),
    wiggle: (el, o = {}) => A(el, [{ transform: "rotate(0)" }, { transform: "rotate(-7deg)" }, { transform: "rotate(6deg)" }, { transform: "rotate(-3deg)" }, { transform: "rotate(0)" }], { dur: 600, ease: "ease-in-out", ...o }),
    shake: (el, o = {}) => A(el, [{ transform: "translateX(0)" }, { transform: "translateX(-9px)" }, { transform: "translateX(8px)" }, { transform: "translateX(-5px)" }, { transform: "translateX(0)" }], { dur: 420, ease: "ease-in-out", ...o }),
    /** Звук: только при живом показе, не при перемотке. */
    sound: (fn, ms = 0) => { if (!instant) later(fn, ms); },
    /** Число бежит от from до to. */
    count: (el, from, to, o = {}) => {
      if (instant) { el.textContent = to; return; }
      const dur = o.dur ?? 900, t0 = performance.now() + (o.delay ?? 0);
      const tick = (t) => { if (!el.isConnected) return; const p = Math.min(1, Math.max(0, (t - t0) / dur)); el.textContent = Math.round(from + (to - from) * (1 - (1 - p) ** 3)); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    },
  };
}

/** Арабские буквы без скобок («Буквы ب ت ث похожи») тоже становятся арабской вставкой {…}. */
export const markAr = (text) => text.replace(/\{[^}]*\}|([؀-ۿ][؀-ۿً-ٰٟۖ-ۭ ]*)/g, (m, run) => (run ? `{${run.trim()}}${run.endsWith(" ") ? " " : ""}` : m));

/** Субтитр: слова выскакивают по одному. **слово**: выделено маркером, {арабский}: арабская вставка. */
function capWords(text) {
  const parts = []; // [текст, арабский ли, выделен ли]
  text.replace(/\*\*([^*]+)\*\*|([^*]+|\*)/g, (m, b, p) => {
    const hl = b != null;
    (hl ? b : p).replace(/\{([^}]+)\}|([^{]+|\{)/g, (m2, a, q) => { parts.push(a != null ? [a, true, hl] : [q, false, hl]); return ""; });
    return "";
  });
  const units = [];
  let cur = null;
  const flush = () => { if (cur?.childNodes.length) units.push(cur); cur = null; };
  for (const [t, isAr, hl] of parts) {
    if (isAr) { const a = ar(t, { cls: "inline", colors: false }); (cur ||= h("span.kw")).append(hl ? h("b.kw-hl", null, a) : a); continue; }
    for (const piece of t.split(/(\s+)/)) {
      if (!piece) continue;
      if (/^\s+$/.test(piece)) { flush(); continue; }
      (cur ||= h("span.kw")).append(hl ? h("b.kw-hl", null, keep(piece)) : keep(piece));
    }
  }
  flush();
  return units;
}
export function caption(text, { turn = false } = {}) {
  const say = h("p.kf-say");
  capWords(markAr(you(text))).forEach((u, i) => { if (i) say.append(keep(" ")); u.style.setProperty("--i", i); say.append(u); });
  return h("div.kf-cap-in", { class: turn ? "turn" : "" }, turn ? h("span.kf-turn", null, "Ваш ход") : null, say);
}

/**
 * Фильм. shots: [{ tone, cls, scroll, build(layer) → refs, beats: [{ say, run(r, fx), gate(r, fx, open), final(r, fx) }] }].
 * onDone: после последнего такта. doneLabel: надпись кнопки на последнем такте. tone: цвет фона сцены (violet | blue | pink).
 */
export function film({ shots, onDone, doneLabel = "Дальше", cls = "" }) {
  const beats = shots.flatMap((s, si) => s.beats.map((b, bi) => ({ ...b, si, bi })));
  const root = h("div.kf", { class: cls });
  const bar = h("div.kf-bar", { "aria-hidden": "true" }, ...beats.map(() => h("i")));
  const stage = h("div.kf-stage");
  const cap = h("div.kf-cap", { "aria-live": "polite" });
  const backBtn = h("button.kf-ic", { type: "button", "aria-label": "Назад" }, icon("left", { size: 24, sw: 2.6 }));
  const againBtn = h("button.kf-ic", { type: "button", "aria-label": "Ещё раз" }, icon("repeat", { size: 22, sw: 2.6 }));
  const nextBtn = h("button.kf-next", { type: "button" });
  const skipGate = h("button.kf-skip", { type: "button" }, "Пропустить");
  root.append(bar, stage, cap, h("div.kf-ctrl", null, backBtn, againBtn, nextBtn, skipGate));

  let k = -1, cur = -1, r = {}, layer = null, timers = [], token = 0, gated = false;
  const later = (fn, ms = 0) => { const t = token; timers.push(setTimeout(() => t === token && root.isConnected && fn(), ms)); };
  const fx = (instant) => { const t = token; return makeFx(instant, instant ? (fn) => fn() : later, () => t === token && root.isConnected); };
  const reset = () => { timers.forEach(clearTimeout); timers = []; token++; stop(); };

  const tone = (t) => { const box = root.closest(".kino"); if (box) box.dataset.tone = t || "violet"; else requestAnimationFrame(() => root.closest(".kino") && tone(t)); };
  // кадр всегда помещается в сцену: на низком экране (телефон 360×640) он уменьшается целиком, кнопки не уезжают вниз;
  // на большом (планшет, Surface) немного растёт, чтобы картинка не терялась посреди пустого фона
  function fit() {
    const c = layer?.firstElementChild;
    if (!c || !stage.clientHeight) return;
    c.style.scale = "";
    if (layer.classList.contains("scroll")) { layer.classList.toggle("tall", c.offsetHeight + 24 > stage.clientHeight - 36); return; } // длинная наглядная часть (таблица слогов, аят) прокручивается, а не мельчит
    // ширина и высота с тем, что вылезло за рамки (крупный текст на узком экране): тогда сцена уменьшается целиком
    const w = Math.max(c.offsetWidth, c.scrollWidth), hgt = Math.max(c.offsetHeight, c.scrollHeight);
    const kw = (stage.clientWidth - 12) / (w + 8), kh = (stage.clientHeight - 36) / (hgt + 24);
    let k = Math.min(1.3, kw, kh);
    // низкая сцена (крупный текст на маленьком экране): картинка не мельчит, а прокручивается пальцем в своём месте;
    // кадр с классом whole (нарисованный телефон: нужная кнопка внизу) всегда виден целиком
    const squeeze = kh < 0.6 && kh < kw && !layer.classList.contains("whole");
    layer.classList.toggle("squeezed", squeeze);
    if (squeeze) k = Math.min(1.3, kw, 0.6);
    if (Math.abs(k - 1) > 0.01) c.style.scale = Math.max(0.4, k).toFixed(3);
  }
  // сцена вписывается заново, когда меняется размер экрана или самой картинки (наклейка выросла на следующем такте)
  const ro = new ResizeObserver(() => fit());
  ro.observe(stage);
  function buildShot(si, animated) {
    const s = shots[si];
    const old = layer;
    layer = h("div.kf-shot", { class: [s.cls, s.scroll ? "scroll" : ""].join(" ") });
    r = s.build(layer, { later }) || {};
    if (old && animated) { old.classList.add("out"); setTimeout(() => old.remove(), 420); stage.append(layer); layer.classList.add("in"); sfx.whoosh(); }
    else stage.replaceChildren(layer);
    cur = si;
    tone(s.tone);
    if (old?.firstElementChild) ro.unobserve(old.firstElementChild);
    if (layer.firstElementChild) ro.observe(layer.firstElementChild);
    fit();
  }
  function run(i, instant) {
    const b = beats[i];
    if (instant && b.gate) (b.final || b.run)?.(r, fx(true));
    else b.run?.(r, fx(instant));
  }
  function setGate(b) {
    gated = !!b.gate;
    root.classList.toggle("gated", gated);
    if (gated) b.gate(r, fx(false), () => { if (!gated || beats[k] !== b) return; gated = false; root.classList.remove("gated"); nextBtn.classList.add("ready"); sfx.correct(); });
  }
  function goTo(i, mode) {
    if (i < 0 || i >= beats.length) return;
    reset();
    const b = beats[i];
    if (mode === "next" && b.si === cur) { /* тот же кадр: только новое движение */ }
    else if (mode === "next") buildShot(b.si, cur >= 0);
    else { // назад или ещё раз: кадр заново, всё до этого такта мгновенно
      buildShot(b.si, false);
      for (let j = beats.findIndex((x) => x.si === b.si); j < i; j++) run(j, true);
    }
    k = i;
    cap.replaceChildren(caption(b.say || "", { turn: !!b.gate }));
    [...bar.children].forEach((el, j) => { el.className = j < k ? "done" : j === k ? "now" : ""; });
    backBtn.disabled = k === 0;
    const last = k === beats.length - 1;
    nextBtn.classList.remove("ready");
    nextBtn.replaceChildren(h("span", null, last ? doneLabel : "Дальше"), icon("right", { size: 22, sw: 3 }));
    run(i, false);
    setGate(b);
  }
  const next = () => {
    if (gated) return;
    sfx.tap();
    if (k >= beats.length - 1) { reset(); onDone?.(); return; }
    goTo(k + 1, "next");
  };
  nextBtn.addEventListener("click", next);
  backBtn.addEventListener("click", () => { sfx.tap(); goTo(k - 1, "back"); });
  againBtn.addEventListener("click", () => { sfx.tap(); goTo(k, "replay"); });
  skipGate.addEventListener("click", () => { if (!gated) return; gated = false; root.classList.remove("gated"); next(); });
  // касание пустого места сцены: тоже «Дальше» (кнопки, слова и буквы на сцене работают сами)
  stage.addEventListener("click", (e) => { if (!e.target.closest("button, a, input")) next(); });
  const onKey = (e) => {
    if (!root.isConnected) { document.removeEventListener("keydown", onKey); return; }
    if (e.target.closest?.("input, textarea") || document.querySelector(".modal-back, .modal")) return;
    if (e.key === "ArrowRight" || ((e.key === "Enter" || e.key === " ") && !e.target.closest?.("button"))) { e.preventDefault(); next(); }
    else if (e.key === "ArrowLeft") goTo(k - 1, "back");
  };
  document.addEventListener("keydown", onKey);
  // первый такт, когда фильм уже на экране (его вставляют после создания); ждём не дольше 3 с
  let tries = 0;
  const start = () => (root.isConnected || ++tries > 180 ? k < 0 && goTo(0, "next") : setTimeout(start, 16));
  fontsReady.then(start);
  return root;
}
