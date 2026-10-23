// Плеер урока: карточки теории, упражнения, повтор ошибок, итог.
import { h, ar, rich, tr, icon, wordChip, cardTr, playBtn, toast, confetti, ring, shuffle, sample, plural, modal, mixed, sizeButton, skipBtn } from "./ui.js";
import { build, quiz, ruleIndex, stepForKey } from "./exercises.js";
import { g, you } from "./speech.js";
import { byId, forms, POINTS, ZONES, LETTERS } from "./letters.js";
import { letterExamples, lessonWords, words, minimalPairs, loadSurah, wordKey, rareExamples, bank, alifMaddExamples, husarySpan } from "./data.js";
import { RULES, plain, rulesIn, onlyRule, causeMarkup, CAUSE_CODES, CAUSE_NOTE, SPAN_CODES } from "./rules.js";
import { M, syllRu, stripStops } from "./arabic.js";
import { diagram } from "./diagram.js";
import { playWord, playAyah, playSpan, stop, sfx, canRecord, startRecording, stopRecording, envelope, playUrl, playLetter, playSyll } from "./audio.js";
import { letterIntro, letterForms, harakatTiles, syllTile, blendCard, blendsFor, playAllVowels, spellNote, V3, SYLL_IDS, quranWordCard } from "./syllables.js";
import { knownLetters, UNITS, ALL_LESSONS } from "./course.js";
import { isInstalled } from "./install.js";
import { store, addXp, srsSeen, finishLesson, dayGoal, todayDone, hardSeen, lessonDone } from "./store.js";
import { track } from "./usage.js";
import { lessonVoice, weakSpots, guideFor, guideKind } from "./tutor.js";
import { applySkip } from "./path.js";

const FORM_NAMES = [["fin", "в конце"], ["med", "в середине"], ["ini", "в начале"], ["iso", "отдельно"]];

// ---------- Карточки ----------
function lettersRow(ids) {
  return h("div.forms-row", null, ...ids.map((id) => h("div.form-cell", null, ar(byId[id].ch), h("small", null, byId[id].name))));
}
export function formsRow(id) {
  const l = byId[id];
  const f = forms(l);
  return h("div.forms-row", null, ...FORM_NAMES.map(([k, n]) => h("div.form-cell", null, ar(f[k]), h("small", null, n))));
}
function drawGlyph(ch) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 200 200");
  svg.setAttribute("class", "glyph-draw");
  svg.innerHTML = `<text x="100" y="128" text-anchor="middle" class="gd-text">${ch}</text>`;
  return svg;
}
function wordsRow(ws, { showTr = cardTr() } = {}) {
  return h("div.words-row", null, ...ws.map((w) => wordChip(w, { showTr })));
}

export function letterCard(id, { mini = false } = {}) {
  const l = byId[id];
  const ex = letterExamples(id, 3);
  return h("div.card.letter-card", { class: mini ? "mini" : "" },
    h("div.lc-top", null,
      h("div.lc-glyph", null, drawGlyph(l.ch)),
      h("div.lc-info", null,
        h("div.lc-name", null, l.name, h("span.lc-ar", null, ar(l.ar))),
        h("div.lc-sound", null, "Звук: ", tr(l.t)),
        h("div.chips", null,
          l.heavy ? h("span.chip.heavy", null, "тяжёлая") : null,
          l.q ? h("span.chip.q", null, "калькаля") : null,
          l.nc ? h("span.chip", null, "не соединяется дальше") : null,
          h("span.chip", null, l.dots)))),
    h("p.lc-text", null, rich(l.sound)),
    h("div.lc-listen", null,
      id === "hamza" ? null : h("button.btn.secondary.listen-btn", { type: "button", onclick: () => playLetter(id) }, icon("vol", { size: 20 }), `Послушать: «${l.name}»`),
      harakatTiles(id === "alif" ? "hamza" : id)),
    l.tip ? h("p.lc-tip", null, icon("sparkle", { size: 16 }), h("span", null, rich(l.tip))) : null,
    mini ? null : formsRow(id),
    h("div.lc-bottom", null,
      h("div.lc-diagram", null, diagram({ highlight: l.point, small: true }), h("small.muted", null, POINTS[l.point].label)),
      ex.length ? h("div.lc-ex", null, h("div.label", null, "Слова Корана с этой буквы"), wordsRow(ex),
        id === "alif" ? [h("div.label", null, "После фатхи алиф тянет «аа»"), wordsRow(alifMaddExamples(2))] : null) : null));
}

function zoneCard(id) {
  const z = ZONES[id];
  return h("div.card.zone-card", null,
    h("div.zc-head", { style: { "--zc": z.color } }, h("span.zc-dot"), h("div", null, h("h2", null, z.ru), h("div.muted", null, z.name))),
    diagram({ highlight: id }),
    h("p", null, rich(z.text)));
}

