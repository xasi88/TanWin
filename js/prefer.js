// Выбор слов и примеров для уроков с оглядкой на скачанный звук (3.0, «Звук без интернета», js/sound.js).
// Модуль без зависимостей: его берут ui.js (sample, pick) и data.js (примеры букв), а правило ставит sound.js.
let ok = null; // (пример) => true, если его звук уже на устройстве или звука у него нет

/** sound.js ставит правило, когда на устройстве есть скачанный звук; null: выбираем из всего, как раньше. */
export const setPrefer = (f) => { ok = f; };

/** Из списка оставляет примеры со скачанным звуком, если их хватает на n штук; иначе список как есть (нужен интернет). */
export function preferred(a, n = 1) {
  if (!ok || !a.length) return a;
  const s = a.filter(ok);
  return s.length >= Math.min(n, a.length) ? s : a;
}

/** Инструмент tools/audit/sound-packs.mjs слушает, что выбрали уроки: так составляется звук каждого этапа. */
export const seen = (x) => { globalThis.__twPick?.(x); return x; };
