/*
 * Стенд приветственного квеста: телефон и пульт. Пульт меняет модель (quest.js) – экран (game.js)
 * отвечает сам. Всё вне телефона – стенд, в продукт не идёт.
 */
import { Quest } from "./quest.js";
import { mount } from "./game.js";

const $ = (selector, root = document) => root.querySelector(selector);

const quest = new Quest();
const view = mount($("#phone"), quest);

const ACTIONS = {
  one: () => quest.ids("sent")[0] && quest.accept(quest.ids("sent")[0]),        // ответил тот, кто ждёт дольше всех
  all: () => quest.ids("sent").forEach((id) => quest.accept(id)),
  three: () => view.demoGuesses(3),
  intro: () => view.openIntro(),
  reset: () => quest.reset(),
  auto: () => {
    quest.auto = !quest.auto;
  },
};

function renderPanel() {
  $('[data-act="auto"]').setAttribute("aria-checked", String(quest.auto));
}

$(".panel").addEventListener("click", (event) => {
  const button = event.target.closest("[data-act]");
  if (!button || !ACTIONS[button.dataset.act]) return;
  ACTIONS[button.dataset.act]();
  renderPanel();
});
renderPanel();

/* стенд целиком в окне; на телефоне – колонкой */
function fitStage() {
  const stage = $(".stage__phones");
  if (window.matchMedia("(max-width: 480px)").matches) {
    stage.style.removeProperty("--stage-zoom");
    return;
  }
  const top = stage.getBoundingClientRect().top + window.scrollY;
  const zoom = Math.max(0.5, Math.min(1, (window.innerHeight - top - 24) / 844));
  stage.style.setProperty("--stage-zoom", zoom.toFixed(3));
}
window.addEventListener("resize", fitStage);
fitStage();

window.WQ = { quest, view };                         // для smoke.py и снимков
