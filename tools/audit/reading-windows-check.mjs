// Проверка окон поверх чтения: Esc и выход из полного экрана закрывают только открытое окно или панель «Aa», а не чтение;
// «Подробно о правилах» не оставляет окно висеть; выключатель «Перевод смыслов» действует в чтении; в сообщение разработчику
// попадают сура и аят при любом виде чтения. Сервер не нужен: проверка поднимает свой.
// Запуск:  node tools/audit/reading-windows-check.mjs [адрес]
import { chromium } from "playwright";
import { serve } from "./serve.mjs";
const own = process.argv[2] ? null : await serve();
const BASE = process.argv[2] || own.base;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" });
await ctx.route(/mc\.yandex|everyayah|qurancdn/, (r) => r.abort());
await ctx.addInitScript(() => {
  if (!localStorage.getItem("tanwin.v2")) localStorage.setItem("tanwin.v2", JSON.stringify({ profile: { onboarded: true, name: "Тест" }, settings: { sfx: false }, marks: [{ id: "a1", s: 78, a: 1, p: 582, at: Date.now() }, { id: "seq1", s: 67, a: 1, p: 562, at: Date.now(), plan: { k: "seq", unit: "p", n: 2 } }] }));
  for (const k of ["tanwin.updNote", "tanwin.readHint", "tanwin.ayahHint2"]) localStorage.setItem(k, "1");
});
const p = await ctx.newPage();
const errors = [], fails = [];
p.on("pageerror", (e) => errors.push(String(e)));
const hash = () => p.evaluate(() => location.hash);
const modals = () => p.locator("#modal-root .modal-wrap:not(.out)").count();
const ok = (name, cond, got) => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : " — " + JSON.stringify(got)}`); if (!cond) fails.push(name); };
const open = async (h) => { await p.goto(BASE + "/#/review"); await p.goto(BASE + "/" + h); await p.waitForSelector(".focus .ayah-mark", { state: "attached" }); await p.waitForTimeout(500); };
const reveal = async () => { if (await p.locator(".focus.quiet").count()) await p.mouse.click(6, 400); await p.waitForTimeout(350); };
const tile = (t) => p.locator(".fm-tile", { hasText: t }).first();

// А. окно закладок + Esc
await open("#/read/78");
await reveal();
await tile("Закладки").click(); await p.waitForTimeout(300);
ok("окно закладок открылось", (await modals()) === 1);
await p.keyboard.press("Escape"); await p.waitForTimeout(400);
ok("Esc закрыл окно закладок, чтение осталось", (await modals()) === 0 && (await hash()) === "#/read/78", await hash());
// Б. цвета таджвида + Esc
await tile("Цвета таджвида").click(); await p.waitForTimeout(300);
await p.keyboard.press("Escape"); await p.waitForTimeout(400);
ok("Esc закрыл окно цветов, чтение осталось", (await modals()) === 0 && (await hash()) === "#/read/78", await hash());
// В. панель «Aa» + Esc
await p.locator(".focus-bar .size-btn").click(); await p.waitForTimeout(250);
ok("панель «Aa» открылась", (await p.locator(".size-pop").count()) === 1);
await p.keyboard.press("Escape"); await p.waitForTimeout(400);
ok("Esc закрыл панель «Aa», чтение осталось", (await p.locator(".size-pop").count()) === 0 && (await hash()) === "#/read/78", await hash());
// Г. карточка слова + Esc
await p.mouse.click(6, 400); await p.waitForTimeout(300); // спрятать панели
const w = await p.locator(".focus .qw").nth(3).boundingBox();
await p.mouse.move(w.x + w.width / 2, w.y + w.height / 2); await p.mouse.down(); await p.waitForTimeout(750); await p.mouse.up(); await p.waitForTimeout(400);
ok("карточка слова открылась", (await p.locator(".word-pop").count()) === 1);
await p.keyboard.press("Escape"); await p.waitForTimeout(400);
ok("Esc закрыл карточку слова, чтение осталось", (await modals()) === 0 && (await hash()) === "#/read/78", await hash());
// Е. полный экран: браузер вышел из него (Esc или «назад») при открытом окне
await reveal();
await p.evaluate(() => document.documentElement.requestFullscreen().catch(() => {}));
await tile("Закладки").click(); await p.waitForTimeout(400);
ok("полный экран включён, окно закладок открыто", (await p.evaluate(() => !!document.fullscreenElement)) && (await modals()) === 1);
await p.evaluate(() => document.exitFullscreen());
await p.waitForTimeout(600);
ok("выход из полного экрана при открытом окне закрыл только окно", (await modals()) === 0 && (await hash()) === "#/read/78", { modals: await modals(), hash: await hash() });
// Ж. без окон Esc закрывает чтение
await p.keyboard.press("Escape"); await p.waitForTimeout(600);
ok("Esc без окон закрывает чтение", (await hash()) === "#/quran", await hash());

// 4. «Подробно о правилах» — окно не остаётся висеть
await open("#/read/78");
await reveal();
await tile("Цвета таджвида").click(); await p.waitForTimeout(300);
await p.locator(".legend a.btn").click(); await p.waitForTimeout(700);
ok("«Подробно о правилах» открыл справочник, окно закрылось", (await hash()) === "#/rules" && (await modals()) === 0, { hash: await hash(), modals: await modals() });

// 5. «Перевод смыслов»
await open("#/read/112");
await reveal();
await tile("По аятам").click(); await p.waitForTimeout(500);
ok("перевод включён: в виде «По аятам» он есть, плитка «По аятам, с переводом»", (await p.locator(".focus .translation").count()) === 4 && (await tile("По аятам").innerText()).includes("с переводом"), await tile("По аятам").innerText());
await p.evaluate(async () => { (await import("/js/store.js")).store.set((s) => { s.settings.translation = false; }); });
await open("#/read/112");
ok("перевод выключен в «Ещё»: в чтении его нет", (await p.locator(".focus .translation").count()) === 0 && (await p.locator(".focus .ayah-mark").count()) === 4, await p.locator(".focus .translation").count());
await reveal();
ok("плитка называется «По аятам»", (await tile("По аятам").innerText()).trim() === "По аятам", await tile("По аятам").innerText());
await p.evaluate(async () => { (await import("/js/store.js")).store.set((s) => { s.settings.translation = true; }); });

// 7. «Написать разработчику» — место при чтении джуза и цели закладки
for (const [h, name] of [["#/juz/30", "джуз"], ["#/mark/seq1", "цель закладки"], ["#/read/78", "сура"], ["#/page/582", "страница"]]) {
  await p.goto(BASE + "/#/review"); await p.goto(BASE + "/" + h); await p.waitForSelector(".focus .ayah-mark, .focus .page-mark", { state: "attached" }); await p.waitForTimeout(900);
  const text = await p.evaluate(async () => { const m = await import("/js/feedback.js"); m.openFeedback(); await new Promise((r) => setTimeout(r, 300)); return document.querySelector("#modal-root .modal")?.innerText || ""; });
  const line = text.split("\n").find((l) => /сура \d+, аят/.test(l)) || text.replace(/\n+/g, " | ").slice(0, 200);
  ok(`место в сообщении (${name})`, /сура \d+, аят \d+/.test(line), line);
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
}
ok("ошибок на страницах нет", !errors.length, errors);
await b.close();
console.log(fails.length ? `Не прошло: ${fails.length}` : "Окна поверх чтения в порядке.");
own?.stop();
process.exit(fails.length ? 1 : 0);
