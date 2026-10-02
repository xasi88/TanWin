// Полный экран: приложение без адресной строки и панелей браузера.
// Установленное приложение (PWA) и так открывается отдельным окном без адресной строки. Во вкладке браузера
// страница может развернуться только после нажатия — так требуют браузеры, — поэтому разворачиваемся при первом касании.
import { store } from "./store.js";
import { isInstalled } from "./install.js";

const root = document.documentElement;
const request = root.requestFullscreen || root.webkitRequestFullscreen;
const leave = document.exitFullscreen || document.webkitExitFullscreen;

/** Умеет ли браузер разворачивать страницу (iPhone — нет: там только установка на экран «Домой»). */
export const canFullscreen = () => !!request && (document.fullscreenEnabled ?? document.webkitFullscreenEnabled ?? true);
export const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

/** Настройка «Полный экран». Пока ученик её не трогал: включена на телефонах и планшетах, открытых в браузере. */
export function wantFullscreen() {
  if (!canFullscreen()) return false;
  const v = store.get().settings.fullscreen;
  return typeof v === "boolean" ? v : matchMedia("(pointer: coarse)").matches && !isInstalled();
}

/** Развернуть на весь экран. Работает только из обработчика нажатия. */
export function enterFullscreen() {
  if (!canFullscreen() || isFullscreen()) return;
  try { Promise.resolve(request.call(root, { navigationUI: "hide" })).catch(() => {}); } catch {}
}
export function exitFullscreen() {
  if (!isFullscreen()) return;
  try { Promise.resolve(leave.call(document)).catch(() => {}); } catch {}
}
export const onFullscreenChange = (f) => {
  document.addEventListener("fullscreenchange", f);
  document.addEventListener("webkitfullscreenchange", f);
  return () => { document.removeEventListener("fullscreenchange", f); document.removeEventListener("webkitfullscreenchange", f); };
};

/** Держит приложение развёрнутым: любое нажатие возвращает полный экран, если он включён в настройках. */
export function initFullscreen() {
  document.addEventListener("click", (e) => { if (wantFullscreen() && !e.target.closest?.("[data-fs-switch]")) enterFullscreen(); }, true);
}
