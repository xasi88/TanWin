// Значки приложения «Мой Коран» из icons/quran.svg: 192, 512 и maskable 512 (рисунок в безопасной зоне, фон до краёв).
// Запуск:  node tools/audit/quran-icons.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const svg = readFileSync(root + "icons/quran.svg", "utf8");
const inner = svg.replace(/^[\s\S]*?<\/defs>/, "").replace(/<\/svg>\s*$/, "").replace(/<rect[^>]*\/>/, "");
const defs = svg.match(/<defs>[\s\S]*?<\/defs>/)[0];
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="url(#bg)"/><g transform="translate(256 256) scale(.8) translate(-256 -256)">${inner}</g></svg>`;

const browser = await chromium.launch();
for (const [name, size, src] of [["quran-192.png", 192, svg], ["quran-512.png", 512, svg], ["quran-maskable-512.png", 512, maskable]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${src}`);
  await page.screenshot({ path: root + "icons/" + name, omitBackground: true });
  await page.close();
  console.log(name);
}
await browser.close();
