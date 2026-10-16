/*
 * Презентация обновлений маркета: слайды листаются стрелками, кнопками, колесом и свайпом,
 * номер слайда – в адресе (#3). На слайде – живой прототип index.html?embed=…, открытый в
 * нужном месте; переключатели под телефоном меняют, что в нём открыто.
 * Телефон грузится, только пока его слайд на экране: в прототипе видео упаковок и таймеры.
 */
(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const slides = $$(".dk-slide");
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

  function load(phone, src) {
    const frame = $("iframe", phone);
    phone.classList.remove("is-loaded");
    frame.onload = () => frame.src !== "about:blank" && phone.classList.add("is-loaded");
    frame.src = src;
  }

  function unload(phone) {
    const frame = $("iframe", phone);
    if (frame.getAttribute("src") && frame.getAttribute("src") !== "about:blank") frame.src = "about:blank";
    phone.classList.remove("is-loaded");
  }

  // ── Слайды ────────────────────────────────────────────────────────────
  function go(i, { push = true } = {}) {
    at = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((slide, k) => {
      const on = k === at;
      slide.classList.toggle("is-active", on);
      slide.inert = !on;
      const phone = $(".dk-phone", slide);
      if (!phone) return;
      if (on) load(phone, phone.dataset.current || phone.dataset.src);
      else unload(phone);
    });
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
