// Автопроверка вёрстки TanWin перед выпуском: бот проходит все экраны и все уроки и ищет
//   • текст, вылезающий за край экрана, карточки или кнопки;
//   • наложения: арабские буквы, задевающие русский текст или соседнюю строку (по реальному контуру букв);
//   • арабский текст, набранный не арабским шрифтом;
//   • служебные слова на экране (null, undefined, NaN…), экраны ошибок и ошибки JavaScript.
//
// Установка (один раз):  cd tools/audit && npm install && npx playwright install chromium webkit
// Запуск из корня проекта:
//   node tools/audit/audit.mjs                          — телефон 390 px, обычные размеры, Chromium
//   node tools/audit/audit.mjs --ar 2.4 --ui 1.4        — самый крупный арабский и остальной текст
//   node tools/audit/audit.mjs --width 320 --engine webkit --theme dark
//   node tools/audit/audit.mjs --font scheherazade      — другой арабский шрифт (amiri, hafs, scheherazade, noto)
//   node tools/audit/audit.mjs --pages                  — только разделы, без уроков (быстро, ~1 мин)
//   node tools/audit/audit.mjs --lessons 11             — только уроки, чьи номера начинаются с «11»
// Итог — в консоли; снимки проблемных экранов и подробный отчёт — в tools/audit/out/.
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, extname, normalize } from "node:path";

let playwright;
try { playwright = await import("playwright"); }
catch { console.error("Нужен Playwright:  cd tools/audit && npm install && npx playwright install chromium webkit"); process.exit(2); }

const args = Object.fromEntries(process.argv.slice(2).join(" ").split(/\s*--/).filter(Boolean).map((x) => { const [k, ...v] = x.trim().split(/\s+/); return [k, v.length ? v.join(" ") : true]; }));
const eng = args.engine || "chromium", width = +(args.width || 390), scale = +(args.ar || 1), ui = +(args.ui || 1), theme = args.theme || "light";
const font = args.font || ""; // --font amiri | hafs | scheherazade | noto (по умолчанию — как в приложении)
const filter = args.lessons === true ? "" : args.lessons || "", pagesOnly = !!args.pages, variant = args.variant || "fresh";
const tag = `${eng}-${width}-ar${scale}-ui${ui}-${theme}${font ? "-" + font : ""}`;

