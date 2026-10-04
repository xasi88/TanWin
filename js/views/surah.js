// Урок-сура: знакомство → слушаем с подсветкой → находим правила → читаем сами за чтецом.
import { h, ar, icon, tr, rich, playBtn, plural, sample } from "../ui.js";
import { g } from "../speech.js";
import { loadSurah, loadSurahs, wordKey } from "../data.js";
import { RULES, LEGEND, rulesIn, plain } from "../rules.js";
import { playAyah, playWord, stop, canRecord, startRecording, stopRecording, playUrl } from "../audio.js";
import { store } from "../store.js";
import { surahUnlocked } from "../path.js";
import { playLesson } from "../lesson.js";
import { renderVerses, surahPlayer, arNum, BISMILLAH, legendModal } from "./quran.js";
import { go, celebrate } from "../app.js";

// Короткие пояснения к сурам пути (о чём сура — для мотивации и понимания)
const ABOUT = {
  1: "«Мать Книги». Её читают в каждом ракаате намаза, поэтому правильное чтение Фатихи — первая цель каждого ученика.",
  112: "Сура о единобожии. Пророк ﷺ сказал, что она равна трети Корана.",
  113: "Одна из двух «сур-защитниц»: просьба о защите у Господа рассвета.",
  114: "Вторая «сура-защитница»: просьба о защите от шёпота искусителя.",
  108: "Самая короткая сура Корана — всего три аята.",
  103: "Сура о ценности времени и о том, что спасает человека от убытка.",
  110: "Сура о помощи Аллаха и победе; ниспослана в конце пророческой миссии.",
  111: "Сура об Абу Лахабе и его жене — врагах призыва.",
  106: "Сура о племени курайш и милостях, дарованных ему.",
  105: "Рассказ о войске со слоном, шедшем на Каабу.",
  107: "Сура о тех, кто отказывает в малой помощи и небрежен в молитве.",
  109: "Сура о чистоте веры: «Вам — ваша религия, мне — моя».",
  102: "Предостережение о страсти к приумножению.",
  101: "Сура о Дне, который потрясёт людей.",
  104: "Предостережение хулителю и клеветнику.",
  97: "Сура о Ночи предопределения, которая лучше тысячи месяцев.",
  95: "Клятва смоковницей и маслиной: человек сотворён в прекраснейшем облике.",
  94: "Утешение: «Воистину, за тягостью — облегчение».",
  93: "Утешение Пророку ﷺ и напоминание о милостях.",
  99: "О землетрясении Судного дня и о том, что будет видно каждое дело.",
  100: "Клятва скачущими конями и напоминание о неблагодарности человека.",
  92: "О разных путях людей: щедрость и скупость.",
  91: "Одиннадцать клятв и мысль о душе: преуспел тот, кто её очистил.",
  90: "О крутом перевале — добрых делах, которые трудны для души.",
  98: "О ясном знамении и о лучших из творений.",
  96: "Первые ниспосланные аяты: «Читай!»",
  89: "Сура о народах прошлого и об успокоившейся душе.",
  88: "О Покрывающем событии и о знамениях творения.",
  87: "«Славь имя Господа твоего Всевышнего».",
  86: "Клятва небом и ночным путником-звездой.",
  85: "О людях рва и о стойкости верующих.",
  84: "О дне, когда небо разверзнется.",
  83: "Предостережение обвешивающим.",
  82: "О дне, когда небо расколется.",
  81: "Картины Конца света: «Когда солнце будет скручено».",
  80: "Урок о том, как относиться к каждому, кто ищет знание.",
  79: "О Воскрешении и истории Мусы и Фараона.",
  78: "О Великой вести — Воскрешении.",
};

function introStep(n, meta, data) {
  return { t: "custom", render: () => h("div.card.surah-intro", null,
    h("div.si-ar", null, ar(meta.ar)),
    h("h1", null, `Сура ${meta.ru}`),
    h("p.muted", null, `${meta.meaning} · ${meta.verses} ${plural(meta.verses, "аят", "аята", "аятов")} · ${meta.place === "м" ? "мекканская" : "мединская"} · №${n}`),
    ABOUT[n] ? h("p", null, ABOUT[n]) : null,
    h("div.si-plan", null,
      h("div", null, icon("ear", { size: 20 }), h("span", null, "Послушаем суру с подсветкой слов")),
      h("div", null, icon("target", { size: 20 }), h("span", null, "Найдём правила таджвида в её аятах")),
      h("div", null, icon("mic", { size: 20 }), h("span", null, "Прочитаем каждый аят вслух за чтецом"))),
    h("button.link", { type: "button", onclick: legendModal }, icon("palette", { size: 16 }), " Цвета таджвида")) };
}

