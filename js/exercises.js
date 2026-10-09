// Генераторы упражнений. Каждое упражнение — объект вопроса, который показывает плеер урока (lesson.js):
// { kind, key, prompt(): Node, options?: [{node(), correct, label}], layout, play?(), explain?, after?(): Node, custom?(api): Node }
import { LETTERS, byId, byChar, SHAPE_FAMILIES, SOUND_PAIRS, HEAVY, forms, ZONES, POINTS } from "./letters.js";
import { syllRu, clusters, M, translit, analyze, stripStops } from "./arabic.js";
import { words, lessonWords, letterExamples, minimalPairs, loadSurah, bank, rareExamples } from "./data.js";
import { RULES, parseMarkup, plain, rulesIn } from "./rules.js";
import { SURAH_PATH, knownLetters } from "./course.js";
import { h, ar, arParts, tr, icon, shuffle, pick, sample, wordChip, rich } from "./ui.js";
import { playWord, preloadWord, playLetter, playSyll, preloadLetter } from "./audio.js";
import { syllText as sylAr, syllTr as sylRu, blendsFor, blendBoard, blendTr, playBlend, V3, VOWELS, SYLL_IDS } from "./syllables.js";
import { diagram, spreadChoices } from "./diagram.js";

const L_ALL = LETTERS.map((l) => l.id);
const uniq = (a) => [...new Set(a)];

function similarLetters(id, n, pool = L_ALL) {
  const fam = SHAPE_FAMILIES.find((f) => f.includes(id)) || [];
  const snd = SOUND_PAIRS.filter((p) => p[0] === id || p[1] === id).flatMap((p) => [p[0], p[1]]);
  let c = uniq([...shuffle(fam), ...shuffle(snd), ...shuffle(pool), ...shuffle(L_ALL)]).filter((x) => x !== id);
  return c.slice(0, n);
}
const letterOpt = (id, correct) => ({ node: () => ar(byId[id].ch, { cls: "opt-letter" }), correct, label: byId[id].name });
const textOpt = (t, correct) => ({ node: () => h("span", null, t), correct, label: t });
const trOpt = (t, correct) => ({ node: () => tr(t), correct, label: t });
const arOpt = (t, correct, cls = "opt-word") => ({ node: () => ar(t, { cls }), correct, label: t });
const withOpts = (q, opts) => ({ ...q, options: shuffle(opts) });

const bigLetter = (ch) => ar(ch, { cls: "q-big" });
const promptText = (t, sub) => h("div.q-text", null, h("h2", null, rich(t)), sub ? h("p.muted", null, rich(sub)) : null);
const target = (lesson, o) => {
  if (o.from === "all" || lesson?.letters === "all") return L_ALL;
  if (Array.isArray(lesson?.letters)) return lesson.letters;
  return L_ALL;
};
// Список «целей» длиной n: каждая цель встречается, прежде чем повториться
// пустой список — пустой результат (иначе цикл не закончится и страница зависнет)
const cycle = (arr, n) => { const out = []; while (arr.length && out.length < n) out.push(...shuffle(arr)); return out.slice(0, n); };

