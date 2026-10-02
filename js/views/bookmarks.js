// Закладки и цель чтения: несколько сохранённых мест в Коране и обратный отсчёт страниц («прочесть сегодня N страниц»).
import { h, icon, modal, toast, plural, confirmBox, confetti } from "../ui.js";
import { loadSurahs, surahMeta } from "../data.js";
import { store } from "../store.js";
import { go } from "../app.js";
import { enterFullscreen } from "../fullscreen.js";
import { continueReading, PAGES, JUZ_PAGE } from "./quran.js";

const MAX_MARKS = 100;
const pagesWord = (n) => plural(n, "страница", "страницы", "страниц");
const juzOf = (p) => { let j = 0; while (j < 29 && JUZ_PAGE[j + 1] <= p) j++; return j + 1; };
const dateRu = (t) => new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
const placeText = (s, a, p) => `${surahMeta(s)?.ru || `Сура ${s}`}, аят ${a}${p ? ` · стр. ${p}` : ""}`;

/** Открыть режим чтения на месте закладки (и когда этот же адрес уже открыт). */
function openRead(s, a) {
  enterFullscreen();
  const hash = `#/read/${s}/${a}`;
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange")); else go(hash.slice(1));
}

// ---------- Закладки ----------
export const marks = () => store.get().marks || [];
/** Ставит закладку на аят; возвращает false, если такая уже есть. */
export function addMark(s, a, p) {
  if (marks().some((m) => m.s === s && m.a === a)) { toast("Закладка на этом месте уже стоит."); return false; }
  store.set((st) => { st.marks = [{ id: Date.now().toString(36), s, a, p: p || null, at: Date.now() }, ...(st.marks || [])].slice(0, MAX_MARKS); });
  toast(`Закладка поставлена: ${placeText(s, a, p)} ✓`, 3200);
  return true;
}
const removeMark = (id) => store.set((st) => { st.marks = (st.marks || []).filter((m) => m.id !== id); });

/** Кнопка «Закладка» для панелей читалки. place() → { s, a, p } — где сейчас читатель. */
export function markBtn(place) {
  return h("button.tool", { type: "button", title: "Поставить закладку на этом месте", onclick: () => { const x = place(); addMark(x.s, x.a, x.p); } },
    icon("bookmark", { size: 18 }), h("span", null, "Закладка"));
}

/** Список закладок. onOpen — что сделать перед переходом (закрыть окно), onChange — после удаления или новой цели. */
function marksList({ onOpen, onChange } = {}) {
  const box = h("div.mark-list");
  const draw = () => {
    const list = marks();
    box.replaceChildren(...list.map((m) => h("div.mark-row", null,
      h("button.mark-open", { type: "button", onclick: () => { onOpen?.(); openRead(m.s, m.a); } },
        h("span.rc-ic", null, icon("bookmark", { size: 22, fill: true, sw: 1 })),
        h("div", null, h("b", null, `${surahMeta(m.s)?.ru || `Сура ${m.s}`}, аят ${m.a}`), h("small.muted", null, `${m.p ? `стр. ${m.p} · джуз ${juzOf(m.p)} · ` : ""}${dateRu(m.at)}`))),
      m.p ? h("button.icon-btn", { type: "button", title: "Цель чтения с этого места", "aria-label": "Поставить цель чтения с этой закладки", onclick: () => goalModal({ s: m.s, a: m.a, p: m.p }, () => { onOpen?.(); openRead(m.s, m.a); }) }, icon("target")) : null,
      h("button.icon-btn", { type: "button", title: "Удалить закладку", "aria-label": "Удалить закладку", onclick: async () => {
        if (await confirmBox("Удалить закладку?", placeText(m.s, m.a, m.p), "Удалить")) { removeMark(m.id); draw(); onChange?.(); }
      } }, icon("trash")))));
    if (!list.length) box.append(h("p.muted", null, "Закладок пока нет. Откройте «Чтение», нажмите на экран, затем меню ☰ → «Закладка здесь». Закладок может быть сколько угодно."));
  };
  draw();
  return box;
}

/** Окно со списком закладок — для режима чтения, чтобы не выходить из него. */
export function marksSheet() {
  modal((close) => h("div.read-menu", null, h("h2", null, "Мои закладки"), marksList({ onOpen: close })), { cls: "sheet" });
}

// ---------- Цель чтения: обратный отсчёт страниц ----------
export const readGoal = () => store.get().readGoal || null;
const goalRead = (gl, page) => Math.max(0, Math.min(gl.pages, page - gl.from));
export const goalLeft = () => { const gl = readGoal(); return gl ? gl.pages - (gl.read || 0) : 0; };

/**
 * Полоска цели: «осталось N страниц из M». set(page, s, a) вызывается при движении по тексту
 * (page = 605, когда дочитан конец Корана); onDone — цель только что выполнена.
 */
export function goalStrip(onDone) {
  const fill = h("i"), cap = h("small.gs-cap");
  const el = h("div.goal-strip", { hidden: true }, h("div.gs-bar", { "aria-hidden": "true" }, fill), cap);
  const paint = () => {
    const gl = readGoal();
    el.hidden = !gl;
    if (!gl) return;
    const read = gl.read || 0, left = gl.pages - read;
    fill.style.width = (read / gl.pages * 100).toFixed(1) + "%";
    el.classList.toggle("done", !left);
    cap.textContent = left ? `Цель: ${plural(left, "осталась", "остались", "осталось")} ${left} ${pagesWord(left)} из ${gl.pages}` : `Цель выполнена: ${gl.pages} ${pagesWord(gl.pages)} ✓`;
  };
  const set = (page, s, a) => {
    const gl = readGoal();
    if (!gl || gl.done || !page) return paint();
    const read = goalRead(gl, page);
    if (read < (gl.read || 0) || page > gl.from + gl.pages + 1) return paint(); // вернулись назад или открыли другое место — достигнутое не теряем и чужое не засчитываем
    if (read !== gl.read || (s && (gl.s !== s || gl.a !== a))) {
      const done = read >= gl.pages;
      store.set((st) => { Object.assign(st.readGoal, { read, done: done ? Date.now() : 0 }, s && !done ? { s, a } : {}); });
      if (done) { confetti(); toast(`Цель выполнена: прочитано ${gl.pages} ${pagesWord(gl.pages)}. Да примет Аллах ваше чтение!`, 5200); onDone?.(); }
    }
    paint();
  };
  paint();
  return { el, set, paint };
}

