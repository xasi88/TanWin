// «Ещё»: настройки, справочники, данные, об источниках.
import { h, ar, icon, toast, confirmBox } from "../ui.js";
import { store } from "../store.js";
import { RECITERS } from "../data.js";
import { go, installApp } from "../app.js";
import { isInstalled } from "../install.js";
import { APP_VERSION, CHANGELOG } from "../version.js";
import { devBanner, feedbackButton } from "../feedback.js";

function seg(label, options, value, onChange) {
  const box = h("div.seg", { role: "radiogroup", "aria-label": label });
  options.forEach(([v, t]) => {
    const b = h("button.seg-btn", { type: "button", role: "radio", "aria-checked": v === value ? "true" : "false", class: v === value ? "on" : "" }, t);
    b.addEventListener("click", () => { box.querySelectorAll("button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); onChange(v); });
    box.append(b);
  });
  return h("div.set-row", null, h("span.set-label", null, label), box);
}
function toggle(label, key, sub) {
  const on = !!store.get().settings[key];
  const t = h("button.switch", { type: "button", role: "switch", "aria-checked": on ? "true" : "false", "aria-label": label, class: on ? "on" : "" }, h("i"));
  t.addEventListener("click", () => { store.set((s) => { s.settings[key] = !s.settings[key]; }); t.classList.toggle("on"); t.setAttribute("aria-checked", t.classList.contains("on")); });
  return h("div.set-row", null, h("div", null, h("span.set-label", null, label), sub ? h("small.muted", null, sub) : null), t);
}
const set = (k) => (v) => store.set((s) => { s.settings[k] = v; });

export function MoreView() {
  const s = store.get();
  const preview = ar("بِسۡمِ [wٱ]للَّهِ", { cls: "size-preview" });
  const slider = h("input", { type: "range", min: "0.8", max: "1.6", step: "0.1", value: s.settings.arScale, "aria-label": "Размер арабского текста" });
  slider.addEventListener("input", () => store.set((st) => { st.settings.arScale = +slider.value; }));
  const name = h("input.text-in", { type: "text", value: s.profile.name, placeholder: "Как к вам обращаться", maxlength: "30" });
  name.addEventListener("change", () => store.set((st) => { st.profile.name = name.value.trim(); }));

  const fileIn = h("input", { type: "file", accept: "application/json,.json", hidden: true });
  fileIn.addEventListener("change", async () => {
    const f = fileIn.files[0]; if (!f) return;
    try { store.import(await f.text()); toast("Прогресс загружен ✓"); go("/"); } catch (e) { toast("Не удалось загрузить: " + e.message); }
  });

  return h("div.page.more", null,
    h("header.page-head", null, h("h1", null, "Ещё")),
    !isInstalled() ? h("button.more-link.install", { type: "button", onclick: installApp }, h("span.ml-ic", null, icon("down", { size: 22 })), h("div", null, h("b", null, "Установить приложение"), h("small.muted", null, "Отдельное окно на рабочем столе или телефоне, работает без интернета")), icon("right", { size: 18 })) : null,
    h("a.more-link.thanks-link", { href: "#/thanks" }, h("span.ml-ic", null, icon("heart", { size: 22, fill: true, sw: 1 })), h("div", null, h("b", null, "Благодарности"), h("small.muted", null, "Люди, благодаря пожертвованиям которых состоялся проект")), icon("right", { size: 18 })),
    h("div.more-links", null,
      link("#/method", "sparkle", "Методика", "Как устроено обучение и почему оно работает"),
      link("#/letters", "list", "Алфавит", "Все 28 букв: звуки, формы, махраджи"),
      link("#/rules", "palette", "Правила таджвида", "Цвета мусхафа и примеры из Корана")),
    h("section.card.settings.about-app", null,
      h("h3", null, "О приложении"),
      h("div.set-row", null, h("div", null, h("span.set-label", null, `Версия ${APP_VERSION}`), h("small.muted", null, `${CHANGELOG[0].title} · приложение в активной разработке`)), h("a.btn.secondary", { href: "#/changelog" }, icon("list", { size: 18 }), "Версии")),
      h("div.set-row", null, h("div", null, h("span.set-label", null, "Нашли ошибку?"), h("small.muted", null, "Напишите автору — укажем версию и экран автоматически")), feedbackButton())),
    h("section.card.settings", null,
      h("h3", null, "Профиль и цель"),
      h("div.set-row", null, h("span.set-label", null, "Имя"), name),
      seg("Цель дня", [[10, "5 мин"], [30, "10 мин"], [50, "15 мин"], [80, "25 мин"]], s.profile.goal, (v) => store.set((st) => { st.profile.goal = v; }))),
    h("section.card.settings", null,
      h("h3", null, "Вид"),
      seg("Тема", [["auto", "Авто"], ["light", "Светлая"], ["dark", "Тёмная"]], s.settings.theme, set("theme")),
      h("div.set-row.col", null, h("span.set-label", null, "Размер арабского текста"), slider, preview),
      toggle("Цвета таджвида", "tajweed", "Раскрашивать правила в мусхафе"),
      toggle("Перевод смыслов", "translation", "Перевод Э. Кулиева в режиме «По аятам»")),
    h("section.card.settings", null,
      h("h3", null, "Звук и подсказки"),
      seg("Чтец аятов", Object.entries(RECITERS).map(([k, r]) => [k, r.name.split(" ").slice(-1)[0]]), s.settings.reciter, set("reciter")),
      h("small.muted.set-note", null, "Хусари — обучающее медленное чтение (рекомендуем для учёбы). Афаси — обычный темп. Слова отдельно всегда озвучены чтецом Quran.com."),
      seg("Транскрипция", [["show", "Показывать"], ["tap", "По нажатию"], ["hide", "Скрыть"]], s.settings.translit, set("translit")),
      h("small.muted.set-note", null, "Транскрипция — это костыль: чем раньше вы будете читать по арабскому тексту, тем лучше. Рекомендуем «По нажатию»."),
      toggle("Звуки ответов", "sfx")),
    h("section.card.settings", null,
      h("h3", null, "Данные"),
      h("p.muted.small", null, "Прогресс хранится только на этом устройстве, без регистрации. Чтобы перенести его на другое устройство, сохраните файл и загрузите его там."),
      h("div.row.wrap.gap", null,
        h("button.btn.secondary", { type: "button", onclick: () => download(`tanwin-progress-${new Date().toISOString().slice(0, 10)}.json`, store.export()) }, icon("down", { size: 18 }), "Сохранить прогресс"),
        h("button.btn.secondary", { type: "button", onclick: () => fileIn.click() }, icon("up", { size: 18 }), "Загрузить"), fileIn,
        h("button.btn.danger", { type: "button", onclick: async () => { if (await confirmBox("Сбросить весь прогресс?", "Это действие нельзя отменить. Сначала можно сохранить прогресс в файл.", "Сбросить", "Отмена")) { store.reset(); go("/welcome"); } } }, icon("trash", { size: 18 }), "Сбросить"))),
    h("section.card.about", null,
      h("h3", null, "Об источниках"),
      h("p", null, "Текст Корана (мусхаф Мадины, риваят Хафса от Асыма), разметка таджвида, пословное аудио и тайминги слов — ", h("a", { href: "https://quran.com", target: "_blank", rel: "noopener" }, "Quran.com"), ". Аудио аятов: Махмуд Халиль аль-Хусари (обучающее чтение) и Мишари Рашид аль-Афаси — ", h("a", { href: "https://everyayah.com", target: "_blank", rel: "noopener" }, "EveryAyah"), " и Quran.com. Перевод смыслов — Эльмир Кулиев."),
      h("p", null, "Шрифты: Amiri Quran (Khaled Hosny) и Nunito — лицензия SIL Open Font License."),
      h("p.muted.small", null, "Приложение не заменяет учителя. Чтение Корана традиционно передаётся из уст в уста (талакки): когда пройдёте путь, прочитайте знающему человеку — он поправит тонкости произношения.")));
}
const link = (href, ic, t, sub) => h("a.more-link", { href }, h("span.ml-ic", null, icon(ic, { size: 22 })), h("div", null, h("b", null, t), h("small.muted", null, sub)), icon("right", { size: 18 }));
function download(name, text) {
  const a = h("a", { href: URL.createObjectURL(new Blob([text], { type: "application/json" })), download: name });
  document.body.append(a); a.click(); a.remove();
}
