// 3.0: любая карточка теории из js/course.js идёт фильмом (шаг 2 плана 3.0).
// Абзацы карточки режутся на фразы: одна фраза, один такт. Картинка меняется под фразу:
// арабские вставки фразы выскакивают крупными наклейками, без них: выделенные слова плашками.
// Крупная надпись карточки (big) видна весь фильм. Наглядная часть (аят, плитки, примеры, сравнение, случаи)
// показывается последним кадром, её можно нажимать и слушать.
import { h, mixed } from "../ui.js";
import { film, markAr } from "./engine.js";
import { LETTERS } from "../letters.js";
import { sticker, badge, arSticker } from "./art.js";

const plain = (t) => t.replace(/\*\*|[{}]/g, "");
// точка после сокращения («т. е.», «и т. п.», «см.») фразу не заканчивает
const ABBR = /(?:\bт\. ?[епд]|\bт\. ?к|\bи т\. ?[пд]|\bсм|\bср|\bгл|\bст)\.$/i;

/** Абзац → фразы. Короткие фразы склеиваются с соседней, чтобы такт не был пустым. */
export function sentences(p) {
  const raw = [];
  let buf = "";
  for (const s of p.split(/(?<=[.!?…])\s+(?=[«"(\[{*А-ЯЁA-Z0-9])/)) {
    buf = buf ? `${buf} ${s}` : s;
    if (ABBR.test(buf)) continue;
    raw.push(buf); buf = "";
  }
  if (buf) raw.push(buf);
  const out = [];
  for (const s of raw) {
    const last = out[out.length - 1];
    if (last && (plain(last).length < 45 || plain(s).length < 28) && plain(`${last} ${s}`).length < 160) out[out.length - 1] = `${last} ${s}`;
    else out.push(s);
  }
  return out;
}

// что показать последним кадром: подсказка по виду наглядной части
const SHOW_HINT = [
  [["sounds", "sounds1", "syll", "syllTable"], "Нажимайте на плитки: чтец скажет имя буквы, огласовку и слог."],
  [["verse"], "Нажимайте на слова и слушайте. Кнопка внизу читает весь аят."],
  [["examples", "compare", "cases", "words", "wordsLevel", "contrast", "muqattaat"], "Нажимайте на примеры и слушайте чтеца."],
  [["forms", "forms2"], "Так буква выглядит отдельно, в начале, в середине и в конце слова."],
  [["diagram"], "Посмотрите на схему: здесь рождается звук."],
  [["stopSigns", "ruleWheel"], "Всё вместе на одной картинке."],
];
const SHOW_KEYS = SHOW_HINT.flatMap(([ks]) => ks);
const TONES = ["lime", "yellow", "sky", "pink"];

// буква, названная в фразе по имени («Алиф пишется…», «у джима точка»): имя не короче трёх букв, чтобы «та» и «да» не путались со словами
const NAMED = LETTERS.filter((l) => l.name.length >= 3).map((l) => [new RegExp(`(^|[^а-яёӀ])${l.name.toLowerCase()}(а|у|ом|е|ы)?(?=$|[^а-яёӀ])`, "i"), l.ch]);
/** Наклейки под фразу: арабские вставки, буквы, названные по имени, или выделенные слова. */
function spotFor(text) {
  const ars = [...text.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]).slice(0, 3);
  if (ars.length) return ars.map((a, i) => arSticker(a, { size: ars.length > 1 || a.length > 10 ? "2.6rem" : "4rem", tone: i ? TONES[i % 4] : "paper", tilt: [-3, 3, -2][i], cls: "kc-ar" }));
  const named = NAMED.filter(([re]) => re.test(plain(text))).map(([, ch]) => ch).slice(0, 4);
  if (named.length) return named.map((ch, i) => arSticker(ch, { size: named.length > 2 ? "2.8rem" : "3.6rem", tone: TONES[i % 4], tilt: [-4, 3, -2, 4][i], cls: "kc-ar" }));
  const bold = [...text.matchAll(/\*\*([^*]+)\*\*/g)].map((m) => m[1].replace(/[:.,]$/, "")).filter((b) => b.length < 40).slice(0, 3);
  return bold.map((b, i) => badge(b, { tone: TONES[i % 4], tilt: [-4, 3, -2][i], cls: "kc-word" }));
}

/** Фильм из карточки. renderCard: из js/lesson.js (рисует наглядную часть), done: к следующему шагу урока. */
export async function cardFilm(step, { renderCard, done }) {
  const hasShow = SHOW_KEYS.some((k) => step[k] != null);
  let extras = null, autoplay = null;
  if (hasShow) {
    const tmp = await renderCard({ ...step, title: "", body: [], note: null, big: null, caption: null, kicker: null, icon: null });
    extras = tmp.querySelector(".card-extras");
    autoplay = tmp.autoplay || null;
  }
  // такты разговора: по фразе; абзац из одного арабского текста (строка «Мукаддимы») становится картинкой следующей фразы
  const talk = [];
  let pendingAr = null;
  for (const p0 of step.body || []) {
    const p = markAr(p0);
    if (/^\{[^}]+\}$/.test(p.trim())) { pendingAr = p.trim().slice(1, -1); continue; }
    for (const s of sentences(p)) { talk.push({ say: s, line: pendingAr }); pendingAr = null; }
  }
  if (!talk.length) talk.push({ say: step.caption || "Посмотрите внимательно." });

  const head = (small = false) => h("div.kc-head", { class: small ? "small" : "" },
    step.kicker ? badge(step.kicker, { tone: "yellow", tilt: -3, cls: "kc-kicker" }) : null,
    sticker([step.icon ? h("span.kc-icon", null, step.icon) : null, h("h2.kc-title", null, mixed(step.title || ""))], { tone: "paper", tilt: -1.5, cls: "kc-title-st" }));

  const talkShot = {
    tone: "violet",
    build(layer) {
      const top = head();
      const spot = h("div.kc-spot");
      const big = step.big ? arSticker(step.big, { size: "3.2rem", tone: "paper", tilt: 2, cls: "kc-big k-hide" }) : null;
      layer.append(h("div.kc", null, top, spot, big));
      return { top, spot, big };
    },
    beats: talk.map((b, i) => ({
      say: b.say,
      run: (r, fx) => {
        if (i === 0) { fx.pop(r.top, { rot: -8 }); if (r.big) fx.pop(r.big, { delay: 250 }); }
        const items = b.line ? [arSticker(b.line, { size: "2.2rem", tone: "paper", cls: "kc-line" })] : spotFor(b.say);
        if (items.length) { r.spot.replaceChildren(...items); fx.each(items, (el, o) => fx.pop(el, { ...o, rot: 14 }), 140, i === 0 ? 300 : 0); }
        else if (i) fx.wiggle(r.big || r.top.lastElementChild);
      },
    })),
  };
  if (!hasShow && step.note) talkShot.beats.push({ say: step.note, run: (r, fx) => fx.wiggle(r.big || r.top.lastElementChild) });

  const shots = [talkShot];
  if (hasShow && extras) {
    const hint = step.caption || SHOW_HINT.find(([ks]) => ks.some((k) => step[k] != null))?.[1] || "Посмотрите внимательно.";
    const showShot = {
      tone: "blue", scroll: true,
      build(layer) {
        const box = sticker([extras], { tone: "paper", cls: "kc-show" });
        layer.append(h("div.kc-show-wrap", null, head(true), box));
        return { box };
      },
      beats: [{ say: hint, run: (r, fx) => { fx.rise(r.box); if (autoplay) fx.sound(autoplay, 700); } }],
    };
    if (step.note) showShot.beats.push({ say: step.note, run: (r, fx) => fx.pulse(r.box, { k: 1.02 }) });
    shots.push(showShot);
  }
  return film({ shots, onDone: done, cls: "ls" });
}
