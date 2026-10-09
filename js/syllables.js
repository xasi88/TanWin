// Буква → её звуки → слоги → слова: экраны урока и «кирпичики» для них.
// Порядок как в классических букварях: сначала сама буква и её формы, потом буква с тремя огласовками,
// потом слоги складываются в слово. Звук — записи букв и слогов (audio/letters), слова — чтец Корана.
import { h, ar, tr, icon, rich, modal, gone, shuffle } from "./ui.js";
import { byId, byChar, forms, LETTERS } from "./letters.js";
import { M, syllRu, clusters } from "./arabic.js";
import { words } from "./data.js";
import { playLetter, playSyll, playSeq, syllItem, wordItem, letterAudioUrl, onPlay, playingId, stop } from "./audio.js";

export const VOWELS = {
  fatha: { mark: M.FATHA, ru: "а", name: "фатха", where: "чёрточка сверху" },
  kasra: { mark: M.KASRA, ru: "и", name: "касра", where: "чёрточка снизу" },
  damma: { mark: M.DAMMA, ru: "у", name: "дамма", where: "завиток сверху" },
};
export const V3 = ["fatha", "kasra", "damma"];
const HAMZA_SEAT = { fatha: "أَ", kasra: "إِ", damma: "أُ" };
const markToVowel = { [M.FATHA]: "fatha", [M.KASRA]: "kasra", [M.DAMMA]: "damma" };

/** Буквы, у которых есть слоги (у алифа своего согласного звука нет). */
export const SYLL_IDS = LETTERS.filter((l) => l.id !== "alif").map((l) => l.id);
export const syllText = (id, v) => (id === "hamza" ? HAMZA_SEAT[v] : byId[id].ch + VOWELS[v].mark);
export const syllTr = (id, v) => syllRu(byId[id].ch, v); // гласная зависит от буквы: после тяжёлых — «о» и «ы»

/** Форма буквы (ini | med | fin | iso) с огласовкой. */
export function formWith(id, form, v) {
  const l = byId[id];
  if (id === "hamza") return syllText(id, v);
  return forms(l)[form].replace(l.ch, l.ch + VOWELS[v].mark);
}

// ---------- Плитка со звуком ----------
/** Кнопка-плитка: арабский текст + чтение; по нажатию звучит. play() запускает звук, audioId — id записи (для подсветки). */
export function soundTile(text, trText, { play, audioId, cls = "", label = null, hint = null } = {}) {
  const b = h("button.snd-tile", { type: "button", class: cls, "aria-label": label || `Послушать: ${trText || text}` },
    ar(text), trText ? tr(trText) : null, hint ? h("small", null, hint) : null, h("span.snd-ico", null, icon("vol", { size: 14 })));
  b.addEventListener("click", () => play?.());
  if (audioId) { const sync = () => { if (gone(b, off)) return; b.classList.toggle("playing", playingId() === audioId); }; const off = onPlay(sync); }
  return b;
}
export const syllTile = (id, v, o = {}) => soundTile(o.text || syllText(id, v), syllTr(id, v), { play: () => playSyll(id, v), audioId: `s:${id}:${v}`, ...o });

function listenBtn(label, fn, audioId) {
  const b = h("button.btn.secondary.listen-btn", { type: "button" }, icon("vol", { size: 20 }), label);
  b.addEventListener("click", fn);
  if (audioId) { const sync = () => { if (gone(b, off)) return; b.classList.toggle("playing", playingId() === audioId); }; const off = onPlay(sync); }
  return b;
}

// ---------- Знакомство с буквой ----------
function drawGlyph(ch) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 200 200");
  svg.setAttribute("class", "glyph-draw");
  svg.innerHTML = `<text x="100" y="128" text-anchor="middle" class="gd-text">${ch}</text>`;
  return svg;
}
const FORM_NAMES = [["fin", "в конце"], ["med", "в середине"], ["ini", "в начале"], ["iso", "отдельно"]];

