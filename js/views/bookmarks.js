// Закладки и цель чтения: сохранённые места в Коране (с названиями, группами и своей целью) и обратный отсчёт страниц.
import { h, icon, modal, toast, plural, confirmBox, confetti, keep } from "../ui.js";
import { loadSurahs, surahMeta } from "../data.js";
import { store, readGoalDone } from "../store.js";
import { go } from "../app.js";
import { enterFullscreen } from "../fullscreen.js";
import { pageContent, PAGES, JUZ_PAGE } from "./quran.js";

const MAX_MARKS = 100;
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const pagesWord = (n) => plural(n, "страница", "страницы", "страниц");
const juzOf = (p) => { let j = 0; while (j < 29 && JUZ_PAGE[j + 1] <= p) j++; return j + 1; };
const dateRu = (t) => new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
const ayahText = (s, a) => `${surahMeta(s)?.ru || `Сура ${s}`}, аят ${a}`;
const placeText = (s, a, p) => `${ayahText(s, a)}${p ? ` · стр. ${p}` : ""}`;

/** Открыть режим чтения на нужном аяте (и когда этот же адрес уже открыт). */
function openRead(s, a) {
  enterFullscreen();
  const hash = `#/read/${s}/${a}`;
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange")); else go(hash.slice(1));
}
const sameDay = (t) => new Date(t).toDateString() === new Date().toDateString();
/**
 * Цель — на день. Выполненная цель на следующий день начинается заново: столько же страниц, с места, где закончился
 * вчерашний план (а не где читатель остановился на самом деле — прочитанное сверх цели в неё не входит).
 */
export async function rollGoal() {
  const gl = readGoal();
  if (!gl || !gl.done || sameDay(gl.done)) return;
  const from = gl.from + gl.pages > PAGES ? 1 : gl.from + gl.pages;
  const part = (await pageContent(from).catch(() => []))[0];
  if (!part) return;
  store.set((st) => { st.readGoal = { from, pages: Math.min(gl.pages, PAGES + 1 - from), read: 0, s: part.s, a: part.from, at: Date.now(), done: 0, ...(gl.mark ? { mark: gl.mark } : {}) }; });
}
/** Открыть закладку. Если у неё есть своя цель — отсчёт страниц начинается сам. */
async function openMark(m) {
  enterFullscreen(); // сразу, пока браузер считает это нажатием
  await rollGoal();
  if (m.goal && m.p) {
    const gl = readGoal();
    if (gl && gl.mark === m.id && !gl.done) return openRead(gl.s, gl.a); // цель этой закладки ещё идёт — продолжаем с места, где остановились
    if (gl && gl.mark === m.id && sameDay(gl.done)) return openRead(m.s, m.a); // сегодняшняя цель уже выполнена — просто читаем дальше, новый отсчёт начнётся завтра
    store.set((st) => { st.readGoal = { from: m.p, pages: Math.min(m.goal, PAGES + 1 - m.p), read: 0, s: m.s, a: m.a, at: Date.now(), done: 0, mark: m.id }; });
  }
  openRead(m.s, m.a);
}

// ---------- Закладки и группы ----------
// Закладка: { id, s, a, p, at, name, g, goal } — name, g (группа) и goal (страниц за раз) необязательны. Группа: { id, name, closed }.
export const marks = () => store.get().marks || [];
export const groups = () => store.get().markGroups || [];
/** Ставит закладку на аят и открывает её настройки (название, группа, цель); возвращает false, если такая уже есть. */
export function addMark(s, a, p) {
  if (marks().some((m) => m.s === s && m.a === a)) { toast("Закладка на этом аяте уже стоит."); return false; }
  const id = newId();
  store.set((st) => { st.marks = [{ id, s, a, p: p || null, at: Date.now() }, ...(st.marks || [])].slice(0, MAX_MARKS); });
  markEditor(id, { fresh: true });
  return true;
}
/** Новый порядок закладок: ids — закладки одного списка сверху вниз; остальные остаются на своих местах. */
const orderMarks = (ids) => store.set((st) => {
  const by = new Map((st.marks || []).map((m) => [m.id, m])), set = new Set(ids);
  let i = 0;
  st.marks = (st.marks || []).map((m) => (set.has(m.id) ? by.get(ids[i++]) : m));
});
const removeMark = (id) => store.set((st) => { st.marks = (st.marks || []).filter((m) => m.id !== id); });
const addGroup = (name) => { const id = "g" + newId(); store.set((st) => { st.markGroups = [...(st.markGroups || []), { id, name }]; }); return id; };

/** Кнопка «Закладка» для панелей читалки. place() → { s, a, p } — где сейчас читатель. */
export function markBtn(place) {
  return h("button.tool", { type: "button", title: "Поставить закладку на этом месте", onclick: () => { const x = place(); addMark(x.s, x.a, x.p); } },
    icon("bookmark", { size: 18 }), h("span", null, "Закладка"));
}

