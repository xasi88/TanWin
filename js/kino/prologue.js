// Пролог (ветка kino): фильм на минуту перед вопросами знакомства. Новичок видит цель (первый аят звучит голосом чтеца),
// понимает, что письмо Корана: это 28 букв и значки, видит «фокус с точками» (ب ت ث) и путь от буквы до суры.
// Решение автора 2026-10-24: пролог стоит перед знакомством, такты идут по нажатию.
import { h, icon } from "../ui.js";
import { playLetter, sfx } from "../audio.js";
import { LETTERS } from "../letters.js";
import { logo } from "../app.js";
import { film, SPRING } from "./engine.js";
import { boat, placeDots, dotT, sticker, badge, arSticker, ayahWords, readAyahLit, sparks, timerSticker } from "./art.js";

const burst = (box, fx) => { if (fx.instant) return; box.classList.remove("go"); void box.offsetWidth; box.classList.add("go"); };

const hello = {
  tone: "violet",
  build(layer) {
    const sp = h("div.k-sparks", null, ...sparks(10));
    const mark = sticker(logo(112), { tone: "paper", cls: "pr-logo", tilt: -4 });
    const title = h("div.k-title.k-hide", null, "TanWin");
    const tags = [badge("С нуля", { tone: "lime", tilt: -6 }), badge("10 минут в день", { tone: "yellow", tilt: 4 }), badge("Бесплатно", { tone: "pink", tilt: -3 })];
    tags.forEach((t) => t.classList.add("k-hide"));
    layer.append(h("div.pr-hello", null, h("div.pr-logo-wrap", null, sp, mark), title, h("div.pr-tags", null, ...tags)));
    return { sp, mark, title, tags };
  },
  beats: [
    { say: "Ассаляму алейкум! Это **TanWin**.",
      run: (r, fx) => { fx.pop(r.mark, { rot: -40, to: 0, dur: 760 }); fx.rise(r.title, { delay: 260 }); burst(r.sp, fx); fx.sound(sfx.pop, 120); } },
    { say: "Здесь вы научитесь читать Коран. С нуля, шаг за шагом.",
      run: (r, fx) => { fx.each(r.tags, (el, o) => fx.pop(el, { ...o, rot: 25 }), 170); [0, 170, 340].forEach((ms) => fx.sound(sfx.pop, ms)); } },
  ],
};

const ayah = {
  tone: "blue",
  build(layer) {
    const { row, words } = ayahWords();
    const ref = badge("Сура 1, аят 1", { tone: "yellow", tilt: 3, cls: "k-hide" });
    layer.append(h("div.pr-ayah", null, row, ref));
    return { words, ref };
  },
  beats: [
    { say: "Это первые слова Корана. Послушайте.",
      run: (r, fx) => { fx.each(r.words, (el, o) => fx.pop(el, o), 150); fx.pop(r.ref, { delay: 700 }); fx.sound(() => readAyahLit(r.words, fx.alive), 900); } },
    { say: "Пока это похоже на красивый узор. Скоро вы научитесь читать эти слова.",
      run: (r, fx) => { fx.each(r.words, (el, o) => fx.wiggle(el, o), 130); } },
  ],
};

