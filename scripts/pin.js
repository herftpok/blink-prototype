/*
 * Пин друга на карте – разметка компонента .pin (styles/components.css).
 * Один источник для всех экранов и фич: карта, шеринг геопозиции, всё, что появится дальше.
 *
 * Правила (pin/*.png): размеры только 52, 36 и 20 – это один пин в масштабе;
 * живая аватарка в маске 62×80 по центру; состояния – стоит, дома, в пути;
 * в сети кадр зелёный со свечением.
 *
 *   BlinkPin.markup({
 *     name: "наташка",
 *     photo: "assets/people/live-1.webp",   // живая аватарка (квадрат с запасом над головой)
 *     size: 52,                             // 52 | 36 | 20
 *     online: false,                        // в сети – зелёная подложка
 *     state: "home",                        // "staying" | "home" | "moving"
 *     minutes: 22,                          // сколько на месте – стикер „22 мин“
 *     speed: 12,                            // в пути – стикер „12 км/ч“
 *     sticker: "24/7",                      // своё число без подписи вместо минут и скорости
 *     title: "наташка",                     // имя над пином с белой обводкой – человек делится геопозицией
 *     battery: 12,                          // плашка заряда под пином (есть только глиф 12 % – Map/Battery.png)
 *     approximate: true,                    // гео перестало приходить: место примерное – бейдж вместо домика и стрелок
 *     tag: "button",                        // "span" – декоративный пин вне карты
 *     className: "pin--static",             // модификаторы
 *     attrs: 'data-go="#/chat/natashka"',   // атрибуты кнопки
 *     assets: "assets",                     // путь к prototype/assets от страницы
 *   })
 */
(() => {
  "use strict";

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  const SIZES = [52, 36, 20];

  /** „наташка, дома, 22 мин“ – для aria-label: состояние словами, без рода */
  function label(o) {
    return [
      o.name,
      o.online && "в сети",
      o.state === "home" && "дома",
      o.state === "moving" && "в пути",
      o.state === "moving" && o.speed != null && `${o.speed} км/ч`,
      o.approximate && "место примерное",
      o.state !== "moving" && o.minutes != null && `${o.minutes} мин`,
      o.battery != null && `заряд ${o.battery} %`,
    ]
      .filter(Boolean)
      .join(", ");
  }

  function markup(o) {
    const assets = o.assets || "assets";
    const size = SIZES.includes(o.size) ? o.size : 52;
    const tag = o.tag || "button";
    const moving = o.state === "moving";
    const classes = ["pin", size !== 52 && `pin--${size}`, o.online && "pin--online", o.className]
      .filter(Boolean)
      .join(" ");

    let value = null;
    let unit = "";
    if (o.sticker != null) value = o.sticker;
    else if (moving && o.speed != null) [value, unit] = [o.speed, "км/ч"];
    else if (!moving && o.minutes != null) [value, unit] = [o.minutes, "мин"];

    const trail = moving
      ? `<span class="pin__motion"><img class="pin__trail" src="${assets}/pin/trail.webp" alt=""></span>`
      : "";
    const badge = o.approximate
      ? `<img class="pin__badge pin__badge--approximate" src="${assets}/pin/approximate.png" alt="">`
      : o.state === "home"
        ? `<img class="pin__badge" src="${assets}/pin/home.png" alt="">`
        : moving
          ? `<img class="pin__badge pin__badge--arrows" src="${assets}/pin/arrows.png" alt="">`
          : "";
    const time =
      value != null
        ? `<span class="pin__time${moving && o.sticker == null ? " pin__time--speed" : ""}" aria-hidden="true">
             <span class="pin__time-value">${escapeHtml(value)}</span>${unit ? `<span class="pin__time-unit">${unit}</span>` : ""}
           </span>`
        : "";
    const a11y = tag === "button" ? `type="button" aria-label="${escapeHtml(label(o))}"` : 'aria-hidden="true"';
    const title = o.title ? `<span class="pin__title" aria-hidden="true">${escapeHtml(o.title)}</span>` : "";
    const battery = o.battery != null ? `<img class="pin__battery" src="${assets}/pin/battery.png" alt="">` : "";

    return `
      <${tag} class="${classes}" ${a11y} ${o.attrs || ""}>
        ${trail}
        <span class="pin__frame"></span>
        <img class="pin__photo" src="${escapeHtml(o.photo)}" alt="">
        ${badge}
        ${time}
        ${title}
        ${battery}
      </${tag}>`;
  }

  window.BlinkPin = { markup, label };
})();