// маленький статический сервер для корня проекта
const root = fileURLToPath(new URL("../..", import.meta.url));
const OUT = fileURLToPath(new URL(`./out${args.out ? "-" + args.out : ""}`, import.meta.url)); // --out имя — для параллельных запусков
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
  if (!path || path === "." || path.includes("..")) path = "index.html";
  try { const body = await readFile(join(root, path)); res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const BASE = `http://127.0.0.1:${server.address().port}`;
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await playwright[eng === "webkit" ? "webkit" : "chromium"].launch();
const ctx = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 1, serviceWorkers: "block", colorScheme: theme === "dark" ? "dark" : "light" });
await ctx.route(/qurancdn|everyayah|mp3/, (r) => r.abort());
await ctx.addInitScript(([s, u, variant, theme, font]) => {
  Object.defineProperty(navigator, "standalone", { get: () => true }); // как установленное приложение
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  const st = { profile: { onboarded: true, name: "Тест", goal: 30, created: Date.now() }, settings: { arScale: s, uiScale: u, theme, unlockAll: variant === "fresh", sfx: false, translit: "show", ...(font ? { arFont: font } : {}) }, lessons: {} };
  if (variant === "mid") {
    for (const id of ["1.1", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "2.8", "2.9", "3.1", "3.2"]) st.lessons[id] = { done: true, stars: 2, best: 88, n: 1, at: Date.now() - 86400000 * 9 };
    st.xp = 1234; st.stats = { answers: 300, correct: 260, ms: 3600000, lessons: 12 };
    st.reading = { s: 2, a: 25, p: 5, mode: "ayah", at: Date.now() };
  }
  localStorage.setItem("tanwin.v2", JSON.stringify(st));
}, [scale, ui, variant, theme, font]);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const AUDIT = () => {
  const W = innerWidth, issues = [];
  const BOX = ".card, .opt, .word-chip, .match-btn, .alpha-cell, .form-cell, .syll, .st-cell, .vt-word, .sn-btn, .rd-word, .hero-card, .unit-head, .node-disc, .modal, .sheet-in, .drill, .more-link, .surah-row, .tile, .stat, .schip, .badge-cell, .m-cell, .rw-cell, .stop-cell, .verse-block, .verses, .seg-btn, .btn, .hs-pill, .hs-goal, .dev-banner, .version, .donor, .res-goal, .ob-pt, .start-opt, .goal-opt, .si-plan div, .map-info, .q-big, .rd-word, .lc-glyph";
  const OVERLAY = ".lp-sheet, .lp-actions, #nav, #toast, .lp-top, .reader-tools, .focus-bar, .focus-juz";
  const modalOpen = document.querySelector("#modal-root .modal-wrap:not(.out)");
  const roots = modalOpen ? [modalOpen] : [document.querySelector("#app")];
  const texts = [];
  const desc = (el) => { const p = []; for (let e = el; e && p.length < 3 && e.id !== "app"; e = e.parentElement) p.unshift(e.tagName.toLowerCase() + (e.className && typeof e.className === "string" ? "." + e.className.trim().split(/\s+/).join(".") : "")); return p.join(" > "); };
  for (const root of roots) {
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n; (n = tw.nextNode());) {
      const t = n.textContent.replace(/[\s‍]/g, "");
      if (!t) continue;
      const el = n.parentElement;
      if (el.closest(".uh-ar, .confetti, svg, .opt-k, .reader-tools, script, style, .node-tip, noscript")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || el.closest("[hidden], .hidden") || !el.getClientRects().length) continue;
      if (el.closest(".unit:not(.open) .nodes")) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      const isAr = /[؀-ۿ]/.test(t);
      const ov = el.closest(OVERLAY);
      if (el.closest("[style*=ellipsis], .sr-main small")) continue; // намеренно обрезанный многоточием текст
      if (isAr && !/Amiri/.test(cs.fontFamily)) issues.push({ k: "unstyled-ar", t: t.slice(0, 30), at: desc(el) });
      // реальный контур букв (canvas), а не «коробка» шрифта
      const cx = (window.__cx ||= document.createElement("canvas").getContext("2d"));
      cx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const m = cx.measureText(n.textContent.trim());
      for (const r0 of r.getClientRects()) {
        if (r0.width < 1 || r0.height < 1) continue;
        const base = r0.bottom - m.fontBoundingBoxDescent;
        const rc = { left: r0.left, right: r0.right, width: r0.width, top: base - m.actualBoundingBoxAscent, bottom: base + m.actualBoundingBoxDescent };
        rc.height = rc.bottom - rc.top;
        texts.push({ t: t.slice(0, 24), isAr, rc, el, ov });
      }
    }
  }
  for (const x of texts) {
    const { rc, el } = x;
    if (el.closest(".lp-sheet:not(.show)")) continue;
    if (rc.left < -1 || rc.right > W + 1) issues.push({ k: "offscreen", t: x.t, at: desc(el), l: Math.round(rc.left), r: Math.round(rc.right) });
    const box = el.closest(BOX);
    if (box && !box.contains(el) === false) {
      const b = box.getBoundingClientRect();
      const tol = 2;
      if (rc.left < b.left - tol || rc.right > b.right + tol) issues.push({ k: "out-of-box-h", t: x.t, at: desc(el), box: desc(box), by: Math.round(Math.max(b.left - rc.left, rc.right - b.right)) });
      if (x.isAr && (rc.top < b.top - tol || rc.bottom > b.bottom + tol) && !box.matches(".verses, .card, .modal, .sheet-in, .hero-card")) issues.push({ k: "out-of-box-v", t: x.t, at: desc(el), box: desc(box), by: Math.round(Math.max(b.top - rc.top, rc.bottom - b.bottom)) });
    }
  }
  // наложения: разные текстовые узлы, чьи строки пересекаются (кроме плавающих панелей поверх страницы)
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const a = texts[i], b = texts[j];
    if (a.el === b.el && a.t === b.t) continue;
    if (!!a.ov !== !!b.ov || (a.ov && a.ov !== b.ov)) continue;
    if (!a.isAr && !b.isAr) continue;
    const ix = Math.min(a.rc.right, b.rc.right) - Math.max(a.rc.left, b.rc.left);
    const iy = Math.min(a.rc.bottom, b.rc.bottom) - Math.max(a.rc.top, b.rc.top);
    // арабский: реальные знаки ≈ 80% высоты строки, поэтому допускаем касание краями
    const tolY = 1;
    if (ix > 2 && iy > tolY) {
      // соседние куски одного слова (цветной span внутри того же .ar) — не наложение
      const arA = a.el.closest(".ar"), arB = b.el.closest(".ar");
      if (arA && arA === arB) continue;
      issues.push({ k: "overlap", t: a.t + " × " + b.t, at: desc(a.el) + " || " + desc(b.el), ix: Math.round(ix), iy: Math.round(iy) });
    }
  }
  const junk = document.body.innerText.match(/.{0,30}(\bnull\b|\bundefined\b|\bNaN\b|Infinity|\[object).{0,30}/);
  if (junk) issues.push({ k: "junk-text", t: junk[0] });
  if (/Что-то пошло не так|Страница не найдена|Не удалось подготовить/.test(document.body.innerText)) issues.push({ k: "broken-screen", t: document.body.innerText.slice(0, 120) });
  const sw = document.documentElement.scrollWidth;
  if (sw > W + 1) issues.push({ k: "page-scroll-x", sw });
  return issues;
};

