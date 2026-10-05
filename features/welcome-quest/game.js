/*
 * Приветственный квест – экран в телефоне (вебвью). Модель и правила – quest.js, стенд – stand.js.
 * Собран по UX-аудиту (README, „Почему так“): каждый экран отвечает на „что это, что тут делать и
 * зачем“ за пару секунд, одно слово значит одно и то же везде.
 *
 * Флоу:
 *   онбординг – подарки и механика на ночной карте, „угадай, где друзья“, „начать“ зовёт розовым →
 *   карта (листается пальцем): следующий подарок и „угадать, где друзья“ → „кого угадываем?“ – только
 *   те, кому заявка ещё не ушла → метка: нажатие по карте ставит пин знакомого (аватар чёрно-белый,
 *   в углу вопрос), пин тянут пальцем → „ты узнаешь, где соня на самом деле, когда вы станете друзьями“
 *   и „добавить в друзья“ → „заявка отправлена“ → принял: пуш, камера показывает метку и место, от метки
 *   к настоящему пину тянется пунктир, км растут (твой пин на это время уходит: пунктир мог бы пройти
 *   через него) → огоньки → хватило на подарок – „подарок твой!“
 *
 * Добавление и угадывание не смешиваются: в списке – только „угадать“, „добавить в друзья“ – когда
 * метка уже стоит, как способ узнать ответ. Тех, кто ещё не друг, другом не называем.
 *
 * Карта – подложка Blink map-hd 390 × 844 pt, крупнее экрана в 1.5 раза, листается пальцем. Точки – в pt
 * подложки (--x, --y), --k – во сколько раз подложка больше на этом экране, камера – сдвиг слоя.
 */
import { MAX_FRIENDS, REWARDS, HOME, ME, PEOPLE, distanceLabel, personById, escapeHtml, plural } from "./quest.js";

const ASSETS = "../../assets";
const asset = (path) => `${ASSETS}/${path}`;
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((done) => setTimeout(done, reduced() ? 0 : ms));

const MAP_W = 390;
const MAP_H = 844;
const FINGER_LIFT = 46;                          // пин, который тянут, стоит над пальцем, pt экрана
const LINE_MS = 900;                             // пунктир от метки до настоящего места
const HERO_GIFTS = [3, 0, 4];                    // онбординг: тень, огонь, vip – индексы REWARDS; vip последним – поверх

const firesWord = (n) => plural(n, "огонёк", "огонька", "огоньков");
const marksWord = (n) => plural(n, "метка", "метки", "меток");

/* подарок словами новичка, без кавычек: что это и где его видно */
const giftTitle = (r) => (r.vip ? "blink vip" : r.kind === "хвост" ? "хвост для пина" : "стикеры для чата");
const giftShort = (r) => (r.vip ? r.name : `${r.kind} ${r.name}`);

/* лицо человека: живая аватарка для пина, фото – для сквирклов и для пина без вырезки */
const pinFace = (p) => (p.live ? { photo: asset(p.live) } : p.photo ? { photo: asset(p.photo), flat: true } : {});
const avatar = (p, className = "") =>
  `<span class="avatar ${className}">${p.photo
    ? `<img class="avatar__img" src="${asset(p.photo)}" alt="">`
    : `<span class="avatar__img wq-initial" aria-hidden="true">${escapeHtml(p.name[0])}</span>`}</span>`;

const fire = (className = "") => `<img class="wq-fire ${className}" src="${asset("stickers/fire.webp")}" alt="">`;

/** метка – пин того, кого угадываешь: аватар чёрно-белый, слева внизу вопрос с белой обводкой,
    как домик у пина „дома“ */
const guessPin = (p, { size = 36, title = "", className = "" } = {}) => window.BlinkPin.markup({
  name: p.name, ...pinFace(p), size, title, badge: asset("stickers/question.webp"),
  className: ["wq-guess-pin", className].filter(Boolean).join(" "), tag: "span", assets: ASSETS,
});

/** настоящий пин: где человек на самом деле – стоит, дома или в пути */
const realPin = (p, { size = 36, title = "", className = "" } = {}) => window.BlinkPin.markup({
  name: p.name, ...pinFace(p), size, online: true, state: p.where.state, minutes: p.where.minutes, speed: p.where.speed,
  title, className, tag: "span", assets: ASSETS,
});