function listenStep(n, meta, data) {
  return { t: "custom", render: () => {
    const view = renderVerses(n, data, meta, { mode: "mushaf", colors: store.get().settings.tajweed });
    const player = surahPlayer(n, data, view, { onFinish: () => done.classList.add("pulse") });
    const done = h("span");
    return h("div.surah-listen", null,
      h("h2", null, "Слушаем и следим глазами"),
      h("p.muted", null, "Следите за подсвеченным словом. Нажмите на любое слово, чтобы услышать его отдельно."),
      h("div.reader-tools", null, player.btn, player.repBtn),
      n !== 1 && n !== 9 ? h("div.bismillah", null, ar(BISMILLAH, { colors: store.get().settings.tajweed })) : null,
      view.el, done);
  } };
}

/** Чтение за чтецом: аят → слушаем → читаем сами (можно записать себя). */
function readAlongStep(n, meta, data) {
  return { t: "custom", selfNext: true, render: (api) => {
    let a = 1;
    const box = h("div.read-along");
    let myUrl = null, recOn = false;
    const show = () => {
      stop();
      myUrl = null;
      const view = renderVerses(n, data, meta, { mode: "ayat", colors: store.get().settings.tajweed, translation: store.get().settings.translation, from: a, to: a });
      const listen = h("button.btn.secondary", { type: "button" }, icon("ear", { size: 18 }), "Послушать аят");
      listen.addEventListener("click", () => playAyah(n, a, { onTime: (ms) => view.highlight(a, ms), onEnd: () => view.highlight(a, -1) }));
      const mic = h("button.btn.secondary", { type: "button", disabled: !canRecord() }, icon("mic", { size: 18 }), "Записать себя");
      const mine = h("button.btn.ghost.hidden", { type: "button", onclick: () => myUrl && playUrl(myUrl, { id: "mine" }) }, icon("play", { size: 18 }), "Мой голос");
      mic.addEventListener("click", async () => {
        if (!recOn) { try { stop(); await startRecording(); recOn = true; mic.classList.add("rec"); mic.lastChild.textContent = "Стоп"; } catch { mic.lastChild.textContent = "Нет доступа к микрофону"; } }
        else { const r = await stopRecording(); recOn = false; mic.classList.remove("rec"); mic.lastChild.textContent = "Записать ещё"; if (r) { myUrl = r.url; mine.classList.remove("hidden"); } }
      });
      const next = h("button.btn.primary.wide", { type: "button" }, a < data.v.length ? `${g("Прочитал", "Прочитала", "Прочитал(а)")} — к аяту ${a + 1}` : `${g("Прочитал", "Прочитала", "Прочитал(а)")} всю суру`, icon("right", { size: 18 }));
      next.addEventListener("click", async () => { if (recOn) { await stopRecording(); recOn = false; } api.addXp(3); a++; a <= data.v.length ? show() : api.done(); });
      box.replaceChildren(
        h("div.ra-head", null, h("h2", null, "Читаем сами"), h("span.pill", null, `Аят ${a} из ${data.v.length}`)),
        h("div.ra-bar", null, h("i", { style: { width: ((a - 1) / data.v.length) * 100 + "%" } })),
        h("p.muted", null, "1) Послушайте аят. 2) Прочитайте его вслух сами — медленно, соблюдая мадды и гунны. 3) Если хотите, запишите себя и сравните."),
        view.el,
        h("div.row.gap.wrap.center", null, listen, mic, mine),
        next);
      setTimeout(() => box.isConnected && listen.click(), 400);
    };
    show();
    return box;
  } };
}

export async function SurahLesson(n) {
  const root = h("div.lesson-root");
  if (!surahUnlocked(n)) { go(`/read/${n}`); return root; }
  const [list, data] = await Promise.all([loadSurahs(), loadSurah(n)]);
  const meta = list[n - 1];
  // правила, встречающиеся в суре (для упражнений «найди правило»)
  const present = new Set(data.v.flatMap((v) => v[0].flatMap((w) => rulesIn(w))));
  const learnable = ["n", "q", "g", "f", "i", "d", "D", "o", "u", "p", "l", "w", "x", "F", "h"].filter((c) => present.has(c));
  const codes = sample(learnable, Math.min(3, learnable.length));
  const steps = [introStep(n, meta, data), listenStep(n, meta, data), ...codes.map((c) => ({ t: "ex", k: "ruleSpot", n: 1, code: c, surah: n })), readAlongStep(n, meta, data)];
  playLesson(root, {
    id: n, title: meta.ru, steps, isSurah: true,
    onExit: (res) => { go("/"); if (res) setTimeout(() => celebrate(res.events), 400); },
  });
  return root;
}
