// Знакомство: что даст курс, цель дня, стартовая точка.
import { h, ar, icon, keep, skipBtn } from "../ui.js";
import { store } from "../store.js";
import { logo, go } from "../app.js";
import { track, user, whoParams } from "../usage.js";
import { fill } from "../tutor.js";

export function Onboarding() {
  let step = 0;
  const data = { name: store.get().profile.name || "", goal: store.get().profile.goalLessons || 1, form: store.get().profile.form || "vy", gender: store.get().profile.gender || "" };
  const root = h("div.onboard");
  const dots = () => h("div.ob-dots", null, ...[0, 1, 2, 3].map((i) => h("i", { class: i === step ? "on" : "" })));
  const screens = [
    () => h("div.ob-screen.hero", null,
      h("div.ob-logo", null, logo(92)),
      h("div.ob-ar", null, ar("ٱقۡرَأۡ", { cls: "ob-big" })),
      h("h1", null, "Научитесь читать Коран"),
      h("p.lead", null, "С нуля — до чтения мусхафа по правилам таджвида. Маленькими шагами, по 10 минут в день. Бесплатно."),
      h("p.muted.small.ob-teacher", null, "Лучше всего учиться с преподавателем. Нет преподавателя или времени — занимайтесь по приложению сами."),
      h("div.ob-points", null,
        pt("ear", "Живые чтецы", "каждое слово и аят — голосом чтеца"),
        pt("book", "Настоящие слова Корана", "с первых же слогов"),
        pt("chart", "Виден прогресс", "путь, уровни, серия дней, награды")),
      next("Начать")),
    () => h("div.ob-screen", null,
      h("h2", null, "Как к вам обращаться?"),
      h("p.muted", null, "Необязательно — но так уроки станут личными: мы будем обращаться к вам по имени и отмечать ваши успехи."),
      (() => { const i = h("input.text-in.big", { type: "text", value: data.name, placeholder: "Имя", maxlength: "30", "aria-label": "Имя" }); i.addEventListener("input", () => (data.name = i.value.trim())); return i; })(), // без автофокуса: на телефоне клавиатура закрыла бы кнопку «Дальше»
      h("div.ob-ask", null, h("span.set-label", null, "Как обращаться"), choice("form", [["vy", "На «вы»"], ["ty", "На «ты»"]])),
      h("div.ob-ask", null, h("span.set-label", null, "Кто учится"), choice("gender", [["m", "Ученик"], ["f", "Ученица"]])),
      h("p.muted.small", null, keep("От этого зависят слова в уроках: «прочитал» или «прочитала», «нажмите» или «нажми». Изменить можно в разделе «Ещё».")),
      next("Дальше")),
    () => h("div.ob-screen", null,
      h("h2", null, data.name ? `Приятно познакомиться, ${fill("{n}", data.name)}!` : "Сколько времени в день?"),
      data.name ? h("p.lead", null, "Сколько времени в день вы готовы уделять?") : null,
      h("p.muted", null, "Регулярность важнее длительности. Цель можно изменить в любой момент."),
      h("div.goal-opts", null, ...[[1, "1 урок в день", "≈ 5-7 минут"], [2, "2 урока", "≈ 10-15 минут"], [3, "3 урока", "≈ 15-20 минут"]].map(([v, t, s]) => {
        const b = h("button.goal-opt", { type: "button", class: data.goal === v ? "on" : "" }, h("b", null, t), h("span", null, s));
        b.addEventListener("click", () => { data.goal = v; b.parentNode.querySelectorAll(".goal-opt").forEach((x) => x.classList.toggle("on", x === b)); });
        return b;
      })),
      next("Дальше")),
    () => h("div.ob-screen", null,
      h("h2", null, fill("{n}, с чего начнём?", data.name)),
      h("div.start-opts", null,
        startOpt("✦", "Я начинаю с нуля", "Не знаю арабских букв", "/learn/1.1"),
        startOpt("ب", "Я знаю буквы", "Сдам проверку алфавита и пойду дальше", "/learn/2.9"),
        startOpt("ـبـ", "Я знаю буквы в словах", "Проверю формы букв и начну с огласовок", "/learn/3.12"),
        startOpt("بَ", "Я читаю по слогам", "Проверю слоги и перейду к словам", "/learn/5.5"),
        startOpt("ٱ", "Я уже читаю", "Проверю чтение аятов и перейду к сурам и таджвиду", "/learn/8.7"))),
  ];
  function pt(ic, t, s) { return h("div.ob-pt", null, h("span.ob-pt-ic", null, icon(ic, { size: 22 })), h("div", null, h("b", null, t), h("small", null, s))); }
  // обращение и род действуют сразу — уже на следующих экранах знакомства
  const saveProfile = () => store.set((st) => { st.profile.name = data.name; st.profile.goalLessons = data.goal; st.profile.form = data.form; st.profile.gender = data.gender; });
  // кнопка прикреплена к низу экрана (.ob-foot): на телефоне она видна сразу, даже если текст длиннее экрана
  function next(label) { return h("div.ob-foot", null, h("button.btn.primary.wide.big", { type: "button", onclick: () => { saveProfile(); if (!step) track("onboard_started"); step++; draw(); } }, label, icon("right", { size: 20 }))); }
  function choice(key, options) {
    const box = h("div.seg", { role: "radiogroup" });
    options.forEach(([v, t]) => {
      const b = h("button.seg-btn", { type: "button", role: "radio", "aria-checked": data[key] === v ? "true" : "false", class: data[key] === v ? "on" : "" }, keep(t));
      b.addEventListener("click", () => { data[key] = v; box.querySelectorAll("button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); });
      box.append(b);
    });
    return box;
  }
  function startOpt(g, t, s, path) {
    const b = h("button.start-opt", { type: "button" }, h("span.so-g", null, ar(g)), h("div", null, h("b", null, t), h("small", null, s)), icon("right"));
    b.addEventListener("click", () => {
      saveProfile();
      store.set((st) => { st.profile.onboarded = true; });
      try { sessionStorage.setItem("tanwin.fromWelcome", "1"); } catch {} // в первом уроке будет кнопка «на главную»
      track("onboarded", { Старт: t, ...whoParams() });
      user(whoParams());
      go(path === "/learn/1.1" ? "/" : path);
      if (path === "/learn/1.1") setTimeout(() => go(path), 50);
    });
    return b;
  }
  const draw = () => { root.replaceChildren(h("div.ob-top", null, step ? h("button.icon-btn", { type: "button", "aria-label": "Назад", onclick: () => { step--; draw(); } }, icon("left")) : h("span"), dots(),
    // «Пропустить» — для тех, кто уже знаком с приложением: без вопросов сразу к выбору, с чего начать
    step < screens.length - 1 ? skipBtn(() => { saveProfile(); track("onboard_skipped", { Шаг: step + 1 }); step = screens.length - 1; draw(); }, { cls: "ob-skip" }) : h("span")), screens[step]()); };
  draw();
  return root;
}
