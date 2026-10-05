// Проверка запуска и оболочки: новичку открывается знакомство; старый адрес отдельного «Моего Корана» (/quran/) открывает
// раздел «Мой Коран» в TanWin; окно про обновления показывается один раз; меню, чтение, закладки и проверка обновления на месте.
// Сервер не нужен: проверка поднимает свой.
// Запуск:  node tools/audit/start-check.mjs [адрес] [папка для снимков]
import { chromium } from "playwright";
import { serve } from "./serve.mjs";

const own = process.argv[2] ? null : await serve();
const BASE = process.argv[2] || own.base;
const SHOTS = process.argv[3] || "";
// без признака «управляется роботом»: окно про обновления роботам не показывается
const browser = await chromium.launch({ args: ["--disable-blink-features=AutomationControlled"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: "block" });
await ctx.route(/mc\.yandex|everyayah|qurancdn/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(m.text()); });
const fails = [];
const ok = (name, cond, got) => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : " — " + JSON.stringify(got)}`); if (!cond) fails.push(name); };
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png` }); };
const text = () => page.evaluate(() => document.body.innerText);
const where = () => page.evaluate(() => location.pathname + location.hash);

// 1. чистое устройство: по любому адресу — знакомство
await page.goto(`${BASE}/quran/`);
await page.waitForSelector(".ob-skip");
ok("новичку открывается знакомство", (await where()) === "/#/welcome", await where());
ok("на знакомстве окно про обновления не показано", !(await page.locator(".upd-note").count()));

// 2. ученик открывает старый адрес отдельного «Моего Корана»
await page.evaluate(async () => { const { store } = await import("/js/store.js"); store.set((st) => { st.profile.onboarded = true; }); });
await page.goto(`${BASE}/quran/`);
await page.waitForSelector(".surah-row");
await page.waitForTimeout(600);
ok("старый адрес /quran/ открыл список сур в TanWin", (await where()) === "/#/quran", await where());
ok("окно «Приложение обновляется само» показано", await page.locator(".upd-note").isVisible());
await shot("1-update-note");
await page.locator(".upd-note .btn").click();
await page.waitForTimeout(400);
ok("в меню TanWin все разделы на месте", (await page.locator("#nav .tab").count()) === 6);
await shot("2-quran");

// 3. чтение и закладка
await page.evaluate(() => { location.hash = "#/read/112"; });
await page.waitForSelector(".focus .ayah-mark", { state: "attached" });
ok("сура открылась для чтения", (await page.locator(".focus .ayah-mark").count()) === 4);
await page.mouse.click(6, 400);
await page.waitForTimeout(300);
await shot("3-read");
await page.locator(".fm-tile", { hasText: "Закладка здесь" }).click();
await page.waitForTimeout(600);
await page.locator(".mark-edit .btn.primary").click(); // «Готово»
await page.waitForTimeout(400);
ok("закладка, поставленная при чтении, сохранилась", (await page.evaluate(async () => (await import("/js/store.js")).store.get().marks?.length)) === 1);
await page.evaluate(() => { location.hash = "#/bookmarks"; });
await page.waitForTimeout(700);
ok("закладки открываются", (await where()) === "/#/bookmarks" && (await page.locator(".mark-row").count()) === 1, await where());
await shot("4-bookmarks");

// 4. проверка обновления: «Версии» и «Ещё»; окно про обновления второй раз не показывается
await page.evaluate(() => { location.hash = "#/changelog"; });
await page.waitForTimeout(600);
ok("в «Версиях» есть «Проверить обновление» и возврат в «Ещё»", (await text()).includes("Проверить обновление") && (await page.locator("a.back").getAttribute("href")) === "#/more");
await page.goto(`${BASE}/#/more`);
await page.waitForSelector(".more-link");
await page.waitForTimeout(500);
ok("окно про обновления второй раз не показано", !(await page.locator(".upd-note").count()));
ok("в «Ещё» есть проверка обновления", (await text()).includes("Обновления приходят сами"));
ok("в «Ещё» нет установки отдельного «Моего Корана»", !(await page.locator('a[href^="quran/"]').count()));
await shot("5-more");

ok("ошибок на страницах нет", !errors.length, errors);
await browser.close();
console.log(fails.length ? `Не прошло: ${fails.length}` : "Запуск и оболочка в порядке.");
own?.stop();
process.exit(fails.length ? 1 : 0);
