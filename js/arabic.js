// Разбор огласованного арабского (мусхаф Мадина, риваят Хафс от Асыма):
// разбиение на «кластеры» (буква + знаки), признаки слова для подбора упражнений и русская транскрипция.
// Модуль без DOM — используется и в браузере, и при сборке данных (node tools/qdata/build.mjs).

export const M = {
  FATHA: "َ", KASRA: "ِ", DAMMA: "ُ",
  FATHATAN: "ً", KASRATAN: "ٍ", DAMMATAN: "ٌ",
  SUKUN: "ْ", SUKUN_Q: "ۡ", SHADDA: "ّ",
  DAGGER: "ٰ", MADDAH: "ٓ", HAMZA_A: "ٔ", HAMZA_B: "ٕ",
  SMALL_WAW: "ۥ", SMALL_YA: "ۦ", SMALL_YA2: "ۧ",
  ZERO: "۟", ZERO_OVAL: "۠", MEEM_HI: "ۢ", MEEM_LO: "ۭ",
  TATWEEL: "ـ",
};

// Знаки остановки (вакф) и прочие орнаменты — не влияют на чтение слова
const STOP_MARKS = /[ۖ-ۜ۞۩‌‏]/g;
export const stripStops = (s) => s.replace(STOP_MARKS, "").trim();

const isMark = (c) => (c >= "ً" && c <= "ٟ") || c === "ٰ" || (c >= "ۖ" && c <= "ۭ" && c !== "ۥ" && c !== "ۦ") || c === "ۥ" || c === "ۦ";

// 28 букв (+ хамза) — базовые формы и их «семья» для транскрипции
export const CONS = {
  "ء": "ʼ", "أ": "ʼ", "إ": "ʼ", "ؤ": "ʼ", "ئ": "ʼ", "آ": "ʼ",
  "ب": "б", "ٮ": "б", "ت": "т", "ث": "с̱", "ج": "дж", "ح": "хь", "خ": "х", "د": "д", "ذ": "з̱",
  "ر": "р", "ز": "з", "س": "с", "ش": "ш", "ص": "с̣", "ض": "д̣", "ط": "т̣", "ظ": "з̣",
  "ع": "ʿ", "غ": "ғ", "ف": "ф", "ق": "ҡ", "ك": "к", "ل": "л", "م": "м", "ن": "н", "ه": "һ",
  "و": "ў", "ي": "й", "ى": "й", "ة": "т",
};
const HAMZAS = new Set(["ء", "أ", "إ", "ؤ", "ئ", "آ"]);
// Какой букве алфавита соответствует символ (для статистики «какие буквы в слове»)
export const BASE_LETTER = { "أ": "ء", "إ": "ء", "ؤ": "ء", "ئ": "ء", "آ": "ء", "ٱ": "ا", "ى": "ا", "ة": "ت", "ٮ": "ب" };

/** Разбивает слово на кластеры {b: буква, m: строка знаков}. Татвиль с надстрочным алифом/хамзой становится отдельным «носителем». */
export function clusters(word) {
  const out = [];
  for (const ch of stripStops(word)) {
    if (ch === "آ") { // «алиф с маддой»: в начале — хамза + долгое «а»
      if (!out.length) out.push({ b: "أ", m: M.FATHA });
      out.push({ b: "ا", m: M.MADDAH });
      continue;
    }
    if (isMark(ch)) {
      if (!out.length) out.push({ b: "", m: "" });
      out[out.length - 1].m += ch;
    } else out.push({ b: ch, m: "" });
  }
  return out;
}

const has = (c, ...ms) => ms.some((m) => c.m.includes(m));
const shortV = (c) => (has(c, M.FATHA, M.FATHATAN) ? "a" : has(c, M.KASRA, M.KASRATAN) ? "i" : has(c, M.DAMMA, M.DAMMATAN) ? "u" : "");
const isSukun = (c) => has(c, M.SUKUN, M.SUKUN_Q);
const isTanween = (c) => has(c, M.FATHATAN, M.KASRATAN, M.DAMMATAN) || (has(c, M.MEEM_HI, M.MEEM_LO) && !!shortV(c) && !isSukun(c));

/**
 * Анализ слова: для каждого кластера — роль (consonant | long | silent | carrier) и признаки слова.
 * Слово читается отдельно (как в пословном аудио): с полной огласовкой в конце, хамзат-уль-васль в начале произносится.
 */
