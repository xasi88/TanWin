// Главный экран: «Путь» — этапы и уроки, карточка продолжения, цель дня.
import { h, ar, icon, ring, modal, plural, mixed } from "../ui.js";
import { UNITS, SURAH_PATH, SURAH_UNIT, lessonById } from "../course.js";
import { store, streakNow, levelInfo, todayXp, srsDue, lessonDone, surahDone } from "../store.js";
import { lessonUnlocked, surahUnlocked, surahsOpen, unitProgress, nextTarget, applySkip, courseProgress } from "../path.js";
import { surahMeta } from "../data.js";
import { playLesson } from "../lesson.js";
import { go, celebrate } from "../app.js";
import { devBanner } from "../feedback.js";

const hue = (u) => `var(--c-${u.hue})`;
const unitOfLesson = (id) => UNITS.find((u) => u.lessons.some((l) => l.id === id));

function greeting() {
  const hr = new Date().getHours();
  const name = store.get().profile.name;
  const g = hr < 5 ? "Доброй ночи" : hr < 12 ? "Доброе утро" : hr < 18 ? "Добрый день" : "Добрый вечер";
  return name ? `${g}, ${name}!` : `${g}!`;
}

function statsBar() {
  const s = store.get();
  const lv = levelInfo();
  const goal = s.profile.goal, tx = todayXp();
  return h("div.home-stats", null,
    h("div.hs-goal", null, ring(tx / goal, { size: 64, stroke: 8, cls: tx >= goal ? "done" : "", label: tx >= goal ? "✓" : `${tx}` }),
      h("div", null, h("b", null, tx >= goal ? "Цель дня выполнена" : "Цель дня"), h("div.muted", null, `${Math.min(tx, goal)} / ${goal} нура`))),
    h("div.hs-pill", { title: "Дней подряд" }, icon("flame", { size: 20, fill: true, sw: 1, cls: streakNow() ? "fire" : "" }), h("b", null, streakNow())),
    h("div.hs-pill", { title: "Уровень" }, h("span.lv-badge", null, lv.n), h("div.lv-bar", null, h("i", { style: { width: lv.pct * 100 + "%" } }))));
}

function continueCard() {
  const t = nextTarget();
  if (!t) return h("div.card.hero-card.done", null, h("div.hero-ar", null, ar("ٱلۡحَمۡدُ لِلَّهِ")), h("h2", null, "Путь пройден!"), h("p", null, "Вы прошли весь курс. Читайте Коран каждый день и повторяйте правила — а ещё прочитайте знающему человеку, чтобы он послушал ваше чтение."), h("a.btn.primary", { href: "#/quran" }, "Открыть мусхаф"));
  if (t.type === "surah") {
    const m = surahMeta(t.n);
    return h("a.card.hero-card", { href: `#/surah/${t.n}`, style: { "--hc": "var(--c-gold)" } },
      h("div.hero-ar", null, ar(m.ar)),
      h("div.hero-body", null, h("div.eyebrow", null, "Читаем Коран"), h("h2", null, `Сура ${m.ru}`), h("p", null, `${m.meaning} · ${m.verses} ${plural(m.verses, "аят", "аята", "аятов")}`)),
      h("span.btn.primary.hero-go", null, "Начать", icon("right", { size: 18 })));
  }
  const l = lessonById[t.id];
  const u = unitOfLesson(t.id);
  const started = Object.keys(store.get().lessons).length > 0;
  return h("a.card.hero-card", { href: `#/learn/${t.id}`, style: { "--hc": hue(u) } },
    h("div.hero-ar", null, ar(u.icon.length <= 3 ? u.icon : u.icon)),
    h("div.hero-body", null, h("div.eyebrow", null, `Этап ${u.id} · ${u.title}`), h("h2", null, mixed(l.title)), h("p", null, mixed(l.sub))),
    h("span.btn.primary.hero-go", null, started ? "Продолжить" : "Начать", icon("right", { size: 18 })));
}

function reviewCard() {
  const due = srsDue().length;
  if (!due) return null;
  return h("a.card.review-card", { href: "#/practice/review" },
    h("span.rc-ic", null, icon("repeat", { size: 26 })),
    h("div", null, h("b", null, "Пора повторить"), h("div.muted", null, `${due} ${plural(due, "тема", "темы", "тем")} ждут повторения — 2–3 минуты`)),
    icon("right"));
}

// Узлы пути: зигзаг
const OFFS = [0, 38, 62, 38, 0, -38, -62, -38];
function lessonNode(l, i, u) {
  const done = lessonDone(l.id);
  const open = lessonUnlocked(l.id);
  const cur = open && !done;
  const st = store.get().lessons[l.id];
  const node = h("button.node", {
    type: "button",
    class: [done ? "done" : "", cur ? "current" : "", !open ? "locked" : "", l.test ? "test" : ""].join(" "),
    style: { "--off": OFFS[i % OFFS.length] + "px", "--hc": hue(u) },
    "aria-label": `${l.title}${done ? ", пройден" : !open ? ", закрыт" : ""}`,
  },
    h("span.node-disc", null, !open ? icon("lock", { size: 22 }) : l.test ? icon("trophy", { size: 26 }) : done ? icon("check", { size: 28, sw: 3 }) : h("span.node-ar", null, ar(nodeGlyph(l, u)))),
    done && st?.stars ? h("span.node-stars", null, ...[1, 2, 3].map((k) => h("i", { class: k <= st.stars ? "on" : "" }, "★"))) : null,
    h("span.node-label", null, mixed(l.title)),
    cur ? h("span.node-tip", null, "Начать") : null);
  node.addEventListener("click", () => lessonSheet(l, u));
  return node;
}
const nodeGlyph = (l, u) => {
  const t = l.title.match(/[؀-ۿ][؀-ۿً-ٰٟۡ ]*/);
  return t ? t[0].trim().split(" ")[0] : u.icon;
};

