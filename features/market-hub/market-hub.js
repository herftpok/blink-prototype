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
  const ME = { name: "ты", live: `${A}/people/live-1.webp`, online: true, speed: 25 };
  const ME_HD = { ...ME, live: `${A}/people/live-hd-1.webp` };

  const START = { cat: null, coins: 55000, owned: [] };
  // вёрстка ленты товаров: air – на чёрном, без подложек; cards – классическая: у каждого товара
  // своя карточка-подложка, имя и ценник слева
  // tiles – на подложке только предмет и чип, имя и цена под ней на чёрном (как в доставках продуктов)
  const LAYOUTS = { air: "без подложек", cards: "карточки с подложкой", tiles: "подложка под товаром",
    // themed – те же плитки, но подложка у каждого типа своя: подчёркивает, где товар живёт
    themed: "подложка по типу товара",
    // shelf – витрина: блоки по разделам, стикеры и наклейки по три в ряд без имени, хвосты по два –
    // рамки по два – без упаковок и без подложек; стили карты по два на подложке («подложка под товаром»).
    // Чипы – прежние. Только с лентой по разделам
    shelf: "витрина: 3 в ряд" };
  const SHELF3 = ["stickers", "gifts"];
  const SHELF_BARE = ["stickers", "gifts", "tails", "frames"];
  const gridClass = (cat) => S.layout === "themed" ? "mh-grid--tiles mh-grid--themed"
    : S.layout === "shelf" ? (SHELF_BARE.includes(cat) ? `mh-grid--shelf${SHELF3.includes(cat) ? " mh-grid--3" : ""}` : "mh-grid--tiles")
    : `mh-grid--${S.layout}`;
  // лента: flat – все товары подряд; sections – блоки по разделам с «ещё», плитки и «ещё» открывают экран раздела
  const FEEDS = { flat: "подряд", sections: "по разделам" };
  // цена: coins – только монеты; rub – монеты и рубли.
  // курс от продукта: 1 монета = 10 ₽
  const PRICES = { coins: "монеты", rub: "монеты и рубли" };
  const RUB_PER_COIN = 10;
  const formatRub = (coins) => {
    const n = Math.round(coins * RUB_PER_COIN);
    return `${n >= 10000 ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : n} ₽`;
  };
  const S = { cat: null, coins: 0, owned: new Set(), layout: "air", top: "banner", deal: true, dealEnds: 0, feed: "flat", screen: null, price: "coins" };
  // личная скидка – до конца суток: выдана в полночь, пропадает в следующую
  const midnight = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); };
  // dealMode – что выбрано на пульте для скидки: on / off / soon (кончится через 10 секунд); идёт в адрес
  const setState = () => Object.assign(S, START, { owned: new Set(START.owned), deal: true, dealEnds: midnight(), dealMode: "on" });

  // ── Всё выбранное – в адресе ──────────────────────────────────────────
  // layout, feed, top, deal, cat (фильтр, а в ленте по разделам – открытый экран раздела) и item (открытая
  // шторка). Значения по умолчанию в адрес не пишем; адрес заменяется, а не копится в истории
  function syncUrl() {
    const q = new URLSearchParams();
    if (S.layout !== "air") q.set("layout", S.layout);
    if (S.feed !== "flat") q.set("feed", S.feed);
    if (S.top !== "banner") q.set("top", S.top);
    if (S.dealMode !== "on") q.set("deal", S.dealMode);
    if (S.price !== "coins") q.set("price", S.price);
    const cat = S.feed === "sections" ? S.screen : S.cat;
    if (cat) q.set("cat", cat);
    // шторка объявлена ниже, но syncUrl зовётся только после загрузки скрипта
    if (ctx.open && ctx.item) q.set("item", ctx.item.id);
    const next = `${location.pathname}${q.toString() ? `?${q}` : ""}`;
    if (next !== `${location.pathname}${location.search}`) history.replaceState(null, "", next);
  }

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
    if (offOf(item)) return `<span class="mh-badge mh-badge--off mh-off" aria-hidden="true">−${offOf(item)}%</span>`;
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
  // Цена – строка: ценник-пилюля и при скидке старая цена справа зачёркнутой; со скидкой пилюля белая –
  // единственная белая в ленте. В режиме «монеты и рубли» под ней серым цена в рублях; у бесплатного,
  // VIP и купленного строка пустая, но место держит – ряды не прыгают
  function priceMarkup(item) {
    return `<span class="mh-pricebox"><span class="mh-pricerow">${chipMarkup(item)}${rubMarkup(item)}</span></span>`;
  }

  function chipMarkup(item) {
    if (S.owned.has(item.id))
      return `<span class="price-chip mw-chip mw-chip--owned mh-price mh-price--owned"><span class="mw-chip__check"><i class="icon icon--check" aria-hidden="true"></i></span>у тебя</span>`;
    if (item.vip) return `<span class="mh-price mh-price--note">${S.layout === "shelf" ? "в подписке" : "только в подписке"}</span>`;
    if (!priceOf(item)) return '<span class="price-chip mw-chip mh-price">бесплатно</span>';
    const old = offOf(item) ? `<s class="mw-chip__old mh-price__old">${formatCoins(item.price)}</s>` : "";
    return `<span class="price-chip price-chip--coins mw-chip mh-price"><img class="price-chip__coin" src="${A}/market/coin.png" alt="">${formatCoins(priceOf(item))}${old}</span>`;
  }

  function rubMarkup(item) {
    if (S.price !== "rub") return "";
    const paid = !S.owned.has(item.id) && !item.vip && priceOf(item);
    return paid ? `<span class="mh-rub">${formatRub(priceOf(item))}</span>` : "";
  }

  function label(item) {
    const kind = catOf(item.cat).kind;
    const rub = S.price === "rub" && !S.owned.has(item.id) && !item.vip && priceOf(item) ? `, ${formatRub(priceOf(item)).replace("₽", "рублей")}` : "";
    const price = S.owned.has(item.id) ? "уже у тебя"
      : item.vip ? "только в подписке blink vip"
      : !priceOf(item) ? "бесплатно"
      : `${formatCoins(priceOf(item))} ${plural(priceOf(item), "монета", "монеты", "монет")}${offOf(item) ? `, было ${formatCoins(item.price)}, скидка ${offOf(item)} %` : ""}`;
    const extra = S.owned.has(item.id) ? ""
      : item.ends ? `, ${leftText(item.ends).aria}`
      : item.stock ? `, осталось ${item.stock.left} штук` : "";
    return `${item.name}, ${kind}, ${price}${rub}${extra}`;
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
  // deal – карточка личной скидки. Огонь в скидке – сам хвост без упаковки (tails/rocket):
  // его ролик – упаковка целиком, окно хвоста из неё в маленьком размере не читается
  function artMarkup(item, { live = true, deal = false } = {}) {
    if (item.cat === "styles")
      return `
        <span class="mh-map" aria-hidden="true">
          <img class="mh-map__img" src="${styleThumb(item)}" alt="" style="object-position:${item.focus}">
          <span class="mh-map__pin">${window.BlinkPin.markup({ name: ME.name, photo: ME.live, size: 36, tag: "span", assets: A })}</span>
        </span>`;
    if (item.cat === "frames") return `<span class="mh-framepin" aria-hidden="true">${framedPin(item.frame)}</span>`;
    // хвост в карточке – живой: тот же ролик, что в упаковке, но в рамке только окно с хвостом
    if (item.tail && deal && bareMode())
      return `<img class="mh-art mh-art--bare mh-art--flame" src="${A}/${item.tail}" alt="" decoding="async">`;
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
          <span class="mh-off mw-deal__off mh-deal__off" aria-hidden="true">−${DEAL.off}%</span>
        </button>
      </section>`;
  }

  const grid = (items, from, animate, cat = null) =>
    items.length ? `<div class="mh-grid ${gridClass(cat)}${animate ? " is-fresh" : ""}">${items.map((item, i) => card(item, from + i)).join("")}</div>` : "";

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
      ${items.length > SPLIT ? `<section class="mh-list" aria-label="ещё товары">${grid(items.slice(SPLIT, SPLIT * 2), SPLIT, animate)}</section>` : ""}
      ${dealMarkup(cat)}
      ${items.length > SPLIT * 2 ? `<section class="mh-list" aria-label="остальные товары">${grid(items.slice(SPLIT * 2), SPLIT * 2, animate)}</section>` : ""}`;
  }

  // ── Лента по разделам (вариант на пульте «лента: по разделам») ─────────
  // Блоки в порядке плиток: стикеры → хвосты → покупки друзей → наклейки → стили карты → скидка → рамки.
  // В блоке четыре лучших товара сеткой 2 × 2; слева заголовок, справа серое «ещё» текстом – экран раздела.
  // Если показаны все товары раздела, «ещё» нет. Друзей и скидку разделяют два блока товаров
  // в витрине у стикеров и наклеек – шесть (два ряда по три)
  const blockSize = (id) => (S.layout === "shelf" && SHELF3.includes(id) ? 6 : 4);
  const sectioned = () => S.feed === "sections";
  function blockMarkup(id) {
    const items = ranked(id);
    if (!items.length) return "";
    const c = catOf(id);
    return `
      <section class="mh-block" aria-labelledby="block-${id}">
        <div class="mh-head">
          <h2 class="section-title" id="block-${id}">${esc(c.title)}</h2>
          ${items.length > blockSize(id) ? `<button class="mh-head__more pressable" type="button" data-open="${id}" aria-label="ещё ${esc(c.title)}">ещё<i class="icon icon--chevron" aria-hidden="true"></i></button>` : ""}
        </div>
        ${grid(items.slice(0, blockSize(id)), 0, false, id)}
      </section>`;
  }
  const sectionsMarkup = () =>
    ["stickers", "tails", "gifts", "styles", "deal", "frames"]
      .map((id) => (id === "deal" ? dealMarkup(null) : blockMarkup(id)))
      .join("");

  // Экран раздела – только товары раздела одной сеткой, без покупок друзей и карточки скидки.
  // Товар со скидкой здесь – обычной ячейкой, с ценой и меткой «−40%»
  function screenMarkup(cat) {
    const items = Object.values(ITEMS).filter((item) => inFeed(item) && inCat(item, cat)).sort((a, b) => b.rank - a.rank);
    const c = catOf(cat);
    return `
      <section class="mh-list" aria-labelledby="list-title-cat">
        <h2 class="visually-hidden" id="list-title-cat">${esc(c.title)}</h2>
        ${grid(items, 0, false, cat)}
      </section>`;
  }

  function renderList({ animate = false } = {}) {
    $("#list").innerHTML = sectioned() ? sectionsMarkup() : feedMarkup(S.cat, { animate });
    if (S.screen) $("#cat-list").innerHTML = screenMarkup(S.screen);
    // в ленте по разделам плитки – навигация: активной плитки нет
    $$("#cats .mh-cat").forEach((b) => b.setAttribute("aria-pressed", String(!sectioned() && b.dataset.cat === S.cat)));
    $$("#panel-cats [data-panel-cat]").forEach((b) => b.setAttribute("aria-checked",
      String(b.dataset.panelCat === ((sectioned() ? S.screen : S.cat) || ""))));
    $$("#panel-feed [data-feed]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.feed === S.feed)));
    $$("#panel-price [data-price]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.price === S.price)));
    // строка рублей под ценником – в карточках с подложкой полосе карты стиля нужно меньше высоты
    app.classList.toggle("mh-rub-on", S.price === "rub");
    $$("#panel-top [data-top]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.top === S.top)));
    $$("#panel-deal [data-deal]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.deal === S.dealMode)));
    $$("#panel-layout [data-layout]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.layout === S.layout)));
    const value = $("#feed [data-coins]");
    value.textContent = formatCoins(S.coins);
    value.closest(".coin-balance").setAttribute("aria-label", `баланс: ${formatCoins(S.coins)} монет`);
    syncUrl();
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

  // ── Экран товара на весь рост: сцена «где вещь живёт», цена, «подарить» и «купить» ─
  // Въезжает справа, как экран раздела. Сверху сцена во весь край: хвост – твой пин на карте с этим
  // хвостом, стикер – переписка, наклейка – твой профиль, стиль карты – карта в стиле с пином,
  // рамка – твой пин в рамке на карте. Внизу – цена (скидка, рубли) и две кнопки
  const app = $("#app-market");
  app.insertAdjacentHTML("beforeend", `
    <section class="screen screen--push mh-item" id="screen-item" aria-labelledby="item-title" hidden tabindex="-1">
      <div class="screen__scroll mh-item__scroll">
        <div class="market__glow" aria-hidden="true"><img class="market__ring" src="../../assets/market/ring.webp" alt=""></div>
        <header class="mh-item__top">
          <button class="icon-button icon-button--header pressable" type="button" data-item-back aria-label="назад">
            <i class="icon icon--back" aria-hidden="true"></i>
          </button>
          <div class="coin-balance mh-item__coins">
            <img class="coin-balance__coin" src="${A}/market/coin.png" alt="">
            <span class="coin-balance__value" data-item-coins></span>
            <button class="coin-balance__add pressable" type="button" aria-label="пополнить монеты">
              <i class="icon icon--plus" aria-hidden="true"></i>
            </button>
          </div>
        </header>
        <div class="mh-item__scene" data-scene aria-hidden="true"></div>
        <div class="mh-item__info" data-info></div>
      </div>
      <footer class="mh-item__bottom" data-bottom></footer>
    </section>
    <div class="mh-gift-backdrop" data-gift-backdrop></div>
    <div class="sheet mh-gift-sheet" data-recipients role="dialog" aria-modal="true" aria-labelledby="gift-to-title" tabindex="-1"></div>
    <section class="mh-gift-confirm" data-confirm role="dialog" aria-modal="true" aria-labelledby="gift-title" tabindex="-1"></section>
    <div class="sheet mh-gift-sent" data-sent role="dialog" aria-modal="true" aria-labelledby="gift-sent-title" tabindex="-1"></div>`);
  const sheet = $("#screen-item");
  // open – экран товара открыт (класс is-open ставится кадром позже, ради анимации въезда)
  const ctx = { item: null, opener: null, open: false };
  const gift = { to: null, anonymous: false, comment: "" };

  // переписка для стикеров: что пишет лёва до стикера и что отвечает после
  const STICKER_CHAT = {
    chihuahua: ["ну пожалуйста", "ладно, уговорила"],
    cat: ["ты опять не спишь?", "кто бы говорил"],
    penguin: ["завтра контрольная", "всё понятно"],
    heart: ["он опять не ответил", "держись"],
    anime: ["смотри, что он мне подарил", "я плачу"],
    emo: ["пойдём на концерт?", "только в чёрном"],
    bee: ["ты где?", "лечу"],
    slipper: ["я съел твою шоколадку", "беги"],
    skullSilver: ["у меня экзамен в восемь", "соболезную"],
    brick: ["почему не ответил?", "аргумент принят"],
    coffin: ["он написал первым", "всё, меня нет"],
    scoop: ["что на ужин?", "подано"],
    toothpaste: ["ты встал?", "почти"],
    grasshopper: ["пойдём гулять", "мне лень"],
  };
  // картинка товара без упаковки, если она есть; иначе упаковка
  const bareArt = (item) => item.bare ? `${A}/${item.bare}` : item.art ? `${H}/${item.art}.webp` : item.pack ? `${A}/${item.pack}` : "";

  function sceneMarkup(item) {
    const pin = (extra = {}) => window.BlinkPin.markup({ name: ME.name, photo: ME_HD.live, size: 52, state: "staying", minutes: 12, tag: "span", assets: A, ...extra });
    if (item.cat === "tails") {
      // фигурка – очищенная вырезка (без рваного края), огонь – хвост из пина
      const worn = item.follower ? { ...item, follower: item.bare } : item;
      return `
        <div class="mh-scene mh-scene--map">
          <img class="mh-scene__tiles" src="${A}/market/map-tail.webp" alt="">
          <span class="mh-scene__rider">${rider(worn, { ...ME_HD, online: false })}</span>
        </div>`;
    }
    if (item.cat === "styles")
      return `
        <div class="mh-scene mh-scene--map">
          <img class="mh-scene__tiles" src="${A}/map-styles/${item.style}.webp" alt="" style="object-position:${item.focus}">
          <span class="mh-scene__pin">${pin()}</span>
        </div>`;
    if (item.cat === "frames")
      return `
        <div class="mh-scene mh-scene--map">
          <img class="mh-scene__tiles" src="${A}/market/map-tail.webp" alt="">
          <span class="mh-scene__pin mh-scene__pin--big">${framedPin(item.frame, { ...ME_HD, online: false })}</span>
        </div>`;
    if (item.cat === "gifts") {
      // наклейка – верх твоего профиля как в прототипе: свечение, вырезка, ник, подарки вокруг
      // приглушены, новая наклейка – на месте розы (или на своём, если уже есть в профиле)
      const me = window.BLINK_DATA.me;
      const gifts = me.gifts.filter((g) => g.dx !== 68).map((g) =>
        `<img class="mh-pf__gift" src="../../${g.src}" alt="" style="--dx:${g.dx};--dy:${g.dy};--w:${g.w}">`).join("");
      return `
        <div class="mh-scene mh-scene--profile">
          <div class="mh-pf">
            ${gifts}
            <img class="mh-pf__avatar" src="../../${me.cutout}" alt="">
            <span class="mh-pf__pill"><span class="mh-pf__share"><i class="icon icon--share"></i></span>${esc(me.username)}</span>
            <img class="mh-pf__new" src="${bareArt(item)}" alt="">
          </div>
          <p class="mh-pf__name">${esc(me.name)}</p>
        </div>`;
    }
    // стикер – в переписке с лёвой: он пишет, ты отвечаешь стикером, он отвечает
    const chat = STICKER_CHAT[item.id];
    if (chat && item.bare) {
      return `
        <div class="mh-scene mh-scene--chat">
          <div class="mw-chat-feed mh-scene__feed">
            <div class="message-row message-row--in"><div class="bubble bubble--in">${esc(chat[0])}</div></div>
            <div class="message-row message-row--out"><div class="bubble bubble--sticker"><img class="mh-scene__sticker" src="${A}/${item.bare}" alt=""></div></div>
            <div class="message-row message-row--in"><div class="bubble bubble--in">${esc(chat[1])}</div></div>
          </div>
        </div>`;
    }
    // у стикеров только в упаковке вырезки нет – упаковка на точках
    return `<div class="mh-scene mh-scene--dots"><img class="mh-scene__pack" src="${bareArt(item)}" alt=""></div>`;
  }

  // срок словами: скидка, когда уходит; тираж – полосой; VIP – только в подписке
  function leaveText(item) {
    if (item.vip) return "только в подписке blink vip";
    if (dealFor(item)) return `скидка −${DEAL.off}% только для тебя – до конца дня`;
    if (item.ends) {
      const days = Math.floor((item.ends - Date.now()) / D_);
      return days < 1 ? "уходит сегодня" : days === 1 ? "уходит завтра" : `уходит через ${days} ${plural(days, "день", "дня", "дней")}`;
    }
    return "";
  }

  // чип над названием – срок, тираж или VIP; скидка видна в цене. Не на сцене: в переписке
  // и на карте он ложился бы на сообщения и пин
  function sceneChip(item) {
    if (S.owned.has(item.id) || offOf(item)) return "";
    const b = badge(item);
    return b ? `<span class="mh-item__chip">${b}</span>` : "";
  }

  function bottomMarkup(item) {
    const owned = S.owned.has(item.id);
    const soldOut = item.stock && item.stock.left <= 0;
    if (item.vip)
      return `<button class="button button--primary mh-item__wide pressable" type="button">в blink vip</button>`;
    const off = offOf(item);
    const price = priceOf(item);
    const priceRow = `
      <div class="mh-item__price">
        <span class="mh-item__pill">${price ? `<img class="mh-item__coin" src="${A}/market/coin.png" alt="">
          <span class="mh-item__sum">${formatCoins(price)}</span>${off ? `<s class="mh-item__old">${formatCoins(item.price)}</s>` : ""}`
          : `<span class="mh-item__sum">бесплатно</span>`}</span>
        ${S.price === "rub" && price ? `<span class="mh-item__rub">${formatRub(price)}</span>` : ""}
        ${off ? `<span class="mh-off mh-item__off" aria-hidden="true">−${off}%</span>` : ""}
      </div>`;
    // наклейку чаще дарят – у неё «подарить» главная кнопка
    const giftFirst = item.cat === "gifts";
    const giftBtn = `<button class="button ${giftFirst ? "button--primary" : "button--secondary"} pressable" type="button" data-gift${soldOut ? " disabled" : ""}>подарить</button>`;
    const buyBtn = owned
      ? `<button class="button button--secondary mh-item__owned" type="button" disabled><i class="icon icon--check" aria-hidden="true"></i>у тебя</button>`
      : `<button class="button ${giftFirst ? "button--secondary" : "button--primary"} pressable" type="button" data-buy${soldOut ? " disabled" : ""}>${price ? "купить" : "забрать"}</button>`;
    return `${priceRow}<div class="mh-item__buttons">${giftBtn}${buyBtn}</div>`;
  }

  function fillSheet() {
    const item = ctx.item;
    const leave = leaveText(item);
    $("[data-scene]", sheet).innerHTML = sceneMarkup(item);
    $("[data-info]", sheet).innerHTML = `
      ${sceneChip(item)}
      <h1 class="mh-item__title ellipsis" id="item-title">${item.cat === "stickers" ? `«${esc(item.name)}»` : esc(item.name)}</h1>
      <p class="mh-item__text">${esc(item.text)}</p>
      ${leave ? `<p class="mh-item__leave">${leave}</p>` : ""}
      ${item.stock && !S.owned.has(item.id) ? `
        <div class="mw-sheet__stock mh-item__stock" role="img" aria-label="осталось ${item.stock.left} из ${item.stock.total}">
          <div class="mw-sheet__stock-bar"><div class="mw-sheet__stock-fill" style="--share:${item.stock.left / item.stock.total}"></div></div>
          <p class="mw-sheet__stock-meta"><span>осталось на&nbsp;складе</span><span><span class="mw-sheet__stock-count">${item.stock.left}</span><span class="mw-sheet__stock-total">/${item.stock.total}</span></span></p>
        </div>` : ""}`;
    $("[data-bottom]", sheet).innerHTML = bottomMarkup(item);
    $("[data-item-coins]", sheet).textContent = formatCoins(S.coins);
    // переписка – на чёрном, без окна; остальные сцены – в окне-рамке
    $("[data-scene]", sheet).classList.toggle("mh-item__scene--bare", !!$(".mh-scene--chat", sheet));
    delete app.dataset.status;
  }

  function openSheet(id, opener) {
    ctx.item = ITEMS[id];
    ctx.opener = opener;
    ctx.open = true;
    fillSheet();
    $(".mh-item__scroll", sheet).scrollTop = 0;
    sheet.hidden = false;
    requestAnimationFrame(() => {
      sheet.classList.add("is-open");
      app.classList.add("has-push");
    });
    $("#screen-market").inert = true;
    $("#screen-cat").inert = true;
    requestAnimationFrame(() => sheet.focus({ preventScroll: true }));
    syncUrl();
  }

  function closeSheet() {
    if (!ctx.open) return;
    ctx.open = false;
    closeGift();
    sheet.classList.remove("is-open");
    delete app.dataset.status;
    if (!S.screen) {
      app.classList.remove("has-push");
      $("#screen-market").inert = false;
    }
    $("#screen-cat").inert = false;
    setTimeout(() => { if (!sheet.classList.contains("is-open")) sheet.hidden = true; }, 300);
    const back = ctx.opener && ctx.opener.isConnected ? ctx.opener : $(`#feed [data-item="${ctx.item.id}"]`);
    if (back) back.focus({ preventScroll: true });
    syncUrl();
  }

  // покупка – одно нажатие: монеты списываются, кнопка на месте – «у тебя», ценник в ленте тоже
  function buy() {
    const item = ctx.item;
    const price = item.vip ? 0 : priceOf(item);
    if (S.owned.has(item.id) || S.coins < price) return;
    S.coins -= price;
    S.owned.add(item.id);
    fillSheet();
    renderList();
  }

  // ── Подарок: «кому подаришь?» → «подарить» → «подарок отправлен!» (эталоны market/*) ─
  const giftEl = { backdrop: $("[data-gift-backdrop]", app), recipients: $("[data-recipients]", app), confirm: $("[data-confirm]", app), sent: $("[data-sent]", app) };
  const STATUS = { lyova: "в сети", sonya: "36 мин назад", timur: "в сети", vasya: "2 ч назад", natashka: "в сети" };
  const giftOpen = () => Object.values(giftEl).some((el) => el.classList.contains("is-open"));

  function openRecipients() {
    gift.to = null;
    gift.anonymous = false;
    gift.comment = "";
    const ids = Object.keys(FRIENDS);
    const row = (id) => `
      <li><button class="recipient pressable" type="button" data-to="${id}">
        <img class="recipient__photo" src="${FRIENDS[id].photo}" alt="">
        <span class="recipient__body">
          <span class="recipient__name">${esc(FRIENDS[id].name)}</span>
          <span class="recipient__status${STATUS[id] === "в сети" ? " recipient__status--online" : ""}">${STATUS[id]}</span>
        </span>
      </button></li>`;
    giftEl.recipients.innerHTML = `
      <div class="sheet__handle">
        <div class="sheet__grabber" aria-hidden="true"></div>
        <h2 class="recipients__title" id="gift-to-title">кому подаришь?</h2>
      </div>
      <div class="recipients__scroll">
        <p class="recipients__label recipients__label--best caps-label"><span class="recipients__label-text">лучшие друзья</span><span class="recipients__label-count">3</span></p>
        <ul class="recipients__list" role="list">${ids.slice(0, 3).map(row).join("")}</ul>
        <p class="recipients__label caps-label"><span class="recipients__label-text">все друзья</span><span class="recipients__label-count">${ids.length}</span></p>
        <ul class="recipients__list" role="list">${ids.map(row).join("")}</ul>
      </div>`;
    giftEl.backdrop.classList.add("is-open");
    giftEl.recipients.classList.add("is-open");
    giftEl.recipients.focus({ preventScroll: true });
    sheet.inert = true;
  }

  function giftArt(item) {
    if (item.cat === "frames") return `<span class="gift-card__art mh-gift-pin">${framedPin(item.frame, { ...ME_HD, online: false })}</span>`;
    if (item.cat === "styles") return `<img class="gift-card__art mh-gift-map" src="${A}/map-styles/${item.style}-thumb.webp" alt="" style="object-position:${item.focus}">`;
    if (item.cat === "tails" && item.tail) return `<img class="gift-card__art mh-gift-flame" src="${A}/${item.tail}" alt="">`;
    return `<img class="gift-card__art" src="${bareArt(item)}" alt="">`;
  }

  function openConfirm() {
    const item = ctx.item;
    const p = FRIENDS[gift.to];
    const price = priceOf(item);
    giftEl.confirm.innerHTML = `
      <img class="mh-gift-confirm__glow" src="${A}/market/glow-top.webp" alt="">
      <div class="mh-gift-confirm__scroll">
        <header class="mh-gift-confirm__head">
          <img class="mh-gift-confirm__photo" src="${p.photo}" alt="">
          <span class="mh-gift-confirm__who">
            <span class="mh-gift-confirm__name ellipsis">${esc(p.name)}</span>
            <span class="mh-gift-confirm__role">получатель</span>
          </span>
          <button class="icon-button icon-button--header pressable" type="button" data-gift-close aria-label="закрыть">
            <i class="icon icon--close" aria-hidden="true"></i>
          </button>
        </header>
        <div class="gift-card">
          ${giftArt(item)}
          <h2 class="gift-card__title" id="gift-title">${esc(item.name)}</h2>
          <p class="gift-card__kind">${esc(catOf(item.cat).kind)}</p>
        </div>
        ${item.stock ? `
          <div class="stock">
            <div class="stock__bar"><div class="stock__fill" style="--share:${item.stock.left / item.stock.total}"></div></div>
            <p class="stock__meta"><span>осталось на&nbsp;складе</span>
              <span class="stock__count">${item.stock.left}<span class="stock__total">/${item.stock.total}</span></span></p>
          </div>` : ""}
        <label class="gift-comment">
          <span class="gift-comment__label">коммент к&nbsp;подарку</span>
          <textarea class="gift-comment__input" rows="2" maxlength="120" placeholder="это тебе" data-comment></textarea>
        </label>
        <div class="gift-option">
          <span id="gift-anon">отправить анонимно</span>
          <button class="switch pressable" type="button" role="switch" aria-checked="false" aria-labelledby="gift-anon" data-anon></button>
        </div>
      </div>
      <div class="mh-gift-confirm__footer">
        <button class="button button--primary gift-cta pressable" type="button" data-send>
          подарить
          <span class="gift-cta__sum">${price ? `<img class="gift-cta__coin" src="${A}/market/coin.png" alt="">${formatCoins(price)}${
            S.price === "rub" ? ` · ${formatRub(price)}` : ""}` : "бесплатно"}</span>
        </button>
      </div>`;
    giftEl.recipients.classList.remove("is-open");
    giftEl.confirm.classList.add("is-open");
    giftEl.confirm.focus({ preventScroll: true });
  }

  function sendGift() {
    const item = ctx.item;
    const price = priceOf(item);
    if (S.coins < price) return;
    S.coins -= price;
    if (item.stock && item.stock.left > 0) item.stock.left -= 1;
    const p = FRIENDS[gift.to];
    giftEl.sent.innerHTML = `
      <div class="mh-gift-sent__handle">
        <h2 class="mh-gift-sent__title" id="gift-sent-title">${gift.anonymous ? "подарок отправлен анонимно!" : "подарок отправлен!"}</h2>
      </div>
      <span class="mh-gift-sent__art">${giftArt(item)}</span>
      <p class="mh-gift-sent__to"><img class="mh-gift-sent__photo" src="${p.photo}" alt="">${esc(p.name)}</p>
      <button class="button button--primary mh-gift-sent__cta pressable" type="button" data-gift-close>круто!</button>`;
    giftEl.confirm.classList.remove("is-open");
    giftEl.sent.classList.add("is-open");
    giftEl.sent.focus({ preventScroll: true });
    fillSheet();
    renderList();
  }

  function closeGift() {
    if (!giftOpen()) return;
    Object.values(giftEl).forEach((el) => el.classList.remove("is-open"));
    sheet.inert = false;
    if (sheet.classList.contains("is-open")) sheet.focus({ preventScroll: true });
  }

  sheet.addEventListener("click", (e) => {
    if (e.target.closest("[data-item-back]")) return closeSheet();
    if (e.target.closest("[data-buy]")) return buy();
    if (e.target.closest("[data-gift]")) return openRecipients();
  });
  giftEl.backdrop.addEventListener("click", closeGift);
  giftEl.recipients.addEventListener("click", (e) => {
    const to = e.target.closest("[data-to]");
    if (!to) return;
    gift.to = to.dataset.to;
    openConfirm();
  });
  giftEl.confirm.addEventListener("click", (e) => {
    if (e.target.closest("[data-gift-close]")) return closeGift();
    const anon = e.target.closest("[data-anon]");
    if (anon) {
      gift.anonymous = !gift.anonymous;
      anon.setAttribute("aria-checked", String(gift.anonymous));
    }
    if (e.target.closest("[data-send]")) sendGift();
  });
  giftEl.confirm.addEventListener("input", (e) => {
    if (e.target.matches("[data-comment]")) gift.comment = e.target.value;
  });
  giftEl.sent.addEventListener("click", (e) => {
    if (e.target.closest("[data-gift-close]")) closeGift();
  });

  // ── События ───────────────────────────────────────────────────────────
  document.addEventListener("click", (e) => {
    const item = e.target.closest("[data-item]");
    if (item && !e.target.closest("#screen-item, .mh-gift-sheet, .mh-gift-confirm, .mh-gift-sent")) return openSheet(item.dataset.item, item);
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
      // витрина бывает только по разделам: лента подряд возвращает ячейки без подложек
      if (S.feed === "flat" && S.layout === "shelf") {
        S.layout = "air";
        renderCats();
      }
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
      S.dealMode = deal.dataset.deal;
      renderList();
      return;
    }
    const priceBtn = e.target.closest("[data-price]");
    if (priceBtn) {
      S.price = priceBtn.dataset.price;
      renderList();
      if (sheet.classList.contains("is-open")) fillSheet();
      return;
    }
    const layout = e.target.closest("[data-layout]");
    if (layout) {
      S.layout = layout.dataset.layout;
      if (S.layout === "shelf" && S.feed !== "sections") {
        closeSheet();
        S.feed = "sections";
        S.cat = null;
      }
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
    // сначала подарок, потом экран товара, потом экран раздела
    if (giftOpen()) closeGift();
    else if (sheet.classList.contains("is-open")) closeSheet();
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
  $("#panel-price").innerHTML = Object.entries(PRICES)
    .map(([id, title]) => `<button class="panel__button pressable" type="button" role="radio" data-price="${id}">${esc(title)}</button>`)
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
      // скидка кончилась на глазах – в адресе её больше нет
      if (S.dealMode === "soon") S.dealMode = "off";
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
  if (q.get("deal") === "off") Object.assign(S, { deal: false, dealMode: "off" });
  if (q.get("deal") === "soon") Object.assign(S, { dealEnds: Date.now() + 10000, dealMode: "soon" });
  // ?layout=cards – лента карточками с подложкой
  if (LAYOUTS[q.get("layout")]) S.layout = q.get("layout");
  if (S.layout === "shelf") S.feed = "sections";
  // ?price=rub – цена в монетах и рублях
  if (PRICES[q.get("price")]) S.price = q.get("price");
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
