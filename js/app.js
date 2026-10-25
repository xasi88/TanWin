// TanWin: оболочка приложения: маршруты, навигация, тема, офлайн.
import { h, $, icon, toast, modal, checkShaping, queueFit, AR_FONTS, arFont } from "./ui.js";
import { store, streakNow, levelInfo, todayXp, protectStorage, onStorageFail } from "./store.js";
import { loadBank, loadSurahs } from "./data.js";
import { stop, onFail } from "./audio.js";
import { checkBadges, courseProgress, nextTarget, lessonById } from "./path.js";
import { APP_VERSION } from "./version.js";
import { canPrompt, install, isInstalled, isStandalone, isIOS, manualHint, whereIcon } from "./install.js";
import { initMetrika, hit, track, whoParams } from "./usage.js";
import { initFeedback, setScreen } from "./feedback.js";
import { fill } from "./tutor.js";
import { initWake } from "./wake.js";
import { ROOT } from "./env.js";
import { initFullscreen, canFullscreen, isFullscreen, setFullscreen, onFullscreenChange } from "./fullscreen.js";

const view = $("#view");
const nav = $("#nav");
window.twStarted = true; // программа загрузилась: запасная надпись из index.html больше не нужна

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
  root.dataset.arFont = arFont(); // по нему одна буква Йа в «Мадине» берёт шрифт с точками (.ya-dots)
  if (root.style.getPropertyValue("--ar-font") !== font) {
    root.style.setProperty("--ar-font", font);
    // у другого шрифта другая ширина слов: после загрузки файла заново подгоняем крупные слова под карточки
    document.fonts?.load?.(`40px ${font}`, "بسم")?.then(queueFit, () => {});
  }
  const dark = s.theme === "dark" || (s.theme === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  // строка браузера в цвет фона, и при чтении Корана тоже
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#1d1147" : "#6b3ff0");
}

