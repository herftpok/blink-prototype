/*
 * Blink – новогодние подарки.
 *
 * В маркете вкладка „новый год“: подарить другу один предмет или собрать мешок, выбрать,
 * как быстро пойдёт эльф, отправить анонимно – и заплатить монетами. На карте стоит 3D-пункт
 * отправки (three.js), от него к дому получателя идёт 3D-эльф с мешком. Нажатие на эльфа –
 * шторка про этот подарок: даритель видит всё, получатель – сколько ждать и от кого (или
 * „аноним“, без содержимого), друзья получателя – от кого и кому, и кнопку подарить самим.
 * Получателю приходит пуш: камера летит к эльфу и держит его. Встряхнул телефон – снег по
 * диагонали, эльф бежит быстрее (раз в день). Дошёл – пуши обоим, у получателя шторка
 * с подарком.
 *
 * Стенд: слева наташка (дарит), справа лёва (получает) или соня (подруга лёвы), между ними
 * пульт. Всё вне телефонов – стенд. Время на стенде идёт быстрее: по умолчанию сутки за 3 минуты.
 */
import { createMapScene, createHeroScene, renderProps } from "./ny-scene.js";
import { STATES } from "./states.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const NBSP = String.fromCharCode(160);

const ASSETS = "../../assets";
const MAP_ZOOM = 1.35;                 // подложка крупнее экрана: камере есть куда ехать
const CAMERA_EASE = 6;                 // как быстро камера догоняет цель (1/с)
const PAN_SLOP = 4;                    // палец сдвинулся меньше – это нажатие
const PUSH_MS = 6000;                  // сколько висит пуш
const CELEBRATE_MS = 3200;             // сколько эльф радуется у двери, прежде чем исчезнуть
const BOOST = 2;                       // во сколько раз быстрее эльф после тряски

/* ── люди, карта, маршруты ───────────────────────────────────────────── */

// n – номер в паке avatars/: live-N (пин), cutout-N (вырезка), photo-N (фото)
const PEOPLE = {
  natashka: { name: "наташка", n: 1, nick: "natashka", dat: "наташке", gen: "наташки", status: "в сети", online: true,
    home: { x: 262, y: 482 }, state: "home", minutes: 8 },
  vasya: { name: "вася", n: 2, nick: "vasyan", dat: "васе", gen: "васи", status: "36 мин назад",
    home: { x: 300, y: 236 }, state: "home", minutes: 50 },
  leva: { name: "лёва", n: 3, nick: "lev.a", dat: "лёве", gen: "лёвы", status: "в сети", online: true,
    home: { x: 300, y: 606 }, state: "home", minutes: 22 },
  sonya: { name: "соня", n: 4, nick: "sonyaaa", dat: "соне", gen: "сони", status: "2 часа назад",
    home: { x: 62, y: 562 }, state: "home", minutes: 35 },
  masha: { name: "маша", n: 5, nick: "mashuly", dat: "маше", gen: "маши", status: "1 день назад",
    home: { x: 82, y: 700 }, state: "home", minutes: 71 },
};
const live = (id) => `${ASSETS}/people/live-${PEOPLE[id].n}.webp`;
const photo = (id) => `${ASSETS}/people/photo-${PEOPLE[id].n}.webp`;
const cutoutOf = (id) => `${ASSETS}/people/cutout-${PEOPLE[id].n}.webp`;
const positionOf = (id) => PEOPLE[id].at || PEOPLE[id].home;

// пункт отправки – на площади под каналом; дверь – откуда выходят эльфы
const DISPATCH = { x: 176, y: 422 };
// маршруты по улицам (pt подложки 390×844): от двери пункта к двери дома. Эльф встаёт сбоку
// от пина хозяина, а не под ним – видно, что он пришёл
const ROUTES = {
  leva: [[176, 440], [210, 442], [210, 600], [272, 600]],
  sonya: [[176, 440], [110, 442], [110, 560], [92, 560]],
  vasya: [[176, 440], [210, 442], [210, 250], [300, 250], [300, 254]],
  masha: [[176, 440], [160, 442], [160, 690], [112, 690]],
  natashka: [[176, 440], [210, 442], [210, 482], [234, 482]],
};

// как быстро идёт эльф: примерно столько он идёт до дома при любой длине маршрута
const SPEEDS = {
  slow: { label: "3 дня", minutes: 3 * 24 * 60 },
  normal: { label: "1 день", minutes: 24 * 60 },
  fast: { label: "12 часов", minutes: 12 * 60 },
};
// эльф появляется сбоку от пункта отправки, а не в его двери: нажатие на него – шторка
// подарка, а не пункта
const START_GAP = 34;

const market = window.BlinkMarket;
// дарить можно всё, что продаётся: без „скоро“ и без бесплатного
const GIFTABLE = [...market.catalog.tails, ...market.catalog.stickers].filter((item) => item.price && !item.soon);
const itemById = (id) => market.byId(id);

/* ── форматирование ──────────────────────────────────────────────────── */

const plural = (n, [one, few, many]) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

