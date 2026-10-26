/*
 * Канал маркета: бот, который пишет о розыгрышах, скидках и новинках.
 * Доработки: история для новорегов, закреп под шапкой, цифра на кнопке (срок, остаток, участники),
 * товар вместо картинки поста с модалкой товара и личные сообщения с личной скидкой.
 * Описание для разработки – states.html и README.
 *
 * Стенд: ?state=<id> из states.js открывает канал в нужном состоянии, пульт справа меняет
 * зрителя, время, остаток и закрепы. Всё, что внутри телефона, – продукт.
 */
(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const A = "../../assets";
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const plural = (n, [one, few, many]) => {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };
  const pad = (n) => String(n).padStart(2, "0");
  const NBSP = " ";
  // числа в формате приложения: 1 248, 12.4k
  const formatCount = (n) => (n >= 10000
    ? `${(Math.floor(n / 100) / 10).toFixed(1).replace(/\.0$/, "")}k`
    : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP));

  /* ── Данные канала ─────────────────────────────────────────────────── */

  // Моменты стенда: «сейчас», последний день акций, после них
  const CLOCKS = {
    now: "2026-10-23T14:17:53",
    last: "2026-10-31T14:17:53",
    after: "2026-11-01T10:00:00",
  };

  const VIEWERS = {
    leva: { name: "лёва", joined: "2026-10-23" },
    sonya: { name: "соня", joined: "2026-03-14" },
  };

  // Участники розыгрыша в каждый момент стенда; дальше растут сами, пока розыгрыш идёт
  const PEOPLE = { now: 1248, last: 12437, after: 12890 };

  // Товары маркета, на которые ссылаются посты и кнопки: обложка – та же, что в витрине маркета.
  // stock – остаток на складе, sale – общая скидка до даты, archive – когда товар уйдёт в архив
  const ITEMS = {
    gold: {
      name: "золото", cover: `${A}/market/tails/gold-poster.webp`, video: `${A}/market/tails/gold.mp4`,
      price: 777, total: 100, friends: 5,
      text: "монеты сыплются за твоим пином, пока ты в пути. последняя партия – больше не будет",
    },
    pixels: {
      name: "пиксели", cover: `${A}/market/tail-pixel.webp`, price: 500, friends: 2,
      text: "восьмибитный след за твоим пином – как в старых играх",
    },
    fire: {
      name: "огонь", cover: `${A}/market/tail-fire-sale.webp`, price: 500, friends: 3,
      sale: { price: 350, ends: "2026-10-21T00:00:00" },
      text: "живой огонь за твоим пином, пока ты в пути",
    },
    spooky: {
      name: "«жутко весело»", cover: `${A}/market/items/zombie-box-new.webp`, price: 300, friends: 5,
      archive: "2026-11-01T00:00:00",
      text: "мышь, привидение, тыква и зомби – пак оживает по ночам и в твоих чатах",
    },
  };

  // Личные предложения: у лёвы пиксели за 300 до полуночи
  const OFFERS = {
    leva: { item: "pixels", price: 300, ends: "2026-10-24T00:00:00" },
  };

  // Розыгрыши – то, что отдаёт ручка розыгрыша: участники, конец, участвует ли зритель
  const RAFFLES = {
    first: { participants: 3120, ends: "2026-10-16T00:00:00" },
    golden: { live: true, ends: "2026-11-01T00:00:00" },
  };

  const FACES = ["photo-3", "photo-4", "photo-2", "photo-5", "photo-1"];

  /*
   * Посты канала по порядку. text – обычное сообщение (серое). media – картинка или item – id товара:
   * тогда вместо картинки обложка товара из маркета, и она вся открывает модалку товара.
   * buttons – кнопки сразу под обычным сообщением. Технически это отдельное сообщение без текста:
   * на бэке добавляем возможность завести сообщение с кнопкой без самого сообщения.
   * Кнопка бывает двух видов, оба настраиваются в админке:
   *   item: id товара, show – какую цифру показать: stock (остаток), sale (до конца скидки, общей или
   *         личной), archive (до архивации). Нажатие – модалка товара
   *   raffle: ручка розыгрыша, show – participants (число участников) или time (время до окончания).
   *         Нажатие – участие
   * ended – надпись после конца (срок вышел, разобрали, розыгрыш закончился).
   * personal – личный пост: виден только этому зрителю.
   */
  const POSTS = [
    {
      id: "hello", at: "2026-10-02T12:00:00",
      text: "привет! это канал маркета blink\nздесь первыми узнают о розыгрышах, скидках и новинках",
    },
    {
      id: "raffle-1", at: "2026-10-05T18:00:00",
      media: { src: `${A}/market/tails/gold-poster.webp`, kind: "pack" },
      text: "розыгрыш 10 золотых хвостов\nучаствуй до 15.10 – итоги здесь же",
      buttons: [{ label: "участвовать", raffle: "first", show: "participants", ended: "розыгрыш закончился" }],
    },
    {
      id: "winners-1", at: "2026-10-16T12:00:00",
      text: "итоги розыгрыша: 10 золотых хвостов уже у победителей\nне повезло – следующий скоро",
    },
    {
      id: "sale-30", at: "2026-10-17T12:00:00",
      item: "fire",
      text: "−30% на огонь\nтолько до 20.10",
      buttons: [{ label: "купить", item: "fire", show: "sale", ended: "акция закончилась" }],
    },
    {
      id: "halloween", at: "2026-10-21T12:00:00",
      media: { src: `${A}/market/halloween-bg.webp`, kind: "photo" },
      text: "хэллоуин в маркете\nмышь, привидение, тыква и зомби – стикеры только до 31.10",
      buttons: [{ label: "смотреть", item: "spooky", show: "archive", ended: "акция закончилась" }],
    },
    {
      id: "gold", at: "2026-10-22T12:00:00",
      item: "gold",
      text: "золото вернулось\nпоследняя партия, больше не будет",
      buttons: [{ label: "купить", item: "gold", show: "stock", ended: "разобрали" }],
    },
    {
      id: "raffle-2", at: "2026-10-23T10:00:00",
      media: { src: `${A}/market/gift.webp`, kind: "gift" },
      text: "розыгрыш 10 золотых хвостов\nучаствуй до 31.10, итоги – 1.11",
      buttons: [{ label: "участвовать", raffle: "golden", show: "participants", ended: "розыгрыш закончился" }],
    },
    {
      id: "offer", at: "2026-10-23T12:00:00", personal: "leva",
      item: "pixels",
      text: "лёва, это только тебе 🎁\nпиксели за 300 вместо 500",
      buttons: [{ label: "купить", item: "pixels", show: "sale", ended: "скидка закончилась" }],
    },
  ];

  // Закрепы – не больше двух, новые сверху. Снимаются по таймеру из админки: розыгрыш – вместе
  // с ним, в полночь на 1.11. Скрыть закреп зритель не может
  const PINS = [
    { post: "raffle-2", until: "2026-11-01T00:00:00" },
    { post: "halloween", until: "2026-11-01T00:00:00" },
  ];

  /* ── Состояние стенда ──────────────────────────────────────────────── */

  const S = {
    viewer: "leva",
    pins: 2,
    clock: "now",
    stock: 42,
    owned: new Set(),      // купленные товары
    joined: false,         // участвует ли зритель в розыгрыше
    raffleShow: "participants", // что в админке выбрано для кнопки розыгрыша: participants или time
    pin: 0,                // какой закреп сейчас на плашке
    base: Date.parse(CLOCKS.now),
    started: Date.now(),
    people: PEOPLE.now,
    still: false,
  };

  // ?still – снимок для раскладки: время стоит, участники не прибывают
  const now = () => (S.still ? S.base : S.base + (Date.now() - S.started));
  const visiblePosts = () => POSTS.filter((p) => !p.personal || p.personal === S.viewer);

  // личное предложение зрителя на товар, пока оно не сгорело
  function offerFor(itemId) {
    const offer = OFFERS[S.viewer];
    return offer && offer.item === itemId && Date.parse(offer.ends) > now() ? offer : null;
  }

  /* ── Цифра на кнопке ───────────────────────────────────────────────── */

  // Срок словами: больше суток – «ещё 8 дней», последние сутки – секунды до нуля
  function countdown(iso) {
    const left = Date.parse(iso) - now();
    if (left <= 0) return { ended: true };
    if (left >= 86400000) {
      const days = Math.floor(left / 86400000);
      return { text: `ещё ${days}${NBSP}${plural(days, ["день", "дня", "дней"])}` };
    }
    const s = Math.floor(left / 1000);
    return { text: `ещё ${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}` };
  }

  // какая цифра у кнопки: что выбрано в админке; у живого розыгрыша – переключатель на пульте
  const showOf = (button) => (button.raffle === "golden" ? S.raffleShow : button.show);

  // Что показать на кнопке сейчас: { text } или { ended: true }
  function counterOf(button) {
    if (button.item) {
      const item = ITEMS[button.item];
      if (button.show === "stock") return S.stock <= 0 ? { ended: true } : { text: `осталось ${S.stock}` };
      if (button.show === "sale") {
        const offer = OFFERS[S.viewer];
        return countdown(offer?.item === button.item ? offer.ends : item.sale.ends);
      }
      if (button.show === "archive") return countdown(item.archive);
    }
    if (button.raffle) {
      const raffle = RAFFLES[button.raffle];
      if (Date.parse(raffle.ends) <= now()) return { ended: true };
      if (showOf(button) === "time") return countdown(raffle.ends);
      const n = raffle.live ? S.people : raffle.participants;
      return { text: `${formatCount(n)}${NBSP}${plural(n, ["участник", "участника", "участников"])}` };
    }
    return null;
  }

  /*
   * Кнопка поста во всех состояниях:
   *   обычная      – надпись по центру (без цифры) или надпись слева и цифра справа
   *   уже у тебя   – товар куплен: тёмная с галочкой, открывает модалку товара
   *   ты участвуешь – зритель в розыгрыше: тёмная с галочкой, число участников остаётся
   *   закончилось  – срок вышел, разобрали, ручка вернула finished: рамка, серая надпись, не нажимается
   */
  function buttonMarkup(post, button, i) {
    const data = `data-post="${post.id}" data-button="${i}"`;
    if (button.item && S.owned.has(button.item)) {
      return `<button class="mb-button mb-button--done pressable" type="button" ${data}>
        <i class="icon icon--check mb-button__check" aria-hidden="true"></i>уже у&nbsp;тебя</button>`;
    }
    const counter = counterOf(button);
    if (counter?.ended) {
      return `<button class="mb-button mb-button--ended" type="button" disabled>${button.ended}</button>`;
    }
    const joined = button.raffle === "golden" && S.joined;
    const icon = joined
      ? '<i class="icon icon--check mb-button__check" aria-hidden="true"></i>'
      : button.link ? '<i class="icon icon--back mb-button__link" aria-hidden="true"></i>' : "";
    const label = joined ? "ты участвуешь" : button.label;
    const classes = ["mb-button", "pressable", counter && "mb-button--counter", joined && "mb-button--done"].filter(Boolean);
    return `<button class="${classes.join(" ")}" type="button" ${data}${joined ? ' aria-pressed="true"' : ""}>
      <span class="mb-button__main">${icon}<span class="mb-button__label">${label}</span></span>${
        counter ? `<span class="mb-counter" data-counter>${counter.text}</span>` : ""}</button>`;
  }

  /* ── Лента ─────────────────────────────────────────────────────────── */

  const day = (iso) => iso.slice(0, 10);
  function dateLabel(iso) {
    const today = day(new Date(now() - new Date().getTimezoneOffset() * 60000).toISOString());
    const d = day(iso);
    if (d === today) return "сегодня";
    const y = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10);
    if (d === y) return "вчера";
    return `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  }

  const coverMarkup = (src, video) => (video && !reduceMotion
    ? `<video class="mb-media__img" src="${video}" poster="${src}" muted loop playsinline autoplay aria-hidden="true"></video>`
    : `<img class="mb-media__img" src="${src}" alt="">`);

  // Картинка поста. Если вместо неё id товара – обложка товара из маркета, и вся она – кнопка
  // в модалку товара
  function mediaMarkup(post) {
    if (post.item) {
      const item = ITEMS[post.item];
      return `<button class="mb-media mb-media--pack mb-media--item pressable" type="button" data-item="${post.item}"
        aria-label="${item.name} – открыть товар">${coverMarkup(item.cover, item.video)}</button>`;
    }
    const m = post.media;
    if (!m) return "";
    return `<figure class="mb-media mb-media--${m.kind}">${coverMarkup(m.src)}</figure>`;
  }

  // тире не начинает строку, короткие предлоги и «не» не висят в конце строки, «же» – в начале
  const typo = (text) => text
    .replace(/ – /g, `${NBSP}– `)
    .replace(/(^|[\s(])(не|в|с|к|у|о|и|а|до|на|по|за|из|от) /gi, `$1$2${NBSP}`)
    .replace(/ (же|ли|бы)(?=[\s.,!?]|$)/g, `${NBSP}$1`);

  // Пост: медиа и обычное сообщение, сразу под ними – кнопки. Кнопки – отдельное сообщение
  // без текста (на бэке его можно завести без самого сообщения), шириной по посту
  function postMarkup(post) {
    const buttons = (post.buttons || []).map((b, i) => buttonMarkup(post, b, i)).join("");
    const action = buttons ? `<div class="mb-action">${buttons}</div>` : "";
    return `<article class="mb-post${post.personal ? " mb-post--personal" : ""}" id="post-${post.id}" data-post="${post.id}">
      ${mediaMarkup(post)}
      <p class="mb-bubble">${typo(post.text)}</p>
      ${action}
    </article>`;
  }

  function renderFeed() {
    // подгрузка старых постов при листании вверх в канале уже есть – на стенде лента целиком
    let html = "";
    let last = "";
    for (const post of visiblePosts()) {
      const label = dateLabel(post.at);
      if (label !== last) {
        html += `<p class="mb-date">${label}</p>`;
        last = label;
      }
      html += postMarkup(post);
    }
    $("#feed").innerHTML = html;
  }

  // Только цифры на кнопках – раз в секунду, без перерисовки ленты
  function tick() {
    for (const button of $$(".mb-button[data-post]")) {
      const post = POSTS.find((p) => p.id === button.dataset.post);
      const b = post.buttons[button.dataset.button];
      if (b.item && S.owned.has(b.item)) continue;
      const counter = counterOf(b);
      const value = $("[data-counter]", button);
      if (counter?.ended || Boolean(counter) !== Boolean(value)) { renderFeed(); return; }
      if (!value) continue;
      value.textContent = counter.text;
    }
    renderPin();
    if (sheetItem && offerFor(sheetItem) === null && $("#item-sheet").dataset.offer === "1") fillSheet();
  }

  /* ── Закреп ────────────────────────────────────────────────────────── */

  const activePins = () => PINS.slice(0, S.pins)
    .filter((p) => Date.parse(p.until) > now() && visiblePosts().some((post) => post.id === p.post));

  function renderPin() {
    const pins = activePins();
    const plate = $("#pin");
    const was = !plate.hidden;
    plate.hidden = !pins.length;
    $("#channel").classList.toggle("has-pin", pins.length > 0);
    if (!pins.length) return;
    S.pin %= pins.length;
    const post = POSTS.find((p) => p.id === pins[S.pin].post);
    const [title, ...rest] = post.text.split("\n");
    $("#pin-title").textContent = title;
    $("#pin-preview").textContent = rest.join(" ");
    const thumb = $("#pin-thumb");
    const src = post.item ? ITEMS[post.item].cover : post.media?.src;
    thumb.hidden = !src;
    if (src) thumb.src = src;
    thumb.className = `mb-pin__thumb mb-pin__thumb--${post.item ? "pack" : post.media?.kind || "none"}`;
    $("#pin-track").innerHTML = pins.map((_, i) => `<span class="mb-pin__segment${i === S.pin ? " is-current" : ""}"></span>`).join("");
    plate.setAttribute("aria-label", `закреплено${pins.length > 1 ? ` ${S.pin + 1} из ${pins.length}` : ""}: ${title}`);
    if (!was && !reduceMotion) {
      plate.classList.remove("is-entering");
      void plate.offsetWidth;
      plate.classList.add("is-entering");
    }
  }

  // Нажатие на закреп: лента едет к посту, плашка – на следующий закреп
  function jumpToPin({ instant = false } = {}) {
    const pins = activePins();
    if (!pins.length) return;
    const id = pins[S.pin].post;
    focus = id;
    center(id, !instant && !reduceMotion);
    S.pin = (S.pin + 1) % pins.length;
    renderPin();
    $("#announce").textContent = `закреп: ${POSTS.find((p) => p.id === id).text.split("\n")[0]}`;
  }

  /* ── Положение ленты ───────────────────────────────────────────────── */

  // Лента прижата к низу, как в мессенджере: догрузилась картинка – последний пост не уезжает.
  // После нажатия на закреп держим его пост по центру, пока человек сам не тронет ленту
  let stick = true;
  let focus = null;
  const atBottom = () => {
    const s = $("#scroll");
    return s.scrollTop + s.clientHeight >= s.scrollHeight - 4;
  };

  function center(id, smooth = false) {
    const post = $(`#post-${id}`);
    if (!post) return;
    const scroll = $("#scroll");
    const top = post.offsetTop - (scroll.clientHeight - post.offsetHeight) / 2;
    scroll.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
  }

  function toBottom() {
    const scroll = $("#scroll");
    focus = null;
    scroll.scrollTop = scroll.scrollHeight;
    stick = true;
  }

  function toTop() {
    focus = null;
    $("#scroll").scrollTop = 0;
    stick = false;
  }

  /* ── Модалка товара: шторка по эталону market/limited_tale.png ─────── */

  let sheetItem = null;
  let sheetOpener = null;

  // «31.10» – последний день: конец срока – полночь следующего дня
  const dayMonth = (iso, shift = 0) => {
    const d = new Date(Date.parse(iso) + shift * 86400000);
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
  };

  function fillSheet() {
    const item = ITEMS[sheetItem];
    // цена для этого человека: личное предложение, иначе общая скидка, пока она идёт
    const personal = offerFor(sheetItem);
    const sale = !personal && item.sale && Date.parse(item.sale.ends) > now() ? item.sale : null;
    const offer = personal || sale;
    const owned = S.owned.has(sheetItem);
    const sheet = $("#item-sheet");
    sheet.dataset.offer = personal && !owned ? "1" : "";      // личная скидка сгорит – модалка перерисуется
    $("#item-title").textContent = item.name;
    const off = offer ? Math.round((1 - offer.price / item.price) * 100) : 0;
    const faces = FACES.slice(0, Math.min(3, item.friends));
    const more = item.friends - faces.length;
    const stock = item.total && !owned
      ? `<div class="mb-sheet__stock" role="img" aria-label="осталось ${S.stock} из ${item.total}">
          <div class="mb-sheet__stock-bar"><div class="mb-sheet__stock-fill" style="--share:${Math.max(0, S.stock) / item.total}"></div></div>
          <p class="mb-sheet__stock-meta"><span>осталось на&nbsp;складе</span><span><span class="mb-sheet__stock-count">${S.stock}</span><span class="mb-sheet__stock-total">/${item.total}</span></span></p>
        </div>`
      : "";
    const buy = owned
      ? `<button class="button button--secondary mb-buy mb-buy--owned" type="button" disabled>
          <i class="icon icon--check" aria-hidden="true"></i>уже у&nbsp;тебя</button>`
      : item.total && S.stock <= 0
        ? `<button class="button mb-buy mb-buy--owned" type="button" disabled>разобрали</button>`
        : `<button class="button button--primary mb-buy pressable" type="button" data-buy>
            <span>купить</span>
            <span class="mb-buy__price"><img class="mb-buy__coin" src="${A}/market/coin.png" alt="">${offer ? offer.price : item.price}${
              offer ? `<s class="mb-buy__old" aria-label="вместо ${item.price}">${item.price}</s>` : ""}</span>
          </button>`;
    $("#item-body").innerHTML = `
      ${personal && !owned ? `<p class="mb-sheet__leave">скидка −${off}% только для&nbsp;тебя – до&nbsp;конца дня</p>` : ""}
      ${sale && !owned ? `<p class="mb-sheet__leave">скидка −${off}% до&nbsp;${dayMonth(item.sale.ends, -1)}</p>` : ""}
      ${item.archive && !owned ? `<p class="mb-sheet__leave">в&nbsp;маркете до&nbsp;${dayMonth(item.archive, -1)}</p>` : ""}
      <p class="mb-sheet__text">${typo(item.text)}</p>
      ${stock}
      <div class="mb-sheet__preview"><img class="mb-sheet__pack" src="${item.cover}" alt=""></div>
      <p class="mb-sheet__friends">
        <span class="mb-faces" aria-hidden="true">
          ${faces.map((f) => `<img class="mb-faces__img" src="${A}/people/${f}.webp" alt="">`).join("")}
          ${more > 0 ? `<span class="mb-faces__more">+${more}</span>` : ""}
        </span>
        есть у&nbsp;${item.friends}&nbsp;${plural(item.friends, ["друга", "друзей", "друзей"])}
      </p>
      ${buy}`;
  }

  function openSheet(id, opener) {
    sheetItem = id;
    sheetOpener = opener;
    fillSheet();
    $("#backdrop").classList.add("is-open");
    $("#item-sheet").classList.add("is-open");
    $("#app").dataset.status = "dark";            // над светлым градиентом маркета статус-бар тёмный
    $("#channel").inert = true;
    if (opener) requestAnimationFrame(() => $("#item-sheet").focus({ preventScroll: true }));
  }

  function closeSheet() {
    const sheet = $("#item-sheet");
    if (!sheet.classList.contains("is-open")) return;
    sheet.classList.remove("is-open", "is-dragging");
    sheet.style.removeProperty("transform");
    $("#backdrop").classList.remove("is-open");
    delete $("#app").dataset.status;
    $("#channel").inert = false;
    sheetItem = null;
    if (sheetOpener?.isConnected) sheetOpener.focus({ preventScroll: true });
  }

  // Покупка – как в маркете: одно нажатие «КУПИТЬ» в модалке. Кнопка на месте становится
  // «уже у тебя», в посте – тоже; со склада уходит одна штука
  function buy() {
    if (!sheetItem || S.owned.has(sheetItem)) return;
    S.owned.add(sheetItem);
    if (ITEMS[sheetItem].total) S.stock = Math.max(0, S.stock - 1);
    fillSheet();
    $("#item-sheet").focus({ preventScroll: true });
    renderFeed();
    syncPanel();
  }

  // жест вниз за грэббер или заголовок: шторка идёт за пальцем, закрытие – по проекции броска
  function dragToClose() {
    const sheet = $("#item-sheet");
    const handle = $("#item-handle");
    let drag = null;
    handle.addEventListener("pointerdown", (e) => {
      drag = { y: e.clientY, t: performance.now(), dy: 0, v: 0 };
      handle.setPointerCapture(e.pointerId);
      sheet.classList.add("is-dragging");
    });
    handle.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const app = $("#app");
      const z = app.getBoundingClientRect().height / app.offsetHeight || 1;
      drag.dy = Math.max(0, (e.clientY - drag.y) / z);
      drag.v = drag.dy / Math.max(1, performance.now() - drag.t);
      sheet.style.transform = `translateY(${drag.dy}px)`;
    });
    const end = () => {
      if (!drag) return;
      sheet.classList.remove("is-dragging");
      sheet.style.removeProperty("transform");
      if (drag.dy + drag.v * 200 > sheet.offsetHeight / 3) closeSheet();
      drag = null;
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }
  dragToClose();

  /* ── Пульт ─────────────────────────────────────────────────────────── */

  const PANEL = {
    viewer: () => S.viewer,
    pins: () => String(S.pins),
    clock: () => S.clock,
    stock: () => String(S.stock),
    owned: () => (S.owned.has("pixels") ? "pixels" : "none"),
    joined: () => (S.joined ? "1" : "0"),
    raffleShow: () => S.raffleShow,
  };

  function syncPanel() {
    for (const group of $$("[data-control]")) {
      const value = PANEL[group.dataset.control]();
      for (const b of $$("[role=radio]", group)) b.setAttribute("aria-checked", String(b.dataset.value === value));
    }
  }

  function setClock(name) {
    S.clock = name;
    S.base = Date.parse(CLOCKS[name]);
    S.started = Date.now();
    S.people = PEOPLE[name];
  }

  function render() {
    syncPanel();
    renderFeed();
    renderPin();
  }

  $(".panel").addEventListener("click", (e) => {
    const b = e.target.closest("[role=radio]");
    if (!b) return;
    const key = b.closest("[data-control]").dataset.control;
    const value = b.dataset.value;
    if (key === "clock") setClock(value);
    else if (key === "owned") value === "pixels" ? S.owned.add("pixels") : S.owned.delete("pixels");
    else if (key === "joined") S.joined = value === "1";
    else S[key] = /^\d+$/.test(value) ? Number(value) : value;
    if (key === "pins") S.pin = 0;
    render();
    if (key === "viewer") toBottom();
  });
  $("#to-top").addEventListener("click", toTop);
  $("#to-bottom").addEventListener("click", toBottom);

  /* ── События канала ────────────────────────────────────────────────── */

  $("#pin").addEventListener("click", () => jumpToPin());

  // Обложка товара и «купить» открывают модалку товара; «участвовать» – зритель в розыгрыше
  // (в продукте участие засчитывает сервис розыгрыша, ручка отвечает joined: true);
  // ссылки ведут на экраны, которых нет в задаче, – только отклик на нажатие
  $("#feed").addEventListener("click", (e) => {
    const cover = e.target.closest("[data-item]");
    if (cover) return openSheet(cover.dataset.item, cover);
    const button = e.target.closest(".mb-button[data-post]");
    if (!button) return;
    const b = POSTS.find((p) => p.id === button.dataset.post).buttons[button.dataset.button];
    if (b.item) return openSheet(b.item, button);
    if (b.raffle === "golden" && !S.joined) {
      S.joined = true;
      S.people += 1;
      renderFeed();
      syncPanel();
      $(`[data-post="${button.dataset.post}"][data-button="${button.dataset.button}"]`)?.focus({ preventScroll: true });
    }
  });

  $("#backdrop").addEventListener("click", closeSheet);
  $("#item-sheet").addEventListener("click", (e) => {
    if (e.target.closest("[data-buy]")) buy();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
  });

  const scroller = $("#scroll");
  scroller.addEventListener("scroll", () => {
    stick = atBottom();
  }, { passive: true });
  for (const type of ["wheel", "touchstart", "keydown"]) {
    scroller.addEventListener(type, () => { focus = null; }, { passive: true });
  }
  // лента выросла (догрузилась картинка) или окно изменилось – низ или пост в фокусе остаются на месте;
  // ещё раз – когда догрузились шрифты и картинки: первая раскладка бывает на пару пунктов короче
  const settle = () => {
    if (focus) center(focus);
    else if (stick) scroller.scrollTop = scroller.scrollHeight;
  };
  const keep = new ResizeObserver(settle);
  keep.observe($("#feed"));
  keep.observe(scroller);
  addEventListener("load", () => requestAnimationFrame(settle));
  document.fonts.ready.then(() => requestAnimationFrame(settle));

  // Участники прибывают сами, пока розыгрыш идёт
  setInterval(() => {
    if (!S.still && Math.random() < 0.6) S.people += 1 + Math.floor(Math.random() * 3);
  }, 1500);
  setInterval(tick, 1000);

  /* ── Стенд целиком в окне ──────────────────────────────────────────── */

  function fit() {
    const body = $(".stage__body");
    body.style.removeProperty("--stage-zoom");
    if (innerWidth <= 480) return;
    const height = Math.max(844, body.scrollHeight);
    const room = innerHeight - $(".stage__head").offsetHeight - 56;
    const zoom = Math.min(1, room / height, (innerWidth - 48) / body.scrollWidth);
    body.style.setProperty("--stage-zoom", zoom.toFixed(3));
  }
  fit();
  addEventListener("resize", fit);

  /* ── Сразу нужное состояние: ?state=<id> из states.js или параметры по одному ── */

  const q = new URLSearchParams(location.search);
  const preset = window.MarketBotStates?.STATES.find((s) => s.id === q.get("state"));
  const params = new URLSearchParams(preset ? preset.query : location.search);
  if (VIEWERS[params.get("viewer")]) S.viewer = params.get("viewer");
  if (params.has("pins")) S.pins = Math.min(2, Number(params.get("pins")));
  if (CLOCKS[params.get("clock")]) setClock(params.get("clock"));
  if (params.has("stock")) S.stock = Number(params.get("stock"));
  if (params.has("people")) S.people = Number(params.get("people"));
  for (const id of (params.get("owned") || "").split(",")) if (ITEMS[id]) S.owned.add(id);
  if (params.get("joined") === "1") { S.joined = true; S.people += 1; }
  if (params.get("raffle") === "time") S.raffleShow = "time";
  S.still = q.has("still");
  render();

  const scrollTo = params.get("scroll");
  requestAnimationFrame(() => {
    if (scrollTo === "top") toTop();
    else if (scrollTo?.startsWith("post:")) {
      const id = scrollTo.slice(5);
      focus = id;
      stick = false;
      center(id);
    } else toBottom();
    // act=jump – нажать на закреп; jump,jump – дважды (лента уезжает ко второму закрепу);
    // sheet:<товар> – открыта модалка товара; buy – в ней нажали «купить»
    for (const act of (params.get("act") || "").split(",")) {
      if (act === "jump") jumpToPin({ instant: true });
      if (act.startsWith("sheet:")) openSheet(act.slice(6), null);
      if (act === "buy") buy();
    }
  });
})();
