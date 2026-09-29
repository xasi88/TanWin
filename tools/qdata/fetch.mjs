// Скачивает все 114 сур с Quran.com API v4: слова (uthmani, таджвид-разметка, аудио, транслитерация).
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
mkdirSync("raw", { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let s = 1; s <= 114; s++) {
  const out = `raw/${String(s).padStart(3, "0")}.json`;
  if (existsSync(out)) continue;
  const verses = [];
  for (let page = 1; ; page++) {
    const url = `https://api.quran.com/api/v4/verses/by_chapter/${s}?words=true&per_page=50&page=${page}&fields=text_uthmani,text_uthmani_tajweed&word_fields=text_uthmani,text_uthmani_tajweed&translations=45`;
    let j;
    for (let t = 0; t < 5; t++) { try { const r = await fetch(url); j = await r.json(); break; } catch (e) { await sleep(1500); } }
    verses.push(...j.verses);
    if (!j.pagination.next_page) break;
    await sleep(150);
  }
  writeFileSync(out, JSON.stringify(verses));
  console.log(s, verses.length);
}
