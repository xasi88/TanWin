// Проверка карты функций (docs/Карта TanWin): заметки связаны между собой и не расходятся с кодом.
//   • каждая ссылка [[…]] ведёт на существующую заметку;
//   • экран и функция знают друг о друге: функция называет экран — на экране есть ссылка на неё, и наоборот;
//   • привязки к коду живы: строка, на которую опирается заметка, дословно есть в названном файле;
//   • у функции указаны приложения, экраны, статус и проверка; расхождение и вопрос описаны словами;
//   • у экрана есть раздел «Робот» с понятными шагами (их выполняет tools/audit/screens-check.mjs);
//   • список на главной заметке свежий.
// Запуск из корня проекта:
//   node tools/map-check.mjs             — проверить
//   node tools/map-check.mjs --write     — заодно обновить список на главной заметке
//   node tools/map-check.mjs --changed   — показать код, который изменился с ветки main, а заметки о нём — нет
//                                          (--base=ветка — сравнить с другой веткой; --strict — считать это ошибкой)
// Как устроены заметки — в «docs/Карта TanWin/Как вести карту.md».
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { parseSteps } from "./map-steps.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const MAP_DIR = "docs/Карта TanWin";
const MAP = join(root, MAP_DIR);
const HOME = "Карта TanWin";
const TYPES = ["приложение", "экран", "функция", "карта"];
const STATUS = ["работает", "расхождение", "вопрос"];
const CHECK = ["бот", "частично", "нет"];
const ISSUE = { расхождение: "Расхождение", вопрос: "Вопрос автору" };
const args = process.argv.slice(2);
const flag = (k) => args.includes(k);

// ---------- Чтение заметок ----------
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || name === "Мои мысли" || name === "Обратная связь") continue; // личные записи автора и сообщения пользователей — не заметки карты, лежат только на его компьютере
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p); else if (name.endsWith(".md")) files.push(p);
  }
})(MAP);

