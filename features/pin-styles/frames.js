/*
 * Платные рамки пина: форма контура вытекает из материала.
 * Основа – тот же кадр 52, сквиркл r21, окно под фото не меняется (внутренний край кольца 3.5).
 * Наружный край отходит от сквиркла не дальше 5 pt и только там, где этого требует материал:
 * кристаллы друзы, подвеска ожерелья, ворс, рваный обугленный край.
 * Белого фона за живой аватаркой нет: внутри кадра – тот же материал (кристалл, перламутр,
 * мех, бумага), человек стоит на нём.
 *
 * Каждая рамка – картинка 64 × 64 pt (кадр + поля 6 pt), 7 px на pt: в фокусе ×3 на экране @2x
 * это 6 px на pt, с запасом. Картинка ложится CSS-переменной --ring-<id> на :root;
 * pin-styles.css кладёт её в слой .pin__skin--back под фото – голова живой аватарки остаётся
 * перед рамкой.
 * Фототекстуры (CC0) – prototype/assets/pin-styles/, источники – ASSETS.md.
 */
(() => {
  "use strict";

  // px на pt: 7 в прототипе; страница выгрузки для фигмы (export.html) ставит 16
  const PT = window.BlinkFramesScale || 7;
  const M = 6;                       // поле вокруг кадра, pt
  const C = (52 + 2 * M) * PT;       // сторона холста, px
  const R = 21;                      // радиус кадра, pt
  const RING = 3.5;                  // кольцо, pt
  const A = "../../assets/pin-styles";

  // ── Общее ─────────────────────────────────────────────────────────────

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** шум по кругу: n(t), t от 0 до 1, замкнут; примерно от −1 до 1 */
  function loopNoise(seed, octaves = [[6, 1], [13, 0.5], [29, 0.25]]) {
    const r = rng(seed);
    const waves = octaves.map(([f, a]) => ({ f, a, ph: r() * Math.PI * 2, ph2: r() * Math.PI * 2 }));
    const norm = waves.reduce((s, w) => s + w.a * 1.5, 0);
    return (t) => waves.reduce((s, w) => s + w.a * (Math.sin(t * Math.PI * 2 * w.f + w.ph) + 0.5 * Math.sin(t * Math.PI * 2 * w.f * 2 + w.ph2)), 0) / norm;
  }

  const X = (v) => (v + M) * PT;      // pt кадра → px холста

  /** точки по сквирклу с отступом off внутрь (отрицательный – наружу), равномерно по длине:
      {x, y, nx, ny, tx, ty, t} в pt кадра; t – доля обхода по часовой с верхней грани */
  function outline(n, off = 0, phase = 0) {
    const r = R - off, a = off, b = 52 - off;
    const straight = b - a - 2 * r, arc = (Math.PI / 2) * r;
    const total = 4 * (straight + arc);
    const corners = [[b - r, a + r], [b - r, b - r], [a + r, b - r], [a + r, a + r]];
    const starts = [[a + r, a], [b, a + r], [b - r, b], [a, b - r]];
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = ((((i + phase) / n) % 1) + 1) % 1;
      let s = t * total;
      for (let k = 0; k < 4; k++) {
        const [dx, dy] = dirs[k];
        if (s <= straight) {
          pts.push({ x: starts[k][0] + dx * s, y: starts[k][1] + dy * s, nx: dy, ny: -dx, tx: dx, ty: dy, t });
          break;
        }
        s -= straight;
        if (s <= arc + 1e-9 || k === 3) {
          const ang = -Math.PI / 2 + (k * Math.PI) / 2 + s / r;
          const nx = Math.cos(ang), ny = Math.sin(ang);
          pts.push({ x: corners[k][0] + nx * r, y: corners[k][1] + ny * r, nx, ny, tx: -ny, ty: nx, t });
          break;
        }
        s -= arc;
      }
    }
    return pts;
  }

  const perimeter = (off) => 4 * (52 - 2 * R) + 2 * Math.PI * (R - off);

  function canvas(size = C) {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  }

  function polyPath(g, pts, open = false) {
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(X(p.x), X(p.y)) : g.moveTo(X(p.x), X(p.y))));
    if (!open) g.closePath();
  }

  /** окно под фото – внутренний край кольца (на 0.5 под белым кадром, чтобы не было шва) */
  function addHole(g) {
    const i = RING - 0.5;
    g.roundRect(X(i), X(i), (52 - 2 * i) * PT, (52 - 2 * i) * PT, (R - i) * PT);
  }

  /** форма кольца: наружный контур + окно, заливка по правилу чётности */
  function ringShape(g, pts) {
    polyPath(g, pts);
    addHole(g);
  }

  function pattern(g, img, scale, rot = 0) {
    const p = g.createPattern(img, "repeat");
    p.setTransform(new DOMMatrix().rotate(rot).scale((scale * PT) / 7));   // зерно текстуры – в pt, при любом масштабе
    return p;
  }

  /** свет сверху слева поверх формы (уже в clip) */
  function light(g, a = 0.3, b = 0.25) {
    const gr = g.createLinearGradient(0, 0, C, C);
    gr.addColorStop(0, `rgba(255,255,255,${a})`);
    gr.addColorStop(0.5, "rgba(255,255,255,0)");
    gr.addColorStop(1, `rgba(0,0,0,${b})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, C, C);
  }

  function load(name) {
    return new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = fail;
      img.src = `${A}/${name}`;
    });
  }

  // ── Выгрузка для фигмы ───────────────────────────────────────────────
  // В прототипе слои сразу складываются в одну картинку. export.html включает сбор:
  // каждый слой отдельно, векторные контуры (SVG, координаты в pt, холст 64 × 64) и точки
  const EX = window.BlinkFramesExport ? {} : null;
  const part = (id) => (EX[id] = EX[id] || { layers: {}, svg: {}, data: {} });
  const keep = (id, name, c) => EX && (part(id).layers[name] = c);
  const keepSvg = (id, name, body) => EX && (part(id).svg[name] = body);
  const keepData = (id, name, v) => EX && (part(id).data[name] = v);
  const f2 = (v) => (+v).toFixed(2);
  /** путь по точкам в pt холста 64 (кадр сдвинут на поле 6) */
  const svgPath = (pts, close = true) =>
    pts.map((p, i) => `${i ? "L" : "M"}${f2(p.x + M)} ${f2(p.y + M)}`).join("") + (close ? "Z" : "");
  const stack = (...layers) => {
    const c = canvas();
    const g = c.getContext("2d");
    layers.forEach((l) => g.drawImage(l, 0, 0));
    return c;
  };

  /** весь кадр – сквиркл 52 r21 (под материал внутри) */
  function framePath(g) {
    g.beginPath();
    g.roundRect(X(0), X(0), 52 * PT, 52 * PT, R * PT);
  }

  /** граница окна: светлая кромка и тень внутрь – кольцо читается, даже когда внутри тот же материал */
  function windowEdge(g, dark = "rgba(0,0,0,0.35)", lightCol = "rgba(255,255,255,0.7)") {
    if (!g) {                                         // отдельным слоем
      const c = canvas();
      windowEdge(c.getContext("2d"), dark, lightCol);
      return c;
    }
    const i = RING;
    g.save();
    framePath(g);
    g.clip();
    g.beginPath();
    g.roundRect(X(i), X(i), (52 - 2 * i) * PT, (52 - 2 * i) * PT, (R - i) * PT);
    g.strokeStyle = dark;
    g.lineWidth = 0.9 * PT;
    g.filter = `blur(${0.5 * PT}px)`;
    g.stroke();
    g.filter = "none";
    if (lightCol) {
      g.strokeStyle = lightCol;
      g.lineWidth = 0.25 * PT;
      g.stroke();
    }
    g.restore();
  }

  // ── Алмаз: необработанный камень ──────────────────────────────────────
  // Кольцо – камень с неровной огранкой: многоугольник из граней разной длины, вершины
  // выступают по-разному, два скола торчат сильнее (слева внизу и справа вверху) – камень
  // несимметричный. Внутри кольца – второй ряд вершин: грани-треугольники и грани до окна
  // неправильной формы, у каждой свой свет. Материал – фото огранённого хрусталя,
  // внутри кадра – тот же хрусталь, светлый: окно в камне
  function crystal(tex) {
    const inside = canvas();
    const facets = canvas();
    let g = inside.getContext("2d");
    const r = rng(17);
    // вершины наружного контура: неровный шаг по обходу и неровный вынос наружу
    const ts = [0.02, 0.1, 0.17, 0.27, 0.355, 0.44, 0.53, 0.6, 0.67, 0.76, 0.85, 0.93];
    const lift = [0.6, 1.2, 2.6, 0.5, 1.4, 0.3, 1.0, 1.6, 3.0, 0.7, 1.8, 0.4];
    const outer = ts.map((t, i) => {
      const p = outline(1, 0, t + (r() - 0.5) * 0.015)[0];
      return { x: p.x + p.nx * lift[i], y: p.y + p.ny * lift[i], t: p.t };
    });
    const n = outer.length;
    // второй ряд – между наружными вершинами, внутри кольца на разной глубине
    const mid = outer.map((o, i) => {
      const t2 = (o.t + ((outer[(i + 1) % n].t - o.t + 1) % 1) / 2) % 1;
      const p = outline(1, 1.3 + r() * 1.2, t2)[0];
      return { x: p.x, y: p.y, t: p.t };
    });
    const win = (t0, t1) => {                       // дуга окна от t0 до t1 по часовой
      const span = (t1 - t0 + 1) % 1, k = Math.max(2, Math.ceil(span * 60));
      return Array.from({ length: k + 1 }, (_, j) => outline(1, RING - 0.4, (t0 + (span * j) / k) % 1)[0]);
    };
    const crystalFill = (contrast, bright, tint) => {
      g.filter = `grayscale(0.7) contrast(${contrast}) brightness(${bright})`;
      g.fillStyle = pattern(g, tex, 0.32, 12);
      g.fillRect(0, 0, C, C);
      g.filter = "none";
      g.globalCompositeOperation = "soft-light";
      g.fillStyle = tint;
      g.fillRect(0, 0, C, C);
      g.globalCompositeOperation = "source-over";
    };
    // окно в камне
    g.save();
    g.beginPath();
    addHole(g);
    g.clip();
    crystalFill(1.25, 1.55, "rgb(175,215,255)");
    const vg = g.createRadialGradient(C / 2, C / 2, 10 * PT, C / 2, C / 2, 30 * PT);
    vg.addColorStop(0, "rgba(255,255,255,0.25)");
    vg.addColorStop(1, "rgba(40,70,120,0.35)");
    g.fillStyle = vg;
    g.fillRect(0, 0, C, C);
    g.restore();
    g = facets.getContext("2d");
    // грани: треугольник у края, грань-ромб между ними и грань до окна
    const faces = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, k = (i - 1 + n) % n;
      faces.push([outer[i], outer[j], mid[i]]);
      faces.push([mid[k], outer[i], mid[i]]);
      faces.push([mid[k], mid[i], ...win(mid[k].t, mid[i].t).reverse()]);   // короткая дуга окна от k до i
    }
    // сплошной хрусталь под гранями: на стыках граней сглаживание оставляет щели
    g.save();
    ringShape(g, outer);
    g.clip("evenodd");
    crystalFill(1.9, 1.22, "rgb(150,200,255)");
    g.restore();
    const L = [-0.6, -0.8];
    const svgFaces = [];
    for (const f of faces) {
      const cx = f.reduce((a, p) => a + p.x, 0) / f.length - 26, cy = f.reduce((a, p) => a + p.y, 0) / f.length - 26;
      const len = Math.hypot(cx, cy) || 1;
      const lit = Math.max(-1, Math.min(1, (cx / len) * L[0] + (cy / len) * L[1] + (r() - 0.5) * 0.9));
      const shade = lit > 0 ? `rgba(255,255,255,${(lit * 0.55).toFixed(3)})` : `rgba(12,32,75,${(-lit * 0.5).toFixed(3)})`;
      svgFaces.push(`<path d="${svgPath(f)}" fill="${shade}" stroke="rgba(255,255,255,0.55)" stroke-width="0.2" stroke-linejoin="miter"/>`);
      g.save();
      polyPath(g, f);
      g.clip();
      crystalFill(1.9, 1.22, "rgb(150,200,255)");
      g.fillStyle = shade;
      g.fillRect(0, 0, C, C);
      g.restore();
      polyPath(g, f);
      g.strokeStyle = "rgba(255,255,255,0.55)";
      g.lineWidth = 0.2 * PT;
      g.lineJoin = "miter";
      g.stroke();
    }
    polyPath(g, outer);
    g.strokeStyle = "rgba(255,255,255,0.95)";
    g.lineWidth = 0.35 * PT;
    g.stroke();
    const edge = windowEdge(null, "rgba(20,40,90,0.4)", "rgba(255,255,255,0.75)");
    // искры – на самых выступающих вершинах
    const glints = [outer[8], outer[2], outer[10], outer[6]];
    keep("crystal", "1-inside", inside);
    keep("crystal", "2-facets", facets);
    keep("crystal", "3-window-edge", edge);
    keepSvg("crystal", "outline", `<path d="${svgPath(outer)}" fill="#fff"/>`);
    keepSvg("crystal", "facets", svgFaces.join("") + `<path d="${svgPath(outer)}" fill="none" stroke="rgba(255,255,255,0.95)" stroke-width="0.35"/>`);
    keepData("crystal", "glints", glints.map((p) => ({ x: +f2(p.x), y: +f2(p.y) })));
    return { ring: stack(inside, facets, edge), glints };
  }

  // ── Жемчуг: ожерелье ──────────────────────────────────────────────────
  // Нитка лежит по краю кадра: жемчужины крупнее внизу и мельче вверху. Голова живой
  // аватарки – перед ожерельем, как перед обычной рамкой. Внутри кадра – перламутр
  function nacre() {
    const c = canvas();
    const g = c.getContext("2d");
    const img = g.createImageData(C, C);
    const r = rng(13);
    const P = 48, grid = Array.from({ length: P * P }, r);
    const at = (x, y) => grid[((y % P) + P) % P * P + (((x % P) + P) % P)];
    const sm = (t) => t * t * (3 - 2 * t);
    const noise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
      const a = at(xi, yi), b = at(xi + 1, yi), cc = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * xf + (cc - a) * yf + (a - b - cc + d) * xf * yf;
    };
    for (let y = 0; y < C; y++) {
      for (let x = 0; x < C; x++) {
        const u = x / PT, v = y / PT;
        const w = noise(u / 9, v / 9) * 0.6 + noise(u / 4, v / 4) * 0.3 + noise(u / 2, v / 2) * 0.1;
        const band = Math.sin((u * 0.35 + v * 0.2 + w * 9) * 1.2);
        const h = (w * 5 + u * 0.03) * Math.PI * 2;
        const i = (y * C + x) * 4;
        const base = 226 + band * 14;
        img.data[i] = Math.min(255, base + 24 * Math.cos(h));
        img.data[i + 1] = Math.min(255, base - 4 + 20 * Math.cos(h - 2.1));
        img.data[i + 2] = Math.min(255, base + 6 + 28 * Math.cos(h + 2.1));
        img.data[i + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    // только под фото и под внутренней половиной бусин (до средней линии кольца):
    // снаружи между бусинами – карта, без подложки
    g.globalCompositeOperation = "destination-in";
    g.beginPath();
    const o = RING / 2 + 0.3;
    g.roundRect(X(o), X(o), (52 - 2 * o) * PT, (52 - 2 * o) * PT, (R - o) * PT);
    g.fill();
    g.globalCompositeOperation = "source-over";
    const edge = windowEdge(null, "rgba(120,100,90,0.3)", "rgba(255,255,255,0.8)");
    keep("pearl", "1-nacre", c);
    keep("pearl", "2-window-edge", edge);
    return stack(c, edge);
  }

  function pearlBead(g, x, y, rx, ry, tint) {
    const rr = Math.max(rx, ry);
    const base = tint < 0.33 ? "#f7ecef" : tint < 0.66 ? "#f6f0e4" : "#edf1f6";
    const gr = g.createRadialGradient(x - rx * 0.35, y - ry * 0.4, rr * 0.05, x, y, rr);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(0.35, base);
    gr.addColorStop(0.8, "#cfc4ba");
    gr.addColorStop(1, "#a99d93");
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    const ir = g.createConicGradient(tint * 6, x, y);
    ["rgba(255,180,220,0.18)", "rgba(180,220,255,0.18)", "rgba(220,255,200,0.14)", "rgba(255,180,220,0.18)"]
      .forEach((col, i, arr) => ir.addColorStop(i / (arr.length - 1), col));
    g.fillStyle = ir;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.95)";
    g.beginPath();
    g.ellipse(x - rx * 0.38, y - ry * 0.42, rx * 0.22, ry * 0.15, -0.6, 0, Math.PI * 2);
    g.fill();
  }

  function necklace() {
    const c = canvas();
    const g = c.getContext("2d");
    const r = rng(11);
    const off = RING / 2;
    const N = 3000;
    const line = outline(N, off);
    const L = perimeter(off);
    // размер по высоте: сверху 2.7, внизу 4.6 – ожерелье тяжелеет книзу
    const sizeAt = (p) => 2.7 + (p.y / 52) ** 1.4 * 1.9;
    // нитка начинается и сходится в середине верхней грани (там голова); обход по часовой
    const start = (52 / 2 - R) / L;
    const beads = [];
    let s = 0;
    while (s < L) {
      const p = line[Math.floor(((start + s / L) % 1) * N)];
      const d = sizeAt(p) * (0.94 + r() * 0.12);
      beads.push({ s: s + d / 2, d });
      s += d * 0.97;
    }
    const k = L / s;                         // подгоняем, чтобы нитка сошлась у застёжки
    const placed = beads.map((b) => {
      const p = line[Math.floor(((start + (b.s * k) / L) % 1) * N)];
      return { x: p.x, y: p.y, r: (b.d / 2) * Math.min(1, k * 1.02), tint: r() };
    });
    for (const b of placed) {
      g.fillStyle = "rgba(60,40,30,0.3)";
      g.beginPath();
      g.ellipse(X(b.x + 0.2), X(b.y + 0.5), b.r * PT, b.r * PT * 0.92, 0, 0, Math.PI * 2);
      g.fill();
    }
    for (const b of placed) pearlBead(g, X(b.x), X(b.y), b.r * PT, b.r * PT, b.tint);
    keep("pearl", "3-beads", c);
    keepSvg("pearl", "beads", placed.map((b) => `<circle cx="${f2(b.x + M)}" cy="${f2(b.y + M)}" r="${f2(b.r)}" fill="#fff"/>`).join(""));
    keepData("pearl", "beads", placed.map((b) => ({ x: +f2(b.x), y: +f2(b.y), d: +f2(b.r * 2) })));
    return c;
  }

  // ── Мех ───────────────────────────────────────────────────────────────
  // Розовый искусственный мех – и кольцо, и всё внутри кадра; по наружному краю ворсинки
  // выходят на 1–2 pt. Два слоя ворса медленно сменяют друг друга – мех еле шевелится
  function fur(tex) {
    const sample = canvas(512);
    const sg = sample.getContext("2d");
    sg.drawImage(tex, 0, 0, 512, 512);
    const px = sg.getImageData(0, 0, 512, 512).data;
    const colorAt = (x, y) => {
      const i = ((Math.floor(Math.abs(y * 37)) % 512) * 512 + (Math.floor(Math.abs(x * 37)) % 512)) * 4;
      return [px[i], px[i + 1], px[i + 2]];
    };
    const base = canvas();
    const g = base.getContext("2d");
    g.save();
    polyPath(g, outline(200, -0.4));
    g.clip();
    g.fillStyle = pattern(g, tex, 0.5, 30);
    g.fillRect(0, 0, C, C);
    light(g, 0.15, 0.3);
    g.restore();
    const edge = windowEdge(null, "rgba(120,20,70,0.45)", null);
    const strands = (seed) => {
      const c = canvas();
      const h = c.getContext("2d");
      const r = rng(seed);
      h.lineCap = "round";
      for (let i = 0; i < 1500; i++) {
        const p = outline(1, r() * 1.6 - 0.2, r())[0];
        const a = Math.atan2(p.ny, p.nx) + (r() - 0.5) * 1.1;
        const len = 0.9 + r() ** 1.5 * 1.6;
        const bend = (r() - 0.5) * 0.8;
        const [cr, cg, cb] = colorAt(p.x, p.y);
        const lift = 1 + (r() - 0.3) * 0.35;
        h.strokeStyle = `rgba(${Math.min(255, cr * lift)},${Math.min(255, cg * lift)},${Math.min(255, cb * lift)},0.9)`;
        h.lineWidth = (0.18 + r() * 0.12) * PT;
        h.beginPath();
        h.moveTo(X(p.x), X(p.y));
        h.quadraticCurveTo(
          X(p.x + Math.cos(a) * len * 0.5 - Math.sin(a) * bend), X(p.y + Math.sin(a) * len * 0.5 + Math.cos(a) * bend),
          X(p.x + Math.cos(a + bend * 0.6) * len), X(p.y + Math.sin(a + bend * 0.6) * len)
        );
        h.stroke();
      }
      return c;
    };
    const hairA = strands(31), hairB = strands(37);
    keep("fur", "1-fur", base);
    keep("fur", "2-window-edge", edge);
    keep("fur", "3-hair-a", hairA);
    keep("fur", "4-hair-b", hairB);
    keepSvg("fur", "outline", `<path d="${svgPath(outline(200, -0.4))}" fill="#fff"/>`);
    return { ring: stack(base, edge), strandsA: hairA, strandsB: hairB };
  }

  // ── Тлеющая бумага ────────────────────────────────────────────────────
  // Лист мятой бумаги, край обгорел крупными волнами и выгрызами: у кромки чёрное, коричневое,
  // потом пожелтевшая бумага – она же внутри кадра. Местами кромка тлеет – отдельный слой,
  // свечение медленно ползёт по кругу (pin-styles.css)
  function burnt(tex) {
    const c = canvas();
    const g = c.getContext("2d");
    const r = rng(41);
    const swell = loopNoise(43, [[5, 1], [11, 0.5]]);
    // зубцы: вершины через 0.5–1.4 pt, через одну наружу и внутрь, прямые отрезки – края острые;
    // изредка глубокий надрыв
    // край как у настоящей обгоревшей бумаги: крупные плавные волны и несколько выгрызов
    // (огонь съедает лист дугами), поверх – мелкая неровность в доли pt. Частых зубцов нет
    const wave = loopNoise(45, [[3, 1], [7, 0.55], [13, 0.25]]);
    const fine = loopNoise(49, [[41, 1], [83, 0.6]]);
    const bites = [0.07, 0.23, 0.41, 0.58, 0.76, 0.9].map((t) => ({ t: t + (r() - 0.5) * 0.04, w: 0.012 + r() * 0.012, d: 0.6 + r() * 0.7 }));
    const edge = [];
    const L = perimeter(0);
    for (let s = 0; s < L; s += 0.25) {
      const t = s / L, p = outline(1, 0, t)[0];
      let d = 0.25 + wave(t) * 0.75 + swell(t) * 0.2 + fine(t) * 0.12 + (r() - 0.5) * 0.06;
      for (const b of bites) {
        const u = Math.abs(((t - b.t + 1.5) % 1) - 0.5) / b.w;   // расстояние до центра выгрыза
        if (u < 1) d -= b.d * Math.sqrt(1 - u * u);              // дуга – как край, съеденный огнём
      }
      edge.push({ ...p, x: p.x + p.nx * d, y: p.y + p.ny * d });
    }
    g.save();
    polyPath(g, edge);
    g.clip();
    g.fillStyle = pattern(g, tex, 0.6);
    g.fillRect(0, 0, C, C);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = "rgb(244, 226, 190)";
    g.fillRect(0, 0, C, C);
    g.globalCompositeOperation = "source-over";
    for (const [w, col] of [[4.2, "rgba(140,80,30,0.35)"], [2.8, "rgba(80,40,14,0.7)"], [1.6, "rgba(25,12,6,0.95)"]]) {
      polyPath(g, edge);
      g.strokeStyle = col;
      g.lineWidth = w * PT;
      g.lineJoin = "round";
      g.stroke();
    }
    light(g, 0.15, 0.2);
    g.restore();
    const shade = windowEdge(null, "rgba(90,50,20,0.35)", null);
    const ember = canvas();
    const e = ember.getContext("2d");
    const hot = loopNoise(47, [[7, 1], [17, 0.5]]);
    e.lineCap = "round";
    e.lineJoin = "miter";
    e.shadowColor = "rgba(255,90,0,0.9)";
    e.shadowBlur = 1.4 * PT;
    for (let k = 0; k < edge.length; k++) {
      const p = edge[k], q = edge[(k + 1) % edge.length];
      const h = hot(p.t);
      if (h < 0.05) continue;
      e.strokeStyle = h > 0.45 ? "#ffd36a" : "#ff7a1a";
      e.lineWidth = (0.3 + h * 0.3) * PT;
      e.beginPath();
      e.moveTo(X(p.x - p.nx * 0.2), X(p.y - p.ny * 0.2));
      e.lineTo(X(q.x - q.nx * 0.2), X(q.y - q.ny * 0.2));
      e.stroke();
    }
    keep("burnt", "1-paper", c);
    keep("burnt", "2-window-edge", shade);
    keep("burnt", "3-ember", ember);
    keepSvg("burnt", "outline", `<path d="${svgPath(edge)}" fill="#fff"/>`);
    return { ring: stack(c, shade), ember };
  }

  // ── Сборка ────────────────────────────────────────────────────────────

  const root = document.documentElement;
  const put = (name, c) => root.style.setProperty(name, `url("${c.toDataURL("image/webp", 0.92)}")`);
  window.BlinkFrames = { glints: [], ready: false };

  Promise.all(["crystal.webp", "fur.webp", "paper.webp"].map(load)).then(([cr, fu, pa]) => {
    const k = crystal(cr);
    window.BlinkFrames.glints = k.glints.map((p) => ({ x: p.x, y: p.y }));
    put("--ring-crystal", k.ring);
    // перламутр и ожерелье – одна картинка под фото: голова выходит перед жемчугом
    const pearl = nacre();
    pearl.getContext("2d").drawImage(necklace(), 0, 0);
    put("--ring-pearl", pearl);
    const f = fur(fu);
    put("--ring-fur", f.ring);
    put("--ring-fur-a", f.strandsA);
    put("--ring-fur-b", f.strandsB);
    const b = burnt(pa);
    put("--ring-burnt", b.ring);
    put("--ring-burnt-ember", b.ember);
    window.BlinkFrames.ready = true;
    window.BlinkFrames.export = EX;
    dispatchEvent(new Event("ps-frames-ready"));
  });
})();
