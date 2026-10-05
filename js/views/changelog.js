// «Версии»: история изменений приложения.
import { h, icon } from "../ui.js";
import { APP_VERSION, CHANGELOG } from "../version.js";
import { devBanner } from "../feedback.js";
import { QURAN_APP } from "../env.js";
import { checkUpdate } from "../app.js";

const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export function ChangelogView() {
  return h("div.page.changelog", null,
    h("header.page-head", null, h("a.back", { href: QURAN_APP ? "#/quran" : "#/more" }, icon("left", { size: 18 }), QURAN_APP ? "Мой Коран" : "Ещё"), h("h1", null, "Версии"),
      h("p.muted", null, `Сейчас у вас версия ${APP_VERSION}. Здесь — всё, что менялось в приложении.`),
      h("p.muted", null, "Обновления приходят сами. Если приложение зависает или что-то не открывается — включите или выключите VPN и проверьте обновление."),
      h("button.btn.secondary", { type: "button", onclick: checkUpdate }, icon("repeat", { size: 18 }), "Проверить обновление")),
    devBanner({ dismissible: false }),
    h("ol.versions", null, ...CHANGELOG.map((r, i) => h("li.version", { class: i === 0 ? "latest" : "" },
      h("div.v-head", null, h("span.v-num", null, r.v), h("div", null, h("b", null, r.title), h("small.muted", null, fmtDate(r.date))), i === 0 ? h("span.v-cur", null, "текущая") : null),
      h("ul", null, ...r.items.map((t) => h("li", null, t)))))));
}
