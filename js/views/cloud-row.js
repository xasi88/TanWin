// «Настройки» → «Прогресс и данные»: облако прогресса и «Привязать Telegram» (2026-11-10). Устройство: js/cloud.js.
import { h, icon, toast, confirmBox } from "../ui.js";
import { inTelegram } from "../tg.js";

const when = (t) => new Date(t).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

function statusText(c) {
  if (c.status === "sync") return "Сохраняется…";
  if (c.status === "error") return "Нет связи с облаком. Прогресс сохранится, когда появится интернет.";
  return c.okAt ? "Сохранено в " + when(c.okAt) : "Сохраняется после каждого урока";
}

/** Строка облака: в Telegram состояние, на сайте «Привязать Telegram» или «Отвязать». */
export function cloudRow() {
  const box = h("div.cloud-row");
  let cloud = null, off = null;
  const draw = () => {
    if (!cloud) return;
    const c = cloud.cloudInfo();
    if (inTelegram) {
      box.replaceChildren(h("div.set-row", null, h("div", null,
        h("span.set-label", null, "Прогресс сохраняется в Telegram"),
        h("small.muted", null, statusText(c) + ". Он не потеряется, даже если очистить Telegram или сменить телефон."))));
    } else if (c.linked) {
      box.replaceChildren(h("div.set-row", null,
        h("div", null, h("span.set-label", null, "Telegram привязан"), h("small.muted", null, statusText(c) + ". Один прогресс здесь и в TanWin в Telegram.")),
        h("button.btn.ghost", { type: "button", onclick: unlink }, "Отвязать")));
    } else {
      box.replaceChildren(h("div.set-row", null,
        h("div", null, h("span.set-label", null, "Привязать Telegram"), h("small.muted", null, "Один прогресс на сайте, в приложении и в Telegram. Он не потеряется, даже если сменить телефон.")),
        h("button.btn.secondary", { type: "button", onclick: link }, icon("repeat", { size: 18 }), "Привязать")));
    }
  };
  async function unlink() {
    if (!(await confirmBox("Отвязать Telegram?", "Прогресс останется и на этом устройстве, и в Telegram. Новые уроки здесь больше не будут попадать в Telegram.", "Отвязать", "Отмена"))) return;
    cloud.unlink(); draw();
  }
  async function link() {
    try {
      // Telegram открывается в том же нажатии: код придумывает сайт (js/cloud.js)
      const { kod, url } = cloud.linkStart();
      window.open(url, "_blank", "noopener");
      box.replaceChildren(h("div.set-row", null,
        h("div", null, h("span.set-label", null, "Ждём Telegram"), h("small.muted", null, "В Telegram нажмите «Запустить» и вернитесь сюда. Прогресс подтянется сам.")),
        h("a.btn.secondary", { href: url, target: "_blank", rel: "noopener" }, "Открыть ещё раз")));
      const ok = await cloud.linkWait(kod, () => !box.isConnected);
      if (ok) toast("Telegram привязан. Прогресс объединён ✓", 4000);
      else if (box.isConnected) toast("Не дождались ответа бота. Попробуйте ещё раз.", 5000);
    } catch (err) {
      toast(err.code === "ustarel" ? "Ссылка устарела. Нажмите «Привязать» ещё раз." : "Нет связи с ботом. Проверьте интернет, включите или выключите VPN.", 5000);
    }
    draw();
  }
  import("../cloud.js").then((m) => {
    cloud = m; draw();
    off = m.onCloud(() => { if (!box.isConnected) off?.(); else draw(); });
  });
  return box;
}