// ---------- Навигация ----------
const TABS = [
  { path: "/", label: "Путь", ic: "path" },
  { path: "/review", label: "Практика", ic: "repeat" },
  { path: "/quran", label: "Мой Коран", ic: "book" },
  { path: "/progress", label: "Прогресс", ic: "chart" },
  { path: "/more", label: "Ещё", ic: "more" },
];
const MORE_SUB = /^\/(settings|letters|rules|method|author|thanks|changelog)$/;
function renderNav(active) {
  const s = store.get();
  const lv = levelInfo();
  nav.replaceChildren(
    h("a.brand", { href: "#/", "aria-label": "TanWin: на главную" }, logo(), h("span.brand-name", null, "TanWin"), h("span.brand-sub", null, "путь к чтению Корана")),
    h("div.nav-tabs", null, ...TABS.map((t) => { // обычные ссылки, а не «вкладки»: так их называет программа чтения с экрана
      // экраны внутри «Ещё» (настройки, справочники, версии) подсвечивают «Ещё»
      const on = t.path === "/" ? active === "/" : active.startsWith(t.path) || (t.path === "/more" && MORE_SUB.test(active));
      return h("a.tab", { href: "#" + t.path, class: on ? "on" : "", "aria-current": on ? "page" : null }, icon(t.ic, { size: 24, sw: 2.2 }), h("span", null, t.label));
    })),
    canFullscreen() ? h("button.nav-fs", { type: "button", "data-fs-switch": true, onclick: () => setFullscreen(!isFullscreen()) },
      icon(isFullscreen() ? "shrink" : "expand", { size: 18 }), h("span", null, isFullscreen() ? "Выйти из полного экрана" : "На весь экран")) : "",
    h("div.nav-foot", null,
      h("div.nf-row", null, icon("flame", { size: 18, fill: true, sw: 1, cls: streakNow() ? "fire" : "" }), h("b", null, streakNow()), h("span", null, "дней подряд")),
      h("div.nf-row", null, icon("nur", { size: 18, fill: true, sw: 1, cls: "nur" }), h("b", null, s.xp), h("span", null, `нура · уровень ${lv.n}`)),
      h("a.nf-ver", { href: "#/changelog" }, `Версия ${APP_VERSION} · в разработке`)));
}
export async function installApp() {
  if (isInstalled()) toast(`TanWin уже установлен. Откройте его со значка ${whereIcon()}.`, 6000);
  else if (canPrompt()) { if (await install()) toast("TanWin установлен. Ищите его на рабочем столе ✓"); }
  // iPhone и iPad: окна установки нет, фильм показывает, куда нажать (js/kino/install.js). На живом iPhone не проверено.
  else if (isIOS()) (await import("./kino/install.js")).showInstallFilm();
  else toast(manualHint(), 6000);
}
/** Браузер не сохраняет прогресс: говорим один раз за запуск. */
function storageWarning() {
  modal((close) => h("div.confirm", null,
    h("h3", null, "Прогресс не сохраняется на этом устройстве"),
    h("p", null, "Браузер не даёт TanWin сохранять данные: запрещено сохранять данные сайтов или память заполнена. Пройденные уроки пропадут, когда вы закроете страницу. Откройте TanWin в обычном окне браузера или освободите место на устройстве."),
    h("button.btn.primary.wide", { type: "button", onclick: () => close() }, "Понятно")));
}
/** Запись прогресса не прочиталась: копия отложена (store.js), говорим один раз и предлагаем сохранить её в файл. */
function brokenWarning() {
  modal((close) => h("div.confirm", null,
    h("h3", null, "Прогресс не прочитался"),
    h("p", null, "Запись прогресса на этом устройстве повреждена: TanWin не смог её прочитать и открывается с нуля. Копия записи отложена. Сохраните её в файл и напишите автору: по файлу прогресс можно восстановить. Копия ждёт в «Ещё» → «Настройки» → «Прогресс и данные»."),
    h("div.row.end", null,
      h("button.btn.ghost", { type: "button", onclick: () => close() }, "Позже"),
      h("button.btn.primary", { type: "button", onclick: async () => { close(); (await import("./views/more.js")).saveBrokenFile(); } }, "Сохранить"))));
}
onFullscreenChange(() => renderNav(location.hash.replace(/^#/, "") || "/"));

// Эмблема 3.0: жёлтая звезда-наклейка с открытой книгой (тот же рисунок, что в icons/icon.svg, без фона)
export const EMBLEM = `<path d="M256 70L297.4 150.4L383.2 122.8L355.6 208.6L436 250L355.6 291.4L383.2 377.2L297.4 349.6L256 430L214.6 349.6L128.8 377.2L156.4 291.4L76 250L156.4 208.6L128.8 122.8L214.6 150.4Z" fill="#130a30" stroke="#130a30" stroke-width="16" stroke-linejoin="round" transform="translate(14 16)"/>
  <path d="M256 70L297.4 150.4L383.2 122.8L355.6 208.6L436 250L355.6 291.4L383.2 377.2L297.4 349.6L256 430L214.6 349.6L128.8 377.2L156.4 291.4L76 250L156.4 208.6L128.8 122.8L214.6 150.4Z" fill="#fad12b" stroke="#130a30" stroke-width="16" stroke-linejoin="round"/>
  <path d="M256 212C234 196 202 190 176 193V299C202 296 234 302 256 318Z" fill="#fff8f2" stroke="#130a30" stroke-width="12" stroke-linejoin="round"/>
  <path d="M256 212C278 196 310 190 336 193V299C310 296 278 302 256 318Z" fill="#c8f53a" stroke="#130a30" stroke-width="12" stroke-linejoin="round"/>
  <path d="M195 226C211 225 227 229 240 236M195 254C211 253 227 257 240 264M317 226C301 225 285 229 272 236M317 254C301 253 285 257 272 264" fill="none" stroke="#130a30" stroke-width="8" stroke-linecap="round"/>`;
export function logo(size = 34) {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "60 56 408 408"); s.setAttribute("width", size); s.setAttribute("height", size); s.setAttribute("class", "logo");
  s.innerHTML = EMBLEM;
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
  [/^\/mark\/(\w+)(\/more)?$/, (id, more) => import("./views/quran.js").then((m) => m.ReadMark(id, !!more)), "Чтение: цель закладки"],
  [/^\/page\/(\d+)$/, (p) => import("./views/quran.js").then((m) => m.ReadPage(+p)), (p) => `Чтение: страница ${p}`],
  // закладки живут в «Моём Коране»: старый адрес раскрывает их там
  [/^\/bookmarks$/, () => import("./views/quran.js").then((m) => m.MarksRoute()), "Закладки"],
  [/^\/progress$/, () => import("./views/progress.js").then((m) => m.ProgressView()), "Прогресс"],
  [/^\/more$/, () => import("./views/more.js").then((m) => m.MoreView()), "Ещё"],
  [/^\/settings$/, () => import("./views/more.js").then((m) => m.SettingsView()), "Настройки"],
  [/^\/letters$/, () => import("./views/reference.js").then((m) => m.LettersRef()), "Алфавит"],
  [/^\/rules$/, () => import("./views/reference.js").then((m) => m.RulesRef()), "Правила таджвида"],
  [/^\/method$/, () => import("./views/reference.js").then((m) => m.MethodView()), "Методика"],
  [/^\/author$/, () => import("./views/author.js").then((m) => m.AuthorView()), "Послание от разработчика"],
  [/^\/thanks$/, () => import("./views/thanks.js").then((m) => m.ThanksView()), "Благодарности"],
  [/^\/changelog$/, () => import("./views/changelog.js").then((m) => m.ChangelogView()), "Версии"],
  // «/welcome/level»: сразу выбор уровня и проверка (кнопка «Я уже учился» на карточке новичка)
  [/^\/welcome(\/level)?$/, () => import("./views/onboard.js").then((m) => m.Onboarding({ level: location.hash.endsWith("/level") })), "Знакомство"],
];
const FULLSCREEN = /^\/(learn|surah|practice|welcome|read|juz|page|mark)/;
const STUDY = /^\/(learn|surah|practice|welcome)/;

let routing = 0;
async function route() {
  const my = ++routing;
  stop();
  store.sync(); // другая вкладка могла что-то записать: новый экран рисуем по свежим данным
  const path = location.hash.replace(/^#/, "") || "/";
  // 3.0 (решение автора 2026-10-25): новичок сразу видит «Путь» и меню, знакомство открывается по его выбору (карточка на «Пути»).
  // Раньше новичка без выбора отправляли в знакомство, и многие уходили, не увидев приложения.
  // банк слов и список сур нужны всем экранам, кроме знакомства: в нём их не ждём
  if (!dataReady && !path.startsWith("/welcome")) {
    view.replaceChildren(h("div.boot", null, logo(72), h("div.spinner")));
    const ok = await loadData();
    if (my !== routing) return;
    if (!ok) { loadFailed(); return; }
  }
  const full = FULLSCREEN.test(path);
  applySettings(); // цвет строки браузера: обычный экран или спокойная страница чтения
  document.body.classList.toggle("fullscreen", full);
  document.body.classList.toggle("study", STUDY.test(path)); // урок, «Практика», знакомство: сообщения сверху (css)
  if (!full) applyUpdate(); // обновление, отложенное на время урока или чтения, включается сразу после него
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
      if (path === "/") updateNotice(); // один раз и только на «Пути»: «приложение обновляется само»
    } catch (e) {
      console.error(e);
      // связи нет, а нужного (например, суры, которую ещё не открывали) на устройстве нет: говорим это словами, без текста ошибки
      const net = !navigator.onLine || /fetch|network|load failed/i.test(String(e?.message));
      view.replaceChildren(h("div.page", null, h("div.card", null,
        h("h2", null, net ? "Нет связи" : "Что-то пошло не так"),
        h("p", null, net ? "Этого на устройстве ещё нет. Суры и экраны сохраняются, когда их открывают при интернете: откройте один раз со связью, дальше будет работать и без неё. Связь есть, а не открывается? Включите или выключите VPN." : "Проверьте подключение к интернету и обновите страницу."),
        net ? null : h("pre.small", null, String(e?.message || e)),
        h("a.btn.primary", { href: "#/" }, "На главную"))));
    }
    return;
  }
  view.replaceChildren(h("div.page", null, h("div.card", null, h("h2", null, "Страница не найдена"), h("a.btn.primary", { href: "#/" }, "На главную"))));
}
export const go = (p) => { location.hash = "#" + p; };

/** Показать новые награды и события после урока. */
export function celebrate(events = []) {
  const fresh = checkBadges();
  if (events.includes("level")) toast(h("span", null, icon("sparkle", { size: 18 }), " " + fill(`{n}, новый уровень: ${levelInfo().n}!`)), 3200);
  else if (events.includes("goal")) toast(h("span", null, icon("flame", { size: 18, fill: true, sw: 1 }), " " + fill(`{n}, цель дня выполнена! Серия: ${streakNow()}`)), 3200);
  fresh.forEach((b, i) => setTimeout(() => toast(h("span.toast-badge", null, h("span.tb-ic", null, b.icon), h("span", null, h("b", null, "Новая награда: "), b.name)), 3000), 800 + i * 3200));
}

// ---------- Запуск ----------
// Банк слов и список сур: три попытки. Не удалось: следующий экран попробует снова
let dataReady = false, dataP = null;
function loadData() {
  return dataP ||= (async () => {
    for (let i = 0; i < 3; i++) {
      try { await Promise.all([loadBank(), loadSurahs()]); return (dataReady = true); }
      catch (e) { console.error(e); await new Promise((ok) => setTimeout(ok, 1200)); }
    }
    dataP = null;
    return false;
  })();
}
function loadFailed() {
  view.replaceChildren(h("div.page", null, h("div.card", null, h("h2", null, "Не удалось загрузить приложение"),
    h("p", null, "Похоже, связь прервалась. Проверьте интернет и попробуйте ещё раз. После первой удачной загрузки приложение открывается и без интернета."),
    h("p", null, "Если у вас включён VPN, попробуйте его выключить. Если выключен, попробуйте включить: иногда сайт не открывается именно из-за этого."),
    h("button.btn.primary", { type: "button", onclick: () => location.reload() }, "Повторить"))));
}

async function start() {
  applySettings();
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applySettings);
  store.on(() => applySettings());
  window.addEventListener("hashchange", route);
  initFullscreen();
  initWake();
  initFeedback();
  // запись не загрузилась, одна подсказка на всё приложение: уроки, карточки слов, чтец.
  // В уроке она одна на урок: при плохой связи она всплывала на каждом звуке и закрывала кнопки (разбор 2026-10-24)
  let failIn = "";
  addEventListener("hashchange", () => { failIn = ""; });
  onFail(() => {
    if (document.body.classList.contains("study")) { if (failIn === location.hash) return; failIn = location.hash; }
    toast("Звук не загружается. Проверьте интернет. Не помогло? Включите или выключите VPN.", 6000);
  });
  startMetrika();
  // на странице уже стоит заставка с описанием сайта (index.html): оставляем её до первого экрана
  if (!view.querySelector(".boot")) view.replaceChildren(h("div.boot", null, logo(72), h("div.spinner")));
  // связь медленная: говорим об этом, а не держим человека перед пустым экраном
  const slow = setTimeout(() => view.querySelector(".boot")?.append(
    h("p.muted.center", null, "Загрузка идёт дольше обычного. Проверьте интернет."),
    h("p.muted.center", null, "Если у вас включён VPN, попробуйте его выключить. Если выключен, попробуйте включить: иногда сайт не открывается именно из-за этого."),
    h("button.btn.secondary", { type: "button", onclick: () => location.reload() }, "Обновить")), 8000);
  // шрифты ждём не дольше четырёх секунд: без них приложение откроется, а текст перерисуется, когда они придут
  const fonts = Promise.race([
    Promise.all([document.fonts?.load?.('40px "Amiri Quran"', "بسم"), document.fonts?.load?.(`40px ${AR_FONTS[arFont()].css}`, "بسم")]).catch(() => {}),
    new Promise((ok) => setTimeout(ok, 4000))]);
  // знакомство не ждёт банка слов (около 120 КБ); «Путь», куда теперь попадает и новичок, ждёт
  const loaded = location.hash.startsWith("#/welcome") || await loadData();
  await fonts;
  clearTimeout(slow);
  if (!loaded) {
    loadFailed();
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
  import("./sound.js").then((m) => m.initSound()).catch(() => {}); // звук без интернета: что скачано, докачка этапа
  // когда есть что беречь: просим браузер не удалять данные приложения
  if (Object.keys(store.get().lessons).length) protectStorage();
  setTimeout(() => onStorageFail(storageWarning), 1500); // после первого экрана, чтобы окно не мигнуло под ним
  if (store.brokenInfo()?.fresh) setTimeout(brokenWarning, 1500);
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
      "Текущий этап": !s.profile.onboarded ? "новичок" : nt?.type === "lesson" ? lessonById[nt.id]?.unit ?? "-" : nt ? "суры" : "курс пройден",
      "Уровень": levelInfo().n,
      "Установлено": isInstalled() ? "да" : "нет",
      ...whoParams(),
    },
  });
  // «Написать автору»: ссылки на WhatsApp в разных местах приложения
  document.addEventListener("click", (e) => { if (e.target.closest?.('a[href^="https://wa.me/"]')) track("feedback", { Экран: location.hash || "#/" }); });
}

