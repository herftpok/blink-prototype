/*
 * Blink – ночлеги: где ты ночевал и сколько раз.
 *
 * Эталон данных – overnight.jpg (список плиток „дом 85“, „ночёвка 17“…). Здесь те же данные
 * собраны в экран, которым хочется поделиться: сводка (сколько ночей не дома, ночная карта с домами
 * друзей, у которых ты ночевал чаще всего, и три коллажа – с кем чаще, у скольких друзей,
 * в скольких городах) и список всех мест. Сторис – та же сводка без списка, с логотипом.
 *
 * Правила прототипа (CLAUDE.md): никаких тостов. „поделиться“ открывает системное меню, если
 * оно есть, иначе копирует текст со ссылкой – кнопка сама говорит „скопировано“.
 * Пины друзей – только через ../../scripts/pin.js.
 */
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const ASSETS = "../../assets";
  const NBSP = String.fromCharCode(160);           // число и слово не рвутся: „14 ночлегов“

  // Друзья – люди из пака: live – живая аватарка для пина, photo – фото для сквиркла,
  // cutout – вырезка, как в списке друзей. with – творительный падеж для „ночей с наташкой“
  const person = (n) => ({
    live: `${ASSETS}/people/live-${n}.webp`,
    photo: `${ASSETS}/people/photo-${n}.webp`,
    cutout: `${ASSETS}/people/cutout-${n}.webp`,
  });
  const FRIENDS = {
    natashka: { name: "наташка", with: "наташкой", ...person(1) },
    lyova: { name: "лёва", with: "лёвой", ...person(3) },
    sonya: { name: "соня", with: "соней", ...person(4) },
    vasya: { name: "вася", with: "васей", ...person(5) },
  };

  const DATA = {
    // kind: home – твой дом, friend – дом друга (host), place – ночёвка.
    // with – с кем из друзей ночевал там. x, y – место дома друга на карте, % от её размера
    places: [
      { kind: "home", title: "дом", city: "москва", nights: 85 },
      { kind: "friend", host: "natashka", city: "москва", nights: 25, with: ["natashka"], x: 42, y: 62 },
      { kind: "place", title: "ночёвка", address: "шоссейная улица, 52", city: "москва", nights: 17 },
      { kind: "friend", host: "lyova", city: "москва", nights: 9, with: ["lyova"], x: 77, y: 45 },
      { kind: "friend", host: "sonya", city: "москва", nights: 4, with: ["sonya"], x: 70, y: 86 },
      { kind: "place", title: "ночёвка", address: "улица баумана, 9", city: "казань", nights: 3, with: ["lyova"] },
      { kind: "friend", host: "vasya", city: "москва", nights: 2, with: ["vasya"], x: 19, y: 82 },
      { kind: "place", title: "ночёвка", address: "невский проспект, 28", city: "санкт-петербург", nights: 1, with: ["sonya"] },
      { kind: "place", title: "ночёвка", address: "сокольническая слободка, 3", city: "москва", nights: 1 },
      { kind: "place", title: "ночёвка", address: "сущёвская улица, 21", city: "москва", nights: 1 },
      { kind: "place", title: "ночёвка", address: "проспект мира, 40", city: "москва", nights: 1 },
      { kind: "place", title: "ночёвка", address: "большая ордынка, 7", city: "москва", nights: 1 },
      { kind: "place", title: "ночёвка", city: "москва", nights: 1 },
      { kind: "place", title: "ночёвка", city: "москва", nights: 1 },
      { kind: "place", title: "ночёвка", city: "москва", nights: 1 },
    ],
  };

  const MAP_FRIENDS = 4;                             // на карте – дома друзей, у кого ночевал чаще всего (3–5)
  const SHORT_LIST = 6;                              // сколько мест видно, пока список свёрнут
  const COPY_MS = 2000;
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** 1 ночь, 2 ночи, 5 ночей */
  function plural(n, [one, few, many]) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }
  const NIGHTS = ["ночь", "ночи", "ночей"];
  const CITIES = ["город", "города", "городов"];
  const HOMES = ["дом", "дома", "домов"];

  const places = DATA.places
    .map((p) => (p.kind === "friend" ? { ...p, title: `у${NBSP}${genitive(p.host)}`, friend: FRIENDS[p.host] } : p))
    .sort((a, b) => b.nights - a.nights);
  const max = places[0].nights;
  const away = places.filter((p) => p.kind !== "home");
  const awayNights = away.reduce((sum, p) => sum + p.nights, 0);
  const cities = new Set(places.map((p) => p.city)).size;

  /** „у наташки“, „у лёвы“: родительный падеж имени друга */
  function genitive(id) {
    return { natashka: "наташки", lyova: "лёвы", sonya: "сони", vasya: "васи" }[id];
  }

  /** Совместные ночёвки: сколько ночей ты провёл вместе с каждым другом, по всем местам */
  const together = Object.keys(FRIENDS)
    .map((id) => ({
      id,
      ...FRIENDS[id],
      nights: places.filter((p) => (p.with || []).includes(id)).reduce((s, p) => s + p.nights, 0),
    }))
    .sort((a, b) => b.nights - a.nights);
  const bestFriend = together[0];

  /* ── сводка: карта и коллажи ─────────────────────────────────────────── */

  /** Пины друзей на ночной карте: у самого частого – 52, у остальных – 36. Бейдж – „ночёвка“
      (домик с месяцем), стикер – сколько ночей ты там провёл, имя – над пином.
      Появляются вразнобой: порядок каждый раз случайный */
  function renderMap() {
    const hosts = places.filter((p) => p.kind === "friend").slice(0, MAP_FRIENDS);
    const sizes = [52, 36, 36, 36, 36];               // самый частый – 52, остальные – 36
    const order = hosts.map((_, i) => i).sort(() => Math.random() - 0.5);
    $("#map-pins").innerHTML = hosts
      .map((p, i) =>
        window.BlinkPin.markup({
          name: p.friend.name,
          photo: p.friend.live,
          size: sizes[i],
          state: "staying",
          badge: `${ASSETS}/pin/overnight.png`,
          sticker: p.nights,
          unit: plural(p.nights, NIGHTS),
          title: p.friend.name,
          tag: "span",
          className: "night-map__pin",
          attrs: `style="--x:${p.x};--y:${p.y};--i:${order[i]}"`,
          assets: ASSETS,
        })
      )
      .join("");
    $("#away-unit").textContent = `${plural(awayNights, NIGHTS)} не${NBSP}дома`;
  }

  function renderSplit() {
    const friendHomes = places.filter((p) => p.kind === "friend");
    const bestFriendData = FRIENDS[bestFriend.id];
    // наташка – по центру: одна вырезка между двумя стопками, композиция уравновешена
    const cells = [
      {
        // у скольких друзей ночевал: вырезки друзей стопкой, вразнобой
        id: "friends",
        art: friendHomes
          .filter((p) => p.friend !== bestFriendData)
          .slice(0, 3)
          .map((p) => `<img class="split__head" src="${p.friend.cutout}" alt="">`)
          .join(""),
        value: friendHomes.length,
        title: `${plural(friendHomes.length, HOMES)} друзей`,
      },
      {
        // вырезка друга, как в списке друзей: без подложки, прямой край закрывает дуга
        id: "friend",
        art: `<span class="cutout split__cutout">
                <span class="cutout__person"><img class="cutout__img" src="${bestFriend.cutout}" alt=""></span>
                <img class="cutout__rim" src="${ASSETS}/friends/rim-offline.png" alt="">
              </span>`,
        value: bestFriend.nights,
        title: `${plural(bestFriend.nights, NIGHTS)} с${NBSP}${bestFriend.with}`,
      },
      {
        // города: ночёвка, машина и самолёт плотной стопкой – как добирался
        id: "cities",
        art: ["nighthouse", "car", "airplane"].map((n) => `<img class="split__trip split__trip--${n}" src="${ASSETS}/overnights/${n}.webp" alt="">`).join(""),
        value: cities,
        title: plural(cities, CITIES),
      },
    ];
    $("#split").innerHTML = cells
      .map(
        (c) => `
          <div class="split split--${c.id}">
            <span class="split__art" aria-hidden="true">${c.art}</span>
            <span class="sticker-number split__number">${c.value}</span>
            <span class="split__title">${c.title}</span>
          </div>`
      )
      .join("");
  }

  /** Число растёт с 1 до итога – как счётчик в итогах года; стартует, когда карта проявилась.
      Без анимаций – сразу итог */
  function countUp(node, value, { duration = 1100, delay = 250 } = {}) {
    if (reducedMotion()) {
      node.textContent = value;
      return;
    }
    node.textContent = 1;
    setTimeout(() => {
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        node.textContent = Math.max(1, Math.round(value * (1 - (1 - t) ** 3)));
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
  }

  /* ── список мест ─────────────────────────────────────────────────────── */

  /** Твой дом – 3D-домик (home_on_map.png); дом друга – крупно его вырезка и ночёвка в углу;
      остальные места – домик с месяцем */
  function placeArt(p) {
    if (p.kind === "home") return `<img class="night-row__house" src="${ASSETS}/overnights/home.webp" alt="">`;
    if (p.kind === "friend") {
      // вырезка друга без фона, как в списке друзей: прямой край закрывает дуга
      return `<span class="cutout night-row__cutout">
                <span class="cutout__person"><img class="cutout__img" src="${p.friend.cutout}" alt=""></span>
                <img class="cutout__rim" src="${ASSETS}/friends/rim-offline.png" alt="">
              </span>
              <img class="night-row__badge" src="${ASSETS}/overnights/nighthouse.webp" alt="">`;
    }
    return `<img class="night-row__house" src="${ASSETS}/overnights/nighthouse.webp" alt="">`;
  }

  let expanded = false;

  function renderList() {
    const shown = expanded ? places : places.slice(0, SHORT_LIST);
    $("#list").innerHTML = shown
      .map((p) => {
        const meta = [p.address, p.city !== "москва" && p.city].filter(Boolean).join(", ");
        return `
          <li>
            <button class="night-row pressable" type="button" style="--share:${(p.nights / max).toFixed(3)}"
                    aria-label="${p.title}${meta ? `, ${meta}` : ""}: ${p.nights} ${plural(p.nights, NIGHTS)}">
              <span class="night-row__art" aria-hidden="true">${placeArt(p)}</span>
              <span class="night-row__body" aria-hidden="true">
                <span class="night-row__title ellipsis">${p.title}</span>
                ${meta ? `<span class="night-row__meta ellipsis">${meta}</span>` : ""}
              </span>
              <span class="night-row__count" aria-hidden="true">${p.nights}<i class="icon icon--moon"></i></span>
              <i class="icon icon--chevron night-row__chevron" aria-hidden="true"></i>
            </button>
          </li>`;
      })
      .join("");
    const more = $("#more");
    more.hidden = places.length <= SHORT_LIST;
    more.textContent = expanded ? "свернуть" : `показать все ${places.length}`;
    more.setAttribute("aria-expanded", String(expanded));
  }

  $("#more").addEventListener("click", () => {
    expanded = !expanded;
    renderList();
  });

  /* ── сторис: та же сводка, без списка мест ───────────────────────────── */

  const sheet = $("#story-sheet");
  const scrim = $("#scrim");
  let opener = null;
  let copiedTimer = 0;

  /** Копия сводки с экрана: в своей сторис человек говорит о себе – „мои ночлеги“.
      Крестик и id убираем, числа – сразу итоговые, без анимаций появления.
      Логотип BLINK – над заголовком */
  function renderStory() {
    const copy = $("#summary").cloneNode(true);
    copy.removeAttribute("id");
    copy.classList.add("is-static");
    copy.querySelector("[data-story-hide]").remove();
    const logo = document.createElement("img");
    logo.className = "story__logo";
    logo.src = `${ASSETS}/brand/logo.png`;
    logo.alt = "";
    copy.prepend(logo);
    copy.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    copy.querySelector(".screen-title").textContent = "мои ночлеги";
    copy.querySelector(".night-map__number").textContent = awayNights;
    copy.querySelectorAll("[aria-label]").forEach((node) => node.removeAttribute("aria-label"));
    copy.setAttribute("aria-hidden", "true");
    $("#story-summary").replaceChildren(copy);
    renderShareButton(false);
  }

  function renderShareButton(copied) {
    $("#story-share-icon").className = `icon icon--${copied ? "check" : "share"}`;
    $("#story-share-label").textContent = copied ? "скопировано" : "поделиться";
    $("#story-share").classList.toggle("button--primary", !copied);
    $("#story-share").classList.toggle("button--secondary", copied);
  }

  function openStory() {
    opener = document.activeElement;
    renderStory();
    sheet.classList.add("is-open");
    scrim.classList.add("is-open");
    $(".screen", $("#app")).inert = true;
    requestAnimationFrame(() => sheet.focus({ preventScroll: true }));
  }

  function closeStory() {
    if (!sheet.classList.contains("is-open")) return;
    sheet.classList.remove("is-open", "is-dragging");
    sheet.style.transform = "";
    scrim.classList.remove("is-open");
    $(".screen", $("#app")).inert = false;
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      const field = document.createElement("textarea");
      field.value = text;
      field.className = "visually-hidden";
      document.body.append(field);
      field.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {
        ok = false;
      }
      field.remove();
      return ok;
    }
  }

  /** Системное меню „поделиться“, если оно есть (телефон); иначе – текст со ссылкой в буфер */
  $("#story-share").addEventListener("click", async () => {
    const text = `мои ночлеги в blink: ${awayNights} ${plural(awayNights, NIGHTS)} не дома, ${cities} ${plural(cities, CITIES)}, чаще всего – с ${bestFriend.with}`;
    const url = "https://blinkmap.com/@ecstasygirl";
    if (navigator.share) {
      try {
        await navigator.share({ title: "мои ночлеги", text, url });
      } catch (error) {
        // закрыли меню – ничего не делаем
      }
      return;
    }
    if (!(await copyText(`${text} ${url}`))) return;
    renderShareButton(true);
    $("#announce").textContent = "текст и ссылка скопированы";
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      renderShareButton(false);
      $("#announce").textContent = "";
    }, COPY_MS);
  });

  $("#share").addEventListener("click", openStory);
  $("#story-close").addEventListener("click", closeStory);
  scrim.addEventListener("click", closeStory);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeStory();
  });

  // Шторку тянут вниз за грэббер: 1:1 с пальцем, закрытие решает проекция броска (apple-design.md §6)
  (() => {
    const handle = $("#story-handle");
    let tracking = false;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let velocity = 0;
    let zoom = 1;
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      tracking = true;
      zoom = sheet.getBoundingClientRect().width / sheet.offsetWidth || 1;
      startY = lastY = event.clientY;
      lastT = event.timeStamp;
      velocity = 0;
      handle.setPointerCapture(event.pointerId);
      sheet.classList.add("is-dragging");
    });
    handle.addEventListener("pointermove", (event) => {
      if (!tracking) return;
      velocity = ((event.clientY - lastY) / zoom / Math.max(1, event.timeStamp - lastT)) * 1000;
      lastY = event.clientY;
      lastT = event.timeStamp;
      sheet.style.transform = `translateY(${Math.max(0, (event.clientY - startY) / zoom)}px)`;
    });
    const finish = (event) => {
      if (!tracking) return;
      tracking = false;
      sheet.classList.remove("is-dragging");
      sheet.style.transform = "";
      const projected = (event.clientY - startY) / zoom + ((velocity / 1000) * 0.998) / (1 - 0.998);
      if (projected > sheet.offsetHeight / 2) closeStory();
    };
    handle.addEventListener("pointerup", finish);
    handle.addEventListener("pointercancel", finish);
  })();

  /* ── старт ────────────────────────────────────────────────────────────── */

  renderMap();
  renderSplit();
  renderList();
  countUp($("#away-nights"), awayNights);
})();
