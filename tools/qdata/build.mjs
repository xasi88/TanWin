// Собирает учебные данные из скачанных ответов Quran.com API (raw/, seg12/, seg7/).
//   node tools/qdata/fetch.mjs      — скачать слова, таджвид-разметку и перевод (Кулиев)
//   node tools/qdata/fetch_seg.mjs  — скачать тайминги слов (аль-Хусари «муаллим», Мишари Афаси)
//   node tools/qdata/build.mjs      — собрать data/surahs.json, data/q/NNN.json, data/bank.json
// Формат аята в data/q/NNN.json: [слова с разметкой таджвида, перевод, тайминги Хусари, тайминги Афаси, [страница, строки…], джуз]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { analyze, levelOf, translit, stripStops } from "../../js/arabic.js";
import { SOUND_PAIRS, byId } from "../../js/letters.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = join(here, "..", "..");
const pad = (n) => String(n).padStart(3, "0");
const read = (p) => JSON.parse(readFileSync(join(here, p), "utf8"));

// Коды правил таджвида (разметка Quran.com → компактная «[код текст]»)
export const RULE_CODES = {
  ham_wasl: "w", laam_shamsiyah: "l", slnt: "s",
  madda_normal: "n", madda_permissible: "p", madda_obligatory_mottasel: "o", madda_obligatory_monfasel: "u", madda_necessary: "x",
  qalaqah: "q", ghunnah: "g", ikhafa: "f", ikhafa_shafawi: "F", iqlab: "i",
  idgham_ghunnah: "d", idgham_wo_ghunnah: "D", idgham_shafawi: "h", idgham_mutajanisayn: "j", idgham_mutaqaribayn: "k",
};
// Вложенные правила разворачиваются: каждый фрагмент получает самое внутреннее правило.
function compact(html) {
  const stack = [];
  const runs = [];
  for (const tok of html.split(/(<rule class=[a-z_-]+>|<\/rule>)/)) {
    if (!tok) continue;
    const open = tok.match(/^<rule class=([a-z_-]+)>$/);
    if (open) { stack.push(open[1] === "custom-alef-maksora" ? stack[stack.length - 1] ?? null : open[1]); continue; }
    if (tok === "</rule>") { stack.pop(); continue; }
    if (/[<>]/.test(tok)) throw new Error("unparsed markup: " + html);
    const c = stack[stack.length - 1] ?? null;
    const code = c ? RULE_CODES[c] : "";
    if (c && !code) throw new Error("unknown rule " + c);
    const last = runs[runs.length - 1];
    if (last && last[0] === code) last[1] += tok; else runs.push([code, tok]);
  }
  return runs.map(([c, t]) => (c ? `[${c}${t}]` : t)).join("");
}
// В тексте с разметкой таджвида знаки «не читается» (кружок U+06DF и вытянутый нолик U+06E0) заменены сукуном U+06E1.
// Возвращаем их по обычному тексту того же слова: k-й знак из {сукун, кружок, нолик} соответствует k-му U+06E1.
const zeroStats = { fixed: 0, skipped: 0 };
function fixZero(cw, uthmani) {
  const marks = [...uthmani].filter((c) => c === "ْ" || c === "۟" || c === "۠");
  if (!marks.some((c) => c !== "ْ")) return cw;
  if ([...cw].filter((c) => c === "ۡ").length !== marks.length) { zeroStats.skipped++; return cw; }
  let k = 0;
  return cw.replace(/ۡ/g, () => { const m = marks[k++]; if (m === "ْ") return "ۡ"; zeroStats.fixed++; return m; });
}
const plainOf = (compactText) => compactText.replace(/\[[a-zA-Z]/g, "").replace(/\]/g, "");

