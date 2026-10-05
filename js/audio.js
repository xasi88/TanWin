// Звук: записи чтецов (слова и аяты), звуки ответов (синтез в браузере) и запись своего голоса.
import { wordAudioUrl, RECITERS } from "./data.js";
import { store } from "./store.js";
import { track } from "./metrika.js";
import { ROOT } from "./env.js";

const el = new Audio();
el.preload = "auto";
let current = null; // { id, onEnd, onTime }
const listeners = new Set();
export const onPlay = (f) => { listeners.add(f); return () => listeners.delete(f); };
const emit = () => listeners.forEach((f) => f(current?.id || null));

// iOS разрешает автопроигрывание только элементу, который уже звучал после касания пользователя
const SILENT = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";
function unlock() {
  if (!current) { el.src = SILENT; el.play().then(() => { if (!current) el.pause(); }).catch(() => {}); }
  try { ac(); } catch {}
}
document.addEventListener("pointerdown", unlock, { once: true, capture: true });
document.addEventListener("keydown", unlock, { once: true, capture: true });

el.addEventListener("ended", () => { const c = current; current = null; emit(); c?.onEnd?.(); });
// У части записей чтеца битый хвост: новый декодер Chromium на последних долях секунды даёт ошибку вместо «ended».
// Запись при этом прозвучала целиком — считаем её доигранной, иначе чтец встаёт на последнем аяте суры.
el.addEventListener("error", () => {
  const c = current, tail = el.error?.code === 3 && el.duration > 0 && el.duration - el.currentTime < 0.6;
  current = null; emit();
  if (tail) c?.onEnd?.(); else c?.onError?.();
});
el.addEventListener("timeupdate", () => current?.onTime?.(el.currentTime * 1000));

let seq = null; // отмена цепочки записей (playSeq)
export function stop() {
  seq?.();
  el.pause();
  if (current) { const c = current; current = null; emit(); c.onStop?.(); }
}
export const playingId = () => current?.id || null;

export async function playUrl(url, { id = url, rate = 1, onEnd, onTime, onError, onStop } = {}) {
  stop();
  current = { id, onEnd, onTime, onError, onStop };
  el.src = new URL(url, ROOT).href; // свои записи лежат в корне сайта
  el.playbackRate = rate;
  emit();
  try { await el.play(); return true; }
  catch (e) { if (current?.id === id) { current = null; emit(); } onError?.(e); return false; }
}
export const playWord = (key, o = {}) => playUrl(wordAudioUrl(key), { id: "w:" + key, ...o });
export function playAyah(s, a, o = {}) {
  const rec = RECITERS[store.get().settings.reciter] || RECITERS.husary;
  return playUrl(rec.url(s, a), { id: `a:${s}:${a}`, rate: store.get().settings.rate || 1, ...o });
}

// ---------- Буквы и слоги (свои записи в audio/letters) ----------
const VOWEL_KEY = { fatha: "a", kasra: "i", damma: "u" };
/** Адрес записи: название буквы (v не задан) или буква с огласовкой fatha | kasra | damma. У алифа и названия хамзы записи нет. */
export function letterAudioUrl(id, v = null) {
  if (v) return id === "alif" || !VOWEL_KEY[v] ? null : `audio/letters/${id}-${VOWEL_KEY[v]}.mp3`;
  return `audio/letters/${id === "hamza" ? "hamza-a" : id}.mp3`;
}
export const hasSyllAudio = (id, v) => !!letterAudioUrl(id, v);
export const playLetter = (id, o = {}) => playUrl(letterAudioUrl(id), { id: "l:" + id, ...o });
export const playSyll = (id, v, o = {}) => playUrl(letterAudioUrl(id, v), { id: `s:${id}:${v}`, ...o });
/**
 * Проигрывает записи подряд. items: [{ url, id }] ; gap — пауза между ними (мс); onStep(i) — какая запись звучит (−1 — конец).
 * Любое другое воспроизведение или stop() обрывает цепочку. onEnd(done): done — цепочка доиграна до конца.
 */
