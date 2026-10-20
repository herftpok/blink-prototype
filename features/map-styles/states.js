/*
 * Все экраны и состояния стилей карты – один список на двоих: раскладка states.html рисует по нему
 * карточки с номерами, стенд index.html открывается в любом из них по ссылке ?state=<id>.
 * query – параметры стенда (как в адресе), act – что сделать после открытия (map-styles.js → ACTS).
 * Снимки – tools/shoot_map_styles.py → states/<id>.webp. Номер карточки – порядок в списке.
 */
window.MapStylesStates = {
  GROUPS: [
    { id: "market", title: "маркет: вкладка «стили»", text: "снимки твоей карты в стилях и «уже у тебя»" },
    { id: "item", title: "шторка стиля", text: "какая тема у стиля, покупка, «надеть»" },
    { id: "profile", title: "профиль → карандаш", text: "строка «стиль карты» в редактировании профиля" },
    { id: "settings", title: "профиль → настройки", text: "«стиль карты» – один из пунктов настроек" },
    { id: "style", title: "экран «стиль карты»", text: "один экран из профиля и настроек: стиль, тема, детализация" },
    { id: "map", title: "карта: стиль поменялся сам", text: "оформил blink vip – зима надета, баннер с «отменить»" },
  ],

  STATES: [
    { id: "market", group: "market", title: "вкладка «стили»", text: "упаковка – снимок твоей карты в стиле, без названия",
      query: "open=market&pack=photo" },
    { id: "market-owned", group: "market", title: "уже у тебя", text: "только стандартный, он надет – лаймовая рамка",
      query: "open=market", act: ["market-owned"] },
    { id: "market-owned-many", group: "market", title: "куплено несколько", text: "гта и майнкрафт куплены, зима с vip, надет майнкрафт",
      query: "open=market&owned=gta,minecraft&current=minecraft&vip=1", act: ["market-owned"] },

    { id: "item-gta", group: "item", title: "гта", text: "только светлая тема; лимитка – склад 42/100",
      query: "open=item:gta" },
    { id: "item-gta-bought", group: "item", title: "гта куплен", text: "стиль сразу надет – «уже выбрано» без подложки",
      query: "open=item:gta", act: ["buy"] },
    { id: "item-wear", group: "item", title: "из «уже у тебя»", text: "купленный, но не надетый стиль – «надеть»",
      query: "open=market&owned=gta", act: ["market-owned", "owned:gta"] },
    { id: "item-worn", group: "item", title: "надел", text: "кнопка стала «уже выбрано», в списке – лаймовая рамка",
      query: "open=market&owned=gta", act: ["market-owned", "owned:gta", "wear"] },
    { id: "item-potter", group: "item", title: "гарри поттер", text: "только светлая тема, в маркете до 31.01",
      query: "open=item:potter" },
    { id: "item-minecraft", group: "item", title: "майнкрафт", text: "два снимка: вблизи и сверху",
      query: "open=item:minecraft" },
    { id: "item-winter", group: "item", title: "зима без vip", text: "светлая и тёмная тема, «оформить blink vip»",
      query: "open=item:winter" },

    { id: "profile", group: "profile", title: "профиль", text: "без «маркета», шестерёнка в правом углу",
      query: "" },
    { id: "edit", group: "profile", title: "редактирование", text: "под «стилем пина» – «стиль карты»",
      query: "open=edit" },
    { id: "edit-end", group: "profile", title: "редактирование, до конца", text: "строк четыре – шторка листается до крестика",
      query: "open=edit&owned=potter&current=potter", act: ["edit-end"] },

    { id: "settings", group: "settings", title: "настройки", text: "по эталону; «стиль карты» ведёт на экран стиля",
      query: "open=settings" },

    { id: "style", group: "style", title: "стандартный", text: "мощный телефон: советуем высокую, ползунок на ней",
      query: "open=style" },
    { id: "style-dark", group: "style", title: "тёмная тема", text: "плитки стандартного и зимы тоже тёмные",
      query: "open=style&theme=dark" },
    { id: "style-weak", group: "style", title: "слабый телефон", text: "советуем низкую – палец переехал, ползунок на ней",
      query: "open=style&device=weak" },
    { id: "style-low", group: "style", title: "низкая на мощном", text: "ползунок на низкой, палец – на высокой",
      query: "open=style&detail=0" },
    { id: "style-picker-end", group: "style", title: "лента стилей до конца", text: "виден майнкрафт",
      query: "open=style", act: ["picker-end"] },
    { id: "style-gta", group: "style", title: "гта надет", text: "тема и детализация выключены, под ними – почему",
      query: "open=style&owned=gta&current=gta" },
    { id: "style-potter", group: "style", title: "гарри поттер надет", text: "темы нет, детализация есть",
      query: "open=style&owned=potter&current=potter", act: ["picker-end"] },
    { id: "style-winter", group: "style", title: "зима с vip", text: "тёмная тема",
      query: "open=style&vip=1&current=winter&theme=dark" },
    { id: "style-buy", group: "style", title: "чужой стиль", text: "шторка покупки поверх экрана стиля",
      query: "open=style", act: ["tile:potter"] },

    { id: "map-vip", group: "map", title: "зима надета с blink vip", text: "лёгкий баннер над «мой мир»: отменить или закрыть",
      query: "", act: ["vip-on"] },
  ],
};
