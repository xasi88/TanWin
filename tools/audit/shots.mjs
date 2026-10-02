// Снимки экранов для просмотра глазами (огласовки, знаки, вёрстка):
//   node tools/audit/shots.mjs "/learn/4.5:1" "/learn/8.5:0" "/quran/1:0" [--font amiri] [--width 390] [--theme dark] [--form ty]
// «адрес:N» — открыть адрес и N раз нажать «Далее». Снимки — в tools/audit/shots/.
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, extname, normalize } from "node:path";
import { chromium } from "playwright";

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : d; };
const targets = argv.filter((a, i) => !a.startsWith("--") && !(argv[i - 1] || "").startsWith("--"));
const width = +opt("width", 390), font = opt("font", ""), theme = opt("theme", "light"), form = opt("form", "vy"), html = opt("html", "");
const root = fileURLToPath(new URL("../..", import.meta.url));
const OUT = fileURLToPath(new URL("./shots", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  if (!path || path === ".") path = "index.html";
  try { const body = await readFile(join(root, path)); res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); } catch { res.writeHead(404); res.end(); }
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block", colorScheme: theme });
await ctx.route(/qurancdn|everyayah|mp3/, (r) => r.abort());
await ctx.addInitScript(([font, theme, form]) => {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.setItem("tanwin.v2", JSON.stringify({ profile: { onboarded: true, name: "Хаси", goal: 30, form, created: Date.now() }, settings: { theme, unlockAll: true, sfx: false, translit: "show", ...(font ? { arFont: font } : {}) }, lessons: {}, srs: {}, xp: 0 }));
}, [font, theme, form]);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("JS:", e.message));
await page.goto(`${BASE}/#/`);
await page.waitForTimeout(1200);
if (html) { // произвольная разметка поверх приложения (таблицы знаков и шрифтов)
  await page.evaluate((h) => { const d = document.createElement("div"); d.style.cssText = "position:absolute;left:0;top:0;width:100%;min-height:100%;z-index:99999;background:#fff;color:#000;padding:8px;box-sizing:border-box"; d.innerHTML = h; document.body.append(d); }, await readFile(html, "utf8"));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/sheet${font ? "-" + font : ""}.png`, fullPage: true });
}
for (const t of targets) {
  const [hash, n = "0"] = t.split(":");
  await page.evaluate((h) => { location.hash = h; }, hash);
  await page.waitForTimeout(1400);
  for (let i = 0; i < +n; i++) { await page.evaluate(() => (document.querySelector(".lp-sheet.show .btn.primary") || document.querySelector(".lp-stage .btn.next"))?.click()); await page.waitForTimeout(600); }
  await page.waitForFunction(() => document.fonts.status === "loaded", null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  const el = await page.$(".lp-stage .lp-content, .page, .onboard");
  const file = `${OUT}/${hash.replace(/[^\w.]+/g, "_")}-${n}${font ? "-" + font : ""}${theme === "dark" ? "-dark" : ""}${form === "ty" ? "-ty" : ""}-${width}.png`;
  // длинные карточки — целиком
  await page.evaluate(() => { const s = document.querySelector(".lp-stage"); if (s) { s.style.overflow = "visible"; s.style.height = "auto"; document.querySelector(".lesson").style.height = "auto"; } });
  if (el) await el.screenshot({ path: file }); else await page.screenshot({ path: file, fullPage: true });
  console.log(file);
}
await browser.close();
server.close();
