// Главный экран: «Путь»: этапы и уроки, карточка продолжения, цель дня.
import { h, ar, icon, ring, modal, plural, mixed, keep, closeX } from "../ui.js";
import { UNITS, SURAH_PATH, SURAH_UNIT, lessonById } from "../course.js";
import { store, streakNow, levelInfo, dayGoal, todayDone, srsDue, lessonDone, surahDone, backupDue, backupLater } from "../store.js";
import { saveProgressFile } from "./more.js";
import { lessonUnlocked, surahUnlocked, surahsOpen, unitProgress, nextTarget, courseProgress, allOpen, lastOpen, setLastOpen } from "../path.js";
import { surahMeta } from "../data.js";
import { playLesson } from "../lesson.js";
import { go, celebrate, installApp, updateState, onUpdateState, applyNow, checkUpdate } from "../app.js";
import { soundRow } from "../sound.js";
import { isInstalled, onInstallChange } from "../install.js";
import { feedbackButton, openFeedback } from "../feedback.js";
import { homeLine, studentName } from "../tutor.js";
import { NEWS } from "../version.js";
import { tourWaits, startTour } from "../tour.js";
import { track, user, whoParams } from "../usage.js";

const hue = (u) => `var(--c-${u.hue})`;
const unitOfLesson = (id) => UNITS.find((u) => u.lessons.some((l) => l.id === id));

function greeting() {
  const hr = new Date().getHours();
  const name = studentName();
  const g = hr < 5 ? "Доброй ночи" : hr < 12 ? "Доброе утро" : hr < 18 ? "Добрый день" : "Добрый вечер";
  return name ? `${g}, ${name}!` : `${g}!`;
}

// 3.0: три наклейки в ряд: цель дня, серия, нур с уровнем. Нажатие открывает «Прогресс».
function statsBar() {
  const s = store.get();
  const lv = levelInfo();
  const goal = dayGoal(), n = todayDone(), st = streakNow();
  return h("div.home-stats", null,
    h("a.hs-goal", { href: "#/progress", class: n >= goal ? "done" : "", "aria-label": `${n >= goal ? "Цель дня выполнена" : "Цель дня"}: уроков ${Math.min(n, goal)} из ${goal}` },
      ring(n / goal, { size: 40, stroke: 6, cls: n >= goal ? "done" : "", label: n >= goal ? "✓" : `${n}` }),
      h("span.hs-t", null, h("b", null, `${Math.min(n, goal)} из ${goal}`), h("small", null, n >= goal ? "цель выполнена" : "цель дня"))),
    h("a.hs-pill.hs-fire", { href: "#/progress", "aria-label": `Дней подряд: ${st}` }, icon("flame", { size: 24, fill: true, sw: 1.4, cls: st ? "fire" : "" }),
      h("span.hs-t", null, h("b", null, st), h("small", null, plural(st, "день подряд", "дня подряд", "дней подряд")))),
    h("a.hs-pill.hs-nur", { href: "#/progress", "aria-label": `Нур: ${s.xp}, уровень ${lv.n}` }, icon("nur", { size: 24, fill: true, sw: 1.4, cls: "nur" }),
      h("span.hs-t", null, h("b", null, s.xp), h("small", null, `уровень ${lv.n}`))));
}

