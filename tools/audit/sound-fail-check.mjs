// Проверка подсказки «Звук не загружается»: запись слова или аята не пришла (сервер закрыт) либо не начинается дольше 8 секунд —
// приложение говорит об этом, а не молчит; когда запись пришла, подсказки нет. Урок 2.8, вопрос «Какое слово прозвучало?», и чтец.
// Сервер и интернет не нужны: проверка поднимает свой сервер, а записи чтецов подменяет сама.
// Запуск:  node tools/audit/sound-fail-check.mjs [адрес] [папка для снимков]
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { serve } from "./serve.mjs";

const own = process.argv[2] ? null : await serve();
const BASE = process.argv[2] || own.base;
const SHOTS = process.argv[3] || "";
const MP3 = fileURLToPath(new URL("../../audio/letters/ba.mp3", import.meta.url));
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
// без service worker: его запросы робот подменить не может
const ctx = await browser.newContext({ viewport: { width: 393, height: 800 }, serviceWorkers: "block" });
await ctx.route(/mc\.yandex/, (r) => r.abort());
let net = "closed"; // closed — сервер звука закрыт; silent — не отвечает; fine — запись приходит
await ctx.route(/everyayah|qurancdn|verses\.quran/, (r) => { if (net === "closed") return r.abort(); if (net === "fine") return r.fulfill({ path: MP3, contentType: "audio/mpeg" }); });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const fails = [];
const ok = (name, cond, got) => { console.log(`${cond ? "✓" : "✗"} ${name}${cond ? "" : " — " + JSON.stringify(got)}`); if (!cond) fails.push(name); };
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png` }); };
const toastText = () => page.evaluate(() => { const t = document.querySelector("#toast"); return t.classList.contains("show") ? t.textContent : ""; });
const hint = async (ms) => { try { await page.waitForFunction(() => { const t = document.querySelector("#toast"); return t.classList.contains("show") && t.textContent.includes("Звук не загружается"); }, null, { timeout: ms }); return true; } catch { return false; } };
const hideToast = () => page.evaluate(() => document.querySelector("#toast").classList.remove("show"));

/** Открыть урок 2.8 заново и дойти до вопроса «Какое слово прозвучало?». Вернёт текст подсказки, если она появилась раньше вопроса. */
async function toQuestion() {
  await page.goto(`${BASE}/#/path`);
  await page.reload();
  await page.goto(`${BASE}/#/learn/2.8`);
  await page.waitForSelector(".lesson .lp-content");
  let early = "";
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(450);
    const st = await page.evaluate(() => ({
      q: document.querySelector(".lp-content.q .q-text h2")?.textContent || "",
      sheet: !!document.querySelector(".lp-sheet.show .btn.primary"),
      next: !!document.querySelector(".lp-actions .btn.next"),
    }));
    if (st.q.includes("Какое слово прозвучало") && !st.sheet) return early;
    early = early || (await toastText());
    if (st.sheet) await page.locator(".lp-sheet.show .btn.primary").click();
    else if (st.next) await page.locator(".lp-actions .btn.next").click();
    else await page.locator(".opts .opt").first().click();
  }
  throw new Error("не дошли до вопроса «Какое слово прозвучало?»");
}

await page.goto(`${BASE}/#/welcome`);
await page.waitForTimeout(1200);
await page.evaluate(async () => {
  const { store } = await import("/js/store.js");
  store.set((st) => { st.profile.onboarded = true; for (const id of ["1.1", "2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7"]) st.lessons[id] = { done: true, stars: 3, best: 96, n: 1, at: Date.now() - 86400000 }; });
  try { localStorage.setItem("tanwin.ayahHint2", "1"); } catch {}
});

// 1. сервер звука закрыт
let early = await toQuestion();
ok("до вопроса подсказки нет: буквы звучат из самого приложения", !early, early);
ok("сервер закрыт — на вопросе «Звук не загружается»", await hint(4000), await toastText());
ok("в подсказке есть совет про интернет и VPN", /Проверьте интернет/.test(await toastText()) && /VPN/.test(await toastText()), await toastText());
await shot("1-closed");
if (SHOTS) { await page.setViewportSize({ width: 393, height: 450 }); await shot("1-closed-short"); await page.setViewportSize({ width: 393, height: 800 }); }
await page.locator("#toast").click();
await page.waitForTimeout(400);
ok("нажатие на подсказку убирает её", !(await toastText()), await toastText());
await page.locator(".q-play").click();
ok("«послушать ещё раз» — подсказка снова", await hint(4000), await toastText());
await hideToast();

// 2. сервер не отвечает: подсказка — через 8 секунд ожидания
net = "silent";
await toQuestion();
const t0 = Date.now();
ok("сервер молчит — первые секунды подсказки нет", !(await hint(4000)), await toastText());
ok("сервер молчит — подсказка после 8 секунд", await hint(8000), [Date.now() - t0, await toastText()]);
await hideToast();

// 3. запись приходит: подсказки нет
net = "fine";
await toQuestion();
ok("запись пришла — подсказки нет", !(await hint(9500)), await toastText());
const twice = await page.evaluate(async () => { const a = await import("/js/audio.js"); a.playWord("001_001_001"); a.playWord("001_001_001"); await new Promise((r) => setTimeout(r, 150)); return a.playingId(); });
ok("два быстрых нажатия на одно слово — второе звучит и отмечено", twice === "w:001_001_001", twice);

// 4. чтец: аят не пришёл
net = "closed";
await page.goto(`${BASE}/#/read/112`);
await page.waitForSelector(".focus .ayah-mark", { state: "attached" });
await page.waitForTimeout(800);
await hideToast();
await page.locator(".focus .ayah-mark").nth(2).click();
ok("чтец: аят не пришёл — «Звук не загружается»", await hint(4000), await toastText());
await shot("2-reciter");

ok("ошибок на странице нет", !errors.length, errors);
await browser.close();
own?.stop();
console.log(fails.length ? `\nНе прошло: ${fails.length}` : "\nВсё прошло");
process.exit(fails.length ? 1 : 0);
