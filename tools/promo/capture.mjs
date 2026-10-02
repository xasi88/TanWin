// Снимки экранов приложения для рекламного ролика: tools/promo/shots/*.png (390×844, ×3).
//   node tools/promo/capture.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, extname, normalize } from "node:path";
import { chromium } from "../audit/node_modules/playwright/index.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const OUT = fileURLToPath(new URL("./shots", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^[\\/]+/, "");
  if (!path || path === ".") path = "index.html";
  try { const body = await readFile(join(root, path)); res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); } catch { res.writeHead(404); res.end(); }
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, serviceWorkers: "block", colorScheme: "light" });
await ctx.route(/qurancdn|everyayah|mp3/, (r) => r.abort());
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, "standalone", { get: () => true }); // как установленное приложение
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  const day = (back) => { const d = new Date(Date.now() - back * 86400000); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const st = { profile: { onboarded: true, name: "Амина", goal: 30, created: Date.now() - 86400000 * 12 }, settings: { theme: "light", sfx: false, translit: "show" }, lessons: {}, days: {}, streak: { cur: 7, best: 7, last: day(0) } };
  for (const id of ["1.1", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "3.1", "3.2"]) st.lessons[id] = { done: true, stars: 3, best: 96, n: 1, at: Date.now() - 86400000 * 2 };
  [45, 60, 38, 72, 50, 64, 41, 0, 35, 55, 0, 30].forEach((xp, i) => { if (xp) st.days[day(i)] = xp; });
  st.xp = 1234; st.stats = { answers: 300, correct: 276, ms: 3 * 3600000, lessons: 12 };
  localStorage.setItem("tanwin.v2", JSON.stringify(st));
});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("JS:", e.message));
const go = async (hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(1600); await page.evaluate(() => document.fonts.ready); };
const shot = async (name) => {
  await page.evaluate(() => document.querySelector(".fb-tab, .feedback-tab, [class*=feedback]")?.remove()); // ярлычок «написать автору» в кадре не нужен
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(OUT, name + ".png") }); console.log(name);
};
const next = () => page.evaluate(() => (document.querySelector(".lp-sheet.show .btn.primary") || document.querySelector(".lp-stage .btn.next"))?.click());

await page.goto(`${BASE}/#/`);
await page.waitForTimeout(1800);
await shot("home");
await go("/letters"); await shot("letters");
await go("/progress"); await shot("progress");

// Сура с подсветкой звучащего слова — как при прослушивании чтеца
await go("/quran/112");
for (let i = 0; i < 4; i++) {
  await page.evaluate((i) => {
    document.querySelectorAll(".qw.now").forEach((x) => x.classList.remove("now"));
    const ws = [...document.querySelectorAll(".qw")];
    ws[i]?.classList.add("now"); ws[i]?.closest(".ayah")?.classList.add("cur");
  }, i);
  await shot("quran-" + i);
}

// Урок: карточка новой буквы, затем вопрос до ответа и после верного ответа
await go("/learn/2.5");
for (let i = 0; i < 3; i++) { await next(); await page.waitForTimeout(700); }
await shot("letter");
await go("/");
await go("/learn/2.3");
let card = true, quiz = false;
for (let i = 0; i < 60 && !(card && quiz); i++) {
  const st = await page.evaluate(() => ({ opts: document.querySelectorAll(".lp-stage .opt:not([disabled])").length, card: !!document.querySelector(".lc-glyph"), sheet: !!document.querySelector(".lp-sheet.show"), result: !!document.querySelector(".lp-content.result") }));
  if (st.result) break;
  if (st.card && !card) { await shot("letter"); card = true; }
  if (st.opts && !st.sheet && !quiz) {
    await shot("quiz-a");
    await page.evaluate(() => document.querySelector(".lp-stage .opt:not([disabled])").click());
    await page.waitForTimeout(900);
    if (await page.evaluate(() => !!document.querySelector(".lp-sheet.ok"))) { await shot("quiz-b"); quiz = true; }
  } else if (st.opts && !st.sheet) await page.evaluate(() => document.querySelector(".lp-stage .opt:not([disabled])").click());
  await page.waitForTimeout(300);
  await next();
  await page.waitForTimeout(700);
}
console.log({ card, quiz });
await browser.close();
server.close();
