// Проверка учёта чтения: страница засчитывается при переходе на следующую и после 40 с на странице,
// один раз за день; место чтения сохраняется; выполненная цель на следующий день начинается заново.
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
  store.set((st) => { st.profile.onboarded = true; st.readGoal = { from: 40, pages: 2, read: 2, s: 2, a: 250, at: y, done: y }; });
}, yesterday);

// 1. переход на следующую страницу засчитывает предыдущую; место чтения сохраняется
await page.goto(`${BASE}/#/read/78`);
await page.reload();
await page.waitForSelector(".focus .page-mark", { state: "attached" });
await page.waitForTimeout(800);
let st = await state();
ok("цель вчерашнего дня началась заново с места по плану", st.readGoal.from === 42 && st.readGoal.read === 0 && !st.readGoal.done, st.readGoal);
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

ok("ошибок JavaScript нет", !errors.length, errors);
await browser.close();
console.log(fails.length ? `Не прошло: ${fails.length}` : "Учёт чтения работает.");
process.exit(fails.length ? 1 : 0);
