// Прогресс (3.0): два пути рядом, «Учёба» (уроки) и «Коран» (чтение), общий календарь двух недель,
// под ним вкладки с подробностями. Раньше счёт уроков и чтения шёл двумя похожими блоками и путался (решение автора 2026-10-24).
import { h, ar, icon, ring, plural } from "../ui.js";
import { store, levelInfo, streakNow, lastDays, mastery, surahDone, readStats, dayGoal } from "../store.js";
import { UNITS, SURAH_UNIT, SURAH_PATH } from "../course.js";
import { LETTERS } from "../letters.js";
import { RULES } from "../rules.js";
import { unitProgress, courseProgress, BADGES, checkBadges, nextTarget } from "../path.js";
import { loadSurahs, surahMeta } from "../data.js";
import { fmtTime } from "../lesson.js";
import { PAGES, JUZ_PAGE } from "./quran.js";

const TAB = "tanwin.progTab"; // открытая вкладка: «study» или «quran», помним на этом устройстве
const tabNow = () => { try { return localStorage.getItem(TAB) === "quran" ? "quran" : "study"; } catch { return "study"; } };
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const days = (n, a, b, c) => `${n} ${plural(n, a, b, c)}`;

/** Этап, на котором ученик сейчас: этап следующего урока; всё пройдено: null. */
function unitNow() {
  const t = nextTarget();
  if (!t) return null;
  return t.type === "surah" ? SURAH_UNIT : UNITS.find((u) => u.lessons.some((l) => l.id === t.id));
}
/** Где читатель в Коране: страница места «Продолжить чтение» (её нет: страница начала суры), джуз, доля джуза. */
function quranPlace() {
  const r = store.get().reading;
  if (!r?.s) return null;
  const p = r.p || surahMeta(r.s)?.page || 1;
  let j = 0;
  while (j < 29 && JUZ_PAGE[j + 1] <= p) j++;
  return { p, juz: j + 1, done: j, f: (p - JUZ_PAGE[j]) / ((JUZ_PAGE[j + 1] || PAGES + 1) - JUZ_PAGE[j]) };
}
/** 30 джузов клетками с номерами: пройденные лаймовые, текущий заполняется жёлтым, как точки в чтении. */
const juzGrid = (q) => h("div.juz-grid", { role: "img", "aria-label": `Джуз ${q.juz} из 30, пройдено ${q.done}` },
  ...Array.from({ length: 30 }, (_, i) => h("span.jg", { class: i < q.done ? "done" : i === q.done ? "cur" : "", style: i === q.done ? { "--f": q.f.toFixed(3) } : null }, i + 1)));

// ---------- два пути рядом ----------
function tracks(pick) {
  const cp = courseProgress(), u = unitNow(), streak = streakNow();
  const r = readStats(), q = quranPlace();
  const card = (key, cls, ic, title, pct, label, main, sub, foot) => h("button.pg-track", { type: "button", class: cls, "data-tab": key, onclick: () => pick(key, true) },
    h("span.pg-tt", null, icon(ic, { size: 18 }), title),
    h("div.pg-tr", null, ring(pct, { size: 72, stroke: 9, label })),
    h("b.pg-main", null, main), h("small.pg-sub", null, sub),
    h("span.pg-foot", null, icon("flame", { size: 16, fill: true, sw: 1 }), foot));
  return h("div.pg-tracks", null,
    card("study", "t-study", "path", "Учёба", cp.pct, Math.round(cp.pct * 100) + "%",
      u ? `Этап ${u.id} из 14` : "Путь пройден", u ? u.title : "все уроки и суры", streak ? `${days(streak, "день", "дня", "дней")} подряд` : "серии пока нет"),
    card("quran", "t-quran", "book", "Коран", q ? (q.p - 1) / PAGES : 0, q ? Math.round(((q.p - 1) / PAGES) * 100) + "%" : "0%",
      q ? `Страница ${q.p}` : "Ещё не читали", q ? `из ${PAGES} · джуз ${q.juz}` : "«Мой Коран» ждёт", r.cur ? `${days(r.cur, "день", "дня", "дней")} подряд` : "серии пока нет"));
}

