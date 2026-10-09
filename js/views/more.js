// «Ещё»: настройки, справочники, данные, об источниках.
import { h, ar, icon, toast, confirmBox, SIZES, AR_FONTS, arFont, keep } from "../ui.js";
import { store, backupDone } from "../store.js";
import { RECITERS } from "../data.js";
import { go, installApp, checkUpdate } from "../app.js";
import { isInstalled, onInstallChange } from "../install.js";
import { canFullscreen, wantFullscreen, setFullscreen } from "../fullscreen.js";
import { APP_VERSION, CHANGELOG, CONTACT } from "../version.js";
import { devBanner, feedbackButton, openFeedback } from "../feedback.js";
import { track, metrikaAvailable } from "../metrika.js";

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
// обращение и род меняют тексты всего приложения — перерисовываем экран
const profile = (k) => (v) => { store.set((s) => { s.profile[k] = v; }); window.dispatchEvent(new Event("hashchange")); };
/** «Полный экран»: переключатель сразу разворачивает или сворачивает приложение. */
function fullscreenToggle() {
  if (!canFullscreen()) return null;
  const label = "Полный экран";
  const t = h("button.switch", { type: "button", role: "switch", "data-fs-switch": true, "aria-label": label }, h("i"));
  const sync = () => { const on = wantFullscreen(); t.classList.toggle("on", on); t.setAttribute("aria-checked", on ? "true" : "false"); };
  t.addEventListener("click", () => { setFullscreen(!wantFullscreen()); sync(); });
  sync();
  return h("div.set-row", null, h("div", null, h("span.set-label", null, label), h("small.muted", null, "Без адресной строки и панелей браузера: приложение разворачивается при первом нажатии. Выйти — «назад» на телефоне или Esc на компьютере.")), t);
}

/** «Установить приложение»: кнопка есть, пока приложение не установлено, и исчезает сразу после установки. */
function installLink() {
  if (isInstalled()) return null;
  const b = h("button.more-link.install", { type: "button", onclick: installApp }, h("span.ml-ic", null, icon("down", { size: 22 })), h("div", null, h("b", null, "Установить приложение"), h("small.muted", null, "Отдельное окно на рабочем столе или телефоне, работает без интернета")), icon("right", { size: 18 }));
  const off = onInstallChange(() => { if (!b.isConnected) off(); else if (isInstalled()) { b.remove(); off(); } });
  return b;
}

