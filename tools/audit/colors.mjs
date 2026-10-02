// Проверка цветов таджвида: в каждом шрифте у каждого раскрашенного фрагмента на снимке действительно есть пиксели его цвета.
//   node tools/audit/colors.mjs            — страницы мусхафа и справочник правил, 4 шрифта, светлая и тёмная темы
// Снимки и координаты — в tools/audit/shots/colors/, итог считает tools/audit/colors.py (нужен Pillow).
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, extname, normalize } from "node:path";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../..", import.meta.url));
const OUT = fileURLToPath(new URL("./shots/colors", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  if (!path || path === ".") path = "index.html";
  try { const body = await readFile(join(root, path)); res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); } catch { res.writeHead(404); res.end(); }
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });
const PAGES = (process.argv[2] || "/page/1,/page/3,/page/50,/page/282,/page/440,/page/582,/page/596,/page/604,/rules").split(",");
const browser = await chromium.launch();
const index = [];
for (const theme of ["light", "dark"]) for (const font of ["hafs", "amiri", "scheherazade", "noto"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: "block", colorScheme: theme });
  await ctx.route(/qurancdn|everyayah|mp3/, (r) => r.abort());
  await ctx.addInitScript(([font, theme]) => localStorage.setItem("tanwin.v2", JSON.stringify({ profile: { onboarded: true, name: "", goal: 30, created: Date.now() }, settings: { theme, unlockAll: true, sfx: false, arFont: font, tajweed: true }, lessons: {}, srs: {}, xp: 0 })), [font, theme]);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/#/`);
  await page.waitForTimeout(1000);
  for (const p of PAGES) {
    await page.evaluate((h) => { location.hash = h; }, p);
    await page.waitForTimeout(p === "/rules" ? 3500 : 1500);
    await page.waitForFunction(() => document.fonts.status === "loaded", null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(400);
    // плавающие панели закрывают текст на снимке — прячем
    await page.addStyleTag({ content: "#nav, .fb-tab, .reader-tools, .focus-bar { visibility: hidden !important }" });
    const spans = await page.evaluate(() => [...document.querySelectorAll(".ar .tj")].map((el) => {
      const rects = [...el.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
      if (!rects.length) return null;
      const code = [...el.classList].find((c) => c.startsWith("r-")).slice(2);
      const word = el.closest(".ar").getBoundingClientRect();
      return { code, text: el.textContent, color: getComputedStyle(el).color, ink: getComputedStyle(el.closest(".ar")).color, family: getComputedStyle(el).fontFamily.split(",")[0],
        rects: rects.map((r) => [r.left + scrollX, r.top + scrollY, r.width, r.height]), word: [word.left + scrollX, word.top + scrollY, word.width, word.height] };
    }).filter(Boolean));
    const name = `${theme}-${font}-${p.replace(/\W+/g, "_")}`;
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
    index.push({ name, theme, font, page: p, spans });
    console.log(name, spans.length);
  }
  await ctx.close();
}
await writeFile(`${OUT}/index.json`, JSON.stringify(index));
await browser.close();
server.close();
