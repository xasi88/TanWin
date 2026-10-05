// Проверка отдельного приложения «Мой Коран» (/quran/): свой манифест, только чтение и закладки, чужие разделы ведут к списку сур,
// данные общие с TanWin, окно про обновления показывается один раз. Нужен сервер на 8765.
// Запуск:  node tools/audit/quran-app-check.mjs [адрес] [папка для снимков]
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:8765";
const SHOTS = process.argv[3] || "";
// без признака «управляется роботом»: окно про обновления роботам не показывается
const browser = await chromium.launch({ args: ["--disable-blink-features=AutomationControlled"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
await ctx.route(/mc\.yandex|everyayah|qurancdn/, (r) => r.abort());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(m.text()); });
const fails = [];
const ok = (name, cond, got) => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : " — " + JSON.stringify(got)}`); if (!cond) fails.push(name); };
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png` }); };
const text = () => page.evaluate(() => document.body.innerText);

// 1. чистое устройство: «Мой Коран» открывается без знакомства с курсом
await page.goto(`${BASE}/quran/?install=1`);
await page.waitForSelector(".surah-row");
await page.waitForTimeout(600);
ok("открылся список сур, а не знакомство", (await page.evaluate(() => location.hash)) === "#/quran", await page.evaluate(() => location.hash));
ok("манифест свой", (await page.evaluate(() => document.querySelector("link[rel=manifest]").href)).endsWith("/quran/manifest.webmanifest"));
const man = await (await page.request.get(`${BASE}/quran/manifest.webmanifest`)).json();
ok("в манифесте своё название и адрес запуска", man.short_name === "Мой Коран" && man.start_url === "./?src=app" && man.scope === "./", man);
for (const i of man.icons) ok(`значок ${i.src} на месте`, (await page.request.get(new URL(i.src, `${BASE}/quran/`).href)).ok());
ok("окно «Приложение обновляется само» показано", await page.locator(".upd-note").isVisible());
await shot("1-update-note");
await page.locator(".upd-note .btn").click();
await page.waitForTimeout(400);
ok("карточка установки есть", (await text()).includes("Установите «Мой Коран» отдельным приложением"));
ok("в карточке сказано про общие данные", (await text()).includes("Закладки, цели и место чтения общие с TanWin"));
ok("в меню только «Мой Коран» и «Закладки»", (await page.locator("#nav .tab").allInnerTexts()).join("|") === "Мой Коран|Закладки", await page.locator("#nav .tab").allInnerTexts());
await shot("2-home");
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await page.waitForTimeout(300);
ok("внизу — версия, проверка обновления и ссылка на TanWin", await page.locator(".q-foot").isVisible() && (await page.locator(".q-foot").innerText()).includes("Проверить обновление"));
await shot("3-foot");

// 2. разделы TanWin в «Моём Коране» недоступны
for (const p of ["/", "/more", "/review", "/learn/1.1", "/welcome"]) {
  await page.evaluate((x) => { location.hash = "#" + x; }, p);
  await page.waitForTimeout(400);
  ok(`адрес ${p} ведёт к списку сур`, (await page.evaluate(() => location.hash)) === "#/quran", await page.evaluate(() => location.hash));
}

// 3. чтение работает: текст суры загружается из корня сайта
await page.evaluate(() => { location.hash = "#/read/112"; });
await page.waitForSelector(".focus .ayah-mark", { state: "attached" });
ok("сура открылась для чтения", (await page.locator(".focus .ayah-mark").count()) === 4);
await page.mouse.click(6, 400);
await page.waitForTimeout(300);
await shot("4-read");
await page.locator(".fm-tile", { hasText: "Закладка здесь" }).click();
await page.waitForTimeout(600);
await page.keyboard.press("Escape");
await page.evaluate(() => { location.hash = "#/bookmarks"; });
await page.waitForTimeout(700);
ok("закладки открываются", (await page.evaluate(() => location.hash)) === "#/bookmarks");
await shot("5-bookmarks");
await page.evaluate(() => { location.hash = "#/changelog"; });
await page.waitForTimeout(600);
ok("в «Версиях» есть «Проверить обновление» и возврат в «Мой Коран»", (await text()).includes("Проверить обновление") && (await page.locator("a.back").getAttribute("href")) === "#/quran");

// 4. TanWin на том же устройстве: закладка видна, окно про обновления второй раз не показывается, есть ссылка на «Мой Коран»
await page.goto(`${BASE}/#/welcome`);
await page.waitForTimeout(1200);
await page.evaluate(async () => { const { store } = await import("/js/store.js"); store.set((st) => { st.profile.onboarded = true; }); });
ok("закладка из «Моего Корана» есть в TanWin", (await page.evaluate(async () => (await import("/js/store.js")).store.get().marks?.length)) === 1);
await page.goto(`${BASE}/#/more`);
await page.waitForSelector(".more-link");
await page.waitForTimeout(500);
ok("окно про обновления второй раз не показано", !(await page.locator(".upd-note").count()));
ok("в «Ещё» есть «Установить „Мой Коран“ отдельно»", (await page.locator('a.more-link[href="quran/?install=1"]').count()) === 1);
ok("в «Ещё» есть проверка обновления", (await text()).includes("Обновления приходят сами"));
await page.locator('a.more-link[href="quran/?install=1"]').scrollIntoViewIfNeeded();
await shot("6-more");
ok("в меню TanWin все разделы на месте", (await page.locator("#nav .tab").count()) === 6);

ok("ошибок на страницах нет", !errors.length, errors);
await browser.close();
process.exit(fails.length ? 1 : 0);
