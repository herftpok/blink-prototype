/*
 * Раскладка states.html: все экраны адвента по сценариям, с номерами по порядку.
 * Список и подписи – states.js, снимки – states/<id>.webp (tools/shoot_advent.py).
 * Карточка – ссылка на живой стенд в этом состоянии: index.html?state=<id>; у карточки якорь #<номер>.
 */
import { GROUPS as ALL_GROUPS, STATES as ALL_STATES } from "./states.js";

// опубликованная версия (GitHub Pages) – без игры и розыгрыша, как и сам стенд; ?nogame – то же локально
const NO_GAME = location.hostname.endsWith("github.io") || new URLSearchParams(location.search).has("nogame");
const HIDDEN = NO_GAME ? ["game", "draw"] : [];
const GROUPS = ALL_GROUPS.filter((g) => !HIDDEN.includes(g.id));
const STATES = ALL_STATES.filter((s) => !HIDDEN.includes(s.group));

const esc = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const number = new Map(STATES.map((state, i) => [state.id, i + 1]));


const card = (state) => `
  <li class="board-card" id="${number.get(state.id)}">
    <a class="board-card__link pressable" href="index.html?state=${encodeURIComponent(state.id)}${NO_GAME && !location.hostname.endsWith("github.io") ? "&nogame" : ""}"
       aria-label="${number.get(state.id)}. ${esc(state.title)}, ${esc(state.text)}">
      <span class="board-card__frame">
        <img class="board-card__shot" src="states/${state.id.replace(":", "-")}.webp" alt="" width="585" height="1266" loading="lazy" decoding="async">
        <span class="board-card__number sticker-number" aria-hidden="true">${number.get(state.id)}</span>
      </span>
      <span class="board-card__title">${esc(state.title)}</span>
      <span class="board-card__text">${esc(state.text)}</span>
    </a>
  </li>`;

document.querySelector("[data-board]").innerHTML = GROUPS.map((group) => {
  const list = STATES.filter((state) => state.group === group.id);
  const first = number.get(list[0].id);
  const last = number.get(list[list.length - 1].id);
  return `
    <section class="board__group" aria-labelledby="group-${group.id}">
      <h2 class="board__group-title" id="group-${group.id}">${esc(group.title)} <span class="board__range">${first === last ? first : `${first}–${last}`}</span></h2>
      <p class="board__group-text">${esc(group.text)}</p>
      <ul class="board__grid" role="list">${list.map(card).join("")}</ul>
    </section>`;
}).join("");
