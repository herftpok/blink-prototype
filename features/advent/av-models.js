/* ==========================================================================
   av-models.js – Blink · «адвент»
   Предметы дней адвента, валюта-снежинка, перчатки «камень, ножницы, бумага», нарядная ёлка, снежные шары
   розыгрыша и призы – three.js, собраны кодом в стиле 3D-стикеров Blink:
   глянцевая пластмасса и «стеклянный» синий, как у стикеров 7, zzz, go.
   Свет и окружение – createLighting из features/new-year (тот же глянец).

   Рендер в картинки – render.html → tools/render_advent.py → renders/*.webp.
   Всё в условных единицах: предмет ~2 по высоте, начало координат в центре.
   ========================================================================== */
import * as THREE from "three";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/* ── палитра: цвета стикеров Blink и системы ───────────────────────────── */

export const PAL = {
  pink: 0xff75e1,
  hotPink: 0xff3fa4,
  lime: 0x96e732,
  cyan: 0x73edff,
  violet: 0xcf91ff,
  gold: 0xf2b53a,
  red: 0xe8283c,
  green: 0x2fb35a,
  white: 0xfbfbfd,
  snow: 0xf2f7ff,
  glass: 0x1756ff,          // «стеклянный» синий стикеров 7 / zzz / go
  iceBlue: 0x6fd6ff,        // голубой – снежинка-валюта
  glassDeep: 0x1d5cff,
  ice: 0xcdefff,
  felt: 0xf1ece4,
  wood: 0xb8783e,
  cookie: 0xe9a457,
  ink: 0x15131b,
  silver: 0xd9dde6,
};

/* ── материалы ─────────────────────────────────────────────────────────── */

const MAT = new Map();
function memo(key, make) {
  if (!MAT.has(key)) MAT.set(key, make());
  return MAT.get(key);
}

/** Глянцевая пластмасса с лаком – как подарок и эльф в new-year */
export function toy(color, o = {}) {
  const key = `toy:${color}:${JSON.stringify(o)}`;
  return memo(key, () => new THREE.MeshPhysicalMaterial({
    color, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, ...o,
  }));
}

/** «Стекло» стикеров: насыщенный синий, сильные блики, лёгкий перелив */
function candyGlass(color = PAL.glass, o = {}) {
  return toy(color, {
    roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.2, iridescenceIOR: 1.5,
    emissive: 0x0a3cff, emissiveIntensity: 0.32, ...o,
  });
}

const metal = (color, rough = 0.22) => toy(color, { metalness: 1, roughness: rough, clearcoat: 0.6, clearcoatRoughness: 0.08 });
const felt = (color) => toy(color, { roughness: 0.85, clearcoat: 0, sheen: 1, sheenColor: 0xffffff, sheenRoughness: 0.4 });
const snowMat = () => toy(PAL.snow, { roughness: 0.6, clearcoat: 0.25, clearcoatRoughness: 0.4, sheen: 1, sheenColor: 0xdff0ff, sheenRoughness: 0.5 });
const glow = (color, k = 1.6) => memo(`glow:${color}:${k}`, () => {
  const m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  m.color.multiplyScalar(k);
  return m;
});

/* ── текстуры на холсте ────────────────────────────────────────────────── */

function canvasTexture(w, h, draw, srgb = true) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

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

/* ── геометрия ─────────────────────────────────────────────────────────── */

function tf(geo, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  const sc = typeof s === "number" ? [s, s, s] : s;
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], "XYZ")),
    new THREE.Vector3(...sc),
  );
  geo.applyMatrix4(m);
  return geo;
}

/** Скруглённый параллелепипед: куб, у которого каждую вершину сдвинули к своему «углу-шару» */
function roundedBox(w, h, d, r, s = 3) {
  const seg = s * 2 + 1;
  const rr = Array.isArray(r) ? r : [r, r, r];
  const rx = Math.max(0.001, Math.min(rr[0], w / 2 - 0.001));
  const ry = Math.max(0.001, Math.min(rr[1], h / 2 - 0.001));
  const rz = Math.max(0.001, Math.min(rr[2], d / 2 - 0.001));
  const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg);
  const P = g.attributes.position;
  const N = g.attributes.normal;
  const bx = w / 2 - rx;
  const by = h / 2 - ry;
  const bz = d / 2 - rz;
  const half = 0.5 / seg;
  const n = new THREE.Vector3();
  const m = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i);
    const y = P.getY(i);
    const z = P.getZ(i);
    n.set(x - Math.sign(x) * half, y - Math.sign(y) * half, z - Math.sign(z) * half).normalize();
    P.setXYZ(i, bx * Math.sign(x) + n.x * rx, by * Math.sign(y) + n.y * ry, bz * Math.sign(z) + n.z * rz);
    m.set(n.x / rx, n.y / ry, n.z / rz).normalize();
    N.setXYZ(i, m.x, m.y, m.z);
  }
  return g;
}

function lathe(profile, segments = 48) {
  return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y)), segments);
}

/** Труба вдоль точек с круглыми концами */
function tube(points, r, { seg = 48, radial = 14, closed = false } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, "centripetal");
  return new THREE.TubeGeometry(curve, seg, r, radial, closed);
}

function capsule(a, b, r) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const g = new THREE.CapsuleGeometry(r, len, 8, 16);
  const dir = B.clone().sub(A).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyQuaternion(q);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}

/** Плоская фигура с толщиной и скруглённой фаской */
function slab(shape, depth, bevel, segs = 6) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 32,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

function starShape(R, r, points = 5, round = 0.18) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * TAU + Math.PI / 2;
    const rad = i % 2 ? r : R;
    pts.push(new THREE.Vector2(Math.cos(a) * rad, Math.sin(a) * rad));
  }
  // скругляем вершины квадратичными кривыми
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const a = p.clone().lerp(prev, round);
    const b = p.clone().lerp(next, round);
    if (i === 0) s.moveTo(a.x, a.y);
    else s.lineTo(a.x, a.y);
    s.quadraticCurveTo(p.x, p.y, b.x, b.y);
  }
  s.closePath();
  return s;
}

function heartShape(k = 1) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9 * k);
  s.bezierCurveTo(-0.15 * k, -0.7 * k, -1.0 * k, -0.25 * k, -1.0 * k, 0.25 * k);
  s.bezierCurveTo(-1.0 * k, 0.75 * k, -0.45 * k, 0.95 * k, 0, 0.55 * k);
  s.bezierCurveTo(0.45 * k, 0.95 * k, 1.0 * k, 0.75 * k, 1.0 * k, 0.25 * k);
  s.bezierCurveTo(1.0 * k, -0.25 * k, 0.15 * k, -0.7 * k, 0, -0.9 * k);
  return s;
}

function roundRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

const mesh = (geo, mat) => new THREE.Mesh(geo, mat);
function group(...children) {
  const g = new THREE.Group();
  children.flat().forEach((c) => c && g.add(c));
  return g;
}

/* ═════════════════════════════════ МОДЕЛИ ═════════════════════════════ */

/** Снежинка – валюта адвента: шесть лучей с веточками, «стеклянный» синий */
export function snowflake({ color = PAL.iceBlue } = {}) {
  const mat = candyGlass(color, { emissive: 0x1aa6d8, emissiveIntensity: 0.28, iridescence: 0.35 });
  const parts = [];
  const r = 0.12;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + Math.PI / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    parts.push(capsule([dx * 0.22, dy * 0.22, 0], [dx * 0.92, dy * 0.92, 0], r));
    for (const [at, len] of [[0.5, 0.3], [0.74, 0.2]]) {
      for (const side of [-1, 1]) {
        const b = a + side * 50 * DEG;
        const ox = dx * at;
        const oy = dy * at;
        parts.push(capsule([ox, oy, 0], [ox + Math.cos(b) * len, oy + Math.sin(b) * len, 0], r * 0.78));
      }
    }
  }
  const hex = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 6, 1);
  hex.rotateX(Math.PI / 2);
  hex.rotateZ(Math.PI / 6);
  const core = mesh(hex, mat);
  const g = group(parts.map((p) => mesh(p, mat)), core);
  // бусина в центре – блик, как у стикеров
  const bead = mesh(new THREE.SphereGeometry(0.16, 24, 16), toy(0xe9fbff, { roughness: 0.1 }));
  bead.position.z = 0.14;
  bead.scale.z = 0.6;
  g.add(bead);
  g.rotation.set(-0.32, 0.38, 0.12);
  return g;
}

