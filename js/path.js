// Логика пути: что открыто, что дальше, общий прогресс, награды.
import { UNITS, ALL_LESSONS, SURAH_PATH, SURAH_UNIT, lessonById } from "./course.js";
import { store, lessonDone, surahDone, streakNow, award } from "./store.js";

export const ORDER = ALL_LESSONS.map((l) => l.id);
const SURAH_GATE = "8.7"; // суры открываются после этапа «Аяты»

/** Настройка «Открыть все уроки»: например, если прогресс потерялся вместе с данными браузера. */
export const allOpen = () => !!store.get().settings.unlockAll;

export function lessonUnlocked(id) {
  if (allOpen()) return true;
  const i = ORDER.indexOf(id);
  if (i <= 0) return true;
  if (lessonDone(id)) return true;
  if (lessonDone(ORDER[i - 1])) return true;
  // открыт, если пройдено что-то дальше (например, проверка этапа)
  return ORDER.slice(i + 1).some((x) => lessonDone(x));
}
export const surahsOpen = () => allOpen() || lessonDone(SURAH_GATE) || SURAH_PATH.some((n) => surahDone(n));
export function surahUnlocked(n) {
  if (!surahsOpen()) return false;
  if (allOpen()) return true;
  const i = SURAH_PATH.indexOf(n);
  return i <= 0 || surahDone(n) || surahDone(SURAH_PATH[i - 1]);
}
export function unitProgress(u) {
  if (u.id === SURAH_UNIT.id) {
    const done = SURAH_PATH.filter((n) => surahDone(n)).length;
    return { done, total: SURAH_PATH.length, pct: done / SURAH_PATH.length };
  }
  const done = u.lessons.filter((l) => lessonDone(l.id)).length;
  return { done, total: u.lessons.length, pct: done / u.lessons.length };
}
export function courseProgress() {
  const total = ORDER.length + SURAH_PATH.length;
  const done = ORDER.filter((id) => lessonDone(id)).length + SURAH_PATH.filter((n) => surahDone(n)).length;
  return { done, total, pct: done / total };
}
/** Следующий шаг: первый непройденный открытый урок; после ворот — чередуем с сурами. */
export function nextTarget() {
  const lesson = allOpen() ? afterLast(ORDER, lessonDone) : ORDER.find((id) => !lessonDone(id) && lessonUnlocked(id));
  // когда открыто всё, суры предлагаем только тем, кто реально дошёл до них (иначе «Продолжить» уводит от уроков)
  const reached = lessonDone(SURAH_GATE) || SURAH_PATH.some((n) => surahDone(n));
  const surah = !surahsOpen() ? null : allOpen() ? (reached || !lesson ? afterLast(SURAH_PATH, surahDone) : null) : SURAH_PATH.find((n) => !surahDone(n) && surahUnlocked(n));
  if (lesson && surah) {
    // после этапа «Аяты» предлагаем то, чего меньше сделано сегодня: сначала урок таджвида, потом суру
    const lastL = Math.max(0, ...Object.values(store.get().lessons).map((x) => x.at || 0));
    const lastS = Math.max(0, ...Object.values(store.get().surahs).map((x) => x.at || 0));
    return lastS <= lastL ? { type: "surah", n: surah } : { type: "lesson", id: lesson };
  }
  if (lesson) return { type: "lesson", id: lesson };
  if (surah) return { type: "surah", n: surah };
  return null;
}
// Когда открыто всё: продолжаем с первого непройденного после самого дальнего пройденного (а не с самого начала).
function afterLast(list, done) {
  let last = -1;
  list.forEach((x, i) => { if (done(x)) last = i; });
  return list.slice(last + 1).find((x) => !done(x)) ?? list.find((x) => !done(x)) ?? null;
}
/** Сдан тест этапа: отмечаем пропущенные уроки этого и предыдущих этапов. */
export function applySkip(testId) {
  const u = UNITS.find((x) => x.lessons.some((l) => l.id === testId));
  if (!u) return;
  store.set((s) => {
    for (const uu of UNITS) {
      if (uu.id > u.id) break;
      // в своём этапе проверка закрывает только уроки до неё (в этапе 7 проверок две)
      const upTo = uu === u ? uu.lessons.slice(0, uu.lessons.findIndex((l) => l.id === testId) + 1) : uu.lessons;
      for (const l of upTo) if (!s.lessons[l.id]) s.lessons[l.id] = { done: true, stars: 0, best: 0, n: 0, skipped: true, at: Date.now() };
    }
  });
}
/** Что уже пройдено — для подбора упражнений в «Повторении». */
export function learnedLevel() {
  // слова с сукуном могут содержать мадд и танвин — этот уровень только после уроков слов с маддом
  const L = [["7.8", "shadda"], ["7.5", "sukun"], ["7.1", "madd"], ["6.4", "tanween"], ["4.3", "damma"], ["4.2", "kasra"], ["4.1", "fatha"]];
  for (const [id, lv] of L) if (lessonDone(id)) return lv;
  return null;
}
export const learned = (id) => lessonDone(id);

