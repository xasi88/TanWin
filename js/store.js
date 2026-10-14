// Прогресс ученика: хранится в localStorage этого устройства; перенос — через файл экспорта.
const KEY = "tanwin.v2";
const listeners = new Set();

const today = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
};
const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

// Версия программы курса: 2 — порядок этапов с 1.11.0 (буквы → формы → огласовки → слоги → слова → аяты → махраджи → таджвид).
const COURSE = 2;
// В 1.11.0 этапы переставлены и уроки получили новые номера: старый номер → новый (остальные не менялись).
const LESSON_MOVES = {
  "3.1": "9.1", "3.2": "9.2", "3.3": "9.3", "3.4": "9.4", "3.5": "9.5", "3.6": "9.6", "3.7": "9.7", "3.8": "9.8",
  "4.1": "3.1", "4.2": "3.9", "4.3": "3.10", "4.4": "3.11", "4.5": "3.12",
  "5.1": "4.1", "5.2": "4.2", "5.3": "4.3", "5.4": "4.4", "5.5": "6.3", "5.6": "4.7", "6.1": "4.6", "6.2": "6.4",
  "8.1": "4.5", "8.2": "7.6", "8.3": "7.7", "9.1": "7.8", "9.2": "7.9", "9.3": "7.10", "9.4": "7.11",
  "10.1": "8.2", "10.2": "8.3", "10.3": "8.4", "10.4": "8.5", "10.5": "8.6", "10.6": "8.7", "10.7": "8.1",
  "11.1": "10.1", "11.2": "10.2", "11.3": "10.3", "11.4": "10.4", "11.5": "10.5", "11.6": "10.6",
  "12.1": "11.1", "12.2": "11.2", "12.3": "11.3", "12.4": "11.4", "12.5": "11.5",
  "13.1": "12.1", "13.2": "12.2", "13.3": "12.3", "13.4": "12.4", "14.1": "13.1", "14.2": "13.2", "14.3": "13.3",
};
/** Прогресс, сохранённый до перестановки этапов (в том числе из файла экспорта): переносим уроки на новые номера. */
function migrate(s) {
  if (!s || typeof s !== "object") return s;
  // До 1.23 настройка «Транскрипция» ни на что не действовала: в карточках теории транскрипция была видна всегда, а в настройке
  // у всех стояло «По нажатию». Чтобы у тех, кто её не трогал, уроки не изменились, один раз переводим её в «Показывать».
  if (s.settings && !s.settings.translitV) { if (s.settings.translit === "tap") s.settings.translit = "show"; s.settings.translitV = 2; }
  if (s.course >= COURSE) return s;
  if (s.lessons && typeof s.lessons === "object") s.lessons = Object.fromEntries(Object.entries(s.lessons).map(([id, v]) => [LESSON_MOVES[id] || id, v]));
  s.course = COURSE;
  return s;
}

const DEFAULT = () => ({
  v: 2,
  course: COURSE,
  profile: { name: "", form: "vy", gender: "", created: Date.now(), goal: 30, onboarded: false }, // form: «вы» или «ты», gender: "m" | "f" | ""
  settings: { theme: "auto", arScale: 1, reciter: "husary", translit: "show", translitV: 2, tajweed: true, sfx: true, translation: true, rate: 1, unlockAll: false, uiScale: 1, analytics: true, arFont: "hafs" },
  lessons: {},
  surahs: {},
  xp: 0,
  days: {},
  streak: { cur: 0, best: 0, last: "" },
  srs: {},
  stats: { answers: 0, correct: 0, ms: 0, lessons: 0 },
  badges: {},
  hard: {},
  marks: [], // закладки в Коране: [{ id, s, a, p, at, name, g, plan, done, cur }] — план и его выполнение описаны в views/bookmarks.js
  markGroups: [], // группы закладок: [{ id, name, closed }]
  qread: { days: {}, goals: 0 }, // чтение Корана: по дням { ms, pages, pp — страницы, прочитанные сегодня } и число выполненных целей
  readGoal: null, // до 1.18 — общая цель чтения; теперь цели живут в закладках (upgradeGoals)
});