/** Ледяной кубик: замёрзший день. Полупрозрачный, с инеем и пузырьками */
export function iceCube({ cracked = false, seed = 3 } = {}) {
  const frost = canvasTexture(256, 256, (g, w, h) => {
    const R = rng(seed);
    g.fillStyle = "#8a8a8a";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,255,255,${0.08 + R() * 0.3})`;
      g.beginPath();
      g.arc(R() * w, R() * h, R() * 3 + 0.5, 0, TAU);
      g.fill();
    }
  }, false);
  // иней: белые пятна и иглы по краю грани – в map с альфой
  const rime = canvasTexture(256, 256, (g, w, h) => {
    const R = rng(seed + 1);
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const edge = R() < 0.75;
      let x = R() * w;
      let y = R() * h;
      if (edge) {
        const side = Math.floor(R() * 4);
        const d = Math.pow(R(), 2.2) * w * 0.22;
        if (side === 0) y = d; else if (side === 1) y = h - d; else if (side === 2) x = d; else x = w - d;
      }
      g.fillStyle = `rgba(255,255,255,${0.12 + R() * 0.35})`;
      g.beginPath();
      g.arc(x, y, R() * 5 + 1, 0, TAU);
      g.fill();
    }
  });
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0x9fe3ff, roughness: 0.12, roughnessMap: frost, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03,
    transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide, sheen: 1, sheenColor: 0xe6f7ff,
    sheenRoughness: 0.25, iridescence: 0.4, emissive: 0x1a6aa8, emissiveIntensity: 0.25, envMapIntensity: 1.4,
  });
  const g = group(mesh(roundedBox(1.6, 1.6, 1.6, 0.26, 4), shellMat));
  const rimeMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: rime, transparent: true, depthWrite: false, roughness: 0.6, emissive: 0xbfe9ff, emissiveIntensity: 0.25,
  });
  g.add(mesh(roundedBox(1.62, 1.62, 1.62, 0.27, 4), rimeMat));
  if (cracked) {
    const crackMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, toneMapped: false });
    const R = rng(seed + 7);
    const pts = [[-0.1, 0.81]];
    for (let i = 0; i < 6; i++) {
      const [x, y] = pts[pts.length - 1];
      pts.push([x + (R() - 0.5) * 0.5, y - 0.22 - R() * 0.1]);
    }
    g.add(mesh(tube(pts.map(([x, y]) => [x, y, 0.815]), 0.02, { seg: 40, radial: 6 }), crackMat));
    g.add(mesh(tube([[0.02, 0.3, 0.815], [0.3, 0.18, 0.815], [0.52, 0.26, 0.815]], 0.016, { seg: 20, radial: 6 }), crackMat));
    g.add(mesh(tube([[-0.2, -0.1, 0.815], [-0.46, -0.2, 0.815], [-0.62, -0.12, 0.815]], 0.014, { seg: 20, radial: 6 }), crackMat));
  }
  g.rotation.set(-0.28, 0.5, 0);
  return g;
}

/** Ёлочный шар. pattern: stripes | dots | earth (континенты – «города и страны») */
export function ornament({ color = PAL.hotPink, accent = PAL.white, pattern = "stripes", seed = 1 } = {}) {
  let map = null;
  if (pattern === "stripes") {
    map = canvasTexture(512, 256, (g, w, h) => {
      g.fillStyle = `#${new THREE.Color(color).getHexString()}`;
      g.fillRect(0, 0, w, h);
      g.fillStyle = `#${new THREE.Color(accent).getHexString()}`;
      for (const y of [0.32, 0.5, 0.68]) g.fillRect(0, h * y - 9, w, y === 0.5 ? 26 : 12);
      g.fillStyle = "#ffd36b";
      for (let i = 0; i < 16; i++) {
        g.beginPath();
        g.arc((i + 0.5) * (w / 16), h * 0.41, 7, 0, TAU);
        g.arc((i + 0.5) * (w / 16), h * 0.59, 7, 0, TAU);
        g.fill();
      }
    });
  } else if (pattern === "earth") {
    map = canvasTexture(1024, 512, (g, w, h) => {
      g.fillStyle = "#2f8fff";
      g.fillRect(0, 0, w, h);
      const R = rng(seed);
      g.fillStyle = "#96e732";
      // пятна-континенты: облака кругов
      const blobs = [[0.2, 0.32, 0.12], [0.27, 0.62, 0.09], [0.52, 0.3, 0.14], [0.56, 0.58, 0.08], [0.76, 0.36, 0.13], [0.86, 0.66, 0.07]];
      for (const [cx, cy, s] of blobs) {
        for (let i = 0; i < 26; i++) {
          g.beginPath();
          g.arc((cx + (R() - 0.5) * s * 1.4) * w, (cy + (R() - 0.5) * s * 1.6) * h, s * w * (0.2 + R() * 0.3), 0, TAU);
          g.fill();
        }
      }
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, w, h * 0.07);
      g.fillRect(0, h * 0.93, w, h * 0.07);
    });
  } else if (pattern === "dots") {
    map = canvasTexture(512, 256, (g, w, h) => {
      g.fillStyle = `#${new THREE.Color(color).getHexString()}`;
      g.fillRect(0, 0, w, h);
      g.fillStyle = `#${new THREE.Color(accent).getHexString()}`;
      for (let row = 0; row < 6; row++)
        for (let i = 0; i < 12; i++) {
          g.beginPath();
          g.arc((i + (row % 2) * 0.5) * (w / 12), (row + 0.5) * (h / 6), 9, 0, TAU);
          g.fill();
        }
    });
  }
  const ballMat = toy(0xffffff, { map, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.03, key: `orn:${pattern}:${color}:${accent}` });
  const ball = mesh(new THREE.SphereGeometry(1, 64, 48), ballMat);
  const cap = mesh(lathe([[0.001, 1.22], [0.2, 1.22], [0.24, 1.18], [0.25, 1.0], [0.3, 0.94], [0.001, 0.9]]), metal(PAL.gold));
  const loop = mesh(new THREE.TorusGeometry(0.11, 0.035, 12, 32), metal(PAL.gold));
  loop.position.y = 1.31;
  const g = group(ball, cap, loop);
  g.rotation.set(0.1, -0.5, 0.12);
  return g;
}

/** Снежный шар. scene: tree | empty (для розыгрыша – приз кладём картинкой между слоями).
    part: all | back (основание и снег внутри) | glass (только стекло – поверх картинки приза) */