/** Окно «Цель чтения». start = { s, a, p } — откуда считать; after() — после установки цели. */
export function goalModal(start, after) {
  modal((close) => {
    const gl = readGoal();
    const max = PAGES + 1 - start.p;
    const inp = h("input.text-in.big", { type: "number", min: 1, max, value: Math.min(max, gl?.pages || 20), inputmode: "numeric", "aria-label": "Сколько страниц прочесть" });
    const till = h("p.muted");
    const val = () => Math.round(+inp.value);
    const sync = () => { const n = val(); till.textContent = n >= 1 && n <= max ? `Читаем со страницы ${start.p} по ${start.p + n - 1}. Отсчёт виден вверху экрана в режиме чтения.` : `Число страниц — от 1 до ${max}.`; };
    inp.addEventListener("input", sync);
    const apply = () => {
      const n = val();
      if (!(n >= 1 && n <= max)) return toast(`Число страниц — от 1 до ${max}`);
      store.set((st) => { st.readGoal = { from: start.p, pages: n, read: 0, s: start.s, a: start.a, at: Date.now(), done: 0 }; });
      close();
      toast(`Цель поставлена: ${n} ${pagesWord(n)}, начиная со страницы ${start.p}`, 3200);
      after?.();
    };
    inp.addEventListener("keydown", (e) => e.key === "Enter" && apply());
    sync();
    return h("div.page-picker.goal-box", null,
      h("h2", null, "Цель чтения"),
      h("p", null, `Сколько страниц вы хотите прочесть, начиная с этого места? Начало: ${placeText(start.s, start.a, start.p)}.`),
      gl ? h("p.muted", null, gl.done ? `Прошлая цель выполнена: ${gl.pages} ${pagesWord(gl.pages)}.` : `Сейчас идёт цель: ${plural(goalLeft(), "осталась", "остались", "осталось")} ${goalLeft()} из ${gl.pages}. Новая цель её заменит.`) : null,
      h("div.row.gap", null, inp, h("button.btn.primary", { type: "button", onclick: apply }, "Начать отсчёт")),
      h("div.rm-row", null, ...[[5, "5"], [10, "10"], [20, "20 — один джуз"]].filter(([n]) => n <= max).map(([n, t]) => h("button.seg-btn", { type: "button", onclick: () => { inp.value = n; sync(); } }, t))),
      till,
      gl ? h("button.btn.ghost", { type: "button", onclick: () => { store.set((st) => { st.readGoal = null; }); close(); toast("Цель снята."); after?.(); } }, icon("trash", { size: 18 }), "Снять цель") : null);
  });
}

/** Карточка цели для страницы «Закладки». */
function goalCard(redraw) {
  const gl = readGoal(), r = store.get().reading;
  const here = r?.p ? { s: r.s, a: r.a, p: r.p } : { s: 1, a: 1, p: 1 };
  if (!gl) return h("section.card.goal-card", null,
    h("h3", null, icon("target", { size: 20 }), " Цель чтения"),
    h("p.muted", null, "Задайте, сколько страниц прочесть, — и приложение покажет обратный отсчёт: сколько осталось до цели."),
    h("button.btn.primary", { type: "button", onclick: () => goalModal(here, redraw) }, `Поставить цель с места чтения (стр. ${here.p})`));
  const left = goalLeft(), strip = goalStrip();
  return h("section.card.goal-card", null,
    h("h3", null, icon("target", { size: 20 }), " Цель чтения"),
    h("div.gc-num", null, left ? h("b", null, left) : icon("check", { size: 40, sw: 3 }), h("span", null, left ? `${pagesWord(left)} ${plural(left, "осталась", "остались", "осталось")} из ${gl.pages}` : `Цель выполнена: ${gl.pages} ${pagesWord(gl.pages)}`)),
    strip.el,
    h("p.muted.small", null, `Со страницы ${gl.from} по ${gl.from + gl.pages - 1} · начато ${dateRu(gl.at)}`),
    h("div.row.gap.wrap", null,
      left ? h("button.btn.primary", { type: "button", onclick: () => openRead(gl.s, gl.a) }, "Продолжить чтение", icon("right", { size: 18 })) : null,
      h("button.btn.secondary", { type: "button", onclick: () => goalModal(here, redraw) }, left ? "Изменить" : "Новая цель")));
}

// ---------- Страница «Закладки» ----------
export async function BookmarksView() {
  await loadSurahs();
  const body = h("div.bm-body");
  const draw = () => body.replaceChildren(
    continueReading() || "",
    goalCard(draw),
    h("h3.bm-h", null, "Мои закладки"),
    marksList({ onChange: draw }));
  draw();
  return h("div.page.bookmarks", null,
    h("header.page-head", null, h("h1", null, "Закладки"), h("p.muted", null, "Сохранённые места в Коране и цель чтения с обратным отсчётом страниц. Место, где вы остановились, запоминается само.")),
    body);
}