// 3.0: большая наклейка «Следующий урок»: этап плашкой сверху, знак урока, название и лаймовая кнопка во всю ширину
function continueCard() {
  const t = nextTarget();
  if (!t) return h("div.card.hero-card.done", null, h("span.hero-kicker", null, "Весь путь пройден"), h("div.hero-ar.wide", null, ar("ٱلۡحَمۡدُ لِلَّهِ")), h("h2", null, "Путь пройден!"), h("p", null, "Читайте Коран каждый день и повторяйте правила. И прочитайте знающему человеку: он послушает ваше чтение."), h("a.btn.primary.big.wide", { href: "#/quran" }, "Открыть мусхаф", icon("right", { size: 20 })));
  if (t.type === "surah") {
    const m = surahMeta(t.n);
    return h("a.card.hero-card", { href: `#/surah/${t.n}`, style: { "--hc": "var(--c-gold)" } },
      h("span.hero-kicker", null, "Этап 14 · Читаем Коран"),
      h("div.hero-main", null, h("div.hero-ar.wide", null, ar(m.ar)),
        h("div.hero-body", null, h("small.hero-next", null, "Следующая сура"), h("h2", null, `Сура ${m.ru}`), h("p", null, `${m.meaning} · ${m.verses} ${plural(m.verses, "аят", "аята", "аятов")}`))),
      h("span.btn.primary.big.hero-go", null, "Читать суру", icon("right", { size: 20 })));
  }
  const l = lessonById[t.id];
  const u = unitOfLesson(t.id);
  const started = Object.keys(store.get().lessons).length > 0;
  return h("a.card.hero-card", { href: `#/learn/${t.id}`, style: { "--hc": hue(u) } },
    h("span.hero-kicker", null, `Этап ${u.id} · ${u.title}`),
    h("div.hero-main", null, h("div.hero-ar", null, l.test ? icon("trophy", { size: 40, sw: 2.2 }) : ar(nodeGlyph(l, u))),
      h("div.hero-body", null, h("small.hero-next", null, l.test ? "Проверка этапа" : started ? "Следующий урок" : "Первый урок"), h("h2", null, mixed(l.title)), h("p", null, mixed(l.sub)))),
    h("span.btn.primary.big.hero-go", null, started ? "Продолжить" : "Начать", icon("right", { size: 20 })));
}

// 3.0 (решение автора 2026-10-25): новичок сразу видит «Путь» и меню. Сверху карточка: что есть в приложении,
// подсказки по экрану по кнопке «Показать, где что» и выбор: знакомство, первый урок или проверка уровня.
// Раньше знакомство открывалось само, и многие уходили, не увидев приложения. Карточка уходит после выбора.
const SECTIONS = [
  ["path", "Путь", "14 этапов по порядку: буквы, огласовки, слова, таджвид, суры"],
  ["repeat", "Практика", "повторение трудного и тренировки"],
  ["book", "Мой Коран", "весь Коран с чтецом, закладки и цель чтения"],
  ["chart", "Прогресс", "дни подряд, пройденные уроки и джузы"],
  ["more", "Ещё", "алфавит, правила таджвида, связь с автором"],
  ["gear", "Шестерёнка", "настройки: имя, тема, размер текста, чтец"],
];
function welcomeCard() {
  if (store.get().profile.onboarded) return null;
  const pick = (choice, path) => {
    track("first_choice", { Выбор: choice });
    // знакомство и проверка уровня сами отметят новичка, когда он выберет, с чего начать (и отложат вопросы об имени)
    if (choice === "первый урок") {
      store.set((st) => { st.profile.onboarded = true; });
      try { localStorage.setItem("tanwin.askMe", "1"); } catch {} // имя и цель спросим на итоге первого урока (onboard.js, askLater)
      track("onboarded", { Старт: "Сразу первый урок", ...whoParams() }); user(whoParams());
    }
    go(path);
  };
  const opt = (g, t, s, choice, path) => h("button.start-opt", { type: "button", onclick: () => pick(choice, path) }, h("span.so-g", null, typeof g === "string" ? ar(g) : g), h("div", null, h("b", null, t), h("small", null, s)), icon("right"));
  return h("section.card.welcome-card", null,
    h("span.hero-kicker", null, "Добро пожаловать"),
    h("h2", null, "Ассаляму алейкум! Это TanWin"),
    h("p.wc-lead", null, "Здесь вы научитесь читать Коран: от первой буквы до сур. Бесплатно, по 10 минут в день."),
    h("ul.wc-list", null, ...SECTIONS.map(([ic, t, s]) => h("li", null, h("span.wc-ic", null, icon(ic, { size: 20, sw: 2.2 })), h("span", null, h("b", null, t), ": ", s)))),
    h("button.btn.secondary.wide.wc-tour", { type: "button", onclick: () => startTour(pathTour()) }, icon("info", { size: 18 }), "Показать, где что"),
    h("b.wc-ask", null, "С чего начнём?"),
    h("div.start-opts", null,
      opt(icon("play", { size: 26 }), "Начать со знакомства", "Короткий фильм: как устроено письмо и весь путь", "знакомство", "/welcome"),
      opt("بَ", "Сразу первый урок", "Урок 1.1: как читается Коран", "первый урок", "/learn/1.1"),
      opt("ٱ", "Я уже учился", "Проверю уровень и продолжу с нужного этапа", "проверка", "/welcome/level")));
}