export function snowGlobe({ scene = "tree", part = "all", base = PAL.hotPink, seed = 5 } = {}) {
  const g = new THREE.Group();
  if (part !== "glass") {
    const baseG = lathe([[0.001, -1.42], [0.86, -1.42], [0.98, -1.36], [1.0, -1.2], [0.92, -1.02], [0.8, -0.86], [0.001, -0.86]]);
    g.add(mesh(baseG, toy(base, { roughness: 0.26 })));
    const rim = mesh(new THREE.TorusGeometry(0.8, 0.07, 16, 64), metal(PAL.gold));
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.88;
    g.add(rim);
    // сугроб на дне
    const drift = mesh(lathe([[0.001, -0.5], [0.3, -0.53], [0.6, -0.66], [0.76, -0.8], [0.79, -0.86], [0.001, -0.86]]), snowMat());
    g.add(drift);
    if (scene === "tree") {
      const tiers = [[0.42, -0.5, 0.5], [0.34, -0.18, 0.44], [0.24, 0.1, 0.36]];
      for (const [r, y, h] of tiers) {
        const cone = mesh(lathe([[0.001, y + h], [r * 0.25, y + h * 0.72], [r, y + 0.05], [r * 0.9, y], [0.001, y]]), toy(PAL.green, { roughness: 0.35 }));
        g.add(cone);
        const cap = mesh(lathe([[0.001, y + h + 0.01], [r * 0.3, y + h * 0.7], [r * 0.42, y + h * 0.55], [0.001, y + h * 0.55]]), snowMat());
        g.add(cap);
      }
      const st = mesh(slab(starShape(0.13, 0.06), 0.04, 0.02), metal(PAL.gold, 0.18));
      st.position.y = 0.55;
      g.add(st);
    }
    // хлопья внутри
    const R = rng(seed);
    const flakeMat = toy(0xffffff, { roughness: 0.4 });
    for (let i = 0; i < 26; i++) {
      const p = new THREE.Vector3((R() - 0.5) * 1.5, -0.4 + R() * 1.3, (R() - 0.5) * 1.5);
      if (p.length() > 0.85) continue;
      const f = mesh(new THREE.SphereGeometry(0.025 + R() * 0.025, 8, 6), flakeMat);
      f.position.copy(p);
      g.add(f);
    }
  }
  if (part !== "back") {
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff, roughness: 0.02, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.01, transparent: true,
      opacity: part === "glass" ? 0.18 : 0.14, depthWrite: false, side: THREE.FrontSide, iridescence: 0.4,
      envMapIntensity: 1.6,
    });
    const glass = mesh(new THREE.SphereGeometry(1.0, 64, 48, 0, TAU, 0, Math.PI * 0.86), glassMat);
    glass.position.y = 0.05;
    g.add(glass);
    // блик-«окно» – белая дуга слева сверху
    const hl = mesh(new THREE.TorusGeometry(0.82, 0.035, 8, 48, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, toneMapped: false }));
    hl.position.set(0, 0.05, 0.5);
    hl.rotation.set(0, 0, 1.75);
    g.add(hl);
  }
  g.rotation.set(0.08, 0, 0);
  return g;
}

/** Валенок с галошей – шаги */
export function valenok() {
  const body = felt(0xece6dc);
  const shaft = mesh(roundedBox(0.96, 1.75, 0.88, 0.42, 5), body);
  shaft.position.set(-0.32, 0.32, 0);
  shaft.rotation.z = 0.04;
  const foot = mesh(roundedBox(1.78, 0.84, 0.9, 0.4, 5), body);
  foot.position.set(0.2, -0.64, 0);
  // галоша: глянцевая резина по низу стопы
  const galosh = mesh(roundedBox(1.86, 0.4, 0.98, [0.2, 0.16, 0.36], 4), toy(0x1b1622, { roughness: 0.12 }));
  galosh.position.set(0.2, -0.92, 0);
  // вышивка: розовая полоса с ромбами и снежинка-брошь
  const band = mesh(roundedBox(1.0, 0.22, 0.92, [0.12, 0.08, 0.42], 3), felt(PAL.hotPink));
  band.position.set(-0.32, 0.86, 0);
  const diamonds = [];
  for (let i = 0; i < 4; i++) {
    const d = mesh(new THREE.OctahedronGeometry(0.075, 0), toy(PAL.cyan, { roughness: 0.2 }));
    d.scale.set(1, 1, 0.5);
    d.position.set(-0.62 + i * 0.2, 0.86, 0.45);
    diamonds.push(d);
  }
  const brooch = snowflake({ color: PAL.glass });
  brooch.traverse((o) => { if (o.material && o.material.emissive) o.material = candyGlass(PAL.glass); });
  brooch.scale.setScalar(0.3);
  brooch.rotation.set(0, 0, 0.2);
  brooch.position.set(-0.3, 0.2, 0.47);
  // снег на голенище
  const snowTop = mesh(new THREE.SphereGeometry(0.55, 32, 16, 0, TAU, 0, Math.PI / 2), snowMat());
  snowTop.scale.set(1, 0.42, 0.92);
  snowTop.position.set(-0.32, 1.12, 0);
  const g = group(shaft, foot, galosh, band, diamonds, brooch, snowTop);
  g.rotation.set(0.14, -0.42, 0.04);
  return g;
}

/** Санки – путь за год */
export function sled() {
  const run = toy(PAL.hotPink, { roughness: 0.22 });
  const parts = [];
  for (const z of [-0.45, 0.45]) {
    parts.push(mesh(tube([[-1.15, -0.45, z], [0.6, -0.45, z], [1.05, -0.4, z], [1.2, -0.15, z], [1.05, 0.05, z], [0.88, -0.05, z]], 0.06), run));
    for (const x of [-0.75, 0.45]) parts.push(mesh(capsule([x, -0.45, z], [x, -0.12, z], 0.05), run));
  }
  const slats = [];
  for (let i = 0; i < 5; i++) {
    const s = mesh(roundedBox(0.3, 0.09, 1.12, 0.04, 2), toy(i % 2 ? PAL.gold : PAL.wood, { roughness: 0.35 }));
    s.position.set(-0.85 + i * 0.36, -0.08, 0);
    slats.push(s);
  }
  const rope = mesh(tube([[1.0, 0.0, -0.45], [1.45, 0.2, -0.2], [1.6, 0.35, 0.1], [1.4, 0.3, 0.4], [1.0, 0.0, 0.45]], 0.035), toy(PAL.cyan, { roughness: 0.5 }));
  const snow = mesh(new THREE.SphereGeometry(0.5, 32, 16, 0, TAU, 0, Math.PI / 2), snowMat());
  snow.scale.set(1.3, 0.35, 0.95);
  snow.position.set(-0.35, -0.04, 0);
  const g = group(parts, slats, rope, snow);
  g.rotation.set(0.42, -0.6, 0.06);
  return g;
}

/** Конверт с сердцем – сообщения */
export function letter() {
  const paper = toy(PAL.white, { roughness: 0.4, clearcoat: 0.6 });
  const body = mesh(roundedBox(2.0, 1.32, 0.16, 0.1, 3), paper);
  const flapShape = new THREE.Shape();
  flapShape.moveTo(-0.96, 0);
  flapShape.lineTo(0.96, 0);
  flapShape.quadraticCurveTo(0.12, -0.78, 0, -0.8);
  flapShape.quadraticCurveTo(-0.12, -0.78, -0.96, 0);
  const flap = mesh(slab(flapShape, 0.02, 0.03), toy(0xeef2ff, { roughness: 0.4 }));
  flap.position.set(0, 0.62, 0.11);
  const card = mesh(roundedBox(1.7, 1.0, 0.04, 0.06, 2), toy(PAL.pink, { roughness: 0.4 }));
  card.position.set(0, 0.5, -0.04);
  card.rotation.z = 0.04;
  const seal = mesh(slab(heartShape(0.24), 0.08, 0.05), toy(PAL.red, { roughness: 0.22 }));
  seal.position.set(0, -0.05, 0.16);
  const g = group(card, body, flap, seal);
  g.rotation.set(-0.12, -0.42, 0.12);
  return g;
}