// ---------- Офлайн (service worker) ----------
export let swReg = null;
const CHECK_EVERY = 30 * 60 * 1000; // при возврате в приложение спрашиваем о новой версии не чаще раза в 30 минут
let lastCheck = 0;
// Плашка на «Пути» (3.0, 2026-10-24): новая версия ждёт, или проверить обновление не удаётся дольше трёх дней (плохой VPN)
const UPD_OK = "tanwin.updOk", STALE = 3 * 864e5;
let updFailed = false;
const updListeners = new Set();
export const onUpdateState = (f) => { updListeners.add(f); return () => updListeners.delete(f); };
const emitUpd = () => updListeners.forEach((f) => f());
/** «ready»: новая версия скачана и ждёт; «stale»: обновление давно не удаётся проверить; null: всё в порядке. */
export function updateState() {
  if (swReg?.waiting && navigator.serviceWorker.controller) return "ready";
  let ok = 0;
  try {
    ok = +localStorage.getItem(UPD_OK) || 0;
    // удачной проверки ещё не было (первый запуск без связи): отсчёт трёх дней идёт с этого запуска, а не с 1970 года
    if (!ok) localStorage.setItem(UPD_OK, String(ok = Date.now()));
  } catch {}
  return updFailed && Date.now() - ok > STALE ? "stale" : null;
}
export const applyNow = () => swReg?.waiting?.postMessage({ type: "SKIP_WAITING" });
/** Спросить сервер о новой версии и запомнить, получилось ли. */
async function tryUpdate() {
  try {
    await swReg.update();
    updFailed = false;
    try { localStorage.setItem(UPD_OK, String(Date.now())); } catch {}
  } catch { updFailed = true; }
  emitUpd();
}
const inLesson = () => document.body.classList.contains("fullscreen");