/** Подсказки по экрану: где настройки, счётчики, весь курс и что в каждом разделе меню. */
function pathTour() {
  const tab = (p) => document.querySelector(`#nav .tab[href="#${p}"]`);
  return [
    { el: document.querySelector(".hh-gear"), title: "Настройки", text: "Шестерёнка открывает настройки: имя, обращение на «ты» или «вы», тема, размер текста, шрифт, чтец, звук без интернета." },
    { el: document.querySelector(".home-stats"), title: "Цель дня, дни подряд и нур", text: "Сколько уроков сделано сегодня, сколько дней вы занимаетесь подряд и сколько нура набрали. Нажмите, и откроется «Прогресс»." },
    { el: document.querySelector(".home-main .unit.open .unit-head") || document.querySelector(".home-main .unit-head"), title: "Весь курс по шагам", text: "Ниже весь путь: 14 этапов, от первых букв до чтения сур. Нажмите на этап, и вы увидите его уроки. Уроки открываются по порядку." },
    { el: tab("/review"), fixed: true, title: "Практика", text: "Повторение того, что было трудно, и тренировки: буквы на слух, места выхода звуков, беглое чтение, таджвид." },
    { el: tab("/quran"), fixed: true, title: "Мой Коран", text: "Весь Коран: суры, джузы и страницы мусхафа. Чтец читает, а слово подсвечивается. Здесь же закладки и цель чтения." },
    { el: tab("/progress"), fixed: true, title: "Прогресс", text: "Ваши успехи: дни подряд, календарь двух недель, пройденные уроки и прочитанные джузы." },
    { el: tab("/more"), fixed: true, title: "Ещё", text: "Алфавит, правила таджвида, методика, знакомство с TanWin, связь с автором и установка приложения." },
  ];
}

/** Раз в неделю: «сохраните копию прогресса»: на случай очистки данных браузера или смены телефона. */
function backupCard() {
  if (!backupDue()) return null;
  const card = h("div.card.backup-card", null,
    h("span.rc-ic", null, icon("down", { size: 24 })),
    h("div", null,
      h("b", null, "Сохраните копию прогресса"),
      h("div.muted", null, "Прогресс хранится только на этом устройстве. Файл-копия вернёт его, если данные браузера сотрутся или вы смените телефон."),
      h("div.row.gap.wrap", null,
        h("button.btn.primary.small-btn", { type: "button", onclick: async () => { await saveProgressFile(); if (!backupDue()) card.remove(); } }, icon("down", { size: 16 }), "Сохранить файл"),
        h("button.btn.ghost.small-btn", { type: "button", onclick: () => { backupLater(); card.remove(); } }, "Через неделю"))),
    closeX(() => { backupLater(); card.remove(); }, "Напомнить через неделю"));
  return card;
}

