// Проверка порядка закладок: ручка есть у каждой закладки; закладку можно перетащить внутри списка, в другую группу,
// в пустую группу и в «Без группы» — мышью, пальцем и стрелками на клавиатуре; свёрнутая группа пропускается;
// порядок и группы сохраняются. То же в окне закладок поверх чтения. Сервер не нужен: проверка поднимает свой.
// Запуск:  node tools/audit/bookmark-drag-check.mjs [адрес]
import { chromium } from "playwright";
import { serve } from "./serve.mjs";

const own = process.argv[2] ? null : await serve();
const BASE = process.argv[2] || own.base;
const now = Date.now();
const STATE = () => ({
  profile: { onboarded: true, name: "Тест" }, settings: { sfx: false },
  markGroups: [{ id: "gA", name: "Каждый день" }, { id: "gB", name: "Пятница" }, { id: "gC", name: "Пустая" }, { id: "gD", name: "Свёрнутая", closed: true }],
  marks: [
    { id: "a1", s: 2, a: 255, p: 42, at: now, g: "gA", name: "Аят аль-Курси" },
    { id: "a2", s: 67, a: 1, p: 562, at: now, g: "gA", name: "Аль-Мульк" },
    { id: "b1", s: 18, a: 1, p: 293, at: now, g: "gB", name: "Аль-Кахф" },
    { id: "d1", s: 36, a: 1, p: 440, at: now, g: "gD", name: "Йа Син" },
    { id: "l1", s: 55, a: 1, p: 531, at: now, name: "Ар-Рахман" },
  ],
});
const browser = await chromium.launch();
const errors = [], fails = [];
const ok = (name, cond, got) => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : " — " + JSON.stringify(got)}`); if (!cond) fails.push(name); };

async function open(state, { touch = false, hash = "#/bookmarks" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1400 }, hasTouch: touch, serviceWorkers: "block" });
  await ctx.route(/mc\.yandex|everyayah|qurancdn/, (r) => r.abort());
  await ctx.addInitScript((st) => { if (!localStorage.getItem("tanwin.v2")) localStorage.setItem("tanwin.v2", JSON.stringify(st)); for (const k of ["tanwin.updNote", "tanwin.readHint", "tanwin.ayahHint2"]) localStorage.setItem(k, "1"); }, state);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + "/" + hash);
  return { ctx, page };
}
/** Что записано: «группа: закладки по порядку». */
const saved = (page) => page.evaluate(() => {
  const st = JSON.parse(localStorage.getItem("tanwin.v2")), out = {};
  for (const m of st.marks) (out[m.g || "-"] ||= []).push(m.id);
  return Object.entries(out).map(([g, l]) => `${g}: ${l.join(" ")}`).sort().join(" | ");
});
const center = async (page, sel) => { const r = await page.locator(sel).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; };
const grip = (id) => `.mark-row[data-id="${id}"] .mark-grip`;
/** Куда вести закладку: к середине другой закладки (чуть выше или ниже неё) или к заголовку/блоку. */
const targetY = (page, sel, dy) => page.evaluate(([s, d]) => { const r = document.querySelector(s).getBoundingClientRect(); return r.top + r.height / 2 + d; }, [sel, dy]);
/** Тянет закладку мышью: маленькими шагами, цель пересчитывается на ходу — строки под указателем сдвигаются. */
async function drag(page, id, sel, dy = 0) {
  const from = await center(page, grip(id));
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  let y = from.y;
  for (let i = 0; i < 400; i++) {
    const to = await targetY(page, sel, dy);
    if (Math.abs(to - y) < 4) break;
    y += Math.sign(to - y) * Math.min(12, Math.abs(to - y));
    await page.mouse.move(from.x, y);
  }
  await page.mouse.up(); await page.waitForTimeout(150);
}
/** То же пальцем: настоящие касания через DevTools, как на планшете. */
async function touchDrag(page, id, sel, dy = 0) {
  const cdp = await page.context().newCDPSession(page);
  const from = await center(page, grip(id));
  const send = (type, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x: Math.round(from.x), y: Math.round(y), id: 1 }] });
  await send("touchStart", from.y);
  let y = from.y;
  for (let i = 0; i < 400; i++) {
    const to = await targetY(page, sel, dy);
    if (Math.abs(to - y) < 4) break;
    y += Math.sign(to - y) * Math.min(12, Math.abs(to - y));
    await send("touchMove", y);
  }
  await send("touchEnd", y); await page.waitForTimeout(200);
}
const rowSel = (id) => `.mark-row[data-id="${id}"]`;

// ---------- Мышь ----------
let { ctx, page } = await open(STATE());
await page.waitForSelector(".mark-row");
ok("ручка есть у каждой закладки на экране", (await page.locator(".mark-row:visible .mark-grip").count()) === 4 && (await page.locator(".mark-row:visible").count()) === 4, await page.locator(".mark-row:visible .mark-grip").count());
ok("сначала записано как задано", (await saved(page)) === "-: l1 | gA: a1 a2 | gB: b1 | gD: d1", await saved(page));

await drag(page, "a1", rowSel("a2"), 14);
ok("внутри группы: первая закладка встала под вторую", (await saved(page)) === "-: l1 | gA: a2 a1 | gB: b1 | gD: d1", await saved(page));

await drag(page, "l1", rowSel("b1"), -14);
ok("из «Без группы» — в группу, над её закладкой", (await saved(page)) === "gA: a2 a1 | gB: l1 b1 | gD: d1", await saved(page));
ok("счётчик группы обновился", (await page.locator(".mark-group", { hasText: "Пятница" }).locator(".mg-count").innerText()) === "2");
ok("пустой блок «Без группы» спрятан", !(await page.locator(".mark-loose").isVisible()));

await drag(page, "b1", rowSel("a1"), 14);
ok("из группы в группу: в конец соседней", (await saved(page)) === "gA: a2 a1 b1 | gB: l1 | gD: d1", await saved(page));

await drag(page, "a2", ".mark-list[data-g=\"gC\"] + .mark-empty", 0);
ok("в пустую группу", (await saved(page)) === "gA: a1 b1 | gB: l1 | gC: a2 | gD: d1", await saved(page));
ok("подсказка «В группе пока пусто» исчезла", !(await page.locator(".mark-list[data-g=\"gC\"] + .mark-empty").isVisible()));

// вниз мимо свёрнутой группы — в «Без группы»; блок появляется, пока закладку тянут
const from = await center(page, grip("l1"));
await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x, from.y + 6);
ok("пока закладку тянут, блок «Без группы» виден", await page.locator(".mark-loose").isVisible());
await page.mouse.up(); await page.waitForTimeout(100);
await drag(page, "l1", ".mark-loose .mark-list", 10);
ok("в «Без группы», свёрнутая группа пропущена", (await saved(page)) === "-: l1 | gA: a1 b1 | gC: a2 | gD: d1", await saved(page));

// ---------- Клавиатура ----------
await page.locator(grip("l1")).focus();
await page.keyboard.press("ArrowUp");
ok("стрелка вверх у первой в списке — в конец списка выше", (await saved(page)) === "gA: a1 b1 | gC: a2 l1 | gD: d1", await saved(page));
ok("ручка осталась выбранной", await page.evaluate(() => document.activeElement?.classList.contains("mark-grip") && document.activeElement.closest(".mark-row").dataset.id === "l1"));
await page.keyboard.press("ArrowUp"); await page.keyboard.press("ArrowUp");
ok("ещё две стрелки вверх — над соседкой и в пустую группу выше", (await saved(page)) === "gA: a1 b1 | gB: l1 | gC: a2 | gD: d1", await saved(page));
await page.keyboard.press("ArrowDown");
ok("стрелка вниз у последней — в начало списка ниже", (await saved(page)) === "gA: a1 b1 | gC: l1 a2 | gD: d1", await saved(page));

// ---------- После перезапуска ----------
await page.reload(); await page.waitForSelector(".mark-row");
const shown = await page.evaluate(() => [...document.querySelectorAll(".mark-list")].map((b) => `${b.dataset.g || "-"}: ${[...b.children].map((r) => r.dataset.id).join(" ")}`).join(" | "));
ok("после перезапуска на экране тот же порядок", shown === "gA: a1 b1 | gB:  | gC: l1 a2 | gD: d1 | -: ", shown);
await ctx.close();

// ---------- Палец ----------
({ ctx, page } = await open(STATE(), { touch: true }));
await page.waitForSelector(".mark-row");
await touchDrag(page, "a1", rowSel("a2"), 14);
ok("пальцем внутри группы", (await saved(page)) === "-: l1 | gA: a2 a1 | gB: b1 | gD: d1", await saved(page));
await touchDrag(page, "a1", rowSel("b1"), 14);
ok("пальцем из группы в группу", (await saved(page)) === "-: l1 | gA: a2 | gB: b1 a1 | gD: d1", await saved(page));
await touchDrag(page, "l1", rowSel("a2"), -14);
ok("пальцем из «Без группы» через все группы наверх", (await saved(page)) === "gA: l1 a2 | gB: b1 a1 | gD: d1", await saved(page));
await ctx.close();

// ---------- Окно закладок поверх чтения ----------
({ ctx, page } = await open(STATE(), { hash: "#/read/112" }));
await page.waitForSelector(".focus .ayah-mark", { state: "attached" });
await page.waitForTimeout(500);
if (await page.locator(".focus.quiet").count()) await page.mouse.click(6, 400);
await page.locator(".fm-tile", { hasText: "Закладки" }).first().click();
await page.waitForSelector(".modal .mark-row");
await page.waitForTimeout(450); // окно выезжает снизу — ждём, пока встанет на место
ok("в окне закладок ручка у каждой", (await page.locator(".modal .mark-row:visible .mark-grip").count()) === 4);
await drag(page, "l1", `.modal ${rowSel("b1")}`, -14);
ok("в окне закладок: из «Без группы» в группу", (await saved(page)) === "gA: a1 a2 | gB: l1 b1 | gD: d1", await saved(page));
ok("чтение при этом не закрылось", (await page.evaluate(() => location.hash)) === "#/read/112");
await ctx.close();

// ---------- Когда ручки нет ----------
({ ctx, page } = await open({ ...STATE(), markGroups: [], marks: [{ id: "one", s: 1, a: 1, p: 1, at: now }] }));
await page.waitForSelector(".mark-row");
ok("одна закладка и ни одной группы — двигать некуда, ручки нет", (await page.locator(".mark-grip").count()) === 0);
await ctx.close();
({ ctx, page } = await open({ ...STATE(), markGroups: [{ id: "gA", name: "Группа" }], marks: [{ id: "one", s: 1, a: 1, p: 1, at: now }] }));
await page.waitForSelector(".mark-row");
ok("одна закладка и группа — ручка есть", (await page.locator(".mark-grip").count()) === 1);
await drag(page, "one", ".mark-group .mark-empty", 0);
ok("единственную закладку можно перенести в группу", (await saved(page)) === "gA: one", await saved(page));
await ctx.close();

ok("ошибок на страницах нет", !errors.length, errors);
await browser.close();
own?.stop();
console.log(fails.length ? `Не прошло: ${fails.length}` : "Порядок закладок работает.");
process.exit(fails.length ? 1 : 0);