/** Знакомство с буквой: как выглядит отдельно и как называется. more(id) — полная карточка (махрадж, советы). */
export function letterIntro(id, { more } = {}) {
  const l = byId[id];
  const hasName = id !== "hamza";
  const glyph = h("button.li-glyph", { type: "button", "aria-label": `Послушать букву ${l.name}`, onclick: () => playLetter(id) }, drawGlyph(l.ch), h("span.snd-ico", null, icon("vol", { size: 18 })));
  const sync = () => { if (gone(glyph, off)) return; glyph.classList.toggle("playing", playingId() === "l:" + id); };
  const off = onPlay(sync);
  const note = id === "alif" ? "Своего согласного звука у алифа нет. Он тянет гласную «а» — «аа» — и служит подставкой для хамзы."
    : id === "hamza" ? "Хамза — короткая смычка голоса. Чаще всего она «сидит» на алифе: {أ} {إ}."
    : l.sound;
  return h("div.card.letter-intro", null,
    h("div.li-top", null, glyph,
      h("div.li-info", null,
        h("div.li-kicker", null, "Новая буква"),
        h("div.lc-name", null, l.name, h("span.lc-ar", null, ar(l.ar))),
        id === "alif" ? null : h("div.lc-sound", null, "Звук: ", tr(l.t)),
        h("div.chips", null, h("span.chip", null, l.dots), l.nc ? h("span.chip", null, "не соединяется дальше") : null))),
    listenBtn(hasName ? `Послушать: «${l.name}»` : "Послушать хамзу: «а»", () => playLetter(id), "l:" + id),
    h("p.lc-text", null, rich(note)),
    more ? h("button.link", { type: "button", onclick: () => more(id) }, icon("info", { size: 16 }), "Подробнее: откуда выходит звук, советы, слова из Корана") : null);
}

// ---------- Формы буквы в слове ----------
/** Та же буква в начале, середине и конце слова (второй проход по алфавиту). Плитки звучат названием буквы. */
export function letterForms(id) {
  const l = byId[id];
  const f = forms(l);
  const tile = (k, n) => soundTile(f[k], null, { play: () => playLetter(id), cls: "form-tile" + (k === "iso" ? " iso" : ""), hint: n, label: `${l.name} ${n}` });
  // буквы в одном слове: соединяющаяся — три подряд (начало, середина, конец); «гордая» — между двумя «ба», после неё разрыв
  const demo = l.nc ? "ب" + l.ch + "ب" : l.ch + l.ch + l.ch;
  return h("div.card.letter-forms", null,
    h("div.li-kicker", null, "Формы буквы"),
    h("h2", null, `${l.name} в слове`),
    h("p", null, rich(l.nc
      ? `${l.name} соединяется только с **предыдущей** буквой. Поэтому вида у неё два: как отдельная — в начале слова, и с «хвостиком» справа — в середине и в конце.`
      : `В слове ${l.name} соединяется с соседями с обеих сторон и меняет вид. Главная часть и точки остаются — по ним букву и узнаём.`)),
    h("div.snd-row.forms4", { dir: "rtl" }, ...[...FORM_NAMES].reverse().map(([k, n]) => tile(k, n))),
    h("div", null,
      h("div.label", null, l.nc ? "В слове: после неё — разрыв" : "Три подряд: начало, середина, конец"),
      h("div.forms-demo", null, ar(demo))));
}

// ---------- Буква с тремя огласовками ----------
/** Три плитки: буква + фатха / касра / дамма, со звуком и подписью, какой значок что значит. */
export function harakatTiles(id, { hints = true } = {}) {
  return h("div.snd-row", { dir: "rtl" }, ...V3.map((v) => syllTile(id, v, { cls: "big v-" + v, hint: hints ? `${VOWELS[v].name} — «${VOWELS[v].ru}»` : null })));
}
export function playAllVowels(id, row) {
  const tiles = row ? [...row.children] : [];
  return playSeq(V3.map((v) => syllItem(id, v)), { gap: 350, onStep: (i) => tiles.forEach((t, j) => t.classList.toggle("now", i === j)) });
}