/** Настройки закладки: название, группа, своя цель, удаление. fresh — закладку только что поставили. */
export function markEditor(id, { fresh = false, onChange } = {}) {
  const m = marks().find((x) => x.id === id);
  if (!m) return;
  modal((close) => {
    let g = groups().some((x) => x.id === m.g) ? m.g : "";
    const name = h("input.text-in", { type: "text", maxlength: 60, value: m.name || "", placeholder: "Например: «Каждый день» или «В пятницу»", "aria-label": "Название закладки" });
    const ng = h("input.text-in", { type: "text", maxlength: 40, hidden: true, placeholder: "Название новой группы", "aria-label": "Название новой группы" });
    const goal = h("input.text-in", { type: "number", min: 0, max: PAGES, inputmode: "numeric", value: m.goal || "", placeholder: "Без цели", "aria-label": "Сколько страниц читать за раз" });
    const chips = h("div.rm-row");
    const drawChips = () => chips.replaceChildren(...[{ id: "", name: "Без группы" }, ...groups(), { id: "+", name: "+ Новая группа" }].map((x) =>
      h("button.seg-btn", { type: "button", class: x.id === g ? "on" : "", onclick: () => { g = x.id; ng.hidden = g !== "+"; drawChips(); if (g === "+") ng.focus(); } }, keep(x.name))));
    drawChips();
    const save = () => {
      const gid = g === "+" ? (ng.value.trim() ? addGroup(ng.value.trim()) : "") : g;
      const n = Math.max(0, Math.min(PAGES, Math.round(+goal.value) || 0));
      store.set((st) => { const x = st.marks.find((y) => y.id === id); if (x) Object.assign(x, { name: name.value.trim(), g: gid, goal: n }); });
      close(); onChange?.();
    };
    for (const inp of [name, ng, goal]) inp.addEventListener("keydown", (e) => e.key === "Enter" && save());
    return h("div.mark-edit", null,
      h("h2", null, fresh ? "Закладка поставлена ✓" : "Закладка"),
      h("p.muted", null, placeText(m.s, m.a, m.p)),
      h("div.label", null, "Название — если нужно"), name,
      h("div.label", null, "Группа"), chips, ng,
      h("div.label", null, "Цель: сколько страниц читать за раз"), goal,
      h("p.muted.small", null, "С целью отсчёт страниц начинается сам, как только вы откроете закладку. Цель выполнена — закладка переезжает вперёд, и в следующий раз чтение продолжится с нового места."),
      h("div.row.gap.wrap", null,
        h("button.btn.primary", { type: "button", onclick: save }, fresh ? "Готово" : "Сохранить"),
        fresh ? null : h("button.btn.ghost", { type: "button", onclick: async () => {
          if (await confirmBox("Удалить закладку?", m.name || placeText(m.s, m.a, m.p), "Удалить")) { removeMark(id); close(); onChange?.(); }
        } }, icon("trash", { size: 18 }), "Удалить")));
  });
}

/** Группа закладок: название, место в списке, удаление. id = null — новая группа. */
function groupEditor(id, onChange) {
  const g = groups().find((x) => x.id === id);
  modal((close) => {
    const name = h("input.text-in", { type: "text", maxlength: 40, value: g?.name || "", placeholder: "Например: «Сегодня» или «Пятница»", "aria-label": "Название группы" });
    const save = () => {
      const t = name.value.trim();
      if (!t) return toast("Напишите название группы.");
      if (g) store.set((st) => { st.markGroups.find((x) => x.id === id).name = t; }); else addGroup(t);
      close(); onChange?.();
    };
    name.addEventListener("keydown", (e) => e.key === "Enter" && save());
    const move = (d) => {
      store.set((st) => { const l = st.markGroups, i = l.findIndex((x) => x.id === id), j = i + d; if (i >= 0 && j >= 0 && j < l.length) [l[i], l[j]] = [l[j], l[i]]; });
      onChange?.();
    };
    requestAnimationFrame(() => !g && name.focus());
    return h("div.mark-edit", null,
      h("h2", null, g ? "Группа закладок" : "Новая группа"),
      g ? null : h("p.muted", null, "Соберите в группу то, что читаете вместе: например, суры на сегодня или на пятницу."),
      h("div.label", null, "Название"), name,
      h("div.row.gap.wrap", null,
        h("button.btn.primary", { type: "button", onclick: save }, g ? "Сохранить" : "Создать"),
        g && groups().length > 1 ? h("button.btn.ghost", { type: "button", onclick: () => move(-1) }, "Выше") : null,
        g && groups().length > 1 ? h("button.btn.ghost", { type: "button", onclick: () => move(1) }, "Ниже") : null,
        g ? h("button.btn.ghost", { type: "button", onclick: async () => {
          if (!(await confirmBox("Удалить группу?", `«${g.name}». Закладки из неё останутся — без группы.`, "Удалить"))) return;
          store.set((st) => { st.markGroups = st.markGroups.filter((x) => x.id !== id); });
          close(); onChange?.();
        } }, icon("trash", { size: 18 }), "Удалить") : null));
  });
}

