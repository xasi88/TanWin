// TanWin в Telegram (мини-приложение @tanwin88_bot, 2026-11-10). Тот же сайт, открытый внутри Telegram.
// Скрипт Telegram (telegram.org/js/telegram-web-app.js) не грузим: в России без VPN он не открывается (опыт Рамбургера).
// Сигналы Telegram страница шлёт сама, события Telegram принимает сама: core.telegram.org/api/web-events.
// Модуль грузится первым (app.js): Telegram кладёт данные входа в адрес (#tgWebAppData=...), а TanWin
// ведёт экраны по адресу. Данные забираем и убираем из адреса до первого экрана, иначе «Страница не найдена».

const KOPIYA = "tanwin.tg"; // данные входа на время вкладки: после перезагрузки в адресе их уже нет

function dannyeVhoda() {
  let d = "";
  // данные ищем в любом месте адреса: Telegram на разных устройствах ставит их по-разному
  try {
    const adres = location.hash + "&" + location.search.slice(1);
    const m = adres.match(/tgWebAppData=([^&]*)/);
    if (m) d = decodeURIComponent(m[1]);
    if (/tgWebApp/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
  } catch (e) { /* адрес без данных */ }
  try {
    if (d) sessionStorage.setItem(KOPIYA, d);
    else d = sessionStorage.getItem(KOPIYA) || "";
  } catch (e) { /* хранилище закрыто */ }
  return d;
}

export const initData = dannyeVhoda();
/** TanWin открыт внутри Telegram. */
export const inTelegram = !!initData;

// Сигнал Telegram, как в telegram-web-app.js: телефон и Telegram Desktop через TelegramWebviewProxy, Telegram Web через окно-родитель
function signal(tip, dannye) {
  if (!inTelegram) return;
  try {
    if (window.TelegramWebviewProxy) window.TelegramWebviewProxy.postEvent(tip, JSON.stringify(dannye || {}));
    else if (window.parent !== window) window.parent.postMessage(JSON.stringify({ eventType: tip, eventData: dannye || {} }), "*");
  } catch (e) { /* не Telegram */ }
}

// События от Telegram: телефон вызывает Telegram.WebView.receiveEvent, Telegram Web шлёт сообщение окну
const slushateli = {};
function prinyat(tip, dannye) { (slushateli[tip] || []).forEach((f) => { try { f(dannye); } catch (e) { console.error(e); } }); }
export function onTg(tip, f) { (slushateli[tip] ||= []).push(f); }
if (inTelegram) {
  const priem = { receiveEvent: prinyat };
  window.Telegram = Object.assign(window.Telegram || {}, { WebView: Object.assign(window.Telegram?.WebView || {}, priem) });
  window.TelegramGameProxy = Object.assign(window.TelegramGameProxy || {}, priem);
  window.TelegramGameProxy_receiveEvent = prinyat;
  addEventListener("message", (e) => {
    if (e.source !== window.parent) return;
    try { const m = JSON.parse(e.data); if (m && m.eventType) prinyat(m.eventType, m.eventData); } catch (err) { /* чужое сообщение */ }
  });
}

/** Шапка Telegram в цвет строки браузера TanWin: светлая и тёмная тема (app.js, applySettings). Фон не красим: у страницы свой. */
let bylCvet = "";
export function tgColors(cvet) {
  if (cvet === bylCvet) return;
  bylCvet = cvet;
  signal("web_app_set_header_color", { color: cvet });
}

// Кнопка «Назад» Telegram: видна на всех экранах, кроме «Пути», ведёт на шаг назад
function knopkaNazad() {
  const doma = (location.hash.replace(/^#/, "") || "/") === "/";
  signal("web_app_setup_back_button", { is_visible: !doma });
}

/** Ссылка наружу (WhatsApp, Quran.com): открывает Telegram, а не окно мини-приложения. */
export function openOutside(url) { signal("web_app_open_link", { url }); }

/** Ярлык TanWin на главном экране телефона (Telegram 8.0 и новее). */
export function addToHome() { signal("web_app_add_to_home_screen"); }

export function initTelegram() {
  if (!inTelegram) return;
  document.documentElement.classList.add("tg");
  signal("web_app_expand");
  // урок и страницы Корана листаются вниз: смахивание не сворачивает приложение
  signal("web_app_setup_swipe_behavior", { allow_vertical_swipe: false });
  knopkaNazad();
  addEventListener("hashchange", knopkaNazad);
  onTg("back_button_pressed", () => {
    if (history.length > 1) history.back();
    else location.hash = "#/";
  });
  // ссылки на другие сайты открывает Telegram
  document.addEventListener("click", (e) => {
    const a = e.target.closest?.("a[href]");
    if (!a || a.origin === location.origin || !/^https?:/.test(a.href)) return;
    e.preventDefault();
    openOutside(a.href);
  }, true);
  signal("web_app_ready");
}