// ================= Буквы =================
const G = {};
G.letterName = (o, lesson) => cycle(target(lesson, o), o.n).map((id) => {
  const l = byId[id];
  return withOpts({ kind: "letterName", key: "L:" + id, layout: "grid2",
    prompt: () => h("div.q-center", null, promptText("Как называется эта буква?"), bigLetter(l.ch)),
    explain: `Это ${l.name} — ${l.t}. ${l.dots[0].toUpperCase() + l.dots.slice(1)}.`,
  }, [textOpt(l.name, true), ...similarLetters(id, 3).map((x) => textOpt(byId[x].name, false))]);
});
G.letterPick = (o, lesson) => cycle(target(lesson, o), o.n).map((id) => {
  const l = byId[id];
  return withOpts({ kind: "letterPick", key: "L:" + id, layout: "grid4",
    prompt: () => promptText(`Найдите букву **${l.name}**`, `Звук: ${l.t}`),
    explain: `${l.name} — ${l.dots}.`,
  }, [letterOpt(id, true), ...similarLetters(id, 3).map((x) => letterOpt(x, false))]);
});
G.shape = (o, lesson) => cycle(target(lesson, o).filter((id) => id !== "hamza"), o.n).map((id) => {
  const l = byId[id];
  const all = uniq(LETTERS.map((x) => x.dots));
  const wrong = shuffle(all.filter((d) => d !== l.dots)).slice(0, 3);
  return withOpts({ kind: "shape", key: "L:" + id, layout: "list",
    prompt: () => h("div.q-center", null, promptText("Сколько точек у этой буквы и где они?"), bigLetter(l.ch)),
    explain: `${l.name}: ${l.dots}.`,
  }, [textOpt(l.dots, true), ...wrong.map((d) => textOpt(d, false))]);
});
G.listenFirst = (o, lesson) => {
  const ids = target(lesson, o).filter((id) => id !== "alif");
  return cycle(ids, o.n).map((id) => {
    const ex = pick(letterExamples(id, 4));
    if (!ex) return null;
    preloadWord(ex.a);
    return withOpts({ kind: "listenFirst", key: "L:" + id, layout: "grid4",
      play: () => playWord(ex.a),
      prompt: () => promptText("С какой буквы начинается слово?", "Послушайте чтеца. Первая буква — самая правая."),
      after: () => h("div.after-word", null, wordChip(ex, { showTr: true, big: true })),
    }, [letterOpt(id, true), ...similarLetters(id, 3, ids).map((x) => letterOpt(x, false))]);
  }).filter(Boolean);
};
// На слух: название буквы → какая это буква
G.letterListen = (o, lesson) => cycle(target(lesson, o).filter((id) => id !== "hamza"), o.n).map((id) => {
  const l = byId[id];
  preloadLetter(id);
  return withOpts({ kind: "letterListen", key: "L:" + id, layout: "grid4",
    play: () => playLetter(id),
    prompt: () => promptText("Какую букву вы слышите?", "Можно слушать сколько угодно раз."),
    explain: `Это ${l.name} — ${l.dots}.`,
  }, [letterOpt(id, true), ...similarLetters(id, 3, target(lesson, o)).map((x) => letterOpt(x, false))]);
});
// На слух: слог (буква с огласовкой) → какой это слог
G.sylListen = (o, lesson) => {
  const vs = o.vowels || V3;
  const ids = (o.letters || target(lesson, o)).filter((id) => id !== "alif");
  return cycle(ids, o.n).map((id) => {
    const v = pick(vs);
    preloadLetter(id, v);
    // неверные варианты: та же буква с другой огласовкой и похожие буквы с той же
    const sameLetter = V3.filter((x) => x !== v).map((x) => sylAr(id, x));
    const sameVowel = similarLetters(id, 4, ids).filter((x) => x !== "alif").map((x) => sylAr(x, v));
    const wrong = uniq(vs.length > 1 ? [sameLetter[0], ...sameVowel.slice(0, 2), sameLetter[1], ...sameVowel.slice(2)] : sameVowel).filter((t) => t && t !== sylAr(id, v)).slice(0, 3);
    return withOpts({ kind: "sylListen", key: "V:" + v, layout: "grid4",
      play: () => playSyll(id, v),
      prompt: () => promptText("Какой слог вы слышите?", "Смотрите и на букву, и на огласовку."),
      explain: `${byId[id].name} + ${VOWELS[v].name} = «${sylRu(id, v)}».`,
    }, [arOpt(sylAr(id, v), true, "opt-letter"), ...wrong.map((t) => arOpt(t, false, "opt-letter"))]);
  });
};
// Собрать слово из слогов: плитки соединяются в слово по мере сборки
G.blend = (o, lesson) => {
  const own = o.letters || (Array.isArray(lesson?.letters) ? lesson.letters : null);
  const scope = { letters: own, known: knownLetters(lesson?.id), vowels: o.vowels || V3, need: o.need || null, minLen: o.minLen || 2, maxLen: o.maxLen || 3 };
  return blendsFor({ ...scope, n: o.n }).map((b) => {
    // лишние плитки: те же буквы с другой огласовкой
    const have = new Set(b.sylls.map((x) => x.text));
    const extra = [];
    for (const x of shuffle(b.sylls)) for (const v of shuffle(V3)) {
      const text = x.text.replace(VOWELS[x.v].mark, VOWELS[v].mark);
      if (extra.length < 2 && !have.has(text)) { have.add(text); extra.push({ id: x.id, v, text }); }
    }
    b.sylls.forEach((x) => preloadLetter(x.id, x.v));
    return { kind: "blend", key: "V:mix", word: b.word || undefined,
      play: () => playBlend(b),
      prompt: () => h("div.q-center", null, promptText("Соберите слово из слогов", "Послушайте и нажимайте на слоги по порядку — справа налево."), h("div.q-tr.small", null, tr(blendTr(b)))),
      explain: `${b.sylls.map((x) => sylRu(x.id, x.v)).join(" + ")} = «${b.tr}»`,
      after: () => (b.word ? wordChip(b.word, { showTr: true, big: true }) : h("div.after-word", null, ar(b.text, { cls: "q-word" }))),
      custom: (api) => blendBoard(b, extra, api.answer) };
  });
};
G.pairListen = (o) => {
  const all = minimalPairs();
  const wanted = o.pairs === "all" || !o.pairs ? null : o.pairs.map((p) => p.join("-"));
  const match = (p) => !wanted || wanted.includes(p.a + "-" + p.b) || wanted.includes(p.b + "-" + p.a);
  // нужные пары вперемешку; если их мало — добавляем другие трудные пары
  let pool = shuffle(all.filter(match));
  if (pool.length < o.n) pool = [...pool, ...shuffle(all.filter((p) => !match(p)))];
  // по кругу по видам пар, чтобы было разнообразие
  const groups = {};
  for (const p of pool) (groups[p.a + p.b] ||= []).push(p);
  const order = [];
  const gl = Object.values(groups);
  for (let i = 0; order.length < pool.length; i++) for (const g of gl) if (g[i]) order.push(g[i]);
  return order.slice(0, o.n).map((p) => {
    const [w, other] = Math.random() < 0.5 ? [p.w1, p.w2] : [p.w2, p.w1];
    preloadWord(w.a);
    return withOpts({ kind: "pairListen", key: `P:${p.a}-${p.b}`, layout: "grid2",
      play: () => playWord(w.a),
      prompt: () => promptText("Какое слово прозвучало?", `Разница — ${p.label}: ${byId[p.a].ch} или ${byId[p.b].ch}`),
      after: () => h("div.after-pair", null, wordChip(w, { showTr: true }), wordChip(other, { showTr: true })),
    }, [arOpt(w.d, true), arOpt(other.d, false)]);
  });
};

