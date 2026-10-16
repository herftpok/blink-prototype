/*
 * Презентация обновлений маркета: слайды листаются стрелками, кнопками, колесом и свайпом,
 * номер слайда – в адресе (#3). На слайде – живой прототип index.html?embed=…, открытый в
 * нужном месте; переключатели под телефоном меняют, что в нём открыто.
 * Загрузка: первым – телефон текущего слайда, пока он грузится, пульсирует стикер blink. Прототип
 * прислал «готов» (mw-ready) – в фоне по одному грузятся телефоны остальных слайдов, ближние первыми,
 * и остаются загруженными: листать можно без ожидания. Телефон скрытого слайда на паузе (mw-pause,
 * при старте – data-paused у iframe): видео и звёзды стоят. На узком экране в памяти – только соседи.
 */
(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const slides = $$(".dk-slide");
  const phones = slides.map((slide) => $(".dk-phone", slide));      // null – у слайда без телефона
  let at = 0;

  // ── Телефон: масштаб под слайд ────────────────────────────────────────
  // на широком экране – по высоте окна (листалка снизу, переключатели под телефоном),
  // на узком – ещё и по ширине
  function fit() {
    const narrow = innerWidth <= 960;
    $$(".dk-phone").forEach((phone) => {
      const toggles = phone.parentElement.querySelector(".dk-toggles") ? 52 : 0;
      const byHeight = (innerHeight - (narrow ? 160 : 140) - toggles) / 844;
      const byWidth = (narrow ? innerWidth - 32 : innerWidth * 0.42) / 390;
      phone.style.setProperty("--s", Math.max(0.45, Math.min(1, byHeight, byWidth)).toFixed(3));
    });
  }

  // ── Телефоны: загрузка, готовность, пауза ─────────────────────────────
  // сколько слайдов вокруг текущего держим загруженными: на телефоне памяти мало
  const reach = () => (innerWidth <= 960 ? 1 : slides.length);

  function pause(phone, paused) {
    const frame = $("iframe", phone);
    frame.dataset.paused = String(paused);
    if (phone.classList.contains("is-loaded")) frame.contentWindow.postMessage({ type: "mw-pause", paused }, location.origin);
  }

  function load(phone, src) {
    const frame = $("iframe", phone);
    if (frame.dataset.loaded === src) return;
    frame.dataset.loaded = src;
    frame.dataset.paused = String(phones.indexOf(phone) !== at);
    phone.classList.remove("is-loaded");
    phone.classList.add("is-loading");
    frame.src = src;
  }

  function unload(phone) {
    const frame = $("iframe", phone);
    if (!frame.dataset.loaded) return;
    delete frame.dataset.loaded;
    frame.src = "about:blank";
    phone.classList.remove("is-loaded", "is-loading");
  }

  function ready(phone) {
    if (!phone.classList.contains("is-loading")) return;
    phone.classList.replace("is-loading", "is-loaded");
    pause(phone, phones.indexOf(phone) !== at);
    preload();
  }

  // фон: по одному, следующий – когда готов предыдущий; ближние к текущему первыми, вперёд раньше назад
  function preload() {
    if (phones.some((phone) => phone && phone.classList.contains("is-loading"))) return;
    const next = phones
      .map((phone, k) => ({ phone, k, d: Math.abs(k - at) }))
      .filter(({ phone, d }) => phone && d <= reach() && !$("iframe", phone).dataset.loaded)
      .sort((a, b) => a.d - b.d || b.k - a.k)[0];
    if (next) load(next.phone, next.phone.dataset.current || next.phone.dataset.src);
  }

  // «готов» – первый экран прототипа отрисован; запасной сигнал – load всей страницы
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== "mw-ready") return;
    const phone = phones.find((p) => p && $("iframe", p).contentWindow === e.source);
    if (phone) ready(phone);
  });
  phones.forEach((phone) => {
    if (phone) $("iframe", phone).addEventListener("load", (e) => e.target.dataset.loaded && ready(phone));
  });

  // ── Слайды ────────────────────────────────────────────────────────────
  function go(i, { push = true } = {}) {
    at = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((slide, k) => {
      slide.classList.toggle("is-active", k === at);
      slide.inert = k !== at;
    });
    phones.forEach((phone, k) => {
      if (!phone) return;
      if (k === at) load(phone, phone.dataset.current || phone.dataset.src);
      else if (Math.abs(k - at) > reach()) unload(phone);
      pause(phone, k !== at);
    });
    preload();
    $("#dk-count").textContent = `${at + 1} / ${slides.length}`;
    $("#dk-prev").disabled = at === 0;
    $("#dk-next").disabled = at === slides.length - 1;
    if (push) history.replaceState(null, "", `#${at + 1}`);
  }

  $("#dk-prev").addEventListener("click", () => go(at - 1));
  $("#dk-next").addEventListener("click", () => go(at + 1));

  // клавиши – когда фокус не в прототипе (в нём свои стрелки: вкладки маркета)
  document.addEventListener("keydown", (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, PageDown: 1, " ": 1, ArrowLeft: -1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (e.key === "Home") return go(0);
    if (e.key === "End") return go(slides.length - 1);
    if (!step || e.target.closest(".dk-toggles")) return;
    e.preventDefault();
    go(at + step);
  });

  // свайп по тексту слайда (над телефоном жесты – его)
  let touch = null;
  $("#deck").addEventListener("touchstart", (e) => {
    if (e.target.closest(".dk-phone")) return;
    touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  $("#deck").addEventListener("touchend", (e) => {
    if (!touch) return;
    const dx = e.changedTouches[0].clientX - touch.x;
    const dy = e.changedTouches[0].clientY - touch.y;
    touch = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(at + (dx < 0 ? 1 : -1));
  }, { passive: true });

  // ── Переключатели под телефоном ───────────────────────────────────────
  $$(".dk-toggle").forEach((toggle) =>
    toggle.addEventListener("click", () => {
      const stage = toggle.closest(".dk-slide__stage");
      const phone = $(".dk-phone", stage);
      $$(".dk-toggle", stage).forEach((t) => t.setAttribute("aria-pressed", String(t === toggle)));
      phone.dataset.current = toggle.dataset.src;
      $("iframe", phone).title = `${phone.querySelector("iframe").title.split(" · ")[0]} · ${toggle.textContent.trim()}`;
      load(phone, toggle.dataset.src);
    })
  );

  fit();
  addEventListener("resize", fit);
  window.BlinkSky && window.BlinkSky.start($(".dk__sky"), { mode: "stars" });

  const fromHash = parseInt(location.hash.slice(1), 10);
  go(Number.isFinite(fromHash) ? fromHash - 1 : 0, { push: false });
  addEventListener("hashchange", () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (Number.isFinite(n) && n - 1 !== at) go(n - 1, { push: false });
  });
})();
