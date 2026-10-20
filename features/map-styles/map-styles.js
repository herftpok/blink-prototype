/*
 * Стили карты: покупка и выбор стиля в маркете (вкладка «стили»), вход из профиля
 * (карандаш → «стиль карты») и из настроек, экран стиля – стиль, тема, детализация,
 * переход к покупке того, чего у тебя нет. Документация – styles/SD1-Платные стили карты.pdf,
 * сценарии и решения – README.md рядом.
 *
 * Одно состояние на весь телефон: купил в маркете – стиль сразу надет и виден на экране стиля,
 * выбрал на экране стиля – «выбрано» переехало в маркете.
 */
(() => {
  "use strict";

  const A = "../../assets";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  const formatCoins = window.BlinkMarket.formatCoins;
  const app = $("#app");

  // 1 монета / 2 монеты / 5 монет
  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  // ── Люди ──────────────────────────────────────────────────────────────
  // ты – живая аватарка из своего фото профиля (people-around/me-live.webp)
  const ME = { name: "ты", live: `${A}/people-around/me-live.webp` };
  const FRIENDS = {
    lyova: { name: "лёва", photo: `${A}/people/photo-3.webp`, live: `${A}/people/live-3.webp` },
    sonya: { name: "соня", photo: `${A}/people/photo-4.webp`, live: `${A}/people/live-4.webp` },
    timur: { name: "тимур", photo: `${A}/people/photo-2.webp`, live: `${A}/people/live-2.webp` },
    vasya: { name: "вася", photo: `${A}/people/photo-5.webp` },
    natashka: { name: "наташка", photo: `${A}/people/photo-1.webp` },
  };
  const FACES = ["lyova", "sonya", "timur", "vasya", "natashka"];

  // ── Стили ─────────────────────────────────────────────────────────────
  // kind: base – есть у всех; season – только в blink vip, уходит вместе с подпиской;
  // custom – за монеты, остаётся навсегда, продаётся ограниченное время.
  // themes – светлая и тёмная тема (у сезонных и стандартного), detail – ползунок детализации;
  // art – картинки assets/map-styles (build_assets.py → build_map_styles); focus – что в кадре превью.
  // shots – снимки в шторке: тема (светлая и тёмная) или второй рендер.
  const STYLES = [
    { id: "standard", name: "стандартный", kind: "base", themes: true, detail: true, city: "петербург",
      art: { light: "standard-light", dark: "standard-dark" }, focus: "50% 50%" },
    { id: "winter", name: "зима", kind: "season", themes: true, detail: true, city: "петербург",
      art: { light: "winter-light", dark: "winter-dark" }, focus: "40% 45%",
      leave: "до весны", text: "снег на крышах, а по улицам ездят снегоуборочные машины. весной его сменит весенний стиль",
      shots: [{ theme: "light", label: "светлая", focus: "34% 42%" }, { theme: "dark", label: "тёмная", focus: "34% 42%" }],
      friends: 3 },
    { id: "gta", name: "гта", kind: "custom", price: 2500, city: "москва", stock: { left: 42, total: 100 }, detail: false,
      art: { light: "gta" }, focus: "50% 62%", packFocus: "50% 6%",
      text: "карта в цветах гта – тёмный асфальт и значки мест как в игре",
      shots: [{ focus: "50% 92%" }], friends: 5 },
    { id: "potter", name: "гарри поттер", kind: "custom", price: 3000, until: "31.01", detail: true, city: "москва",
      art: { light: "potter" }, focus: "50% 55%",
      text: "город на старом пергаменте, подписи от руки – как карта мародёров",
      shots: [{ focus: "50% 56%" }], friends: 0 },
    { id: "minecraft", name: "майнкрафт", kind: "custom", price: 3000, until: "30.11", detail: true, city: "петербург",
      art: { light: "minecraft" }, focus: "45% 50%",
      text: "весь город собран из кубиков, даже вода",
      shots: [{ focus: "45% 50%" }, { art: "minecraft-2", focus: "45% 52%" }], friends: 2 },
  ];
  const byId = (id) => STYLES.find((style) => style.id === id);
  const DETAIL = ["низкая", "средняя", "высокая"];
  const THEME = { light: "светлый", dark: "тёмный", system: "системный" };
  // рекомендуемая детализация зависит от телефона; на стенде телефон выбирают на пульте
  const DEVICES = { strong: 2, mid: 1, weak: 0 };

  // ── Состояние ─────────────────────────────────────────────────────────
  const START = { coins: 55000, vip: false, owned: ["standard"], current: "standard", theme: "light",
    device: "strong", detail: DEVICES.strong, appIcon: 1 };
  const S = {};

  function setState(next) {
    Object.assign(S, START, next, { owned: new Set(next.owned || START.owned) });
  }

  const owns = (style) => S.owned.has(style.id) || (style.kind === "season" && S.vip);
  // системная тема на стенде – светлая, как на эталоне standart-2.png
  const themeOf = (style) => (style.themes && S.theme === "dark" ? "dark" : "light");

  function artUrl(style, { theme = themeOf(style), art, detail = S.detail } = {}) {
    const base = art || style.art[theme] || style.art.light;
    const level = style.detail ? ["-low", "-mid", ""][detail] : "";
    return `${A}/map-styles/${base}${level}.webp`;
  }

  // картинка стиля для плиток, упаковок и «уже у тебя» – лёгкая копия; у стилей с темой – в выбранной теме
  const thumbUrl = (style) => `${A}/map-styles/${style.art[themeOf(style)] || style.art.light}-thumb.webp`;

  // ── Таб-бар: карта, маркет и ты; у друзей и чатов экранов в этой фиче нет ─
  // статус-бар и индикатор «домой»: на светлой карте – чёрные
  const BASE_STATUS = { map: "dark", profile: "dark", market: "light" };
  let tab = "profile";

  function showTab(next) {
    if (!BASE_STATUS[next]) return;
    tab = next;
    $("#screen-map").hidden = next !== "map";
    $("#screen-market").hidden = next !== "market";
    $("#screen-profile").hidden = next !== "profile";
    $$(".tabbar__item").forEach((item) => {
      if (item.dataset.tab === next) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    syncChrome();
  }

  // ── Профиль (profile/profile.png без «маркета», шестерёнка справа; данные – scripts/data.js) ─
  function renderProfile() {
    const me = window.BLINK_DATA.me;
    const s = me.stats;
    const fix = (path) => `../../${path}`;
    $("#profile-name").textContent = me.name;
    $("#profile-bio").textContent = me.bio;
    $("#profile-city").textContent = me.city;
    $("#profile-username").textContent = me.username;
    $("#profile-gifts").innerHTML = me.gifts
      .map((g) => `<img class="gift" src="${fix(g.src)}" alt="${esc(g.label)}" style="--dx:${g.dx};--dy:${g.dy};--w:${g.w}">`)
      .join("");
    const sticker = (value) => `<span class="sticker-number">${esc(value)}</span>`;
    $("#stat-friends").insertAdjacentHTML("beforeend", sticker(s.friends));
    $("#stat-friends-new").textContent = `+${s.friendsNew}`;
    $("#stat-views").insertAdjacentHTML("beforeend", sticker(s.views));
    $("#stat-stars").insertAdjacentHTML("beforeend", sticker(s.stars));
    $("#stat-stars-new").textContent = `+${s.starsNew}`;
    $("#stat-checkins").insertAdjacentHTML("beforeend", sticker(s.checkins));
    $("#edit-username").value = me.username;
    $("#edit-name").value = me.name;
    $("#edit-bio").value = me.bio;
  }

  // ── Маркет: вкладка «стили» ───────────────────────────────────────────
  // Новинка – крупно наверху, остальные стили – сеткой в две колонки (правило 33: второй крупный блок
  // другой формы), ниже – «уже у тебя». Упаковка – снимок: твоя карта в этом стиле в белой рамке,
  // с твоим пином. Названий в маркете нет – стиль видно по карте, название – в шторке стиля
  let market = null;
  let shop = null;

  const pinOf = (who, size, extra = {}) =>
    window.BlinkPin.markup({ name: who.name, photo: who.live, size, tag: "span", assets: A, ...extra });

  function artMarkup(style, hero) {
    return `
      <span class="ms-photo" aria-hidden="true">
        <span class="ms-photo__map"><img src="${thumbUrl(style)}" alt="" style="object-position:${style.packFocus || style.focus}"></span>
        <span class="ms-photo__pin">${pinOf(ME, hero ? 52 : 36)}</span>
      </span>`;
  }

  function chipMarkup(style) {
    if (owns(style))
      return `<span class="price-chip ms-chip ms-chip--owned"><span class="ms-chip__check"><i class="icon icon--check" aria-hidden="true"></i></span>у тебя</span>`;
    const stock = style.stock ? `<span class="ms-chip__stock">осталось ${style.stock.left}</span>` : "";
    return `<span class="price-chip price-chip--coins ms-chip"><img class="price-chip__coin" src="${A}/market/coin.png" alt="">${formatCoins(style.price)}${stock}</span>`;
  }

  function packLabel(style) {
    if (owns(style)) return `стиль карты «${style.name}», у тебя`;
    const stock = style.stock ? `, осталось ${style.stock.left}` : "";
    return `стиль карты «${style.name}», ${formatCoins(style.price)} ${plural(style.price, "монета", "монеты", "монет")}${stock}`;
  }

  function packMarkup(style, hero) {
    return `
      <button class="ms-pack ms-pack--${hero ? "hero" : "grid"} pressable" type="button" data-sheet="${style.id}"
              aria-label="${esc(packLabel(style))}">
        <span class="ms-pack__art">${artMarkup(style, hero)}</span>
        ${chipMarkup(style)}
      </button>`;
  }

  // «уже у тебя»: нажатие открывает шторку стиля с «НАДЕТЬ»; надетый – с лаймовой рамкой и «выбрано»
  function ownedMarkup() {
    return STYLES.filter(owns)
      .map((style) => {
        const on = style.id === S.current;
        return `
          <button class="ms-owned pressable" type="button" data-sheet="${style.id}" aria-haspopup="dialog"
                  aria-label="${esc(`${style.name}${style.kind === "season" ? ", в blink vip" : ""}${on ? ", выбран" : ""}`)}"
                  data-on="${on}">
            <span class="ms-owned__thumb"><img src="${thumbUrl(style)}" alt="" style="object-position:${style.focus}"></span>
            ${style.kind === "season" ? `<img class="ms-owned__vip" src="${A}/market/vip-star.png" alt="">` : ""}
            ${on ? `<span class="owned-card__selected ms-owned__selected"><span class="owned-card__check"><i class="icon icon--check" aria-hidden="true"></i></span>выбрано</span>` : ""}
          </button>`;
      })
      .join("");
  }

  function renderShop() {
    if (!shop) return;
    const [hero, ...rest] = STYLES.filter((style) => style.kind === "custom");
    shop.innerHTML = `
      <div class="ms-shop">
        ${packMarkup(hero, true)}
        <div class="ms-shop__grid">${rest.map((style) => packMarkup(style, false)).join("")}</div>
        <div class="ms-shop__section">
          <h2 class="market-section__title">уже у тебя</h2>
          <p class="market-section__text">стили в коллекции</p>
        </div>
        <div class="ms-shop__owned">${ownedMarkup()}</div>
      </div>`;
  }

  // ── Экран «стиль карты» ───────────────────────────────────────────────
  function tileMarkup(style) {
    const mine = owns(style);
    const on = style.id === S.current;
    let chip = "";
    let label = style.name;
    if (!mine && style.kind === "season") {
      chip = `<span class="ms-tile__chip"><img class="ms-tile__vip" src="${A}/market/vip-star.png" alt="">vip</span>`;
      label += ", в blink vip";
    } else if (!mine) {
      chip = `<span class="ms-tile__chip"><img class="ms-tile__coin" src="${A}/market/coin.png" alt="">${formatCoins(style.price)}</span>`;
      label += `, ${formatCoins(style.price)} ${plural(style.price, "монета", "монеты", "монет")}`;
    }
    return `
      <button class="ms-tile pressable${mine ? "" : " ms-tile--locked"}" type="button" data-tile="${style.id}"
              ${mine ? `aria-pressed="${on}"` : 'aria-haspopup="dialog"'} aria-label="${esc(label)}">
        <span class="ms-tile__thumb"><img src="${thumbUrl(style)}" alt="" style="object-position:${style.focus}"></span>
        ${chip}
        <span class="ms-tile__name">${esc(style.name)}</span>
      </button>`;
  }

  function renderPicker() {
    const picker = $("#picker");
    const scroll = picker.scrollLeft;
    picker.innerHTML = STYLES.map(tileMarkup).join("");
    picker.scrollLeft = scroll;
  }

  // превью: новая картинка проявляется поверх старой, старая уходит после перехода
  function renderPreview({ instant = false } = {}) {
    const style = byId(S.current);
    const map = $("#preview-map");
    const url = artUrl(style);
    const top = map.lastElementChild;
    if (top && top.dataset.url === url) return;
    const img = new Image();
    img.className = "ms-preview__img";
    img.alt = "";
    img.dataset.url = url;
    img.src = url;
    img.style.objectPosition = style.focus;
    map.append(img);
    const done = () => [...map.children].slice(0, -1).forEach((old) => old.remove());
    if (instant || !top) {
      img.classList.add("is-in");
      done();
    } else {
      const show = () => requestAnimationFrame(() => img.classList.add("is-in"));
      if (img.complete) show();
      else img.addEventListener("load", show, { once: true });
      setTimeout(done, 400);
    }
    const theme = style.themes ? `, ${THEME[S.theme]} тема` : "";
    const detail = style.detail ? `, детализация ${DETAIL[S.detail]}` : "";
    $("#preview").setAttribute("aria-label", `карта в стиле «${style.name}»${theme}${detail}`);
  }

  // Тема и детализация есть всегда; у стиля, где их нет, они выключены и подписано почему.
  // Уровень детализации видно под ползунком – отдельно не повторяем. Большой палец – уровень,
  // который советуем этому телефону
  function renderOptions() {
    const style = byId(S.current);
    const themeBox = $("#theme");
    themeBox.classList.toggle("is-off", !style.themes);
    $$("#theme [data-theme]").forEach((button) => {
      const on = style.themes ? button.dataset.theme === S.theme : button.dataset.theme === "light";
      button.setAttribute("aria-checked", String(on));
      button.disabled = !style.themes;
      button.tabIndex = on ? 0 : -1;
    });
    const themeNote = $("#theme-note");
    themeNote.hidden = style.themes;
    themeNote.textContent = style.themes ? "" : `в «${style.name}» только светлая тема`;

    const box = $("#detail");
    const input = $("#detail-input");
    const rec = DEVICES[S.device];
    box.classList.toggle("is-off", !style.detail);
    input.disabled = !style.detail;
    input.value = String(S.detail);
    input.setAttribute("aria-valuetext", style.detail ? DETAIL[S.detail] : "не настраивается");
    box.style.setProperty("--value", S.detail);
    $$("#detail .ms-detail__tick").forEach((tick, i) => tick.classList.toggle("is-on", i <= S.detail));
    $$("#detail [data-stop]").forEach((stop) => {
      const i = Number(stop.dataset.stop);
      stop.classList.toggle("is-recommended", style.detail && i === rec);
      stop.classList.toggle("is-on", style.detail && i === S.detail);
    });
    $("#detail-note").innerHTML = style.detail
      ? `чем выше, тем больше на&nbsp;карте домов и&nbsp;деревьев.
         <span class="ms-note__line"><img class="ms-note__sticker" src="${A}/stickers/thumbs-up.webp" alt="большой палец"> – советуем для&nbsp;твоего телефона</span>`
      : `в «${esc(style.name)}» меняются только цвета и&nbsp;значки – настраивать нечего`;
  }

  // ── Карта в надетом стиле ─────────────────────────────────────────────
  // стандартный светлый – подложка карты приложения (Map/map_background.png), остальные – картинка стиля
  function mapArt(style) {
    if (style.id === "standard" && themeOf(style) === "light") return `${A}/map/map-hd.webp`;
    return artUrl(style);
  }

  function renderMap() {
    const style = byId(S.current);
    const tiles = $("#map-tiles");
    const url = mapArt(style);
    if (tiles.getAttribute("src") !== url) tiles.src = url;
    tiles.style.objectPosition = style.focus;
    $("#map-city").textContent = style.city;
  }

  // Стиль поменялся сам – баннер над «мой мир»: какой стиль надели и почему, «отменить» возвращает
  // прежний, крестик – убирает баннер. Решение пользователя (п. 3a документа); у других экранов Blink
  // тостов нет, это единственный такой баннер – на карте, лёгкий, без подложки-плашки
  let changed = null;                     // { from, to } – что вернуть по «отменить»

  function showUpdate(from, to, why) {
    changed = { from, to };
    const style = byId(to);
    $("#style-update-thumb").src = thumbUrl(style);
    $("#style-update-thumb").style.objectPosition = style.focus;
    $("#style-update-title").textContent = `на карте ${style.name}`;
    $("#style-update-note").textContent = why;
    const box = $("#style-update");
    box.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("is-in")));
  }

  function hideUpdate() {
    const box = $("#style-update");
    changed = null;
    box.classList.remove("is-in");
    setTimeout(() => { if (!box.classList.contains("is-in")) box.hidden = true; }, 300);
  }

  function undoUpdate() {
    if (!changed) return;
    S.current = changed.from;
    renderAll();
    hideUpdate();
  }

  // значения в шторках профиля
  function renderEntries() {
    const style = byId(S.current);
    $$("[data-style-name]").forEach((node) => (node.textContent = style.name));
  }

  function renderAll() {
    renderMap();
    renderShop();
    renderPicker();
    renderPreview();
    renderOptions();
    renderEntries();
    if (market) market.setCoins(S.coins);
    if (sheetStyle) fillItem();
  }

  function select(id) {
    const style = byId(id);
    if (!style || !owns(style) || S.current === id) return;
    S.current = id;
    renderAll();
  }

  // ── Шторка стиля: карточка товара ─────────────────────────────────────
  // Снимки – как стиль выглядит у тебя: твой пин в центре, рядом друзья (лёва в сети – 36, соня
  // дома – 20). У стилей с темами – светлая и тёмная. Под описанием – что в стиле настраивается.
  let sheetStyle = null;

  function shotMarkup(style, shot) {
    const art = artUrl(style, { theme: shot.theme || "light", art: shot.art, detail: 2 });
    const pin = (who, size, extra) => window.BlinkPin.markup({ name: who.name, photo: who.live, size, tag: "span", assets: A, ...extra });
    return `
      <figure class="ms-shot">
        <img class="ms-shot__map" src="${art}" alt="" style="object-position:${shot.focus || style.focus}">
        <span class="ms-shot__pin" style="--x:27%;--y:36%">${pin(FRIENDS.lyova, 36, { online: true, state: "staying", minutes: 12 })}</span>
        <span class="ms-shot__pin" style="--x:80%;--y:28%">${pin(FRIENDS.sonya, 20, { state: "home" })}</span>
        <span class="ms-shot__pin" style="--x:56%;--y:70%">${pin(ME, 52, { state: "moving", speed: 5 })}</span>
        ${shot.label ? `<figcaption class="ms-shot__label">${esc(shot.label)}</figcaption>` : ""}
      </figure>`;
  }

  // какая у стиля тема: светлая и тёмная – или только светлая (серым), одной строкой под описанием
  function themeMarkup(style) {
    return `
      <p class="ms-theme-row${style.themes ? "" : " is-off"}">
        <span class="ms-theme-row__label">тема</span>
        <span class="ms-theme-row__value">${style.themes ? "светлая и тёмная" : "только светлая"}</span>
      </p>`;
  }

  function friendsMarkup(style) {
    if (!style.friends) return `<p class="ms-item__friends ms-item__friends--none">такого стиля нет у&nbsp;друзей</p>`;
    const faces = FACES.slice(0, Math.min(3, style.friends));
    const more = style.friends - faces.length;
    return `
      <p class="ms-item__friends">
        <span class="ms-faces" aria-hidden="true">
          ${faces.map((id) => `<img class="ms-faces__img" src="${FRIENDS[id].photo}" alt="">`).join("")}
          ${more > 0 ? `<span class="ms-faces__more">+${more}</span>` : ""}
        </span>
        есть у&nbsp;${style.friends}&nbsp;${plural(style.friends, "друга", "друзей", "друзей")}
      </p>`;
  }

  // надетый стиль – выключенная кнопка: без подложки, серым «уже выбрано» (Buttons/Button-8.png)
  function ctaMarkup(style) {
    if (owns(style) && style.id === S.current)
      return `<button class="button ms-cta ms-cta--center" type="button" disabled>уже выбрано</button>`;
    if (owns(style))
      return `<button class="button button--primary ms-cta ms-cta--center pressable" type="button" data-act="wear">надеть</button>`;
    if (style.kind === "season")
      return `<button class="button button--primary ms-cta ms-cta--center pressable" type="button" data-act="vip">
        <img class="ms-cta__vip" src="${A}/market/vip-star.png" alt="">оформить blink vip</button>`;
    return `<button class="button button--primary ms-cta pressable" type="button" data-act="buy">
      <span>купить</span>
      <span class="ms-cta__price"><img class="ms-cta__coin" src="${A}/market/coin.png" alt="">${formatCoins(style.price)}</span>
    </button>`;
  }

  // срок – розовым (время идёт), тираж – полосой «осталось на складе», как у подарков
  function fillItem() {
    const style = byId(sheetStyle);
    const mine = owns(style);
    const leave = style.kind === "season" ? `с blink vip – ${style.leave}` : style.until && !mine ? `в маркете до ${style.until}` : "";
    const text = style.text || "обычная карта blink";
    $("#item-title").textContent = style.name;
    const shots = style.shots || [{ theme: "light", label: "светлая" }, { theme: "dark", label: "тёмная" }];
    $("#item-body").innerHTML = `
      ${leave ? `<p class="ms-item__leave">${esc(leave)}</p>` : ""}
      <p class="ms-item__text">${esc(text)}</p>
      ${themeMarkup(style)}
      ${style.stock && !mine ? `
        <div class="ms-item__stock" role="img" aria-label="осталось ${style.stock.left} из ${style.stock.total}">
          <div class="ms-item__stock-bar"><div class="ms-item__stock-fill" style="--share:${style.stock.left / style.stock.total}"></div></div>
          <p class="ms-item__stock-meta"><span>осталось на&nbsp;складе</span><span><span class="ms-item__stock-count">${style.stock.left}</span><span class="ms-item__stock-total">/${style.stock.total}</span></span></p>
        </div>` : ""}
      <div class="ms-shots${shots.length > 1 ? " ms-shots--many" : ""}" aria-hidden="true">
        ${shots.map((shot) => shotMarkup(style, shot)).join("")}
      </div>
      ${shots.length > 1 ? `<p class="ms-dots" aria-hidden="true">${shots.map((_, i) => `<span class="ms-dots__dot${i ? "" : " is-on"}"></span>`).join("")}</p>` : ""}
      ${style.kind === "base" ? "" : friendsMarkup(style)}
      ${ctaMarkup(style)}`;
    const strip = $(".ms-shots", $("#item-body"));
    strip.addEventListener("scroll", () => {
      const i = Math.round(strip.scrollLeft / strip.firstElementChild.offsetWidth);
      $$(".ms-dots__dot", $("#item-body")).forEach((dot, k) => dot.classList.toggle("is-on", k === i));
    }, { passive: true });
  }

  // покупка – одно нажатие «КУПИТЬ»: монеты списываются, стиль сразу надет (как в доке, п. 3) –
  // кнопка на месте становится «уже выбрано»
  function buy() {
    const style = byId(sheetStyle);
    if (owns(style) || S.coins < style.price) return;
    S.coins -= style.price;
    S.owned.add(style.id);
    S.current = style.id;
    renderAll();
    $("#sheet-item").focus({ preventScroll: true });
  }

  function wear() {
    select(sheetStyle);
    $("#sheet-item").focus({ preventScroll: true });
  }

  // ── Настройки: иконка приложения выбирается на месте ──────────────────
  function renderIcons() {
    $$("#app-icons [data-icon]").forEach((button) => {
      const on = Number(button.dataset.icon) === S.appIcon;
      button.setAttribute("aria-checked", String(on));
      button.tabIndex = on ? 0 : -1;
    });
  }

  // ── Слои: шторки и экран стиля ────────────────────────────────────────
  // Порядок снизу вверх: профиль или маркет → редактирование или настройки → экран стиля → шторка стиля.
  // Открытый слой делает всё под собой inert; Esc, нажатие мимо и жест вниз закрывают только верхний.
  const LAYERS = {
    edit: { el: () => $("#sheet-edit"), backdrop: "edit", status: "dark" },
    settings: { el: () => $("#sheet-settings"), backdrop: "settings", status: "dark" },
    style: { el: () => $("#screen-style"), status: "light" },
    item: { el: () => $("#sheet-item"), backdrop: "item", status: "dark" },
  };
  const stack = [];

  function syncChrome() {
    const top = stack[stack.length - 1];
    app.dataset.status = top ? LAYERS[top.name].status : BASE_STATUS[tab];
    app.dataset.home = !top && tab === "map" ? "dark" : "light";
    $$(".screen, .tabbar", app).forEach((el) => (el.inert = stack.length > 0));
    Object.entries(LAYERS).forEach(([name, layer]) => {
      layer.el().inert = !top || top.name !== name;
    });
  }

  function open(name, opener, { focus = true } = {}) {
    if (stack.some((layer) => layer.name === name)) return;
    const layer = LAYERS[name];
    const el = layer.el();
    stack.push({ name, opener });
    if (layer.backdrop) $(`[data-backdrop="${layer.backdrop}"]`).classList.add("is-open");
    if (name === "style") {
      el.hidden = false;
      renderPicker();
      renderPreview({ instant: true });
      renderOptions();
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-open")));
    } else {
      el.classList.add("is-open");
    }
    syncChrome();
    if (focus) requestAnimationFrame(() => el.focus({ preventScroll: true }));
  }

  function close(name) {
    const at = stack.findIndex((layer) => layer.name === name);
    if (at < 0) return;
    const [{ opener }] = stack.splice(at, 1);
    const layer = LAYERS[name];
    const el = layer.el();
    el.classList.remove("is-open", "is-dragging");
    el.style.removeProperty("transform");
    if (layer.backdrop) $(`[data-backdrop="${layer.backdrop}"]`).classList.remove("is-open");
    if (name === "style") setTimeout(() => { if (!el.classList.contains("is-open")) el.hidden = true; }, 420);
    if (name === "item") sheetStyle = null;
    syncChrome();
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  }

  const closeTop = () => stack.length && close(stack[stack.length - 1].name);

  function closeAll() {
    [...stack].reverse().forEach((layer) => close(layer.name));
  }

  function openItem(id, opener) {
    sheetStyle = id;
    fillItem();
    open("item", opener);
  }

  // жест вниз за грэббер или заголовок: шторка идёт за пальцем, решение – по проекции броска
  function dragToClose(name) {
    const sheet = LAYERS[name].el();
    const handle = $("[data-drag]", sheet);
    let drag = null;
    handle.addEventListener("pointerdown", (e) => {
      drag = { y: e.clientY, t: performance.now(), dy: 0, v: 0 };
      handle.setPointerCapture(e.pointerId);
      sheet.classList.add("is-dragging");
    });
    handle.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const zoom = app.getBoundingClientRect().height / app.offsetHeight || 1;
      drag.dy = Math.max(0, (e.clientY - drag.y) / zoom);
      drag.v = drag.dy / Math.max(1, performance.now() - drag.t);
      sheet.style.transform = `translateY(${drag.dy}px)`;
    });
    const end = () => {
      if (!drag) return;
      sheet.classList.remove("is-dragging");
      sheet.style.removeProperty("transform");
      if (drag.dy + drag.v * 200 > sheet.offsetHeight / 3) close(name);
      drag = null;
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }
  ["edit", "settings", "item"].forEach(dragToClose);

  // ── События ───────────────────────────────────────────────────────────
  app.addEventListener("click", (e) => {
    const t = e.target;
    const backdrop = t.closest("[data-backdrop]");
    if (backdrop) return close(backdrop.dataset.backdrop);
    const tabButton = t.closest(".tabbar__item");
    if (tabButton) return showTab(tabButton.dataset.tab);
    const opener = t.closest("[data-open]");
    if (opener) return open(opener.dataset.open, opener);
    if (t.closest("[data-close]")) return close(t.closest("#screen-style") ? "style" : "edit");
    const pack = t.closest("[data-sheet]");
    if (pack) return openItem(pack.dataset.sheet, pack);
    const tile = t.closest("[data-tile]");
    if (tile) {
      const style = byId(tile.dataset.tile);
      return owns(style) ? select(style.id) : openItem(style.id, tile);
    }
    const theme = t.closest("[data-theme]");
    if (theme && !theme.disabled) {
      S.theme = theme.dataset.theme;
      renderAll();
      return;
    }
    const icon = t.closest("[data-icon]");
    if (icon) {
      S.appIcon = Number(icon.dataset.icon);
      renderIcons();
      return;
    }
    const act = t.closest("[data-act]");
    if (!act) return;
    if (act.dataset.act === "buy") buy();
    if (act.dataset.act === "wear") wear();
    if (act.dataset.act === "undo-style") undoUpdate();
    if (act.dataset.act === "close-update") hideUpdate();
    // «оформить blink vip» – лендинга подписки в задаче нет: кнопка только отвечает на нажатие
  });

  // стрелки двигают выбор темы и иконки приложения, как у нативного переключателя
  function arrows(group, list, get, set) {
    $(group).addEventListener("keydown", (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!step || !list().length) return;
      e.preventDefault();
      const items = list();
      set(items[(items.indexOf(get()) + step + items.length) % items.length]);
    });
  }
  arrows("#theme", () => (byId(S.current).themes ? Object.keys(THEME) : []), () => S.theme, (value) => {
    S.theme = value;
    renderAll();
    $(`#theme [data-theme="${value}"]`).focus();
  });
  arrows("#app-icons", () => [1, 2, 3, 4], () => S.appIcon, (value) => {
    S.appIcon = value;
    renderIcons();
    $(`#app-icons [data-icon="${value}"]`).focus();
  });

  $("#detail-input").addEventListener("input", (e) => {
    S.detail = Number(e.target.value);
    renderOptions();
    renderPreview();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && stack.length) {
      e.preventDefault();
      closeTop();
    }
  });

  // ── Пульт стенда ──────────────────────────────────────────────────────
  function show(what) {
    closeAll();
    if (what === "map") showTab("map");
    if (what === "market") {
      showTab("market");
      market.selectTab("styles");
      $("#screen-market .screen__scroll").scrollTop = 0;
    }
    if (what === "edit" || what === "settings") {
      showTab("profile");
      open(what, $(`[data-open="${what}"]`));
      $(`#sheet-${what} .ms-page__scroll`).scrollTop = 0;
    }
  }

  function syncPanel() {
    $$("[data-vip]").forEach((button) => button.setAttribute("aria-checked", String((button.dataset.vip === "on") === S.vip)));
    $$("[data-device]").forEach((button) => button.setAttribute("aria-checked", String(button.dataset.device === S.device)));
  }

  // Оформил blink vip – сезонный стиль надевается сам (п. 3a документа): карта с баннером «на карте
  // зима», можно отменить. Подписка кончилась – сезонный стиль уходит, возвращается стандартный
  function setVip(on) {
    if (on === S.vip) return;
    S.vip = on;
    const from = S.current;
    if (on) S.current = "winter";
    if (!on && byId(S.current).kind === "season") S.current = "standard";
    renderAll();
    syncPanel();
    if (on && from !== "winter") {
      closeAll();
      showTab("map");
      showUpdate(from, "winter", "стиль из blink vip");
    }
    if (!on) hideUpdate();
  }

  document.addEventListener("click", (e) => {
    const vip = e.target.closest("[data-vip]");
    if (vip) return setVip(vip.dataset.vip === "on");
    // другой телефон – другая рекомендуемая детализация; ползунок встаёт на неё
    const device = e.target.closest("[data-device]");
    if (device) {
      S.device = device.dataset.device;
      S.detail = DEVICES[S.device];
      renderAll();
      syncPanel();
      return;
    }
    const action = e.target.closest("[data-show]");
    if (!action) return;
    if (action.dataset.show === "reset") {
      closeAll();
      setState({});
      renderAll();
      renderIcons();
      syncPanel();
      showTab("profile");
      return;
    }
    show(action.dataset.show);
  });

  // ── Стенд в окне: телефон и пульт целиком ─────────────────────────────
  function fit() {
    const phones = $("#stage-phones");
    if (innerWidth <= 480) return phones.style.removeProperty("--stage-zoom");
    const room = innerHeight - $(".stage__head").offsetHeight - 80;
    const wide = (innerWidth - 48) / 654;
    phones.style.setProperty("--stage-zoom", Math.min(1, room / 874, wide).toFixed(3));
  }
  addEventListener("resize", fit);

  // ── Старт ─────────────────────────────────────────────────────────────
  // ссылки на состояния: ?vip=1, ?owned=gta,potter, ?current=gta, ?theme=dark, ?detail=0, ?device=weak,
  // ?open=map|market|edit|settings|style|item:<id>;
  // или ?state=<id> – состояние из раскладки (states.js)
  const url = new URLSearchParams(location.search);
  const preset = (window.MapStylesStates?.STATES || []).find((state) => state.id === url.get("state"));
  const params = preset ? new URLSearchParams(preset.query) : url;

  // шаги после открытия – чтобы дойти до состояния раскладки
  const ACTS = {
    // лента маркета – до «уже у тебя»
    "market-owned": () => {
      const scroll = $("#screen-market .screen__scroll");
      let y = 0;
      for (let el = $(".ms-shop__section"); el && el !== scroll; el = el.offsetParent) y += el.offsetTop;
      scroll.scrollTop = y - 150;
    },
    owned: (id) => openItem(id, $(`.ms-owned[data-sheet="${id}"]`)),
    buy: () => buy(),
    wear: () => wear(),
    "edit-end": () => ($("#sheet-edit .ms-page__scroll").scrollTop = 1e5),
    "settings-end": () => ($("#sheet-settings .ms-page__scroll").scrollTop = 1e5),
    "picker-end": () => ($("#picker").scrollLeft = 1e5),
    "style-end": () => ($(".ms-style__scroll").scrollTop = 1e5),
    tile: (id) => openItem(id, $(`#picker [data-tile="${id}"]`)),
    "vip-on": () => setVip(true),
  };
  const device = DEVICES[params.get("device")] !== undefined ? params.get("device") : START.device;
  setState({
    vip: params.get("vip") === "1",
    owned: ["standard", ...(params.get("owned") || "").split(",").filter(byId)],
    theme: THEME[params.get("theme")] ? params.get("theme") : START.theme,
    device,
    detail: params.has("detail") ? Math.max(0, Math.min(2, Number(params.get("detail")) || 0)) : DEVICES[device],
  });
  const wanted = byId(params.get("current"));
  if (wanted && owns(wanted)) S.current = wanted.id;

  renderProfile();
  $("#preview-pin").innerHTML = window.BlinkPin.markup({ name: ME.name, photo: ME.live, size: 52, tag: "span", assets: A });
  // друзья на карте – пины 52 / 36 / 20 по близости, ты – в середине
  $("#map-pins").innerHTML = [
    window.BlinkPin.markup({ name: "наташка", photo: `${A}/people/live-1.webp`, size: 52, state: "home", minutes: 22, tag: "span", assets: A, attrs: 'style="--x:96;--y:300"' }),
    window.BlinkPin.markup({ name: FRIENDS.lyova.name, photo: FRIENDS.lyova.live, size: 36, online: true, state: "staying", minutes: 12, tag: "span", assets: A, attrs: 'style="--x:286;--y:250"' }),
    window.BlinkPin.markup({ name: FRIENDS.sonya.name, photo: FRIENDS.sonya.live, size: 20, state: "home", tag: "span", assets: A, attrs: 'style="--x:300;--y:520"' }),
    window.BlinkPin.markup({ name: ME.name, photo: ME.live, size: 52, tag: "span", assets: A, attrs: 'style="--x:180;--y:470"' }),
  ].join("");
  market = window.BlinkMarket.mount($("#screen-market"), {
    assets: A,
    coins: S.coins,
    extraTabs: [{ id: "styles", title: "стили", render: (panel) => (shop = panel) }],
    initialTab: "styles",
  });
  renderAll();
  renderIcons();
  syncPanel();
  fit();
  showTab("profile");

  const openParam = params.get("open") || "";
  if (openParam === "map") show("map");
  if (openParam === "market") show("market");
  if (openParam === "edit" || openParam === "settings") show(openParam);
  if (openParam === "style") {
    show("settings");
    open("style", $('#sheet-settings [data-open="style"]'), { focus: false });
  }
  if (openParam.startsWith("item:") && byId(openParam.slice(5))) {
    show("market");
    openItem(openParam.slice(5), null);
  }
  (preset?.act || []).forEach((step) => {
    const [name, arg] = step.split(":");
    if (ACTS[name]) ACTS[name](arg);
  });
})();
