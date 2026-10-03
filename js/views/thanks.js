// «Благодарности»: люди, благодаря пожертвованиям которых состоялся проект.
import { h, ar, icon, keep } from "../ui.js";
import { DONORS, THANKS_TEXT, TOTAL_RAISED, SPECIAL_THANKS } from "../donors.js";

// слова автора: на «ты» не переводятся (keep); **имя** — полужирным
const bold = (text) => text.split("**").map((x, i) => (i % 2 ? h("b", null, keep(x)) : keep(x)));

export function ThanksView() {
  const T = THANKS_TEXT;
  return h("div.page.thanks", null,
    h("header.page-head", null, h("a.back", { href: "#/more" }, icon("left", { size: 18 }), "Ещё"), h("h1", null, T.title)),
    h("section.card.thanks-hero", null,
      h("div.th-ar", null, ar("جَزَاكُمُ ٱللَّهُ خَيۡرًا")),
      h("p.th-tr", null, "Джазакумуллаху хайран — да воздаст вам Аллах благом"),
      TOTAL_RAISED ? h("div.th-total", null, h("small", null, "Собрано на создание"), h("b", null, TOTAL_RAISED)) : null,
      h("p.th-lead", null, T.lead)),
    h("section.card.th-special", null,
      h("h3", null, h("span.rc-ic", null, icon("heart", { size: 22 })), SPECIAL_THANKS.title),
      ...SPECIAL_THANKS.text.map((p) => h("p", null, ...bold(p))),
      h("p.th-sp-dua", null, keep(SPECIAL_THANKS.dua))),
    DONORS.length
      ? h("section.donors", null,
          h("div.card-title", null, h("h3", null, "Наши благотворители"), h("span.muted", null, `${DONORS.length} человек`)),
          h("div.donor-grid", null, ...DONORS.map((d, i) => h("div.donor", { style: { "--i": i } },
            h("span.d-ic", null, i + 1),
            h("div", null, h("b", null, d.name), d.note ? h("small.muted", null, d.note) : null)))))
      : h("section.card.center", null, h("p.muted", null, T.empty)),
    h("section.card.th-dua", null, icon("sparkle", { size: 22 }), h("p", null, T.dua)));
}