// ---------- общий календарь: уроки и чтение по дням ----------
// урок: бледно-лаймовый день, цель дня выполнена: лаймовый; чтение Корана (минута или страница): жёлтый
function calendar() {
  const ds = lastDays(14), qd = store.get().qread.days, goal = dayGoal();
  const read = (d) => { const x = qd[d]; return !!x && (x.ms >= 60000 || x.pages > 0); };
  const lessonDays = ds.filter((d) => d.n || d.xp).length, met = ds.filter((d) => d.met).length, readDays = ds.filter((d) => read(d.d)).length;
  return h("section.card.pg-cal", null,
    h("div.card-title", null, h("h3", null, "Две недели"),
      h("span.pg-legend", null, h("span", null, h("i.cal-l.met"), "уроки"), h("span", null, h("i.cal-q.on"), "Коран"))),
    h("div.cal", { role: "img", "aria-label": `За две недели: ${days(lessonDays, "день", "дня", "дней")} с уроками, ${days(readDays, "день", "дня", "дней")} с чтением Корана` },
      ...ds.map((d, i) => h("div.cal-day", { class: i === ds.length - 1 ? "today" : "", title: `${d.d}: уроков ${d.n}${read(d.d) ? ", читали Коран" : ""}` },
        h("i.cal-l", { class: d.met ? "met" : d.n || d.xp ? "on" : "" }), h("i.cal-q", { class: read(d.d) ? "on" : "" }), h("small", null, WD[d.wd])))),
    h("p.pg-sum", null, h("b", null, "Уроки: "), `${days(lessonDays, "день", "дня", "дней")} из 14, цель дня (${days(goal, "урок", "урока", "уроков")}) выполнена в ${met}`),
    h("p.pg-sum", null, h("b", null, "Коран: "), `${days(readDays, "день", "дня", "дней")} из 14`));
}

const tile = (ic, v, label, sub) => h("div.tile", null, icon(ic, { size: 22, fill: ic === "flame" || ic === "nur", sw: ic === "flame" || ic === "nur" ? 1 : 2 }), h("b", null, v), h("span", null, label), h("small.muted", null, sub));

// ---------- вкладка «Учёба» ----------
function lettersGrid() {
  return h("div.card", null,
    h("div.card-title", null, h("h3", null, "Буквы"), h("span.muted", null, "цвет показывает, насколько прочно запомнено")),
    h("div.mastery-grid", null, ...LETTERS.map((l) => {
      const m = Math.max(mastery("L:" + l.id), mastery("M:" + l.id) * 0.8);
      return h("div.m-cell", { style: { "--m": m }, title: `${l.name}: ${Math.round(m * 100)}%` }, ar(l.ch), h("i", { style: { width: m * 100 + "%" } }));
    })));
}
function rulesGrid() {
  const keys = ["n", "p", "o", "u", "x", "g", "f", "i", "d", "D", "F", "h", "q", "w", "l", "s"];
  const seen = keys.filter((k) => store.get().srs["R:" + k]);
  if (!seen.length) return null;
  return h("div.card", null,
    h("div.card-title", null, h("h3", null, "Правила таджвида"), h("span.muted", null, `${seen.length} из ${keys.length} начато`)),
    h("div.rule-chips", null, ...keys.map((k) => {
      const m = mastery("R:" + k);
      return h("span.rchip", { class: store.get().srs["R:" + k] ? "" : "off", style: { "--rc": `var(--r-${k})`, "--m": m } }, h("span.rc-dot"), RULES[k].name, store.get().srs["R:" + k] ? h("small", null, Math.round(m * 100) + "%") : null);
    })));
}
function study() {
  const s = store.get(), lv = levelInfo(), cp = courseProgress();
  const acc = s.stats.answers ? Math.round((s.stats.correct / s.stats.answers) * 100) : 0;
  const got = BADGES.filter((b) => s.badges[b.id]), rest = BADGES.filter((b) => !s.badges[b.id]); // полученные награды первыми
  return [
    h("div.ph-stats.pg-tiles", null,
      tile("check", cp.done, plural(cp.done, "урок пройден", "урока пройдено", "уроков пройдено"), `из ${cp.total}, с сурами`),
      tile("nur", s.xp, "нура", `уровень ${lv.n} · до следующего ${lv.need - lv.into}`),
      tile("target", acc + "%", "точность", `${s.stats.answers} ${plural(s.stats.answers, "ответ", "ответа", "ответов")}`),
      tile("bolt", fmtTime(s.stats.ms), "в занятиях", `${s.stats.lessons} ${plural(s.stats.lessons, "занятие", "занятия", "занятий")}`)),
    h("div.card", null,
      h("div.card-title", null, h("h3", null, "Этапы")),
      h("div.unit-bars", null, ...[...UNITS, SURAH_UNIT].map((u) => {
        const p = unitProgress(u);
        return h("div.ub-row", { style: { "--hc": `var(--c-${u.hue})` } }, h("span.ub-ic", null, ar(u.icon)), h("div.ub-main", null, h("div.ub-top", null, h("b", null, `${u.id}. ${u.title}`), h("span.muted", null, `${p.done}/${p.total}`)), h("div.ub-bar", null, h("i", { style: { width: p.pct * 100 + "%" } }))));
      }))),
    lettersGrid(),
    rulesGrid(),
    h("div.card", null,
      h("div.card-title", null, h("h3", null, "Награды"), h("span.muted", null, `${got.length} из ${BADGES.length}`)),
      h("div.badges", null, ...[...got, ...rest].map((b) => h("div.badge-cell", { class: s.badges[b.id] ? "on" : "" }, h("span.b-ic", null, b.icon), h("b", null, b.name), h("small", null, b.text))))),
  ];
}

