// Анонимная статистика посещений: Яндекс.Метрика и PostHog (одни и те же события уходят в обе системы).
// Номер счётчика — METRIKA_ID, ключ PostHog — POSTHOG_KEY в version.js (0 или пусто — выключено). Ученик может отключить статистику в «Ещё → Данные».
// Никаких имён и прогресса по отдельным людям: только просмотры экранов, цели (урок пройден, сура выучена…)
// и обобщённые параметры (сколько уроков пройдено, на каком этапе, ученик или ученица). Вебвизор, запись сеансов и автосбор нажатий выключены.
// На localhost и из файла ничего не отправляется — события пишутся в консоль (удобно проверять).
import { store } from "./store.js";
import { METRIKA_ID, POSTHOG_KEY, POSTHOG_HOST, APP_VERSION } from "./version.js";
import "./posthog-loader.js";

const LOCAL = location.protocol === "file:" || /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])$|\.(localhost|test)$/.test(location.hostname);
let started = false;
let opts = null;
let lastUrl = document.referrer;

export const metrikaAvailable = () => !!METRIKA_ID || !!POSTHOG_KEY;
const allowed = () => metrikaAvailable() && store.get().settings.analytics !== false;

// статистика никогда не должна мешать учёбе: любые ошибки здесь глушим
function send(method, ...args) {
  try {
    if (!started || !allowed()) return;
    if (LOCAL) { console.debug("[Статистика]", method, ...args); return; }
    if (METRIKA_ID) window.ym?.(METRIKA_ID, method, ...args);
  } catch {}
  try {
    if (!started || !allowed() || LOCAL || !POSTHOG_KEY) return;
    const ph = window.posthog;
    if (!ph) return;
    if (method === "init") ph.register(args[0].params);
    else if (method === "userParams") ph.register(args[0]);
    else if (method === "hit") ph.capture("$pageview", { $current_url: args[0], title: args[1].title, $referrer: args[1].referer });
    else if (method === "reachGoal") ph.capture(args[0], args[1]);
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
    // PostHog: без автосбора нажатий (в них мог бы попасть текст с именем), без записи сеансов и опросов;
    // просмотры экранов отправляем сами. Данные хранятся в localStorage, без cookie.
    if (POSTHOG_KEY) window.posthog?.init(POSTHOG_KEY, { api_host: POSTHOG_HOST, defaults: "2026-05-30", person_profiles: "identified_only", autocapture: false, capture_pageview: false, capture_pageleave: false, disable_session_recording: true, disable_surveys: true, capture_dead_clicks: false, persistence: "localStorage" });
  }
  // defer: просмотры отправляем сами при смене экрана (адреса вида #/learn/3.2)
  send("init", { defer: true, clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false, params: { Версия: APP_VERSION, ...params } });
  send("userParams", user);
}

/** Обобщённые сведения из знакомства: кто учится и как к нему обращаться. Имя не передаётся никогда. */
export const whoParams = () => {
  const p = store.get().profile;
  return { "Кто учится": p.gender === "f" ? "ученица" : p.gender === "m" ? "ученик" : "не указано", "Обращение": p.form === "ty" ? "на «ты»" : "на «вы»" };
};
/** Обновляет параметры посетителя (например, после знакомства — они известны не с начала визита). */
export function user(params) {
  send("userParams", params);
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
