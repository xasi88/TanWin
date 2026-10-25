// Фильм «что дальше» (3.0): для тех, кто на знакомстве выбрал не «с нуля», а «знаю буквы», «читаю по слогам» и т. п.
// Просьба автора 2026-10-24: человеку объясняют, что будет дальше. Перед проверкой он видит: какая проверка,
// сколько нужно ответить, какие шаги пути засчитаются и с какого этапа он продолжит. И что делать, если не получится.
import { h, icon } from "../ui.js";
import { sfx } from "../audio.js";
import { UNITS, lessonById } from "../course.js";
import { film } from "./engine.js";
import { sticker, badge, arSticker } from "./art.js";

// шаги пути, как в прологе; третье число: последний этап курса, который входит в шаг
const STEPS = [["ب", "Буквы", 2], ["ـبـ", "Формы букв", 3], ["بَ", "Огласовки", 4], ["بَـ", "Слоги", 5], ["قُلۡ", "Слова", 7], ["ٱ", "Аяты", 8], ["نْ", "Таджвид", 13], ["۞", "Суры", 14]];
const clean = (t) => t.replace(/[؀-ۿـ]+/g, "").replace(/\s+/g, " ").trim(); // арабский знак в названии урока без арабского шрифта не нужен

/** Что откроется после проверки testId: { unit, next, nextText }. */
export function afterTest(testId) {
  const ui = UNITS.findIndex((u) => u.lessons.some((l) => l.id === testId));
  const u = UNITS[ui], li = u.lessons.findIndex((l) => l.id === testId);
  if (li < u.lessons.length - 1) return { unit: u, nextText: `урок «${clean(u.lessons[li + 1].title)}»` }; // проверка в середине этапа
  const nu = UNITS[ui + 1];
  return { unit: u, next: nu, nextText: !nu ? "чтение сур" : nu.id === 9 ? "этап 9 «Махраджи». С него начинается таджвид, и открываются суры" : `этап ${nu.id} «${nu.title}»` };
}

/** testId: проверка, которую выбрал человек. onDone: начать проверку. */
export function startFilm({ testId, onDone }) {
  const test = lessonById[testId];
  const { unit, nextText } = afterTest(testId);
  const doneTo = STEPS.filter((s) => s[2] <= unit.id).length; // столько шагов засчитается

  const check = {
    tone: "blue",
    build(layer) {
      const card = sticker([
        h("span.st-trophy", null, icon("trophy", { size: 40, sw: 2.2 })),
        h("b.st-title", null, clean(test.title)),
        h("small.st-sub", null, test.sub)], { tone: "paper", cls: "st-card k-hide", tilt: -2 });
      const pct = badge("80%", { tone: "lime", tilt: -6, cls: "st-pct k-hide" });
      const first = badge("с первой попытки", { tone: "yellow", tilt: 4, cls: "st-first k-hide" });
      layer.append(h("div.st-check", null, h("div.st-card-wrap", null, card, pct), first));
      return { card, pct, first };
    },
    beats: [
      { say: "Хорошо! Сначала короткая **проверка**.",
        run: (r, fx) => { fx.pop(r.card, { rot: -20, to: 0 }); fx.sound(sfx.pop, 100); } },
      { say: "Нужно **80%** верных ответов с первой попытки.",
        run: (r, fx) => { fx.pop(r.pct, { rot: 30, to: 0 }); fx.pop(r.first, { delay: 260 }); fx.sound(sfx.pop); fx.sound(sfx.pop, 260); } },
    ],
  };

  const path = {
    tone: "violet",
    build(layer) {
      const line = h("i.k-path-line");
      const stops = STEPS.map(([g, t], i) => h("div.k-stop.k-hide", { class: (i % 2 ? "l" : "r") + (i < doneTo ? " st-done" : i === doneTo ? " st-next" : ""), style: { "--tilt": `${i % 2 ? 3 : -3}deg`, "--row": i + 1 } },
        h("span.k-stop-n", null, i + 1), arSticker(g, { size: "1.6rem", tone: "paper", cls: "k-stop-g" }), h("b", null, t),
        i < doneTo ? h("span.st-tick", null, icon("check", { size: 14, sw: 3.4 })) : null));
      const here = badge("Вы здесь", { tone: "yellow", tilt: -5, cls: "st-here k-hide" });
      const nextStop = stops[doneTo];
      nextStop?.append(here);
      layer.append(h("div.k-path.st-path", null, line, ...stops));
      return { line, stops, here, nextStop };
    },
    beats: [
      { say: "Сдадите, и эти шаги засчитаются. Учить их заново не нужно.",
        run: (r, fx) => {
          fx.animate(r.line, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { dur: 1200, ease: "ease-in-out" });
          fx.each(r.stops, (el, o) => fx.pop(el, { ...o, rot: 14 }), 120, 100);
          for (let i = 0; i < doneTo; i++) fx.sound(sfx.pop, 100 + i * 120);
        } },
      { say: `Ваш следующий шаг: ${nextText}.`,
        run: (r, fx) => { if (!r.nextStop) return; fx.pulse(r.nextStop, { k: 1.12, dur: 600 }); fx.pop(r.here, { delay: 250, rot: 25, to: -5 }); fx.sound(sfx.finish, 250); } },
    ],
  };

  const calm = {
    tone: "pink",
    build(layer) {
      const easy = sticker([icon("target", { size: 28, sw: 2.2 }), h("b", null, "Проверка попроще")], { tone: "lime", cls: "st-opt k-hide", tilt: -3 });
      const first = sticker([icon("path", { size: 28, sw: 2.2 }), h("b", null, "Первый урок")], { tone: "sky", cls: "st-opt k-hide", tilt: 3 });
      const ok = badge("Это нормально", { tone: "yellow", tilt: -4, cls: "k-hide" });
      layer.append(h("div.st-calm", null, ok, h("div.st-opts", null, easy, first)));
      return { easy, first, ok };
    },
    beats: [
      { say: "Не получится с первого раза? Не страшно. Мы предложим проверку попроще или первый урок.",
        run: (r, fx) => { fx.pop(r.ok, { rot: -20, to: -4 }); fx.rise(r.easy, { delay: 250 }); fx.rise(r.first, { delay: 420 }); fx.sound(sfx.pop, 250); fx.sound(sfx.pop, 420); } },
    ],
  };

  return film({ shots: [check, path, calm], onDone, doneLabel: "Начать проверку", cls: "pr st" });
}