// Две вкладки приложения (или вкладка и установленное приложение) — два окна с одним хранилищем. Каждое держит прогресс в памяти
// и записывает его целиком, поэтому перед любым изменением окно берёт из хранилища то, что успело записать другое (pull), —
// иначе его запись стёрла бы чужую работу: закладку, место чтения, пройденный урок. По той же причине каждое изменение
// записывается сразу: несохранённое в памяти пропало бы при следующем pull.
let seen = null; // строка из хранилища, по которой построено то, что сейчас в памяти
const stored = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const parse = (raw) => upgradeGoals(merge(DEFAULT(), migrate(JSON.parse(raw))));
const state = load();
function load() {
  const raw = stored();
  try { if (raw) { const s = parse(raw); seen = raw; return s; } } catch {}
  return DEFAULT();
}
const isMap = (x) => !!x && typeof x === "object" && !Array.isArray(x);
/** Переносит в target всё из src, не подменяя сами объекты: экраны держат ссылки на state и его части. */
function adopt(target, src) {
  for (const k of Object.keys(target)) if (!(k in src)) delete target[k];
  for (const [k, v] of Object.entries(src)) { if (isMap(target[k]) && isMap(v)) adopt(target[k], v); else target[k] = v; }
}
/** Берёт из хранилища запись другого окна. Возвращает true, если данные в памяти обновились. */
function pull() {
  const raw = stored();
  if (!raw || raw === seen) return false; // пусто — хранилище очистили: в памяти осталась единственная копия, её и запишем
  let fresh;
  try { fresh = parse(raw); } catch { return false; }
  adopt(state, fresh);
  seen = raw;
  return true;
}
/**
 * 1.18: цели живут в закладках (mark.plan). Старая цель закладки (goal: N страниц за раз) становится планом
 * «читать по порядку, N страниц в день»; общая цель чтения (readGoal) — закладкой «Цель чтения» с таким же планом.
 */
function upgradeGoals(s) {
  if (!Array.isArray(s.marks)) s.marks = [];
  for (const m of s.marks) {
    if (m.goal && !m.plan) m.plan = { k: "seq", unit: "p", n: m.goal };
    delete m.goal;
  }
  const gl = s.readGoal;
  if (gl && gl.pages) {
    const m = gl.mark && s.marks.find((x) => x.id === gl.mark);
    const page = gl.from + (gl.read || 0) > 604 ? 1 : gl.from + (gl.read || 0);
    if (m) { // цель закладки: закладка уже стоит на нужном месте, если цель выполнена; иначе — там, где остановились
      m.done = gl.done || 0;
      if (!gl.done && gl.s) Object.assign(m, { s: gl.s, a: gl.a, p: page });
    } else {
      const mark = { id: "goal" + (gl.at || 1).toString(36), s: gl.s || 1, a: gl.a || 1, p: page, at: gl.at || Date.now(), name: "Цель чтения", plan: { k: "seq", unit: "p", n: gl.pages }, done: gl.done || 0 };
      if (gl.done || !gl.s) mark.byPage = true; // место известно только как страница — сура и аят уточнятся при открытии
      s.marks.unshift(mark);
    }
  }
  s.readGoal = null;
  return s;
}
function merge(base, x) {
  for (const k of Object.keys(x || {})) {
    if (base[k] && typeof base[k] === "object" && !Array.isArray(base[k]) && typeof x[k] === "object") base[k] = merge(base[k], x[k]);
    else base[k] = x[k];
  }
  return base;
}
function save() {
  const raw = JSON.stringify(state);
  try { localStorage.setItem(KEY, raw); seen = raw; } catch {} // не записалось — seen прежний: следующий pull не вернёт старое поверх нового
  listeners.forEach((f) => f(state));
}
/** Другое окно записало прогресс — подхватываем сразу (тема, размер текста, закладки), не дожидаясь своей записи. */
function sync() { if (pull()) listeners.forEach((f) => f(state)); }
globalThis.addEventListener?.("storage", (e) => { if (e.key === KEY || e.key === null) sync(); });
// окно могло «спать» в памяти телефона и пропустить это событие — сверяемся, когда к нему возвращаются
globalThis.addEventListener?.("pageshow", sync);
globalThis.document?.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") sync(); });

export const store = {
  get: () => state,
  on: (f) => { listeners.add(f); return () => listeners.delete(f); },
  /** Изменить прогресс: fn получает данные с учётом записей другого окна, результат сразу записывается. */
  set(fn) { pull(); fn(state); save(); },
  sync,
  reset() { adopt(state, DEFAULT()); save(); },
  export: () => { pull(); return JSON.stringify({ app: "TanWin", exported: new Date().toISOString(), state }, null, 1); },
  import(text) {
    const j = JSON.parse(text);
    const s = j.state || j;
    if (!s || typeof s !== "object" || !("lessons" in s)) throw new Error("Это не файл прогресса TanWin");
    adopt(state, upgradeGoals(merge(DEFAULT(), migrate(s)))); save();
  },
};