/** Микрофон – голосовые */
export function microphone() {
  const grille = canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = "#c9ced8";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#7d8494";
    g.lineWidth = 3;
    for (let i = 0; i < 24; i++) {
      g.beginPath();
      g.moveTo((i / 24) * w, 0);
      g.lineTo((i / 24) * w + 40, h);
      g.stroke();
      g.beginPath();
      g.moveTo((i / 24) * w + 40, 0);
      g.lineTo((i / 24) * w, h);
      g.stroke();
    }
  });
  const head = mesh(new THREE.SphereGeometry(0.62, 48, 32), toy(0xffffff, { map: grille, metalness: 0.8, roughness: 0.28, key: "mic" }));
  head.position.y = 0.72;
  const ring = mesh(lathe([[0.001, 0.32], [0.46, 0.32], [0.5, 0.26], [0.46, 0.14], [0.001, 0.14]]), toy(PAL.hotPink, { roughness: 0.22 }));
  const handle = mesh(lathe([[0.001, 0.16], [0.36, 0.16], [0.3, -0.9], [0.22, -1.3], [0.2, -1.36], [0.001, -1.38]]), toy(PAL.hotPink, { roughness: 0.22 }));
  const btn = mesh(roundedBox(0.14, 0.32, 0.1, 0.05, 2), toy(PAL.lime, { roughness: 0.25 }));
  btn.position.set(0, -0.3, 0.32);
  btn.rotation.x = -0.06;
  const g = group(head, ring, handle, btn);
  g.rotation.set(0.12, 0.2, -0.38);
  return g;
}

/** Колокольчик – звонки (звонок = колокольчик) */
export function bell() {
  const shell = mesh(lathe([[0.001, 1.0], [0.18, 0.98], [0.34, 0.86], [0.44, 0.55], [0.5, 0.15], [0.62, -0.25], [0.86, -0.52], [0.9, -0.6], [0.82, -0.62], [0.001, -0.5]], 64), metal(0xffc94a, 0.14));
  const lip = mesh(new THREE.TorusGeometry(0.86, 0.06, 16, 64), metal(PAL.gold, 0.18));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.58;
  const clapper = mesh(new THREE.SphereGeometry(0.2, 24, 16), metal(0xd89a2a, 0.25));
  clapper.position.set(0.12, -0.7, 0.1);
  const bowMat = toy(PAL.red, { roughness: 0.25 });
  const loopL = mesh(new THREE.TorusGeometry(0.26, 0.09, 14, 40), bowMat);
  loopL.scale.set(1.1, 0.7, 0.6);
  loopL.position.set(-0.3, 1.05, 0.15);
  loopL.rotation.z = 0.3;
  const loopR = loopL.clone();
  loopR.position.x = 0.3;
  loopR.rotation.z = -0.3;
  const knot = mesh(new THREE.SphereGeometry(0.13, 20, 14), bowMat);
  knot.position.set(0, 1.04, 0.2);
  const tailL = mesh(tube([[0, 1.0, 0.2], [-0.22, 0.75, 0.32], [-0.3, 0.5, 0.3]], 0.06, { seg: 20 }), bowMat);
  const tailR = mesh(tube([[0, 1.0, 0.2], [0.24, 0.72, 0.32], [0.36, 0.48, 0.28]], 0.06, { seg: 20 }), bowMat);
  const leaves = [-1, 1].map((s) => {
    const leaf = new THREE.Shape();
    leaf.moveTo(0, 0);
    leaf.quadraticCurveTo(0.2, 0.18, 0.42, 0);
    leaf.quadraticCurveTo(0.2, -0.18, 0, 0);
    const m = mesh(slab(leaf, 0.02, 0.02), toy(PAL.green, { roughness: 0.3 }));
    m.position.set(s * 0.12, 1.12, 0.05);
    m.rotation.set(0, 0, s > 0 ? 0.5 : Math.PI - 0.5);
    return m;
  });
  const g = group(shell, lip, clapper, leaves, loopL, loopR, knot, tailL, tailR);
  g.rotation.set(0.18, -0.2, 0.22);
  return g;
}

/** Хлопушка – тусовка года */
export function popper() {
  const stripes = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = "#ff75e1";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#ffffff";
    for (let i = -4; i < 8; i++) {
      g.beginPath();
      g.moveTo(i * 40, 0);
      g.lineTo(i * 40 + 20, 0);
      g.lineTo(i * 40 + 20 + 128, h);
      g.lineTo(i * 40 + 128, h);
      g.fill();
    }
  });
  const cone = mesh(lathe([[0.001, -1.2], [0.14, -1.18], [0.5, 0.35], [0.54, 0.42], [0.001, 0.42]]), toy(0xffffff, { map: stripes, roughness: 0.25, key: "popper" }));
  const rim = mesh(new THREE.TorusGeometry(0.52, 0.06, 14, 48), metal(PAL.gold));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.4;
  const R = rng(11);
  const colors = [PAL.pink, PAL.lime, PAL.cyan, PAL.violet, PAL.gold];
  const bits = [];
  for (let i = 0; i < 26; i++) {
    const a = R() * TAU;
    const spread = 0.3 + R() * 0.9;
    const y = 0.7 + R() * 1.2;
    const isRibbon = i % 3 === 0;
    const geo = isRibbon
      ? tube([[0, 0, 0], [0.08, 0.12, 0.04], [-0.04, 0.25, 0.02], [0.06, 0.36, 0]], 0.025, { seg: 16, radial: 6 })
      : roundedBox(0.12, 0.05, 0.12, 0.02, 1);
    const m = mesh(geo, toy(colors[i % colors.length], { roughness: 0.3 }));
    m.position.set(Math.cos(a) * spread * (y - 0.3), y, Math.sin(a) * spread * (y - 0.3) * 0.6);
    m.rotation.set(R() * TAU, R() * TAU, R() * TAU);
    bits.push(m);
  }
  const g = group(cone, rim, bits);
  g.rotation.set(0.2, 0, -0.42);
  return g;
}

/** Билетик розыгрыша: вырезы по бокам, звезда посередине */
export function ticket({ color = PAL.hotPink } = {}) {
  const w = 2.0;
  const h = 1.1;
  const r = 0.14;
  const n = 0.2;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, -n);
  s.absarc(w / 2, 0, n, -Math.PI / 2, Math.PI / 2, true);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, n);
  s.absarc(-w / 2, 0, n, Math.PI / 2, -Math.PI / 2, true);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const body = mesh(slab(s, 0.08, 0.06), toy(color, { roughness: 0.22 }));
  const st = mesh(slab(starShape(0.3, 0.14), 0.06, 0.04), metal(PAL.gold, 0.16));
  st.position.set(0.25, 0, 0.1);
  const dots = [];
  for (let i = 0; i < 5; i++) {
    const d = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), toy(PAL.white, { roughness: 0.3 }));
    d.rotation.x = Math.PI / 2;
    d.position.set(-0.45, -0.4 + i * 0.2, 0.11);
    dots.push(d);
  }
  const g = group(body, st, dots);
  g.rotation.set(-0.3, 0.42, 0.2);
  return g;
}

