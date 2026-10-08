/*
 * Маркет недели – альтернативная витрина маркета по двум исследованиям в market/*.pdf
 * („Интерфейсы ротируемых магазинов“, „Механики возврата в ротируемый магазин“).
 *
 * Лента сверху вниз: шапка с балансом → вкладки „хвосты · стикеры“, у каждой своя неделя → „на этой неделе“ (когда придёт новое – словами, без
 * тикающего таймера) → один крупный предмет недели без карусели, с примеркой на твоём пине →
 * четыре предложения недели → „у друзей“ – что взяли твои друзья → полка „хэллоуин“ со ссылкой
 * „все“ → „уже у тебя“ → архив. Карточка – одна зона нажатия, на ней цена и одно состояние.
 * Нажатие – шторка предмета по эталонам market/unlimited_sticker.png, limited_tale.png,
 * unlimitid_tale.png; покупка – как там: „КУПИТЬ“ с ценой.
 *
 * Второй телефон – чат с лёвой: нажатие на его стикер открывает шторку этого набора.
 * Пульт стенда переключает день: четверг, воскресенье (последний день), понедельник (новая витрина).
 */
(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const A = "../../assets";
  const { formatCoins } = window.BlinkMarket;

  const esc = (v) =>
    String(v).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  // ── Каталог ────────────────────────────────────────────────────────────
  // pack – упаковка (market/*), tail – хвост без упаковки для примерки на пине,
  // sticker – стикер из набора для превью; без них превью – сама упаковка на карточке с точками.
  // friends – у скольких друзей уже есть (лица в шторке – первые три)
  const ITEMS = {
    fire: { name: "огонь", kind: "хвост", pack: "market/tail-fire-sale.webp", tail: "tails/rocket.webp", price: 300, old: 500, friends: 3,
      text: "реактивное пламя за твоим пином на карте" },
    cat: { name: "кото йота", kind: "хвост", pack: "market/tail-cat.webp", price: 300, friends: 1,
      text: "кот верхом на волне плывёт за твоим пином. хвост от партнёра" },
    zombie: { name: "жутко весело", kind: "стикерпак", pack: "market/items/zombie-new.webp", sticker: "market/sticker-zombie.webp",
      price: 1500, stock: { left: 68, total: 100 }, friends: 5,
      text: "этот пак оживает по ночам… и в твоих чатах. добавь немного жути в переписку с друзьями" },
    shadow: { name: "тень", kind: "хвост", pack: "market/tail-shadow-sale.webp", tail: "tails/dementor.webp", price: 300, old: 450, friends: 0,
      text: "рваная тень тянется за твоим пином по всей карте" },
    jewelry: { name: "украшения", kind: "стикерпак", pack: "market/items/jewelry-limited.webp", price: 1200, stock: { left: 42, total: 100 }, friends: 2,
      text: "сердца, звёзды и буквы в стразах – для переписки с друзьями" },
    "shadow-limited": { name: "тень сквозь время", kind: "хвост", pack: "market/items/shadow-limited.webp", tail: "tails/dementor.webp",
      price: 2500, stock: { left: 17, total: 100 }, friends: 1, text: "та самая рваная тень, только тиражом 100 штук" },
    "fire-new": { name: "огонёк", kind: "хвост", pack: "market/items/fire-new.webp", tail: "tails/rocket.webp", price: 800, friends: 0,
      text: "пламя за твоим пином – новое и поярче" },
    "fire-2": { name: "искра", kind: "хвост", pack: "market/tail-fire-2.webp", tail: "tails/rocket.webp", price: 200, friends: 1,
      text: "короткая вспышка за твоим пином" },
    ember: { name: "уголёк", kind: "хвост", pack: "market/tail-fire.webp", tail: "tails/rocket.webp", price: 150, friends: 0,
      text: "тихое пламя за твоим пином – на каждый день" },
    pixel: { name: "пиксели", kind: "хвост", pack: "market/tail-pixel.webp", price: 500, friends: 0,
      text: "хвост из пикселей, как в старых играх" },
    "bat-box": { name: "летучая мышь", kind: "хвост", pack: "market/items/bat-box-sale.webp", price: 300, old: 500, friends: 2,
      text: "пушистая летучая мышь летит за твоим пином" },
    "ghost-box": { name: "призрак", kind: "хвост", pack: "market/items/ghost-box-new.webp", price: 800, friends: 0,
      text: "привидение плывёт за твоим пином по ночной карте" },
    bats: { name: "летучие мыши", kind: "стикерпак", pack: "market/items/bat-sale.webp", price: 300, old: 500, friends: 4,
      text: "пушистые летучие мыши для ночных переписок" },
    ghost: { name: "привидения", kind: "стикерпак", pack: "market/items/ghost.webp", price: 300, friends: 1,
      text: "привидения для переписки, совсем не страшные" },
    pumpkin: { name: "тыквы", kind: "стикерпак", pack: "market/items/pumpkin.webp", price: 300, friends: 0,
      text: "тыквы с улыбкой – к хэллоуину" },
    "zombie-box": { name: "зомби", kind: "хвост", pack: "market/items/zombie-box-new.webp", price: 800, friends: 3,
      text: "зомби бредёт за твоим пином до самого дома" },
  };
  Object.entries(ITEMS).forEach(([id, item]) => (item.id = id));

  // Друзья – пак людей из avatars/, имена как в соседних фичах
  const FRIENDS = {
    lyova: { name: "лёва", photo: `${A}/people/photo-3.webp` },
    sonya: { name: "соня", photo: `${A}/people/photo-4.webp` },
    timur: { name: "тимур", photo: `${A}/people/photo-2.webp` },
    vasya: { name: "вася", photo: `${A}/people/photo-5.webp` },
    natashka: { name: "наташка", photo: `${A}/people/photo-1.webp` },
  };
  const FACES = ["lyova", "sonya", "timur", "vasya", "natashka"];

  // Вкладки маркета, как на эталоне market_full_screen.png. У каждой своя витрина недели: предмет
  // недели, четыре предложения, что взяли друзья (свежее – сверху), и подборка к празднику
  // (у неё свой срок, она не крутится каждую неделю)
  const TABS = [
    { id: "tails", title: "хвосты" },
    { id: "stickers", title: "стикеры" },
  ];
  const WEEKS = {
    tails: {
      w41: {
        hero: "fire",
        offers: ["cat", "shadow", "fire-2", "pixel"],
        friends: [
          { who: "sonya", item: "cat", when: "сегодня" },
          { who: "timur", item: "fire", when: "во вторник" },
          { who: "natashka", item: "fire-2", when: "в понедельник" },
        ],
      },
      w42: {
        hero: "shadow-limited",
        offers: ["fire-new", "ember", "cat", "pixel"],
        friends: [{ who: "lyova", item: "shadow-limited", when: "сегодня" }],
      },
    },
    stickers: {
      w41: {
        hero: "zombie",
        offers: ["jewelry", "bats", "ghost", "pumpkin"],
        friends: [
          { who: "sonya", item: "bats", when: "сегодня" },
          { who: "lyova", item: "zombie", when: "вчера" },
          { who: "vasya", item: "jewelry", when: "в понедельник" },
        ],
      },
      w42: {
        hero: "ghost",
        offers: ["pumpkin", "jewelry", "bats", "zombie"],
        friends: [{ who: "natashka", item: "ghost", when: "сегодня" }],
      },
    },
  };

  const COLLECTIONS = {
    tails: { title: "хэллоуин", until: "до 31.10", items: ["zombie-box", "ghost-box", "bat-box"] },
  };

  // Коллекция и архив – карточки хвостов со скриншота market_full_screen.png
  const OWNED = ["owned-1", "owned-2", "owned-3"];
  const ARCHIVE = ["archive-1", "archive-2"];

  // День на стенде: какая неделя на витрине и что пишем о сроке
  const DAYS = {
    thu: { week: "w41", next: "новое – 12.10", leave: "уходит в воскресенье" },
    sun: { week: "w41", next: "новое – завтра", leave: "уходит сегодня" },
    mon: { week: "w42", next: "новое – 19.10", leave: "уходит в воскресенье" },
  };

  const S = { tab: "tails", day: "thu", coins: 55000, owned: new Set() };
  const week = (tab = S.tab) => WEEKS[tab][DAYS[S.day].week];
  const collection = () => COLLECTIONS[S.tab];

  // ── Ценник ─────────────────────────────────────────────────────────────
  // одно состояние: цена (со старой зачёркнутой при скидке) или „у тебя“
  function chip(item) {
    if (S.owned.has(item.id))
      return `<span class="price-chip mw-chip mw-chip--owned"><span class="mw-chip__check"><i class="icon icon--check" aria-hidden="true"></i></span>у тебя</span>`;
    return `<span class="price-chip price-chip--coins mw-chip">
      <img class="price-chip__coin" src="${A}/market/coin.png" alt="">${formatCoins(item.price)}${
        item.old ? `<s class="mw-chip__old">${formatCoins(item.old)}</s>` : ""}</span>`;
  }

  // тираж – только реальный: „осталось 42 из 100“ голографическим текстом под ценой
  const stockLine = (item) =>
    item.stock && !S.owned.has(item.id)
      ? `<span class="mw-stock">осталось ${item.stock.left} из ${item.stock.total}</span>`
      : "";

  function label(item) {
    const price = S.owned.has(item.id)
      ? "уже у тебя"
      : `${formatCoins(item.price)} монет${item.old ? `, было ${formatCoins(item.old)}` : ""}`;
    const stock = item.stock && !S.owned.has(item.id) ? `, осталось ${item.stock.left} из ${item.stock.total}` : "";
    return `${item.name}, ${item.kind}, ${price}${stock}`;
  }

  // ── Пин с хвостом: примерка на тебе ───────────────────────────────────
  // твой пин в пути (живая аватарка, скорость), хвост растёт из-под кадра – как на эталоне хвоста
  const rider = (item) => `
    <span class="mw-rider" aria-hidden="true">
      ${item.tail ? `<img class="mw-rider__tail" src="${A}/${item.tail}" alt="">` : ""}
      ${window.BlinkPin.markup({ name: "ты", photo: `${A}/people/live-1.webp`, size: 52, online: true, state: "moving", speed: 25, tag: "span", assets: A })}
    </span>`;

  // ── Лента ─────────────────────────────────────────────────────────────
  function card(item, cls = "") {
    return `
      <button class="mw-item pressable ${cls}" type="button" data-item="${item.id}" aria-label="${esc(label(item))}">
        <img class="mw-item__pack" src="${A}/${item.pack}" alt="">
        ${chip(item)}${stockLine(item)}
      </button>`;
  }

  // Предмет недели. Хвост – на карте за твоим пином, упаковка наклеена на угол карты.
  // Стикерпак – стикер на карточке с сеткой точек, упаковка так же на углу. Нет отдельной
  // картинки – на карточке сама упаковка, крупно
  function heroMarkup(item) {
    const art = item.tail
      ? `<span class="mw-hero__map"><img class="mw-hero__tiles" src="${A}/market/map-tail.webp" alt="">${rider(item)}</span>`
      : `<span class="mw-hero__map mw-hero__map--dots">
          <img class="${item.sticker ? "mw-hero__sticker" : "mw-hero__solo"}" src="${A}/${item.sticker || item.pack}" alt="">
        </span>`;
    const solo = !item.tail && !item.sticker;
    return `
      <button class="mw-hero pressable${solo ? " mw-hero--solo" : ""}" type="button" data-item="${item.id}" aria-label="${esc(`предмет недели: ${label(item)}`)}">
        ${art}
        ${solo ? "" : `<span class="mw-hero__pack-wrap"><img class="mw-hero__pack" src="${A}/${item.pack}" alt="">${chip(item)}</span>`}
        <span class="mw-hero__name">
          <span class="mw-hero__title">${esc(item.name)}</span>
          <span class="mw-hero__kind">${esc(item.kind)}</span>
          ${solo ? chip(item) : ""}${stockLine(item)}
        </span>
      </button>`;
  }

  function friendCard({ who, item: id, when }) {
    const f = FRIENDS[who];
    const item = ITEMS[id];
    return `
      <button class="mw-friend pressable" type="button" data-item="${id}"
              aria-label="${esc(`${f.name}, ${when}: ${item.name}, ${item.kind}`)}">
        <span class="mw-friend__art"><img class="mw-friend__pack" src="${A}/${item.pack}" alt=""></span>
        <img class="mw-friend__face" src="${f.photo}" alt="">
        <span class="mw-friend__name ellipsis">${esc(f.name)}</span>
        <span class="mw-friend__when">${esc(when)}</span>
      </button>`;
  }

  function cards(list, kind) {
    return list.map((art, i) => `<div class="mw-owned__card mw-owned__card--${i}"><img src="${A}/market/${art}.webp" alt=""></div>`).join("");
  }

  // Шапка и вкладки рисуются один раз: фокус на вкладке не теряется при переключении
  function renderShell() {
    $("#feed").innerHTML = `
      <div class="market__glow" aria-hidden="true"><img class="market__ring" src="${A}/market/ring.webp" alt=""></div>
      <header class="market__header">
        <h1 class="screen-title">маркет</h1>
        <div class="coin-balance">
          <img class="coin-balance__coin" src="${A}/market/coin.png" alt="">
          <span class="coin-balance__value" data-coins></span>
          <button class="coin-balance__add pressable" type="button" aria-label="пополнить монеты">
            <i class="icon icon--plus" aria-hidden="true"></i>
          </button>
        </div>
      </header>
      <div class="market-tabs" role="tablist" aria-label="разделы маркета">
        ${TABS.map((t) => `<button class="market-tab pressable" type="button" role="tab" data-tab="${t.id}"
                                   id="market-tab-${t.id}" aria-controls="market-panel">${esc(t.title)}</button>`).join("")}
      </div>
      <div class="mw-panel" id="market-panel" role="tabpanel"></div>`;
  }

  function renderFeed() {
    const w = week();
    const day = DAYS[S.day];
    const hero = ITEMS[w.hero];
    const coll = collection();
    const value = $("#feed [data-coins]");
    value.textContent = formatCoins(S.coins);
    value.closest(".coin-balance").setAttribute("aria-label", `баланс: ${formatCoins(S.coins)} монет`);
    $$("#feed .market-tab").forEach((t) => {
      const on = t.dataset.tab === S.tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    $("#market-panel").setAttribute("aria-labelledby", `market-tab-${S.tab}`);
    // купленные стикерпаки – упаковками в „уже у тебя“; у хвостов – коллекция с эталона
    const ownedPacks = [...S.owned].map((id) => ITEMS[id]).filter((i) => i.kind === "стикерпак");
    $("#market-panel").innerHTML = `
      <section class="mw-block" aria-labelledby="week-title">
        <div class="mw-head">
          <h2 class="section-title" id="week-title">на этой неделе</h2>
          <span class="mw-head__note${S.day === "sun" ? " mw-head__note--soon" : ""}">${day.next}</span>
        </div>
        ${heroMarkup(hero)}
        <div class="mw-offers">${w.offers.map((id) => card(ITEMS[id])).join("")}</div>
      </section>

      <section class="mw-block" aria-labelledby="friends-title">
        <div class="mw-head">
          <h2 class="section-title" id="friends-title">у друзей</h2>
        </div>
        <div class="mw-shelf">${w.friends.map(friendCard).join("")}</div>
      </section>

      ${coll ? `
      <section class="mw-block" aria-labelledby="collection-title">
        <div class="mw-head">
          <h2 class="section-title" id="collection-title">${coll.title} <span class="section-title__count">${coll.until}</span></h2>
          <button class="more-link caps-label pressable" type="button" data-act="all">все <i class="icon icon--chevron" aria-hidden="true"></i></button>
        </div>
        <div class="mw-shelf mw-shelf--packs">${coll.items.map((id) => card(ITEMS[id], "mw-item--shelf")).join("")}</div>
      </section>` : ""}

      ${S.tab === "tails" ? `
      <section class="mw-owned" aria-labelledby="owned-title">
        <div class="market-section mw-owned__title">
          <h2 class="market-section__title" id="owned-title">уже у тебя</h2>
          <p class="market-section__text">хвосты в коллекции</p>
        </div>
        <div class="mw-owned__grid">
          ${cards(OWNED)}
          <span class="owned-card__selected mw-owned__selected"><span class="owned-card__check"><i class="icon icon--check" aria-hidden="true"></i></span>выбрано</span>
        </div>
      </section>

      <section class="mw-owned mw-archive" aria-labelledby="archive-title">
        <img class="mw-archive__tape" src="${A}/market/tape.webp" alt="">
        <div class="market-section mw-owned__title">
          <h2 class="market-section__title" id="archive-title">архив</h2>
          <p class="market-section__text">лимитированные хвосты,<br>которые остались в&nbsp;истории</p>
        </div>
        <div class="mw-owned__grid mw-owned__grid--two">${cards(ARCHIVE)}</div>
      </section>` : ownedPacks.length ? `
      <section class="mw-owned" aria-labelledby="owned-title">
        <div class="market-section mw-owned__title">
          <h2 class="market-section__title" id="owned-title">уже у тебя</h2>
          <p class="market-section__text">стикерпаки в коллекции</p>
        </div>
        <div class="market-grid mw-owned__packs">${ownedPacks.map((i) => card(i, "mw-item--grid")).join("")}</div>
      </section>` : ""}`;
  }

  function renderAll() {
    const coll = collection() || COLLECTIONS.tails;
    $("#all-title").textContent = coll.title;
    $("#all-grid").innerHTML = coll.items.map((id) => card(ITEMS[id], "mw-item--grid")).join("");
  }

  // ── Чат с лёвой ───────────────────────────────────────────────────────
  function renderChat() {
    $("#chat-feed").innerHTML = `
      <p class="chat-divider">сегодня</p>
      <div class="message-row message-row--in"><div class="bubble bubble--in">смотри, что у&nbsp;меня есть</div></div>
      <div class="message-row message-row--in is-continued">
        <button class="bubble bubble--sticker mw-chat-sticker pressable" type="button" data-item="zombie"
                aria-label="стикер из набора „жутко весело“">
          <img src="${A}/market/sticker-zombie.webp" alt="">
        </button>
      </div>
      <div class="message-row message-row--out"><div class="bubble bubble--out">ахах где взял</div></div>
      <div class="message-row message-row--in"><div class="bubble bubble--in">в маркете, на этой неделе</div></div>`;
  }

  // ── Шторка предмета ───────────────────────────────────────────────────
  // своя у каждого телефона: подложка – градиент маркета, шторка снизу, без крестика
  const sheets = new Map();

  function sheetFor(app) {
    if (sheets.has(app)) return sheets.get(app);
    app.insertAdjacentHTML(
      "beforeend",
      `<div class="mw-backdrop" data-close></div>
       <div class="sheet mw-sheet" role="dialog" aria-modal="true" tabindex="-1">
         <div class="sheet__handle" data-drag>
           <div class="sheet__grabber" aria-hidden="true"></div>
           <h2 class="mw-sheet__title" data-title></h2>
         </div>
         <div class="mw-sheet__body" data-body></div>
       </div>`
    );
    const ctx = { app, sheet: $(".mw-sheet", app), backdrop: $(".mw-backdrop", app), item: null, opener: null };
    ctx.sheet.setAttribute("aria-labelledby", (ctx.sheet.querySelector("[data-title]").id = `${app.id}-sheet-title`));
    ctx.backdrop.addEventListener("click", () => closeSheet(ctx));
    dragToClose(ctx);
    ctx.sheet.addEventListener("click", (e) => {
      if (e.target.closest("[data-buy]")) buy(ctx);
    });
    sheets.set(app, ctx);
    return ctx;
  }

  function previewMarkup(item) {
    if (item.tail)
      return `<div class="mw-preview mw-preview--map"><img class="mw-preview__tiles" src="${A}/market/map-tail.webp" alt="">${rider(item)}</div>`;
    if (item.sticker)
      return `<div class="mw-preview mw-preview--dots"><img class="mw-preview__sticker" src="${A}/${item.sticker}" alt=""></div>`;
    return `<div class="mw-preview mw-preview--dots"><img class="mw-preview__pack" src="${A}/${item.pack}" alt=""></div>`;
  }

  function friendsMarkup(item) {
    if (!item.friends) return `<p class="mw-sheet__friends mw-sheet__friends--none">такого предмета нет у&nbsp;друзей</p>`;
    const faces = FACES.slice(0, Math.min(3, item.friends));
    const more = item.friends - faces.length;
    return `
      <p class="mw-sheet__friends">
        <span class="mw-faces" aria-hidden="true">
          ${faces.map((id) => `<img class="mw-faces__img" src="${FRIENDS[id].photo}" alt="">`).join("")}
          ${more > 0 ? `<span class="mw-faces__more">+${more}</span>` : ""}
        </span>
        есть у&nbsp;${item.friends}&nbsp;${plural(item.friends, "друга", "друзей", "друзей")}
      </p>`;
  }

  // 1 друга / 2 друзей / 5 друзей – „есть у 1 друга“
  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function buyMarkup(item) {
    if (S.owned.has(item.id))
      return `<button class="button button--secondary mw-buy mw-buy--owned" type="button" data-buy disabled>
        <i class="icon icon--check" aria-hidden="true"></i>у тебя</button>`;
    return `<button class="button button--primary mw-buy pressable" type="button" data-buy>
      <span>купить</span>
      <span class="mw-buy__price"><img class="mw-buy__coin" src="${A}/market/coin.png" alt="">${formatCoins(item.price)}${
        item.old ? `<s class="mw-buy__old">${formatCoins(item.old)}</s>` : ""}</span>
    </button>`;
  }

  // тираж – полосой, как „осталось на складе“ в подарке; дата ухода – розовым: время идёт
  function fillSheet(ctx) {
    const item = ctx.item;
    const inWeek = TABS.some((t) => [week(t.id).hero, ...week(t.id).offers].includes(item.id));
    const coll = Object.values(COLLECTIONS).find((c) => c.items.includes(item.id));
    const leave = inWeek || !coll ? DAYS[S.day].leave : coll.until.replace("до", "в маркете до");
    const quoted = item.kind === "стикерпак" ? `„${item.name}“` : item.name;
    $("[data-title]", ctx.sheet).textContent = quoted;
    $("[data-body]", ctx.sheet).innerHTML = `
      <p class="mw-sheet__leave">${leave}</p>
      <p class="mw-sheet__text">${esc(item.text)}</p>
      ${item.stock && !S.owned.has(item.id) ? `
        <div class="mw-sheet__stock" role="img" aria-label="осталось ${item.stock.left} из ${item.stock.total}">
          <div class="mw-sheet__stock-bar"><div class="mw-sheet__stock-fill" style="--share:${item.stock.left / item.stock.total}"></div></div>
          <p class="mw-sheet__stock-meta"><span>осталось на&nbsp;складе</span><span><span class="mw-sheet__stock-count">${item.stock.left}</span><span class="mw-sheet__stock-total">/${item.stock.total}</span></span></p>
        </div>` : ""}
      ${previewMarkup(item)}
      ${friendsMarkup(item)}
      ${buyMarkup(item)}`;
  }

  function openSheet(app, id, opener) {
    const ctx = sheetFor(app);
    ctx.item = ITEMS[id];
    ctx.opener = opener;
    fillSheet(ctx);
    ctx.backdrop.classList.add("is-open");
    ctx.sheet.classList.add("is-open");
    $$(".screen, .tabbar", app).forEach((el) => (el.inert = true));
    requestAnimationFrame(() => ctx.sheet.focus({ preventScroll: true }));
  }

  function closeSheet(ctx) {
    if (!ctx.sheet.classList.contains("is-open")) return;
    ctx.sheet.classList.remove("is-open", "is-dragging");
    ctx.sheet.style.removeProperty("transform");
    ctx.backdrop.classList.remove("is-open");
    $$(".screen, .tabbar", ctx.app).forEach((el) => (el.inert = false));
    if (ctx.opener && ctx.opener.isConnected) ctx.opener.focus({ preventScroll: true });
  }

  // жест вниз за грэббер или заголовок: шторка идёт за пальцем, закрытие – по проекции броска
  function dragToClose(ctx) {
    const handle = $("[data-drag]", ctx.sheet);
    let drag = null;
    handle.addEventListener("pointerdown", (e) => {
      drag = { y: e.clientY, t: performance.now(), dy: 0, v: 0 };
      handle.setPointerCapture(e.pointerId);
      ctx.sheet.classList.add("is-dragging");
    });
    handle.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const z = ctx.app.getBoundingClientRect().height / ctx.app.offsetHeight || 1;
      drag.dy = Math.max(0, (e.clientY - drag.y) / z);
      drag.v = drag.dy / Math.max(1, performance.now() - drag.t);
      ctx.sheet.style.transform = `translateY(${drag.dy}px)`;
    });
    const end = () => {
      if (!drag) return;
      ctx.sheet.classList.remove("is-dragging");
      ctx.sheet.style.removeProperty("transform");
      if (drag.dy + drag.v * 200 > ctx.sheet.offsetHeight / 3) closeSheet(ctx);
      drag = null;
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  // покупка – как сейчас: одно нажатие „КУПИТЬ“; монеты списываются, кнопка на месте
  // становится „у тебя“, ценник в ленте – тоже
  function buy(ctx) {
    const item = ctx.item;
    if (S.owned.has(item.id) || S.coins < item.price) return;
    S.coins -= item.price;
    S.owned.add(item.id);
    fillSheet(ctx);
    ctx.sheet.focus({ preventScroll: true });
    rerender();
  }

  // ── Экран „все“ ───────────────────────────────────────────────────────
  const marketApp = $("#app-market");
  const all = $("#screen-all");
  let allOpener = null;

  function openAll(opener) {
    allOpener = opener;
    renderAll();
    all.hidden = false;
    requestAnimationFrame(() => {
      all.classList.add("is-open");
      marketApp.classList.add("has-push");
    });
    $("#screen-market").inert = true;
  }

  function closeAll() {
    if (all.hidden) return;
    all.classList.remove("is-open");
    marketApp.classList.remove("has-push");
    $("#screen-market").inert = false;
    setTimeout(() => (all.hidden = true), 300);
    if (allOpener && allOpener.isConnected) allOpener.focus({ preventScroll: true });
  }

  // ── События ───────────────────────────────────────────────────────────
  document.addEventListener("click", (e) => {
    const app = e.target.closest(".app");
    const item = e.target.closest("[data-item]");
    if (app && item && !e.target.closest(".mw-sheet")) return openSheet(app, item.dataset.item, item);
    const tab = e.target.closest(".market-tab");
    if (tab) return selectTab(tab.dataset.tab);
    const act = e.target.closest("[data-act]");
    if (!act) return;
    if (act.dataset.act === "all") openAll(act);
    if (act.dataset.act === "back") closeAll();
    if (act.dataset.act === "reset") reset();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const open = [...sheets.values()].find((ctx) => ctx.sheet.classList.contains("is-open"));
    if (open) closeSheet(open);
    else closeAll();
  });

  // вкладки переключаются мгновенно; стрелки двигают выбор, как у нативных вкладок
  function selectTab(id) {
    if (!WEEKS[id] || id === S.tab) return;
    S.tab = id;
    renderFeed();
  }

  $("#feed").addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step || !e.target.closest(".market-tab")) return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === S.tab);
    selectTab(TABS[(i + step + TABS.length) % TABS.length].id);
    $(`#market-tab-${S.tab}`).focus();
  });

  // пульт: день недели
  $$("[data-day]").forEach((b) =>
    b.addEventListener("click", () => {
      S.day = b.dataset.day;
      sheets.forEach(closeSheet);
      rerender();
      $("#market-scroll").scrollTop = 0;
    })
  );

  function rerender() {
    renderFeed();
    if (!all.hidden) renderAll();
    sheets.forEach((ctx) => ctx.sheet.classList.contains("is-open") && fillSheet(ctx));
    $$("[data-day]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.day === S.day)));
  }

  function reset() {
    sheets.forEach(closeSheet);
    closeAll();
    Object.assign(S, { tab: "tails", day: "thu", coins: 55000, owned: new Set() });
    rerender();
    $("#market-scroll").scrollTop = 0;
  }

  // ── Стенд в окне ──────────────────────────────────────────────────────
  function fit() {
    const phones = $("#stage-phones");
    if (innerWidth <= 480) return phones.style.removeProperty("--stage-zoom");
    // 874 – телефон и подпись над ним
    const room = innerHeight - $(".stage__head").offsetHeight - 80;
    const wide = (innerWidth - 48) / 1092;
    phones.style.setProperty("--stage-zoom", Math.min(1, room / 874, wide).toFixed(3));
  }
  fit();
  addEventListener("resize", fit);

  window.BlinkSky && window.BlinkSky.start($(".market__sky"), { mode: "stars" });

  // ?tab=stickers – вкладка; ?day=sun|mon – день; ?item=<id> – сразу шторка предмета; ?chat – она же в чате
  const q = new URLSearchParams(location.search);
  if (DAYS[q.get("day")]) S.day = q.get("day");
  if (WEEKS[q.get("tab")]) S.tab = q.get("tab");
  (q.get("owned") || "").split(",").filter((id) => ITEMS[id]).forEach((id) => S.owned.add(id));
  renderChat();
  renderShell();
  rerender();
  if (ITEMS[q.get("item")]) openSheet(q.has("chat") ? $("#app-chat") : marketApp, q.get("item"), null);
  if (q.has("all")) openAll(null);
  window.MarketWeek = { S, ITEMS, WEEKS, openSheet, rerender };
})();
