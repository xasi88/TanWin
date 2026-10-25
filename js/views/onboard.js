// Знакомство: что даст курс, цель дня, стартовая точка.
// Ветка kino: первый экран стал фильмом-прологом (js/kino/prologue.js), остальные экраны в ярком кино-виде (css/kino.css).
// С 2026-10-25 знакомство открывается только по выбору человека: кнопкой на карточке новичка («Путь») или в «Ещё».
import { h, ar, icon, keep, skipBtn } from "../ui.js";
import { store } from "../store.js";
import { go } from "../app.js";
import { track, user, whoParams } from "../usage.js";
import { fill } from "../tutor.js";
import { prologue } from "../kino/prologue.js";
import { startFilm } from "../kino/start.js";

// Новичок, который не прошёл экран «Как к вам обращаться?» (выбрал «Сразу первый урок», проверку уровня или «Пропустить»),
// видит эти вопросы на итоге первого урока (решение автора 2026-10-25). Отметка живёт до ответа или «Пропустить».
const ASK = "tanwin.askMe";
export const askWaits = () => { try { return localStorage.getItem(ASK) === "1"; } catch { return false; } };
export const askLater = () => { try { localStorage.setItem(ASK, "1"); } catch {} };
const askDone = () => { try { localStorage.removeItem(ASK); } catch {} };
const profileData = () => ({ name: store.get().profile.name || "", goal: store.get().profile.goalLessons || 1, form: store.get().profile.form || "vy", gender: store.get().profile.gender || "" });

