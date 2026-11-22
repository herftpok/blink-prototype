/*
 * states.html: как работает адвент – сценарии по порядку. Флоу – ряд экранов слева направо со стрелками,
 * у шага номер «флоу.шаг», заголовок и что происходит. Снимок – ссылка на живой стенд: index.html?state=<id>.
 * Данные – states.js, снимки – states/<id>.webp (tools/shoot_advent.py).
 */
import { FLOWS, APPENDIX } from "./states.js";

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const shot = (id) => `states/${id.replace(":", "-")}.webp`;

const step = (s, num, last) => `
  <li class="flow-step" id="${num}">
    <a class="flow-step__link pressable" href="index.html?state=${encodeURIComponent(s.id)}" aria-label="${num}. ${esc(s.title)}: ${esc(s.text)}">
      <span class="flow-step__frame"><img class="flow-step__shot" src="${shot(s.id)}" alt="" width="585" height="1266" loading="lazy" decoding="async"></span>
      <span class="flow-step__num">${num}</span>
      <span class="flow-step__title">${esc(s.title)}</span>
      <span class="flow-step__text">${esc(s.text)}</span>
    </a>
    ${last ? "" : '<span class="flow-step__arrow" aria-hidden="true"></span>'}
  </li>`;

const flows = FLOWS.map((f, i) => `
  <section class="flow" aria-labelledby="flow-${f.id}">
    <header class="flow__head">
      <span class="flow__index sticker-number" aria-hidden="true">${i + 1}</span>
      <div>
        <h2 class="flow__title" id="flow-${f.id}">${esc(f.title)}</h2>
        <p class="flow__text">${esc(f.text)}</p>
      </div>
    </header>
    <ol class="flow__steps" role="list">${f.steps.map((s, k) => step(s, `${i + 1}.${k + 1}`, k === f.steps.length - 1)).join("")}</ol>
  </section>`).join("");

const appendix = APPENDIX.map((g) => `
  <section class="flow flow--appendix" aria-labelledby="app-${g.id}">
    <h3 class="flow__title" id="app-${g.id}">${esc(g.title)}</h3>
    <p class="flow__text">${esc(g.text)}</p>
    <ul class="flow__grid" role="list">${g.steps.map((s) => `
      <li><a class="flow-step__link pressable" href="index.html?state=${encodeURIComponent(s.id)}">
        <span class="flow-step__frame"><img class="flow-step__shot" src="${shot(s.id)}" alt="" width="585" height="1266" loading="lazy" decoding="async"></span>
        <span class="flow-step__title">${esc(s.title)}</span><span class="flow-step__text">${esc(s.text)}</span>
      </a></li>`).join("")}</ul>
  </section>`).join("");

document.querySelector("[data-board]").innerHTML = `${flows}
  <h2 class="board__appendix">Приложение</h2>${appendix}`;