export function analyze(word) {
  const cs = clusters(word);
  const f = new Set();
  const letters = new Set();
  const role = new Array(cs.length).fill("consonant");
  const vowel = new Array(cs.length).fill("");
  let prevV = "";
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    const b = c.b;
    const v = shortV(c);
    vowel[i] = v;
    if (has(c, M.ZERO, M.ZERO_OVAL)) { role[i] = "silent"; f.add("silent"); letters.add(BASE_LETTER[b] || b); continue; }
    if (b === M.TATWEEL || b === "") {
      role[i] = "carrier";
      if (has(c, M.HAMZA_A, M.HAMZA_B)) { role[i] = "consonant"; f.add("hamza"); letters.add("ء"); }
      if (has(c, M.DAGGER)) { f.add("dagger"); f.add("madd"); }
      if (has(c, M.MADDAH)) f.add("maddah");
      if (has(c, M.SHADDA)) f.add("shadda"); // шадда и маленькая йа бывают и на «носителе» (7:196)
      if (has(c, M.SMALL_YA2)) f.add("madd");
      prevV = v || prevV;
      continue;
    }
    letters.add(BASE_LETTER[b] || b);
    if (has(c, M.SMALL_WAW, M.SMALL_YA, M.SMALL_YA2) || b === "ۥ" || b === "ۦ") f.add("sila");
    if (has(c, M.DAGGER)) { f.add("dagger"); f.add("madd"); }
    if (has(c, M.MADDAH)) f.add("maddah");
    if (has(c, M.SHADDA)) f.add("shadda");
    if (isSukun(c)) f.add("sukun");
    if (has(c, M.MEEM_HI, M.MEEM_LO)) f.add("iqlab");
    if (isTanween(c)) f.add("tanween");
    if (v === "a") f.add("fatha"); if (v === "i") f.add("kasra"); if (v === "u") f.add("damma");
    if (HAMZAS.has(b)) f.add("hamza");
    if (b === "ٱ") { role[i] = i === 0 ? "wasl" : "silent"; f.add("wasl"); continue; }
    if (b === "ة") f.add("tamarbuta");
    const bare = !c.m.replace(/[ۖ-ۜٓ]/g, "");
    if (bare) {
      // буква без знаков: долгая гласная; «голая» согласная (в мадинском письме — знак идгама/ихфы) или немая
      if (b === "ا" && i > 0 && isTanween(cs[i - 1])) { role[i] = "silent"; f.add("tanweenAlif"); }
      else if ((b === "ا" || b === "ى") && (prevV === "a")) { role[i] = "long"; vowel[i] = "a"; f.add("madd"); if (b === "ى") f.add("maqsura"); }
      else if (b === "و" && prevV === "u") { role[i] = "long"; vowel[i] = "u"; f.add("madd"); }
      else if ((b === "ي" || b === "ى") && prevV === "i") { role[i] = "long"; vowel[i] = "i"; f.add("madd"); if (b === "ى") f.add("maqsura"); }
      else if (b === "ا" && i === 0) { role[i] = "consonant"; f.add("muqattaat"); }
      else if (b !== "ا" && b !== "و" && b !== "ي" && b !== "ى" && !(cs[i + 1] && has(cs[i + 1], M.SHADDA))) { role[i] = "consonant"; vowel[i] = ""; f.add("bareSakin"); prevV = ""; continue; }
      else { role[i] = "silent"; f.add("silent"); }
      if (has(c, M.MADDAH)) f.add("maddah");
      if (role[i] === "long") { prevV = vowel[i]; continue; }
      continue;
    }
    if (isSukun(c) && prevV === "a" && (b === "و" || b === "ي")) f.add("leen");
    if (b === "ى" && has(c, M.DAGGER)) { role[i] = "long"; vowel[i] = "a"; }
    prevV = isSukun(c) ? "" : v;
  }
  const skel = cs.map((c) => c.b).join("").replace(/[ٱأ]/g, "ا");
  if (/^[وفبت]?ا?لله(م)?$/.test(skel) || skel === "لله") f.add("allah");
  return { cs, role, vowel, f, letters };
}

// ---------- Транскрипция ----------
const V = { a: "а", i: "и", u: "у" };
const LONG = { a: "аа", i: "ии", u: "уу" };

