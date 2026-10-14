// Скачивает записи букв и слогов «Каиды Нурании» из репозитория github.com/ibr7h/al-qaida-nooraniyya
// и кладёт их в папку под именами TanWin: <id>.mp3 — название буквы, <id>-a|i|u.mp3 — буква с фатхой, касрой, даммой
// (чтец читает слог по складам: «ба, фатха, ба»; эти записи звучат в приложении целиком, мы их не режем).
// Запуск:  node tools/audio/fetch-qaida.mjs <папка для исходных записей>
// Потом:   node tools/audio/build.mjs <та же папка>
// Какая запись к какой букве относится, берётся из описаний уроков самого источника (урок 1 — буквы, урок 4 — слоги).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LETTERS } from "../../js/letters.js";

const out = process.argv[2];
if (!out) { console.error("Укажите папку для исходных записей"); process.exit(1); }
mkdirSync(out, { recursive: true });
const SITE = "https://ibr7h.github.io/al-qaida-nooraniyya/assets/";
const get = async (path) => { const r = await fetch(SITE + path); if (!r.ok) throw new Error(`${path}: ${r.status}`); return r; };
const lesson = async (n) => (await get(`content/lessons/lesson_${n}.json`)).json();

const byCh = Object.fromEntries(LETTERS.map((l) => [l.ch, l.id]));
const idOf = (ch) => byCh[ch === "ه" || ch === "هـ" ? "ه" : ch === "أ" || ch === "إ" ? "ء" : ch];
const VOW = { "َ": "a", "ِ": "i", "ُ": "u" };
const jobs = new Map(); // имя TanWin → файл источника
for (const it of (await lesson("01")).items) {
  if (it.type !== "letter") continue;
  const id = idOf(it.text);
  if (id && !jobs.has(id)) jobs.set(id, it.audio); // ي встречается дважды (вторая — форма ى): берём первую
}
const l4 = (await lesson("04")).items;
const uses = {}; // сколько записей урока ссылается на файл
for (const it of l4) uses[it.audio] = (uses[it.audio] || 0) + 1;
for (const it of l4) {
  if (it.type !== "custom") continue;
  const v = VOW[it.text.at(-1)], id = idOf(it.text.slice(0, -1));
  if (!id || !v) continue;
  let file = it.audio;
  // Ошибка в описании источника: у بَ указан файл f4-131 — это запись «وَ وِ وُ» предыдущей буквы, а f4-132 не указан нигде.
  // Правило: файл слога занят ещё одной записью, а следующий по номеру свободен — берём следующий.
  if (uses[file] > 1) {
    const next = file.replace(/(\d+)(?=\.mp3$)/, (n) => String(+n + 1).padStart(n.length, "0"));
    if (!uses[next]) { console.log(`${id}-${v}: в источнике указан ${file}, он занят другой записью — берём ${next}`); file = next; }
    else { console.error(`${id}-${v}: файл ${file} указан дважды, какой верный — неясно`); process.exit(1); }
  }
  jobs.set(`${id}-${v}`, file);
}
const need = LETTERS.flatMap((l) => (l.id === "alif" ? ["alif"] : [l.id, `${l.id}-a`, `${l.id}-i`, `${l.id}-u`]));
const missing = need.filter((x) => !jobs.has(x));
if (missing.length) { console.error("В источнике нет записей:", missing.join(", ")); process.exit(1); }
for (const name of need) writeFileSync(join(out, name + ".mp3"), Buffer.from(await (await get("audio/" + jobs.get(name))).arrayBuffer()));
writeFileSync(join(out, "map.json"), JSON.stringify(Object.fromEntries(need.map((n) => [n, jobs.get(n)])), null, 1));
console.log(`Скачано записей: ${need.length}`);