/** level: открыть сразу выбор уровня («Я уже учился» на карточке новичка); «Назад» тогда ведёт на «Путь». */
export function Onboarding({ level = false } = {}) {
  let step = 0, answered = false;
  const wasNew = !store.get().profile.onboarded; // знакомство открыли повторно из «Ещё»: вопросы после урока не нужны
  const data = profileData();
  const root = h("div.onboard.kino.ob-kino");
  const dots = () => h("div.ob-dots", null, ...[0, 1, 2, 3].map((i) => h("i", { class: i === step ? "on" : "" })));
  const screens = [
    () => h("div.ob-screen.ob-film", null, prologue({ onDone: () => { saveProfile(); track("onboard_started"); step++; draw(); } })),
    () => h("div.ob-screen", null,
      h("h2", null, "Как к вам обращаться?"),
      h("p.muted", null, "Необязательно. С именем уроки станут личными: мы будем обращаться к вам по имени."),
      (() => { const i = h("input.text-in.big", { type: "text", value: data.name, placeholder: "Имя", maxlength: "30", "aria-label": "Имя" }); i.addEventListener("input", () => (data.name = i.value.trim())); return i; })(), // без автофокуса: на телефоне клавиатура закрыла бы кнопку «Дальше»
      h("div.ob-ask", null, h("span.set-label", null, "Как обращаться"), choice(data, "form", [["vy", "На «вы»"], ["ty", "На «ты»"]])),
      h("div.ob-ask", null, h("span.set-label", null, "Кто учится"), choice(data, "gender", [["m", "Ученик"], ["f", "Ученица"]])),
      h("p.muted.small", null, keep("От этого зависят слова в уроках: «прочитал» или «прочитала», «нажмите» или «нажми». Изменить можно в настройках.")),
      next("Дальше")),
    () => h("div.ob-screen", null,
      h("h2", null, data.name ? `Приятно познакомиться, ${fill("{n}", data.name)}!` : "Сколько времени в день?"),
      data.name ? h("p.lead", null, "Сколько времени в день вы готовы уделять?") : null,
      h("p.muted", null, "Лучше понемногу, но каждый день. Цель можно изменить в настройках."),
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
  // обращение и род действуют сразу: уже на следующих экранах знакомства
  const saveProfile = () => store.set((st) => { st.profile.name = data.name; st.profile.goalLessons = data.goal; st.profile.form = data.form; st.profile.gender = data.gender; });
  // кнопка прикреплена к низу экрана (.ob-foot): на телефоне она видна сразу, даже если текст длиннее экрана
  function next(label) { return h("div.ob-foot", null, h("button.btn.primary.wide.big", { type: "button", onclick: () => { saveProfile(); if (!step) track("onboard_started"); if (step === 1) answered = true; step++; draw(); } }, label, icon("right", { size: 20 }))); }
  function startOpt(g, t, s, path) {
    const b = h("button.start-opt", { type: "button" }, h("span.so-g", null, ar(g)), h("div", null, h("b", null, t), h("small", null, s)), icon("right"));
    b.addEventListener("click", () => {
      saveProfile();
      store.set((st) => { st.profile.onboarded = true; });
      if (answered) askDone(); else if (wasNew) askLater(); // имя и цель не спросили: спросим на итоге первого урока
      track("onboarded", { Старт: t, ...whoParams() });
      user(whoParams());
      // «С нуля»: на «Путь», там сверху карточка «Первый урок» (с 1.34.1; раньше сразу открывался урок 1.1 и пугал новичка).
      // Подсказки «где что» с 3.0 по кнопке на карточке новичка и в «Ещё», а не сами.
      // Проверку человек выбрал сам: она открывается сразу, в ней «Пропустить» ведёт на главную
      if (path === "/learn/1.1") return go("/");
      // 3.0: перед проверкой фильм «что дальше»: что за проверка, что засчитается, с какого этапа продолжить
      const begin = () => { try { sessionStorage.setItem("tanwin.fromWelcome", "1"); } catch {} go(path); };
      root.classList.add("at-film");
      root.replaceChildren(
        h("div.ob-top", null, h("button.icon-btn", { type: "button", "aria-label": "Назад", onclick: () => draw() }, icon("left")), h("span"), skipBtn(begin, { cls: "ob-skip", label: "Пропустить объяснение и начать проверку" })),
        h("div.ob-screen.ob-film", null, startFilm({ testId: path.split("/").pop(), onDone: begin })));
    });
    return b;
  }
  // «Назад» с первого экрана (и с выбора уровня, если пришли прямо к нему) ведёт на «Путь»: знакомство человек открыл сам и может из него выйти
  const back = () => { if (!step || (level && step === screens.length - 1)) return go("/"); step--; draw(); };
  const draw = () => { root.classList.toggle("at-film", step === 0); root.replaceChildren(h("div.ob-top", null, h("button.icon-btn", { type: "button", "aria-label": step ? "Назад" : "На «Путь»", onclick: back }, icon("left")), dots(),
    // «Пропустить»: для тех, кто уже знаком с приложением: без вопросов сразу к выбору, с чего начать
    step < screens.length - 1 ? skipBtn(() => { saveProfile(); track("onboard_skipped", { Шаг: step + 1 }); step = screens.length - 1; draw(); }, { cls: "ob-skip" }) : h("span")), screens[step]()); };
  if (level) step = screens.length - 1;
  draw();
  return root;
}

function choice(data, key, options) {
  const box = h("div.seg", { role: "radiogroup" });
  options.forEach(([v, t]) => {
    const b = h("button.seg-btn", { type: "button", role: "radio", "aria-checked": data[key] === v ? "true" : "false", class: data[key] === v ? "on" : "" }, keep(t));
    b.addEventListener("click", () => { data[key] = v; box.querySelectorAll("button").forEach((x) => { x.classList.toggle("on", x === b); x.setAttribute("aria-checked", x === b); }); });
    box.append(b);
  });
  return box;
}

/** Итог первого урока у того, кто пропустил знакомство: имя, «вы» или «ты», ученик или ученица, цель дня. Можно пропустить. */
export function profileAsk() {
  const data = profileData();
  const name = h("input.text-in", { type: "text", value: data.name, placeholder: "Имя", maxlength: "30", "aria-label": "Имя" });
  name.addEventListener("input", () => (data.name = name.value.trim()));
  const card = h("div.card.profile-ask", null,
    h("b.pa-h", null, "Как к вам обращаться?"),
    h("p.muted", null, "Необязательно. С именем уроки станут личными. Изменить можно в «Настройках»."),
    name,
    h("div.ob-ask", null, h("span.set-label", null, "Как обращаться"), choice(data, "form", [["vy", "На «вы»"], ["ty", "На «ты»"]])),
    h("div.ob-ask", null, h("span.set-label", null, "Кто учится"), choice(data, "gender", [["m", "Ученик"], ["f", "Ученица"]])),
    h("div.ob-ask", null, h("span.set-label", null, "Цель дня"), choice(data, "goal", [[1, "1 урок"], [2, "2 урока"], [3, "3 урока"]])),
    h("div.row.gap.wrap", null,
      h("button.btn.primary", { type: "button", onclick: () => {
        store.set((st) => { st.profile.name = data.name; st.profile.form = data.form; st.profile.gender = data.gender; st.profile.goalLessons = data.goal; });
        askDone(); track("profile_after_lesson", { Имя: data.name ? "да" : "нет" }); user(whoParams());
        card.replaceWith(h("p.tutor-line", null, data.name ? `Приятно познакомиться, ${fill("{n}", data.name)}!` : "Сохранено ✓"));
      } }, "Сохранить"),
      h("button.btn.ghost", { type: "button", onclick: () => { askDone(); track("profile_after_lesson", { Имя: "пропустил" }); card.remove(); } }, "Пропустить")));
  return card;
}
