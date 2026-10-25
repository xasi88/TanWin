// Фильм «Как установить на iPhone» (3.0): вместо строки текста нарисованный iPhone показывает, куда нажать.
// Safari до iOS 26: кнопка «Поделиться» внизу. iOS 26 и новее: «•••» рядом с адресом, в меню «Поделиться».
// Другие браузеры на iPhone (Chrome, окно внутри Instagram, Telegram, WhatsApp) приложение не ставят: сначала открыть ссылку в Safari.
// Установленное приложение хранит данные отдельно от Safari: если есть пройденные уроки, сначала копия прогресса.
// Шаги сверены со справкой Apple и обзорами iOS 26 (2026-10-25). На живом iPhone не проверено: у автора нет iPhone.
import { h, icon, toast } from "../ui.js";
import { sfx } from "../audio.js";
import { store } from "../store.js";
import { film } from "./engine.js";
import { sticker, badge, svg, sparks } from "./art.js";
import { EMBLEM } from "../app.js";

const ua = navigator.userAgent;
/** Браузер на iPhone, который не ставит приложения: Chrome, Firefox, Edge, Яндекс, окна внутри соцсетей и мессенджеров. */
const NOT_SAFARI = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA\/|FBAN|FBAV|Instagram|Telegram|WhatsApp|VKClient|OKApp|Line\//;
/** Safari 26 и новее: меню «•••» вместо панели кнопок. */
const modern = () => +(/Version\/(\d+)/.exec(ua)?.[1] || 0) >= 26;
const isPad = () => /iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// значки Safari: контур, как у кнопок iOS
const SHARE = "M8 9.5H6.5a1 1 0 0 0-1 1V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-8.5a1 1 0 0 0-1-1H16M12 3.5V14M8.7 6.8 12 3.5l3.3 3.3";
const PLUS = "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM12 8v8M8 12h8";
const ios = (d) => svg("svg", { viewBox: "0 0 24 24", class: "ins-i", "aria-hidden": "true" }, svg("path", { d }));
const tile = () => { const s = svg("svg", { viewBox: "60 56 408 408", class: "ins-logo", "aria-hidden": "true" }); s.innerHTML = EMBLEM; return h("span.ins-tile", null, s); };
/** Кольцо касания: показывает, куда нажать. */
const tap = () => h("i.ins-tap");

/** Нарисованный iPhone: экран с содержимым. */
const phone = (kids, cls = "") => h("div.ins-phone", { class: cls }, h("i.ins-island"), h("div.ins-screen", null, ...kids));
/** Страница TanWin в Safari (уменьшенная). */
const page = () => h("div.ins-page", null, tile(), h("b", null, "TanWin"), h("i.ins-line"), h("i.ins-line.short"));
const address = () => h("span.ins-addr", null, "tanwin.xasi88.ru");

function safariOld() {
  const share = h("span.ins-btn.ins-share", null, ios(SHARE), tap());
  const bar = h("div.ins-bar.old", null, address(),
    h("div.ins-tools", null, icon("left", { size: 18, sw: 2.4 }), icon("right", { size: 18, sw: 2.4 }), share, icon("book", { size: 18, sw: 2.2 }), h("i.ins-tabs")));
  return { el: phone([page(), bar]), share };
}
function safariNew() {
  const dots = h("span.ins-btn.ins-dots", null, "•••", tap());
  const item = h("div.ins-mi.hit", null, ios(SHARE), "Поделиться", tap());
  const menu = h("div.ins-menu.k-hide", null, h("div.ins-mi", null, icon("bookmark", { size: 16, sw: 2.2 }), "Добавить в закладки"), item, h("div.ins-mi", null, icon("eye", { size: 16, sw: 2.2 }), "Найти на странице"));
  const bar = h("div.ins-bar.new", null, h("span.ins-btn", null, icon("left", { size: 16, sw: 2.6 })), address(), dots);
  return { el: phone([page(), menu, bar]), dots, menu, item };
}