/** Геймпад – приз розыгрыша */
export function gamepad() {
  const s = new THREE.Shape();
  s.moveTo(-0.6, 0.55);
  s.lineTo(0.6, 0.55);
  s.bezierCurveTo(1.15, 0.55, 1.35, 0.2, 1.45, -0.25);
  s.bezierCurveTo(1.55, -0.75, 1.25, -0.95, 1.0, -0.8);
  s.bezierCurveTo(0.8, -0.65, 0.65, -0.4, 0.4, -0.38);
  s.lineTo(-0.4, -0.38);
  s.bezierCurveTo(-0.65, -0.4, -0.8, -0.65, -1.0, -0.8);
  s.bezierCurveTo(-1.25, -0.95, -1.55, -0.75, -1.45, -0.25);
  s.bezierCurveTo(-1.35, 0.2, -1.15, 0.55, -0.6, 0.55);
  const body = mesh(slab(s, 0.3, 0.16), toy(0x6b4cff, { roughness: 0.25 }));
  const stickMat = toy(0x22202a, { roughness: 0.35 });
  const sticks = [[-0.42, -0.12], [0.42, -0.12]].map(([x, y]) => {
    const st = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.2, 24), stickMat);
    st.rotation.x = Math.PI / 2;
    st.position.set(x, y, 0.32);
    return st;
  });
  const dpadMat = toy(0x22202a, { roughness: 0.35 });
  const dpad = [mesh(roundedBox(0.36, 0.11, 0.08, 0.04, 2), dpadMat), mesh(roundedBox(0.11, 0.36, 0.08, 0.04, 2), dpadMat)];
  dpad.forEach((d) => d.position.set(-0.85, 0.18, 0.28));
  const btnColors = [PAL.lime, PAL.pink, PAL.cyan, PAL.gold];
  const btns = [[0.85, 0.34], [1.04, 0.18], [0.85, 0.02], [0.66, 0.18]].map(([x, y], i) => {
    const b = mesh(new THREE.SphereGeometry(0.08, 16, 12), toy(btnColors[i], { roughness: 0.2 }));
    b.scale.z = 0.6;
    b.position.set(x, y, 0.3);
    return b;
  });
  const g = group(body, sticks, dpad, btns);
  g.rotation.set(0.62, -0.18, 0.1);
  return g;
}

/** Наушники – приз розыгрыша */
export function headphones() {
  const band = mesh(new THREE.TorusGeometry(0.95, 0.11, 20, 64, Math.PI), toy(PAL.white, { roughness: 0.25 }));
  band.scale.set(1, 1.05, 1.6);
  band.position.y = -0.05;
  const cups = [-1, 1].map((s) => {
    const cup = mesh(lathe([[0.001, -0.25], [0.42, -0.25], [0.5, -0.18], [0.52, 0.0], [0.5, 0.18], [0.42, 0.25], [0.001, 0.25]]), toy(PAL.hotPink, { roughness: 0.22 }));
    cup.rotation.z = Math.PI / 2;
    cup.position.set(s * 0.98, -0.25, 0);
    const pad = mesh(new THREE.TorusGeometry(0.34, 0.13, 16, 40), toy(0x2a2533, { roughness: 0.6, clearcoat: 0.2 }));
    pad.rotation.y = Math.PI / 2;
    pad.position.set(s * 0.74, -0.25, 0);
    return [cup, pad];
  });
  const g = group(band, cups.flat());
  g.rotation.set(0.15, -0.55, 0.05);
  return g;
}

/** Снежная полка: длинный сугроб, на нём стоят предметы ряда календаря */
export function snowLedge({ width = 8, seed = 6 } = {}) {
  const R = rng(seed);
  const g = new THREE.Group();
  const mat = snowMat();
  const n = 26;
  for (let i = 0; i < n; i++) {
    const s = mesh(new THREE.SphereGeometry(1, 40, 20), mat);
    const r = 0.22 + R() * 0.16;
    s.scale.set(r * 1.6, r * 0.55, r * 0.9);
    s.position.set((i / (n - 1) - 0.5) * width, (R() - 0.5) * 0.06, (R() - 0.5) * 0.25);
    g.add(s);
  }
  const spark = glow(0xffffff, 1.6);
  for (let i = 0; i < 40; i++) {
    const p = mesh(new THREE.OctahedronGeometry(0.018, 0), spark);
    p.position.set((R() - 0.5) * width, 0.08 + R() * 0.08, 0.2 + R() * 0.15);
    g.add(p);
  }
  g.rotation.x = 0.5;
  return g;
}

/** Сугроб-постамент под предметом дня, с осколками льда вокруг: день только что оттаял */
export function mound({ shards = true, seed = 12 } = {}) {
  const R = rng(seed);
  const g = new THREE.Group();
  const mat = snowMat();
  const lumps = [[0, 0, 0, 1.25], [-0.95, -0.1, 0.1, 0.8], [0.95, -0.08, -0.05, 0.85], [-0.45, 0.02, 0.45, 0.7], [0.5, 0.0, 0.42, 0.72], [-1.6, -0.22, 0.2, 0.5], [1.6, -0.2, 0.15, 0.55]];
  for (const [x, y, z, r] of lumps) {
    const s = mesh(new THREE.SphereGeometry(1, 48, 28), mat);
    s.scale.set(r * 1.35, r * 0.48, r);
    s.position.set(x, y, z);
    g.add(s);
  }
  if (shards) {
    const iceMat = new THREE.MeshPhysicalMaterial({
      color: 0xbfeaff, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.6,
      iridescence: 0.5, emissive: 0x1a6aa8, emissiveIntensity: 0.25, envMapIntensity: 1.6,
    });
    const spots = [[-1.35, 0.25, 0.5], [1.3, 0.3, 0.55], [-0.75, 0.32, 0.85], [0.9, 0.28, 0.9], [1.85, 0.05, 0.3], [-1.9, 0.02, 0.35], [0.15, 0.4, 0.95]];
    spots.forEach(([x, y, z], i) => {
      const sz = 0.18 + R() * 0.2;
      const geo = new THREE.IcosahedronGeometry(sz, 0);
      const P = geo.attributes.position;
      for (let k = 0; k < P.count; k++) P.setXYZ(k, P.getX(k) * (0.7 + R() * 0.6), P.getY(k) * (0.8 + R() * 0.7), P.getZ(k) * (0.6 + R() * 0.5));
      geo.computeVertexNormals();
      const sh = mesh(geo, iceMat);
      sh.position.set(x, y, z);
      sh.rotation.set(R() * TAU, R() * TAU, R() * TAU);
      g.add(sh);
    });
  }
  const spark = glow(0xffffff, 1.6);
  for (let i = 0; i < 18; i++) {
    const p = mesh(new THREE.OctahedronGeometry(0.025, 0), spark);
    p.position.set((R() - 0.5) * 3.4, 0.2 + R() * 0.35, 0.3 + R() * 0.6);
    g.add(p);
  }
  g.rotation.x = 0.35;
  return g;
}

/** Подарок: коробка-кубик с лентой и бантом – значок уровня подарка с ёлки */
export function giftBox({ color = PAL.hotPink, ribbon = PAL.lime, size = 1 } = {}) {
  const body = mesh(roundedBox(1.4 * size, 1.15 * size, 1.4 * size, 0.18 * size, 3), toy(color, { roughness: 0.26 }));
  const rib = toy(ribbon, { roughness: 0.26 });
  const b1 = mesh(roundedBox(0.3 * size, 1.19 * size, 1.44 * size, 0.06 * size, 2), rib);
  const b2 = mesh(roundedBox(1.44 * size, 1.19 * size, 0.3 * size, 0.06 * size, 2), rib);
  const loops = [-1, 1].map((sd) => {
    const l = mesh(new THREE.TorusGeometry(0.24 * size, 0.08 * size, 14, 32), rib);
    l.scale.set(1.2, 0.8, 0.7);
    l.position.set(sd * 0.24 * size, 0.72 * size, 0);
    l.rotation.set(0, 0, sd * 0.45);
    return l;
  });
  const knot = mesh(new THREE.SphereGeometry(0.12 * size, 16, 12), rib);
  knot.position.y = 0.66 * size;
  const g = group(body, b1, b2, loops, knot);
  g.rotation.set(0.32, -0.62, 0);
  return g;
}

