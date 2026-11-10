/*
 * Адвент: календарь, день, карточка статистики, «новогодняя гирлянда» и розыгрыш в одном телефоне + пульт.
 * Данные – av-data.js, карточки статистики – av-cards.js, общая выдача и розыгрыш – av-game.js, активная хваталка и сцены – av-journey.js.
 * Переходы: календарь → день – предмет дня летит из клетки в шапку дня (как в видео-референсе),
 * остальные клетки гаснут; день → карточка – снизу на весь экран; гирлянда и розыгрыш – справа.
 */
(() => {
  "use strict";

  const D = window.AV_DATA;
  const J = window.AV_JOURNEY;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ASSETS = "../../assets";
  const NBSP = String.fromCharCode(160);
  const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INTRO_KEY = "blink:newyear:2026:intro-seen";
  const introWasSeen = () => { try { return localStorage.getItem(INTRO_KEY) === "1"; } catch { return false; } };

  const app = $("#app");

  // Игра и розыгрыш доступны на всех хостах; ?nogame оставляет только календарь.
  const GAME_ON = !new URLSearchParams(location.search).has("nogame");
  if (!GAME_ON) {
    app.classList.add("av--no-game");
    $$(".av-balance[data-go]").forEach((b) => {
      b.removeAttribute("data-go");
      b.tabIndex = -1;
      b.setAttribute("aria-label", "жетоны");
    });
    $("#panel-tree")?.closest(".panel__group")?.setAttribute("hidden", "");
    const lead = $(".stage__lead");
    if (lead) lead.textContent = "14 декабря – 11 января: каждый день карточка о твоём годе или предсказание на 2027 и жетоны за вход и задания";
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
    introSeen: introWasSeen(),
    today: 8,              // индекс «сегодня» в DAYS (22.12)
    balance: 0,
    tickets: 0,
    days: [],              // по дням: login, task, share – "todo" | "done" | "claimed" | "missed"; seen
    taken: [],             // id полученных подарков
    garland: { attempts: 0 },   // раунды за день
    clock: "16:48",        // время на телефоне: до новых попыток (00:00) – 7 ч 12 мин
    events: [],            // аналитика: garland_open, garland_start, garland_finish…
    star: false,           // рамка за всю коллекцию
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

  /** Состояние на любой «сегодня»: прошлые дни частично собраны, часть бросков сделана */
  function preset(todayIdx) {
    const R = rng(todayIdx * 31 + 7);
    S.today = todayIdx;
    S.calendarMonth = J.atHome(todayIdx) ? "home" : "train";
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
    S.days.forEach((state,i) => { state.memory = i < todayIdx ? (state.seen ? "claimed" : "missed") : "todo"; if (J.atHome(i)) { state.memory="missed"; state.login="missed"; state.task="missed"; state.share="missed"; state.cracked=state.seen; } state.partners = {}; });
    let earned = 0;
    S.days.forEach((d, i) => {
      if (J.atHome(i)) return;
      const k = D.DAYS[i].task.boost || 1;
      if (d.login === "claimed") earned += D.ECONOMY.login;
      if (d.task === "claimed") earned += D.DAYS[i].task.reward * k;
      if (d.share === "claimed") earned += D.ECONOMY.share;
      if (d.memory === "claimed") earned += D.ECONOMY.memory;
    });
    S.taken = [];
    S.scoreRewards = {};
    S.wheelRecent = [];
    S.garland = { attempts: 0 };
    S.events = [];
    S.star = false;
    S.tickets = 0;
    S.draw = {};
    S.balance = earned;
    if (todayIdx > 0) {
      // Демонстрационная история: по одному открытому подарку в активный день.
      const ctx = { S, D };
      for (let i = 0; i < Math.min(18, todayIdx) && S.balance >= D.ECONOMY.attempt + 40; i++) {
        const prize = window.AV_GAME.choose(ctx, R);
        if (!prize) break;
        S.balance -= D.ECONOMY.attempt;
        window.AV_GAME.settle(ctx, { prizeId: prize.id });
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
    board: $("#screen-board"),
    draw: $("#screen-draw"),
  };
  const stack = ["home"];
  let busy = false;
  let currentDay = S.today;

  const current = () => stack[stack.length - 1];

  function anim(el, frames, opts) {
    if (!el) return Promise.resolve();
    const a = el.animate(frames, { duration: 280, easing: EASE, fill: "both", ...opts, ...(reduced() ? { duration: 1, delay: 0 } : {}) });
    return a.finished.then(() => a);
  }

  function show(name) {
    screens[name].hidden = false;
    app.dataset.screen = name;
  }

  /** Экран справа (гирлянда, розыгрыш), под ним предыдущий уходит влево на 30 % */
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
    if (name === "game") window.AV_GAME.pause();
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
    const idx=D.DAYS.indexOf(day), seen=S.days[idx]?.seen;
    fly.innerHTML = day.prediction ? `<img class="av-fly__obj" src="${J.A(seen ? "cookie" : "stocking")}" alt="">` : J.art(day,idx,seen,src);
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
    if (busy || i > S.today) return;
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
    const els = $$(".av-cell, .av-today, .av-entries, .av-home-tasks, .av-calendar__head, .av-bar, .av-dock", screens.home).filter((el) => el !== keep);
    els.forEach((el) => anim(el, [{ opacity: from }, { opacity: to }], { duration: 240, delay }));
    if (keep) $$(".av-cell__date, .badge-star, .av-cell__dot, .av-today__copy, .av-today__open", keep).forEach((el) => anim(el, [{ opacity: from }, { opacity: to }], { duration: 160, delay }));
  }

  function resetHomeFade() {
    $$(".av-cell, .av-today, .av-entries, .av-home-tasks, .av-calendar__head, .av-bar, .av-dock, .av-cell__date, .badge-star, .av-cell__dot, .av-today__copy, .av-today__open", screens.home).forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel());
      el.style.opacity = "";
    });
    $$(".av-cell__art", screens.home).forEach((el) => { el.style.visibility = ""; });
  }

  async function closeDay() {
    if (busy) return;
    if (name === "game") window.AV_GAME.pause();
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
    const from = current();
    if (!D.DAYS[currentDay].prediction || S.days[currentDay].cracked) S.days[currentDay].seen = true;
    if (!D.DAYS[currentDay].prediction) completeTask("memory", currentDay, { animate: false, refresh: false });
    renderStat();
    show("stat");
    stack.push("stat");
    const prediction = Boolean(D.DAYS[currentDay].prediction);
    if (prediction && !S.days[currentDay].cracked) {
      $("#stat-share").closest("footer").classList.add("is-opening");
      $("#stat-share").closest("footer").inert = true;
    }
    await anim(screens.stat, prediction ? [{ opacity: 0 }, { opacity: 1 }] : [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], { duration: prediction ? 280 : 380 }).then((a) => a.cancel());
    window.AV_CARDS.enter($("#stat-card"));
    screens[from].hidden = true;
    busy = false;
    focusScreen("stat");
    if (prediction && !S.days[currentDay].cracked) crackCookie();
  }

  async function closeStat() {
    if (busy) return;
    window.AV_CARDS.cancel?.();
    busy = true;
    stack.pop();
    const back = current();
    RENDER[back]?.({ refresh: true });
    show(back);
    const prediction = Boolean(D.DAYS[currentDay].prediction);
    await anim(screens.stat, prediction ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: "translateY(0)" }, { transform: "translateY(100%)" }], { duration: prediction ? 240 : 320 }).then((a) => a.cancel());
    screens.stat.hidden = true;
    busy = false;
    if (back === "home" && !prediction && document.documentElement.classList.contains("kb")) $("#home-tasks [data-act='task-memory']")?.focus({ preventScroll: true });
    else focusScreen(back);
  }

  function openTodayStat() {
    if (busy) return;
    currentDay = S.today;
    return openStat();
  }

  /* ── 1. календарь ────────────────────────────────────────────────────── */

  function cellState(i) {
    if (i > S.today) return "frozen";
    if (i === S.today) return "today";
    return "open";
  }

  /** Сколько заданий дня ещё не выполнено. */
  function waiting(i) {
    const d = S.days[i];
    return ["memory", "task", "share"].filter((k) => d[k] === "todo" || d[k] === "done").length;
  }

  function renderHome() {
    const day = D.DAYS[S.today], home = J.atHome(S.today), seen = S.days[S.today].seen;
    app.dataset.phase = home ? "home" : "train";
    $("#home-scene").src = J.A(home ? "living-room" : "train-window");
    if (!home) {
      const view = J.landscape(S.today), panorama = $(".ex-cabin__landscape");
      panorama.dataset.landscape = view;
      panorama.style.setProperty("--journey-landscape-delay", `-${(S.today % 6) * 12}s`);
      $$("img", panorama).forEach(image => { if (image.getAttribute("src") !== view) image.src = view; });
    }
    $("#home-title").textContent = "новый год";
    $("#home-today").hidden = !home;
    $("#home-today").classList.toggle("is-seen", seen);
    $("#home-today").innerHTML = J.hero({ day, i: S.today, seen, src });
    // The train uses a compact task panel; the room keeps its existing scene controls.
    if (home) $(".ex-cabin").append($("#home-entries"));
    else $("#home-tasks").after($("#home-entries"));
    $("#home-entries").innerHTML = J.entries(S, D, plural);
    $("#home-tasks").hidden = home;
    $("#home-task-list").innerHTML = home ? "" : tasksMarkup(S.today, { home: true });
    renderCalendar();
    renderBalance();
  }

  function renderCalendar() {
    const month = S.calendarMonth, home = J.atHome(S.today), jan = month === "home";
    $("#calendar-title").textContent = jan ? "январские вечера" : home ? "твой 2026" : "остановки маршрута";
    $("#calendar-switch").hidden = !home;
    $("#calendar-switch").textContent = jan ? "2026" : "январь";
    $("#calendar-switch").dataset.calendar = jan ? "train" : "home";
    const days = D.DAYS.map((day, i) => ({day,i})).filter(({i}) => J.atHome(i) === jan);
    $("#calendar").innerHTML = `<div class="av-grid" role="group" aria-label="${jan ? "дни января" : "остановки декабря"}">${days.map(({day,i}) => cellMarkup(day,i)).join("")}</div>`;
    const rail = $(".av-grid", $("#calendar")), active = $(".is-today", rail);
    if (active) rail.scrollLeft = Math.max(0, active.offsetLeft - rail.offsetLeft - (rail.clientWidth - active.clientWidth) / 2);
  }

  const COLS = 3;                                     // три дня в ряд: крупнее и спокойнее

  // полка под каждым рядом; клетки и полки стоят в сетке явно, полка – под предметами
  function ledges() {
    const rows = Math.ceil(D.DAYS.length / COLS);
    return Array.from({ length: rows }, (_, r) => `<span class="av-ledge" style="grid-row:${r + 1}" aria-hidden="true"></span>`).join("");
  }

  function cellMarkup(day, i) {
    const st = cellState(i), d = S.days[i];
    const label = `${dayName(day)}, ${st === "frozen" ? "ещё закрыто" : day.title}${st === "today" ? ", сегодня" : ""}${st === "open" && !d.seen ? ", не просмотрено" : ""}`;
    return `<button class="av-cell is-${st}${d.seen?' is-viewed':''} pressable" type="button" data-day="${i}" aria-disabled="${st === "frozen"}" aria-label="${label}"><span class="av-cell__art">${J.art(day,i,d.seen,src)}</span><span class="av-cell__date">${st === "today" ? "сегодня" : day.date}</span>${d.seen?'<span class="av-cell__viewed" aria-label="просмотрено"><i class="icon icon--check" aria-hidden="true"></i></span>':st === "open" ? '<span class="av-cell__dot" aria-hidden="true"></span>' : ""}</button>`;
  }

  function renderBalance() {
    $$("[data-balance]").forEach((el) => { el.textContent = fmt(S.balance); });
    $$("[data-tickets]").forEach((el) => { el.textContent = fmt(S.tickets); });
    $$(".av-wallet [data-go]").forEach(el => el.setAttribute("aria-label", el.dataset.go === "draw" ? `${fmt(S.tickets)} ${plural(S.tickets, "билет", "билета", "билетов")}, в розыгрыш` : `${fmt(S.balance)} жетонов, к хваталке`));
  }

  /* ── 2. день ─────────────────────────────────────────────────────────── */

  function renderDay() {
    const i = currentDay;
    const day = D.DAYS[i];
    const isToday = i === S.today;
    $("#day-date").textContent = dayName(day);
    screens.day.dataset.phase = day.prediction ? "home" : "train";
    $("#day-slot").innerHTML = day.prediction ? `<img class="av-day__obj" src="${J.A(S.days[i].seen ? "cookie" : "stocking")}" alt="">` : `<div class="av-day__obj">${J.art(day,i,S.days[i].seen,src)}</div>`;
    $("#day-glow").src = objSrc(day);
    const rows = taskRows(day);
    $("#day-body").innerHTML = `
      <div class="av-day__head">
        <h2 class="av-day__title" id="day-title">${day.title}</h2>
        <p class="av-day__lead">${day.lead}</p>
      </div>
      <button class="button button--primary av-day__cta pressable" type="button" data-act="open-stat">${day.prediction ? "открыть предсказание" : "смотреть"}</button>
      ${day.prediction ? "" : `<h3 class="av-day__section caps-label"><span>${isToday ? "жетоны дня" : "жетоны этого дня"}</span><span>${rows.reduce((t, r) => t + r.reward, D.PARTNERS[i % D.PARTNERS.length].reward)}</span></h3>${tasksMarkup(i)}`}`;
    renderBalance();
  }

  function taskRows(day) {
    const k = day.task.boost || 1;
    return [
      { key: "memory", title: "воспоминание дня", description: "твоя статистика за 2026", reward: D.ECONOMY.memory },
      { key: "login", title: "ежедневный вход", description: "просто открой blink", instruction: "жетоны начисляются за первый вход в blink за день", reward: D.ECONOMY.login },
      { key: "task", title: day.task.title, description: day.task.description, instruction: day.task.instruction, reward: day.task.reward * k },
      { key: "share", title: day.prediction ? "поделись предсказанием" : "поделись карточкой", description: "открой карточку и отправь её в сторис", instruction: day.prediction ? "открой предсказание, разломи печенье и нажми «поделиться». Отправь карточку в сторис." : "открой сегодняшнюю карточку, нажми «поделиться» и отправь её в сторис", reward: D.ECONOMY.share },
    ];
  }

  function tasksMarkup(i, { home = false } = {}) {
    const flake = `<img class="av-task__flake" src="art/coin.webp" alt="жетонов">`;
    const rows = taskRows(D.DAYS[i]).filter(r => !home || r.key !== "login");
    const dailyPartner = !J.atHome(i) ? D.PARTNERS[i % D.PARTNERS.length] : null;
    return `<ul class="av-tasks">${rows.map(r => taskRow(r, S.days[i][r.key], flake, i)).join("")}${dailyPartner ? partnerRow(dailyPartner, i, flake) : ""}</ul>`;
  }

  function taskRow(r, state, flake, i) {
    const done = state === "claimed", memory = r.key === "memory", seen = S.days[i].seen;
    const available = i === S.today && state !== "missed";
    const status = done ? '<span class="av-task__state" role="img" aria-label="выполнено"><i class="icon icon--check" aria-hidden="true"></i></span>' : "";
    const attrs = r.partner && available ? `data-partner-help="${r.partner.id}" data-task-day="${i}"` : memory && i <= S.today ? `data-act="task-memory" data-task-day="${i}"`
      : available ? `data-task-help="${r.key}" data-task-day="${i}"` : '';
    const label = memory ? `${seen ? 'посмотреть статистику ещё раз' : 'смотреть статистику дня'}, ${r.reward} жетонов${done ? ' уже начислено' : ' за просмотр'}`
      : `инструкция: ${r.title}, ${r.reward} жетонов${done ? ' уже начислено' : ' за выполнение'}`;
    const action = attrs ? `<button class="av-task__reward-action pressable" type="button" ${attrs} aria-label="${label}"><span>${r.reward}</span>${flake}<i class="icon icon--chevron" aria-hidden="true"></i></button>`
      : `<span class="av-task__reward av-task__reward--expired"><span>${r.reward}</span>${flake}</span>`;
    const description = done ? memory ? 'карточка просмотрена' : 'задание выполнено' : state === 'missed' ? 'день прошёл' : r.description;
    return `<li class="av-task${memory ? " av-task--memory" : ""}${r.partner ? " av-task--partner" : ""}${done ? " is-done" : ""}" data-row="${r.key}">
      ${r.partner ? `<img class="av-task__partner-logo" src="${r.partner.logo}" alt="${r.partner.name}">` : ""}<div class="av-task__copy"><span class="av-task__heading"><span class="av-task__text">${r.title}</span>${status}</span><span class="av-task__description">${description}</span></div>
      ${action}
    </li>`;
  }

  function partnerState(partner, i) {
    return S.days[i].partners?.[partner.id] || (i < S.today || J.atHome(i) ? "missed" : "todo");
  }

  function partnerRow(partner, i, coin = '<img class="av-task__flake" src="art/coin.webp" alt="жетонов">') {
    return taskRow({ ...partner, key: `partner-${partner.id}`, partner }, partnerState(partner, i), coin, i);
  }

  function renderPartners() {
    $("#partner-task-list").innerHTML = `<ul class="av-tasks">${D.PARTNERS.map(partner => partnerRow(partner, S.today)).join("")}</ul>`;
    const allDone = D.PARTNERS.every(p => partnerState(p, S.today) === "claimed");
    $(".av-partners__lead").textContent = allDone ? "все награды за сегодня уже у тебя" : "ещё 30 жетонов за каждое задание";
  }

  function openPartners() {
    if (busy || J.atHome(S.today)) return;
    renderPartners();
    openSheet("partners");
  }

  // A verified application/partner callback grants the reward; reading instructions never does.
  function completePartner(id, i) {
    const partner = D.PARTNERS.find(p => p.id === id);
    if (!partner || i !== S.today || J.atHome(i) || partnerState(partner, i) !== "todo") return false;
    S.days[i].partners[id] = "claimed";
    S.balance += partner.reward;
    S.events.push({ name: "newyear_partner_complete", partner: id, day: D.DAYS[i].date, amount: partner.reward });
    renderBalance();
    $("#home-task-list").innerHTML = tasksMarkup(S.today, { home: true });
    if (current() === "day") renderDay();
    if (current() === "game") RENDER.game();
    if (openSheetName === "partners") renderPartners();
    if (openSheetName === "task" && taskHelp.partner === id) renderTaskHelp();
    announce(`+${partner.reward} жетонов`);
    return true;
  }

  /** Завершение приходит от действия, а не от открытия инструкции. Состояние и баланс меняются атомарно. */
  function completeTask(key, i = S.today, { animate = true, refresh = true } = {}) {
    if (!["login", "memory", "task", "share"].includes(key) || i !== S.today || J.atHome(i)) return false;
    const state = S.days[i];
    if (!state || state[key] === "claimed" || state[key] === "missed") return false;
    if (key === "memory" && !state.seen) return false;
    const amount = taskRows(D.DAYS[i]).find((r) => r.key === key).reward;
    state[key] = "claimed";
    S.balance += amount;
    S.events.push({ name: "newyear_task_complete", day: D.DAYS[i].date, key, amount });
    renderBalance();
    const fromEl = $(`[data-row="${key}"]`, screens[current()]);
    const target = $("[data-balance]", screens[current()])?.closest(".av-balance");
    if (animate && fromEl && target && (current() !== "day" || currentDay === i)) flyFlakes(fromEl, target, 6).then(() => {
      target.classList.remove("is-bump");
      void target.offsetWidth;
      target.classList.add("is-bump");
    });
    if (refresh) {
      $("#home-task-list").innerHTML = tasksMarkup(S.today, { home: true });
      if (current() === "day") renderDay();
      if (openSheetName === "task") renderTaskHelp();
      const cell = $(`.av-cell[data-day="${i}"]`);
      if (cell) cell.outerHTML = cellMarkup(D.DAYS[i], i);
    }
    if (animate) announce(`+${amount} жетонов`);
    return true;
  }

  function flyFlakes(fromEl, toEl, count = 6, img = "art/coin.webp", size = 26) {
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
    window.AV_CARDS.cancel?.();
    const day = D.DAYS[currentDay];
    screens.stat.dataset.phase = day.prediction ? "home" : "train";
    $("#stat-card").innerHTML = window.AV_CARDS.render(day, cardCtx());
    syncStatButton();
  }

  /** У предсказания, пока печенье целое, кнопка внизу – «разломить», потом – «поделиться» */
  function syncStatButton() {
    const day = D.DAYS[currentDay];
    const crack = Boolean(day.prediction && !S.days[currentDay].cracked);
    const b = $("#stat-share");
    b.disabled = false;
    b.closest("footer").classList.remove("is-opening");
    b.closest("footer").inert = false;
    b.dataset.mode = crack ? "crack" : "share";
    $("i", b).hidden = crack;
    $("span", b).textContent = crack ? "открыть предсказание" : "поделиться";
  }

  function crackCookie() {
    const i = currentDay, state = S.days[i];
    const button = $("#stat-share");
    if (state.cracked || button.disabled) return;
    button.disabled = true;
    button.closest("footer").classList.add("is-opening");
    button.closest("footer").inert = true;
    window.AV_CARDS.crack($("#stat-card"), () => {
      if (S.days[i] !== state) return;
      state.cracked = true;
      if (current() === "stat" && currentDay === i) {
        state.seen = true;
        syncStatButton();
        announce(D.DAYS[i].prediction);
      }
    });
  }

  /* ── 4–5. хваталка и розыгрыш ────────────────────────────────────── */

  const RENDER = {
    game: () => window.AV_GAME.render($("#game"), gameCtx()),
    board: () => window.AV_GAME.renderBoard($("#board"), gameCtx()),
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
      openPartners,
      toHome: () => { goToday(); },
      toDraw: () => push("draw"),
      toTree: () => push("game"),
      openBoard: () => push("board"),
      openStory: (markup) => openShare(markup),
    };
  }

  function goToday() {
    // Задания сегодняшнего дня теперь сразу на главной.
    while (stack.length > 1) {
      const name = stack.pop();
      screens[name].hidden = true;
    }
    renderHome();
    show("home");
    currentDay = S.today;
    if (J.atHome(S.today)) $("#home-scroll").scrollTop = 0;
    else scrollHomeTo($("#home-tasks"));
  }

  function scrollHomeTo(element) {
    const scroll = $("#home-scroll");
    scroll.scrollTop = Math.max(0, scroll.scrollTop + element.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 24);
  }

  function renderDraw() {
    window.AV_GAME.renderDraw($("#draw"), gameCtx());
    renderBalance();
  }

  /* ── шторки ──────────────────────────────────────────────────────────── */

  const sheets = { intro: $("#sheet-intro"), prize: $("#sheet-prize"), pool: $("#sheet-pool"), share: $("#sheet-share"), task: $("#sheet-task"), partners: $("#sheet-partners") };
  let openSheetName = null;
  let sheetReturn = null;
  let taskHelp = { key: "task", day: 0 };
  let partnerHelpReturn = false;

  function renderTaskHelp() {
    const partner = taskHelp.partner && D.PARTNERS.find(p => p.id === taskHelp.partner);
    const row = partner || taskRows(D.DAYS[taskHelp.day]).find((r) => r.key === taskHelp.key);
    const done = partner ? partnerState(partner, taskHelp.day) === "claimed" : S.days[taskHelp.day][taskHelp.key] === "claimed";
    const brand = $("#task-help-brand");
    brand.hidden = !partner;
    brand.innerHTML = partner ? `<img src="${partner.logo}" alt=""><span>${partner.name}</span>` : "";
    $("#task-help-title").textContent = row.title;
    $("#task-help-text").textContent = row.instruction;
    $("#task-help-reward").innerHTML = `<span>${row.reward}<img class="av-task__flake" src="art/coin.webp" alt="жетонов"></span><span>${done ? "уже начислено" : "начислим автоматически"}</span>`;
    const action = $("#task-help-action");
    action.textContent = partner ? done ? current() === "game" ? "к хваталке" : "понятно" : partner.action : taskHelp.key === "share" && !done ? "смотреть" : "понятно";
    action.dataset.partner = partner && !done ? partner.id : "";
    action.dataset.card = String(taskHelp.key === "share" && !done);
  }

  function openTaskHelp(key, i) {
    if (!D.DAYS[i] || !["login", "task", "share"].includes(key)) return;
    taskHelp = { key, day: i };
    renderTaskHelp();
    openSheet("task");
  }

  function openPartnerHelp(id, i) {
    if (busy || !Number.isInteger(i) || i !== S.today || J.atHome(i) || !D.PARTNERS.some(p => p.id === id)) return;
    const fromList = openSheetName === "partners";
    taskHelp = { key: "partner", partner: id, day: i };
    renderTaskHelp();
    openSheet("task");
    partnerHelpReturn = fromList;
  }

  function openSheet(name) {
    if (openSheetName) closeSheet(true);
    openSheetName = name;
    sheetReturn = document.activeElement;
    if (name === "partners") renderPartners();
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
    if (was === "intro") {
      S.introSeen = true;
      try { localStorage.setItem(INTRO_KEY, "1"); } catch { /* In-memory state still prevents repeat onboarding. */ }
      if (!silent) $("#home-tasks [data-act='task-memory']")?.focus({ preventScroll: true });
    }
    if (was !== "intro" && !silent) {
      const fallback = taskHelp.partner ? $(`[data-partner-help="${taskHelp.partner}"], [data-game="claw-grab"]`, screens[current()]) : null;
      const returnIsVisible = sheetReturn && document.contains(sheetReturn) && !sheetReturn.closest(".sheet:not(.is-open), .av-screen[hidden]");
      const restore = returnIsVisible ? sheetReturn : fallback;
      restore?.focus({ preventScroll: true });
    }
    if (was === "prize") window.AV_GAME.afterPrize(gameCtx());
    if (was === "task" && partnerHelpReturn) {
      partnerHelpReturn = false;
      if (!silent && !J.atHome(S.today)) openSheet("partners");
    }
  }

  function openPrize(prize, extra) {
    $("#prize-body").innerHTML = window.AV_GAME.prizeMarkup(prize, extra, gameCtx());
    openSheet("prize");
    window.AV_GAME.prizeEnter(prize, extra, gameCtx());
  }

  // что в шторке «поделиться»: карточка дня (задание «поделись») или подарок из гирлянды
  let shareKind = "day";

  function openShare(markup) {
    const day = D.DAYS[currentDay];
    shareKind = markup ? "garland" : "day";
    $("#share-story").innerHTML = `<div class="av-share__page">${markup || window.AV_CARDS.render(day, { ...cardCtx(), story: true })}</div>`;
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
    if (t.dataset.calendar) {
      S.calendarMonth = t.dataset.calendar;
      renderCalendar();
      if (t.closest(".av-entries")) scrollHomeTo($(".av-calendar"));
      return;
    }
    if (t.dataset.act === "journey-collection") return openSheet("pool");
    if (t.dataset.act === "intro-done") return closeSheet();
    if (t.dataset.act === "task-memory") {
      const i = Number(t.dataset.taskDay);
      if (busy || t.closest(".av-screen") !== screens[current()] || !Number.isInteger(i) || !D.DAYS[i] || i > S.today || J.atHome(i)) return;
      currentDay = i;
      return openStat();
    }
    if (t.dataset.act === "open-today") return openTodayStat();
    if (t.dataset.go === "game") return push("game");
    if (t.dataset.push === "garland") {
      // пуш «друг обогнал» – сразу в игру
      S.events.push({ name: "garland_push_open" });
      hidePush();
      return push("game");
    }
    if (t.dataset.go === "draw") return push("draw");
    if (t.dataset.act === "partner-home") { closeSheet(true); return goToday(); }
    if (t.dataset.partnerHelp) return openPartnerHelp(t.dataset.partnerHelp, Number(t.dataset.taskDay));
    if (t.dataset.taskHelp) return openTaskHelp(t.dataset.taskHelp, Number(t.dataset.taskDay));
    if (t.id === "task-help-action") {
      if (t.dataset.partner) {
        const partner = D.PARTNERS.find(p => p.id === t.dataset.partner);
        if (!partner || taskHelp.day !== S.today || J.atHome(S.today)) return;
        S.events.push({ name: "newyear_partner_open", partner: partner.id, day: D.DAYS[S.today].date });
        window.open(partner.url, "_blank", "noopener,noreferrer");
        return;
      }
      if (taskHelp.partner && current() === "game" && S.balance >= D.ECONOMY.attempt) partnerHelpReturn = false;
      const watch = t.dataset.card === "true";
      closeSheet();
      if (watch) { currentDay = taskHelp.day; return openStat(); }
      return;
    }
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
      if (shareKind === "day") completeTask("share", currentDay, { animate: false });
      t.dataset.done = "1";
      $("#share-cta-label").textContent = "готово";
      setTimeout(() => { if (openSheetName === "share") closeSheet(); }, 600);
      return;
    }
    window.AV_GAME.click(t, gameCtx());
  });

  $("#scrim").addEventListener("click", () => closeSheet());

  window.addEventListener("advent:task-completed", (e) => {
    if (Number.isInteger(e.detail?.day)) completeTask(e.detail.key, e.detail.day);
  });

  window.addEventListener("advent:partner-completed", e => {
    if (Number.isInteger(e.detail?.day)) completePartner(e.detail.id, e.detail.day);
  });

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
    window.AV_CARDS.cancel?.();
    preset(idx);
    completeTask("login", idx, { animate: false, refresh: false });
    // любые открытые экраны – назад в календарь
    while (stack.length > 1) screens[stack.pop()].hidden = true;
    if (openSheetName) closeSheet(true);
    show("home");
    renderHome();
    // Сегодня вынесено в начало: календарь сохраняет все даты без принудительной прокрутки.
    $("#home-scroll").scrollTop = 0;
    syncPanel();
  }

  function syncPanel() {
    $("#panel-date").textContent = dayName(D.DAYS[S.today]);
    $$("[data-toggle]", panel).forEach((b) => b.setAttribute("aria-checked", String(!!S[b.dataset.toggle])));
  }

  panel.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.partnerConfirm) return window.dispatchEvent(new CustomEvent("advent:partner-completed", { detail: { id: b.dataset.partnerConfirm, day: S.today } }));
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
      case "tickets": S.tickets = 30; break;
      case "task-done": return window.dispatchEvent(new CustomEvent("advent:task-completed", { detail: { key: "task", day: S.today } }));
      case "tries": S.garland.attempts = 0; break;
      case "push": return showPush();
      case "almost": S.taken = D.POOL.slice(3).map((p) => p.id); break;
      case "empty-pool": S.taken = D.POOL.map((p) => p.id); break;
      case "reset": S.empty = false; S.vip = false; return resetTo(8);
      default:
    }
    renderBalance();
    RENDER[current()]?.({});
  });

  /* ── пуш «друг обогнал» – не чаще раза в день ──────────────────────────── */

  function showPush() {
    $("#push-text").textContent = "в автомате появился твой новогодний подарок";
    $("#push").classList.add("is-shown");
  }

  function hidePush() {
    $("#push").classList.remove("is-shown");
  }

  /* ── состояния для раскладки states.html и ссылок ?state=<id> ─────────── */

  /** Без анимаций: стопка экранов как после переходов */
  function jump(names) {
    window.AV_CARDS.cancel?.();
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
      case "intro": resetTo(0); S.introSeen = false; openSheet("intro"); break;
      case "train": case "journey-first": case "home-first": resetTo(0); if (!S.introSeen) openSheet("intro"); break;
      case "home-ready": resetTo(0); break;
      case "landscape": {
        const i = dayIdx(arg);
        if (i < 0 || i >= 18) return false;
        resetTo(i);
        break;
      }
      case "home-tasks-done":
        resetTo(0); S.days[0].seen = true;
        ["memory", "task", "share"].forEach(key => completeTask(key, 0, { animate: false, refresh: false }));
        renderHome(); break;
      case "home-seen": resetTo(0); S.days[0].seen = true; completeTask("memory", 0, { animate: false, refresh: false }); renderHome(); break;
      case "home": resetTo(8); break;
      case "fireside": case "home-late": resetTo(dayIdx("05.01")); break;
      case "claw-grabbing":
        resetTo(0); S.balance=60; jump(["home","game"]);
        window.AV_GAME.click({dataset:{game:"claw-grab"}},gameCtx()); break;
      case "claw-prize":
        resetTo(0); S.balance=60; jump(["home","game"]);
        window.AV_GAME.click({dataset:{game:"claw-grab"}},gameCtx()); window.AV_GAME.pause(); RENDER.game(); break;
      case "fireside-seen": resetTo(dayIdx("01.01")); S.days[S.today].cracked=true; S.days[S.today].seen=true; renderHome(); break;
      case "arrival": resetTo(dayIdx("01.01")); break;
      case "fortune-opening": resetTo(dayIdx("01.01")); currentDay = S.today; jump(["home", "stat"]); crackCookie(); break;
      case "claw-closed": resetTo(dayIdx("01.01")); jump(["home","game"]); break;
      case "draw-closed": resetTo(dayIdx("01.01")); jump(["home","draw"]); break;
      case "home-end": resetTo(dayIdx("11.01")); break;
      case "task-help": resetTo(8); openTaskHelp(arg === "share" ? "share" : "task", 8); break;
      case "day-today": resetTo(8); currentDay = 8; jump(["home", "day"]); break;
      case "day-claimed":
        resetTo(8); currentDay = 8;
        completeTask("task", 8, { animate: false, refresh: false });
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
        if (D.DAYS[currentDay].prediction) { S.days[currentDay].cracked = kind === "cracked"; S.days[currentDay].seen = kind === "cracked"; }
        jump(["home", "day", "stat"]);
        break;
      case "share": resetTo(8); currentDay = 8; jump(["home", "day", "stat"]); openShare(); break;
      case "claw": case "wheel": case "garland": case "popper": case "express": case "elka":
        resetTo(8); S.balance = 90; jump(["home", "game"]); break;
      case "garland-wheel": case "garland-score": case "garland-ranking":
        resetTo(kind==='garland-wheel'?8:0); S.balance=90; window.AV_GAME.variant(kind==='garland-wheel'?'wheel':'score'); jump(["home","game"]);
        if(kind==='garland-ranking')window.AV_GAME.click({dataset:{game:'lab-ranking'}},gameCtx()); break;
      case "home-partner-done": resetTo(0); completePartner("music", 0); break;
      case "partner-tasks": resetTo(0); S.balance = 0; jump(["home", "game"]); openPartners(); break;
      case "partner-task": resetTo(0); S.balance = 0; jump(["home", "game"]); openPartners(); openPartnerHelp(arg || "music", 0); break;
      case "partner-done": resetTo(0); S.balance = 0; jump(["home", "game"]); openPartners(); openPartnerHelp("music", 0); completePartner("music", 0); break;
      case "partner-all-done": resetTo(0); D.PARTNERS.forEach(p => completePartner(p.id, 0)); S.balance = 0; jump(["home", "game"]); openPartners(); break;
      case "claw-zero": resetTo(0); S.balance = 0; jump(["home", "game"]); break;
      case "claw-first": case "wheel-first": case "garland-first": resetTo(0); S.balance = 30; jump(["home", "game"]); break;
      case "garland-play": case "garland-paused":
        resetTo(8); S.balance = 60; S.garland.attempts = 1; jump(["home", "game"]);
        window.AV_GAME.setRun(gameCtx(), { playing: kind === "garland-play", paused: kind === "garland-paused" }); break;
      case "garland-prize": case "garland-perfect": case "garland-miss": case "garland-rare":
        resetTo(0); S.balance = 60; S.garland.attempts = 1; jump(["home", "game"]);
        window.AV_GAME.setRun(gameCtx(), { prizeId: kind === "garland-rare" ? D.POOL.find(p=>p.tier==='epic').id : D.POOL[0].id, finale: kind === "garland-perfect", hits: kind === "garland-perfect" ? 3 : kind === "garland-miss" ? 0 : 2 }); break;
      case "claw-poor": case "wheel-poor": case "garland-poor": resetTo(8); S.balance = 20; jump(["home", "game"]); break;
      case "garland-done": resetTo(8); S.garland.attempts = 3; jump(["home", "game"]); break;
      case "claw-empty": case "wheel-empty": case "garland-empty": resetTo(8); S.taken = D.POOL.map(p=>p.id); S.star = true; jump(["home", "game"]); break;
      case "garland-story":
        resetTo(0); S.balance = 60; jump(["home", "game"]);
        window.AV_GAME.setRun(gameCtx(), { prizeId: D.POOL[0].id });
        window.AV_GAME.click({ dataset: { game: "share" } }, gameCtx()); break;
      case "garland-push": resetTo(8); showPush(); break;
      case "garland-decoration": resetTo(8); window.AV_GAME.decoration(); jump(["home","game"]); break;
      case "pool": resetTo(8); jump(["home", "game"]); openSheet("pool"); break;
      case "draw": resetTo(8); S.tickets = 9; jump(["home", "draw"]); break;
      case "draw-mine": resetTo(8); S.tickets = 4; S.draw = { console: 7, headphones: 3 }; jump(["home", "draw"]); break;
      case "draw-none": resetTo(8); S.tickets = 0; jump(["home", "draw"]); break;
      default: return false;
    }
    if (kind !== "garland-push") hidePush();
    renderBalance();
    syncPanel();
    return true;
  }

  /* ── старт ───────────────────────────────────────────────────────────── */

  const sky = window.BlinkSky ? window.BlinkSky.start($("#sky"), { mode: "snow" }) : null;
  const statSky = window.BlinkSky ? window.BlinkSky.start($("#stat-sky"), { mode: "snow" }) : null;
  // конфетти цветами системы – поверх всего: гирлянда, подарок, звезда
  let fx = window.BlinkSky ? window.BlinkSky.start($("#fx"), { mode: "none" }) : null;
  app.addEventListener("av:confetti", () => {
    const colors = getComputedStyle(app).getPropertyValue("--confetti-colors").split(",").map((c) => c.trim());
    fx?.confetti(colors);
  });

  // низкий телефон (SE, 667): карточка статистики и вход в гирлянду сжимаются, а не наезжают на кнопки
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
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && current() === "stat" && D.DAYS[currentDay].prediction && !S.days[currentDay].cracked) {
      renderStat();
      crackCookie();
    }
  });

  resetTo(8);
  const asked = new URLSearchParams(location.search).get("state");
  if (asked) showState(asked);

  // для снимков состояний и проверок
  window.AV = {
    S, D, stack, screens, openDay: (i) => openDay(i, $(`.av-cell[data-day="${i}"]`)), openStat, closeStat,
    push, pop, resetTo, renderHome, renderDay, openSheet, closeSheet, openShare, current, sky, GAME_ON,
    setDay: (i) => { currentDay = i; }, showState, openPrize, gameCtx, completeTask,
  };
})();
