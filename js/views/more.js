// «Ещё»: разделы по группам (учимся, о TanWin, связь) и об источниках. «Настройки»: отдельный экран #/settings (с 3.0).
import { h, ar, icon, toast, confirmBox, plural, SIZES, AR_FONTS, arFont, keep } from "../ui.js";
import { store, backupDone } from "../store.js";
import { RECITERS, reciterOf } from "../data.js";
import { go, installApp, checkUpdate } from "../app.js";
import { isInstalled, isStandalone, onInstallChange, whereIcon } from "../install.js";
import { canFullscreen, wantFullscreen, setFullscreen } from "../fullscreen.js";
import { APP_VERSION, CHANGELOG, CONTACT } from "../version.js";
import { feedbackButton, openFeedback } from "../feedback.js";
import { track, metrikaAvailable } from "../usage.js";
import { tourLater } from "../tour.js";

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

// «Звук без интернета» (3.0, js/sound.js): сам ли скачивать звук этапа, скачать всё, удалить скачанное
function soundSettings() {
  const on = store.get().settings.soundAuto !== false; // по умолчанию включено
  const sw = h("button.switch", { type: "button", role: "switch", "aria-checked": on ? "true" : "false", "aria-label": "Скачивать звук этапа само", class: on ? "on" : "" }, h("i"));
  sw.addEventListener("click", () => { const v = !sw.classList.contains("on"); store.set((s) => { s.settings.soundAuto = v; }); sw.classList.toggle("on", v); sw.setAttribute("aria-checked", v); });
  const info = h("small.muted.set-note", null, "Считаю…");
  const all = h("button.btn.secondary.wide", { type: "button" }, icon("down", { size: 18 }), "Скачать звук всех этапов");
  const del = h("button.btn.ghost.wide", { type: "button" }, "Удалить скачанный звук");
  let busy = false;
  const draw = async () => {
    const { unitState, savedMb } = await import("../sound.js");
    let left = 0, done = 0;
    for (let u = 1; u <= 14; u++) { const st = await unitState(u); if (st.done) done++; else left += st.mb; }
    info.textContent = `Скачано ${savedMb()} МБ, этапов со звуком: ${done} из 14.` + (left ? ` Осталось примерно ${left} МБ.` : " Скачано всё.");
    all.hidden = !left;
    del.hidden = !savedMb();
  };
  all.addEventListener("click", async () => {
    if (busy) return;
    busy = true; all.disabled = true;
    const { downloadUnit } = await import("../sound.js");
    let ok = true;
    for (let u = 1; u <= 14; u++) { info.textContent = `Скачиваю звук этапа ${u} из 14…`; ok = (await downloadUnit(u)) && ok; if (!navigator.onLine) break; }
    busy = false; all.disabled = false;
    toast(ok ? "Звук всех этапов сохранён ✓" : "Скачалось не всё. Нажмите ещё раз, когда связь будет лучше.", 5000);
    draw();
  });
  del.addEventListener("click", async () => {
    if (!(await confirmBox("Удалить скачанный звук?", "Уроки снова будут брать звук слов и аятов из интернета. Звук букв и слогов останется: он внутри приложения.", "Удалить", "Отмена"))) return;
    await (await import("../sound.js")).deleteSound();
    toast("Скачанный звук удалён", 3000);
    draw();
  });
  draw();
  return [
    h("div.set-row", null, h("div", null, h("span.set-label", null, "Скачивать звук этапа само"), h("small.muted", null, "Пока есть связь, приложение скачивает звук этапа, на котором вы сейчас. Большой этап: только по Wi-Fi.")), sw),
    h("small.muted.set-note", null, "Звук букв и слогов всегда внутри приложения. Слова и аяты приходят из интернета. Скачайте их заранее: уроки будут звучать и без связи. Звук каждого этапа можно скачать и на «Пути», под названием этапа."),
    info, all, del,
  ];
}
// обращение и род меняют тексты всего приложения: перерисовываем экран
const profile = (k) => (v) => { store.set((s) => { s.profile[k] = v; }); window.dispatchEvent(new Event("hashchange")); };
/** «Полный экран»: переключатель сразу разворачивает или сворачивает приложение. */
function fullscreenToggle() {
  if (!canFullscreen()) return null;
  const label = "Полный экран";
  const t = h("button.switch", { type: "button", role: "switch", "data-fs-switch": true, "aria-label": label }, h("i"));
  const sync = () => { const on = wantFullscreen(); t.classList.toggle("on", on); t.setAttribute("aria-checked", on ? "true" : "false"); };
  t.addEventListener("click", () => { setFullscreen(!wantFullscreen()); sync(); });
  sync();
  return h("div.set-row", null, h("div", null, h("span.set-label", null, label), h("small.muted", null, "Без адресной строки браузера. Выйти: «назад» на телефоне или Esc на компьютере.")), t);
}

