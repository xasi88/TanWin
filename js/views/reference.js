// Справочники: алфавит, карта махраджей, правила таджвида, описание методики.
import { h, ar, icon, rich, modal, tr } from "../ui.js";
import { LETTERS, byId, POINTS, ZONES } from "../letters.js";
import { RULES, FAMILIES, LEGEND } from "../rules.js";
import { letterCard, ruleCard } from "../lesson.js";
import { diagram } from "../diagram.js";
import { mastery } from "../store.js";

export function LettersRef() {
  const info = h("div.map-info", null, h("p.muted", null, "Нажмите на точку, чтобы увидеть её буквы."));
  const map = diagram({ interactive: true, highlight: "all", onPick: (pt) => {
    const p = POINTS[pt];
    info.replaceChildren(h("b", null, p.label), h("div", null, ar(p.letters.replace(/\s*\(.*\)/, ""), { cls: "map-letters" })), h("small.muted", null, ZONES[p.zone].ru));
  } });
  return h("div.page", null,
    h("header.page-head", null, h("a.back", { href: "#/more" }, icon("left", { size: 18 }), "Ещё"), h("h1", null, "Алфавит"), h("p.muted", null, "28 букв. Нажмите на букву — звук, формы, место выхода и примеры из Корана.")),
    h("div.alpha-grid", null, ...LETTERS.map((l) => {
      const b = h("button.alpha-cell", { type: "button", style: { "--m": mastery("L:" + l.id) } }, ar(l.ch), h("span", null, l.name), tr(l.t));
      b.addEventListener("click", () => modal(letterCard(l.id), { cls: "wide" }));
      return b;
    })),
    h("div.card.map-card", null, h("h2", null, "Карта махраджей"), h("div.map-wrap", null, map, info)));
}

export function RulesRef() {
  const groups = Object.entries(FAMILIES).map(([fam, f]) => {
    const codes = LEGEND.filter((c) => RULES[c].fam === fam);
    return h("section.rules-group", null, h("h2", null, h("span.fam-dot", { style: { background: f.color } }), f.name), ...codes.map((c) => ruleCard(c)));
  });
  return h("div.page", null,
    h("header.page-head", null, h("a.back", { href: "#/more" }, icon("left", { size: 18 }), "Ещё"), h("h1", null, "Правила таджвида"),
      h("p.muted", null, "Риваят Хафса от Асыма (путь аш-Шатыбии). Цвета совпадают с раскраской в мусхафе приложения. Изхар (ясное чтение) цветом не отмечается.")),
    ...groups);
}

const METHOD = [
  ["path", "Классический порядок «Каиды Нураниййи»", "Буквы → формы → огласовки → танвин → долгие гласные → сукун → шадда → особые написания → таджвид → чтение сур. Этим путём веками учат не-арабов читать Коран: каждый шаг опирается на предыдущий."],
  ["book", "Только настоящие слова Корана", "Все слова для чтения взяты из Корана и отобраны автоматически так, чтобы в них было **только уже пройденное** (как «декодируемые тексты» в обучении чтению). Уже на уроке фатхи вы читаете {خَلَقَ}, {جَعَلَ}, {كَتَبَ}."],
  ["ear", "Живые чтецы вместо синтеза", "Каждое слово озвучено чтецом (Quran.com), аяты — шейхом Махмудом аль-Хусари в обучающем темпе и Мишари аль-Афаси. Слух настраивается на эталон, а не на компьютерный голос."],
  ["repeat", "Интервальные повторения", "Забывание идёт по «кривой Эббингауза». Повторы с растущими интервалами (1, 2, 4, 8… дней) — один из самых надёжно доказанных приёмов запоминания (мета-анализ Cepeda и соавт., 2006). Раздел «Практика» делает это автоматически."],
  ["target", "Активное припоминание", "Вопрос запоминается лучше, чем повторное чтение правила (эффект тестирования, Roediger & Karpicke, 2006). Поэтому почти каждый шаг — маленькая задача, а ошибки возвращаются в конце урока."],
  ["sparkle", "Звук + образ", "Буква, схема речевого аппарата, цвет правила и голос чтеца подаются вместе — «двойное кодирование» (Paivio; Mayer) облегчает запоминание."],
  ["trophy", "Мастерство перед движением дальше", "Проверка этапа требует 80% верных ответов с первой попытки (идея «обучения до мастерства» Б. Блума). Уже знаете тему — сдайте проверку и перескочите этап."],
  ["eye", "Транскрипция уходит", "Русская транскрипция — лишь опора. По умолчанию она скрыта до ответа, чтобы глаза учились читать арабский текст, а не русские буквы."],
  ["flame", "Понемногу каждый день", "10 минут ежедневно дают больше, чем долгие занятия раз в неделю. Цель дня и серия помогают выработать привычку."],
  ["heart", "Учитель — обязательно", "Коран передаётся из уст в уста (талакки). Тонкости — тяжесть букв, длину маддов, гунну — окончательно ставит знающий чтец. Пройдя путь, обязательно прочитайте ему."],
];
export function MethodView() {
  return h("div.page.method", null,
    h("header.page-head", null, h("a.back", { href: "#/more" }, icon("left", { size: 18 }), "Ещё"), h("h1", null, "Как устроена методика"),
      h("p.muted", null, "Путь от нуля до чтения мусхафа: 14 этапов обучения и 38 сур для чтения. Правила — по риваяту Хафса от Асыма, махраджи и сыфаты — по «Мукаддиме» имама аль-Джазари.")),
    h("div.method-list", null, ...METHOD.map(([ic, t, d], i) => h("div.card.method-item", { style: { "--i": i } }, h("span.mi-ic", null, icon(ic, { size: 24 })), h("div", null, h("h3", null, t), h("p", null, rich(d)))))),
    h("a.btn.primary", { href: "#/" }, "К пути", icon("right", { size: 18 })));
}