/**
 * На телефоне и планшете в браузере: предложение установить приложение, оно открывается на весь экран, без адресной строки.
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
      h("div.muted", null, "Значок на главном экране, запуск на весь экран (без адресной строки браузера) и работа без интернета."),
      h("div.row.gap.wrap", null,
        h("button.btn.primary.small-btn", { type: "button", onclick: () => { hide(); installApp(); } }, icon("down", { size: 16 }), "Установить"),
        h("button.btn.ghost.small-btn", { type: "button", onclick: hide }, "Не сейчас"))),
    closeX(hide, "Не сейчас"));
  // браузер ответил позже, что приложение уже стоит: карточку убираем, даже если она ещё не на экране
  const off = onInstallChange(() => { if (isInstalled()) { card.style.display = "none"; card.remove(); off(); } });
  return card;
}

/**
 * Письмо разработчика «Что нового»: один раз после обновления, тем, кто начал заниматься до него.
 * Закрыли, перешли к списку изменений или к подсказкам «где что»: больше не показывается.
 * Письмо 3.0 называет число пройденных уроков самого ученика (видно, что ничего не пропало) и спрашивает «Как вам новый вид?».
 */
function newsCard() {
  let seen = false, voted = false;
  try { seen = localStorage.getItem("tanwin.news") === NEWS.id; voted = localStorage.getItem("tanwin.newsVote") === NEWS.id; } catch {}
  if (seen || !(store.get().profile.created < NEWS.since)) return null;
  const hide = () => { try { localStorage.setItem("tanwin.news", NEWS.id); } catch {} card.remove(); };
  const { done } = courseProgress();
  const thanks = (t) => h("p.news-vote", null, h("b", null, t));
  const vote = (like) => {
    try { localStorage.setItem("tanwin.newsVote", NEWS.id); } catch {}
    track("news_vote", { Письмо: NEWS.id, Оценка: like ? "Нравится" : "Не нравится" });
    ask.replaceWith(thanks(like ? "Спасибо! Значит, мы идём верной дорогой." : "Спасибо за честный ответ. Напишите, что неудобно: мы исправим."));
    if (!like) openFeedback();
  };
  const ask = voted ? thanks("Спасибо за ответ!") : h("div.news-vote", null, h("b", null, "Как вам новый вид?"),
    h("div.row.gap.wrap", null,
      h("button.btn.secondary.small-btn", { type: "button", onclick: () => vote(true) }, icon("heart", { size: 18 }), "Нравится"),
      h("button.btn.ghost.small-btn", { type: "button", onclick: () => vote(false) }, "Не нравится")));
  const card = h("div.card.news-card", null,
    h("b.news-h", null, icon("sparkle", { size: 20 }), "TanWin 3.0: новый вид"),
    h("p", null, "Ассаляму алейкум! Мы обновили вид всего приложения. Объяснения в уроках теперь идут фильмом, шаг за шагом."),
    h("p", null, h("b", null, done ? `Ваш прогресс на месте: пройдено ${done} ${plural(done, "урок", "урока", "уроков")}.` : "Ваш прогресс на месте."), " Закладки и настройки тоже. Учить заново ничего не нужно."),
    h("ul.news-list", null,
      h("li", null, "Уроки, как и раньше, на «Пути». Он стал дорогой из этапов."),
      h("li", null, "Настройки: шестерёнка вверху «Пути»."),
      h("li", null, "«Прогресс»: два раздела, «Учёба» и «Коран»."),
      h("li", null, "Значок приложения тоже новый: жёлтая звезда с открытой книгой.")),
    ask,
    h("p", null, "Нашли ошибку? Напишите: кнопка есть на каждом экране. Мы исправим и поблагодарим вас в списке версий."),
    h("p.news-sign", null, keep("Хаси Абдуллах, сын Алама")),
    h("div.row.gap.wrap", null,
      h("button.btn.primary.small-btn", { type: "button", onclick: () => { hide(); startTour(pathTour()); } }, icon("info", { size: 18 }), "Показать, где что"),
      h("a.btn.secondary.small-btn", { href: "#/changelog", onclick: hide }, "Что нового"),
      h("button.btn.ghost.small-btn", { type: "button", onclick: hide }, "Понятно")),
    closeX(hide, "Закрыть письмо"));
  return card;
}