// Русские названия сур (транслитерация)
const NAMES_RU = ["Аль-Фатиха","Аль-Бакара","Аль Имран","Ан-Ниса","Аль-Маида","Аль-Анам","Аль-Араф","Аль-Анфаль","Ат-Тауба","Юнус","Худ","Юсуф","Ар-Раад","Ибрахим","Аль-Хиджр","Ан-Нахль","Аль-Исра","Аль-Кахф","Марьям","Та Ха","Аль-Анбия","Аль-Хадж","Аль-Муминун","Ан-Нур","Аль-Фуркан","Аш-Шуара","Ан-Намль","Аль-Касас","Аль-Анкабут","Ар-Рум","Лукман","Ас-Саджда","Аль-Ахзаб","Саба","Фатыр","Йа Син","Ас-Саффат","Сад","Аз-Зумар","Гафир","Фуссилат","Аш-Шура","Аз-Зухруф","Ад-Духан","Аль-Джасия","Аль-Ахкаф","Мухаммад","Аль-Фатх","Аль-Худжурат","Каф","Аз-Зарият","Ат-Тур","Ан-Наджм","Аль-Камар","Ар-Рахман","Аль-Вакиа","Аль-Хадид","Аль-Муджадала","Аль-Хашр","Аль-Мумтахана","Ас-Сафф","Аль-Джумуа","Аль-Мунафикун","Ат-Тагабун","Ат-Талак","Ат-Тахрим","Аль-Мульк","Аль-Калам","Аль-Хакка","Аль-Мааридж","Нух","Аль-Джинн","Аль-Муззаммиль","Аль-Муддассир","Аль-Кияма","Аль-Инсан","Аль-Мурсалят","Ан-Наба","Ан-Назиат","Абаса","Ат-Таквир","Аль-Инфитар","Аль-Мутаффифин","Аль-Иншикак","Аль-Бурудж","Ат-Тарик","Аль-Аля","Аль-Гашия","Аль-Фаджр","Аль-Балад","Аш-Шамс","Аль-Лейль","Ад-Духа","Аш-Шарх","Ат-Тин","Аль-Аляк","Аль-Кадр","Аль-Баййина","Аз-Зальзаля","Аль-Адият","Аль-Кариа","Ат-Такасур","Аль-Аср","Аль-Хумаза","Аль-Филь","Курайш","Аль-Маун","Аль-Каусар","Аль-Кафирун","Ан-Наср","Аль-Масад","Аль-Ихлас","Аль-Фаляк","Ан-Нас"];

const chapters = read("chapters_ru.json").chapters;
const surahs = [];
const bank = new Map(); // plain uthmani → запись
const CURRICULUM = new Set([1, ...Array.from({ length: 37 }, (_, i) => 78 + i)]);
const MUQATTAAT = new Set(["2:1:1","3:1:1","7:1:1","10:1:1","11:1:1","12:1:1","13:1:1","14:1:1","15:1:1","19:1:1","20:1:1","26:1:1","27:1:1","28:1:1","29:1:1","30:1:1","31:1:1","32:1:1","36:1:1","38:1:1","40:1:1","41:1:1","42:1:1","42:2:1","43:1:1","44:1:1","45:1:1","46:1:1","50:1:1","68:1:1"]);
const ruleStats = {};

