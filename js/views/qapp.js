// «Мой Коран» отдельным приложением (папка /quran/): карточка установки, подвал, и общее для обоих приложений
// окно «Приложение обновляется само» — про обновления и VPN.
import { h, icon, toast, modal, keep } from "../ui.js";
import { QURAN_APP, ROOT } from "../env.js";
import { canPrompt, install, isIOS, isStandalone, manualHint, onInstallChange, ownWindow, quranInstalled } from "../install.js";
import { APP_VERSION } from "../version.js";
import { checkUpdate } from "../app.js";

const Q_URL = new URL("quran/", ROOT).href;
const HINT = "tanwin.qInstallHint";

/** Общие ли данные у «Моего Корана» и TanWin — зависит от системы: говорим как есть. */
export const sharedNote = () => isIOS()
  ? "На iPhone и iPad каждое приложение на экране «Домой» хранит данные отдельно: закладки, цели и место чтения в «Моём Коране» и в TanWin будут свои."
  : "Закладки, цели и место чтения общие с TanWin: поставили в одном приложении — видно в другом. Для этого оба должны быть установлены из одного браузера на этом устройстве. Между разными устройствами данные не передаются.";

/** То же одной строкой — для кнопки в «Ещё». */
export const sharedShort = () => isIOS() ? "На iPhone и iPad данные у него свои, отдельно от TanWin." : "Закладки и цели общие с TanWin.";

/**
 * Карточка «Установить „Мой Коран“» на главном экране отдельного приложения. Её нет, когда приложение уже открыто своим значком.
 * «Не сейчас» прячет её; по ссылке из TanWin (?install=1) она показывается снова.
 */
export function quranInstallCard() {
  if (!QURAN_APP || ownWindow()) return null;
  const asked = new URLSearchParams(location.search).has("install");
  let hidden = false;
  try { hidden = !!localStorage.getItem(HINT); } catch {}
  if (!asked && (hidden || quranInstalled())) return null;
  const hide = () => { try { localStorage.setItem(HINT, "1"); } catch {} off(); card.remove(); };
  const copy = async () => { try { await navigator.clipboard.writeText(Q_URL); toast("Адрес скопирован ✓"); } catch { toast(Q_URL.replace(/^https?:\/\//, ""), 6000); } };
  const act = h("div.row.gap.wrap");
  const how = h("div.muted");
  const fill = () => {
    if (quranInstalled() && !canPrompt()) {
      how.textContent = "«Мой Коран» установлен — ищите его значок на рабочем столе или главном экране.";
      act.replaceChildren(h("button.btn.ghost.small-btn", { type: "button", onclick: hide }, "Понятно"));
    } else if (canPrompt()) {
      how.textContent = "";
      act.replaceChildren(
        h("button.btn.primary.small-btn", { type: "button", onclick: async () => { if (await install()) toast("«Мой Коран» установлен — ищите его на рабочем столе ✓"); } }, icon("down", { size: 16 }), "Установить"),
        h("button.btn.ghost.small-btn", { type: "button", onclick: hide }, "Не сейчас"));
    } else {
      // внутри окна TanWin браузер установку не предлагает — нужна обычная вкладка
      how.textContent = isStandalone()
        ? "Сейчас эта страница открыта внутри приложения TanWin — отсюда установка не запускается. Скопируйте адрес, откройте его в браузере и установите оттуда. На компьютере можно проще: меню окна «⋯» → «Открыть в браузере»."
        : manualHint();
      act.replaceChildren(
        isStandalone() ? h("button.btn.primary.small-btn", { type: "button", onclick: copy }, "Скопировать адрес") : "",
        h("button.btn.ghost.small-btn", { type: "button", onclick: hide }, "Не сейчас"));
    }
  };
  const card = h("div.card.backup-card.install-card", null,
    h("span.rc-ic", null, icon("down", { size: 24 })),
    h("div", null,
      h("b", null, keep("Установите «Мой Коран» отдельным приложением")),
      h("div.muted", null, "Свой значок на экране. Внутри только чтение: суры, джузы, страницы, закладки и цели — ничего лишнего."),
      how,
      h("div.muted", null, sharedNote()),
      act));
  const off = onInstallChange(() => { if (!card.isConnected) off(); else fill(); });
  fill();
  return card;
}

/** Подвал главного экрана «Моего Корана»: версия, проверка обновления и дорога к урокам. */
export function quranFoot() {
  if (!QURAN_APP) return null;
  return h("div.q-foot", null,
    h("a", { href: "#/changelog" }, `Версия ${APP_VERSION}`),
    h("button.link", { type: "button", onclick: checkUpdate }, "Проверить обновление"),
    h("a", { href: ROOT }, "Уроки чтения и таджвида — TanWin"));
}

/**
 * Окно «Приложение обновляется само»: один раз каждому. Обновление может не дойти из-за VPN (включённого или выключенного),
 * и тогда приложение зависает или не открывается — человек должен знать, что это не поломка и что делать.
 */
const NOTE = "tanwin.updNote";
export function updateNotice() {
  try { if (localStorage.getItem(NOTE) || navigator.webdriver) return; localStorage.setItem(NOTE, "1"); } catch { return; }
  const where = QURAN_APP ? "внизу списка сур" : "в разделе «Ещё» → «О приложении»";
  modal((close) => h("div.upd-note", null,
    h("h2", null, "Приложение обновляется само"),
    h("p", null, "Мы почти каждый день делаем его лучше. Обновления приходят сами — устанавливать ничего не нужно."),
    h("p", null, "Но иногда обновление доходит не сразу: это зависит от того, включён у вас VPN или выключен. Тогда приложение может зависнуть, не открыть страницу или показать ошибку."),
    h("p", null, h("b", null, "Это не поломка."), ` Если что-то не работает — включите или выключите VPN и нажмите «Проверить обновление»: кнопка ${where}.`),
    h("button.btn.primary.wide", { type: "button", onclick: close }, "Понятно")));
}
