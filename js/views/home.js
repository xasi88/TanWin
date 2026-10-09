// Главный экран: «Путь» — этапы и уроки, карточка продолжения, цель дня.
import { h, ar, icon, ring, modal, plural, mixed, keep } from "../ui.js";
import { UNITS, SURAH_PATH, SURAH_UNIT, lessonById } from "../course.js";
import { store, streakNow, levelInfo, todayXp, srsDue, lessonDone, surahDone, backupDue, backupLater } from "../store.js";
import { saveProgressFile } from "./more.js";
import { lessonUnlocked, surahUnlocked, surahsOpen, unitProgress, nextTarget, courseProgress, allOpen, lastOpen, setLastOpen } from "../path.js";
import { surahMeta } from "../data.js";
import { playLesson } from "../lesson.js";
import { go, celebrate, installApp } from "../app.js";
import { isInstalled } from "../install.js";
import { devBanner } from "../feedback.js";
import { homeLine, studentName } from "../tutor.js";
import { NEWS } from "../version.js";

const hue = (u) => `var(--c-${u.hue})`;
const unitOfLesson = (id) => UNITS.find((u) => u.lessons.some((l) => l.id === id));

function greeting() {
  const hr = new Date().getHours();
  const name = studentName();
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

/** Раз в неделю: «сохраните копию прогресса» — на случай очистки данных браузера или смены телефона. */
function backupCard() {
  if (!backupDue()) return null;
  const card = h("div.card.backup-card", null,
    h("span.rc-ic", null, icon("down", { size: 24 })),
    h("div", null,
      h("b", null, "Сохраните копию прогресса"),
      h("div.muted", null, "Прогресс хранится только на этом устройстве. Файл-копия вернёт его, если данные браузера сотрутся или вы смените телефон."),
      h("div.row.gap.wrap", null,
        h("button.btn.primary.small-btn", { type: "button", onclick: async () => { await saveProgressFile(); if (!backupDue()) card.remove(); } }, icon("down", { size: 16 }), "Сохранить файл"),
        h("button.btn.ghost.small-btn", { type: "button", onclick: () => { backupLater(); card.remove(); } }, "Через неделю"))));
  return card;
}

/**
 * На телефоне и планшете в браузере: предложение установить приложение — оно открывается на весь экран, без адресной строки.
 * Показывается один раз: после «Установить» или «Не сейчас» больше не появляется (кнопка остаётся в разделе «Ещё»).
 */
function installCard() {
  let hidden = false;
  try { hidden = !!localStorage.getItem("tanwin.installHint"); } catch {}
  if (hidden || isInstalled() || !matchMedia("(pointer: coarse)").matches) return null;
  const hide = () => { try { localStorage.setItem("tanwin.installHint", "1"); } catch {} card.remove(); };
  const card = h("div.card.backup-card.install-card", null,
    h("span.rc-ic", null, icon("down", { size: 24 })),
    h("div", null,
      h("b", null, "Установите TanWin как приложение"),
      h("div.muted", null, "Значок на главном экране, запуск на весь экран — без адресной строки браузера — и работа без интернета."),
      h("div.row.gap.wrap", null,
        h("button.btn.primary.small-btn", { type: "button", onclick: () => { hide(); installApp(); } }, icon("down", { size: 16 }), "Установить"),
        h("button.btn.ghost.small-btn", { type: "button", onclick: hide }, "Не сейчас"))));
  return card;
}

/**
 * Письмо разработчика «Что нового»: один раз после обновления — тем, кто начал заниматься до него.
 * Закрыли или перешли к списку изменений — больше не показывается.
 */
function newsCard() {
  let seen = false;
  try { seen = localStorage.getItem("tanwin.news") === NEWS.id; } catch {}
  if (seen || !(store.get().profile.created < NEWS.since)) return null;
  const hide = () => { try { localStorage.setItem("tanwin.news", NEWS.id); } catch {} card.remove(); };
  const card = h("div.card.news-card", null,
    h("b.news-h", null, icon("sparkle", { size: 20 }), "TanWin обновился"),
    h("p", null, "Ассаляму алейкум! В приложении изменились подписи и голос букв. Не пугайтесь: ваш прогресс на месте, ничего учить заново не нужно."),
    h("p", null, "Что изменилось. После тяжёлых букв подпись пишется через «о» и «ы»: «къо», «къы», «ро». Так эти буквы и читаются в Коране. Названия букв и знаки теперь такие, как принято в Чечне: «Хьа», «Хо», «ТӀо», «Къоф». Буквы и слоги читает другой голос — по букварю «Каида Нурания». Как читать новые подписи, написано в «Алфавите»."),
    h("p", null, "На неточность указал Абдуллах Маматиев. Мы исправили её для всех. Спасибо ему — пусть и ему будет за это награда."),
    h("p", null, "TanWin бесплатный, и делаем мы его вместе. Нашли ошибку или неточность — напишите: кнопка «Написать разработчику» есть на каждом экране. Мы исправим её для всех и поблагодарим вас в списке версий."),
    h("p", null, "Лучше всего учиться с преподавателем. Нет преподавателя или времени — занимайтесь по приложению сами."),
    h("p.news-sign", null, keep("Хаси Абдуллах, сын Алама")),
    h("div.row.gap.wrap", null,
      h("a.btn.primary.small-btn", { href: "#/letters", onclick: hide }, "Как читать подписи"),
      h("a.btn.ghost.small-btn", { href: "#/changelog", onclick: hide }, "Все изменения"),
      h("button.btn.ghost.small-btn", { type: "button", onclick: hide }, "Понятно")));
  return card;
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
function lessonNode(l, i, u, target) {
  const done = lessonDone(l.id);
  const open = lessonUnlocked(l.id);
  const cur = open && !done && (!allOpen() || (target?.type === "lesson" && target.id === l.id));
  const st = store.get().lessons[l.id];
  const node = h("button.node", {
    type: "button", "data-lesson": l.id,
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

function surahNode(n, i, target) {
  const m = surahMeta(n);
  const done = surahDone(n), open = surahUnlocked(n);
  const cur = open && !done && (!allOpen() || (target?.type === "surah" && target.n === n));
  const node = h("button.node.surah", {
    type: "button", "data-surah": n, class: [done ? "done" : "", cur ? "current" : "", !open ? "locked" : ""].join(" "),
    style: { "--off": OFFS[i % OFFS.length] + "px", "--hc": "var(--c-gold)" }, "aria-label": `Сура ${m.ru}`,
  },
    h("span.node-disc", null, !open ? icon("lock", { size: 22 }) : done ? icon("check", { size: 28, sw: 3 }) : h("span.node-num", null, n)),
    h("span.node-label", null, m.ru),
    cur ? h("span.node-tip", null, "Читать") : null);
  node.addEventListener("click", () => {
    if (open) go(`/surah/${n}`);
    else modal(h("div.lesson-sheet", { style: { "--hc": "var(--c-gold)" } }, h("h2", null, `Сура ${m.ru}`), h("p.muted", null, m.meaning),
      h("p", null, surahsOpen() ? "Сначала прочитайте предыдущие суры пути." : "Суры откроются после этапа 8 «Аяты». А в разделе «Мой Коран» можно читать и слушать любую суру уже сейчас."),
      h("a.btn.secondary.wide", { href: `#/read/${n}` }, "Открыть в мусхафе")));
  });
  return node;
}

// Этапы свёрнуты, кроме текущего. Что пользователь развернул или свернул сам — помним до перезагрузки.
// Открыт всегда один этап. Какой — выбрал сам ученик (помнится до перезапуска или до входа в урок), иначе этап урока,
// который открывали последним, иначе этап следующего шага пути.
let pickedUnit; // undefined — ученик ещё не выбирал; null — свернул открытый этап
const unitOfLast = () => { const x = lastOpen(); return !x ? null : x.t === "surah" ? SURAH_UNIT : unitOfLesson(x.id); };
function unitBlock(u, target) {
  const p = unitProgress(u);
  const isSurah = u.id === SURAH_UNIT.id;
  const current = target && (target.type === "surah" ? isSurah : unitOfLesson(target.id) === u);
  const nodes = h("div.nodes", { id: `unit-${u.id}-nodes` });
  if (isSurah) SURAH_PATH.forEach((n, i) => nodes.append(surahNode(n, i, target)));
  else u.lessons.forEach((l, i) => nodes.append(lessonNode(l, i, u, target)));
  const toggle = h("button.uh-toggle", { type: "button", "aria-controls": nodes.id, "aria-label": `Этап ${u.id}. ${u.title}` });
  const head = h("div.unit-head", { style: { "--hc": hue(u) } },
    h("div.uh-text", null, h("div.eyebrow", null, `Этап ${u.id}`), h("h2", null, u.title), h("p", null, u.sub)),
    h("div.uh-side", null, ring(p.pct, { size: 54, stroke: 6, label: `${p.done}/${p.total}` })),
    h("span.uh-chev", { "aria-hidden": "true" }, icon("down2", { size: 22, sw: 2.6 })),
    h("span.uh-ar", { "aria-hidden": "true" }, ar(u.icon)),
    toggle);
  const sec = h("section.unit", { id: `unit-${u.id}`, class: current ? "current" : "" }, head, nodes);
  const set = (open) => { sec.classList.toggle("open", open); toggle.setAttribute("aria-expanded", open ? "true" : "false"); };
  sec.setOpen = set;
  set(pickedUnit !== undefined ? pickedUnit === u.id : (unitOfLast() || (current ? u : null)) === u);
  toggle.addEventListener("click", () => {
    const open = !sec.classList.contains("open");
    pickedUnit = open ? u.id : null;
    // открыли этап — остальные закрываются
    if (open) for (const other of sec.parentNode.querySelectorAll(".unit.open")) other.setOpen(false);
    set(open);
    if (sec.getBoundingClientRect().top < 0) sec.scrollIntoView({ block: "start" }); // закрылся этап выше — заголовок не должен уехать за край
  });
  return sec;
}

export function HomeView() {
  const target = nextTarget();
  const page = h("div.page.home", null,
    h("div.home-grid", null,
      h("aside.home-side", null,
        newsCard(),
        devBanner(),
        h("header.home-head", null,
          h("div", null, h("h1", null, greeting()), h("p.muted", null, homeLine())),
          statsBar()),
        continueCard(),
        reviewCard(),
        installCard(),
        backupCard(),
        h("footer.home-foot", null, h("a", { href: "#/method" }, "Методика"), " · ", h("a", { href: "#/letters" }, "Алфавит"), " · ", h("a", { href: "#/rules" }, "Таджвид"), " · ", h("a", { href: "#/thanks" }, "Благодарности"))),
      h("div.path.home-main", null, ...[...UNITS, SURAH_UNIT].map((u) => unitBlock(u, target)))));
  // прокрутка к текущему узлу
  requestAnimationFrame(() => {
    // встаём на урок, который открывали последним; его нет в открытом этапе — на следующий шаг пути
    const x = pickedUnit === undefined ? lastOpen() : null;
    const cur = (x && page.querySelector(x.t === "surah" ? `.unit.open .node[data-surah="${x.n}"]` : `.unit.open .node[data-lesson="${x.id}"]`)) || page.querySelector(".unit.open .node.current");
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
  setLastOpen({ t: "lesson", id });
  pickedUnit = undefined; // после урока «Путь» открывает его этап
  playLesson(root, {
    id, title: l.title, steps: l.steps, isTest: !!l.test, lesson: l,
    onExit: (res) => {
      go("/");
      if (res) setTimeout(() => celebrate(res.events), 400);
    },
  });
  return root;
}