// ---------- Сохранность прогресса ----------
// Прогресс живёт в хранилище браузера. Просим браузер не удалять его (Safari чистит данные сайтов,
// которые не открывали около недели), а раз в неделю напоминаем сохранить копию в файл.
export async function protectStorage() {
  try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch {}
}
const WEEK = 7 * 86400000;
/** Пора ли напомнить о копии: есть что терять, и неделю не сохраняли (и не откладывали). */
export function backupDue(now = Date.now()) {
  const p = state.profile;
  if (Object.keys(state.lessons).length + Object.keys(state.surahs).length < 3) return false;
  return now - (p.lastBackup || p.created || 0) > WEEK && now > (p.backupSnooze || 0);
}
export function backupDone() { pull(); state.profile.lastBackup = Date.now(); save(); }
export function backupLater() { pull(); state.profile.backupSnooze = Date.now() + WEEK; save(); }

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
  pull();
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

// ---------- Чтение Корана: дни, время, страницы, цели ----------
/** Засчитывает за сегодня время чтения (мс) и прочитанные страницы. */
export function readTick(ms, pages = 0) {
  if (!ms && !pages) return;
  pull();
  const d = today(), x = state.qread.days[d] || (state.qread.days[d] = { ms: 0, pages: 0 });
  x.ms += ms; x.pages += pages;
  save();
}
/** Страница p мусхафа прочитана сегодня. Каждая страница за день считается один раз — и после перезапуска приложения тоже. */
export function readPage(p) {
  pull();
  const d = today(), x = state.qread.days[d] || (state.qread.days[d] = { ms: 0, pages: 0 });
  if (x.pp?.includes(p)) return;
  for (const k of Object.keys(state.qread.days)) if (k !== d) delete state.qread.days[k].pp; // список страниц нужен только за сегодня
  (x.pp || (x.pp = [])).push(p);
  x.pages++;
  save();
}
export function readGoalDone() { pull(); state.qread.goals++; save(); }
/** Сводка чтения. День засчитан, если читали хотя бы минуту или прочли страницу. */
export function readStats() {
  const all = Object.entries(state.qread.days);
  const days = all.filter(([, x]) => x.ms >= 60000 || x.pages > 0).map(([d]) => d).sort();
  let best = 0, run = 0, prev = "";
  for (const d of days) { run = prev && dayDiff(prev, d) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = d; }
  return {
    days: days.length, best, cur: prev && dayDiff(prev, today()) <= 1 ? run : 0,
    ms: all.reduce((k, [, x]) => k + x.ms, 0), pages: all.reduce((k, [, x]) => k + x.pages, 0),
    goals: state.qread.goals, today: state.qread.days[today()] || { ms: 0, pages: 0 },
  };
}

// ---------- Интервальные повторения (система Лейтнера) ----------
// Коробка 0…7; интервал в днях растёт вдвое. Ошибка возвращает элемент в коробку 1.
const INTERVAL = [0, 1, 2, 4, 8, 16, 32, 64];
export function srsSeen(key, ok) {
  pull();
  const now = Date.now();
  const it = state.srs[key] || { box: 0, due: now, ok: 0, bad: 0 };
  if (ok) { it.box = Math.min(7, it.box + 1); it.ok++; } else { it.box = 1; it.bad++; }
  it.due = now + INTERVAL[it.box] * 86400000 - 3600000; // на час раньше, чтобы попасть в «завтра»
  it.last = now;
  state.srs[key] = it;
  save();
}
export const srsDue = (now = Date.now()) => Object.entries(state.srs).filter(([, v]) => v.due <= now).map(([k]) => k);
export function mastery(key) {
  const it = state.srs[key];
  if (!it) return 0;
  return Math.min(1, it.box / 5);
}

// ---------- Уроки ----------
export function finishLesson(id, { pct, ms, answers, correct, isSurah = false }) {
  pull();
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

// ---------- Трудные слова ----------
// Слово, в котором ошиблись, попадает в тренировку «Трудные слова» и уходит из неё после двух верных ответов подряд.
export function hardSeen(key, ok) {
  pull();
  const it = state.hard[key];
  if (ok) { if (!it) return; it.ok++; if (it.ok >= 2) delete state.hard[key]; }
  else state.hard[key] = { bad: (it?.bad || 0) + 1, ok: 0, last: Date.now() };
  save();
}
/** Ключи трудных слов: сначала самые «ошибочные» и недавние. */
export const hardWords = () => Object.entries(state.hard).sort((a, b) => b[1].bad - a[1].bad || b[1].last - a[1].last).map(([k]) => k);

export function award(id) {
  pull();
  if (state.badges[id]) return false;
  state.badges[id] = Date.now();
  save();
  return true;
}
export { today };
