import { writeFileSync, existsSync, mkdirSync } from "node:fs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const rec of [12, 7]) {
  mkdirSync(`seg${rec}`, { recursive: true });
  for (let s = 1; s <= 114; s++) {
    const out = `seg${rec}/${String(s).padStart(3, "0")}.json`;
    if (existsSync(out)) continue;
    const res = [];
    for (let page = 1; ; page++) {
      let j;
      for (let t = 0; t < 5; t++) { try { j = await (await fetch(`https://api.quran.com/api/v4/verses/by_chapter/${s}?audio=${rec}&per_page=50&page=${page}`)).json(); break; } catch { await sleep(1500); } }
      for (const v of j.verses) res.push([v.verse_number, v.audio?.url || null, (v.audio?.segments || []).map((x) => [x[1], x[2], x[3]])]);
      if (!j.pagination.next_page) break;
    }
    writeFileSync(out, JSON.stringify(res));
  }
  console.log("done", rec);
}
