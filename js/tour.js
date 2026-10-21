// Подсказка для новичка на «Пути»: три шага, нужное место подсвечено, остальное затемнено (просьба автора 2026-10-21).
// Знакомство ставит отметку «ждёт», «Путь» показывает подсказку один раз. Ученики, которые учились до 1.34.1, её не видят.
import { h, icon, skipBtn } from "./ui.js";
import { fill } from "./tutor.js";
import { track } from "./usage.js";

const KEY = "tanwin.tour"; // "wait": показать на «Пути»; "done": уже показана
export const tourWaits = () => { try { return localStorage.getItem(KEY) === "wait"; } catch { return false; } };
export const tourLater = () => { try { localStorage.setItem(KEY, "wait"); } catch {} };
const tourDone = () => { try { localStorage.setItem(KEY, "done"); } catch {} };

/** steps: [{ el, title, text, fixed }]; fixed: элемент закреплён на экране (меню), прокручивать к нему не нужно. Шаг без элемента пропускается. */
export function startTour(steps) {
  steps = steps.filter((s) => s.el?.isConnected);
  if (!steps.length) return;
  let i = 0;
  const hole = h("div.tour-hole");
  const body = h("div.tour-body");
  const count = h("span.tour-count");
  const next = h("button.btn.primary", { type: "button", onclick: () => (i < steps.length - 1 ? show(i + 1) : end("tour_done")) });
  const bubble = h("div.tour-bubble", { role: "dialog", "aria-modal": "true", "aria-live": "polite" },
    h("div.tour-top", null, count, skipBtn(() => end("tour_skipped"), { cls: "tour-skip" })),
    body, h("div.tour-foot", null, next));
  const layer = h("div.tour", null, hole, bubble);
  document.body.append(layer);

  // дыра ровно над элементом; облачко под ним, а если снизу нет места, над ним
  function place() {
    const r = steps[i].el.getBoundingClientRect();
    const pad = 6;
    Object.assign(hole.style, { top: r.top - pad + "px", left: r.left - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
    const bh = bubble.offsetHeight, gap = 14;
    const below = r.bottom + pad + gap;
    const top = below + bh <= innerHeight - 8 ? below : Math.max(8, r.top - pad - gap - bh);
    bubble.style.top = top + "px";
    // на широком экране облачко стоит у своего места (меню слева), на телефоне во всю ширину
    bubble.style.left = Math.max(16, Math.min(r.left + r.width / 2 - bubble.offsetWidth / 2, innerWidth - bubble.offsetWidth - 16)) + "px";
  }
  function show(n) {
    i = n;
    const s = steps[i];
    body.replaceChildren(h("h3", null, fill(s.title)), h("p", null, fill(s.text))); // через h(): текст переводится на «ты», если ученик так выбрал
    count.textContent = `${i + 1} из ${steps.length}`;
    next.replaceChildren(i < steps.length - 1 ? "Дальше" : "Понятно", icon("right", { size: 18 }));
    // элемент вне места над облачком (путь на телефоне): прокручиваем, чтобы он встал вверху, а облачко под ним
    const r = s.el.getBoundingClientRect();
    if (!s.fixed && (r.top < 60 || r.bottom > innerHeight - bubble.offsetHeight - 40)) window.scrollBy(0, r.top - 80);
    requestAnimationFrame(place);
    next.focus({ preventScroll: true });
  }
  function end(goal) {
    tourDone();
    track(goal, { Шаг: i + 1 });
    layer.remove();
    removeEventListener("resize", place);
    removeEventListener("scroll", place, true);
    removeEventListener("hashchange", leave);
    document.removeEventListener("keydown", esc);
    window.scrollTo(0, 0); // после подсказки снова видна карточка урока
  }
  const leave = () => { tourDone(); layer.remove(); removeEventListener("resize", place); removeEventListener("scroll", place, true); document.removeEventListener("keydown", esc); };
  const esc = (e) => { if (e.key === "Escape") end("tour_skipped"); };
  addEventListener("resize", place);
  addEventListener("scroll", place, true);
  addEventListener("hashchange", leave, { once: true });
  document.addEventListener("keydown", esc);
  show(0);
}