const linksIn = (text) => [...text.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/g)].map((m) => m[1].trim());
const unquote = (v) => v.trim().replace(/^"(.*)"$/, "$1");
/** Свойства заметки: «ключ: значение» или «ключ:» и строки «  - значение». */
function props(src) {
  const out = {};
  let key = null;
  for (const line of src.split("\n")) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && key) { out[key].push(unquote(item[1])); continue; }
    const kv = line.match(/^([^\s:#][^:]*):\s*(.*)$/);
    if (!kv) continue;
    key = kv[1].trim();
    out[key] = kv[2] ? unquote(kv[2]) : [];
    if (kv[2]) key = null;
  }
  return out;
}
/** Разделы заметки по заголовкам «## …»; текст до первого заголовка — под ключом "". */
function sections(body) {
  const out = { "": "" };
  let cur = "";
  for (const line of body.split("\n")) {
    const hd = line.match(/^## (.+)$/);
    if (hd) { cur = hd[1].trim(); out[cur] = ""; } else out[cur] += line + "\n";
  }
  return out;
}
/** Привязки из раздела «Для разработки»: { Код: [[файл, строка]], Проверка: […], … } */
function anchors(text = "") {
  const out = {};
  let label = "";
  for (const line of text.split("\n")) {
    const lb = line.match(/^([^-`\s][^:`]*):/);
    if (lb) { label = lb[1].trim(); continue; }
    const a = line.match(/^- `([^`]+)` · `(.+)`$/);
    if (a) (out[label] || (out[label] = [])).push([a[1], a[2]]);
  }
  return out;
}

const notes = new Map(); // название → заметка
const errors = [], warns = [];
const err = (n, text) => errors.push(`${n}: ${text}`);
for (const p of files) {
  const rel = relative(root, p).split(sep).join("/");
  const name = p.split(sep).pop().replace(/\.md$/, "");
  const src = readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  const m = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) { err(name, "нет свойств в начале заметки (блок между строками «---»)"); continue; }
  if (notes.has(name)) { err(name, `две заметки с одним названием: ${notes.get(name).rel} и ${rel}`); continue; }
  const pr = props(m[1]), sec = sections(m[2]);
  notes.set(name, { name, rel, path: p, src, pr, sec, body: m[2], anc: anchors(sec["Для разработки"]) });
}
const type = (n) => notes.get(n)?.pr["тип"];
const propLinks = (note, key) => [].concat(note.pr[key] || []).flatMap(linksIn);

// ---------- Проверки ----------
const fileCache = new Map();
const fileText = (f) => { if (!fileCache.has(f)) { const p = join(root, f); fileCache.set(f, existsSync(p) && statSync(p).isFile() ? readFileSync(p, "utf8") : null); } return fileCache.get(f); };

for (const n of notes.values()) {
  const t = n.pr["тип"];
  if (!TYPES.includes(t)) { err(n.name, `свойство «тип» должно быть одним из: ${TYPES.join(", ")}`); continue; }
  // ссылки — и в свойствах, и в тексте
  for (const l of new Set([...linksIn(n.src)])) if (!notes.has(l)) err(n.name, `ссылка [[${l}]] ведёт в никуда`);
  if (t === "карта") continue;
  if (!n.pr["адрес"] && t !== "функция") err(n.name, "не указан «адрес»");

  if (t !== "приложение") {
    const apps = propLinks(n, "приложения");
    if (!apps.length) err(n.name, "не указаны «приложения»");
    for (const a of apps) if (type(a) !== "приложение") err(n.name, `в «приложениях» названо не приложение: ${a}`);
  }
  if (t === "экран") {
    for (const s of ["Как сюда попадают", "Что на экране", "Для разработки", "Робот"]) if (!(s in n.sec)) err(n.name, `нет раздела «${s}»`);
    const base = propLinks(n, "основа");
    for (const b of base) if (type(b) !== "экран") err(n.name, `«основа» должна быть экраном: ${b}`);
    // шаги для робота по экранам (tools/audit/screens-check.mjs): запись понятна, экран открывается и на нём что-то проверяется
    const robot = parseSteps(n.sec["Робот"]);
    for (const b of robot.bad) err(n.name, `в разделе «Робот» непонятная строка: ${b}`);
    for (const v of ["открыть", "есть"]) if ("Робот" in n.sec && !robot.steps.some((s) => s.verb === v)) err(n.name, `в разделе «Робот» нет ни одного шага «${v}»`);
  }
  if (t === "функция") {
    for (const s of ["Правила", "Для разработки"]) if (!(s in n.sec)) err(n.name, `нет раздела «${s}»`);
    const st = n.pr["статус"], ck = n.pr["проверка"];
    if (!STATUS.includes(st)) err(n.name, `«статус» должен быть одним из: ${STATUS.join(", ")}`);
    if (!CHECK.includes(ck)) err(n.name, `«проверка» должна быть одним из: ${CHECK.join(", ")}`);
    for (const [s, title] of Object.entries(ISSUE)) {
      if (st === s && !(n.sec[title] || "").trim()) err(n.name, `статус «${s}», а раздела «${title}» нет`);
      if (st !== s && title in n.sec) err(n.name, `есть раздел «${title}», а статус — «${st}»`);
    }
    const screens = propLinks(n, "экраны");
    if (!screens.length) err(n.name, "не указаны «экраны»");
    for (const s of screens) {
      const sn = notes.get(s);
      if (type(s) !== "экран") { err(n.name, `в «экранах» назван не экран: ${s}`); continue; }
      if (!linksIn(sn.sec["Что на экране"] || "").includes(n.name)) err(n.name, `называет экран «${s}», а в его разделе «Что на экране» ссылки на эту функцию нет`);
      if (!propLinks(sn, "приложения").some((a) => propLinks(n, "приложения").includes(a))) err(n.name, `экран «${s}» есть только в приложениях, где самой функции нет`);
    }
    const tests = n.anc["Проверка"] || [];
    if (ck === "нет" && tests.length) err(n.name, "«проверка: нет», а под словом «Проверка:» названы проверки бота");
    if (ck !== "нет" && !tests.length) err(n.name, `«проверка: ${ck}», а под словом «Проверка:» ни одной проверки бота`);
  }
  if (t === "экран") for (const f of linksIn(n.sec["Что на экране"] || "")) {
    if (type(f) === "функция" && !propLinks(notes.get(f), "экраны").includes(n.name)) err(n.name, `в «Что на экране» есть функция «${f}», а она этот экран в «экранах» не называет`);
  }
  // привязки к коду
  if (!(n.anc["Код"] || []).length) err(n.name, "в разделе «Для разработки» под словом «Код:» нет ни одной привязки");
  for (const [label, list] of Object.entries(n.anc)) for (const [f, needle] of list) {
    const text = fileText(f);
    if (text == null) err(n.name, `привязка к файлу, которого нет: ${f}`);
    else if (!text.includes(needle)) err(n.name, `в ${f} больше нет строки «${needle}»`);
    if (label === "Проверка" && !f.startsWith("tools/")) err(n.name, `под словом «Проверка:» должен быть файл из tools/, а не ${f}`);
  }
}

// ---------- Список на главной заметке ----------
const byName = (a, b) => a.name.localeCompare(b.name, "ru");
const all = (t) => [...notes.values()].filter((n) => n.pr["тип"] === t).sort(byName);
function index() {
  const screens = all("экран"), feats = all("функция");
  const open = feats.filter((f) => f.pr["статус"] !== "работает");
  const first = (f) => (f.sec[ISSUE[f.pr["статус"]]] || "").trim().split("\n")[0]; // первая строка раздела — суть одним предложением
  const count = (k, v) => feats.filter((f) => f.pr[k] === v).length;
  const featsOn = (s) => feats.filter((f) => propLinks(f, "экраны").includes(s.name)).length;
  const head = (...cols) => `| ${cols.join(" | ")} |\n|${cols.map(() => "---").join("|")}|`;
  const row = (...cols) => `| ${cols.join(" | ")} |`;
  return [
    "## Что требует решения", "",
    ...(open.length ? open.map((f) => `- [[${f.name}]] — ${f.pr["статус"]}. ${first(f)}`) : ["Сейчас ничего."]), "",
    "## Экраны", "",
    head("Экран", "Адрес", "Своих функций"),
    ...screens.map((s) => row(`[[${s.name}]]`, s.pr["адрес"], featsOn(s))), "",
    "## Функции", "",
    head("Функция", "Статус", "Проверка", "Экраны"),
    ...feats.map((f) => row(`[[${f.name}]]`, f.pr["статус"], f.pr["проверка"], propLinks(f, "экраны").map((s) => `[[${s}]]`).join(", "))), "",
    `Всего: экранов — ${screens.length}, функций — ${feats.length}. Поведение проверяет бот: ${count("проверка", "бот")}; частично: ${count("проверка", "частично")}; без проверки: ${count("проверка", "нет")}.`,
  ].join("\n");
}
const home = notes.get(HOME);
const MARK = /(<!-- СПИСОК: начало[^>]*-->\n)[\s\S]*?(<!-- СПИСОК: конец -->)/;
if (!home || !MARK.test(home.src)) err(HOME, "нет главной заметки или в ней нет отметок «СПИСОК: начало / конец»");
else if (!errors.length) {
  const fresh = home.src.replace(MARK, (_, a, b) => `${a}\n${index()}\n\n${b}`);
  if (fresh !== home.src) {
    if (flag("--write")) { writeFileSync(home.path, fresh); console.log("Список на главной заметке обновлён."); }
    else err(HOME, "список на главной заметке устарел — запустите node tools/map-check.mjs --write");
  }
}

// ---------- Код изменился, а заметки — нет ----------
if (flag("--changed")) {
  const base = (args.find((a) => a.startsWith("--base=")) || "--base=main").slice(7);
  const git = (...a) => execFileSync("git", ["-c", "core.quotepath=off", ...a], { cwd: root, encoding: "utf8" });
  const changed = new Set(git("diff", "--name-only", "-z", `${base}...HEAD`).split("\0").filter(Boolean));
  const st = git("status", "--porcelain", "-uall", "-z").split("\0");
  for (let i = 0; i < st.length; i++) { if (st[i].length < 4) continue; changed.add(st[i].slice(3)); if (/[RC]/.test(st[i].slice(0, 2))) i++; } // у переименования следом идёт старое имя
  const mapTouched = (n) => changed.has(n.rel);
  const byFile = new Map(); // файл кода → заметки, которые на него опираются
  for (const n of notes.values()) for (const [f] of n.anc["Код"] || []) (byFile.get(f) || byFile.set(f, []).get(f)).push(n);
  const stale = [...byFile].filter(([f, ns]) => changed.has(f) && !ns.some(mapTouched)).sort();
  if (!stale.length) console.log(`С ветки ${base}: код, описанный на карте, без заметок не менялся.`);
  for (const [f, ns] of stale) (flag("--strict") ? errors : warns).push(`${f} изменился, а ни одна заметка о нём — нет. Перечитайте: ${ns.map((n) => n.name).sort().join(", ")}`);
}

// ---------- Итог ----------
const feats = all("функция");
for (const w of warns) console.log(`! ${w}`);
for (const e of errors) console.log(`✗ ${e}`);
if (!errors.length) {
  const n = (k, v) => feats.filter((f) => f.pr[k] === v).length;
  console.log(`✓ Карта в порядке: заметок — ${notes.size}, экранов — ${all("экран").length}, функций — ${feats.length} (расхождений — ${n("статус", "расхождение")}, вопросов — ${n("статус", "вопрос")}; проверяет бот — ${n("проверка", "бот")}, частично — ${n("проверка", "частично")}, без проверки — ${n("проверка", "нет")}).`);
} else console.log(`Не прошло: ${errors.length}`);
process.exit(errors.length ? 1 : 0);
