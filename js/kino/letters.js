// 3.0: знакомство с любой буквой фильмом (шаг 3 плана 3.0) вместо карточки letterIntro.
// Буква пишется на глазах (контур шрифта мусхафа рисуется пером, потом заливается), звучит её название,
// потом звук, приметы (точки), и «Ваш ход»: нажать на букву и повторить название вслух.
import { h, ar } from "../ui.js";
import { playLetter, sfx } from "../audio.js";
import { byId } from "../letters.js";
import { harakatTiles } from "../syllables.js";
import { film, markAr } from "./engine.js";
import { svg, sticker, badge } from "./art.js";
import { sentences } from "./cards.js";

// у алифа и хамзы своего звука нет: пояснение то же, что на карточке знакомства с буквой (js/syllables.js)
const NOTE = {
  alif: "Своего звука у алифа нет. Звук даёт маленький знак хамзы ء над алифом или под ним. После фатхи алиф без знаков тянет звук «а»: «аа».",
  hamza: "Хамза: короткая смычка голоса. Чаще всего она «сидит» на алифе: {أ} {إ}.",
};

/** Буква, которую рисует перо: контур, потом заливка. */
function glyph(ch) {
  const text = svg("text", { x: 120, y: 152, "text-anchor": "middle", class: "kg-text" });
  text.textContent = ch;
  return { el: svg("svg", { viewBox: "0 0 240 240", class: "k-glyph", "aria-hidden": "true" }, text), text };
}

/** Фильм знакомства с буквой. more(id): окно «Подробнее» (махрадж, советы, слова Корана). */
export function letterFilm(id, { done, more } = {}) {
  const l = byId[id];
  const note = markAr(NOTE[id] || l.sound);
  const talk = sentences(note);
  const shot = {
    tone: "blue",
    build(layer) {
      const g = glyph(l.ch);
      const card = sticker([g.el], { tone: "paper", tilt: -2, cls: "k-letter-card", tag: "button", type: "button", "aria-label": `Послушать букву ${l.name}` });
      card.addEventListener("click", () => { playLetter(id); card.animate([{ rotate: "0deg" }, { rotate: "-6deg" }, { rotate: "5deg" }, { rotate: "0deg" }], { duration: 500, easing: "ease-in-out" }); });
      const name = badge(l.name, { tone: "lime", tilt: -6, cls: "k-name k-hide" });
      const arName = id === "hamza" ? null : sticker([ar(l.ar, { colors: false })], { tone: "yellow", tilt: 5, cls: "k-arname k-hide" });
      const snd = id === "alif" || id === "hamza" ? null : badge(`звук «${l.t}»`, { tone: "sky", tilt: 4, cls: "k-hint k-hide" });
      const dots = badge(l.dots, { tone: "pink", tilt: -3, cls: "k-dots k-hide" });
      const tiles = id === "alif" ? harakatTiles("hamza") : null;
      tiles?.classList.add("k-tiles", "k-hide");
      const moreBtn = more ? h("button.k-more.k-hide", { type: "button", onclick: () => more(id) }, "Подробнее: откуда выходит звук") : null;
      layer.append(h("div.kl", null, h("div.k-boat-wrap", null, card, name, arName, snd), h("div.kl-row", null, dots, tiles), moreBtn));
      return { g, card, name, arName, snd, dots, tiles, moreBtn };
    },
    beats: [
      { say: `Новая буква: **${l.name}**.`,
        run: (r, fx) => {
          fx.pop(r.card, { rot: 10 });
          fx.animate(r.g.text, [{ strokeDashoffset: 900, fillOpacity: 0 }, { strokeDashoffset: 0, fillOpacity: 0, offset: 0.72 }, { strokeDashoffset: 0, fillOpacity: 1 }], { dur: 1700, delay: 250, ease: "ease-in-out" });
          fx.pop(r.name, { delay: 1500 }); if (r.arName) fx.pop(r.arName, { delay: 1700, rot: 20 });
          fx.sound(() => playLetter(id), 1550);
        } },
      ...talk.map((say, i) => ({ say, run: (r, fx) => { if (!i && r.snd) { fx.pop(r.snd, { rot: -16 }); fx.sound(sfx.pop); } else fx.wiggle(r.card); } })),
      ...(id === "alif" ? [{ say: "Нажмите на плитки: чтец скажет «Алиф, фатха, а».", run: (r, fx) => fx.rise(r.tiles) }] : []),
      { say: `Её примета: ${l.dots}.`, run: (r, fx) => { fx.pop(r.dots, { rot: 18 }); fx.sound(sfx.pop); } },
      { say: "Нажмите на букву и повторите её название вслух.",
        gate: (r, fx, open) => { r.card.classList.add("k-call"); r.card.addEventListener("click", () => { r.card.classList.remove("k-call"); if (r.moreBtn) fx.pop(r.moreBtn); fx.later(open, 900); }, { once: true }); },
        final: (r, fx) => { if (r.moreBtn) fx.show(r.moreBtn); } },
    ],
  };
  return film({ shots: [shot], onDone: done, cls: "ls" });
}
