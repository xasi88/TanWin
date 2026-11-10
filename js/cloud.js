// Облако прогресса (Firebase tanwin, 2026-11-10): один прогресс в Telegram, на сайте и в установленном приложении.
// Вход: в Telegram сам, по подписи Telegram; на сайте кнопкой «Привязать Telegram» (код через бота). Пропуск выдаёт
// бот (bot/src/index.js), дальше Firebase продлевает вход сам. Прогресс идёт прямо в Firebase (REST, без библиотек),
// не через бота: из России без VPN Cloudflare обрывает большие запросы.
// Документ progress/<uid>: data (прогресс строкой JSON), at (когда записан), v (версия). Правила: firestore.rules.
import { store } from "./store.js";
import { inTelegram, initData } from "./tg.js";
import { mergeStates, hasProgress } from "./merge.js";
import { APP_VERSION } from "./version.js";

const BOT = "https://tanwin-bot.gmarbigm.workers.dev";
const KEY = "AIzaSyD5Vosjj70_ahkb48dYhfgfBMcvJugKx4E"; // открытый ключ веб-приложения Firebase: доступ решают правила базы
const DOC = "https://firestore.googleapis.com/v1/projects/tanwin/databases/(default)/documents/progress/";
const META = "tanwin.cloud"; // { uid, refresh, syncedAt, dirty, localAt, okAt }
const PAUZA = 4000; // запись в облако не чаще раза в 4 секунды

let meta = {};
try { meta = JSON.parse(localStorage.getItem(META)) || {}; } catch { meta = {}; }
const saveMeta = () => { try { localStorage.setItem(META, JSON.stringify(meta)); } catch {} };

// Состояние для экрана настроек: off (не привязано), sync, ok, error
let status = meta.refresh ? "ok" : "off";
const listeners = new Set();
export const onCloud = (f) => { listeners.add(f); return () => listeners.delete(f); };
const setStatus = (s) => { status = s; listeners.forEach((f) => f(s)); };
export const cloudInfo = () => ({ status, linked: !!meta.refresh || inTelegram, okAt: meta.okAt || 0 });

function tgUid() {
  try { const u = JSON.parse(new URLSearchParams(initData).get("user") || "null"); return u && u.id ? "tg-" + u.id : ""; } catch { return ""; }
}

