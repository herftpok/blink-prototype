/*
 * Адвент: календарь, день, карточка статистики, цу-е-фа и розыгрыш в одном телефоне + пульт.
 * Данные – av-data.js, карточки статистики – av-cards.js, игра «цу-е-фа» и розыгрыш – av-game.js.
 * Переходы: календарь → день – предмет дня летит из клетки в шапку дня (как в видео-референсе),
 * остальные клетки гаснут; день → карточка – снизу на весь экран; цу-е-фа и розыгрыш – справа.
 */
(() => {
  "use strict";

  const D = window.AV_DATA;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ASSETS = "../../assets";
  const NBSP = String.fromCharCode(160);
  const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const app = $("#app");

  // Опубликованная версия (GitHub Pages) – без игры и розыгрыша: игра ещё в работе, а билеты в розыгрыш
  // берутся только из неё. Локально – всё; ?nogame – посмотреть опубликованный вид локально
  const GAME_ON = !location.hostname.endsWith("github.io") && !new URLSearchParams(location.search).has("nogame");
  if (!GAME_ON) {
    app.classList.add("av--no-game");
    $$(".av-balance[data-go]").forEach((b) => {
      b.removeAttribute("data-go");
      b.tabIndex = -1;
      b.setAttribute("aria-label", "снежинки");
    });
    $("#panel-tree")?.closest(".panel__group")?.setAttribute("hidden", "");
    const lead = $(".stage__lead");
    if (lead) lead.textContent = "14 декабря – 11 января: каждый день карточка о твоём годе или предсказание на 2027 и снежинки за вход и задания";
  }
  const announce = (text) => { $("#announce").textContent = text; };

  /* ── помощники ───────────────────────────────────────────────────────── */

  /** "r:valenok" → renders/valenok.webp, "s:eyes" → стикер, "a:market/coin.png" → ассет */
  function src(ref) {
    if (!ref) return "";
    const [kind, name] = ref.split(/:(.+)/);
    if (kind === "r") return `renders/${name}.webp`;
    if (kind === "s") return `${ASSETS}/stickers/${name}.webp`;
    if (kind === "a") return `${ASSETS}/${name}`;
    return ref;
  }

  const person = (id) => {
    const p = D.PEOPLE[id];
    return { ...p, id, live: `${ASSETS}/people/live-${p.n}.webp`, photo: `${ASSETS}/people/photo-${p.n}.webp`, cutout: `${ASSETS}/people/cutout-${p.n}.webp` };
  };

  /** 2846 → «2 846» (неразрывный пробел между разрядами) */
  const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);

  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  const MONTHS = { 12: "декабря", "01": "января" };
  const dayName = (day) => {
    const [d, m] = day.date.split(".");
    return `${Number(d)}${NBSP}${MONTHS[m]}`;
  };

  // стабильный «случайный» наклон для клетки
  const tilt = (i, k = 7) => (((i * 73) % 17) / 16 - 0.5) * 2 * k;

  /** Предмет дня: картинка или веер стикеров (25.12) */
  function objMarkup(day, cls = "") {
    if (day.obj === "fan") {
      return `<span class="av-fan ${cls}">${["heart", "fire", "kiss"].map((s) => `<img class="av-fan__img" src="${src(`s:${s}`)}" alt="">`).join("")}</span>`;
    }
    return `<img class="${cls}" src="${src(day.obj)}" alt="">`;
  }
  const objSrc = (day) => (day.obj === "fan" ? src("s:fire") : src(day.obj));

  /* ── состояние ───────────────────────────────────────────────────────── */

  const S = {
    today: 8,              // индекс «сегодня» в DAYS (22.12)
    balance: 0,
    tickets: 0,
    days: [],              // по дням: login, task, share – "todo" | "done" | "claimed" | "missed"; seen
    taken: [],             // id подарков с ёлки, которые уже твои
    beaten: [],            // каких друзей обыграл в цу-е-фа
    stake: 100,            // выбранная ставка
    streak: 0,             // обычных подарков подряд
    star: false,           // золотая звезда собрана
    draw: {},              // билеты в шарах: id → сколько положено
    empty: false,          // пульт: мало данных – запасные карточки
    vip: false,
  };

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Подарок с ёлки уровня tier (или ближайшего ниже, если уровень кончился) – из оставшихся, без повторов */
  function takeTier(tier, R = Math.random) {
    const order = ["common", "rare", "epic", "legend"];
    for (let k = order.indexOf(tier); k >= 0; k--) {
      const left = D.POOL.filter((p) => p.tier === order[k] && !S.taken.includes(p.id));
      if (left.length) return left[Math.floor(R() * left.length)];
    }
    return D.POOL.find((p) => !S.taken.includes(p.id)) || null;
  }

  /** Состояние на любой «сегодня»: прошлые дни частично собраны, часть бросков сделана */
  function preset(todayIdx) {
    const R = rng(todayIdx * 31 + 7);
    S.today = todayIdx;
    S.days = D.DAYS.map((day, i) => {
      if (i > todayIdx) return { login: "todo", task: "todo", share: "todo", seen: false };
      if (i === todayIdx) return { login: "todo", task: "todo", share: "todo", seen: false };
      const missed = i % 5 === 3;
      return {
        login: missed ? "missed" : "claimed",
        task: missed ? "missed" : R() < 0.7 ? "claimed" : "missed",
        share: missed ? "missed" : R() < 0.5 ? "claimed" : "missed",
        seen: !missed && R() < 0.85,
      };
    });
    let earned = 0;
    S.days.forEach((d, i) => {
      const k = D.DAYS[i].task.boost || 1;
      if (d.login === "claimed") earned += D.ECONOMY.login;
      if (d.task === "claimed") earned += D.DAYS[i].task.reward * k;
      if (d.share === "claimed") earned += D.ECONOMY.share;
    });
    S.taken = [];
    S.stake = D.ECONOMY.stake;
    S.streak = 0;
    S.star = false;
    S.tickets = 0;
    S.draw = {};
    S.balance = earned;
    S.beaten = [];
    if (todayIdx > 0) {
      // почти всё заработанное уже было на кону; ставки по 100, побед – около половины
      const ctx = { S, D };
      const duels = Math.floor((earned * 0.8) / D.ECONOMY.stake);
      for (let k = 0; k < duels; k++) {
        if (S.balance < D.ECONOMY.stake) break;
        const who = D.RIVALS[Math.floor(R() * D.RIVALS.length)].who;
        window.AV_GAME.resolve(ctx, who, Math.floor(R() * 6), Math.floor(R() * 5), D.ECONOMY.stake, R);
      }
      // часть билетов уже в шарах
      const placed = Math.floor(S.tickets * 0.4);
      if (placed) {
        S.draw.console = placed;
        S.tickets -= placed;
      }
    }
  }

  /* ── экраны и переходы ───────────────────────────────────────────────── */

  const screens = {
    home: $("#screen-home"),
    day: $("#screen-day"),
    stat: $("#screen-stat"),
    game: $("#screen-game"),
    draw: $("#screen-draw"),
  };
  const stack = ["home"];
  let busy = false;
  let currentDay = S.today;

  const current = () => stack[stack.length - 1];

  function anim(el, frames, opts) {
    if (!el) return Promise.resolve();
    const a = el.animate(frames, { duration: reduced() ? 1 : 280, easing: EASE, fill: "both", ...opts });
    return a.finished.then(() => a);
  }

  function show(name) {
    screens[name].hidden = false;
    app.dataset.screen = name;
  }

  /** Экран справа (цу-е-фа, розыгрыш), под ним предыдущий уходит влево на 30 % */
  async function push(name, opts = {}) {
    if (busy || current() === name) return;
    busy = true;
    const from = screens[current()];
    RENDER[name]?.(opts);
    show(name);
    stack.push(name);
    const a1 = anim(screens[name], [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }]);
    const a2 = anim(from, [{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(-30%)", opacity: 0.4 }]);
    const [x, y] = await Promise.all([a1, a2]);
    from.hidden = true;
    x.cancel();
    y.cancel();
    busy = false;
    focusScreen(name);
  }

  async function pop() {
    if (busy || stack.length < 2) return;
    const name = stack[stack.length - 1];
    if (name === "day") return closeDay();
    if (name === "stat") return closeStat();
    busy = true;
    stack.pop();
    const back = current();
    RENDER[back]?.({ refresh: true });
    show(back);
    const a1 = anim(screens[name], [{ transform: "translateX(0)" }, { transform: "translateX(100%)" }]);
    const a2 = anim(screens[back], [{ transform: "translateX(-30%)", opacity: 0.4 }, { transform: "translateX(0)", opacity: 1 }]);
    const [x, y] = await Promise.all([a1, a2]);
    screens[name].hidden = true;
    x.cancel();
    y.cancel();
    busy = false;
    focusScreen(back);
  }

  function focusScreen(name) {
    // фокус переносим только для клавиатуры: у мыши и пальца кольцо фокуса не нужно
    if (!app.matches(":focus-within") || !document.documentElement.classList.contains("kb")) return;
    $(".av-bar__back, .av-close", screens[name])?.focus();
  }

  const rectIn = (el) => {
    const a = app.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const z = a.width / app.offsetWidth || 1;          // стенд может быть в zoom
    return { x: (r.left - a.left) / z, y: (r.top - a.top) / z, w: r.width / z, h: r.height / z };
  };

  /** Предмет дня перелетает из клетки календаря в шапку дня (и обратно) */
  function flyObject(fromEl, toEl, day, { reverse = false, duration = 540 } = {}) {
    const a = rectIn(fromEl);
    const b = rectIn(toEl);
    const fly = document.createElement("div");
    fly.className = "av-fly__item";
    fly.innerHTML = objMarkup(day, "av-fly__obj");
    const inner = fly.firstElementChild;
    inner.style.width = "100%";
    inner.style.height = "100%";
    if (inner.tagName === "IMG") inner.style.objectFit = "contain";
    Object.assign(fly.style, { width: `${b.w}px`, height: `${b.h}px` });
    $("#fly").append(fly);
    const sa = a.w / b.w;
    const from = `translate(${a.x}px, ${a.y}px) scale(${sa})`;
    const to = `translate(${b.x}px, ${b.y}px) scale(1)`;
    fly.style.transformOrigin = "0 0";
    // по дуге: в середине пути предмет чуть выше и поворачивается, как в референсе
    const mid = `translate(${(a.x + b.x) / 2}px, ${Math.min(a.y, b.y) - 24}px) scale(${(sa + 1) / 2}) rotate(${reverse ? 6 : -6}deg)`;
    const frames = reverse ? [{ transform: to }, { transform: mid, offset: 0.5 }, { transform: from }] : [{ transform: from }, { transform: mid, offset: 0.5 }, { transform: to }];
    const run = fly.animate(frames, { duration: reduced() ? 1 : duration, easing: "cubic-bezier(0.45, 0, 0.2, 1)", fill: "both" });
    return run.finished.then(() => fly);
  }

  async function openDay(i, fromCell) {
    if (busy) return;
    busy = true;
    currentDay = i;
    const day = D.DAYS[i];
    renderDay();
    show("day");
    stack.push("day");
    const slot = $("#day-slot");
    const art = fromCell ? $(".av-cell__art", fromCell) : null;
    const parts = [$(".av-bar", screens.day), $("#day-glow"), $(".av-day__mound", screens.day), ...$$("#day-body > *")];
    const reveal = () => parts.forEach((el, k) => {
      const rise = el.classList.contains("av-day__mound") ? 40 : 14;
      // translate, а не transform: у сугроба и свечения свой transform центрирования
      anim(el, [{ opacity: 0, translate: `0 ${rise}px` }, { opacity: 1, translate: "0 0" }], { delay: k * 35, duration: 360 })
        .then((a) => { el.style.opacity = ""; a.cancel(); });
    });
    parts.forEach((el) => { el.style.opacity = "0"; });
    if (art && !reduced()) {
      slot.style.visibility = "hidden";
      art.style.visibility = "hidden";
      fadeHome(fromCell, 1, 0);
      const flight = flyObject($(".av-cell__obj, .av-fan", fromCell) || art, slot, day);
      setTimeout(reveal, 150);                          // день проявляется, пока предмет ещё летит
      const fly = await flight;
      slot.style.visibility = "";
      fly.remove();
    } else {
      reveal();
    }
    screens.home.hidden = true;
    resetHomeFade();
    busy = false;
    focusScreen("day");
  }

  /** Календарь гаснет вокруг нажатой клетки (или проявляется обратно) */
  function fadeHome(keep, from, to, delay = 0) {
    const els = $$(".av-cell, .av-ledge, .av-bar, .av-dock", screens.home).filter((el) => el !== keep);
    els.forEach((el) => anim(el, [{ opacity: from }, { opacity: to }], { duration: 240, delay }));
    if (keep) $$(".av-cell__date, .badge-star, .av-cell__dot", keep).forEach((el) => anim(el, [{ opacity: from }, { opacity: to }], { duration: 160, delay }));
  }

  function resetHomeFade() {
    $$(".av-cell, .av-ledge, .av-bar, .av-dock, .av-cell__date, .badge-star, .av-cell__dot", screens.home).forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel());
      el.style.opacity = "";
    });
    $$(".av-cell__art", screens.home).forEach((el) => { el.style.visibility = ""; });
  }

  async function closeDay() {
    if (busy) return;
    busy = true;
    stack.pop();
    renderHome();
    show("home");
    const cell = $(`.av-cell[data-day="${currentDay}"]`, screens.home);
    const day = D.DAYS[currentDay];
    const slot = $("#day-slot");
    if (cell && !reduced()) {
      cell.scrollIntoView({ block: "nearest" });
      const art = $(".av-cell__art", cell);
      art.style.visibility = "hidden";
      fadeHome(cell, 0, 1, 140);
      anim(screens.day, [{ opacity: 1 }, { opacity: 0 }], { duration: 200 });
      const target = $(".av-cell__obj, .av-fan", cell) || art;
      slot.style.visibility = "hidden";
      const fly = await flyObject(target, slot, day, { reverse: true, duration: 460 });
      art.style.visibility = "";
      fly.remove();
      resetHomeFade();
    }
    screens.day.hidden = true;
    screens.day.getAnimations().forEach((a) => a.cancel());
    slot.style.visibility = "";
    busy = false;
    focusScreen("home");
  }

  async function openStat() {
    if (busy) return;
    busy = true;
    S.days[currentDay].seen = true;
    renderStat();
    show("stat");
    stack.push("stat");
    await anim(screens.stat, [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], { duration: 380 }).then((a) => a.cancel());
    window.AV_CARDS.enter($("#stat-card"));
    screens.day.hidden = true;
    busy = false;
    focusScreen("stat");
  }

  async function closeStat() {
    if (busy) return;
    busy = true;
    stack.pop();
    renderDay();
    show("day");
    await anim(screens.stat, [{ transform: "translateY(0)" }, { transform: "translateY(100%)" }], { duration: 320 }).then((a) => a.cancel());
    screens.stat.hidden = true;
    busy = false;
    focusScreen("day");
  }

  /* ── 1. календарь ────────────────────────────────────────────────────── */

  function cellState(i) {
    if (i > S.today) return "frozen";
    if (i === S.today) return "today";
    return "open";
  }

  /** Сколько снежинок дня ещё можно забрать сегодня – звезда-счётчик на клетке */
  function waiting(i) {
    const d = S.days[i];
    return ["login", "task", "share"].filter((k) => d[k] === "todo" || d[k] === "done").length;
  }

  function renderHome() {
    $("#calendar").innerHTML = `<div class="av-grid">${D.DAYS.map((day, i) => cellMarkup(day, i)).join("")}${ledges()}</div>`;
    renderBalance();
    const left = D.POOL.length - S.taken.length;
    $("#dock-game").textContent = `ставки от${NBSP}${D.ECONOMY.stakes[0]}`;
    $("#dock-draw").textContent = `${S.tickets}${NBSP}${plural(S.tickets, "билет", "билета", "билетов")}`;
  }

  const COLS = 3;                                     // три дня в ряд: крупнее и спокойнее

  // полка под каждым рядом; клетки и полки стоят в сетке явно, полка – под предметами
  function ledges() {
    const rows = Math.ceil(D.DAYS.length / COLS);
    return Array.from({ length: rows }, (_, r) => `<span class="av-ledge" style="grid-row:${r + 1}" aria-hidden="true"></span>`).join("");
  }

  function cellMarkup(day, i) {
    const st = cellState(i);
    const d = S.days[i];
    const ice = st === "frozen" ? `<img class="av-cell__ice" src="renders/ice.webp" alt="" style="--ice-tilt:${tilt(i + 3, 4)}deg">` : "";
    const glow = st === "today" ? `<img class="av-cell__glow" src="${objSrc(day)}" alt="">` : "";
    const n = st === "today" ? waiting(i) : 0;
    const badge = n ? `<span class="badge-star" aria-hidden="true"><i class="icon icon--badge-star"></i><span class="badge-star__value">${n}</span></span>` : "";
    const dot = st === "open" && !d.seen ? `<span class="av-cell__dot" aria-hidden="true"></span>` : "";
    const label = st === "frozen"
      ? `${dayName(day)}, ещё закрыто`
      : `${dayName(day)}, ${day.title}${st === "today" ? ", сегодня" : ""}${dot ? ", не открыто" : ""}${n ? `, снежинок ждёт: ${n}` : ""}`;
    return `<button class="av-cell is-${st} pressable" type="button" data-day="${i}" aria-label="${label}" style="--tilt:${tilt(i)}deg;grid-row:${Math.floor(i / COLS) + 1};grid-column:${(i % COLS) + 1}">
      <span class="av-cell__art">${glow}${objMarkup(day, "av-cell__obj")}${ice}</span>
      ${badge}${dot}
      <span class="av-cell__date">${st === "today" ? "сегодня" : day.date}</span>
    </button>`;
  }

  function renderBalance() {
    $$("[data-balance]").forEach((el) => { el.textContent = fmt(S.balance); });
    $$("[data-tickets]").forEach((el) => { el.textContent = fmt(S.tickets); });
  }

  /* ── 2. день ─────────────────────────────────────────────────────────── */

  function renderDay() {
    const i = currentDay;
    const day = D.DAYS[i];
    const isToday = i === S.today;
    $("#day-date").textContent = dayName(day);
    $("#day-slot").innerHTML = objMarkup(day, "av-day__obj");
    $("#day-glow").src = objSrc(day);
    const d = S.days[i];
    const flake = `<img class="av-task__flake" src="renders/snowflake.webp" alt="">`;
    const k = day.task.boost || 1;
    const rows = [
      { key: "login", art: `<img class="av-task__art" src="renders/snowflake.webp" alt="">`, text: "за вход", reward: D.ECONOMY.login },
      { key: "task", art: `<span class="av-task__art">${objMarkup(day, "av-task__obj")}</span>`, text: day.task.text, reward: day.task.reward * k, boost: k > 1 },
      { key: "share", art: `<span class="av-task__art av-task__art--icon"><i class="icon icon--share" aria-hidden="true"></i></span>`, text: day.prediction ? "поделись предсказанием" : "поделись карточкой дня", reward: D.ECONOMY.share },
    ];
    $("#day-body").innerHTML = `
      <div class="av-day__head">
        <h2 class="av-day__title" id="day-title">${day.title}</h2>
        <p class="av-day__lead">${day.lead}</p>
      </div>
      <button class="button button--primary av-day__cta pressable" type="button" data-act="open-stat">${day.prediction ? "открыть предсказание" : "смотреть"}</button>
      <h3 class="av-day__section caps-label"><span>${isToday ? "снежинки дня" : "снежинки этого дня"}</span><span>${rows.reduce((t, r) => t + r.reward, 0)}</span></h3>
      <ul class="av-tasks">${rows.map((r) => taskRow(r, d[r.key], flake, isToday)).join("")}</ul>`;
    renderBalance();
  }

  function taskRow(r, state, flake, isToday) {
    let action = "";
    if (state === "todo" && isToday) {
      action = r.key === "login"
        ? `<button class="av-task__button av-task__button--claim pressable" type="button" data-claim="login">забрать</button>`
        : `<button class="av-task__button av-task__button--do pressable" type="button" data-do="${r.key}">сделать</button>`;
    } else if (state === "done") {
      action = `<button class="av-task__button av-task__button--claim pressable" type="button" data-claim="${r.key}">забрать</button>`;
    } else if (state === "claimed") {
      action = `<span class="av-task__state"><i class="icon icon--check" aria-hidden="true"></i>получено</span>`;
    } else {
      action = `<span class="av-task__state">день прошёл</span>`;
    }
    return `<li class="av-task" data-row="${r.key}">
      ${r.art}
      <div class="av-task__body">
        <span class="av-task__text">${r.text}</span>
        <span class="av-task__reward">${flake}+${r.reward}${r.boost ? `<span class="av-task__boost">${NBSP}×2 в праздники</span>` : ""}</span>
      </div>
      ${action}
    </li>`;
  }

  /** Задание выполнено (на стенде – по нажатию «сделать»: экранов заданий в задаче нет) */
  function doTask(key) {
    S.days[currentDay][key] = "done";
    if (key === "share") return openStat();
    renderDay();
    $(`[data-claim="${key}"]`)?.focus({ preventScroll: true });
  }

  /** Забрать снежинки: летят из строки в баланс шапки */
  function claim(key, fromEl) {
    const day = D.DAYS[currentDay];
    const k = day.task.boost || 1;
    const amount = key === "login" ? D.ECONOMY.login : key === "share" ? D.ECONOMY.share : day.task.reward * k;
    S.days[currentDay][key] = "claimed";
    const target = $(".av-balance", screens[current()]);
    flyFlakes(fromEl, target, 6).then(() => {
      S.balance += amount;
      renderBalance();
      target.classList.remove("is-bump");
      void target.offsetWidth;
      target.classList.add("is-bump");
    });
    renderDay();
    announce(`+${amount} снежинок`);
  }

  function flyFlakes(fromEl, toEl, count = 6, img = "renders/snowflake.webp", size = 26) {
    if (!fromEl || !toEl) return Promise.resolve();
    const a = rectIn(fromEl);
    const b = rectIn(toEl);
    const runs = [];
    for (let k = 0; k < count; k++) {
      const f = document.createElement("img");
      f.className = "av-fly__item";
      f.src = img;
      f.alt = "";
      Object.assign(f.style, { width: `${size}px`, height: `${size}px` });
      $("#fly").append(f);
      const x0 = a.x + a.w / 2 - size / 2 + (Math.random() - 0.5) * 40;
      const y0 = a.y + a.h / 2 - size / 2 + (Math.random() - 0.5) * 16;
      const x1 = b.x + 4;
      const y1 = b.y + b.h / 2 - size / 2;
      const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * 80;
      const my = Math.min(y0, y1) - 40 - Math.random() * 60;
      const run = f.animate([
        { transform: `translate(${x0}px, ${y0}px) scale(0.6) rotate(0deg)`, opacity: 0 },
        { transform: `translate(${x0}px, ${y0 - 10}px) scale(1) rotate(40deg)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${mx}px, ${my}px) scale(1.1) rotate(160deg)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x1}px, ${y1}px) scale(0.7) rotate(300deg)`, opacity: 1 },
      ], { duration: reduced() ? 1 : 700 + k * 70, easing: EASE, fill: "both" });
      runs.push(run.finished.then(() => f.remove()));
    }
    return Promise.all(runs);
  }

  /* ── 3. карточка статистики ──────────────────────────────────────────── */

  function cardCtx() {
    return { S, D, src, person, fmt, plural, NBSP, dayName, objMarkup, ASSETS };
  }

  function renderStat() {
    const day = D.DAYS[currentDay];
    $("#stat-card").innerHTML = window.AV_CARDS.render(day, cardCtx());
    syncStatButton();
  }

  /** У предсказания, пока печенье целое, кнопка внизу – «разломить», потом – «поделиться» */
  function syncStatButton() {
    const day = D.DAYS[currentDay];
    const crack = Boolean(day.prediction && !S.days[currentDay].cracked);
    const b = $("#stat-share");
    b.dataset.mode = crack ? "crack" : "share";
    $("i", b).hidden = crack;
    $("span", b).textContent = crack ? "разломить" : "поделиться";
  }

  function crackCookie() {
    window.AV_CARDS.crack($("#stat-card"), () => {
      S.days[currentDay].cracked = true;
      syncStatButton();
      announce(D.DAYS[currentDay].prediction);
    });
  }

  /* ── 4–5. цу-е-фа и розыгрыш ─────────────────────────────────────────── */

  const RENDER = {
    game: () => window.AV_GAME.render($("#game"), gameCtx()),
    draw: () => renderDraw(),
    home: () => renderHome(),
    day: () => renderDay(),
  };

  function gameCtx() {
    return {
      S, D, src, fmt, plural, NBSP, renderBalance, flyFlakes, rectIn, announce, app,
      openPool: () => openSheet("pool"),
      openPrize: (prize, extra) => openPrize(prize, extra),
      toTasks: () => { goToday(); },
      toDraw: () => push("draw"),
      toTree: () => push("game"),
    };
  }

  function goToday() {
    // из игры к заданиям: назад в календарь и сразу в «сегодня»
    while (stack.length > 1) {
      const name = stack.pop();
      screens[name].hidden = true;
    }
    renderHome();
    show("home");
    currentDay = S.today;
    const cell = $(`.av-cell[data-day="${S.today}"]`);
    openDay(S.today, cell);
  }

  function renderDraw() {
    window.AV_GAME.renderDraw($("#draw"), gameCtx());
    renderBalance();
  }

  /* ── шторки ──────────────────────────────────────────────────────────── */

  const sheets = { prize: $("#sheet-prize"), pool: $("#sheet-pool"), share: $("#sheet-share") };
  let openSheetName = null;
  let sheetReturn = null;

  function openSheet(name) {
    if (openSheetName) closeSheet(true);
    openSheetName = name;
    sheetReturn = document.activeElement;
    if (name === "pool") window.AV_GAME.renderPool($("#pool-body"), gameCtx());
    $("#scrim").classList.add("is-open");
    sheets[name].classList.add("is-open");
    Object.values(screens).forEach((s) => { s.inert = true; });
    sheets[name].focus({ preventScroll: true });
  }

  function closeSheet(silent) {
    if (!openSheetName) return;
    const el = sheets[openSheetName];
    el.classList.remove("is-open");
    el.style.transform = "";
    $("#scrim").classList.remove("is-open");
    Object.values(screens).forEach((s) => { s.inert = false; });
    const was = openSheetName;
    openSheetName = null;
    if (!silent && sheetReturn && document.contains(sheetReturn)) sheetReturn.focus({ preventScroll: true });
    if (was === "prize") window.AV_GAME.afterPrize(gameCtx());
  }

  function openPrize(prize, extra) {
    $("#prize-body").innerHTML = window.AV_GAME.prizeMarkup(prize, extra, gameCtx());
    openSheet("prize");
    window.AV_GAME.prizeEnter(prize, extra, gameCtx());
  }

  function openShare() {
    const day = D.DAYS[currentDay];
    $("#share-story").innerHTML = `<div class="av-share__page">${window.AV_CARDS.render(day, { ...cardCtx(), story: true })}</div>`;
    $("#share-cta-label").textContent = "в сторис";
    $("#share-cta").dataset.done = "";
    openSheet("share");
  }

  // жест вниз за грэббер
  Object.values(sheets).forEach((sheet) => {
    const handle = $(".sheet__handle", sheet);
    let y0 = null;
    let dy = 0;
    let t0 = 0;
    handle.addEventListener("pointerdown", (e) => {
      y0 = e.clientY;
      dy = 0;
      t0 = performance.now();
      handle.setPointerCapture(e.pointerId);
      sheet.classList.add("is-dragging");
    });
    handle.addEventListener("pointermove", (e) => {
      if (y0 == null) return;
      dy = Math.max(0, e.clientY - y0);
      sheet.style.transform = `translateY(${dy}px)`;
    });
    const end = () => {
      if (y0 == null) return;
      sheet.classList.remove("is-dragging");
      const v = dy / Math.max(1, performance.now() - t0);
      y0 = null;
      if (dy + v * 200 > sheet.offsetHeight * 0.35) closeSheet();
      else sheet.style.transform = "";
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  });

  /* ── события ─────────────────────────────────────────────────────────── */

  app.addEventListener("click", (e) => {
    const t = e.target.closest("button, [data-go], [data-act]");
    if (!t || !app.contains(t)) return;
    const cell = t.closest(".av-cell");
    if (cell) {
      const i = Number(cell.dataset.day);
      if (cellState(i) === "frozen") {
        cell.classList.remove("is-shaking");
        void cell.offsetWidth;
        cell.classList.add("is-shaking");
        announce(`${dayName(D.DAYS[i])} ещё закрыто`);
        return;
      }
      openDay(i, cell);
      return;
    }
    if (t.dataset.go === "game") return push("game");
    if (t.dataset.go === "draw") return push("draw");
    if (t.dataset.claim) return claim(t.dataset.claim, t.closest(".av-task") || t);
    if (t.dataset.do) return doTask(t.dataset.do);
    switch (t.dataset.act) {
      case "back": return pop();
      case "exit": return undefined;                // выход из адвента – в приложение (вне задачи)
      case "open-stat": return openStat();
      case "close-stat": return closeStat();
      default:
    }
    if (t.id === "stat-share") return t.dataset.mode === "crack" ? crackCookie() : openShare();
    if (t.dataset.act === "crack") return crackCookie();
    if (t.id === "share-cta") {
      // на телефоне – системный «поделиться»; задание дня выполнено
      if (currentDay === S.today && S.days[currentDay].share === "todo") S.days[currentDay].share = "done";
      t.dataset.done = "1";
      $("#share-cta-label").textContent = "готово";
      setTimeout(() => closeSheet(), 600);
      return;
    }
    window.AV_GAME.click(t, gameCtx());
  });

  $("#scrim").addEventListener("click", () => closeSheet());

  document.addEventListener("keydown", (e) => {
    if (e.key === "Tab") document.documentElement.classList.add("kb");
    if (e.key !== "Escape") return;
    if (openSheetName) return closeSheet();
    if (stack.length > 1) pop();
  });
  document.addEventListener("pointerdown", () => document.documentElement.classList.remove("kb"));

  // свайп от левого края – назад
  (() => {
    let x0 = null;
    app.addEventListener("pointerdown", (e) => {
      const r = app.getBoundingClientRect();
      x0 = e.clientX - r.left < 20 && stack.length > 1 && !openSheetName ? e.clientX : null;
    });
    app.addEventListener("pointerup", (e) => {
      if (x0 != null && e.clientX - x0 > 80) pop();
      x0 = null;
    });
  })();

  /* ── пульт ───────────────────────────────────────────────────────────── */

  const panel = $(".panel");

  function resetTo(idx) {
    window.AV_GAME.cancel();
    preset(idx);
    // любые открытые экраны – назад в календарь
    while (stack.length > 1) screens[stack.pop()].hidden = true;
    if (openSheetName) closeSheet(true);
    show("home");
    renderHome();
    // сегодня всегда на первом экране: календарь докручен до него
    const scroller = $("#home-scroll");
    scroller.scrollTop = 0;
    const today = $(`.av-cell[data-day="${S.today}"]`, scroller);
    // докручиваем, только если сегодня не видно на первом экране
    if (today && today.offsetTop + today.offsetHeight > scroller.clientHeight - 40) {
      scroller.scrollTop = today.offsetTop + today.offsetHeight / 2 - scroller.clientHeight * 0.45;
    }
    syncPanel();
  }

  function syncPanel() {
    $("#panel-date").textContent = dayName(D.DAYS[S.today]);
    $$("[data-toggle]", panel).forEach((b) => b.setAttribute("aria-checked", String(!!S[b.dataset.toggle])));
  }

  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.panelDate) return resetTo(D.DAYS.findIndex((d) => d.date === b.dataset.panelDate));
    if (b.dataset.toggle) {
      S[b.dataset.toggle] = !S[b.dataset.toggle];
      syncPanel();
      if (current() === "stat") renderStat();
      return;
    }
    switch (b.dataset.panel) {
      case "prev": return resetTo(Math.max(0, S.today - 1));
      case "next": return resetTo(Math.min(D.DAYS.length - 1, S.today + 1));
      case "flakes": S.balance += 500; break;
      case "zero": S.balance = 0; break;
      case "almost": S.beaten = D.RIVALS.slice(0, 4).map((r) => r.who); S.star = false; break;
      case "empty-pool": S.taken = D.POOL.map((p) => p.id); break;
      case "reset": S.empty = false; S.vip = false; return resetTo(8);
      default:
    }
    renderBalance();
    RENDER[current()]?.({});
  });

  /* ── состояния для раскладки states.html и ссылок ?state=<id> ─────────── */

  /** Без анимаций: стопка экранов как после переходов */
  function jump(names) {
    if (openSheetName) closeSheet(true);
    Object.values(screens).forEach((el) => { el.hidden = true; el.getAnimations().forEach((a) => a.cancel()); });
    stack.length = 0;
    names.forEach((n) => stack.push(n));
    const top = names[names.length - 1];
    RENDER[top]?.({});
    if (top === "stat") renderStat();
    show(top);
  }

  const dayIdx = (date) => D.DAYS.findIndex((d) => d.date === date);
  const prizeById = (id) => D.POOL.find((p) => p.id === id);

  let stateTimer = 0;

  function showState(id) {
    clearTimeout(stateTimer);
    fx?.stop();
    fx = window.BlinkSky ? window.BlinkSky.start($("#fx"), { mode: "none" }) : null;
    S.empty = false;
    S.vip = false;
    const [kind, arg] = id.split(":");
    switch (kind) {
      case "home-first": resetTo(0); break;
      case "home": resetTo(8); break;
      case "home-late": resetTo(dayIdx("05.01")); break;
      case "home-end": resetTo(dayIdx("11.01")); break;
      case "day-today": resetTo(8); currentDay = 8; jump(["home", "day"]); break;
      case "day-claimed":
        resetTo(8); currentDay = 8;
        Object.assign(S.days[8], { login: "claimed", task: "done" });
        S.balance += D.ECONOMY.login;
        jump(["home", "day"]);
        break;
      case "day-past": resetTo(8); currentDay = 2; jump(["home", "day"]); break;
      case "day-boost": resetTo(dayIdx("31.12")); currentDay = S.today; jump(["home", "day"]); break;
      case "day-prediction": resetTo(dayIdx("05.01")); currentDay = S.today; jump(["home", "day"]); break;
      case "stat":
      case "empty":
      case "vip":
      case "cracked":
        resetTo(D.DAYS.length - 1);
        currentDay = dayIdx(arg);
        S.empty = kind === "empty";
        S.vip = kind === "vip";
        if (kind === "cracked") S.days[currentDay].cracked = true;
        jump(["home", "day", "stat"]);
        break;
      case "share": resetTo(8); currentDay = 8; jump(["home", "day", "stat"]); openShare(); break;
      case "game-first": resetTo(0); S.balance = D.ECONOMY.login; S.stake = D.ECONOMY.stakes[0]; jump(["home", "game"]); break;
      case "game": resetTo(8); S.balance = 640; jump(["home", "game"]); break;
      case "game-high": resetTo(8); S.balance = 640; S.stake = 500; jump(["home", "game"]); break;
      case "game-poor": resetTo(8); S.balance = 20; S.stake = D.ECONOMY.stakes[0]; jump(["home", "game"]); break;
      case "game-four": resetTo(dayIdx("05.01")); S.balance = 460; S.beaten = D.RIVALS.slice(0, 4).map((r) => r.who); jump(["home", "game"]); break;
      case "game-empty": resetTo(dayIdx("09.01")); S.taken = D.POOL.map((p) => p.id); S.balance = 180; jump(["home", "game"]); break;
      case "duel": resetTo(8); S.balance = 340; jump(["home", "game"]); window.AV_GAME.setView(gameCtx(), "duel", { stake: 300 }); break;
      case "duel-chant":
        resetTo(8);
        S.balance = 340;
        jump(["home", "game"]);
        window.AV_GAME.setView(gameCtx(), "duel", { stake: 300 });
        window.AV_GAME.playRound(gameCtx(), "scissors", "paper");     // снимок ловит «камень… ножницы…»
        break;
      case "duel-win-round":
      case "duel-lose-round": {
        resetTo(8);
        S.balance = 340;
        jump(["home", "game"]);
        window.AV_GAME.setView(gameCtx(), "duel", { stake: 300, me: kind === "duel-win-round" ? 0 : 1, them: kind === "duel-win-round" ? 1 : 0, round: 2 });
        const [me, them] = kind === "duel-win-round" ? ["scissors", "paper"] : ["rock", "paper"];
        window.AV_GAME.playRound(gameCtx(), me, them, { instant: true });
        break;
      }
      case "result-win":
      case "result-lose":
      case "prize": {
        resetTo(8);
        S.balance = 640;
        jump(["home", "game"]);
        const win = kind !== "result-lose";
        const out = window.AV_GAME.resolve(gameCtx(), "natashka", win ? 2 : 1, win ? 1 : 2, 300);
        if (kind === "prize") {
          // на снимке – подарок нужного уровня
          const want = prizeById(arg);
          S.taken[S.taken.indexOf(out.prize.id)] = want.id;
          out.prize = want;
        }
        window.AV_GAME.setView(gameCtx(), "result", { me: win ? 2 : 1, them: win ? 1 : 2, stake: 300, ...out });
        break;
      }
      case "star":
        resetTo(dayIdx("05.01"));
        S.beaten = D.RIVALS.map((r) => r.who);
        S.star = true;
        jump(["home", "game"]);
        openPrize({ ...D.STAR, tier: "legend" }, { star: true });
        break;
      case "pool": resetTo(8); jump(["home", "game"]); openSheet("pool"); break;
      case "draw": resetTo(8); S.tickets = 9; jump(["home", "draw"]); break;
      case "draw-mine": resetTo(8); S.tickets = 4; S.draw = { console: 7, headphones: 3 }; jump(["home", "draw"]); break;
      case "draw-none": resetTo(8); S.tickets = 0; jump(["home", "draw"]); break;
      default: return false;
    }
    renderBalance();
    syncPanel();
    return true;
  }

  /* ── старт ───────────────────────────────────────────────────────────── */

  const sky = window.BlinkSky ? window.BlinkSky.start($("#sky"), { mode: "snow" }) : null;
  const statSky = window.BlinkSky ? window.BlinkSky.start($("#stat-sky"), { mode: "snow" }) : null;
  // конфетти цветами системы – поверх всего: победа в цу-е-фа и золотая звезда
  let fx = window.BlinkSky ? window.BlinkSky.start($("#fx"), { mode: "none" }) : null;
  app.addEventListener("av:confetti", () => {
    const colors = getComputedStyle(app).getPropertyValue("--confetti-colors").split(",").map((c) => c.trim());
    fx?.confetti(colors);
  });

  // низкий телефон (SE, 667): карточка статистики сжимается целиком, а не наезжает на кнопку
  function fitPhone() {
    const h = app.clientHeight || 844;
    app.style.setProperty("--av-fit", String(Math.min(1, h / 844)));
    app.style.setProperty("--board-fit", String(Math.min(1, (h - (h < 720 ? 434 : 470)) / 300)));
  }
  window.addEventListener("resize", fitPhone);
  fitPhone();

  function fitStage() {
    const zoom = Math.min(1, (window.innerHeight - 40) / 900);
    document.documentElement.style.setProperty("--stage-zoom", window.innerWidth > 700 ? String(Math.max(0.6, zoom)) : "1");
  }
  window.addEventListener("resize", fitStage);
  fitStage();

  resetTo(8);
  const asked = new URLSearchParams(location.search).get("state");
  if (asked) showState(asked);

  // для снимков состояний и проверок
  window.AV = {
    S, D, stack, screens, openDay: (i) => openDay(i, $(`.av-cell[data-day="${i}"]`)), openStat, closeStat,
    push, pop, resetTo, renderHome, renderDay, openSheet, closeSheet, openShare, current, sky, GAME_ON,
    setDay: (i) => { currentDay = i; }, showState, openPrize, takeTier, gameCtx,
  };
})();