// ---------- Награды ----------
export const BADGES = [
  { id: "first", icon: "✦", name: "Первый шаг", text: "Пройден первый урок", test: () => ORDER.some((id) => lessonDone(id)) },
  { id: "alphabet", icon: "ب", name: "Алфавит", text: "Все 28 букв", test: () => lessonDone("2.9") },
  { id: "forms", icon: "ـبـ", name: "Формы букв", text: "Узнаю букву в любом месте слова", test: () => lessonDone("3.12") },
  { id: "makharij", icon: "◉", name: "Знаток махраджей", text: "Места выхода звуков", test: () => lessonDone("9.8") },
  { id: "harakat", icon: "بَ", name: "Огласовки", text: "Фатха, касра, дамма, сукун, танвин", test: () => lessonDone("4.7") },
  { id: "syllables", icon: "بَـ", name: "Читаю по слогам", text: "Слоги складываются в слова", test: () => lessonDone("5.5") },
  { id: "madd", icon: "بَا", name: "Долгие гласные", text: "Танвин и мадд", test: () => lessonDone("7.4") },
  { id: "reader", icon: "بّ", name: "Читаю слова", text: "Сукун и шадда", test: () => lessonDone("7.11") },
  { id: "mushaf", icon: "ٱ", name: "Мусхаф Мадины", text: "Аяты и особые написания", test: () => lessonDone("8.7") },
  { id: "nun", icon: "نْ", name: "Нун и мим", text: "Изхар, идгам, икляб, ихфа", test: () => lessonDone("10.6") },
  { id: "madds", icon: "ـٓ", name: "Мастер маддов", text: "Все виды удлинения", test: () => lessonDone("11.5") },
  { id: "waqf", icon: "ۘ", name: "Вакф", text: "Правила остановки", test: () => lessonDone("13.3") },
  { id: "fatiha", icon: "۞", name: "Аль-Фатиха", text: "Прочитана первая сура", test: () => surahDone(1) },
  { id: "ten", icon: "١٠", name: "Десять сур", text: "Прочитано 10 сур", test: () => SURAH_PATH.filter((n) => surahDone(n)).length >= 10 },
  { id: "juz", icon: "٣٠", name: "Джуз Амма", text: "Все суры пути", test: () => SURAH_PATH.every((n) => surahDone(n)) },
  { id: "streak3", icon: "🔥", name: "Три дня подряд", text: "Серия 3 дня", test: () => store.get().streak.best >= 3 },
  { id: "streak7", icon: "🌙", name: "Неделя", text: "Серия 7 дней", test: () => store.get().streak.best >= 7 },
  { id: "streak30", icon: "🌟", name: "Месяц", text: "Серия 30 дней", test: () => store.get().streak.best >= 30 },
  { id: "perfect", icon: "💎", name: "Безупречно", text: "Урок на 100%", test: () => Object.values(store.get().lessons).some((l) => l.best === 100) },
  { id: "xp1000", icon: "✺", name: "Тысяча нура", text: "1000 очков опыта", test: () => store.get().xp >= 1000 },
];
/** Проверяет и выдаёт новые награды; возвращает список новых. */
export function checkBadges() {
  const fresh = [];
  for (const b of BADGES) if (b.test() && award(b.id)) fresh.push(b);
  return fresh;
}
export { streakNow, lessonById };