async function ruleExamples(code, n = 4, keep = null) {
  const idx = await ruleIndex();
  let cand = idx.filter((x) => x.codes.includes(code) && (!keep || keep(x)));
  if (cand.length < n * 2) cand = [...cand, ...rareExamples(code).filter((x) => !keep || keep(x))]; // редкие правила: со всего Корана
  const seen = new Set();
  return shuffle(cand).filter((x) => { const p = plain(x.w); if (seen.has(p)) return false; seen.add(p); return true; }).slice(0, n);
}
// Мадд и правила на стыке слов (2.0): пример звучит куском аята голосом Хусари, вместе со следующим словом, если
// причина в нём. Берутся только примеры с надёжным временем слов (js/data.js → husarySpan).
const maddSpan = (x, code, c) => husarySpan(x.seg, x.wi, x.wi + (c?.next ? 1 : 0), code === "x");
function ruleCard(code) {
  const r = RULES[code];
  const exBox = h("div.words-row", null, h("div.skeleton"));
  const madd = SPAN_CODES.has(code);
  const keep = CAUSE_CODES.has(code) || madd ? (x) => { const c = causeOf(x, code); return (!CAUSE_CODES.has(code) || !!c) && (!madd || !!maddSpan(x, code, c)); } : null;
  ruleExamples(code, 4, keep).then((xs) => exBox.replaceChildren(...xs.map((x) => {
    const key = wordKey(x.s, x.a, x.wi + 1);
    const c = causeOf(x, code);
    const text = c ? c.d + (c.next ? " " + c.next : "") : onlyRule(x.w, code);
    const b = h("button.word-chip.rule-ex", { type: "button" }, ar(stripStops(text)), h("span.ref", null, `${x.s}:${x.a}`));
    b.addEventListener("click", () => madd ? playSpan(x.s, x.a, x.wi, x.wi + (c?.next ? 1 : 0), { seg: x.seg, long: code === "x" })
      : playWord(key, c?.next ? { onEnd: () => playWord(wordKey(x.s, x.a, x.wi + 2)) } : {}));
    return b;
  })));
  return h("div.card.rule-card", { style: { "--rc": `var(--r-${code})` } },
    h("div.rc-head", null, h("span.rc-swatch"), h("div", null, h("h2", null, r.name), h("div.muted", null, rich(r.short)))),
    h("p", null, rich(r.text)),
    h("div.label", null, "Примеры из Корана: нажмите, чтобы послушать"),
    exBox,
    CAUSE_CODES.has(code) ? h("p.cause-note", null, CAUSE_NOTE[code]) : null);
}
// Буква-причина (2.0): хамза мадда, буква с шаддой после обязательного мадда, последняя буква при остановке;
// у разделённого мадда рядом следующее слово (js/rules.js).
const causeOf = (x, code) => causeMarkup(x.w, x.words?.[x.wi + 1], code);

// Пример в карточках 2.0: слово (или два слова, если хамза в следующем) звучит по нажатию.
// Слова из одного аята подряд звучат куском аята голосом Хусари: так слышно правило на стыке слов и длину мадда.
// solo: записью отдельного слова, как в начале чтения (хамзат-уль-васль звучит только так).
function exChip(x) {
  const ws = Array.isArray(x) ? x : [x];
  const b = h("button.word-chip.case-ex", { type: "button", "aria-label": "Послушать" },
    ar(ws.map((w) => w.d).join(" ")), h("span.wc-ico", null, icon("vol", { size: 16 })));
  const k = ws.map((w) => w.a.split("_").map(Number));
  const one = !ws.some((w) => w.solo) && k.every(([s, a, w], i) => s === k[0][0] && a === k[0][1] && w === k[0][2] + i);
  const play = (i) => playWord(ws[i].a, i + 1 < ws.length ? { onEnd: () => play(i + 1) } : {});
  b.addEventListener("click", () => (one ? playSpan(k[0][0], k[0][1], k[0][2] - 1, k[0][2] - 2 + ws.length, { long: !!x.long }) : play(0)));
  return b;
}

const MUQ = [["ا[xلٓمٓ]", "002_001_001", "алиф-ляям-миим"], ["ا[xلٓ]ر", "010_001_001", "алиф-ляям-роо"], ["[xكٓ]هي[xعٓصٓ]", "019_001_001", "кааф-хӀаа-йаа-Ӏайн-соод"], ["طه", "020_001_001", "тӀоо-хӀаа"], ["ط[xسٓمٓ]", "026_001_001", "тӀоо-сиин-миим"], ["ي[xسٓ]", "036_001_001", "йаа-сиин"], ["[xصٓ]", "038_001_001", "соод"], ["ح[xمٓ]", "040_001_001", "хьаа-миим"], ["[xعٓسٓقٓ]", "042_002_001", "Ӏайн-сиин-къооф"], ["[xقٓ]", "050_001_001", "къооф"], ["[xنٓ]", "068_001_001", "нуун"]];
const STOP_SIGNS = [["ۘ", "мим", "обязательная остановка"], ["ۙ", "ля", "не останавливаться"], ["ۚ", "джим", "равнозначно"], ["ۖ", "сыля", "лучше продолжить"], ["ۗ", "кыля", "лучше остановиться"], ["ۛ", "муӀанака", "на одном из двух мест"]];

function syllRow(v) {
  return h("div", null, spellNote(), h("div.syll-grid", null, ...SYLL_IDS.map((id) => syllTile(id, v, { cls: "syll" }))));
}
function syllTable() {
  const ids = LETTERS.filter((l) => !["alif", "hamza"].includes(l.id)).map((l) => l.id);
  const t = h("div.syll-table");
  for (const id of ids) {
    const row = h("div.st-row", null, h("span.st-name", null, byId[id].name));
    for (const [m, vk] of [[M.FATHA, "fatha"], [M.KASRA, "kasra"], [M.DAMMA, "damma"]]) {
      const c = h("button.st-cell", { type: "button" }, ar(byId[id].ch + m), tr(syllRu(byId[id].ch, vk), { hidden: true }));
      c.addEventListener("click", () => { c.querySelector(".tr").classList.remove("hid"); playSyll(id, vk); });
      row.append(c);
    }
    t.append(row);
  }
  return h("div", null, h("p.muted.center", null, "Прочитайте слог вслух. Потом нажмите на него: увидите чтение и услышите запись."), spellNote(), t);
}

async function verseBlock(key, { tapWords = false } = {}) {
  const [s, a] = key.split(":").map(Number);
  const d = await loadSurah(s);
  const v = d.v[a - 1];
  const colors = store.get().settings.tajweed;
  const box = h("div.verse-block", { dir: "rtl" });
  v[0].forEach((w, i) => {
    const b = h("button.vb-word", { type: "button" }, ar(w, { colors }));
    b.addEventListener("click", () => { playWord(wordKey(s, a, i + 1)); b.classList.add("seen"); });
    box.append(b);
  });
  return h("div.verse-wrap", null, box,
    h("div.verse-foot", null, playBtn(`a:${s}:${a}`, () => playAyah(s, a, { onTime: (ms) => highlightWord(box, v, ms) , onEnd: () => highlightWord(box, v, -1) }), { label: "Послушать аят" }),
      h("span.muted", null, tapWords ? "Нажимайте на слова справа налево" : `Сура ${s}, аят ${a}`)));
}
function highlightWord(box, v, ms) {
  const segIdx = store.get().settings.reciter === "afasy" ? 3 : 2;
  const seg = v[segIdx] || [];
  [...box.children].forEach((el, i) => el.classList.toggle("now", ms >= 0 && seg[i * 2] >= 0 && ms >= seg[i * 2] && ms < seg[i * 2 + 1] + 60));
}