/** Строка раздела «Ещё»: значок в цветном квадрате, название, пояснение, стрелка. */
const link = (href, ic, t, sub, tone = "") => h("a.more-link", { href, class: tone }, h("span.ml-ic", null, icon(ic, { size: 22, sw: 2.2 })), h("div", null, h("b", null, t), h("small.muted", null, sub)), icon("right", { size: 18, sw: 2.6 }));
/**
 * «Установить приложение»: кнопка есть, пока приложение не установлено. Установлено, а открыт браузер:
 * вместо кнопки строка, где искать значок. В самом приложении строки нет.
 */
const installedRow = () => h("div.more-link.install.installed", null, h("span.ml-ic", null, icon("check", { size: 22, sw: 2.6 })), h("div", null, h("b", null, "Приложение установлено"), h("small.muted", null, `Откройте TanWin со значка ${whereIcon()}`)));
function installLink() {
  if (isStandalone()) return null;
  if (isInstalled()) return installedRow();
  const b = h("button.more-link.install.t-lime", { type: "button", onclick: installApp }, h("span.ml-ic", null, icon("down", { size: 22, sw: 2.2 })), h("div", null, h("b", null, "Установить приложение"), h("small.muted", null, "Значок на экране телефона. Работает и без интернета")), icon("right", { size: 18, sw: 2.6 }));
  const off = onInstallChange(() => { if (!b.isConnected) off(); else if (isInstalled()) { b.replaceWith(installedRow()); off(); } });
  return b;
}

export function MoreView() {
  return h("div.page.more", null,
    h("header.page-head", null, h("h1", null, "Ещё")),
    h("a.more-hero", { href: "#/settings" },
      h("span.mh-ic", null, icon("gear", { size: 30, sw: 2.2 })),
      h("div", null, h("b", null, "Настройки"), h("small", null, "Имя, тема, размер текста, шрифт, чтец, копия прогресса")),
      h("span.rc-go", null, icon("right", { size: 20, sw: 2.6 }))),
    h("h2.sec-label", null, "Учимся"),
    h("div.more-links", null,
      link("#/letters", "list", "Алфавит", "28 букв: звуки, формы, махраджи", "t-sky"),
      link("#/rules", "palette", "Правила таджвида", "Цвета мусхафа и примеры из Корана", "t-pink"),
      link("#/bookmarks", "bookmark", "Закладки и цель чтения", "Сохранённые места в Коране", "t-yellow"),
      link("#/method", "sparkle", "Методика", "Как устроено обучение", "t-mint"),
      // 3.0 (2026-10-25): знакомство и подсказки больше не открываются сами, их можно открыть здесь в любой момент
      link("#/welcome", "play", "Знакомство с TanWin", "Короткий фильм: как устроено письмо и весь путь", "t-lime"),
      h("button.more-link.t-sky", { type: "button", onclick: () => { tourLater(); go("/"); } }, h("span.ml-ic", null, icon("info", { size: 22, sw: 2.2 })), h("div", null, h("b", null, "Где что в приложении"), h("small.muted", null, "Подсказки на «Пути»: меню, настройки, этапы")), icon("right", { size: 18, sw: 2.6 }))),
    h("h2.sec-label", null, "О TanWin"),
    h("div.more-links", null,
      link("#/author", "chat", "Послание от разработчика", "Как и зачем появился TanWin", "t-violet"),
      link("#/thanks", "heart", "Благодарности", "Люди, благодаря которым состоялся проект", "t-peach"),
      link("#/changelog", "list", `Версии`, `Сейчас ${APP_VERSION}: ${CHANGELOG[0].title}`, "t-sky"),
      installLink()),
    h("h2.sec-label", null, "Связь"),
    h("div.more-links", null,
      CONTACT.whatsapp ? h("button.more-link.contact-link", { type: "button", onclick: openFeedback }, h("span.ml-ic", null, icon("chat", { size: 22, sw: 2.2 })), h("div", null, h("b", null, "Написать автору"), h("small.muted", null, "Нашли ошибку или есть идея? Версия и экран подставятся сами")), icon("right", { size: 18, sw: 2.6 })) : null,
      h("button.more-link.t-paper", { type: "button", onclick: checkUpdate }, h("span.ml-ic", null, icon("repeat", { size: 22, sw: 2.2 })), h("div", null, h("b", null, "Проверить обновление"), h("small.muted", null, "Обновления приходят сами. Зависло: включите или выключите VPN")), icon("right", { size: 18, sw: 2.6 }))),
    h("section.card.about", null,
      h("h3", null, "Об источниках"),
      h("p", null, "Текст Корана (мусхаф Мадины, риваят Хафса от Асыма), разметка таджвида, пословное аудио и тайминги слов: ", h("a", { href: "https://quran.com", target: "_blank", rel: "noopener" }, "Quran.com"), ". Аудио аятов: Махмуд Халиль аль-Хусари (обучающее чтение), Мишари Рашид аль-Афаси и Абу Бакр аш-Шатри: ", h("a", { href: "https://everyayah.com", target: "_blank", rel: "noopener" }, "EveryAyah"), " и Quran.com. Озвучка отдельных букв и слогов: записи букваря «Каида Нурания» из проекта ", h("a", { href: "https://github.com/ibr7h/al-qaida-nooraniyya", target: "_blank", rel: "noopener" }, "al-qaida-nooraniyya"), ". Перевод смыслов: Эльмир Кулиев."),
      h("p", null, "Шрифты: Amiri Quran (Khaled Hosny), Scheherazade New (SIL Global), Noto Naskh Arabic (Google), Nunito, Unbounded и Manrope: лицензия SIL Open Font License; KFGQPC Uthmanic Script Hafs: Комплекс имени короля Фахда по изданию Священного Корана (Медина)."),
      h("p.muted.small", null, "Приложение не заменяет учителя. Чтение Корана традиционно передаётся из уст в уста (талакки): когда пройдёте путь, прочитайте знающему человеку: он поправит тонкости произношения.")));
}

