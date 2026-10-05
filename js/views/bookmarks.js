// Закладки и их цели: сохранённые места в Коране (с названиями и группами). У закладки может быть цель —
// читать по порядку (столько-то страниц или аятов в день) или повторять отрывок (суру, аяты, свой набор).
import { h, icon, modal, toast, plural, confirmBox, keep } from "../ui.js";
import { loadSurahs, surahMeta } from "../data.js";
import { store } from "../store.js";
import { go } from "../app.js";
import { track } from "../metrika.js";
import { enterFullscreen } from "../fullscreen.js";
import { pageContent, PAGES, JUZ_PAGE } from "./quran.js";

const MAX_MARKS = 100;
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
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
// ---------- Цель закладки ----------
// mark.plan — что читать:
//   { k: "seq", unit: "p" | "a", n }             — по порядку: n страниц или аятов в день; закладка идёт вперёд
//   { k: "rep", items: [{ s, from, to }], days } — повторять отрывок (сура, аяты, свой набор); days — дни недели (0 — вс) или null = каждый день
// mark.done — когда цель выполнена в последний раз; mark.cur = { s, a } — где остановились, не дочитав сегодняшнее.
// Цель считается только тогда, когда чтение открыто через эту закладку (экран #/mark/ID в views/quran.js).
const sameDay = (t) => new Date(t).toDateString() === new Date().toDateString();
const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"], WEEK = [1, 2, 3, 4, 5, 6, 0];
export const doneToday = (m) => !!m.done && sameDay(m.done);
export const dueToday = (m) => !!m.plan && (m.plan.k !== "rep" || !m.plan.days || m.plan.days.includes(new Date().getDay()));
const itemText = (x) => {
  const sm = surahMeta(x.s), name = sm?.ru || `Сура ${x.s}`;
  return x.from <= 1 && sm && x.to >= sm.verses ? `сура ${name}` : x.from === x.to ? `${name}, аят ${x.from}` : `${name}, аяты ${x.from}–${x.to}`;
};
/** Цель словами: «по 2 страницы в день», «сура Аль-Мульк · каждый день», «Аль-Бакара, аяты 285–286 · пт». */
export function planText(pl) {
  if (!pl) return "";
  if (pl.k === "seq") return `по ${pl.n} ${pl.unit === "p" ? plural(pl.n, "странице", "страницы", "страниц") : plural(pl.n, "аяту", "аята", "аятов")} в день`;
  const what = pl.items.length === 1 ? itemText(pl.items[0]) : `${pl.items.length} ${plural(pl.items.length, "отрывок", "отрывка", "отрывков")}`;
  return `${what} · ${pl.days ? WEEK.filter((d) => pl.days.includes(d)).map((d) => WD[d]).join(", ") : "каждый день"}`;
}
/** Изменить закладку. */
export const setMark = (id, fn) => store.set((st) => { const m = (st.marks || []).find((x) => x.id === id); if (m) fn(m); });
/** Открыть закладку: с целью — экран цели (только то, что нужно прочесть сегодня), без цели — чтение с этого места. */
function openMark(m) {
  if (!m.plan) return openRead(m.s, m.a);
  enterFullscreen();
  const hash = `#/mark/${m.id}`;
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent("hashchange")); else go(hash.slice(1));
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
  track("bookmark_added");
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

