// Установка приложения на рабочий стол / домашний экран (PWA).
// Событие beforeinstallprompt ловится сразу при загрузке, иначе браузер его не повторит.
import { track } from "./metrika.js";

let evt = null;
const listeners = new Set();
const emit = () => listeners.forEach((f) => f());

// Вкладка браузера сама не знает, что приложение уже установлено, — запоминаем это при установке.
// Если браузер снова предлагает установку, значит, приложения на устройстве нет (его удалили) — отметку снимаем.
const FLAG = "tanwin.installed";
const setFlag = (on) => { try { if (on) localStorage.setItem(FLAG, "1"); else localStorage.removeItem(FLAG); } catch {} };
const flag = () => { try { return !!localStorage.getItem(FLAG); } catch { return false; } };

window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); evt = e; setFlag(false); emit(); });
window.addEventListener("appinstalled", () => { evt = null; setFlag(true); emit(); track("app_installed"); });

export const onInstallChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
/** Открыто как приложение (отдельное окно, без адресной строки). */
export const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
/** Приложение установлено: открыто как приложение или его установили из этого браузера. */
export const isInstalled = () => isStandalone() || flag();
export const canPrompt = () => !!evt;
const ua = navigator.userAgent;
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
  if (/Firefox/.test(ua)) return "Firefox на компьютере не устанавливает сайты как приложения — откройте эту страницу в Chrome, Edge или Яндекс Браузере.";
  if (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) return "В Safari на Mac: меню «Файл» → «Добавить в Dock».";
  return "Откройте меню браузера (⋮) и выберите «Установить приложение» или «Добавить на главный экран».";
}
