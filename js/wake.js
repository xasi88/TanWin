// Экран не гаснет, пока приложением пользуются: Wake Lock держится, пока страница на виду и читатель недавно
// касался экрана — или пока идёт то, что касаний не требует (автопрокрутка, чтец). Свернули приложение или
// оставили планшет на столе — блокировка снимается, чтобы не сажать батарею.
const IDLE = 10 * 60 * 1000; // сколько экран ждёт без касаний
let lock = null, pending = false, lastAct = Date.now(), busy = null;

const want = () => document.visibilityState === "visible" && (!!busy?.() || Date.now() - lastAct < IDLE);
async function sync() {
  if (!navigator.wakeLock || pending) return;
  if (!want()) { lock?.release().catch(() => {}); lock = null; return; }
  if (lock) return;
  pending = true;
  try {
    lock = await navigator.wakeLock.request("screen");
    lock.addEventListener("release", () => { lock = null; }); // система сняла блокировку сама (приложение свернули)
  } catch {} // браузер не разрешил (режим энергосбережения, старая версия) — экран гаснет как обычно
  pending = false;
  if (!want()) sync();
}
const active = () => { lastAct = Date.now(); if (!lock) sync(); };

export function initWake() {
  for (const ev of ["pointerdown", "keydown", "touchmove", "wheel"]) addEventListener(ev, active, { passive: true, capture: true });
  document.addEventListener("visibilitychange", sync);
  setInterval(sync, 30000);
  sync();
}
/** f() → true, пока экран должен гореть и без касаний (автопрокрутка, чтец); null — снять условие. */
export function wakeWhile(f) { busy = f; sync(); }