/** Новая версия уже скачана и ждёт (например, пришла во время урока): включаем её, если человек сейчас не на уроке и не в чтении. */
function applyUpdate() {
  const w = swReg?.waiting;
  if (w && navigator.serviceWorker.controller && !inLesson()) w.postMessage({ type: "SKIP_WAITING" });
}

function registerSW() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register(new URL("sw.js", ROOT)).then((reg) => {
    swReg = reg;
    lastCheck = Date.now(); // при запуске браузер сам проверяет новую версию; мы проверяем ещё раз, чтобы знать, дошла ли проверка
    applyUpdate();
    setTimeout(tryUpdate, 4000);
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      nw?.addEventListener("statechange", () => {
        if (nw.state === "installed" && navigator.serviceWorker.controller) {
          // вне урока обновляемся сразу; во время урока по кнопке или само после урока (см. route), чтобы не прервать занятие
          if (!inLesson()) { nw.postMessage({ type: "SKIP_WAITING" }); return; }
          emitUpd();
          toast(h("span", null, "Доступно обновление. ", h("button.link", { type: "button", onclick: () => { nw.postMessage({ type: "SKIP_WAITING" }); } }, "Обновить")), 8000);
        }
      });
    });
  }).catch(async () => {
    // сервер не ответил (плохой VPN): работает уже установленная версия, а проверка обновления не удалась
    swReg = await navigator.serviceWorker.getRegistration().catch(() => null) || null;
    if (swReg) { updFailed = true; emitUpd(); }
  });
  // перезагрузка нужна только при обновлении. При самом первом заходе service worker тоже «берёт управление»,
  // но версия та же: перезагружать страницу посреди знакомства или урока незачем.
  // Был ли уже управляющий service worker, смотрим при каждом событии, а не один раз при запуске: иначе обновление,
  // пришедшее в первую открытую страницу, не перезапускало её, и старый код работал с файлами новой версии (разбор 2026-10-25)
  let controlled = !!navigator.serviceWorker.controller, reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!controlled) { controlled = true; loadData(); } // первый заход: банк слов уже в памяти service worker, знакомство берёт его оттуда без второго скачивания
    else if (!reloaded) { reloaded = true; location.reload(); }
  });
  // приложение часто не закрывают, а сворачивают: тогда браузер сам новую версию не ищет. Ищем при возврате на экран
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !swReg) return;
    applyUpdate();
    if (Date.now() - lastCheck < CHECK_EVERY) return;
    lastCheck = Date.now();
    tryUpdate();
  });
}

