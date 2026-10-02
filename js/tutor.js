// Голос преподавателя: обращение по имени, похвала, поддержка при ошибке, слова о продвижении.
// В шаблонах {n} — имя ученика; если имя не указано, обращение убирается и фраза остаётся цельной.
import { store, streakNow, todayXp, goalDoneToday, today } from "./store.js";
import { UNITS, SURAH_PATH } from "./course.js";
import { courseProgress, unitProgress } from "./path.js";
import { plural } from "./ui.js";
import { g } from "./speech.js";
import { byId } from "./letters.js";
import { RULES } from "./rules.js";

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
const lastOf = (u, id) => u.lessons.at(-1).id === id;
const doneLessons = () => Object.values(store.get().lessons).filter((l) => l.done && !l.skipped).length;

/** Голос на один урок: помнит, что уже сказано, чтобы не повторяться и не называть имя в каждой фразе. */
export function lessonVoice({ id, isTest = false, isSurah = false, title = "" } = {}) {
  let n = 0, missRow = 0, last = "", half = false;
  const pick = (list) => { const c = list.filter((x) => x !== last); return (last = c[Math.floor(Math.random() * c.length)]); };
  return {
    /** Слова в начале урока. */
    intro({ warm = "" } = {}) {
      const st = store.get();
      if (warm) return fill(`{n}, начнём с короткого повтора. В прошлый раз было трудно: ${warm}.`);
      if (isSurah) return fill(`{n}, читаем суру «${title}». Слушайте чтеца и следите за словами.`);
      if (!id) return fill("{n}, немного практики — и пройденное останется с вами надолго.");
      if (isTest) return fill("{n}, это проверка этапа. Покажите, чему вы научились: нужно 80% верных ответов.");
      if (st.lessons[id]?.done) return fill(`{n}, возвращаться к пройденному — признак ${g("хорошего ученика", "хорошей ученицы")}. Освежим этот урок.`);
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
      return n % 3 === 1 ? fill(pick(PRAISE_N)).replace("Молодец", g("Молодец", "Умница")) : pick(PRAISE);
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
    /** Личный разбор ошибок на итоговом экране: что было трудно и что с этим будет дальше. */
    weakNote(label) {
      return `Сегодня было трудно: ${label}. Следующий урок начнём с короткого повтора — и всё встанет на место.`;
    },
    /** Этап, который этот урок завершил (тогда на итоге показываем «Смотрите, что вы уже умеете»). */
    unitDone({ passed, first }) {
      if (!passed || !id || isSurah) return null;
      const u = unitOf(id);
      if (!u) return null;
      if (isTest) return lastOf(u, id) ? u : null; // проверка посреди этапа этап не завершает
      const p = unitProgress(u);
      return first && p.done === p.total ? u : null;
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
      if (isTest && !lastOf(u, id)) return say("{n}, проверка сдана — идём дальше по этапу.");
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

const VOWEL_RU = { fatha: "слоги с фатхой", kasra: "слоги с касрой", damma: "слоги с даммой", mix: "слоги с разными огласовками" };
const RULE_RU = { izhar: "изхар", allah: "лям в слове «Аллах»", ra: "твёрдая и мягкая ра" };
/** Ключи ошибок (как в интервальном повторении) → понятные слова: «буквы ت и ث», «слоги с касрой». */
export function weakSpots(keys) {
  const letters = [], other = [];
  const add = (list, x) => { if (x && !list.includes(x)) list.push(x); };
  for (const key of keys) {
    const [t, v] = key.split(":");
    if ("LMFH".includes(t)) add(letters, byId[v]?.ch);
    else if (t === "P") v.split("-").forEach((x) => add(letters, byId[x]?.ch));
    else if (t === "V") add(other, VOWEL_RU[v] || "слоги");
    else if (t === "W") add(other, "чтение слов");
    else if (t === "R") add(other, RULE_RU[v] || (RULES[v] ? `правило «${RULES[v].name}»` : "правила таджвида"));
    else if (t === "S") add(other, "остановка в конце аята");
  }
  const ls = letters.slice(0, 4);
  if (ls.length) other.unshift(ls.length === 1 ? `буква ${ls[0]}` : `буквы ${ls.slice(0, -1).join(", ")} и ${ls.at(-1)}`);
  return other.slice(0, 2).join(", ");
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
