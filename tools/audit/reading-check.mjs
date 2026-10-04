// Проверка учёта чтения: страница засчитывается при переходе на следующую и после 40 с на странице,
// один раз за день; место чтения сохраняется; старая цель чтения переезжает в закладку; цель закладки выполняется кнопкой «Я прочитал».
// Запуск (нужен сервер на 8765: python -m http.server 8765):  node tools/audit/reading-check.mjs
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:8765";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
await ctx.route(/qurancdn|everyayah|verses\.quran|mp3/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") console.log("консоль:", m.text().slice(0, 200)); });
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("tanwin.v2")));
const today = (st) => Object.entries(st.qread.days).sort().pop()?.[1];
const fails = [];
const ok = (name, cond, got) => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : " — " + JSON.stringify(got)}`); if (!cond) fails.push(name); };

await page.goto(`${BASE}/#/welcome`);
await page.waitForTimeout(1500);
const yesterday = Date.now() - 26 * 3600e3;
await page.evaluate(async (y) => {
  const { store } = await import("/js/store.js"); // чистый профиль ещё не записан в хранилище — пишем через само приложение
  store.set((st) => { st.profile.onboarded = true; });
  // данные «как в версии 1.17»: общая цель чтения (2 страницы, одна прочитана) и закладка со своей целью
  const st = JSON.parse(localStorage.getItem("tanwin.v2"));
  st.readGoal = { from: 40, pages: 2, read: 1, s: 2, a: 257, at: y, done: 0 };
  st.marks = [{ id: "old1", s: 67, a: 1, p: 562, at: y, name: "Вечером", goal: 3 }];
  localStorage.setItem("tanwin.v2", JSON.stringify(st));
}, yesterday);

// 1. переход на следующую страницу засчитывает предыдущую; место чтения сохраняется
await page.goto(`${BASE}/?run=1#/read/78`);
await page.waitForSelector(".focus .page-mark", { state: "attached" }).catch(async (e) => { console.log("экран:", await page.evaluate(() => location.hash + " | " + document.querySelector("#view").innerText.slice(0, 200))); throw e; });
await page.waitForTimeout(800);
let st = await state();
ok("старая общая цель стала закладкой с целью", !st.readGoal && st.marks.some((m) => m.name === "Цель чтения" && m.plan?.k === "seq" && m.plan.n === 2 && m.s === 2 && m.a === 257), st.marks);
ok("цель старой закладки сохранилась", st.marks.find((m) => m.id === "old1")?.plan?.n === 3 && !("goal" in st.marks.find((m) => m.id === "old1")), st.marks);
await page.evaluate(() => { const sc = document.querySelector(".focus-scroll"), m = document.querySelectorAll(".page-mark")[1]; sc.scrollTop += m.getBoundingClientRect().top - 300; });
await page.waitForTimeout(900);
st = await state();
ok("страница 582 засчитана при переходе на 583", today(st)?.pages === 1 && today(st)?.pp?.includes(582), today(st));
ok("место чтения сохранено", st.reading?.s === 78 && st.reading.mode === "surah" && st.reading.a > 1, st.reading);

// 2. та же страница второй раз за день не считается — и после перезапуска тоже
await page.reload();
await page.waitForSelector(".focus .page-mark", { state: "attached" });
await page.evaluate(() => { const sc = document.querySelector(".focus-scroll"), m = document.querySelectorAll(".page-mark")[1]; sc.scrollTop = 0; setTimeout(() => { sc.scrollTop += m.getBoundingClientRect().top - 300; }, 500); });
await page.waitForTimeout(1600);
ok("повторно страница не считается", today(await state())?.pages === 1, today(await state()));

// 3. отдельная страница засчитывается после 40 с чтения
await page.goto(`${BASE}/#/page/100`);
await page.waitForSelector(".focus .qw");
for (let i = 0; i < 10; i++) { await page.mouse.move(100 + i, 300); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(5000); }
st = await state();
ok("разрозненная страница 100 засчитана по времени", today(st)?.pp?.includes(100) && today(st).pages === 2, today(st));
ok("время чтения идёт в прогресс", today(st)?.ms >= 30000, today(st));

// 4. закладка с целью «повторять отрывок»: на экране только отрывок, «Я прочитал» выполняет цель
await page.evaluate(async () => {
  const { store } = await import("/js/store.js");
  store.set((s) => { s.marks.unshift({ id: "rep1", s: 2, a: 285, p: null, at: Date.now(), name: "Конец Аль-Бакара", plan: { k: "rep", items: [{ s: 2, from: 285, to: 286 }], days: null } }); });
});
await page.goto(`${BASE}/?run=2#/mark/rep1`);
await page.waitForSelector(".focus-end .btn.primary", { state: "attached" });
ok("в отрывке ровно два аята", await page.evaluate(() => [...document.querySelectorAll(".focus-part [data-a]")].map((e) => e.dataset.a).join()) === "285,286");
await page.evaluate(() => document.querySelector(".focus-end .btn.primary").click());
await page.waitForTimeout(600);
st = await state();
ok("«Я прочитал» выполняет цель закладки", !!st.marks.find((m) => m.id === "rep1").done && st.qread.goals === 1, st.marks[0]);

// 5. цель «по порядку»: 3 страницы от закладки; после «Я прочитал» закладка переезжает, «Читать дальше» — и она идёт следом
await page.goto(`${BASE}/?run=3#/mark/old1`);
await page.waitForSelector(".focus-end .btn.primary", { state: "attached" });
const pagesShown = await page.evaluate(() => [...new Set([...document.querySelectorAll(".focus-part [data-p]")].map((e) => e.dataset.p))].join());
ok("на экране три страницы от закладки", pagesShown === "562,563,564", pagesShown);
await page.evaluate(() => document.querySelector(".focus-end .btn.primary").click());
await page.waitForTimeout(800);
st = await state();
const old1 = () => st.marks.find((m) => m.id === "old1");
ok("закладка переехала за прочитанное", old1().done && old1().s === 68 && old1().a === 17 && old1().p === 565, old1()); // страница 564 кончается на 68:16
await page.evaluate(() => [...document.querySelectorAll(".focus-end .btn")].find((b) => /Читать дальше/.test(b.textContent)).click());
await page.waitForTimeout(2500);
await page.evaluate(() => { const sc = document.querySelector(".focus-scroll"); sc.scrollTop += 1500; });
await page.waitForTimeout(900);
st = await state();
ok("при чтении дальше закладка идёт следом", old1().s > 68 || old1().a > 17, old1());

ok("ошибок JavaScript нет", !errors.length, errors);
await browser.close();
console.log(fails.length ? `Не прошло: ${fails.length}` : "Учёт чтения работает.");
process.exit(fails.length ? 1 : 0);
