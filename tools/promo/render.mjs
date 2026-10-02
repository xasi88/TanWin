// Рекламный ролик 9:16 (1080×1920, 30 к/с) из promo.html + озвучка audio/*.mp3 → out/tanwin-promo.mp4
//   node tools/promo/render.mjs            весь ролик
//   node tools/promo/render.mjs 3 12 22    только кадры на 3-й, 12-й и 22-й секундах (out/f-*.png) — для проверки
// Нужны: ffmpeg в PATH; снимки (capture.mjs) и озвучка (voice.py).
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { join, extname, normalize } from "node:path";
import { chromium } from "../audit/node_modules/playwright/index.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const here = fileURLToPath(new URL(".", import.meta.url));
const OUT = join(here, "out");
const FPS = 30;
// Звук: [файл, начало в секундах, громкость]
const AUDIO = [["iqra", 0.55, 0.9], ["v1", 1.7, 1], ["v2", 7.4, 1], ["v3", 13.6, 1], ["v4", 20.3, 1], ["v5", 27.9, 1], ["v6", 33.6, 1], ["v7", 40.8, 1]];

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^[\\/]+/, "");
  try { const body = await readFile(join(root, path)); res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); } catch { res.writeHead(404); res.end(); }
}).listen(0, "127.0.0.1");
await once(server, "listening");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("JS:", e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/tools/promo/promo.html`);
await page.waitForFunction(() => window.READY);

const probes = process.argv.slice(2).map(Number);
if (probes.length) {
  for (const t of probes) { await page.evaluate((t) => window.seek(t), t); await page.screenshot({ path: join(OUT, `f-${t}.png`) }); console.log(`f-${t}.png`); }
} else {
  const total = await page.evaluate(() => window.DURATION);
  const file = join(OUT, "tanwin-promo.mp4");
  const inputs = AUDIO.flatMap(([f]) => ["-i", join(here, "audio", f + ".mp3")]);
  const mix = AUDIO.map(([, at, vol], i) => `[${i + 1}:a]aresample=48000,volume=${vol},adelay=${Math.round(at * 1000)}:all=1[a${i}]`).join(";") +
    ";" + AUDIO.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${AUDIO.length}:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11,apad[a]`;
  const ff = spawn("ffmpeg", ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", ...inputs,
    "-filter_complex", mix, "-map", "0:v", "-map", "[a]", "-t", String(total),
    "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-pix_fmt", "yuv420p", "-profile:v", "high", "-r", String(FPS), "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
    "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", file], { stdio: ["pipe", "inherit", "inherit"] });
  const n = Math.round(total * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.seek(t), i / FPS);
    const buf = await page.screenshot({ type: "jpeg", quality: 95 });
    if (!ff.stdin.write(buf)) await once(ff.stdin, "drain");
    if (i % 150 === 0) console.log(`${Math.round(i / n * 100)}%`);
  }
  ff.stdin.end();
  await once(ff, "close");
  console.log(file);
}
await browser.close();
server.close();