function lessonSheet(l, u) {
  const done = lessonDone(l.id);
  const open = lessonUnlocked(l.id);
  const st = store.get().lessons[l.id];
  modal((close) => h("div.lesson-sheet", { style: { "--hc": hue(u) } },
    h("div.ls-band", null, h("span", null, `Этап ${u.id} · ${u.title}`)),
    h("h2", null, mixed(l.title)), h("p.muted", null, mixed(l.sub)),
    done && st ? h("p", null, st.skipped ? "Пропущен после проверки этапа." : `Лучший результат: ${st.best}% · ${"★".repeat(st.stars)}`) : null,
    open
      ? h("button.btn.primary.wide", { type: "button", onclick: () => { close(); go(`/learn/${l.id}`); } }, done ? "Пройти ещё раз" : "Начать урок", icon("right", { size: 18 }))
      : h("div", null,
          h("p", null, icon("lock", { size: 16 }), " Сначала пройдите предыдущие уроки."),
          testOf(u) ? h("button.btn.secondary.wide", { type: "button", onclick: () => { close(); go(`/learn/${testOf(u).id}`); } }, icon("bolt", { size: 18 }), "Уже знаю — сдать проверку этапа") : null)));
}
const testOf = (u) => u.lessons.find((l) => l.test);

function surahNode(n, i) {
  const m = surahMeta(n);
  const done = surahDone(n), open = surahUnlocked(n);
  const cur = open && !done;
  const node = h("button.node.surah", {
    type: "button", class: [done ? "done" : "", cur ? "current" : "", !open ? "locked" : ""].join(" "),
    style: { "--off": OFFS[i % OFFS.length] + "px", "--hc": "var(--c-gold)" }, "aria-label": `Сура ${m.ru}`,
  },
    h("span.node-disc", null, !open ? icon("lock", { size: 22 }) : done ? icon("check", { size: 28, sw: 3 }) : h("span.node-num", null, n)),
    h("span.node-label", null, m.ru),
    cur ? h("span.node-tip", null, "Читать") : null);
  node.addEventListener("click", () => {
    if (open) go(`/surah/${n}`);
    else modal(h("div.lesson-sheet", { style: { "--hc": "var(--c-gold)" } }, h("h2", null, `Сура ${m.ru}`), h("p.muted", null, m.meaning),
      h("p", null, surahsOpen() ? "Сначала прочитайте предыдущие суры пути." : "Суры откроются после этапа 10 «Особые написания». А в разделе «Коран» можно читать и слушать любую суру уже сейчас."),
      h("a.btn.secondary.wide", { href: `#/quran/${n}` }, "Открыть в мусхафе")));
  });
  return node;
}

function unitBlock(u) {
  const p = unitProgress(u);
  const isSurah = u.id === SURAH_UNIT.id;
  const head = h("div.unit-head", { style: { "--hc": hue(u) } },
    h("div.uh-text", null, h("div.eyebrow", null, `Этап ${u.id}`), h("h2", null, u.title), h("p", null, u.sub)),
    h("div.uh-side", null, ring(p.pct, { size: 54, stroke: 6, label: `${p.done}/${p.total}` })),
    h("span.uh-ar", { "aria-hidden": "true" }, ar(u.icon)));
  const nodes = h("div.nodes");
  if (isSurah) SURAH_PATH.forEach((n, i) => nodes.append(surahNode(n, i)));
  else u.lessons.forEach((l, i) => nodes.append(lessonNode(l, i, u)));
  return h("section.unit", { id: `unit-${u.id}` }, head, nodes);
}

export function HomeView() {
  const cp = courseProgress();
  const page = h("div.page.home", null,
    h("div.home-grid", null,
      h("aside.home-side", null,
        devBanner(),
        h("header.home-head", null,
          h("div", null, h("h1", null, greeting()), h("p.muted", null, cp.done ? `Пройдено ${Math.round(cp.pct * 100)}% пути к чтению Корана` : "Начнём путь к чтению Корана")),
          statsBar()),
        continueCard(),
        reviewCard(),
        h("footer.home-foot", null, h("a", { href: "#/method" }, "Методика"), " · ", h("a", { href: "#/letters" }, "Алфавит"), " · ", h("a", { href: "#/rules" }, "Таджвид"), " · ", h("a", { href: "#/thanks" }, "Благодарности"))),
      h("div.path", null, ...UNITS.map(unitBlock), unitBlock(SURAH_UNIT))));
  // прокрутка к текущему узлу
  requestAnimationFrame(() => {
    const cur = page.querySelector(".node.current");
    if (cur && Object.keys(store.get().lessons).length > 2) cur.scrollIntoView({ block: "center", behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
  });
  return page;
}

// ---------- Урок ----------
export function LessonRoute(id) {
  const l = lessonById[id];
  const root = h("div.lesson-root");
  if (!l) { go("/"); return root; }
  if (!lessonUnlocked(id) && !l.test) { go("/"); return root; }
  playLesson(root, {
    id, title: l.title, steps: l.steps, isTest: !!l.test, lesson: l,
    onExit: (res) => {
      if (res?.passed && l.test) applySkip(id);
      go("/");
      if (res) setTimeout(() => celebrate(res.events), 400);
    },
  });
  return root;
}
