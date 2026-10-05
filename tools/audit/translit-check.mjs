// Проверка настройки «Транскрипция»: в карточках теории транскрипция видна сразу, по нажатию или скрыта — как выбрано в «Ещё»;
// у тех, кто настройку не трогал (старые данные), и у новых учеников она видна сразу. Сервер не нужен: проверка поднимает свой.
// Запуск:  node tools/audit/translit-check.mjs [адрес]
import { chromium } from "playwright";
import { serve } from "./serve.mjs";
const own = process.argv[2] ? null : await serve();
const BASE = process.argv[2] || own.base;
const b = await chromium.launch();
const errors = [], fails = [];
const ok = (name, cond, got) => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : " — " + JSON.stringify(got)}`); if (!cond) fails.push(name); };
async function session(settings) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: "block" });
  await ctx.route(/mc\.yandex|everyayah|qurancdn/, (r) => r.abort());
  await ctx.addInitScript((st) => { if (!localStorage.getItem("tanwin.v2")) localStorage.setItem("tanwin.v2", JSON.stringify({ profile: { onboarded: true, name: "Тест" }, settings: st })); localStorage.setItem("tanwin.updNote", "1"); }, settings);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, p };
}
const WORDS = ".lp-stage .words-row .word-chip";
/** Открывает урок 6.1: его первая карточка теории — слова Корана с транскрипцией. */
async function card(p) {
  if (p.url() === "about:blank") { await p.goto(BASE + "/#/review"); await p.waitForSelector("#nav .tab"); }
  else { await p.evaluate(() => { location.hash = "#/review"; }); await p.waitForTimeout(400); }
  await p.evaluate(() => { location.hash = "#/learn/6.1"; });
  await p.waitForSelector(WORDS);
  return { n: await p.locator(WORDS).count(), shown: await p.locator(WORDS + " .tr:not(.hid)").count(), hidden: await p.locator(WORDS + " .tr.hid").count() };
}
const more = async (p) => { await p.evaluate(() => { location.hash = "#/more"; }); await p.waitForSelector(".more-link"); };

// 1. старые данные: в настройке у всех стояло «По нажатию», и она ни на что не действовала
let { ctx, p } = await session({ sfx: false, unlockAll: true, translit: "tap" });
let c = await card(p);
ok("старые данные: транскрипция в карточке теории видна сразу, как раньше", c.n > 0 && c.shown === c.n, c);
await more(p);
ok("в «Ещё» выбрано «Показывать»", await p.evaluate(() => [...document.querySelectorAll(".seg-btn")].find((x) => x.textContent === "Показывать")?.classList.contains("on")) === true);

// 2. ученик выбирает «По нажатию»
await p.locator(".seg-btn", { hasText: "По нажатию" }).click(); await p.waitForTimeout(200);
c = await card(p);
ok("«По нажатию»: транскрипция скрыта", c.n > 0 && c.shown === 0 && c.hidden === c.n, c);
await p.locator(WORDS).first().click(); await p.waitForTimeout(300);
ok("нажали на слово — его транскрипция появилась", (await p.locator(WORDS + " .tr:not(.hid)").count()) === 1);
await p.reload(); await p.waitForSelector(WORDS);
ok("после перезапуска выбор «По нажатию» сохранился", (await p.evaluate(() => JSON.parse(localStorage.getItem("tanwin.v2")).settings.translit)) === "tap");

// 3. «Скрыть»
await more(p);
await p.locator(".seg-btn", { hasText: "Скрыть" }).click(); await p.waitForTimeout(200);
c = await card(p);
ok("«Скрыть»: транскрипции под словами нет совсем", c.n > 0 && c.shown === 0 && c.hidden === 0, c);
await p.locator(WORDS).first().click(); await p.waitForTimeout(300);
ok("нажатие на слово транскрипцию не показывает", (await p.locator(WORDS + " .tr").count()) === 0);
await ctx.close();

// 4. новый ученик
({ ctx, p } = await session({ sfx: false, unlockAll: true }));
c = await card(p);
ok("новый ученик: транскрипция видна сразу", c.n > 0 && c.shown === c.n, c);
await ctx.close();

ok("ошибок на страницах нет", !errors.length, errors);
await b.close();
console.log(fails.length ? `Не прошло: ${fails.length}` : "Настройка «Транскрипция» работает.");
own?.stop();
process.exit(fails.length ? 1 : 0);