export function letterSounds(id) {
  const l = byId[id];
  const row = harakatTiles(id);
  const inWord = id === "hamza" ? null : h("div", null,
    h("div.label", null, "Те же слоги внутри слова"),
    h("div.snd-row.small", { dir: "rtl" },
      ...[["ini", "fatha", "в начале"], ["med", "kasra", "в середине"], ["fin", "damma", "в конце"]].map(([form, v, where]) => syllTile(id, v, { text: formWith(id, form, v), hint: where }))));
  return h("div.card.letter-sounds", null,
    h("div.li-kicker", null, "Буква + огласовка = слог"),
    h("h2", null, id === "hamza" ? "Хамза с огласовками" : h("span", null, `${l.name} с огласовками`)),
    h("p", null, rich(id === "hamza"
      ? "Огласовка — маленький значок над или под буквой. Он даёт гласный звук. Подставка-алиф не читается — звучит только хамза."
      : `Сама буква — согласный «${l.t}». Маленький значок над или под ней добавляет гласный: получается слог. Нажимайте на плитки и повторяйте вслух.`)),
    row,
    listenBtn("Послушать все три", () => playAllVowels(id, row)),
    inWord);
}

// ---------- Сложение слогов ----------
/** Слово банка, целиком состоящее из открытых слогов «буква + короткая гласная» → [{ id, v }] или null. */
export function wordSyllables(d) {
  const out = [];
  for (const c of clusters(d)) {
    const l = byChar[c.b];
    const v = markToVowel[c.m];
    if (!l || !v || l.id === "alif" || "ىةٱ".includes(c.b)) return null;
    out.push({ id: l.id, v, text: c.b + c.m });
  }
  return out.length >= 2 ? out : null;
}

/**
 * Примеры «слог + слог = слово» для урока.
 * letters — буквы урока (хотя бы одна есть в каждом примере), known — все уже пройденные буквы; vowels — допустимые огласовки,
 * need — огласовка, которая обязательно есть в слове.
 * Сначала настоящие слова Корана (самые частые и короткие), а если букв ещё мало — цепочки слогов, как в классических букварях.
 */
export function blendsFor({ letters = null, known = null, vowels = V3, need = null, n = 3, minLen = 2, maxLen = 3 } = {}) {
  const want = letters ? new Set(letters) : null, ok = known ? new Set(known) : null;
  const level = vowels.includes("damma") ? "damma" : vowels.includes("kasra") ? "kasra" : "fatha";
  const pool = [];
  const seen = new Set();
  for (const w of words({ level, maxLen, minLen })) {
    const s = wordSyllables(w.d);
    if (!s || seen.has(w.tr)) continue;
    if (!s.every((x) => vowels.includes(x.v) && (!ok || ok.has(x.id)))) continue;
    if (want && !s.some((x) => want.has(x.id))) continue;
    if (need && !s.some((x) => x.v === need)) continue;
    seen.add(w.tr);
    pool.push({ sylls: s, text: w.d, tr: w.tr, word: w });
  }
  pool.sort((a, b) => b.word.n - a.word.n);
  const out = shuffle(pool.slice(0, Math.max(n * 5, 16))).slice(0, n).sort((a, b) => a.sylls.length - b.sylls.length);
  // букв ещё мало для настоящих слов: складываем слоги из букв урока (как в классических букварях)
  const ids = (letters || known || []).filter((id) => id !== "alif");
  const mk = (pairs) => { const sylls = pairs.map(([id, v]) => ({ id, v, text: syllText(id, v) })); return { sylls, text: sylls.map((x) => x.text).join(""), tr: sylls.map((x) => syllTr(x.id, x.v)).join(""), word: null }; };
  const v0 = vowels[0];
  const synth = [];
  for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++) if (i !== j) synth.push(mk([[ids[i], v0], [ids[j], vowels[(i + j) % vowels.length]]]));
  for (const x of shuffle(synth)) { if (out.length >= n) break; if (!out.some((y) => y.text === x.text)) out.push(x); }
  return out;
}
export const blendTr = (b) => b.sylls.map((x) => syllTr(x.id, x.v)).join("-");

/** Проиграть пример: слоги по одному, затем слитно (слово Корана — голосом чтеца). onStep(i): i — слог, sylls.length — всё слово. */
export function playBlend(b, { onStep, onEnd } = {}) {
  const parts = b.sylls.map((x) => syllItem(x.id, x.v));
  const whole = b.word ? [wordItem(b.word.a)] : [];
  const n = parts.length;
  if (whole.length) return playSeq([...parts, ...whole], { gap: 380, onStep, onEnd });
  // нет записи слова: второй раз — те же слоги подряд, без пауз
  return playSeq(parts, { gap: 380, onStep, onEnd: (done) => {
    if (!done) return onEnd?.(false);
    onStep?.(n);
    playSeq(parts, { gap: 0, onStep: (i) => { if (i < 0) onStep?.(-1); }, onEnd });
  } });
}

