// Где запущено приложение. Кроме TanWin есть «Мой Коран» — отдельное приложение из папки /quran/:
// тот же код и те же данные, но на экране только чтение Корана и закладки (см. docs/ARCHITECTURE.md).
export const ROOT = new URL("../", import.meta.url).href; // корень сайта: от него считаются адреса данных, звуков и sw.js
export const QURAN_APP = /\/quran\/(index\.html)?$/.test(location.pathname);
export const APP_NAME = QURAN_APP ? "Мой Коран" : "TanWin";
