/*
 * Маркет – разметка экрана и каталог. Общий для главного прототипа и фич (как pin.js):
 * эталон – market/market_full_screen.png, стили – styles/screens/market.css.
 *
 *   const market = BlinkMarket.mount(document.getElementById("screen-market"), {
 *     assets: "assets",
 *     coins: 55000,
 *     sky: "stars",                        // "stars" – как на эталоне, "snow" – новогодний маркет
 *     extraTabs: [{ id: "ny", title: "новый год", render: (panel) => {…} }],
 *     initialTab: "tails",
 *     onItem: (item, button) => {…},       // нажатие на предмет
 *   });
 *   market.setCoins(54700);  market.selectTab("ny");
 *
 * Вкладка „хвосты“ стоит по координатам эталона, „стикеры“ – сеткой (эталона нет).
 */
(() => {
  "use strict";

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  /** 55000 → „55 000“, 5000 → „5000“: как на эталоне – пробел в числах от десяти тысяч */
  const formatCoins = (n) => (n >= 10000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : String(n));

  // Каталог. x, y, w – рамка упаковки на холсте 390 (pt @3x со скриншота), только у вкладки „хвосты“
  const TAILS = [
    { id: "fire-sale", name: "огонь", kind: "хвост", art: "market/tail-fire-sale.webp", price: 300, oldPrice: 500, x: 108, y: 192, w: 173, hero: true },
    { id: "cat", name: "кото йота", kind: "хвост", art: "market/tail-cat.webp", price: 300, x: 37, y: 456, w: 139 },
    { id: "fire", name: "огонёк", kind: "хвост", art: "market/tail-fire.webp", price: 0, x: 216, y: 456, w: 137 },
    { id: "fire-2", name: "искра", kind: "хвост", art: "market/tail-fire-2.webp", price: 0, x: 37, y: 684, w: 137 },
    { id: "shadow-sale", name: "тень", kind: "хвост", art: "market/tail-shadow-sale.webp", price: 300, oldPrice: 450, x: 214, y: 684, w: 143 },
    { id: "pixel", name: "пиксели", kind: "хвост", art: "market/tail-pixel.webp", soon: true, x: 126, y: 912, w: 139 },
  ];

  const STICKERS = [
    { id: "zombie", name: "жутко весело", kind: "стикерпак", art: "market/items/zombie-new.webp", price: 1500, stock: { left: 68, total: 100 } },
    { id: "bat", name: "летучие мыши", kind: "стикерпак", art: "market/items/bat-sale.webp", price: 300, oldPrice: 500 },
    { id: "ghost", name: "привидения", kind: "стикерпак", art: "market/items/ghost.webp", price: 300 },
    { id: "pumpkin", name: "тыквы", kind: "стикерпак", art: "market/items/pumpkin.webp", price: 300 },
    { id: "jewelry", name: "украшения", kind: "стикерпак", art: "market/items/jewelry-limited.webp", price: 1200, stock: { left: 42, total: 100 } },
    { id: "ghost-box", name: "призрак", kind: "хвост", art: "market/items/ghost-box-new.webp", price: 800 },
    { id: "zombie-box", name: "зомби", kind: "хвост", art: "market/items/zombie-box-new.webp", price: 800 },
    { id: "shadow-limited", name: "тень сквозь время", kind: "хвост", art: "market/items/shadow-limited.webp", price: 2500, stock: { left: 17, total: 100 } },
  ];

  // Коллекция и архив – карточки хвоста без упаковки, у каждой свой наклон (вырезаны со скриншота)
  const OWNED = [
    { art: "market/owned-1.webp", x: 46, y: 1275, w: 124, selected: true },
    { art: "market/owned-2.webp", x: 225, y: 1276, w: 123 },
    { art: "market/owned-3.webp", x: 135, y: 1496, w: 123 },
  ];
  const ARCHIVE = [
    { art: "market/archive-1.webp", x: 46, y: 2031, w: 124 },
    { art: "market/archive-2.webp", x: 225, y: 2032, w: 123 },
  ];

  const TABS = [
    { id: "tails", title: "хвосты" },
    { id: "stickers", title: "стикеры" },
  ];

  const byId = (id) => [...TAILS, ...STICKERS].find((item) => item.id === id);

  function priceChip(item, assets) {
    if (item.soon) return '<span class="price-chip">скоро</span>';
    if (!item.price) return '<span class="price-chip">бесплатно</span>';
    return `<span class="price-chip price-chip--coins">
      <img class="price-chip__coin" src="${assets}/market/coin.png" alt="">${formatCoins(item.price)}</span>`;
  }

  function itemLabel(item) {
    if (item.soon) return `${item.name}, ${item.kind}, скоро`;
    return `${item.name}, ${item.kind}, ${item.price ? `${formatCoins(item.price)} монет` : "бесплатно"}`;
  }

  /** Предмет: упаковка и ценник. placed – стоит по координатам эталона */
  function itemMarkup(item, assets, { placed = true, extra = "" } = {}) {
    const style = placed ? ` style="--x:${item.x};--y:${item.y};--w:${item.w}"` : "";
    return `
      <button class="market-item pressable" type="button" data-item="${item.id}"${style}
              aria-label="${escapeHtml(itemLabel(item))}"${item.soon ? " aria-disabled=\"true\"" : ""}>
        <img class="market-item__art" src="${assets}/${item.art}" alt="">
        ${priceChip(item, assets)}${extra}
      </button>`;
  }

  function tailsMarkup(assets) {
    const cards = (list) =>
      list
        .map(
          (card) => `
            <div class="owned-card" style="--x:${card.x};--y:${card.y};--w:${card.w}">
              <img src="${assets}/${card.art}" alt="">
              ${card.selected ? `<span class="owned-card__selected"><span class="owned-card__check"><i class="icon icon--check" aria-hidden="true"></i></span>выбрано</span>` : ""}
            </div>`
        )
        .join("");
    return `
      ${TAILS.map((item) => itemMarkup(item, assets)).join("")}
      <div class="market-section" style="--y:1175">
        <h2 class="market-section__title">уже у тебя</h2>
        <p class="market-section__text">хвосты в коллекции</p>
      </div>
      ${cards(OWNED)}
      <img class="market-tape" src="${assets}/market/tape.webp" alt="" style="--y:1712">
      <div class="market-section" style="--y:1884">
        <h2 class="market-section__title">архив</h2>
        <p class="market-section__text">лимитированные хвосты,<br>которые остались в&nbsp;истории</p>
      </div>
      ${cards(ARCHIVE)}`;
  }

  function stickersMarkup(assets) {
    return `<div class="market-grid">${STICKERS.map((item) => itemMarkup(item, assets, { placed: false })).join("")}</div>`;
  }

  function mount(screen, options = {}) {
    const assets = options.assets || "assets";
    const tabs = [...TABS, ...(options.extraTabs || [])];
    let coins = options.coins ?? 55000;
    let active = options.initialTab || "tails";

    screen.innerHTML = `
      <canvas class="market__sky" aria-hidden="true"></canvas>
      <div class="screen__scroll">
        <div class="market__content" data-tab="${active}">
          <div class="market__glow" aria-hidden="true"><img class="market__ring" src="${assets}/market/ring.webp" alt=""></div>
          <header class="market__header">
            <h1 class="screen-title">маркет</h1>
            <div class="coin-balance">
              <img class="coin-balance__coin" src="${assets}/market/coin.png" alt="">
              <span class="coin-balance__value" data-coins></span>
              <button class="coin-balance__add pressable" type="button" aria-label="пополнить монеты">
                <i class="icon icon--plus" aria-hidden="true"></i>
              </button>
            </div>
          </header>
          <div class="market-tabs" role="tablist" aria-label="разделы маркета">
            ${tabs
              .map(
                (tab) => `<button class="market-tab pressable" type="button" role="tab" data-tab="${tab.id}"
                                  id="market-tab-${tab.id}" aria-controls="market-panel-${tab.id}">${escapeHtml(tab.title)}</button>`
              )
              .join("")}
          </div>
          ${tabs
            .map(
              (tab) => `<div class="market__panel" id="market-panel-${tab.id}" role="tabpanel"
                             aria-labelledby="market-tab-${tab.id}" data-panel="${tab.id}" hidden></div>`
            )
            .join("")}
        </div>
      </div>`;

    const $ = (selector) => screen.querySelector(selector);
    const content = $(".market__content");
    $("#market-panel-tails").innerHTML = tailsMarkup(assets);
    $("#market-panel-stickers").innerHTML = stickersMarkup(assets);
    (options.extraTabs || []).forEach((tab) => tab.render && tab.render($(`#market-panel-${tab.id}`)));

    const sky = window.BlinkSky ? window.BlinkSky.start($(".market__sky"), { mode: options.sky || "stars" }) : null;
    const listeners = [];

    function setCoins(value) {
      coins = value;
      const node = $("[data-coins]");
      node.textContent = formatCoins(coins);
      node.closest(".coin-balance").setAttribute("aria-label", `баланс: ${formatCoins(coins)} монет`);
    }

    function selectTab(id) {
      if (!tabs.some((tab) => tab.id === id)) return;
      active = id;
      content.dataset.tab = id;
      screen.querySelectorAll(".market-tab").forEach((tab) => {
        const on = tab.dataset.tab === id;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
      });
      screen.querySelectorAll(".market__panel").forEach((panel) => {
        panel.hidden = panel.dataset.panel !== id;
      });
      listeners.forEach((cb) => cb(id));
    }

    screen.addEventListener("click", (event) => {
      const tab = event.target.closest(".market-tab");
      if (tab) {
        selectTab(tab.dataset.tab);
        return;
      }
      const item = event.target.closest("[data-item]");
      if (item && options.onItem) options.onItem(byId(item.dataset.item), item);
    });

    // стрелки двигают выбор вкладки, как у нативных вкладок
    $(".market-tabs").addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const i = tabs.findIndex((tab) => tab.id === active);
      const next = tabs[(i + step + tabs.length) % tabs.length].id;
      selectTab(next);
      $(`#market-tab-${next}`).focus();
    });

    setCoins(coins);
    selectTab(active);
    return { setCoins, selectTab, onTab: (cb) => listeners.push(cb), sky, get coins() { return coins; } };
  }

  window.BlinkMarket = { mount, formatCoins, byId, catalog: { tails: TAILS, stickers: STICKERS }, itemMarkup, priceChip };
})();
