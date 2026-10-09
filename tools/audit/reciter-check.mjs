// Проверка чтеца на экране чтения: нажатие на номер аята читает подряд с него; после остановки плитка в меню
// продолжает с того же аята; дослушали до конца — отметка снимается. Нужен интернет (аудио) и сервер на 8765.
// Запуск:  node tools/audit/reciter-check.mjs
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:8765";
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const fails = [];
const ok = (name, cond, got) => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : " — " + JSON.stringify(got)}`); if (!cond) fails.push(name); };
const selA = () => page.evaluate(() => +document.querySelector(".focus .sel")?.closest("[data-a]")?.dataset.a || +document.querySelector(".focus .sel")?.dataset.a || 0);
const goTile = () => page.evaluate(() => document.querySelector(".fm-go span").textContent);
const openMenu = async () => { if (await page.evaluate(() => document.querySelector(".focus").classList.contains("quiet"))) await page.mouse.click(6, 400); await page.waitForTimeout(300); }; // край экрана: ни номеров аятов, ни кнопок в конце текста

await page.goto(`${BASE}/#/welcome`);
await page.waitForTimeout(1500);
await page.evaluate(async () => { const { store } = await import("/js/store.js"); store.set((st) => { st.profile.onboarded = true; }); try { localStorage.setItem("tanwin.ayahHint2", "1"); } catch {} });
await page.goto(`${BASE}/#/read/112`); // Аль-Ихляс: четыре коротких аята
await page.waitForSelector(".focus .ayah-mark", { state: "attached" });
await page.waitForTimeout(800);

await openMenu();
ok("пока ничего не слушали — «Слушать суру»", (await goTile()) === "Слушать суру", await goTile());
await page.mouse.click(6, 400); // панели убираем
await page.locator(".focus .ayah-mark").nth(2).click(); // номер 3-го аята
await page.waitForFunction(() => document.querySelector(".focus .sel"), null, { timeout: 15000 });
ok("нажали на номер 3 — чтец на аяте 3", (await selA()) === 3, await selA());
await page.waitForFunction(() => { const e = document.querySelector(".focus .sel"); return +(e?.dataset.a || e?.closest("[data-a]")?.dataset.a) === 4; }, null, { timeout: 40000 }).catch(() => {});
ok("после аята 3 чтец сам перешёл на аят 4", (await selA()) === 4, await selA());

await openMenu();
ok("чтец звучит — в меню «Остановить чтеца»", (await goTile()) === "Остановить чтеца", await goTile());
await page.locator(".fm-go").click();
await page.waitForTimeout(500);
ok("остановили — «Продолжить с аята 4»", (await goTile()) === "Продолжить с аята 4", await goTile());
await page.locator(".fm-go").click();
await page.waitForTimeout(1500);
await openMenu();
ok("продолжил с аята 4, а не с начала", (await selA()) === 4 && (await goTile()) === "Остановить чтеца", [await selA(), await goTile()]);
await page.waitForFunction(() => !document.querySelector(".focus .sel"), null, { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(500);
await openMenu();
ok("дослушали до конца — отметка снята, снова «Слушать суру»", (await selA()) === 0 && (await goTile()) === "Слушать суру", [await selA(), await goTile()]);

// длинный аят (2:282 выше экрана): начало встаёт у верха, дальше текст идёт за словом, которое звучит
await page.goto(`${BASE}/#/read/2/282`);
await page.waitForSelector('.focus [data-s="2"] [data-a="282"] .ayah-mark, .focus [data-a="282"] .ayah-mark', { state: "attached" });
await page.waitForTimeout(1500);
await page.evaluate(() => document.querySelector('.focus [data-a="282"] .ayah-mark').click());
await page.waitForFunction(() => document.querySelector('.focus [data-a="282"] .qw.now'), null, { timeout: 20000 }).catch(() => {});
const long = () => page.evaluate(() => {
  const sc = document.querySelector(".focus-scroll"), top = sc.getBoundingClientRect().top, el = document.querySelector('.focus [data-a="282"]'), w = el.querySelector(".qw.now");
  return { first: Math.round(el.querySelector(".qw").getBoundingClientRect().top - top), now: w ? Math.round(w.getBoundingClientRect().bottom - top) : null, h: sc.clientHeight };
});
let at = await long();
ok("длинный аят: начало у верха экрана", at.first > 0 && at.first < at.h * 0.2, at);
await page.waitForFunction(() => document.querySelector('.focus [data-a="282"] .qw').getBoundingClientRect().top < 0, null, { timeout: 150000 }).catch(() => {});
await page.waitForTimeout(1500);
at = await long();
ok("длинный аят: текст ушёл вверх за чтецом, слово на виду", at.first < 0 && at.now > 0 && at.now < at.h * 0.7, at);

ok("ошибок на странице нет", !errors.length, errors);
await browser.close();
process.exit(fails.length ? 1 : 0);
