/*
 * Виджеты Blink на рабочем столе iOS – стенд.
 * Рабочий стол (обои, док, „поиск“, статус-бар) – превью, как статус-бар в остальных стендах:
 * в продукт идут только виджеты. Пульт над телефонами – тоже только стенд.
 *
 * ?leva=moving|staying|home|offline|lost – что сейчас с лёвой, &incoming=1 – лёва кинул какашку
 */
(() => {
  "use strict";

  const A = "../../assets";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const PEOPLE = {
    leva: { name: "лёва", live: `${A}/people/live-3.webp`, photo: `${A}/people/photo-3.webp` },
    natashka: { name: "наташка", live: `${A}/people/live-1.webp`, photo: `${A}/people/photo-1.webp` },
    sonya: { name: "соня", live: `${A}/people/live-4.webp`, photo: `${A}/people/photo-4.webp` },
    vasya: { name: "вася", live: `${A}/people/live-5.webp` },
    me: { name: "ты", live: `${A}/people-around/me-live.webp` },
  };

  /* что с лёвой – пин рисует состояние сам: хвост и скорость, домик и минуты, серый – данные старые */
  const LEVA = {
    moving: { online: true, state: "moving", speed: 12, heading: -90 },
    staying: { online: true, state: "staying", minutes: 40 },
    home: { state: "home", minutes: 22 },
    offline: { state: "staying", minutes: 15 },
    lost: { approximate: true, className: "pin--stale" },
  };
  const LEVA_STATES = [
    ["moving", "в пути"],
    ["staying", "стоит"],
    ["home", "дома"],
    ["offline", "не в сети"],
    ["lost", "нет гео"],
  ];

  const q = new URLSearchParams(location.search);
  const throwDemo = document.body.dataset.demo === "throws";
  const S = {
    leva: LEVA[q.get("leva")] ? q.get("leva") : "moving",
    incoming: q.get("incoming") === "1" || (throwDemo && !["start", "wait"].includes(q.get("state"))),
    counts: { leva: Math.max(0, Math.min(999999, Math.floor(Number(q.get("count")) || (q.get("state") === "wait" ? 1 : 0)))), natashka: 0, sonya: 0 },
  };

  const sending = new Set(q.get("state") === "wait" && !S.incoming ? ["leva"] : []);
  const returnTimers = new Map();
  // Поведение веб-прототипа: секунда без новых отправок, отдельно для каждого друга.
  const RETURN_IDLE_MS = 1000;
  function cancelReturn(who) {
    clearTimeout(returnTimers.get(who));
    returnTimers.delete(who);
    // Выход из состояния стикера завершает серию только этого друга.
    if (sending.delete(who)) S.counts[who] = 0;
  }
  function scheduleReturn(who) {
    clearTimeout(returnTimers.get(who));
    const timer = setTimeout(() => {
      if (returnTimers.get(who) !== timer) return;
      returnToPin(who);
    }, RETURN_IDLE_MS);
    returnTimers.set(who, timer);
  }

  const pin = (who, o = {}) =>
    BlinkPin.markup({ name: PEOPLE[who].name, photo: PEOPLE[who].live, tag: "span", assets: A, ...o });

  /* точка на карте: x/y – низ кадра пина в pt виджета при ширине экрана 390 (виджет 161, 346 × 161, 346 × 344);
     на других ширинах точка едет вместе с виджетом – CSS переводит pt в доли. data-who – в кого летит какашка */
  const at = (x, y, html, o = {}) =>
    `<span class="wg-spot" ${o.who ? `data-who="${o.who}"` : ""} ${o.end ? `data-end="${o.end}"` : ""} style="--x:${x};--y:${y}${o.heading != null ? `;--heading:${o.heading}deg` : ""}">${html}</span>`;

  /* путь между двумя пинами (data-end="a" и "b"): розовые точки от кадра до кадра и расстояние на середине.
     Концы ставит layoutPaths() по настоящим кадрам – на любой ширине путь соединяет пины */
  const path = (text) => `
      <span class="wg-path" aria-hidden="true"></span>
      <span class="map-chip map-chip--live wg-path__chip">${text}</span>`;

  const roundButton = (icon, label) =>
    `<button class="wg-round pressable" type="button" aria-label="${label}"><i class="icon icon--${icon}" aria-hidden="true"></i></button>`;

  const poop = (who, mod) =>
    `<button class="wg-poop wg-poop--${mod} pressable" type="button" data-poop="${who}" aria-label="кинуть какашку: ${PEOPLE[who].name}${S.counts[who] ? `, отправлено ${S.counts[who]}` : ""}">
       <img class="wg-poop__img" src="${A}/stickers/shit.webp" alt="">
     </button>`;

  const hasIncoming = who => S.incoming && who === "leva";
  const hasSent = who => sending.has(who) && !hasIncoming(who);
  const incoming = who => hasIncoming(who) ? `<img class="wg-incoming" src="${A}/stickers/shit.webp" alt="" data-incoming>` : "";
  // Поза зависит от данных: в WidgetKit угол и масштаб анимируются обычной SwiftUI spring.
  const countAngle = count => [-8, 5, -4, 7][count % 4];
  const burst = who => hasSent(who) ? `<span class="wg-burst" role="img" aria-label="отправлено ${S.counts[who]}: ${PEOPLE[who].name}">
    <span class="wg-burst__name" aria-hidden="true">${PEOPLE[who].name}</span>
    <img class="wg-stuck wg-poop__img" src="${A}/stickers/shit.webp" alt="">
    <span class="sticker-number wg-throw-count" style="--count-turn:${countAngle(S.counts[who])}deg" aria-hidden="true">x${S.counts[who]}</span>
  </span>` : "";
  const mapButton = who => `<button class="wg-open" type="button" aria-label="${PEOPLE[who].name} на карте"></button>`;
  const reply = who => `<button class="wg-reply pressable" type="button" data-reply="${who}">кинуть в ответ</button>`;
  const eventLine = who => hasIncoming(who) ? '<p class="wg-event" role="status">кинул в тебя</p>' : '';

  const levaPin = (o = {}) => pin("leva", { ...LEVA[S.leva], ...o });
  const levaHeading = () => LEVA[S.leva].heading;

  /* ── виджеты ── */

  /* маленький „друг“: карта вокруг друга, пин с именем, звонок и чат по углам, какашка сверху справа.
     Нажатие на карту – друг на карте в приложении */
  function friendSmall(who, pinHtml, heading, map) {
    const p = PEOPLE[who];
    return `
      <article class="widget widget--small wg-map${hasIncoming(who) ? " wg-map--incoming" : ""}${hasSent(who) ? " wg-map--sent" : ""}" data-friend="${who}" style="--map-x:${map[0]}px;--map-y:${map[1]}px" aria-label="${p.name}">
        ${mapButton(who)}
        ${at(80.5, hasIncoming(who) ? 94 : 106, pinHtml + burst(who), { who, heading })}
        ${!hasIncoming(who) ? poop(who, "corner") : ""}
        ${hasIncoming(who) ? reply(who) : `<div class="wg-corner wg-corner--bl">${roundButton("phone", `позвонить: ${p.name}`)}</div><div class="wg-corner wg-corner--br">${roundButton("chat", `написать: ${p.name}`)}</div>`}
        ${eventLine(who)}
        ${incoming(who)}
      </article>`;
  }

  /* средний „друг“: шапка как у карты (имя + расстояние), пин, кнопки снизу слева, какашка справа */
  function friendMedium(who, pinHtml, heading, map, meta) {
    const p = PEOPLE[who];
    return `
      <article class="widget widget--medium wg-map${hasIncoming(who) ? " wg-map--incoming" : ""}${hasSent(who) ? " wg-map--sent" : ""}" data-friend="${who}" style="--map-x:${map[0]}px;--map-y:${map[1]}px" aria-label="${p.name}">
        ${mapButton(who)}
        <header class="wg-head">
          <h2 class="wg-head__name">${p.name}</h2>
          <p class="wg-head__meta">${meta}</p>
        </header>
        ${at(211, 106, pinHtml + burst(who), { who, heading })}
        <div class="wg-row wg-row--bl">
          ${roundButton("phone", `позвонить: ${p.name}`)}
          ${roundButton("chat", `написать: ${p.name}`)}
          ${roundButton("navigate", `${p.name} на карте`)}
        </div>
        ${hasIncoming(who) ? reply(who) : poop(who, "big")}
        ${eventLine(who)}
        ${incoming(who)}
      </article>`;
  }

  /* „встреча“: ты и друг на карте, между вами розовый пунктир и расстояние */
  function meetMedium(map) {
    return `
      <article class="widget widget--medium wg-map" style="--map-x:${map[0]}px;--map-y:${map[1]}px" aria-label="лёва и ты">
        <button class="wg-open" type="button" aria-label="лёва и ты на карте"></button>
        ${path("1.2&nbsp;км")}
        ${at(64, 112, pin("me", { title: "ты", size: 36, state: "staying", minutes: 8 }), { end: "a" })}
        ${at(282, 104, pin("leva", { title: "лёва", online: true, state: "moving", speed: 5 }), { who: "leva", heading: 176, end: "b" })}
        <div class="wg-row wg-row--bl">
          ${roundButton("phone", "позвонить: лёва")}
          ${roundButton("chat", "написать: лёва")}
        </div>
      </article>`;
  }

  /* большой „все на карте“: шапка карты и друзья вокруг тебя, нажатие на пин – этот друг */
  function squadLarge(map) {
    return `
      <article class="widget widget--large wg-map" style="--map-x:${map[0]}px;--map-y:${map[1]}px" aria-label="друзья на карте">
        <button class="wg-open" type="button" aria-label="карта"></button>
        <header class="wg-head wg-head--city">
          <h2 class="wg-head__city">москва</h2>
          <p class="wg-head__meta">09:53 · −15&nbsp;°C</p>
        </header>
        ${at(173, 214, pin("me", { state: "staying", minutes: 40 }))}
        ${at(258, 120, pin("natashka", { state: "home", minutes: 22, online: true }), { who: "natashka" })}
        ${at(84, 280, levaPin({ size: 36 }), { who: "leva", heading: levaHeading() != null ? -30 : null })}
        ${at(286, 300, pin("sonya", { size: 20, state: "staying" }), { who: "sonya" })}
        ${at(60, 150, pin("vasya", { size: 36, state: "staying", minutes: 5 }), { who: "vasya" })}
      </article>`;
  }

  /* ── рабочий стол ── */

  const blinkIcon = `<button class="home__icon pressable" type="button" aria-label="blink"><img src="${A}/settings/app-icon-1.png" alt=""></button>`;

  /* слот – место в сетке 2 × 3 (колонка маленького виджета × ряд) */
  const slot = (col, row, html, span = "") => `<div class="home__slot ${span}" style="--col:${col};--row:${row}">${html}</div>`;

  function phones() {
    const meta = S.leva === "lost" ? "проблемы с геолокацией" : "2.3&nbsp;км от тебя";
    const list = [
      {
        caption: "по заданию: друг маленький и средний",
        slots: [
          slot(1, 1, friendSmall("leva", levaPin({ title: "лёва" }), levaHeading(), [-130.5, -384])),
          slot(2, 1, friendSmall("natashka", pin("natashka", { title: "наташка", state: "home", minutes: 22 }), null, [-200, -440])),
          slot(1, 2, friendMedium("leva", levaPin(), levaHeading(), [0, -384], meta), "home__slot--wide"),
          slot(1, 3, blinkIcon, "home__slot--icons"),
        ],
      },
      {
        caption: 'встреча и нет геолокации',
        slots: [
          slot(1, 1, meetMedium([-24, -400]), "home__slot--wide"),
          slot(2, 2, friendSmall("sonya", pin("sonya", { title: "соня", approximate: true, className: "pin--stale" }), null, [-20, -264])),
        ],
      },
      {
        caption: "все друзья вокруг тебя",
        slots: [slot(1, 1, squadLarge([-20, -240]), "home__slot--large")],
      },
    ];
    if (throwDemo) { list[0].caption = "друг на карте: маленький и средний виджет"; return [list[0]]; }
    return list;
  }

  const phone = ({ caption, slots }) => `
    <figure class="stage__phone">
      <div class="device">
        <main class="app home">
          <div class="status-bar" aria-hidden="true">
            <img class="status-bar__time" src="${A}/system/status-time.png" alt="">
            <span class="home__island"></span>
            <img class="status-bar__icons" src="${A}/system/status-icons.png" alt="">
          </div>
          <div class="home__page">${slots.join("")}</div>
          <p class="home__search" aria-hidden="true"><i class="icon icon--search"></i>Поиск</p>
          <img class="home__dock" src="${A}/widgets/dock.png" alt="">
          <div class="home-indicator" aria-hidden="true"></div>
        </main>
      </div>
      <figcaption class="stage__caption">${caption}</figcaption>
    </figure>`;

  /* ── пульт ── */

  function panel() {
    if (throwDemo) return `<button class="panel__button pressable" type="button" data-throw-state="start">обычный виджет</button><button class="panel__button pressable" type="button" data-throw-state="hold">лёва кидает</button><button class="panel__button pressable" type="button" data-throw-state="wait">показать отправку</button>`;
    return `
      <div class="panel__group" role="radiogroup" aria-label="что с лёвой">
        <span class="panel__label caps-label">лёва</span>
        ${LEVA_STATES.map(
          ([id, text]) =>
            `<button class="panel__button pressable" type="button" role="radio" aria-checked="${S.leva === id}" data-leva="${id}">${text}</button>`
        ).join("")}
      </div>
      <button class="panel__button pressable" type="button" id="incoming" aria-pressed="${S.incoming}">лёва кидает какашку</button>`;
  }

  function render() {
    $("#phones").innerHTML = phones().map(phone).join("");
    $("#panel").innerHTML = panel();
    layoutPaths();
  }

  /* ── какашка летит ── */

  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  /* центр элемента в координатах виджета (стенд может быть уменьшен zoom) */
  function centerIn(el, widget) {
    const r = el.getBoundingClientRect();
    const w = widget.getBoundingClientRect();
    const zoom = w.width / widget.offsetWidth || 1;
    return [(r.left + r.width / 2 - w.left) / zoom, (r.top + r.height / 2 - w.top) / zoom];
  }

  function layoutPaths() {
    $$(".wg-path").forEach((line) => {
      const widget = line.closest(".widget");
      const [x1, y1] = centerIn($('[data-end="a"] .pin__frame', widget), widget);
      const [x2, y2] = centerIn($('[data-end="b"] .pin__frame', widget), widget);
      const set = (el, props) => Object.entries(props).forEach(([k, v]) => el.style.setProperty(k, v));
      set(line, {
        "--x": `${x1}px`,
        "--y": `${y1}px`,
        "--len": `${Math.hypot(x2 - x1, y2 - y1)}px`,
        "--turn": `${(Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI}deg`,
      });
      set($(".wg-path__chip", widget), { "--x": `${(x1 + x2) / 2}px`, "--y": `${(y1 + y2) / 2}px` });
    });
  }

  /* Короткий отклик обновления данных, без бесконечных циклов и отложенной смены состояния.
     Веб-кадры приближают spring-переход SwiftUI: angle(count), scale transition, <= 2 s. */
  function animateCount(who, previousCount) {
    if (reduced.matches) return;
    const from = countAngle(previousCount), to = countAngle(S.counts[who]);
    const swing = Math.sign(to - from) || 1;
    $$(`.widget[data-friend="${who}"]`).forEach(widget => {
      $(".wg-throw-count", widget)?.animate([
        { transform: `rotate(${from}deg) scale(0.86)`, offset: 0 },
        { transform: `rotate(${to + swing * 4}deg) scale(1.13)`, offset: 0.38 },
        { transform: `rotate(${to - swing * 2}deg) scale(0.98)`, offset: 0.7 },
        { transform: `rotate(${to}deg) scale(1)`, offset: 1 },
      ], { duration: 420, easing: "ease-out" });
      $(".wg-stuck", widget)?.animate([
        { transform: `rotate(${-6 - swing * 5}deg) scale(0.96)` },
        { transform: `rotate(${-6 + swing * 2}deg) scale(1.04)` },
        { transform: "rotate(-6deg) scale(1)" },
      ], { duration: 320, easing: "ease-out" });
    });
  }

  function throwPoop(button) {
    const who = button.dataset.poop || button.dataset.reply;
    const oldWidget = button.closest(".widget");
    const back = $("[data-incoming]", oldWidget);
    const [x0, y0] = centerIn(back || $(".wg-poop__img", button), oldWidget);
    const [x1, y1] = centerIn($(`.wg-spot[data-who="${who}"] .pin__frame`, oldWidget), oldWidget);
    const size = oldWidget.classList.contains("widget--medium") ? "widget--medium" : "widget--small";
    const keepFocus = document.activeElement === button;
    const previousCount = S.counts[who] || 0;

    // Каждый тап добавляет стикер и заново отсчитывает паузу до возврата пина.
    S.counts[who] = (S.counts[who] || 0) + 1;
    sending.add(who);
    if (who === "leva") S.incoming = false;
    render();
    const widget = $(`.${size}[data-friend="${who}"]`);
    if (keepFocus) $("[data-poop]", widget)?.focus({ preventScroll: true });
    animateCount(who, previousCount);
    scheduleReturn(who);
    const fly = document.createElement("img");
    fly.className = "wg-fly";
    fly.src = `${A}/stickers/shit.webp`;
    fly.alt = "";
    fly.style.setProperty("--x", `${x0}px`);
    fly.style.setProperty("--y", `${y0}px`);
    widget.append(fly);
    const dx = x1 - x0, dy = y1 - y0;
    fly.animate([
      { transform: "translate(-50%, -50%)" },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.62) rotate(-30deg)` },
    ], { duration: reduced.matches ? 1 : 560, easing: token("--ease-emphasized"), fill: "forwards" }).onfinish = () => fly.remove();
  }

  // Уходящий стикер остаётся только на время перехода, новое состояние уже содержит пин.
  // Нативный эквивалент: removal scale + opacity и появление пина через opacity.
  function returnToPin(who, focusSize) {
    const outgoing = reduced.matches ? [] : $$(`.widget[data-friend="${who}"]`).flatMap(widget => {
      const sticker = $(".wg-burst", widget);
      return sticker ? [{
        size: widget.classList.contains("widget--medium") ? "widget--medium" : "widget--small",
        sticker: sticker.cloneNode(true),
      }] : [];
    });
    cancelReturn(who);
    render();
    outgoing.forEach(({ size, sticker }) => {
      const widget = $(`.${size}[data-friend="${who}"]`);
      sticker.classList.add("wg-returning");
      sticker.setAttribute("aria-hidden", "true");
      sticker.removeAttribute("role");
      sticker.removeAttribute("aria-label");
      $(".wg-spot", widget).append(sticker);
      sticker.animate([
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.65)" },
      ], { duration: 260, easing: token("--ease-emphasized"), fill: "forwards" }).onfinish = () => sticker.remove();
      $(".pin", widget).animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 320, delay: 100, easing: "ease-out", fill: "backwards",
      });
    });
    if (focusSize) $(`.${focusSize}[data-friend="${who}"] .wg-open`)?.focus({ preventScroll: true });
  }

  /* ── события ── */

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-poop], [data-reply], [data-leva], [data-throw-state], #incoming");
    if (!t) return;
    if (t.dataset.throwState) {
      if (t.dataset.throwState === "start" && sending.has("leva")) {
        S.incoming = false;
        S.counts.leva = 0;
        return returnToPin("leva");
      }
      cancelReturn("leva");
      S.incoming = t.dataset.throwState === "hold";
      if (t.dataset.throwState === "start") S.counts.leva = 0;
      if (t.dataset.throwState === "wait") { S.counts.leva = Math.max(1, S.counts.leva); sending.add("leva"); }
      render();
      if (sending.has("leva")) scheduleReturn("leva");
      return;
    }
    if (t.dataset.poop || t.dataset.reply) return throwPoop(t);
    if (t.dataset.leva) {
      S.leva = t.dataset.leva;
      return render();
    }
    S.incoming = !S.incoming;
    cancelReturn("leva");

    render();
  });

  /* телефоны целиком в окне */
  function fit() {
    const body = $(".stage__body");
    if (innerWidth <= 480) return body.style.removeProperty("--stage-zoom");
    const room = innerHeight - $(".stage__head").offsetHeight - $(".panel").offsetHeight - 96;
    body.style.setProperty("--stage-zoom", Math.min(1, room / 844).toFixed(3));
  }

  render();
  fit();
  if (sending.has("leva")) scheduleReturn("leva");
  addEventListener("resize", () => {
    fit();
    layoutPaths();
  });
})();