async function post(url, telo, form = false) {
  const r = await fetch(url, form
    ? { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: telo }
    : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(telo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error("облако: " + r.status); e.code = j.oshibka || j.error?.message || r.status; throw e; }
  return j;
}
// Запрос к боту: тело строкой без content-type, браузер не шлёт предварительный запрос (как в Рамбургере)
async function bot(put, telo) {
  const r = await fetch(BOT + put, { method: "POST", body: JSON.stringify(telo) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error("бот: " + r.status); e.code = j.oshibka || "sboj"; throw e; }
  return j;
}

let idToken = "", idExp = 0;
/** Пропуск Firebase из пропуска бота. */
async function signIn(customToken) {
  const j = await post("https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=" + KEY, { token: customToken, returnSecureToken: true });
  idToken = j.idToken; idExp = Date.now() + (Number(j.expiresIn) || 3600) * 1000 - 60000;
  // номер человека есть только внутри пропуска (поле user_id)
  const uid = JSON.parse(atob(j.idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).user_id;
  if (meta.uid && meta.uid !== uid) meta = {}; // другой человек Telegram: прошлое слияние не в счёт
  Object.assign(meta, { uid, refresh: j.refreshToken });
  saveMeta();
}
async function token() {
  if (idToken && Date.now() < idExp) return idToken;
  if (inTelegram && meta.uid !== tgUid()) {
    await signIn((await bot("/vhod", { d: initData })).token);
    return idToken;
  }
  if (!meta.refresh) throw Object.assign(new Error("нет входа"), { code: "off" });
  try {
    const j = await post("https://securetoken.googleapis.com/v1/token?key=" + KEY, "grant_type=refresh_token&refresh_token=" + encodeURIComponent(meta.refresh), true);
    idToken = j.id_token; idExp = Date.now() + (Number(j.expires_in) || 3600) * 1000 - 60000;
    meta.refresh = j.refresh_token; saveMeta();
  } catch (e) {
    if (inTelegram) { await signIn((await bot("/vhod", { d: initData })).token); return idToken; }
    throw e;
  }
  return idToken;
}

async function readDoc(t) {
  const r = await fetch(DOC + meta.uid, { headers: { authorization: "Bearer " + t } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("облако: чтение " + r.status);
  const f = (await r.json()).fields || {};
  return { at: Number(f.at?.integerValue) || 0, data: f.data?.stringValue || "" };
}
async function writeDoc(t, data, at) {
  const r = await fetch(DOC + meta.uid, {
    method: "PATCH", headers: { authorization: "Bearer " + t, "content-type": "application/json" },
    body: JSON.stringify({ fields: { data: { stringValue: data }, at: { integerValue: String(at) }, v: { stringValue: APP_VERSION } } }),
  });
  if (!r.ok) throw new Error("облако: запись " + r.status);
}

let applying = false;
function apply(s, keep) {
  applying = true;
  try { store.cloudApply(s, keep); } finally { applying = false; }
  // экран рисуется заново с новым прогрессом; урок и чтение не прерываем: они возьмут его на следующем экране
  if (!document.body.classList.contains("study") && !document.body.classList.contains("fullscreen")) dispatchEvent(new HashChangeEvent("hashchange"));
}

let busy = null, again = false;
/** Сверка с облаком: взять новое из облака, отдать своё, при правках с двух сторон слить. */
export function sync() {
  if (busy) { again = true; return busy; }
  busy = (async () => {
    setStatus("sync");
    const t = await token();
    const mark = meta.localAt || 0;
    const cloud = await readDoc(t);
    let push = false;
    if (!cloud || !cloud.data) push = true;
    else if (cloud.at === meta.syncedAt) push = !!meta.dirty;
    else {
      const remote = JSON.parse(cloud.data);
      const local = store.get();
      if (meta.syncedAt == null || meta.dirty) {
        // первая привязка или правки с двух сторон: сливаем, прежний прогресс устройства можно вернуть
        apply(mergeStates(local, remote, meta.localAt || 0, cloud.at), hasProgress(local));
        push = true;
      } else apply(remote, false);
      meta.syncedAt = cloud.at;
    }
    if (push) { const at = Date.now(); await writeDoc(t, JSON.stringify(store.get()), at); meta.syncedAt = at; }
    meta.dirty = (meta.localAt || 0) !== mark; // правка во время сверки: запишется следующей
    meta.okAt = Date.now(); saveMeta();
    setStatus("ok");
  })().catch((e) => {
    setStatus(e.code === "off" ? "off" : "error");
    if (e.code !== "off") console.warn(e);
  }).finally(() => {
    busy = null;
    if (again) { again = false; later(); }
  });
  return busy;
}

let timer = 0;
function later() { clearTimeout(timer); timer = setTimeout(sync, PAUZA); }

/** Сайт: привязать Telegram, шаг 1. Код привязки (16 случайных знаков) придумывает сам сайт: ссылку на бота
 *  можно открыть в том же нажатии, без ожидания ответа (2026-11-10, автор: «слишком сложно»). */
export function linkStart() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  const kod = Array.from(b, (x) => "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]).join("");
  return { kod, url: "https://t.me/tanwin88_bot?start=svyaz_" + kod };
}
/** Шаг 2: ждёт, пока бот получит код (до 10 минут), входит и сливает прогресс. stop(): человек ушёл с экрана. */
export async function linkWait(kod, stop = () => false) {
  const konec = Date.now() + 10 * 60000;
  while (Date.now() < konec && !stop()) {
    await new Promise((ok) => setTimeout(ok, 3000));
    const j = await bot("/kod-proverka", { kod }).catch((e) => { if (e.code === "ustarel") throw e; return { zhdu: true }; });
    if (j.token) {
      meta = {}; // новая привязка: первая сверка сольёт прогресс устройства и облака
      await signIn(j.token);
      listen();
      await sync();
      return true;
    }
  }
  return false;
}

/** Отвязать Telegram на этом устройстве. Прогресс остаётся и здесь, и в облаке. */
export function unlink() { meta = {}; idToken = ""; saveMeta(); setStatus("off"); }

let started = false;
function listen() {
  if (started) return;
  started = true;
  store.on(() => {
    if (applying) return;
    meta.dirty = true; meta.localAt = Date.now(); saveMeta();
    later();
  });
  // вернулись в приложение: берём новое с других устройств; уходим: отдаём своё сразу
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); else if (meta.dirty) sync(); });
}

export function initCloud() {
  if (!inTelegram && !meta.refresh) return;
  listen();
  sync();
}
