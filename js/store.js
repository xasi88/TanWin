// Прогресс ученика: хранится в localStorage этого устройства; перенос — через файл экспорта.
const KEY = "tanwin.v2";
const listeners = new Set();

const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

const DEFAULT = () => ({
  v: 2,
  profile: { name: "", created: Date.now(), goal: 30, onboarded: false },
  settings: { theme: "auto", arScale: 1, reciter: "husary", translit: "tap", tajweed: true, sfx: true, translation: true, rate: 1, unlockAll: false },
  lessons: {},
  surahs: {},
  xp: 0,
  days: {},
  streak: { cur: 0, best: 0, last: "" },
  srs: {},
  stats: { answers: 0, correct: 0, ms: 0, lessons: 0 },
  badges: {},
});

let state = load();
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(DEFAULT(), JSON.parse(raw));
  } catch {}
  return DEFAULT();
}
function merge(base, x) {
  for (const k of Object.keys(x || {})) {
    if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k]) && typeof x[k] === "object") base[k] = merge(base[k], x[k]);
    else base[k] = x[k];
  }
  return base;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  listeners.forEach((f) => f(state));
}

export const store = {
  get: () => state,
  on: (f) => { listeners.add(f); return () => listeners.delete(f); },
  set(fn) { fn(state); save(); },
  reset() { state = DEFAULT(); save(); },
  export: () => JSON.stringify({ app: "TanWin", exported: new Date().toISOString(), state }, null, 1),
  import(text) {
    const j = JSON.parse(text);
    const s = j.state || j;
    if (!s || typeof s !== "object" || !("lessons" in s)) throw new Error("Это не файл прогресса TanWin");
    state = merge(DEFAULT(), s); save();
  },
};

// ---------- Опыт, цель дня, серия ----------
export const LEVEL_XP = (n) => 40 * n * (n - 1); // уровень 1 = 0, 2 = 80, 3 = 240, 4 = 480…
export function levelInfo(xp = state.xp) {
  let n = 1;
  while (LEVEL_XP(n + 1) <= xp) n++;
  const a = LEVEL_XP(n), b = LEVEL_XP(n + 1);
  return { n, into: xp - a, need: b - a, pct: (xp - a) / (b - a) };
}
export const todayXp = () => state.days[today()] || 0;

/** Добавляет опыт; возвращает события (цель дня выполнена, новый уровень). */
export function addXp(n) {
  const ev = [];
  const d = today();
  const before = state.days[d] || 0;
  const lvl = levelInfo().n;
  state.xp += n;
  state.days[d] = before + n;
  if (before < state.profile.goal && state.days[d] >= state.profile.goal) {
    ev.push("goal");
    const s = state.streak;
    if (s.last !== d) {
      s.cur = s.last && dayDiff(s.last, d) === 1 ? s.cur + 1 : 1;
      s.last = d;
      s.best = Math.max(s.best, s.cur);
      ev.push("streak");
    }
  }
  if (levelInfo().n > lvl) ev.push("level");
  save();
  return ev;
}
/** Текущая серия с учётом пропуска: если вчера цель не выполнена — серия обнулилась. */
export function streakNow() {
  const s = state.streak;
  if (!s.last) return 0;
  const gap = dayDiff(s.last, today());
  return gap <= 1 ? s.cur : 0;
}
export const goalDoneToday = () => todayXp() >= state.profile.goal;
export function lastDays(n = 14) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const k = today(d);
    out.push({ d: k, xp: state.days[k] || 0, wd: d.getDay() });
  }
  return out;
}

// ---------- Интервальные повторения (система Лейтнера) ----------
// Коробка 0…7; интервал в днях растёт вдвое. Ошибка возвращает элемент в коробку 1.
const INTERVAL = [0, 1, 2, 4, 8, 16, 32, 64];
export function srsSeen(key, ok) {
  const now = Date.now();
  const it = state.srs[key] || { box: 0, due: now, ok: 0, bad: 0 };
  if (ok) { it.box = Math.min(7, it.box + 1); it.ok++; } else { it.box = 1; it.bad++; }
  it.due = now + INTERVAL[it.box] * 86400000 - 3600000; // на час раньше, чтобы попасть в «завтра»
  it.last = now;
  state.srs[key] = it;
}
export const srsDue = (now = Date.now()) => Object.entries(state.srs).filter(([, v]) => v.due <= now).map(([k]) => k);
export function mastery(key) {
  const it = state.srs[key];
  if (!it) return 0;
  return Math.min(1, it.box / 5);
}

// ---------- Уроки ----------
export function finishLesson(id, { pct, ms, answers, correct, isSurah = false }) {
  const map = isSurah ? state.surahs : state.lessons;
  const prev = map[id] || { stars: 0, best: 0, n: 0 };
  const stars = pct >= 95 ? 3 : pct >= 80 ? 2 : 1;
  map[id] = { done: true, stars: Math.max(prev.stars, stars), best: Math.max(prev.best, pct), n: prev.n + 1, at: Date.now() };
  state.stats.answers += answers;
  state.stats.correct += correct;
  state.stats.ms += ms;
  state.stats.lessons++;
  save();
  return { stars, first: !prev.n };
}
export const lessonDone = (id) => !!state.lessons[id]?.done;
export const surahDone = (n) => !!state.surahs[n]?.done;

export function award(id) {
  if (state.badges[id]) return false;
  state.badges[id] = Date.now();
  save();
  return true;
}
export { today };
