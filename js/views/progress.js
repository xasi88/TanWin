// Прогресс: уровень, серия, активность, освоение букв и правил, этапы, награды.
import { h, ar, icon, ring, plural } from "../ui.js";
import { store, levelInfo, streakNow, lastDays, mastery, surahDone } from "../store.js";
import { UNITS, SURAH_UNIT, SURAH_PATH } from "../course.js";
import { LETTERS } from "../letters.js";
import { RULES } from "../rules.js";
import { unitProgress, courseProgress, BADGES, checkBadges } from "../path.js";
import { surahMeta } from "../data.js";
import { fmtTime } from "../lesson.js";

function activityChart() {
  const days = lastDays(14);
  const max = Math.max(store.get().profile.goal, ...days.map((d) => d.xp));
  const goal = store.get().profile.goal;
  const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  return h("div.card.chart-card", null,
    h("div.card-title", null, h("h3", null, "Активность за 2 недели"), h("span.muted", null, `цель — ${goal} нура в день`)),
    h("div.bars", { role: "img", "aria-label": "Нур по дням" },
      h("div.goal-line", { style: { bottom: (goal / max) * 100 + "%" } }),
      ...days.map((d, i) => h("div.bar-col", { title: `${d.d}: ${d.xp} нура` },
        h("div.bar", { class: d.xp >= goal ? "met" : d.xp ? "some" : "", style: { height: Math.max(2, (d.xp / max) * 100) + "%" } }, d.xp ? h("span.bar-v", null, d.xp) : null),
        h("small", { class: i === days.length - 1 ? "today" : "" }, WD[d.wd])))));
}

function lettersGrid() {
  return h("div.card", null,
    h("div.card-title", null, h("h3", null, "Буквы"), h("span.muted", null, "цвет — насколько прочно запомнено")),
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

export function ProgressView() {
  checkBadges();
  const s = store.get();
  const lv = levelInfo();
  const cp = courseProgress();
  const acc = s.stats.answers ? Math.round((s.stats.correct / s.stats.answers) * 100) : 0;
  const surahsRead = SURAH_PATH.filter((n) => surahDone(n));
  return h("div.page.progress", null,
    h("header.page-head", null, h("h1", null, "Прогресс")),
    h("div.prog-hero", null,
      h("div.ph-ring", null, ring(cp.pct, { size: 132, stroke: 12, label: Math.round(cp.pct * 100) + "%" }), h("div.muted", null, "пути пройдено")),
      h("div.ph-stats", null,
        tile("flame", streakNow(), plural(streakNow(), "день подряд", "дня подряд", "дней подряд"), `рекорд: ${s.streak.best}`),
        tile("nur", s.xp, "нура", `уровень ${lv.n} · до следующего ${lv.need - lv.into}`),
        tile("target", acc + "%", "точность", `${s.stats.answers} ${plural(s.stats.answers, "ответ", "ответа", "ответов")}`),
        tile("bolt", fmtTime(s.stats.ms), "в занятиях", `${s.stats.lessons} ${plural(s.stats.lessons, "урок", "урока", "уроков")}`))),
    activityChart(),
    h("div.card", null,
      h("div.card-title", null, h("h3", null, "Этапы")),
      h("div.unit-bars", null, ...[...UNITS, SURAH_UNIT].map((u) => {
        const p = unitProgress(u);
        return h("div.ub-row", { style: { "--hc": `var(--c-${u.hue})` } }, h("span.ub-ic", null, ar(u.icon)), h("div.ub-main", null, h("div.ub-top", null, h("b", null, `${u.id}. ${u.title}`), h("span.muted", null, `${p.done}/${p.total}`)), h("div.ub-bar", null, h("i", { style: { width: p.pct * 100 + "%" } }))));
      }))),
    lettersGrid(),
    rulesGrid(),
    surahsRead.length ? h("div.card", null, h("div.card-title", null, h("h3", null, "Прочитанные суры"), h("span.muted", null, `${surahsRead.length} из ${SURAH_PATH.length}`)),
      h("div.surah-chips", null, ...surahsRead.map((n) => h("a.schip", { href: `#/quran/${n}` }, ar(surahMeta(n).ar), h("small", null, surahMeta(n).ru))))) : null,
    h("div.card", null,
      h("div.card-title", null, h("h3", null, "Награды"), h("span.muted", null, `${Object.keys(s.badges).length} из ${BADGES.length}`)),
      h("div.badges", null, ...BADGES.map((b) => h("div.badge-cell", { class: s.badges[b.id] ? "on" : "" }, h("span.b-ic", null, b.icon), h("b", null, b.name), h("small", null, b.text))))));
}
const tile = (ic, v, label, sub) => h("div.tile", null, icon(ic, { size: 22, fill: ic === "flame" || ic === "nur", sw: ic === "flame" || ic === "nur" ? 1 : 2 }), h("b", null, v), h("span", null, label), h("small.muted", null, sub));
