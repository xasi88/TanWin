// Проверка обращения на «ты»: ищет в текстах приложения слова на «вы», которых нет в словаре js/speech.js.
// Запуск:  node tools/speech-check.mjs   (пустой список — всё в порядке)
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const { KNOWN } = await import("../js/speech.js");
// Не обращения: существительные в предложном падеже и т. п.
const SKIP = new Set(["месте", "вместе", "защите", "алфавите", "шрифте", "интернете", "ракаате", "чистоте", "те", "планшете"]);
const files = [...readdirSync(join(root, "js")).filter((f) => f.endsWith(".js")).map((f) => "js/" + f), ...readdirSync(join(root, "js/views")).map((f) => "js/views/" + f)];
let found = 0;
for (const f of files) {
  if (f === "js/speech.js") continue;
  readFileSync(join(root, f), "utf8").split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    for (const m of line.replace(/\/\/ .*$/, "").matchAll(/[А-Яа-яЁё]+/g)) {
      const w = m[0].toLowerCase();
      if (!/^(вы|вас|вам|вами|ваш[а-яё]*)$|те$|тесь$/.test(w) || KNOWN.has(w) || SKIP.has(w)) continue;
      console.log(`${f}:${i + 1}: ${m[0]}`); found++;
    }
  });
}
console.log(found ? `Нет в словаре: ${found}` : "Все обращения на «вы» есть в словаре.");
