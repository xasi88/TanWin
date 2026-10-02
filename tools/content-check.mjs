// Проверка учебных данных перед выпуском (без браузера):  node tools/content-check.mjs
//  • в словах каждого уровня нет знаков, которые изучаются позже (лестница «одно новое за шаг»);
//  • подборки слов в уроках не пусты; ссылки на уроки, буквы, правила и аяты существуют;
//  • тексты сур целы: 114 сур, 6236 аятов, число аятов совпадает со списком сур.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const J = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));
const { UNITS, ALL_LESSONS, SURAH_PATH, lessonById } = await import("../js/course.js");
const { byId } = await import("../js/letters.js");
const { RULES } = await import("../js/rules.js");
const { clusters } = await import("../js/arabic.js");

const problems = [];
const bad = (...a) => problems.push(a.join(" "));

// ---------- 1. Знаки по уровням ----------
const LEVELS = ["fatha", "kasra", "damma", "tanween", "madd", "sukun", "shadda", "full"];
const FATHA = "َ", KASRA = "ِ", DAMMA = "ُ", TAN = "ًٌٍ", SUKUN = "ْۡ", SHADDA = "ّ", DAGGER = "ٰ", SMALL = "ۥۦۧ";
const HAMZA = "ٕٔ"; // хамза над или под строкой — это буква, а не новый знак
const allowed = {
  fatha: FATHA, kasra: FATHA + KASRA, damma: FATHA + KASRA + DAMMA,
  tanween: FATHA + KASRA + DAMMA + TAN,
  madd: FATHA + KASRA + DAMMA + TAN + DAGGER + SMALL,
  sukun: FATHA + KASRA + DAMMA + TAN + DAGGER + SMALL + SUKUN,
  shadda: FATHA + KASRA + DAMMA + TAN + DAGGER + SMALL + SUKUN + SHADDA,
};
const bank = J("data/bank.json").map(([d, a, n, L, tr, f]) => ({ d, a, n, L, tr, f, li: LEVELS.indexOf(L), len: clusters(d).length, cs: clusters(d) }));
for (const w of bank) {
  if (w.L === "full") continue;
  const marks = w.cs.map((c) => c.m).join("");
  const extra = [...marks].filter((m) => !allowed[w.L].includes(m) && !HAMZA.includes(m));
  if (extra.length) bad("знак не по уровню:", w.L, w.d, w.a, "лишние:", [...new Set(extra)].map((c) => "U+" + c.codePointAt(0).toString(16)).join(","));
  // до уровня «мадд» в слове не должно быть букв без огласовки (кроме алифа после фатхатана)
  // фатхатан над лям-алифом в мусхафе стоит на алифе: عَمَلاً
  if (w.li < LEVELS.indexOf("madd")) w.cs.forEach((c, i) => { if (!c.m && !(c.b === "ا" && /ً/.test(w.cs[i - 1]?.m || "")) && !(c.b === "ل" && w.cs[i + 1]?.b === "ا" && /ً/.test(w.cs[i + 1].m)) && c.b !== "ـ") bad("буква без огласовки до уровня мадда:", w.L, w.d, w.a); });
  if (!w.tr || /undefined|null/.test(w.tr)) bad("нет транскрипции:", w.d, w.a);
}

// ---------- 2. Подборки слов в уроках ----------
const pool = ({ level = "full", need = "", avoid = "", maxLen = 7, minLen = 2 }) => bank.filter((w) => w.li <= LEVELS.indexOf(level) && w.len <= maxLen && w.len >= minLen && [...need].every((c) => w.f.includes(c)) && ![...avoid].some((c) => w.f.includes(c)));
// что уже пройдено к уроку: сукун (4.5) раньше танвина (4.6), мадда (7.1) и шадды (7.8)
const order = ALL_LESSONS.map((l) => l.id);
const before = (id, than) => order.indexOf(id) < order.indexOf(than);
for (const l of ALL_LESSONS) {
  for (const st of l.steps) {
    const o = st.t === "card" ? st.wordsLevel : ["read", "speak"].includes(st.t) || (st.t === "ex" && st.level) ? st : null;
    if (!o || !o.level || o.lunar || o.solar || o.heavyStart || o.startsWith) continue;
    const ws = pool({ level: o.level, need: o.need || "", avoid: o.avoid || "", maxLen: o.maxLen || (st.t === "read" ? 6 : 5) });
    const n = o.n || st.n || 1;
    if (ws.length < Math.max(n, 4)) bad(`урок ${l.id}: мало слов (${ws.length}) для`, JSON.stringify({ level: o.level, need: o.need, avoid: o.avoid, maxLen: o.maxLen }));
    for (const w of ws) {
      const marks = w.cs.map((c) => c.m).join("");
      if (before(l.id, "4.6") && /[ًٌٍ]/.test(marks)) bad(`урок ${l.id}: танвин до урока 4.6 —`, w.d);
      if (before(l.id, "7.8") && marks.includes(SHADDA)) bad(`урок ${l.id}: шадда до урока 7.8 —`, w.d);
      if (before(l.id, "7.1") && (/[ٰۥۦ]/.test(marks) || w.f.includes("m"))) bad(`урок ${l.id}: долгая гласная до урока 7.1 —`, w.d);
      if (before(l.id, "4.5") && /[ْۡ]/.test(marks)) bad(`урок ${l.id}: сукун до урока 4.5 —`, w.d);
    }
  }
}