export function mount(host, quest) {
  host.innerHTML = phoneMarkup();
  const app = $(".app", host);
  const root = $(".wq", app);
  const layer = $("[data-layer]", root);
  const marks = $("[data-marks]", root);
  const me = $("[data-me]", root);
  const revealLayer = $("[data-reveal]", root);
  const aim = $("[data-aim]", root);
  const tap = $("[data-tap]", root);
  const card = $("[data-card]", root);
  const push = $("[data-push]", root);
  const intro = $("[data-intro]", root);

  const state = {
    mode: "home",                 // home | guess | sent | result
    picking: null,                // кого отмечаем
    aim: null,                    // где метка, pt подложки; null – ещё не поставили
    sent: null,                   // кому только что ушла заявка
    result: null,                 // итог последнего раскрытия
    busy: false,
    intro: false,
  };
  /* фокус переводим на кнопку только тем, кто идёт с клавиатуры: у пальца кольца фокуса нет */
  let keyboard = false;
  root.addEventListener("keydown", () => (keyboard = true), true);
  root.addEventListener("pointerdown", () => (keyboard = false), true);
  const focusFor = (el) => keyboard && el && el.focus({ preventScroll: true });
  /* шторка становится видимой не сразу (visibility – в переходе): фокус ставим, когда она уже видна */
  const focusLater = (el, tries = 8) => requestAnimationFrame(() => {
    el.focus({ preventScroll: true });
    if (document.activeElement !== el && tries > 0) setTimeout(() => focusLater(el, tries - 1), 30);
  });

  /* ── геометрия и камера ──────────────────────────────────────────────
     Подложка 390 × 844 pt крупнее экрана в ZOOM раз, карту листают пальцем. Камера – сдвиг слоя
     (transform), края подложки в кадр не попадают. На раскрытии камера сама показывает метку и
     настоящее место над карточкой */
  const ZOOM = 1.5;
  const ZOOM_MIN = 0.6;
  let zoom = ZOOM;
  const cam = { x: 0, y: 0 };
  const metrics = () => {
    const w = root.offsetWidth;
    return { w, h: root.offsetHeight, k: (w / MAP_W) * zoom };
  };
  const toScreen = (p) => {
    const { k } = metrics();
    return { x: p.x * k + cam.x, y: p.y * k + cam.y };
  };
  const toMap = (x, y) => {
    const { k } = metrics();
    return { x: (x - cam.x) / k, y: (y - cam.y) / k };
  };
  /* видимая часть карты: под шапкой (с запасом на голову пина) и над карточкой */
  function view() {
    const head = $("[data-head]", root);
    const top = head.offsetTop + head.offsetHeight + 84;
    return { top, bottom: Math.max(top + 60, card.offsetTop - 16) };
  }
  /* края подложки в кадр не пускаем; по вертикали край может уйти под шапку и под карточку: там его
     не видно, зато пин у края карты встаёт над карточкой */
  const clampAxis = (v, size, total, before = 0, after = 0) => {
    const lo = size - total - after;
    const hi = before;
    return lo <= hi ? Math.min(hi, Math.max(lo, v)) : (lo + hi) / 2;
  };
  function setCam(c, fly = false) {
    const { w, h, k } = metrics();
    const v = view();
    cam.x = clampAxis(c.x, w, MAP_W * k);
    cam.y = clampAxis(c.y, h, MAP_H * k, v.top - 84, h - v.bottom);
    layer.classList.toggle("is-flying", fly && !reduced());
    layer.style.setProperty("--cam-x", `${cam.x.toFixed(1)}px`);
    layer.style.setProperty("--cam-y", `${cam.y.toFixed(1)}px`);
  }
  /* точку карты – в середину видимой части */
  function centerOn(p, fly = false) {
    layer.style.setProperty("--k", metrics().k.toFixed(4));
    const { w, k } = metrics();
    const v = view();
    setCam({ x: w / 2 - p.x * k, y: (v.top + v.bottom) / 2 - p.y * k }, fly);
  }
  /* камера плавно: масштаб и точка в центре видимой части меняются вместе (0.5 s) */
  function flyTo(target, targetZoom) {
    return new Promise((done) => {
      const fromZoom = zoom;
      const { w } = metrics();
      const v = view();
      const from = toMap(w / 2, (v.top + v.bottom) / 2);
      const t0 = performance.now();
      const ease = (t) => 1 - (1 - t) ** 3;
      const step = (now) => {
        const t = reduced() ? 1 : Math.min(1, (now - t0) / 500);
        const e = ease(t);
        zoom = fromZoom + (targetZoom - fromZoom) * e;
        centerOn({ x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e });
        if (t < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
  }
  /* масштаб, при котором метка с подписью, пунктир с км и настоящий пин с головой и именем помещаются
     между шапкой и карточкой */
  function fitZoom(a, b) {
    const { w } = metrics();
    const v = view();
    const base = w / MAP_W;
    const dx = Math.abs(a.x - b.x) * base;
    const dy = Math.abs(a.y - b.y) * base;
    const availW = w - 2 * 80;
    const availH = v.bottom - v.top - 70;
    return Math.max(ZOOM_MIN, Math.min(ZOOM, availW / Math.max(dx, 1), availH / Math.max(dy, 1)));
  }
  /* метка – в пределах подложки и видимой части экрана */
  const clampToMap = (p) => {
    const v = view();
    const { w } = metrics();
    const lo = toMap(26, v.top);
    const hi = toMap(w - 26, v.bottom);
    return { x: Math.min(hi.x, Math.max(lo.x, p.x)), y: Math.min(hi.y, Math.max(lo.y, p.y)) };
  };
  /* стенд и проверки ставят метку в точную точку карты – где бы ни была камера; только в пределах подложки */
  const onMap = (p) => ({ x: Math.min(MAP_W - 20, Math.max(20, p.x)), y: Math.min(MAP_H - 20, Math.max(20, p.y)) });
  const place = (p) => `--x: ${p.x.toFixed(1)}; --y: ${p.y.toFixed(1)}`;

  function layout() {
    layer.style.setProperty("--k", metrics().k.toFixed(4));
    setCam(cam);
  }

  /* ── карта: ты, метки и знакомые, которые уже приняли заявку ─────────── */

  /* твой пин – своим слоем и один раз: на итоге он плавно уходит (пунктир мог бы пройти через него)
     и плавно возвращается, а перерисовка меток его не трогает */
  me.innerHTML = `<span class="wq-mark wq-mark--me" style="${place(HOME)}">${window.BlinkPin.markup({
    name: "ты", photo: asset(ME.live), size: 52, online: true, state: "home", tag: "span", assets: ASSETS })}</span>`;

  function renderMarks() {
    const html = [];
    for (const [id, g] of quest.guesses) {
      const p = personById(id);
      if (g.status === "revealed") {
        if (state.mode === "result" && state.result?.id === id) continue;     // он сейчас в слое раскрытия
        html.push(`<span class="wq-mark" style="${place(p.where)}">${realPin(p)}</span>`);
      } else {
        /* ждёт ответа – метка с именем; принял, а раскрытие ещё не показали – метка зовёт розовым */
        const ready = g.status === "accepted";
        html.push(`<span class="wq-mark wq-mark--guess${ready ? " is-ready" : ""}" style="${place(g)}">${guessPin(p, { title: p.name })}</span>`);
      }
    }
    marks.innerHTML = html.join("");
  }

  /* ── шапка: плашка игры и крестик или „назад“ и „где сейчас соня?“ ─────── */

  function renderHead() {
    const guessing = state.mode === "guess";
    $("[data-act='cancel']", root).hidden = !guessing;
    $("[data-plate]", root).hidden = guessing;
    $("[data-close]", root).hidden = guessing;
    const who = $("[data-who]", root);
    who.hidden = !guessing;
    if (guessing) {
      const p = state.picking;
      who.innerHTML = `
        ${avatar(p, "wq-who__avatar")}
        <span class="wq-who__body">
          <span class="wq-who__title ellipsis">где сейчас ${escapeHtml(p.name)}?</span>
          <span class="wq-who__text ellipsis">${escapeHtml(p.reason)}</span>
        </span>`;
    }
    const left = MAX_FRIENDS - quest.guesses.size;
    $("[data-plate-meta]", root).innerHTML = `осталось ${left}&nbsp;${marksWord(left)} из&nbsp;${MAX_FRIENDS}`;
    root.dataset.mode = state.mode;
  }

  /* ── карточка снизу ─────────────────────────────────────────────────── */

  /** следующий подарок: картинка, что это, полоса от прошлого порога и сколько огоньков осталось */
  function goalMarkup(fires) {
    const i = REWARDS.findIndex((r) => fires < r.fires);
    const count = `<span class="wq-goal__count" aria-hidden="true">${fire("wq-fire--count")}<span data-goal-count>${fires}</span></span>`;
    if (i < 0) {
      return `
        <button class="wq-goal pressable" type="button" data-act="prizes" aria-label="все подарки твои, ${fires} ${firesWord(fires)}">
          <span class="wq-goal__body"><span class="wq-goal__title">все подарки твои</span></span>
          ${count}
        </button>`;
    }
    const r = REWARDS[i];
    const from = i === 0 ? 0 : REWARDS[i - 1].fires;
    const share = (fires - from) / (r.fires - from);
    const left = r.fires - fires;
    return `
      <button class="wq-goal pressable" type="button" data-act="prizes"
              aria-label="${escapeHtml(`${giftTitle(r)}: ещё ${left} ${firesWord(left)}. все подарки`)}">
        <img class="wq-goal__art${r.vip ? " wq-goal__art--vip" : ""}" src="${asset(r.art)}" alt="">
        <span class="wq-goal__body">
          <span class="wq-goal__title">${giftTitle(r)}</span>
          <span class="wq-goal__bar"><span class="wq-goal__fill" data-goal-fill style="--fill: ${share.toFixed(3)}"></span></span>
          <span class="wq-goal__left" data-goal-left>ещё ${left}&nbsp;${firesWord(left)}</span>
        </span>
        ${count}
      </button>`;
  }

  /* кто ещё не ответил – лица и имена одной строкой */
  function waitingMarkup() {
    const ids = quest.ids("sent");
    if (!ids.length) return "";
    const people = ids.map(personById);
    const names = people.slice(0, 2).map((p) => escapeHtml(p.name)).join(", ");
    const more = people.length > 2 ? ` и&nbsp;ещё ${people.length - 2}` : "";
    return `
      <p class="wq-waiting">
        <span class="wq-waiting__faces" aria-hidden="true">${people.slice(0, 3).map((p) => avatar(p, "wq-waiting__face")).join("")}</span>
        <span class="wq-waiting__text ellipsis">ждём ответа: ${names}${more}</span>
      </p>`;
  }

  function renderCard() {
    const more = quest.canGuess;
    let html = "";
    if (state.mode === "guess") {
      const p = state.picking;
      html = state.aim
        ? `
        <div class="wq-ask">
          <span class="wq-ask__pin" aria-hidden="true">${window.BlinkPin.markup({
            name: p.name, ...pinFace(p), size: 36, className: "pin--static", tag: "span", assets: ASSETS })}</span>
          <p class="wq-ask__text">ты узнаешь, где ${escapeHtml(p.name)} на&nbsp;самом деле, когда вы станете друзьями</p>
        </div>
        <button class="button button--primary wq-card__cta pressable" type="button" data-act="send">добавить в&nbsp;друзья</button>`
        : '<button class="button button--primary wq-card__cta pressable" type="button" data-act="send" disabled>отметь на&nbsp;карте</button>';
    } else if (state.mode === "sent") {
      const p = personById(state.sent);
      html = `
        <div class="wq-note">
          <img class="wq-note__sticker" src="${asset("stickers/pray.webp")}" alt="">
          <div class="wq-note__body">
            <p class="wq-note__title">заявка отправлена</p>
            <p class="wq-note__text">когда ${escapeHtml(p.name)} её примет, ты увидишь, где ${escapeHtml(p.pron || p.name)} на&nbsp;самом деле</p>
          </div>
        </div>
        <div class="wq-card__actions">
          ${more
            ? `<button class="button button--primary wq-card__cta pressable" type="button" data-act="find">угадать ещё</button>
               <button class="button button--ghost wq-card__cta pressable" type="button" data-act="home">позже</button>`
            : '<button class="button button--primary wq-card__cta pressable" type="button" data-act="home">хорошо</button>'}
        </div>`;
    } else if (state.mode === "result") {
      const r = state.result;
      const p = personById(r.id);
      html = `
        <div class="wq-heat${state.busy ? " is-waiting" : ""}" data-heat>
          <span class="wq-heat__fires" aria-label="${r.heat.fires} ${firesWord(r.heat.fires)} из 3">
            ${[0, 1, 2].map((n) => fire(`wq-fire--big${n < r.heat.fires ? "" : " is-dim"}`)).join("")}
          </span>
          <span class="wq-heat__body">
            <span class="wq-heat__word">${r.heat.word}</span>
            <span class="wq-heat__text">${escapeHtml(p.name)} в&nbsp;${distanceLabel(r.meters)} от&nbsp;твоей метки</span>
          </span>
        </div>
        ${goalMarkup(r.before)}
        <button class="button button--primary wq-card__cta pressable" type="button" data-act="next">дальше</button>`;
    } else {
      html = `
        ${goalMarkup(quest.fires)}
        ${waitingMarkup()}
        ${more
          ? '<button class="button button--primary wq-card__cta pressable" type="button" data-act="find">угадать, где друзья</button>'
          : `<p class="wq-card__note">все ${MAX_FRIENDS} меток стоят&nbsp;– ждём ответов</p>`}`;
    }
    card.innerHTML = html;
    card.dataset.mode = state.mode;
  }

  function renderAll() {
    layout();
    renderHead();
    renderMarks();
    renderCard();
  }

  /* огоньки за раскрытие: полоса дотягивается, число растёт */
  function countFires(from, to) {
    const value = $("[data-goal-count]", card);
    const fill = $("[data-goal-fill]", card);
    const left = $("[data-goal-left]", card);
    const i = REWARDS.findIndex((r) => from < r.fires);
    if (fill && i >= 0) {
      const lo = i === 0 ? 0 : REWARDS[i - 1].fires;
      const hi = REWARDS[i].fires;
      fill.style.setProperty("--fill", Math.min(1, (to - lo) / (hi - lo)).toFixed(3));
      if (left) {
        const rest = Math.max(0, hi - to);
        left.innerHTML = rest ? `ещё ${rest}&nbsp;${firesWord(rest)}` : "хватает!";
      }
    }
    if (!value) return;
    if (reduced()) {
      value.textContent = to;
      return;
    }
    const t0 = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - t0) / 600);
      value.textContent = Math.round(from + (to - from) * (1 - (1 - t) ** 3));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ── шторки: „кого угадываем?“, „подарки за огоньки“, „что это“ ──────── */

  const sheets = {};
  function makeSheet(name, { onClose } = {}) {
    const sheet = $(`[data-sheet="${name}"]`, root);
    const scrim = $(`[data-scrim="${name}"]`, root);
    const s = {
      sheet,
      get isOpen() {
        return sheet.classList.contains("is-open");
      },
      open() {
        s.opener = document.activeElement;
        sheet.classList.add("is-open");
        scrim.classList.add("is-open");
        lock();
        focusLater(sheet);
      },
      close() {
        if (!s.isOpen) return;
        sheet.classList.remove("is-open");
        scrim.classList.remove("is-open");
        lock();
        if (s.opener && s.opener.isConnected) s.opener.focus({ preventScroll: true });
        if (onClose) onClose();
      },
    };
    scrim.addEventListener("click", () => s.close());
    dragToClose(sheet, $(".sheet__handle", sheet), () => s.close());
    sheets[name] = s;
    return s;
  }

  /* жест вниз за грэббер: шторка идёт за пальцем, закрытие – по проекции броска */
  function dragToClose(sheet, handle, close) {
    let start = null;
    handle.addEventListener("pointerdown", (event) => {
      start = { y: event.clientY, t: performance.now(), dy: 0, v: 0 };
      handle.setPointerCapture(event.pointerId);
      sheet.classList.add("is-dragging");
    });
    handle.addEventListener("pointermove", (event) => {
      if (!start) return;
      const z = root.getBoundingClientRect().height / root.offsetHeight || 1;
      start.dy = Math.max(0, (event.clientY - start.y) / z);
      start.v = start.dy / Math.max(1, performance.now() - start.t);
      sheet.style.transform = `translateY(${start.dy}px)`;
    });
    const end = () => {
      if (!start) return;
      sheet.classList.remove("is-dragging");
      sheet.style.removeProperty("transform");
      if (start.dy + start.v * 200 > sheet.offsetHeight / 3) close();
      start = null;
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }

  /* под шторкой, карточкой подарка и онбордингом экран недоступен */
  function lock() {
    const covered = Boolean($(":scope > .sheet.is-open", root)) || state.intro || won.isOpen;
    for (const el of $$("[data-lock]", root)) el.inert = covered;
    app.dataset.home = covered ? "light" : "dark";
    app.dataset.status = state.intro ? "light" : "dark";
  }

  /* кого угадать: только те, у кого ещё нет метки, – кому заявка ушла, в списке не стоят */
  function renderPeople(query = "") {
    const q = query.trim().toLowerCase().replace(/^@/, "");
    const free = PEOPLE.filter((p) => !quest.guesses.has(p.id));
    const list = free.filter((p) => !q || p.name.includes(q) || p.username.includes(q));
    const box = $("[data-people]", root);
    if (!list.length) {
      box.innerHTML = `<li class="wq-people__empty">${free.length ? "никого с&nbsp;таким именем" : "больше никого нет"}</li>`;
      return;
    }
    box.innerHTML = list.map((p) => `
        <li class="friend-row wq-person">
          <span class="friend-row__avatar">${avatar(p)}</span>
          <span class="friend-row__body">
            <span class="friend-row__name ellipsis">${escapeHtml(p.name)}</span>
            <span class="friend-row__distance ellipsis">${escapeHtml(p.reason)}</span>
          </span>
          <button class="wq-add pressable" type="button" data-pick="${p.id}" aria-label="угадать, где сейчас ${escapeHtml(p.name)}"${quest.canGuess ? "" : " disabled"}>угадать</button>
        </li>`).join("");
  }

  function openFriends() {
    $("[data-search]", root).value = "";
    renderPeople();
    sheets.friends.open();
  }

  /* все подарки: что это, сколько огоньков нужно, какие уже твои */
  function openPrizes() {
    $("[data-prizes]", root).innerHTML = REWARDS.map((r, i) => {
      const got = quest.claimed.has(i) || quest.fires >= r.fires;
      return `
        <li class="wq-prize" data-state="${got ? "got" : "locked"}">
          <button class="wq-prize__button pressable" type="button" data-gift="${i}" aria-label="${escapeHtml(`${giftShort(r)}: ${got ? "уже твой" : `${r.fires} ${firesWord(r.fires)}`}`)}">
            <img class="wq-prize__art${r.vip ? " wq-prize__art--vip" : ""}" src="${asset(r.art)}" alt="">
            <span class="wq-prize__body">
              <span class="wq-prize__title">${giftTitle(r)}</span>
              <span class="wq-prize__name">${r.vip ? "подписка" : r.name}</span>
            </span>
            ${got
              ? '<span class="wq-prize__got"><i class="icon icon--check" aria-hidden="true"></i>твой</span>'
              : `<span class="wq-prize__need">${fire("wq-fire--count")}${r.fires}</span>`}
          </button>
        </li>`;
    }).join("");
    $("[data-prizes-text]", root).innerHTML = `у&nbsp;тебя ${quest.fires}&nbsp;${firesWord(quest.fires)}`;
    sheets.prizes.open();
  }

  /* что за подарок: упаковка, название, что это и за сколько огоньков */
  function openGift(i) {
    const r = REWARDS[i];
    $("[data-gift-art]", root).src = asset(r.art);
    $("[data-gift-name]", root).textContent = r.name;
    $("[data-gift-kind]", root).textContent = r.vip ? "подписка" : giftTitle(r);
    $("[data-gift-need]", root).innerHTML = quest.claimed.has(i) || quest.fires >= r.fires
      ? "уже твой"
      : `за&nbsp;${r.fires}&nbsp;${firesWord(r.fires)}`;
    sheets.gift.open();
  }

  /* ── метка: нажатие по карте ставит пин знакомого, палец его тянет ────── */

  function renderAim(lifted = false) {
    if (!state.aim) {
      aim.hidden = true;
      return;
    }
    aim.hidden = false;
    tap.hidden = true;
    aim.style.cssText = place(state.aim);
    aim.classList.toggle("is-lifted", lifted);
  }

  /* подсказка на карте без метки: пульсирующий круг в верхней трети видимой части (посередине стоит
     твой пин – подсказка на нём читалась бы как „ты“) и „нажми, где сейчас соня“ */
  function showTap(p) {
    const v = view();
    tap.style.setProperty("--sx", `${(metrics().w / 2).toFixed(1)}px`);
    tap.style.setProperty("--sy", `${(v.top - 40 + (v.bottom - v.top + 40) * 0.3).toFixed(1)}px`);
    $("[data-tap-text]", tap).innerHTML = `нажми, где сейчас ${escapeHtml(p.name)}`;
    tap.hidden = false;
  }

  function startGuess(id) {
    const p = personById(id);
    if (!p || !quest.canGuess || quest.guesses.has(id)) return;
    sheets.friends.close();
    state.mode = "guess";
    state.picking = p;
    state.aim = null;
    aim.innerHTML = `
      <span class="wq-aim__shadow" aria-hidden="true"></span>
      <span class="wq-aim__lift">${guessPin(p, { size: 52, className: "pin--pop" })}</span>`;
    aim.setAttribute("aria-label", `метка: где сейчас ${p.name}. стрелки двигают`);
    renderAll();
    renderAim();
    showTap(p);
    focusFor(aim);
  }

  function cancelGuess() {
    if (state.mode !== "guess") return;
    state.mode = "home";
    state.picking = null;
    state.aim = null;
    aim.hidden = true;
    tap.hidden = true;
    renderAll();
    maybeReveal();
  }

  function sendGuess() {
    if (state.mode !== "guess" || !state.aim) return;
    const p = state.picking;
    const at = state.aim;
    state.mode = "sent";
    state.sent = p.id;
    state.picking = null;
    state.aim = null;
    aim.hidden = true;
    tap.hidden = true;
    quest.send(p.id, at);
    renderAll();
    focusFor($("[data-act='find']", card) || $("[data-act='home']", card));
    maybeReveal();
  }

  function leaveSent() {
    if (state.mode !== "sent") return;
    state.mode = "home";
    state.sent = null;
    renderAll();
  }

  /* палец на карте: у пина метки – тянет его (пин стоит над пальцем), в другом месте – листает карту;
     короткое нажатие, пока ставишь метку, ставит её точно туда */
  const map = $("[data-map]", root);
  let drag = null;
  map.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || state.intro || state.busy) return;
    event.preventDefault();
    const r = root.getBoundingClientRect();
    const z = r.width / root.offsetWidth || 1;
    const at = { x: (event.clientX - r.left) / z, y: (event.clientY - r.top) / z };
    let kind = "pan";
    if (state.mode === "guess" && state.aim) {
      const a = toScreen(state.aim);
      if (Math.hypot(at.x - a.x, at.y - (a.y - 34)) < 56) kind = "pin";
    }
    drag = { r, z, kind, start: at, cam: { ...cam }, moved: false };
    map.setPointerCapture(event.pointerId);
    if (kind === "pin") moveAim(at);
  });
  map.addEventListener("pointermove", (event) => {
    if (!drag) return;
    const at = { x: (event.clientX - drag.r.left) / drag.z, y: (event.clientY - drag.r.top) / drag.z };
    if (Math.hypot(at.x - drag.start.x, at.y - drag.start.y) > 6) drag.moved = true;
    if (drag.kind === "pin") moveAim(at);
    else if (drag.moved) setCam({ x: drag.cam.x + at.x - drag.start.x, y: drag.cam.y + at.y - drag.start.y });
  });
  const endDrag = () => {
    if (!drag) return;
    const tapped = drag.kind === "pan" && !drag.moved && state.mode === "guess";
    const first = !state.aim;
    if (tapped) state.aim = clampToMap(toMap(drag.start.x, drag.start.y));
    drag = null;
    renderAim(false);
    if (tapped && first) renderCard();
  };
  map.addEventListener("pointerup", endDrag);
  map.addEventListener("pointercancel", endDrag);

  function moveAim(at) {
    state.aim = clampToMap(toMap(at.x, at.y - FINGER_LIFT));
    renderAim(true);
  }

  aim.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 40 : 10;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
    if (!d) return;
    event.preventDefault();
    const first = !state.aim;
    const v = view();
    const from = state.aim || toMap(metrics().w / 2, (v.top + v.bottom) / 2);
    state.aim = clampToMap({ x: from.x + d[0], y: from.y + d[1] });
    renderAim();
    if (first) renderCard();
  });

  /* ── знакомый принял: пуш и раскрытие ──────────────────────────────── */

  let pushTimer = 0;
  function showPush(id) {
    const p = personById(id);
    $("[data-push-title]", root).textContent = `${p.name} теперь в друзьях`;
    $("[data-push-text]", root).textContent = `смотри, где ${p.name} на самом деле`;
    push.dataset.id = id;
    push.classList.add("is-shown");
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push.classList.remove("is-shown"), 6000);
  }
  push.addEventListener("click", () => {
    push.classList.remove("is-shown");
    const id = push.dataset.id;
    if (quest.guesses.get(id)?.status !== "accepted") return;
    if (state.mode === "guess") cancelGuess();
    Object.values(sheets).forEach((s) => s.close());
    if (state.mode === "result") goHome();
    leaveSent();
    maybeReveal(id);
  });

  /* раскрытие играет само, когда человек на карте: не ставит метку, не смотрит другой итог, не открыта
     шторка. Иначе ждёт – метка зовёт розовым – и играет, когда он вернётся */
  function maybeReveal(id) {
    if (state.busy || state.intro || state.mode === "guess" || state.mode === "result") return;
    if ($(":scope > .sheet.is-open", root) || won.isOpen) return;
    const next = id || quest.ids("accepted")[0];
    if (next) reveal(next);
  }

  async function reveal(id) {
    const r = quest.reveal(id);
    if (!r) return;
    state.busy = true;
    state.mode = "result";
    state.sent = null;
    state.result = r;
    renderAll();                                    // карточка итога выше домашней: камера считает уже с ней
    const g = quest.guesses.get(id);
    const where = personById(id).where;
    await flyTo({ x: (g.x + where.x) / 2, y: (g.y + where.y) / 2 - 12 }, fitZoom(g, where));
    if (state.result !== r) return;
    drawReveal(r);
    await wait(LINE_MS + 150);                      // пунктир дошёл, км досчитали, друг выпрыгнул
    if (state.result !== r) return;
    state.busy = false;
    $("[data-heat]", card)?.classList.remove("is-waiting");
    focusFor($("[data-act='next']", card));
    await wait(300);
    if (state.result === r && state.mode === "result") countFires(r.before, r.after);
  }

  /* метка (там, где ты её поставил) – пунктир тянется к настоящему месту, рядом растут км – в конце
     выпрыгивает настоящий пин */
  function drawReveal(r) {
    const p = personById(r.id);
    const g = quest.guesses.get(r.id);
    const where = p.where;
    const a = toScreen(g);
    const b = toScreen(where);
    const { k } = metrics();
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    revealLayer.innerHTML = `
      <span class="wq-line" style="${place(g)}; --len: ${(length / k).toFixed(1)}; --angle: ${angle.toFixed(1)}deg"></span>
      <span class="wq-mark wq-mark--guess wq-mark--mine" style="${place(g)}">${guessPin(p, { size: 52 })}<span class="wq-mine" aria-hidden="true">твоя метка</span></span>
      <span class="sticker-number wq-km" style="${place(toMap(...kmSpot(a, b)))}" data-km aria-hidden="true">0&nbsp;км</span>
      <span class="wq-mark wq-mark--real" style="${place(where)}">${realPin(p, { size: 52, title: p.name })}</span>`;
    countKm($("[data-km]", revealLayer), r.meters);
  }

  /* км растут вместе с пунктиром: 0.1 … 0.5 км, в конце – как дистанция в приложении */
  function countKm(el, meters) {
    if (reduced()) {
      el.innerHTML = distanceLabel(meters);
      return;
    }
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const step = (now) => {
      const t = Math.min(1, (now - t0) / LINE_MS);
      el.innerHTML = t < 1 ? `${((meters * ease(t)) / 1000).toFixed(1)}&nbsp;км` : distanceLabel(meters);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* куда км: у середины пунктира, сбоку от него; пунктир короткий – рядом с меткой. Первое место, где
     наклейка не ложится на метку с подписью, настоящий пин, шапку, карточку и края экрана (твоего пина
     на итоге нет). Рамки – в px экрана от острия пина (пин 52 с головой над кадром) */
  function kmSpot(a, b) {
    const { w } = metrics();
    const v = view();
    const box = (at, x0, y0, x1, y1) => ({ x0: at.x + x0, y0: at.y + y0, x1: at.x + x1, y1: at.y + y1 });
    const obstacles = [box(b, -46, -110, 60, 6), box(a, -46, -90, 60, 32)];
    const [hw, hh] = [40, 16];
    const hits = (c, r) => c.x + hw > r.x0 && c.x - hw < r.x1 && c.y + hh > r.y0 && c.y - hh < r.y1;
    const fits = (c) => c.x - hw >= 8 && c.x + hw <= w - 8 && c.y - hh >= v.top - 70 && c.y + hh <= v.bottom + 8
      && !obstacles.some((r) => hits(c, r));
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const [ux, uy] = [(b.x - a.x) / length, (b.y - a.y) / length];
    const [nx, ny] = uy > 0 ? [uy, -ux] : [-uy, ux];      // нормаль к пунктиру – вверх
    const along = (t, side) => length >= 120 && { x: a.x + (b.x - a.x) * t + nx * 26 * side, y: a.y + (b.y - a.y) * t + ny * 26 * side };
    const spots = [
      along(0.5, 1), along(0.5, -1), along(0.35, 1), along(0.65, 1),
      { x: a.x, y: a.y + 56 },                             // под меткой и её подписью
      { x: a.x + 76, y: a.y - 20 },
      { x: a.x - 76, y: a.y - 20 },
      { x: b.x, y: b.y + 30 },
    ].filter(Boolean);
    const spot = spots.find(fits) || spots[spots.length - 1];
    return [spot.x, spot.y];
  }

  /* ── „подарок твой!“ – карточка снизу на градиенте маркета, с конфетти ── */

  const won = {
    card: $("[data-won]", root),
    backdrop: $("[data-won-backdrop]", root),
    sky: window.BlinkSky.start($("[data-confetti]", root), { mode: "none" }),
    done: null,
    get isOpen() {
      return this.card.classList.contains("is-open");
    },
    open(indexes) {
      const items = indexes.map((i) => REWARDS[i]);
      const first = items[0];
      $("[data-won-title]", root).textContent = items.length > 1
        ? "подарки твои!"
        : `${giftTitle(first)} – ${first.kind === "стикеры" ? "твои!" : "твой!"}`;
      $("[data-won-art]", root).innerHTML = items.length > 1
        ? `<span class="wq-won__fan">${items.map((it, i) => `<img class="wq-won__fan-item" style="--i: ${i}; --n: ${items.length}" src="${asset(it.art)}" alt="">`).join("")}</span>`
        : `<img class="wq-won__single" src="${asset(first.art)}" alt="">`;
      $("[data-won-name]", root).textContent = items.map(giftShort).join(" · ");
      this.opener = document.activeElement;
      this.card.classList.add("is-open");
      this.backdrop.classList.add("is-open");
      lock();
      focusLater(this.card);
      if (!reduced()) {
        const colors = getComputedStyle(root).getPropertyValue("--confetti-colors").split(",").map((c) => c.trim());
        this.sky.confetti(colors);
      }
      return new Promise((done) => (this.done = done));
    },
    close() {
      if (!this.isOpen) return;
      this.card.classList.remove("is-open");
      this.backdrop.classList.remove("is-open");
      lock();
      if (this.opener && this.opener.isConnected) this.opener.focus({ preventScroll: true });
      const done = this.done;
      this.done = null;
      if (done) done();
    },
  };
  won.backdrop.addEventListener("click", () => won.close());
  dragToClose(won.card, $("[data-won-drag]", root), () => won.close());

  function goHome() {
    state.mode = "home";
    state.result = null;
    state.busy = false;
    revealLayer.innerHTML = "";
    renderAll();
    /* после итога карта возвращается к обычному масштабу – ставить следующую метку удобнее */
    if (zoom !== ZOOM) {
      const { w } = metrics();
      const v = view();
      flyTo(toMap(w / 2, (v.top + v.bottom) / 2), ZOOM);
    }
  }

  /* после итога: хватило на подарок – „подарок твой!“; ответил ещё кто-то – сразу его раскрытие */
  async function next() {
    goHome();
    const gifts = quest.due();
    if (gifts.length) {
      await won.open(gifts);
      quest.claim(gifts);
      renderCard();
    }
    if (quest.ids("accepted").length) maybeReveal();
  }

  /* ── онбординг: подарки выпрыгивают снизу, над ними механика на ночной карте ──
     Механика одной картинкой: метка – пин знакомого (чёрно-белый, с вопросом) – пунктир с км – его
     настоящий пин. Внизу „начать“: когда подарки встали, кнопка зовёт розовым кольцом */

  const introSky = window.BlinkSky.start($("[data-intro-sky]", root), { mode: "none" });
  let introTimers = [];

  function heroMarkup() {
    const leva = personById("leva");
    const scene = `
      <span class="wq-hero__line" aria-hidden="true"></span>
      <span class="wq-hero__mark wq-hero__mark--guess" aria-hidden="true">${guessPin(leva)}</span>
      <span class="wq-hero__mark wq-hero__mark--real" aria-hidden="true">${window.BlinkPin.markup({
        name: leva.name, ...pinFace(leva), size: 36, online: true, state: "staying", tag: "span", assets: ASSETS })}</span>
      <span class="sticker-number wq-hero__km" aria-hidden="true">0.5&nbsp;км</span>`;
    const gifts = HERO_GIFTS.map((i, n) => {
      const r = REWARDS[i];
      return `
        <button class="wq-hero__gift wq-hero__gift--${n} pressable" type="button" data-gift="${i}" aria-label="${escapeHtml(giftShort(r))}">
          ${r.vip ? '<span class="wq-hero__halo" aria-hidden="true"></span>' : ""}
          <img class="wq-hero__art${r.vip ? " wq-hero__art--vip" : ""}" src="${asset(r.art)}" alt="">
        </button>`;
    }).join("");
    return scene + gifts;
  }

  function openIntro() {
    Object.values(sheets).forEach((s) => s.close());
    introTimers.forEach(clearTimeout);
    introTimers = [];
    state.intro = true;
    $("[data-hero]", intro).innerHTML = heroMarkup();          // анимации – с начала
    intro.classList.add("is-open");
    introSky.set("stars");
    /* подарки приземлились – конфетти цветами системы */
    introTimers.push(setTimeout(() => {
      if (!state.intro || reduced()) return;
      const colors = getComputedStyle(root).getPropertyValue("--confetti-colors").split(",").map((c) => c.trim());
      introSky.confetti(colors, 36);
    }, 650));
    lock();
    focusLater(intro);
  }

  function closeIntro() {
    if (!state.intro) return;
    state.intro = false;
    introTimers.forEach(clearTimeout);
    intro.classList.remove("is-open");
    introSky.set("none");
    lock();
    maybeReveal();
  }

  /* ── нажатия ───────────────────────────────────────────────────────── */

  root.addEventListener("click", (event) => {
    const pick = event.target.closest("[data-pick]");
    if (pick) return startGuess(pick.dataset.pick);
    const gift = event.target.closest("[data-gift]");
    if (gift) return openGift(Number(gift.dataset.gift));
    const act = event.target.closest("[data-act]");
    if (!act) return;
    const name = act.dataset.act;
    if (name === "find") {
      leaveSent();
      openFriends();
    } else if (name === "home") {
      leaveSent();
      maybeReveal();
    } else if (name === "send") sendGuess();
    else if (name === "cancel") cancelGuess();
    else if (name === "next") next();
    else if (name === "prizes") openPrizes();
    else if (name === "rules") openIntro();
    else if (name === "won-ok") won.close();
    else if (name === "intro-ok" || name === "intro-close") closeIntro();
  });

  $("[data-search]", root).addEventListener("input", (event) => renderPeople(event.target.value));

  /* Esc: верхний слой – по одному. Слушаем на документе: Esc работает, даже если фокус ещё не в шторке */
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !root.offsetParent) return;
    if (sheets.gift.isOpen) return sheets.gift.close();
    if (won.isOpen) return won.close();
    if (sheets.prizes.isOpen) return sheets.prizes.close();
    if (sheets.friends.isOpen) return sheets.friends.close();
    if (state.intro) return closeIntro();
    if (state.mode === "guess") return cancelGuess();
    if (state.mode === "sent") return leaveSent();
  });

  makeSheet("friends", { onClose: () => setTimeout(maybeReveal, 0) });
  makeSheet("prizes", { onClose: () => setTimeout(maybeReveal, 0) });
  makeSheet("gift");

  /* ── модель ────────────────────────────────────────────────────────── */

  quest.addEventListener("accept", ({ detail }) => {
    showPush(detail.id);
    if (state.mode === "sent" && state.sent === detail.id) leaveSent();
    else renderMarks();
    maybeReveal();
  });
  quest.addEventListener("reset", () => {
    Object.values(sheets).forEach((s) => s.close());
    won.close();
    push.classList.remove("is-shown");
    Object.assign(state, { mode: "home", picking: null, aim: null, sent: null, result: null, busy: false });
    aim.hidden = true;
    tap.hidden = true;
    revealLayer.innerHTML = "";
    zoom = ZOOM;
    renderAll();
    centerOn(HOME);
    openIntro();
  });

  new ResizeObserver(() => {
    layout();
    if (state.aim) renderAim();
  }).observe(root);

  renderAll();
  centerOn(HOME);
  openIntro();

  /* для стенда и проверок */
  return {
    root,
    state,
    quest,
    openIntro,
    closeIntro,
    pick: startGuess,
    aimAt: (x, y) => {
      const first = !state.aim;
      state.aim = onMap({ x, y });
      renderAim();
      if (first) renderCard();
    },
    send: sendGuess,
    next,
    sheets,
    won,
    /* стенд: n заявок подряд, у каждой метка недалеко от настоящего места */
    demoGuesses(n) {
      closeIntro();
      if (state.mode === "result") goHome();
      const free = PEOPLE.filter((p) => !quest.guesses.has(p.id)).slice(0, n);
      for (const p of free) {
        if (!quest.canGuess) break;
        startGuess(p.id);
        state.aim = onMap({ x: p.where.x + 34, y: p.where.y + 46 });
        sendGuess();
      }
      leaveSent();
    },
  };
}