const letters = {
  tone: "violet",
  build(layer) {
    const tiles = LETTERS.filter((l) => l.id !== "hamza").map((l, i) => arSticker(l.ch, { size: "1.9rem", cls: "k-tile k-hide", tilt: ((i * 37) % 7) - 3 }));
    const num = h("b.k-num", null, "0");
    const counter = sticker([num, h("small", null, "букв")], { tone: "lime", cls: "k-counter k-hide", tilt: 5 });
    const marks = ["ـَ", "ـِ", "ـُ"].map((m, i) => arSticker(m, { tone: ["pink", "yellow", "sky"][i], size: "2.6rem", cls: "k-mark k-hide", tilt: [-8, 6, -4][i] }));
    layer.append(h("div.pr-letters", null, h("div.pr-top", null, counter, h("div.pr-marks", null, ...marks)), h("div.k-grid", { dir: "rtl" }, ...tiles)));
    return { tiles, num, counter, marks };
  },
  beats: [
    { say: "Все слова Корана написаны всего **28 буквами**.",
      run: (r, fx) => { fx.pop(r.counter); fx.count(r.num, 0, 28, { dur: 1500, delay: 150 }); fx.each(r.tiles, (el, o) => fx.pop(el, { ...o, dur: 420 }), 48, 150); [150, 600, 1050].forEach((ms) => fx.sound(sfx.pop, ms)); } },
    { say: "И ещё маленькими **значками** над буквами и под ними.",
      run: (r, fx) => { fx.each(r.marks, (el, o) => fx.drop(el, o), 190); fx.sound(sfx.whoosh); } },
  ],
};

const dots = {
  tone: "pink",
  build(layer) {
    const b = boat();
    placeDots(b, 0);
    const card = sticker(b.el, { tone: "paper", cls: "k-boat-card", tilt: -2 });
    const name = badge("ба", { tone: "lime", tilt: -6, cls: "k-name k-hide" });
    const trio = ["ب", "ت", "ث"].map((c, i) => arSticker(c, { size: "3.2rem", tone: ["lime", "yellow", "sky"][i], cls: "k-hide", tilt: [-5, 3, -2][i] }));
    layer.append(h("div.pr-dots", null, h("div.k-boat-wrap", null, card, name), h("div.k-row3", { dir: "rtl" }, ...trio)));
    return { b, card, name, trio };
  },
  beats: [
    { say: "Многие буквы похожи. Посмотрите на эту «лодочку».",
      run: (r, fx) => { fx.pop(r.card, { rot: 8, to: 0 }); fx.draw(r.b.body, { delay: 350, dur: 1200 }); fx.fadeIn(r.b.el.querySelector(".kb-shade"), { delay: 1350 }); } },
    { say: "Одна точка снизу: это **ба**.",
      run: (r, fx) => {
        fx.animate(r.b.dots[0], [{ transform: dotT(154, 330, 0.4), opacity: 0 }, { transform: dotT(154, 226), opacity: 1 }], { dur: 700 });
        r.name.textContent = "ба"; fx.pop(r.name, { delay: 350 }); fx.sound(() => playLetter("ba"), 450);
      } },
    { say: "Две точки сверху: это **та**.",
      run: (r, fx) => {
        fx.animate(r.b.dots[0], [{ transform: dotT(154, 226) }, { transform: dotT(139, 126) }], { dur: 650 });
        fx.animate(r.b.dots[1], [{ transform: dotT(139, 126, 0), opacity: 0 }, { transform: dotT(171, 126), opacity: 1 }], { dur: 600, delay: 380 });
        r.name.textContent = "та"; fx.wiggle(r.name, { delay: 500 }); fx.sound(sfx.snap, 420); fx.sound(() => playLetter("ta"), 700);
      } },
    { say: "Три точки сверху: это **са**.",
      run: (r, fx) => {
        fx.animate(r.b.dots[0], [{ transform: dotT(139, 126) }, { transform: dotT(139, 128) }], { dur: 300 });
        fx.animate(r.b.dots[1], [{ transform: dotT(171, 126) }, { transform: dotT(171, 128) }], { dur: 300 });
        fx.animate(r.b.dots[2], [{ transform: dotT(155, -40, 0.5), opacity: 0 }, { transform: dotT(155, 97), opacity: 1 }], { dur: 750, ease: SPRING });
        r.name.textContent = "са"; fx.wiggle(r.name, { delay: 450 }); fx.sound(() => playLetter("tha"), 600);
      } },
    { say: "Форма одна, меняются только точки. Уже не так сложно, правда?",
      run: (r, fx) => { fx.each(r.trio, (el, o) => fx.pop(el, o), 180); [0, 180, 360].forEach((ms) => fx.sound(sfx.pop, ms)); } },
  ],
};