// ================= Махраджи =================
const ZONE_IDS = Object.keys(ZONES);
G.zonePick = (o) => cycle(L_ALL.filter((x) => x !== "alif"), o.n).map((id) => {
  const l = byId[id];
  const z = POINTS[l.point].zone;
  return withOpts({ kind: "zonePick", key: "M:" + id, layout: "list",
    prompt: () => h("div.q-center", null, promptText("Откуда выходит звук этой буквы?"), bigLetter(l.ch)),
    explain: `${l.name}: ${POINTS[l.point].label.toLowerCase()}.`,
    after: () => diagram({ highlight: l.point, small: true }),
  }, [textOpt(ZONES[z].ru, true), ...sample(ZONE_IDS.filter((x) => x !== z && x !== "jawf"), 3).map((x) => textOpt(ZONES[x].ru, false))]);
});
G.pointPick = (o) => {
  const ids = o.letters === "all" || !o.letters ? L_ALL.filter((x) => x !== "alif") : o.letters;
  return cycle(ids, o.n).map((id) => {
    const l = byId[id];
    return { kind: "pointPick", key: "M:" + id,
      prompt: () => h("div.q-center", null, promptText(`Нажмите, откуда выходит {${l.ch}}`, `${l.name}`)),
      explain: `${l.name}: ${POINTS[l.point].label.toLowerCase()}.`,
      custom: (api) => {
        const wrap = h("div.diagram-wrap");
        const only = spreadChoices(l.point, 3);
        const draw = (hl) => wrap.replaceChildren(diagram({ interactive: !hl, highlight: hl, only: hl ? null : only, onPick: (pt) => {
          const ok = pt === l.point;
          draw(l.point);
          if (!ok) wrap.querySelector(`[data-point="${pt}"]`)?.classList.add("wrong-pt");
          api.answer(ok);
        } }));
        draw(null);
        return wrap;
      } };
  });
};
G.heavy = (o) => cycle(L_ALL.filter((x) => !["alif", "ra", "lam", "hamza"].includes(x)), o.n).map((id) => {
  const l = byId[id];
  const hv = HEAVY.includes(id);
  return withOpts({ kind: "heavy", key: "H:" + id, layout: "grid2",
    prompt: () => h("div.q-center", null, promptText("Тяжёлая или лёгкая буква?"), bigLetter(l.ch)),
    explain: hv ? `${l.name} — одна из семи тяжёлых: خ ص ض غ ط ق ظ.` : `${l.name} — лёгкая буква.`,
  }, [textOpt("Тяжёлая", hv), textOpt("Лёгкая", !hv)]);
});

// ================= Формы =================
const FORM_PLACE = { ini: "в начале слова", med: "в середине слова", fin: "в конце слова" };
// В какой форме стоит буква: начало, середина или конец слова (только буквы, которые соединяются с обеих сторон)
G.formWhere = (o, lesson) => {
  const own = Array.isArray(lesson?.letters) ? lesson.letters : L_ALL;
  const ids = own.filter((x) => x !== "hamza" && !byId[x].nc);
  if (!ids.length) return [];
  return cycle(ids, o.n).map((id) => {
    const l = byId[id];
    const which = pick(["ini", "med", "fin"]);
    const NAMES = { ini: "В начале слова", med: "В середине", fin: "В конце слова" };
    return withOpts({ kind: "formWhere", key: "F:" + id, layout: "list",
      prompt: () => h("div.q-center", null, promptText(`Где в слове стоит ${l.name} в таком виде?`, "Смотрите, с какой стороны есть соединение."), ar(forms(l)[which], { cls: "q-big form-box" })),
      explain: "Соединение слева — после буквы есть следующая (начало или середина). Соединение справа — перед ней есть буква (середина или конец).",
    }, Object.entries(NAMES).map(([k, t]) => textOpt(t, k === which)));
  });
};
G.formPick = (o, lesson) => cycle((o.own && Array.isArray(lesson?.letters) ? lesson.letters : L_ALL).filter((x) => x !== "hamza" && x !== "alif"), o.n).map((id) => {
  const l = byId[id];
  const f = forms(l);
  const which = pick(l.nc ? ["fin"] : ["ini", "med", "fin"]);
  return withOpts({ kind: "formPick", key: "F:" + id, layout: "grid4",
    prompt: () => h("div.q-center", null, promptText(`Какая буква стоит ${FORM_PLACE[which]}?`), ar(f[which], { cls: "q-big form-box" })),
    explain: `Это ${l.name}. Отдельно: ${l.ch}.`,
  }, [letterOpt(id, true), ...similarLetters(id, 3).map((x) => letterOpt(x, false))]);
});
const baseLetters = (d) => clusters(d).map((c) => byChar[c.b]?.id || (c.b === "ٱ" ? "alif" : null)).filter(Boolean);
G.firstLetter = (o) => sample(words({ level: "shadda", minLen: 3, maxLen: 5, filter: (w) => w.firstL && w.firstL !== "hamza" }), o.n).map((w) => {
  const id = w.firstL;
  return withOpts({ kind: "firstLetter", key: "L:" + id, layout: "grid4",
    prompt: () => h("div.q-center", null, promptText("Какая буква в этом слове первая?", "Первая — самая правая."), ar(w.d, { cls: "q-word" })),
    after: () => wordChip(w, { showTr: true }),
  }, [letterOpt(id, true), ...similarLetters(id, 3).map((x) => letterOpt(x, false))]);
});
G.hasLetter = (o) => sample(words({ level: "shadda", minLen: 3, maxLen: 6 }), o.n).map((w) => {
  const inWord = uniq(baseLetters(w.d));
  const yes = Math.random() < 0.5;
  const id = yes ? pick(inWord.filter((x) => x !== "alif") .length ? inWord.filter((x) => x !== "alif") : inWord) : pick(similarLetters(pick(inWord), 4).filter((x) => !inWord.includes(x) && x !== "alif")) || "zza";
  const has = inWord.includes(id);
  return withOpts({ kind: "hasLetter", key: "L:" + id, layout: "grid2",
    prompt: () => h("div.q-center", null, promptText(`Есть ли в слове буква {${byId[id].ch}}?`, byId[id].name), ar(w.d, { cls: "q-word" })),
    after: () => wordChip(w, { showTr: true }),
  }, [textOpt("Да, есть", has), textOpt("Нет", !has)]);
});

