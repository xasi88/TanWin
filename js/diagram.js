// Схема речевого аппарата в разрезе (лицо смотрит влево) с 17 точками махраджей.
// Подписи — «таблички» на выносных линиях, чтобы близкие точки у зубов не слипались.
import { POINTS, ZONES } from "./letters.js";

// Точка на схеме и место её таблички
export const XY = {
  lips: [47, 230], fa: [81, 232], tha: [99, 226], sin: [106, 242], ta: [101, 212], nun: [113, 207], ra: [126, 203], lam: [142, 200],
  dad: [170, 212], mid: [200, 197], kaf: [247, 203], qaf: [272, 214],
  halq3: [323, 262], halq2: [331, 318], halq1: [326, 396], jawf: [214, 238], nose: [196, 160],
};
const TAG = {
  lam: [-78, 112], ra: [-78, 142], nun: [-78, 172], ta: [-78, 202], tha: [-78, 232], sin: [-78, 262], fa: [-78, 292], lips: [-78, 322],
  nose: [120, 74], mid: [200, 74], kaf: [272, 74], qaf: [344, 74],
  dad: [118, 330], jawf: [214, 330],
  halq3: [418, 262], halq2: [418, 318], halq1: [418, 396],
};
const ZONE_OF = Object.fromEntries(Object.entries(POINTS).map(([k, v]) => [k, v.zone]));
const TIP = ["ta", "sin", "tha"];

/**
 * opts: highlight — id точки, id зоны, "tip" или "all"; interactive — точки кликабельны (onPick(pointId, el));
 * labels — показывать таблички у подсвеченных точек (в интерактивном режиме без подсветки таблички скрыты, чтобы не подсказывать).
 */
