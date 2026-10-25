// Установка приложения на рабочий стол / домашний экран (PWA).
// Событие beforeinstallprompt ловится сразу при загрузке, иначе браузер его не повторит.
import { track } from "./usage.js";

let evt = null;
const listeners = new Set();
const emit = () => listeners.forEach((f) => f());

// Вкладка браузера сама не знает, что приложение уже установлено, запоминаем это при установке.
// Если браузер снова предлагает установку, значит, приложения на устройстве нет (его удалили): отметку снимаем.
const FLAG = "tanwin.installed";
const setFlag = (on) => { try { if (on) localStorage.setItem(FLAG, "1"); else localStorage.removeItem(FLAG); } catch {} };
const flag = () => { try { return !!localStorage.getItem(FLAG); } catch { return false; } };

window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); evt = e; setFlag(false); emit(); });
window.addEventListener("appinstalled", () => { evt = null; setFlag(true); emit(); track("app_installed"); });

export const onInstallChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
/** Открыто как приложение (отдельное окно, без адресной строки). */
export const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
/** Приложение установлено: открыто как приложение, его установили из этого браузера или браузер ответил, что оно стоит (ниже). */
export const isInstalled = () => isStandalone() || flag();
export const canPrompt = () => !!evt;
// Вкладка браузера, а приложение уже стоит (поставили не из этого браузера или отметка потерялась): Chrome и Edge на компьютере
// (с версии 140) и Chrome на Android отвечают через getInstalledRelatedApps, если в manifest.webmanifest есть ссылка на себя
// (related_applications, полные адреса сайта и черновика). Пустой ответ отметку не снимает: старый Chrome на компьютере отвечает пусто всегда.
// Удалённое приложение браузер и так выдаёт: снова предлагает установку (beforeinstallprompt выше).
if (!isStandalone() && navigator.getInstalledRelatedApps) {
  navigator.getInstalledRelatedApps().then((apps) => { if (apps.some((a) => a.platform === "webapp") && !flag()) { setFlag(true); emit(); } }).catch(() => {});
}
const ua = navigator.userAgent;
/** Где искать значок установленного приложения. */
export const whereIcon = () => /Android/.test(ua) ? "на главном экране" : /Windows/.test(ua) ? "на рабочем столе или в меню «Пуск»" : "среди приложений";
export const isIOS = () => /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Показывает системное окно установки. Возвращает true, если пользователь согласился. */
export async function install() {
  if (!evt) return false;
  const e = evt;
  evt = null;
  e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") setFlag(true);
  emit();
  return outcome === "accepted";
}

/** Подсказка, если системного окна нет (Safari, Firefox). */
export function manualHint() {
  if (isIOS()) return "В Safari нажмите «Поделиться» и выберите «На экран „Домой“».";
  if (/Firefox/.test(ua)) return "Firefox на компьютере не устанавливает сайты как приложения. Откройте эту страницу в Chrome, Edge или Яндекс Браузере.";
  if (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) return "В Safari на Mac: меню «Файл» → «Добавить в Dock».";
  return "Откройте меню браузера (⋮) и выберите «Установить приложение» или «Добавить на главный экран».";
}
