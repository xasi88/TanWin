// Плашка «приложение в активной разработке» и кнопка «Сообщить об ошибке».
import { h, icon } from "./ui.js";
import { APP_VERSION, CONTACT, feedbackLink } from "./version.js";

const KEY = "tanwin.devBanner";

/** Кнопка сообщения автору (WhatsApp). Если номер не задан — подсказка вместо кнопки. */
export function feedbackButton({ cls = "btn secondary", label = "Сообщить об ошибке" } = {}) {
  const url = feedbackLink();
  if (!url) return h("span.muted.small", null, "Связь с автором появится в ближайшем обновлении.");
  return h("a", { class: cls, href: url, target: "_blank", rel: "noopener" }, icon("chat", { size: 18 }), label);
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