// ================= Огласовки =================
const VOW = { fatha: [M.FATHA, "a"], kasra: [M.KASRA, "i"], damma: [M.DAMMA, "u"], fathatan: [M.FATHATAN, "a", "н"], kasratan: [M.KASRATAN, "i", "н"], dammatan: [M.DAMMATAN, "u", "н"] };
const SYL_LETTERS = L_ALL.filter((x) => !["alif", "hamza"].includes(x));
const sylText = (id, v) => { const ch = byId[id].ch; return v === "fathatan" ? ch + M.FATHATAN + (id === "ta" ? "" : "ا") : ch + VOW[v][0]; };
const sylTr = (id, v) => syllRu(byId[id].ch, VOW[v][1]) + (VOW[v][2] || ""); // гласная зависит от буквы: после тяжёлых — «о» и «ы»
G.syllable = (o, lesson) => {
  const vs = o.vowels || ["fatha"];
  const own = o.own && Array.isArray(lesson?.letters) ? lesson.letters.filter((x) => SYL_LETTERS.includes(x)) : null;
  const ids = o.letters || (own?.length ? own : SYL_LETTERS);
  return Array.from({ length: o.n }, () => {
    const id = pick(ids), v = pick(vs);
    const right = sylTr(id, v);
    const alts = uniq([
      ...Object.keys(VOW).filter((x) => x !== v && (vs.length > 1 ? vs.includes(x) || vs.length < 3 : true)).map((x) => sylTr(id, x)),
      ...similarLetters(id, 3, SYL_LETTERS).filter((x) => x !== "alif" && x !== "hamza").map((x) => sylTr(x, v)),
    ]).filter((t) => t !== right);
    return withOpts({ kind: "syllable", key: "V:" + v, layout: "grid2",
      prompt: () => h("div.q-center", null, promptText("Как читается слог?"), ar(sylText(id, v), { cls: "q-big" })),
      onAnswer: () => { if (VOWELS[v]) playSyll(id, v); },
      explain: `${byId[id].name} + ${{ fatha: "фатха", kasra: "касра", damma: "дамма", fathatan: "фатхатан", kasratan: "касратан", dammatan: "даммтан" }[v]} = «${right}».`,
    }, [trOpt(right, true), ...shuffle(alts).slice(0, 3).map((t) => trOpt(t, false))]);
  });
};
G.syllableRev = (o) => Array.from({ length: o.n }, () => {
  const vs = o.vowels || ["fatha", "kasra", "damma"];
  const id = pick(SYL_LETTERS), v = pick(vs);
  // неверные варианты — только с уже пройденными огласовками; не хватает — похожие буквы
  const others = vs.filter((x) => x !== v).map((x) => sylText(id, x));
  const sim = similarLetters(id, 3 - others.length, SYL_LETTERS).map((x) => sylText(x, v));
  return withOpts({ kind: "syllableRev", key: "V:" + v, layout: "grid4",
    prompt: () => h("div.q-center", null, promptText("Найдите слог"), h("div.q-tr", null, tr(sylTr(id, v)))),
  }, [arOpt(sylText(id, v), true, "opt-letter"), ...[...others, ...sim].map((t) => arOpt(t, false, "opt-letter"))]);
});

