// Картинка для предпросмотра ссылки в мессенджерах и соцсетях (og:image): icons/og.png, 1200×630.
//   node tools/audit/og.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../..", import.meta.url));
const font = (f) => "data:font/woff2;base64," + readFileSync(join(root, "fonts", f)).toString("base64"); // страница без адреса не читает файлы с диска
const icon = readFileSync(join(root, "icons/icon.svg"), "utf8");
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: N; src: url("${font("nunito.woff2")}"); font-weight: 200 1000; }
@font-face { font-family: A; src: url("${font("hafs.woff2")}"); }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; font-family: N, sans-serif; color: #fff; background: linear-gradient(135deg, #12b58a, #075e47); display: flex; align-items: center; gap: 56px; padding: 0 84px; overflow: hidden; position: relative; }
.ic { width: 300px; height: 300px; flex: none; filter: drop-shadow(0 18px 40px rgba(0, 0, 0, .28)); }
.ic svg { width: 100%; height: 100%; }
h1 { font-size: 104px; font-weight: 950; letter-spacing: -2px; line-height: 1; }
p { font-size: 44px; font-weight: 800; margin-top: 18px; color: #ffe9b0; }
small { display: block; font-size: 30px; font-weight: 700; margin-top: 26px; opacity: .92; line-height: 1.35; }
.ar { position: absolute; right: 60px; bottom: 6px; font-family: A; font-size: 150px; color: rgba(255, 255, 255, .13); direction: rtl; }
</style><div class="ic">${icon}</div><div><h1>TanWin</h1><p>Путь к чтению Корана</p><small>С нуля — до чтения по правилам таджвида.<br>Бесплатно, по 10 минут в день.</small></div><div class="ar">ٱقۡرَأۡ</div>`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: join(root, "icons/og.png") });
await browser.close();
console.log("icons/og.png готова");