/** Луна – цель «пути за год» */
export function moon() {
  const tex = canvasTexture(512, 256, (g, w, h) => {
    const R = rng(21);
    g.fillStyle = "#fff1b8";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = R() * w;
      const y = h * (0.15 + R() * 0.7);
      const r = 8 + R() * 26;
      const grd = g.createRadialGradient(x, y, r * 0.2, x, y, r);
      grd.addColorStop(0, "rgba(214,170,90,0.75)");
      grd.addColorStop(0.75, "rgba(230,190,110,0.4)");
      grd.addColorStop(1, "rgba(255,241,184,0)");
      g.fillStyle = grd;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
  });
  const ball = mesh(new THREE.SphereGeometry(1, 64, 48), toy(0xffffff, { map: tex, roughness: 0.55, clearcoat: 0.5, key: "moon" }));
  const g = group(ball);
  g.rotation.set(0.2, 0.8, 0);
  return g;
}

/** Стакан кофе навынос – приз кофейни-партнёра */
export function coffee() {
  const cup = mesh(lathe([[0.001, -1.0], [0.56, -1.0], [0.6, -0.96], [0.74, 0.62], [0.001, 0.62]]), toy(PAL.white, { roughness: 0.3 }));
  const sleeve = mesh(lathe([[0.62, -0.42], [0.66, -0.42], [0.71, 0.22], [0.67, 0.22]]), toy(PAL.hotPink, { roughness: 0.3 }));
  const sleeveFill = mesh(lathe([[0.001, -0.4], [0.65, -0.4], [0.7, 0.2], [0.001, 0.2]]), toy(PAL.hotPink, { roughness: 0.3 }));
  const lid = mesh(lathe([[0.001, 0.98], [0.42, 0.98], [0.5, 0.9], [0.56, 0.78], [0.8, 0.72], [0.82, 0.64], [0.76, 0.6], [0.001, 0.6]]), toy(0x3a2531, { roughness: 0.25 }));
  const heart = mesh(slab(heartShape(0.16), 0.04, 0.03), toy(PAL.white, { roughness: 0.3 }));
  heart.position.set(0, -0.1, 0.7);
  heart.rotation.x = -0.08;
  const steam = [-0.2, 0.15].map((x, i) => mesh(tube([[x, 1.05, 0], [x + 0.12, 1.3, 0.05], [x - 0.05, 1.55, 0], [x + 0.08, 1.8 - i * 0.1, 0]], 0.05, { seg: 24 }), toy(0xffffff, { roughness: 0.6, transparent: true, opacity: 0.8 })));
  const g = group(cup, sleeveFill, sleeve, lid, heart, steam);
  g.rotation.set(0.16, -0.3, 0.08);
  return g;
}

/** Попкорн – приз кинотеатра-партнёра */
export function popcorn() {
  const stripes = canvasTexture(256, 64, (g, w, h) => {
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#e8283c";
    for (let i = 0; i < 8; i++) g.fillRect(i * 32, 0, 16, h);
  });
  const bucket = mesh(lathe([[0.001, -1.0], [0.6, -1.0], [0.64, -0.96], [0.86, 0.5], [0.8, 0.5], [0.001, 0.5]]), toy(0xffffff, { map: stripes, roughness: 0.3, key: "popcorn" }));
  const R = rng(13);
  const corn = [];
  for (let i = 0; i < 34; i++) {
    const a = R() * TAU;
    const rr = Math.sqrt(R()) * 0.72;
    const k = mesh(new THREE.IcosahedronGeometry(0.17 + R() * 0.07, 1), toy(i % 5 ? 0xfff2c4 : 0xffd36b, { roughness: 0.55, clearcoat: 0.3 }));
    k.position.set(Math.cos(a) * rr, 0.55 + (0.72 - rr) * 0.5 + R() * 0.25, Math.sin(a) * rr);
    k.rotation.set(R() * TAU, R() * TAU, 0);
    corn.push(k);
  }
  const g = group(bucket, corn);
  g.rotation.set(0.28, -0.3, 0.06);
  return g;
}

/** Шапка blink с помпоном – мерч */
export function beanie() {
  const knit = canvasTexture(256, 128, (g, w, h) => {
    g.fillStyle = "#8f5bff";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "rgba(255,255,255,0.18)";
    g.lineWidth = 4;
    for (let i = 0; i < 32; i++) {
      g.beginPath();
      g.moveTo(i * 8, 0);
      g.lineTo(i * 8, h);
      g.stroke();
    }
  });
  const dome = mesh(new THREE.SphereGeometry(1, 64, 32, 0, TAU, 0, Math.PI / 2), toy(0xffffff, { map: knit, roughness: 0.8, clearcoat: 0, sheen: 1, sheenColor: 0xd9c4ff, key: "beanie" }));
  dome.scale.set(0.98, 1.45, 0.98);
  dome.position.y = 0.3;
  const cuff = mesh(new THREE.CylinderGeometry(1.04, 1.06, 0.48, 64, 1, true), felt(PAL.hotPink));
  cuff.position.y = 0.12;
  const cuffTop = mesh(new THREE.TorusGeometry(1.04, 0.08, 12, 64), felt(PAL.hotPink));
  cuffTop.rotation.x = Math.PI / 2;
  cuffTop.position.y = 0.36;
  const cuffBot = cuffTop.clone();
  cuffBot.position.y = -0.12;
  const star = mesh(slab(starShape(0.22, 0.1), 0.04, 0.03), toy(PAL.white, { roughness: 0.3 }));
  star.position.set(0, 0.13, 1.08);
  const pom = mesh(new THREE.IcosahedronGeometry(0.34, 3), felt(0xffffff));
  pom.position.y = 1.78;
  const g = group(dome, cuff, cuffTop, cuffBot, star, pom);
  g.rotation.set(0.32, -0.25, 0.08);
  return g;
}

/** Золотая звезда – эксклюзив за победы в цу-е-фа над пятью друзьями */
export function topStar() {
  const st = mesh(slab(starShape(1, 0.46, 5, 0.16), 0.32, 0.16), toy(0xffb92e, { metalness: 0.55, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.04 }));
  const inner = mesh(slab(starShape(0.55, 0.25, 5, 0.18), 0.1, 0.06), toy(0xfff4c2, { roughness: 0.15, emissive: 0xffd36b, emissiveIntensity: 0.25 }));
  inner.position.z = 0.24;
  const g = group(st, inner);
  g.rotation.set(-0.12, 0.42, -0.08);
  return g;
}

/** Печенье с предсказанием как у эмодзи: полумесяц со складкой по внешнему краю и острыми кончиками.
    part: whole | left | right – половинки, когда печенье разломили (тот же ракурс). Пустое внутри */
export function fortuneCookie3({ part = "whole", glaze = PAL.cookie, beta = 1.75, R = 0.95, tube: r0 = 0.62, groove = 0.5 } = {}) {
  const sugar = canvasTexture(256, 256, (g, w, h) => {
    const Rn = rng(4);
    g.fillStyle = "#7a7a7a";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = `rgba(255,255,255,${0.05 + Rn() * 0.12})`;
      g.fillRect(Rn() * w, Rn() * h, 1 + Rn() * 2, 1 + Rn() * 2);
    }
  }, false);
  const mat = toy(glaze, { roughness: 0.46, roughnessMap: sugar, bumpMap: sugar, bumpScale: 0.6, clearcoat: 0.6, clearcoatRoughness: 0.22, side: THREE.DoubleSide, key: `cookie3:${glaze}` });
  const piece = (a0, a1) => {
    const geo = new THREE.TorusGeometry(R, r0, 48, 96, a1 - a0);
    geo.rotateZ(a0);
    const P = geo.attributes.position;
    const c = new THREE.Vector3();
    const o = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i);
      const y = P.getY(i);
      const z = P.getZ(i);
      const phi = Math.atan2(y, x);                       // угол по дуге: 0 – середина
      c.set(Math.cos(phi) * R, Math.sin(phi) * R, 0);
      o.set(x - c.x, y - c.y, z);
      const radial = o.x * Math.cos(phi) + o.y * Math.sin(phi);
      const th = Math.atan2(o.z, radial);                 // угол вокруг трубки: 0 – снаружи дуги
      const t = Math.min(1, Math.abs(phi) / beta);
      const taper = Math.pow(Math.max(0, 1 - t * t), 0.55) * 0.92 + 0.04;
      // складка снаружи: глубокая борозда по внешнему краю; изнутри чуть приплюснуто
      const crease = 1 - groove * Math.exp(-((th / 0.42) ** 2)) * (0.6 + 0.4 * (1 - t));
      const flat = 1 - 0.18 * Math.exp(-(((Math.abs(th) - Math.PI) / 0.7) ** 2));
      const rr = r0 * taper * crease * flat;
      const nr = Math.cos(th) * rr;
      const nz = Math.sin(th) * rr * 1.08;
      P.setXYZ(i, c.x + Math.cos(phi) * nr, c.y + Math.sin(phi) * nr, nz);
    }
    geo.computeVertexNormals();
    return mesh(geo, mat);
  };
  // дуга от -beta до beta, середина сверху: печенье лежит «шапочкой», кончики вниз
  const g = new THREE.Group();
  const holder = new THREE.Group();
  if (part !== "right") holder.add(piece(-beta, part === "left" ? 0 : beta));
  if (part === "right") holder.add(piece(0, beta));
  holder.rotation.z = Math.PI / 2;
  g.add(holder);
  // бумажки снаружи нет: она появляется, когда печенье разломили (вёрстка карточки)
  g.rotation.set(0.5, -0.45, 0.08);
  return g;
}