function reviewCard() {
  const due = srsDue().length;
  if (!due) return null;
  return h("a.card.review-card", { href: "#/practice/review" },
    h("span.rc-ic", null, icon("repeat", { size: 26, sw: 2.4 })),
    h("div", null, h("b", null, "Пора повторить"), h("div.muted", null, `${due} ${plural(due, "тема", "темы", "тем")} · 2-3 минуты`)),
    h("span.rc-go", null, icon("right", { size: 20, sw: 2.6 })));
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
          testOf(u) ? h("button.btn.secondary.wide", { type: "button", onclick: () => { close(); go(`/learn/${testOf(u).id}`); } }, icon("bolt", { size: 18 }), "Уже знаю, сдать проверку этапа") : null)));
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

// Этапы свёрнуты, кроме текущего. Что пользователь развернул или свернул сам: помним до перезагрузки.
// Открыт всегда один этап. Какой: выбрал сам ученик (помнится до перезапуска или до входа в урок), иначе этап урока,
// который открывали последним, иначе этап следующего шага пути.
let pickedUnit; // undefined: ученик ещё не выбирал; null, свернул открытый этап
const unitOfLast = () => { const x = lastOpen(); return !x ? null : x.t === "surah" ? SURAH_UNIT : unitOfLesson(x.id); };
function unitBlock(u, target) {
  const p = unitProgress(u);
  const isSurah = u.id === SURAH_UNIT.id;
  const current = target && (target.type === "surah" ? isSurah : unitOfLesson(target.id) === u);
  const nodes = h("div.nodes", { id: `unit-${u.id}-nodes` });
  if (isSurah) SURAH_PATH.forEach((n, i) => nodes.append(surahNode(n, i, target)));
  else u.lessons.forEach((l, i) => nodes.append(lessonNode(l, i, u, target)));
  const toggle = h("button.uh-toggle", { type: "button", "aria-controls": nodes.id, "aria-label": `Этап ${u.id}. ${u.title}` });
  const all = p.done === p.total;
  const head = h("div.unit-head", { style: { "--hc": hue(u) }, class: all ? "all" : "" },
    h("span.uh-num", { "aria-hidden": "true" }, all ? icon("check", { size: 18, sw: 3.2 }) : u.id),
    h("div.uh-text", null, h("h2", null, u.title), h("p", null, u.sub),
      h("div.uh-prog", null, h("span.uh-bar", null, h("i", { style: { width: p.pct * 100 + "%" } })), h("b", null, `${p.done}/${p.total}`))),
    h("span.uh-ar", { "aria-hidden": "true" }, ar(u.icon)),
    h("span.uh-chev", { "aria-hidden": "true" }, icon("down2", { size: 22, sw: 2.8 })),
    current ? h("span.uh-here", { "aria-hidden": "true" }, "Вы здесь") : null,
    toggle);
  const sec = h("section.unit", { id: `unit-${u.id}`, class: current ? "current" : "" }, head, soundRow(u.id), nodes);
  const set = (open) => { sec.classList.toggle("open", open); toggle.setAttribute("aria-expanded", open ? "true" : "false"); };
  sec.setOpen = set;
  set(pickedUnit !== undefined ? pickedUnit === u.id : (unitOfLast() || (current ? u : null)) === u);
  toggle.addEventListener("click", () => {
    const open = !sec.classList.contains("open");
    pickedUnit = open ? u.id : null;
    // открыли этап: остальные закрываются
    if (open) for (const other of sec.parentNode.querySelectorAll(".unit.open")) other.setOpen(false);
    set(open);
    if (sec.getBoundingClientRect().top < 0) sec.scrollIntoView({ block: "start" }); // закрылся этап выше: заголовок не должен уехать за край
  });
  return sec;
}