/** Русская транскрипция отдельно прочитанного слова. Особые звуки — особыми знаками (см. легенду в приложении). */
export function translit(word) {
  const { cs, role, f } = analyze(word);
  let out = "";
  const allah = f.has("allah");
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    const r = role[i];
    const b = c.b;
    if (r === "silent") continue;
    if (r === "carrier") {
      if (has(c, M.DAGGER, M.MADDAH)) out = lengthen(out, "a");
      continue;
    }
    if (r === "wasl") {
      // начало слова: артикль → «а»; иначе по третьей букве: дамма → «у», иначе «и»
      const n1 = cs[i + 1], n2 = cs[i + 2];
      if (n1 && n1.b === "ل") out += "а";
      else out += n2 && shortV(n2) === "u" ? "у" : "и";
      continue;
    }
    if (r === "long") { out = lengthen(out, cs[i].b === "و" ? "u" : (cs[i].b === "ي" || (cs[i].b === "ى" && lastVowel(out) === "и")) ? "i" : "a"); continue; }
    if (r === "consonant" && b === "ا") { out += "а"; continue; }
    // согласный
    let cons = b === M.TATWEEL || b === "" ? "ʼ" : CONS[b] ?? "";
    if (HAMZAS.has(b) || (b === M.TATWEEL && has(c, M.HAMZA_A, M.HAMZA_B))) cons = out === "" ? "" : "ʼ";
    if (b === "ة" && !shortV(c)) cons = "һ";
    if (has(c, M.MEEM_HI) && b === "ن" && !shortV(c)) cons = "м"; // икляб внутри слова: نۢب → «мб»
    const shadda = has(c, M.SHADDA);
    const vv = shortV(c);
    if (shadda && cons && out) out += cons === "дж" ? "д" : cons === "хь" ? "х" : cons;
    out += cons;
    if (isTanween(c)) { out += V[vv] + "н"; continue; }
    if (vv) out += V[vv];
    if (has(c, M.DAGGER)) out = lengthen(out, "a");
    if (has(c, M.SMALL_WAW)) out = lengthen(out, "u");
    if (has(c, M.SMALL_YA, M.SMALL_YA2)) out = lengthen(out, "i");
    if (b === "ۥ") out = lengthen(out, "u");
  }
  if (allah) out = out.replace(/лл(а)һ/, "лл$1аһ");
  return out;
}
const lastVowel = (s) => { const m = s.match(/[аиу]$/); return m ? m[0] : ""; };
function lengthen(s, v) {
  const lv = lastVowel(s);
  if (lv && lv.repeat(2) === s.slice(-2)) return s; // уже долгая
  if (lv) return s + lv;
  return s + LONG[v];
}

// ---------- Уровни слов для учебных этапов ----------
// Слово подходит этапу, если в нём нет ничего, что ещё не пройдено.
export const LEVELS = ["fatha", "kasra", "damma", "tanween", "madd", "sukun", "shadda", "full"];
const LEVEL_ALLOWED = {
  fatha: ["fatha", "hamza"],
  kasra: ["fatha", "kasra", "hamza"],
  damma: ["fatha", "kasra", "damma", "hamza"],
  tanween: ["fatha", "kasra", "damma", "hamza", "tanween", "tanweenAlif", "tamarbuta"],
  madd: ["fatha", "kasra", "damma", "hamza", "tanween", "tanweenAlif", "tamarbuta", "madd", "dagger", "maqsura", "sila"],
  sukun: ["fatha", "kasra", "damma", "hamza", "tanween", "tanweenAlif", "tamarbuta", "madd", "dagger", "maqsura", "sila", "sukun", "leen"],
  shadda: ["fatha", "kasra", "damma", "hamza", "tanween", "tanweenAlif", "tamarbuta", "madd", "dagger", "maqsura", "sila", "sukun", "leen", "shadda"],
};
/** Самый ранний этап, на котором слово можно читать; "full" — нужны особые правила (васль, немые буквы, мадда и т.п.). */
export function levelOf(f) {
  for (const L of LEVELS.slice(0, -1)) {
    const ok = [...f].every((x) => LEVEL_ALLOWED[L].includes(x));
    if (ok) return L;
  }
  return "full";
}

// ---------- Связность букв через границу <span> (см. checkShaping в ui.js; этим же пользуется tools/pages.mjs) ----------
export const ZWJ = "‍";
export const isMarkCh = (c) => /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/.test(c);
export const JOIN_NEXT = /[ئبت-خس-غـ-هىيٮٯ]/; // ب ت … ي, татвиль: соединяются и со следующей буквой
export const JOIN_PREV = /[آ-إاةد-زوٱ]/; // ا د ذ ر ز و ة ٱ: только с предыдущей

/** Переносит границы кусочков [текст, класс] между целыми буквами и склеивает соседей соединителем ZWJ. */
export function glue(parts) {
  const cl = []; // буква со знаками → класс: своей буквы, а если его нет — цветного знака
  for (const [t, c] of parts) for (const ch of t) {
    const last = cl[cl.length - 1];
    if (last && (isMarkCh(ch) || ch === ZWJ || (last.t[0] === "ل" && /[آأإاٱ]/.test(ch)))) { last.t += ch; last.c ||= c; }
    else cl.push({ t: ch, c });
  }
  const runs = [];
  for (const x of cl) {
    const r = runs[runs.length - 1];
    if (r && r.c === x.c) { r.t += x.t; r.last = x.t[0]; } else runs.push({ t: x.t, c: x.c, first: x.t[0], last: x.t[0] });
  }
  for (let i = 1; i < runs.length; i++) {
    if (JOIN_NEXT.test(runs[i - 1].last) && (JOIN_NEXT.test(runs[i].first) || JOIN_PREV.test(runs[i].first))) { runs[i - 1].t += ZWJ; runs[i].t = ZWJ + runs[i].t; }
  }
  return runs.map((r) => [r.t, r.c]);
}
