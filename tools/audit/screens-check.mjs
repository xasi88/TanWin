// Робот по экранам: открывает каждый экран из карты функций (docs/Карта TanWin/Экраны) в настоящем браузере — в TanWin
// и в отдельном «Моём Коране» — и проверяет, что всё перечисленное в разделе «Робот» его заметки на месте.
// Так пропажу кнопки или плитки на одном из экранов видно до выпуска. Как пишутся шаги — tools/map-steps.mjs.
// Сервер не нужен: робот поднимает свой.
// Запуск из корня проекта:  node tools/audit/screens-check.mjs [часть названия экрана]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, extname, normalize } from "node:path";
import { chromium } from "playwright";
import { parseSteps } from "../map-steps.mjs";

const root = fileURLToPath(new URL("../..", import.meta.url));
const DIR = join(root, "docs", "Карта TanWin", "Экраны");
const APPS = { TanWin: { path: "/", name: "TanWin" }, "Мой Коран отдельным приложением": { path: "/quran/", name: "Мой Коран" } };
const filter = (process.argv[2] || "").toLowerCase();

// ---------- С какими данными открывается приложение ----------
const DAY = 86400000, now = Date.now();
const done = (stars = 3) => ({ done: true, stars, best: stars === 3 ? 100 : 85, n: 1, at: now - 3 * DAY });
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const pupil = () => ({
  profile: { onboarded: true, name: "Тест", goal: 30, created: now - 30 * DAY },
  settings: { sfx: false },
  lessons: { "1.1": done(), "2.1": done(2), "2.2": done(), "2.3": done() },
  xp: 260, days: { [iso(now - DAY)]: 60, [iso(now)]: 20 }, streak: { cur: 1, best: 3, last: iso(now - DAY) },
  srs: { "L:alif": { box: 1, due: now - DAY, ok: 1, bad: 1, last: now - 2 * DAY }, "L:ba": { box: 2, due: now - DAY, ok: 2, bad: 0, last: now - 3 * DAY } },
  stats: { answers: 60, correct: 51, ms: 900000, lessons: 4 },
  hard: { "002_255_002": { bad: 2, ok: 0, last: now - DAY } },
});
const STATES = {
  "новичок": () => null, // чистое устройство: приложение открывают впервые
  "ученик": pupil,
  "всё открыто": () => ({ ...pupil(), settings: { sfx: false, unlockAll: true } }),
  "закладки": () => ({
    ...pupil(),
    reads: { 112: 1 },
    reading: { s: 2, a: 255, p: 42, mode: "surah", j: 0, id: "", at: now },
    qread: { days: { [iso(now)]: { ms: 600000, pages: 3, pp: [1, 2, 3] } }, goals: 2 },
    markGroups: [{ id: "gA", name: "Каждый день" }, { id: "gB", name: "Пятница" }],
    marks: [
      { id: "a1", s: 2, a: 255, p: 42, at: now, g: "gA", name: "Аят аль-Курси" },
      { id: "seq1", s: 67, a: 1, p: 562, at: now, g: "gA", plan: { k: "seq", unit: "p", n: 2 } },
      { id: "rep1", s: 18, a: 1, p: null, at: now, g: "gB", name: "Аль-Кахф, начало", plan: { k: "rep", items: [{ s: 18, from: 1, to: 10 }], days: null } },
      { id: "l1", s: 36, a: 1, p: 440, at: now },
    ],
  }),
};
const QUIET = { "tanwin.updNote": "1", "tanwin.readHint": "1", "tanwin.ayahHint2": "1" }; // разовые подсказки не заслоняют экран