/** «Проверить обновление»: просим браузер прямо сейчас сходить за новой версией (обычно он делает это сам при запуске). */
export async function checkUpdate() {
  if (!swReg) return toast("Обновите страницу: этого достаточно, чтобы получить новую версию.", 5000);
  toast("Проверяю обновление…", 20000);
  try {
    await swReg.update();
    updFailed = false;
    try { localStorage.setItem(UPD_OK, String(Date.now())); } catch {}
    emitUpd();
    if (swReg.installing || swReg.waiting) {
      toast("Есть обновление, загружаю. Приложение перезапустится само.", 20000);
      swReg.waiting?.postMessage({ type: "SKIP_WAITING" });
    } else toast(`У вас последняя версия: ${APP_VERSION} ✓`, 4000);
  } catch { updFailed = true; emitUpd(); toast("Не получилось проверить обновление. Включите или выключите VPN и попробуйте ещё раз.", 7000); }
}

/**
 * Окно «Приложение обновляется само»: один раз каждому. Обновление может не дойти из-за VPN (включённого или выключенного),
 * и тогда приложение зависает или не открывается: человек должен знать, что делать.
 * Новичку в первые дни не показываем (диагностика 2026-10-21, техника п.6): только с третьего дня, на «Пути».
 */
const NOTE = "tanwin.updNote";
const NOTE_AFTER = 2 * 864e5;
function updateNotice() {
  if (Date.now() - (store.get().profile.created || 0) < NOTE_AFTER) return;
  try { if (localStorage.getItem(NOTE) || navigator.webdriver) return; localStorage.setItem(NOTE, "1"); } catch { return; }
  modal((close) => h("div.upd-note", null,
    h("h2", null, "Приложение обновляется само"),
    h("p", null, "Мы почти каждый день делаем TanWin лучше. Обновления приходят сами: устанавливать ничего не нужно."),
    h("p", null, "Если после обновления страница не открылась или зависла, нажмите «Проверить обновление» в разделе «Ещё». Иногда помогает включить или выключить VPN."),
    h("button.btn.primary.wide", { type: "button", onclick: close }, "Понятно")));
}

start();