/** Строка «слог + слог = слово»: плитки справа налево, слитное слово слева; кнопка проигрывает по слогам и целиком. */
export function blendRow(b) {
  const tiles = b.sylls.map((x) => syllTile(x.id, x.v, { text: x.text }));
  const whole = soundTile(b.text, b.tr, { cls: "whole", play: () => run(), label: `Послушать: ${b.tr}` });
  const parts = h("div.bl-parts", { dir: "rtl" });
  tiles.forEach((t, i) => { if (i) parts.append(h("span.bl-op", null, "+")); parts.append(t); });
  const row = h("div.blend", null, parts, h("span.bl-op.eq", null, icon("down", { size: 20 })), whole);
  const mark = (i) => { tiles.forEach((t, j) => t.classList.toggle("now", i === j)); whole.classList.toggle("now", i === b.sylls.length); if (i === b.sylls.length) { whole.classList.remove("join"); void whole.offsetWidth; whole.classList.add("join"); } };
  const run = () => playBlend(b, { onStep: mark });
  row.play = run;
  return row;
}

/** Карточка «Складываем слоги»: несколько примеров + пояснение. */
export function blendCard(blends, { title = null, text = null } = {}) {
  const rows = blends.map(blendRow);
  const real = blends.some((b) => b.word);
  const card = h("div.card.blend-card", null,
    h("div.li-kicker", null, real ? "Слог + слог = слово" : "Слог + слог"),
    h("h2", null, title || (real ? "Слоги складываются в слово" : "Читаем слоги слитно")),
    h("p", null, rich(text || "Читаем справа налево: первый слог, второй — и сразу вместе, без паузы. Буквы при этом соединяются и меняют форму, а звуки остаются теми же.")),
    h("div.blend-list", null, ...rows),
    h("p.muted.small.center", null, real ? "Нажмите на слово — прозвучат слоги по одному, а потом слово целиком голосом чтеца Корана." : "Нажмите на плитку слева — прозвучат слоги по одному, а потом вместе."));
  card.autoplay = () => rows[0]?.play();
  return card;
}

// ---------- Упражнение «Соберите слово из слогов» ----------
/** Игровое поле: плитки-слоги внизу, собранное слово сверху (буквы соединяются по мере сборки). answer(ok) — по заполнении. */
export function blendBoard(b, extra, answer) {
  const tiles = shuffle([...b.sylls.map((x) => ({ ...x })), ...extra]);
  const picked = [];
  const out = h("div.bb-out", { dir: "rtl" });
  const tray = h("div.bb-tray", { dir: "rtl" });
  let locked = false;
  const draw = () => {
    out.replaceChildren(picked.length ? ar(picked.map((i) => tiles[i].text).join(""), { cls: "q-word" }) : h("span.bb-ph", null, "Нажимайте на слоги по порядку"));
    out.classList.toggle("filled", picked.length > 0);
    [...tray.children].forEach((el, i) => el.classList.toggle("used", picked.includes(i)));
    undo.disabled = !picked.length || locked;
  };
  const undo = h("button.btn.ghost.bb-undo", { type: "button", onclick: () => { if (locked) return; picked.pop(); draw(); } }, icon("left", { size: 16 }), "Убрать слог");
  tiles.forEach((t, i) => {
    const el = h("button.snd-tile.bb-tile", { type: "button", "aria-label": syllTr(t.id, t.v) }, ar(t.text));
    el.addEventListener("click", () => {
      if (locked || picked.includes(i)) return;
      picked.push(i); playSyll(t.id, t.v); draw();
      if (picked.length === b.sylls.length) {
        locked = true;
        const ok = picked.every((k, j) => tiles[k].text === b.sylls[j].text);
        out.classList.add(ok ? "ok" : "bad");
        setTimeout(() => answer(ok), 450);
      }
    });
    tray.append(el);
  });
  draw();
  return h("div.blend-board", null, out, tray, h("div.center", null, undo));
}

/** Полная карточка буквы в окне (из урока — по ссылке «Подробнее»). */
export function openLetter(card) { stop(); modal(card, { cls: "wide" }); }
export { letterAudioUrl };
