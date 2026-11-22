/*
 * Новогодний адвент 14–31 декабря: купе, лента дней, два задания дня, статистика, хваталка и розыгрыш.
 * Данные – av-data.js, карточки статистики – av-cards.js, выдача хваталки – av-claw-engine.js (описание – algorithm.html).
 * Экраны: главная → статистика (снизу, на весь экран) · хваталка и розыгрыш (справа). Первый вход – экскурсия по главной.
 */
(() => {
  "use strict";

  const D = window.AV_DATA;
  const C = window.AV_CLAW;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const ASSETS = "../../assets";
  const NBSP = String.fromCharCode(160);
  const EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TOUR_KEY = "blink:newyear:2026:tour-seen";
  const app = $("#app");
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
  /** 2846 → «2 846» */
  const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  const tickets = (n) => `${fmt(n)}${NBSP}${plural(n, "билетик", "билетика", "билетиков")}`;
  const dayNum = (i) => Number(D.DAYS[i].date.split(".")[0]);
  const dayName = (day) => `${Number(day.date.split(".")[0])}${NBSP}декабря`;
  const objMarkup = (day, cls = "") => day.obj === "fan"
    ? `<span class="av-fan ${cls}">${["heart", "fire", "kiss"].map((s) => `<img class="av-fan__img" src="${src(`s:${s}`)}" alt="">`).join("")}</span>`
    : `<img class="${cls}" src="${src(day.obj)}" alt="">`;
  /** Неразрывный пробел после однобуквенных предлогов и союзов – строка не рвётся после «в», «к», «и» */
  const nb = (text) => text.replace(/(^|[\s(«])([вкусоиаВКУСОИА])\s/g, `$1$2${NBSP}`);
  const coin = (alt = "монеток") => `<img class="av-task__flake" src="art/coin.webp" alt="${alt}">`;
  const LANDSCAPES = ["panorama", "village", "river", "viaduct", "mountains", "lake", "city", "panorama", "mountains", "village", "lake", "river", "viaduct", "city", "mountains", "panorama", "village", "city"];

  /* ── состояние ───────────────────────────────────────────────────────── */

  const S = {
    tourSeen: (() => { try { return localStorage.getItem(TOUR_KEY) === "1"; } catch { return false; } })(),
    today: 8,          // индекс «сегодня» (22.12)
    selected: 8,       // день в ленте главной и статистики
    coins: 0,
    tickets: 0,
    days: [],          // { memory, task }: "todo" | "claimed"
    claw: C.create(),  // номер попытки, полученные предметы (номера в C.PRIZES), серия B
    draw: {},          // билетики в розыгрыше: id приза → сколько положено
    events: [],        // аналитика
    empty: false,
    vip: false,
    ended: false,      // ивент закончился: хваталка закрыта, остатки сгорели, виден календарь и итоги розыгрыша
    won: null,         // итог розыгрыша: id приза или null
  };

  /** Задания дня можно выполнить в день задания и позже, до 31.12. Будущий день закрыт */
  const isOpen = (i) => S.ended || i <= S.today;
  const RESULTS_KEY = "blink:newyear:2026:results-seen";
  const taskTbd = (i) => Boolean(D.DAYS[i].task.tbd);
  /** Невыполненное в открытом дне: точка в ленте главной */
  const hasTodo = (i) => isOpen(i) && (S.days[i].memory === "todo" || (!taskTbd(i) && S.days[i].task === "todo"));

  /** Демо-история к любому «сегодня»: прошлые дни частично выполнены, часть попыток сделана */
  function preset(todayIdx) {
    const R = C.rng(todayIdx * 31 + 7);
    S.today = todayIdx;
    S.selected = todayIdx;
    S.days = D.DAYS.map((_, i) => {
      if (i >= todayIdx) return { memory: "todo", task: "todo" };
      const lazy = i % 5 === 3;                     // пропущенный день – с точкой, его можно догнать
      return { memory: lazy ? "todo" : "claimed", task: lazy || R() > 0.8 || taskTbd(i) ? "todo" : "claimed" };
    });
    let earned = 0;
    S.days.forEach((d) => { if (d.memory === "claimed") earned += D.ECONOMY.memory; if (d.task === "claimed") earned += D.ECONOMY.task; });
    S.claw = C.create();
    S.coins = earned;
    while (S.coins >= D.ECONOMY.attempt && R() < 0.9) {
      S.coins -= D.ECONOMY.attempt;
      C.spin(S.claw, R);
    }
    S.tickets = S.claw.tickets;
    S.draw = {};
    if (S.tickets >= 60) { S.draw.airpods = 40; S.tickets -= 40; }
    S.events = [];
  }

  /* ── экраны и переходы ───────────────────────────────────────────────── */

  const screens = { home: $("#screen-home"), stat: $("#screen-stat"), game: $("#screen-game"), draw: $("#screen-draw") };
  const stack = ["home"];
  let busy = false;
  const current = () => stack[stack.length - 1];

  function anim(el, frames, opts) {
    const a = el.animate(frames, { duration: 280, easing: EASE, fill: "both", ...opts, ...(reduced() ? { duration: 1, delay: 0 } : {}) });
    // отменённая анимация (быстрая смена дня) – не ошибка: вернём null, продолжение пропустит шаг
    return a.finished.then(() => a, () => null);
  }
  function show(name) { screens[name].hidden = false; app.dataset.screen = name; }
  function focusScreen(name) {
    if (!document.documentElement.classList.contains("kb")) return;
    $(".av-bar__back, .av-close", screens[name])?.focus();
  }

  /** Хваталка и розыгрыш – справа, предыдущий экран уходит влево на 30 % */
  async function push(name) {
    if (busy || current() === name) return;
    if (stack.includes(name)) { while (current() !== name) await pop(); return; }
    busy = true;
    const from = screens[current()];
    show(name);
    RENDER[name]();
    stack.push(name);
    const [x, y] = await Promise.all([
      anim(screens[name], [{ transform: "translateX(100%)" }, { transform: "translateX(0)" }]),
      anim(from, [{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(-30%)", opacity: 0.4 }]),
    ]);
    from.hidden = true;
    x?.cancel(); y?.cancel();
    busy = false;
    focusScreen(name);
  }

  async function pop() {
    if (busy || stack.length < 2) return;
    const name = current();
    if (name === "stat") return closeStat();
    if (name === "game") clawLeave();
    busy = true;
    stack.pop();
    const back = current();
    show(back);
    RENDER[back]();
    const [x, y] = await Promise.all([
      anim(screens[name], [{ transform: "translateX(0)" }, { transform: "translateX(100%)" }]),
      anim(screens[back], [{ transform: "translateX(-30%)", opacity: 0.4 }, { transform: "translateX(0)", opacity: 1 }]),
    ]);
    screens[name].hidden = true;
    x?.cancel(); y?.cancel();
    busy = false;
    focusScreen(back);
  }

  /**
   * «получить монеты»: под капотом выбираем день, где можно заработать. Сначала самый ранний открытый день
   * с невыполненным партнёрским заданием, иначе самый ранний открытый день с любым невыполненным заданием.
   * -1 – всё выполнено, новые задания завтра.
   */
  function coinsDay() {
    const open = D.DAYS.map((_, i) => i).filter((i) => i <= S.today);
    const partner = open.find((i) => D.DAYS[i].task.partner && S.days[i].task === "todo");
    if (partner !== undefined) return partner;
    const any = open.find((i) => hasTodo(i));
    return any === undefined ? -1 : any;
  }

  /** Назад на главную к заданиям дня, где можно получить монеты; невыполненные карточки подсвечиваются */
  function toTasks() {
    const day = coinsDay();
    if (day >= 0) S.selected = day;
    while (stack.length > 1) screens[stack.pop()].hidden = true;
    clawLeave();
    show("home");
    renderHome();
    $$("#home-task-list .av-task:not(.is-done):not(.is-tbd)").forEach((el) => {
      el.classList.remove("is-hint");
      void el.offsetWidth;
      el.classList.add("is-hint");
    });
    $("#home-scroll").scrollTop = 0;                 // главная без вертикальной прокрутки: задания уже в экране
  }

  /* ── лента дней: колесо ──────────────────────────────────────────────── */
  /*
   * 18 ячеек одной ширины, в ленте видно 3 дня: вчера, выбранный («22 декабря») и завтра.
   * Масштаб и прозрачность ячеек считаются от расстояния до центра на каждом кадре прокрутки – как колесо iOS,
   * поэтому ширина ячеек не меняется. Содержимое дня меняется один раз, с направлением.
   */

  const strips = {};

  /** Ширина ячейки: в ленте ровно 3 дня – вчера, выбранный, завтра */
  const cellOf = (st) => st.root.clientWidth / 3 || 120;

  /*
   * Управление лентой – своё, без нативной инерции, чтобы взмах не уносил через несколько дней:
   * – тянешь пальцем – лента едет ровно под пальцем, можно осознанно протянуть на несколько дней;
   * – отпустил – встаёт на ближайший день, без разгона;
   * – быстрый взмах любой силы – ровно на один день в сторону взмаха;
   * – нажатие на соседнюю дату – к ней; колесо и трекпад – по дню за щелчок; ← → с клавиатуры.
   */
  function makeStrip(root, { dots, onPick }) {
    const st = { root, dots, onPick, frame: 0, drag: null, swallow: false, wheelAcc: 0, wheelLock: 0 };
    strips[root.id] = st;
    root.addEventListener("scroll", () => {
      if (!st.frame) st.frame = requestAnimationFrame(() => { st.frame = 0; paintWheel(st); });
    }, { passive: true });

    root.addEventListener("pointerdown", (e) => {
      if (e.button) return;
      st.drag = { x0: e.clientX, y0: e.clientY, s0: root.scrollLeft, start: S.selected, moved: false, samples: [{ x: e.clientX, t: performance.now() }] };
    });
    root.addEventListener("pointermove", (e) => {
      const d = st.drag;
      if (!d) return;
      const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (!d.moved) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
        d.moved = true;
        root.setPointerCapture(e.pointerId);
        root.getAnimations?.().forEach((x) => x.cancel());
      }
      root.scrollLeft = d.s0 - dx;
      d.samples.push({ x: e.clientX, t: performance.now() });
      if (d.samples.length > 6) d.samples.shift();
    });
    const release = () => {
      const d = st.drag;
      st.drag = null;
      if (!d || !d.moved) return;
      st.swallow = true;                           // отпускание после протяжки – не нажатие на дату
      setTimeout(() => { st.swallow = false; }, 400);
      const first = d.samples[0], last = d.samples[d.samples.length - 1];
      const v = (last.x - first.x) / Math.max(1, last.t - first.t);   // pt/мс, знак – направление пальца
      let target = Math.round(root.scrollLeft / cellOf(st));
      // любой быстрый взмах – ровно один день, как бы сильно ни махнули; несколько дней – только медленной протяжкой
      if (Math.abs(v) > 0.35) target = d.start - Math.sign(v);
      target = Math.max(0, Math.min(D.DAYS.length - 1, target));
      if (target === S.selected) scrollStripTo(st, target, true);
      else onPick(target);
    };
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", release);
    root.addEventListener("click", (e) => { if (st.swallow) { e.stopPropagation(); e.preventDefault(); } }, true);

    // колесо мыши и трекпад: один день на щелчок, без разгона
    root.addEventListener("wheel", (e) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (!delta) return;
      e.preventDefault();
      const now = performance.now();
      // один жест трекпада – один день: после шага ждём, пока инерция затихнет (пауза 200 мс без событий)
      if (now < st.wheelLock) { st.wheelLock = now + 200; return; }
      st.wheelAcc += delta;
      if (Math.abs(st.wheelAcc) < 30) return;
      const target = Math.max(0, Math.min(D.DAYS.length - 1, S.selected + Math.sign(st.wheelAcc)));
      st.wheelAcc = 0;
      st.wheelLock = now + 200;
      if (target !== S.selected) onPick(target);
    }, { passive: false });

    root.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const target = Math.max(0, Math.min(D.DAYS.length - 1, S.selected + (e.key === "ArrowRight" ? 1 : -1)));
      if (target !== S.selected) onPick(target);
      $(`.v3-day[data-day="${target}"]`, root)?.focus({ preventScroll: true });
    });
    return st;
  }

  function stripMarkup(st) {
    return `<div class="v3-strip__track">${D.DAYS.map((day, i) => {
      const sel = i === S.selected, today = i === S.today, future = !isOpen(i), todo = st.dots && hasTodo(i);
      const label = `${dayName(day)}${today ? ", сегодня" : ""}${future ? ", ещё закрыто" : todo ? ", есть невыполненные задания" : ""}`;
      return `<button class="v3-day pressable${sel ? " is-selected" : ""}${today ? " is-today" : ""}${future ? " is-future" : ""}" type="button" role="option" aria-selected="${sel}" data-day="${i}" aria-label="${label}">
        <span class="v3-day__num">${dayNum(i)}<span class="v3-day__month">${NBSP}декабря</span>${todo ? '<span class="v3-day__dot" aria-hidden="true"></span>' : ""}</span>
      </button>`;
    }).join("")}</div>`;
  }

  /** Колесо: центральная ячейка крупная и яркая, к краям мельче и тусклее */
  function paintWheel(st) {
    const r = st.root.getBoundingClientRect();
    if (!r.width) return;
    const mid = r.left + r.width / 2;
    $$(".v3-day", st.root).forEach((b) => {
      const c = b.getBoundingClientRect();
      const d = Math.min(1, Math.abs(c.left + c.width / 2 - mid) / (r.width / 2));
      b.style.setProperty("--wheel-scale", (1 - (st.dots ? 0.42 : 0.25) * Math.min(1, d * 2.2)).toFixed(3));
      b.style.setProperty("--wheel-alpha", (1 - 0.8 * d).toFixed(3));
    });
  }

  /** Довезти ленту до дня: выбранный день встаёт в центр */
  function scrollStripTo(st, i, smooth) {
    st.root.scrollTo({ left: i * cellOf(st), behavior: smooth && !reduced() ? "smooth" : "auto" });
    paintWheel(st);
  }

  function syncSelected(st) {
    $$(".v3-day", st.root).forEach((b) => {
      const sel = Number(b.dataset.day) === S.selected;
      b.classList.toggle("is-selected", sel);
      b.setAttribute("aria-selected", String(sel));
    });
  }

  function renderStrip(st) {
    st.root.style.setProperty("--cell", `${cellOf(st)}px`);
    st.root.innerHTML = stripMarkup(st);
    st.root.scrollLeft = S.selected * cellOf(st);
    paintWheel(st);
  }

  /** Смена дня: старое уезжает в сторону листания, новое въезжает с другой стороны */
  function slideSwap(el, dir, render) {
    el.getAnimations().forEach((a) => a?.cancel());
    if (reduced() || !dir) { render(); return Promise.resolve(); }
    return anim(el, [{ transform: "translateX(0)", opacity: 1 }, { transform: `translateX(${-dir * 48}px)`, opacity: 0 }], { duration: 140, easing: "ease-in" }).then((a) => {
      if (!a) return null;
      render();
      a?.cancel();
      return anim(el, [{ transform: `translateX(${dir * 48}px)`, opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: 280 }).then((b) => b?.cancel());
    });
  }

  /** Горизонтальный свайп по области: ±1 день. Вертикальная прокрутка не мешает (touch-action: pan-y) */
  function bindSwipe(el, onDay) {
    let x0 = null, y0 = 0, dx = 0, horiz = false, swallow = false;
    el.addEventListener("pointerdown", (e) => { if (e.button) return; x0 = e.clientX; y0 = e.clientY; dx = 0; horiz = false; });
    el.addEventListener("pointermove", (e) => {
      if (x0 == null) return;
      dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (!horiz && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) { horiz = true; el.setPointerCapture(e.pointerId); }
      if (horiz) el.style.transform = `translateX(${dx * 0.5}px)`;
    });
    const end = () => {
      if (x0 == null) return;
      x0 = null;
      el.style.transform = "";
      if (!horiz) return;
      swallow = true;                              // клик после свайпа не нажимает кнопку под пальцем
      setTimeout(() => { swallow = false; }, 400);
      if (Math.abs(dx) > 56) onDay(dx < 0 ? 1 : -1);
    };
    el.addEventListener("click", (e) => { if (swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
  }

  /* ── 1. главная ──────────────────────────────────────────────────────── */

  const homeStrip = makeStrip($("#home-strip"), { dots: true, onPick: (i) => homeDay(i) });

  /** После ивента: вместо ленты и заданий – календарь всех 18 дней, каждый открывает свою статистику */
  function renderCalendar() {
    $("#home-calendar").innerHTML = `<div class="v3-cal" role="list">${D.DAYS.map((day, i) => `
      <button class="v3-cal__day pressable" type="button" role="listitem" data-act="cal-day" data-day="${i}" aria-label="${dayName(day)}, ${day.title}">
        <span class="v3-cal__art">${objMarkup(day, "v3-cal__obj")}</span><span class="v3-cal__date">${dayNum(i)}</span>
      </button>`).join("")}</div>`;
  }

  function renderHome() {
    app.toggleAttribute("data-ended", S.ended);
    $("#home-tasks").hidden = S.ended;
    $("#home-after").hidden = !S.ended;
    // билет на столе после ивента открывает итоги, автомат убран
    const ticket = $(".v3-prop--ticket");
    if (S.ended) { delete ticket.dataset.go; ticket.dataset.act = "results"; ticket.setAttribute("aria-label", "итоги розыгрыша"); }
    else { ticket.dataset.go = "draw"; delete ticket.dataset.act; ticket.setAttribute("aria-label", "розыгрыш"); }
    if (S.ended) { setLandscape(S.today, false); renderCalendar(); renderBalance(); return; }
    setLandscape(S.selected, false);
    renderStrip(homeStrip);
    renderHomeHead();
    $("#home-task-list").innerHTML = tasksMarkup(S.selected);
    renderBalance();
  }

  function renderHomeHead() {
    $("#tasks-title").textContent = S.selected === S.today ? "задания на сегодня" : "задания дня";
    $("#to-today").hidden = S.selected === S.today;
  }

  /** За окном – пейзаж выбранного дня: при смене дня окно гаснет и проявляется с новым видом */
  function setLandscape(i, animate) {
    const view = `art/winter-${LANDSCAPES[i]}.webp`, land = $("#landscape");
    const swap = () => {
      land.style.setProperty("--journey-landscape-delay", `-${(i % 6) * 12}s`);
      $$("img", land).forEach((img) => { if (img.getAttribute("src") !== view) img.src = view; });
    };
    if (!animate || reduced() || $("img", land).getAttribute("src") === view) return swap();
    const win = $(".ex-cabin__window");
    win.getAnimations().forEach((a) => a?.cancel());
    anim(win, [{ opacity: 1 }, { opacity: 0.15 }], { duration: 160 }).then((a) => {
      swap();
      if (!a) return;
      a?.cancel();
      anim(win, [{ opacity: 0.15 }, { opacity: 1 }], { duration: 360 }).then((b) => b?.cancel());
    });
  }

  /** Новый день на главной – из ленты, свайпа по карточкам или «к сегодня» */
  function homeDay(i) {
    if (i < 0 || i >= D.DAYS.length || i === S.selected) return;
    const dir = Math.sign(i - S.selected);
    S.selected = i;
    syncSelected(homeStrip);
    scrollStripTo(homeStrip, i, true);
    renderHomeHead();
    setLandscape(i, true);
    slideSwap($("#home-task-list"), dir, () => { $("#home-task-list").innerHTML = tasksMarkup(i); });
  }
  bindSwipe($("#home-task-list"), (d) => homeDay(S.selected + d));

  function tasksMarkup(i) {
    const day = D.DAYS[i], st = S.days[i], open = isOpen(i);
    const opens = `откроется ${dayName(day)}`;
    const memoryDone = st.memory === "claimed";
    const memory = {
      key: "memory", cls: "av-task--memory", title: "воспоминание дня",
      description: !open ? opens : memoryDone ? "карточка просмотрена" : "твоя статистика за 2026",
      done: memoryDone, act: `data-act="open-stat" data-task-day="${i}"`,
      label: !open ? `${dayName(day)}: статистика откроется в этот день` : `${memoryDone ? "посмотреть статистику ещё раз" : "смотреть статистику дня"}, ${D.ECONOMY.memory} монеток${memoryDone ? " уже начислено" : ""}`,
    };
    const t = day.task, taskDone = st.task === "claimed";
    const task = t.tbd
      ? { key: "task", cls: "is-tbd", title: "задание дня", description: "задание уточняется" }
      : {
        key: "task", title: t.text,
        description: !open ? opens : taskDone ? "задание выполнено" : t.partner ? "задание партнёра" : "",
        done: taskDone, act: open ? `data-act="task-help" data-task-day="${i}"` : "",
        label: `${t.text}, ${D.ECONOMY.task} монеток${taskDone ? " уже начислено" : ""}`,
      };
    return `<ul class="av-tasks${open ? "" : " is-future"}">${[memory, task].map(taskRow).join("")}</ul>`;
  }

  function taskRow(r) {
    const reward = D.ECONOMY[r.key];
    const status = r.done ? '<span class="av-task__state" role="img" aria-label="выполнено"><i class="icon icon--check" aria-hidden="true"></i></span>' : "";
    const action = r.act
      ? `<button class="av-task__reward-action pressable" type="button" ${r.act} aria-label="${r.label}"><span>${reward}</span>${coin()}<i class="icon icon--chevron" aria-hidden="true"></i></button>`
      : `<span class="av-task__reward av-task__reward--muted"><span>${reward}</span>${coin()}</span>`;
    return `<li class="av-task ${r.cls || ""}${r.done ? " is-done" : ""}" data-row="${r.key}">
      <div class="av-task__copy"><span class="av-task__heading"><span class="av-task__text">${r.title}</span>${status}</span>${r.description ? `<span class="av-task__description">${r.description}</span>` : ""}</div>
      ${action}
    </li>`;
  }

  function renderBalance() {
    $$("[data-coins]").forEach((el) => { el.textContent = fmt(S.coins); });
    $$("[data-tickets]").forEach((el) => { el.textContent = fmt(S.tickets); });
    $$('.av-balance[data-go="draw"]').forEach((el) => el.setAttribute("aria-label", `${tickets(S.tickets)}, в розыгрыш`));
    $$('.av-balance[data-go="game"]').forEach((el) => el.setAttribute("aria-label", `${fmt(S.coins)} ${plural(S.coins, "монетка", "монетки", "монеток")}, к хваталке`));
  }

  /** Задание засчитано: награда один раз, сразу в баланс. Только открытые дни */
  function completeTask(key, i, { animate = true } = {}) {
    if (S.ended || !D.DAYS[i] || !isOpen(i) || !["memory", "task"].includes(key)) return false;
    if (key === "task" && taskTbd(i)) return false;
    if (S.days[i][key] === "claimed") return false;
    const amount = D.ECONOMY[key];
    S.days[i][key] = "claimed";
    S.coins += amount;
    S.events.push({ name: "newyear_task_complete", day: D.DAYS[i].date, key, amount });
    renderBalance();
    if (current() === "home") {
      const row = $(`#home-task-list [data-row="${key}"]`);
      if (animate && row && i === S.selected) flyCoins(row, $('#screen-home .av-balance[data-go="game"]'));
      $("#home-task-list").innerHTML = tasksMarkup(S.selected);
    }
    const cell = $(`#home-strip .v3-day[data-day="${i}"]`);
    if (cell && !hasTodo(i)) $(".v3-day__dot", cell)?.remove();
    if (animate) announce(`+${amount} монеток`);
    return true;
  }

  const rectIn = (el) => {
    const a = app.getBoundingClientRect(), r = el.getBoundingClientRect();
    const z = a.width / app.offsetWidth || 1;
    return { x: (r.left - a.left) / z, y: (r.top - a.top) / z, w: r.width / z, h: r.height / z };
  };

  function flyCoins(fromEl, toEl, count = 6, img = "art/coin.webp", size = 26) {
    if (!fromEl || !toEl || reduced()) return Promise.resolve();
    const a = rectIn(fromEl), b = rectIn(toEl);
    return Promise.all(Array.from({ length: count }, (_, k) => {
      const f = document.createElement("img");
      f.className = "av-fly__item";
      f.src = img;
      f.alt = "";
      Object.assign(f.style, { width: `${size}px`, height: `${size}px` });
      $("#fly").append(f);
      const x0 = a.x + a.w - 80 + (Math.random() - 0.5) * 30, y0 = a.y + a.h / 2 - size / 2;
      const x1 = b.x + 6, y1 = b.y + b.h / 2 - size / 2;
      const mx = (x0 + x1) / 2 + (Math.random() - 0.5) * 60, my = Math.min(y0, y1) - 40 - Math.random() * 50;
      return f.animate([
        { transform: `translate(${x0}px, ${y0}px) scale(.6)`, opacity: 0 },
        { transform: `translate(${x0}px, ${y0 - 10}px) scale(1)`, opacity: 1, offset: 0.15 },
        { transform: `translate(${mx}px, ${my}px) scale(1.1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${x1}px, ${y1}px) scale(.7)`, opacity: 1 },
      ], { duration: 700 + k * 70, easing: EASE, fill: "both" }).finished.then(() => f.remove());
    }));
  }

  /* ── 2. статистика ───────────────────────────────────────────────────── */

  const statStrip = makeStrip($("#stat-strip"), { dots: false, onPick: (i) => statDay(i) });
  const cardCtx = (extra = {}) => ({ S, D, src, person, fmt, plural, NBSP, dayName, objMarkup, ASSETS, ...extra });

  function renderStatCard() {
    const i = S.selected, day = D.DAYS[i];
    const card = $("#stat-card");
    $("#stat-footer").hidden = !isOpen(i);
    if (!isOpen(i)) {
      // заглушка будущего дня: куб льда с числом, дата и одна строка
      card.innerHTML = `<article class="v3-locked" aria-labelledby="stat-title">
        <div class="v3-locked__art"><img class="v3-locked__ice" src="renders/ice.webp" alt=""><span class="sticker-number v3-locked__num">${dayNum(i)}</span></div>
        <h1 class="v3-locked__title" id="stat-title">откроется ${dayName(day)}</h1>
        <p class="v3-locked__text">${nb("в этот день будет новый факт о тебе")}</p>
        <button class="button button--primary v3-locked__cta pressable" type="button" data-act="stat-today">к сегодня</button>
      </article>`;
      return;
    }
    card.innerHTML = window.AV_CARDS.render(day, cardCtx());
    window.AV_CARDS.enter(card);
    completeTask("memory", i, { animate: false });
  }

  function renderStat() {
    renderStrip(statStrip);
    renderStatCard();
  }

  async function openStat(i) {
    if (busy) return;
    busy = true;
    S.selected = i;
    show("stat");
    stack.push("stat");
    renderStat();
    await anim(screens.stat, [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], { duration: 380 }).then((a) => a?.cancel());
    screens.home.hidden = true;
    busy = false;
    focusScreen("stat");
  }

  async function closeStat() {
    if (busy) return;
    busy = true;
    stack.pop();
    show("home");
    renderHome();
    await anim(screens.stat, [{ transform: "translateY(0)" }, { transform: "translateY(100%)" }], { duration: 320 }).then((a) => a?.cancel());
    screens.stat.hidden = true;
    busy = false;
    if (document.documentElement.classList.contains("kb")) $('#home-task-list [data-act="open-stat"]')?.focus({ preventScroll: true });
  }

  /** Новый день на статистике – из ленты, свайпа по карточке или «к сегодня» */
  function statDay(i) {
    if (i < 0 || i >= D.DAYS.length || i === S.selected) return;
    const dir = Math.sign(i - S.selected);
    S.selected = i;
    syncSelected(statStrip);
    scrollStripTo(statStrip, i, true);
    slideSwap($("#stat-card"), dir, renderStatCard);
  }
  bindSwipe($("#stat-card"), (d) => statDay(S.selected + d));

  /* ── 3. хваталка ─────────────────────────────────────────────────────── */

  let claw = { view: "ready", result: null, timer: 0 };
  const GRAB_MS = 2600;

  function clawLeave() {
    // уход во время захвата: результат уже сохранён, при возвращении покажем его без новой оплаты
    if (claw.view === "grabbing") { clearTimeout(claw.timer); claw.view = "result"; }
  }

  const prizeImg = (r) => (r.prize ? src(r.prize.img) : "art/ticket.webp");

  function renderGame() {
    const root = $("#game");
    if (claw.view === "result" && claw.result) return renderClawResult(root);
    const poor = S.coins < D.ECONOMY.attempt;
    const grabbing = claw.view === "grabbing";
    const nothing = poor && coinsDay() < 0;
    const label = grabbing ? "достаём…" : nothing ? "новые задания завтра" : poor ? "получить монеты" : `крутить <span>${D.ECONOMY.attempt}<img src="art/coin.webp" alt="монеток"></span>`;
    root.innerHTML = `<div class="ex-arcade"><div class="ex-machine-wrap"><div class="ex-machine${grabbing ? " is-grabbing" : ""}" role="img" aria-label="автомат с призами" aria-busy="${grabbing}" style="--grab-drop:32cqh">
      <img class="ex-machine__case" src="art/claw-volume.webp" alt="">
      <div class="ex-machine__depth"><span class="ex-machine__cable" aria-hidden="true"></span><img class="ex-claw" src="art/claw-hand.webp" alt="">${grabbing ? `<span class="ex-caught-prize"><img src="${prizeImg(claw.result)}" alt=""></span>` : ""}</div>
      <div class="ex-machine__console" aria-hidden="true"><img src="art/claw-volume.webp" alt=""></div></div></div>
      <footer class="ex-arcade__footer">
        <button class="button ${poor && !grabbing ? "button--secondary" : "button--primary"} pressable" type="button" data-act="${poor && !grabbing ? "get-coins" : "claw-grab"}" ${grabbing || nothing ? "disabled" : ""}>${label}</button>
        <button class="ex-text-link pressable" type="button" data-act="pool">призы и правила <i class="icon icon--chevron" aria-hidden="true"></i></button>
      </footer></div>`;
  }

  /** Одна попытка: результат, списание, номер попытки и коллекция – одной операцией до анимации */
  function grab() {
    if (claw.view !== "ready" || S.coins < D.ECONOMY.attempt) return;
    const out = C.spin(S.claw);
    S.coins -= D.ECONOMY.attempt;
    if (out.tickets) S.tickets += out.tickets;
    S.events.push({ name: "newyear_claw_spin", attempt: out.attempt, tier: out.tier, reason: out.reason, prize: out.prize ? out.prize.n : null, tickets: out.tickets || 0 });
    claw = { view: "grabbing", result: out, timer: 0 };
    renderBalance();
    renderGame();
    claw.timer = setTimeout(() => {
      claw.view = "result";
      if (current() === "game") renderGame();
      announce(out.prize ? `твой приз: ${out.prize.title}` : `+${tickets(out.tickets)}`);
      if (!reduced() && out.tier !== "B") app.dispatchEvent(new CustomEvent("av:confetti"));
    }, reduced() ? 120 : GRAB_MS);
  }

  const TIER_LABEL = { A: "в коллекцию", S: "главный приз" };

  function renderClawResult(root) {
    const r = claw.result;
    const copy = r.prize
      ? `<span class="v3-tier v3-tier--${r.tier}">${TIER_LABEL[r.tier]}</span><h4>${r.prize.title}</h4>`
      : `<h4>+${tickets(r.tickets)}</h4><p class="v3-result__note">${nb("это шансы в розыгрыше")}</p>`;
    root.innerHTML = `<div class="ex-result v3-result"><h3>${r.prize ? "твой приз" : "билетики"}</h3>
      <div class="ex-result__art"><img class="ex-result__prize${r.prize ? "" : " is-ticket"}" src="${prizeImg(r)}" alt="${r.prize ? r.prize.title : ""}"></div>
      ${copy}
      <footer><button class="button button--primary pressable" type="button" data-act="claw-again">${S.coins >= D.ECONOMY.attempt ? "крутить ещё" : "отлично"}</button>
      ${r.tickets ? '<button class="ex-text-link pressable" type="button" data-go="draw">в розыгрыш <i class="icon icon--chevron" aria-hidden="true"></i></button>' : ""}</footer></div>`;
  }

  function renderPool() {
    const got = S.claw.got;
    const item = (p) => `<li class="avg-item${got.includes(p.n) ? " is-got" : ""}"><img class="avg-item__img" src="${src(p.img)}" alt=""><span class="avg-item__title">${p.title}</span>${got.includes(p.n) ? '<span class="avg-item__got"><i class="icon icon--check" aria-hidden="true"></i>твоё</span>' : ""}</li>`;
    const a = C.PRIZES.filter((p) => p.tier === "A"), s = C.PRIZES.filter((p) => p.tier === "S");
    const gotA = a.filter((p) => got.includes(p.n)).length;
    $("#pool-body").innerHTML = `
      <div class="v3-rules"><p>${D.ECONOMY.attempt} монеток – одна попытка</p><p>${nb("В попытке выпадает стикер, хвост или билетики. За 18 попыток соберёшь всю коллекцию. Главные призы редкие и могут не выпасть.")}</p></div>
      <section class="avg-pool__tier"><h3 class="avg-pool__head"><span class="v3-tier v3-tier--A">коллекция</span><span class="avg-pool__count">${gotA} из ${a.length}</span></h3><ul class="avg-pool__grid">${a.map(item).join("")}</ul></section>
      <section class="avg-pool__tier"><h3 class="avg-pool__head"><span class="v3-tier v3-tier--S">главные призы</span><span class="avg-pool__count">шанс меньше 1%</span></h3><ul class="avg-pool__grid">${s.map(item).join("")}</ul></section>
      <section class="avg-pool__tier"><h3 class="avg-pool__head"><span class="v3-tier">билетики</span><span class="avg-pool__count">в остальных попытках</span></h3>
        <ul class="v3-nominals">${C.CONFIG.tickets.map((t) => `<li><img src="art/ticket.webp" alt="">${t.amount}</li>`).join("")}</ul></section>`;
  }

  /* ── 4. розыгрыш: 1 билетик = 1 шанс у любого приза ─────────────────── */

  let draw = { index: 0, count: 1 };

  function renderDraw() {
    const root = $("#draw");
    const p = D.DRAW.prizes[draw.index];
    draw.count = Math.max(1, Math.min(draw.count, S.tickets || 1));
    const mine = S.draw[p.id] || 0;
    const chance = mine ? `твой шанс ≈ ${(mine / (p.total + mine) * 100).toFixed(2).replace(".", ",")}%` : "ты пока не участвуешь";
    root.innerHTML = `
      <figure class="v3-draw__hero"><img class="v3-draw__hero-glow" src="${src(p.img)}" alt=""><img class="v3-draw__hero-img" src="${src(p.img)}" alt="${p.title}"></figure>
      <p class="v3-draw__when">${nb(`1 билетик – 1 шанс, приём до ${D.DRAW.closes}`)}</p>
      <div class="v3-draw__prizes" role="group" aria-label="выбери приз">${D.DRAW.prizes.map((q, i) => {
        const n = S.draw[q.id] || 0;
        return `<button class="v3-draw__prize pressable${i === draw.index ? " is-selected" : ""}" type="button" data-act="draw-select" data-prize="${i}" aria-pressed="${i === draw.index}">
          <img class="v3-draw__art" src="${src(q.img)}" alt="">
          <span class="v3-draw__title">${q.title}</span>
          ${n ? `<span class="v3-draw__mine"><img src="art/ticket.webp" alt="">${fmt(n)}</span>` : ""}
        </button>`;
      }).join("")}</div>
      <div class="v3-draw__panel">
        <p class="v3-draw__chance">${chance}</p>
        ${S.tickets > 0 ? `<div class="avd-put">
            <span class="avd-put__label">билетики</span>
            <button class="icon-button avd-step pressable" type="button" data-act="draw-minus" aria-label="меньше" ${draw.count <= 1 ? "disabled" : ""}><span aria-hidden="true">−</span></button>
            <span class="avd-put__count" aria-live="polite">${draw.count}</span>
            <button class="icon-button avd-step pressable" type="button" data-act="draw-plus" aria-label="больше" ${draw.count >= S.tickets ? "disabled" : ""}><i class="icon icon--plus" aria-hidden="true"></i></button>
          </div>
          <button class="button button--primary pressable" type="button" data-act="draw-put">положить ${tickets(draw.count)}</button>`
        : `<button class="button button--secondary pressable" type="button" data-go="game">${nb("билетики выпадают в хваталке")}</button>`}
      </div>`;
    renderBalance();
  }

  function putTickets() {
    const p = D.DRAW.prizes[draw.index];
    const n = Math.min(draw.count, S.tickets);
    if (!n) return;
    const from = $('[data-act="draw-put"]');
    const target = $(`.v3-draw__prize[data-prize="${draw.index}"] .v3-draw__art`);
    S.tickets -= n;
    S.draw[p.id] = (S.draw[p.id] || 0) + n;
    S.events.push({ name: "newyear_draw_put", prize: p.id, tickets: n });
    flyCoins(from, target, Math.min(6, n + 1), "art/ticket.webp", 34);
    draw.count = 1;
    renderDraw();
    announce(`${tickets(n)} в розыгрыше «${p.title}»`);
  }

  const RENDER = { home: renderHome, stat: renderStat, game: renderGame, draw: renderDraw };

  /* ── экскурсия по главной (первый вход) ──────────────────────────────── */
  /*
   * Всё, кроме показанного элемента, затемнено. Окно подсветки переезжает от элемента к элементу,
   * подпись – заголовок в одну строку и одна строка о том, зачем это. 5 шагов, «пропустить» на каждом.
   */
  const TOUR = [
    { target: "#home-strip", title: "18 дней до нового года", text: "листай даты, точка – в этот день осталось задание" },
    { target: '#home-task-list [data-row="memory"]', title: "твой 2026 в цифрах", text: "каждый день новый факт и 50 монеток за просмотр" },
    { target: '#home-task-list [data-row="task"]', title: "задание дня", text: "сделай его в blink и забери ещё 50 монеток" },
    { target: ".v3-prop--machine", title: "хваталка", text: "100 монеток – попытка: стикер, хвост или билетики" },
    { target: ".v3-prop--ticket", title: "розыгрыш", text: "1 билетик – 1 шанс выиграть iPhone, MacBook или AirPods" },
  ];
  let tourStep = -1;

  function openTour() {
    tourStep = 0;
    $("#home-scroll").scrollTop = 0;
    $("#tour").hidden = false;
    screens.home.inert = true;
    paintTour(true);
    anim($("#tour"), [{ opacity: 0 }, { opacity: 1 }], { duration: 320 }).then((a) => a?.cancel());
  }

  function paintTour(first) {
    const step = TOUR[tourStep], el = $(step.target);
    if (!el) return closeTour();
    const r = rectIn(el), pad = 8;
    const hole = $("#tour-hole");
    hole.classList.toggle("is-instant", Boolean(first));
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 16;
    // окно не выходит за края телефона: лента дней шире экрана
    const left = Math.max(6, r.x - pad), right = Math.min(app.clientWidth - 6, r.x + r.w + pad);
    Object.assign(hole.style, { left: `${left}px`, top: `${r.y - pad}px`, width: `${right - left}px`, height: `${r.h + pad * 2}px`, borderRadius: `${Math.min(radius + pad, 28)}px` });
    $("#tour-title").textContent = nb(step.title);
    $("#tour-text").textContent = nb(step.text);
    $("#tour-next").textContent = tourStep === TOUR.length - 1 ? "поехали" : "дальше";
    $$("#tour-dots span").forEach((d, k) => d.classList.toggle("is-on", k === tourStep));
    // подпись – под элементом, если снизу хватает места, иначе над ним
    const tip = $("#tour-tip"), below = r.y + r.h + pad + 12, appH = app.clientHeight;
    tip.style.top = "";
    tip.style.bottom = "";
    if (below + 170 < appH) tip.style.top = `${below}px`;
    else tip.style.bottom = `${appH - (r.y - pad - 12)}px`;
    if (!first) anim(tip, [{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 280, delay: 140 }).then((a) => a?.cancel());
    $("#tour-next").focus({ preventScroll: true, focusVisible: document.documentElement.classList.contains("kb") });
  }

  function nextTour() {
    if (tourStep < 0) return;
    if (tourStep >= TOUR.length - 1) return closeTour();
    tourStep += 1;
    paintTour(false);
  }

  function closeTour() {
    if (tourStep < 0) return;
    tourStep = -1;
    S.tourSeen = true;
    try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* флаг в памяти тоже не покажет второй раз */ }
    screens.home.inert = false;
    anim($("#tour"), [{ opacity: 1 }, { opacity: 0 }], { duration: 220 }).then((a) => { $("#tour").hidden = true; a?.cancel(); });
  }

  /* ── шторки ──────────────────────────────────────────────────────────── */

  const sheets = { task: $("#sheet-task"), pool: $("#sheet-pool"), share: $("#sheet-share"), results: $("#sheet-results") };
  let openSheetName = null;
  let sheetReturn = null;

  function openSheet(name) {
    if (openSheetName) closeSheet(true);
    openSheetName = name;
    sheetReturn = document.activeElement;
    if (name === "pool") renderPool();
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
    openSheetName = null;
    if (!silent && sheetReturn && document.contains(sheetReturn)) sheetReturn.focus({ preventScroll: true });
  }

  function openTaskHelp(i) {
    const done = S.days[i].task === "claimed";
    $("#task-help-title").textContent = D.DAYS[i].task.text;
    $("#task-help-reward").innerHTML = `<span>${D.ECONOMY.task}${coin()}</span><span>${done ? "уже у тебя" : "придут, когда задание засчитается"}</span>`;
    openSheet("task");
  }

  /** Итоги розыгрыша: шторка один раз после окончания; повторно – по билету на столе */
  function openResults() {
    const mine = D.DRAW.prizes.filter((p) => S.draw[p.id]);
    const prize = D.DRAW.prizes.find((p) => p.id === S.won);
    const list = mine.length
      ? `<ul class="v3-results__list">${mine.map((p) => `<li><img src="${src(p.img)}" alt=""><span>${p.title}</span><b>${tickets(S.draw[p.id])}</b></li>`).join("")}</ul>`
      : `<p class="v3-results__text">${nb("в этот раз билетиков в розыгрыше не было")}</p>`;
    $("#results-body").innerHTML = prize
      ? `<img class="v3-results__art" src="${src(prize.img)}" alt="">
         <h2 class="sheet__title v3-results__title" id="results-title">твой приз – ${prize.title}</h2>
         <p class="v3-results__text">${nb("мы свяжемся с тобой, чтобы передать приз")}</p>${list}
         <button class="button button--primary pressable" type="button" data-act="close-sheet">отлично</button>`
      : `<img class="v3-results__art v3-results__art--ticket" src="art/ticket.webp" alt="">
         <h2 class="sheet__title v3-results__title" id="results-title">в этот раз без приза</h2>${list}
         <button class="button button--primary pressable" type="button" data-act="close-sheet">смотреть свой 2026</button>`;
    try { localStorage.setItem(RESULTS_KEY, "1"); } catch { /* показ один раз держит и сервер */ }
    openSheet("results");
  }

  function openShare() {
    $("#share-story").innerHTML = `<div class="av-share__page">${window.AV_CARDS.render(D.DAYS[S.selected], cardCtx({ story: true }))}</div>`;
    $("#share-cta-label").textContent = "в сторис";
    openSheet("share");
  }

  // жест вниз за грэббер
  Object.values(sheets).forEach((sheet) => {
    const handle = $(".sheet__handle", sheet);
    let y0 = null, dy = 0, t0 = 0;
    handle.addEventListener("pointerdown", (e) => { y0 = e.clientY; dy = 0; t0 = performance.now(); handle.setPointerCapture(e.pointerId); sheet.classList.add("is-dragging"); });
    handle.addEventListener("pointermove", (e) => { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sheet.style.transform = `translateY(${dy}px)`; });
    const end = () => {
      if (y0 == null) return;
      sheet.classList.remove("is-dragging");
      const v = dy / Math.max(1, performance.now() - t0);
      y0 = null;
      if (dy + v * 200 > sheet.offsetHeight * 0.35) closeSheet(); else sheet.style.transform = "";
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  });

  /* ── события ─────────────────────────────────────────────────────────── */

  app.addEventListener("click", (e) => {
    const t = e.target.closest("button");
    if (!t || !app.contains(t) || t.disabled) return;
    const strip = t.closest(".v3-strip");
    if (strip && t.dataset.day) {
      const i = Number(t.dataset.day);
      return strip.id === "stat-strip" ? statDay(i) : homeDay(i);
    }
    if (t.dataset.go === "game") return push("game");
    if (t.dataset.go === "draw") return push("draw");
    switch (t.dataset.act) {
      case "exit": return undefined;                        // выход из ивента – в приложение, вне задачи
      case "back": return pop();
      case "open-stat": return openStat(Number(t.dataset.taskDay));
      case "close-stat": return closeStat();
      case "stat-today": return statDay(S.today);
      case "to-today": return homeDay(S.today);
      case "task-help": return openTaskHelp(Number(t.dataset.taskDay));
      case "close-sheet": return closeSheet();
      case "tour-next": return nextTour();
      case "tour-skip": return closeTour();
      case "to-tasks": case "get-coins": return toTasks();
      case "results": return openResults();
      case "cal-day": return openStat(Number(t.dataset.day));
      case "claw-grab": return grab();
      case "claw-again": claw = { view: "ready", result: null, timer: 0 }; return renderGame();
      case "pool": return openSheet("pool");
      case "draw-select": draw = { index: Number(t.dataset.prize), count: 1 }; return renderDraw();
      case "draw-minus": draw.count = Math.max(1, draw.count - 1); return renderDraw();
      case "draw-plus": draw.count += 1; return renderDraw();
      case "draw-put": return putTickets();
      default:
    }
    if (t.id === "stat-share") return openShare();
    if (t.id === "share-cta") {
      S.events.push({ name: "newyear_share", day: D.DAYS[S.selected].date });
      $("#share-cta-label").textContent = "готово";
      setTimeout(() => { if (openSheetName === "share") closeSheet(); }, 600);
    }
    return undefined;
  });

  $("#scrim").addEventListener("click", () => closeSheet());

  // подтверждённое событие приложения: { day, key: "task" }
  window.addEventListener("advent:task-completed", (e) => {
    if (Number.isInteger(e.detail?.day)) completeTask(e.detail.key || "task", e.detail.day);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Tab") document.documentElement.classList.add("kb");
    if (tourStep >= 0 && e.key === "Escape") return closeTour();
    if (tourStep >= 0 && e.key === "ArrowRight") return nextTour();
    if (e.key !== "Escape") return;
    if (openSheetName) return closeSheet();
    if (stack.length > 1) pop();
  });
  document.addEventListener("pointerdown", () => document.documentElement.classList.remove("kb"));
  document.addEventListener("visibilitychange", () => {
    app.toggleAttribute("data-scene-paused", document.hidden);
    if (document.hidden) clawLeave(); else if (current() === "game") renderGame();
  });

  // свайп от левого края – назад
  (() => {
    let x0 = null;
    app.addEventListener("pointerdown", (e) => {
      const r = app.getBoundingClientRect();
      x0 = e.clientX - r.left < 20 && stack.length > 1 && !openSheetName ? e.clientX : null;
    });
    app.addEventListener("pointerup", (e) => { if (x0 != null && e.clientX - x0 > 80) pop(); x0 = null; });
  })();

  /* ── пульт ───────────────────────────────────────────────────────────── */

  const panel = $(".panel");

  function resetTo(idx) {
    clearTimeout(claw.timer);
    claw = { view: "ready", result: null, timer: 0 };
    draw = { index: 0, count: 1 };
    if (tourStep >= 0) { tourStep = -1; $("#tour").hidden = true; screens.home.inert = false; }
    S.ended = false;
    S.won = null;
    preset(idx);
    while (stack.length > 1) screens[stack.pop()].hidden = true;
    Object.values(screens).forEach((s) => s.getAnimations().forEach((a) => a?.cancel()));
    if (openSheetName) closeSheet(true);
    show("home");
    renderHome();
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
    if (b.dataset.panelDate) return resetTo(D.DAYS.findIndex((d) => d.date === b.dataset.panelDate));
    if (b.dataset.toggle) {
      S[b.dataset.toggle] = !S[b.dataset.toggle];
      syncPanel();
      if (current() === "stat") renderStatCard();
      return;
    }
    switch (b.dataset.panel) {
      case "prev": return resetTo(Math.max(0, S.today - 1));
      case "next": return resetTo(Math.min(D.DAYS.length - 1, S.today + 1));
      case "tour": resetTo(S.today); return openTour();
      case "coins": S.coins += 100; break;
      case "zero": S.coins = 0; break;
      case "tickets": S.tickets += 500; break;
      case "task-done": return window.dispatchEvent(new CustomEvent("advent:task-completed", { detail: { key: "task", day: S.selected } }));
      case "reset": S.empty = false; S.vip = false; return resetTo(8);
      default:
    }
    renderBalance();
    RENDER[current()]();
  });

  /* ── состояния для states.html и ссылок ?state=<id> ──────────────────── */

  function jump(names) {
    if (openSheetName) closeSheet(true);
    Object.values(screens).forEach((el) => { el.hidden = true; el.getAnimations().forEach((a) => a?.cancel()); });
    stack.length = 0;
    names.forEach((n) => stack.push(n));
    const top = names[names.length - 1];
    show(top);              // сначала показать: лента меряет ширину видимого экрана
    RENDER[top]();
  }

  const dayIdx = (date) => D.DAYS.findIndex((d) => d.date === date);
  /** Сид, при котором следующая попытка даёт нужный тир – для показа результата */
  function forceSpin(want) {
    for (let seed = 1; seed < 5000; seed++) {
      const probe = JSON.parse(JSON.stringify(S.claw));
      if (C.spin(probe, C.rng(seed)).tier === want) return seed;
    }
    return 1;
  }
  function selectHome(i) { S.selected = i; renderHome(); }

  function showState(id) {
    S.empty = false;
    S.vip = false;
    const [kind, arg] = id.split(":");
    switch (kind) {
      case "intro": case "tour": resetTo(0); openTour(); break;
      case "tour-claw": resetTo(0); openTour(); tourStep = 3; paintTour(true); break;
      case "tour-step": resetTo(0); openTour(); tourStep = Number(arg) - 1; paintTour(true); break;
      case "stat-today": resetTo(8); S.selected = 8; jump(["home", "stat"]); break;
      case "home-memory-done": resetTo(8); completeTask("memory", 8, { animate: false }); renderHome(); break;
      case "stat-past": resetTo(8); S.selected = 3; jump(["home", "stat"]); break;
      case "task-help-past": resetTo(8); selectHome(3); openTaskHelp(3); break;
      case "home-past-done": resetTo(8); completeTask("memory", 3, { animate: false }); completeTask("task", 3, { animate: false }); selectHome(3); break;
      case "home-coins": resetTo(8); S.coins = 0; completeTask("memory", 8, { animate: false }); completeTask("task", 8, { animate: false }); renderHome(); break;
      case "home": resetTo(8); break;
      case "home-first": resetTo(0); break;
      case "home-last": resetTo(17); break;
      case "home-past": resetTo(8); selectHome(3); break;
      case "home-future": resetTo(8); selectHome(11); break;
      case "home-tbd": resetTo(8); selectHome(7); break;
      case "home-done": resetTo(8); completeTask("memory", 8, { animate: false }); completeTask("task", 8, { animate: false }); renderHome(); break;
      case "task-help": resetTo(8); openTaskHelp(8); break;
      case "stat": case "empty": case "vip":
        resetTo(17); S.selected = dayIdx(arg); S.empty = kind === "empty"; S.vip = kind === "vip"; jump(["home", "stat"]); break;
      case "stat-locked": resetTo(8); S.selected = 12; jump(["home", "stat"]); break;
      case "share": resetTo(8); jump(["home", "stat"]); openShare(); break;
      case "claw": resetTo(8); S.coins = 100; jump(["home", "game"]); break;
      case "claw-poor": resetTo(8); S.coins = 50; jump(["home", "game"]); break;
      case "claw-grabbing": case "claw-a": case "claw-s": case "claw-b": {
        resetTo(0); S.coins = 100; jump(["home", "game"]);
        if (kind === "claw-grabbing") { grab(); break; }
        if (kind === "claw-b") { S.claw.attempt = 1; S.claw.got.push(0); }   // на 1-й попытке B заменяется A
        const out = C.spin(S.claw, C.rng(forceSpin({ "claw-a": "A", "claw-s": "S", "claw-b": "B" }[kind])));
        S.coins -= D.ECONOMY.attempt;
        if (out.tickets) S.tickets += out.tickets;
        claw = { view: "result", result: out, timer: 0 };
        renderGame(); renderBalance();
        break;
      }
      case "pool": resetTo(8); jump(["home", "game"]); openSheet("pool"); break;
      case "claw-poor-partner": resetTo(8); S.days[3].task = "todo"; S.coins = 50; jump(["home", "game"]); break;
      case "coins-partner": resetTo(8); S.days[3].task = "todo"; S.coins = 50; jump(["home", "game"]); toTasks(); break;
      case "claw-poor-early": resetTo(8); Object.assign(S.days[3], { memory: "claimed", task: "claimed" }); S.coins = 50; jump(["home", "game"]); break;
      case "coins-early": resetTo(8); Object.assign(S.days[3], { memory: "claimed", task: "claimed" }); S.coins = 50; jump(["home", "game"]); toTasks(); break;
      case "claw-nothing": resetTo(8); S.days.forEach((d, i) => { if (i <= 8) { d.memory = "claimed"; d.task = "claimed"; } }); S.coins = 0; jump(["home", "game"]); break;
      case "after-won": case "after-lost": case "after-empty": case "after-calendar": case "after-stat":
        resetTo(17);
        S.ended = true; S.coins = 0; S.tickets = 0;
        S.draw = kind === "after-empty" ? {} : { iphone: 120, airpods: 255 };
        S.won = kind === "after-won" ? "airpods" : null;
        if (kind === "after-stat") { S.selected = 4; jump(["home", "stat"]); break; }
        renderHome();
        if (kind !== "after-calendar") openResults();
        break;
      case "draw": resetTo(8); S.tickets = 26; jump(["home", "draw"]); break;
      case "draw-mine": resetTo(8); S.tickets = 18; S.draw = { iphone: 12, airpods: 30 }; jump(["home", "draw"]); break;
      case "draw-none": resetTo(8); S.tickets = 0; jump(["home", "draw"]); break;
      default: return false;
    }
    renderBalance();
    syncPanel();
    return true;
  }

  /* ── старт ───────────────────────────────────────────────────────────── */

  window.BlinkSky?.start($("#sky"), { mode: "snow" });
  window.BlinkSky?.start($("#stat-sky"), { mode: "snow" });
  const fx = window.BlinkSky ? window.BlinkSky.start($("#fx"), { mode: "none" }) : null;
  app.addEventListener("av:confetti", () => {
    const colors = getComputedStyle(app).getPropertyValue("--confetti-colors").split(",").map((c) => c.trim());
    fx?.confetti(colors);
  });

  function fitPhone() {
    app.style.setProperty("--av-fit", String(Math.min(1, (app.clientHeight || 844) / 844)));
  }
  function fitStage() {
    const zoom = Math.min(1, (window.innerHeight - 40) / 900);
    document.documentElement.style.setProperty("--stage-zoom", window.innerWidth > 700 ? String(Math.max(0.6, zoom)) : "1");
  }
  window.addEventListener("resize", () => { fitPhone(); fitStage(); if (tourStep >= 0) paintTour(true); });
  fitPhone();
  fitStage();

  resetTo(8);
  const asked = new URLSearchParams(location.search).get("state");
  if (asked) showState(asked);
  else if (!S.tourSeen) openTour();
  // в продукте: если ивент закончился и итоги ещё не показаны – openResults() один раз (RESULTS_KEY)

  // для снимков состояний и проверок
  window.AV = { S, D, C, stack, screens, current, showState, resetTo, completeTask, openStat, closeStat, push, pop, openSheet, closeSheet, grab, homeDay, statDay, openTour, tourStep: () => tourStep, claw: () => claw };
})();