export function diagram({ highlight = null, interactive = false, onPick = null, labels = true, small = false, only = null } = {}) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  // без табличек поле слева не нужно — схема крупнее
  svg.setAttribute("viewBox", highlight && labels ? "-122 40 590 410" : "20 60 450 390");
  svg.setAttribute("class", "diagram" + (small ? " small" : "") + (interactive ? " interactive" : ""));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Схема речевого аппарата в разрезе: губы, зубы, язык, нёбо, горло, нос");
  svg.innerHTML = `
  <defs>
    <linearGradient id="dg-skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--dg-skin1)"/><stop offset="1" stop-color="var(--dg-skin2)"/></linearGradient>
    <linearGradient id="dg-tongue" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--dg-tongue1)"/><stop offset="1" stop-color="var(--dg-tongue2)"/></linearGradient>
    <radialGradient id="dg-glow"><stop offset="0" stop-color="var(--accent)" stop-opacity=".85"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></radialGradient>
  </defs>
  <path class="dg-head" d="M160 40 C128 58 110 80 104 106 C98 128 72 138 44 154 C34 161 40 170 60 172 C56 182 50 190 45 199 C39 208 39 216 45 222 L47 228 C40 234 40 244 47 251 C52 264 58 274 66 284 C70 302 78 318 94 332 C122 348 162 350 196 352 C204 382 206 414 206 450 L468 450 L468 40 Z" fill="url(#dg-skin)"/>
  <path class="dg-cavity dg-nose-cav" d="M64 168 C100 152 170 142 240 148 C290 152 322 162 340 180 C344 188 338 196 330 194 C300 180 250 172 190 172 C140 172 100 176 64 178 Z"/>
  <path class="dg-cavity" d="M100 214 C140 198 200 190 250 198 C290 206 320 222 334 242 L348 302 L352 450 L318 450 L314 382 C310 342 300 302 290 282 C270 264 240 258 200 258 C160 258 128 256 104 250 Z"/>
  <path class="dg-palate" d="M92 206 C130 192 190 182 240 186 L244 198 C190 194 130 202 98 216 Z"/>
  <path class="dg-velum" d="M240 186 C270 188 300 202 318 224 C322 234 318 246 312 248 C306 238 300 228 290 218 C276 206 260 200 244 198 Z"/>
  <path class="dg-teeth" d="M79 205 L98 203 L100 229 C94 233 86 233 81 229 Z"/>
  <path class="dg-teeth" d="M83 241 L101 239 L105 263 L87 265 Z"/>
  <path class="dg-lip" d="M44 199 C56 193 72 195 80 201 L82 225 C70 229 56 229 46 223 C40 215 40 207 44 199 Z"/>
  <path class="dg-lip" d="M46 234 C58 230 72 232 85 236 L87 264 C72 270 58 268 50 258 C42 250 42 242 46 234 Z"/>
  <path class="dg-tongue" d="M104 238 C112 224 130 214 156 208 C196 200 240 204 272 220 C294 232 304 258 306 292 C308 322 304 348 298 362 L270 362 C262 332 246 302 220 288 C190 274 150 268 120 264 C104 260 98 250 104 238 Z" fill="url(#dg-tongue)"/>
  <path class="dg-velum" d="M300 332 C312 320 322 318 324 326 L312 352 Z"/>
  <path class="dg-larynx" d="M300 374 L348 374 L350 446 L300 446 Z"/>
  <path class="dg-cords" d="M304 400 L346 400"/>
  <text class="dg-cap" x="358" y="440">гортань</text>
  <text class="dg-cap" x="60" y="140">нос</text>
  <text class="dg-cap" x="150" y="245">язык</text>
  `;
  const lines = document.createElementNS(NS, "g");
  const dots = document.createElementNS(NS, "g");
  const tags = document.createElementNS(NS, "g");
  svg.append(lines, dots, tags);
  const hl = highlight;
  const isOn = (id) => hl && (hl === "all" || hl === id || hl === ZONE_OF[id] || (hl === "tip" && TIP.includes(id)));
  for (const [id, [x, y]] of Object.entries(XY)) {
    if (only && !only.includes(id)) continue;
    const zone = ZONE_OF[id];
    const on = isOn(id);
    const pg = document.createElementNS(NS, "g");
    pg.setAttribute("class", `dg-pt z-${zone}` + (on ? " on" : "") + (hl && !on ? " dim" : ""));
    pg.dataset.point = id;
    pg.innerHTML = `${on && hl !== "all" ? `<circle cx="${x}" cy="${y}" r="24" fill="url(#dg-glow)" class="dg-halo"/>` : ""}
      ${interactive ? `<circle cx="${x}" cy="${y}" r="15" class="dg-hit"/>` : ""}
      <circle cx="${x}" cy="${y}" r="${interactive ? 8 : 6.5}" class="dg-dot"/>`;
    if (interactive) {
      pg.setAttribute("tabindex", "0");
      pg.setAttribute("role", "button");
      pg.setAttribute("aria-label", POINTS[id].label);
      const pick = () => onPick?.(id, pg);
      pg.addEventListener("click", pick);
      pg.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick()));
    }
    dots.append(pg);
    if (labels && on) {
      const [tx, ty] = TAG[id];
      const text = POINTS[id].letters.replace(/\s*\(.*\)/, "").replace("гунна ", "");
      const w = Math.max(46, text.replace(/\s/g, "").length * 21 + 26);
      const ln = document.createElementNS(NS, "path");
      ln.setAttribute("class", `dg-line z-${zone}`);
      ln.setAttribute("d", `M${tx} ${ty} L${x} ${y}`);
      lines.append(ln);
      const tg = document.createElementNS(NS, "g");
      tg.setAttribute("class", `dg-tag z-${zone}`);
      tg.innerHTML = `<rect x="${tx - w / 2}" y="${ty - 16}" width="${w}" height="32" rx="12"/><text x="${tx}" y="${ty + 9}" text-anchor="middle">${text}</text>`;
      tags.append(tg);
    }
  }
  return svg;
}
/** Варианты для вопроса «нажмите на место выхода»: верная точка + n отвлекающих, не ближе minDist друг к другу. */
export function spreadChoices(target, n = 3, minDist = 34) {
  const ids = Object.keys(XY).filter((k) => k !== target && k !== "jawf");
  const out = [target];
  for (const id of ids.sort(() => Math.random() - 0.5)) {
    if (out.length > n) break;
    if (out.every((o) => Math.hypot(XY[o][0] - XY[id][0], XY[o][1] - XY[id][1]) >= minDist)) out.push(id);
  }
  return out;
}
export { ZONES, POINTS };