function wordsForCard(o) {
  let pool;
  if (o.lunar || o.solar) {
    pool = words({ level: "full", maxLen: 6, filter: (w) => /^ٱل/.test(w.d) && (o.lunar ? /^ٱلۡ/.test(w.d) : /^ٱل[^ْۡ]ّ?/.test(w.d) && w.d.slice(2, 5).includes("ّ")) });
  } else if (o.heavyStart) {
    pool = words({ level: o.level, maxLen: 5, filter: (w) => ["kha", "sad", "dad", "ghayn", "tta", "qaf", "zza"].includes(w.firstL) });
  } else {
    pool = lessonWords({ level: o.level, need: o.need || "", avoid: o.avoid || "", startsWith: o.startsWith || null, maxLen: o.maxLen || 5, filter: o.vowelA ? (w) => /َىٰ?$/.test(w.d) : o.zero ? (w) => w.d.includes("۟") : null }, o.n);
  }
  return sample(pool.slice(0, 40), o.n);
}

async function renderCard(step) {
  const el = h("div.card.theory");
  if (step.icon) el.append(h("div.card-icon", null, step.icon));
  if (step.kicker) el.append(h("div.kicker", null, step.kicker));
  el.append(h("h2", null, mixed(step.title)));
  // абзац из одного арабского текста в фигурных скобках (строка «Джазарийи» и т. п.) стоит отдельно, справа налево
  for (const p of step.body || []) el.append(/^\{[^}]+\}$/.test(p) ? h("p.ar-line", { dir: "rtl" }, rich(p)) : h("p", null, rich(p)));
  const extras = h("div.card-extras");
  if (step.big) extras.append(ar(step.big, { cls: "card-big" }));
  if (step.caption) extras.append(h("p.caption", null, step.caption));
  if (step.forms) extras.append(formsRow(step.forms));
  if (step.forms2) extras.append(formsRow(step.forms2));
  if (step.sounds) { const row = harakatTiles(step.sounds); extras.append(row, spellNote()); el.autoplay = () => playAllVowels(step.sounds, row); }
  if (step.sounds1) extras.append(h("div.snd-row", { dir: "rtl" }, ...step.sounds1.map((id) => syllTile(id, step.vowel, { cls: "big v-" + step.vowel, spell: true }))), spellNote());
  if (step.syll) extras.append(syllRow(step.syll));
  if (step.syllTable) extras.append(syllTable());
  if (step.diagram) extras.append(diagram({ highlight: step.diagram }));
  if (step.wordsLevel) extras.append(wordsRow(wordsForCard(step.wordsLevel)));
  if (step.words) extras.append(wordsRow(step.words.map((d) => bank().byText.get(d)).filter(Boolean), { showTr: true }));
  if (step.contrast) {
    const [a, b] = step.contrast;
    const ps = minimalPairs().filter((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
    const pairs = sample(ps, 2);
    if (pairs.length) extras.append(...pairs.map((p) => h("div.pair-row", null, wordChip(p.w1), h("span.vs", null, "или"), wordChip(p.w2))));
    else extras.append(lettersRow([a, b]));
  }
  if (step.muqattaat) extras.append(h("div.words-row", null, ...MUQ.map(([t, a, trn]) => wordChip({ d: t, a, tr: trn }))));
  if (step.stopSigns) extras.append(h("div.stop-grid", null, ...STOP_SIGNS.map(([s, n, m]) => h("div.stop-cell", null, ar("ـ" + s + "ـ", { cls: "stop-sign" }), h("b", null, n), h("small", null, m)))));
  if (step.ruleWheel) extras.append(h("div.rule-wheel", null,
    ...[["Изхар", "ء ه ع ح غ خ", "ясно", "izhar"], ["Идгам", "ي ر م ل و ن", "слияние", "d"], ["Икляб", "ب", "н → м", "i"], ["Ихфа", "15 букв", "скрыто", "f"]]
      .map(([n, l, s, c]) => h("div.rw-cell", { style: { "--rc": c === "izhar" ? "var(--ink-2)" : `var(--r-${c})` } }, h("b", null, n), ar(l), h("small", null, s)))));
  if (step.verse) extras.append(await verseBlock(step.verse, { tapWords: step.tapWords }));
  // 2.0: примеры в ряд, сравнение (плитки с длиной) и случаи (название, пояснение, примеры)
  if (step.examples) extras.append(h("div.words-row", null, ...step.examples.map(exChip)));
  if (step.compare) extras.append(h("div.cmp", { style: { "--n": step.cols || step.compare.length } }, ...step.compare.map((c) =>
    h("div.cmp-tile", { style: { "--rc": c.code ? `var(--r-${c.code})` : "var(--ink-2)" } }, // без кода: изхар, цветом не отмечается
      h("div.cmp-num", null, c.num), h("div.cmp-unit", null, c.unit), h("div.cmp-when", null, rich(c.when)), c.ex ? exChip(c.ex) : null))));
  if (step.cases) extras.append(h("div.cases", null, ...step.cases.map((c) =>
    h("div.case", { style: { "--rc": c.code ? `var(--r-${c.code})` : "var(--ink-2)" } },
      h("div.case-txt", null, h("b", null, mixed(c.name)), h("small", null, rich(c.note))), c.ex?.length ? h("div.case-ex", null, ...c.ex.map(exChip)) : null))));
  if (extras.childNodes.length) el.append(extras);
  if (step.note) el.append(h("p.card-note", null, rich(step.note)));
  return el;
}

// Слово из конца аята: почему чтец читает его не так, как подписано (w.stop: из data.js, с версии 1.27.0).
function stopNote(w) {
  const rule = /хӀ$/.test(w.stop) ? "Буква ة на остановке звучит «хӀ»."
    : /н$/.test(w.tr) && /(аа|оо)$/.test(w.stop) ? "Фатхатан на остановке звучит долгим «аа»."
    : /н$/.test(w.tr) ? "Танвин на остановке не звучит."
    : "Последняя огласовка на остановке не звучит.";
  return mixed(`Это слово стоит в конце аята, и чтец на нём останавливается. ${rule}`); // mixed: буква ة арабским шрифтом
}

// ---------- Чтение и запись голоса ----------
function readStep(step, api) {
  const pool = lessonWords({ level: step.level, need: step.need || "", avoid: step.avoid || "", maxLen: step.maxLen || 6 }, step.n);
  const ws = sample(pool.slice(0, 300), step.n);
  let i = 0, good = 0;
  const box = h("div.read-drill");
  const show = () => {
    const w = ws[i];
    const trEl = tr(w.tr, { hidden: true });
    const reveal = h("button.btn.secondary.wide", { type: "button" }, icon("eye", { size: 18 }), "Проверить себя");
    const judge = h("div.row.gap.hidden", null,
      h("button.btn.bad", { type: "button", onclick: () => next(false) }, icon("x", { size: 18 }), g("Ошибся", "Ошиблась")),
      h("button.btn.good", { type: "button", onclick: () => next(true) }, icon("check", { size: 18 }), g("Прочитал верно", "Прочитала верно")));
    const stopEl = w.stop ? h("p.rd-stop.hidden", null, "На остановке: ", tr(w.stop), ". ", stopNote(w)) : null;
    reveal.addEventListener("click", () => { trEl.classList.remove("hid"); stopEl?.classList.remove("hidden"); playWord(w.a); reveal.classList.add("hidden"); judge.classList.remove("hidden"); });
    box.replaceChildren(
      h("div.rd-count", null, `${i + 1} / ${ws.length}`),
      h("p.muted.center", null, "Прочитайте слово вслух. Затем проверьте себя по чтецу."),
      h("button.rd-word", { type: "button", onclick: () => playWord(w.a), "aria-label": "Послушать" }, ar(w.d, { cls: "q-word" })),
      h("div.rd-tr", null, trEl), stopEl || "", reveal, judge); // replaceChildren пишет null как текст «null»
  };
  const next = (ok) => { if (ok) good++; srsSeen("W:" + step.level, ok); hardSeen(ws[i].a, ok); api.addXp(ok ? 4 : 1); i++; i < ws.length ? show() : api.done({ good, total: ws.length }); };
  show();
  return box;
}

function speakStep(step, api) {
  const w = sample(lessonWords({ level: step.level, maxLen: 5 }, 4).slice(0, 60), 1)[0];
  const box = h("div.speak");
  const wave = (env, cls) => h("div.wave", { class: cls }, ...(env || []).map((v) => h("i", { style: { height: Math.max(4, v * 100) + "%" } })));
  const ref = h("div.wave-slot");
  const mine = h("div.wave-slot");
  let myUrl = null;
  envelope(`https://audio.qurancdn.com/wbw/${w.a}.mp3`, 48).then((e) => ref.replaceChildren(h("div.wave-label", null, "Чтец"), wave(e, "ref"))).catch(() => {});
  const mic = h("button.mic-btn", { type: "button", "aria-label": "Записать себя" }, icon("mic", { size: 30 }));
  const status = h("div.muted.center", null, canRecord() ? "Нажмите на микрофон и прочитайте слово" : "Запись голоса недоступна в этом браузере");
  const playMine = h("button.btn.secondary.hidden", { type: "button", onclick: () => myUrl && playUrl(myUrl, { id: "mine" }) }, icon("play", { size: 18 }), "Мой голос");
  let recording = false;
  mic.addEventListener("click", async () => {
    if (!canRecord()) { track("speech_used", { Микрофон: "не поддерживается" }); return; }
    if (!recording) {
      try { stop(); await startRecording(); recording = true; mic.classList.add("rec"); status.textContent = you("Идёт запись… нажмите ещё раз, чтобы остановить"); }
      catch { status.textContent = you("Нет доступа к микрофону. Разрешите его в настройках браузера."); }
    } else {
      const r = await stopRecording(); recording = false; mic.classList.remove("rec");
      if (!r) return;
      myUrl = r.url;
      status.textContent = you("Сравните свою запись с чтецом: длина гласных, удвоения, паузы.");
      playMine.classList.remove("hidden");
      judge.classList.remove("hidden");
      envelope(r.blob, 48).then((e) => mine.replaceChildren(h("div.wave-label", null, "Вы"), wave(e, "mine"))).catch(() => {});
    }
  });
  const judge = h("div.row.gap.hidden", null,
    h("button.btn.secondary", { type: "button", onclick: () => api.done({ good: 0, total: 1 }) }, "Потренируюсь ещё"),
    h("button.btn.good", { type: "button", onclick: () => { api.addXp(5); api.done({ good: 1, total: 1 }); } }, icon("check", { size: 18 }), "Похоже!"));
  box.append(
    h("h2.center", null, "Прочитайте сами"),
    h("div.center", null, ar(w.d, { cls: "q-word" })),
    h("div.row.center.gap", null, playBtn("w:" + w.a, () => playWord(w.a), { label: "Послушать чтеца" }), h("span.muted", null, "Сначала послушайте чтеца")),
    h("div.center", null, mic), status,
    h("div.waves", null, ref, mine),
    h("div.row.center.gap", null, playMine),
    judge); // «Пропустить»: в правом верхнем углу шага (show)
  return box;
}

/** Из чего складывать слоги на шаге: буквы урока и уже пройденные (этап «Алфавит») или слова с нужными огласовками. */
export function blendScope(st, lesson) {
  const own = st.letters || (Array.isArray(lesson?.letters) ? lesson.letters : null);
  return { letters: own, known: knownLetters(lesson?.id), vowels: st.vowels || V3, need: st.need || null, minLen: st.minLen || 2, maxLen: st.maxLen || 3 };
}

// ---------- «Смотрите, что вы уже умеете» ----------
// В конце этапа: настоящее слово или аят Корана, которые ученик теперь читает сам.
const SHOW_LEVEL = { 4: "damma", 5: "damma", 6: "tanween", 7: "shadda" };
const SHOW_VERSE = { 8: "1:2", 9: "112:1", 10: "114:1", 11: "1:6", 12: "113:1", 13: "103:1" };
async function showcase(u) {
  const head = h("div.label", null, icon("sparkle", { size: 16 }), "Смотрите, что вы уже умеете");
  if (SHOW_VERSE[u.id]) return [head, h("p", null, "Этот аят Корана вы теперь читаете сами, слово за словом. Прочитайте вслух, потом послушайте чтеца."), await verseBlock(SHOW_VERSE[u.id])];
  if (SHOW_LEVEL[u.id]) {
    const ws = sample(lessonWords({ level: SHOW_LEVEL[u.id], maxLen: 5 }, 3).slice(0, 40), 3);
    return ws.length ? [head, h("p", null, "Эти слова из Корана вы теперь читаете сами. Прочитайте вслух, потом нажмите на слово и проверьте себя по чтецу."), wordsRow(ws, { showTr: false })] : null;
  }
  if (u.id === 2 || u.id === 3) return [head,
    h("p", null, u.id === 2 ? "Это первое слово Корана. Вы уже узнаёте в нём каждую букву: ба, син, мим." : "Это первое слово Корана. Теперь вы видите буквы и внутри слова: ба в начале, син в середине, мим в конце."),
    ar("بِسۡمِ", { cls: "card-big" }), lettersRow(["ba", "sin", "mim"])];
  return null;
}

// ---------- Плеер ----------
/**
 * Запускает урок в контейнере root. opts: { title, questionsOnly (для повторения), isTest, surah, onExit, id }
 * steps: шаги курса (или готовые вопросы, если questionsOnly).
 */
export async function playLesson(root, { id, title, steps, isTest = false, onExit, isSurah = false, lesson = null }) {
  stop();
  root.replaceChildren(h("div.lesson-loading", null, h("div.spinner"), h("p", null, "Готовим урок…")));
  // Разворачиваем шаги в экраны
  const screens = [];
  // Разминка: то, в чём ученик ошибался на прошлом занятии, первыми вопросами этого урока
  const warm = id && !isTest && !isSurah ? store.get().warmup : null;
  for (const key of warm?.keys || []) {
    const st = stepForKey(key);
    try { if (st) (await build(st, { letters: st.letters })).forEach((q) => screens.push({ type: "q", q })); } catch {}
  }
  const usedWarm = screens.length > 0;
  const warmLabel = usedWarm ? weakSpots(warm.keys) : "";
  for (const st of steps) {
    if (st.t === "ex") (await build(st, { id: lesson?.id, letters: st.letters || lesson?.letters })).forEach((q) => screens.push({ type: "q", q }));
    else if (st.t === "quiz") screens.push({ type: "q", q: quiz(st) });
    else if (st.t === "q") screens.push({ type: "q", q: st.q });
    else if (st.t === "letter" && !st.mini) screens.push({ type: "letterIntro", st });
    else if (st.t === "blend") {
      // «слог + слог = слово»: из букв урока (алфавит) или из слов нужного уровня (огласовки)
      const blends = blendsFor({ ...blendScope(st, lesson), n: st.n || 3 });
      if (blends.length) screens.push({ type: "blend", st, blends });
    }
    else if (st.t === "quranWord") { if (bank()?.byKey.has(st.key)) screens.push({ type: "quranWord", st }); }
    else screens.push({ type: st.t, st });
  }
  if (!screens.length) { root.replaceChildren(h("div.card", null, h("p", null, "Не удалось подготовить упражнения. Проверьте подключение к интернету."))); return; }

  const total0 = screens.filter((s) => s.type === "q").length;
  let idx = 0, firstTryOk = 0, answered = 0, xp = 0, combo = 0, bestCombo = 0;
  const t0 = Date.now();
  if (id && !isTest && !isSurah) track("lesson_started", { Урок: `${id}. ${title}` });
  else if (id && isTest) track("test_started", { Проверка: `${id}. ${title}` }); // иначе проверки не видны в «открыли урок»
  const mistakes = [];
  const voice = lessonVoice({ id, isTest, isSurah, title });
  const tutorNote = () => h("p.tutor-note", null, icon("sparkle", { size: 16 }), h("span", null, mixed(voice.intro({ warm: warmLabel }))));
  // слово учителя: над первым шагом каждого вида в уроке (в проверках и уроках сур не нужно).
  // Первые 3 раза для каждого вида: полностью, потом строка «Как это работает?», которая раскрывается нажатием.
  const told = new Set();
  const guideNote = (s) => {
    if (isTest || isSurah) return null;
    const kind = guideKind(s);
    if (told.has(kind)) return null;
    const t = guideFor(kind, { named: idx !== 0 }); // на первом экране имя уже прозвучало во вступлении
    if (!t) return null;
    told.add(kind);
    const counts = guideCounts(), seen = counts[kind] || 0;
    if (seen >= GUIDE_FULL) {
      const more = h("p.hidden", null, mixed(t));
      const btn = h("button.guide-more", { type: "button", "aria-expanded": "false", onclick: () => btn.setAttribute("aria-expanded", !more.classList.toggle("hidden")) }, icon("info", { size: 16 }), "Как это работает?");
      return h("div.tutor-note.guide.short", null, btn, more);
    }
    store.set((st) => { st.guides = { ...(st.guides || counts), [kind]: seen + 1 }; });
    return h("p.tutor-note.guide", null, icon("info", { size: 16 }), h("span", null, mixed(t)));
  };

  const bar = h("div.lp-bar-fill");
  const xpEl = h("span.lp-xp", null, icon("nur", { size: 16, fill: true, sw: 1 }), h("b", null, "0"));
  const comboEl = h("span.lp-combo");
  const exitBtn = h("button.icon-btn", { type: "button", "aria-label": "Выйти из урока" }, icon("close"));
  exitBtn.addEventListener("click", async () => {
    if (idx === 0 || await (await import("./ui.js")).confirmBox("Выйти из урока?", "Прогресс этого урока не сохранится.", "Выйти", "Остаться")) { stop(); onExit?.(null); }
  });
  const stage = h("div.lp-stage");
  const sheet = h("div.lp-sheet");
  // первый урок (или проверку) сразу после знакомства можно не проходить: «Пропустить» ведёт на главную, уроки при этом не открываются.
  // Кнопка стоит в верхней панели на месте счётчика нура: нур всё равно виден на итоге урока.
  let fromWelcome = false;
  try { fromWelcome = !!sessionStorage.getItem("tanwin.fromWelcome"); sessionStorage.removeItem("tanwin.fromWelcome"); } catch {}
  const homeBtn = fromWelcome ? skipBtn(() => { stop(); onExit?.(null); }, { cls: "lp-home", label: isTest ? "Пропустить проверку и перейти на главную" : "Пропустить урок и перейти на главную" }) : null;
  const shell = h("div.lesson", { class: isTest ? "test" : "" },
    h("header.lp-top", null, exitBtn, h("div.lp-bar", null, bar), comboEl, homeBtn || xpEl, sizeButton()),
    stage, sheet);
  root.replaceChildren(shell);

  const gain = (n) => { xp += n; xpEl.querySelector("b").textContent = xp; xpEl.classList.remove("pop"); void xpEl.offsetWidth; xpEl.classList.add("pop"); };
  const progress = () => { bar.style.width = Math.min(100, (idx / screens.length) * 100) + "%"; };

  // клавиатура (компьютер)
  const onKey = (e) => {
    if (!shell.isConnected) { document.removeEventListener("keydown", onKey); return; }
    if (e.target.closest("input,textarea")) return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 6) { const b = stage.querySelectorAll(".opt:not([disabled])")[n - 1]; b?.click(); }
    if (e.key === "Enter" || (e.key === " " && !e.target.closest("button"))) { const c = sheet.querySelector(".btn.primary") || stage.querySelector(".btn.next"); if (c) { e.preventDefault(); c.click(); } }
    if (e.key.toLowerCase() === "r" || e.key.toLowerCase() === "к") stage.querySelector(".q-play")?.click();
  };
  document.addEventListener("keydown", onKey);

  const nextBtn = (label = "Далее", cls = "primary") => {
    const b = h("button.btn.next.wide", { type: "button", class: cls }, label, icon("right", { size: 18 }));
    b.addEventListener("click", () => { sfx.tap(); go(); });
    return b;
  };

  function go() {
    stop();
    sheet.classList.remove("show", "ok", "bad");
    sheet.replaceChildren();
    idx++;
    progress();
    if (idx >= screens.length) return finish();
    const half = voice.halfway(idx, screens.length);
    if (half) toast(half, 2800);
    show();
  }

  async function show() {
    const s = screens[idx];
    stage.scrollTop = 0;
    stage.classList.remove("enter"); void stage.offsetWidth; stage.classList.add("enter");
    if (s.type === "q") return showQ(s);
    let body;
    if (s.type === "card") body = await renderCard(s.st);
    else if (s.type === "letter") body = letterCard(s.st.id, { mini: s.st.mini });
    else if (s.type === "letterIntro") body = letterIntro(s.st.id, { more: (id) => { stop(); modal(letterCard(id), { cls: "wide" }); } });
    else if (s.type === "forms") body = letterForms(s.st.id);
    else if (s.type === "quranWord") body = quranWordCard(s.st.key);
    else if (s.type === "blend") body = blendCard(s.blends, { title: s.st.title, text: s.st.text });
    else if (s.type === "zone") body = zoneCard(s.st.id);
    else if (s.type === "rule") body = ruleCard(s.st.code);
    else if (s.type === "read") body = readStep(s.st, { addXp: gain, done: () => go() });
    else if (s.type === "speak") body = speakStep(s.st, { addXp: gain, done: () => go() });
    else if (s.type === "custom") body = await s.st.render({ addXp: gain, done: () => go() });
    const needsNext = !["read", "speak"].includes(s.type) && !(s.type === "custom" && s.st.selfNext);
    const skip = s.type === "speak" ? h("div.step-skip", null, skipBtn(() => go(), { label: "Пропустить запись голоса" })) : null;
    stage.replaceChildren(h("div.lp-content", null, skip, idx === 0 ? tutorNote() : null, guideNote(s), body, needsNext ? h("div.lp-actions", null, nextBtn(idx === 0 ? "Начнём" : "Далее")) : null));
    // звук сразу: название буквы, три слога или первый пример сложения (а не слово, начинающееся с буквы)
    const here = idx;
    const auto = (fn, ms) => setTimeout(() => stage.isConnected && idx === here && fn(), ms);
    if (s.type === "letterIntro" || s.type === "letter" || s.type === "forms") auto(() => playLetter(s.st.id), 700);
    else if (body.autoplay) auto(body.autoplay, 700);
  }

  function showQ(s) {
    const q = s.q;
    let locked = false;
    const content = h("div.lp-content.q");
    if (idx === 0) content.append(tutorNote());
    const guide = guideNote(s);
    if (guide) content.append(guide);
    if (isTest) content.append(h("div.test-badge", null, icon("target", { size: 14 }), "Проверка"));
    content.append(q.prompt());
    if (q.play) {
      const pb = h("button.q-play", { type: "button", "aria-label": "Послушать ещё раз (R)" }, icon("vol", { size: 34 }));
      pb.addEventListener("click", () => { pb.classList.add("pulse"); q.play(); setTimeout(() => pb.classList.remove("pulse"), 600); });
      content.append(h("div.q-center", null, pb));
      setTimeout(() => stage.isConnected && q.play(), 250);
    }
    const answer = (ok, pickedEl) => {
      if (locked) return; locked = true;
      answered++;
      const first = !q._retry;
      let miss = null;
      if (ok) {
        sfx.correct(); combo++; bestCombo = Math.max(bestCombo, combo);
        if (first) { firstTryOk++; gain(10); } else gain(3);
        if (combo === 5 || combo === 10 || combo === 20) comboEl.replaceChildren(icon("flame", { size: 16, fill: true, sw: 1 }), `${combo} подряд!`), comboEl.classList.add("show"), setTimeout(() => comboEl.classList.remove("show"), 1800);
      } else {
        sfx.wrong(); combo = 0;
        miss = voice.miss({ retry: !!q._retry });
        if (!isTest && !q._retry) screens.push({ type: "q", q: { ...q, _retry: true, options: q.options && shuffle(q.options) } });
        if (!mistakes.includes(q)) mistakes.push(q);
      }
      if (q.key) srsSeen(q.key, ok && first);
      if (q.word) hardSeen(q.word.a, ok && first);
      q.onAnswer?.();
      const correctOpt = q.options?.find((o) => o.correct);
      sheet.className = "lp-sheet show " + (ok ? "ok" : "bad");
      sheet.replaceChildren(
        h("div.sheet-in", null,
          h("div.sheet-head", null, icon(ok ? "check" : "x", { size: 26, sw: 3 }),
            h("b", null, ok ? voice.praise({ combo, retry: !!q._retry }) : miss.head),
            ok ? null : correctOpt ? h("span.sheet-right", null, "Верно: ", correctOpt.node()) : null),
          q.explain && (!ok || isTest || q.kind === "quiz") ? h("p.sheet-explain", null, rich(q.explain)) : null,
          miss ? h("p.sheet-tutor", null, miss.text) : null,
          q.word?.stop ? h("p.sheet-stop", null, stopNote(q.word)) : null,
          q.after ? h("div.sheet-after", null, q.after()) : null,
          h("button.btn.primary.wide", { type: "button", onclick: () => { sfx.tap(); go(); } }, ok ? "Далее" : "Понятно", icon("right", { size: 18 }))));
      progress();
    };
    if (q.custom) content.append(q.custom({ answer: (ok) => answer(ok) }));
    if (q.options) {
      const grid = h("div.opts", { class: q.layout || "list" });
      q.options.forEach((o, i) => {
        const b = h("button.opt", { type: "button", "aria-label": o.label }, h("span.opt-k", null, i + 1), h("span.opt-v", null, o.node()));
        b.addEventListener("click", () => {
          if (locked) return;
          [...grid.children].forEach((x, j) => { x.disabled = true; if (q.options[j].correct) x.classList.add("right"); });
          if (!o.correct) b.classList.add("wrong");
          answer(o.correct, b);
        });
        grid.append(b);
      });
      content.append(grid);
    }
    stage.replaceChildren(content);
  }

  function finish() {
    document.removeEventListener("keydown", onKey);
    homeBtn?.replaceWith(xpEl); // на итоге пропускать уже нечего: на место «Пропустить» возвращается счётчик нура
    const pct = total0 ? Math.round((firstTryOk / total0) * 100) : 100;
    const passed = !isTest || pct >= 80;
    const ms = Date.now() - t0;
    let bonus = 0;
    if (passed) { bonus += isTest ? 30 : 20; if (pct === 100 && total0 >= 4) bonus += 10; }
    xp += bonus;
    xpEl.querySelector("b").textContent = xp;
    const events = addXp(xp);
    let res = { stars: 0, first: false };
    if (passed && id) res = finishLesson(id, { pct, ms, answers: answered, correct: firstTryOk, isSurah });
    // проверка этапа сдана, пропущенные уроки засчитываем сразу: итоговый экран могут закрыть, не нажав «Продолжить»
    if (passed && id && isTest) applySkip(id);
    track(!id ? "practice_done" : isSurah ? "surah_done" : isTest ? (passed ? "test_passed" : "test_failed") : "lesson_done",
      { [isSurah ? "Сура" : id ? "Урок" : "Тренировка"]: id ? `${id}. ${title}` : title, "Точность, %": pct, "Впервые": res.first ? "да" : "нет" });
    sfx.finish();
    if (passed) confetti(res.stars === 3 ? 110 : 60);
    const st = passed ? res.stars : 0;
    const goal = dayGoal(), done = todayDone();
    const note = voice.resultNote({ passed, first: res.first, pct });
    // личный разбор: что было трудно, с этого начнётся следующий урок
    const weak = isSurah ? [] : [...new Set(mistakes.map((m) => m.key).filter(Boolean))].slice(0, 3);
    if (usedWarm || weak.length) store.set((s) => { if (usedWarm) delete s.warmup; if (weak.length) s.warmup = { keys: weak, at: Date.now() }; });
    const weakText = weak.length ? weakSpots(weak) : "";
    const unit = voice.unitDone({ passed, first: res.first });
    const show = unit ? h("div.showcase") : null;
    if (show) showcase(unit).then((kids) => (kids ? show.append(...kids) : show.remove())).catch(() => show.remove());
    stage.replaceChildren(h("div.lp-content.result", null,
      h("div.res-stars", null, ...[1, 2, 3].map((i) => h("span", { class: i <= st ? "on" : "", style: { "--i": i } }, icon("star", { size: 54, fill: true, sw: 1 })))),
      h("h1", null, voice.resultTitle({ passed, pct })),
      note ? h("p.tutor-line", null, note) : null,
      weakText ? h("p.tutor-weak", null, icon("target", { size: 18 }), h("span", null, mixed(voice.weakNote(weakText)))) : null,
      show,
      passed && id === "1.1" ? afterFirstLesson() : null,
      h("p.muted", null, passed ? (isTest ? "Проверка сдана: следующий этап открыт." : "Новые знания уже в «Практике».") : "Для проверки нужно 80% верных ответов с первой попытки. Повторите и попробуйте снова: вы справитесь."),
      !passed && isTest && id ? easierTest(id, { fromWelcome, events }) : null,
      h("div.res-stats", null,
        stat("Точ­ность", pct + "%", "target"), // мягкий перенос: на 320 точках с крупным текстом слово не влезает в плитку
        stat("Нур", "+" + xp, "nur"),
        stat("Время", fmtTime(ms), "bolt")),
      h("div.res-goal", null, ring(done / goal, { size: 58, stroke: 7, label: done >= goal ? "✓" : `${done}/${goal}` }),
        h("div", null, h("b", null, done >= goal ? "Цель дня выполнена!" : "Цель дня"), h("div.muted", null, done >= goal ? `Уроков сегодня: ${done}` : `Уроков сегодня: ${done} из ${goal}`))),
      !weakText && mistakes.some((m) => m.key) && !isTest ? h("p.muted.small", null, "Темы с ошибками чаще появятся в «Практике»: так они запомнятся лучше.") : null,
      h("div.lp-actions", null,
        !passed ? h("button.btn.secondary.wide", { type: "button", onclick: () => playLesson(root, { id, title, steps, isTest, onExit, isSurah, lesson }) }, "Ещё раз") : null,
        h("button.btn.primary.wide", { type: "button", onclick: () => onExit?.({ passed, pct, events }) }, "Продолжить", icon("right", { size: 18 })))));
    sheet.classList.remove("show");
    bar.style.width = "100%";
    if (events.includes("level")) setTimeout(() => sfx.level(), 900);
  }

  progress();
  show();
}

