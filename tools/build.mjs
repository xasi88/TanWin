// Готовит сайт к публикации: пересчитывает версию и список файлов для офлайн-кэша в sw.js.
// Запуск:  node tools/build.mjs
// В офлайн-кэш попадает всё приложение и тексты учебных сур (Аль-Фатиха и Джуз Амма);
// остальные суры кэшируются при первом открытии.
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SKIP = new Set(["og.png", "sw.js", "robots.txt", "sitemap.xml", "README.md", "CNAME", ".git", "node_modules", "tools", "docs", ".claude", "q"]);
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

// Предзагрузка: все модули, которые нужны для запуска (js/app.js и всё, что он импортирует), браузер качает сразу и параллельно,
// а не цепочкой «скачал файл — узнал, что нужен следующий». Список вписывается в index.html между <!--PRELOAD--> и <!--/PRELOAD-->.
const boot = [];
const deps = (function deps(f) {
  if (boot.includes(f)) return;
  boot.push(f);
  for (const m of readFileSync(join(root, f), "utf8").matchAll(/^(?:import|export)\s[^"'\n]*?["'](\.{1,2}\/[^"']+)["']/gm)) deps(join(f, "..", m[1]).split(sep).join("/"));
});
for (const f of ["js/app.js", "js/views/home.js"]) deps(f); // запуск и первый экран — «Путь»
const links = boot.slice(1).sort().map((f) => `<link rel="modulepreload" href="${f}">`);
const htmlPath = join(root, "index.html");
writeFileSync(htmlPath, readFileSync(htmlPath, "utf8").replace(/<!--PRELOAD-->[\s\S]*?<!--\/PRELOAD-->/, `<!--PRELOAD-->\n  ${links.join("\n  ")}\n  <!--/PRELOAD-->`));

// Описание сайта для поисковиков (заставка в index.html): этапы курса берём из js/course.js, чтобы текст не расходился с курсом.
const stages = [...readFileSync(join(root, "js/course.js"), "utf8").matchAll(/id: \d+, hue: "[^"]*", icon: "[^"]*", title: "([^"]*)", sub: "([^"]*)"/g)];
if (!stages.length) throw new Error("build: не нашёл этапы курса в js/course.js");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const stageList = ["<ol>", ...stages.map((m) => `  <li><b>${esc(m[1])}.</b> ${esc(m[2])}.</li>`), "</ol>"].map((l) => "          " + l).join("\n");
writeFileSync(htmlPath, readFileSync(htmlPath, "utf8").replace(/<!--STAGES-->[\s\S]*?<!--\/STAGES-->/, `<!--STAGES-->\n${stageList}\n          <!--/STAGES-->`));
// Карта сайта: дата последнего выпуска
writeFileSync(join(root, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://tanwin.xasi88.ru/</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></url>\n</urlset>\n`);

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
