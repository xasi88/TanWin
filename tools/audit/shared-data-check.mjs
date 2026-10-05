// Проверка общих данных: приложение открыто в двух окнах (две вкладки или вкладка и установленное приложение), оба пишут
// в одно хранилище — никто не стирает чужую работу. Закладка из окна чтения переживает сохранение в первом окне, урок из первого —
// чтение во втором; настройки доходят до второго окна без перезапуска; сброс прогресса доходит до обоих. Нужен сервер на 8765.
// Запуск:  node tools/audit/shared-data-check.mjs [адрес]
import { chromium } from "playwright";

const BASE = process.argv[2] || "http://localhost:8765";
const browser = await chromium.launch();
// одно хранилище на оба окна — как у двух вкладок одного браузера
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: "block" });
await ctx.route(/mc\.yandex|everyayah|qurancdn|verses\.quran/, (r) => r.abort());
const errors = [];
const fails = [];
const ok = (name, cond, got) => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : " — " + JSON.stringify(got)}`); if (!cond) fails.push(name); };
const open = async (url) => { const p = await ctx.newPage(); p.on("pageerror", (e) => errors.push(String(e))); await p.goto(url); return p; };
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("tanwin.v2") || "{}")); // что лежит в хранилище
const memory = (page) => page.evaluate(async () => JSON.parse(JSON.stringify((await import("/js/store.js")).store.get()))); // что окно держит в памяти
const SWITCH = '.switch[aria-label="Звуки ответов"]'; // любая настройка на экране «Ещё»: её нажатие — обычное сохранение

// первое окно открыто на экране «Ещё»
const tanwin = await open(`${BASE}/#/welcome`);
await tanwin.waitForTimeout(1500);
await tanwin.evaluate(async () => {
  const { store } = await import("/js/store.js");
  store.set((st) => { st.profile.onboarded = true; });
  localStorage.setItem("tanwin.updNote", "1"); localStorage.setItem("tanwin.readHint", "1");
});
await tanwin.evaluate(() => { location.hash = "#/more"; });
await tanwin.waitForSelector(SWITCH);

// 1. во втором окне читают Коран и ставят закладку; затем первое окно сохраняет настройку
const quran = await open(`${BASE}/#/read/78`);
await quran.waitForSelector(".focus .page-mark", { state: "attached" });
await quran.waitForTimeout(700);
await quran.mouse.click(6, 400); // край экрана: показать панели
await quran.waitForTimeout(400);
await quran.locator(".fm-tile", { hasText: "Закладка здесь" }).click();
await quran.locator(".mark-edit .btn.primary").click(); // «Готово»
await quran.waitForTimeout(400);
/** Окно чтения сохраняет место чтения: листаем текст, пока аят у верха экрана не сменится (в конце текста — возвращаемся к началу). */
async function quranSaves() {
  const before = (await memory(quran)).reading?.at || 0;
  for (let i = 0; i < 8; i++) {
    await quran.evaluate(() => { const sc = document.querySelector(".focus-scroll"); sc.scrollTop = sc.scrollTop + 500 > sc.scrollHeight - sc.clientHeight ? 0 : sc.scrollTop + 500; });
    await quran.waitForTimeout(600);
    if (((await memory(quran)).reading?.at || 0) !== before) return;
  }
  throw new Error("окно чтения не сохранило место чтения — проверять нечего");
}
ok("закладка из окна чтения записана", (await saved(quran)).marks?.length === 1, (await saved(quran)).marks);
await tanwin.locator(SWITCH).click();
await tanwin.waitForTimeout(300);
let st = await saved(tanwin);
ok("первое окно сохранило настройку — закладка из окна чтения на месте", st.marks?.length === 1 && st.settings.sfx === false, { marks: st.marks?.length, sfx: st.settings?.sfx });
ok("первое окно видит эту закладку без перезапуска", (await memory(tanwin)).marks.length === 1, (await memory(tanwin)).marks);
ok("окно чтения видит настройку из первого окна без перезапуска", (await memory(quran)).settings.sfx === false, (await memory(quran)).settings);

