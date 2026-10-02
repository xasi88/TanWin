// Голос преподавателя: обращение по имени, похвала, поддержка при ошибке, слова о продвижении.
// В шаблонах {n} — имя ученика; если имя не указано, обращение убирается и фраза остаётся цельной.
import { store, streakNow, todayXp, goalDoneToday, today } from "./store.js";
import { UNITS, SURAH_PATH } from "./course.js";
import { courseProgress, unitProgress } from "./path.js";
import { plural } from "./ui.js";

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const studentName = () => { const n = (store.get().profile.name || "").trim(); return n ? cap(n) : ""; };

/** Подставляет имя в шаблон: «Верно, {n}!» → «Верно, Али!» или «Верно!». */
export function fill(t, n = studentName()) {
  if (n) return t.replaceAll("{n}", cap(n.trim()));
  return cap(t.replace(/, \{n\}/g, "").replace(/\{n\}, /g, "").replace(/ ?\{n\}/g, ""));
}

const PRAISE = ["Верно!", "Отлично!", "Правильно!", "Так держать!", "Машаллах!", "Здорово!"];
const PRAISE_N = ["Верно, {n}!", "Отлично, {n}!", "{n}, так держать!", "Машаллах, {n}!", "Молодец, {n}!", "Здорово получается, {n}!"];
const PRAISE_COMBO = ["{n}, {c} подряд без ошибок!", "{c} подряд — блестяще, {n}!"];
const PRAISE_RETRY = ["Вот теперь верно, {n}!", "{n}, теперь получилось!", "Разобрались, {n}!"];
const PRAISE_BACK = ["Вот так, {n}!", "{n}, снова верно!", "Хорошо, {n}, идём дальше!"];
const MISS = ["Не совсем", "Почти", "Чуть иначе"];
const SUPPORT = [
  "{n}, ничего страшного: этот вопрос вернётся в конце урока, и вы ответите верно.",
  "{n}, ошибаться — нормально: так запоминается крепче. К этому вопросу мы ещё вернёмся.",
  "{n}, посмотрите на верный ответ — в конце урока попробуем ещё раз.",
];
const SUPPORT_AGAIN = ["{n}, не спешите — здесь важнее точность, чем скорость.", "{n}, сделайте вдох и посмотрите на объяснение. У вас получится."];
const SUPPORT_RETRY = ["{n}, это трудное место — оно ещё встретится в «Практике», и мы его закрепим.", "{n}, запомним это место: вернёмся к нему в «Практике»."];
const SUPPORT_TEST = ["{n}, запомните верный ответ — и идём дальше.", "{n}, одна ошибка ничего не решает. Продолжаем."];

const unitOf = (id) => UNITS.find((u) => u.lessons.some((l) => l.id === id));
const doneLessons = () => Object.values(store.get().lessons).filter((l) => l.done && !l.skipped).length;

