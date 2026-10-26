/*
 * Все экраны канала маркета – один список на троих: раскладка states.html рисует по нему карточки
 * с номерами, стенд index.html открывается в любом из них по ссылке ?state=<id>, снимки
 * tools/shoot_market_bot.py кладёт в states/<id>.webp. Номер карточки – порядок в списке.
 * query – параметры стенда: viewer (leva – новорег с личной скидкой, sonya), pins (0–2), clock
 * (now – 23.10, last – 31.10 днём, after – 1.11), stock, owned (купленные товары), joined=1 – в розыгрыше,
 * raffle=time – у кнопки розыгрыша в админке выбрано время до окончания,
 * scroll (top, post:<id>), act – что сделать после открытия: jump – нажать на закреп,
 * sheet:<товар> – открыть модалку товара, buy – купить в ней.
 */
window.MarketBotStates = {
  // Порядок – как очередность внедрения: история, цифры на кнопках, товар в посте, закреп, личные.
  // title – подзаголовок над сеткой в states.html; пустой – раздел и так назван, подзаголовка нет
  GROUPS: [
    { id: "history", title: "" },
    { id: "deadline", title: "товар: до архивации" },
    { id: "stock", title: "товар: остаток" },
    { id: "people", title: "розыгрыш" },
    { id: "item", title: "" },
    { id: "pin", title: "" },
    { id: "personal", title: "" },
  ],

  STATES: [
    { id: "history-new", group: "history", title: "новорег открыл канал", text: "лёва в blink с 23.10, а видит всю историю с 02.10",
      query: "viewer=leva&pins=0" },
    { id: "history-up", group: "history", title: "листает вверх", text: "акция и прошлый розыгрыш закончились – кнопки погасли",
      query: "viewer=leva&pins=0&scroll=post:raffle-1" },
    { id: "history-top", group: "history", title: "начало канала", text: "первый пост, 02.10 – историю храним всю",
      query: "viewer=leva&pins=0&scroll=top" },

    { id: "deadline-days", group: "deadline", title: "больше суток", text: "в админке – до архивации: «ещё 8 дней»",
      query: "pins=0&scroll=post:halloween" },
    { id: "deadline-hours", group: "deadline", title: "последние сутки", text: "«ещё 09:42:07», секунды идут до нуля",
      query: "pins=0&clock=last&scroll=post:halloween" },
    { id: "deadline-ended", group: "deadline", title: "срок вышел", text: "«акция закончилась», нажать нельзя",
      query: "pins=0&clock=after&scroll=post:halloween" },

    { id: "stock-many", group: "stock", title: "есть на складе", text: "в админке – остаток: «осталось 42», как в маркете",
      query: "pins=0&scroll=post:gold" },
    { id: "stock-one", group: "stock", title: "одна штука", text: "«осталось 1» – всегда просто число",
      query: "pins=0&stock=1&scroll=post:gold" },
    { id: "stock-out", group: "stock", title: "разобрали", text: "товар ушёл в архив – кнопка погасла",
      query: "pins=0&stock=0&scroll=post:gold" },

    { id: "people-live", group: "people", title: "число участников", text: "в админке – участники: «1 248 участников», растёт само",
      query: "pins=0&scroll=post:raffle-2" },
    { id: "people-time", group: "people", title: "время до окончания", text: "в админке – время: «ещё 8 дней»",
      query: "pins=0&raffle=time&scroll=post:raffle-2" },
    { id: "people-joined", group: "people", title: "ты участвуешь", text: "участие засчитано – тёмная с галочкой, число остаётся",
      query: "pins=0&joined=1&scroll=post:raffle-2" },
    { id: "people-many", group: "people", title: "больше 10 000", text: "«12.4k участников»",
      query: "pins=0&clock=last&scroll=post:raffle-2" },
    { id: "people-ended", group: "people", title: "розыгрыш закончился", text: "ручка вернула finished или прошла дата конца",
      query: "pins=0&clock=after&scroll=post:raffle-2" },

    { id: "item-post", group: "item", title: "пост с товаром", text: "вместо картинки – id товара: обложка из маркета, нажимается целиком",
      query: "pins=0&scroll=post:gold" },
    { id: "item-sheet", group: "item", title: "модалка товара", text: "открывают обложка и «купить»: склад, друзья, «КУПИТЬ 777»",
      query: "pins=0&scroll=post:gold&act=sheet:gold" },
    { id: "item-bought", group: "item", title: "купил", text: "в модалке – «уже у тебя», со склада ушла одна",
      query: "pins=0&scroll=post:gold&act=sheet:gold,buy" },
    { id: "item-owned", group: "item", title: "пост после покупки", text: "кнопка «уже у тебя», остаток 41",
      query: "pins=0&scroll=post:gold&owned=gold&stock=41" },

    { id: "pin-one", group: "pin", title: "один закреп", text: "ставят и снимают в админке – вручную или по таймеру",
      query: "pins=1" },
    { id: "pin-two", group: "pin", title: "два закрепа – больше нельзя", text: "полоска из двух отрезков, первым – новый; скрыть нельзя",
      query: "pins=2" },
    { id: "pin-jump", group: "pin", title: "нажатие на закреп", text: "лента уехала к посту; на плашке – следующий",
      query: "pins=2&act=jump,jump" },
    { id: "pin-off", group: "pin", title: "таймер вышел", text: "таймер из админки вышел – закреп снят у всех",
      query: "pins=2&clock=after&scroll=post:raffle-2" },

    { id: "offer", group: "personal", title: "лёва: личная скидка", text: "видит только лёва: обложка товара, текст с именем, срок на кнопке",
      query: "viewer=leva&pins=0" },
    { id: "offer-other", group: "personal", title: "соня в ту же минуту", text: "личного поста лёвы у неё нет",
      query: "viewer=sonya&pins=0" },
    { id: "offer-sheet", group: "personal", title: "модалка с личной ценой", text: "«−40% только для тебя», 300 вместо 500",
      query: "viewer=leva&pins=0&act=sheet:pixels" },
    { id: "offer-bought", group: "personal", title: "куплено", text: "кнопка «уже у тебя» с галочкой",
      query: "viewer=leva&pins=0&owned=pixels" },
    { id: "offer-ended", group: "personal", title: "скидка сгорела", text: "срок вышел – «скидка закончилась»",
      query: "viewer=leva&pins=0&clock=last&scroll=post:offer" },
  ],
};