// 2. в первом окне пройден урок; затем во втором листают текст (место чтения сохраняется при прокрутке)
await tanwin.evaluate(async () => { (await import("/js/store.js")).finishLesson("1.1", { pct: 100, ms: 60000, answers: 10, correct: 10 }); });
await quranSaves();
st = await saved(quran);
ok("место чтения из второго окна записано", st.reading?.s === 78, st.reading);
ok("чтение во втором окне не стёрло урок из первого", !!st.lessons?.["1.1"]?.done, Object.keys(st.lessons || {}));
await tanwin.locator(SWITCH).click();
await tanwin.waitForTimeout(300);
st = await saved(tanwin);
ok("первое окно не стёрло место чтения и закладку", st.reading?.s === 78 && st.marks?.length === 1 && !!st.lessons?.["1.1"], { reading: st.reading, marks: st.marks?.length });

// 3. ответ в уроке записывается сразу, а не ждёт конца урока — иначе его стёрло бы чужое сохранение
await tanwin.evaluate(async () => { const s = await import("/js/store.js"); s.srsSeen("L:ba", true); s.hardSeen("002_255_001", false); });
st = await saved(tanwin);
ok("ответ в уроке записан сразу", !!st.srs?.["L:ba"] && !!st.hard?.["002_255_001"], { srs: Object.keys(st.srs || {}), hard: Object.keys(st.hard || {}) });
await quranSaves();
st = await saved(quran);
ok("чтение во втором окне не стёрло ответы урока", !!st.srs?.["L:ba"] && !!st.hard?.["002_255_001"], { srs: Object.keys(st.srs || {}) });

// 4. размер арабского текста, выбранный в одном окне, сразу действует в другом
await tanwin.evaluate(async () => { (await import("/js/store.js")).store.set((s) => { s.settings.arScale = 1.5; }); });
await quran.waitForTimeout(400);
const arK = await quran.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ar-k").trim());
ok("размер текста из первого окна сразу действует во втором", +arK === 1.5, arK);

// 4а. окно «спало» и пропустило событие о чужой записи (запись идёт мимо событий — прямо в хранилище из того же окна):
// перед своим сохранением оно всё равно берёт то, что лежит в хранилище
await tanwin.evaluate(() => { const s = JSON.parse(localStorage.getItem("tanwin.v2")); s.marks.push({ id: "slept", s: 36, a: 1, p: 440, at: Date.now() }); localStorage.setItem("tanwin.v2", JSON.stringify(s)); });
await tanwin.locator(SWITCH).click();
await tanwin.waitForTimeout(300);
st = await saved(tanwin);
ok("окно, пропустившее чужую запись, не стёрло её своим сохранением", st.marks?.some((m) => m.id === "slept") && st.marks.length === 2, st.marks?.map((m) => m.id));
await tanwin.evaluate(async () => { (await import("/js/store.js")).store.set((s) => { s.marks = s.marks.filter((m) => m.id !== "slept"); }); });

// 5. хранилище очистили, пока приложение открыто: в памяти — единственная копия, следующее сохранение возвращает её
await quran.evaluate(() => localStorage.removeItem("tanwin.v2"));
await tanwin.locator(SWITCH).click();
await tanwin.waitForTimeout(300);
st = await saved(tanwin);
ok("после очистки хранилища открытое приложение записало всё заново", !!st.lessons?.["1.1"] && st.marks?.length === 1 && st.reading?.s === 78, { lessons: Object.keys(st.lessons || {}), marks: st.marks?.length });

// 6. сброс прогресса в первом окне доходит до второго: его следующее сохранение не возвращает старое
await tanwin.evaluate(async () => { (await import("/js/store.js")).store.reset(); });
await quran.waitForTimeout(300);
await quranSaves();
st = await saved(quran);
ok("после сброса в первом окне второе не вернуло старые закладки и уроки", !(st.marks || []).length && !Object.keys(st.lessons || {}).length, { marks: st.marks?.length, lessons: Object.keys(st.lessons || {}) });

ok("ошибок на страницах нет", !errors.length, errors);
await browser.close();
console.log(fails.length ? `Не прошло: ${fails.length}` : "Общие данные в сохранности.");
process.exit(fails.length ? 1 : 0);