// Неверные варианты чтения: меняем гласную, долготу, удвоение, танвин
// Какие гласные бывают после согласной, на которую кончается s: после тяжёлых — «о ы у», после «р» — «о и у», иначе «а и у»
const vowelsAfter = (s) => (/(с̣|д̣|тӀ|зӀ|гӀ|къ|х)[аиуоы]*$/.test(s) ? ["о", "ы", "у"] : /р[аиуоы]*$/.test(s) ? ["о", "и", "у"] : ["а", "и", "у"]);
function mutateTr(t) {
  const out = new Set();
  const chars = [...t];
  for (let i = 0; i < chars.length; i++) {
    if (!"аиуоы".includes(chars[i])) continue;
    const V = vowelsAfter(chars.slice(0, i).join(""));
    const long = chars[i + 1] === chars[i] || chars[i - 1] === chars[i];
    for (const v of V) if (v !== chars[i] && !long) { const c = [...chars]; c[i] = v; out.add(c.join("")); }
    if (long && chars[i + 1] === chars[i]) { const c = [...chars]; c.splice(i, 1); out.add(c.join("")); }
    if (!long) { const c = [...chars]; c.splice(i, 0, chars[i]); out.add(c.join("")); }
  }
  const dbl = t.match(/([бвгджзйклмнрстфхшӀ])\1/);
  if (dbl) out.add(t.replace(dbl[0], dbl[1]));
  if (/[аиуоы]н$/.test(t)) { const V = vowelsAfter(t.slice(0, -2)); out.add(t.slice(0, -1)); out.add(t.slice(0, -2) + V[(V.indexOf(t.at(-2)) + 1) % 3] + "н"); }
  out.delete(t);
  return [...out];
}
function readOptions(w, n = 3) {
  let m = shuffle(mutateTr(w.tr));
  // предпочитаем «близкие» ошибки в начале слова и в середине
  return m.slice(0, n);
}
G.readWord = (o) => {
  const pool = o.words || lessonWords({ level: o.level, need: o.need || "", avoid: o.avoid || "", maxLen: o.maxLen || 6 }, o.n);
  return (o.words || sample(pool.slice(0, 250), o.n)).map((w) => {
    const wrong = readOptions(w, 3);
    return withOpts({ kind: "readWord", key: "W:" + (o.level || w.L), word: w, layout: "grid2",
      prompt: () => h("div.q-center", null, promptText("Как читается слово?", "Прочитайте вслух, потом выберите."), ar(w.d, { cls: "q-word" })),
      after: () => wordChip(w, { showTr: true, big: true }),
      onAnswer: () => playWord(w.a),
    }, [trOpt(w.tr, true), ...wrong.map((t) => trOpt(t, false))]);
  });
};
// похожие слова банка (одинаковая длина, общие буквы)
function similarWords(w, pool, n) {
  const L = new Set([...w.skel]);
  const sc = (x) => [...x.skel].filter((c) => L.has(c)).length - Math.abs(x.len - w.len) * 1.5;
  return pool.filter((x) => x !== w && x.skel !== w.skel && x.tr !== w.tr).map((x) => [sc(x) + Math.random(), x]).sort((a, b) => b[0] - a[0]).slice(0, n).map((x) => x[1]);
}
function mutateAr(d) {
  const swaps = [[M.FATHA, M.KASRA], [M.KASRA, M.DAMMA], [M.DAMMA, M.FATHA], [M.FATHA, M.DAMMA]];
  const cs = clusters(d);
  for (let t = 0; t < 12; t++) {
    const i = Math.floor(Math.random() * cs.length);
    const [a, b] = pick(swaps);
    if (cs[i].m.includes(a)) {
      const c2 = cs.map((c, j) => (j === i ? c.b + c.m.replace(a, b) : c.b + c.m)).join("");
      if (c2 !== d) return c2;
    }
  }
  return null;
}
G.listenWord = (o) => {
  const pool = lessonWords({ level: o.level || "full", need: o.need || "", avoid: o.avoid || "", maxLen: o.maxLen || 6 }, o.n);
  return (o.words || sample(pool.slice(0, 250), o.n)).map((w) => {
    preloadWord(w.a);
    const sim = similarWords(w, o.words ? words({ level: w.L, maxLen: 7 }) : pool, 3);
    const mut = mutateAr(w.d);
    const opts = [arOpt(w.d, true), ...(mut ? [arOpt(mut, false)] : []), ...sim.slice(0, mut ? 2 : 3).map((x) => arOpt(x.d, false))];
    return withOpts({ kind: "listenWord", key: "W:" + (o.level || w.L), word: w, layout: "list-ar",
      play: () => playWord(w.a),
      prompt: () => promptText("Какое слово прочитал чтец?", "Можно слушать сколько угодно раз."),
      after: () => wordChip(w, { showTr: true }),
    }, opts);
  });
};
G.match = (o) => {
  let pairs;
  if (o.mode === "syllable") {
    const ids = sample(SYL_LETTERS, 5);
    pairs = ids.map((id) => { const v = pick(["fatha", "kasra", "damma"]); return [sylText(id, v), sylTr(id, v)]; });
  } else {
    const pool = lessonWords({ level: o.level || "damma", maxLen: 5 }, 5);
    const seen = new Set();
    pairs = shuffle(pool.slice(0, 200)).filter((w) => !seen.has(w.tr) && seen.add(w.tr)).slice(0, 5).map((w) => [w.d, w.tr, w]);
  }
  return [{ kind: "match", key: o.mode === "syllable" ? "V:mix" : "W:" + (o.level || "damma"),
    prompt: () => promptText("Соедините пары", "Нажмите на арабский текст, затем на его чтение."),
    custom: (api) => matchBoard(pairs, api) }];
};
function matchBoard(pairs, api) {
  let sel = null, mistakes = 0, left = pairs.length;
  const L = shuffle(pairs.map((p, i) => ({ i, p }))), R = shuffle(pairs.map((p, i) => ({ i, p })));
  const colL = h("div.match-col"), colR = h("div.match-col");
  const btn = (side, it) => {
    const b = h("button.match-btn", { type: "button" }, side === "L" ? ar(it.p[0]) : tr(it.p[1]));
    b.addEventListener("click", () => {
      if (b.classList.contains("done")) return;
      if (!sel || sel.side === side) { sel?.b.classList.remove("sel"); sel = { side, it, b }; b.classList.add("sel"); if (side === "L" && it.p[2]) playWord(it.p[2].a); return; }
      if (sel.it.i === it.i) {
        [sel.b, b].forEach((x) => { x.classList.remove("sel"); x.classList.add("done"); });
        const lw = side === "L" ? it.p[2] : sel.it.p[2];
        if (side === "R" && lw) playWord(lw.a);
        sel = null; left--;
        if (!left) api.answer(mistakes <= 1, { silent: false });
      } else {
        mistakes++;
        [sel.b, b].forEach((x) => { x.classList.add("shake"); setTimeout(() => x.classList.remove("shake", "sel"), 450); });
        sel = null;
      }
    });
    return b;
  };
  L.forEach((it) => colL.append(btn("L", it)));
  R.forEach((it) => colR.append(btn("R", it)));
  return h("div.match", null, colL, colR);
}

// ================= Правила таджвида (по аятам учебных сур) =================
let IDX = null;
export async function ruleIndex() {
  if (IDX) return IDX;
  const out = [];
  const surahs = await Promise.all(SURAH_PATH.map((s) => loadSurah(s).then((d) => [s, d])));
  for (const [s, d] of surahs) d.v.forEach((v, ai) => v[0].forEach((w, wi) => out.push({ s, a: ai + 1, wi, w, words: v[0], codes: rulesIn(w) })));
  IDX = out;
  return out;
}
const wkey = (x, wi = x.wi) => `${String(x.s).padStart(3, "0")}_${String(x.a).padStart(3, "0")}_${String(wi + 1).padStart(3, "0")}`;
const ref = (x) => h("span.ref", null, `${x.s}:${x.a}`);

G.ruleSpot = async (o) => {
  const idx = await ruleIndex();
  // аяты, где правило есть, но не во всех словах, и аят не слишком длинный
  const verses = new Map();
  for (const x of idx) { const k = x.s + ":" + x.a; if (!verses.has(k)) verses.set(k, { s: x.s, a: x.a, words: x.words }); }
  const cand = [...verses.values()].filter((v) => {
    if (o.surah && v.s !== o.surah) return false;
    const hits = v.words.filter((w) => rulesIn(w).includes(o.code)).length;
    return hits >= 1 && hits < v.words.length && v.words.length >= 3 && v.words.length <= (o.surah ? 14 : 9);
  });
  return sample(cand, o.n).map((v) => ({ kind: "ruleSpot", key: "R:" + o.code,
    prompt: () => promptText(`Нажмите на слово, где есть **«${RULES[o.code].name}»**`, RULES[o.code].short),
    explain: RULES[o.code].text,
    custom: (api) => {
      const box = h("div.verse-tap", { dir: "rtl" });
      v.words.forEach((w, wi) => {
        const has = rulesIn(w).includes(o.code);
        const b = h("button.vt-word", { type: "button" }, ar(stripStops(plain(w))));
        b.addEventListener("click", () => {
          if (box.classList.contains("answered")) return;
          box.classList.add("answered");
          v.words.forEach((ww, j) => {
            const bb = box.children[j];
            if (rulesIn(ww).includes(o.code)) { bb.replaceChildren(ar(stripStops(onlyRule(ww, o.code)))); bb.classList.add("hit"); }
          });
          if (!has) b.classList.add("miss");
          playWord(wkey(v, wi));
          api.answer(has);
        });
        box.append(b);
      });
      return h("div", null, box, h("div.verse-ref", null, `Сура ${v.s}, аят ${v.a}`));
    } }));
};
// показываем цветом только одно правило
const onlyRule = (w, code) => parseMarkup(w).map(([t, c]) => (c === code ? `[${c}${t}]` : t)).join("");

