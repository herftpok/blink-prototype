/*
 * Blink – отмена уроков в мороз (актировка): младшим классам можно не идти в школу.
 *
 * Слово „актировка“ понимают не все, поэтому в интерфейсе – „отмена уроков“ (на пульте можно
 * сравнить с „отменой занятий“ и „дистантом“). На карте за температурой – плашка: уроки
 * отменили – иней, стикер zzz и „отмена уроков 1–7“, нет – обычное стекло „уроки будут“.
 * Нажатие – снизу выезжает вебвью в шеринг-стиле, как ночлеги: весь экран – замёрзшее окно,
 * на стекле мороз и с какого по какой класс можно не идти, стикеры zzz и pray; уроки будут –
 * мороз крупно и шутка. Раскладка – заголовок сверху или всё по центру (пульт).
 * „поделиться“ – шторка с превью сторис.
 *
 * Пороги – демо: у каждого города свои, их публикует управление образования.
 * Правила прототипа (CLAUDE.md): никаких тостов; шторка без крестика.
 */
(() => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const ASSETS = "../../assets";
  const NBSP = String.fromCharCode(160);
  const MINUS = "−";
  const COPY_MS = 2000;
  const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const CITY = "новосибирск";
  const CITY_IN = "в новосибирске";
  const DATE = "14.01";

  // Пороги актировки (отмены уроков): с какого мороза (°C) каким классам можно не идти. Демо-значения
  const RULES = [
    { t: -25, to: 4 },
    { t: -28, to: 7 },
    { t: -30, to: 9 },
    { t: -32, to: 11 },
  ];

  // Пульт стенда: мороз утром – от „нет актировки“ до „все классы“
  const PRESETS = [-22, -26, -29, -31, -34];

  // Пины друзей – как на эталоне карты (scripts/data.js → mapFriends)
  const FRIENDS = [
    { name: "наташка", photo: `${ASSETS}/people/live-1.webp`, x: 268, y: 331, size: 52, state: "home", minutes: 22 },
    { name: "лёва", photo: `${ASSETS}/people/live-3.webp`, x: 97, y: 396, size: 36, online: true, state: "moving", speed: 12 },
    { name: "соня", photo: `${ASSETS}/people/live-4.webp`, x: 308, y: 442, size: 20, state: "staying" },
  ];

  // Название на карте и в заголовке: on – уроки отменили, off – уроки будут. Выбирается на пульте
  const NAMES = {
    lessons: { on: "отмена уроков", off: "уроки будут" },
    classes: { on: "отмена занятий", off: "занятия будут" },
    remote: { on: "дистант", off: "дистанта нет" },
  };

  // Уроки будут – подпись под морозом язвит, что в школу всё-таки идти. Выбирается на пульте.
  // Строки разбиты вручную: по смыслу, а не где кончилось место. gap – сколько градусов
  // не хватило до первого порога
  const JOKES = {
    hat: { label: "про шапку", text: () => "шапку не забудь,\nсолнышко" },
    gap: { label: "ещё 3°", text: (gap) => `ещё ${gap}° – и можно\nбыло бы спать` },
  };

  const LAYOUTS = { top: "заголовок сверху", center: "всё по центру" };

  const S = { temp: -29, name: "lessons", joke: "hat", layout: "top" };
  const name = () => NAMES[S.name];

  const deg = (t) => `${t < 0 ? MINUS : ""}${Math.abs(t)}${NBSP}°C`;
  const grades = (to) => `1–${to}`;
  /** самый холодный пройденный порог или null – уроки будут */
  const level = () => RULES.filter((r) => S.temp <= r.t).pop() || null;

  /* ── карта ───────────────────────────────────────────────────────────── */

  function renderMap() {
    $("#city").textContent = CITY;
    $("#temperature").textContent = deg(S.temp);
    const l = level();
    const entry = $("#entry");
    entry.classList.toggle("akt-chip--none", !l);
    $(".akt-chip__sticker").src = `${ASSETS}/stickers/${l ? "zzz" : "crying-face"}.webp`;
    $("#entry-label").textContent = l ? `${name().on} ${grades(l.to)}` : name().off;
  }

  $("#pins").innerHTML = FRIENDS.map((p) =>
    window.BlinkPin.markup({ ...p, className: "pressable", attrs: `style="--x:${p.x};--y:${p.y}"`, assets: ASSETS })
  ).join("");

  /* ── вебвью ──────────────────────────────────────────────────────────── */

  const joke = () => JOKES[S.joke].text(Math.max(0, S.temp - RULES[0].t));

  function renderWebview() {
    const l = level();
    $("#summary").dataset.layout = S.layout;
    $("#summary").dataset.state = l ? "on" : "off";
    $("#akt-title").textContent = l ? name().on : name().off;
    // мороз – только на стекле: плашкой над классами или главным числом, если уроки будут
    $("#meta").textContent = `${CITY} · ${DATE}`;
    $("#temp-chip").hidden = !l;
    $("#temp-chip").textContent = deg(S.temp);
    const number = l ? grades(l.to) : deg(S.temp).replace(`${NBSP}°C`, "°");
    $("#grades").textContent = number;
    $("#grades").classList.toggle("akt__number--long", number.length > 3);
    $("#grades-unit").textContent = l ? "классы дома" : joke();
    $("#grades-unit").classList.toggle("akt__unit--joke", !l);
    $("#sticker-top").src = `${ASSETS}/stickers/${l ? "zzz" : "crying-face"}.webp`;
    $("#sticker-bottom").hidden = !l;
  }

  const webview = $("#webview");
  const mapScreen = $("#screen-map");
  const tabbar = $(".tabbar");
  let sky = null;
  let opener = null;

  function openWebview() {
    opener = document.activeElement;
    renderWebview();
    webview.hidden = false;
    void webview.offsetWidth;                       // стартовое положение под краем – до класса is-open
    // перезапуск анимаций появления: окно, стикер, классы
    webview.querySelectorAll(".akt__frost, .akt__verdict-text, .akt__sticker").forEach((n) => {
      n.style.animation = "none";
      void n.offsetWidth;
      n.style.animation = "";
    });
    // сверху и снизу иней светлый: глифы статус-бара и home indicator – тёмные, как на карте
    requestAnimationFrame(() => webview.classList.add("is-open"));
    mapScreen.inert = true;
    tabbar.inert = true;
    if (!sky) sky = window.BlinkSky.start($("#snow"), { mode: "snow" });
    webview.focus({ preventScroll: true });
  }

  function closeWebview() {
    if (!webview.classList.contains("is-open")) return;
    closeStory();
    webview.classList.remove("is-open");
    mapScreen.inert = false;
    tabbar.inert = false;
    const done = () => {
      if (!webview.classList.contains("is-open")) webview.hidden = true;
    };
    if (reducedMotion()) done();
    else webview.addEventListener("transitionend", done, { once: true });
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }

  $("#entry").addEventListener("click", openWebview);
  $("#close").addEventListener("click", closeWebview);

  /* ── сторис ──────────────────────────────────────────────────────────── */

  const sheet = $("#story-sheet");
  const scrim = $("#scrim");
  let storyOpener = null;
  let copiedTimer = 0;

  function renderStory() {
    const copy = $("#summary").cloneNode(true);
    copy.removeAttribute("id");
    copy.querySelector("canvas").remove();
    const frost = copy.querySelector(".akt__frost");
    frost.src = frost.dataset.storySrc;                 // иней, собранный под 9:16
    const logo = document.createElement("img");
    logo.className = "story__logo";
    logo.src = `${ASSETS}/brand/logo.png`;
    logo.alt = "";
    copy.querySelector(".akt__head").prepend(logo);
    copy.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    copy.querySelectorAll("[aria-label], [aria-labelledby]").forEach((node) => {
      node.removeAttribute("aria-label");
      node.removeAttribute("aria-labelledby");
    });
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
    storyOpener = document.activeElement;
    renderStory();
    sheet.classList.add("is-open");
    scrim.classList.add("is-open");
    webview.inert = true;
    requestAnimationFrame(() => sheet.focus({ preventScroll: true }));
  }

  function closeStory() {
    if (!sheet.classList.contains("is-open")) return;
    sheet.classList.remove("is-open", "is-dragging");
    sheet.style.transform = "";
    scrim.classList.remove("is-open");
    webview.inert = false;
    if (storyOpener && storyOpener.focus) storyOpener.focus({ preventScroll: true });
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

  function shareText() {
    const l = level();
    return l
      ? `${name().on} ${CITY_IN}: ${grades(l.to)} классы сегодня дома, ${deg(S.temp)}`
      : `${CITY_IN} сегодня ${deg(S.temp)}, ${name().off}. ${joke().replace("\n", " ")}`;
  }

  /** Системное меню „поделиться“, если оно есть (телефон); иначе – текст со ссылкой в буфер */
  $("#story-share").addEventListener("click", async () => {
    const url = "https://blinkmap.com";
    if (navigator.share) {
      try {
        await navigator.share({ title: name().on, text: shareText(), url });
      } catch (error) {
        // закрыли меню – ничего не делаем
      }
      return;
    }
    if (!(await copyText(`${shareText()} ${url}`))) return;
    renderShareButton(true);
    $("#announce").textContent = "текст и ссылка скопированы";
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      renderShareButton(false);
      $("#announce").textContent = "";
    }, COPY_MS);
  });

  $("#share").addEventListener("click", openStory);
  scrim.addEventListener("click", closeStory);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (sheet.classList.contains("is-open")) closeStory();
    else closeWebview();
  });

  // Шторку тянут вниз за грэббер и заголовок: 1:1 с пальцем, закрытие решает проекция броска
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

  /* ── пульт стенда ────────────────────────────────────────────────────── */

  /** группа радиокнопок пульта: key – поле состояния, options – { значение: подпись } */
  const radios = (key, options) =>
    Object.entries(options)
      .map(([value, label]) => `<button class="panel__button pressable" type="button" role="radio"
              aria-checked="${String(S[key]) === value}" data-set="${key}" data-value="${value}">${label}</button>`)
      .join("");

  function renderPanel() {
    const frost = Object.fromEntries(PRESETS.map((t) => {
      const l = RULES.filter((r) => t <= r.t).pop();
      return [t, `${deg(t)} <span class="panel__hint">${l ? grades(l.to) : "нет"}</span>`];
    }));
    $("#panel-frost-buttons").innerHTML = radios("temp", frost);
    $("#panel-name-buttons").innerHTML = radios("name", Object.fromEntries(Object.entries(NAMES).map(([k, n]) => [k, n.on])));
    $("#panel-layout-buttons").innerHTML = radios("layout", LAYOUTS);
    $("#panel-joke-buttons").innerHTML = radios("joke", Object.fromEntries(Object.entries(JOKES).map(([k, j]) => [k, j.label])));
  }

  $(".panel").addEventListener("click", (event) => {
    const button = event.target.closest("[data-set]");
    if (!button) return;
    const { set, value } = button.dataset;
    S[set] = set === "temp" ? Number(value) : value;
    render();
  });

  $("#panel-open").addEventListener("click", openWebview);
  $("#panel-reset").addEventListener("click", () => {
    closeWebview();
    S.temp = -29;
    render();
  });

  function render() {
    renderMap();
    renderPanel();
    if (webview.classList.contains("is-open")) renderWebview();
  }

  /** стенд целиком в окне: сводка, телефон и пульт – и по высоте, и по ширине */
  function fit() {
    const body = $(".stage__body");
    body.style.removeProperty("--stage-zoom");
    if (innerWidth <= 480) return;
    const height = Math.max(844, body.scrollHeight);
    const room = innerHeight - $(".stage__head").offsetHeight - 56;
    const zoom = Math.min(1, room / height, (innerWidth - 48) / body.scrollWidth);
    body.style.setProperty("--stage-zoom", zoom.toFixed(3));
  }
  fit();
  addEventListener("resize", fit);

  // Сразу нужное состояние: ?t=-31 – мороз, ?name=classes|remote – название, ?layout=center –
  // всё по центру, ?joke=gap – шутка, ?open=1 – вебвью, ?story=1 – шторка сторис
  const q = new URLSearchParams(location.search);
  if (q.has("t") && Number.isFinite(Number(q.get("t")))) S.temp = Number(q.get("t"));
  if (NAMES[q.get("name")]) S.name = q.get("name");
  if (LAYOUTS[q.get("layout")]) S.layout = q.get("layout");
  if (JOKES[q.get("joke")]) S.joke = q.get("joke");
  render();
  if (q.get("open") === "1" || q.get("story") === "1") openWebview();
  if (q.get("story") === "1") setTimeout(openStory, 50);
})();