/* ── разметка телефона ───────────────────────────────────────────────── */

function phoneMarkup() {
  const sheet = (name, label, body) => `
    <div class="scrim" data-scrim="${name}"></div>
    <div class="sheet wq-sheet wq-sheet--${name}" data-sheet="${name}" role="dialog" aria-modal="true" aria-label="${label}" tabindex="-1">${body}</div>`;
  return `
    <div class="app wq-phone" data-status="dark" data-home="dark">
      <div class="status-bar" aria-hidden="true">
        <img class="status-bar__time" src="${asset("system/status-time.png")}" alt="">
        <img class="status-bar__island" src="${asset("system/live-activity.png")}" alt="">
        <img class="status-bar__icons" src="${asset("system/status-icons.png")}" alt="">
      </div>

      <section class="wq" aria-label="приветственный квест">
        <div class="wq-map" data-map data-lock>
          <div class="wq-map__layer" data-layer>
            <img class="wq-map__tiles" src="${asset("map/map-hd.webp")}" alt="">
            <div class="wq-map__me" data-me></div>
            <div class="wq-map__marks" data-marks></div>
            <div class="wq-map__reveal" data-reveal></div>
            <div class="wq-aim" data-aim role="slider" tabindex="0" aria-label="метка" hidden></div>
          </div>
        </div>
        <div class="wq-tap" data-tap hidden>
          <span class="wq-tap__ring" aria-hidden="true"></span>
          <span class="map-chip wq-tap__chip" data-tap-text></span>
        </div>

        <header class="wq-head" data-head data-lock>
          <button class="wq-square pressable" type="button" data-act="cancel" aria-label="назад, без метки" hidden>
            <i class="icon icon--back" aria-hidden="true"></i>
          </button>
          <button class="wq-plate pressable" type="button" data-plate data-act="rules" aria-label="как играть">
            <img class="wq-plate__sticker" src="${asset("stickers/question.webp")}" alt="">
            <span class="wq-plate__title">угадай, где друзья</span>
            <span class="wq-plate__meta" data-plate-meta></span>
          </button>
          <div class="wq-who" data-who hidden></div>
          <button class="wq-square wq-head__close pressable" type="button" data-close aria-label="закрыть квест">
            <i class="icon icon--close" aria-hidden="true"></i>
          </button>
        </header>

        <div class="wq-card" data-card data-lock></div>

        <button class="ny-push" data-push type="button" aria-live="polite" tabindex="-1">
          <img class="ny-push__icon" src="${asset("system/app-icon.png")}" alt="">
          <span class="ny-push__body">
            <span class="ny-push__head"><span class="ny-push__title" data-push-title></span><span class="ny-push__time">сейчас</span></span>
            <span class="ny-push__text" data-push-text></span>
          </span>
        </button>

        ${sheet("friends", "кого угадываем?", `
          <div class="sheet__handle wq-sheet__handle">
            <div class="sheet__grabber" aria-hidden="true"></div>
            <div class="wq-sheet__head">
              <div class="wq-sheet__heading">
                <h2 class="sheet__title">кого угадываем?</h2>
                <p class="sheet__text wq-sheet__text">ищи своих знакомых и&nbsp;угадывай, где они сейчас</p>
              </div>
              <img class="wq-sheet__sticker" src="${asset("stickers/eyes.webp")}" alt="">
            </div>
          </div>
          <label class="wq-search">
            <i class="icon icon--search" aria-hidden="true"></i>
            <input class="wq-search__input" type="search" placeholder="имя или ник" autocomplete="off" enterkeyhint="search" data-search aria-label="имя или ник">
          </label>
          <ul class="wq-people" role="list" data-people></ul>`)}

        ${sheet("prizes", "подарки за огоньки", `
          <div class="sheet__handle wq-sheet__handle">
            <div class="sheet__grabber" aria-hidden="true"></div>
            <div class="wq-sheet__head">
              <div class="wq-sheet__heading">
                <h2 class="sheet__title">подарки за огоньки</h2>
                <p class="sheet__text wq-sheet__text" data-prizes-text></p>
              </div>
              <img class="wq-sheet__sticker" src="${asset("stickers/fire.webp")}" alt="">
            </div>
          </div>
          <ul class="wq-prizes" role="list" data-prizes></ul>`)}

        <div class="scrim" data-scrim="gift"></div>
        <div class="sheet wq-giftsheet" data-sheet="gift" role="dialog" aria-modal="true" aria-labelledby="wq-gift-title" tabindex="-1">
          <div class="sheet__handle"><div class="sheet__grabber" aria-hidden="true"></div></div>
          <div class="wq-giftcard">
            <img class="wq-giftcard__art" data-gift-art src="" alt="">
            <h2 class="wq-giftcard__title" id="wq-gift-title" data-gift-name></h2>
            <p class="wq-giftcard__kind" data-gift-kind></p>
            <p class="wq-giftcard__need" data-gift-need></p>
          </div>
        </div>

        <div class="wq-won-backdrop" data-won-backdrop></div>
        <canvas class="wq-confetti" data-confetti aria-hidden="true"></canvas>
        <div class="sheet wq-won" data-won role="dialog" aria-modal="true" aria-labelledby="wq-won-title" tabindex="-1">
          <div class="wq-won__handle" data-won-drag>
            <h2 class="wq-won__title" id="wq-won-title" data-won-title></h2>
          </div>
          <div class="wq-won__art" data-won-art></div>
          <p class="wq-won__name" data-won-name></p>
          <button class="button button--primary wq-won__cta pressable" type="button" data-act="won-ok">забрать</button>
        </div>

        <div class="wq-intro" data-intro role="dialog" aria-modal="true" aria-labelledby="wq-hero-title" tabindex="-1">
          <canvas class="market__sky" data-intro-sky aria-hidden="true"></canvas>
          <button class="icon-button wq-close wq-close--dark pressable" type="button" data-act="intro-close" aria-label="пропустить">
            <i class="icon icon--close" aria-hidden="true"></i>
          </button>
          <section class="wq-intro__step wq-hero">
            <div class="wq-hero__stage">
              <img class="wq-hero__map" src="${asset("overnights/map-night.webp")}" alt="">
              <span class="wq-hero__floor" aria-hidden="true"></span>
              <div class="wq-hero__gifts" data-hero></div>
            </div>
            <h2 class="wq-hero__title" id="wq-hero-title">угадай, где друзья</h2>
            <p class="wq-hero__text">и&nbsp;забирай подарки</p>
          </section>
          <button class="button button--primary wq-intro__cta wq-intro__cta--call pressable" type="button" data-act="intro-ok">начать</button>
        </div>
      </section>

      <div class="home-indicator" aria-hidden="true"></div>
    </div>`;
}
