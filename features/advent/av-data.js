/*
 * Адвент – моковые данные: 29 дней (14.12–11.01), статистика пользователя за 2026 год,
 * предсказания на 2027, задания дня, снежки с друзьями, подарки на ёлке и призы большого розыгрыша.
 * Все числа и призы – мок для прототипа. Интерфейсные строки экранов – в advent.js.
 *
 * Картинки: obj – предмет дня. "r:<имя>" – рендер three.js (renders/<имя>.webp, av-models.js),
 * "s:<имя>" – 3D-стикер из assets/stickers, "a:<путь>" – любой ассет из assets/.
 */
window.AV_DATA = (() => {
  "use strict";

  // Люди – пак avatars/ (как в новогодних подарках): live – пин, photo – сквиркл, cutout – вырезка
  const PEOPLE = {
    natashka: { name: "наташка", n: 1, with: "наташкой", gen: "наташки" },
    vasya: { name: "вася", n: 2, with: "васей", gen: "васи" },
    leva: { name: "лёва", n: 3, with: "лёвой", gen: "лёвы" },
    sonya: { name: "соня", n: 4, with: "соней", gen: "сони" },
    masha: { name: "маша", n: 5, with: "машей", gen: "маши" },
  };

  // Блоки адвента – подписи разделов календаря
  const BLOCKS = {
    move: { label: "твой год в движении", range: "14–18 декабря" },
    talk: { label: "твой год в общении", range: "19–25 декабря" },
    friends: { label: "твой год с друзьями", range: "26–31 декабря" },
    future: { label: "предсказания на 2027", range: "1–11 января" },
  };

  /*
   * Дни. stat – карточка статистики: number (стикер-число), unit (строка под ним),
   * note (одна строка-сравнение), graphic – что нарисовать и с какими данными.
   * empty – запасная карточка, если данных нет или мало: она тоже шуточная, ей можно поделиться.
   * task – задание дня по теме (второе задание у всех – «поделись карточкой дня»).
   */
  const DAYS = [
    {
      date: "14.12", block: "move", title: "заходы в blink", obj: "s:blink",
      lead: "все твои заходы за год",
      stat: { number: 2846, unit: "заходов в blink", note: "почти 8 раз в день", graphic: { kind: "app-icon" } },
      empty: { number: 41, unit: "заход в blink", note: "ты с нами с 1 декабря – целый год посчитаем в следующий раз", sticker: "s:blink" },
      task: { text: "загляни на карту к друзьям", reward: 30 },
    },
    {
      date: "15.12", block: "move", title: "шаги", obj: "r:valenok",
      lead: "твои шаги за год и место среди друзей",
      stat: {
        number: 2450000, unit: "шагов за год", note: "3-е место среди друзей",
        graphic: { kind: "podium", unit: "шагов", rows: [
          { who: "vasya", value: "2.9 млн" }, { who: "natashka", value: "2.6 млн" }, { who: "me", value: "2.4 млн" },
        ] },
      },
      empty: { title: "шаги не считались", note: "без доступа к движению мы их не видим. зато никто не скажет, что ты мало ходишь", sticker: "r:valenok" },
      task: { text: "пройди сегодня 3 000 шагов", reward: 30 },
    },
    {
      date: "16.12", block: "move", title: "путь за год", obj: "r:sled",
      lead: "все километры года – пешком и на колёсах",
      stat: { number: 4820, unit: "км за год", note: "ещё 80 таких лет – и ты на луне", graphic: { kind: "moon", share: 0.0125 } },
      empty: { title: "твой путь – тайна", note: "геолокация в фоне была выключена. верим, что диван отдыхал без тебя", sticker: "r:sled" },
      task: { text: "включи геолокацию в фоне", reward: 30 },
    },
    {
      date: "17.12", block: "move", title: "города и страны", obj: "r:ornament-earth",
      lead: "города и страны 2026 года на твоей карте",
      stat: {
        number: 7, unit: "городов в 2 странах", note: "дальше всего – стамбул",
        graphic: { kind: "garland", cities: ["москва", "санкт-петербург", "казань", "сочи", "калининград", "стамбул", "анталья"] },
      },
      empty: { number: 1, unit: "город за весь год", note: "москва тебя не отпускает. может, в 2027 отпустит", sticker: "r:ornament-earth", graphic: { kind: "garland", cities: ["москва"] } },
      task: { text: "отметь город в профиле", reward: 30 },
    },
    {
      date: "18.12", block: "move", title: "ночлеги", obj: "a:overnights/nighthouse.webp",
      lead: "ночи не дома за весь год",
      stat: {
        number: 68, unit: "ночей не дома", note: "чаще всего – у наташки",
        graphic: { kind: "faces", rows: [{ who: "natashka", value: "25" }, { who: "leva", value: "9" }, { who: "sonya", value: "4" }] },
      },
      empty: { title: "все ночи дома", note: "домосед года – тоже титул", sticker: "a:overnights/nighthouse.webp" },
      task: { text: "загляни в свои ночлеги", reward: 30 },
    },
    {
      date: "19.12", block: "talk", title: "просмотры профиля", obj: "s:eyes",
      lead: "сколько раз заглядывали в твой профиль",
      stat: {
        number: 1204, unit: "просмотра профиля", note: "чаще всех заходили",
        graphic: { kind: "viewers", rows: [{ who: "leva", value: "86" }, { who: "sonya", value: "41" }, { who: "masha", value: "30" }] },
      },
      empty: { number: 6, unit: "просмотров профиля", note: "профиль пока – закрытый клуб. новое фото это исправит", sticker: "s:eyes" },
      task: { text: "обнови фото в профиле", reward: 30 },
    },
    {
      date: "20.12", block: "talk", title: "сообщения", obj: "r:letter",
      lead: "все твои сообщения за год",
      stat: { number: 18340, unit: "сообщений", note: "это 50 в день", graphic: { kind: "bubbles" } },
      empty: { number: 12, unit: "сообщений за год", note: "ты больше слушаешь. в 2027 напиши первым", sticker: "r:letter" },
      task: { text: "напиши тому, с кем давно не переписывались", reward: 30 },
    },
    {
      date: "21.12", block: "talk", title: "ночной чат", obj: "s:zzz",
      lead: "сообщения с полуночи до шести утра",
      stat: {
        number: 2140, unit: "сообщений ночью", note: "с полуночи до шести утра",
        graphic: { kind: "faces", rows: [{ who: "natashka", value: "640" }, { who: "leva", value: "410" }, { who: "vasya", value: "220" }] },
      },
      empty: { title: "ночью ты спишь", note: "редкий талант. береги его", sticker: "s:zzz" },
      task: { text: "пожелай другу спокойной ночи", reward: 30 },
    },
    {
      date: "22.12", block: "talk", title: "голосовые", obj: "r:microphone",
      lead: "твои голосовые за год",
      stat: { number: 640, unit: "голосовых", note: "почти 9 часов твоего голоса", graphic: { kind: "wave" } },
      empty: { title: "ни одного голосового", note: "друзья ещё не слышали тебя в blink. это можно исправить за 5 секунд", sticker: "r:microphone" },
      task: { text: "отправь голосовое", reward: 30 },
    },
    {
      date: "23.12", block: "talk", title: "шары", obj: "r:ornament-pink",
      lead: "твои шары в чатах за год",
      stat: { number: 312, unit: "шаров", note: "больше всего – лёве", graphic: { kind: "pile" } },
      empty: { title: "ни одного шара", note: "первый всегда самый запоминающийся", sticker: "r:ornament-pink" },
      task: { text: "отправь шар", reward: 30 },
    },
    {
      date: "24.12", block: "talk", title: "звонки", obj: "r:bell",
      lead: "минуты в звонках за год",
      stat: { number: 3260, unit: "минут в звонках", note: "это 54 часа на связи", graphic: { kind: "timer", text: "54:20:00" } },
      empty: { title: "звонков не было", note: "ты из тех, кто пишет. уважаем", sticker: "r:bell" },
      task: { text: "позвони другу", reward: 30 },
    },
    {
      date: "25.12", block: "talk", title: "стикеры года", obj: "fan",
      lead: "твои стикеры за год и самые любимые",
      stat: {
        number: 4210, unit: "стикеров", note: "любимый – огонь",
        graphic: { kind: "stickers", rows: [{ s: "fire", value: "820" }, { s: "heart", value: "610" }, { s: "kiss", value: "400" }] },
      },
      empty: { title: "стикеров не было", note: "словами тоже хорошо получается", sticker: "s:heart" },
      task: { text: "отправь стикер", reward: 30 },
    },
    {
      date: "26.12", block: "friends", title: "друг по переписке", obj: "s:kiss",
      lead: "с кем у тебя самая длинная переписка",
      stat: {
        name: "natashka", number: 8420, unit: "сообщений на двоих", note: "кружки и голосовые тоже считаются",
        graphic: { kind: "top3", rows: [{ who: "natashka", value: "8 420" }, { who: "leva", value: "5 100" }, { who: "sonya", value: "2 300" }] },
      },
      empty: { title: "переписка ещё впереди", note: "лучший друг по переписке найдётся в 2027", sticker: "s:kiss" },
      task: { text: "напиши лучшему другу", reward: 30 },
    },
    {
      date: "27.12", block: "friends", title: "новые друзья", obj: "s:clap",
      lead: "все новые друзья 2026 года",
      stat: { number: 23, unit: "новых друга", note: "последний – маша, 19 декабря", graphic: { kind: "crowd", count: 23 } },
      empty: { title: "новых друзей не было", note: "зато старые на месте", sticker: "s:clap" },
      task: { text: "добавь нового друга", reward: 30 },
    },
    {
      date: "28.12", block: "friends", title: "встречи года", obj: "s:go",
      lead: "все встречи с друзьями за год",
      stat: {
        number: 186, unit: "встреч с друзьями", note: "это раз в два дня",
        graphic: { kind: "map", pins: [
          { who: "natashka", value: "94", x: 46, y: 46, size: 52 }, { who: "leva", value: "41", x: 76, y: 30, size: 52 },
          { who: "sonya", value: "28", x: 22, y: 72, size: 36 }, { who: "vasya", value: "14", x: 20, y: 30, size: 36 },
          { who: "masha", value: "9", x: 72, y: 78, size: 36 },
        ] },
      },
      empty: { title: "встреч не было", note: "в 2027 – больше прогулок. друзья рядом, проверь карту", sticker: "s:go" },
      task: { text: "встреться с другом", reward: 30 },
    },
    {
      date: "29.12", block: "friends", title: "тусовка года", obj: "r:popper",
      lead: "когда вокруг тебя собралось больше всего друзей",
      stat: { number: 9, unit: "друзей в одном месте", note: "14 июля, парк горького", graphic: { kind: "party", count: 9 } },
      empty: { title: "больше трёх не собиралось", note: "главная тусовка ещё впереди", sticker: "r:popper" },
      task: { text: "собери троих друзей рядом", reward: 30 },
    },
    {
      date: "30.12", block: "friends", title: "друг года", obj: "s:heart",
      lead: "с кем у тебя больше всего встреч",
      stat: { name: "natashka", number: 94, unit: "встречи", note: "312 часов вместе", graphic: { kind: "friend", who: "natashka" } },
      empty: { title: "друг года ещё не определился", note: "у тебя есть целый 2027, чтобы выбрать", sticker: "s:heart" },
      task: { text: "подари другу подарок", reward: 30, boost: 2 },
    },
    {
      date: "31.12", block: "friends", title: "тряхи", obj: "r:globe",
      lead: "все тряхи с друзьями за год",
      stat: { number: 148, unit: "тряхов", note: "чаще всего – с лёвой", graphic: { kind: "shake" } },
      empty: { title: "ни одного тряха", note: "встряхни телефон рядом с другом – так добавлять быстрее всего", sticker: "r:globe" },
      task: { text: "тряхнись с другом", reward: 30, boost: 2 },
    },
  ];

  // Январь – предсказания: печенье с предсказанием трёх глазурей по кругу
  const PREDICTIONS = [
    "тот, кто чаще всех смотрит твой профиль, наконец напишет",
    "весной кто-то из друзей позовёт тебя в поездку, и ты согласишься не раздумывая",
    "летом ты окажешься в городе, которого ещё нет на твоей карте",
    "появится друг, с которым вы будете видеться каждую неделю",
    "твой самый длинный звонок года случится в три часа ночи",
    "кто-то пришлёт тебе голосовое на четыре минуты, и оно будет лучшим за год",
    "ты соберёшь самую большую тусовку среди своих друзей",
    "кто-то из друзей признается, что скучал",
    "будет ночёвка, которую вы вспомните на следующий новый год",
    "на карте появится место, куда вы будете возвращаться снова и снова",
    "ты встретишься с тем, с кем давно переписываешься",
  ];
  const COOKIES = ["cookie", "cookie-pink", "cookie-choco"];
  const PRED_TASKS = [
    "отправь предсказание другу", "поставь статус на пин", "загляни к друзьям на карту", "напиши другу",
  ];
  PREDICTIONS.forEach((text, i) => {
    DAYS.push({
      date: `${String(i + 1).padStart(2, "0")}.01`, block: "future", title: "предсказание", obj: `r:${COOKIES[i % 3]}`, cookie: COOKIES[i % 3],
      lead: "что ждёт тебя в 2027",
      prediction: text,
      task: { text: PRED_TASKS[i % PRED_TASKS.length], reward: 30, boost: i === 0 ? 2 : 1 },
    });
  });

  /* ── экономика (консультация iGaming CPO – README) ──
     вход – 30, задание дня – 30, «поделись карточкой» – 30: до 90 в день, 2 610 за адвент.
     Снежки на ставку: ставишь снежинки, друг ставит столько же. Победа – банк целиком (×2)
     и подарок с ёлки: чем больше ставка, тем чаще редкие и лучше. Проигрыш – ставка уходит другу,
     утешение – билеты в розыгрыш (чем больше ставка, тем больше). Ничья – ставки возвращаются.
     31.12 и 01.01 задания ×2 */
  const ECONOMY = {
    login: 30,
    share: 30,
    stakes: [30, 100, 300, 500],
    stake: 100,          // ставка по умолчанию
    // вес уровня подарка при этой ставке: обычный · редкий · эпический · легендарный
    odds: {
      30: [1, 0.4, 0.12, 0.04],
      100: [1, 0.6, 0.35, 0.2],
      300: [1, 1, 0.8, 0.5],
      500: [1, 1.5, 1.5, 1.2],
    },
    ticketsPer: 50,      // проигрыш: 1 билет за каждые 50 ставки, минимум 1
    ticketsDraw: 1,
    balls: 5,            // снежков на бой
    commonStreak: 3,     // не больше трёх обычных подарков подряд
    starFriends: 5,      // обыграй пятерых разных друзей – золотая звезда
    exchange: 50,        // ёлка пуста: 50 снежинок = 1 билет
  };

  /* ── подарки на ёлке: у каждого свой пул, 25 штук, без повторов ──
     tier: common 13 · rare 7 · epic 4 · legend 1. Вес выпадения – от ставки (ECONOMY.odds).
     Золотая звезда – тому, кто обыграл в снежки пятерых разных друзей: рамка пина, больше её не получить */
  const TIERS = {
    common: { label: "обычный", gift: "gift-pink", weight: 1 },
    rare: { label: "редкий", gift: "gift-cyan", weight: 0.6 },
    epic: { label: "эпический", gift: "gift-violet", weight: 0.35 },
    legend: { label: "легендарный", gift: "gift-gold", weight: 0.2 },
  };
  const POOL = [
    { id: "pack-fire", tier: "common", title: "стикерпак «огонь»", kind: "стикерпак", img: "a:market/always/pack-fire.webp" },
    { id: "pack-heart", tier: "common", title: "стикерпак «сердца»", kind: "стикерпак", img: "a:market/always/pack-heart.webp" },
    { id: "pack-kiss", tier: "common", title: "стикерпак «поцелуи»", kind: "стикерпак", img: "a:market/always/pack-kiss.webp" },
    { id: "pack-thumb", tier: "common", title: "стикерпак «класс»", kind: "стикерпак", img: "a:market/always/pack-thumbs-up.webp" },
    { id: "coins-100", tier: "common", title: "100 монет", kind: "в маркет", img: "a:market/coin.png" },
    { id: "coins-200", tier: "common", title: "200 монет", kind: "в маркет", img: "a:market/coin.png" },
    { id: "vip-3", tier: "common", title: "3 дня blink vip", kind: "подписка", img: "a:market/vip-star.png" },
    { id: "coffee", tier: "common", title: "кофе в подарок", kind: "от кофейни-партнёра", img: "r:coffee" },
    { id: "cinema", tier: "common", title: "кино за полцены", kind: "от кинотеатра-партнёра", img: "r:popcorn" },
    { id: "tail-paper", tier: "common", title: "хвост «бумага»", kind: "хвост", img: "a:market/tails/paper.webp" },
    { id: "tail-paws", tier: "common", title: "хвост «лапки»", kind: "хвост", img: "a:market/tails/paws.webp" },
    { id: "pack-ornament", tier: "common", title: "стикерпак «ёлочные шары»", kind: "стикерпак", img: "r:ornament-violet" },
    { id: "pack-snow", tier: "common", title: "стикерпак «снежинки»", kind: "стикерпак", img: "r:snowflake" },
    { id: "tail-jelly", tier: "rare", title: "хвост «желе»", kind: "хвост", img: "a:market/tails/jelly.webp" },
    { id: "tail-crystal", tier: "rare", title: "хвост «кристалл»", kind: "хвост", img: "a:market/tails/crystal.webp" },
    { id: "vip-30", tier: "rare", title: "месяц blink vip", kind: "подписка", img: "a:market/vip-star.png" },
    { id: "coins-500", tier: "rare", title: "500 монет", kind: "в маркет", img: "a:market/coin.png" },
    { id: "box-comet", tier: "rare", title: "стикерпак «комета»", kind: "лимитированный", img: "a:market/always/box-comet.webp" },
    { id: "coffee-month", tier: "rare", title: "кофе каждый день неделю", kind: "от кофейни-партнёра", img: "r:coffee" },
    { id: "beanie", tier: "rare", title: "шапка blink", kind: "привезём домой", img: "r:beanie" },
    { id: "tail-gold", tier: "epic", title: "хвост «золото»", kind: "хвост", img: "a:market/tails/gold.webp" },
    { id: "plush", tier: "epic", title: "плюшевая звезда blink", kind: "привезём домой", img: "s:blink" },
    { id: "vip-365", tier: "epic", title: "год blink vip", kind: "подписка", img: "a:market/vip-star.png" },
    { id: "cinema-year", tier: "epic", title: "два билета в кино каждый месяц", kind: "от кинотеатра-партнёра", img: "r:popcorn" },
    { id: "box", tier: "legend", title: "бокс blink: шапка, худи и звезда", kind: "привезём домой", img: "r:gift-gold" },
  ];
  const STAR = { id: "star", title: "золотая звезда", kind: "рамка пина – только за победы над пятью друзьями", img: "r:star-frame" };

  // Кого вызвать на снежки: друзья из пака, в сети – выше. Лёва уже вызвал тебя сам, ставка 300
  const RIVALS = [
    { who: "natashka", status: "в сети", online: true },
    { who: "leva", status: "в сети", online: true, challenge: 300 },
    { who: "sonya", status: "2 часа назад" },
    { who: "vasya", status: "вчера" },
    { who: "masha", status: "3 дня назад" },
  ];

  /* ── большой розыгрыш: шар на каждый приз. Билеты в шаре остаются до конца,
     приём закрывается 10.01 в 23:59, розыгрыш – 11.01 в 20:00 вживую. В каждом шаре
     один главный приз и 30 поменьше, а утешительный – всем, кто положил билеты */
  const DRAW = {
    closes: "10 января в 23:59",
    when: "11 января в 20:00",
    prizes: [
      { id: "headphones", title: "беспроводные наушники", img: "r:headphones", total: 4380, mine: 0, small: 30, trend: +6 },
      { id: "console", title: "игровая приставка", img: "r:gamepad", total: 9120, mine: 2, small: 30, trend: +11 },
      { id: "trip", title: "выходные в горах на двоих", img: "r:sled", total: 2710, mine: 0, small: 30, trend: +4 },
      { id: "vip", title: "blink vip навсегда", img: "a:market/vip-star.png", total: 1960, mine: 0, small: 30, trend: +3 },
    ],
  };

  // Лента друзей: кто что получил с ёлки (социальное доказательство)
  const FEED = [
    { who: "leva", prize: "хвост «золото»", tier: "epic", ago: "5 мин" },
    { who: "sonya", prize: "месяц blink vip", tier: "rare", ago: "12 мин" },
    { who: "natashka", prize: "звезду с макушки", tier: "star", ago: "1 ч" },
    { who: "vasya", prize: "кофе в подарок", tier: "common", ago: "2 ч" },
  ];

  return { PEOPLE, BLOCKS, DAYS, ECONOMY, TIERS, POOL, STAR, RIVALS, DRAW, FEED, starCollectors: 214 };
})();
