/*
 * Маркет: общий хаб товаров.
 *
 * Первая страница маркета – все товары одной лентой. Сверху вместо вкладок – блок категорий:
 * пять плиток на экране без прокрутки (три и две пошире): стикеры, хвосты, подарки, стили карты,
 * рамки. Нажатие на плитку – она становится белой, лента ниже показывает только эту категорию;
 * повторное нажатие снимает фильтр. Товары – в одинаковых карточках (окно с предметом, имя, цена),
 * по рекомендованности (rank), без заголовка; после шестого товара – панель «покупки друзей»:
 * что друзья брали недавно, в той же категории, что выбрана.
 *
 * Товары: стикерпаки и подарки – вырезки со скриншотов маркета без бейджей NEW и LIMITED
 * (build_assets.py → build_market_hub), подарки из фигмы – market/gifts; хвосты – живые упаковки
 * маркета недели; стили карты – снимки карты из features/map-styles; рамки – features/pin-styles.
 * Бейджи на карточках – новые чипы market chips/: часы с остатком срока, «шт», VIP, скидка.
 * Нажатие на товар – шторка предмета маркета недели: превью, «есть у N друзей», «КУПИТЬ».
 */
(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const A = "../../assets";
  const H = `${A}/market-hub`;
  const { formatCoins } = window.BlinkMarket;

  const esc = (v) =>
    String(v).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  // ── Категории ──────────────────────────────────────────────────────────
  // row – в каком ряду блока; kind – как товар назван в шторке
  const CATS = [
    { id: "stickers", title: "стикеры", kind: "стикерпак", row: 0 },
    { id: "tails", title: "хвосты", kind: "хвост", row: 0 },
    { id: "gifts", title: "наклейки", kind: "наклейка", row: 0 },
    { id: "styles", title: "стили карты", kind: "стиль карты", row: 1 },
    { id: "frames", title: "рамки", kind: "рамка пина", row: 1 },
    // только в варианте верха «vip в разделах»: фильтрует ленту по товарам «только в подписке»
    { id: "vip", title: "blink vip", kind: "товар blink vip", row: 1, onlyTile: true },
  ];
  const catOf = (id) => CATS.find((c) => c.id === id);
  // верх ленты: banner – баннер blink vip и пять разделов; tile – шесть разделов, vip – один из них
  const TOPS = { banner: "баннер и разделы", tile: "vip в разделах" };
  const shownCats = () => CATS.filter((c) => !c.onlyTile || S.top === "tile");
  const inCat = (item, cat = S.cat) => !cat || (cat === "vip" ? Boolean(item.vip) : item.cat === cat);

  // ── Время стенда ───────────────────────────────────────────────────────
  // сроки считаются от открытия страницы: «ещё 3 дня», а у одного товара – меньше двух суток,
  // и его срок идёт по секундам («в продаже 32:56:11», как в примере чипа)
  const T0 = Date.now();
  const H_ = 3600000;
  const D_ = 24 * H_;

  // ── Каталог ────────────────────────────────────────────────────────────
  // rank – рекомендованность: чем больше, тем выше в ленте. ends – когда уходит, stock – тираж,
  // off – скидка в процентах (old считается сам), vip – только в подписке.
  // friends – у скольких друзей уже есть. Цены стикеров и подарков – со скриншотов маркета
  const ITEMS = {
    // стикерпаки: вырезки со скриншотов вкладки «стикеры» (чёрные пакеты)
    chihuahua: { cat: "stickers", name: "чихуахуа", art: "stickers/chihuahua", price: 5, rank: 98, friends: 4, ends: T0 + 3 * D_ + 5 * H_,
      text: "маленькая собака с большими глазами – ответ на любое «ну пожалуйста»" },
    hat: { cat: "stickers", name: "панама", art: "stickers/hat", price: 1000, rank: 71, friends: 1, stock: { left: 68, total: 100 },
      text: "тот самый взгляд из-под панамы" },
    cry: { cat: "stickers", name: "ржака", art: "stickers/cry", price: 0, rank: 80, friends: 6,
      text: "смеёшься до слёз – и не надо печатать «ахахах»" },
    strawberry: { cat: "stickers", name: "клубника", art: "stickers/strawberry", price: 5, rank: 52, friends: 1,
      text: "сочная клубника для сладких переписок" },
    banana: { cat: "stickers", name: "банан", art: "stickers/banana", price: 5, rank: 47, friends: 2,
      text: "золотой банан – без лишних слов" },
    fan: { cat: "stickers", name: "вентилятор", art: "stickers/fan", price: 12, rank: 44, friends: 0,
      text: "когда в чате стало жарко" },
    bomb: { cat: "stickers", name: "бомба", art: "stickers/bomb", price: 10, rank: 58, friends: 3,
      text: "звезда-бомба с коктейлем: новости, от которых всё взрывается" },
    six: { cat: "stickers", name: "шестёрка", art: "stickers/six", price: 7, rank: 30, friends: 0, text: "стеклянная шестёрка" },
    seven: { cat: "stickers", name: "семёрка", art: "stickers/seven", price: 6, rank: 33, friends: 1, text: "стеклянная семёрка – на удачу" },
    vampire: { cat: "stickers", name: "вампир", art: "stickers/vampire", price: 5, rank: 38, friends: 1, text: "граф выходит на связь после заката" },
    rose: { cat: "stickers", name: "роза", art: "stickers/rose", price: 5, rank: 41, friends: 2, text: "стеклянная роза – вместо тысячи слов" },
    parrot: { cat: "stickers", name: "попугаи", art: "stickers/parrot", price: 5, rank: 36, friends: 0, text: "двое неразлучников в зеркале" },
    skull: { cat: "stickers", name: "череп", art: "stickers/skull", price: 20, rank: 49, friends: 2, text: "череп с розой и шариком – готика на каждый день" },
    cat: { cat: "stickers", name: "кот в капюшоне", art: "stickers/cat", price: 5, rank: 62, friends: 3, text: "кот в капюшоне смотрит прямо в душу" },
    penguin: { cat: "stickers", name: "пингвин", art: "stickers/penguin", price: 5, rank: 27, friends: 0, text: "пингвин, которому всё понятно" },

    // подарки: прозрачные коробки – скриншоты вкладки «подарки» и фигма (market/gifts)
    ring: { cat: "gifts", name: "кольцо", art: "gifts/ring", price: 1000, off: 99, rank: 95, friends: 1, ends: T0 + 32 * H_ + 56 * 60000 + 11000,
      text: "золотое кольцо с камнем. останется в профиле у того, кому подаришь" },
    crown: { cat: "gifts", name: "корона", art: "gifts/crown", price: 50, rank: 74, friends: 3, text: "для того, кто сегодня главный" },
    chocolate: { cat: "gifts", name: "шоколад", art: "gifts/chocolate", price: 3, rank: 55, friends: 5, text: "кусочек шоколада – просто так" },
    coconut: { cat: "gifts", name: "кокосы", art: "gifts/coconut", price: 5, rank: 31, friends: 0, text: "два кокоса – намёк на отпуск" },
    leaf: { cat: "gifts", name: "листик", art: "gifts/leaf", price: 5, rank: 25, friends: 1, text: "зелёный листик на память" },
    daisy: { cat: "gifts", name: "ромашка", art: "gifts/daisy", price: 5, rank: 46, friends: 2, text: "любит – не любит" },
    candle: { cat: "gifts", name: "свеча", art: "gifts/candle", price: 3, rank: 29, friends: 0, text: "свеча для тёплого вечера" },
    candy: { cat: "gifts", name: "конфета", art: "gifts/candy", price: 10, rank: 50, friends: 3, text: "ромашка в фантике, как из детства" },
    bottle: { cat: "gifts", name: "чекушка", art: "gifts/bottle", price: 10, rank: 35, friends: 2, text: "маленькая бутылка на большой праздник" },
    flower: { cat: "gifts", name: "роза", art: "gifts/flower", price: 10, rank: 64, friends: 4, stock: { left: 68, total: 200 },
      text: "живая красная роза в коробке" },
    heel: { cat: "gifts", name: "туфля", art: "gifts/heel", price: 10, rank: 40, friends: 1, text: "лакированная туфля с красной подошвой" },

    // хвосты: живые упаковки маркета недели (market/tails/*.mp4), тираж и сроки – оттуда же
    fire: { cat: "tails", name: "огонь", pack: "market/anim-tail-fire.webp", tail: "tails/rocket.webp", price: 500, rank: 92, friends: 3,
      text: "реактивное пламя за твоим пином на карте" },
    jelly: { cat: "tails", name: "медузы", video: "market/tails/jelly.mp4", pack: "market/tails/jelly-poster.webp", follower: "market/tails/bare-jelly.webp",
      price: 30, ends: T0 + 3 * D_ + 9 * H_, rank: 70, friends: 4, text: "медузы и пузыри плывут за твоим пином" },
    paws: { cat: "tails", name: "лапки", video: "market/tails/paws.mp4", pack: "market/tails/paws-poster.webp", follower: "market/tails/bare-paws.webp",
      price: 15, rank: 54, friends: 3, text: "цветные следы лапок за твоим пином" },
    crystal: { cat: "tails", name: "кристалл", video: "market/tails/crystal.mp4", pack: "market/tails/crystal-poster.webp", follower: "market/tails/bare-crystal.webp",
      price: 6, rank: 34, friends: 0, text: "фиолетовый кристалл с осколками летит за тобой" },
    scroll: { cat: "tails", name: "свиток", video: "market/tails/scroll.mp4", pack: "market/tails/scroll-poster.webp", follower: "market/tails/bare-scroll.webp",
      price: 20, rank: 39, friends: 1, text: "старый свиток с корнями тянется за пином" },
    paper: { cat: "tails", name: "рулон", video: "market/tails/paper.mp4", pack: "market/tails/paper-poster.webp", follower: "market/tails/bare-paper.webp",
      price: 10, rank: 28, friends: 2, text: "рулон бумаги разматывается за тобой по всей карте" },

    // стили карты: снимки из features/map-styles – твоя карта в этом стиле в белой рамке
    gta: { cat: "styles", name: "гта", style: "gta", focus: "50% 6%", price: 2500, stock: { left: 42, total: 100 }, rank: 88, friends: 5,
      text: "карта в цветах гта – тёмный асфальт и значки мест как в игре" },
    potter: { cat: "styles", name: "гарри поттер", style: "potter", focus: "50% 55%", price: 3000, ends: T0 + 5 * D_ + 2 * H_, rank: 68, friends: 0,
      text: "город на старом пергаменте, подписи от руки – как карта мародёров" },
    minecraft: { cat: "styles", name: "майнкрафт", style: "minecraft", focus: "45% 50%", price: 3000, ends: T0 + 3 * D_ + 14 * H_, rank: 73, friends: 2,
      text: "весь город собран из кубиков, даже вода" },
    winter: { cat: "styles", name: "зима", style: "winter-light", focus: "40% 45%", price: 0, vip: true, rank: 57, friends: 3,
      text: "снег на крышах, а по улицам ездят снегоуборочные машины" },

    // рамки пина: features/pin-styles (frames.js собирает кольца на холсте при загрузке текстур)
    crystalFrame: { cat: "frames", name: "алмаз", frame: "crystal", price: 1500, rank: 85, friends: 1, stock: { left: 68, total: 300 },
      text: "необработанный камень вокруг твоего пина, по граням пробегает свет" },
    pearl: { cat: "frames", name: "жемчуг", frame: "pearl", price: 1200, rank: 63, friends: 2,
      text: "ожерелье по краю пина и перламутр внутри" },
    fur: { cat: "frames", name: "мех", frame: "fur", price: 900, off: 50, rank: 59, friends: 0,
      text: "розовый мех – ворсинки выходят за край пина" },
    burnt: { cat: "frames", name: "тлеющая бумага", frame: "burnt", price: 700, ends: T0 + 3 * D_ + 20 * H_, rank: 43, friends: 1,
      text: "край пина обгорел, а тление ползёт по кромке" },
  };

  // Предметы без упаковки (bare, путь от assets) – для ленты карточками с подложкой: там упаковка лишняя.
  // Стикеры и подарки – market/clear stickers и market/clear gifts (build_assets.py → build_market_hub),
  // хвосты – сам хвост, вырезанный из ролика упаковки (market/tails/bare-*) или хвост для пина
  const CLEAR = `market-hub/clear`;
  Object.entries({
    chihuahua: "stickers/chihuahua", cat: "stickers/cat", penguin: "stickers/penguin",
    crown: "gifts/crown", coconut: "gifts/coconut", leaf: "gifts/leaf", chocolate: "gifts/chocolate",
  }).forEach(([id, file]) => (ITEMS[id].bare = `${CLEAR}/${file}.webp`));
  Object.entries(ITEMS).forEach(([id, item]) => {
    // фигурка – очищенная вырезка market-hub/clear/tails; хвост из пина (огонь) – tails/rocket.webp
    if (item.cat === "tails") item.bare = item.follower ? `${CLEAR}/tails/${id}.webp` : item.tail;
    // clip – живой хвост для карточки: ролик упаковки (у огня – анимированный WebP), в карточке виден
    // только хвост – окно внутри упаковки, сама упаковка остаётся за рамкой
    if (item.cat === "tails") item.clip = item.video ? { video: item.video, poster: item.pack } : { img: item.pack };
  });
  // есть только без упаковки – в ленте без подложек (упаковками) их нет
  Object.assign(ITEMS, {
    heart: { cat: "stickers", name: "разбитое сердце", bare: `${CLEAR}/stickers/heart.webp`, price: 5, rank: 78, friends: 3,
      text: "сердце в цепях – когда всё сложно" },
    anime: { cat: "stickers", name: "аниме", bare: `${CLEAR}/stickers/anime.webp`, price: 12, rank: 69, friends: 2, off: 50,
      text: "слёзы, румянец и язык – эмоции на максимум" },
    emo: { cat: "stickers", name: "эмо", bare: `${CLEAR}/stickers/emo.webp`, price: 14, rank: 65, friends: 1,
      text: "чёлка, тушь и вселенская грусть" },
    bee: { cat: "stickers", name: "пчела", bare: `${CLEAR}/stickers/bee.webp`, price: 5, rank: 61, friends: 4,
      text: "пчела с большими глазами – жужжит в ответ" },
    slipper: { cat: "stickers", name: "тапок", bare: `${CLEAR}/stickers/slipper.webp`, price: 10, rank: 56, friends: 2, stock: { left: 68, total: 100 },
      text: "синий тапок blink – летит в того, кто заслужил" },
    skullSilver: { cat: "stickers", name: "череп", bare: `${CLEAR}/stickers/skull.webp`, price: 20, rank: 51, friends: 2,
      text: "серебряный череп – готика на каждый день" },
    brick: { cat: "stickers", name: "кирпич", bare: `${CLEAR}/stickers/brick.webp`, price: 5, rank: 48, friends: 0, text: "весомый аргумент" },
    coffin: { cat: "stickers", name: "гроб", bare: `${CLEAR}/stickers/coffin.webp`, price: 5, rank: 45, friends: 1, text: "«я умер» – но стикером" },
    scoop: { cat: "stickers", name: "блинчик", bare: `${CLEAR}/stickers/scoop.webp`, price: 5, rank: 42, friends: 0, text: "блин с икрой на совке – подано" },
    toothpaste: { cat: "stickers", name: "паста", bare: `${CLEAR}/stickers/toothpaste.webp`, price: 5, rank: 37, friends: 0, text: "выдавлено до конца" },
    grasshopper: { cat: "stickers", name: "кузнечик", bare: `${CLEAR}/stickers/grasshopper.webp`, price: 5, rank: 32, friends: 1, text: "кузнечик, которому всё надоело" },
    gnome: { cat: "gifts", name: "гном", bare: `${CLEAR}/gifts/gnome.webp`, price: 30, rank: 82, friends: 2, ends: T0 + 32 * H_ + 56 * 60000 + 11000,
      text: "садовый гном – будет стоять в профиле и охранять" },
    heart67: { cat: "gifts", name: "6+7", bare: `${CLEAR}/gifts/heart67.webp`, price: 5, rank: 67, friends: 3, text: "валентинка от руки" },
    babe: { cat: "gifts", name: "babe", bare: `${CLEAR}/gifts/babe.webp`, wide: true, price: 0, rank: 58, friends: 4, text: "наклейка для своих" },
    vipTag: { cat: "gifts", name: "vip", bare: `${CLEAR}/gifts/vip.webp`, price: 50, rank: 53, friends: 1, text: "граффити для того, кто особенный" },
    panties: { cat: "gifts", name: "трусики", bare: `${CLEAR}/gifts/panties.webp`, price: 3, rank: 44, friends: 1, text: "розовые, с бантиками" },
    loh: { cat: "gifts", name: "loh", bare: `${CLEAR}/gifts/loh.webp`, wide: true, price: 5, rank: 38, friends: 2, text: "наклейка для лучшего друга" },
    sperm: { cat: "gifts", name: "sperm", bare: `${CLEAR}/gifts/sperm.webp`, wide: true, price: 5, rank: 33, friends: 0, text: "наклейка с характером" },
    kurwa: { cat: "gifts", name: "kurwa", bare: `${CLEAR}/gifts/kurwa.webp`, wide: true, price: 5, rank: 30, friends: 0, text: "записка на жёлтом листке" },
    gold: { cat: "tails", name: "золото", bare: `${CLEAR}/tails/gold.webp`,
      clip: { video: "market/tails/gold.mp4", poster: "market/tails/gold-poster.webp" }, follower: "market/tails/bare-gold.webp",
      price: 777, stock: { left: 42, total: 100 }, rank: 77, friends: 1, text: "золотые монеты сыплются за твоим пином, тиражом 100 штук" },
  });
  Object.entries(ITEMS).forEach(([id, item]) => (item.id = id));
  // что есть в ленте: карточками – всё, у чего есть предмет без упаковки; упаковками – всё, у чего есть упаковка.
  // Стили карты и рамки упаковок не имеют – они в обеих лентах
  const bareMode = () => S.layout !== "air";
  const inFeed = (item) =>
    item.cat === "styles" || item.cat === "frames" || Boolean(bareMode() ? item.bare : item.art || item.pack);

  // Друзья – пак людей из avatars/, имена как в соседних фичах
  const FRIENDS = {
    lyova: { name: "лёва", photo: `${A}/people/photo-3.webp`, live: `${A}/people/live-3.webp` },
    sonya: { name: "соня", photo: `${A}/people/photo-4.webp`, live: `${A}/people/live-4.webp` },
    timur: { name: "тимур", photo: `${A}/people/photo-2.webp`, live: `${A}/people/live-2.webp` },
    vasya: { name: "вася", photo: `${A}/people/photo-5.webp`, live: `${A}/people/live-5.webp` },
    natashka: { name: "наташка", photo: `${A}/people/photo-1.webp`, live: `${A}/people/live-1.webp` },
  };
  const FACES = ["lyova", "sonya", "timur", "vasya", "natashka"];

  // покупки друзей – свежие сверху; в каждой категории хотя бы одна, чтобы полка была и с фильтром
  const BOUGHT = [
    { who: "sonya", item: "chihuahua", when: "сегодня" },
    { who: "timur", item: "gta", when: "сегодня" },
    { who: "lyova", item: "fire", when: "вчера" },
    { who: "natashka", item: "flower", when: "вчера" },
    { who: "vasya", item: "crystalFrame", when: "10.11" },
    { who: "lyova", item: "cry", when: "10.11" },
    { who: "sonya", item: "jelly", when: "9.11" },
    { who: "timur", item: "crown", when: "8.11" },
    { who: "natashka", item: "pearl", when: "8.11" },
    { who: "vasya", item: "minecraft", when: "7.11" },
  ];

  const ME = { name: "ты", live: `${A}/people/live-1.webp`, online: true, speed: 25 };
  const ME_HD = { ...ME, live: `${A}/people/live-hd-1.webp` };

  const START = { cat: null, coins: 55000, owned: [] };
  // вёрстка ленты товаров: air – на чёрном, без подложек; cards – классическая: у каждого товара
  // своя карточка-подложка, имя и ценник слева
  // tiles – на подложке только предмет и чип, имя и цена под ней на чёрном (как в доставках продуктов)
  const LAYOUTS = { air: "без подложек", cards: "карточки с подложкой", tiles: "подложка под товаром",
    // themed – те же плитки, но подложка у каждого типа своя: подчёркивает, где товар живёт
    themed: "подложка по типу товара" };
  const gridClass = () => (S.layout === "themed" ? "mh-grid--tiles mh-grid--themed" : `mh-grid--${S.layout}`);
  // лента: flat – все товары подряд; sections – блоки по разделам с «ещё», плитки и «ещё» открывают экран раздела
  const FEEDS = { flat: "подряд", sections: "по разделам" };
  const S = { cat: null, coins: 0, owned: new Set(), layout: "air", top: "banner", deal: true, dealEnds: 0, feed: "flat", screen: null };
  // личная скидка – до конца суток: выдана в полночь, пропадает в следующую
  const midnight = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); };
  const setState = () => Object.assign(S, START, { owned: new Set(START.owned), deal: true, dealEnds: midnight() });

  // Скидка только для тебя (как в features/market-week): один товар на сутки, подобран по вкусу.
  // Пока действует – товар только в карточке скидки, в сетке его нет; в шторке – цена со скидкой
  const DEAL = { item: "fire", off: 40 };
  const dealOn = () => S.deal && Date.now() < S.dealEnds && !S.owned.has(DEAL.item);
  const dealFor = (item) => dealOn() && item.id === DEAL.item;
  const offOf = (item) => (dealFor(item) ? DEAL.off : item.off);

  // ── Цена и сроки ───────────────────────────────────────────────────────
  const priceOf = (item) => (offOf(item) ? Math.max(1, Math.round((item.price * (100 - offOf(item))) / 100)) : item.price);
  const pad = (n) => String(n).padStart(2, "0");

  // «3 дня» – пока больше двух суток; потом часы по секундам, как в примере чипа «32:56:11»
  function leftText(ends) {
    const left = Math.max(0, ends - Date.now());
    const sec = Math.ceil(left / 1000);
    if (left >= 2 * D_) {
      const d = Math.floor(left / D_);
      return { short: false, text: `ещё ${d} ${plural(d, "день", "дня", "дней")}`, aria: `уйдёт через ${d} ${plural(d, "день", "дня", "дней")}` };
    }
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return { short: true, text: `${pad(h)}:${pad(m)}:${pad(sec % 60)}`,
      aria: `уйдёт через ${h} ${plural(h, "час", "часа", "часов")} ${m} ${plural(m, "минуту", "минуты", "минут")}` };
  }

  // ── Чипы на упаковке (market chips/) ──────────────────────────────────
  // одна метка на карточку, по важности: VIP → скидка → срок → тираж. Купленное – без меток
  function badge(item) {
    if (S.owned.has(item.id)) return "";
    if (item.vip) return `<img class="mh-badge mh-badge--vip" src="${H}/chips/vip.png" alt="">`;
    if (offOf(item)) return `<span class="mh-badge mh-badge--off" aria-hidden="true">−${offOf(item)}%</span>`;
    if (item.ends) {
      const t = leftText(item.ends);
      return `<span class="mh-badge mh-utility${t.short ? " mh-utility--two" : ""}" data-ends="${item.ends}" aria-hidden="true">
        <img class="mh-utility__clock" src="${H}/chips/clock.png" alt="">
        <span class="mh-utility__text">${t.short ? '<small>в продаже</small>' : ""}<b data-left>${t.text}</b></span></span>`;
    }
    if (item.stock)
      return `<span class="mh-badge mh-utility" aria-hidden="true">
        <img class="mh-utility__clock" src="${H}/chips/clock.png" alt=""><span class="mh-utility__text"><b>${item.stock.left}&nbsp;шт</b></span></span>`;
    return "";
  }

  // ценник – тёмная пилюля маркета (.price-chip): монета и число (старая зачёркнута), «бесплатно»,
  // «у тебя»; VIP – серое «только в подписке» без пилюли, как в примере market chips/
  function priceMarkup(item) {
    if (S.owned.has(item.id))
      return `<span class="price-chip mw-chip mw-chip--owned mh-price mh-price--owned"><span class="mw-chip__check"><i class="icon icon--check" aria-hidden="true"></i></span>у тебя</span>`;
    if (item.vip) return `<span class="mh-price mh-price--note">только в подписке</span>`;
    if (!priceOf(item)) return '<span class="price-chip mw-chip mh-price">бесплатно</span>';
    return `<span class="price-chip price-chip--coins mw-chip mh-price"><img class="price-chip__coin" src="${A}/market/coin.png" alt="">${formatCoins(priceOf(item))}${
      offOf(item) ? `<s class="mw-chip__old mh-price__old">${formatCoins(item.price)}</s>` : ""}</span>`;
  }

  function label(item) {
    const kind = catOf(item.cat).kind;
    const price = S.owned.has(item.id) ? "уже у тебя"
      : item.vip ? "только в подписке blink vip"
      : !priceOf(item) ? "бесплатно"
      : `${formatCoins(priceOf(item))} ${plural(priceOf(item), "монета", "монеты", "монет")}${offOf(item) ? `, было ${formatCoins(item.price)}, скидка ${offOf(item)} %` : ""}`;
    const extra = S.owned.has(item.id) ? ""
      : item.ends ? `, ${leftText(item.ends).aria}`
      : item.stock ? `, осталось ${item.stock.left} штук` : "";
    return `${item.name}, ${kind}, ${price}${extra}`;
  }

  // ── Картинка товара ────────────────────────────────────────────────────
  // рамка – детали поверх кольца (блик, искры, ворс, тление) из features/pin-styles
  const vars = (o) => Object.entries(o).map(([k, v]) => `--${k}:${v}`).join(";");
  function decor(frame) {
    const F = window.BlinkFrames;
    if (!F || !F.ready) return "";
    switch (frame) {
      case "crystal":
        return '<span class="ps-fx"><span class="ps-shine"></span></span>' +
          F.glints.map((p, i) => `<span class="ps-spark" style="${vars({ sx: `${(p.x + 6).toFixed(2)}px`, sy: `${(p.y + 6).toFixed(2)}px`, sd: `${i * 0.9}s` })}"></span>`).join("");
      case "pearl":
        return '<span class="ps-fx"><span class="ps-shine"></span></span>';
      case "fur":
        return '<span class="ps-hair"></span><span class="ps-hair ps-hair--b"></span>';
      case "burnt":
        return '<span class="ps-ember"></span>';
      default:
        return "";
    }
  }
  const framedPin = (frame, who = ME_HD, extra = {}) =>
    window.BlinkPin.markup({ name: who.name, photo: who.live, size: 52, frame, tag: "span", assets: A, ...extra })
      .replace('<span class="pin__skin pin__skin--back"></span>', `<span class="pin__skin pin__skin--back">${decor(frame)}</span>`);

  // хвост – твой пин в пути с этим хвостом (разметка маркета недели: .mw-rider)
  const rider = (item, who = ME, cls = "") => `
    <span class="mw-rider ${cls}" aria-hidden="true">
      ${item.tail ? `<span class="mw-rider__wing"><img class="mw-rider__tail" src="${A}/${item.tail}" alt=""></span>` : ""}
      ${item.follower ? `<img class="mw-rider__follower" src="${A}/${item.follower}" alt="">` : ""}
      ${window.BlinkPin.markup({ name: who.name, photo: who.live, size: 52, online: who.online, state: "moving", speed: who.speed, tag: "span", assets: A })}
    </span>`;

  const styleThumb = (item) => `${A}/map-styles/${item.style}-thumb.webp`;

  // Картинка товара в окне карточки – окно у всех одного размера, предмет стоит по центру:
  // пакет, коробка, живое видео (чёрный фон ролика растворяется в карточке), снимок карты во всё окно
  // с твоим пином, рамка – твой пин в этой рамке
  // mini – мини-карточка в «покупках друзей»: без пина на карте, хвост – статичным окном
  // deal – карточка личной скидки. Огонь в мини-карточке и в скидке – сам хвост без упаковки (tails/rocket):
  // его ролик – упаковка целиком, окно хвоста из неё в маленьком размере не читается
  function artMarkup(item, { live = true, mini = false, deal = false } = {}) {
    if (item.cat === "styles")
      return `
        <span class="mh-map" aria-hidden="true">
          <img class="mh-map__img" src="${styleThumb(item)}" alt="" style="object-position:${item.focus}">
          ${mini ? "" : `<span class="mh-map__pin">${window.BlinkPin.markup({ name: ME.name, photo: ME.live, size: 36, tag: "span", assets: A })}</span>`}
        </span>`;
    if (item.cat === "frames") return `<span class="mh-framepin" aria-hidden="true">${framedPin(item.frame)}</span>`;
    // хвост в карточке – живой: тот же ролик, что в упаковке, но в рамке только окно с хвостом
    if (item.tail && (mini || (deal && bareMode())))
      return `<img class="mh-art mh-art--bare mh-art--flame" src="${A}/${item.tail}" alt="" decoding="async">`;
    // в «покупках друзей» – всегда сам предмет без упаковки, если он есть
    if (mini && item.bare) return `<img class="mh-art mh-art--bare" src="${A}/${item.bare}" alt="" decoding="async">`;
    if (bareMode() && item.clip)
      return `<span class="mh-tailclip">${item.clip.video && live
        ? `<video class="mw-video mh-video mh-tailclip__media" data-src="${A}/${item.clip.video}" poster="${A}/${item.clip.poster}"
                  muted loop playsinline preload="none" disablepictureinpicture aria-hidden="true"></video>`
        : `<img class="mh-tailclip__media" src="${A}/${item.clip.img || item.clip.poster}" alt="" decoding="async">`}</span>`;
    // wide – стикер-надпись: широкая и низкая, за угол плитки её не уводим
    if (bareMode() && item.bare)
      return `<img class="mh-art mh-art--bare${item.wide ? " mh-art--wide" : ""}" src="${A}/${item.bare}" alt="" decoding="async">`;
    if (item.video && live)
      return `<video class="mw-video mh-video" data-src="${A}/${item.video}" poster="${A}/${item.pack}"
                muted loop playsinline preload="none" disablepictureinpicture aria-hidden="true"></video>`;
    const file = item.art ? `${H}/${item.art}.webp` : `${A}/${item.pack}`;
    return `<img class="mh-art${item.video ? " mh-art--black" : ""}" src="${file}" alt="" decoding="async">`;
  }

  // Ячейка – одна на все категории, без подложки: окно с предметом и чипом, имя, цена. Вся ячейка – кнопка
  function card(item, i) {
    return `
      <button class="mh-card mh-card--${item.cat} pressable" type="button" data-item="${item.id}" style="--i:${i}"
              aria-label="${esc(label(item))}">
        <span class="mh-card__art"><span class="mh-card__item">${artMarkup(item)}${badge(item)}</span></span>
        <span class="mh-card__name ellipsis" aria-hidden="true">${esc(item.name)}</span>
        ${priceMarkup(item)}
      </button>`;
  }

  // ── Блок категорий: два ряда, все разделы без прокрутки ────────────────
  // Швы плиток не совпадают ни между рядами, ни со швом двух колонок ленты (191–199 pt на 390):
  // ряд 1 – три равные (швы 130–138, 252–260), ряд 2 – «стили карты» шире (шов ~220–228; с vip – ~157–165
  // и ~272–280). Картинка стоит в правом нижнем углу плитки
  const SELF = { ...ME_HD, online: false };   // твой пин без зелёного свечения – смотрят на хвост и рамку
  function catArt(id) {
    switch (id) {
      case "stickers":
        return bareMode() ? `<img class="mh-cat__img mh-cat__img--bare" src="${A}/${ITEMS.chihuahua.bare}" alt="">`
          : `<img class="mh-cat__img" src="${H}/stickers/chihuahua.webp" alt="">`;
      case "tails":
        // пин с огнём наклонён – летит вверх-вправо, пламя тянется из-за левого края плитки
        // без скорости: стикер «км/ч» справа внизу срезался бы краем, стрелки пути остаются
        return `<span class="mh-cat__rider">${rider(ITEMS.fire, { ...SELF, speed: undefined })}</span>`;
      case "gifts":
        return bareMode() ? `<img class="mh-cat__img mh-cat__img--gift mh-cat__img--bare" src="${A}/${ITEMS.crown.bare}" alt="">`
          : `<img class="mh-cat__img mh-cat__img--gift" src="${H}/gifts/crown.webp" alt="">`;
      case "styles":
        // один снимок карты крупно, с наклоном – стиль видно
        return `<span class="mh-cat__map"><img src="${styleThumb(ITEMS.minecraft)}" alt="" style="object-position:${ITEMS.minecraft.focus}"></span>`;
      case "frames":
        // коллекция рамок веером: мех впереди, алмаз и жемчуг на друзьях позади, у каждого свой наклон
        return `<span class="mh-cat__pin mh-cat__pin--left">${framedPin("crystal", { ...SELF, live: `${A}/people/live-hd-4.webp`, name: "соня" }, { size: 36 })}</span>
                <span class="mh-cat__pin mh-cat__pin--right">${framedPin("pearl", { ...SELF, live: `${A}/people/live-hd-2.webp`, name: "тимур" }, { size: 36 })}</span>
                <span class="mh-cat__pin mh-cat__pin--front">${framedPin("fur", SELF)}</span>`;
      case "vip":
        return `<img class="mh-cat__star" src="${A}/market/vip-star.png" alt="">`;
      default:
        return "";
    }
  }

  function renderCats() {
    $("#vip").innerHTML = S.top === "banner"
      ? `<button class="mh-vip pressable" type="button" aria-label="blink vip – тебя будет видно везде">
           <img class="mh-vip__img" src="${H}/vip-banner.webp" alt="">
         </button>`
      : "";
    $("#cats").className = `mh-cats mh-cats--${S.top}`;
    $("#cats").innerHTML = [0, 1].map((row) => `
      <div class="mh-cats__row mh-cats__row--${row}">
        ${shownCats().filter((c) => c.row === row).map((c) => `
          <button class="mh-cat mh-cat--${c.id} pressable" type="button" data-cat="${c.id}" aria-pressed="false">
            <span class="mh-cat__title">${esc(c.title)}</span>
            <span class="mh-cat__art" aria-hidden="true">${catArt(c.id)}</span>
          </button>`).join("")}
      </div>`).join("");
  }

  // ── Лента ─────────────────────────────────────────────────────────────
  const ranked = (cat = S.cat) =>
    Object.values(ITEMS).filter((item) => inFeed(item) && inCat(item, cat) && !dealFor(item)).sort((a, b) => b.rank - a.rank);

  // «покупки друзей» – акцент на покупке: мини-карточка товара 104 × 112, под ней по центру аватарка
  // покупателя 36 (наполовину на нижнем крае карточки) и имя. Предмет – без цены и чипа; карточка темнее
  // и меньше товаров ленты – читается как вставка другой формы
  function friendCard({ who, item: id, when }) {
    const f = FRIENDS[who];
    const item = ITEMS[id];
    return `
      <button class="mh-bought mh-bought--${item.cat} pressable" type="button" data-item="${id}"
              aria-label="${esc(`${f.name}, ${when}: ${item.name}, ${catOf(item.cat).kind}`)}">
        <span class="mh-bought__card"><span class="mh-bought__item">${artMarkup(item, { live: false, mini: true })}</span></span>
        <img class="mh-bought__face" src="${f.photo}" alt="" decoding="async">
        <span class="mh-bought__name ellipsis">${esc(f.name)}</span>
      </button>`;
  }

  // key – свой id заголовка: лента и экран раздела могут быть в DOM одновременно
  function friendsMarkup(cat = S.cat, key = "list") {
    const list = BOUGHT.filter((b) => inFeed(ITEMS[b.item]) && inCat(ITEMS[b.item], cat));
    if (!list.length) return "";
    return `
      <section class="mh-friends" aria-labelledby="friends-title-${key}">
        <h2 class="section-title mh-friends__title" id="friends-title-${key}">покупки друзей</h2>
        <div class="mh-friends__rail">${list.map(friendCard).join("")}</div>
      </section>`;
  }

  // Скидка только для тебя – карточка маркета недели (.mw-deal): сетка точек, предмет, имя, розовым
  // «осталось 09:42:07» (секунды идут), ценник со старой ценой, «−40%» стикер-числом на углу.
  // Видна во всей ленте и в разделе своего товара
  function dealTimer() {
    const left = Math.max(0, S.dealEnds - Date.now());
    const sec = Math.ceil(left / 1000);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return { left, text: `${pad(h)}:${pad(m)}:${pad(sec % 60)}`,
      aria: `скидка пропадёт через ${h} ${plural(h, "час", "часа", "часов")} ${m} ${plural(m, "минуту", "минуты", "минут")}` };
  }

  function dealMarkup(cat = S.cat) {
    const item = ITEMS[DEAL.item];
    if (!dealFor(item) || !inFeed(item) || !inCat(item, cat)) return "";
    const t = dealTimer();
    return `
      <section class="mh-deal-block" aria-label="скидка только для тебя">
        <button class="mw-deal mh-deal pressable" type="button" data-item="${item.id}" aria-label="${esc(label(item))}">
          <span class="mw-deal__art mh-deal__art"><span class="mh-card__item">${artMarkup(item, { deal: true })}</span></span>
          <span class="mw-deal__info">
            <span class="mw-deal__name">${esc(item.name)}</span>
            <span class="mw-deal__note${t.left < 60000 ? " is-urgent" : ""}" role="timer" data-deal-timer aria-label="${t.aria}">
              <span aria-hidden="true">осталось <span data-deal-left>${t.text}</span></span>
            </span>
            <span class="mw-deal__price">${priceMarkup(item)}</span>
          </span>
          <span class="sticker-number mw-deal__off" aria-hidden="true">−${DEAL.off}%</span>
        </button>
      </section>`;
  }

  const grid = (items, from, animate) =>
    items.length ? `<div class="mh-grid ${gridClass()}${animate ? " is-fresh" : ""}">${items.map((item, i) => card(item, from + i)).join("")}</div>` : "";

  // товары идут подряд, без заголовка: шесть → покупки друзей → ещё шесть → личная скидка → остальные.
  // Друзей и скидку разделяют товары – две вставки подряд не стоят
  const SPLIT = 6;
  function feedMarkup(cat, { animate = false, key = "list" } = {}) {
    const items = ranked(cat);
    const c = cat && catOf(cat);
    return `
      <section class="mh-list" aria-labelledby="list-title-${key}">
        <h2 class="visually-hidden" id="list-title-${key}">${c ? esc(c.title) : "все товары"}</h2>
        ${grid(items.slice(0, SPLIT), 0, animate)}
      </section>
      ${friendsMarkup(cat, key)}
      ${items.length > SPLIT ? `<section class="mh-list" aria-label="ещё товары">${grid(items.slice(SPLIT, SPLIT * 2), SPLIT, animate)}</section>` : ""}
      ${dealMarkup(cat)}
      ${items.length > SPLIT * 2 ? `<section class="mh-list" aria-label="остальные товары">${grid(items.slice(SPLIT * 2), SPLIT * 2, animate)}</section>` : ""}`;
  }

  // ── Лента по разделам (вариант на пульте «лента: по разделам») ─────────
  // Блоки в порядке плиток: стикеры → хвосты → покупки друзей → наклейки → стили карты → скидка → рамки.
  // В блоке четыре лучших товара сеткой 2 × 2; слева заголовок, справа серое «ещё» текстом – экран раздела.
  // Если показаны все товары раздела, «ещё» нет. Друзей и скидку разделяют два блока товаров
  const BLOCK = 4;
  const sectioned = () => S.feed === "sections";
  function blockMarkup(id) {
    const items = ranked(id);
    if (!items.length) return "";
    const c = catOf(id);
    return `
      <section class="mh-block" aria-labelledby="block-${id}">
        <div class="mh-head">
          <h2 class="section-title" id="block-${id}">${esc(c.title)}</h2>
          ${items.length > BLOCK ? `<button class="mh-head__more pressable" type="button" data-open="${id}" aria-label="ещё ${esc(c.title)}">ещё</button>` : ""}
        </div>
        ${grid(items.slice(0, BLOCK), 0, false)}
      </section>`;
  }
  const sectionsMarkup = () =>
    ["stickers", "tails", "friends", "gifts", "styles", "deal", "frames"]
      .map((id) => (id === "friends" ? friendsMarkup(null) : id === "deal" ? dealMarkup(null) : blockMarkup(id)))
      .join("");

  function renderList({ animate = false } = {}) {
    $("#list").innerHTML = sectioned() ? sectionsMarkup() : feedMarkup(S.cat, { animate });
    if (S.screen) $("#cat-list").innerHTML = feedMarkup(S.screen, { key: "cat" });
    // в ленте по разделам плитки – навигация: активной плитки нет
    $$("#cats .mh-cat").forEach((b) => b.setAttribute("aria-pressed", String(!sectioned() && b.dataset.cat === S.cat)));
    $$("#panel-cats [data-panel-cat]").forEach((b) => b.setAttribute("aria-checked",
      String(b.dataset.panelCat === ((sectioned() ? S.screen : S.cat) || ""))));
    $$("#panel-feed [data-feed]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.feed === S.feed)));
    $$("#panel-top [data-top]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.top === S.top)));
    $$("#panel-deal [data-deal]").forEach((b) => b.setAttribute("aria-checked", String((b.dataset.deal === "on") === S.deal)));
    $$("#panel-layout [data-layout]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.layout === S.layout)));
    const value = $("#feed [data-coins]");
    value.textContent = formatCoins(S.coins);
    value.closest(".coin-balance").setAttribute("aria-label", `баланс: ${formatCoins(S.coins)} монет`);
  }

  // ── Экран раздела: все товары раздела, въезжает справа (как «все» в маркете недели) ─
  const catScreen = $("#screen-cat");
  let catOpener = null;
  function openCat(id, opener = null) {
    catOpener = opener;
    S.screen = id;
    $("#cat-title").textContent = catOf(id).title;
    $("#cat-scroll").scrollTop = 0;
    renderList();
    catScreen.hidden = false;
    requestAnimationFrame(() => {
      catScreen.classList.add("is-open");
      app.classList.add("has-push");
    });
    $("#screen-market").inert = true;
  }

  function closeCat() {
    if (!S.screen) return;
    S.screen = null;
    catScreen.classList.remove("is-open");
    app.classList.remove("has-push");
    $("#screen-market").inert = false;
    setTimeout(() => {
      if (!S.screen) {
        catScreen.hidden = true;
        $("#cat-list").innerHTML = "";
      }
    }, 300);
    renderList();
    if (catOpener && catOpener.isConnected) catOpener.focus({ preventScroll: true });
  }

  // категория: та же – снимаем фильтр. Если блок категорий уехал из виду, возвращаем ленту к нему
  function selectCat(id, opener = null) {
    if (sectioned()) return openCat(id, opener);
    S.cat = S.cat === id ? null : id;
    renderList({ animate: true });
    const scroller = $("#market-scroll");
    const top = $("#cats").getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    if (top < 0) scroller.scrollTo({ top: scroller.scrollTop + top - 60, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  // ── Шторка предмета (маркет недели) ───────────────────────────────────
  const app = $("#app-market");
  app.insertAdjacentHTML("beforeend", `
    <div class="mw-backdrop" data-close></div>
    <div class="sheet mw-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">
      <div class="sheet__handle" data-drag>
        <div class="sheet__grabber" aria-hidden="true"></div>
        <h2 class="mw-sheet__title" id="sheet-title"></h2>
      </div>
      <div class="mw-sheet__body" data-body></div>
    </div>`);
  const sheet = $(".mw-sheet", app);
  const backdrop = $(".mw-backdrop", app);
  const ctx = { item: null, opener: null };

  // превью – как товар выглядит в приложении: хвост и рамка – на твоём пине на карте, стиль – твоя карта,
  // стикерпак и подарок – упаковка на точках
  function previewMarkup(item) {
    if (item.cat === "tails" && (item.tail || item.follower))
      return `
        <div class="mw-preview mw-preview--map" aria-hidden="true">
          <div class="mw-preview__camera">
            <img class="mw-preview__tiles" src="${A}/market/map-tail.webp" alt="">
            ${rider(item, ME_HD, "mw-rider--zoom mw-preview__me")}
          </div>
        </div>`;
    if (item.cat === "styles")
      return `
        <div class="mw-preview mh-preview--style" aria-hidden="true">
          <img class="mh-preview__map" src="${A}/map-styles/${item.style}.webp" alt="" style="object-position:${item.focus}">
          <span class="mh-preview__pin">${window.BlinkPin.markup({ name: ME.name, photo: ME_HD.live, size: 52, state: "staying", minutes: 12, tag: "span", assets: A })}</span>
        </div>`;
    if (item.cat === "frames")
      return `
        <div class="mw-preview mw-preview--map mh-preview--frame" aria-hidden="true">
          <img class="mw-preview__tiles" src="${A}/market/map-tail.webp" alt="">
          <span class="mh-preview__pin mh-preview__pin--big">${framedPin(item.frame)}</span>
        </div>`;
    const file = bareMode() && item.bare ? `${A}/${item.bare}` : item.art ? `${H}/${item.art}.webp` : `${A}/${item.pack}`;
    return `<div class="mw-preview mw-preview--dots"><img class="mw-preview__pack${bareMode() && item.bare ? " mh-preview__bare" : ""}" src="${file}" alt=""></div>`;
  }

  function friendsLine(item) {
    if (!item.friends) return `<p class="mw-sheet__friends mw-sheet__friends--none">такого нет у&nbsp;друзей</p>`;
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

  // VIP-товар не продаётся за монеты: кнопка ведёт в подписку – её экрана в задаче нет,
  // кнопка только отвечает на нажатие
  function buyMarkup(item) {
    if (S.owned.has(item.id))
      return `<button class="button button--secondary mw-buy mw-buy--owned" type="button" disabled>
        <i class="icon icon--check" aria-hidden="true"></i>у тебя</button>`;
    if (item.vip) return `<button class="button button--primary mw-buy mw-buy--free pressable" type="button">в blink vip</button>`;
    if (!priceOf(item))
      return `<button class="button button--primary mw-buy mw-buy--free pressable" type="button" data-buy>забрать</button>`;
    return `<button class="button button--primary mw-buy pressable" type="button" data-buy>
      <span>купить</span>
      <span class="mw-buy__price"><img class="mw-buy__coin" src="${A}/market/coin.png" alt="">${formatCoins(priceOf(item))}${
        offOf(item) ? `<s class="mw-buy__old">${formatCoins(item.price)}</s>` : ""}</span>
    </button>`;
  }

  // срок словами: скидка, когда уходит, тираж – полосой ниже, VIP – только в подписке
  function leaveText(item) {
    if (item.vip) return "только в подписке blink vip";
    if (dealFor(item)) return `скидка −${DEAL.off}% только для тебя – до конца дня`;
    if (item.off) return `скидка −${item.off}%`;
    if (item.ends) {
      const days = Math.floor((item.ends - Date.now()) / D_);
      return days < 1 ? "уходит сегодня" : days === 1 ? "уходит завтра" : `уходит через ${days} ${plural(days, "день", "дня", "дней")}`;
    }
    return item.stock ? "" : "всегда в маркете";
  }

  function fillSheet() {
    const item = ctx.item;
    const leave = leaveText(item);
    $("#sheet-title").textContent = item.cat === "stickers" ? `«${item.name}»` : item.name;
    $("[data-body]", sheet).innerHTML = `
      ${leave ? `<p class="mw-sheet__leave${leave === "всегда в маркете" ? " mw-sheet__leave--always" : ""}">${leave}</p>` : ""}
      <p class="mw-sheet__text">${esc(item.text)}</p>
      ${item.stock && !S.owned.has(item.id) ? `
        <div class="mw-sheet__stock" role="img" aria-label="осталось ${item.stock.left} из ${item.stock.total}">
          <div class="mw-sheet__stock-bar"><div class="mw-sheet__stock-fill" style="--share:${item.stock.left / item.stock.total}"></div></div>
          <p class="mw-sheet__stock-meta"><span>осталось на&nbsp;складе</span><span><span class="mw-sheet__stock-count">${item.stock.left}</span><span class="mw-sheet__stock-total">/${item.stock.total}</span></span></p>
        </div>` : ""}
      ${previewMarkup(item)}
      ${friendsLine(item)}
      ${buyMarkup(item)}`;
  }

  function openSheet(id, opener) {
    ctx.item = ITEMS[id];
    ctx.opener = opener;
    fillSheet();
    backdrop.classList.add("is-open");
    sheet.classList.add("is-open");
    $$(".screen, .tabbar", app).forEach((el) => (el.inert = true));
    requestAnimationFrame(() => sheet.focus({ preventScroll: true }));
  }

  function closeSheet() {
    if (!sheet.classList.contains("is-open")) return;
    sheet.classList.remove("is-open", "is-dragging");
    sheet.style.removeProperty("transform");
    backdrop.classList.remove("is-open");
    $$(".screen, .tabbar", app).forEach((el) => (el.inert = false));
    const back = ctx.opener && ctx.opener.isConnected ? ctx.opener : $(`#feed [data-item="${ctx.item.id}"]`);
    if (back) back.focus({ preventScroll: true });
  }

  // жест вниз за грэббер или заголовок: шторка идёт за пальцем, закрытие – по проекции броска
  (function dragToClose() {
    const handle = $("[data-drag]", sheet);
    let drag = null;
    handle.addEventListener("pointerdown", (e) => {
      drag = { y: e.clientY, t: performance.now(), dy: 0, v: 0 };
      handle.setPointerCapture(e.pointerId);
      sheet.classList.add("is-dragging");
    });
    handle.addEventListener("pointermove", (e) => {
      if (!drag) return;
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
  })();

  // покупка – одно нажатие «КУПИТЬ»: монеты списываются, кнопка на месте – «у тебя», ценник в ленте тоже
  function buy() {
    const item = ctx.item;
    const price = item.vip ? 0 : priceOf(item);
    if (S.owned.has(item.id) || S.coins < price) return;
    S.coins -= price;
    S.owned.add(item.id);
    fillSheet();
    sheet.focus({ preventScroll: true });
    renderList();
  }

  backdrop.addEventListener("click", closeSheet);
  sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-buy]")) buy();
  });

  // ── События ───────────────────────────────────────────────────────────
  document.addEventListener("click", (e) => {
    const item = e.target.closest("[data-item]");
    if (item && !e.target.closest(".mw-sheet")) return openSheet(item.dataset.item, item);
    const cat = e.target.closest("[data-cat]");
    if (cat) return selectCat(cat.dataset.cat, cat);
    const more = e.target.closest("[data-open]");
    if (more) return openCat(more.dataset.open, more);
    if (e.target.closest("[data-act='back']")) return closeCat();
    const panelCat = e.target.closest("[data-panel-cat]");
    if (panelCat && sectioned()) {
      closeSheet();
      if (panelCat.dataset.panelCat) openCat(panelCat.dataset.panelCat);
      else closeCat();
      return;
    }
    const feed = e.target.closest("[data-feed]");
    if (feed) {
      closeSheet();
      closeCat();
      S.feed = feed.dataset.feed;
      S.cat = null;
      renderList();
      $("#market-scroll").scrollTop = 0;
      return;
    }
    if (panelCat) {
      closeSheet();
      S.cat = null;
      if (panelCat.dataset.panelCat) selectCat(panelCat.dataset.panelCat);
      else renderList({ animate: true });
      return;
    }
    const top = e.target.closest("[data-top]");
    if (top) {
      S.top = top.dataset.top;
      if (S.cat === "vip" && S.top === "banner") S.cat = null;
      renderCats();
      renderList();
      return;
    }
    const deal = e.target.closest("[data-deal]");
    if (deal) {
      S.deal = deal.dataset.deal !== "off";
      S.dealEnds = deal.dataset.deal === "soon" ? Date.now() + 10000 : midnight();
      renderList();
      return;
    }
    const layout = e.target.closest("[data-layout]");
    if (layout) {
      S.layout = layout.dataset.layout;
      // в ленте карточками – предметы без упаковок, набор товаров свой: плитки категорий тоже перерисовываем
      renderCats();
      renderList();
      return;
    }
    if (e.target.closest("[data-act='reset']")) {
      closeSheet();
      closeCat();
      setState();
      renderList();
      $("#market-scroll").scrollTop = 0;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    // сначала шторка, потом экран раздела
    if (sheet.classList.contains("is-open")) closeSheet();
    else closeCat();
  });

  // ── Пульт ─────────────────────────────────────────────────────────────
  $("#panel-cats").innerHTML = [{ id: "", title: "все товары" }, ...CATS]
    .map((c) => `<button class="panel__button pressable" type="button" role="radio" data-panel-cat="${c.id}">${esc(c.title)}</button>`)
    .join("");
  $("#panel-feed").innerHTML = Object.entries(FEEDS)
    .map(([id, title]) => `<button class="panel__button pressable" type="button" role="radio" data-feed="${id}">${esc(title)}</button>`)
    .join("");
  $("#panel-top").innerHTML = Object.entries(TOPS)
    .map(([id, title]) => `<button class="panel__button pressable" type="button" role="radio" data-top="${id}">${esc(title)}</button>`)
    .join("");
  $("#panel-layout").innerHTML = Object.entries(LAYOUTS)
    .map(([id, title]) => `<button class="panel__button pressable" type="button" role="radio" data-layout="${id}">${esc(title)}</button>`)
    .join("");

  // ── Сроки по секундам ─────────────────────────────────────────────────
  setInterval(() => {
    $$("#list [data-ends], #cat-list [data-ends]").forEach((el) => {
      const t = leftText(Number(el.dataset.ends));
      const b = el.querySelector("[data-left]");
      if (b.textContent !== t.text) b.textContent = t.text;
    });
    // личная скидка: секунды идут, в последнюю минуту строка стучит, на нуле карточка уходит – товар
    // возвращается в сетку по обычной цене
    const timers = $$("[data-deal-timer]");
    const timer = timers[0];
    timers.forEach((el) => {
      const t = dealTimer();
      el.querySelector("[data-deal-left]").textContent = t.text;
      el.setAttribute("aria-label", t.aria);
      el.classList.toggle("is-urgent", t.left > 0 && t.left < 60000);
    });
    if (timer && !dealOn()) {
      renderList();
      if (sheet.classList.contains("is-open")) fillSheet();
    }
  }, 1000);

  // ── Живые упаковки – видео играют, пока видны (как в маркете недели) ───
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const io = new IntersectionObserver((entries) => entries.forEach(({ target, isIntersecting }) => {
    if (!isIntersecting || reducedMotion.matches) return target.pause();
    if (!target.getAttribute("src")) target.src = target.dataset.src;
    target.play().catch(() => {});
  }), { rootMargin: "120px 0px" });
  new MutationObserver(() => $$(".mh-video:not([data-watched])").forEach((v) => {
    v.dataset.watched = "";
    io.observe(v);
  })).observe(document.body, { childList: true, subtree: true });

  // ── Стенд в окне ──────────────────────────────────────────────────────
  function fit() {
    const phones = $("#stage-phones");
    if (innerWidth <= 480) return phones.style.removeProperty("--stage-zoom");
    const room = innerHeight - $(".stage__head").offsetHeight - 80;
    const wide = (innerWidth - 48) / 654;
    phones.style.setProperty("--stage-zoom", Math.min(1, room / 874, wide).toFixed(3));
  }
  fit();
  addEventListener("resize", fit);
  if (window.BlinkSky) window.BlinkSky.start($(".market__sky"), { mode: "stars" });

  // ?cat=<id> – сразу с выбранной категорией, ?item=<id> – сразу шторка
  const q = new URLSearchParams(location.search);
  setState();
  // ?feed=sections – лента по разделам; вместе с ?cat=<id> – сразу открыт экран раздела
  if (FEEDS[q.get("feed")]) S.feed = q.get("feed");
  if (catOf(q.get("cat"))) S.cat = q.get("cat");
  if (S.cat === "vip") S.top = "tile";
  const startScreen = sectioned() && S.cat;
  if (startScreen) S.cat = null;
  // ?top=tile – vip одним из разделов; ?deal=off – скидки нет, ?deal=soon – кончится через 10 секунд
  if (TOPS[q.get("top")]) S.top = q.get("top");
  if (q.get("deal") === "off") S.deal = false;
  if (q.get("deal") === "soon") S.dealEnds = Date.now() + 10000;
  // ?layout=cards – лента карточками с подложкой
  if (LAYOUTS[q.get("layout")]) S.layout = q.get("layout");
  renderCats();
  renderList();
  // кольца рамок собираются из текстур после загрузки – тогда перерисовываем пины в рамках
  const redraw = () => {
    renderCats();
    renderList();
    if (sheet.classList.contains("is-open")) fillSheet();
  };
  if (!(window.BlinkFrames && window.BlinkFrames.ready)) addEventListener("ps-frames-ready", redraw, { once: true });
  if (startScreen) openCat(startScreen);
  if (ITEMS[q.get("item")]) openSheet(q.get("item"), null);

  window.MarketHub = { S, ITEMS, selectCat, openSheet, openCat, closeCat };
})();
