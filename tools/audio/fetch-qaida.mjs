// Скачивает записи букв и слогов «Каиды Нурании» из репозитория github.com/ibr7h/al-qaida-nooraniyya
// и кладёт их в папку под именами TanWin: <id>.mp3 — название буквы, <id>-a|i|u.mp3 — буква с фатхой, касрой, даммой.
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
for (const it of (await lesson("04")).items) {
  if (it.type !== "custom") continue;
  const v = VOW[it.text.at(-1)], id = idOf(it.text.slice(0, -1));
  if (id && v) jobs.set(`${id}-${v}`, it.audio);
}
const need = LETTERS.flatMap((l) => (l.id === "alif" ? ["alif"] : [l.id, `${l.id}-a`, `${l.id}-i`, `${l.id}-u`]));
const missing = need.filter((x) => !jobs.has(x));
if (missing.length) { console.error("В источнике нет записей:", missing.join(", ")); process.exit(1); }
for (const name of need) writeFileSync(join(out, name + ".mp3"), Buffer.from(await (await get("audio/" + jobs.get(name))).arrayBuffer()));
writeFileSync(join(out, "map.json"), JSON.stringify(Object.fromEntries(need.map((n) => [n, jobs.get(n)])), null, 1));
console.log(`Скачано записей: ${need.length}`);

// ---------- Слог без проговаривания ----------
// В уроке 4 «Каиды» чтец проговаривает слог по складам: «ро — фатха — ро». Нам нужен только итог — последний слог.
// Ищем на записи последний всплеск громкости (гласный слога) и провал перед ним (граница со словом «фатха»),
// режем чуть раньше провала — там, где затих предыдущий гласный: так согласный слога остаётся целым.
import { spawnSync } from "node:child_process";
import { renameSync } from "node:fs";
const RATE = 22050, WIN = 220; // окно 10 мс
const pcmOf = (file) => { const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-i", file, "-ac", "1", "-ar", String(RATE), "-f", "s16le", "-"], { maxBuffer: 1e8 }); return new Int16Array(r.stdout.buffer, r.stdout.byteOffset, r.stdout.length >> 1); };
export function cutPoint(file) {
  const pcm = pcmOf(file), raw = [];
  for (let i = 0; i + WIN <= pcm.length; i += WIN) { let s = 0; for (let k = 0; k < WIN; k++) s += pcm[i + k] ** 2; raw.push(Math.sqrt(s / WIN)); }
  const env = raw.map((_, i) => (raw[i - 1] ?? raw[i]) * 0.25 + raw[i] * 0.5 + (raw[i + 1] ?? raw[i]) * 0.25);
  const max = Math.max(...env);
  let end = env.length - 1; while (end > 0 && env[end] < max * 0.08) end--;
  const argmax = (a, b) => { let m = a; for (let i = a; i <= b; i++) if (env[i] > env[m]) m = i; return m; };
  // идём с конца назад: сначала вершина последнего всплеска (гласный слога), потом самое тихое место перед ним
  let p2 = end, i = end;
  for (; i > 0; i--) { if (env[i] > env[p2]) p2 = i; if (env[i] < env[p2] * 0.5 && p2 - i >= 3) break; }
  let valley = i;
  for (; i > 0; i--) { if (env[i] < env[valley]) valley = i; if (env[i] > env[valley] * 1.6 + max * 0.03 && valley - i >= 2) break; }
  const p1 = argmax(Math.max(0, valley - 30), valley); // гласный предыдущего слова
  const level = env[valley] + (env[p1] - env[valley]) * 0.2;
  let cut = valley; while (cut > p1 && env[cut - 1] < level) cut--;
  return { cut: (cut * WIN) / RATE, end: ((end + 1) * WIN) / RATE, env, marks: { p1, cut, valley, p2, end } };
}
const BARS = " ▁▂▃▄▅▆▇█";
for (const name of need.filter((n) => n.includes("-"))) {
  const file = join(out, name + ".mp3"), full = join(out, name + ".full.mp3");
  renameSync(file, full);
  const { cut, env, marks } = cutPoint(full);
  spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-y", "-ss", cut.toFixed(3), "-i", full, "-af", "afade=t=in:d=0.012", "-c:a", "libmp3lame", "-b:a", "192k", file]);
  const max = Math.max(...env); let line = "";
  for (let i = 0; i < env.length; i += 2) line += (i <= marks.cut && marks.cut < i + 2 ? "|" : "") + BARS[Math.min(8, Math.round((Math.max(env[i], env[i + 1] ?? 0) / max) * 8))];
  console.log(name.padEnd(8), line);
}