export function MoreView() {
  const s = store.get();
  const preview = ar("بِسۡمِ [wٱ]للَّهِ", { cls: "size-preview" });
  const sizeRow = (key, title, sub, extra) => {
    const { min, max, step } = SIZES[key];
    const val = h("b.sp-val", null, Math.round((s.settings[key] || 1) * 100) + "%");
    const slider = h("input", { type: "range", min, max, step, value: s.settings[key] || 1, "aria-label": title });
    slider.addEventListener("input", () => { store.set((st) => { st.settings[key] = +slider.value; }); val.textContent = Math.round(slider.value * 100) + "%"; });
    return h("div.set-row.col", null, h("div.set-row", null, h("div", null, h("span.set-label", null, title), h("small.muted", null, sub)), val), slider, extra);
  };
  const name = h("input.text-in", { type: "text", value: s.profile.name, placeholder: "Как к вам обращаться", maxlength: "30" });
  name.addEventListener("change", () => store.set((st) => { st.profile.name = name.value.trim(); }));

  const fileIn = h("input", { type: "file", accept: "application/json,.json", hidden: true });
  fileIn.addEventListener("change", async () => {
    const f = fileIn.files[0]; if (!f) return;
    try { store.import(await f.text()); toast("Прогресс загружен ✓"); go("/"); } catch (e) { toast("Не удалось загрузить: " + e.message); }
  });

  return h("div.page.more", null,
    h("header.page-head", null, h("h1", null, "Ещё")),
    h("a.more-link.author-link", { href: "#/author" }, h("span.ml-ic", null, icon("chat", { size: 22 })), h("div", null, h("b", null, "Послание от разработчика"), h("small.muted", null, "Как и зачем появился TanWin — слово автора")), icon("right", { size: 18 })),
    installLink(),
    h("a.more-link.thanks-link", { href: "#/thanks" }, h("span.ml-ic", null, icon("heart", { size: 22, fill: true, sw: 1 })), h("div", null, h("b", null, "Благодарности"), h("small.muted", null, "Люди, благодаря пожертвованиям которых состоялся проект")), icon("right", { size: 18 })),
    CONTACT.whatsapp ? h("button.more-link.contact-link", { type: "button", onclick: openFeedback }, h("span.ml-ic", null, icon("chat", { size: 22 })), h("div", null, h("b", null, "Написать автору в WhatsApp"), h("small.muted", null, "Нашли ошибку или неточность? Есть идея? Напишите — версия и экран подставятся сами")), icon("right", { size: 18 })) : null,
    h("div.more-links", null,
      link("#/bookmarks", "bookmark", "Закладки и цель чтения", "Сохранённые места в Коране, обратный отсчёт страниц"),
      link("#/method", "sparkle", "Методика", "Как устроено обучение и почему оно работает"),
      link("#/letters", "list", "Алфавит", "Все 28 букв: звуки, формы, махраджи"),
      link("#/rules", "palette", "Правила таджвида", "Цвета мусхафа и примеры из Корана")),
    h("section.card.settings.about-app", null,
      h("h3", null, "О приложении"),
      h("div.set-row", null, h("div", null, h("span.set-label", null, `Версия ${APP_VERSION}`), h("small.muted", null, `${CHANGELOG[0].title} · приложение в активной разработке`)), h("a.btn.secondary", { href: "#/changelog" }, icon("list", { size: 18 }), "Версии")),
      h("div.set-row", null, h("div", null, h("span.set-label", null, "Обновления приходят сами"), h("small.muted", null, "Если приложение зависает или что-то не открывается — включите или выключите VPN и проверьте обновление")), h("button.btn.secondary", { type: "button", onclick: checkUpdate }, icon("repeat", { size: 18 }), "Проверить")),
      h("div.set-row", null, h("div", null, h("span.set-label", null, "Нашли ошибку?"), h("small.muted", null, "Напишите автору — укажем версию и экран автоматически")), feedbackButton())),
    h("section.card.settings", null,
      h("h3", null, "Профиль и цель"),
      h("div.set-row", null, h("span.set-label", null, "Имя"), name),
      seg("Обращение", [["vy", keep("На «вы»")], ["ty", keep("На «ты»")]], s.profile.form || "vy", profile("form")),
      seg("Кто учится", [["", "Не указано"], ["m", "Ученик"], ["f", "Ученица"]], s.profile.gender || "", profile("gender")),
      h("small.muted.set-note", null, keep("От этого зависят слова в уроках: «прочитал» или «прочитала», «нажмите» или «нажми».")),
      seg("Цель дня", [[10, "5 мин"], [30, "10 мин"], [50, "15 мин"], [80, "25 мин"]], s.profile.goal, (v) => store.set((st) => { st.profile.goal = v; }))),
    h("section.card.settings", null,
      h("h3", null, "Вид"),
      seg("Тема", [["auto", "Как на устройстве"], ["light", "Светлая"], ["dark", "Тёмная"]], s.settings.theme, set("theme")),
      fullscreenToggle(),
      seg("Арабский шрифт", Object.entries(AR_FONTS).map(([k, f]) => [k, f.name]), arFont(), set("arFont")),
      h("small.muted.set-note", null, "«Мадина» — шрифт печатного мусхафа Мадины (стоит по умолчанию). «Амири» — прежний шрифт приложения. «Шехерезада» — широкие просветы между знаками. «Ното» — простой и ровный. Менять можно и при чтении — кнопка «Aa»."),
      sizeRow("arScale", "Размер арабского текста", "Можно менять и прямо в уроке или при чтении — кнопка «Aa»", preview),
      sizeRow("uiScale", "Размер остального текста", "Русский текст, кнопки и меню"),
      toggle("Цвета таджвида", "tajweed", "Раскрашивать правила в мусхафе. Переключается и при чтении — кнопка «Aa»"),
      toggle("Перевод смыслов", "translation", "Перевод Э. Кулиева в режиме «По аятам»")),
    h("section.card.settings", null,
      h("h3", null, "Звук и подсказки"),
      seg("Чтец аятов", Object.entries(RECITERS).map(([k, r]) => [k, r.name.split(" ").slice(-1)[0]]), s.settings.reciter, set("reciter")),
      h("small.muted.set-note", null, "Хусари — обучающее медленное чтение (рекомендуем для учёбы). Афаси — обычный темп. Слова отдельно всегда озвучены чтецом Quran.com."),
      seg("Транскрипция", [["show", "Показывать"], ["tap", "По нажатию"], ["hide", "Скрыть"]], s.settings.translit, set("translit")),
      h("small.muted.set-note", null, "Русские буквы под словами в карточках теории и в окне буквы. «По нажатию» — появляются, когда вы нажмёте на слово. Транскрипция — это костыль: чем раньше вы будете читать по арабскому тексту, тем лучше. Рекомендуем «По нажатию»."),
      toggle("Звуки ответов", "sfx")),
    h("section.card.settings", null,
      h("h3", null, "Обучение"),
      toggle("Открыть все уроки", "unlockAll", "Все уроки и суры пути доступны сразу. Пригодится, если прогресс потерялся (например, после очистки данных браузера): откройте все уроки и продолжайте с того места, где остановились.")),
    h("section.card.settings", null,
      h("h3", null, "Данные"),
      h("p.muted.small", null, "Прогресс хранится только на этом устройстве, без регистрации. Чтобы перенести его на другое устройство, сохраните файл и загрузите его там."),
      h("div.row.wrap.gap", null,
        h("button.btn.secondary", { type: "button", onclick: saveProgressFile }, icon("down", { size: 18 }), "Сохранить прогресс"),
        h("button.btn.secondary", { type: "button", onclick: () => fileIn.click() }, icon("up", { size: 18 }), "Загрузить"), fileIn,
        h("button.btn.danger", { type: "button", onclick: async () => { if (await confirmBox("Сбросить весь прогресс?", "Это действие нельзя отменить. Сначала можно сохранить прогресс в файл.", "Сбросить", "Отмена")) { store.reset(); go("/welcome"); } } }, icon("trash", { size: 18 }), "Сбросить")),
      metrikaAvailable() ? h("div.set-sep", null, toggle("Анонимная статистика", "analytics", "Показывает автору, сколько людей учится и где бывает трудно. Через Яндекс.Метрику передаются только открытые экраны, пройденные уроки и то, кто учится — ученик или ученица. Имя не передаётся.")) : null),
    h("section.card.about", null,
      h("h3", null, "Об источниках"),
      h("p", null, "Текст Корана (мусхаф Мадины, риваят Хафса от Асыма), разметка таджвида, пословное аудио и тайминги слов — ", h("a", { href: "https://quran.com", target: "_blank", rel: "noopener" }, "Quran.com"), ". Аудио аятов: Махмуд Халиль аль-Хусари (обучающее чтение) и Мишари Рашид аль-Афаси — ", h("a", { href: "https://everyayah.com", target: "_blank", rel: "noopener" }, "EveryAyah"), " и Quran.com. Озвучка отдельных букв и слогов — записи букваря «Каида Нурания» из проекта ", h("a", { href: "https://github.com/ibr7h/al-qaida-nooraniyya", target: "_blank", rel: "noopener" }, "al-qaida-nooraniyya"), ". Перевод смыслов — Эльмир Кулиев."),
      h("p", null, "Шрифты: Amiri Quran (Khaled Hosny), Scheherazade New (SIL Global), Noto Naskh Arabic (Google) и Nunito — лицензия SIL Open Font License; KFGQPC Uthmanic Script Hafs — Комплекс имени короля Фахда по изданию Священного Корана (Медина)."),
      h("p.muted.small", null, "Приложение не заменяет учителя. Чтение Корана традиционно передаётся из уст в уста (талакки): когда пройдёте путь, прочитайте знающему человеку — он поправит тонкости произношения.")));
}
const link = (href, ic, t, sub) => h("a.more-link", { href }, h("span.ml-ic", null, icon(ic, { size: 22 })), h("div", null, h("b", null, t), h("small.muted", null, sub)), icon("right", { size: 18 }));
/** Сохраняет прогресс в файл: на телефоне — через «Поделиться» (в «Файлы», мессенджер, почту), на компьютере — загрузкой. */
export async function saveProgressFile() {
  const name = `tanwin-progress-${new Date().toISOString().slice(0, 10)}.json`;
  const text = store.export();
  const file = typeof File === "function" ? new File([text], name, { type: "application/json" }) : null;
  const mobile = matchMedia("(pointer: coarse)").matches;
  if (mobile && file && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Прогресс TanWin" }); backupDone(); track("backup_saved"); toast("Копия прогресса сохранена ✓"); return; }
    catch (e) { if (e?.name === "AbortError") return; }
  }
  download(name, text);
  backupDone();
  track("backup_saved");
  toast("Файл с прогрессом сохранён в «Загрузки» ✓");
}
function download(name, text) {
  const a = h("a", { href: URL.createObjectURL(new Blob([text], { type: "application/json" })), download: name });
  document.body.append(a); a.click(); a.remove();
}