const results = [];
let shotN = 0;
let screens = 0; const seenKinds = {};
async function check(label) {
  screens++;
  await page.waitForTimeout(350);
  await page.waitForFunction(() => document.fonts.check('20px "Amiri Quran"', "ب") && document.fonts.status === "loaded", null, { timeout: 15000 }).catch(() => {});
  const issues = await page.evaluate(AUDIT);
  if (issues.length) {
    const file = `${OUT}/${String(++shotN).padStart(3, "0")}.png`;
    if (shotN <= 60) await page.screenshot({ path: file });
    results.push({ label, file, issues });
  }
  return issues;
}

const PAGES = ["/surah/1", "/surah/112", "/page/1", "/page/582", "/read/1", "/read/2", "/read/112", "/", "/review", "/quran", "/quran/1", "/quran/2", "/quran/112", "/progress", "/more", "/letters", "/rules", "/method", "/thanks", "/changelog"];
await page.goto(`${BASE}/#/`);
await page.waitForTimeout(1500);
for (const p of PAGES) {
  await page.evaluate((h) => { location.hash = h; }, p);
  await page.waitForTimeout(900);
  if (p === "/") await page.evaluate(() => document.querySelectorAll(".unit:not(.open) .uh-toggle").forEach((b) => b.click()));
  await check("page " + p);
  if (/^\/quran\/\d/.test(p)) { // режим «по аятам»
    await page.evaluate(() => [...document.querySelectorAll(".reader-tools .tool")].find((b) => /аятам|Мусхаф/.test(b.textContent))?.click());
    await check("page " + p + " ayat");
    await page.evaluate(() => [...document.querySelectorAll(".reader-tools .tool")].find((b) => /аятам|Мусхаф/.test(b.textContent))?.click());
    await page.evaluate(() => document.querySelector(".qw")?.click());
    await check("page " + p + " word-pop");
    await page.keyboard.press("Escape");
  }
  if (p === "/letters") {
    await page.evaluate(() => document.querySelector(".alpha-cell")?.click());
    await check("page /letters letter-modal");
    await page.keyboard.press("Escape");
  }
}

if (!pagesOnly) {
  const ids = await page.evaluate(async () => (await import("/js/course.js")).ALL_LESSONS.map((l) => l.id));
  for (const id of ids.filter((x) => !filter || x.startsWith(filter))) {
    await page.evaluate((h) => { location.hash = h; }, "/learn/" + id);
    await page.waitForTimeout(1200);
    let prev = "", same = 0;
    for (let step = 0; step < 30; step++) {
      const sig = await page.evaluate(() => (document.querySelector(".lp-stage")?.innerText || "") + (document.querySelector(".lp-sheet.show") ? "S" : ""));
      if (!sig && step > 0) break;
      same = sig === prev ? same + 1 : 0; prev = sig;
      if (same >= 2) break;
      await check(`lesson ${id} step ${step}`);
      const acted = await page.evaluate(() => {
        const click = (el) => { if (el) { el.click(); return true; } return false; };
        const sheetBtn = document.querySelector(".lp-sheet.show .btn.primary");
        if (sheetBtn) return click(sheetBtn) && "sheet";
        const opts = [...document.querySelectorAll(".lp-stage .opt:not([disabled])")];
        if (opts.length) return click(opts[Math.floor(Math.random() * opts.length)]) && "opt";
        const res = document.querySelector(".lp-content.result .btn.primary");
        if (res) return "result";
        const next = document.querySelector(".lp-stage .btn.next");
        if (next) return click(next) && "next";
        const skip = [...document.querySelectorAll(".lp-stage button")].find((b) => /Пропустить|Дальше|Готово|Далее|Продолжить/.test(b.textContent));
        if (skip) return click(skip) && "skip";
        const m = document.querySelector(".lp-stage .match-btn:not(.done), .lp-stage .vt-word, .lp-stage .dg-pt");
        if (m) { m.dispatchEvent(new MouseEvent("click", { bubbles: true })); return "tap"; }
        return false;
      });
      if (acted === "result" || !acted) break;
    }
  }
}
await writeFile(`${OUT}/report.json`, JSON.stringify({ tag, errors, results }, null, 1));
const counts = {};
for (const r of results) for (const i of r.issues) counts[i.k] = (counts[i.k] || 0) + 1;
console.log(`${tag}: проверено экранов ${screens}, с замечаниями ${results.length}`, counts, errors.length ? `ошибок JS: ${errors.length}` : "ошибок JS нет");
for (const r of results.slice(0, 15)) console.log(" •", r.label, "—", r.issues.slice(0, 2).map((i) => `${i.k}: ${i.t}`).join(" | "), r.file ? `(${r.file.split(/[\/]/).pop()})` : "");
await browser.close();
server.close();
process.exit(results.length || errors.length ? 1 : 0);
