// Звук без интернета (3.0, 2026-10-24). Причина: у пожилого человека с плохим VPN замолчали уроки.
// Звук каждого этапа (список в data/sounds.json, его составляет tools/audit/sound-packs.mjs) скачивается заранее:
// сам, пока есть связь (этап, на котором ученик сейчас), или по кнопке у этапа на «Пути» и в «Настройках».
// Лежит в своём кэше и сам не удаляется. Когда связи нет или звук не загрузился, урок берёт слова и примеры
// только со скачанным звуком (js/prefer.js); при хорошей связи выбирает из всех слов, как раньше.
import { wordAudioUrl, husaryUrl, RECITERS, reciterOf, loadSurah } from "./data.js";
import { setPrefer } from "./prefer.js";
import { onFail } from "./audio.js";
import { store } from "./store.js";
import { ROOT } from "./env.js";
import { h, icon, toast } from "./ui.js";

export const SOUND = "tanwin-sound"; // имя кэша; такое же в sw.js
const pad = (n) => String(n).padStart(3, "0");
const KEY = /^\d{3}_\d{3}_\d{3}$/;
// средний размер записи, байт: слово Quran.com, аят Хусари «муаллим», аят другого чтеца (замер 2026-10-24)
const AVG = { w: 50e3, h: 160e3, r: 120e3 };

/**
 * Звук примера: записи слов («002_255_005»), аят голосом Хусари для куска аята («h:002255»).
 * Пример: слово банка ({ a: ключ }), пара слов ({ w1, w2 }), место в аяте ({ s, a, words }), список таких.
 */
export function soundKeys(x, out = [], d = 0) {
  if (!x || d > 3) return out;
  if (typeof x === "string") { if (KEY.test(x)) out.push(x); return out; }
  if (Array.isArray(x)) { for (const y of x) soundKeys(y, out, d + 1); return out; }
  if (typeof x !== "object") return out;
  if (typeof x.a === "string" && KEY.test(x.a)) out.push(x.a);
  if (typeof x.s === "number" && typeof x.a === "number" && Array.isArray(x.words)) {
    // место в аяте: звучит кусок аята голосом Хусари и само слово со следующим; аят целиком (нажать на любое слово): все слова
    out.push(`h:${pad(x.s)}${pad(x.a)}`);
    const ws = typeof x.wi === "number" ? [x.wi, x.wi + 1].filter((i) => i < x.words.length) : x.words.map((_, i) => i);
    for (const i of ws) out.push(`${pad(x.s)}_${pad(x.a)}_${pad(i + 1)}`);
  }
  for (const k of ["w1", "w2", "x"]) if (x[k] && typeof x[k] === "object") soundKeys(x[k], out, d + 1);
  return out;
}

/** Адрес записи: слово; «h:SSSAAA», аят Хусари; «r:SSSAAA», аят выбранного чтеца. */
export function soundUrl(k) {
  const s = +k.slice(2, 5), a = +k.slice(5);
  if (k.startsWith("h:")) return husaryUrl(s, a);
  if (k.startsWith("r:")) return RECITERS[reciterOf(store.get().settings.reciter)].url(s, a);
  return wordAudioUrl(k);
}
const size = (k) => AVG[k[1] === ":" ? k[0] : "w"];

let saved = new Set(); // адреса скачанных записей
let packs = null; // data/sounds.json: { units: { [этап]: [ключи] } }
const has = (k) => saved.has(soundUrl(k));
let trouble = false; // связи нет или запись не загрузилась: уроки берут примеры со скачанным звуком
const prefer = () => setPrefer(saved.size && trouble ? (x) => soundKeys(x).every(has) : null);
const setTrouble = (on) => { if (trouble !== on) { trouble = on; prefer(); } };
/** Проверка связи с сервером звука: одна короткая запись, не дольше 5 секунд. */
async function probe() {
  if (!navigator.onLine) return setTrouble(true);
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
  try { setTrouble(!(await fetch(wordAudioUrl("001_001_001") + "?tw=1", { method: "HEAD", signal: ctl.signal })).ok); } catch { setTrouble(true); }
  clearTimeout(t);
}

