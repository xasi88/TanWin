// Сюда попадает только старая версия приложения (до 1.19): её service worker на любой адрес отвечал приложением,
// и вместо страницы буквы получался пустой экран. Ждём, пока включится новая версия, и открываем страницу заново.
const v = document.getElementById("view");
if (v) v.innerHTML = '<p style="padding:48px 24px;text-align:center;font-family:sans-serif">Обновляем TanWin…</p>';
const sw = navigator.serviceWorker;
let done = false;
const reload = () => { if (!done) { done = true; location.reload(); } };
sw.addEventListener("controllerchange", reload);
sw.getRegistration().then((reg) => {
  if (!reg) return reload();
  const push = () => reg.waiting && reg.waiting.postMessage({ type: "SKIP_WAITING" });
  push();
  reg.addEventListener("updatefound", () => reg.installing && reg.installing.addEventListener("statechange", push));
  reg.update().catch(() => {});
});
