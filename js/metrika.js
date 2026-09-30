// Анонимная статистика посещений: Яндекс.Метрика.
// Номер счётчика — METRIKA_ID в version.js (0 — статистика выключена). Ученик может отключить её в «Ещё → Данные».
// Никаких имён и прогресса по отдельным людям: только просмотры экранов, цели (урок пройден, сура выучена…)
// и обобщённые параметры (сколько уроков пройдено, на каком этапе). Вебвизор выключен.
// На localhost и из файла ничего не отправляется — события пишутся в консоль (удобно проверять).
import { store } from "./store.js";
import { METRIKA_ID, APP_VERSION } from "./version.js";

const LOCAL = location.protocol === "file:" || /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$|\.(localhost|test)$/.test(location.hostname);
let started = false;
let opts = null;
let lastUrl = document.referrer;

export const metrikaAvailable = () => !!METRIKA_ID;
const allowed = () => !!METRIKA_ID && store.get().settings.analytics !== false;

// статистика никогда не должна мешать учёбе: любые ошибки здесь глушим
function send(method, ...args) {
  try {
    if (!started || !allowed()) return;
    if (LOCAL) { console.debug("[Метрика]", method, ...args); return; }
    window.ym?.(METRIKA_ID, method, ...args);
  } catch {}
}

/** Подключает счётчик. params — параметры визита, user — параметры посетителя.
 *  Если статистика отключена в настройках — подключится, как только её включат. */
export function initMetrika(o = {}) {
  if (opts) return;
  opts = o;
  start();
  store.on(start);
}
function start() {
  if (started || !allowed()) return;
  started = true;
  const { params = {}, user = {} } = opts;
  if (!LOCAL) {
    // официальный загрузчик Метрики: до загрузки tag.js вызовы ym() складываются в очередь
    window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
    window.ym.l = Date.now();
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://mc.yandex.ru/metrika/tag.js";
    document.head.append(s);
  }
  // defer: просмотры отправляем сами при смене экрана (адреса вида #/learn/3.2)
  send("init", { defer: true, clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false, params: { Версия: APP_VERSION, ...params } });
  send("userParams", user);
}

/** Просмотр экрана. */
export function hit(path, title) {
  const url = location.origin + location.pathname + "#" + path;
  send("hit", url, { title: title ? `${title} · TanWin` : document.title, referer: lastUrl });
  lastUrl = url;
}

/** Достижение цели. Идентификаторы целей перечислены в docs/ARCHITECTURE.md («Статистика посещений»). */
export function track(name, params) {
  send("reachGoal", name, params);
}
