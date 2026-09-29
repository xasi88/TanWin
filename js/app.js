// TanWin — оболочка приложения: маршруты, навигация, тема, офлайн.
import { h, $, icon, toast } from "./ui.js";
import { store, streakNow, levelInfo, todayXp } from "./store.js";
import { loadBank, loadSurahs } from "./data.js";
import { stop } from "./audio.js";
import { checkBadges } from "./path.js";
import { canPrompt, install, isInstalled, onInstallChange, manualHint } from "./install.js";

const view = $("#view");
const nav = $("#nav");

// ---------- Тема и размер арабского текста ----------
export function applySettings() {
  const s = store.get().settings;
  const root = document.documentElement;
  if (s.theme === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", s.theme);
  root.style.setProperty("--ar-scale", s.arScale || 1);
  const dark = s.theme === "dark" || (s.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b1020" : "#fbf7ef");
}

// ---------- Навигация ----------
const TABS = [
  { path: "/", label: "Путь", ic: "path" },
  { path: "/review", label: "Практика", ic: "repeat" },
  { path: "/quran", label: "Коран", ic: "book" },
  { path: "/progress", label: "Прогресс", ic: "chart" },
  { path: "/more", label: "Ещё", ic: "more" },
];
function renderNav(active) {
  const s = store.get();
  const lv = levelInfo();
  nav.replaceChildren(
    h("a.brand", { href: "#/", "aria-label": "TanWin — на главную" }, logo(), h("span.brand-name", null, "TanWin"), h("span.brand-sub", null, "путь к чтению Корана")),
    h("div.nav-tabs", { role: "tablist" }, ...TABS.map((t) => {
      const on = t.path === "/" ? active === "/" : active.startsWith(t.path);
      return h("a.tab", { href: "#" + t.path, class: on ? "on" : "", "aria-current": on ? "page" : null }, icon(t.ic, { size: 24 }), h("span", null, t.label));
    })),
    !isInstalled() ? h("button.nav-install", { type: "button", onclick: installApp }, icon("down", { size: 18 }), h("span", null, "Установить приложение")) : null,
    h("div.nav-foot", null,
      h("div.nf-row", null, icon("flame", { size: 18, fill: true, sw: 1, cls: streakNow() ? "fire" : "" }), h("b", null, streakNow()), h("span", null, "дней подряд")),
      h("div.nf-row", null, icon("nur", { size: 18, fill: true, sw: 1, cls: "nur" }), h("b", null, s.xp), h("span", null, `нура · уровень ${lv.n}`))));
}
export async function installApp() {
  if (canPrompt()) { if (await install()) toast("TanWin установлен — ищите его на рабочем столе ✓"); }
  else toast(manualHint(), 6000);
}
onInstallChange(() => renderNav(location.hash.replace(/^#/, "") || "/"));

export function logo(size = 34) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 64 64"); s.setAttribute("width", size); s.setAttribute("height", size); s.setAttribute("class", "logo");
  s.innerHTML = `<defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd97a"/><stop offset="1" stop-color="#d49a24"/></linearGradient></defs>
    <path d="M32 2l6.9 13.4 14.3-4.6-4.6 14.3L62 32l-13.4 6.9 4.6 14.3-14.3-4.6L32 62l-6.9-13.4-14.3 4.6 4.6-14.3L2 32l13.4-6.9-4.6-14.3 14.3 4.6Z" fill="url(#lg1)"/>
    <circle cx="32" cy="33.5" r="17" fill="#0b3b30"/>
    <path d="M32 27.5c-3.6-2.5-8.6-3.3-13.2-2.8v16.8c4.6-.5 9.6.3 13.2 2.8Z" fill="#ffd97a"/>
    <path d="M32 27.5c3.6-2.5 8.6-3.3 13.2-2.8v16.8c-4.6-.5-9.6.3-13.2 2.8Z" fill="#f2c257"/>`;
  return s;
}

// ---------- Маршруты ----------
const routes = [
  [/^\/$/, () => import("./views/home.js").then((m) => m.HomeView())],
  [/^\/learn\/([\d.]+)$/, (id) => import("./views/home.js").then((m) => m.LessonRoute(id))],
  [/^\/surah\/(\d+)$/, (n) => import("./views/surah.js").then((m) => m.SurahLesson(+n))],
  [/^\/review$/, () => import("./views/review.js").then((m) => m.ReviewView())],
  [/^\/practice\/(\w+)$/, (k) => import("./views/review.js").then((m) => m.PracticeRoute(k))],
  [/^\/quran$/, () => import("./views/quran.js").then((m) => m.QuranList())],
  [/^\/quran\/(\d+)$/, (n) => import("./views/quran.js").then((m) => m.Reader(+n))],
  [/^\/progress$/, () => import("./views/progress.js").then((m) => m.ProgressView())],
  [/^\/more$/, () => import("./views/more.js").then((m) => m.MoreView())],
  [/^\/letters$/, () => import("./views/reference.js").then((m) => m.LettersRef())],
  [/^\/rules$/, () => import("./views/reference.js").then((m) => m.RulesRef())],
  [/^\/method$/, () => import("./views/reference.js").then((m) => m.MethodView())],
  [/^\/thanks$/, () => import("./views/thanks.js").then((m) => m.ThanksView())],
  [/^\/welcome$/, () => import("./views/onboard.js").then((m) => m.Onboarding())],
];
const FULLSCREEN = /^\/(learn|surah|practice|welcome)/;

let routing = 0;
async function route() {
  const my = ++routing;
  stop();
  const path = location.hash.replace(/^#/, "") || "/";
  if (!store.get().profile.onboarded && !path.startsWith("/welcome")) { location.replace("#/welcome"); return; }
  const full = FULLSCREEN.test(path);
  document.body.classList.toggle("fullscreen", full);
  renderNav(path);
  for (const [re, fn] of routes) {
    const m = path.match(re);
    if (!m) continue;
    try {
      const el = await fn(...m.slice(1));
      if (my !== routing) return;
      view.replaceChildren(el);
      view.classList.remove("view-enter"); void view.offsetWidth; view.classList.add("view-enter");
      if (!full) window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      view.replaceChildren(h("div.page", null, h("div.card", null, h("h2", null, "Что-то пошло не так"), h("p", null, "Проверьте подключение к интернету и обновите страницу."), h("pre.small", null, String(e?.message || e)), h("a.btn.primary", { href: "#/" }, "На главную"))));
    }
    return;
  }
  view.replaceChildren(h("div.page", null, h("div.card", null, h("h2", null, "Страница не найдена"), h("a.btn.primary", { href: "#/" }, "На главную"))));
}
export const go = (p) => { location.hash = "#" + p; };

/** Показать новые награды и события после урока. */
export function celebrate(events = []) {
  const fresh = checkBadges();
  if (events.includes("level")) toast(h("span", null, icon("sparkle", { size: 18 }), ` Новый уровень: ${levelInfo().n}!`), 3200);
  else if (events.includes("goal")) toast(h("span", null, icon("flame", { size: 18, fill: true, sw: 1 }), ` Цель дня выполнена! Серия: ${streakNow()}`), 3200);
  fresh.forEach((b, i) => setTimeout(() => toast(h("span.toast-badge", null, h("span.tb-ic", null, b.icon), h("span", null, h("b", null, "Новая награда: "), b.name)), 3000), 800 + i * 3200));
}

// ---------- Запуск ----------
async function start() {
  applySettings();
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applySettings);
  store.on(() => applySettings());
  window.addEventListener("hashchange", route);
  view.replaceChildren(h("div.boot", null, logo(72), h("div.spinner")));
  try { await Promise.all([loadBank(), loadSurahs(), document.fonts?.load?.('40px "Amiri Quran"', "بسم")]); }
  catch (e) { console.error(e); }
  route();
  registerSW();
}

// ---------- Офлайн (service worker) ----------
export let swReg = null;
function registerSW() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("sw.js").then((reg) => {
    swReg = reg;
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      nw?.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          // вне урока обновляемся сразу; во время урока — по кнопке, чтобы не прервать занятие
          if (!document.body.classList.contains("fullscreen")) { nw.postMessage({ type: "SKIP_WAITING" }); return; }
          toast(h("span", null, "Доступно обновление. ", h("button.link", { type: "button", onclick: () => { nw.postMessage({ type: "SKIP_WAITING" }); } }, "Обновить")), 8000);
        }
      });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

start();