/** Нарядная ёлка: пушистые ярусы с волнистым краем, снег на лапах, глянцевые шары, звезда, подарки */
export function xmasTree({ seed = 7 } = {}) {
  const R = rng(seed);
  const g = new THREE.Group();
  const green = toy(0x139447, { roughness: 0.62, clearcoat: 0.18, clearcoatRoughness: 0.4 });
  const snow = toy(0xf7fbff, { roughness: 0.55, clearcoat: 0.3, sheen: 1, sheenColor: 0xd8ecff, sheenRoughness: 0.5 });
  const tiers = [
    { y: -1.15, h: 1.05, r: 1.25 },
    { y: -0.45, h: 0.95, r: 1.0 },
    { y: 0.18, h: 0.85, r: 0.76 },
    { y: 0.74, h: 0.72, r: 0.5 },
  ];
  const surface = [];
  tiers.forEach((t, k) => {
    // ярус – конус с волнистым пухлым краем: лапы
    const geo = new THREE.ConeGeometry(t.r, t.h, 96, 12, true);
    const P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i);
      const y = P.getY(i);
      const z = P.getZ(i);
      const a = Math.atan2(z, x);
      const low = (t.h / 2 - y) / t.h;                      // 0 – верх, 1 – низ яруса
      const scallop = 1 + 0.09 * Math.pow(low, 3) * Math.cos(a * 9);
      const droop = -0.08 * Math.pow(low, 4) * (1 + Math.cos(a * 9));
      P.setXYZ(i, x * scallop, y + droop, z * scallop);
    }
    geo.computeVertexNormals();
    const cone = mesh(geo, green);
    cone.position.y = t.y + t.h / 2;
    g.add(cone);
    // дно яруса, чтобы снизу не было дыры
    const cap = mesh(new THREE.CircleGeometry(t.r * 1.05, 48), green);
    cap.rotation.x = Math.PI / 2;
    cap.position.y = t.y + 0.02;
    g.add(cap);
    // снег лежит на лапах: белая полоса на видимой части яруса (верх прячется под следующим), низ волной по лапам
    const l0 = k === tiers.length - 1 ? 0.12 : 0.52;
    const l1 = 0.8;
    const band = new THREE.CylinderGeometry(t.r * l0 * 1.04, t.r * l1 * 1.05, t.h * (l1 - l0), 96, 4, true);
    const BP = band.attributes.position;
    const hb = t.h * (l1 - l0);
    for (let i = 0; i < BP.count; i++) {
      const x = BP.getX(i);
      const y = BP.getY(i);
      const z = BP.getZ(i);
      const a = Math.atan2(z, x);
      const low = (hb / 2 - y) / hb;                     // 0 – верх полосы, 1 – низ
      const scallop = 1 + 0.06 * Math.pow(l0 + (l1 - l0) * low, 3) * Math.cos(a * 9);
      const drip = -0.07 * Math.pow(low, 3) * (1 + Math.cos(a * 9 + 0.5)) - 0.03 * Math.pow(low, 3) * (1 + Math.cos(a * 23));
      BP.setXYZ(i, x * scallop, y + drip, z * scallop);
    }
    band.computeVertexNormals();
    const snowBand = mesh(band, snow);
    snowBand.position.y = t.y + t.h * (1 - (l0 + l1) / 2);
    g.add(snowBand);
    surface.push(t);
  });
  // шары на ярусах, только с видимой стороны
  const balls = [PAL.hotPink, PAL.cyan, PAL.gold, PAL.violet, PAL.red, PAL.lime];
  let n = 0;
  tiers.forEach((t, k) => {
    const count = 6 - k;
    for (let i = 0; i < count; i++) {
      const a = Math.PI / 2 + (i / (count - 1 || 1) - 0.5) * 2.4 + (R() - 0.5) * 0.2;
      const yy = t.y + 0.22 + R() * t.h * 0.35;
      const rad = t.r * (1 - (yy - t.y) / t.h) * 0.98 + 0.05;
      const c = balls[n++ % balls.length];
      const b = mesh(new THREE.SphereGeometry(0.1 + (k === 0 ? 0.02 : 0), 24, 16), c === PAL.gold ? metal(0xffc23d, 0.15) : toy(c, { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03 }));
      b.position.set(Math.cos(a) * rad, yy, Math.sin(a) * rad);
      g.add(b);
    }
  });
  const star = mesh(slab(starShape(0.3, 0.14), 0.1, 0.05), toy(0xffc23d, { metalness: 0.5, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.03, emissive: 0xffa000, emissiveIntensity: 0.15 }));
  star.position.y = 1.72;
  g.add(star);
  const trunk = mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 24), toy(PAL.wood, { roughness: 0.5 }));
  trunk.position.y = -1.28;
  g.add(trunk);
  // подарки под ёлкой
  const gifts = [[-0.7, PAL.hotPink, PAL.lime, 0.32], [0.62, PAL.cyan, PAL.hotPink, 0.36], [0.05, PAL.gold, PAL.red, 0.28], [-0.25, 0x8f5bff, PAL.gold, 0.22]];
  gifts.forEach(([x, c, rbn, sz], i) => {
    const box = giftBox({ color: c, ribbon: rbn, size: sz });
    box.rotation.set(0, 0.4 + i * 0.6, 0);
    box.position.set(x, -1.42 + sz * 0.55, 0.55 + (i % 2) * 0.25);
    g.add(box);
  });
  g.rotation.set(0.12, 0, 0);
  return g;
}

/** Рука в вязаной перчатке с меховой опушкой – жест «камень, ножницы, бумага».
    pose: rock | scissors | paper. Рука смотрит пальцами вверх, к зрителю – тыльной стороной */
