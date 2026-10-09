// Проверка «Пути»: открыт всегда один этап; после перезапуска открыт этап урока, который открывали последним.
// Нужен сервер на 8765. Запуск:  node tools/audit/path-check.mjs
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:8765";
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const fails = [];
const ok = (name, cond, got) => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : " — " + JSON.stringify(got)}`); if (!cond) fails.push(name); };
const openUnits = () => page.evaluate(() => [...document.querySelectorAll(".unit.open")].map((x) => x.id));

await page.goto(`${BASE}/#/welcome`);
await page.waitForTimeout(1500);
// ученик прошёл этапы 1–3 и стоит на этапе 4
await page.evaluate(async () => {
  const { store } = await import("/js/store.js");
  const { UNITS } = await import("/js/course.js");
  store.set((st) => { st.profile.onboarded = true; st.profile.created = Date.now(); st.settings.sfx = false; for (const u of UNITS.slice(0, 3)) for (const l of u.lessons) st.lessons[l.id] = { done: Date.now(), stars: 3, at: Date.now() }; });
  localStorage.removeItem("tanwin.lastOpen");
});
await page.goto(`${BASE}/#/`);
await page.reload();
await page.waitForSelector(".unit");
await page.waitForTimeout(600);
ok("никакой урок ещё не открывали — открыт этап следующего шага", JSON.stringify(await openUnits()) === '["unit-4"]', await openUnits());

await page.locator("#unit-2 .uh-toggle").click();
ok("открыли этап 2 — этап 4 закрылся", JSON.stringify(await openUnits()) === '["unit-2"]', await openUnits());
await page.locator("#unit-2 .uh-toggle").click();
ok("нажали на открытый этап — он свернулся", (await openUnits()).length === 0, await openUnits());

// заходим в урок этапа 2 и выходим из приложения
const id = await page.evaluate(async () => (await import("/js/course.js")).UNITS[1].lessons[1].id);
await page.goto(`${BASE}/#/learn/${id}`);
await page.waitForSelector(".lesson-root");
await page.waitForTimeout(500);
await page.goto(`${BASE}/#/`);
await page.reload();
await page.waitForSelector(".unit");
await page.waitForTimeout(800);
ok("после перезапуска открыт этап урока, который открывали последним", JSON.stringify(await openUnits()) === '["unit-2"]', await openUnits());
const seen = await page.evaluate((id) => { const r = document.querySelector(`.node[data-lesson="${id}"]`).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }, id);
ok("этот урок виден на экране", seen);
ok("ошибок на странице нет", !errors.length, errors);
await browser.close();
process.exit(fails.length ? 1 : 0);
