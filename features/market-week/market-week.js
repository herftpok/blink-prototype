/*
 * Новый маркет – альтернативная витрина маркета по двум исследованиям в market/*.pdf
 * («Интерфейсы ротируемых магазинов», «Механики возврата в ротируемый магазин»).
 *
 * Лента сверху вниз: шапка с балансом → вкладки «хвосты · стикеры», у каждой своя неделя → «новинки» (когда придут следующие – словами, без
 * тикающего таймера) → один крупный предмет недели без карусели, с примеркой на твоём пине →
 * четыре предложения недели → «у друзей» – что взяли твои друзья → полка «хэллоуин» со ссылкой
 * «все» → «уже у тебя» → архив. Карточка – одна зона нажатия, на ней цена и одно состояние.
 * Нажатие – шторка предмета по эталонам market/unlimited_sticker.png, limited_tale.png,
 * unlimitid_tale.png; покупка – как там: «КУПИТЬ» с ценой.
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
  // pack – упаковка (market/*), tail – хвост без упаковки для примерки на пине, follower – фигурка,
  // которая летит за пином (мышь, призрак, зомби – из упаковок), sticker – стикер из набора,
  // chat – переписка в превью: что пишет друг до стикера и что отвечает после.
  // friends – у скольких друзей уже есть (лица в шторке – первые три)
  const ITEMS = {
    // хвосты – живые упаковки из записей маркета (market/tales*.mov, tail_animation*.mov).
    // Ограничения – по одному: ends – когда уходит (медузы; ушёл – пропадает из ленты), stock – тираж
    // (золото). Остальные – всегда в маркете
    fire: { name: "огонь", kind: "хвост", pack: "market/anim-tail-fire.webp", tail: "tails/rocket.webp", price: 500, friends: 3,
      text: "реактивное пламя за твоим пином на карте" },
    gold: { name: "золото", kind: "хвост", pack: "market/tails/gold.webp", video: "market/tails/gold.mp4", follower: "market/tails/bare-gold.webp", price: 777, stock: { left: 42, total: 100 }, friends: 1,
      text: "золотые монеты сыплются за твоим пином, тиражом 100 штук" },
    jelly: { name: "медузы", kind: "хвост", ends: new Date(2026, 9, 13, 18), pack: "market/tails/jelly.webp", video: "market/tails/jelly.mp4", follower: "market/tails/bare-jelly.webp", price: 30, friends: 4,
      text: "медузы и пузыри плывут за твоим пином" },
    paws: { name: "лапки", kind: "хвост", pack: "market/tails/paws.webp", video: "market/tails/paws.mp4", follower: "market/tails/bare-paws.webp", price: 15, friends: 3,
      text: "цветные следы лапок за твоим пином" },
    crystal: { name: "кристалл", kind: "хвост", pack: "market/tails/crystal.webp", video: "market/tails/crystal.mp4", follower: "market/tails/bare-crystal.webp", price: 6, friends: 0,
      text: "фиолетовый кристалл с осколками летит за тобой" },
    scroll: { name: "свиток", kind: "хвост", pack: "market/tails/scroll.webp", video: "market/tails/scroll.mp4", follower: "market/tails/bare-scroll.webp", price: 20, friends: 1,
      text: "старый свиток с корнями тянется за пином" },
    paper: { name: "рулон", kind: "хвост", pack: "market/tails/paper.webp", video: "market/tails/paper.mp4", follower: "market/tails/bare-paper.webp", price: 10, friends: 2,
      text: "рулон бумаги разматывается за тобой по всей карте" },
    zombie: { name: "жутко весело", kind: "стикерпак", pack: "market/items/zombie-new.webp", sticker: "market/sticker-zombie.webp",
      chat: ["ты как после вчерашнего?", "ахах узнаю себя"],
      price: 1500, stock: { left: 68, total: 100 }, friends: 5,
      text: "этот пак оживает по ночам… и в твоих чатах. добавь немного жути в переписку с друзьями" },
    pixel: { name: "пиксели", kind: "хвост", pack: "market/tail-pixel.webp", price: 500, friends: 0,
      text: "хвост из пикселей, как в старых играх" },
    "bat-box": { name: "летучая мышь", kind: "хвост", pack: "market/items/bat-box-sale.webp", follower: "market/sticker-bat.webp", price: 300, old: 500, friends: 2,
      text: "пушистая летучая мышь летит за твоим пином" },
    "ghost-box": { name: "призрак", kind: "хвост", pack: "market/items/ghost-box-new.webp", follower: "market/sticker-ghost.webp", price: 800, friends: 0,
      text: "привидение плывёт за твоим пином по ночной карте" },
    bats: { name: "летучие мыши", kind: "стикерпак", pack: "market/items/bat-sale.webp", sticker: "market/sticker-bat.webp", weekly: true,
      chat: ["го гулять ночью?", "вылетаю"], price: 300, old: 500, friends: 4,
      text: "пушистые летучие мыши для ночных переписок" },
    ghost: { name: "привидения", kind: "стикерпак", pack: "market/items/ghost.webp", sticker: "market/sticker-ghost.webp",
      chat: ["ты куда пропал?", "напугал 😅"], price: 300, friends: 1,
      text: "привидения для переписки, совсем не страшные" },
    pumpkin: { name: "тыквы", kind: "стикерпак", pack: "market/items/pumpkin.webp", sticker: "market/sticker-pumpkin.webp",
      chat: ["что делаем на хэллоуин?", "режем тыквы у меня"], price: 300, friends: 0,
      text: "тыквы с улыбкой – к хэллоуину" },
    "zombie-box": { name: "зомби", kind: "хвост", pack: "market/items/zombie-box-new.webp", follower: "market/sticker-zombie.webp", price: 800, friends: 3,
      text: "зомби бредёт за твоим пином до самого дома" },
    // всегда в маркете: стикерпаки из 3D-стикеров и хвост-комета в пустых упаковках (build_assets → package_with)
    "pack-thumbs": { name: "реакции", kind: "стикерпак", pack: "market/always/pack-thumbs-up.webp", sticker: "stickers/thumbs-up.webp",
      chat: ["скинул тебе конспект", "лучший"], price: 200, friends: 4, text: "палец вверх и другие реакции – ответить, не печатая" },
    "pack-fire": { name: "жара", kind: "стикерпак", pack: "market/always/pack-fire.webp", sticker: "stickers/fire.webp",
      chat: ["зацени мой новый трек", "ахах спасибо"], price: 200, friends: 2, text: "огонь – когда кто-то выдал что-то крутое" },
    "pack-heart": { name: "сердечки", kind: "стикерпак", pack: "market/always/pack-heart.webp", sticker: "stickers/heart.webp",
      chat: ["скучаю по тебе", "и я 🥹"], price: 200, friends: 3, text: "сердечки для своих" },
    "pack-kiss": { name: "поцелуи", kind: "стикерпак", pack: "market/always/pack-kiss.webp", sticker: "stickers/kiss.webp",
      chat: ["спокойной ночи", "сладких снов"], price: 200, friends: 1, text: "поцелуи на ночь и не только" },
    comet: { name: "комета", kind: "хвост", pack: "market/always/box-comet.webp", tail: "tails/comet.webp", price: 400, friends: 2,
      text: "звёздный шлейф за твоим пином" },
  };
  Object.entries(ITEMS).forEach(([id, item]) => (item.id = id));

  // Друзья – пак людей из avatars/, имена как в соседних фичах
  const FRIENDS = {
    lyova: { name: "лёва", photo: `${A}/people/photo-3.webp`, live: `${A}/people/live-3.webp`, online: true, speed: 14 },
    sonya: { name: "соня", photo: `${A}/people/photo-4.webp`, live: `${A}/people/live-4.webp`, online: false, speed: 6 },
    timur: { name: "тимур", photo: `${A}/people/photo-2.webp`, live: `${A}/people/live-2.webp`, online: true, speed: 32 },
    vasya: { name: "вася", photo: `${A}/people/photo-5.webp`, live: `${A}/people/live-5.webp`, online: false, speed: 18 },
    // у валентина и алеси нет вырезки – обычное фото с фоном: в пине лежит целиком (flat)
    valentin: { name: "валентин", photo: `${A}/people/valentin.webp`, live: `${A}/people/valentin.webp`, flat: true, online: true, speed: 21 },
    alesya: { name: "алеся", photo: `${A}/people/alesya.webp`, live: `${A}/people/alesya.webp`, flat: true, online: false, speed: 4 },
    natashka: { name: "наташка", photo: `${A}/people/photo-1.webp`, live: `${A}/people/live-1.webp`, online: true, speed: 9 },
  };
  const FACES = ["lyova", "sonya", "timur", "vasya", "natashka"];

  // Вкладки маркета, как на эталоне market_full_screen.png. У каждой своя витрина недели: предмет
  // недели, четыре предложения, что взяли друзья (свежее – сверху), и подборка к празднику
  // (у неё свой срок, она не крутится каждую неделю)
  const TABS = [
    { id: "stickers", title: "стикеры" },
    { id: "tails", title: "хвосты" },
  ];
  // «подарки» – вкладка без экрана в этой фиче: стоит в ряду, но не нажимается
  const SOON_TABS = [{ id: "gifts", title: "подарки" }];
  const WEEKS = {
    tails: {
      // у хвостов витрина по неделям не крутится – меняются только хвосты друзей
      w41: {
        friends: [
          { who: "sonya", item: "comet", when: "сегодня", at: [118, 118], heading: -18 },
          { who: "timur", item: "fire", when: "во вторник", at: [282, 156], heading: 14 },
          { who: "vasya", item: "comet", when: "5.10", at: [392, 92], heading: 196, far: true },
          // на карте друзей – только хвосты, которые растут из пина: фигурки (монеты, медузы, лапки)
          // читаются там как стикеры
          { who: "lyova", item: "fire", when: "5.10", at: [540, 140], heading: 8 },
          { who: "valentin", item: "comet", when: "4.10", at: [700, 102], heading: -24 },
          { who: "alesya", item: "fire", when: "3.10", at: [860, 150], heading: 200, far: true },
        ],
      },
      w42: {
        friends: [{ who: "lyova", item: "comet", when: "сегодня", at: [210, 136], heading: -12 }],
      },
    },
    // у стикеров наверху не предмет недели, а сезонный баннер с наборами (COLLECTIONS.stickers)
    stickers: {
      w41: {
        offers: ["zombie", "bats", "ghost", "pumpkin"],
        friends: [
          { who: "sonya", item: "bats", when: "сегодня" },
          { who: "lyova", item: "zombie", when: "вчера" },
          { who: "vasya", item: "ghost", when: "5.10" },
        ],
      },
      w42: {
        offers: ["pumpkin", "ghost", "bats", "zombie"],
        friends: [{ who: "natashka", item: "ghost", when: "сегодня" }],
      },
    },
  };

  // Подборки к празднику – не крутятся каждую неделю, у них свой срок. banner – подборка
  // стоит наверху вкладки сезонным баннером, нажатие открывает её целиком
  const COLLECTIONS = {
    stickers: { title: "хэллоуин", until: "до 31.10", items: ["zombie", "bats", "ghost", "pumpkin"], banner: "market/halloween-bg.webp" },
  };

  // Всегда в маркете – не крутятся по неделям и не уходят: в ленте – сеткой после новинок и полок,
  // без своего заголовка. Комета уже у тебя (коллекция – кометы)
  // Хвосты новинками не крутятся – новые появляются редко. Лента хвостов: лучшее предложение на
  // карте (best), шесть хвостов (first), хвосты друзей, остальные (rest)
  // наверху – хит недели: хвост, который за неделю взяли чаще всего; why – почему он наверху, словами
  const TAILS_FEED = {
    best: "fire",
    why: "хит недели",
    first: ["gold", "jelly", "paws", "crystal", "scroll", "paper"],
    rest: ["pixel"],
  };
  const ALWAYS = {
    tails: [TAILS_FEED.best, ...TAILS_FEED.first, ...TAILS_FEED.rest, "comet"].filter((id) => !ITEMS[id].ends),
    stickers: ["pack-thumbs", "pack-fire", "pack-heart", "pack-kiss"],
  };
  const isAlways = (id) => Object.values(ALWAYS).some((list) => list.includes(id));

  // Коллекция и архив – карточки хвостов со скриншота market_full_screen.png
  // живые карточки хвостов без упаковки (market/tales2.mov, tales3.mov) – у каждого свой хвост:
  // со старого скриншота здесь стояли пять одинаковых комет
  const OWNED = ["tails/card-comet", "tails/card-cat", "tails/card-heart", "tails/card-neon"];
  const ARCHIVE = ["tails/card-easter", "tails/card-jewelry"];

  // День на стенде: какая неделя на витрине и что пишем о сроке
  const DAYS = {
    // at – который час на стенде (часы идут по-настоящему); ends – когда витрина недели сменится:
    // понедельник 00:00 по местному времени. last – за 10 секунд до смены: видно, как она проходит
    thu: { week: "w41", at: new Date(2026, 9, 8, 14, 17, 53), leave: "уходит в воскресенье" },
    sun: { week: "w41", at: new Date(2026, 9, 11, 21, 47, 30), leave: "уходит сегодня" },
    last: { week: "w41", at: new Date(2026, 9, 11, 23, 59, 50), leave: "уходит сегодня" },
    mon: { week: "w42", at: new Date(2026, 9, 12, 10, 5, 0), leave: "уходит в воскресенье" },
  };
  const WEEK_ENDS = { w41: new Date(2026, 9, 12), w42: new Date(2026, 9, 19) };

  // Скидка только для тебя – по одной в каждой вкладке, подобрана по вкусу (что у тебя уже есть),
  // действует сутки: выдана в полночь и пропадает в следующую полночь. Бывает не у всех и не
  // каждый день – на пульте её можно выключить. off – скидка в процентах
  const DEALS = { tails: { item: "pixel", off: 40 }, stickers: { item: "pack-heart", off: 50 } };
  const dealEndsFor = (day) => {
    const at = DAYS[day].at;
    return new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1).getTime();
  };

  // комета уже у тебя: в коллекции «уже у тебя» – кометы
  const OWNED_AT_START = ["comet"];
  const S = { tab: "tails", day: "thu", coins: 55000, owned: new Set(OWNED_AT_START), clock: 0, since: 0, deal: true, dealEnds: 0 };

  // ── Часы стенда и таймер смены витрины ────────────────────────────────
  function setDay(id) {
    S.day = id;
    S.clock = DAYS[id].at.getTime();
    S.since = performance.now();
    S.dealEnds = dealEndsFor(id);
  }
  const now = () => S.clock + (performance.now() - S.since);
  const pad = (n) => String(n).padStart(2, "0");

  // «3 дня 09:40» (двоеточие мигает), в последние сутки – с секундами «02:12:28»; aria – словами.
  // short – для ценника: «3 дня» без часов, в последние сутки – «02:12:28»
  function countdown(target, prefix, short = false) {
    const left = Math.max(0, target - now());
    const sec = Math.ceil(left / 1000);
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const colon = '<span class="mw-timer__colon">:</span>';
    const days = d && `${d}\u00a0${plural(d, "день", "дня", "дней")}`;
    return {
      left,
      html: d ? (short ? days : `${days} ${pad(h)}${colon}${pad(m)}`) : `${pad(h)}:${pad(m)}:${pad(sec % 60)}`,
      aria: `${prefix} ${[d && `${d} ${plural(d, "день", "дня", "дней")}`, h && `${h} ${plural(h, "час", "часа", "часов")}`,
        `${m} ${plural(m, "минуту", "минуты", "минут")}`].filter(Boolean).join(" ")}`,
    };
  }

  // два таймера: смена витрины (новинки стикеров – в ценнике) и личная скидка (обе вкладки)
  const TIMERS = {
    week: { prefix: "пропадут через", target: () => WEEK_ENDS[DAYS[S.day].week], short: true },
    deal: { prefix: "скидка пропадёт через", target: () => S.dealEnds },
  };

  // новинка стикеров уходит со сменой витрины – срок в ценнике, как тираж: «осталось 3 дня»
  // когда товар уходит: хвост – свой срок, новинка стикеров – со сменой витрины; null – не уходит
  // weekly – стикерпак уходит со сменой витрины (мыши); у остальных новинок срока нет
  const endsOf = (item) =>
    item.ends ? item.ends.getTime() : item.weekly ? WEEK_ENDS[DAYS[S.day].week] : null;
  const timed = (item) => endsOf(item) != null;
  const gone = (item) => item.ends && item.ends.getTime() <= now();

  // скидка действует: включена на пульте и время не вышло
  const dealOn = () => S.deal && now() < S.dealEnds;
  const dealFor = (item) => {
    const any = Object.values(DEALS).find((x) => x.item === item.id);
    return dealOn() && any && !S.owned.has(item.id) ? any : null;
  };
  // цена с личной скидкой – круглая, до десятков; старая – зачёркнута
  const priceOf = (item) => {
    const d = dealFor(item);
    return d ? Math.round((item.price * (100 - d.off)) / 1000) * 10 : item.price;
  };
  const oldOf = (item) => (dealFor(item) ? item.price : item.old);

  // раз в секунду: идёт отсчёт; в последнюю минуту стикер стучит; дошёл до нуля – витрина
  // сменилась на следующую неделю, новинки появляются по очереди
  let dealWasOn = null;
  function tick() {
    let expired = false;
    $$("#feed [data-timer]").forEach((timer) => {
      const t = TIMERS[timer.dataset.timer];
      const ends = timer.dataset.ends ? Number(timer.dataset.ends) : null;
      const c = countdown(ends ?? t.target(), t.prefix, t.short);
      if (ends && c.left <= 0) expired = true;
      const value = timer.querySelector(".mw-timer__value");
      if (value.innerHTML !== c.html) value.innerHTML = c.html;
      timer.classList.toggle("is-urgent", c.left > 0 && c.left < 60000);
      if (timer.hasAttribute("aria-label") && timer.getAttribute("aria-label") !== c.aria) timer.setAttribute("aria-label", c.aria);
    });
    // скидка кончилась – раздел уходит, цена возвращается; срок хвоста вышел – хвост уходит из ленты
    const on = dealOn();
    if ((dealWasOn && !on) || expired) rerender();
    dealWasOn = on;
    const c = countdown(TIMERS.week.target(), TIMERS.week.prefix);
    if (c.left <= 0 && DAYS[S.day].week === "w41") {
      const at = now();
      S.day = "mon";
      S.clock = at;
      S.since = performance.now();
      sheets.forEach(closeSheet);
      rerender();
      const feed = $("#feed");
      feed.classList.remove("is-fresh");
      void feed.offsetWidth;
      feed.classList.add("is-fresh");
      setTimeout(() => feed.classList.remove("is-fresh"), 1600);
    }
  }
  const week = (tab = S.tab) => WEEKS[tab][DAYS[S.day].week];
  const collection = () => COLLECTIONS[S.tab];

  // ── Ценник ─────────────────────────────────────────────────────────────
  // одно состояние: цена (со старой зачёркнутой при скидке) или «у тебя»
  function chip(item) {
    if (S.owned.has(item.id))
      return `<span class="price-chip mw-chip mw-chip--owned"><span class="mw-chip__check"><i class="icon icon--check" aria-hidden="true"></i></span>у тебя</span>`;
    // ограничение – в той же пилюле, после разделителя, словами и розовым, как «осталось 09:42» у скидки:
    // тираж – «осталось 42», срок новинки – «ещё 3 дня» (в последние сутки – «ещё 02:12:28», секунды
    // идут). «осталось 3 дня» в ширину карточки не помещается. Тираж и срок вместе тоже не помещаются –
    // у тиражной новинки тираж: он кончается раньше
    let stock = "";
    if (item.stock) stock = `<span class="mw-chip__stock">осталось ${item.stock.left}</span>`;
    else if (timed(item)) {
      const ends = endsOf(item);
      const c = countdown(ends, TIMERS.week.prefix, true);
      stock = `<span class="mw-chip__stock${c.left < 60000 ? " is-urgent" : ""}" data-timer="week"${
        item.ends ? ` data-ends="${ends}"` : ""}>ещё&nbsp;<span class="mw-timer__value">${c.html}</span></span>`;
    }
    if (!priceOf(item)) return '<span class="price-chip mw-chip">бесплатно</span>';
    // у новинки со сроком старую цену в сетке не пишем – не помещается; скидку видно по ярлыку SALE,
    // старая цена – на кнопке в шторке
    const old = stock && timed(item) ? null : oldOf(item);
    return `<span class="price-chip price-chip--coins mw-chip">
      <img class="price-chip__coin" src="${A}/market/coin.png" alt="">${formatCoins(priceOf(item))}${
        old ? `<s class="mw-chip__old">${formatCoins(old)}</s>` : ""}${stock}</span>`;
  }

  function label(item) {
    const price = S.owned.has(item.id)
      ? "уже у тебя"
      : !priceOf(item) ? "бесплатно"
      : `${formatCoins(priceOf(item))} монет${oldOf(item) ? `, было ${formatCoins(oldOf(item))}` : ""}${
          dealFor(item) ? `, скидка ${dealFor(item).off} %` : ""}`;
    const stock = item.stock && !S.owned.has(item.id) ? `, осталось ${item.stock.left} из ${item.stock.total}`
      : timed(item) ? `, ${countdown(endsOf(item), item.ends ? "уйдёт через" : TIMERS.week.prefix).aria}` : "";
    return `${item.name}, ${item.kind}, ${price}${stock}`;
  }

  // ── Пин с хвостом: примерка на тебе ───────────────────────────────────
  // твой пин в пути (живая аватарка, скорость), хвост растёт из-под кадра – как на эталоне хвоста
  // who – чей пин: по умолчанию ты; у друзей – их живая аватарка, онлайн и скорость
  const ME = { name: "ты", live: `${A}/people/live-1.webp`, online: true, speed: 25 };
  // в баннере камера приближена: карта и пин крупнее в 1.5 раза, живая аватарка – HD
  const ME_HD = { ...ME, live: `${A}/people/live-hd-1.webp` };
  // хвост – в «крыле» с центром в центре кадра: поворачивается по направлению полёта (--heading,
  // 0° – вправо) вместе со стрелками пина; сам пин не поворачивается
  const rider = (item, who = ME, cls = "") => `
    <span class="mw-rider ${cls}" aria-hidden="true">
      ${item.tail ? `<span class="mw-rider__wing"><img class="mw-rider__tail" src="${A}/${item.tail}" alt=""></span>` : ""}
      ${item.follower ? `<img class="mw-rider__follower" src="${A}/${item.follower}" alt="">` : ""}
      ${window.BlinkPin.markup({ name: who.name, photo: who.live, flat: who.flat, size: 52, online: who.online, state: "moving", speed: who.speed, tag: "span", assets: A })}
    </span>`;

  // ── Лента ─────────────────────────────────────────────────────────────
  // живая упаковка на чёрном – видео: анимированный WebP браузер декодирует на процессоре, и шесть–восемь
  // таких на экране дёргаются; видео декодирует видеочип. Сначала виден постер (первый кадр петли),
  // видео грузится и играет, только пока оно у экрана (IntersectionObserver, «Живые упаковки» ниже)
  const videoMarkup = (cls, file) =>
    `<video class="${cls} mw-video" data-src="${A}/${file}" poster="${A}/${file.replace(/\.mp4$/, "-poster.webp")}"
            muted loop playsinline preload="none" disablepictureinpicture aria-hidden="true"></video>`;
  const packMarkup = (item) =>
    item.video
      ? videoMarkup("mw-item__pack", item.video)
      : `<img class="mw-item__pack" src="${A}/${item.pack}" alt="" loading="lazy" decoding="async">`;

  function card(item, cls = "") {
    return `
      <button class="mw-item pressable ${cls}" type="button" data-item="${item.id}" aria-label="${esc(label(item))}">
        ${packMarkup(item)}
        ${chip(item)}
      </button>`;
  }

  // Предмет недели у хвостов – низкий баннер: твой пин с этим хвостом на карте, упаковка
  // наклеена на угол карты, рядом имя и цена
  // почему хвост наверху – справа от названия: стикер огня (в blink – «горячо, первое место») и «хит недели»
  const whyMarkup = (why) => `
    <span class="mw-hero__why">
      <img class="mw-hero__why-sticker" src="${A}/stickers/fire.webp" alt="">
      <span>${esc(why)}</span>
    </span>`;

  function heroMarkup(item) {
    return `
      <button class="mw-hero pressable" type="button" data-item="${item.id}" aria-label="${esc(`${item.id === TAILS_FEED.best ? TAILS_FEED.why : "лучшее предложение"}: ${label(item)}`)}">
        <span class="mw-hero__map"><img class="mw-hero__tiles" src="${A}/market/map-tail.webp" alt="">${rider(item, ME_HD, "mw-rider--zoom")}</span>
        <img class="mw-hero__pack" src="${A}/${item.pack}" alt="">
        <span class="mw-hero__name">
          <span class="mw-hero__head">
            <span class="mw-hero__title">${esc(item.name)}</span>
            ${item.id === TAILS_FEED.best ? whyMarkup(TAILS_FEED.why) : ""}
          </span>
          <span class="mw-hero__price">${chip(item)}</span>
        </span>
      </button>`;
  }

  // Сезонный баннер стикеров: праздничная сцена фоном, «новые стикеры» наклейкой, крупный заголовок
  // и срок розовой пилюлей, стикеры всех наборов – каждый на своём месте в сцене и целиком
  // в баннере. Нажатие – подборка целиком
  function bannerMarkup(coll) {
    const n = coll.items.length;
    const packs = `${n}\u00a0${plural(n, "стикерпак", "стикерпака", "стикерпаков")}`;
    return `
      <button class="mw-season pressable" type="button" data-act="all"
              aria-label="${esc(`${coll.title}: ${packs}, ${coll.until}`)}">
        <span class="mw-season__scene" aria-hidden="true"><img src="${A}/${coll.banner}" alt=""></span>
        <span class="mw-season__text" aria-hidden="true">
          <span class="sticker-number mw-season__kicker">новые стикеры</span>
          <span class="mw-season__title">${esc(coll.title)}</span>
          <span class="mw-season__until">${esc(coll.until)}</span>
        </span>
        <span class="mw-season__stickers" aria-hidden="true">
          ${coll.items.map((id) => `<img class="mw-season__sticker mw-season__sticker--${id}" src="${A}/${ITEMS[id].sticker}" alt="">`).join("")}
        </span>
      </button>`;
  }

  // У друзей с хвостами – общая полоса города: друзья летят по ней в разные стороны, каждый со своим
  // хвостом; дальний – пин 36. at – острие пина на полосе (pt), heading – куда летит. Полоса шире
  // экрана и листается вбок; нажатие на друга – шторка его хвоста. Карта – ночная, как в ночлегах
  // (overnights/map-night.webp – весь город, одной картинкой без стыков)
  function skyMarkup(friends) {
    const width = Math.max(390, ...friends.map((f) => f.at[0] + 90));
    return `
      <div class="mw-sky">
        <div class="mw-sky__city" style="--w:${width}">
          <span class="mw-sky__map"><img class="mw-sky__tile" src="${A}/overnights/map-night.webp" alt="" loading="lazy" decoding="async"></span>
          ${friends.map(({ who, item: id, when, at, heading, far }) => {
            const f = FRIENDS[who];
            const item = ITEMS[id];
            return `
              <button class="mw-flyer pressable" type="button" data-item="${id}" style="--x:${at[0]};--y:${at[1]};--heading:${heading}deg"
                      aria-label="${esc(`${f.name}, ${when}: ${item.name}, ${item.kind}`)}">
                ${rider(item, f, [far && "mw-rider--far", item.tail && item.tail.includes("dementor") && "mw-rider--pale"].filter(Boolean).join(" "))}
              </button>`;
          }).join("")}
        </div>
      </div>`;
  }

  // у друзей: хвост – пин друга с этим хвостом на кусочке карты; стикерпак – упаковка с фото друга на углу
  function friendCard({ who, item: id, when }, i) {
    const f = FRIENDS[who];
    const item = ITEMS[id];
    if (item.tail)
      return `
      <button class="mw-friend mw-friend--pin pressable" type="button" data-item="${id}"
              aria-label="${esc(`${f.name}, ${when}: ${item.name}, ${item.kind}`)}">
        <span class="mw-friend__map" style="--map-x:${[20, 70, 45, 85][i % 4]}%;--map-y:${[30, 60, 80, 20][i % 4]}%">
          <img class="mw-friend__tiles" src="${A}/market/map-tail.webp" alt="" loading="lazy" decoding="async">
          ${rider(item, f)}
        </span>
        <span class="mw-friend__name ellipsis">${esc(f.name)}</span>
        <span class="mw-friend__when ellipsis">${esc(item.name)} · ${esc(when)}</span>
      </button>`;
    return `
      <button class="mw-friend pressable" type="button" data-item="${id}"
              aria-label="${esc(`${f.name}, ${when}: ${item.name}, ${item.kind}`)}">
        <span class="mw-friend__art"><img class="mw-friend__pack" src="${A}/${item.pack}" alt="" loading="lazy" decoding="async"></span>
        <img class="mw-friend__face" src="${f.photo}" alt="" loading="lazy" decoding="async">
        <span class="mw-friend__name ellipsis">${esc(f.name)}</span>
        <span class="mw-friend__when">${esc(when)}</span>
      </button>`;
  }

  // карточки коллекции в ряд; selected – «выбрано» под первой
  function cards(list, selected = false) {
    return list
      .map((art, i) => `<div class="mw-owned__card">${videoMarkup("mw-owned__video", `market/${art}.mp4`)}${
        selected && i === 0 ? `<span class="owned-card__selected mw-owned__selected"><span class="owned-card__check"><i class="icon icon--check" aria-hidden="true"></i></span>выбрано</span>` : ""}</div>`)
      .join("");
  }

  // лучшее предложение – огонь, пока не ушёл; ушёл – первый живой хвост из ленты с примеркой на пине
  const best = () =>
    [TAILS_FEED.best, ...TAILS_FEED.first].find((id) => !gone(ITEMS[id]) && (ITEMS[id].tail || ITEMS[id].follower));

  // Товар на странице один раз: скидочный – только в карточке скидки, комета (уже у тебя) – только
  // в «уже у тебя»
  const IN_COLLECTION = ["comet"];
  const shown = (ids) => ids.filter((id) => !IN_COLLECTION.includes(id) && !gone(ITEMS[id]) && !(dealFor(ITEMS[id]) && dealMarkup()));
  const grid = (ids, aria) => {
    const list = shown(ids);
    return list.length
      ? `<section class="mw-block mw-catalog" aria-label="${aria}"><div class="mw-offers">${list.map((id) => card(ITEMS[id])).join("")}</div></section>`
      : "";
  };

  // Только для тебя: личная скидка на один товар на сутки. Карточка с сеткой точек: упаковка слева,
  // справа имя, розовым «осталось 09:42:07» (секунды идут) и цена со старой зачёркнутой;
  // на правом верхнем углу наклеено «−40%» (стикер-число). Без заголовка – место бережём
  // сколько осталось скидке – розовой строкой под именем, тем же отсчётом, что пилюля у новинок
  function dealTimerMarkup() {
    const t = TIMERS.deal;
    const c = countdown(t.target(), t.prefix);
    return `
      <span class="mw-deal__note${c.left < 60000 ? " is-urgent" : ""}" role="timer" data-timer="deal" aria-label="${c.aria}">
        <span aria-hidden="true">осталось <span class="mw-timer__value">${c.html}</span></span>
      </span>`;
  }

  function dealMarkup() {
    const deal = DEALS[S.tab];
    const item = deal && ITEMS[deal.item];
    if (!item || !dealFor(item)) return "";
    return `
      <section class="mw-block mw-deal-block" aria-label="скидка только для тебя">
        <button class="mw-deal pressable" type="button" data-item="${item.id}" aria-label="${esc(label(item))}">
          <span class="mw-deal__art"><img class="mw-deal__pack" src="${A}/${item.pack}" alt="" loading="lazy" decoding="async"></span>
          <span class="mw-deal__info">
            <span class="mw-deal__name">${esc(item.name)}</span>
            ${dealTimerMarkup()}
            <span class="mw-deal__price">${chip(item)}</span>
          </span>
          <span class="sticker-number mw-deal__off" aria-hidden="true">−${deal.off}%</span>
        </button>
      </section>`;
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
        ${SOON_TABS.map((t) => `<span class="market-tab mw-tab--inert" role="tab" aria-disabled="true"
                                      id="market-tab-${t.id}">${esc(t.title)}</span>`).join("")}
      </div>
      <div class="mw-panel" id="market-panel" role="tabpanel"></div>`;
  }

  function renderFeed() {
    const w = week();
    const tails = S.tab === "tails";
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
    // купленные стикерпаки – упаковками в «уже у тебя»; у хвостов – коллекция с эталона
    const ownedPacks = [...S.owned].map((id) => ITEMS[id]).filter((i) => i.kind === "стикерпак");
    $("#market-panel").innerHTML = `
      ${tails ? `
      <section class="mw-block mw-best" aria-label="лучшее предложение">${heroMarkup(ITEMS[best()])}</section>
      ${grid(TAILS_FEED.first.filter((id) => id !== best()), "хвосты")}` : `
      ${coll && coll.banner ? bannerMarkup(coll) : ""}
      <section class="mw-block" aria-labelledby="week-title">
        <div class="mw-head">
          <h2 class="section-title" id="week-title">новинки</h2>
        </div>
        <div class="mw-offers">${w.offers.map((id) => card(ITEMS[id])).join("")}</div>
      </section>`}

      <section class="mw-block ${S.tab === "tails" ? "mw-friends--sky" : "mw-friends--stickers"}" aria-labelledby="friends-title">
        <div class="mw-head">
          <h2 class="section-title" id="friends-title">${S.tab === "tails" ? "хвосты друзей" : "стикеры друзей"}</h2>
        </div>
        ${w.friends.every((f) => ITEMS[f.item].kind === "хвост") ? skyMarkup(w.friends) : `<div class="mw-shelf">${w.friends.map((f, i) => friendCard(f, i)).join("")}</div>`}
      </section>

      ${/* скидка – после друзей; до баннера наверху – больше экрана (CLAUDE.md, правило 33) */ ""}
      ${dealMarkup()}

      ${coll && !coll.banner ? `
      <section class="mw-block" aria-labelledby="collection-title">
        <div class="mw-head">
          <h2 class="section-title" id="collection-title">${coll.title} <span class="section-title__count">${coll.until}</span></h2>
          <button class="more-link caps-label pressable" type="button" data-act="all">все <i class="icon icon--chevron" aria-hidden="true"></i></button>
        </div>
        <div class="mw-shelf mw-shelf--packs">${coll.items.map((id) => card(ITEMS[id], "mw-item--shelf")).join("")}</div>
      </section>` : ""}

      ${tails ? grid(TAILS_FEED.rest, "остальные хвосты") : grid(ALWAYS.stickers, "все товары")}

      ${S.tab === "tails" ? `
      <section class="mw-owned" aria-labelledby="owned-title">
        <div class="market-section mw-owned__title">
          <h2 class="market-section__title" id="owned-title">уже у тебя</h2>
          <p class="market-section__text">хвосты в коллекции</p>
        </div>
        <div class="mw-owned__grid">${cards(OWNED, true)}</div>
      </section>

      <section class="mw-owned mw-archive" aria-labelledby="archive-title">
        <img class="mw-archive__tape" src="${A}/market/tape.webp" alt="" loading="lazy" decoding="async">
        <div class="market-section mw-owned__title">
          <h2 class="market-section__title" id="archive-title">архив</h2>
          <p class="market-section__text">лимитированные хвосты,<br>которые остались в&nbsp;истории</p>
        </div>
        <div class="mw-owned__grid">${cards(ARCHIVE)}</div>
      </section>` : ownedPacks.length ? `
      <section class="mw-owned" aria-labelledby="owned-title">
        <div class="market-section mw-owned__title">
          <h2 class="market-section__title" id="owned-title">уже у тебя</h2>
          <p class="market-section__text">стикерпаки в коллекции</p>
        </div>
        <div class="market-grid mw-owned__packs">${ownedPacks.map((i) => card(i, "mw-item--grid")).join("")}</div>
      </section>` : ""}`;
  }

  // «все»: подборка к празднику сеткой
  function renderAll() {
    const coll = collection() || COLLECTIONS.stickers;
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
                aria-label="стикер из набора «жутко весело»">
          <img src="${A}/market/sticker-zombie.webp" alt="" loading="lazy" decoding="async">
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

  // Превью – как предмет выглядит в приложении.
  // Хвост – твоя карта: камера приближена в 1.5 раза (как в баннере), ты в пути с этим хвостом,
  // рядом друзья – пин 36 в сети и дальний 20. В кадре камеры видно x 19–86 %, y 23–90 % карты. Хвоста без упаковки нет – твой пин и упаковка на углу.
  // Стикер – переписка с лёвой: он пишет, ты отвечаешь этим стикером, он реагирует – видно, к чему он
  function previewMarkup(item) {
    if (item.kind === "хвост") {
      const lyova = FRIENDS.lyova;
      const sonya = FRIENDS.sonya;
      const worn = item.tail || item.follower;
      return `
        <div class="mw-preview mw-preview--map" aria-hidden="true">
          <div class="mw-preview__camera">
            <img class="mw-preview__tiles" src="${A}/market/map-tail.webp" alt="">
            <span class="mw-preview__friend" style="--x:31%;--y:42%">${window.BlinkPin.markup({ name: lyova.name, photo: lyova.live, size: 36, online: true, state: "staying", minutes: 12, tag: "span", assets: A })}</span>
            <span class="mw-preview__friend" style="--x:76%;--y:36%">${window.BlinkPin.markup({ name: sonya.name, photo: sonya.live, size: 20, state: "home", tag: "span", assets: A })}</span>
            ${rider(item, ME_HD, "mw-rider--zoom mw-preview__me")}
          </div>
          ${worn ? "" : `<img class="mw-preview__pack-tag" src="${A}/${item.pack}" alt="">`}
        </div>`;
    }
    if (item.sticker && item.chat) {
      const peer = FRIENDS.lyova;
      const [before, after] = item.chat;
      return `
        <div class="mw-preview mw-preview--chat" aria-hidden="true">
          <div class="mw-chat-peer">
            <span class="avatar avatar--online mw-chat-peer__avatar"><img class="avatar__img" src="${peer.photo}" alt=""></span>
            <span class="mw-chat-peer__text"><span class="mw-chat-peer__name">${esc(peer.name)}</span><span class="mw-chat-peer__status">в сети</span></span>
          </div>
          <div class="mw-chat-feed">
            <div class="message-row message-row--in mw-chat-msg" style="--i:0"><div class="bubble bubble--in">${esc(before)}</div></div>
            <div class="message-row message-row--out mw-chat-msg mw-chat-msg--sticker" style="--i:1"><div class="bubble bubble--sticker"><img src="${A}/${item.sticker}" alt=""></div></div>
            <div class="message-row message-row--in mw-chat-msg" style="--i:2"><div class="bubble bubble--in">${esc(after)}</div></div>
          </div>
        </div>`;
    }
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

  // 1 друга / 2 друзей / 5 друзей – «есть у 1 друга»
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
    if (!priceOf(item))
      return `<button class="button button--primary mw-buy mw-buy--free pressable" type="button" data-buy>забрать</button>`;
    return `<button class="button button--primary mw-buy pressable" type="button" data-buy>
      <span>купить</span>
      <span class="mw-buy__price"><img class="mw-buy__coin" src="${A}/market/coin.png" alt="">${formatCoins(priceOf(item))}${
        oldOf(item) ? `<s class="mw-buy__old">${formatCoins(oldOf(item))}</s>` : ""}</span>
    </button>`;
  }

  // тираж – полосой, как «осталось на складе» в подарке; дата ухода – розовым: время идёт
  // «уходит сегодня», «уходит завтра», «уходит 13.10» – когда хвост уйдёт из маркета
  function leaveText(ends) {
    const day = (t) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
    const days = Math.round((day(ends.getTime()) - day(now())) / 86400000);
    return days <= 0 ? "уходит сегодня" : days === 1 ? "уходит завтра" : `уходит ${ends.getDate()}.${pad(ends.getMonth() + 1)}`;
  }

  function fillSheet(ctx) {
    const item = ctx.item;
    const coll = Object.values(COLLECTIONS).find((c) => c.items.includes(item.id));
    const deal = dealFor(item);
    // срок словами: скидка – до конца дня, временный – когда уходит, сезонный – до конца сезона;
    // у тиражного срока нет, но и «всегда» не скажешь – о нём говорит склад ниже
    const leave = deal ? `скидка −${deal.off}% только для тебя – до\u00a0конца дня`
      : item.weekly ? DAYS[S.day].leave
      : item.ends ? leaveText(item.ends)
      : coll ? coll.until.replace("до", "в маркете до")
      : item.stock ? "" : "всегда в\u00a0маркете";
    const always = leave === "всегда в\u00a0маркете";
    const quoted = item.kind === "стикерпак" ? `«${item.name}»` : item.name;
    $("[data-title]", ctx.sheet).textContent = quoted;
    $("[data-body]", ctx.sheet).innerHTML = `
      ${leave ? `<p class="mw-sheet__leave${always && !deal ? " mw-sheet__leave--always" : ""}">${leave}</p>` : ""}
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

  function openSheet(app, id, opener, { focus = true } = {}) {
    const ctx = sheetFor(app);
    ctx.item = ITEMS[id];
    ctx.opener = opener;
    fillSheet(ctx);
    // переписка в превью проигрывается при открытии шторки, а не при каждой перерисовке (покупка)
    ctx.sheet.classList.add("is-entering");
    clearTimeout(ctx.entering);
    ctx.entering = setTimeout(() => ctx.sheet.classList.remove("is-entering"), 2000);
    ctx.backdrop.classList.add("is-open");
    ctx.sheet.classList.add("is-open");
    $$(".screen, .tabbar", app).forEach((el) => (el.inert = true));
    if (focus) requestAnimationFrame(() => ctx.sheet.focus({ preventScroll: true }));
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

  // покупка – как сейчас: одно нажатие «КУПИТЬ»; монеты списываются, кнопка на месте
  // становится «у тебя», ценник в ленте – тоже
  function buy(ctx) {
    const item = ctx.item;
    const price = priceOf(item);
    if (S.owned.has(item.id) || S.coins < price) return;
    S.coins -= price;
    S.owned.add(item.id);
    fillSheet(ctx);
    ctx.sheet.focus({ preventScroll: true });
    rerender();
  }

  // ── Экран «все» ───────────────────────────────────────────────────────
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

  // пульт: личная скидка – есть или нет; «кончится через 10 секунд» – видно, как раздел уходит
  $$("[data-deal]").forEach((b) =>
    b.addEventListener("click", () => {
      const v = b.dataset.deal;
      if (v === "soon") {
        S.deal = true;
        S.dealEnds = now() + 10000;
      } else {
        S.deal = v === "on";
        S.dealEnds = dealEndsFor(S.day);
      }
      rerender();
    })
  );

  // пульт: день недели
  $$("[data-day]").forEach((b) =>
    b.addEventListener("click", () => {
      setDay(b.dataset.day);
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
    $$("[data-deal='on'], [data-deal='off']").forEach((b) => b.setAttribute("aria-checked", String((b.dataset.deal === "on") === S.deal)));
  }

  function reset() {
    sheets.forEach(closeSheet);
    closeAll();
    Object.assign(S, { tab: "tails", coins: 55000, owned: new Set(OWNED_AT_START), deal: true });
    setDay("thu");
    rerender();
    $("#market-scroll").scrollTop = 0;
  }

  // ── Живые упаковки – видео: грузятся и играют, пока видны ────────────
  // лента перерисовывается целиком – новые <video> подхватываем наблюдателем за DOM. src – только когда
  // видео подъехало к экрану: до этого виден постер, и первый экран не ждёт ролики всей ленты.
  // В презентации телефон скрытого слайда на паузе: presentation.js шлёт {type: "mw-pause", paused}
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const seen = new Set();
  let paused = Boolean(window.frameElement) && window.frameElement.dataset.paused === "true";
  let sky = null;
  function playback(v) {
    if (!seen.has(v) || paused || reducedMotion.matches) return v.pause();
    if (!v.getAttribute("src")) v.src = v.dataset.src;
    v.play().catch(() => {});
  }
  const playIfSeen = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting }) => {
        if (!target.isConnected) {
          seen.delete(target);
          return playIfSeen.unobserve(target);
        }
        if (isIntersecting) seen.add(target);
        else seen.delete(target);
        playback(target);
      }), { rootMargin: "120px 0px" })
    : null;
  function watchVideos() {
    $$(".mw-video:not([data-watched])").forEach((v) => {
      v.dataset.watched = "";
      if (playIfSeen) return playIfSeen.observe(v);
      seen.add(v);
      playback(v);
    });
  }
  new MutationObserver(watchVideos).observe(document.body, { childList: true, subtree: true });
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== "mw-pause" || paused === e.data.paused) return;
    paused = e.data.paused;
    seen.forEach(playback);
    // слайд показали – переписка в открытой шторке проигрывается заново: в фоне её никто не видел
    if (!paused) $$(".mw-sheet.is-open").forEach((sheet) => {
      sheet.classList.remove("is-entering");
      void sheet.offsetWidth;
      sheet.classList.add("is-entering");
      setTimeout(() => sheet.classList.remove("is-entering"), 2000);
    });
    if (!sky) return;
    if (paused) sky.stop();
    else sky.set(sky.mode);
  });

  // ── Стенд в окне ──────────────────────────────────────────────────────
  // ?embed=market|chat – только один телефон, без пульта и подписей: для презентации (presentation.html).
  // Телефон 390×844 во всю страницу, рамку и масштаб даёт презентация
  const params = new URLSearchParams(location.search);
  const embed = params.get("embed");
  if (embed) document.documentElement.classList.add("is-embed", `is-embed--${embed === "chat" ? "chat" : "market"}`);

  function fit() {
    const phones = $("#stage-phones");
    if (embed) return phones.style.removeProperty("--stage-zoom");
    if (innerWidth <= 480) return phones.style.removeProperty("--stage-zoom");
    // 874 – телефон и подпись над ним
    const room = innerHeight - $(".stage__head").offsetHeight - 80;
    const wide = (innerWidth - 48) / 1092;
    phones.style.setProperty("--stage-zoom", Math.min(1, room / 874, wide).toFixed(3));
  }
  fit();
  addEventListener("resize", fit);

  sky = window.BlinkSky ? window.BlinkSky.start($(".market__sky"), { mode: "stars" }) : null;
  if (sky && paused) sky.stop();

  // ?tab=stickers – вкладка; ?day=sun|last|mon – день; ?item=<id> – сразу шторка предмета; ?chat – она же в чате;
  // ?deal=off – скидки нет, ?deal=soon – скидка кончится через 10 секунд; ?focus=<раздел> – лента сразу на нём
  const q = params;
  setDay(DAYS[q.get("day")] ? q.get("day") : "thu");
  if (q.get("deal") === "off") S.deal = false;
  if (q.get("deal") === "soon") S.dealEnds = now() + 10000;
  if (WEEKS[q.get("tab")]) S.tab = q.get("tab");
  (q.get("owned") || "").split(",").filter((id) => ITEMS[id]).forEach((id) => S.owned.add(id));
  renderChat();
  renderShell();
  rerender();
  // тик – ровно на смене секунды отсчёта: цифры меняются вовремя, витрина – ровно в ноль
  (function loop() {
    tick();
    const next = (target) => (target - now()) % 1000 || 1000;
    setTimeout(loop, Math.max(20, Math.min(next(WEEK_ENDS[DAYS[S.day].week]), S.dealEnds > now() ? next(S.dealEnds) : 1000)));
  })();
  // во встраивании шторка из адреса фокус не забирает: стрелки листают презентацию, а не прототип
  if (ITEMS[q.get("item")]) openSheet(q.has("chat") ? $("#app-chat") : marketApp, q.get("item"), null, { focus: !embed });
  if (q.has("all")) openAll(null);

  // ?focus=hero|novelties|grid|friends|deal – лента прокручена так, что раздел под шапкой. Шрифты и картинки
  // догружаются и сдвигают ленту – раздел держим на месте, пока человек сам не тронул ленту
  // [раздел, отступ от верха экрана]: у сетки над ней видно низ героя целиком (название и цена
  // не под статус-баром), у скидки – ещё и друзей
  const FOCUS = {
    novelties: ["[aria-labelledby='week-title']", 96],
    grid: [".mw-catalog", 150],
    friends: ["[aria-labelledby='friends-title']", 96],
    deal: [".mw-deal-block", 300],
  };
  if (FOCUS[q.get("focus")]) {
    const scroller = $("#market-scroll");
    let touched = false;
    ["wheel", "touchstart", "pointerdown", "keydown"].forEach((e) => scroller.addEventListener(e, () => (touched = true), { passive: true }));
    const place = () => {
      const [sel, offset] = FOCUS[q.get("focus")];
      const el = $(`#feed ${sel}`);
      if (!el || touched) return;
      scroller.scrollTop += el.getBoundingClientRect().top - scroller.getBoundingClientRect().top - offset;
    };
    place();
    document.fonts.ready.then(place);
    setTimeout(place, 600);
    setTimeout(place, 1500);
  }
  // ?embed: первый экран отрисован (шрифты и картинки в кадре) – телефон говорит презентации «готов»,
  // и она убирает загрузку, не дожидаясь, пока догрузится вся лента. Ждём не дольше 3 s
  if (embed && parent !== window) {
    const phone = embed === "chat" ? $("#app-chat") : marketApp;
    const pending = $$("img", phone).filter((img) => !img.complete && img.loading !== "lazy" && img.getBoundingClientRect().top < 844);
    const settled = (img) => new Promise((ok) => ["load", "error"].forEach((e) => img.addEventListener(e, ok, { once: true })));
    Promise.race([document.fonts.ready.then(() => Promise.all(pending.map(settled))), new Promise((ok) => setTimeout(ok, 3000))])
      .then(() => requestAnimationFrame(() => requestAnimationFrame(() => parent.postMessage({ type: "mw-ready" }, location.origin))));
  }
  window.MarketWeek = { S, ITEMS, WEEKS, openSheet, rerender };
})();
