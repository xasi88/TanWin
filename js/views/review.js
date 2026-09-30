// Практика: интервальное повторение (что пора повторить) и тренажёры.
import { h, ar, icon, plural, shuffle, rich } from "../ui.js";
import { store, srsDue, lessonDone } from "../store.js";
import { learnedLevel, allOpen } from "../path.js";
import { playLesson } from "../lesson.js";
import { go, celebrate } from "../app.js";

const LEVEL_RU = { fatha: "фатха", kasra: "фатха и касра", damma: "три огласовки", tanween: "танвин", madd: "мадд", sukun: "сукун", shadda: "шадда", full: "всё" };

/** Превращает ключ повторения в шаг-упражнение. */
function stepFor(key) {
  const [t, v] = key.split(":");
  if (t === "L") return { t: "ex", k: pick1(["letterName", "letterPick", "listenFirst"]), n: 1, letters: [v] };
  if (t === "M") return { t: "ex", k: pick1(["pointPick", "zonePick"]), n: 1, letters: [v] };
  if (t === "H") return { t: "ex", k: "heavy", n: 1 };
  if (t === "F") return { t: "ex", k: "formPick", n: 1 };
  if (t === "V") return { t: "ex", k: "syllable", n: 1, vowels: v === "mix" ? ["fatha", "kasra", "damma"] : [v] };
  if (t === "W") return { t: "ex", k: pick1(["readWord", "listenWord"]), n: 1, level: v };
  if (t === "P") return { t: "ex", k: "pairListen", n: 1, pairs: [v.split("-")] };
  if (t === "R") {
    if (v === "izhar") return { t: "ex", k: "nunRule", n: 1 };
    if (v === "allah") return { t: "ex", k: "allahLam", n: 1 };
    if (v === "ra") return { t: "ex", k: "raRule", n: 1 };
    if (v === "l") return { t: "ex", k: "sunMoon", n: 1 };
    if (["n", "p", "o", "u", "x"].includes(v) && Math.random() < 0.5) return { t: "ex", k: "maddCount", n: 1 };
    return { t: "ex", k: "ruleSpot", n: 1, code: v };
  }
  if (t === "S") return v === "waqf" ? { t: "ex", k: "waqfForm", n: 1 } : { t: "ex", k: "stopSign", n: 1 };
  return null;
}
const pick1 = (a) => a[Math.floor(Math.random() * a.length)];

function reviewSteps(max = 14) {
  const srs = store.get().srs;
  const due = srsDue().sort((a, b) => srs[a].box - srs[b].box || srs[a].due - srs[b].due).slice(0, max);
  return shuffle(due).map(stepFor).filter(Boolean);
}
/** Смешанная тренировка по всему пройденному (когда повторять нечего). */
function mixedSteps() {
  const keys = Object.keys(store.get().srs);
  const lv = learnedLevel();
  const steps = shuffle(keys).slice(0, 10).map(stepFor).filter(Boolean);
  if (lv) steps.push({ t: "ex", k: "readWord", n: 3, level: lv }, { t: "ex", k: "listenWord", n: 2, level: lv });
  return shuffle(steps);
}

const DRILLS = [
  { id: "review", icon: "repeat", title: "Повторение", text: "То, что пора освежить в памяти", need: null },
  { id: "letters", icon: "sparkle", title: "Буквы", text: "Названия, формы, звуки", need: "2.9", steps: () => [{ t: "ex", k: "letterName", n: 4, from: "all" }, { t: "ex", k: "letterPick", n: 4, from: "all" }, { t: "ex", k: "formPick", n: 3 }, { t: "ex", k: "listenFirst", n: 3, from: "all" }] },
  { id: "ear", icon: "ear", title: "Тренажёр слуха", text: "Трудные пары: {س} и {ص}, {ت} и {ط}, {ه} и {ح}…", need: "3.4", steps: () => [{ t: "ex", k: "pairListen", n: 10, pairs: "all" }] },
  { id: "makharij", icon: "target", title: "Махраджи", text: "Откуда выходит звук", need: "3.8", steps: () => [{ t: "ex", k: "pointPick", n: 5, letters: "all" }, { t: "ex", k: "heavy", n: 4 }, { t: "ex", k: "zonePick", n: 3 }] },
  { id: "fluency", icon: "book", title: "Беглое чтение", text: "Слова Корана вашего уровня", need: "5.1", steps: () => [{ t: "read", level: learnedLevel() || "fatha", n: 12 }] },
  { id: "listen", icon: "vol", title: "Слова на слух", text: "Узнайте слово по чтецу", need: "5.1", steps: () => [{ t: "ex", k: "listenWord", n: 10, level: learnedLevel() || "fatha" }] },
  { id: "voice", icon: "mic", title: "Мой голос", text: "Запишите себя и сравните с чтецом", need: "5.1", steps: () => Array.from({ length: 3 }, () => ({ t: "speak", level: learnedLevel() || "fatha" })) },
  { id: "tajweed", icon: "palette", title: "Найди правило", text: "Правила таджвида в аятах", need: "11.4", steps: () => [
    ...["f", "i", "d", "D", "g", "q", "n", "o", "u"].filter(() => Math.random() < 0.7).slice(0, 6).map((c) => ({ t: "ex", k: "ruleSpot", n: 1, code: c })),
    { t: "ex", k: "nunRule", n: 4 }] },
  { id: "madd", icon: "slow", title: "Сколько тянуть?", text: "Мадды: 2, 4–5, 6", need: "12.5", steps: () => [{ t: "ex", k: "maddCount", n: 10 }] },
];

export function ReviewView() {
  const due = srsDue().length;
  const total = Object.keys(store.get().srs).length;
  const cards = DRILLS.map((d) => {
    const open = !d.need || lessonDone(d.need) || allOpen();
    const main = d.id === "review";
    const sub = main ? (due ? `${due} ${plural(due, "тема ждёт", "темы ждут", "тем ждут")} повторения` : total ? "Сейчас всё свежо в памяти. Можно потренироваться." : "Пройдите первые уроки — и здесь появятся повторения.") : d.text;
    return h(open ? "a.drill" : "div.drill", { href: open ? `#/practice/${d.id}` : null, class: (open ? "" : "locked ") + (main ? "main" : "") },
      h("span.dr-ic", null, icon(open ? d.icon : "lock", { size: 26 })),
      h("div", null, h("b", null, d.title), h("div.muted", null, open ? rich(sub) : "Откроется по мере прохождения пути")),
      main && due ? h("span.badge", null, due) : null);
  });
  return h("div.page", null,
    h("header.page-head", null, h("h1", null, "Практика"), h("p.muted", null, "Интервальное повторение: приложение запоминает, что вы начинаете забывать, и возвращает это как раз вовремя. Пять минут здесь в день закрепляют пройденное надолго.")),
    h("div.drills", null, ...cards));
}

export function PracticeRoute(kind) {
  const root = h("div.lesson-root");
  const d = DRILLS.find((x) => x.id === kind);
  if (!d) { go("/review"); return root; }
  let steps;
  if (kind === "review") {
    steps = reviewSteps();
    if (!steps.length) steps = mixedSteps();
    if (!steps.length) { go("/review"); return root; }
  } else steps = d.steps();
  playLesson(root, { id: null, title: d.title, steps, onExit: (res) => { go("/review"); if (res) setTimeout(() => celebrate(res.events), 400); } });
  return root;
}
export { LEVEL_RU };