/** Лист «Поделиться»: нужная строка внизу списка. */
function shareSheet() {
  const row = h("div.ins-row.hit", null, "На экран «Домой»", ios(PLUS), tap());
  const sheet = h("div.ins-sheet", null,
    h("div.ins-sh-head", null, tile(), h("div", null, h("b", null, "TanWin"), h("small", null, "tanwin.xasi88.ru"))),
    h("div.ins-apps", null, ...[1, 2, 3, 4].map(() => h("i"))),
    h("div.ins-row", null, "Скопировать", icon("page", { size: 16, sw: 2.2 })),
    h("div.ins-row", null, "Добавить в закладки", icon("bookmark", { size: 16, sw: 2.2 })),
    row);
  return { el: phone([page(), sheet], "dim"), row, sheet };
}

/** Окно «На экран „Домой“»: кнопка «Добавить» вверху справа. */
function addBox(isNew) {
  const add = h("span.ins-add", null, "Добавить", tap());
  const box = h("div.ins-sheet.full", null,
    h("div.ins-add-top", null, h("span", null, "Отменить"), h("b", null, "На экран «Домой»"), add),
    h("div.ins-add-card", null, tile(), h("div", null, h("b", null, "TanWin"), h("small", null, "tanwin.xasi88.ru"))),
    isNew ? h("div.ins-row", null, "Открыть как веб-приложение", h("i.ins-switch")) : null);
  return { el: phone([box], "dim"), add };
}

/** Экран «Домой»: значки приложений, TanWin появляется на свободном месте. */
function home() {
  const mine = h("span.ins-app.mine.k-hide", null, tile(), h("small", null, "TanWin"), h("div.k-sparks", null, ...sparks(8)));
  const apps = [...Array(11)].map((_, i) => h("span.ins-app", { style: { "--c": ["var(--k-sky)", "var(--k-pink)", "var(--k-lime)", "var(--k-yellow)"][i % 4] } }, h("i"), h("small")));
  return { el: phone([h("div.ins-home", null, ...apps, mine)], "home"), mine };
}

/**
 * Фильм установки. Флаги можно передать (робот и раскадровка): safari, modern, lessons (число пройденных уроков).
 * onDone: закрыть.
 */
