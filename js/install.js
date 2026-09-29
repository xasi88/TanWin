// Установка приложения на рабочий стол / домашний экран (PWA).
// Событие beforeinstallprompt ловится сразу при загрузке, иначе браузер его не повторит.
let evt = null;
const listeners = new Set();
const emit = () => listeners.forEach((f) => f());

window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); evt = e; emit(); });
window.addEventListener("appinstalled", () => { evt = null; emit(); });

export const onInstallChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
export const isInstalled = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
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
  emit();
  return outcome === "accepted";
}

/** Подсказка, если системного окна нет (Safari, Firefox). */
export function manualHint() {
  if (isIOS()) return "В Safari нажмите «Поделиться» и выберите «На экран „Домой“».";
  if (/Firefox/.test(ua)) return "Firefox на компьютере не устанавливает сайты как приложения — откройте TanWin в Chrome, Edge или Яндекс Браузере.";
  if (/Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) return "В Safari на Mac: меню «Файл» → «Добавить в Dock».";
  return "Откройте меню браузера (⋮) и выберите «Установить TanWin» или «Установить приложение».";
}
