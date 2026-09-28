/*
 * Все экраны и состояния новогодней фичи – один список на двоих: раскладка states.html рисует
 * по нему карточки, стенд index.html открывается в любом из них по ссылке ?state=<id>.
 * Как дойти до состояния – в new-year.js (STATE_SETUPS), снимки – tools/shoot_states.py.
 *
 * phone – чей телефон на снимке: left – наташка (дарит), right – лёва (получает) или соня (подруга).
 */

export const GROUPS = [
  { id: "market", title: "маркет: вкладка „новый год“", text: "наташка выбирает подарок" },
  { id: "flow", title: "подарок другу", text: "кому → подарить → отправлен" },
  { id: "sender", title: "карта у дарителя", text: "эльф идёт от пункта отправки к дому друга" },
  { id: "recipient", title: "карта у получателя", text: "к лёве идёт эльф с подарком" },
  { id: "friend", title: "карта у друзей получателя", text: "соня видит эльфа, который идёт к лёве" },
];

export const STATES = [
  { id: "market-ny", group: "market", phone: "left", title: "новый год", text: "живой 3D-эльф с мешком, снег, упаковки с „+“" },
  { id: "market-sack", group: "market", phone: "left", title: "мешок подарков", text: "плашка над таб-баром: сколько подарков и сумма" },

  { id: "recipients", group: "flow", phone: "left", title: "кому подаришь?", text: "лучшие друзья и все друзья, поиск" },
  { id: "confirm", group: "flow", phone: "left", title: "подарить", text: "коммент, анонимно, за сколько дойдёт эльф" },
  { id: "confirm-limited", group: "flow", phone: "left", title: "подарить лимитированный", text: "остаток на складе" },
  { id: "confirm-sack", group: "flow", phone: "left", title: "подарить мешок", text: "веер упаковок, сумма за все" },
  { id: "sent", group: "flow", phone: "left", title: "подарок отправлен!", text: "карточка снизу, конфетти, „где эльф?“" },
  { id: "sent-anon", group: "flow", phone: "left", title: "отправлен анонимно", text: "заголовок про анонимность" },

  { id: "elf-sender", group: "sender", phone: "left", title: "эльф в пути", text: "камера за эльфом, пунктир маршрута, что внутри" },
  { id: "elf-sender-sack", group: "sender", phone: "left", title: "эльф несёт мешок", text: "каждый подарок своей плашкой" },
  { id: "dispatch-empty", group: "sender", phone: "left", title: "пункт отправки: пусто", text: "подарков ещё нет – „подарить“" },
  { id: "dispatch-list", group: "sender", phone: "left", title: "пункт отправки: подарки", text: "кому, когда дойдёт, доставлен" },
  { id: "push-delivered", group: "sender", phone: "left", title: "пуш: эльф донёс подарок", text: "нативный баннер iOS" },
  { id: "many", group: "sender", phone: "left", title: "три эльфа сразу", text: "у каждого свой маршрут и колпак" },

  { id: "push-incoming", group: "recipient", phone: "right", title: "пуш: к тебе идёт эльф", text: "нажатие – камера летит к эльфу" },
  { id: "elf-recipient", group: "recipient", phone: "right", title: "эльф идёт ко мне", text: "сколько ещё идти, подсказка про тряску" },
  { id: "elf-recipient-anon", group: "recipient", phone: "right", title: "от анонима", text: "вопросик вместо пина дарителя" },
  { id: "running", group: "recipient", phone: "right", title: "потряс телефон", text: "снежный шар, эльф бежит до двери" },
  { id: "tired", group: "recipient", phone: "right", title: "эльф выдохся", text: "трясти можно раз в день" },
  { id: "arrival", group: "recipient", phone: "right", title: "подарок пришёл", text: "послание дарителя, подарок, конфетти" },
  { id: "arrival-sack", group: "recipient", phone: "right", title: "пришёл мешок от анонима", text: "подарки плашками" },

  { id: "elf-friend", group: "friend", phone: "right", persona: "sonya", title: "эльф несёт подарок другу", text: "кто → кому и „подарить кому-нибудь“" },
];