const scrollBox = (el) => { for (let p = el.parentElement; p; p = p.parentElement) if (/auto|scroll/.test(getComputedStyle(p).overflowY) && p.scrollHeight > p.clientHeight) return p; return document.scrollingElement; };
/**
 * Ручка «переместить»: закладку тянут вверх или вниз (или двигают стрелками на клавиатуре).
 * Сдвигаются соседние строки, а не сама закладка: иначе браузер отпустил бы её из-под пальца.
 */
function gripBtn(box, row) {
  const save = () => orderMarks([...box.children].map((x) => x.dataset.id).filter(Boolean));
  const mid = (x) => { const r = x.getBoundingClientRect(); return r.top + r.height / 2; };
  const up = () => { const x = row.previousElementSibling; if (x?.dataset.id) { row.after(x); return true; } };
  const down = () => { const x = row.nextElementSibling; if (x?.dataset.id) { row.before(x); return true; } };
  const btn = h("button.icon-btn.mark-grip", { type: "button", title: "Переместить: потяните вверх или вниз", "aria-label": "Переместить закладку: потяните или нажимайте стрелки вверх и вниз" }, icon("grip", { sw: 3 }));
  btn.addEventListener("keydown", (e) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    if (e.key === "ArrowUp" ? up() : down()) { save(); row.scrollIntoView({ block: "nearest" }); }
  });
  btn.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch {}
    row.classList.add("drag");
    const sc = scrollBox(box);
    let y = e.clientY, raf = 0;
    const place = () => { if (row.previousElementSibling?.dataset.id && y < mid(row.previousElementSibling)) up(); else if (row.nextElementSibling?.dataset.id && y > mid(row.nextElementSibling)) down(); };
    const edge = () => { // у края экрана список подкручивается сам
      const r = sc === document.scrollingElement ? { top: 0, bottom: innerHeight } : sc.getBoundingClientRect();
      const d = y < r.top + 56 ? -9 : y > r.bottom - 56 ? 9 : 0;
      if (d) { sc.scrollTop += d; place(); }
      raf = requestAnimationFrame(edge);
    };
    const move = (ev) => { y = ev.clientY; place(); };
    const drop = () => {
      cancelAnimationFrame(raf);
      row.classList.remove("drag");
      btn.removeEventListener("pointermove", move); btn.removeEventListener("pointerup", drop); btn.removeEventListener("pointercancel", drop);
      save();
    };
    btn.addEventListener("pointermove", move); btn.addEventListener("pointerup", drop); btn.addEventListener("pointercancel", drop);
    raf = requestAnimationFrame(edge);
  });
  return btn;
}

/** Список закладок по группам. onOpen — что сделать перед переходом (закрыть окно), onChange — после любого изменения. */
function marksList({ onOpen, onChange } = {}) {
  const wrap = h("div.mark-groups");
  const redraw = () => (onChange ? onChange() : draw());
  const row = (m, box, many) => {
    const sub = [m.name ? ayahText(m.s, m.a) : null, m.p ? `стр. ${m.p}` : null, !m.name && m.p ? `джуз ${juzOf(m.p)}` : null, m.goal ? `цель: ${m.goal} стр.` : dateRu(m.at)].filter(Boolean).join(" · ");
    const r = h("div.mark-row", { "data-id": m.id },
      h("button.mark-open", { type: "button", onclick: () => { onOpen?.(); openMark(m); } },
        h("span.rc-ic", null, icon(m.goal ? "target" : "bookmark", m.goal ? { size: 22 } : { size: 22, fill: true, sw: 1 })),
        h("div", null, h("b", null, keep(m.name || ayahText(m.s, m.a))), h("small.muted", null, sub))),
      h("button.icon-btn", { type: "button", title: "Название, группа, цель, удаление", "aria-label": "Настроить закладку", onclick: () => markEditor(m.id, { onChange: redraw }) }, icon("more", { sw: 3 })));
    if (many) r.prepend(gripBtn(box, r));
    return r;
  };
  const rows = (list) => { const box = h("div.mark-list"); box.append(...list.map((m) => row(m, box, list.length > 1))); return box; };
  const draw = () => {
    const all = marks(), gs = groups(), known = new Set(gs.map((g) => g.id));
    const loose = all.filter((m) => !known.has(m.g));
    wrap.replaceChildren(...[
      ...gs.map((g) => {
        const list = all.filter((m) => m.g === g.id);
        return h("details.mark-group", { open: !g.closed, ontoggle: (e) => { const closed = !e.currentTarget.open; if (closed !== !!g.closed) store.set((st) => { const x = st.markGroups.find((y) => y.id === g.id); if (x) x.closed = closed; }); } },
          h("summary", null, icon("down2", { size: 18, sw: 3 }), h("b", null, keep(g.name)), h("span.muted", null, list.length),
            h("button.icon-btn", { type: "button", title: "Переименовать, переместить или удалить группу", "aria-label": "Настроить группу", onclick: (e) => { e.preventDefault(); groupEditor(g.id, redraw); } }, icon("more", { sw: 3 }))),
          list.length ? rows(list) : h("p.muted.small", null, "В группе пока пусто. Нажмите «⋯» у закладки и выберите эту группу."));
      }),
      gs.length && loose.length ? h("div.label", null, "Без группы") : null,
      loose.length ? rows(loose) : null,
      all.length ? null : h("p.muted", null, "Закладок пока нет. Откройте суру в разделе «Мой Коран», нажмите на экран и выберите вверху «Закладка здесь». Или нажмите на слово и удерживайте — закладка встанет точно на этот аят."),
      all.length > 1 ? h("p.muted.small", null, "Чтобы поменять порядок, потяните закладку за точки слева вверх или вниз.") : null,
      h("button.btn.secondary", { type: "button", onclick: () => groupEditor(null, redraw) }, "Новая группа"),
    ].filter(Boolean));
  };
  draw();
  return wrap;
}