// ---------- Слово учителя: сколько раз показано ----------
// Решение автора от 2026-10-21: каждое пояснение полностью первые 3 раза, потом короткой строкой.
// Счёт хранится в store.guides. У того, кто учился раньше, он считается один раз по пройденным урокам.
const GUIDE_FULL = 3;
function stepGuideKind(st) {
  if (st.t === "ex") return guideKind({ type: "q", q: { kind: st.k } });
  if (st.t === "quiz" || st.t === "q") return "q";
  if (st.t === "letter") return st.mini ? "letter" : "letterIntro";
  return st.t;
}
function guideCounts() {
  const st = store.get();
  if (st.guides) return st.guides;
  const n = {};
  for (const u of UNITS) for (const l of u.lessons) {
    if (l.test || !lessonDone(l.id)) continue;
    for (const k of new Set(l.steps.map(stepGuideKind))) n[k] = (n[k] || 0) + 1;
  }
  store.set((s) => { s.guides = n; });
  return n;
}

// ---------- Проверка не сдана ----------
// Запасной путь (диагностика 2026-10-21, программа п.6): не отправлять сразу на урок 1.1, а предложить предыдущую проверку курса.
// Сдал её: уроки до неё засчитаны, путь продолжится сразу после неё. Предыдущая уже сдана: путь и так ведёт к нужным урокам.
function easierTest(id, { fromWelcome, events }) {
  const i = ALL_LESSONS.findIndex((l) => l.id === id);
  const prev = ALL_LESSONS.slice(0, i).findLast((l) => l.test);
  const open = (path) => {
    if (fromWelcome) try { sessionStorage.setItem("tanwin.fromWelcome", "1"); } catch {} // и в этой проверке «Пропустить» на главную
    import("./app.js").then((m) => { m.go(path); setTimeout(() => m.celebrate(events), 400); });
  };
  if (!prev) {
    if (lessonDone("1.1")) return null;
    return h("div.card.easier", null,
      h("b", null, "Начните с первого урока"),
      h("p.muted", null, "Буквы по четыре, с голосом чтеца. Первые уроки короткие."),
      h("button.btn.secondary", { type: "button", onclick: () => open("/learn/1.1") }, "Первый урок", icon("right", { size: 18 })));
  }
  if (lessonDone(prev.id)) return null;
  const next = ALL_LESSONS[ALL_LESSONS.indexOf(prev) + 1]; // в названии бывает арабский знак («Фатха  ـَ»): в строке текста он без арабского шрифта, убираем
  return h("div.card.easier", null,
    h("b", null, "Попробуйте проверку попроще"),
    h("p.muted", null, `Сдадите её, и путь продолжится с урока «${next.title.replace(/[؀-ۿـ]+/g, "").replace(/\s+/g, " ").trim()}».`),
    h("button.btn.secondary", { type: "button", onclick: () => open("/learn/" + prev.id) }, prev.title, icon("right", { size: 18 })));
}