// ---------- Маленький сервер для корня проекта ----------
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  if (path.includes("..")) { res.writeHead(403); return res.end(); }
  if (!path || /[/\\]$/.test(path)) path += "index.html"; // «/quran/» — отдельное приложение
  try { const body = await readFile(join(root, path)); res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// ---------- Заметки экранов ----------
const notes = readdirSync(DIR).filter((f) => f.endsWith(".md")).map((f) => {
  const src = readFileSync(join(DIR, f), "utf8").replace(/\r\n/g, "\n");
  const apps = [...(src.match(/^приложения:\n((?:\s+-.*\n)+)/m)?.[1] || "").matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
  const robot = src.match(/^## Робот\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1] || "";
  return { name: f.replace(/\.md$/, ""), apps, ...parseSteps(robot) };
}).filter((n) => n.name.toLowerCase().includes(filter));

// Виден ли элемент человеку: есть размер, не спрятан и не прозрачен (панели чтения прячутся прозрачностью)
const shown = (els) => els.some((el) => {
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  let o = 1;
  for (let x = el; x && x.nodeType === 1; x = x.parentElement) { const cs = getComputedStyle(x); if (cs.display === "none" || cs.visibility === "hidden") return false; o *= +cs.opacity; }
  return o > 0.05;
});

const browser = await chromium.launch();
const fails = [];
let checks = 0, runs = 0;
for (const note of notes) {
  if (!note.steps.length) { fails.push(`${note.name}: нет шагов в разделе «Робот»`); console.log(`✗ ${note.name}: нет шагов в разделе «Робот»`); continue; }
  for (const app of note.apps) {
    const where = `${note.name} · ${APPS[app]?.name || app}`;
    if (!APPS[app]) { fails.push(`${where}: неизвестное приложение`); continue; }
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, serviceWorkers: "block" });
    await ctx.route(/mc\.yandex|everyayah|qurancdn|verses\.quran/, (r) => r.abort());
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    let state = "ученик", seeded = false, bad = [], n = 0;
    const settle = (ms = 350) => page.waitForTimeout(ms);
    const has = (sel) => page.locator(sel).evaluateAll(shown);
    try {
      for (const s of note.steps) {
        if (s.only && s.only !== app) continue;
        if (s.verb === "состояние") { if (!STATES[s.arg]) throw new Error(`нет состояния «${s.arg}»`); state = s.arg; }
        else if (s.verb === "ширина") { await page.setViewportSize({ width: +s.arg, height: 800 }); await settle(); }
        else if (s.verb === "открыть") {
          if (!seeded) { // данные кладём до запуска приложения, один раз на окно
            await ctx.addInitScript(([st, quiet]) => {
              if (sessionStorage.getItem("seeded")) return;
              sessionStorage.setItem("seeded", "1");
              if (st) localStorage.setItem("tanwin.v2", JSON.stringify(st));
              for (const [k, v] of Object.entries(quiet)) localStorage.setItem(k, v);
            }, [STATES[state](), QUIET]);
            seeded = true;
          }
          await page.goto(BASE + APPS[app].path + s.arg);
          await page.waitForFunction(() => { const v = document.querySelector("#view"); return v?.firstElementChild && !v.querySelector(".boot"); }, null, { timeout: 20000 });
          await settle(600);
        }
        else if (s.verb === "коснуться") { const [x, y] = s.arg.split(",").map(Number); await page.mouse.click(x, y); await settle(450); }
        else if (s.verb === "нажать") { await page.locator(s.arg).first().click({ timeout: 6000 }); await settle(450); }
        else if (s.verb === "держать") {
          const b = await page.locator(s.arg).first().boundingBox();
          await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.waitForTimeout(750); await page.mouse.up(); await settle(500);
        }
        else if (s.verb === "есть") {
          n++;
          let ok = false;
          for (let i = 0; i < 20 && !(ok = await has(s.arg)); i++) await page.waitForTimeout(200);
          if (!ok) bad.push(`нет на экране: ${s.arg}`);
        }
        else if (s.verb === "нет") { n++; await settle(250); if (await has(s.arg)) bad.push(`не должно быть, а есть: ${s.arg}`); }
      }
    } catch (e) { bad.push(`шаги прервались: ${String(e.message || e).split("\n")[0].slice(0, 200)}`); }
    if (errors.length) bad.push(`ошибки на странице: ${errors.join(" | ")}`);
    runs++; checks += n;
    console.log(`${bad.length ? "✗" : "✓"} ${where}: проверок ${n}${bad.map((b) => `\n    ${b}`).join("")}`);
    for (const b of bad) fails.push(`${where}: ${b}`);
    await ctx.close();
  }
}
await browser.close();
server.close();
console.log(fails.length ? `Не прошло: ${fails.length}` : `Все экраны на месте: экранов ${notes.length}, открытий ${runs}, проверок ${checks}.`);
process.exit(fails.length ? 1 : 0);
