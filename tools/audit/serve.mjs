// Маленький сервер для проверок: отдаёт корень проекта на свободном порту. Проверке не нужен запущенный сервер на 8765,
// и она не спотыкается о его отказы при сотне одновременных запросов.
//   const { base, stop } = await serve();  …  stop();
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, extname } from "node:path";

const root = fileURLToPath(new URL("../..", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };

export async function serve() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    let path = decodeURIComponent(url.pathname).split("/").filter((x) => x && x !== "..").join("/");
    if (!path || url.pathname.endsWith("/")) path += (path ? "/" : "") + "index.html"; // «/» и «/quran/»
    try { const body = await readFile(join(root, path)); res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" }); res.end(body); }
    catch { res.writeHead(404); res.end(); }
  }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  return { base: `http://127.0.0.1:${server.address().port}`, stop: () => server.close() };
}