// ---------- После первого урока ----------
// Что дальше и предложение поставить значок: одна карточка на итоге урока 1.1, без напоминаний.
function afterFirstLesson() {
  let hidden = false;
  try { hidden = !!localStorage.getItem("tanwin.installHint"); } catch {}
  const offer = !hidden && !isInstalled() && matchMedia("(pointer: coarse)").matches;
  return h("div.card.after-first", null,
    h("b", null, "Следующий урок: первые четыре буквы"),
    ar("ا ب ت ث", { cls: "af-ar" }),
    offer ? h("p.muted", null, "Поставьте значок TanWin на экран: урок откроется одним нажатием, даже без интернета.") : null,
    offer ? h("button.btn.secondary", { type: "button", onclick: (e) => { try { localStorage.setItem("tanwin.installHint", "1"); } catch {} e.currentTarget.remove(); import("./app.js").then((m) => m.installApp()); } }, icon("down", { size: 18 }), "Установить") : null);
}

const stat = (label, value, ic) => h("div.stat", null, icon(ic, { size: 20 }), h("b", null, value), h("small", null, label));
export const fmtTime = (ms) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} с`;
  const m = Math.round(s / 60);
  if (m < 60) return s < 600 && s % 60 ? `${Math.floor(s / 60)} мин ${s % 60} с` : `${m} мин`;
  return `${Math.floor(m / 60)} ч ${m % 60 ? (m % 60) + " мин" : ""}`.trim();
};
export { renderCard, zoneCard, ruleCard, verseBlock };
