/*
 * Первый друг: новорег на пустой карте, в углу – человек, которого стоит добавить.
 * Нажатие – шторка: крупно человек, почему вы знакомы, „добавить“ и крестик – „не этот“:
 * на месте встаёт следующая рекомендация (и в кружке на карте тоже). Фото – вход в профиль.
 * Расстояния нет нигде: где человек, мы не знаем, пока заявку не примут.
 * Пульт стенда меняет причину, „заявку приняли“ ставит пин человека на карту.
 */
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const A = "../../assets";

  // Очередь рекомендаций – пак людей из avatars/ (имена – как в соседних фичах).
  // photo – фото на белом (кружок и шторка), live – живая аватарка для пина, когда заявку примут,
  // contact – как человек записан у тебя в контактах. Крестик – следующий, после последнего – первый
  const PEOPLE = [
    { id: "sonya", name: "соня", n: 4, contact: "соня общага" },
    { id: "timur", name: "тимур", n: 2, contact: "тимур универ" },
    { id: "natashka", name: "наташка", n: 1, contact: "наташка с района" },
    { id: "lyova", name: "лёва", n: 3, contact: "лёва гитара" },
    { id: "vasya", name: "вася", n: 5, contact: "вася футбол" },
  ].map((p) => ({ ...p, photo: `${A}/people/photo-${p.n}.webp`, live: `${A}/people/live-${p.n}.webp` }));
  const ARC_MAX = 10;   // на дуге над кружком – первое слово имени, длиннее – с многоточием

  // chip – коротко, для подписи кружка скринридеру; text – в шторке (у контактов – как человек записан)
  const REASONS = {
    contacts: { icon: "contacts", chip: "есть в контактах", text: (p) => p.contact },
    invite: { icon: "link", chip: "приглашение в blink", text: () => "ты в blink по приглашению" },
    school: { icon: "school", chip: "из твоей школы", text: () => "школа № 564, тоже 11 класс" },
  };

  // at – кто сейчас в рекомендации, sent – кому ушла заявка, accepted – кто принял
  const S = { at: 0, reason: "contacts", sent: new Set(), accepted: null };
  const person = () => PEOPLE[S.at];

  const esc = (v) =>
    String(v).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  // ── Имя по дуге ────────────────────────────────────────────────────────
  // textPath на дуге r 30 ставит буквы с округлением, и они скачут вверх-вниз. Поэтому каждая
  // буква – свой <text> в верхней точке круга, повёрнутый вокруг центра кружка: базовая линия
  // у всех одна (r 30 – на 3 снаружи кольца), шаг – по ширине буквы на высоте середины строчных
  const ARC_R = 30;            // базовая линия от центра кружка (кольцо – до r 27)
  const ARC_MID = ARC_R + 4;   // середина строчных Montserrat 15: по ней шаг такой же, как в прямой строке
  const ARC_TRACK = 0.6;       // +0.04em: низ букв на дуге сходится
  const SVG = "http://www.w3.org/2000/svg";
  let arcText = "";

  function arcName(text) {
    arcText = text;
    const layers = $$("#invite [data-arc]");
    const probe = document.createElementNS(SVG, "text");
    layers[1].replaceChildren(probe);
    const widths = [...text].map((ch) => {
      probe.textContent = ch;
      return probe.getComputedTextLength() + ARC_TRACK;
    });
    const total = widths.reduce((a, w) => a + w, 0) - ARC_TRACK;
    let at = -total / 2;
    const glyphs = [...text].map((ch, i) => {
      const deg = ((at + (widths[i] - ARC_TRACK) / 2) / ARC_MID) * (180 / Math.PI);
      at += widths[i];
      return { ch, deg: deg.toFixed(2) };
    });
    layers.forEach((layer) =>
      layer.replaceChildren(
        ...glyphs.map(({ ch, deg }) => {
          const t = document.createElementNS(SVG, "text");
          t.setAttribute("x", "50");
          t.setAttribute("y", String(50 - ARC_R));
          t.setAttribute("transform", `rotate(${deg} 50 50)`);
          t.textContent = ch;
          return t;
        })
      )
    );
  }
  // ширина букв – по настоящему Montserrat: шрифт догрузился – расставляем заново
  document.fonts.ready.then(() => arcText && arcName(arcText));

  function render() {
    const p = person();
    const r = REASONS[S.reason];
    const sent = S.sent.has(p.id);
    const accepted = PEOPLE.find((x) => x.id === S.accepted);

    const first = p.name.split(" ")[0];
    arcName(first.length > ARC_MAX ? `${first.slice(0, ARC_MAX - 1)}…` : first);
    $("#invite-person").innerHTML = p.photo
      ? `<img class="ff-invite__photo" src="${p.photo}" alt="">`
      : `<span class="ff-invite__initial">${esc(p.name[0])}</span>`;
    $("#invite-badge").className = `icon icon--${sent ? "check" : "plus"}`;
    $("#invite").classList.toggle("is-sent", sent);
    $("#invite").classList.toggle("is-gone", !!accepted);
    $("#invite").inert = !!accepted;
    $("#invite").setAttribute("aria-label", `${p.name}, ${r.chip}${sent ? ", заявка отправлена" : " – добавить в друзья"}`);

    $("#sheet-avatar").innerHTML = p.photo
      ? `<img src="${p.photo}" alt="">`
      : `<span class="ff-sheet__initial" aria-hidden="true">${esc(p.name[0])}</span>`;
    $("#sheet-name").textContent = p.name;
    $("#profile").setAttribute("aria-label", `профиль: ${p.name}`);
    $("#next").disabled = !!accepted;
    $("#sheet-icon").className = `icon icon--${r.icon}`;
    $("#sheet-reason").textContent = r.text(p);

    const add = $("#add");
    add.classList.toggle("button--primary", !sent);
    add.classList.toggle("button--secondary", sent);
    add.textContent = sent ? "отправлено" : "добавить";

    // пин – только когда заявку приняли: теперь известно, где человек
    $("#pins").innerHTML = accepted
      ? window.BlinkPin.markup({
          name: accepted.name,
          photo: accepted.live,
          size: 52,
          state: "staying",
          minutes: 2,
          assets: A,
          className: "pressable pin--pop",
          attrs: 'style="--x:236;--y:478"',
        })
      : "";

    $$("[data-reason]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.reason === S.reason)));
    $("#accept").disabled = !sent || !!accepted;
  }

  // ── Глаза вокруг кружка ───────────────────────────────────────────────
  // Пока человека не открыли, вокруг кружка то тут, то там на миг появляются глаза-стикеры:
  // будто на тебя смотрят с разных сторон. Появились и пропали резко – моргнули. Обычно видна
  // одна пара, изредка две, каждая в своём месте. Места – [угол от 3 часов по часовой, радиус от центра кружка]:
  // слева и снизу слева – вплотную к кольцу (r 27), сверху – дальше, за именем (оно до r 41).
  // Справа до края экрана 50, поэтому там одно место повыше; снизу – „где я“ и „+“, туда не ставим
  const EYE_SLOTS = [[115, 46], [140, 46], [165, 46], [190, 46], [215, 48], [240, 62], [305, 58]];
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const eyes = $$(".ff-invite__eye");
  const busy = new Set();
  let peeking = false;
  let timers = [];

  const rand = (a, b) => a + Math.random() * (b - a);
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function peek(eye) {
    if (!peeking) return;
    const free = EYE_SLOTS.filter((d) => !busy.has(d));
    const slot = free[Math.floor(Math.random() * free.length)];
    busy.add(slot);
    const a = ((slot[0] + rand(-5, 5)) * Math.PI) / 180;
    const r = slot[1] + rand(-2, 2);
    eye.style.setProperty("--ex", `${(Math.cos(a) * r).toFixed(1)}px`);
    eye.style.setProperty("--ey", `${(Math.sin(a) * r).toFixed(1)}px`);
    // справа от кружка глаза отражены: смотрят на него, а не прочь
    const flip = Math.cos(a) > 0;
    // наклон вразнобой: 8–28° в случайную сторону
    const tilt = Math.round(rand(8, 28)) * (Math.random() < 0.5 ? -1 : 1);
    eye.style.setProperty("--ex", `${(Math.cos(a) * r).toFixed(1)}px`);
    eye.style.setProperty("--ey", `${(Math.sin(a) * r).toFixed(1)}px`);
    eye.style.setProperty("--es", `${Math.round(rand(20, 30))}px`);
    eye.style.setProperty("--er", `${tilt}deg`);
    eye.style.setProperty("--ef", flip ? "-1" : "1");
    eye.classList.add("is-on");
    later(() => {
      eye.classList.remove("is-on");
      busy.delete(slot);
      later(() => peek(eye), rand(700, 1500));            // пауза – и смотрит уже из другого места
    }, rand(300, 600));
  }

  function startEyes() {
    stopEyes();
    if (reduced() || S.accepted) return;
    peeking = true;
    eyes.forEach((eye, i) => later(() => peek(eye), 900 + i * 900));   // вторая пара – вразбег с первой   // после пружины появления
  }

  function stopEyes() {
    peeking = false;
    timers.forEach(clearTimeout);
    timers = [];
    busy.clear();
    eyes.forEach((eye) => eye.classList.remove("is-on"));
  }

  // ── Шторка ─────────────────────────────────────────────────────────────
  const sheet = $("#sheet");
  let opener = null;

  function openSheet() {
    stopEyes();
    opener = document.activeElement;
    sheet.classList.add("is-open");
    $("#scrim").classList.add("is-open");
    $("#screen-map").inert = true;
    $(".tabbar").inert = true;
    requestAnimationFrame(() => sheet.focus({ preventScroll: true }));
  }

  function closeSheet() {
    if (!sheet.classList.contains("is-open")) return;
    sheet.classList.remove("is-open", "is-dragging");
    sheet.style.removeProperty("transform");
    $("#scrim").classList.remove("is-open");
    $("#screen-map").inert = false;
    $(".tabbar").inert = false;
    if (opener && opener.isConnected && !opener.inert) opener.focus({ preventScroll: true });
  }

  $("#invite").addEventListener("click", openSheet);
  $("#scrim").addEventListener("click", closeSheet);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
  });

  // жест вниз за грэббер: шторка идёт за пальцем, закрытие – по проекции броска
  const handle = sheet.querySelector(".sheet__handle");
  let drag = null;
  handle.addEventListener("pointerdown", (e) => {
    drag = { y: e.clientY, t: performance.now(), dy: 0, v: 0 };
    handle.setPointerCapture(e.pointerId);
    sheet.classList.add("is-dragging");
  });
  handle.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const z = $("#app").getBoundingClientRect().height / $("#app").offsetHeight || 1;
    drag.dy = Math.max(0, (e.clientY - drag.y) / z);
    drag.v = drag.dy / Math.max(1, performance.now() - drag.t);
    sheet.style.transform = `translateY(${drag.dy}px)`;
  });
  const endDrag = () => {
    if (!drag) return;
    sheet.classList.remove("is-dragging");
    sheet.style.removeProperty("transform");
    if (drag.dy + drag.v * 200 > sheet.offsetHeight / 3) closeSheet();
    drag = null;
  };
  handle.addEventListener("pointerup", endDrag);
  handle.addEventListener("pointercancel", endDrag);

  // заявка уходит одним нажатием, кнопка меняется на месте; повторное нажатие – только отклик
  $("#add").addEventListener("click", () => {
    if (S.sent.has(person().id)) return;
    S.sent.add(person().id);
    render();
  });

  // крестик – „не этот человек“: на месте встаёт следующий. Шторка вбок не едет –
  // строка с фото гаснет и проявляется заново уже с другим человеком
  const row = $(".ff-sheet__row");
  $("#next").addEventListener("click", () => {
    S.at = (S.at + 1) % PEOPLE.length;
    render();
    row.classList.remove("is-swapped");
    void row.offsetWidth;                                     // перезапуск анимации появления
    row.classList.add("is-swapped");
  });

  // ── Пульт стенда ───────────────────────────────────────────────────────
  $$("[data-reason]").forEach((b) =>
    b.addEventListener("click", () => {
      S.reason = b.dataset.reason;
      render();
    })
  );
  $("#accept").addEventListener("click", () => {
    closeSheet();
    stopEyes();
    S.accepted = person().id;
    render();
  });
  $("#reset").addEventListener("click", () => {
    closeSheet();
    Object.assign(S, { at: 0, sent: new Set(), accepted: null });
    startEyes();
    // кружок появляется заново – с пружиной и розовой волной
    render();
    $("#invite").getAnimations({ subtree: true }).forEach((a) => {
      a.cancel();
      a.play();
    });
  });

  // ── Стенд в окне ───────────────────────────────────────────────────────
  function fit() {
    const body = $(".stage__body");
    if (innerWidth <= 480) return body.style.removeProperty("--stage-zoom");
    const room = innerHeight - $(".stage__head").offsetHeight - 56;
    body.style.setProperty("--stage-zoom", Math.min(1, room / 844).toFixed(3));
  }
  fit();
  addEventListener("resize", fit);

  const q = new URLSearchParams(location.search);
  const at = PEOPLE.findIndex((p) => p.id === q.get("person"));
  if (at >= 0) S.at = at;
  if (REASONS[q.get("reason")]) S.reason = q.get("reason");
  if (q.get("state") === "sent" || q.get("state") === "accepted") S.sent.add(person().id);
  if (q.get("state") === "accepted") S.accepted = person().id;
  render();
  if (q.get("state") === "sheet") openSheet();
  else if (!S.sent.size) startEyes();
})();