mkdirSync(join(root, "data", "q"), { recursive: true });
for (let s = 1; s <= 114; s++) {
  const V = read(`raw/${pad(s)}.json`);
  const S12 = read(`seg12/${pad(s)}.json`);
  const S7 = read(`seg7/${pad(s)}.json`);
  const ch = chapters[s - 1];
  const verses = V.map((v, idx) => {
    const words = v.words.filter((w) => w.char_type_name === "word");
    const cw = words.map((w) => fixZero(compact(w.text_uthmani_tajweed), w.text_uthmani));
    const tr = (v.translations?.[0]?.text || "").replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const segs = (S) => {
      const row = S.find((r) => r[0] === v.verse_number);
      if (!row) return null;
      const out = new Array(words.length).fill(null);
      for (const [p, a, b] of row[2]) if (p >= 1 && p <= words.length) out[p - 1] = [a, b];
      return out.flat().map((x) => x ?? -1);
    };
    // банк слов
    words.forEach((w, i) => {
      const key = `${s}:${v.verse_number}:${w.position}`;
      if (MUQATTAAT.has(key)) return;
      const u = stripStops(w.text_uthmani);
      const disp = stripStops(plainOf(cw[i]));
      for (const m of cw[i].matchAll(/\[([a-zA-Z])/g)) ruleStats[m[1]] = (ruleStats[m[1]] || 0) + 1;
      let e = bank.get(u);
      if (!e) {
        const a = analyze(u);
        e = { u, d: disp, a: `${pad(s)}_${pad(v.verse_number)}_${pad(w.position)}`, n: 0, L: levelOf(a.f), tr: translit(u), f: [...a.f], len: a.cs.length, cur: false };
        bank.set(u, e);
      }
      e.n++;
      if (CURRICULUM.has(s)) e.cur = true;
    });
    // Мусхаф Мадины (604 страницы по 15 строк): [страница первого слова, строка каждого слова…, строка знака конца аята], джуз.
    // Новая страница внутри аята — там, где номер строки уменьшается.
    const marks = v.words.filter((w) => w.char_type_name === "word" || w.char_type_name === "end");
    const pl = [marks[0].page_number, ...marks.map((w) => w.line_number)];
    return [cw, tr, segs(S12), segs(S7), pl, v.juz_number];
  });
  const name_ru = NAMES_RU[s - 1];
  surahs.push([s, ch.name_arabic, name_ru, ch.translated_name.name, ch.verses_count, ch.revelation_place === "makkah" ? "м" : "д", ch.pages[0]]);
  writeFileSync(join(root, "data", "q", `${pad(s)}.json`), JSON.stringify({ id: s, v: verses }));
}
writeFileSync(join(root, "data", "surahs.json"), JSON.stringify(surahs));

// Банк слов: все «ранние» слова, частые слова поздних уровней и все слова учебных сур
// Минимальные пары по всему Корану: слова, отличающиеся одной «трудной» буквой (س/ص, ت/ط, ك/ق…)
const pairs = [];
const HZ = ["أ", "إ", "ء", "ؤ", "ئ"];
for (const [a, b] of SOUND_PAIRS) {
  const A = a === "hamza" ? HZ : [byId[a].ch], B = b === "hamza" ? HZ : [byId[b].ch];
  const seen = new Set();
  for (const [u, e] of bank) for (const x of A) {
    let i = u.indexOf(x);
    while (i >= 0) {
      for (const y of B) {
        const e2 = bank.get(u.slice(0, i) + y + u.slice(i + 1));
        const k = [e.d, e2?.d].sort().join("|");
        if (e2 && e2 !== e && !seen.has(k)) { seen.add(k); pairs.push([a, b, e.d, e.a, e.tr, e2.d, e2.a, e2.tr]); }
      }
      i = u.indexOf(x, i + 1);
    }
  }
}
writeFileSync(join(root, "data", "pairs.json"), JSON.stringify(pairs));
console.log("minimal pairs:", pairs.length);

// Примеры редких правил со всего Корана (для карточек правил)
const RARE = ["j", "k", "x", "i", "F", "h"];
const rare = Object.fromEntries(RARE.map((c) => [c, []]));
for (let s = 1; s <= 114; s++) {
  const d = JSON.parse(readFileSync(join(root, "data", "q", `${pad(s)}.json`), "utf8"));
  d.v.forEach((v, ai) => v[0].forEach((w, wi) => {
    for (const c of RARE) if (rare[c].length < 24 && w.includes("[" + c) && v[0].length <= 12) rare[c].push([s, ai + 1, wi, v[0]]);
  }));
}
writeFileSync(join(root, "data", "rare.json"), JSON.stringify(rare));

const all = [...bank.values()];
const keep = all.filter((e) => {
  if (e.len > 9) return false;
  if (["fatha", "kasra", "damma", "tanween"].includes(e.L)) return true;
  if (e.cur) return true;
  if (e.L === "full") return e.n >= 4;
  return e.n >= 2;
});
keep.sort((a, b) => b.n - a.n);
const FEAT = { fatha: "a", kasra: "i", damma: "u", tanween: "T", tanweenAlif: "A", tamarbuta: "t", madd: "m", dagger: "g", maqsura: "y", sila: "S", sukun: "0", leen: "L", shadda: "2", hamza: "h", wasl: "w", silent: "z", maddah: "M", iqlab: "q", allah: "@", bareSakin: "b", muqattaat: "Q" };
const out = keep.map((e) => [e.d, e.a, e.n, e.L, e.tr, e.f.map((x) => FEAT[x] || "").join(""), e.cur ? 1 : 0]);
writeFileSync(join(root, "data", "bank.json"), JSON.stringify(out));
const byL = {}; for (const e of keep) byL[e.L] = (byL[e.L] || 0) + 1;
console.log("знаки «не читается» восстановлены:", zeroStats);
console.log("surahs:", surahs.length, "bank:", out.length, byL, "rules:", ruleStats);
