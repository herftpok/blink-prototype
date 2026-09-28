/*
 * Частицы на холсте: звёзды фона маркета, снег новогоднего маркета и „снежный шар“ –
 * снег, который после тряски телефона летит по диагонали через весь экран и оседает.
 *
 *   const sky = BlinkSky.start(canvas, { mode: "stars" });   // "stars" | "snow" | "none"
 *   BlinkSky.start(canvas, { mode: "none", shade: true });   // над светлым (карта): у снежинок тень
 *   sky.set("snow");  sky.mode  // → "snow"
 *   sky.globe();        // встряхнули: вихрь по диагонали, через несколько секунд оседает
 *   sky.globe(60000);   // вихрь подольше (снимки состояний)
 *   sky.confetti(["#ff75e1", "#73edff"]);         // праздник: ленточки падают сверху и уходят за край
 *   sky.confetti(colors, 44, true);                // уже в кадре (снимки состояний)
 *   sky.stop();
 *
 * Холст сам подстраивается под размер и плотность пикселей, рисует только пока виден.
 * prefers-reduced-motion: звёзды и снег стоят на месте, вихря нет.
 */
(() => {
  "use strict";

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (a, b) => a + Math.random() * (b - a);

  // Плотность – на 390×844 pt: столько частиц на экран телефона
  const STAR_COUNT = 70;
  const SNOW_COUNT = 64;
  const GLOBE_COUNT = 220;
  const GLOBE_MS = 3600;          // сколько вихрь несётся, прежде чем осесть

  function start(canvas, { mode = "stars", shade = false } = {}) {
    const ctx = canvas.getContext("2d");
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = 0;
    let current = mode;
    let stars = [];
    let flakes = [];
    let globe = [];
    let globeStart = 0;
    let globeMs = GLOBE_MS;
    let confetti = [];

    const scale = () => (w * h) / (390 * 844);

    function makeStars() {
      stars = Array.from({ length: Math.round(STAR_COUNT * scale()) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: rand(0.5, 1.4),
        a: rand(0.18, 0.55),
        phase: Math.random() * Math.PI * 2,
        speed: rand(0.4, 1.2),
      }));
    }

    const flake = (y = Math.random() * h) => ({
      x: Math.random() * w,
      y,
      r: rand(1, 3.2),
      a: rand(0.35, 0.85),
      vy: rand(14, 34),
      drift: rand(6, 16),
      phase: Math.random() * Math.PI * 2,
    });

    function makeSnow() {
      flakes = Array.from({ length: Math.round(SNOW_COUNT * scale()) }, () => flake());
    }

    function resize() {
      // плотность – системная: рамка холста меняется, когда телефон качают (transform), и считать
      // по ней нельзя – холст пересоздавался бы каждый кадр
      const nw = canvas.offsetWidth;
      const nh = canvas.offsetHeight;
      if (!nw || !nh) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (nw === w && nh === h && canvas.width === Math.round(nw * dpr)) return;
      w = nw;
      h = nh;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      makeStars();
      makeSnow();
      if (reduced()) draw(0, 0);
    }

    function drawDot(x, y, r, a) {
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    function draw(t, dt) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#fff";
      // белое на светлой карте не видно: мягкая тень даёт снежинке объём
      ctx.shadowColor = shade ? "rgba(20, 30, 60, 0.45)" : "transparent";
      ctx.shadowBlur = shade ? 3 * dpr : 0;
      const still = reduced();
      if (current === "stars") {
        for (const s of stars) {
          const twinkle = still ? 1 : 0.65 + 0.35 * Math.sin(t / 1000 * s.speed + s.phase);
          drawDot(s.x, s.y, s.r, s.a * twinkle);
        }
      }
      if (current === "snow") {
        for (const f of flakes) {
          if (!still) {
            f.y += f.vy * dt;
            f.x += Math.sin(t / 1400 + f.phase) * f.drift * dt;
            if (f.y > h + 6) Object.assign(f, flake(-6));
            if (f.x < -6) f.x = w + 6;
            if (f.x > w + 6) f.x = -6;
          }
          drawDot(f.x, f.y, f.r, f.a);
        }
      }
      // конфетти: ленточки кувыркаются (сжатие по ширине – переворот) и падают с лёгким качанием
      if (confetti.length) {
        for (const p of confetti) {
          p.y += p.vy * dt;
          p.x += (p.vx + Math.sin(t / 320 + p.phase) * p.sway) * dt;
          p.rot += p.vr * dt;
          p.flip += p.vflip * dt;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(Math.cos(p.flip), 1);
          ctx.globalAlpha = 1;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
          ctx.restore();
        }
        confetti = confetti.filter((p) => p.y < h + 30);
        ctx.fillStyle = "#fff";
      }
      // снежный шар: вихрь по диагонали, быстро – потом медленнее, оседает и тает
      if (globe.length) {
        const age = t - globeStart;
        const k = Math.max(0, 1 - age / globeMs);         // 1 → 0: сила вихря
        for (const g of globe) {
          const speed = g.speed * (0.18 + 0.82 * k * k);
          g.x += (g.dx * speed + Math.sin(t / 380 + g.phase) * 22 * k) * dt;
          g.y += (g.dy * speed + 18 * (1 - k)) * dt;
          if (g.x > w + 10) g.x = -10;
          if (g.y > h + 10) { g.y = -10; g.x = Math.random() * w; }
          const fade = age > globeMs ? Math.max(0, 1 - (age - globeMs) / 1400) : 1;
          drawDot(g.x, g.y, g.r, g.a * fade);
        }
        if (age > globeMs + 1400) globe = [];
      }
      ctx.globalAlpha = 1;
    }

    function frame(t) {
      raf = 0;
      if (!canvas.isConnected) return;
      resize();
      const visible = canvas.offsetParent !== null && w > 0;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      if (visible) draw(t, dt);
      if (!reduced() || globe.length || confetti.length) raf = requestAnimationFrame(frame);
    }

    function kick() {
      if (!raf) {
        last = 0;
        raf = requestAnimationFrame(frame);
      }
    }

    if (typeof ResizeObserver !== "undefined") new ResizeObserver(() => { resize(); kick(); }).observe(canvas);
    resize();
    kick();

    return {
      /** что сейчас на небе: "stars" | "snow" | "none" */
      get mode() {
        return current;
      },
      set(next) {
        current = next;
        if (next === "snow") makeSnow();
        kick();
      },
      /** Встряхнули телефон: снег по диагонали через весь экран, потом оседает */
      globe(duration = GLOBE_MS) {
        if (reduced()) return;
        resize();
        globeStart = performance.now();
        globeMs = duration;
        const angle = rand(0.5, 0.7);                     // ~30–40° вниз вправо
        globe = Array.from({ length: Math.round(GLOBE_COUNT * scale()) }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: rand(1.6, 4.4),
          a: rand(0.6, 1),
          dx: Math.cos(angle),
          dy: Math.sin(angle),
          speed: rand(380, 760),
          phase: Math.random() * Math.PI * 2,
        }));
        kick();
      },
      /** Праздник: ленточки конфетти цветами системы сыплются сверху, волнами, и уходят за нижний край */
      confetti(colors = ["#fff"], count = 44, inView = false) {
        if (reduced()) return;
        resize();
        confetti = Array.from({ length: Math.round(count * Math.sqrt(scale())) }, () => ({
          x: Math.random() * w,
          y: inView ? rand(-12, h * 0.6) : -rand(12, h * 0.55),
          w: rand(5, 8),
          h: rand(10, 17),
          color: colors[Math.floor(Math.random() * colors.length)],
          vx: rand(-24, 24),
          vy: rand(190, 300),
          sway: rand(18, 46),
          phase: Math.random() * Math.PI * 2,
          rot: Math.random() * Math.PI * 2,
          vr: rand(-5, 5),
          flip: Math.random() * Math.PI * 2,
          vflip: rand(6, 12),
        }));
        kick();
      },
      stop() {
        cancelAnimationFrame(raf);
        raf = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      },
    };
  }

  window.BlinkSky = { start };
})();
