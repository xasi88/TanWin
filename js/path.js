// Логика пути: что открыто, что дальше, общий прогресс, награды.
import { UNITS, ALL_LESSONS, SURAH_PATH, SURAH_UNIT, lessonById } from "./course.js";
import { store, lessonDone, surahDone, streakNow, award } from "./store.js";

export const ORDER = ALL_LESSONS.map((l) => l.id);
const SURAH_GATE = "10.6"; // суры открываются после этапа «Особые написания»

export function lessonUnlocked(id) {
  const i = ORDER.indexOf(id);
  if (i <= 0) return true;
  if (lessonDone(id)) return true;
  if (lessonDone(ORDER[i - 1])) return true;
  // открыт, если пройдено что-то дальше (например, проверка этапа)
  return ORDER.slice(i + 1).some((x) => lessonDone(x));
}
export const surahsOpen = () => lessonDone(SURAH_GATE) || SURAH_PATH.some((n) => surahDone(n));
export function surahUnlocked(n) {
  if (!surahsOpen()) return false;
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
  const lesson = ORDER.find((id) => !lessonDone(id) && lessonUnlocked(id));
  const surah = surahsOpen() ? SURAH_PATH.find((n) => !surahDone(n) && surahUnlocked(n)) : null;
  if (lesson && surah) {
    // после этапа 10 предлагаем то, чего меньше сделано сегодня: сначала урок таджвида, потом суру
    const lastL = Math.max(0, ...Object.values(store.get().lessons).map((x) => x.at || 0));
    const lastS = Math.max(0, ...Object.values(store.get().surahs).map((x) => x.at || 0));
    return lastS <= lastL ? { type: "surah", n: surah } : { type: "lesson", id: lesson };
  }
  if (lesson) return { type: "lesson", id: lesson };
  if (surah) return { type: "surah", n: surah };
  return null;
}
/** Сдан тест этапа: отмечаем пропущенные уроки этого и предыдущих этапов. */
export function applySkip(testId) {
  const u = UNITS.find((x) => x.lessons.some((l) => l.id === testId));
  if (!u) return;
  store.set((s) => {
    for (const uu of UNITS) {
      if (uu.id > u.id) break;
      for (const l of uu.lessons) if (!s.lessons[l.id]) s.lessons[l.id] = { done: true, stars: 0, best: 0, n: 0, skipped: true, at: Date.now() };
    }
  });
}
/** Что уже пройдено — для подбора упражнений в «Повторении». */
export function learnedLevel() {
  const L = [["9.1", "shadda"], ["8.1", "sukun"], ["7.1", "madd"], ["6.1", "tanween"], ["5.3", "damma"], ["5.2", "kasra"], ["5.1", "fatha"]];
  for (const [id, lv] of L) if (lessonDone(id)) return lv;
  return null;
}
export const learned = (id) => lessonDone(id);

// ---------- Награды ----------
export const BADGES = [
  { id: "first", icon: "✦", name: "Первый шаг", text: "Пройден первый урок", test: () => ORDER.some((id) => lessonDone(id)) },
  { id: "alphabet", icon: "ب", name: "Алфавит", text: "Все 28 букв", test: () => lessonDone("2.9") },
  { id: "makharij", icon: "◉", name: "Знаток махраджей", text: "Места выхода звуков", test: () => lessonDone("3.8") },
  { id: "harakat", icon: "بَ", name: "Первые слова", text: "Читаю с огласовками", test: () => lessonDone("5.6") },
  { id: "madd", icon: "بَا", name: "Долгие гласные", text: "Танвин и мадд", test: () => lessonDone("7.4") },
  { id: "reader", icon: "بّ", name: "Читаю слова", text: "Сукун и шадда", test: () => lessonDone("9.4") },
  { id: "mushaf", icon: "ٱ", name: "Мусхаф Мадины", text: "Особые написания", test: () => lessonDone("10.6") },
  { id: "nun", icon: "نْ", name: "Нун и мим", text: "Изхар, идгам, икляб, ихфа", test: () => lessonDone("11.6") },
  { id: "madds", icon: "ـٓ", name: "Мастер маддов", text: "Все виды удлинения", test: () => lessonDone("12.5") },
  { id: "waqf", icon: "ۘ", name: "Вакф", text: "Правила остановки", test: () => lessonDone("14.3") },
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