export function installFilm({ onDone, safari = !NOT_SAFARI.test(ua), isNew = modern(), lessons = Object.values(store.get().lessons).filter((x) => x.done).length } = {}) {
  if (!safari) {
    const copy = () => sticker([icon("page", { size: 22, sw: 2.4 }), h("b", null, "Скопировать ссылку")], { tone: "lime", tag: "button", type: "button", cls: "ins-copy k-hide", tilt: -2 });
    const open = {
      tone: "blue",
      build(layer) {
        const compass = sticker([h("span.ins-compass", null, h("i")), h("b", null, "Safari")], { tone: "paper", cls: "ins-safari k-hide", tilt: -3 });
        const btn = copy();
        layer.append(h("div.ins-col", null, compass, btn));
        return { compass, btn };
      },
      beats: [
        { say: "Этот браузер не ставит приложения на iPhone. Нужен **Safari**.",
          run: (r, fx) => { fx.pop(r.compass, { rot: -20, to: -3 }); fx.sound(sfx.pop, 100); } },
        { say: "Скопируйте ссылку, откройте Safari и вставьте её в адресную строку.",
          run: (r, fx) => fx.rise(r.btn),
          gate: (r, fx, open) => {
            r.btn.onclick = async () => {
              try { await navigator.clipboard.writeText(location.origin + location.pathname); toast("Ссылка скопирована ✓"); } catch { toast(location.origin + location.pathname, 6000); }
              open();
            };
          },
          final: (r, fx) => fx.show(r.btn) },
      ],
    };
    return film({ shots: [open], onDone, doneLabel: "Понятно", cls: "pr ins" });
  }

  const shots = [];
  if (lessons) shots.push({
    tone: "pink",
    build(layer) {
      const card = sticker([h("span.ins-count", null, lessons), h("b", null, "пройдено уроков")], { tone: "paper", cls: "ins-progress k-hide", tilt: -2 });
      const save = sticker([icon("down", { size: 22, sw: 2.4 }), h("b", null, "Сохранить прогресс")], { tone: "lime", tag: "button", type: "button", cls: "ins-save k-hide", tilt: 2 });
      layer.append(h("div.ins-col", null, card, save));
      return { card, save };
    },
    beats: [
      { say: "На iPhone приложение начнёт **с чистого листа**: Safari не передаёт ему ваши уроки.",
        run: (r, fx) => { fx.pop(r.card, { rot: -16, to: -2 }); fx.sound(sfx.pop, 100); } },
      { say: "Сохраните копию прогресса, чтобы ничего не потерять.",
        run: (r, fx) => fx.rise(r.save),
        gate: (r, fx, open) => { r.save.onclick = async () => { const { saveProgressFile } = await import("../views/more.js"); await saveProgressFile(); open(); }; },
        final: (r, fx) => fx.show(r.save) },
    ],
  });

  shots.push(isNew ? {
    tone: "violet",
    cls: "whole",
    build(layer) { const s = safariNew(); layer.append(s.el); return s; },
    beats: [
      { say: "Нажмите **«•••»** рядом с адресом сайта.",
        run: (r, fx) => { r.dots.classList.add("on"); fx.pulse(r.dots, { k: 1.2, delay: 300 }); fx.sound(sfx.tap, 300); } },
      { say: "В меню выберите **«Поделиться»**.",
        run: (r, fx) => { r.dots.classList.remove("on"); r.item.classList.add("on"); fx.pop(r.menu, { rot: 0, to: 0 }); fx.pulse(r.item, { k: 1.06, delay: 500 }); fx.sound(sfx.pop, 0); } },
    ],
  } : {
    tone: "violet",
    cls: "whole",
    build(layer) { const s = safariOld(); layer.append(s.el); return s; },
    beats: [
      { say: isPad() ? "Нажмите кнопку **«Поделиться»** вверху справа." : "Нажмите кнопку **«Поделиться»** внизу экрана.",
        run: (r, fx) => { r.share.classList.add("on"); fx.pulse(r.share, { k: 1.25, delay: 300 }); fx.sound(sfx.tap, 300); } },
    ],
  });

  shots.push({
    tone: "violet",
    cls: "whole",
    build(layer) { const s = shareSheet(); layer.append(s.el); return s; },
    beats: [
      { say: "Пролистайте список вниз и выберите **«На экран „Домой“»**.",
        run: (r, fx) => { fx.rise(r.sheet, { dy: 120 }); r.row.classList.add("on"); fx.pulse(r.row, { k: 1.05, delay: 700 }); fx.sound(sfx.tap, 700); } },
    ],
  });

  shots.push({
    tone: "violet",
    cls: "whole",
    build(layer) { const s = addBox(isNew); layer.append(s.el); return s; },
    beats: [
      { say: isNew ? "Переключатель оставьте включённым и нажмите **«Добавить»**." : "Нажмите **«Добавить»** вверху справа.",
        run: (r, fx) => { r.add.classList.add("on"); fx.pulse(r.add, { k: 1.15, delay: 400 }); fx.sound(sfx.tap, 400); } },
    ],
  });

  shots.push({
    tone: "blue",
    cls: "whole",
    build(layer) { const s = home(); layer.append(s.el); return s; },
    beats: [
      { say: "Готово! **TanWin** на экране «Домой». Открывайте его отсюда.",
        run: (r, fx) => {
          fx.pop(r.mine, { rot: -25, to: 0, delay: 200 });
          if (!fx.instant) fx.later(() => r.mine.querySelector(".k-sparks").classList.add("go"), 400);
          fx.sound(sfx.finish, 300);
        } },
      ...(lessons ? [{ say: "В приложении загрузите копию: **шестерёнка → «Прогресс и данные» → «Загрузить»**.",
        run: (r, fx) => { fx.show(r.mine); fx.pulse(r.mine, { k: 1.12 }); } }] : []),
    ],
  });

  return film({ shots, onDone, doneLabel: "Понятно", cls: "pr ins" });
}

/** Фильм поверх приложения: на весь экран, крестик закрывает. */
export function showInstallFilm(opts = {}) {
  const open = document.querySelector(".ins-film");
  if (open) return open; // двойное нажатие «Установить»: второй фильм не нужен
  const close = () => { box.remove(); document.removeEventListener("keydown", esc); };
  const esc = (e) => { if (e.key === "Escape") close(); };
  const box = h("div.kino.ins-film", { role: "dialog", "aria-modal": "true", "aria-label": "Как установить на iPhone" },
    h("div.ins-top", null, h("b", null, "Как установить на iPhone"), h("button.kf-ic", { type: "button", "aria-label": "Закрыть", onclick: close }, icon("close", { size: 22, sw: 2.6 }))),
    installFilm({ ...opts, onDone: close }));
  document.addEventListener("keydown", esc);
  document.body.append(box);
  return box;
}