/** Настройки закладки: название, группа, цель, удаление. fresh — закладку только что поставили. */
export function markEditor(id, { fresh = false, onChange } = {}) {
  const m = marks().find((x) => x.id === id);
  if (!m) return;
  modal((close) => {
    let g = groups().some((x) => x.id === m.g) ? m.g : "";
    const name = h("input.text-in", { type: "text", maxlength: 60, value: m.name || "", placeholder: "Например: «Каждый вечер» или «В пятницу»", "aria-label": "Название закладки" });
    const ng = h("input.text-in", { type: "text", maxlength: 40, hidden: true, placeholder: "Название новой группы", "aria-label": "Название новой группы" });
    const chips = h("div.rm-row");
    const drawChips = () => chips.replaceChildren(...[{ id: "", name: "Без группы" }, ...groups(), { id: "+", name: "+ Новая группа" }].map((x) =>
      h("button.seg-btn", { type: "button", class: x.id === g ? "on" : "", onclick: () => { g = x.id; ng.hidden = g !== "+"; drawChips(); if (g === "+") ng.focus(); } }, keep(x.name))));
    drawChips();

    // --- цель ---
    const verses = (s) => surahMeta(s)?.verses || 1;
    let kind = m.plan?.k || "", unit = m.plan?.unit || "p";
    let items = m.plan?.k === "rep" ? m.plan.items.map((x) => ({ ...x })) : [{ s: m.s, from: 1, to: verses(m.s) }];
    let days = m.plan?.k === "rep" && m.plan.days ? new Set(m.plan.days) : null;
    const num = (value, max, label) => h("input.text-in.num-in", { type: "number", min: 1, max, value, inputmode: "numeric", "aria-label": label });
    const nIn = num(m.plan?.k === "seq" ? m.plan.n : 2, PAGES, "Сколько в день");
    const kindRow = h("div.rm-row"), box = h("div.plan-box");
    const seg = (list, cur, pick) => list.map(([k, t]) => h("button.seg-btn", { type: "button", class: k === cur ? "on" : "", onclick: () => pick(k) }, t));
    const pFrom = num(m.p || 1, PAGES, "С какой страницы"), pTo = num(m.p || 1, PAGES, "По какую страницу");
    const addPages = async () => {
      const a = Math.round(+pFrom.value), b = Math.round(+pTo.value);
      if (!(a >= 1 && b >= a && b <= PAGES)) return toast(`Страницы — от 1 до ${PAGES}, «с» не больше «по».`);
      if (b - a > 40) return toast("За один раз — не больше 40 страниц.");
      const add = [];
      for (let p = a; p <= b; p++) for (const part of await pageContent(p).catch(() => [])) {
        const last = add[add.length - 1];
        if (last && last.s === part.s && last.to + 1 === part.from) last.to = part.to; else add.push({ s: part.s, from: part.from, to: part.to });
      }
      if (!add.length) return toast("Не удалось загрузить страницы. Проверьте интернет.");
      items = [...items, ...add].slice(0, 40);
      draw();
    };
    const itemRow = (x, i) => {
      const sel = h("select.text-in", { "aria-label": "Сура" }, ...Array.from({ length: 114 }, (_, k) => h("option", { value: k + 1, selected: k + 1 === x.s }, keep(`${k + 1}. ${surahMeta(k + 1)?.ru || ""}`))));
      const from = num(x.from, verses(x.s), "С какого аята"), to = num(x.to, verses(x.s), "По какой аят");
      sel.addEventListener("change", () => { x.s = +sel.value; x.from = 1; x.to = verses(x.s); draw(); });
      from.addEventListener("change", () => { x.from = Math.min(verses(x.s), Math.max(1, Math.round(+from.value) || 1)); if (x.to < x.from) x.to = x.from; draw(); });
      to.addEventListener("change", () => { x.to = Math.min(verses(x.s), Math.max(x.from, Math.round(+to.value) || x.from)); draw(); });
      return h("div.plan-item", null, sel, h("label", null, "с аята", from), h("label", null, "по", to),
        items.length > 1 ? h("button.icon-btn", { type: "button", "aria-label": "Убрать отрывок", title: "Убрать", onclick: () => { items.splice(i, 1); draw(); } }, icon("trash", { size: 18 })) : null);
    };
    const draw = () => {
      kindRow.replaceChildren(...seg([["", "Без цели"], ["seq", "Читать по порядку"], ["rep", "Повторять отрывок"]], kind, (k) => { kind = k; draw(); }));
      if (kind === "seq") box.replaceChildren(
        h("div.plan-seq", null, nIn, h("div.rm-row", null, ...seg([["p", "страниц в день"], ["a", "аятов в день"]], unit, (k) => { unit = k; draw(); }))),
        h("p.muted.small", null, "Откроете закладку — на экране будет ровно столько, сколько нужно прочесть сегодня. В конце нажмите «Я прочитал» — и можно читать дальше: назавтра закладка будет ждать там, где вы остановитесь."));
      else if (kind === "rep") box.replaceChildren(
        h("div.label", null, "Что читать"),
        ...items.map(itemRow),
        h("p.muted.small", null, "Вся сура — аяты с первого по последний. Чтобы читать только часть, поменяйте номера аятов."),
        h("button.btn.ghost.small-btn", { type: "button", onclick: () => { const lastS = items[items.length - 1]?.s || m.s; const s = Math.min(114, lastS + 1); items.push({ s, from: 1, to: verses(s) }); draw(); } }, "+ Ещё сура или отрывок"),
        h("div.plan-pages", null, h("span", null, "Или страницы: с"), pFrom, h("span", null, "по"), pTo, h("button.btn.ghost.small-btn", { type: "button", onclick: addPages }, "Добавить")),
        h("div.label", null, "Когда"),
        h("div.rm-row", null,
          h("button.seg-btn", { type: "button", class: days ? "" : "on", onclick: () => { days = null; draw(); } }, "Каждый день"),
          ...WEEK.map((d) => h("button.seg-btn", { type: "button", class: days?.has(d) ? "on" : "", onclick: () => { days = days || new Set(); if (days.has(d)) days.delete(d); else days.add(d); if (!days.size || days.size === 7) days = null; draw(); } }, WD[d]))),
        h("p.muted.small", null, "Откроете закладку — на экране будет только этот отрывок. Место закладки не меняется: в следующий раз вы прочтёте его снова."));
      else box.replaceChildren();
    };
    draw();

    const save = () => {
      const gid = g === "+" ? (ng.value.trim() ? addGroup(ng.value.trim()) : "") : g;
      const plan = kind === "seq" ? { k: "seq", unit, n: Math.max(1, Math.min(unit === "p" ? PAGES : 300, Math.round(+nIn.value) || 1)) }
        : kind === "rep" ? { k: "rep", items: items.map((x) => ({ s: x.s, from: x.from, to: x.to })), days: days ? [...days] : null } : null;
      const changed = JSON.stringify(plan) !== JSON.stringify(m.plan || null);
      setMark(id, (x) => {
        Object.assign(x, { name: name.value.trim(), g: gid });
        if (!changed) return;
        if (plan) x.plan = plan; else delete x.plan;
        delete x.done; delete x.cur; // новая цель — новый отсчёт
        if (plan?.k === "rep") Object.assign(x, { s: plan.items[0].s, a: plan.items[0].from, p: null }); // закладка стоит на начале отрывка
      });
      close(); onChange?.();
    };
    for (const inp of [name, ng]) inp.addEventListener("keydown", (e) => e.key === "Enter" && save());
    return h("div.mark-edit", null,
      h("h2", null, fresh ? "Закладка поставлена ✓" : "Закладка"),
      h("p.muted", null, placeText(m.s, m.a, m.p)),
      h("div.label", null, "Название — если нужно"), name,
      h("div.label", null, "Группа"), chips, ng,
      h("div.label", null, "Цель"), kindRow, box,
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
      if (g) store.set((st) => { const x = st.markGroups.find((y) => y.id === id); if (x) x.name = t; }); else addGroup(t); // группу могли удалить в другом окне
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
    const rep = m.plan?.k === "rep"; // у отрывка для повтора место — сам отрывок
    const status = !m.plan ? null : doneToday(m) ? "сегодня выполнено ✓" : dueToday(m) ? "ждёт сегодня" : null;
    const sub = [m.name && !rep ? ayahText(m.s, m.a) : null, m.p && !rep ? `стр. ${m.p}` : null, !m.name && m.p && !rep ? `джуз ${juzOf(m.p)}` : null, m.plan ? `цель: ${rep && !m.name ? planText(m.plan).split(" · ").slice(1).join(" · ") : planText(m.plan)}` : dateRu(m.at), status].filter(Boolean).join(" · ");
    const r = h("div.mark-row", { "data-id": m.id },
      h("button.mark-open", { type: "button", onclick: () => { onOpen?.(); openMark(m); } },
        h("span.rc-ic", { class: m.plan && doneToday(m) ? "done" : "" }, icon(m.plan ? (doneToday(m) ? "check" : "target") : "bookmark", m.plan ? { size: 22, sw: doneToday(m) ? 3 : 2 } : { size: 22, fill: true, sw: 1 })),
        h("div", null, h("b", null, keep(m.name || (rep ? planText(m.plan).split(" · ")[0] : ayahText(m.s, m.a)))), h("small.muted", null, sub))),
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
      all.length ? null : h("p.muted", null, "Закладок пока нет. Откройте суру в разделе «Мой Коран», нажмите на экран и выберите вверху «Закладка здесь». Или нажмите на слово и удерживайте — закладка встанет точно на этот аят. Закладке можно задать цель: например, две страницы в день или сура Аль-Мульк каждый вечер."),
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

// ---------- Страница «Закладки» ----------
export async function BookmarksView() {
  await loadSurahs();
  const body = h("div.bm-body");
  const draw = () => body.replaceChildren(marksList({ onChange: draw }));
  draw();
  return h("div.page.bookmarks", null,
    h("header.page-head", null, h("h1", null, "Закладки"), h("p.muted", null, "Сохранённые места в Коране — с названиями, группами и целями: читать по порядку или повторять суру и отдельные аяты. Цель считается, когда вы открываете чтение через её закладку.")),
    body);
}
