// Готовит сайт к публикации: пересчитывает версию и список файлов для офлайн-кэша в sw.js.
// Запуск:  node tools/build.mjs
// В офлайн-кэш попадает всё приложение и тексты учебных сур (Аль-Фатиха и Джуз Амма);
// остальные суры кэшируются при первом открытии.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SKIP = new Set(["og.png", "sw.js", "README.md", "CNAME", ".git", "node_modules", "tools", "docs", ".claude", "q"]);
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name) || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p); else files.push(relative(root, p).split(sep).join("/"));
  }
})(root);
const CURR = [1, ...Array.from({ length: 37 }, (_, i) => 78 + i)];
for (const n of CURR) files.push(`data/q/${String(n).padStart(3, "0")}.json`);
files.sort();

const hash = createHash("sha1");
for (const f of files) { hash.update(f); hash.update(readFileSync(join(root, f))); }
const version = hash.digest("hex").slice(0, 10);

const list = ["./", ...files].map((f) => JSON.stringify(f)).join(",\n  ");
let sw = readFileSync(join(root, "sw.js"), "utf8");
sw = sw.replace(/const VERSION = ".*?";/, `const VERSION = "${version}";`);
sw = sw.replace(/\/\*FILES\*\/[\s\S]*?\/\*END\*\//, `/*FILES*/\nconst FILES = [\n  ${list},\n];\n/*END*/`);
writeFileSync(join(root, "sw.js"), sw);
const size = files.reduce((s, f) => s + statSync(join(root, f)).size, 0);
console.log(`sw.js: версия ${version}, файлов в офлайн-кэше: ${files.length + 1}, ≈ ${(size / 1048576).toFixed(1)} МБ`);