// ---------- вкладка «Коран» ----------
function quran() {
  const r = readStats(), q = quranPlace();
  const surahsRead = SURAH_PATH.filter((n) => surahDone(n));
  const where = q
    ? h("div.card.pg-where", null,
      h("div.card-title", null, h("h3", null, "Где вы в Коране"), h("a", { href: "#/bookmarks" }, "Закладки и цель")),
      juzGrid(q),
      h("small.pg-cap", null, `Джуз ${q.juz} · стр. ${q.p} · пройдено ${q.done}, осталось ${29 - q.done}`),
      h("a.btn.primary.wide", { href: "#/read" }, "Продолжить чтение", icon("right", { size: 18 })))
    : h("div.card.pg-where", null,
      h("div.card-title", null, h("h3", null, "Где вы в Коране")),
      h("p.muted", null, "Откройте суру в «Моём Коране». Здесь появится место, где вы остановились, 30 джузов точками, дни и время чтения."),
      h("a.btn.primary.wide", { href: "#/quran" }, "Открыть «Мой Коран»", icon("right", { size: 18 })));
  return [
    where,
    h("div.ph-stats.pg-tiles", null,
      tile("book", r.days, plural(r.days, "день с чтением", "дня с чтением", "дней с чтением"), `рекорд подряд: ${r.best}`),
      tile("bolt", fmtTime(r.ms), "за чтением", `сегодня: ${fmtTime(r.today.ms)}`),
      tile("page", r.pages, plural(r.pages, "страница", "страницы", "страниц"), `сегодня: ${r.today.pages}`),
      tile("target", r.goals, plural(r.goals, "цель выполнена", "цели выполнены", "целей выполнено"), "цели закладок")),
    surahsRead.length ? h("div.card", null, h("div.card-title", null, h("h3", null, "Суры из уроков"), h("span.muted", null, `${surahsRead.length} из ${SURAH_PATH.length}`)),
      h("div.surah-chips", null, ...surahsRead.map((n) => h("a.schip", { href: `#/read/${n}` }, ar(surahMeta(n).ar), h("small", null, surahMeta(n).ru))))) : null,
  ];
}

export async function ProgressView() {
  checkBadges();
  await loadSurahs(); // названия сур и страница начала суры для места чтения
  const panel = h("div.pg-panel", { role: "tabpanel", id: "pg-panel" });
  const tabs = h("div.seg.pg-tabs", { role: "tablist", "aria-label": "Подробности" });
  const pick = (key, scroll = false) => {
    try { localStorage.setItem(TAB, key); } catch {}
    for (const b of tabs.children) { const on = b.dataset.tab === key; b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); }
    for (const c of top.querySelectorAll(".pg-track")) c.classList.toggle("on", c.dataset.tab === key);
    panel.replaceChildren(...(key === "quran" ? quran() : study()).filter(Boolean));
    if (scroll) tabs.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  for (const [key, label] of [["study", "Учёба"], ["quran", "Коран"]]) tabs.append(h("button.seg-btn", { type: "button", role: "tab", "data-tab": key, "aria-controls": "pg-panel", onclick: () => pick(key) }, label));
  const top = tracks(pick);
  const view = h("div.page.progress", null, h("header.page-head", null, h("h1", null, "Прогресс")), top, calendar(), tabs, panel);
  pick(tabNow());
  return view;
}