/** сколько ещё идти – примерно и словами: „2 дня“, „20 часов“, „40 минут“; для „через …“ */
function leftWords(ms) {
  const min = Math.ceil(ms / 60000);
  if (min <= 1) return "минуту";
  if (min < 60) return `${min}${NBSP}${plural(min, ["минуту", "минуты", "минут"])}`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}${NBSP}${plural(h, ["час", "часа", "часов"])}`;
  const days = Math.round(h / 24);
  return `${days}${NBSP}${plural(days, ["день", "дня", "дней"])}`;
}

const giftCount = (n) => `${n}${NBSP}${plural(n, ["подарок", "подарка", "подарков"])}`;
const sumOf = (items) => items.reduce((sum, id) => sum + (itemById(id).price || 0), 0);

/* ── время стенда и „сервер“ ─────────────────────────────────────────── */

// t – время стенда в мс; scale – во сколько раз быстрее жизни. По умолчанию сутки за 3 минуты: эльф „за 1 день“
// идёт 3 минуты, и после тряски его бег видно дольше минуты
const sim = { scale: 480, t: 0, pushMs: PUSH_MS };     // pushMs – сколько висит пуш (снимкам состояний нужно дольше)

const bus = {
  handlers: {},
  on(name, fn) {
    (this.handlers[name] = this.handlers[name] || []).push(fn);
  },
  emit(name, payload) {
    (this.handlers[name] || []).forEach((fn) => fn(payload));
  },
};

function measure(route) {
  const segments = [];
  let total = 0;
  for (let i = 1; i < route.length; i += 1) {
    const [ax, ay] = route[i - 1];
    const [bx, by] = route[i];
    const length = Math.hypot(bx - ax, by - ay);
    segments.push({ ax, ay, bx, by, length, start: total });
    total += length;
  }
  return { segments, total };
}

const server = {
  gifts: [],
  seq: 0,
  day: 1,                              // „день“ для ограничения тряски: раз в день
  shakes: {},                          // кто трясёт → в какой день уже тряс

  send({ from, to, items, anonymous = false, comment = "", speed = "normal" }) {
    this.seq += 1;
    const path = measure(ROUTES[to]);
    const gift = {
      id: this.seq,
      from,
      to,
      items: [...items],
      anonymous,
      comment: comment.trim(),
      speed,
      path,
      walked: Math.min(START_GAP, path.total / 4),
      boost: false,
      status: "walking",
      sentAt: sim.t,
      variant: (this.seq - 1) % 4,
      doneAt: 0,                       // реальное время прихода – эльф ещё радуется у двери
    };
    this.gifts.push(gift);
    bus.emit("sent", gift);
    return gift;
  },

  /** скорость в pt за мс стенда */
  speedOf(gift) {
    return (gift.path.total / (SPEEDS[gift.speed].minutes * 60000)) * (gift.boost ? BOOST : 1);
  },

  left(gift) {
    return gift.status === "walking" ? (gift.path.total - gift.walked) / this.speedOf(gift) : 0;
  },

  update(dtSim) {
    for (const gift of this.gifts) {
      if (gift.status !== "walking") continue;
      gift.walked = Math.min(gift.path.total, gift.walked + this.speedOf(gift) * dtSim);
      if (gift.walked >= gift.path.total) {
        gift.status = "delivered";
        gift.doneAt = performance.now();
        bus.emit("delivered", gift);
      }
    }
  },

  byId(id) {
    return this.gifts.find((gift) => gift.id === id);
  },

  reset() {
    this.gifts = [];
    this.seq = 0;
    this.day = 1;
    this.shakes = {};
  },
};

/** где эльф на маршруте: точка, куда смотрит, идёт ли */
function elfAt(gift) {
  const { segments, total } = gift.path;
  const d = Math.min(gift.walked, total);
  const seg = segments.find((s) => d <= s.start + s.length) || segments[segments.length - 1];
  const t = seg.length ? (d - seg.start) / seg.length : 1;
  return {
    x: seg.ax + (seg.bx - seg.ax) * t,
    y: seg.ay + (seg.by - seg.ay) * t,
    heading: Math.atan2(seg.by - seg.ay, seg.bx - seg.ax),
  };
}

/* ═══════════════════════ телефон ═══════════════════════════════════════ */

const props = { gift: "", sack: "", elf: "", elfWalk: [], elfRun: [] };     // 3D-картинки для шторок (renderProps)

function phoneMarkup() {
  const tool = (icon, label) =>
    `<button class="icon-button icon-button--map pressable" type="button" aria-label="${label}"><i class="icon icon--${icon}" aria-hidden="true"></i></button>`;
  return `
    <div class="app ny-phone" data-status="dark" data-home="dark">
      <div class="status-bar" aria-hidden="true">
        <img class="status-bar__time" src="${ASSETS}/system/status-time.png" alt="">
        <img class="status-bar__island" src="${ASSETS}/system/live-activity.png" alt="">
        <img class="status-bar__icons" src="${ASSETS}/system/status-icons.png" alt="">
      </div>

      <section class="screen map ny-map" data-screen="map" aria-label="карта">
        <div class="map__canvas ny-map__canvas" data-canvas>
          <div class="ny-map__layer" data-layer>
            <img class="ny-map__tiles" src="${ASSETS}/map/map-hd.webp" alt="">
            <svg class="ny-route" data-route aria-hidden="true">
              <path class="ny-route__path ny-route__path--done" data-route-done d=""></path>
              <path class="ny-route__path" data-route-left d=""></path>
            </svg>
            <div class="ny-map__pins" data-pins></div>
          </div>
          <canvas class="ny-map__3d" data-3d aria-hidden="true"></canvas>
        </div>

        <header class="map__header">
          <h1 class="map__city">москва</h1>
          <p class="map__weather">
            <time>22:40</time>
            <span class="map__weather-temp"><span aria-hidden="true">❄️</span><span>−3${NBSP}°C</span></span>
          </p>
          <button class="map-chip map__steps pressable" type="button">
            <i class="icon icon--steps" aria-hidden="true"></i><span data-steps></span>
          </button>
        </header>

        <div class="map__tools">${tool("places", "места")}${tool("space", "пространства")}${tool("games", "игры")}</div>

        <div class="map__actions">
          <button class="map-button map-button--world pressable" type="button">
            <i class="icon icon--globe" aria-hidden="true"></i>мой мир
          </button>
          <button class="map-button map-button--locate pressable" type="button" data-locate aria-label="показать, где я">
            <i class="icon icon--crosshair" aria-hidden="true"></i>
          </button>
        </div>
      </section>

      <section class="screen market" data-screen="market" aria-label="маркет" hidden></section>

      <!-- мешок висит над таб-баром, пока в нём есть подарки -->
      <div class="ny-sack" data-sack aria-live="polite">
        <span class="fan" data-sack-fan aria-hidden="true"></span>
        <span class="ny-sack__body">
          <span class="ny-sack__title">мешок подарков</span>
          <span class="ny-sack__sum"><span data-sack-count></span> · <img class="ny-sack__coin" src="${ASSETS}/market/coin.png" alt=""><span data-sack-sum></span></span>
        </span>
        <button class="button button--primary ny-sack__button pressable" type="button" data-sack-gift>подарить</button>
      </div>

      <nav class="tabbar" aria-label="разделы">
        <button class="tabbar__item pressable" type="button" data-tab="map"><i class="icon icon--pin" aria-hidden="true"></i>карта</button>
        <button class="tabbar__item pressable" type="button"><i class="icon icon--friends" aria-hidden="true"></i>друзья</button>
        <button class="tabbar__item pressable" type="button"><i class="icon icon--chat" aria-hidden="true"></i>чаты</button>
        <button class="tabbar__item pressable" type="button" data-tab="market"><i class="icon icon--market" aria-hidden="true"></i>маркет</button>
        <button class="tabbar__item pressable" type="button"><img class="tabbar__avatar" data-tab-avatar src="" alt="">ты</button>
      </nav>

      <!-- карта: шторка эльфа, пункта отправки, пришедшего подарка. Подложка прозрачная –
           эльф виден над шторкой -->
      <div class="scrim scrim--clear" data-map-scrim></div>
      <div class="sheet ny-map-sheet" data-map-sheet role="dialog" aria-modal="true" aria-labelledby="" tabindex="-1">
        <div class="sheet__handle" data-drag><div class="sheet__grabber" aria-hidden="true"></div></div>
        <div data-map-body></div>
      </div>

      <!-- флоу подарка: кому → подарить → отправлен -->
      <div class="ny-backdrop" data-backdrop></div>
      <div class="sheet ny-sheet" data-recipients role="dialog" aria-modal="true" tabindex="-1"></div>
      <section class="ny-confirm" data-confirm role="dialog" aria-modal="true" tabindex="-1"></section>
      <div class="sheet ny-sent" data-sent role="dialog" aria-modal="true" tabindex="-1"></div>

      <!-- пуш – нативный баннер iOS: вёрстка и цвета системные, от Blink – иконка, заголовок и текст -->
      <button class="ny-push" data-push type="button" aria-live="polite" tabindex="-1">
        <img class="ny-push__icon" src="${ASSETS}/system/app-icon.png" alt="">
        <span class="ny-push__body">
          <span class="ny-push__head"><span class="ny-push__title" data-push-title></span><span class="ny-push__time">сейчас</span></span>
          <span class="ny-push__text" data-push-text></span>
        </span>
      </button>
      <canvas class="ny-globe" data-globe aria-hidden="true"></canvas>
      <p class="visually-hidden" data-announce aria-live="polite"></p>
      <div class="home-indicator" aria-hidden="true"></div>
    </div>`;
}

class Phone {
  constructor(mount, persona) {
    this.mount = mount;
    this.build(persona);
  }

  get me() {
    return PEOPLE[this.persona];
  }

  /** роль зрителя в подарке: дарит, получает или дружит с получателем */
  roleIn(gift) {
    if (gift.from === this.persona) return "sender";
    if (gift.to === this.persona) return "recipient";
    return "friend";
  }

  build(persona) {
    this.destroy();
    this.persona = persona;
    this.mount.innerHTML = phoneMarkup();
    this.root = this.mount.firstElementChild;
    const q = (selector) => $(selector, this.root);
    this.el = {
      map: q("[data-screen='map']"),
      market: q("[data-screen='market']"),
      canvas: q("[data-canvas]"),
      layer: q("[data-layer]"),
      pins: q("[data-pins]"),
      routeDone: q("[data-route-done]"),
      routeLeft: q("[data-route-left]"),
      gl: q("[data-3d]"),
      sack: q("[data-sack]"),
      mapScrim: q("[data-map-scrim]"),
      mapSheet: q("[data-map-sheet]"),
      mapBody: q("[data-map-body]"),
      backdrop: q("[data-backdrop]"),
      recipients: q("[data-recipients]"),
      confirm: q("[data-confirm]"),
      sent: q("[data-sent]"),
      push: q("[data-push]"),
      globe: q("[data-globe]"),
      announce: q("[data-announce]"),
    };
    q("[data-tab-avatar]").src = photo(persona);
    q("[data-steps]").textContent = `${345 + this.me.n * 211} шагов · ${this.me.n + 2} место`;

    this.tab = null;
    this.cam = { x: 0, y: 0, tx: 0, ty: 0, inset: 0 };
    this.follow = null;                 // id подарка, за чьим эльфом едет камера
    this.sheet = null;                  // { kind, giftId }
    this.sack = [];
    this.draft = null;                  // подарок, который сейчас оформляется
    this.pushTimer = 0;
    this.pushAction = null;
    this.lastSheetPaint = 0;
    this.scene = null;
    this.hero = null;

    this.renderPins();
    this.mountMarket();
    this.bindMap();
    this.bindSheets();
    this.globe = window.BlinkSky ? window.BlinkSky.start(this.el.globe, { mode: "none", shade: true }) : null;
    this.showTab(persona === "natashka" ? "market" : "map");
    this.centerOn(persona === "natashka" ? DISPATCH : positionOf(persona), { x: 0.5, y: 0.46 }, true);
  }

  destroy() {
    if (this.scene) this.scene.dispose();
    if (this.hero) this.hero.dispose();
    if (this.globe) this.globe.stop();
    clearTimeout(this.pushTimer);
    this.scene = null;
    this.hero = null;
  }

  /* ── табы ── */

  showTab(tab) {
    this.tab = tab;
    this.el.map.hidden = tab !== "map";
    this.el.market.hidden = tab !== "market";
    this.root.dataset.status = tab === "map" ? "dark" : "light";
    this.root.dataset.home = tab === "map" ? "dark" : "light";
    $$(".tabbar__item[data-tab]", this.root).forEach((item) => {
      if (item.dataset.tab === tab) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    this.renderSack();
    if (tab === "map") this.ensureScene();
  }

  /* ── карта: камера ── */

  metrics() {
    const w = this.root.clientWidth || 390;
    const h = this.root.clientHeight || 844;
    const layerW = w * MAP_ZOOM;
    return { w, h, k: layerW / 390, layerW, layerH: (layerW * 844) / 390 };
  }

  clamp(x, y) {
    const { w, h, layerW, layerH } = this.metrics();
    return {
      x: Math.min(0, Math.max(w - layerW, x)),
      y: Math.min(0, Math.max(h - this.cam.inset - layerH, y)),
    };
  }

  /** камера, при которой точка карты стоит в anchor (доли экрана) */
  target(point, anchor) {
    const { w, h, k } = this.metrics();
    return this.clamp(w * anchor.x - point.x * k, h * anchor.y - point.y * k);
  }

  centerOn(point, anchor, instant = false) {
    const t = this.target(point, anchor);
    this.cam.tx = t.x;
    this.cam.ty = t.y;
    if (instant) {
      this.cam.x = t.x;
      this.cam.y = t.y;
    }
  }

  /** где держать эльфа, пока открыта шторка: над её краем, но не под шапкой карты */
  followAnchor() {
    const { h } = this.metrics();
    const sheetTop = this.sheet ? h - this.el.mapSheet.offsetHeight : h;
    return { x: 0.5, y: Math.max(0.3, Math.min(0.46, (sheetTop - 70) / h)) };
  }

  renderPins() {
    const { k } = this.metrics();
    this.el.layer.style.setProperty("--k", k.toFixed(4));
    this.el.pins.innerHTML = Object.keys(PEOPLE)
      .map((id) => {
        const p = PEOPLE[id];
        const at = positionOf(id);
        const own = id === this.persona;
        return window.BlinkPin.markup({
          name: own ? "ты" : p.name,
          photo: live(id),
          size: own || p.online ? 52 : 36,
          online: own || p.online,
          state: p.state,
          minutes: p.minutes,
          className: "pressable",
          attrs: `style="--x:${at.x};--y:${at.y}" data-person="${id}"`,
          assets: ASSETS,
        });
      })
      .join("");
  }

  ensureScene() {
    if (this.scene) return;
    try {
      this.scene = createMapScene(this.el.gl, { dispatch: DISPATCH });
    } catch (error) {
      this.scene = null;                // нет WebGL – карта без 3D, остальное работает
    }
  }

  bindMap() {
    const canvas = this.el.canvas;
    let start = null;
    let moved = false;
    let suppress = false;

    canvas.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || this.sheet) return;
      start = { x: event.clientX, y: event.clientY, cx: this.cam.x, cy: this.cam.y, zoom: this.zoom() };
      moved = false;
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!start) return;
      const dx = (event.clientX - start.x) / start.zoom;
      const dy = (event.clientY - start.y) / start.zoom;
      if (!moved) {
        if (Math.hypot(dx, dy) < PAN_SLOP) return;
        moved = true;
        this.follow = null;
        canvas.setPointerCapture(event.pointerId);
        canvas.classList.add("is-dragging");
      }
      const c = this.clamp(start.cx + dx, start.cy + dy);
      this.cam.x = this.cam.tx = c.x;
      this.cam.y = this.cam.ty = c.y;
    });
    const finish = (event) => {
      if (!start) return;
      if (!moved && event.type === "pointerup" && this.scene) {
        const hit = this.scene.pick(event.clientX, event.clientY);
        if (hit) {
          suppress = true;              // нажали на эльфа или пункт – пин под ними не срабатывает
          if (hit.type === "elf") this.openElf(hit.id);
          else this.openDispatch();
        }
      }
      start = null;
      canvas.classList.remove("is-dragging");
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
    canvas.addEventListener("click", (event) => {
      if (!suppress) return;
      suppress = false;
      event.stopPropagation();
      event.preventDefault();
    }, true);

    $("[data-locate]", this.root).addEventListener("click", () => {
      this.follow = null;
      this.centerOn(positionOf(this.persona), { x: 0.5, y: 0.5 });
    });
    $$(".tabbar__item[data-tab]", this.root).forEach((item) =>
      item.addEventListener("click", () => this.showTab(item.dataset.tab))
    );
    this.el.push.addEventListener("click", () => {
      const action = this.pushAction;
      this.hidePush();
      if (action) action();
    });
  }

  /** во сколько раз стенд уменьшил телефон – по контейнеру: сам телефон качают при тряске */
  zoom() {
    return this.mount.getBoundingClientRect().width / (this.mount.offsetWidth || 1) || 1;
  }

  /* ── маркет и новогодняя вкладка ── */

  mountMarket() {
    this.market = market.mount(this.el.market, {
      assets: ASSETS,
      coins: 55000,
      sky: "snow",
      initialTab: "ny",
      extraTabs: [{ id: "ny", title: "новый год", render: (panel) => this.renderNY(panel) }],
      onItem: (item, button) => {
        if (!button.closest("[data-panel='ny']") || !item || item.soon) return;
        this.startGift([item.id]);
      },
    });
    this.market.onTab((tab) => {
      if (this.market.sky) this.market.sky.set(tab === "ny" ? "snow" : "stars");
      this.renderSack();
    });
    $("[data-sack-gift]", this.root).addEventListener("click", () => this.startGift(this.sack, { sack: true }));
  }

  renderNY(panel) {
    panel.innerHTML = `
      <div class="ny-hero">
        <div class="ny-hero__stage"><canvas data-hero aria-hidden="true"></canvas></div>
        <h2 class="ny-hero__title">новогодняя почта</h2>
        <p class="ny-hero__text">эльф донесёт подарок до&nbsp;дома друга – вы оба увидите его на&nbsp;карте</p>
      </div>
      <div class="market-grid ny-grid">
        ${GIFTABLE.map(
          (item) => `
            <div class="ny-item">
              ${market.itemMarkup(item, ASSETS, { placed: false })}
              <button class="ny-add pressable" type="button" data-add="${item.id}" aria-pressed="false"
                      aria-label="в мешок: ${escapeHtml(item.name)}"><i class="icon icon--plus" aria-hidden="true"></i></button>
            </div>`
        ).join("")}
      </div>`;
    panel.addEventListener("click", (event) => {
      const add = event.target.closest("[data-add]");
      if (!add) return;
      event.stopPropagation();
      const id = add.dataset.add;
      this.sack = this.sack.includes(id) ? this.sack.filter((x) => x !== id) : [...this.sack, id];
      this.renderSack();
    });
    this.heroCanvas = $("[data-hero]", panel);
  }

  renderSack() {
    $$("[data-add]", this.root).forEach((button) => {
      const on = this.sack.includes(button.dataset.add);
      button.setAttribute("aria-pressed", String(on));
      button.querySelector(".icon").className = `icon icon--${on ? "check" : "plus"}`;
    });
    const shown = this.tab === "market" && this.market && $("[data-panel='ny']", this.root) &&
      !$("[data-panel='ny']", this.root).hidden && this.sack.length > 0;
    this.el.sack.classList.toggle("is-shown", Boolean(shown));
    if (!this.sack.length) return;
    $("[data-sack-fan]", this.root).innerHTML = fan(this.sack.slice(0, 3));
    $("[data-sack-count]", this.root).textContent = giftCount(this.sack.length);
    $("[data-sack-sum]", this.root).textContent = market.formatCoins(sumOf(this.sack));
  }

  /* ── флоу подарка ── */

  startGift(items, { sack = false } = {}) {
    if (!items.length) return;
    this.draft = { items: [...items], sack: sack || items.length > 1, to: null, anonymous: panelState.anonymous, comment: "", speed: panelState.speed };
    this.openRecipients();
  }

  friendsOf() {
    return Object.keys(PEOPLE).filter((id) => id !== this.persona);
  }

  openRecipients() {
    const row = (id) => {
      const p = PEOPLE[id];
      return `
        <li><button class="recipient pressable" type="button" data-to="${id}">
          <img class="recipient__photo" src="${photo(id)}" alt="">
          <span class="recipient__body">
            <span class="recipient__name">${escapeHtml(p.name)}</span>
            <span class="recipient__status${p.online ? " recipient__status--online" : ""}">${escapeHtml(p.status)}</span>
          </span>
        </button></li>`;
    };
    const friends = this.friendsOf();
    const best = friends.slice(0, 4);
    this.el.recipients.innerHTML = `
      <div class="sheet__handle">
        <div class="sheet__grabber" aria-hidden="true"></div>
        <h2 class="recipients__title" id="${this.id("to-title")}">кому подаришь?</h2>
      </div>
      <div class="recipients__scroll">
        <p class="recipients__label recipients__label--best caps-label"><span class="recipients__label-text">лучшие друзья</span><span class="recipients__label-count">${best.length}</span></p>
        <ul class="recipients__list" role="list">${best.map(row).join("")}</ul>
        <p class="recipients__label caps-label"><span class="recipients__label-text">все друзья</span><span class="recipients__label-count">${friends.length}</span></p>
        <ul class="recipients__list" role="list" data-all>${friends.map(row).join("")}</ul>
      </div>
      <div class="recipients__footer">
        <label class="search-field">
          <i class="icon icon--search" aria-hidden="true"></i>
          <span class="visually-hidden">поиск друга</span>
          <input class="search-field__input" type="search" placeholder="имя или ник" data-search
                 autocomplete="off" autocapitalize="none" autocorrect="off" enterkeyhint="search">
        </label>
      </div>`;
    this.el.recipients.setAttribute("aria-labelledby", this.id("to-title"));
    dragToClose(this, this.el.recipients, $(".sheet__handle", this.el.recipients), () => this.closeFlow());
    $("[data-search]", this.el.recipients).addEventListener("input", (event) => {
      const query = event.target.value.trim().toLowerCase();
      $$("[data-to]", this.el.recipients).forEach((button) => {
        const p = PEOPLE[button.dataset.to];
        button.parentElement.hidden = Boolean(query) && !p.name.includes(query) && !p.nick.includes(query);
      });
    });
    this.el.recipients.onclick = (event) => {
      const to = event.target.closest("[data-to]");
      if (!to) return;
      this.draft.to = to.dataset.to;
      this.openConfirm();
    };
    this.el.backdrop.classList.add("is-open");
    this.el.recipients.classList.add("is-open");
    this.el.recipients.focus({ preventScroll: true });
  }

  /** уникальный id внутри телефона: у двух телефонов одинаковая разметка */
  id(name) {
    return `${this.mount.id}-${name}`;
  }

  giftArt(items, sack) {
    if (sack) {
      return `<img class="gift-card__art" src="${props.sack || itemById(items[0]).art}" alt="">`;
    }
    return `<img class="gift-card__art" src="${ASSETS}/${itemById(items[0]).art}" alt="">`;
  }

  openConfirm() {
    const d = this.draft;
    const p = PEOPLE[d.to];
    const single = d.items.length === 1 ? itemById(d.items[0]) : null;
    const title = single ? single.name : "мешок подарков";
    const kind = single ? single.kind : giftCount(d.items.length);
    const stock = single && single.stock
      ? `<div class="stock">
           <div class="stock__bar"><div class="stock__fill" style="--share:${single.stock.left / single.stock.total}"></div></div>
           <p class="stock__meta"><span>осталось на&nbsp;складе</span>
             <span class="stock__count">${single.stock.left}<span class="stock__total">/${single.stock.total}</span></span></p>
         </div>`
      : "";
    const speedTiles = Object.entries(SPEEDS)
      .map(
        ([id, s]) => `
          <button class="choice-tile pressable" type="button" role="radio" data-speed="${id}" aria-checked="${id === d.speed}"
                  tabindex="${id === d.speed ? 0 : -1}" aria-label="примерно ${s.label}">
            <span class="choice-tile__value" aria-hidden="true">${s.label.replace(" ", NBSP)}</span>
          </button>`
      )
      .join("");
    this.el.confirm.innerHTML = `
      <img class="ny-confirm__glow" src="${ASSETS}/market/glow-top.webp" alt="">
      <div class="ny-confirm__scroll">
        <header class="ny-confirm__head">
          <img class="ny-confirm__photo" src="${photo(d.to)}" alt="">
          <span class="ny-confirm__who">
            <span class="ny-confirm__name ellipsis">${escapeHtml(p.name)}</span>
            <span class="ny-confirm__role">получатель</span>
          </span>
          <button class="icon-button icon-button--header pressable" type="button" data-confirm-close aria-label="закрыть">
            <i class="icon icon--close" aria-hidden="true"></i>
          </button>
        </header>
        <div class="gift-card">
          ${d.sack ? `<span class="fan" aria-hidden="true">${fan(d.items.slice(0, 3))}</span>` : this.giftArt(d.items, false)}
          <h2 class="gift-card__title" id="${this.id("gift-title")}">${escapeHtml(title)}</h2>
          <p class="gift-card__kind">${escapeHtml(kind)}</p>
        </div>
        ${stock}
        <label class="gift-comment">
          <span class="gift-comment__label">коммент к&nbsp;подарку</span>
          <textarea class="gift-comment__input" rows="2" maxlength="120" placeholder="с наступающим!" data-comment></textarea>
        </label>
        <div class="gift-option">
          <span id="${this.id("anon")}">отправить анонимно</span>
          <button class="switch pressable" type="button" role="switch" aria-checked="${d.anonymous}" aria-labelledby="${this.id("anon")}" data-anon></button>
        </div>
        <div class="gift-speed">
          <p class="gift-speed__label" id="${this.id("speed")}">эльф дойдёт примерно за</p>
          <div class="choice-tiles" role="radiogroup" aria-labelledby="${this.id("speed")}" data-speeds>${speedTiles}</div>
        </div>
      </div>
      <div class="ny-confirm__footer">
        <button class="button button--primary gift-cta pressable" type="button" data-send>
          подарить
          <span class="gift-cta__sum"><img class="gift-cta__coin" src="${ASSETS}/market/coin.png" alt="">${market.formatCoins(sumOf(d.items))}</span>
        </button>
      </div>`;
    this.el.confirm.setAttribute("aria-labelledby", this.id("gift-title"));
    const confirm = this.el.confirm;
    $("[data-confirm-close]", confirm).addEventListener("click", () => this.closeFlow());
    $("[data-anon]", confirm).addEventListener("click", (event) => {
      d.anonymous = !d.anonymous;
      event.currentTarget.setAttribute("aria-checked", String(d.anonymous));
    });
    $("[data-comment]", confirm).addEventListener("input", (event) => {
      d.comment = event.target.value;
    });
    $("[data-speeds]", confirm).addEventListener("click", (event) => {
      const tile = event.target.closest("[data-speed]");
      if (!tile) return;
      d.speed = tile.dataset.speed;
      $$("[data-speed]", confirm).forEach((t) => {
        t.setAttribute("aria-checked", String(t === tile));
        t.tabIndex = t === tile ? 0 : -1;
      });
    });
    $("[data-send]", confirm).addEventListener("click", () => this.send());
    this.el.recipients.classList.remove("is-open");
    confirm.classList.add("is-open");
    confirm.focus({ preventScroll: true });
  }

  send() {
    const d = this.draft;
    const sum = sumOf(d.items);
    if (this.market.coins < sum) return;
    this.market.setCoins(this.market.coins - sum);
    const gift = server.send({ from: this.persona, to: d.to, items: d.items, anonymous: d.anonymous, comment: d.comment, speed: d.speed });
    if (d.sack) {
      this.sack = [];
      this.renderSack();
    }
    this.openSent(gift);
  }

  /** „подарок отправлен!“ – карточка снизу с полями по бокам и снизу, на том же градиенте, что и
      „кому подаришь?“ (чёрная на чёрном маркете сливалась бы с ним). Сверху сыплется конфетти */
  openSent(gift) {
    const p = PEOPLE[gift.to];
    const labelId = this.id("sent-title");
    this.el.sent.innerHTML = `
      <div class="ny-sent__handle" data-sent-drag>
        <h2 class="ny-sent__title" id="${labelId}">${gift.anonymous ? "подарок отправлен анонимно!" : "подарок отправлен!"}</h2>
      </div>
      ${gift.items.length > 1 ? `<span class="fan ny-sent__fan" aria-hidden="true">${fan(gift.items.slice(0, 3))}</span>`
        : `<img class="ny-sent__art" src="${ASSETS}/${itemById(gift.items[0]).art}" alt="">`}
      <p class="ny-sent__to"><img class="ny-sent__photo" src="${photo(gift.to)}" alt="">${escapeHtml(p.name)}</p>
      <button class="button button--primary ny-sent__cta pressable" type="button" data-sent-ok>круто!</button>
      <button class="button button--ghost ny-sent__second pressable" type="button" data-sent-map>где эльф?</button>`;
    this.el.sent.setAttribute("aria-labelledby", labelId);
    $("[data-sent-ok]", this.el.sent).addEventListener("click", () => this.closeFlow());
    $("[data-sent-map]", this.el.sent).addEventListener("click", () => {
      this.closeFlow();
      this.showTab("map");
      this.openElf(gift.id);
    });
    dragToClose(this, this.el.sent, $("[data-sent-drag]", this.el.sent), () => this.closeFlow());
    this.el.confirm.classList.remove("is-open");
    this.el.backdrop.classList.add("is-open");
    this.el.sent.classList.add("is-open");
    this.el.sent.focus({ preventScroll: true });
    if (this.globe) this.globe.confetti(confettiColors(this.root));
  }

  closeFlow() {
    this.el.recipients.classList.remove("is-open");
    this.el.confirm.classList.remove("is-open");
    this.el.backdrop.classList.remove("is-open");
    this.el.sent.classList.remove("is-open");
    this.draft = null;
  }

  /* ── шторки на карте ── */

  bindSheets() {
    // шторки закрываются нажатием мимо, жестом вниз за грэббер и Esc – крестиков в них нет
    this.el.mapScrim.addEventListener("click", () => this.closeSheet());
    this.el.backdrop.addEventListener("click", () => this.closeFlow());
    this.root.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (this.el.sent.classList.contains("is-open") || this.el.confirm.classList.contains("is-open") ||
          this.el.recipients.classList.contains("is-open")) this.closeFlow();
      else if (this.sheet) this.closeSheet();
    });
    dragToClose(this, this.el.mapSheet, $("[data-drag]", this.root), () => this.closeSheet());
  }

  openSheet(kind, giftId, html, labelId) {
    this.sheet = { kind, giftId };
    this.el.mapBody.innerHTML = html;
    this.el.mapSheet.setAttribute("aria-labelledby", labelId);
    this.el.mapScrim.classList.add("is-open");
    this.el.mapSheet.classList.add("is-open");
    this.cam.inset = this.el.mapSheet.offsetHeight;
    $(".screen.map", this.root).inert = true;
    this.el.mapSheet.focus({ preventScroll: true });
    this.paintSheet(true);
  }

  closeSheet() {
    if (!this.sheet) return;
    this.sheet = null;
    this.el.mapScrim.classList.remove("is-open");
    this.el.mapSheet.classList.remove("is-open");
    this.cam.inset = 0;
    $(".screen.map", this.root).inert = false;
    const c = this.clamp(this.cam.tx, this.cam.ty);
    this.cam.tx = c.x;
    this.cam.ty = c.y;
  }

  /** шторка эльфа: сверху дорожка „кто → эльф → кому“ – пины, между ними пунктир, по которому
      идёт эльф; дальше примерное время и что внутри. Даритель видит содержимое, получатель –
      „сюрприз“ и подсказку про тряску, друг получателя – кнопку подарить самому */
  openElf(giftId) {
    const gift = server.byId(giftId);
    if (!gift) return;
    if (this.tab !== "map") this.showTab("map");
    if (gift.status === "delivered" && this.roleIn(gift) === "recipient") {
      this.openArrival(gift);
      return;
    }
    this.follow = giftId;
    const role = this.roleIn(gift);
    const from = PEOPLE[gift.from];
    const to = PEOPLE[gift.to];
    const anon = gift.anonymous && role !== "sender";
    const pin = (photoSrc, className = "") =>
      window.BlinkPin.markup({ photo: photoSrc, size: 52, tag: "span", assets: ASSETS, className });
    const person = (pinMarkup, label) => `
      <span class="elf-track__person">
        <span class="elf-track__pin">${pinMarkup}</span>
        <span class="elf-track__name ellipsis">${escapeHtml(label)}</span>
      </span>`;
    // аноним – только стикер-вопрос, без кадра пина
    const sender = anon
      ? person(`<img class="elf-track__sticker" src="${ASSETS}/stickers/question.webp" alt="">`, "аноним")
      : person(pin(live(gift.from)), role === "sender" ? "ты" : from.name);
    const recipient = person(pin(live(gift.to)), role === "recipient" ? "ты" : to.name);
    const title = role === "recipient" ? "к тебе идёт эльф с&nbsp;подарком" : `эльф несёт подарок ${escapeHtml(to.dat)}`;
    // что внутри – только дарителю: каждый подарок своей плашкой, у мешка сверху – сколько их, розовым
    const inside = role === "sender"
      ? `<div class="gift-inside">
           ${gift.items.length > 1 ? `<p class="gift-inside__head"><span class="gift-inside__count">${giftCount(gift.items.length)}</span></p>` : ""}
           ${giftPlates(gift.items)}
         </div>`
      : "";
    const labelId = this.id("elf-title");
    const hint = role === "recipient"
      ? `<p class="ny-hint" data-shake-hint><i class="icon icon--bump" aria-hidden="true"></i>потряси телефон – эльф побежит быстрее</p>`
      : "";
    const cta = role === "friend"
      ? `<button class="button button--primary ny-sheet-cta pressable" type="button" data-gift-too>подарить кому-нибудь</button>`
      : "";
    this.openSheet("elf", giftId, `
      <div class="elf-track" data-track>
        ${sender}
        <span class="elf-track__way">
          <span class="elf-track__done" aria-hidden="true"></span>
          <span class="elf-track__elf" aria-hidden="true">
            <span class="elf-track__speed"></span>
            ${gaitFrames(props.elfWalk, "walk")}${gaitFrames(props.elfRun, "run")}
          </span>
          <span class="elf-track__eta" data-eta></span>
        </span>
        ${recipient}
      </div>
      <h2 class="sheet__title ny-sheet-title" id="${labelId}">${title}</h2>
      ${inside}${hint}${cta}`, labelId);
    const too = $("[data-gift-too]", this.el.mapBody);
    if (too) too.addEventListener("click", () => this.giftToo());
  }

  giftToo() {
    this.closeSheet();
    this.showTab("market");
    this.market.selectTab("ny");
  }

  /** пункт отправки: твои подарки – кому, дошёл ли и сколько ещё идти, что внутри */
  openDispatch() {
    this.follow = null;
    const mine = server.gifts.filter((gift) => gift.from === this.persona).slice().reverse();
    const labelId = this.id("post-title");
    const rows = mine
      .map(
        (gift) => `
          <li><button class="dispatch-row pressable" type="button" data-row="${gift.id}">
            <img class="dispatch-row__photo" src="${photo(gift.to)}" alt="">
            <span class="dispatch-row__body">
              <span class="dispatch-row__name">${escapeHtml(PEOPLE[gift.to].name)}</span>
              <span class="dispatch-row__status" data-row-status="${gift.id}"></span>
            </span>
            <span class="fan dispatch-row__fan" aria-hidden="true">${fan(gift.items.slice(0, 3))}</span>
            <i class="icon icon--chevron dispatch-row__chevron" aria-hidden="true"></i>
          </button></li>`
      )
      .join("");
    this.openSheet("dispatch", null, `
      <img class="dispatch-hero" src="${ASSETS}/market/gift.webp" alt="">
      <h2 class="sheet__title ny-sheet-title" id="${labelId}">пункт отправки подарков</h2>
      <p class="sheet__text ny-sheet-title">здесь ты можешь посмотреть статус отправления твоих новогодних подарков</p>
      ${mine.length
        ? `<ul class="dispatch-list" role="list">${rows}</ul>`
        : `<button class="button button--primary ny-sheet-cta pressable" type="button" data-gift-too>подарить</button>`}`, labelId);
    this.el.mapBody.onclick = (event) => {
      const row = event.target.closest("[data-row]");
      if (row) this.openElf(Number(row.dataset.row));
      if (event.target.closest("[data-gift-too]")) this.giftToo();
    };
  }

  /** подарок пришёл: у получателя – что внутри, от кого, коммент и кнопка подарить самому */
  /** подарок пришёл: сверху послание дарителя – аватар, ник и дата дарения, под ними текст;
      ниже подарок (один – карточкой, мешок – плашками) и „подарить кому-нибудь“. Сыплется конфетти */
  openArrival(gift) {
    if (this.tab !== "map") this.showTab("map");
    this.follow = gift.id;
    const from = PEOPLE[gift.from];
    const labelId = this.id("arrival-title");
    const single = gift.items.length === 1 ? itemById(gift.items[0]) : null;
    const sent = standDate(gift.sentAt);
    this.openSheet("arrival", gift.id, `
      <h2 class="visually-hidden" id="${labelId}">эльф принёс подарок${gift.anonymous ? "" : ` от ${escapeHtml(from.gen)}`}</h2>
      <header class="arrival-head">
        ${gift.anonymous
          ? `<img class="arrival-head__sticker" src="${ASSETS}/stickers/question.webp" alt="">`
          : `<img class="arrival-head__photo" src="${photo(gift.from)}" alt="">`}
        <span class="arrival-head__who">
          <span class="arrival-head__nick ellipsis">${gift.anonymous ? "аноним" : escapeHtml(from.nick)}</span>
          <time class="arrival-head__date" datetime="${sent.toISOString().slice(0, 10)}">${formatDate(sent)}</time>
        </span>
      </header>
      ${gift.comment ? `<p class="arrival-message">${escapeHtml(gift.comment)}</p>` : ""}
      ${single
        ? `<div class="gift-card gift-card--sheet">
             <img class="gift-card__art" src="${ASSETS}/${single.art}" alt="">
             <h3 class="gift-card__title">${escapeHtml(single.name)}</h3>
             <p class="gift-card__kind">${escapeHtml(single.kind)}</p>
           </div>`
        : `<div class="arrival-plates">${giftPlates(gift.items)}</div>`}
      <button class="button button--primary ny-sheet-cta pressable" type="button" data-gift-too>подарить кому-нибудь</button>`, labelId);
    $("[data-gift-too]", this.el.mapBody).addEventListener("click", () => this.giftToo());
    if (this.globe) this.globe.confetti(confettiColors(this.root));
  }

  openTired() {
    const labelId = this.id("tired-title");
    const giftId = this.sheet && this.sheet.giftId;
    this.openSheet("tired", giftId, `
      <img class="tired-art" src="${ASSETS}/stickers/zzz.webp" alt="">
      <h2 class="sheet__title ny-sheet-title" id="${labelId}">эльф выдохся</h2>
      <p class="sheet__text ny-sheet-title">бежать быстрее он может раз в&nbsp;день. дальше пойдёт как шёл</p>
      <button class="button button--primary ny-sheet-cta pressable" type="button" data-tired-ok>понятно</button>`, labelId);
    $("[data-tired-ok]", this.el.mapBody).addEventListener("click", () => {
      if (giftId) this.openElf(giftId);
      else this.closeSheet();
    });
  }

  /** живые значения в шторке: где эльф на дорожке, сколько ещё идти, статусы в пункте отправки */
  paintSheet(force = false) {
    if (!this.sheet) return;
    const now = performance.now();
    if (!force && now - this.lastSheetPaint < 250) return;
    this.lastSheetPaint = now;
    const body = this.el.mapBody;
    if (this.sheet.kind === "elf") {
      const gift = server.byId(this.sheet.giftId);
      if (!gift) return;
      const track = $("[data-track]", body);
      if (track) {
        track.style.setProperty("--progress", Math.min(1, gift.walked / gift.path.total).toFixed(4));
        // после тряски эльф бежит – и на дорожке тоже: другие кадры и снежные штрихи за спиной
        track.classList.toggle("is-running", gift.boost && gift.status === "walking");
      }
      if (gift.status === "delivered") {
        if (this.roleIn(gift) === "recipient") this.openArrival(gift);
        else setText($("[data-eta]", body), "уже у двери");
        return;
      }
      setText($("[data-eta]", body), `ещё примерно ${leftWords(server.left(gift))}`);
      const hint = $("[data-shake-hint]", body);
      if (hint) hint.hidden = gift.boost || server.shakes[this.persona] === server.day;
    }
    if (this.sheet.kind === "dispatch") {
      $$("[data-row-status]", body).forEach((node) => {
        const gift = server.byId(Number(node.dataset.rowStatus));
        const html = gift.status === "walking"
          ? `примерно через ${leftWords(server.left(gift))}`
          : `<span class="dispatch-row__done">доставлен</span>`;
        if (node.innerHTML !== html) node.innerHTML = html;
      });
    }
  }

  /* ── пуши ── */

  push({ title, text, action }) {
    setText($("[data-push-title]", this.root), title);
    setText($("[data-push-text]", this.root), text);
    this.pushAction = action;
    this.el.push.tabIndex = 0;
    this.el.push.classList.add("is-shown");
    this.el.announce.textContent = `${title}. ${text}`;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.hidePush(), sim.pushMs);
  }

  hidePush() {
    clearTimeout(this.pushTimer);
    this.el.push.classList.remove("is-shown");
    this.el.push.tabIndex = -1;
  }

  /* ── тряска ── */

  /** встряхнули телефон: он качается, по экрану летит снег; если идёт твой эльф – бежит быстрее */
  shake() {
    this.root.classList.remove("is-shaking");
    void this.root.offsetWidth;
    this.root.classList.add("is-shaking");
    setTimeout(() => this.root.classList.remove("is-shaking"), 950);
    const gift = this.shakeTarget();
    if (!gift) return "none";
    if (server.shakes[this.persona] === server.day) {
      this.openTired();
      return "tired";
    }
    server.shakes[this.persona] = server.day;
    gift.boost = true;
    if (this.globe) this.globe.globe();
    this.el.announce.textContent = "эльф побежал быстрее";
    this.paintSheet(true);
    return "boost";
  }

  /** трясти имеет смысл, пока следишь за эльфом, который идёт к тебе */
  shakeTarget() {
    const gift = this.follow ? server.byId(this.follow) : null;
    return gift && gift.to === this.persona && gift.status === "walking" ? gift : null;
  }

  /* ── кадр ── */

  frame(dt) {
    if (this.tab === "map") {
      const { w, h, k } = this.metrics();
      if (this.follow) {
        const gift = server.byId(this.follow);
        if (gift) {
          const at = elfAt(gift);
          const t = this.target(at, this.followAnchor());
          this.cam.tx = t.x;
          this.cam.ty = t.y;
        }
      }
      const ease = 1 - Math.exp(-dt * CAMERA_EASE);
      this.cam.x += (this.cam.tx - this.cam.x) * ease;
      this.cam.y += (this.cam.ty - this.cam.y) * ease;
      this.el.layer.style.transform = `translate3d(${this.cam.x.toFixed(2)}px, ${this.cam.y.toFixed(2)}px, 0)`;
      this.paintRoute(k);
      if (this.scene) {
        this.scene.resize(w, h, Math.min(window.devicePixelRatio || 1, 2));
        this.scene.setView(this.cam.x, this.cam.y, k);
        this.scene.sync(this.elves());
        this.scene.render(dt);
      }
      this.paintSheet();
    }
    if (this.tab === "market" && this.heroCanvas && !this.heroCanvas.closest("[hidden]")) {
      if (!this.hero) {
        try {
          this.hero = createHeroScene(this.heroCanvas);
        } catch (error) {
          this.hero = { resize() {}, render() {}, dispose() {} };
        }
      }
      const rect = this.heroCanvas.parentElement;
      this.hero.resize(rect.clientWidth, rect.clientHeight, Math.min(window.devicePixelRatio || 1, 2));
      this.hero.render(dt);
    }
  }

  /** эльфы для 3D: все, что идут, и те, что радуются у двери. У получателя эльф ждёт у двери,
      пока открыта шторка с подарком */
  elves() {
    const now = performance.now();
    const waiting = this.sheet && this.sheet.kind === "arrival" ? this.sheet.giftId : null;
    return server.gifts
      .filter((gift) => gift.status === "walking" || now - gift.doneAt < CELEBRATE_MS || gift.id === waiting)
      .map((gift) => {
        const at = elfAt(gift);
        // шаг эльфа под скорость на экране, чтобы ноги не скользили: при pace 1 он проходит ~27 px/с,
        // быстрее – примерно как 27·pace^1.2 (ny-models.js, MODEL_INFO)
        const screenSpeed = server.speedOf(gift) * sim.scale * 1000 * this.metrics().k;
        return {
          id: gift.id,
          x: at.x,
          y: at.y,
          heading: gift.status === "walking" ? at.heading : Math.PI / 2,
          walking: gift.status === "walking",
          running: gift.boost && gift.status === "walking",
          pace: Math.max(0.5, Math.min(2.6, (screenSpeed / 27) ** (1 / 1.2))),
          celebrate: gift.status === "delivered",
          variant: gift.variant,
        };
      });
  }

  /** пунктир маршрута: пройденное – бледно, впереди – розовым; только у эльфа, за которым следишь */
  paintRoute(k) {
    const gift = this.follow ? server.byId(this.follow) : null;
    const shown = Boolean(gift && gift.status === "walking");
    this.el.routeDone.classList.toggle("is-shown", shown);
    this.el.routeLeft.classList.toggle("is-shown", shown);
    if (!shown) return;
    const at = elfAt(gift);
    const pts = gift.path.segments;
    const d = gift.walked;
    const done = [[pts[0].ax, pts[0].ay]];
    const left = [[at.x, at.y]];
    for (const s of pts) {
      if (s.start + s.length <= d) done.push([s.bx, s.by]);
      else left.push([s.bx, s.by]);
    }
    done.push([at.x, at.y]);
    const toPath = (list) => list.map(([x, y], i) => `${i ? "L" : "M"}${(x * k).toFixed(1)} ${(y * k).toFixed(1)}`).join(" ");
    this.el.routeDone.setAttribute("d", toPath(done));
    this.el.routeLeft.setAttribute("d", toPath(left));
  }
}

/** шторку тянут вниз за грэббер: 1:1 за пальцем, закрытие решает проекция броска
    (где шторка остановилась бы с той же скоростью). Сдвиг – переменной --drag, без инлайн-transform */
function dragToClose(phone, sheet, handle, onClose) {
  if (!handle) return;
  let start = null;
  let last = null;
  let velocity = 0;
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    start = event.clientY;
    last = { y: event.clientY, t: performance.now() };
    velocity = 0;
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener("pointermove", (event) => {
    if (start == null) return;
    const now = performance.now();
    velocity = (event.clientY - last.y) / Math.max(1, now - last.t);
    last = { y: event.clientY, t: now };
    const dy = Math.max(0, (event.clientY - start) / phone.zoom());
    sheet.classList.add("is-dragging");
    sheet.style.setProperty("--drag", `${dy.toFixed(1)}px`);
  });
  const end = (event) => {
    if (start == null) return;
    const dy = (event.clientY - start) / phone.zoom();
    const projected = dy + (Math.max(0, velocity) * 180) / phone.zoom();
    start = null;
    sheet.classList.remove("is-dragging");
    sheet.style.removeProperty("--drag");
    if (dy > 4 && projected > Math.min(160, sheet.offsetHeight / 3)) onClose();
  };
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}

function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

/** каждый подарок своей плашкой: один – во всю ширину, несколько – лентой */
function giftPlates(ids) {
  const items = ids.map(itemById);
  const plate = (item) => `
    <li class="gift-plate">
      <img class="gift-plate__art" src="${ASSETS}/${item.art}" alt="">
      <span class="gift-plate__body">
        <span class="gift-plate__name ellipsis">${escapeHtml(item.name)}</span>
        <span class="gift-plate__kind">${escapeHtml(item.kind)}</span>
      </span>
    </li>`;
  return `<ul class="gift-plates${items.length > 1 ? " gift-plates--row" : ""}" role="list">${items.map(plate).join("")}</ul>`;
}

/** дата на стенде: время стенда (мс от старта) → день; стенд начинается 28 декабря в 22:40, как на карте */
const STAND_START = new Date(2026, 11, 28, 22, 40);
const standDate = (t) => new Date(STAND_START.getTime() + t);
const formatDate = (d) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

/** кадры походки для дорожки в шторке: шаг или бег, сменяются по кругу (только opacity) */
function gaitFrames(frames, gait) {
  return frames
    .map((src, i) => `<img class="elf-track__frame elf-track__frame--${gait}${i ? "" : " elf-track__frame--first"}" style="--f:${i}" src="${src}" alt="">`)
    .join("");
}

/** цвета конфетти – токен --confetti-colors: только цвета системы */
function confettiColors(root) {
  return getComputedStyle(root).getPropertyValue("--confetti-colors").split(",").map((c) => c.trim()).filter(Boolean);
}

/** веер упаковок: до трёх, внахлёст с разными наклонами */
function fan(ids) {
  return ids
    .map((id, i) => `<img class="fan__item" style="--i:${i};--n:${ids.length}" src="${ASSETS}/${itemById(id).art}" alt="">`)
    .join("");
}

function cutoutMarkup(id) {
  const glow = PEOPLE[id].online ? "online" : "offline";
  return `
    <span class="cutout" aria-hidden="true">
      <img class="cutout__glow" src="${ASSETS}/friends/glow-${glow}.webp" alt="">
      <span class="cutout__person"><img class="cutout__img" src="${cutoutOf(id)}" alt=""></span>
      <img class="cutout__rim" src="${ASSETS}/friends/rim-${glow}.png" alt="">
    </span>`;
}

/* ═══════════════════════ стенд и пульт ═════════════════════════════════ */

// подарки с пульта – эльф „за 1 день“, не анонимно; в маркете это выбирают на экране „подарить“
const panelState = { speed: "normal", anonymous: false, right: "leva" };
const phones = {
  left: new Phone($("#phone-left"), "natashka"),
  right: new Phone($("#phone-right"), "leva"),
};
const allPhones = () => [phones.left, phones.right];
const phoneOf = (persona) => allPhones().find((phone) => phone.persona === persona);

// пуш получателю, когда эльф вышел; пуши обоим, когда дошёл
bus.on("sent", (gift) => {
  const recipient = phoneOf(gift.to);
  if (recipient) recipient.push(sentPush(gift, recipient));
  allPhones().forEach((phone) => {
    if (phone.scene) phone.scene.pulse();
  });
  renderPanel();
});

function sentPush(gift, phone) {
  return {
    title: "к тебе идёт эльф с подарком",
    text: gift.anonymous ? "от анонима" : `от ${PEOPLE[gift.from].gen}`,
    action: () => phone.openElf(gift.id),
  };
}

bus.on("delivered", (gift) => {
  const recipient = phoneOf(gift.to);
  if (recipient) {
    recipient.push({ title: "эльф принёс подарок", text: gift.anonymous ? "от анонима" : `от ${PEOPLE[gift.from].gen}`, action: () => recipient.openArrival(gift) });
    recipient.openArrival(gift);
  }
  const sender = phoneOf(gift.from);
  if (sender && sender !== recipient) {
    sender.push({ title: "эльф донёс подарок", text: `подарок у ${PEOPLE[gift.to].gen}`, action: () => sender.openDispatch() });
  }
  renderPanel();
});

function resetAll() {
  server.reset();
  sim.t = 0;
  phones.left.build("natashka");
  phones.right.build(panelState.right);
  renderPanel();
}

/** подарок с пульта – так же, как из маркета, только без нажатий */
function quickGift(from, to, items, overrides = {}) {
  const phone = phoneOf(from);
  if (phone) phone.market.setCoins(phone.market.coins - sumOf(items));
  return server.send({
    from,
    to,
    items,
    anonymous: panelState.anonymous,
    speed: panelState.speed,
    comment: "с наступающим! это тебе от эльфов",
    ...overrides,
  });
}

function scene(name) {
  resetAll();
  const left = phones.left;
  if (name === "market") return;
  if (name === "gift") {
    const gift = quickGift("natashka", "leva", ["zombie"]);
    left.showTab("map");
    left.centerOn(DISPATCH, { x: 0.5, y: 0.46 }, true);
    left.follow = gift.id;
  }
  if (name === "sack") {
    const gift = quickGift("natashka", "leva", ["cat", "zombie", "ghost"]);
    left.showTab("map");
    left.follow = gift.id;
  }
  if (name === "many") {
    // три эльфа уже в пути и на разных улицах: вышли в разное время
    const gifts = [
      quickGift("natashka", "leva", ["fire-sale"]),
      quickGift("masha", "sonya", ["pumpkin", "bat"], { speed: "slow" }),
      quickGift("vasya", "natashka", ["ghost"], { speed: "fast", anonymous: true }),
    ];
    [0.45, 0.3, 0.2].forEach((share, i) => {
      gifts[i].walked = gifts[i].path.total * share;
      gifts[i].sentAt -= SPEEDS[gifts[i].speed].minutes * 60000 * share;
    });
    left.showTab("map");
    left.centerOn(DISPATCH, { x: 0.5, y: 0.5 }, true);
  }
}

/** подарок, с которым сейчас работает пульт: к лёве, самый свежий из идущих */
function levaGift() {
  const walking = server.gifts.filter((gift) => gift.to === "leva" && gift.status === "walking");
  return walking[walking.length - 1] || null;
}

function act(name) {
  const right = phones.right;
  const gift = levaGift();
  if (name === "push" && gift && right.persona === "leva") right.push(sentPush(gift, right));
  if (name === "open-push" && gift && right.persona === "leva") {
    right.hidePush();
    right.openElf(gift.id);
  }
  if (name === "shake" && right.persona === "leva") right.shake();
  if (name === "arrive" && gift) gift.walked = gift.path.total - 0.01;
  if (name === "new-day") server.day += 1;
  if (name === "reset") resetAll();
  renderPanel();
}

/** от чего зависит пульт: пуш открыли в самом телефоне, карту утащили пальцем – пульт узнаёт в том же кадре */
let panelKey = "";
function panelSignature() {
  const gift = levaGift();
  return [phones.right.persona, gift ? gift.id : 0, Boolean(phones.right.shakeTarget()), server.shakes.leva === server.day].join();
}

function renderPanel() {
  panelKey = panelSignature();
  $$("[data-right]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.right === panelState.right)));
  $$("[data-time]").forEach((b) => b.setAttribute("aria-checked", String(Number(b.dataset.time) === sim.scale)));
  const leva = phones.right.persona === "leva";
  const gift = levaGift();
  $("[data-act='push']").disabled = !(leva && gift);
  $("[data-act='open-push']").disabled = !(leva && gift);
  $("[data-act='arrive']").disabled = !gift;
  const canShake = leva && phones.right.shakeTarget();
  $("[data-act='shake']").disabled = !canShake;
  let note = "";
  if (!leva) note = "трясёт телефон получатель – переключи справа на лёву";
  else if (!gift) note = "сначала подари лёве что-нибудь";
  else if (!canShake) note = "сначала открой эльфа у лёвы – пуш или нажатие на эльфа";
  else if (server.shakes.leva === server.day) note = "сегодня лёва уже тряс – эльф выдохся";
  $("#panel-shake-note").textContent = note;
  $("#side-right").textContent = phones.right.persona === "leva" ? "лёва · получает подарок" : "соня · подруга лёвы";
}

document.querySelector(".panel").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || button.disabled) return;
  if (button.dataset.scene) scene(button.dataset.scene);
  if (button.dataset.act) act(button.dataset.act);
  if (button.dataset.right && button.dataset.right !== phones.right.persona) {
    panelState.right = button.dataset.right;
    phones.right.build(panelState.right);
  }
  if (button.dataset.time) sim.scale = Number(button.dataset.time);
  renderPanel();
});

/* стенд целиком в окне; на телефоне – колонкой */
function fitStage() {
  const stagePhones = $("#stage-phones");
  if (window.matchMedia("(max-width: 480px)").matches) {
    stagePhones.style.removeProperty("--stage-zoom");
    return;
  }
  const head = $(".stage__head").offsetHeight;
  const availH = window.innerHeight - head - 16 - 20 * 2;
  const availW = window.innerWidth - 24 * 2;
  const zoom = Math.max(0.45, Math.min(1, availH / (844 + 30), availW / (390 * 2 + 244 + 24 * 2)));
  stagePhones.style.setProperty("--stage-zoom", zoom.toFixed(3));
}
window.addEventListener("resize", fitStage);
fitStage();
if (document.fonts) document.fonts.ready.then(fitStage);

/* ── все состояния фичи: раскладка states.html и ссылки ?state=<id> ─────────
   Как дойти до каждого состояния с чистого стенда. Список и подписи – states.js */

const STATE_COMMENT = "с наступающим! пусть этот год будет не «ну норм», а «офигеть, как я так живу» 🎄";

/** эльф у двери прямо сейчас: пуши и шторка прихода – как в жизни */
function deliverNow(gift) {
  gift.walked = gift.path.total;
  server.update(0);
}

function stateConfirm(items, to, sack = false) {
  scene("market");
  phones.left.startGift(items, { sack });
  phones.left.draft.to = to;
  phones.left.openConfirm();
}

function stateSent(anonymous) {
  scene("market");
  phones.left.openSent(quickGift("natashka", "leva", ["jewelry"], { anonymous }));
}

function stateRecipient() {
  scene("gift");
  phones.right.hidePush();
  phones.right.openElf(server.gifts[0].id);
}

function stateDispatch() {
  phones.left.showTab("map");
  phones.left.centerOn(DISPATCH, { x: 0.5, y: 0.3 }, true);
  phones.left.openDispatch();
}

const STATE_SETUPS = {
  "market-ny": () => scene("market"),
  "market-sack": () => {
    scene("market");
    phones.left.sack = ["cat", "ghost", "pumpkin"];
    phones.left.renderSack();
  },
  recipients: () => {
    scene("market");
    phones.left.startGift(["zombie"]);
  },
  confirm: () => stateConfirm(["cat"], "leva"),
  "confirm-limited": () => stateConfirm(["jewelry"], "leva"),
  "confirm-sack": () => stateConfirm(["cat", "ghost", "pumpkin"], "sonya", true),
  sent: () => stateSent(false),
  "sent-anon": () => stateSent(true),
  "elf-sender": () => {
    scene("gift");
    phones.left.openElf(server.gifts[0].id);
  },
  "elf-sender-sack": () => {
    scene("sack");
    phones.left.openElf(server.gifts[0].id);
  },
  "dispatch-empty": () => {
    resetAll();
    stateDispatch();
  },
  "dispatch-list": () => {
    resetAll();
    // один уже дошёл – тихо, без пушей; второй в пути
    const done = quickGift("natashka", "vasya", ["ghost"]);
    Object.assign(done, { walked: done.path.total, status: "delivered", doneAt: performance.now() - CELEBRATE_MS });
    quickGift("natashka", "leva", ["zombie"]);
    phones.right.hidePush();
    stateDispatch();
  },
  "push-delivered": () => {
    scene("gift");
    deliverNow(server.gifts[0]);
  },
  many: () => scene("many"),
  "push-incoming": () => scene("gift"),
  "elf-recipient": () => stateRecipient(),
  "elf-recipient-anon": () => {
    resetAll();
    const gift = quickGift("natashka", "leva", ["zombie"], { anonymous: true });
    phones.right.hidePush();
    phones.right.openElf(gift.id);
  },
  running: () => {
    stateRecipient();
    phones.right.shake();
  },
  tired: () => {
    stateRecipient();
    server.shakes.leva = server.day;              // сегодня уже тряс
    phones.right.shake();
  },
  arrival: () => {
    resetAll();
    deliverNow(quickGift("natashka", "leva", ["jewelry"], { comment: STATE_COMMENT }));
    phones.right.hidePush();
  },
  "arrival-sack": () => {
    resetAll();
    deliverNow(quickGift("natashka", "leva", ["cat", "zombie", "ghost"], { anonymous: true, comment: "угадай, от кого 🎁" }));
    phones.right.hidePush();
  },
  "elf-friend": () => {
    scene("gift");
    phones.right.openElf(server.gifts[0].id);
  },
};

/** включить состояние: стенд с чистого листа, справа – лёва или соня, как нужно состоянию */
function showState(id) {
  const meta = STATES.find((state) => state.id === id);
  if (!meta || !STATE_SETUPS[id]) return false;
  panelState.right = meta.persona || "leva";
  STATE_SETUPS[id]();
  renderPanel();
  return true;
}

/* ── старт ───────────────────────────────────────────────────────────── */

try {
  Object.assign(props, renderProps(240));
} catch (error) {
  // без WebGL шторки обходятся без 3D-картинок
}
renderPanel();

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  sim.t += dt * 1000 * sim.scale;
  server.update(dt * 1000 * sim.scale);
  allPhones().forEach((phone) => phone.frame(dt));
  if (panelSignature() !== panelKey) renderPanel();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ссылка из раскладки: index.html?state=<id> открывает стенд сразу в этом состоянии
const initialState = new URLSearchParams(location.search).get("state");
if (initialState) showState(initialState);

// для смоук-теста и снимков: состояние стенда без доступа к модулю
window.NY = { server, sim, phones, scene, act, showState, states: STATES.map(({ id, phone }) => ({ id, phone })) };
