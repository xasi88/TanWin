// Загрузка данных: банк слов Корана (data/bank.json), список сур, тексты сур (data/q/NNN.json).
import { clusters } from "./arabic.js";
import { byChar, byId, SOUND_PAIRS } from "./letters.js";
import { rulesIn } from "./rules.js";

const pad = (n) => String(n).padStart(3, "0");
const cache = new Map();
async function json(url) {
  if (cache.has(url)) return cache.get(url);
  const p = fetch(url).then((r) => { if (!r.ok) throw new Error(r.status + " " + url); return r.json(); });
  cache.set(url, p);
  p.catch(() => cache.delete(url));
  return p;
}

// Коды признаков — см. tools/qdata/build.mjs (FEAT)
export const LEVEL_ORDER = ["fatha", "kasra", "damma", "tanween", "madd", "sukun", "shadda", "full"];
let BANK = null;
export async function loadBank() {
  if (BANK) return BANK;
  const raw = await json("data/bank.json");
  BANK = raw.map(([d, a, n, L, tr, f, cur], i) => {
    const cs = clusters(d);
    const first = cs[0]?.b || "";
    return { i, d, a, n, L, li: LEVEL_ORDER.indexOf(L), tr, f, cur: !!cur, len: cs.length, first, firstL: byChar[first]?.id || null, skel: cs.map((c) => c.b).join("") };
  });
  BANK.byText = new Map(BANK.map((w) => [w.d, w]));
  BANK.byKey = new Map(BANK.map((w) => [w.a, w]));
  const [pairs, rare] = await Promise.all([json("data/pairs.json"), json("data/rare.json")]);
  const label = Object.fromEntries(SOUND_PAIRS.map(([a, b, l]) => [a + "-" + b, l]));
  PAIRS = pairs.map(([a, b, d1, a1, t1, d2, a2, t2]) => ({ a, b, label: label[a + "-" + b], w1: { d: d1, a: a1, tr: t1 }, w2: { d: d2, a: a2, tr: t2 } }));
  RARE = rare;
  return BANK;
}
let RARE = null;
/** Примеры редких правил со всего Корана (в учебных сурах их мало). */
export const rareExamples = (code) => (RARE?.[code] || []).map(([s, a, wi, ws]) => ({ s, a, wi, w: ws[wi], words: ws, codes: rulesIn(ws[wi]) }));
export const bank = () => BANK;

/**
 * Слова для упражнений.
 * level — самый поздний допустимый уровень; exact — только этот уровень; need — обязательные признаки (коды);
 * maxLen — длина в кластерах; startsWith — первая буква.
 */
export function words({ level = "full", exact = false, need = "", avoid = "", maxLen = 7, minLen = 2, startsWith = null, filter = null } = {}) {
  const li = LEVEL_ORDER.indexOf(level);
  return BANK.filter((w) =>
    (exact ? w.li === li : w.li <= li) &&
    w.len <= maxLen && w.len >= minLen &&
    [...need].every((c) => w.f.includes(c)) &&
    ![...avoid].some((c) => w.f.includes(c)) &&
    (!startsWith || w.first === startsWith || (startsWith === "ء" && "أإءؤئ".includes(w.first))) &&
    (!filter || filter(w)));
}
/** Слова «по теме» урока: сначала самого уровня, потом более ранних; частые — первыми. */
export function lessonWords(opts, n) {
  const exact = words({ ...opts, exact: true });
  const pool = exact.length >= n * 2 ? exact : words(opts);
  return pool;
}

/** Примеры слов для буквы: начинаются с неё, сначала простые и частые. */
export function letterExamples(id, n = 3) {
  const l = byId[id];
  let pool;
  if (id === "alif") pool = words({ level: "madd", exact: true, maxLen: 4, filter: (w) => w.d.includes("َا") && !w.f.includes("g") });
  else pool = words({ level: "shadda", maxLen: 5, startsWith: id === "hamza" ? "ء" : l.ch });
  pool = [...pool].sort((a, b) => a.li - b.li || b.n - a.n);
  // разнообразие: не больше двух слов одного уровня подряд
  const out = [];
  for (const w of pool) { if (out.length >= n) break; if (!out.some((x) => x.skel === w.skel)) out.push(w); }
  return out;
}

// Минимальные пары: слова Корана, отличающиеся одной трудной буквой (готовый список data/pairs.json)
let PAIRS = null;
export const minimalPairs = () => PAIRS || [];

// ---------- Суры ----------
let SURAHS = null;
export async function loadSurahs() {
  if (SURAHS) return SURAHS;
  const raw = await json("data/surahs.json");
  SURAHS = raw.map(([id, ar, ru, meaning, verses, place, page]) => ({ id, ar, ru, meaning, verses, place, page }));
  return SURAHS;
}
export const surahMeta = (n) => SURAHS?.[n - 1];
/** Сура: { id, v: [[слова-разметка[], перевод, тайминги Хусари[], тайминги Афаси[]], …] } */
export const loadSurah = (n) => json(`data/q/${pad(n)}.json`);
export const wordAudioUrl = (key) => `https://audio.qurancdn.com/wbw/${key}.mp3`;
export const wordKey = (s, a, w) => `${pad(s)}_${pad(a)}_${pad(w)}`;
export const RECITERS = {
  husary: { name: "Махмуд аль-Хусари", note: "обучающее чтение, медленно", url: (s, a) => `https://everyayah.com/data/Husary_Muallim_128kbps/${pad(s)}${pad(a)}.mp3`, seg: 2 },
  afasy: { name: "Мишари Рашид аль-Афаси", note: "муратталь, обычный темп", url: (s, a) => `https://verses.quran.com/Alafasy/mp3/${pad(s)}${pad(a)}.mp3`, seg: 3 },
};
export { pad };
