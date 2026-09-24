/*
 * Blink – шеринг геопозиции по ссылке.
 *
 * Два телефона. Слева ты в приложении: нажимаешь на свой пин – камера поднимает его
 * чуть выше центра экрана, снизу выезжает шторка „поделиться“: геопозиция по ссылке,
 * ссылка на профиль, QR-код. Геопозиция и QR – шторки поверх первой, тоже снизу.
 * Второй вход – „где я“: камера ставит твой пин в центр и едет за ним, пока карту не
 * сдвинули пальцем. Дальше три варианта (переключаются на стенде): А – над пином кнопки
 * „профиль“, „гео по ссылке“, „qr-код“; Б – сама „где я“ становится „поделиться“ и открывает
 * шторку; В – над пином только „поделиться гео“.
 * Геопозиция: выбрал время → ссылка создалась и скопировалась → глаза в розовом
 * кольце-таймере, над твоим пином – „транслируется ещё 14:32“. Перестать делиться –
 * с подтверждением на месте, без модалки.
 * Справа друг без blink открывает ссылку в браузере (рамка Safari, browser.png): карта
 * с тобой (имя над пином, заряд под ним), шапка как в приложении (город, погода, сколько
 * ещё идёт трансляция), баннер „скачай blink“, экран конца трансляции и старой ссылки.
 *
 * Между телефонами – „сервер“ с одной сессией, как в API веба:
 * POST /geo/share {duration_minutes}, DELETE /geo/share, GET /geo/share/{token}
 * (404 после конца). Всё вне телефонов – стенд: передача ссылки и перемотка времени.
 *
 * Правила прототипа (CLAUDE.md): никаких тостов. Копирование меняет кнопку на месте,
 * конец трансляции меняет экраны обоих телефонов.
 */
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const ASSETS = "../../assets";

  const DATA = {
    // ты – наташка: идёт по улице, поэтому у пина хвост и скорость
    me: {
      name: "наташка",
      live: `${ASSETS}/people/live-1.webp`,        // живая аватарка – для пина
      cutout: `${ASSETS}/people/cutout-1.webp`,    // вырезка – баннер и экран конца трансляции
      photo: `${ASSETS}/people/photo-1.webp`,      // фото – таб „ты“ и центр QR-кода
      profileUrl: "https://blinkmap.com/@natashka",
    },
    // друзья на твоей карте – люди из пака, пины по тем же правилам
    friends: [
      { name: "лёва", photo: `${ASSETS}/people/live-3.webp`, x: 97, y: 396, size: 36, online: true, state: "staying", minutes: 14 },
      { name: "соня", photo: `${ASSETS}/people/live-4.webp`, x: 308, y: 442, size: 20, online: false, state: "staying" },
    ],
    map: { city: "москва", time: "09:53", weather: "☔", temperature: "−15 °C", steps: 345, rank: 9 },
    // заряд приходит вместе с геопозицией (поле charge). 12 % – как на плашке Map/Battery.png:
    // других уровней в библиотеке пока нет
    battery: 12,
    durations: [15, 30, 60],                       // как в вебе: 15, 30 и 60 мин, по умолчанию 15
    // путь наташки в pt подложки 390×844: по улице под каналом вправо, потом по проспекту вниз
    route: [{ x: 150, y: 442 }, { x: 209, y: 442 }, { x: 209, y: 640 }],
    speedKmh: 5,
    shareOrigin: "https://web.blinkmap.com/share/",
  };

  const STEP_MS = 2000;           // как часто приходит новая точка
  const STEP_PT = 4;              // сколько проходит за это время, pt подложки
  const COPY_MS = 2000;           // сколько кнопка говорит „скопировано“
  const CONFIRM_MS = 4000;        // сколько красная кнопка ждёт второго нажатия
  const MAP_ZOOM = 1.35;          // подложка крупнее экрана: камере есть куда ехать
  const OWN_FOCUS = { x: 0.5, y: 0.4 };        // твой пин при открытой шторке: по центру, чуть выше середины
  const FOCUS_GAP = 24;                        // если шторка выше – пин стоит над её краем
  const CENTER = { x: 0.5, y: 0.5 };           // „где я“: твой пин посередине экрана
  const LOCATE_MS = 500;                       // сколько камера едет к тебе по „где я“
  const PAN_SLOP = 4;                          // палец сдвинулся меньше – это нажатие, а не жест
  // „где я“: А – кнопки над пином, Б – кнопка „поделиться“, В – над пином только „поделиться гео“.
  // У Б и В своя ссылка на стенд: …/geo-share/#share-button, …/geo-share/#geo-only
  const ENTRIES = { pin: "", button: "#share-button", geo: "#geo-only" };
  const VIEW_ANCHOR = { x: 0.5, y: 0.47 };     // у друга: пин между шапкой и баннером
  const TOKEN_HEX = "9f2c1e7a0b5d4c3e8f6a1b2c3d4e5f60";
  const EXPIRED_TOKEN = `48101.${TOKEN_HEX}`;

  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cssNumber = (name) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  const SHEET_MS = cssNumber("--duration-sheet") * 1000 || 380;   // камера едет вместе со шторкой
  // высота пина над якорем: маска аватарки и её отступ от низа кадра (tokens.css)
  const PIN_HEIGHT = cssNumber("--pin-avatar-height") + cssNumber("--pin-avatar-bottom") || 84;
  const EASE = "var(--ease-emphasized)";
  // кольцо-таймер никогда не бывает полным: с первой секунды видно, что это отсчёт, а не круг
  const RING_MAX = 0.94;

  /* ── время и сервер ──────────────────────────────────────────────────── */

  // Часы стенда: перемотка сдвигает их, а не таймеры телефонов
  const clock = {
    skew: 0,
    now() {
      return Date.now() + this.skew;
    },
  };

  /** 872 → „14:32“: отсчёт с секундами, видно, что время идёт */
  const clockLabel = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const displayUrl = (url) => url.replace(/^https:\/\//, "");

  const server = {
    session: null,                  // { token, url, minutes, expiresAt, endedBy: null | "stop" | "time" }
    created: 0,
    failing: false,                 // стенд: „ссылка не создалась“

    create(minutes) {
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (this.failing) {
            reject(new Error("create failed"));
            return;
          }
          this.created += 1;
          const n = this.created;
          const token = `${48212 + n}.${TOKEN_HEX.slice(n) + TOKEN_HEX.slice(0, n)}`;
          this.session = {
            token,
            url: DATA.shareOrigin + token,
            minutes,
            expiresAt: clock.now() + minutes * 60000,
            endedBy: null,
          };
          resolve(this.session);
        }, 450);
      });
    },

    stop() {
      if (this.isActive()) this.session.endedBy = "stop";
    },

    isActive() {
      return Boolean(this.session) && !this.session.endedBy;
    },

    left() {
      return this.isActive() ? Math.max(0, Math.ceil((this.session.expiresAt - clock.now()) / 1000)) : 0;
    },

    /** доля оставшегося времени – для кольца-таймера */
    progress() {
      return this.isActive() ? this.left() / (this.session.minutes * 60) : 0;
    },

    /** GET /geo/share/{token}: после конца трансляции – 404, о человеке ничего не известно */
    lookup(token) {
      const s = this.session;
      if (!s || s.token !== token || s.endedBy) return null;
      return { owner: DATA.me };
    },
  };

  /* ── движение наташки ────────────────────────────────────────────────── */

  const route = (() => {
    const segments = [];
    let total = 0;
    for (let i = 1; i < DATA.route.length; i += 1) {
      const a = DATA.route[i - 1];
      const b = DATA.route[i];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      segments.push({ a, b, length, start: total });
      total += length;
    }
    return { segments, total };
  })();

  const motion = {
    dist: 0,
    arrivedAt: null,              // когда остановилась (часы стенда)
    minutes: 0,                   // сколько минут на месте показано на пинах
  };

  function positionAt(dist) {
    const d = Math.min(dist, route.total);
    const seg = route.segments.find((s) => d <= s.start + s.length) || route.segments[route.segments.length - 1];
    const t = seg.length ? (d - seg.start) / seg.length : 1;
    return {
      x: seg.a.x + (seg.b.x - seg.a.x) * t,
      y: seg.a.y + (seg.b.y - seg.a.y) * t,
      heading: (Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x) * 180) / Math.PI,
      moving: d < route.total,
    };
  }

  /** Что сейчас с наташкой – для всех её пинов: в пути со скоростью или стоит, сколько минут */
  function ownState() {
    if (positionAt(motion.dist).moving) return { state: "moving", speed: DATA.speedKmh };
    return { state: "staying", minutes: Math.max(1, Math.ceil((clock.now() - motion.arrivedAt) / 60000)) };
  }

  /** Пин наташки – общий компонент (scripts/pin.js), 52 и у тебя, и у друга */
  function ownPin({ name, online = true, className = "", attrs = "", extra = {} }) {
    return window.BlinkPin.markup({
      name,
      photo: DATA.me.live,
      size: 52,
      online,
      ...ownState(),
      ...extra,
      className: `pressable ${className}`,
      attrs,
      assets: ASSETS,
    });
  }

  /** Хвост и стрелки смотрят туда, куда человек идёт */
  function setHeading(pin, pos) {
    if (pin) pin.style.setProperty("--heading", `${pos.heading.toFixed(1)}deg`);
  }

  /** Ставит точку на слой карты: координаты в px слоя, едет только transform */
  function placeMover(mover, x, y, duration) {
    mover.style.setProperty("--move-duration", `${duration}ms`);
    mover.style.setProperty("--x", x.toFixed(2));
    mover.style.setProperty("--y", y.toFixed(2));
  }

  /* ── камера: подложка крупнее экрана, телефон видит её часть ─────────── */

  function camera(app, layer) {
    const cam = {
      pos: { x: 0, y: 0 },
      inset: 0,                   // низ экрана закрыт шторкой: карта может уйти под неё, как с padding у Mapbox
      metrics() {
        const w = app.clientWidth;
        const h = app.clientHeight;
        const layerW = w * MAP_ZOOM;
        return { w, h, k: layerW / 390, layerW, layerH: (layerW * 844) / 390 };
      },
      clamp(x, y) {
        const { w, h, layerW, layerH } = cam.metrics();
        return { x: Math.min(0, Math.max(w - layerW, x)), y: Math.min(0, Math.max(h - cam.inset - layerH, y)) };
      },
      /** камера, при которой точка карты стоит в anchor (доли экрана) */
      target(pos, anchor) {
        const { w, h, k } = cam.metrics();
        return cam.clamp(w * anchor.x - pos.x * k, h * anchor.y - pos.y * k);
      },
      set(pos, duration = 0, ease = "linear") {
        cam.pos = pos;
        const style = layer.style;
        style.setProperty("--k", cam.metrics().k.toFixed(4));
        style.setProperty("--cam-duration", `${reducedMotion() ? 0 : duration}ms`);
        style.setProperty("--cam-ease", ease);
        style.setProperty("--cam-x", pos.x.toFixed(2));
        style.setProperty("--cam-y", pos.y.toFixed(2));
      },
    };
    return cam;
  }

  /* ── копирование ─────────────────────────────────────────────────────── */

  async function writeClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // file:// или нет прав на буфер – пробуем старый способ
    }
    const focused = document.activeElement;
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.className = "visually-hidden";
    document.body.append(field);
    field.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch (error) {
      ok = false;
    }
    field.remove();
    if (focused && focused.focus) focused.focus({ preventScroll: true });
    return ok;
  }

  /* ── общее: жесты и кольцо-таймер ────────────────────────────────────── */

  // во сколько раз стенд уменьшил телефон
  const zoomOf = (element) => element.getBoundingClientRect().width / element.offsetWidth || 1;

  /** Резина у края (apple-design.md §9): чем дальше тянешь, тем сильнее сопротивление */
  const rubberband = (overshoot, dimension) => (1 - 1 / ((overshoot * 0.55) / dimension + 1)) * dimension;

  /** Проекция броска (apple-design.md §6): куда элемент „доедет“ с текущей скоростью */
  const project = (velocity) => ((velocity / 1000) * 0.998) / (1 - 0.998);

  /** Карту двигает палец: камера идёт за ним 1:1. Сдвинул дальше PAN_SLOP – это жест
      (onMove: камера перестаёт ехать за пином), не сдвинул – нажатие по карте (onTap).
      С кнопок и пинов жест не начинается */
  function enablePan(canvas, app, cam, { enabled, onMove, onTap = () => {} }) {
    let start = null;
    let moved = false;
    let zoom = 1;

    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button, .pin-actions") || !enabled()) return;
      zoom = zoomOf(app);
      moved = false;
      start = { x: event.clientX, y: event.clientY, cam: { ...cam.pos } };
      canvas.setPointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!start) return;
      const dx = (event.clientX - start.x) / zoom;
      const dy = (event.clientY - start.y) / zoom;
      if (!moved) {
        if (Math.hypot(dx, dy) < PAN_SLOP) return;
        moved = true;
        canvas.classList.add("is-dragging");
        onMove();
      }
      cam.set(cam.clamp(start.cam.x + dx, start.cam.y + dy), 0);
    });

    const finish = (event) => {
      if (!start) return;
      if (!moved && event.type === "pointerup") onTap();
      start = null;
      canvas.classList.remove("is-dragging");
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
  }

  const setText = (node, text) => {
    if (node.textContent !== text) node.textContent = text;
  };

  /** Кольцо-таймер: доля оставшегося времени, но не больше RING_MAX – зазор виден сразу;
      время вышло – дуги нет совсем */
  function setRing(ring, progress) {
    ring.style.setProperty("--progress", (progress * RING_MAX).toFixed(4));
    ring.classList.toggle("ring--empty", progress <= 0);
  }

  const leftLabel = () => {
    const left = server.left();
    return `${Math.floor(left / 60)} мин ${left % 60} сек`;
  };

  /* ═══════════════════════ ТЫ: приложение ═══════════════════════════════ */

  const SHEETS = { menu: $("#s-sheet"), geo: $("#s-geo-sheet"), qr: $("#s-qr-sheet") };

  const sender = {
    app: $("#sender"),
    scrim: $("#s-scrim"),
    mover: $("#s-mover"),
    camera: camera($("#sender"), $("#s-layer")),
    stack: [],                     // открытые шторки снизу вверх: поверх „поделиться“ – геопозиция или QR
    openers: new Map(),            // шторка → кнопка, которая её открыла: туда возвращается фокус
    follow: false,                 // камера держит твой пин, пока открыта шторка
    centered: false,               // после „где я“ камера держит твой пин в центре, пока карту не сдвинули
    entry: "pin",                  // что даёт „где я“: "pin" – кнопки над пином, "button" – кнопка „поделиться“,
                                   // "geo" – над пином только „поделиться гео“
    actionsOpen: false,            // варианты А и В: над пином открыты кнопки (пока открыта шторка – ждут под ней)
    wasActive: false,              // шла ли трансляция на прошлом тике: в варианте В кнопка и плашка сменяют друг друга
    selected: DATA.durations[0],
    pending: false,
    failed: false,
    afterEnd: false,               // прошлая ссылка кончилась – шторка говорит об этом
    copiedUntil: 0,
    copiedOnce: false,
    copyTimer: 0,
    confirming: false,             // „перестать делиться гео“ ждёт второго нажатия
    confirmTimer: 0,
    profileCopiedUntil: 0,
    profileTimer: 0,
  };

  const ownMapPin = () => $(".pin", sender.mover);
  const topSheet = () => sender.stack[sender.stack.length - 1] || null;

  function renderSenderMap() {
    const m = DATA.map;
    $("#s-city").textContent = m.city;
    $("#s-time").textContent = m.time;
    $("#s-weather").textContent = m.weather;
    $("#s-temperature").textContent = m.temperature;
    $("#s-steps").textContent = `${m.steps} шагов · ${m.rank} место`;
    $("#s-tab-avatar").src = DATA.me.photo;
    $("#s-qr-avatar").src = DATA.me.photo;
    $("#s-qr-name").textContent = DATA.me.name;
    $("#s-qr-link").textContent = displayUrl(DATA.me.profileUrl);

    $("#s-pins").innerHTML = DATA.friends
      .map((p) =>
        window.BlinkPin.markup({ ...p, className: "pressable", attrs: `style="--x:${p.x};--y:${p.y}"`, assets: ASSETS })
      )
      .join("");

    $("#s-durations").innerHTML = DATA.durations
      .map(
        (minutes) => `
          <button class="choice-tile pressable" type="button" role="radio" data-minutes="${minutes}"
                  aria-label="${minutes} минут">
            <span class="choice-tile__value" aria-hidden="true">${minutes}</span>
            <span class="choice-tile__unit" aria-hidden="true">мин</span>
          </button>`
      )
      .join("");
  }

  /** Твой пин на своей карте – всегда в сети: ты в приложении. Нажатие открывает „поделиться“ */
  function renderOwnPin() {
    const markup = ownPin({ name: "ты", attrs: 'aria-haspopup="dialog" aria-controls="s-sheet"' });
    const old = ownMapPin();
    if (old) old.outerHTML = markup;
    else sender.mover.insertAdjacentHTML("afterbegin", markup);
    const pin = ownMapPin();
    pin.setAttribute("aria-label", `${pin.getAttribute("aria-label")} – поделиться`);
    setHeading(pin, positionAt(motion.dist));
  }

  /** Куда камера ставит твой пин при открытой шторке: чуть выше середины экрана.
      Шторка выше – пин над её краем, но не выше шапки карты: там город и плашки */
  function ownFocus() {
    const { h } = sender.camera.metrics();
    const header = $(".map__header", sender.app);
    // плашка трансляции над пином при открытой шторке спрятана – считаем только сам пин
    const floor = header.offsetTop + header.offsetHeight + FOCUS_GAP / 2 + PIN_HEIGHT;
    const top = h - (topSheet() ? topSheet().offsetHeight : 0);
    return { x: OWN_FOCUS.x, y: Math.max(floor, Math.min(h * OWN_FOCUS.y, top - FOCUS_GAP)) / h };
  }

  /** Точка едет – камера за ней: при открытой шторке пин над её краем, после „где я“ – в центре */
  function placeOwnPin(pos, duration) {
    const { k } = sender.camera.metrics();
    placeMover(sender.mover, pos.x * k, pos.y * k, duration);
    if (sender.follow) sender.camera.set(sender.camera.target(pos, ownFocus()), duration);
    else if (sender.centered) sender.camera.set(sender.camera.target(pos, CENTER), duration);
  }

  /** Камера поднимает твой пин и держит его, пока открыта шторка. Шторка закрывает
      низ экрана – под неё карта может уйти дальше своего края */
  function focusOwnPin() {
    sender.follow = true;
    sender.camera.inset = topSheet().offsetHeight;
    sender.camera.set(sender.camera.target(positionAt(motion.dist), ownFocus()), SHEET_MS, EASE);
  }

  /** Над твоим пином, пока тебя видно по ссылке: live-точка и „транслируется ещё 14:32“.
      Пока над пином кнопки „поделиться“, плашка прячется, а live-точка – на „гео“ */
  function renderLiveChip() {
    const active = server.isActive();
    const chip = $("#s-live");
    chip.hidden = !active;
    $("#s-act-live").hidden = !active;
    $("#s-act-geo").setAttribute("aria-label", active ? `геопозиция по ссылке, осталось ${leftLabel()}` : "геопозиция по ссылке");
    // у „гео“ над пином – сколько ещё, словами, пока плашка уступает место кнопкам
    setText($("#s-act-geo-label"), active ? `ещё ${clockLabel(server.left())}` : "гео по\u00a0ссылке");
    if (sender.wasActive !== active) {
      sender.wasActive = active;
      syncEntry();
    }
    if (!active) return;
    setText($("#s-live-text"), `транслируется ещё ${clockLabel(server.left())}`);
    chip.setAttribute("aria-label", `геопозицию видно по ссылке, осталось ${leftLabel()}`);
  }

  /** Карточка „геопозиция по ссылке“ в меню: в покое – что это даёт, во время трансляции –
      зелёная live-точка и сколько осталось. Точку не пересоздаём каждую секунду: сбился бы пульс */
  function renderGeoCard() {
    const text = $("#s-geo-card-text");
    const state = server.isActive() ? "live" : "idle";
    if (text.dataset.state !== state) {
      text.dataset.state = state;
      text.innerHTML =
        state === "live"
          ? '<span class="live-dot" aria-hidden="true"></span><span></span>'
          : "транслируй геопозицию друзьям без\u00a0blink";
    }
    if (state === "live") setText(text.lastElementChild, `транслируется ещё ${clockLabel(server.left())}`);
  }

  /** „профиль“ – в шторке и над пином: одно нажатие копирует ссылку, надпись на 2 s – „скопировано“ */
  function renderProfileTile() {
    const copied = sender.profileCopiedUntil > Date.now();
    const label = copied ? "ссылка на профиль скопирована" : "скопировать ссылку на профиль";
    [["#s-profile-icon", "#s-profile-label", "#s-profile"], ["#s-act-profile-icon", "#s-act-profile-label", "#s-act-profile"]]
      .forEach(([icon, text, button]) => {
        $(icon).className = `icon icon--${copied ? "check" : "link"}`;
        $(text).textContent = copied ? "скопировано" : "профиль";
        $(button).setAttribute("aria-label", label);
      });
  }

  function renderTiles() {
    $$("#s-durations .choice-tile").forEach((tile) => {
      const on = Number(tile.dataset.minutes) === sender.selected;
      tile.setAttribute("aria-checked", String(on));
      tile.tabIndex = on ? 0 : -1;
    });
  }

  function renderCta() {
    const cta = $("#s-cta");
    const copied = server.isActive() && sender.copiedUntil > Date.now();
    cta.classList.toggle("button--primary", !copied);
    cta.classList.toggle("button--secondary", copied);
    cta.setAttribute("aria-busy", String(sender.pending));
    $("#s-cta-icon").className = `icon icon--${copied ? "check" : "link"}`;
    $("#s-cta-label").textContent = sender.pending ? "создаём ссылку" : copied ? "скопировано" : "скопировать ссылку";
  }

  /** Кольцо и стикер со временем в герое шторки: каждую секунду */
  function renderHeroTimer() {
    const left = server.left();
    setRing($("#s-ring"), server.progress());
    setText($("#s-time-badge"), clockLabel(left));
    $("#s-time-badge").setAttribute("aria-label", `осталось ${leftLabel()}`);
    $("#s-hero").classList.toggle("is-urgent", server.isActive() && left < 60);
  }

  /** Шторка геопозиции: выбор времени или трансляция. Ссылку не показываем – только то,
      что она скопирована */
  function renderGeoSheet() {
    const active = server.isActive();
    $("#s-hero").dataset.live = String(active);
    $("#s-geo-title").textContent = active ? "ты на\u00a0карте по\u00a0ссылке" : "геопозиция по\u00a0ссылке";
    const text = active
      ? ""
      : sender.afterEnd
        ? "прошлая ссылка больше не\u00a0работает"
        : "транслируй геопозицию друзьям без\u00a0blink";
    $("#s-geo-text").textContent = text;
    $("#s-geo-text").hidden = !text;
    $("#s-setup").hidden = active;
    $("#s-error").hidden = active || !sender.failed;
    $("#s-stop").hidden = !active;
    SHEETS.geo.dataset.live = String(active);          // две кнопки внизу – шторка опускает их ниже
    if (!active) setStopConfirm(false);
    if (active) renderHeroTimer();
    renderTiles();
    renderCta();
  }

  function renderSheets() {
    renderGeoCard();
    renderProfileTile();
    renderGeoSheet();
  }

  function syncSenderChrome() {
    const open = sender.stack.length > 0;
    // шторка чёрная и закрывает низ; карта над ней не затемняется – там твой пин
    sender.app.dataset.home = open ? "light" : "dark";
    sender.app.classList.toggle("has-sheet", open);
    // под шторкой карта и таб-бар недоступны и с клавиатуры, под верхней шторкой – нижняя
    $(".screen.map", sender.app).inert = open;
    $(".tabbar", sender.app).inert = open;
    Object.values(SHEETS).forEach((sheet) => {
      sheet.inert = sheet !== topSheet();
    });
    syncEntry();
  }

  /** Что сейчас даёт „где я“. Вариант А – кнопки над пином: открыты после „где я“, пока их
      не закрыли нажатием по карте; под шторкой ждут и возвращаются, когда она закрылась.
      Вариант Б – пока камера держит тебя в центре, „где я“ не нужна: на её месте „поделиться“ */
  function syncEntry() {
    const share = sender.entry === "button" && sender.centered;
    const locate = $("#s-locate");
    locate.classList.toggle("is-alt", share);
    locate.setAttribute("aria-label", share ? "поделиться" : "показать, где я");
    if (share) {
      locate.setAttribute("aria-haspopup", "dialog");
      locate.setAttribute("aria-controls", "s-sheet");
    } else {
      locate.removeAttribute("aria-haspopup");
      locate.removeAttribute("aria-controls");
    }

    // А – три кнопки над пином. В – одна „поделиться гео“, пока трансляции нет; идёт трансляция –
    // на её месте плашка „транслируется ещё 14:32“, она тоже открывает шторку геопозиции
    const over = sender.actionsOpen && !sender.stack.length;
    const bar = sender.entry === "pin" && over;
    const single = sender.entry === "geo" && over && !server.isActive();
    [["#s-actions", bar], ["#s-geo-actions", single]].forEach(([selector, open]) => {
      const actions = $(selector);
      actions.classList.toggle("is-open", open);
      actions.inert = !open;
    });
    sender.app.classList.toggle("has-actions", bar);
  }

  /** Фокус внутри кнопок над пином – им закрываться, фокус вернётся на „где я“ */
  const focusOverPin = () => ["#s-actions", "#s-geo-actions"].some((selector) => $(selector).contains(document.activeElement));

  /** „где я“: камера ставит твой пин в центр и дальше едет за ним */
  function centerOnMe() {
    sender.centered = true;
    sender.camera.set(sender.camera.target(positionAt(motion.dist), CENTER), LOCATE_MS, EASE);
  }

  /** Кнопки над пином закрылись (нажатие по карте, Esc, карту сдвинули) */
  function closeActions() {
    if (!sender.actionsOpen) return;
    const hadFocus = focusOverPin();
    sender.actionsOpen = false;
    syncEntry();
    if (hadFocus) $("#s-locate").focus({ preventScroll: true });
  }

  /** Меняет содержимое шторки и плавно подгоняет её высоту: шторка сразу встаёт на новую
      высоту, а transform возвращает её от старой (FLIP) – едет только transform, по вертикали.
      Камера при этом держит твой пин над краем шторки */
  function morphSheet(sheet, change) {
    const before = sheet.offsetHeight;
    change();
    const after = sheet.offsetHeight;
    if (!sender.stack.includes(sheet) || after === before) return;
    if (!reducedMotion()) {
      sheet.classList.add("is-dragging");             // без перехода: встаём на старую высоту
      sheet.style.transform = `translateY(${after - before}px)`;
      void sheet.offsetWidth;
      sheet.classList.remove("is-dragging");
      sheet.style.transform = "";                      // и едем к новой
    }
    if (sheet === topSheet()) focusOwnPin();
  }

  /** Открывает шторку поверх уже открытых. Каждая выезжает снизу – и первая, и вторая */
  function openSheet(name, opener = document.activeElement) {
    const sheet = SHEETS[name];
    if (sender.stack.includes(sheet)) return;
    if (name === "geo") sender.failed = false;
    renderSheets();
    sender.openers.set(sheet, opener);
    sender.stack.push(sheet);
    sheet.classList.add("is-open");
    sender.scrim.classList.add("is-open");
    syncSenderChrome();
    focusOwnPin();
    requestAnimationFrame(() => sheet.focus({ preventScroll: true }));
  }

  /** Закрывает шторку (по умолчанию верхнюю): она уезжает вниз, под ней – предыдущая.
      Закрылась последняя – камера отпускает пин, карта возвращается в свои края */
  function closeSheet(sheet = topSheet(), { restoreFocus = true } = {}) {
    const i = sender.stack.indexOf(sheet);
    if (i === -1) return;
    if (sheet === SHEETS.geo) setStopConfirm(false);
    sender.stack.splice(i, 1);
    sheet.classList.remove("is-open", "is-dragging");
    sheet.style.transform = "";
    if (sender.stack.length) {
      syncSenderChrome();
      focusOwnPin();
    } else {
      sender.follow = false;
      sender.scrim.classList.remove("is-open");
      sender.camera.inset = 0;
      // после „где я“ камера возвращает тебя в центр, иначе карта просто встаёт в свои края
      sender.camera.set(
        sender.centered
          ? sender.camera.target(positionAt(motion.dist), CENTER)
          : sender.camera.clamp(sender.camera.pos.x, sender.camera.pos.y),
        SHEET_MS,
        EASE
      );
      syncSenderChrome();
    }
    const opener = sender.openers.get(sheet);
    sender.openers.delete(sheet);
    if (restoreFocus) focusBack(opener);
  }

  /** Фокус – на кнопку, которая открыла шторку. Её уже нет (вариант В: пошла трансляция, и на месте
      „поделиться гео“ теперь плашка) – на плашку над пином, иначе на сам пин */
  function focusBack(opener) {
    const usable = (node) => node && node.isConnected && !node.closest("[hidden], [inert]");
    const back = usable(opener)
      ? opener
      : opener && opener.closest("#s-geo-actions") && usable($("#s-live"))
        ? $("#s-live")
        : ownMapPin();
    if (back) back.focus({ preventScroll: true });
  }

  function closeAll() {
    const bottom = sender.stack[0];
    const opener = bottom && sender.openers.get(bottom);
    while (sender.stack.length) closeSheet(topSheet(), { restoreFocus: false });
    focusBack(opener);
  }

  async function copyLink() {
    if (!server.isActive()) return;
    const ok = await writeClipboard(server.session.url);
    if (ok) {
      sender.copiedOnce = true;
      sender.copiedUntil = Date.now() + COPY_MS;
      $("#s-announce").textContent = "ссылка скопирована";
      clearTimeout(sender.copyTimer);
      sender.copyTimer = setTimeout(() => {
        renderCta();
        $("#s-announce").textContent = "";
      }, COPY_MS + 20);
    }
    renderCta();
    renderStage();
  }

  // нажатие на свой пин: камера поднимает его, снизу – „поделиться“. Кнопки над пином
  // уступают шторке и после неё не возвращаются: вход был не через них
  sender.mover.addEventListener("click", (event) => {
    const pin = event.target.closest(".pin");
    if (!pin) return;
    sender.actionsOpen = false;
    openSheet("menu", pin);
  });
  $("#s-live").addEventListener("click", (event) => {
    sender.actionsOpen = false;
    openSheet("geo", event.currentTarget);
  });

  $("#s-geo-card").addEventListener("click", (event) => openSheet("geo", event.currentTarget));
  $("#s-qr").addEventListener("click", (event) => openSheet("qr", event.currentTarget));
  sender.scrim.addEventListener("click", closeAll);
  $$("[data-close]", sender.app).forEach((button) => {
    button.addEventListener("click", () => closeSheet(button.closest(".sheet")));
  });

  // „где я“: камера ставит твой пин в центр. Дальше – по варианту: А – над пином кнопки
  // „поделиться“, Б – кнопка сама становится „поделиться“ и второе нажатие открывает шторку,
  // В – над пином „поделиться гео“
  $("#s-locate").addEventListener("click", (event) => {
    if (sender.entry === "button" && sender.centered) {
      openSheet("menu", event.currentTarget);
      return;
    }
    centerOnMe();
    if (sender.entry !== "button") sender.actionsOpen = true;
    syncEntry();
    // с клавиатуры фокус переходит на первую кнопку над пином (идёт трансляция – на плашку над ним)
    if (sender.entry !== "button" && event.detail === 0) {
      const first = sender.entry === "pin" ? $("#s-act-profile") : server.isActive() ? $("#s-live") : $("#s-geo-cta");
      requestAnimationFrame(() => first.focus({ preventScroll: true }));
    }
  });

  // кнопки над пином: геопозиция и QR – шторки (кнопки ждут под ними), профиль копируется на месте
  $("#s-act-geo").addEventListener("click", (event) => openSheet("geo", event.currentTarget));
  $("#s-geo-cta").addEventListener("click", (event) => openSheet("geo", event.currentTarget));
  $("#s-act-qr").addEventListener("click", (event) => openSheet("qr", event.currentTarget));
  // нажатие по пину друга – тоже мимо кнопок
  $("#s-pins").addEventListener("click", closeActions);

  async function copyProfile() {
    if (!(await writeClipboard(DATA.me.profileUrl))) return;
    sender.profileCopiedUntil = Date.now() + COPY_MS;
    $("#s-announce").textContent = "ссылка на профиль скопирована";
    renderProfileTile();
    clearTimeout(sender.profileTimer);
    sender.profileTimer = setTimeout(() => {
      renderProfileTile();
      $("#s-announce").textContent = "";
    }, COPY_MS + 20);
  }
  $("#s-profile").addEventListener("click", copyProfile);
  $("#s-act-profile").addEventListener("click", copyProfile);

  $("#s-durations").addEventListener("click", (event) => {
    const tile = event.target.closest(".choice-tile");
    if (!tile || sender.pending) return;
    sender.selected = Number(tile.dataset.minutes);
    sender.failed = false;
    morphSheet(SHEETS.geo, renderGeoSheet);             // строка ошибки могла уйти
  });

  // стрелки двигают выбор внутри группы, как у нативных радиокнопок
  $("#s-durations").addEventListener("keydown", (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const i = DATA.durations.indexOf(sender.selected);
    sender.selected = DATA.durations[(i + step + DATA.durations.length) % DATA.durations.length];
    renderGeoSheet();
    $(`#s-durations [data-minutes="${sender.selected}"]`).focus();
  });

  $("#s-cta").addEventListener("click", async () => {
    if (sender.pending) return;
    if (server.isActive()) {
      copyLink();
      return;
    }
    // одно нажатие: ссылка создаётся и сразу копируется
    sender.pending = true;
    sender.failed = false;
    morphSheet(SHEETS.geo, renderGeoSheet);
    try {
      await server.create(sender.selected);
      sender.pending = false;
      sender.afterEnd = false;
      morphSheet(SHEETS.geo, renderSheets);            // вместо выбора времени – глаза в кольце-таймере
      renderLiveChip();
      renderStage();
      await copyLink();
    } catch (error) {
      sender.pending = false;
      sender.failed = true;
      morphSheet(SHEETS.geo, renderGeoSheet);
    }
  });

  /** Подтверждение без модалки: красная кнопка заливается и спрашивает „точно перестать?“,
      второе нажатие останавливает; не нажали за 4 s – кнопка возвращается */
  function setStopConfirm(on) {
    sender.confirming = on;
    clearTimeout(sender.confirmTimer);
    const stop = $("#s-stop");
    stop.classList.toggle("is-confirming", on);
    stop.textContent = on ? "точно перестать?" : "перестать делиться гео";
    if (on) sender.confirmTimer = setTimeout(() => setStopConfirm(false), CONFIRM_MS);
  }

  $("#s-stop").addEventListener("click", () => {
    if (!sender.confirming) {
      setStopConfirm(true);
      return;
    }
    setStopConfirm(false);
    server.stop();
    onSessionEnd();
    $("#s-cta").focus({ preventScroll: true });       // кнопка пропала – фокус на главное действие
  });

  // Шторку тянут вниз за грэббер: 1:1 с пальцем, решение по проекции броска
  $$("[data-drag]", sender.app).forEach((handle) => {
    const sheet = handle.closest(".sheet");
    let tracking = false;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    let zoom = 1;

    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || sheet !== topSheet()) return;
      tracking = true;
      zoom = zoomOf(sheet);
      startY = lastY = event.clientY;
      lastT = event.timeStamp;
      velocity = 0;
      handle.setPointerCapture(event.pointerId);
      sheet.classList.add("is-dragging");
    });

    handle.addEventListener("pointermove", (event) => {
      if (!tracking) return;
      const dt = Math.max(1, event.timeStamp - lastT);
      velocity = ((event.clientY - lastY) / zoom / dt) * 1000;
      lastY = event.clientY;
      lastT = event.timeStamp;
      const dy = (event.clientY - startY) / zoom;
      const offset = dy >= 0 ? dy : -rubberband(-dy, sheet.offsetHeight);
      sheet.style.transform = `translateY(${offset}px)`;
    });

    const finish = (event) => {
      if (!tracking) return;
      tracking = false;
      sheet.classList.remove("is-dragging");
      const dy = (event.clientY - startY) / zoom;
      sheet.style.transform = "";
      if (dy + project(velocity) > sheet.offsetHeight / 2) closeSheet(sheet);
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  });

  // Свою карту тоже двигает палец. Сдвинул – камера больше не держит тебя в центре: кнопки
  // над пином закрываются, „поделиться“ снова становится „где я“. Нажатие по карте закрывает кнопки
  enablePan($("#s-canvas"), sender.app, sender.camera, {
    enabled: () => !sender.stack.length,
    onMove: () => {
      const hadFocus = focusOverPin();
      sender.centered = false;
      sender.actionsOpen = false;
      syncEntry();
      if (hadFocus) $("#s-locate").focus({ preventScroll: true });
    },
    onTap: closeActions,
  });

  /** Стенд: какой вариант даёт „где я“. Карта уже держит тебя в центре – вариант виден сразу */
  function setEntry(entry) {
    sender.entry = entry in ENTRIES ? entry : "pin";
    $$("[data-entry]").forEach((option) => {
      const on = option.dataset.entry === sender.entry;
      option.setAttribute("aria-checked", String(on));
      option.tabIndex = on ? 0 : -1;
    });
    sender.actionsOpen = sender.entry !== "button" && sender.centered;
    syncEntry();
  }

  // варианты Б и В открываются по своей ссылке – и при загрузке, и если адрес сменили
  const entryFromUrl = () => Object.keys(ENTRIES).find((entry) => ENTRIES[entry] && ENTRIES[entry] === location.hash) || "pin";
  window.addEventListener("hashchange", () => setEntry(entryFromUrl()));

  $("#entry").addEventListener("click", (event) => {
    const option = event.target.closest("[data-entry]");
    if (!option) return;
    setEntry(option.dataset.entry);
    history.replaceState(null, "", ENTRIES[sender.entry] || location.pathname + location.search);
  });

  // стрелки двигают выбор внутри группы, как у нативных радиокнопок
  $("#entry").addEventListener("keydown", (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const order = Object.keys(ENTRIES);
    const next = order[(order.indexOf(sender.entry) + step + order.length) % order.length];
    $(`[data-entry="${next}"]`).click();
    $(`[data-entry="${next}"]`).focus();
  });

  /* ═══════════════════════ ДРУГ: браузер ════════════════════════════════ */

  const viewer = {
    app: $("#viewer"),
    canvas: $("#v-canvas"),
    mover: $("#v-mover"),
    camera: camera($("#viewer"), $("#v-layer")),
    endedSheet: $("#v-ended"),
    view: "idle",                  // idle | loading | map | invalid
    token: null,
    owner: null,
    ended: false,
    endReason: null,               // "stop" – остановили, "time" – время вышло
    lost: false,                   // стенд: „гео перестало приходить“
    follow: true,                  // камера едет за пином, пока карту не сдвинули рукой
    shown: null,                   // последняя точка, которую видит друг
    loadTimer: 0,
  };

  const viewerPin = () => $(".pin", viewer.mover);

  /** Пин наташки у друга. Гео перестало приходить или трансляция кончилась – „не в сети“
      и тусклый: это последняя известная точка. Гео пропало – ещё и бейдж „место примерное“ */
  function renderViewerPin({ pop = false } = {}) {
    if (!viewer.owner) return;
    const stale = viewer.lost || viewer.ended;
    const classes = [pop && "pin--pop", stale && "pin--stale"].filter(Boolean).join(" ");
    viewer.mover.innerHTML = ownPin({
      name: viewer.owner.name,
      online: !stale,
      className: classes,
      // имя над пином, заряд под ним
      extra: { title: viewer.owner.name, battery: DATA.battery, approximate: viewer.lost && !viewer.ended },
    });
    setHeading(viewerPin(), viewer.shown || positionAt(motion.dist));
  }

  function showViewerPin(pos, duration) {
    const { k } = viewer.camera.metrics();
    viewer.shown = pos;
    placeMover(viewer.mover, pos.x * k, pos.y * k, duration);
    setHeading(viewerPin(), pos);
    if (viewer.follow) viewer.camera.set(viewer.camera.target(pos, VIEW_ANCHOR), duration, duration > 900 ? "linear" : EASE);
  }

  function setViewerChrome() {
    const onMap = viewer.view === "map" || viewer.view === "loading";
    viewer.app.dataset.status = onMap ? "dark" : "light";
    viewer.app.dataset.home = viewer.view === "idle" ? "light" : "dark";   // под индикатором – светлая панель браузера
    viewer.app.classList.toggle("is-ended", viewer.ended);
  }

  /** Шапка друга – как у карты в приложении: город, время и погода там, где человек.
      Вместо шагов – сколько ещё идёт трансляция, словами. Имя и заряд – у самого пина.
      Статусов „в пути“ и „на месте“ нет: человек то идёт, то стоит, и такая строка мигала бы */
  function renderViewerHeader() {
    const m = DATA.map;
    // город и погода приходят вместе с геопозицией
    const hasGeo = Boolean(viewer.owner);
    $("#v-city").hidden = !hasGeo;
    $("#v-weather").hidden = !hasGeo;
    if (hasGeo) {
      setText($("#v-city"), m.city);
      setText($("#v-time"), m.time);
      setText($("#v-weather-icon"), m.weather);
      setText($("#v-temperature"), m.temperature);
    }

    // сколько ещё идёт трансляция; иначе – что случилось (серая точка)
    let text;
    let off = false;
    let loading = false;
    if (viewer.view === "loading") [text, loading] = ["открываем…", true];
    else if (viewer.ended) [text, off] = [viewer.endReason === "stop" ? "трансляцию остановили" : "время вышло", true];
    else if (viewer.lost) [text, off] = ["проблемы с геолокацией", true];
    else text = `трансляция закончится через ${clockLabel(server.left())}`;
    setText($("#v-left-text"), text);
    const dot = $("#v-left-dot");
    dot.hidden = loading;
    dot.classList.toggle("live-dot--off", off);
    $("#v-left").setAttribute("aria-label", off || loading ? text : `трансляция закончится через ${leftLabel()}`);
  }

  function renderViewer() {
    $("#v-idle").hidden = viewer.view !== "idle";
    $("#v-map").hidden = viewer.view !== "map" && viewer.view !== "loading";
    $("#v-invalid").hidden = viewer.view !== "invalid";
    $("#v-browser").hidden = viewer.view === "idle";      // до ссылки браузер ещё не открыт

    $("#v-banner").hidden = viewer.view !== "map";
    $("#v-actions").hidden = viewer.view !== "map";
    renderViewerHeader();
    setViewerChrome();
  }

  function resetViewer() {
    clearTimeout(viewer.loadTimer);
    Object.assign(viewer, {
      view: "idle", token: null, owner: null, ended: false, endReason: null, lost: false, follow: true, shown: null,
    });
    viewer.endedSheet.classList.remove("is-open");
    viewer.mover.innerHTML = "";
  }

  /** Друг открыл ссылку: сначала загрузка, потом снимок с сервера */
  function openLink(token) {
    resetViewer();
    viewer.token = token;
    viewer.view = "loading";
    renderViewer();
    renderStage();
    viewer.loadTimer = setTimeout(loadSnapshot, 600);
  }

  function loadSnapshot() {
    const snapshot = server.lookup(viewer.token);
    if (!snapshot) {
      viewer.view = "invalid";
      renderViewer();
      renderStage();
      return;
    }
    const owner = snapshot.owner;
    viewer.owner = owner;
    viewer.view = "map";
    $("#v-banner-photo").src = owner.cutout;
    $("#v-banner-title").textContent = `${owner.name} уже в\u00a0blink`;
    $("#v-ended-photo").src = owner.cutout;
    $("#v-ended-text").textContent = `а\u00a0в\u00a0приложении всегда видно, где ${owner.name}`;
    $("#v-recenter").setAttribute("aria-label", `показать на карте: ${owner.name}`);

    viewer.shown = positionAt(motion.dist);
    renderViewerPin({ pop: true });
    showViewerPin(viewer.shown, 0);
    renderViewer();
    renderStage();
  }

  function onViewerSessionEnd(reason) {
    if (viewer.view !== "map" || viewer.ended) return;
    viewer.ended = true;
    viewer.endReason = reason;
    viewer.endedSheet.classList.add("is-open");
    renderViewerPin();
    renderViewer();
  }

  // карту друга двигает палец; камера перестаёт ехать за пином, пока не нажмёшь „показать“
  enablePan(viewer.canvas, viewer.app, viewer.camera, {
    enabled: () => viewer.view === "map",
    onMove: () => {
      viewer.follow = false;
    },
  });

  $("#v-recenter").addEventListener("click", () => {
    viewer.follow = true;
    if (viewer.shown) viewer.camera.set(viewer.camera.target(viewer.shown, VIEW_ANCHOR), 500, EASE);
  });

  /* ═══════════════════════ общее: конец трансляции, время, движение ═════ */

  function onSessionEnd() {
    sender.afterEnd = true;
    sender.copiedUntil = 0;
    morphSheet(SHEETS.geo, renderSheets);             // в шторке геопозиции снова выбор времени
    renderLiveChip();
    onViewerSessionEnd(server.session.endedBy);
    renderStage();
  }

  /** Наташка сменила состояние (дошла, прошла минута) – все её пины рисуются заново */
  function repaintOwn() {
    motion.minutes = ownState().minutes || 0;
    renderOwnPin();
    if (viewer.view === "map") renderViewerPin();
    renderStage();
  }

  /** Наташка дошла: дальше пины показывают, сколько минут она стоит */
  function arrive() {
    if (motion.arrivedAt != null) return;
    motion.dist = route.total;
    motion.arrivedAt = clock.now();
    repaintOwn();
  }

  function tick() {
    const s = server.session;
    if (s && !s.endedBy && clock.now() >= s.expiresAt) {
      s.endedBy = "time";
      onSessionEnd();
    }
    renderLiveChip();
    renderGeoCard();
    if (server.isActive()) renderHeroTimer();
    // стоит: число минут на пинах растёт – перерисовываем, когда оно сменилось
    if (motion.arrivedAt != null && ownState().minutes !== motion.minutes) repaintOwn();
    if (viewer.view === "map" || viewer.view === "loading") renderViewerHeader();
  }

  function stepMotion() {
    if (motion.arrivedAt != null) return;
    motion.dist = Math.min(route.total, motion.dist + STEP_PT);
    const pos = positionAt(motion.dist);
    placeOwnPin(pos, STEP_MS);
    setHeading(ownMapPin(), pos);
    if (!pos.moving) setTimeout(arrive, STEP_MS);   // дошла: пин меняет состояние, когда долетит до точки
    // друг видит новую точку, только пока трансляция идёт и связь есть
    if (viewer.view === "map" && !viewer.ended && !viewer.lost) showViewerPin(pos, STEP_MS);
  }

  /* ═══════════════════════ стенд ════════════════════════════════════════ */

  function renderStage() {
    const box = $("#stage-link");
    const s = server.session;
    let state = "none";
    let status = "ссылки пока нет";
    let url = "нажми на свой пин или „где я“ на своей карте";
    if (s && !s.endedBy) {
      const open = viewer.token === s.token && viewer.view !== "idle" && viewer.view !== "invalid";
      state = open ? "open" : "ready";
      status = open ? "друг смотрит по ссылке" : sender.copiedOnce ? "ссылка скопирована" : "ссылка готова";
      url = displayUrl(s.url);
    } else if (s) {
      state = "ended";
      status = "ссылка больше не работает";
      url = displayUrl(s.url);
    }
    box.dataset.state = state;
    $("#stage-link-status").textContent = status;
    $("#stage-link-url").textContent = url;
    $("#stage-send").hidden = state !== "ready";

    const active = server.isActive();
    $$("[data-demo='minute'], [data-demo='expire']").forEach((b) => {
      b.disabled = !active;
    });
    $("[data-demo='lost']").disabled = viewer.view !== "map" || viewer.ended;
    $("[data-demo='arrive']").disabled = motion.arrivedAt != null;
    $("[data-demo='fail']").setAttribute("aria-pressed", String(server.failing));
    $("[data-demo='lost']").setAttribute("aria-pressed", String(viewer.lost));
  }

  $("#stage-send").addEventListener("click", () => {
    if (server.isActive()) openLink(server.session.token);
  });

  function resetAll() {
    clearTimeout(sender.copyTimer);
    clearTimeout(sender.profileTimer);
    server.session = null;
    server.failing = false;
    clock.skew = 0;
    Object.assign(motion, { dist: 0, arrivedAt: null, minutes: 0 });
    Object.assign(sender, {
      selected: DATA.durations[0],
      pending: false,
      failed: false,
      afterEnd: false,
      copiedUntil: 0,
      copiedOnce: false,
      profileCopiedUntil: 0,
      centered: false,
      actionsOpen: false,
    });
    while (sender.stack.length) closeSheet(topSheet(), { restoreFocus: false });
    resetViewer();
    renderOwnPin();
    // камера – как на обычной карте: посередине подложки
    const { w, h, layerW, layerH } = sender.camera.metrics();
    sender.camera.inset = 0;
    sender.camera.set({ x: (w - layerW) / 2, y: (h - layerH) / 2 }, 0);
    placeOwnPin(positionAt(0), 0);
    renderSheets();
    renderLiveChip();
    syncSenderChrome();
    renderViewer();
    renderStage();
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-demo]");
    if (!button || button.disabled) return;
    switch (button.dataset.demo) {
      case "minute":
        // 59 сек, а не 60: сразу видно, что пошла последняя минута
        clock.skew += server.session.expiresAt - clock.now() - 59000;
        tick();
        break;
      case "expire":
        clock.skew += server.session.expiresAt - clock.now();
        tick();
        break;
      case "arrive": {
        const end = positionAt(route.total);
        placeOwnPin(end, 600);
        if (viewer.view === "map" && !viewer.ended && !viewer.lost) showViewerPin(end, 600);
        arrive();
        break;
      }
      case "fail":
        server.failing = !server.failing;
        break;
      case "lost":
        viewer.lost = !viewer.lost;
        if (viewer.view === "map" && !viewer.ended) {
          renderViewerPin();
          // гео снова приходит – пин догоняет настоящую точку
          if (!viewer.lost) showViewerPin(positionAt(motion.dist), 600);
        }
        renderViewer();
        break;
      case "old":
        openLink(EXPIRED_TOKEN);
        break;
      case "reset":
        resetAll();
        break;
      default:
        break;
    }
    renderStage();
  });

  // Esc закрывает верхнюю шторку – как шаг назад; шторок нет – кнопки над пином
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (sender.stack.length) closeSheet();
    else closeActions();
  });

  /* стенд целиком помещается в окно; на телефоне телефоны идут друг под другом */
  function fitStage() {
    const phones = $("#stage-phones");
    if (window.matchMedia("(max-width: 480px)").matches) {
      phones.style.removeProperty("--stage-zoom");
    } else {
      // высота: шапка стенда, зазор, подпись над телефоном и сам телефон; ширина: два телефона и колонка между ними
      const head = $(".stage__head").offsetHeight;
      const availH = window.innerHeight - head - 16 - 20 * 2;
      const availW = window.innerWidth - 24 * 2;
      const zoom = Math.max(0.5, Math.min(1, availH / (844 + 30), availW / (390 * 2 + 200 + 24 * 2)));
      phones.style.setProperty("--stage-zoom", zoom.toFixed(3));
    }
    // ширина телефона могла смениться – слой карты тоже
    if (topSheet()) sender.camera.inset = topSheet().offsetHeight;
    sender.camera.set(sender.camera.clamp(sender.camera.pos.x, sender.camera.pos.y), 0);
    placeOwnPin(positionAt(motion.dist), 0);
    if (viewer.shown && viewer.view === "map") {
      showViewerPin(viewer.shown, 0);
      if (!viewer.follow) viewer.camera.set(viewer.camera.clamp(viewer.camera.pos.x, viewer.camera.pos.y), 0);
    }
  }
  window.addEventListener("resize", fitStage);

  /* ── старт ───────────────────────────────────────────────────────────── */

  renderSenderMap();
  setEntry(entryFromUrl());
  resetAll();
  fitStage();
  if (document.fonts) document.fonts.ready.then(fitStage);   // высота шапки стенда меняется после шрифтов
  setInterval(tick, 1000);
  setInterval(stepMotion, STEP_MS);
})();
