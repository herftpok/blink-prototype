/*
 * Раскладка states.html: все экраны и состояния новогодней фичи по сценариям.
 * Список и подписи – states.js, снимки – states/<id>.webp (tools/shoot_states.py).
 * Карточка – ссылка на живой стенд в этом состоянии: index.html?state=<id>.
 */
import { GROUPS, STATES } from "./states.js";

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

// чей телефон на снимке
const owner = (state) => (state.phone === "left" ? "наташка" : state.persona === "sonya" ? "соня" : "лёва");

const card = (state) => `
  <li class="board-card">
    <a class="board-card__link pressable" href="index.html?state=${state.id}">
      <img class="board-card__shot" src="states/${state.id}.webp" alt="" width="585" height="1266" loading="lazy" decoding="async">
      <span class="board-card__who">${escapeHtml(owner(state))}</span>
      <span class="board-card__title">${escapeHtml(state.title)}</span>
      <span class="board-card__text">${escapeHtml(state.text)}</span>
    </a>
  </li>`;

document.querySelector("[data-board]").innerHTML = GROUPS.map(
  (group) => `
    <section class="board__group" aria-labelledby="group-${group.id}">
      <h2 class="board__group-title" id="group-${group.id}">${escapeHtml(group.title)}</h2>
      <p class="board__group-text">${escapeHtml(group.text)}</p>
      <ul class="board__grid" role="list">${STATES.filter((state) => state.group === group.id).map(card).join("")}</ul>
    </section>`
).join("");
