// «Версии»: история изменений приложения.
import { h, icon } from "../ui.js";
import { APP_VERSION, CHANGELOG } from "../version.js";
import { devBanner } from "../feedback.js";

const fmtDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

export function ChangelogView() {
  return h("div.page.changelog", null,
    h("header.page-head", null, h("a.back", { href: "#/more" }, icon("left", { size: 18 }), "Ещё"), h("h1", null, "Версии"),
      h("p.muted", null, `Сейчас у вас версия ${APP_VERSION}. Здесь — всё, что менялось в приложении.`)),
    devBanner({ dismissible: false }),
    h("ol.versions", null, ...CHANGELOG.map((r, i) => h("li.version", { class: i === 0 ? "latest" : "" },
      h("div.v-head", null, h("span.v-num", null, r.v), h("div", null, h("b", null, r.title), h("small.muted", null, fmtDate(r.date))), i === 0 ? h("span.v-cur", null, "текущая") : null),
      h("ul", null, ...r.items.map((t) => h("li", null, t)))))));
}
