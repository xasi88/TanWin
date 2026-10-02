// Связь с разработчиком: маленькая кнопка на каждом экране → окно с сообщением → WhatsApp.
// Здесь же плашка «приложение в активной разработке».
import { h, icon, modal, toast } from "./ui.js";
import { store } from "./store.js";
import { APP_VERSION, CONTACT } from "./version.js";

const KEY = "tanwin.devBanner";
const DRAFT = "tanwin.fbDraft";
const phone = () => CONTACT.whatsapp.replace(/\D/g, "");

// ---------- Где сейчас ученик ----------
let screen = { title: "", path: "/" };
/** Вызывает маршрутизатор (app.js) при каждой смене экрана: название экрана попадёт в сообщение. */
export function setScreen(title, path) { screen = { title: title || "", path: path || "/" }; }

const clip = (t, n = 60) => { t = (t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
/** Описание места: экран, а в уроке — ещё и шаг (заголовок и арабский текст на нём); в Коране — сура и аят. */
function where() {
  const parts = [screen.title || screen.path];
  const stage = document.querySelector(".lp-stage");
  if (stage) {
    const head = clip(stage.querySelector("h1, h2")?.textContent);
    const arabic = clip(stage.querySelector(".q-word, .q-big, .card-big, .bb-out .ar, .snd-tile .ar, .rd-word .ar")?.textContent, 40);
    if (head) parts.push(`«${head}»`);
    if (arabic) parts.push(arabic);
  } else if (/^\/(quran\/|read|page)/.test(screen.path)) {
    const r = store.get().reading;
    if (r) parts.push(`сура ${r.s}, аят ${r.a}${r.p ? `, стр. ${r.p}` : ""}`);
  }
  return parts.join(" · ");
}
function device() {
  const s = store.get().settings;
  const dark = s.theme === "dark" || (s.theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  const app = matchMedia("(display-mode: standalone)").matches || navigator.standalone ? "приложение" : "браузер";
  return `${innerWidth}×${innerHeight}, ${app}, тема ${dark ? "тёмная" : "светлая"}, шрифт ${s.arFont || "hafs"}`;
}

// ---------- Окно сообщения ----------
const KINDS = [
  ["bug", "Ошибка", "Что пошло не так? Например: не играет звук, кнопка не нажимается…"],
  ["text", "Неточность", "Где неточность — в правиле, транскрипции, переводе, слове?"],
  ["idea", "Идея", "Что стоит добавить или сделать удобнее?"],
  ["other", "Другое", "Вопрос, пожелание, отзыв — всё, что хотите сказать"],
];
function message(kind, text, place) {
  const name = store.get().profile.name;
  return [
    `Ассаляму алейкум! TanWin ${APP_VERSION} · ${KINDS.find((k) => k[0] === kind)[1]}`,
    `Экран: ${place}`,
    `Адрес: #${screen.path}`,
    `Устройство: ${device()}`,
    name ? `Имя: ${name}` : null,
    "",
    text.trim() || "…",
  ].filter((x) => x !== null).join("\n");
}

/** Окно «Написать разработчику». Экран, шаг урока и версия подставляются сами; отправка — через WhatsApp. */
export function openFeedback() {
  if (!phone()) { toast("Связь с автором появится в ближайшем обновлении."); return; }
  if (document.querySelector(".fb")) return; // окно уже открыто
  const place = where(); // запоминаем сразу: за окном экран может смениться
  let kind = "bug";
  let draft = "";
  try { draft = sessionStorage.getItem(DRAFT) || ""; } catch {}
  modal((close) => {
    const area = h("textarea.text-in.fb-text", { rows: "4", maxlength: "1500", "aria-label": "Сообщение", placeholder: KINDS[0][2] });
    area.value = draft;
    const send = h("a.btn.primary.wide", { target: "_blank", rel: "noopener" }, icon("chat", { size: 20 }), "Отправить в WhatsApp");
    const sync = () => {
      send.href = `https://wa.me/${phone()}?text=${encodeURIComponent(message(kind, area.value, place))}`;
      try { sessionStorage.setItem(DRAFT, area.value); } catch {}
    };
    area.addEventListener("input", sync);
    const seg = h("div.seg.fb-kinds", { role: "radiogroup", "aria-label": "О чём сообщение" }, ...KINDS.map(([k, label, hint]) => {
      const b = h("button.seg-btn", { type: "button", role: "radio", class: k === kind ? "on" : "", "aria-checked": k === kind ? "true" : "false" }, label);
      b.addEventListener("click", () => {
        kind = k; area.placeholder = hint;
        [...seg.children].forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b ? "true" : "false"); });
        sync(); area.focus();
      });
      return b;
    }));
    send.addEventListener("click", () => {
      try { sessionStorage.removeItem(DRAFT); } catch {}
      setTimeout(close, 300); // ссылка должна успеть открыться
    });
    sync();
    return h("div.fb", null,
      h("h2", null, "Написать разработчику"),
      h("p.muted", null, "Ошибка, неточность, идея или пожелание — читаю всё сам. Сообщение откроется в WhatsApp, останется нажать «Отправить»."),
      h("div.fb-where", null, icon("target", { size: 16 }), h("span", null, h("b", null, "Вы здесь: "), place)),
      seg, area, send,
      h("p.muted.small", null, `Экран и версия ${APP_VERSION} добавятся сами — так сразу понятно, о чём речь. Снимок экрана можно приложить уже в WhatsApp.`));
  }, { cls: "sheet" });
}

/** Маленькая кнопка у правого края на каждом экране. Не мешает: полупрозрачная, прячется вместе с панелью чтения и под окнами. */
export function initFeedback() {
  if (!phone() || document.querySelector(".fb-tab")) return;
  const b = h("button.fb-tab", { type: "button", "aria-label": "Написать разработчику", title: "Написать разработчику: ошибка, неточность, идея" }, icon("chat", { size: 18 }));
  b.addEventListener("click", openFeedback);
  document.body.append(b);
}

/** Кнопка сообщения автору для страниц (плашка, «Ещё»). Если номер не задан — подсказка вместо кнопки. */
export function feedbackButton({ cls = "btn secondary", label = "Сообщить об ошибке" } = {}) {
  if (!phone()) return h("span.muted.small", null, "Связь с автором появится в ближайшем обновлении.");
  return h("button", { type: "button", class: cls, onclick: openFeedback }, icon("chat", { size: 18 }), label);
}

/** Информационная плашка. dismissible — можно скрыть до следующей версии. */
export function devBanner({ dismissible = true } = {}) {
  let hidden = false;
  try { hidden = dismissible && localStorage.getItem(KEY) === APP_VERSION; } catch {}
  if (hidden) return null;
  const box = h("aside.dev-banner", { role: "note" },
    h("span.db-ic", null, icon("bolt", { size: 20 })),
    h("div.db-body", null,
      h("b", null, "Приложение в активной разработке"),
      h("p", null, `Мы каждый день делаем TanWin лучше. Нашли ошибку, неточность в правиле или неверное слово? Пожалуйста, сообщите ${CONTACT.name} — это очень поможет. Версия ${APP_VERSION}.`),
      h("div.db-actions", null, feedbackButton({ cls: "btn secondary small-btn" }), h("a.link", { href: "#/changelog" }, "Что нового"))),
    dismissible ? h("button.db-x", { type: "button", "aria-label": "Скрыть до следующей версии", onclick: () => { try { localStorage.setItem(KEY, APP_VERSION); } catch {} box.remove(); } }, icon("close", { size: 18 })) : null);
  return box;
}