const pickRuleWords = async (codes, n) => {
  const idx = await ruleIndex();
  const out = [];
  const avail = codes.filter((c) => idx.some((x) => x.codes.includes(c)) || rareExamples(c).length);
  const per = cycle(avail, n);
  for (const c of per) {
    let cand = idx.filter((x) => x.codes.includes(c));
    if (cand.length < 6) cand = [...cand, ...rareExamples(c)];
    const x = pick(cand);
    if (x) out.push({ x, c });
  }
  return out;
};
// слово с выделенным фрагментом правила (нейтральная подсветка) + соседнее слово для контекста
function ruleSnippet(x, code, { colors = false } = {}) {
  const box = h("div.snippet", { dir: "rtl" });
  const next = x.words[x.wi + 1];
  const prev = x.words[x.wi - 1];
  const cross = ["f", "i", "d", "D", "u", "F", "h", "j", "k"].includes(code);
  const seq = [];
  if (!cross && prev && Math.random() < 0.3) seq.push([prev, x.wi - 1, false]);
  seq.push([x.w, x.wi, true]);
  if (cross && next) seq.push([next, x.wi + 1, true]);
  for (const [w, wi, main] of seq) {
    const el = arParts(h("span.sn-word"), parseMarkup(stripStops(w)).map(([t, c]) => [t, c === code && main ? (colors ? `tj r-${c}` : "hl") : ""]));
    const b = h("button.sn-btn", { type: "button", "aria-label": "Послушать" }, h("span.ar", { dir: "rtl", lang: "ar" }, el));
    b.addEventListener("click", () => playWord(wkey(x, wi)));
    box.append(b);
  }
  return h("div.q-center", null, box, h("div.verse-ref", null, `Сура ${x.s}, аят ${x.a}`));
}
G.ruleName = async (o) => {
  const items = await pickRuleWords(o.codes, o.n);
  return items.map(({ x, c }) => withOpts({ kind: "ruleName", key: "R:" + c, layout: "list",
    prompt: () => h("div", null, promptText("Какое правило в выделенном месте?"), ruleSnippet(x, c)),
    explain: RULES[c].text, after: () => ruleSnippet(x, c, { colors: true }),
  }, [textOpt(RULES[c].name, true), ...sample(o.codes.filter((k) => k !== c && RULES[k].name !== RULES[c].name), 3).map((k) => textOpt(RULES[k].name, false))]));
};
const COUNT = { n: "2 хараката", p: "2, 4 или 6", o: "4–5 харакатов", u: "4–5 харакатов", x: "6 харакатов" };
G.maddCount = async (o) => {
  const items = await pickRuleWords(["n", "p", "o", "u", "x"], o.n);
  return items.map(({ x, c }) => withOpts({ kind: "maddCount", key: "R:" + c, layout: "grid2",
    prompt: () => h("div", null, promptText("Сколько тянуть выделенный мадд?"), ruleSnippet(x, c)),
    explain: `${RULES[c].name}: ${RULES[c].short}. ${RULES[c].text}`, after: () => ruleSnippet(x, c, { colors: true }),
  }, uniq(Object.values(COUNT)).map((t) => textOpt(t, t === COUNT[c]))));
};
const THROAT = "ءأإؤئهعحغخ";
G.nunRule = async (o) => {
  const idx = await ruleIndex();
  const NAMES = { izhar: "Изхар", d: "Идгам", D: "Идгам", i: "Икляб", f: "Ихфа" };
  const pools = { izhar: [], d: [], D: [], i: [], f: [] };
  for (const x of idx) {
    const next = x.words[x.wi + 1];
    if (!next) continue;
    const p = plain(x.w).replace(/[ۖ-ۜ]/g, "");
    // нун сакина (в мадинском письме перед идгамом/ихфой — без сукуна) или танвин (при икляб — огласовка с маленькой «м»)
    const endsNun = /ن[ۡۢ]?$/.test(p) || /[ًٌٍ]ا?$/.test(p) || /[َ-ِ][ۭۢ]ا?$/.test(p);
    for (const c of ["d", "D", "i", "f"]) if (endsNun && parseMarkup(x.w).some(([, cc], i, arr) => cc === c && i === arr.length - 1)) pools[c].push(x);
    if (endsNun && THROAT.includes(plain(next)[0])) pools.izhar.push(x);
  }
  let kinds = o.only?.includes("izhar") ? ["izhar", "izhar", pick(["d", "i", "f", "D"])] : ["izhar", "d", "D", "i", "f"];
  return cycle(kinds, o.n).map((k) => {
    const x = pick(pools[k]);
    if (!x) return null;
    const name = NAMES[k];
    const box = () => {
      const b = h("div.snippet", { dir: "rtl" });
      [[x.w, x.wi], [x.words[x.wi + 1], x.wi + 1]].forEach(([w, wi], j) => {
        const parts = parseMarkup(stripStops(w));
        const el = arParts(h("span.sn-word"), parts.map(([t], i) => [t, (j === 0 && i === parts.length - 1) || (j === 1 && i === 0 && k !== "izhar") ? "hl" : ""]));
        const btn = h("button.sn-btn", { type: "button" }, h("span.ar", { dir: "rtl", lang: "ar" }, el));
        btn.addEventListener("click", () => playWord(wkey(x, wi)));
        b.append(btn);
      });
      return h("div.q-center", null, b, h("div.verse-ref", null, `Сура ${x.s}, аят ${x.a}`));
    };
    const why = { izhar: "После нун сакины или танвина — горловая буква: читаем ясно.", d: RULES.d.text, D: RULES.D.text, i: RULES.i.text, f: RULES.f.text }[k];
    return withOpts({ kind: "nunRule", key: "R:" + (k === "izhar" ? "izhar" : k), layout: "grid2",
      prompt: () => h("div", null, promptText("Какое правило нун сакины / танвина?", "Смотрите на следующую букву."), box()),
      explain: why,
    }, ["Изхар", "Идгам", "Икляб", "Ихфа"].map((t) => textOpt(t, t === name)));
  }).filter(Boolean);
};
G.sunMoon = (o) => {
  const pool = words({ level: "full", maxLen: 7, filter: (w) => /^ٱل/.test(w.d) && w.f.includes("w") });
  return sample(pool.slice(0, 400), o.n).map((w) => {
    const cs = clusters(w.d);
    const lamSukun = cs[1] && (cs[1].m.includes(M.SUKUN_Q) || cs[1].m.includes(M.SUKUN));
    const solar = !lamSukun && cs[2]?.m.includes(M.SHADDA);
    return withOpts({ kind: "sunMoon", key: "R:l", layout: "list",
      prompt: () => h("div.q-center", null, promptText("Читается ли лям артикля?"), ar(w.d, { cls: "q-word" })),
      explain: solar ? "Солнечная буква: лям не читается, следующая буква удваивается (шадда)." : "Лунная буква: у лям сукун — она читается.",
      after: () => wordChip(w, { showTr: true }),
    }, [textOpt("Да — лунная буква", !solar), textOpt("Нет — солнечная буква", solar)]);
  });
};
G.allahLam = async (o) => {
  const idx = await ruleIndex();
  const cand = idx.filter((x) => analyze(plain(x.w)).f.has("allah"));
  // лям тяжёлая после фатхи/даммы и в начале чтения, лёгкая после касры (танвин перед васлем даёт касру)
  const LIGHT = ["ِ", "ً", "ٌ", "ٍ"];
  const verdict = (x) => {
    const cs = clusters(plain(x.w));
    const li = cs.findIndex((c) => c.b === "ل" && c.m.includes(M.SHADDA));
    const own = cs.slice(0, li).map((c) => c.m).join("").match(/[ً-ِ]/g);
    if (own) return LIGHT.includes(own.pop()) ? "light" : "heavy";
    if (x.wi === 0) return "heavy";
    const prev = plain(x.words[x.wi - 1]).match(/[ً-ِ]/g);
    if (!prev) return null;
    return LIGHT.includes(prev.pop()) ? "light" : "heavy";
  };
  const list = cand.map((x) => [x, verdict(x)]).filter(([, v]) => v);
  const heavy = list.filter(([, v]) => v === "heavy"), light = list.filter(([, v]) => v === "light");
  return Array.from({ length: o.n }, (_, i) => {
    const [x, v] = pick(i % 2 ? heavy : light) || pick(list);
    const snippet = () => {
      const b = h("div.snippet", { dir: "rtl" });
      const seq = x.wi > 0 ? [[x.words[x.wi - 1], x.wi - 1], [x.w, x.wi]] : [[x.w, x.wi]];
      seq.forEach(([w, wi]) => { const btn = h("button.sn-btn", { type: "button" }, ar(stripStops(plain(w)))); btn.addEventListener("click", () => playWord(wkey(x, wi))); b.append(btn); });
      return h("div.q-center", null, b, h("div.verse-ref", null, `Сура ${x.s}, аят ${x.a}`));
    };
    return withOpts({ kind: "allahLam", key: "R:allah", layout: "grid2",
      prompt: () => h("div", null, promptText("Какая лям в имени Аллаха?", "Смотрите на гласную перед словом."), snippet()),
      explain: v === "heavy" ? "Перед именем Аллаха фатха или дамма (или начало чтения) — лям тяжёлая." : "Перед именем Аллаха касра — лям лёгкая.",
    }, [textOpt("Тяжёлая", v === "heavy"), textOpt("Лёгкая", v === "light")]);
  });
};
// Ра: определяем только для ра не в конце слова (при слитном чтении)
function raVerdict(d) {
  const cs = clusters(d);
  const HV = new Set(["خ", "ص", "ض", "غ", "ط", "ق", "ظ"]);
  const res = [];
  cs.forEach((c, i) => {
    if (c.b !== "ر" || i === cs.length - 1) return;
    const m = c.m;
    if (/[ًٌَُ]/.test(m)) return res.push([i, "heavy"]);
    if (/[ٍِ]/.test(m)) return res.push([i, "light"]);
    if (/[ْۡ]/.test(m)) {
      const p = cs[i - 1];
      if (!p) return;
      if (p.b === "ٱ") return res.push([i, "heavy"]);
      if (/[َُ]/.test(p.m)) return res.push([i, "heavy"]);
      if (/ِ/.test(p.m)) { const n = cs[i + 1]; return res.push([i, n && HV.has(n.b) && !/ِ/.test(n.m) ? "heavy" : "light"]); }
    }
  });
  return res.length === 1 ? res[0] : null;
}
G.raRule = (o) => {
  const pool = words({ level: "full", maxLen: 7, filter: (w) => w.d.includes("ر") && !!raVerdict(w.d) });
  const heavy = pool.filter((w) => raVerdict(w.d)[1] === "heavy"), light = pool.filter((w) => raVerdict(w.d)[1] === "light");
  return Array.from({ length: o.n }, (_, i) => {
    const w = pick(i % 2 ? light : heavy);
    const [ri, v] = raVerdict(w.d);
    const cs = clusters(w.d);
    const view = () => arParts(h("span.ar.q-word", { dir: "rtl", lang: "ar" }), cs.map((c, j) => [c.b + c.m, j === ri ? "hl" : ""]));
    const c = cs[ri];
    const why = /[ًٌَُ]/.test(c.m) ? "Ро с фатхой или даммой — тяжёлая."
      : /[ٍِ]/.test(c.m) ? "Ро с касрой — лёгкая."
      : v === "heavy" ? "Ро с сукуном после фатхи/даммы, после хамзат-уль-васль или перед тяжёлой буквой — тяжёлая." : "Ро с сукуном после касры — лёгкая.";
    return withOpts({ kind: "raRule", key: "R:ra", layout: "grid2",
      prompt: () => h("div.q-center", null, promptText("Выделенная ро — тяжёлая или лёгкая?"), view()),
      explain: why, after: () => wordChip(w, { showTr: true }),
    }, [textOpt("Тяжёлая", v === "heavy"), textOpt("Лёгкая", v === "light")]);
  });
};
// Остановка: как читается слово на вакфе
function waqfTr(w) {
  const t = w.tr;
  const cs = clusters(w.d);
  const last = [...cs].reverse().find((c) => c.b !== "ا" || c.m);
  if (!last) return null;
  if (last.b === "ة") return t.replace(/т[аиу]н?$/, "хӀ");
  if (last.m.includes(M.FATHATAN)) return t.replace(/([ао])н$/, "$1$1");
  if (/[ٌٍ]/.test(last.m)) return t.replace(/[уиы]н$/, "");
  if (/[َُِ]/.test(last.m) && !last.m.includes(M.SHADDA)) return t.replace(/[аиуоы]$/, "");
  return null;
}
G.waqfForm = (o) => {
  const pool = words({ level: "shadda", minLen: 3, maxLen: 6, filter: (w) => { const s = waqfTr(w); return s && s !== w.tr; } });
  return sample(pool.slice(0, 600), o.n).map((w) => {
    const stop = waqfTr(w);
    const wrong = uniq([w.tr, stop.endsWith("хӀ") ? w.tr.replace(/н$/, "") : stop + (/(аа|оо)$/.test(stop) ? "н" : "у"), w.tr.replace(/[аиуоы]н$/, (m) => ("оы".includes(m[0]) ? "о" : "а"))]).filter((x) => x !== stop).slice(0, 2);
    return withOpts({ kind: "waqfForm", key: "S:waqf", layout: "list",
      prompt: () => h("div.q-center", null, promptText("Как прочитать слово, **остановившись** на нём?"), ar(w.d, { cls: "q-word" })),
      explain: "На остановке последняя огласовка уходит: фатхатан → «аа», та марбута → «хӀ», остальное → сукун.",
    }, [trOpt(stop, true), ...wrong.map((t) => trOpt(t, false))]);
  });
};
const STOPS = [["ۘ", "Обязательная остановка"], ["ۙ", "Здесь не останавливаться"], ["ۚ", "Остановка и продолжение равны"], ["ۖ", "Лучше продолжить"], ["ۗ", "Лучше остановиться"], ["ۛ", "Остановиться на одном из двух мест"]];
G.stopSign = (o) => cycle(STOPS, o.n).map(([s, meaning]) => withOpts({ kind: "stopSign", key: "S:" + s, layout: "list",
  prompt: () => h("div.q-center", null, promptText("Что означает этот знак?"), ar("ـ" + s + "ـ", { cls: "q-big stop-sign" })),
}, [textOpt(meaning, true), ...sample(STOPS.filter((x) => x[0] !== s), 3).map((x) => textOpt(x[1], false))]));