const BYTES = "tanwin.soundBytes";
const bytes = () => { try { return +localStorage.getItem(BYTES) || 0; } catch { return 0; } };
const addBytes = (n) => { try { localStorage.setItem(BYTES, String(bytes() + n)); } catch {} };
/** Сколько места занимает скачанный звук, МБ. */
export const savedMb = () => Math.round(bytes() / 1048576);

export async function loadPacks() {
  if (packs) return packs;
  try { packs = await (await fetch(new URL("data/sounds.json", ROOT))).json(); } catch { packs = { units: {} }; }
  return packs;
}

/** Звук этапа: ключи записей. Этап 14 (суры): следующие три суры пути, аяты голосом выбранного чтеца и все слова. */
export async function unitKeys(u) {
  await loadPacks();
  if (u !== 14) return packs.units[u] || [];
  const { SURAH_PATH } = await import("./course.js");
  const { surahDone } = await import("./store.js");
  const next = SURAH_PATH.filter((n) => !surahDone(n)).slice(0, 3);
  const out = [];
  for (const n of next) {
    const d = await loadSurah(n);
    d.v.forEach((v, i) => { out.push(`r:${pad(n)}${pad(i + 1)}`); v[0].forEach((_, w) => out.push(`${pad(n)}_${pad(i + 1)}_${pad(w + 1)}`)); });
  }
  return out;
}

const running = new Map(); // этап → { have, total, stop }
const listeners = new Set();
/** Подписка на ход скачивания (кнопки на «Пути» и в «Настройках» обновляются сами). */
export const onSound = (f) => { listeners.add(f); return () => listeners.delete(f); };
const emit = (u) => listeners.forEach((f) => f(u));

/** Что с звуком этапа: сколько записей, сколько уже есть, сколько осталось скачать (МБ), идёт ли скачивание. */
export async function unitState(u) {
  const keys = await unitKeys(u);
  const miss = keys.filter((k) => !has(k));
  const run = running.get(u);
  return { total: keys.length, have: keys.length - miss.length, mb: Math.max(1, Math.round(miss.reduce((s, k) => s + size(k), 0) / 1048576)), done: keys.length > 0 && !miss.length, run: run ? { have: run.have, total: run.total } : null };
}

/** Скачивает звук этапа. quiet: само, в фоне, по две записи за раз. Возвращает true, если скачано всё. */
export async function downloadUnit(u, { quiet = false } = {}) {
  if (!("caches" in window) || running.has(u)) return false;
  const miss = (await unitKeys(u)).filter((k) => !has(k));
  if (!miss.length) return true;
  const c = await caches.open(SOUND);
  const job = { have: 0, total: miss.length, stop: false };
  running.set(u, job);
  emit(u);
  let fails = 0;
  const one = async (k) => {
    const url = soundUrl(k);
    try {
      const r = await fetch(url + "?tw=1"); // мимо кэша слов в sw.js
      if (!r.ok) throw new Error(r.status);
      const b = await r.blob();
      await c.put(url, new Response(b, { headers: { "Content-Type": r.headers.get("Content-Type") || "audio/mpeg", "Content-Length": String(b.size) } }));
      saved.add(url); addBytes(b.size); fails = 0;
    } catch { fails++; }
    job.have++;
  };
  const step = quiet ? 2 : 5;
  for (let i = 0; i < miss.length && !job.stop; i += step) {
    if (!navigator.onLine || fails >= 12) break; // связи нет: продолжим в другой раз
    await Promise.all(miss.slice(i, i + step).map(one));
    if (i % 40 === 0) emit(u);
  }
  running.delete(u);
  prefer();
  emit(u);
  return (await unitKeys(u)).every(has);
}
export const stopUnit = (u) => { const j = running.get(u); if (j) j.stop = true; };

