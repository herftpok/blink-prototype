/*
 * Раскладка states.html: экраны канала маркета с номерами по порядку, сеткой в разделах описания.
 * Список и подписи – states.js, снимки – states/<id>.webp (tools/shoot_market_bot.py).
 * Карточка – ссылка на живой стенд в этом состоянии: index.html?state=<id>; у карточки якорь #<номер>.
 * Сетка встаёт в каждый [data-board="<группа>"]; несколько групп через пробел. Подзаголовок – только
 * у группы с title: раздел и так назван, номера – на экранах.
 */
(() => {
  "use strict";

  const { GROUPS, STATES } = window.MarketBotStates;
  const esc = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const number = new Map(STATES.map((state, i) => [state.id, i + 1]));

  const card = (state) => `
    <li class="board-card" id="${number.get(state.id)}">
      <a class="board-card__link pressable" href="index.html?state=${state.id}"
         aria-label="${number.get(state.id)}. ${esc(state.title)}: ${esc(state.text)}">
        <span class="board-card__frame">
          <img class="board-card__shot" src="states/${state.id}.webp" alt="" width="780" height="1688" loading="lazy" decoding="async">
          <span class="board-card__number sticker-number" aria-hidden="true">${number.get(state.id)}</span>
        </span>
        <span class="board-card__title">${esc(state.title)}</span>
        <span class="board-card__text">${esc(state.text)}</span>
      </a>
    </li>`;

  for (const slot of document.querySelectorAll("[data-board]")) {
    slot.innerHTML = slot.dataset.board.split(" ").map((id) => {
      const group = GROUPS.find((g) => g.id === id);
      const list = STATES.filter((state) => state.group === id);
      const first = number.get(list[0].id);
      const last = number.get(list[list.length - 1].id);
      return `
        <div class="board__group">
          ${group.title ? `<h3 class="board__group-title">${esc(group.title)} <span class="board__range">${first === last ? first : `${first}–${last}`}</span></h3>` : ""}
          <ul class="board__grid" role="list">${list.map(card).join("")}</ul>
        </div>`;
    }).join("");
  }
})();
