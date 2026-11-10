// Слияние двух копий прогресса (устройство и облако, 2026-11-10). Правило: ничего пройденного не теряется.
// Основа: копия, которую меняли позже (настройки, профиль, всё незнакомое). Из другой добавляется пройденное:
// уроки и суры (лучший результат), опыт, дни, повторения, награды, закладки, чтение.

const isMap = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const copy = (x) => JSON.parse(JSON.stringify(x));
const num = (x) => (typeof x === "number" && isFinite(x) ? x : 0);

/** Урок или сура: пройденный лучше непройденного, дальше лучшее по каждому числу. */
function betterLesson(x, y) {
  if (!isMap(x)) return y;
  if (!isMap(y)) return x;
  if (!!x.done !== !!y.done) return x.done ? x : y;
  const out = { ...((num(y.at) > num(x.at)) ? y : x) };
  for (const k of ["stars", "best", "n", "at"]) out[k] = Math.max(num(x[k]), num(y[k]));
  if (x.skipped !== y.skipped) out.skipped = !!(x.skipped && y.skipped); // пройден по-настоящему хотя бы в одной копии
  return out;
}

/** По каждому ключу словаря: pick(a, b) выбирает, что оставить. */
function each(a, b, pick) {
  const out = isMap(a) ? copy(a) : {};
  if (!isMap(b)) return out;
  for (const [k, v] of Object.entries(b)) out[k] = k in out ? pick(out[k], v) : copy(v);
  return out;
}
const later = (field) => (x, y) => (num(y?.[field]) > num(x?.[field]) ? y : x);

/** Список с полем id: объединение, при совпадении id остаётся запись основной копии. */
function unionById(main, other) {
  const out = Array.isArray(main) ? copy(main) : [];
  const ids = new Set(out.map((x) => x && x.id));
  for (const x of Array.isArray(other) ? other : []) if (x && x.id && !ids.has(x.id)) { out.push(copy(x)); ids.add(x.id); }
  return out;
}

/**
 * a и b: две копии прогресса, aAt и bAt: когда их меняли. Возвращает новую копию, обе исходные не трогает.
 */
export function mergeStates(a, b, aAt = 0, bAt = 0) {
  if (!isMap(a)) return copy(b);
  if (!isMap(b)) return copy(a);
  const [main, other] = num(bAt) > num(aAt) ? [b, a] : [a, b];
  const s = copy(main);
  s.lessons = each(main.lessons, other.lessons, betterLesson);
  s.surahs = each(main.surahs, other.surahs, betterLesson);
  s.xp = Math.max(num(a.xp), num(b.xp));
  s.days = each(main.days, other.days, (x, y) => Math.max(num(x), num(y)));
  s.sessions = each(main.sessions, other.sessions, (x, y) => Math.max(num(x), num(y)));
  const sa = isMap(a.streak) ? a.streak : {}, sb = isMap(b.streak) ? b.streak : {};
  const lastSt = (sb.last || "") > (sa.last || "") ? sb : (sa.last || "") > (sb.last || "") ? sa : num(sb.cur) > num(sa.cur) ? sb : sa;
  s.streak = { cur: num(lastSt.cur), best: Math.max(num(sa.best), num(sb.best), num(lastSt.cur)), last: lastSt.last || "" };
  s.srs = each(main.srs, other.srs, later("last"));
  s.hard = each(main.hard, other.hard, later("last"));
  s.stats = each(main.stats, other.stats, (x, y) => Math.max(num(x), num(y)));
  s.badges = each(main.badges, other.badges, (x, y) => Math.min(num(x) || num(y), num(y) || num(x))); // награда с первой даты
  s.marks = unionById(main.marks, other.marks);
  s.markGroups = unionById(main.markGroups, other.markGroups);
  if (isMap(main.qread) || isMap(other.qread)) {
    const qa = isMap(main.qread) ? main.qread : {}, qb = isMap(other.qread) ? other.qread : {};
    s.qread = {
      ...copy(qa),
      days: each(qa.days, qb.days, (x, y) => (num(y?.ms) + num(y?.pages) > num(x?.ms) + num(x?.pages) ? y : x)),
      goals: Math.max(num(qa.goals), num(qb.goals)),
    };
  }
  if (isMap(s.profile) && isMap(other.profile)) {
    s.profile.onboarded = !!(s.profile.onboarded || other.profile.onboarded);
    if (other.profile.created && (!s.profile.created || other.profile.created < s.profile.created)) s.profile.created = other.profile.created;
    if (!s.profile.name && other.profile.name) s.profile.name = other.profile.name;
  }
  return s;
}

/** Есть ли в копии что беречь: пройденный урок, сура, опыт или закладка. */
export const hasProgress = (s) => isMap(s) && (num(s.xp) > 0 || Object.keys(s.lessons || {}).length > 0 || Object.keys(s.surahs || {}).length > 0 || (s.marks || []).length > 0);