/** Удалить весь скачанный звук. */
export async function deleteSound() {
  for (const j of running.values()) j.stop = true;
  try { await caches.delete(SOUND); } catch {}
  saved = new Set();
  try { localStorage.removeItem(BYTES); } catch {}
  prefer();
  emit(0);
}

/** Этап, на котором ученик сейчас: этап следующего урока; суры: 14. */
async function unitNow() {
  const { nextTarget } = await import("./path.js");
  const { UNITS } = await import("./course.js");
  const t = nextTarget();
  return !t ? null : t.type === "surah" ? 14 : UNITS.find((u) => u.lessons.some((l) => l.id === t.id))?.id || null;
}
const AUTO_MB = 15; // больше этого само качает только по Wi-Fi или кабелю: мобильный интернет бережём

/** При запуске: что уже скачано; потом, если есть связь, само докачивает звук этапа, на котором ученик сейчас. */
export async function initSound() {
  if (!("caches" in window)) return;
  try { saved = new Set((await (await caches.open(SOUND)).keys()).map((r) => r.url)); } catch {}
  onFail(() => setTrouble(true)); // запись не пришла: следующие уроки берут скачанное
  addEventListener("offline", () => setTrouble(true));
  addEventListener("online", () => { if (saved.size) probe(); });
  if (saved.size) probe(); else prefer();
  if (navigator.webdriver || store.get().settings.soundAuto === false || navigator.connection?.saveData) return;
  setTimeout(async () => {
    const u = await unitNow().catch(() => null);
    if (!u || !navigator.onLine) return;
    const st = await unitState(u), net = navigator.connection?.type;
    if (!st.done && (st.mb <= AUTO_MB || net === "wifi" || net === "ethernet")) downloadUnit(u, { quiet: true });
  }, 8000);
}

// ---------- кнопка «Звук этапа без интернета» (на «Пути» под заголовком этапа) ----------
/** Строка этапа: сколько весит звук, «Скачать», ход скачивания, «Сохранён ✓». Обновляется сама. */
export function soundRow(u) {
  const row = h("div.snd-row", { hidden: true });
  const draw = async () => {
    const st = await unitState(u);
    if (!st.total) { row.hidden = true; return; }
    row.hidden = false;
    const title = u === 14 ? "Звук следующих трёх сур" : "Звук этапа без интернета";
    if (st.run) {
      const pct = Math.round((st.run.have / st.run.total) * 100);
      row.className = "snd-row run";
      row.replaceChildren(icon("down", { size: 20 }), h("div.snd-main", null, h("b", null, `Скачиваю звук: ${pct}%`), h("span.snd-bar", null, h("i", { style: { width: pct + "%" } }))),
        h("button.btn.small.ghost", { type: "button", onclick: () => stopUnit(u) }, "Стоп"));
    } else if (st.done) {
      row.className = "snd-row done";
      row.replaceChildren(icon("check", { size: 20, sw: 3 }), h("div.snd-main", null, h("b", null, u === 14 ? "Звук трёх сур сохранён" : "Звук этапа сохранён"), h("small", null, "Уроки звучат и без интернета")));
    } else {
      row.className = "snd-row";
      const part = st.have > 0;
      row.replaceChildren(icon("down", { size: 20 }), h("div.snd-main", null, h("b", null, title), h("small", null, `${part ? "Осталось" : "Примерно"} ${st.mb} МБ. Скачайте, пока связь хорошая`)),
        h("button.btn.small.primary", { type: "button", onclick: async () => {
          const ok = await downloadUnit(u);
          toast(ok ? (u === 14 ? "Звук сур сохранён ✓ Уроки звучат и без интернета" : `Звук этапа ${u} сохранён ✓ Уроки звучат и без интернета`) : "Скачалось не всё. Нажмите «Докачать», когда связь будет лучше.", 5000);
        } }, part ? "Докачать" : "Скачать"));
    }
  };
  const off = onSound((x) => { if (!row.isConnected && row.dataset.on) return off(); if (!x || x === u) draw(); });
  row.dataset.on = "1";
  draw();
  return row;
}