/** Строит вопросы для шага-упражнения урока. */
export async function build(step, lesson) {
  const g = G[step.k];
  if (!g) { console.warn("нет генератора", step.k); return []; }
  try { return (await g(step, lesson)).filter(Boolean); }
  catch (e) { console.error("генератор", step.k, e); return []; }
}
/** Вопрос на понимание из описания урока. */
export function quiz(step) {
  const [right, ...wrong] = step.a;
  return withOpts({ kind: "quiz", key: null, layout: "list", prompt: () => promptText(step.q), explain: step.why },
    [{ node: () => h("span", null, rich(right)), correct: true, label: right }, ...wrong.map((t) => ({ node: () => h("span", null, rich(t)), correct: false, label: t }))]);
}
export { G as GENERATORS };

/** Превращает ключ повторения в шаг-упражнение («Практика», разминка в начале урока). */
export function stepForKey(key) {
  const [t, v] = key.split(":");
  if (t === "L") return { t: "ex", k: pick1(v === "alif" ? ["letterName", "letterPick"] : ["letterName", "letterPick", "listenFirst"]), n: 1, letters: [v] }; // слов «на алиф» нет
  if (t === "M") return { t: "ex", k: pick1(["pointPick", "zonePick"]), n: 1, letters: [v] };
  if (t === "H") return { t: "ex", k: "heavy", n: 1 };
  if (t === "F") return { t: "ex", k: "formPick", n: 1 };
  if (t === "V") return { t: "ex", k: "syllable", n: 1, vowels: v === "mix" ? ["fatha", "kasra", "damma"] : [v] };
  if (t === "W") return { t: "ex", k: pick1(["readWord", "listenWord"]), n: 1, level: v };
  if (t === "P") return { t: "ex", k: "pairListen", n: 1, pairs: [v.split("-")] };
  if (t === "R") {
    if (v === "izhar") return { t: "ex", k: "nunRule", n: 1 };
    if (v === "allah") return { t: "ex", k: "allahLam", n: 1 };
    if (v === "ra") return { t: "ex", k: "raRule", n: 1 };
    if (v === "l") return { t: "ex", k: "sunMoon", n: 1 };
    if (["n", "p", "o", "u", "x"].includes(v) && Math.random() < 0.5) return { t: "ex", k: "maddCount", n: 1 };
    return { t: "ex", k: "ruleSpot", n: 1, code: v };
  }
  if (t === "S") return v === "waqf" ? { t: "ex", k: "waqfForm", n: 1 } : { t: "ex", k: "stopSign", n: 1 };
  return null;
}
const pick1 = (a) => a[Math.floor(Math.random() * a.length)];