const STOPS = [["ب", "Буквы"], ["ـبـ", "Формы букв"], ["بَ", "Огласовки"], ["بَـ", "Слоги"], ["قُلۡ", "Слова"], ["ٱ", "Аяты"], ["۞", "Суры"]];
const path = {
  tone: "violet",
  build(layer) {
    const line = h("i.k-path-line");
    const stops = STOPS.map(([g, t], i) => h("div.k-stop.k-hide", { class: i % 2 ? "l" : "r", style: { "--tilt": `${i % 2 ? 3 : -3}deg`, "--row": i + 1 } },
      h("span.k-stop-n", null, i + 1), arSticker(g, { size: "1.7rem", tone: ["lime", "yellow", "sky", "pink", "lime", "yellow", "sky"][i], cls: "k-stop-g" }), h("b", null, t)));
    const goal = h("div.k-stop.k-goal.k-hide", { style: { "--row": STOPS.length + 1, "--tilt": "-2deg" } }, icon("star", { size: 26, fill: true, sw: 1 }), h("b", null, "Читаю Коран"));
    layer.append(h("div.k-path", null, line, ...stops, goal));
    return { line, stops, goal };
  },
  beats: [
    { say: "Вас ждёт путь из маленьких шагов: от первой буквы до чтения сур.",
      run: (r, fx) => {
        fx.animate(r.line, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { dur: 1500, ease: "ease-in-out" });
        fx.each(r.stops, (el, o) => fx.pop(el, { ...o, rot: 14 }), 190, 150); fx.pop(r.goal, { delay: 150 + 190 * STOPS.length, dur: 800 });
        STOPS.forEach((_, i) => fx.sound(sfx.pop, 150 + i * 190)); fx.sound(sfx.finish, 150 + 190 * STOPS.length);
      } },
  ],
};

const how = {
  tone: "blue",
  build(layer) {
    const t = timerSticker("10", "мин");
    const clock = sticker(t.el, { tone: "paper", cls: "k-clock k-hide", tilt: -4 });
    const one = sticker([h("b", null, "+1"), h("small", null, "новое в каждом уроке")], { tone: "lime", cls: "k-plus k-hide", tilt: 4 });
    const teacher = sticker([icon("chat", { size: 30 }), h("b", null, "С преподавателем"), h("small", null, "лучше всего")], { tone: "paper", cls: "k-who k-hide", tilt: -3 });
    const self = sticker([logo(34), h("b", null, "Сами, в TanWin"), h("small", null, "если преподавателя нет рядом")], { tone: "yellow", cls: "k-who k-hide", tilt: 3 });
    const free = badge("Бесплатно", { tone: "pink", tilt: -7, cls: "k-hide k-free" });
    layer.append(h("div.pr-how", null, h("div.pr-how-top", null, clock, one), h("div.pr-who", null, teacher, self, free)));
    return { t, clock, one, teacher, self, free };
  },
  beats: [
    { say: "Каждый урок добавляет одно новое. Хватит 10 минут в день.",
      run: (r, fx) => { fx.pop(r.clock); fx.draw(r.t.ring, { delay: 300, dur: 1400 }); fx.pop(r.one, { delay: 500 }); fx.sound(sfx.pop); fx.sound(sfx.pop, 500); } },
    { say: "Лучше всего учиться с преподавателем. Если его нет рядом, занимайтесь здесь.",
      run: (r, fx) => { fx.rise(r.teacher); fx.rise(r.self, { delay: 220 }); fx.pop(r.free, { delay: 650, rot: 30 }); fx.sound(sfx.pop, 650); } },
  ],
};

/** Пролог знакомства. onDone: к вопросам (имя, цель, с чего начать). */
export function prologue({ onDone }) {
  return film({ shots: [hello, ayah, letters, dots, path, how], onDone, doneLabel: "Начнём!", cls: "pr" });
}
