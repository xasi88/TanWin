// TanWin — оболочка приложения: маршруты, навигация, тема, офлайн.
import { h, $, icon, toast, checkShaping, queueFit, AR_FONTS, arFont } from "./ui.js";
import { store, streakNow, levelInfo, todayXp, protectStorage } from "./store.js";
import { loadBank, loadSurahs } from "./data.js";
import { stop } from "./audio.js";
import { checkBadges, courseProgress, nextTarget, lessonById } from "./path.js";
import { APP_VERSION } from "./version.js";
import { canPrompt, install, isInstalled, isStandalone, manualHint } from "./install.js";
import { initMetrika, hit, track } from "./metrika.js";
import { initFeedback, setScreen } from "./feedback.js";
import { fill } from "./tutor.js";
import { initWake } from "./wake.js";
import { initFullscreen, canFullscreen, isFullscreen, setFullscreen, onFullscreenChange } from "./fullscreen.js";

const view = $("#view");
const nav = $("#nav");

// ---------- Тема и размер арабского текста ----------
export function applySettings() {
  const s = store.get().settings;
  const root = document.documentElement;
  if (s.theme === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", s.theme);
  // арабский и остальной текст увеличиваются независимо (см. «Арабский текст» в docs/ARCHITECTURE.md)
  root.style.setProperty("--ui-scale", s.uiScale || 1);
  root.style.setProperty("--ar-k", (s.arScale || 1) / (s.uiScale || 1));
  root.classList.toggle("ar-big", (s.arScale || 1) > 1.4);
  root.classList.toggle("tj-off", !s.tajweed); // цвета таджвида в мусхафе: текст размечен всегда, цвет снимается стилем
  const font = AR_FONTS[arFont()].css;
  if (root.style.getPropertyValue("--ar-font") !== font) {
    root.style.setProperty("--ar-font", font);
    // у другого шрифта другая ширина слов — после загрузки файла заново подгоняем крупные слова под карточки
    document.fonts?.load?.(`40px ${font}`, "بسم")?.then(queueFit, () => {});
  }
  const dark = s.theme === "dark" || (s.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0b1020" : "#fbf7ef");
}

// ---------- Навигация ----------
const TABS = [
  { path: "/", label: "Путь", ic: "path" },
  { path: "/review", label: "Практика", ic: "repeat" },
  { path: "/quran", label: "Мой Коран", ic: "book" },
  { path: "/bookmarks", label: "Закладки", ic: "bookmark" },
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
    canFullscreen() ? h("button.nav-fs", { type: "button", "data-fs-switch": true, onclick: () => setFullscreen(!isFullscreen()) },
      icon(isFullscreen() ? "shrink" : "expand", { size: 18 }), h("span", null, isFullscreen() ? "Выйти из полного экрана" : "На весь экран")) : "",
    h("div.nav-foot", null,
      h("div.nf-row", null, icon("flame", { size: 18, fill: true, sw: 1, cls: streakNow() ? "fire" : "" }), h("b", null, streakNow()), h("span", null, "дней подряд")),
      h("div.nf-row", null, icon("nur", { size: 18, fill: true, sw: 1, cls: "nur" }), h("b", null, s.xp), h("span", null, `нура · уровень ${lv.n}`)),
      h("a.nf-ver", { href: "#/changelog" }, `Версия ${APP_VERSION} · в разработке`)));
}
export async function installApp() {
  if (canPrompt()) { if (await install()) toast("TanWin установлен — ищите его на рабочем столе ✓"); }
  else toast(manualHint(), 6000);
}
onFullscreenChange(() => renderNav(location.hash.replace(/^#/, "") || "/"));

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
// [адрес, экран, название для статистики]
const routes = [
  [/^\/$/, () => import("./views/home.js").then((m) => m.HomeView()), "Путь"],
  [/^\/learn\/([\d.]+)$/, (id) => import("./views/home.js").then((m) => m.LessonRoute(id)), (id) => `Урок ${id}. ${lessonById[id]?.title || ""}`],
  [/^\/surah\/(\d+)$/, (n) => import("./views/surah.js").then((m) => m.SurahLesson(+n)), (n) => `Урок суры ${n}`],
  [/^\/review$/, () => import("./views/review.js").then((m) => m.ReviewView()), "Практика"],
  [/^\/practice\/(\w+)$/, (k) => import("./views/review.js").then((m) => m.PracticeRoute(k)), (k) => `Практика: ${k}`],
  [/^\/quran$/, () => import("./views/quran.js").then((m) => m.MyQuran()), "Мой Коран"],
  // старые адреса суры (#/quran/2/255) открывают чтение
  [/^\/quran\/(\d+)(?:\/(\d+))?$/, (n, a) => { location.replace(`#/read/${n}${a ? `/${a}` : ""}`); return h("div"); }, (n) => `Чтение: сура ${n}`],
  [/^\/read$/, () => import("./views/quran.js").then((m) => m.ReadStart()), "Чтение"],
  [/^\/read\/(\d+)(?:\/(\d+))?$/, (n, a) => import("./views/quran.js").then((m) => m.ReadMode(+n, +a || 0)), (n) => `Чтение: сура ${n}`],
  [/^\/juz\/(\d+)(?:\/(\d+)(?:\/(\d+))?)?$/, (j, s, a) => import("./views/quran.js").then((m) => m.ReadJuz(+j, +s || 0, +a || 0)), (j) => `Чтение: джуз ${j}`],
  [/^\/page\/(\d+)$/, (p) => import("./views/quran.js").then((m) => m.ReadPage(+p)), (p) => `Чтение: страница ${p}`],
  [/^\/bookmarks$/, () => import("./views/bookmarks.js").then((m) => m.BookmarksView()), "Закладки"],
  [/^\/progress$/, () => import("./views/progress.js").then((m) => m.ProgressView()), "Прогресс"],
  [/^\/more$/, () => import("./views/more.js").then((m) => m.MoreView()), "Ещё"],
  [/^\/letters$/, () => import("./views/reference.js").then((m) => m.LettersRef()), "Алфавит"],
  [/^\/rules$/, () => import("./views/reference.js").then((m) => m.RulesRef()), "Правила таджвида"],
  [/^\/method$/, () => import("./views/reference.js").then((m) => m.MethodView()), "Методика"],
  [/^\/author$/, () => import("./views/author.js").then((m) => m.AuthorView()), "Послание от разработчика"],
  [/^\/thanks$/, () => import("./views/thanks.js").then((m) => m.ThanksView()), "Благодарности"],
  [/^\/changelog$/, () => import("./views/changelog.js").then((m) => m.ChangelogView()), "Версии"],
  [/^\/welcome$/, () => import("./views/onboard.js").then((m) => m.Onboarding()), "Знакомство"],
];
const FULLSCREEN = /^\/(learn|surah|practice|welcome|read|juz|page)/;

let routing = 0;
async function route() {
  const my = ++routing;
  stop();
  const path = location.hash.replace(/^#/, "") || "/";
  if (!store.get().profile.onboarded && !path.startsWith("/welcome")) { location.replace("#/welcome"); return; }
  const full = FULLSCREEN.test(path);
  document.body.classList.toggle("fullscreen", full);
  renderNav(path);
  for (const [re, fn, title] of routes) {
    const m = path.match(re);
    if (!m) continue;
    try {
      const el = await fn(...m.slice(1));
      if (my !== routing) return;
      view.replaceChildren(el);
      view.classList.remove("view-enter"); void view.offsetWidth; view.classList.add("view-enter");
      if (!full) window.scrollTo(0, 0);
      const name = typeof title === "function" ? title(...m.slice(1)) : title;
      setScreen(name, path); // для кнопки «Написать разработчику»
      hit(path, name);
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
  if (events.includes("level")) toast(h("span", null, icon("sparkle", { size: 18 }), " " + fill(`{n}, новый уровень — ${levelInfo().n}!`)), 3200);
  else if (events.includes("goal")) toast(h("span", null, icon("flame", { size: 18, fill: true, sw: 1 }), " " + fill(`{n}, цель дня выполнена! Серия: ${streakNow()}`)), 3200);
  fresh.forEach((b, i) => setTimeout(() => toast(h("span.toast-badge", null, h("span.tb-ic", null, b.icon), h("span", null, h("b", null, "Новая награда: "), b.name)), 3000), 800 + i * 3200));
}

// ---------- Запуск ----------
async function start() {
  applySettings();
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applySettings);
  store.on(() => applySettings());
  window.addEventListener("hashchange", route);
  initFullscreen();
  initWake();
  initFeedback();
  startMetrika();
  view.replaceChildren(h("div.boot", null, logo(72), h("div.spinner")));
  // связь медленная — говорим об этом, а не держим человека перед пустым экраном
  const slow = setTimeout(() => view.querySelector(".boot")?.append(
    h("p.muted.center", null, "Загрузка идёт дольше обычного. Проверьте интернет."),
    h("button.btn.secondary", { type: "button", onclick: () => location.reload() }, "Обновить")), 8000);
  // шрифты ждём не дольше четырёх секунд: без них приложение откроется, а текст перерисуется, когда они придут
  const fonts = Promise.race([
    Promise.all([document.fonts?.load?.('40px "Amiri Quran"', "بسم"), document.fonts?.load?.(`40px ${AR_FONTS[arFont()].css}`, "بسم")]).catch(() => {}),
    new Promise((ok) => setTimeout(ok, 4000))]);
  let loaded = false;
  for (let i = 0; i < 3 && !loaded; i++) { // данные: три попытки
    try { await Promise.all([loadBank(), loadSurahs()]); loaded = true; }
    catch (e) { console.error(e); await new Promise((ok) => setTimeout(ok, 1200)); }
  }
  await fonts;
  clearTimeout(slow);
  if (!loaded) {
    view.replaceChildren(h("div.page", null, h("div.card", null, h("h2", null, "Не удалось загрузить приложение"),
      h("p", null, "Похоже, связь прервалась. Проверьте интернет и попробуйте ещё раз. После первой удачной загрузки приложение открывается и без интернета."),
      h("button.btn.primary", { type: "button", onclick: () => location.reload() }, "Повторить"))));
    registerSW();
    return;
  }
  checkShaping();
  // крупный арабский текст подгоняется под ширину экрана: после каждой отрисовки, поворота экрана, смены масштаба
  new MutationObserver(queueFit).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", queueFit);
  store.on(queueFit);
  document.fonts?.ready.then(queueFit);
  route();
  registerSW();
  // когда есть что беречь — просим браузер не удалять данные приложения
  if (Object.keys(store.get().lessons).length) protectStorage();
}

// ---------- Статистика посещений (Яндекс.Метрика, анонимно) ----------
function startMetrika() {
  const s = store.get();
  const count = (map) => Object.values(map).filter((x) => x.done && !x.skipped).length;
  const nt = nextTarget();
  initMetrika({
    params: { Режим: isStandalone() ? "приложение" : "браузер" },
    user: {
      "Пройдено уроков": count(s.lessons),
      "Выучено сур": count(s.surahs),
      "Прогресс курса, %": Math.round(courseProgress().pct * 100),
      "Текущий этап": !s.profile.onboarded ? "новичок" : nt?.type === "lesson" ? lessonById[nt.id]?.unit ?? "—" : nt ? "суры" : "курс пройден",
      "Уровень": levelInfo().n,
      "Установлено": isInstalled() ? "да" : "нет",
    },
  });
  // «Написать автору» — ссылки на WhatsApp в разных местах приложения
  document.addEventListener("click", (e) => { if (e.target.closest?.('a[href^="https://wa.me/"]')) track("feedback", { Экран: location.hash || "#/" }); });
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
  // перезагрузка нужна только при обновлении. При самом первом заходе service worker тоже «берёт управление»,
  // но версия та же — перезагружать страницу посреди знакомства или урока незачем
  const updating = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (updating && !reloaded) { reloaded = true; location.reload(); } });
}

start();
