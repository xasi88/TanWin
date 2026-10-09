// Готовит озвучку букв и слогов (audio/letters/*.mp3) из исходных записей.
// Запуск:  node tools/audio/build.mjs <папка с исходными mp3>
// Нужен ffmpeg в PATH. Каждая запись обрезается по тишине, выравнивается по громкости и сжимается (моно, 64 кбит/с).
//
// Имена на выходе: <id>.mp3 — название буквы, <id>-a|i|u.mp3 — буква с фатхой, касрой, даммой (id — как в js/letters.js).
// Исходный набор — «Каида Нурания», его скачивает tools/audio/fetch-qaida.mjs уже под именами TanWin (см. audio/letters/SOURCE.md).
// Старый набор (github.com/bubblesinarabic/alphabets-audio) тоже подходит: его имена перечислены в NAMES.
// Чтобы заменить озвучку своей, достаточно положить в audio/letters файлы с теми же именами.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const src = process.argv[2];
if (!src || !existsSync(src)) { console.error("Укажите папку с исходными записями"); process.exit(1); }
const out = fileURLToPath(new URL("../../audio/letters/", import.meta.url));
mkdirSync(out, { recursive: true });

// id буквы → имя в исходном наборе (несколько вариантов — берётся первый существующий)
const NAMES = {
  alif: ["alif"], ba: ["baa"], ta: ["taa"], tha: ["thaa"], jim: ["jeem"], hha: ["haa"], kha: ["khaa", "kha"],
  dal: ["dal", "daal"], dhal: ["thaal"], ra: ["raa"], zay: ["zay"], sin: ["seen"], shin: ["sheen"], sad: ["saad"],
  dad: ["daad"], tta: ["taa_heavy"], zza: ["zaa_heavy"], ayn: ["ayn"], ghayn: ["ghayn"], fa: ["faa"], qaf: ["qaaf"],
  kaf: ["kaaf"], lam: ["laam"], mim: ["meem"], nun: ["noon"], ha: ["haa_light"], waw: ["waw"], ya: ["yaa"],
};
// исключения исходного набора (так файлы подключены на самом сайте-источнике)
const SPECIAL = { "tha-u": "thou-damma", "kha-u": "kha-damma" };
const VOW = { a: "fatha", i: "kasra", u: "damma" };

const jobs = [];
for (const [id, names] of Object.entries(NAMES)) {
  jobs.push([id, names.map((n) => n)]);
  if (id === "alif") continue; // у алифа нет своего согласного: «алиф с огласовкой» — это хамза
  for (const [k, v] of Object.entries(VOW)) jobs.push([`${id}-${k}`, [SPECIAL[`${id}-${k}`], ...names.map((n) => `${n}-${v}`)].filter(Boolean)]);
}
for (const [k, v] of Object.entries(VOW)) jobs.push([`hamza-${k}`, [`alif-${v}`]]);
jobs.push(["hamza", []]); // название хамзы есть только в «Каиде Нурании»
// короткие записи слогов (один слог без проговаривания по складам) — их готовит fetch-qaida.mjs
for (const [name] of [...jobs]) if (name.includes("-")) jobs.push([name + ".s", []]);

const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
const TRIM = "silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.08,areverse";
let n = 0, bytes = 0;
for (const [name, cands] of jobs) {
  const file = [name, ...cands].map((c) => join(src, c + ".mp3")).find(existsSync); // сначала — запись, уже названная по-нашему
  if (!file) { if (!name.endsWith(".s")) console.warn("нет записи:", name, cands.join(" | ")); continue; }
  // громкость после обрезки → усиление до среднего −19 дБ, но пик не выше −1 дБ
  const log = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-i", file, "-af", `${TRIM},volumedetect`, "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const num = (re) => parseFloat((re.exec(log) || [])[1] ?? "NaN");
  const mean = num(/mean_volume: (-?[\d.]+) dB/), peak = num(/max_volume: (-?[\d.]+) dB/);
  if (Number.isNaN(mean)) { console.warn("не удалось измерить:", name); continue; }
  const gain = Math.min(-19 - mean, -1 - peak).toFixed(1);
  const dst = join(out, name + ".mp3");
  ff(["-y", "-i", file, "-af", `${TRIM},volume=${gain}dB,afade=t=in:d=0.01`, "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "64k", "-map_metadata", "-1", dst]);
  n++; bytes += statSync(dst).size;
}
console.log(`audio/letters: ${n} файлов, ${(bytes / 1024).toFixed(0)} КБ`);