/** «Настройки» (3.0): всё, что меняет приложение под ученика, по группам. Каждая группа: одна наклейка. */
export function SettingsView() {
  const s = store.get();
  const preview = ar("بِسۡمِ [wٱ]للَّهِ", { cls: "size-preview" });
  const sizeRow = (key, title, sub, extra) => {
    const { min, max, step } = SIZES[key];
    const val = h("b.sp-val", null, Math.round((s.settings[key] || 1) * 100) + "%");
    const slider = h("input", { type: "range", min, max, step, value: s.settings[key] || 1, "aria-label": title });
    slider.addEventListener("input", () => { store.set((st) => { st.settings[key] = +slider.value; }); val.textContent = Math.round(slider.value * 100) + "%"; });
    return h("div.set-row.col", null, h("div.set-row", null, h("div", null, h("span.set-label", null, title), h("small.muted", null, sub)), val), slider, extra);
  };
  const name = h("input.text-in", { type: "text", value: s.profile.name, placeholder: "Как к вам обращаться", maxlength: "30", "aria-label": "Имя" });
  name.addEventListener("change", () => store.set((st) => { st.profile.name = name.value.trim(); }));

  const fileIn = h("input", { type: "file", accept: "application/json,.json", hidden: true });
  fileIn.addEventListener("change", async () => {
    const f = fileIn.files[0]; if (!f) return;
    fileIn.value = ""; // тот же файл можно выбрать ещё раз
    try {
      const text = await f.text();
      const { lessons, exported, now } = store.fileInfo(text);
      const when = exported ? ", сохранён " + dateRu(exported, true) : "";
      if (!(await confirmBox("Заменить прогресс?", `В файле: ${lessons} ${lessonsWord(lessons)}${when}. Сейчас на устройстве: ${now} ${lessonsWord(now)}. Нынешний прогресс сохранится: вернуть его можно здесь же, кнопкой «Вернуть как было».`, "Заменить", "Отмена"))) return;
      store.import(text); toast("Прогресс загружен ✓"); go("/");
    } catch (e) { toast("Не удалось загрузить: " + e.message); }
  });
  const undo = store.undoInfo();
  const undoImport = async () => {
    if (!(await confirmBox("Вернуть прогресс как было?", `Вернётся прогресс до загрузки файла ${dateRu(undo.at)}. Всё, что сделано после загрузки, пропадёт.`, "Вернуть", "Отмена"))) return;
    try { store.undoImport(); toast("Прогресс возвращён ✓"); go("/"); } catch (e) { toast("Не удалось вернуть: " + e.message); }
  };
  // запись прогресса не прочиталась при запуске: её копия ждёт здесь, пока человек не сохранит её в файл или не удалит
  const broken = store.brokenInfo();
  const brokenRow = broken ? h("div.set-row.undo-row.broken-row", null,
    h("div", null, h("span.set-label", null, "Повреждённая запись прогресса"), h("small.muted", null, `Отложена ${dateRu(broken.at)}. Сохраните файл и напишите автору: по нему прогресс можно восстановить`)),
    h("div.row.gap", null,
      h("button.btn.secondary", { type: "button", onclick: saveBrokenFile }, icon("down", { size: 18 }), "Сохранить файл"),
      h("button.btn.ghost", { type: "button", onclick: async () => { if (await confirmBox("Удалить повреждённую запись?", "Восстановить прогресс по ней будет нельзя.", "Удалить", "Отмена")) { store.dropBroken(); brokenRow.remove(); } } }, icon("trash", { size: 18 }), "Удалить"))) : null;
  const group = (tone, ic, title, ...kids) => h("section.card.settings", { class: tone }, h("h3.set-h", null, h("span.set-ic", null, icon(ic, { size: 20, sw: 2.2 })), title), ...kids);

  return h("div.page.settings-page", null,
    h("header.page-head", null, h("a.back", { href: "#/more" }, icon("left", { size: 18, sw: 2.6 }), "Ещё"), h("h1", null, "Настройки")),
    group("t-yellow", "heart", "Профиль",
      h("div.set-row", null, h("span.set-label", null, "Имя"), name),
      seg("Обращение", [["vy", keep("На «вы»")], ["ty", keep("На «ты»")]], s.profile.form || "vy", profile("form")),
      seg("Кто учится", [["", "Не указано"], ["m", "Ученик"], ["f", "Ученица"]], s.profile.gender || "", profile("gender")),
      h("small.muted.set-note", null, keep("От этого зависят слова в уроках: «прочитал» или «прочитала», «нажмите» или «нажми».")),
      seg("Цель дня", [[1, "1 урок"], [2, "2 урока"], [3, "3 урока"]], s.profile.goalLessons || 1, (v) => store.set((st) => { st.profile.goalLessons = v; })),
      h("small.muted.set-note", null, "Засчитывается урок, урок суры, проверка или тренировка, пройденные до конца.")),
    group("t-sky", "sun", "Вид",
      seg("Тема", [["auto", "Как на устройстве"], ["light", "Дневная"], ["dark", "Ночная"]], s.settings.theme, set("theme")),
      h("small.muted.set-note", null, "Ночная: тёмно-фиолетовый фон, наклейки и текст Корана остаются светлыми. «Как на устройстве»: тема меняется вместе с телефоном."),
      sizeRow("uiScale", "Размер текста", "Русский текст, кнопки и меню"),
      fullscreenToggle()),
    group("t-mint", "book", "Арабский текст",
      seg("Шрифт", Object.entries(AR_FONTS).map(([k, f]) => [k, f.name]), arFont(), set("arFont")),
      h("small.muted.set-note", null, "«Мадина»: шрифт печатного мусхафа Мадины, стоит сразу. «Амири»: прежний шрифт приложения. «Шехерезада»: широкие просветы между знаками. «Ното»: простой и ровный."),
      sizeRow("arScale", "Размер арабского", "Менять можно и в уроке или при чтении: кнопка «Aa»", preview),
      toggle("Цвета таджвида", "tajweed", "Правила в мусхафе раскрашены"),
      toggle("Перевод смыслов", "translation", "Перевод Э. Кулиева при чтении по аятам")),
    group("t-pink", "vol", "Звук и подсказки",
      seg("Чтец аятов", Object.entries(RECITERS).map(([k, r]) => [k, r.short]), reciterOf(s.settings.reciter), set("reciter")),
      h("small.muted.set-note", null, "Хусари: медленное обучающее чтение, лучше для учёбы. Афаси: обычный темп. Шатри: мягкий голос, спокойный темп. Слова отдельно всегда звучат голосом чтеца Quran.com."),
      seg("Русские буквы под словами", [["show", "Показывать"], ["tap", "По нажатию"], ["hide", "Скрыть"]], s.settings.translit, set("translit")),
      h("small.muted.set-note", null, "Подсказка, как читать слово. Чем раньше вы будете читать без неё, тем лучше. Советуем «По нажатию»: подсказка появится, когда вы нажмёте на слово."),
      toggle("Звуки ответов", "sfx", "Короткий звук на верный и неверный ответ")),
    group("t-sky", "down", "Звук без интернета", ...soundSettings()),
    group("t-lime", "path", "Обучение",
      toggle("Открыть все уроки", "unlockAll", "Все уроки и суры пути открыты сразу. Пригодится, если прогресс потерялся: откройте всё и продолжайте с того места, где остановились.")),
    group("t-violet", "down", "Прогресс и данные",
      h("p.muted.small", null, "Прогресс хранится только на этом устройстве, без регистрации. Чтобы перенести его на другое устройство, сохраните файл и загрузите его там."),
      h("div.row.wrap.gap", null,
        h("button.btn.secondary", { type: "button", onclick: saveProgressFile }, icon("down", { size: 18 }), "Сохранить прогресс"),
        h("button.btn.secondary", { type: "button", onclick: () => fileIn.click() }, icon("up", { size: 18 }), "Загрузить"), fileIn),
      undo ? h("div.set-row.undo-row", null, h("div", null, h("span.set-label", null, "Загрузили не тот файл?"), h("small.muted", null, `Прогресс до загрузки файла ${dateRu(undo.at)}`)), h("button.btn.secondary", { type: "button", onclick: undoImport }, icon("repeat", { size: 18 }), "Вернуть как было")) : null,
      brokenRow,
      metrikaAvailable() ? h("div.set-sep", null, toggle("Анонимная статистика", "analytics", "Показывает автору, сколько людей учится и где трудно. Через Яндекс.Метрику и PostHog уходят открытые экраны, пройденные уроки и то, кто учится: ученик или ученица. Имя не передаётся.")) : null,
      h("a.link", { href: "privacy/" }, "Конфиденциальность: что хранится и что передаётся"),
      h("div.set-sep", null,
        h("button.btn.danger", { type: "button", onclick: async () => { if (await confirmBox("Сбросить весь прогресс?", "Это нельзя отменить. Сначала можно сохранить прогресс в файл.", "Сбросить", "Отмена")) { store.reset(); go("/welcome"); } } }, icon("trash", { size: 18 }), "Сбросить прогресс"))),
    group("t-paper", "info", "О приложении",
      h("div.set-row", null, h("div", null, h("span.set-label", null, `Версия ${APP_VERSION}`), h("small.muted", null, CHANGELOG[0].title)), h("a.btn.secondary.small-btn", { href: "#/changelog" }, icon("list", { size: 18 }), "Версии")),
      h("div.set-row", null, h("div", null, h("span.set-label", null, "Обновления приходят сами"), h("small.muted", null, "Если что-то зависло, включите или выключите VPN и проверьте обновление")), h("button.btn.secondary.small-btn", { type: "button", onclick: checkUpdate }, icon("repeat", { size: 18 }), "Проверить")),
      h("div.set-row", null, h("div", null, h("span.set-label", null, "Нашли ошибку?"), h("small.muted", null, "Напишите автору: версия и экран подставятся сами")), feedbackButton())));
}
const lessonsWord = (n) => plural(n, "урок", "урока", "уроков");
/** «21 октября» или «21 октября 2026». */
const dateRu = (t, year = false) => new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "long", ...(year ? { year: "numeric" } : {}) }).replace(/\s*г\.$/, "");
/** Сохраняет текст в файл: на телефоне, через «Поделиться» (в «Файлы», мессенджер, почту), на компьютере, загрузкой. Возвращает "shared", "downloaded" или null, если человек закрыл «Поделиться». */
async function saveTextFile(name, text, title) {
  const file = typeof File === "function" ? new File([text], name, { type: "application/json" }) : null;
  const mobile = matchMedia("(pointer: coarse)").matches;
  if (mobile && file && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return "shared"; }
    catch (e) { if (e?.name === "AbortError") return null; }
  }
  download(name, text);
  return "downloaded";
}
/** Сохраняет прогресс в файл. */
export async function saveProgressFile() {
  const how = await saveTextFile(`tanwin-progress-${new Date().toISOString().slice(0, 10)}.json`, store.export(), "Прогресс TanWin");
  if (!how) return;
  backupDone();
  track("backup_saved");
  toast(how === "shared" ? "Копия прогресса сохранена ✓" : "Файл с прогрессом сохранён в «Загрузки» ✓");
}
/** Отложенная испорченная запись прогресса в файл: по нему автор может восстановить прогресс. */
export async function saveBrokenFile() {
  const b = store.brokenInfo(); if (!b) return;
  const how = await saveTextFile(`tanwin-broken-${new Date(b.at).toISOString().slice(0, 10)}.json`, b.raw, "Повреждённая запись TanWin");
  if (how) toast(how === "shared" ? "Копия записи сохранена ✓" : "Файл сохранён в «Загрузки» ✓");
}
function download(name, text) {
  const a = h("a", { href: URL.createObjectURL(new Blob([text], { type: "application/json" })), download: name });
  document.body.append(a); a.click(); a.remove();
}