export function playSeq(items, { gap = 220, onStep, onEnd } = {}) {
  let i = -1, timer = 0, dead = false;
  const end = (done = false) => { if (dead) return; dead = true; clearTimeout(timer); if (seq === end) seq = null; onStep?.(-1); onEnd?.(done === true); };
  const next = () => {
    if (dead) return;
    i++;
    if (i >= items.length) return end(true);
    let once = false;
    const after = () => { if (once || dead) return; once = true; timer = setTimeout(next, gap); };
    seq = null; // playUrl сам вызывает stop() — цепочку он обрывать не должен
    playUrl(items[i].url, { id: items[i].id || items[i].url, rate: items[i].rate || 1, onEnd: after, onError: after });
    seq = end;
    onStep?.(i);
  };
  next();
  return end;
}
export const syllItem = (id, v) => ({ url: letterAudioUrl(id, v), id: `s:${id}:${v}` });
export const wordItem = (key) => ({ url: wordAudioUrl(key), id: "w:" + key });
export function preloadLetter(id, v = null) { const u = letterAudioUrl(id, v); if (u) { const a = new Audio(); a.preload = "auto"; a.src = new URL(u, ROOT).href; } }

/** Предзагрузка слова (браузер положит его в кэш). */
export function preloadWord(key) { const a = new Audio(); a.preload = "auto"; a.src = wordAudioUrl(key); }

// ---------- Звуки интерфейса ----------
let ctx = null;
function ac() {
  if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; ctx = new A(); }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
function tone(freq, start, dur, { type = "sine", vol = 0.16, to = null } = {}) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur + 0.03);
}
const on = () => store.get().settings.sfx;
export const sfx = {
  correct() { if (!on()) return; tone(784, 0, 0.12, { type: "triangle" }); tone(1175, 0.08, 0.28, { type: "triangle", vol: 0.13 }); },
  wrong() { if (!on()) return; tone(260, 0, 0.16, { type: "sine", vol: 0.14, to: 200 }); tone(196, 0.13, 0.24, { type: "sine", vol: 0.12, to: 160 }); },
  tap() { if (!on()) return; tone(1320, 0, 0.04, { vol: 0.04 }); },
  finish() { if (!on()) return; [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.42, { type: "triangle", vol: 0.12 })); },
  level() { if (!on()) return; [392, 523, 659, 784, 1047].forEach((f, i) => { tone(f, i * 0.07, 0.5, { type: "sine", vol: 0.1 }); tone(f * 1.5, i * 0.07 + 0.03, 0.4, { type: "triangle", vol: 0.05 }); }); },
};

// ---------- Запись своего голоса ----------
let rec = null;
export const canRecord = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
export async function startRecording() {
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { track("speech_used", { Микрофон: "нет доступа" }); throw e; }
  const chunks = [];
  const mr = new MediaRecorder(stream);
  mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res) => { mr.onstop = () => { stream.getTracks().forEach((t) => t.stop()); res(new Blob(chunks, { type: mr.mimeType || "audio/webm" })); }; });
  mr.start();
  track("speech_used", { Микрофон: "работает" });
  rec = { mr, done, t0: Date.now() };
  return rec;
}
export async function stopRecording() {
  if (!rec) return null;
  const r = rec; rec = null;
  if (r.mr.state !== "inactive") r.mr.stop();
  const blob = await r.done;
  return { blob, url: URL.createObjectURL(blob), ms: Date.now() - r.t0 };
}
export const isRecording = () => !!rec;

/** Огибающая громкости записи — для отрисовки «волны» (n столбиков от 0 до 1). */
export async function envelope(src, n = 64) {
  const c = ac(); if (!c) return null;
  const buf = src instanceof Blob ? await src.arrayBuffer() : await (await fetch(new URL(src, ROOT))).arrayBuffer();
  const audio = await c.decodeAudioData(buf);
  const d = audio.getChannelData(0);
  const step = Math.floor(d.length / n);
  const out = [];
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * step; j < (i + 1) * step; j += 16) s = Math.max(s, Math.abs(d[j]));
    out.push(s);
  }
  const mx = Math.max(...out, 0.01);
  return out.map((v) => v / mx);
}
