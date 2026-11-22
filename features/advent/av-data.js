/*
 * Адвент – данные: 18 дней (14–31 декабря), статистика пользователя за 2026 год, два задания дня,
 * экономика монеток, розыгрыш за билетики. Задания и правила – new year event/контент, задания, призы и правила.md.
 * Пул хватайки и её алгоритм – av-claw-engine.js. Числа статистики – мок для прототипа.
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
  /*
   * Задание дня – дословно из документа «контент, задания, призы и правила», раздел 2 (З01–З18), строчными, как в интерфейсе blink.
   * text – текст карточки, trigger – триггер срабатывания из документа, tbd – действие ещё не утверждено.
   * Засчитывается в день задания и позже, до 31.12 включительно.
   */
  const TASKS = [
    { id: "З01", text: "открой карту и посмотри, где твои друзья", trigger: "открытие экрана карты после выхода из вебвью ивента" },
    { id: "З02", tbd: true },
    { id: "З03", text: "пройди один шаг", trigger: "прохождение хотя бы одного шага в любой из дней ≥ дню задания" },
    { id: "З04", text: "найди объект на карте и нажми на него", trigger: "получение ивента по клику на 3D refID", partner: "Самокат" },
    { id: "З05", text: "поставь реакцию на сообщение друга", trigger: "получение ивента об оставлении реакции на любое сообщение в любом чате" },
    { id: "З06", text: "попробуй vip бесплатно", trigger: "появление VIP-статуса у аккаунта" },
    { id: "З07", text: "отправь одно сообщение", trigger: "получение ивента об отправлении сообщения в любом чате" },
    { id: "З08", tbd: true },
    { id: "З09", text: "отправь одно голосовое", trigger: "получение ивента (в документе без уточнения)" },
    { id: "З10", text: "отправь один шар", trigger: "получение ивента (в документе без уточнения)" },
    { id: "З11", text: "позвони другу", trigger: "получение ивента о звонке" },
    { id: "З12", text: "отправь 100 стикеров", trigger: "получение ивента об отправке стикеров" },
    { id: "З13", tbd: true },
    { id: "З14", text: "добавь одного друга", trigger: "получение ивента о добавлении друга (не старс)" },
    { id: "З15", tbd: true },
    { id: "З16", text: "создай групповой чат и предложи потусить", trigger: "получение ивента о создании чата минимум из 3 человек" },
    { id: "З17", text: "отправь другу подарок", trigger: "получение ивента об отправлении подарка" },
    { id: "З18", text: "сделай один трях", trigger: "получение ивента о тряхе" },
  ];
  DAYS.forEach((day, i) => {
    day.task = TASKS[i];
    day.hero = i === 0 ? "a:system/app-icon.png" : day.obj;
  });

  /* Два задания в день по 50 монеток = одна попытка в хваталке за 100. 18 дней – 18 попыток */
  const ECONOMY = { memory: 50, task: 50, attempt: 100 };

  /*
   * Розыгрыш: 1 билетик = 1 шанс, у всех призов одинаково. Билетики можно разложить по любым призам.
   * total – сколько билетиков уже положили другие (мок для шанса).
   */
  const DRAW = {
    closes: "31 декабря в 23:59",
    prizes: [
      { id: "iphone", title: "iPhone", img: "r:smartphone", total: 9120 },
      { id: "macbook", title: "MacBook", img: "r:laptop", total: 6480 },
      { id: "airpods", title: "AirPods", img: "r:headphones", total: 4380 },
    ],
  };

  return { PEOPLE, BLOCKS, DAYS, TASKS, ECONOMY, DRAW };
})();