/** Голос на один урок: помнит, что уже сказано, чтобы не повторяться и не называть имя в каждой фразе. */
export function lessonVoice({ id, isTest = false, isSurah = false, title = "" } = {}) {
  let n = 0, missRow = 0, last = "", half = false;
  const pick = (list) => { const c = list.filter((x) => x !== last); return (last = c[Math.floor(Math.random() * c.length)]); };
  return {
    /** Слова в начале урока. */
    intro() {
      const st = store.get();
      if (isSurah) return fill(`{n}, читаем суру «${title}». Слушайте чтеца и следите за словами.`);
      if (!id) return fill("{n}, немного практики — и пройденное останется с вами надолго.");
      if (isTest) return fill("{n}, это проверка этапа. Покажите, чему вы научились: нужно 80% верных ответов.");
      if (st.lessons[id]?.done) return fill("{n}, возвращаться к пройденному — признак хорошего ученика. Освежим этот урок.");
      const k = doneLessons();
      if (!k && !Object.keys(st.lessons).length) return fill("{n}, добро пожаловать! Это ваш первый урок. Идём маленькими шагами — спешить некуда.");
      const u = unitOf(id);
      if (u) {
        const p = unitProgress(u), left = p.total - p.done;
        if (u.lessons[0].id === id) return fill(`{n}, начинаем новый этап — «${u.title}».`);
        if (left === 1) return fill(`{n}, это последний шаг этапа «${u.title}».`);
        if (left <= 3) return fill(`{n}, до конца этапа «${u.title}» — ${left} ${plural(left, "урок", "урока", "уроков")}. Вы почти у цели.`);
      }
      return k ? fill(`{n}, за плечами уже ${k} ${plural(k, "урок", "урока", "уроков")}. Продолжаем!`) : fill("{n}, продолжаем!");
    },
    /** Похвала за верный ответ: имя — в особые моменты и примерно в каждом третьем ответе. */
    praise({ combo = 0, retry = false } = {}) {
      const back = missRow > 0;
      missRow = 0; n++;
      if (retry) return fill(pick(PRAISE_RETRY));
      if ([5, 10, 20].includes(combo)) return fill(pick(PRAISE_COMBO).replace("{c}", combo));
      if (back) return fill(pick(PRAISE_BACK));
      return n % 3 === 1 ? fill(pick(PRAISE_N)) : pick(PRAISE);
    },
    /** Ошибка: короткий заголовок и слова поддержки. */
    miss({ retry = false } = {}) {
      missRow++;
      const list = isTest ? SUPPORT_TEST : retry ? SUPPORT_RETRY : missRow > 1 ? SUPPORT_AGAIN : SUPPORT;
      return { head: pick(MISS), text: fill(pick(list)) };
    },
    /** Один раз за урок — на середине (только в длинных уроках). */
    halfway(idx, total) {
      if (half || total < 10 || idx < Math.ceil(total / 2) || idx >= total - 2) return null;
      half = true;
      return fill("{n}, половина урока позади — отлично идёте!");
    },
    /** Заголовок итогового экрана. */
    resultTitle({ passed, pct }) {
      if (!passed) return fill("{n}, почти получилось");
      return fill(pct === 100 ? "Безупречно, {n}!" : pct >= 80 ? "Отличная работа, {n}!" : "Урок пройден, {n}!");
    },
    /** Что изменилось после этого урока: как далеко продвинулся ученик. Вызывать после finishLesson. */
    resultNote({ passed, first, pct }) {
      if (!passed) return null;
      const say = (t) => fill(t, ""); // имя уже в заголовке итога
      const cp = courseProgress(), all = Math.round(cp.pct * 100);
      if (isSurah) {
        const k = SURAH_PATH.filter((x) => store.get().surahs[x]?.done).length;
        return first ? say(`{n}, вы прочитали уже ${k} ${plural(k, "суру", "суры", "сур")} Корана из ${SURAH_PATH.length} на пути.`) : null;
      }
      if (!id) {
        const s = streakNow();
        return s >= 2 ? say(`{n}, вы занимаетесь ${s} ${plural(s, "день", "дня", "дней")} подряд — это и есть путь к свободному чтению.`) : null;
      }
      const u = unitOf(id);
      if (!u) return null;
      if (isTest) return say(`{n}, этап ${u.id} «${u.title}» позади. Пройдено ${all}% пути к чтению Корана.`);
      if (!first) {
        const best = store.get().lessons[id]?.best || 0;
        return best > 0 && pct >= best ? say(`{n}, это ваш лучший результат в этом уроке — ${pct}%.`) : say("{n}, повторение сделало этот урок прочнее.");
      }
      const p = unitProgress(u), left = p.total - p.done;
      if (!left) return say(`{n}, этап ${u.id} «${u.title}» пройден целиком! Позади ${all}% пути к чтению Корана.`);
      if (doneLessons() === 1) return say("{n}, первый урок позади — начало положено!");
      return say(`{n}, пройдено ${p.done} из ${p.total} уроков этапа «${u.title}» — это уже ${all}% всего пути.`);
    },
  };
}

/** Строка под приветствием на главном экране: замечаем серию, перерыв и пройденный путь. */
export function homeLine() {
  const st = store.get();
  const cp = courseProgress(), all = Math.round(cp.pct * 100);
  if (!cp.done && !st.xp) return "Начнём путь к чтению Корана";
  const path = `Пройдено ${all}% пути к чтению Корана`;
  if (goalDoneToday()) return `Цель дня выполнена — так держать! ${path}.`;
  const s = streakNow();
  if (!todayXp()) {
    const lastDay = Object.keys(st.days).filter((d) => st.days[d] > 0).sort().pop();
    const gap = lastDay ? Math.round((new Date(today()) - new Date(lastDay)) / 86400000) : 0;
    if (gap >= 3) return `Вас не было ${gap} ${plural(gap, "день", "дня", "дней")} — хорошо, что вы вернулись. Всё пройденное на месте: ${all}% пути.`;
    if (s >= 2) return `Вы занимаетесь ${s} ${plural(s, "день", "дня", "дней")} подряд. Сегодняшний урок продолжит серию.`;
  }
  return path;
}