// ---------- 3. Ссылки внутри курса ----------
const ids = new Set();
for (const l of ALL_LESSONS) {
  if (ids.has(l.id)) bad("повтор номера урока", l.id);
  ids.add(l.id);
  if (!l.title || !l.steps?.length) bad("пустой урок", l.id);
  for (const id of Array.isArray(l.letters) ? l.letters : []) if (!byId[id]) bad(`урок ${l.id}: нет буквы`, id);
  for (const st of l.steps) {
    if (["letter", "forms"].includes(st.t) && !byId[st.id]) bad(`урок ${l.id}: нет буквы`, st.id);
    if (st.t === "rule" && !RULES[st.code]) bad(`урок ${l.id}: нет правила`, st.code);
    if (st.t === "ex" && st.code && !RULES[st.code]) bad(`урок ${l.id}: нет правила`, st.code);
    for (const c of st.codes || []) if (!RULES[c]) bad(`урок ${l.id}: нет правила`, c);
    for (const id of Array.isArray(st.letters) ? st.letters : []) if (!byId[id]) bad(`урок ${l.id}: нет буквы`, id);
    for (const p of Array.isArray(st.pairs) ? st.pairs : []) for (const id of p) if (!byId[id]) bad(`урок ${l.id}: нет буквы`, id);
    if (st.t === "quiz" && (!st.q || st.a?.length < 2 || !st.why)) bad(`урок ${l.id}: неполный вопрос`, st.q);
  }
}
const src = (f) => readFileSync(join(root, f), "utf8");
for (const [f, re] of [["js/path.js", /(?:lessonDone\(|SURAH_GATE = |\[)"(\d+\.\d+)"/g], ["js/views/onboard.js", /\/learn\/(\d+\.\d+)/g], ["js/views/review.js", /need: "(\d+\.\d+)"/g]])
  for (const m of src(f).matchAll(re)) if (!lessonById[m[1]]) bad(`${f}: ссылка на несуществующий урок`, m[1]);
for (const u of UNITS) if (!u.lessons.at(-1).test && u.id !== 1 && u.id !== 6) bad("этап без итоговой проверки:", u.id);

// ---------- 4. Тексты сур ----------
const surahs = J("data/surahs.json");
if (surahs.length !== 114) bad("сур в списке:", surahs.length);
let total = 0;
for (const [id, ar, ru, meaning, verses] of surahs) {
  const d = J(`data/q/${String(id).padStart(3, "0")}.json`);
  total += d.v.length;
  if (d.v.length !== verses) bad(`сура ${id}: аятов ${d.v.length}, в списке ${verses}`);
  if (!ar || !ru || !meaning) bad(`сура ${id}: нет названия`);
  d.v.forEach((v, i) => {
    if (!v[0]?.length || v[0].some((w) => !w || !/[ء-ي]/.test(w))) bad(`сура ${id}:${i + 1}: пустое слово`);
    if (!v[1]) bad(`сура ${id}:${i + 1}: нет перевода`);
    for (const w of v[0]) { const open = (w.match(/\[/g) || []).length, close = (w.match(/\]/g) || []).length; if (open !== close) bad(`сура ${id}:${i + 1}: сломана разметка`, w); for (const m of w.matchAll(/\[([a-zA-Z])/g)) if (!RULES[m[1]]) bad(`сура ${id}:${i + 1}: неизвестное правило`, m[1]); }
  });
}
if (total !== 6236) bad("всего аятов:", total, "(должно быть 6236)");
for (const n of SURAH_PATH) if (!surahs[n - 1]) bad("нет суры пути", n);
for (const m of src("js/course.js").matchAll(/verse: "(\d+):(\d+)"/g)) if (!(+m[2] <= surahs[+m[1] - 1]?.[4])) bad("нет аята", m[0]);
const pairs = J("data/pairs.json");
for (const p of pairs) { if (!byId[p[0]] || !byId[p[1]]) bad("пары: нет буквы", p[0], p[1]); }

console.log(`Слов в банке: ${bank.length}, уроков: ${ALL_LESSONS.length}, сур: ${surahs.length}, аятов: ${total}, пар: ${pairs.length}`);
const uniq = [...new Set(problems)];
for (const p of uniq.slice(0, 80)) console.log(" •", p);
console.log(uniq.length ? `Замечаний: ${uniq.length}` : "Замечаний нет.");
process.exit(uniq.length ? 1 : 0);