export function glovedHand({ pose = "rock", color = PAL.hotPink } = {}) {
  const knit = canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = `#${new THREE.Color(color).getHexString()}`;
    g.fillRect(0, 0, w, h);
    // вязка: вертикальные «косички» – светлые и тёмные полоски
    for (let x = 0; x < w; x += 16) {
      g.fillStyle = "rgba(255,255,255,0.10)";
      g.fillRect(x, 0, 6, h);
      g.fillStyle = "rgba(0,0,0,0.10)";
      g.fillRect(x + 9, 0, 4, h);
    }
    for (let y = 0; y < h; y += 12) {
      g.fillStyle = "rgba(0,0,0,0.06)";
      g.fillRect(0, y, w, 2);
    }
  });
  const glove = toy(0xffffff, { map: knit, roughness: 0.85, clearcoat: 0, sheen: 1, sheenColor: 0xffd0f0, sheenRoughness: 0.5, key: `glove:${color}` });
  const g = new THREE.Group();
  // ладонь: скруглённый брусок, тыльная сторона – к зрителю (+Z) с узором
  const palm = mesh(roundedBox(1.0, 1.08, 0.5, [0.24, 0.24, 0.22], 4), glove);
  g.add(palm);
  // вышитая снежинка на тыльной стороне: белые лучи с веточками
  const thread = toy(0xffffff, { roughness: 0.7, clearcoat: 0, sheen: 1, sheenColor: 0xffffff, sheenRoughness: 0.4 });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU + Math.PI / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    const c = [0, -0.05, 0.27];
    g.add(mesh(capsule(c, [c[0] + dx * 0.27, c[1] + dy * 0.27, 0.27], 0.028), thread));
    for (const sd of [-1, 1]) {
      const b = a + sd * 0.8;
      const o = [c[0] + dx * 0.16, c[1] + dy * 0.16, 0.27];
      g.add(mesh(capsule(o, [o[0] + Math.cos(b) * 0.08, o[1] + Math.sin(b) * 0.08, 0.27], 0.022), thread));
    }
  }
  const r = 0.135;
  const tipY = 0.5;
  // пальцы: x и длина; вытянутый – вверх, согнутый – загнут к зрителю и вниз (кулак)
  const fingers = [
    { x: -0.34, len: 0.62 },   // указательный (слева – правая рука тыльной стороной)
    { x: -0.11, len: 0.7 },    // средний
    { x: 0.12, len: 0.64 },    // безымянный
    { x: 0.35, len: 0.5 },     // мизинец
  ];
  const up = { rock: [0, 0, 0, 0], scissors: [1, 1, 0, 0], paper: [1, 1, 1, 1] }[pose];
  const spread = { rock: [0, 0, 0, 0], scissors: [-0.26, 0.2, 0, 0], paper: [-0.16, -0.05, 0.06, 0.18] }[pose];
  fingers.forEach((f, i) => {
    if (up[i]) {
      const a = spread[i];
      const x1 = f.x + Math.sin(a) * f.len;
      const y1 = tipY + Math.cos(a) * f.len;
      g.add(mesh(capsule([f.x, tipY - 0.05, 0], [x1, y1, 0], r), glove));
    } else {
      // согнутый: от костяшки вперёд и вниз – два сегмента
      g.add(mesh(capsule([f.x, tipY - 0.04, 0.02], [f.x, tipY + 0.1, 0.24], r), glove));
      g.add(mesh(capsule([f.x, tipY + 0.1, 0.24], [f.x, tipY - 0.12, 0.42], r * 0.95), glove));
    }
  });
  // большой палец: у камня и ножниц – поперёк согнутых пальцев, у бумаги – в сторону
  if (pose === "paper") {
    g.add(mesh(capsule([-0.46, -0.18, 0.02], [-0.82, 0.22, 0.08], r * 1.08), glove));
  } else {
    g.add(mesh(capsule([-0.46, -0.12, 0.12], [-0.3, 0.2, 0.42], r * 1.08), glove));
    g.add(mesh(capsule([-0.3, 0.2, 0.42], [0.08, 0.3, 0.5], r), glove));
  }
  // меховая опушка на запястье – как у шапки Деда Мороза
  const cuff = mesh(new THREE.TorusGeometry(0.42, 0.2, 18, 48), toy(0xffffff, { roughness: 0.9, clearcoat: 0, sheen: 1, sheenColor: 0xffffff, sheenRoughness: 0.3 }));
  cuff.rotation.x = Math.PI / 2;
  cuff.scale.set(1.22, 0.62, 1);
  cuff.position.y = -0.62;
  g.add(cuff);
  const wrist = mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.26, 32), glove);
  wrist.position.y = -0.82;
  g.add(wrist);
  g.rotation.set(-0.08, 0.18, 0);
  return g;
}

/** Каталог для рендера: имя → фабрика и ракурс */
export const CATALOG = {
  snowflake: () => snowflake(),
  "ice": () => iceCube(),
  "ornament-pink": () => ornament({ color: PAL.hotPink, accent: PAL.white, pattern: "stripes" }),
  "ornament-earth": () => ornament({ pattern: "earth", seed: 3 }),
  "ornament-violet": () => ornament({ color: 0x8f5bff, accent: PAL.pink, pattern: "dots" }),
  globe: () => snowGlobe({ scene: "tree" }),
  "globe-back": () => snowGlobe({ scene: "empty", part: "back" }),
  "globe-glass": () => snowGlobe({ part: "glass" }),
  valenok: () => valenok(),
  sled: () => sled(),
  letter: () => letter(),
  microphone: () => microphone(),
  bell: () => bell(),
  popper: () => popper(),
  ticket: () => ticket(),
  gamepad: () => gamepad(),
  headphones: () => headphones(),
  mound: { make: () => mound(), size: [900, 300], pad: 0.52 },
  cookie: () => fortuneCookie3({ groove: 0.62, beta: 1.6 }),
  "cookie-left": () => fortuneCookie3({ groove: 0.62, beta: 1.6, part: "left" }),
  "cookie-right": () => fortuneCookie3({ groove: 0.62, beta: 1.6, part: "right" }),
  "cookie-pink": () => fortuneCookie3({ groove: 0.62, beta: 1.6, glaze: 0xff8fd6 }),
  "cookie-pink-left": () => fortuneCookie3({ groove: 0.62, beta: 1.6, glaze: 0xff8fd6, part: "left" }),
  "cookie-pink-right": () => fortuneCookie3({ groove: 0.62, beta: 1.6, glaze: 0xff8fd6, part: "right" }),
  "cookie-choco": () => fortuneCookie3({ groove: 0.62, beta: 1.6, glaze: 0x7a4a2e }),
  "cookie-choco-left": () => fortuneCookie3({ groove: 0.62, beta: 1.6, glaze: 0x7a4a2e, part: "left" }),
  "cookie-choco-right": () => fortuneCookie3({ groove: 0.62, beta: 1.6, glaze: 0x7a4a2e, part: "right" }),
  "hand-rock": { make: () => glovedHand({ pose: "rock" }), size: [512, 640], pad: 0.54 },
  "hand-scissors": { make: () => glovedHand({ pose: "scissors" }), size: [512, 640], pad: 0.54 },
  "hand-paper": { make: () => glovedHand({ pose: "paper" }), size: [512, 640], pad: 0.54 },
  "hand-rock-blue": { make: () => glovedHand({ pose: "rock", color: 0x4fc3ff }), size: [512, 640], pad: 0.54 },
  "hand-scissors-blue": { make: () => glovedHand({ pose: "scissors", color: 0x4fc3ff }), size: [512, 640], pad: 0.54 },
  "hand-paper-blue": { make: () => glovedHand({ pose: "paper", color: 0x4fc3ff }), size: [512, 640], pad: 0.54 },
  "xmas-tree": { make: () => xmasTree(), size: [640, 760], pad: 0.52, pitch: 8 },
  ledge: { make: () => snowLedge(), size: [1074, 120], pad: 0.52, pitch: 10 },
  "gift-pink": () => giftBox(),
  "gift-cyan": () => giftBox({ color: PAL.cyan, ribbon: PAL.hotPink }),
  "gift-violet": () => giftBox({ color: 0x8f5bff, ribbon: PAL.gold }),
  "gift-gold": () => giftBox({ color: PAL.gold, ribbon: PAL.red }),
  moon: () => moon(),
  coffee: () => coffee(),
  popcorn: () => popcorn(),
  beanie: () => beanie(),
  "star-frame": () => topStar(),
};