// Плашка обновления (3.0): новая версия ждёт, или проверить обновление не удаётся дольше трёх дней (плохой VPN)
function updPlaque() {
  const box = h("div.upd-slot");
  const draw = () => {
    const st = updateState();
    box.replaceChildren(!st ? "" : st === "ready"
      ? h("div.upd-plaque.ready", null, icon("sparkle", { size: 22 }), h("div", null, h("b", null, "Есть новая версия"), h("small", null, "Обновление займёт пару секунд")), h("button.btn.primary", { type: "button", onclick: applyNow }, "Обновить"))
      : h("div.upd-plaque.stale", null, icon("info", { size: 22 }), h("div", null, h("b", null, "Давно не получалось проверить обновление"), h("small", null, "Проверьте интернет. Не помогло? Включите или выключите VPN")), h("button.btn.secondary", { type: "button", onclick: checkUpdate }, "Проверить")));
  };
  const off = onUpdateState(() => (box.isConnected ? draw() : off()));
  draw();
  return box;
}

export function HomeView() {
  const target = nextTarget();
  const page = h("div.page.home", null,
    h("div.home-grid", null,
      // сверху то, что делать сейчас: приветствие одной строкой, «Продолжить», «Пора повторить»; счётчики ниже (диагностика 2026-10-21)
      h("aside.home-side", null,
        h("header.home-head", null,
          h("div.hh-row", null, h("h1", null, greeting()), h("a.hh-gear", { href: "#/settings", "aria-label": "Настройки" }, icon("gear", { size: 24 }))),
          h("p.home-line", null, homeLine()),
          statsBar()),
        updPlaque(),
        welcomeCard() || continueCard(),
        reviewCard(),
        newsCard(),
        installCard(),
        backupCard(),
        h("p.home-fb", null, "Нашли ошибку? ", feedbackButton({ cls: "link", label: "Напишите" })),
        h("footer.home-foot", null, h("a", { href: "#/method" }, "Методика"), " · ", h("a", { href: "#/letters" }, "Алфавит"), " · ", h("a", { href: "#/rules" }, "Таджвид"), " · ", h("a", { href: "#/thanks" }, "Благодарности"))),
      h("div.home-main", null,
        h("h2.sec-h", null, "Весь путь"),
        h("p.sec-sub", null, "14 этапов: от первой буквы до чтения сур. Нажмите на этап, и откроются его уроки."),
        h("div.path", null, ...[...UNITS, SURAH_UNIT].map((u) => unitBlock(u, target))))));
  // прокрутка к текущему узлу: только на широком экране, где путь в своей колонке.
  // На телефоне не прыгаем вниз к пути: сверху должна быть видна «Продолжить».
  requestAnimationFrame(() => {
    if (!matchMedia("(min-width: 1200px)").matches) return;
    // встаём на урок, который открывали последним; его нет в открытом этапе: на следующий шаг пути
    const x = pickedUnit === undefined ? lastOpen() : null;
    const cur = (x && page.querySelector(x.t === "surah" ? `.unit.open .node[data-surah="${x.n}"]` : `.unit.open .node[data-lesson="${x.id}"]`)) || page.querySelector(".unit.open .node.current");
    if (cur && Object.keys(store.get().lessons).length > 2) cur.scrollIntoView({ block: "center", behavior: "instant" in document.documentElement.style ? "instant" : "auto" });
  });
  // подсказки «где что» по просьбе: кнопка «Где что в приложении» в «Ещё» ставит отметку и открывает «Путь»
  if (tourWaits()) setTimeout(() => page.isConnected && startTour(pathTour()), 500);
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
  // кино-режим (ветка kino): у урока есть фильм-версия, её шаги вместо шагов курса
  import("../kino/lessons.js").catch(() => ({ KINO: {} })).then(({ KINO }) => playLesson(root, {
    id, title: l.title, steps: KINO[id]?.steps || l.steps, isTest: !!l.test, lesson: l,
    onExit: (res) => {
      go("/");
      if (res) setTimeout(() => celebrate(res.events), 400);
    },
  }));
  return root;
}