/** Окно со списком закладок — для режима чтения, чтобы не выходить из него. */
export function marksSheet() {
  modal((close) => h("div.read-menu", null, h("h2", null, "Мои закладки"), marksList({ onOpen: close })), { cls: "sheet" });
}

// ---------- Цель чтения: обратный отсчёт страниц ----------
export const readGoal = () => store.get().readGoal || null;
const goalRead = (gl, page) => Math.max(0, Math.min(gl.pages, page - gl.from));
export const goalLeft = () => { const gl = readGoal(); return gl ? gl.pages - (gl.read || 0) : 0; };

/** Цель закладки выполнена: закладка переезжает на начало страницы p (после конца Корана — в его начало). Возвращает новую страницу. */
async function advanceMark(id, p) {
  const part = p > PAGES ? null : (await pageContent(p).catch(() => []))[0];
  const to = part ? { s: part.s, a: part.from, p } : p > PAGES ? { s: 1, a: 1, p: 1 } : null;
  if (!to || !marks().some((m) => m.id === id)) return 0;
  store.set((st) => { Object.assign(st.marks.find((m) => m.id === id), to, { at: Date.now() }); });
  return to.p;
}

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
      if (done) {
        confetti();
        readGoalDone();
        const msg = `Цель выполнена: прочитано ${gl.pages} ${pagesWord(gl.pages)}. Да примет Аллах ваше чтение!`;
        if (gl.mark) advanceMark(gl.mark, gl.from + gl.pages).then((p) => toast(msg + (p ? ` Закладка переехала на страницу ${p}.` : ""), 6500));
        else toast(msg, 5200);
        onDone?.();
      }
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
      h("p.muted.small", null, "Чтобы цель включалась сама каждый раз, задайте её у закладки: кнопка «⋯» в списке закладок."),
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
    left ? null : h("p.muted", null, gl.from + gl.pages > PAGES ? "Завтра цель начнётся заново — с начала Корана." : `Завтра цель начнётся заново: ${gl.pages} ${pagesWord(gl.pages)} со страницы ${gl.from + gl.pages}. То, что прочитано сегодня сверх цели, в неё не входит.`),
    h("div.row.gap.wrap", null,
      left ? h("button.btn.primary", { type: "button", onclick: () => openRead(gl.s, gl.a) }, "Продолжить чтение", icon("right", { size: 18 })) : null,
      h("button.btn.secondary", { type: "button", onclick: () => goalModal(here, redraw) }, left ? "Изменить" : "Новая цель")));
}

// ---------- Страница «Закладки» ----------
export async function BookmarksView() {
  await loadSurahs();
  await rollGoal();
  const body = h("div.bm-body");
  const draw = () => body.replaceChildren(
    goalCard(draw),
    h("h3.bm-h", null, "Мои закладки"),
    marksList({ onChange: draw }));
  draw();
  return h("div.page.bookmarks", null,
    h("header.page-head", null, h("h1", null, "Закладки"), h("p.muted", null, "Сохранённые места в Коране — с названиями, группами и своей целью — и обратный отсчёт страниц. Место, где вы остановились, запоминается само — оно в разделе «Мой Коран».")),
    body);
}
