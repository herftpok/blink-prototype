/* ==========================================================================
   ny-models.js – Blink · «новогодние подарки»
   Procedural three.js models, core build only (no addons, no texture files):
   the gift dispatch post and the elf couriers, plus the lighting rig that
   gives them the glossy look of the Blink 3D stickers.

   Exports: createLighting, createShadowCatcher, createDispatchPoint, createElf,
   createGiftBox, createSack (UI props), MODEL_INFO.

   Contract (see MODEL_INFO.notes for the full list):
   · 1 world unit = 1 CSS px at 1×. Ground is y = 0, +Y is up.
   · Camera: OrthographicCamera(-W/2, W/2, H/2, -H/2, -2000, 2000),
     rotation.x = -50°. A ground point (x, 0, z) lands x px right and
     z·sin(50°) px below the screen centre.
   · Every model's origin is the centre of its footprint on the ground;
     models face +Z (towards the camera).
   · Elf heading h: 0 → walks towards +X (screen right), π/2 → +Z (screen
     down). Internally rotation.y = π/2 − h.
   · Geometries, materials and textures are shared between instances and
     between renderers (module-level cache). Animated materials (window glow,
     smoke, fairy lights) are per dispatch-post instance.
   ========================================================================== */
import * as THREE from "three";

/* ----------------------------------------------------------------- utils */

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const wrapAngle = (a) => {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
};
const noRaycast = () => {};
let warnedThree = false;
/** The THREE argument of the factories is accepted for API symmetry; the module uses its own `three` import. */
function checkThree(T) {
  if (!warnedThree && T && T !== THREE && T.REVISION !== undefined && T.Mesh !== THREE.Mesh) {
    warnedThree = true;
    console.warn("ny-models: a different three.js instance was passed in; the models are built with the module's own `three` import.");
  }
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- caches */

const GEO = new Map();
const MAT = new Map();
const TEX = new Map();
function memo(map, key, make) {
  let v = map.get(key);
  if (v === undefined) {
    v = make();
    map.set(key, v);
  }
  return v;
}

/* --------------------------------------------------------------- palette */

const PAL = {
  skin: 0xf6c7a4,
  cheek: 0xff8fa8,
  eye: 0x15131b,
  mouth: 0x6a2433,
  tunic: 0x3fbf5b,
  hat: 0xe8283c,
  sack: 0xb8783e,
  fur: 0xffffff,
  boot: 0x3a2531,
  belt: 0x70401f,
  gold: 0xf2b53a,
  pink: 0xff75e1,
  lime: 0x96e732,
  red: 0xe8283c,
  wall: 0xe8414a,
  roof: 0x8c2236,
  snow: 0xe9f0fa,
  trim: 0xffffff,
  door: 0x2f9d62,
  glow: 0xffd36b,
  wire: 0x285440,
  soot: 0x2b1c24,
  smoke: 0xe9edf6,
  shadow: 0x1c2744,
};

/* ------------------------------------------------------ geometry helpers */

const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _eu = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Transform a geometry in place: scale → rotate (XYZ Euler) → translate. */
function tf(geo, p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  const sc = typeof s === "number" ? [s, s, s] : s;
  _q.setFromEuler(_eu.set(r[0], r[1], r[2], "XYZ"));
  _m4.compose(_p.set(p[0], p[1], p[2]), _q, _s.set(sc[0], sc[1], sc[2]));
  geo.applyMatrix4(_m4);
  return geo;
}

/** Point on a sphere: az = degrees to the right (+X), el = degrees up. 0,0 = +Z. */
function sph(r, az, el) {
  const a = az * DEG;
  const e = el * DEG;
  return new THREE.Vector3(r * Math.cos(e) * Math.sin(a), r * Math.sin(e), r * Math.cos(e) * Math.cos(a));
}

/** Orient a geometry built around +Z so that +Z follows `n` (local +Y stays as close to world up as possible). */
function orient(geo, pos, n, roll = 0) {
  const z = n.clone().normalize();
  const up = Math.abs(z.y) > 0.99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  const x = new THREE.Vector3().crossVectors(up, z).normalize();
  const y = new THREE.Vector3().crossVectors(z, x);
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  if (roll) m.multiply(new THREE.Matrix4().makeRotationZ(roll));
  m.setPosition(pos);
  return geo.applyMatrix4(m);
}

/** Merge geometries into one indexed geometry with position / normal / uv. Inputs are disposed. */
function merge(list) {
  let nv = 0;
  let ni = 0;
  for (const g of list) {
    nv += g.attributes.position.count;
    ni += g.index ? g.index.count : g.attributes.position.count;
  }
  const pos = new Float32Array(nv * 3);
  const nor = new Float32Array(nv * 3);
  const uv = new Float32Array(nv * 2);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let vo = 0;
  let io = 0;
  for (const g of list) {
    const P = g.attributes.position;
    const N = g.attributes.normal;
    const U = g.attributes.uv;
    for (let i = 0; i < P.count; i++) {
      const k = (vo + i) * 3;
      pos[k] = P.getX(i);
      pos[k + 1] = P.getY(i);
      pos[k + 2] = P.getZ(i);
      if (N) {
        nor[k] = N.getX(i);
        nor[k + 1] = N.getY(i);
        nor[k + 2] = N.getZ(i);
      }
      if (U) {
        uv[(vo + i) * 2] = U.getX(i);
        uv[(vo + i) * 2 + 1] = U.getY(i);
      }
    }
    if (g.index) for (let k = 0; k < g.index.count; k++) idx[io++] = g.index.getX(k) + vo;
    else for (let k = 0; k < P.count; k++) idx[io++] = vo + k;
    vo += P.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}

function posKey(P, i, q = 1e3) {
  return `${Math.round(P.getX(i) * q)},${Math.round(P.getY(i) * q)},${Math.round(P.getZ(i) * q)}`;
}

/** Average normals of coincident vertices (UV seams, poles) so shading has no seams. */
function weldNormals(geo) {
  const P = geo.attributes.position;
  const N = geo.attributes.normal;
  const groups = new Map();
  for (let i = 0; i < P.count; i++) {
    const k = posKey(P, i);
    let l = groups.get(k);
    if (!l) groups.set(k, (l = []));
    l.push(i);
  }
  const n = new THREE.Vector3();
  for (const l of groups.values()) {
    if (l.length < 2) continue;
    n.set(0, 0, 0);
    for (const i of l) {
      n.x += N.getX(i);
      n.y += N.getY(i);
      n.z += N.getZ(i);
    }
    if (n.lengthSq() < 1e-12) continue;
    n.normalize();
    for (const i of l) N.setXYZ(i, n.x, n.y, n.z);
  }
  N.needsUpdate = true;
  return geo;
}

/** Smooth normals across edges flatter than `crease` (angle-weighted); keeps real creases. For extrusions. */
function creaseNormals(geo, crease = 55 * DEG) {
  if (geo.index) geo = geo.toNonIndexed();
  const P = geo.attributes.position;
  const n = P.count;
  const fn = new Float32Array(n); // triangle normal, stored once per triangle (3 floats at 3*t)
  const ang = new Float32Array(n); // corner angle per vertex
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const e1 = new THREE.Vector3();
  const e2 = new THREE.Vector3();
  const f = new THREE.Vector3();
  const corner = (p, q, r) => {
    e1.subVectors(q, p);
    e2.subVectors(r, p);
    const l = e1.length() * e2.length();
    return l > 1e-12 ? Math.acos(clamp(e1.dot(e2) / l, -1, 1)) : 0;
  };
  for (let t = 0; t < n / 3; t++) {
    a.fromBufferAttribute(P, 3 * t);
    b.fromBufferAttribute(P, 3 * t + 1);
    c.fromBufferAttribute(P, 3 * t + 2);
    e1.subVectors(b, a);
    e2.subVectors(c, a);
    f.crossVectors(e1, e2);
    const len = f.length();
    if (len > 1e-12) f.divideScalar(len);
    else f.set(0, 0, 0);
    fn[3 * t] = f.x;
    fn[3 * t + 1] = f.y;
    fn[3 * t + 2] = f.z;
    ang[3 * t] = corner(a, b, c);
    ang[3 * t + 1] = corner(b, c, a);
    ang[3 * t + 2] = corner(c, a, b);
  }
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const k = posKey(P, i);
    let l = groups.get(k);
    if (!l) groups.set(k, (l = []));
    l.push(i);
  }
  const cosC = Math.cos(crease);
  const out = new Float32Array(n * 3);
  for (const l of groups.values()) {
    for (const i of l) {
      const ti = 3 * Math.floor(i / 3);
      let x = 0;
      let y = 0;
      let z = 0;
      for (const j of l) {
        const tj = 3 * Math.floor(j / 3);
        const d = fn[ti] * fn[tj] + fn[ti + 1] * fn[tj + 1] + fn[ti + 2] * fn[tj + 2];
        if (d >= cosC) {
          x += fn[tj] * ang[j];
          y += fn[tj + 1] * ang[j];
          z += fn[tj + 2] * ang[j];
        }
      }
      const len = Math.hypot(x, y, z) || 1;
      out[3 * i] = x / len;
      out[3 * i + 1] = y / len;
      out[3 * i + 2] = z / len;
    }
  }
  geo.setAttribute("normal", new THREE.BufferAttribute(out, 3));
  return geo;
}

/**
 * Rounded box (Minkowski box + ellipsoid), same idea as the RoundedBoxGeometry addon.
 * r is a number or [rx, ry, rz] – per-axis radii give thin ribbons that hug a rounded box.
 */
function roundedBox(w, h, d, r, s = 2) {
  const seg = s * 2 + 1;
  const rr = Array.isArray(r) ? r : [r, r, r];
  const rx = Math.max(0.01, Math.min(rr[0], w / 2 - 0.01));
  const ry = Math.max(0.01, Math.min(rr[1], h / 2 - 0.01));
  const rz = Math.max(0.01, Math.min(rr[2], d / 2 - 0.01));
  const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg).toNonIndexed();
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

function sphere(r, ws = 16, hs = 12) {
  return new THREE.SphereGeometry(r, ws, hs);
}

/** Ellipsoid at p with radii [rx, ry, rz] and rotation. */
function ellipsoid(radii, p = [0, 0, 0], rot = [0, 0, 0], ws = 14, hs = 10) {
  return tf(new THREE.SphereGeometry(1, ws, hs), p, rot, radii);
}

function lathe(profile, segments = 20) {
  if (profile[0][1] > profile[profile.length - 1][1]) profile = [...profile].reverse();
  const g = new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)),
    segments,
  );
  return weldNormals(g);
}

/** Tube along a Catmull-Rom path with a radius profile rFn(t) and rounded end caps. uv.x = arc length / uvPeriod. */
function tube(points, rFn, { tubular = 24, radial = 10, caps = true, capRings = 4, uvPeriod = 1 } = {}) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], p[1], p[2])),
    false,
    "centripetal",
  );
  const L = curve.getLength();
  const r0 = rFn(0);
  const r1 = rFn(1);
  const c0 = caps ? Math.min(r0, L * 0.45) : 0;
  const c1 = caps ? Math.min(r1, L * 0.45) : 0;
  const radiusAt = (t) => {
    let r = rFn(t);
    const s = t * L;
    if (c0 > 0 && s < c0) {
      const u = 1 - s / c0;
      r *= Math.sqrt(Math.max(0, 1 - u * u));
    }
    if (c1 > 0 && L - s < c1) {
      const u = 1 - (L - s) / c1;
      r *= Math.sqrt(Math.max(0, 1 - u * u));
    }
    return r;
  };
  const set = new Set();
  for (let i = 0; i <= tubular; i++) set.add(i / tubular);
  for (let k = 1; k < capRings; k++) {
    const f = 1 - Math.cos((k / capRings) * (Math.PI / 2));
    if (c0) set.add((c0 * f) / L);
    if (c1) set.add(1 - (c1 * f) / L);
  }
  const ts = [...set].sort((x, y) => x - y);
  const pos = [];
  const nor = [];
  const uvs = [];
  const idx = [];
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  const d = new THREE.Vector3();
  let hasN = false;
  for (const t of ts) {
    curve.getPointAt(t, P);
    curve.getTangentAt(t, T);
    if (!hasN) {
      const ax = Math.abs(T.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      N.crossVectors(T, ax).normalize();
      hasN = true;
    } else {
      N.addScaledVector(T, -N.dot(T)).normalize();
    }
    B.crossVectors(T, N);
    const r = radiusAt(t);
    const ta = Math.max(0, t - 1e-3);
    const tb = Math.min(1, t + 1e-3);
    const drds = (radiusAt(tb) - radiusAt(ta)) / ((tb - ta) * L);
    for (let j = 0; j <= radial; j++) {
      const v = (j / radial) * TAU;
      const cs = Math.cos(v);
      const sn = Math.sin(v);
      d.set(cs * N.x + sn * B.x, cs * N.y + sn * B.y, cs * N.z + sn * B.z);
      pos.push(P.x + d.x * r, P.y + d.y * r, P.z + d.z * r);
      const nx = d.x - T.x * drds;
      const ny = d.y - T.y * drds;
      const nz = d.z - T.z * drds;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nor.push(nx / nl, ny / nl, nz / nl);
      uvs.push((t * L) / uvPeriod, j / radial);
    }
  }
  for (let i = 0; i < ts.length - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = (i + 1) * (radial + 1) + j;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

/** Polygon with rounded corners → THREE.Shape. */
function roundedPoly(pts, radius) {
  const shape = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    const r0 = Array.isArray(radius) ? radius[i] : radius;
    const da = new THREE.Vector2(a[0] - p[0], a[1] - p[1]);
    const db = new THREE.Vector2(b[0] - p[0], b[1] - p[1]);
    const r = Math.min(r0, da.length() / 2, db.length() / 2);
    da.normalize();
    db.normalize();
    const A = [p[0] + da.x * r, p[1] + da.y * r];
    const Bp = [p[0] + db.x * r, p[1] + db.y * r];
    if (i === 0) shape.moveTo(A[0], A[1]);
    else shape.lineTo(A[0], A[1]);
    shape.quadraticCurveTo(p[0], p[1], Bp[0], Bp[1]);
  }
  shape.closePath();
  return shape;
}

/** Arch (rectangle with a half-circle top), bottom centre at 0,0. */
function archPath(w, h, path = new THREE.Shape()) {
  const r = w / 2;
  path.moveTo(-r, 0);
  path.lineTo(r, 0);
  path.lineTo(r, h - r);
  path.absarc(0, h - r, r, 0, Math.PI, false);
  path.lineTo(-r, 0);
  return path;
}

/** Arch-shaped frame (upside-down U), bottom at y = 0 – a single contour, no hole touching the outline. */
function archFramePath(wOut, hOut, wIn, hIn) {
  const ro = wOut / 2;
  const ri = wIn / 2;
  const p = new THREE.Shape();
  p.moveTo(-ro, 0);
  p.lineTo(-ri, 0);
  p.lineTo(-ri, hIn - ri);
  p.absarc(0, hIn - ri, ri, Math.PI, 0, true);
  p.lineTo(ri, 0);
  p.lineTo(ro, 0);
  p.lineTo(ro, hOut - ro);
  p.absarc(0, hOut - ro, ro, 0, Math.PI, false);
  p.lineTo(-ro, 0);
  return p;
}

/** Extrude a shape along +Z, centred on z = 0, with rounded (bevelled) edges and smooth normals. */
function extrude(shape, depth, bevel, { curveSegments = 6, bevelSegments = 3, crease = 60 * DEG, steps = 1, deform = null } = {}) {
  const core = Math.max(0.01, depth - 2 * bevel);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: core,
    steps,
    curveSegments,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments,
  });
  g.translate(0, 0, -core / 2);
  if (deform) deform(g.attributes.position);
  return creaseNormals(g, crease);
}

/** Gift box: rounded body + two ribbon bands + bow. Origin = bottom centre. */
function giftGeos(w, h, d, o = {}) {
  const r = o.r ?? Math.min(w, h, d) * 0.18;
  const t = o.band ?? Math.min(w, d) * 0.22;
  const e = o.lift ?? Math.max(0.28, Math.min(w, h, d) * 0.035);
  const seg = o.seg ?? 2;
  const rseg = o.ribbonSeg ?? Math.max(1, seg - 1);
  const body = tf(roundedBox(w, h, d, r, seg), [0, h / 2, 0]);
  const b1 = tf(roundedBox(w + 2 * e, h + 2 * e, t, [r + e, r + e, t * 0.45], rseg), [0, h / 2, 0]);
  const b2 = tf(roundedBox(t, h + 2 * e, d + 2 * e, [t * 0.45, r + e, r + e], rseg), [0, h / 2, 0]);
  const L = (o.bow ?? 1) * Math.min(w, d) * 0.23;
  const top = h + e;
  const ts = o.bowSeg ?? 12;
  const parts = [b1, b2];
  for (const s of [-1, 1]) {
    parts.push(
      tf(
        new THREE.TorusGeometry(L, L * (o.bowFat ?? 0.4), o.bowTube ?? 6, ts),
        [s * L * (o.bowSpread ?? 0.95), top + L * (o.bowLift ?? 0.55), 0],
        [0, s * (o.bowTwist ?? 0), -s * (o.bowLean ?? 0.62)],
        [1, 0.78, 0.62],
      ),
    );
  }
  const kn = o.knot ?? 0.55;
  parts.push(ellipsoid([L * kn, L * kn * 0.82, L * kn], [0, top + L * 0.25, 0], [0, 0, 0], o.bowTube ? 6 : 8, o.bowTube ? 4 : 6));
  return { body, ribbon: merge(parts) };
}

/** Fur trim: a torus lying in XZ with soft scallops around the ring. */
function fluffyRing(R, r, radial, tubular, bumps, amp) {
  const g = new THREE.TorusGeometry(R, r, radial, tubular);
  g.rotateX(Math.PI / 2);
  const P = g.attributes.position;
  const c = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    v.fromBufferAttribute(P, i);
    const th = Math.atan2(v.z, v.x);
    c.set(Math.cos(th) * R, 0, Math.sin(th) * R);
    const k = 1 + (amp / r) * (Math.pow(0.5 + 0.5 * Math.cos(th * bumps), 2) - 0.35);
    v.sub(c).multiplyScalar(k).add(c);
    P.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return weldNormals(g);
}

/** Lumpy sphere (fluffy pompom / snow ball). */
function lumpySphere(r, amp = 0.07, freq = 4.2, ws = 16, hs = 12, seed = 1) {
  const g = new THREE.SphereGeometry(1, ws, hs);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i);
    const y = P.getY(i);
    const z = P.getZ(i);
    const k =
      1 +
      amp *
        (Math.sin(freq * x + seed) * Math.sin(freq * y + seed * 1.7) * Math.sin(freq * z + seed * 0.3) +
          0.5 * Math.sin(2.1 * freq * (x + y) + seed));
    P.setXYZ(i, x * r * k, y * r * k, z * r * k);
  }
  g.computeVertexNormals();
  return weldNormals(g);
}

/* -------------------------------------------------------------- textures */

function canvasTexture(w, h, draw, srgb = true) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  draw(cv.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Soft radial falloff, greyscale & opaque (alphaMap reads the green channel) – contact shadows and glows. */
function radialTexture() {
  return memo(TEX, "radial", () =>
    canvasTexture(
      128,
      128,
      (g, w, h) => {
        g.fillStyle = "#000";
        g.fillRect(0, 0, w, h);
        const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        grd.addColorStop(0, "#fff");
        grd.addColorStop(0.3, "#c4c4c4");
        grd.addColorStop(0.62, "#474747");
        grd.addColorStop(0.86, "#0d0d0d");
        grd.addColorStop(1, "#000");
        g.fillStyle = grd;
        g.fillRect(0, 0, w, h);
      },
      false,
    ),
  );
}

/** Stripes. diagonal=false: bands across u (uv.x); diagonal=true: helix bands for a candy cane. */
function stripeTexture(key, colA, colB, diagonal) {
  return memo(TEX, key, () =>
    canvasTexture(64, 64, (g, w, h) => {
      g.fillStyle = colB;
      g.fillRect(0, 0, w, h);
      g.fillStyle = colA;
      if (diagonal) {
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(32, 0);
        g.lineTo(0, 32);
        g.closePath();
        g.moveTo(64, 0);
        g.lineTo(64, 32);
        g.lineTo(32, 64);
        g.lineTo(0, 64);
        g.closePath();
        g.fill();
      } else {
        g.fillRect(0, 0, 32, 64);
      }
    }),
  );
}

/* ------------------------------------------------------------- materials */

/** Glossy toy plastic (MeshPhysicalMaterial with clearcoat), cached by key. */
function toy(key, color, o = {}) {
  return memo(MAT, key, () => {
    const m = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.42,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      ...o,
    });
    m.name = key;
    return m;
  });
}

const hex = (c) => new THREE.Color(c).getHex();

function sharedMaterials() {
  return {
    skin: toy("skin", PAL.skin, {
      roughness: 0.5,
      clearcoat: 0.45,
      clearcoatRoughness: 0.28,
      sheen: 0.35,
      sheenColor: 0xffc9b8,
      sheenRoughness: 0.55,
    }),
    cheek: toy("cheek", PAL.cheek, { roughness: 0.62, clearcoat: 0.2, clearcoatRoughness: 0.4 }),
    eye: toy("eye", PAL.eye, { roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.03 }),
    shine: memo(MAT, "shine", () => new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })),
    mouth: toy("mouth", PAL.mouth, { roughness: 0.45, clearcoat: 0.6 }),
    fur: toy("fur", PAL.fur, {
      roughness: 0.82,
      clearcoat: 0,
      sheen: 1,
      sheenColor: 0xffffff,
      sheenRoughness: 0.35,
    }),
    boot: toy("boot", PAL.boot, { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 }),
    belt: toy("belt", PAL.belt, { roughness: 0.45, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
    gold: toy("gold", PAL.gold, { metalness: 1, roughness: 0.26, clearcoat: 0.6, clearcoatRoughness: 0.08 }),
    stocking: toy("stocking", 0xffffff, {
      map: stripeTexture("stripe-legs", "#e8283c", "#ffffff", false),
      roughness: 0.55,
      clearcoat: 0.4,
      clearcoatRoughness: 0.3,
    }),
    pink: toy("pink", PAL.pink, { roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 }),
    lime: toy("lime", PAL.lime, { roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 }),
    red: toy("red", PAL.red, { roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.08 }),
    white: toy("white", 0xfbfbfd, { roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.1 }),
    blob: memo(
      MAT,
      "blob",
      () =>
        new THREE.MeshBasicMaterial({
          color: PAL.shadow,
          alphaMap: radialTexture(),
          transparent: true,
          opacity: 0.34,
          depthWrite: false,
          toneMapped: false,
        }),
    ),
    hit: memo(MAT, "hit", () => new THREE.MeshBasicMaterial({ visible: false })),
  };
}

/* ---------------------------------------------------------- mesh helper */

function mk(geo, mat, { cast = true, receive = false, name = "" } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  m.raycast = noRaycast; // only userData.hit is meant for picking
  if (name) m.name = name;
  return m;
}

const _hitInv = new THREE.Matrix4();
const _hitRay = new THREE.Ray();
const _hitPt = new THREE.Vector3();
/**
 * Invisible picking proxy: an empty geometry (so Box3.setFromObject(group) ignores it) with an analytic
 * raycast against a sphere or a box in its local space. Works with Raycaster.intersectObject(s).
 * For orthographic cameras the whole line is tested: Raycaster.setFromCamera starts ortho rays on the camera
 * plane, and with the map camera at ground level everything below the screen centre lies behind that plane.
 * Such hits get a negative distance, so they still sort nearest-to-viewer first.
 */
function hitProxy(shape, mat) {
  const m = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  m.visible = false;
  m.name = "hit";
  m.userData.hitShape = shape;
  m.raycast = function raycast(raycaster, intersects) {
    const ortho = !!(raycaster.camera && raycaster.camera.isOrthographicCamera);
    _hitRay.copy(raycaster.ray);
    if (ortho) _hitRay.origin.addScaledVector(_hitRay.direction, -1e5);
    _hitInv.copy(this.matrixWorld).invert();
    _hitRay.applyMatrix4(_hitInv);
    const hitLocal = shape.isSphere ? _hitRay.intersectSphere(shape, _hitPt) : _hitRay.intersectBox(shape, _hitPt);
    if (!hitLocal) return;
    const point = _hitPt.clone().applyMatrix4(this.matrixWorld);
    const distance = point.clone().sub(raycaster.ray.origin).dot(raycaster.ray.direction);
    if (!ortho && (distance < raycaster.near || distance > raycaster.far)) return;
    intersects.push({ distance, point, object: this, face: null, faceIndex: undefined, uv: undefined });
  };
  return m;
}

/* ===================================================================== */
/*                               LIGHTING                                 */
/* ===================================================================== */

const KEY_DIR = new THREE.Vector3(-0.42, 1.0, 0.5).normalize(); // towards the key light (upper-left-front)
const RIM_DIR = new THREE.Vector3(0.72, 0.55, -0.7).normalize(); // towards the rim light (behind-right)
const KEY_DIST = 1000;
const SHADOW_BOX = { x: 300, z: 600, yMin: -20, yMax: 220 }; // half-extents of the covered ground area (600 × 1200)
const SHADOW_MAP = 2048;
const ENV = new WeakMap();

function buildEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const scene = new THREE.Scene();
  const R = 50;
  const dome = new THREE.SphereGeometry(R, 32, 16);
  const P = dome.attributes.position;
  const col = [];
  const top = new THREE.Color(0xd4e3ff);
  const hor = new THREE.Color(0xc2cad8);
  const bot = new THREE.Color(0xebe6de);
  const c = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i) / R;
    if (y >= 0) c.copy(hor).lerp(top, Math.pow(y, 0.7));
    else c.copy(hor).lerp(bot, Math.pow(-y, 0.45));
    col.push(c.r * 0.5, c.g * 0.5, c.b * 0.5);
  }
  dome.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Mesh(dome, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const panel = (dir, w, h, intensity, color = 0xffffff, dist = 30) => {
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    mat.color.multiplyScalar(intensity);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.copy(new THREE.Vector3(dir[0], dir[1], dir[2]).normalize().multiplyScalar(dist));
    m.lookAt(0, 0, 0);
    scene.add(m);
  };
  panel([-0.55, 0.8, 0.45], 30, 20, 6.5, 0xfff6ec); // key softbox, upper-left-front
  panel([0.15, 1, -0.25], 34, 34, 1.6); // overhead
  panel([1, 0.2, -0.15], 7, 40, 4.5, 0xeef4ff); // right strip → edge highlight
  panel([-1, 0.15, -0.35], 6, 30, 2.0); // left strip
  panel([0.1, 0.55, 1], 36, 14, 1.3); // front fill (camera side)
  panel([-0.75, -0.05, -0.6], 24, 10, 1.3, 0xff9fe6); // pink accent (Blink)
  panel([0.7, 0.0, 0.7], 24, 8, 1.1, 0x9fd8ff); // blue accent
  const rt = pmrem.fromScene(scene, 0.03);
  pmrem.dispose();
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return rt.texture;
}

/**
 * Lights + procedural studio environment + soft shadows.
 * Sets renderer.shadowMap (PCFShadowMap with radius – in r186 PCFSoftShadowMap is removed and falls back to it
 * with a console warning), NeutralToneMapping and sRGB output.
 * @returns {{ update(centerX:number, centerZ:number):void, key:THREE.DirectionalLight, rim:THREE.DirectionalLight, hemi:THREE.HemisphereLight }}
 */
export function createLighting(_THREE, renderer, scene) {
  checkThree(_THREE);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  let env = ENV.get(renderer);
  if (!env) {
    env = buildEnvironment(renderer);
    ENV.set(renderer, env);
  }
  scene.environment = env;
  scene.environmentIntensity = 0.5;

  const hemi = new THREE.HemisphereLight(0xd9e6ff, 0xeae3d8, 0.3);
  hemi.name = "ny-hemi";

  const key = new THREE.DirectionalLight(0xffefdc, 3.1);
  key.name = "ny-key";
  key.castShadow = true;
  key.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.6;
  key.shadow.radius = 4;

  // Light-space basis (same as the shadow camera after lookAt).
  const zc = KEY_DIR.clone();
  const xc = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), zc).normalize();
  const yc = new THREE.Vector3().crossVectors(zc, xc);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  let z0 = Infinity;
  let z1 = -Infinity;
  const p = new THREE.Vector3();
  for (const x of [-SHADOW_BOX.x, SHADOW_BOX.x])
    for (const y of [SHADOW_BOX.yMin, SHADOW_BOX.yMax])
      for (const z of [-SHADOW_BOX.z, SHADOW_BOX.z]) {
        p.set(x, y, z);
        x0 = Math.min(x0, p.dot(xc));
        x1 = Math.max(x1, p.dot(xc));
        y0 = Math.min(y0, p.dot(yc));
        y1 = Math.max(y1, p.dot(yc));
        z0 = Math.min(z0, p.dot(zc));
        z1 = Math.max(z1, p.dot(zc));
      }
  const cam = key.shadow.camera;
  cam.left = x0;
  cam.right = x1;
  cam.bottom = y0;
  cam.top = y1;
  cam.near = KEY_DIST - z1 - 20;
  cam.far = KEY_DIST - z0 + 20;
  cam.updateProjectionMatrix();
  const texelX = (x1 - x0) / SHADOW_MAP;
  const texelY = (y1 - y0) / SHADOW_MAP;

  const rim = new THREE.DirectionalLight(0xdde9ff, 1.1);
  rim.name = "ny-rim";
  rim.position.copy(RIM_DIR).multiplyScalar(100);

  scene.add(hemi, key, key.target, rim);

  const c = new THREE.Vector3();
  function update(centerX = 0, centerZ = 0) {
    c.set(centerX, 0, centerZ);
    // snap to the shadow-map texel grid so shadows do not shimmer while panning
    const u = Math.round(c.dot(xc) / texelX) * texelX;
    const v = Math.round(c.dot(yc) / texelY) * texelY;
    const w = c.dot(zc);
    key.target.position.set(0, 0, 0).addScaledVector(xc, u).addScaledVector(yc, v).addScaledVector(zc, w);
    key.position.copy(key.target.position).addScaledVector(zc, KEY_DIST);
    key.target.updateMatrixWorld();
    key.updateMatrixWorld();
  }
  update(0, 0);
  return { update, key, rim, hemi };
}

/** Large transparent ground plane that only shows the soft shadows (ShadowMaterial). */
export function createShadowCatcher(_THREE, size = 4000) {
  checkThree(_THREE);
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShadowMaterial({ color: PAL.shadow, opacity: 0.22, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.name = "ny-shadow-catcher";
  m.receiveShadow = true;
  m.renderOrder = -2;
  return m;
}

/* ===================================================================== */
/*                                  ELF                                   */
/* ===================================================================== */

// Design units = world units (px at 1×).
const ELF = {
  scale: 0.88,
  hipY: 12.4,
  hipX: 3.1,
  neckY: 14.6, // above the torso pivot (torso pivot is at hipY)
  headY: 9.3,
  headR: 10,
  shoulderX: 7.0,
  shoulderY: 10.9,
  hat: { H: 19, R0: 8.0, y1: 7, y2: 13.5, rest: { b1x: 0.0, b1z: -0.3, b2x: -0.06, b2z: -0.62 } },
  eyeY: 1.0,
  stepHz: 1.0, // walk cycles per second at pace 1 (= 2 steps/s)
};

/**
 * The gift sack (sack-local: centre at y = 0, bottom at y = -8.6, +Z is the side that touches the elf's back,
 * the rope bow faces −Z). detail "lo" for the walking elves, "hi" for the standalone prop.
 */
function sackGeometry(detail = "lo") {
  return memo(GEO, `sack:${detail}`, () => {
    const hi = detail === "hi";
    const prof = [
      [0.001, -8.6],
      [4.3, -8.3],
      [7.3, -6.8],
      [8.9, -4.0],
      [9.3, -0.6],
      [8.8, 2.8],
      [7.2, 5.6],
      [5.0, 7.6],
      [3.3, 8.8],
      [2.9, 9.4],
      [3.5, 10.1],
      [4.7, 11.0],
      [5.0, 11.9],
      [4.3, 12.4],
      [3.2, 11.9],
      [0.001, 11.2],
    ];
    const sack = new THREE.LatheGeometry(
      prof.map(([r, y]) => new THREE.Vector2(r, y)),
      hi ? 30 : 14,
    );
    const P = sack.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i);
      const y = P.getY(i);
      const z = P.getZ(i);
      const phi = Math.atan2(x, z);
      const band = y > -7.5 && y < 8 ? Math.sin(((y + 7.5) / 15.5) * Math.PI) : 0;
      const k = 1 + 0.055 * band * Math.sin(3 * phi + 1.2 + y * 0.25);
      P.setXYZ(i, x * k, y, z * k * 0.8);
    }
    sack.computeVertexNormals();
    const g = { sack: weldNormals(sack) };
    const rope = [tf(new THREE.TorusGeometry(3.25, 0.72, hi ? 8 : 5, hi ? 28 : 14), [0, 9.4, 0], [Math.PI / 2, 0, 0], [1, 1, 0.8])];
    for (const sd of [-1, 1]) {
      rope.push(
        tf(new THREE.TorusGeometry(1.5, 0.5, hi ? 7 : 4, hi ? 16 : 8), [sd * 1.55, 10.0, -2.7], [0.3, 0, -sd * 0.55], [1, 0.8, 1]),
      );
      if (hi) {
        rope.push(
          tube(
            [
              [sd * 0.5, 9.5, -2.8],
              [sd * 1.5, 7.8, -3.4],
              [sd * 1.9, 6.1, -3.3],
            ],
            () => 0.42,
            { tubular: 8, radial: 7 },
          ),
        );
      }
    }
    rope.push(ellipsoid([0.9, 0.75, 0.7], [0, 9.8, -3.0], [0, 0, 0], hi ? 10 : 6, hi ? 8 : 4));
    g.rope = merge(rope);
    const gift = hi
      ? giftGeos(6.4, 5.6, 6.4, { r: 1.2, band: 1.5, bow: 1.1, seg: 2, ribbonSeg: 2, bowSeg: 14 })
      : giftGeos(6.4, 5.6, 6.4, { r: 1.2, band: 1.5, bow: 1.1, seg: 1, ribbonSeg: 1, bowSeg: 7, bowTube: 4 });
    g.giftBody = gift.body;
    g.giftRibbon = gift.ribbon;
    g.giftPos = [0.3, 11.0, 0.3];
    g.giftRot = [0.22, 0.6, -0.3];
    return g;
  });
}

function sackMaterial(color) {
  const h = hex(color ?? PAL.sack);
  return toy(`sack:${h}`, h, {
    roughness: 0.58,
    clearcoat: 0.45,
    clearcoatRoughness: 0.3,
    sheen: 0.4,
    sheenColor: 0xffffff,
    sheenRoughness: 0.5,
  });
}

function elfGeometry() {
  return memo(GEO, "elf", () => {
    const g = {};
    const HR = ELF.headR;

    /* head (skin): sphere + pointy ears + button nose */
    const ear = (side) => {
      const e = new THREE.SphereGeometry(1, 8, 6);
      const P = e.attributes.position;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i);
        const y = P.getY(i);
        const z = P.getZ(i);
        const t = (y + 1) / 2; // 0 base → 1 tip
        const w = Math.pow(1 - t, 0.7) * 0.92 + 0.08;
        P.setXYZ(i, x * w * 2.5, t * 7.6 - 0.6, z * w * 1.05);
      }
      e.computeVertexNormals();
      weldNormals(e);
      tf(e, [0, 0, 0], [0, 0, -side * 1.02]); // tip outwards and up
      tf(e, [0, 0, 0], [0, side * 0.45, 0]); // sweep back a little
      const base = sph(HR - 1.4, side * 86, 6);
      return tf(e, [base.x, base.y, base.z]);
    };
    const nose = tf(sphere(1.6, 8, 6), sph(HR + 0.3, 0, -5).toArray());
    g.headSkin = merge([sphere(HR, 20, 14), ear(1), ear(-1), nose]);

    /* eyes + catchlights, built relative to the eye pivot (for blinks) */
    const eyes = [];
    const shines = [];
    for (const side of [-1, 1]) {
      const n = sph(1, side * 21, 6);
      const p = n.clone().multiplyScalar(HR - 0.3);
      p.y -= ELF.eyeY;
      eyes.push(orient(ellipsoid([1.9, 2.5, 1.15], [0, 0, 0], [0, 0, 0], 10, 7), p, n));
      shines.push(orient(tf(sphere(0.62, 6, 4), [-0.55, 0.8, 0.9]), p, n));
      shines.push(orient(tf(sphere(0.3, 5, 3), [0.6, -0.95, 0.82]), p, n));
    }
    g.eyes = merge(eyes);
    g.shines = merge(shines);

    /* cheeks + smile */
    g.cheeks = merge(
      [-1, 1].map((side) => {
        const n = sph(1, side * 37, -9);
        return orient(ellipsoid([2.1, 1.35, 0.55], [0, 0, 0], [0, 0, 0], 8, 5), n.clone().multiplyScalar(HR - 0.12), n);
      }),
    );
    {
      const n = sph(1, 0, -17);
      const smile = new THREE.TorusGeometry(1.25, 0.36, 5, 10, Math.PI);
      tf(smile, [0, 0, 0], [0, 0, Math.PI]);
      g.mouth = orient(smile, n.clone().multiplyScalar(HR - 0.05), n);
    }

    /* hat: skinned cone (3 bones), fur trim, pompom */
    {
      const { H, R0, y1, y2 } = ELF.hat;
      const prof = [
        [0.001, 0.8],
        [R0 * 0.8, 0.25],
        [R0, 0],
      ];
      const N = 11;
      const tipR = 1.25;
      for (let i = 1; i <= N; i++) {
        const t = i / N;
        prof.push([R0 * Math.pow(1 - t, 0.9) * (1 - t * 0.02) + tipR * t, t * (H - tipR)]);
      }
      for (let k = 1; k <= 2; k++) {
        const a = (k / 2) * (Math.PI / 2);
        prof.push([tipR * Math.cos(a), H - tipR + tipR * Math.sin(a)]);
      }
      const hat = lathe(prof, 16);
      const P = hat.attributes.position;
      const si = [];
      const sw = [];
      const blend = 2.6;
      for (let i = 0; i < P.count; i++) {
        const y = P.getY(i);
        let w0 = 0;
        let w1 = 0;
        let w2 = 0;
        if (y < y1 - blend) w0 = 1;
        else if (y < y1 + blend) {
          const f = (y - (y1 - blend)) / (2 * blend);
          w0 = 1 - f;
          w1 = f;
        } else if (y < y2 - blend) w1 = 1;
        else if (y < y2 + blend) {
          const f = (y - (y2 - blend)) / (2 * blend);
          w1 = 1 - f;
          w2 = f;
        } else w2 = 1;
        si.push(0, 1, 2, 0);
        sw.push(w0, w1, w2, 0);
      }
      hat.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
      hat.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
      g.hat = hat;
      g.trim = fluffyRing(8.3, 2.45, 6, 26, 10, 0.32);
      g.pompom = lumpySphere(3.3, 0.06, 4.5, 10, 8, 2);
    }

    /* tunic: bell lathe with a zig-zag hem */
    {
      const prof = [
        [0.001, -2.0],
        [5.6, -2.4],
        [8.4, -2.1],
        [9.0, -1.0],
        [8.9, 1.2],
        [8.4, 3.4],
        [8.2, 6.8],
        [7.4, 10.0],
        [5.6, 12.8],
        [3.4, 14.4],
        [0.001, 15.1],
      ];
      const tun = new THREE.LatheGeometry(
        prof.map(([r, y]) => new THREE.Vector2(r, y)),
        18,
      );
      const P = tun.attributes.position;
      for (let i = 0; i < P.count; i++) {
        const y = P.getY(i);
        if (y < 0.4) {
          const phi = Math.atan2(P.getX(i), P.getZ(i));
          const k = clamp((0.4 - y) / 1.4, 0, 1);
          const zig = Math.pow(0.5 + 0.5 * Math.cos(phi * 7), 1.4);
          P.setY(i, y - 1.7 * zig * k);
        }
      }
      tf(tun, [0, 0, 0], [0, 0, 0], [1, 1, 0.9]);
      tun.computeVertexNormals();
      g.tunic = weldNormals(tun);
      g.belt = tf(new THREE.TorusGeometry(8.45, 1.25, 4, 18), [0, 3.4, 0], [Math.PI / 2, 0, 0], [1, 1, 0.9]);
      g.buckle = tf(roundedBox(4.6, 3.8, 1.3, [1.0, 1.0, 0.5], 1), [0, 3.4, 8.45 * 0.9 + 0.95]);
    }

    /* arms */
    g.sleeve = tube(
      [
        [0, 0.4, 0],
        [0, -6.3, 0],
      ],
      () => 2.15,
      { tubular: 2, radial: 8, capRings: 3 },
    );
    g.hand = tf(sphere(2.3, 7, 5), [0, -7.6, 0.25]);

    /* legs: striped stockings + boots with curled toes (hip-local) */
    g.leg = tube(
      [
        [0, 0.6, 0],
        [0, -(ELF.hipY - 3.4), 0],
      ],
      () => 1.85,
      { tubular: 3, radial: 9, capRings: 3, uvPeriod: 2.6 },
    );
    {
      const by = -ELF.hipY + 2.35;
      const bootBody = ellipsoid([2.85, 2.4, 4.05], [0, by, 1.0], [0, 0, 0], 9, 6);
      const toe = tube(
        [
          [0, by + 1.0, 3.9],
          [0, by + 2.2, 5.5],
          [0, by + 3.9, 5.6],
          [0, by + 4.7, 4.5],
        ],
        (t) => lerp(1.05, 0.55, t),
        { tubular: 6, radial: 6, capRings: 2 },
      );
      g.boot = merge([bootBody, toe]);
      g.bootBell = tf(sphere(0.85, 6, 4), [0, by + 4.6, 4.2]);
    }

    /* sack on the back (sack-local; +Z touches the elf's back) */
    Object.assign(g, sackGeometry("lo"));

    g.blob = new THREE.PlaneGeometry(29, 27).rotateX(-Math.PI / 2);
    return g;
  });
}

let elfCounter = 0;

/**
 * Elf courier.
 * @param {object} options { hatColor, tunicColor, sackColor } – any THREE.Color input.
 * @returns {{ group: THREE.Group, update(dt:number, state:{walking:boolean, pace?:number, celebrate?:boolean, running?:boolean}):void, setHeading(rad:number, immediate?:boolean):void }}
 */
export function createElf(_THREE, options = {}) {
  checkThree(_THREE);
  const G = elfGeometry();
  const S = sharedMaterials();
  const hatHex = hex(options.hatColor ?? PAL.hat);
  const tunicHex = hex(options.tunicColor ?? PAL.tunic);
  const sackHex = hex(options.sackColor ?? PAL.sack);
  const tunicMat = toy(`tunic:${tunicHex}`, tunicHex, { roughness: 0.42, clearcoat: 0.85, clearcoatRoughness: 0.16 });
  const hatMat = toy(`hat:${hatHex}`, hatHex, { roughness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.14 });
  const sackMat = sackMaterial(sackHex);
  const rand = mulberry32(0x5eed + elfCounter++ * 7919);
  const seed = rand() * 100;

  const group = new THREE.Group();
  group.name = "ny-elf";

  const blob = mk(G.blob, S.blob, { cast: false });
  blob.position.y = 0.15;
  blob.renderOrder = -1;
  group.add(blob);

  const yawNode = new THREE.Group();
  yawNode.scale.setScalar(ELF.scale);
  group.add(yawNode);
  const rig = new THREE.Group(); // bob / hop / squash (pivot at the feet)
  yawNode.add(rig);

  // legs
  const hips = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * ELF.hipX, ELF.hipY, 0);
    hip.add(mk(G.leg, S.stocking), mk(G.boot, S.boot), mk(G.bootBell, S.gold, { cast: false }));
    rig.add(hip);
    return hip;
  });

  // torso
  const torso = new THREE.Group();
  torso.position.y = ELF.hipY;
  rig.add(torso);
  torso.add(mk(G.tunic, tunicMat), mk(G.belt, S.belt), mk(G.buckle, S.gold, { cast: false }));

  const shoulders = [-1, 1].map((side) => {
    const sh = new THREE.Group();
    sh.position.set(side * ELF.shoulderX, ELF.shoulderY, 0);
    sh.add(mk(G.sleeve, tunicMat), mk(G.hand, S.skin));
    torso.add(sh);
    return sh;
  });

  const SACK_REST = { x: 1.4, y: 9.4, z: -7.6, rx: -0.14, rz: -0.24 };
  const sackPivot = new THREE.Group();
  sackPivot.position.set(SACK_REST.x, SACK_REST.y, SACK_REST.z);
  sackPivot.rotation.set(SACK_REST.rx, 0, SACK_REST.rz);
  torso.add(sackPivot);
  sackPivot.add(mk(G.sack, sackMat), mk(G.rope, S.gold));
  const sackGift = new THREE.Group();
  sackGift.position.fromArray(G.giftPos);
  sackGift.rotation.fromArray(G.giftRot);
  sackGift.add(mk(G.giftBody, S.pink), mk(G.giftRibbon, S.lime));
  sackPivot.add(sackGift);

  // head
  const neck = new THREE.Group();
  neck.position.y = ELF.neckY;
  torso.add(neck);
  const head = new THREE.Group();
  head.position.set(0, ELF.headY, 0.5);
  head.rotation.x = -0.2;
  head.scale.set(1.05, 0.97, 1);
  neck.add(head);
  head.add(
    mk(G.headSkin, S.skin),
    mk(G.cheeks, S.cheek, { cast: false }),
    mk(G.mouth, S.mouth, { cast: false }),
  );
  const eyes = new THREE.Group();
  eyes.position.y = ELF.eyeY;
  eyes.add(mk(G.eyes, S.eye, { cast: false }), mk(G.shines, S.shine, { cast: false }));
  head.add(eyes);

  // hat
  const hatRoot = new THREE.Group();
  hatRoot.position.set(0, 5.6, -1.0);
  hatRoot.rotation.set(0.06, 0, 0.1);
  head.add(hatRoot);
  hatRoot.add(mk(G.trim, S.fur));
  const bones = [new THREE.Bone(), new THREE.Bone(), new THREE.Bone()];
  bones[1].position.y = ELF.hat.y1;
  bones[2].position.y = ELF.hat.y2 - ELF.hat.y1;
  bones[0].add(bones[1]);
  bones[1].add(bones[2]);
  const hat = new THREE.SkinnedMesh(G.hat, hatMat);
  hat.add(bones[0]);
  hat.bind(new THREE.Skeleton(bones));
  hat.castShadow = true;
  hat.frustumCulled = false;
  hat.raycast = noRaycast;
  hat.position.y = 0.5;
  hatRoot.add(hat);
  const pompom = mk(G.pompom, S.fur);
  pompom.position.y = ELF.hat.H - ELF.hat.y2 + 1.4;
  bones[2].add(pompom);

  // hit sphere
  const hit = hitProxy(new THREE.Sphere(new THREE.Vector3(), 30), S.hit);
  hit.position.y = 27;
  group.add(hit);
  group.userData.hit = hit;
  group.userData.kind = "elf";

  /* ---------------------------------------------------------- animation */
  let time = rand() * 10;
  let phase = 0;
  let walkW = 0;
  let runW = 0; // бег после тряски: шаг чаще и шире, корпус вперёд, руки работают, подлёт на каждом шаге
  let celebW = 0;
  let hopT = 0;
  let yaw = 0;
  let yawTarget = 0;
  let yawVel = 0;
  let headingSet = false;
  let blinkIn = 1.5 + rand() * 2.5;
  let blinkT = -1;
  let prevY = 0;
  let velY = 0;
  const hs = { x: 0, vx: 0, z: 0, vz: 0 };
  const R = ELF.hat.rest;

  function setHeading(rad, immediate = false) {
    yawTarget = Math.PI / 2 - rad;
    if (immediate || !headingSet) {
      yaw = yawTarget;
      yawNode.rotation.y = yaw;
    }
    headingSet = true;
  }

  function update(dt, state = {}) {
    dt = clamp(Number(dt) || 0, 0, 0.1);
    time += dt;
    const celebrate = !!state.celebrate;
    const walking = !!state.walking && !celebrate;
    const pace = clamp(state.pace ?? 1, 0.3, 3);
    const pk = pace - 1;
    walkW = approach(walkW, walking ? 1 : 0, 9, dt);
    runW = approach(runW, walking && state.running ? 1 : 0, 5, dt);
    celebW = approach(celebW, celebrate ? 1 : 0, 7, dt);
    const idleW = clamp(1 - walkW - celebW, 0, 1);
    // бег – не только быстрее: частота шага растёт сама, даже когда эльф на стенде ползёт по карте
    if (walking) phase += dt * ELF.stepHz * Math.max(pace, 1.15 * runW) * (1 + 1.1 * runW);

    // heading
    const d = wrapAngle(yawTarget - yaw);
    const step = d * (1 - Math.exp(-12 * dt));
    yaw += step;
    yawVel = dt > 0 ? step / dt : 0;
    yawNode.rotation.y = yaw;

    const ph = TAU * phase;
    const s = Math.sin(ph);
    const s2 = s * s;

    /* walk */
    const legA = (0.68 + 0.12 * pk + 0.4 * runW) * walkW;
    let hipL = -legA * s;
    let hipR = legA * s;
    // бег: на каждом шаге подлёт – оба носка над землёй
    let bob = (-(1.65 + 0.8 * pk) * s2 + 0.45 * (1 - s2)) * walkW * (1 - runW) + 3.2 * Math.abs(s) * runW * walkW;
    const lean = (0.1 + 0.15 * pk + 0.36 * runW) * walkW;
    const sway = 0.075 * s * walkW;
    const twist = (0.11 + 0.08 * runW) * s * walkW;
    const armA = (0.75 + 0.22 * pk + 0.6 * runW) * walkW;
    let armLx = armA * s;
    let armRx = -armA * s;
    let armLz = -0.36 + 0.14 * runW;
    let armRz = 0.36 - 0.14 * runW;
    let neckX = -0.05 * Math.cos(2 * ph) * walkW;
    let neckY = 0;
    let neckZ = -0.05 * s * walkW;
    let torsoSY = 1;

    /* idle: breathing + looking around */
    const br = Math.sin((TAU * time) / 2.8 + seed);
    neckY += (0.34 * Math.sin(time * 0.55 + seed * 3) + 0.12 * Math.sin(time * 1.37 + seed)) * idleW;
    neckX += 0.035 * br * idleW;
    armLz -= 0.05 * br * idleW;
    armRz += 0.05 * br * idleW;
    torsoSY += 0.022 * br * idleW;

    /* celebrate: happy hops with arms up */
    let hop = 0;
    let sq = 1;
    if (celebW > 0.001) {
      hopT += dt * 2.1;
      const u = hopT % 1;
      if (u < 0.22) {
        sq = 1 - 0.15 * Math.sin((Math.PI * u) / 0.22);
      } else {
        const a = (u - 0.22) / 0.78;
        hop = 4 * a * (1 - a) * 7;
        sq = 1 + 0.09 * Math.max(0, 1 - a * 2.2);
      }
      hop *= celebW;
      sq = lerp(1, sq, celebW);
      const wave = Math.sin(time * 13);
      armLz = lerp(armLz, -2.5 + 0.2 * wave, celebW);
      armRz = lerp(armRz, 2.5 + 0.2 * wave, celebW);
      armLx = lerp(armLx, -0.5, celebW);
      armRx = lerp(armRx, -0.5, celebW);
      neckX = lerp(neckX, -0.2, celebW);
      hipL = lerp(hipL, -0.18, celebW * (hop > 0.5 ? 1 : 0.3));
      hipR = lerp(hipR, 0.12, celebW * (hop > 0.5 ? 1 : 0.3));
    } else {
      hopT = 0;
    }

    rig.position.y = bob + hop;
    rig.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    torso.rotation.set(lean, twist, sway);
    torso.scale.set(1, torsoSY, 1);
    hips[0].rotation.x = hipL;
    hips[1].rotation.x = hipR;
    shoulders[0].rotation.set(armLx, 0, armLz);
    shoulders[1].rotation.set(armRx, 0, armRz);
    neck.rotation.set(neckX - lean * 0.55, neckY - twist * 0.8, neckZ - sway * 0.7);

    // sack: bounces a beat behind the body
    sackPivot.position.y = SACK_REST.y + (0.55 + 0.9 * runW) * Math.cos(2 * ph - 1.3) * walkW + 0.6 * celebW * Math.sin(TAU * hopT - 1.8);
    sackPivot.rotation.z = SACK_REST.rz + 0.09 * Math.sin(ph - 0.9) * walkW;
    sackPivot.rotation.x = SACK_REST.rx - 0.07 * Math.cos(2 * ph - 1.0) * walkW - 0.12 * pk * walkW;
    sackGift.position.y = G.giftPos[1] + 0.35 * Math.cos(2 * ph - 2.0) * walkW;

    // blink (+ happy squint while celebrating)
    blinkIn -= dt;
    if (blinkIn <= 0) {
      blinkT = 0;
      blinkIn = 2.2 + rand() * 2.8;
    }
    let blink = 1;
    if (blinkT >= 0) {
      blinkT += dt;
      const b = blinkT / 0.15;
      if (b >= 1) blinkT = -1;
      else blink = 1 - 0.9 * Math.sin(Math.PI * b);
    }
    eyes.scale.y = blink * lerp(1, 0.45, celebW);

    // hat: springy secondary motion (lags the body)
    const y = rig.position.y;
    const vy = dt > 0 ? (y - prevY) / dt : 0;
    prevY = y;
    velY = lerp(velY, vy, 0.5);
    const tx = -0.1 * pace * walkW + 0.12 * Math.cos(2 * ph - 1.9) * walkW - 0.006 * velY;
    const tz = 0.24 * Math.sin(ph - 1.4) * walkW - 0.004 * velY - 0.05 * clamp(yawVel, -6, 6) + 0.12 * neckY;
    let rest = dt;
    while (rest > 1e-6) {
      const h = Math.min(rest, 1 / 120);
      hs.vx += (110 * (tx - hs.x) - 8 * hs.vx) * h;
      hs.x += hs.vx * h;
      hs.vz += (110 * (tz - hs.z) - 8 * hs.vz) * h;
      hs.z += hs.vz * h;
      rest -= h;
    }
    hs.x = clamp(hs.x, -0.9, 0.7);
    hs.z = clamp(hs.z, -0.9, 0.9);
    bones[1].rotation.set(R.b1x + hs.x * 0.45, 0, R.b1z + hs.z * 0.45);
    bones[2].rotation.set(R.b2x + hs.x * 0.8, 0, R.b2z + hs.z * 0.8);

    blob.scale.setScalar(1 - clamp(hop, 0, 12) * 0.022);
  }

  yaw = yawTarget = 0; // faces +Z (the camera) until the first setHeading(), which snaps
  yawNode.rotation.y = 0;
  update(0, { walking: false });
  return { group, update, setHeading };
}

/* ===================================================================== */
/*                          DISPATCH POST (пункт)                         */
/* ===================================================================== */

const POST = {
  scale: 1.1, // whole post; ≈112 px wide on screen
  yaw: -22 * DEG, // 3/4 view: the lit facade turns a little to the left, the shaded right wall shows
  W: 56, // facade width (X)
  D: 32, // depth (Z)
  base: 2.5,
  eaveY: 35,
  ridgeY: 66,
  overSide: 6, // roof overhang beyond the side walls
  overFront: 4.5, // roof overhang in front of the facade / behind the back wall
  chimney: { x: 14, z: -10 },
  signZ: 3,
};

function postGeometry() {
  return memo(GEO, "post", () => {
    const g = {};
    const rand = mulberry32(20261231);
    const hw = POST.W / 2;
    const hd = POST.D / 2;
    const roofLen = POST.D + 2 * POST.overFront;

    /* snow patch under everything (group frame, not yawed) */
    {
      const m = lathe(
        [
          [52, 0],
          [50, 0.6],
          [46, 1.8],
          [37, 2.9],
          [20, 3.5],
          [0.001, 3.6],
        ],
        40,
      );
      const P = m.attributes.position;
      for (let i = 0; i < P.count; i++) {
        const x = P.getX(i);
        const z = P.getZ(i);
        const phi = Math.atan2(x, z);
        const k = 0.94 * (1 + 0.07 * Math.sin(3 * phi + 0.8) + 0.04 * Math.sin(5 * phi + 2.1));
        P.setXYZ(i, x * k, P.getY(i), z * k * 0.82);
      }
      m.computeVertexNormals();
      g.mound = weldNormals(m);
      const lumps = [];
      for (const [x, z, r] of [
        [-49, 4, 3.0],
        [-45, 13, 2.1],
        [47, -8, 2.6],
        [8, 42, 2.0],
        [-6, 40.5, 1.4],
        [30, 36, 1.8],
      ]) {
        lumps.push(tf(lumpySphere(r, 0.08, 3, 7, 5, x), [x, 1.2, z], [0, 0, 0], [1, 0.62, 1]));
      }
      g.moundLumps = merge(lumps);
    }

    /* house body: pentagon prism, gable facing +Z, rounded edges */
    g.walls = extrude(
      roundedPoly(
        [
          [-hw, POST.base],
          [hw, POST.base],
          [hw, POST.eaveY],
          [0, POST.ridgeY],
          [-hw, POST.eaveY],
        ],
        4.2,
      ),
      POST.D,
      3.6,
      { curveSegments: 5, bevelSegments: 3 },
    );
    // white corner posts on the facade
    g.trim = merge(
      [-1, 1].map((sx) =>
        tube(
          [
            [sx * (hw - 0.5), POST.base + 1, hd - 0.5],
            [sx * (hw - 0.5), POST.eaveY - 0.5, hd - 0.5],
          ],
          () => 2.4,
          { tubular: 2, radial: 9, capRings: 3 },
        ),
      ),
    );

    /* roof slab + thick snow cap: Λ profiles in X–Y, extruded along Z */
    {
      const slope = (POST.ridgeY - POST.eaveY) / hw;
      const cosA = 1 / Math.sqrt(1 + slope * slope);
      const sinA = slope * cosA;
      const ridge = POST.ridgeY + 0.6;
      const over = hw + POST.overSide;
      const eaveY = ridge - over * slope;
      const T = 3.6;
      const topRidge = ridge + T / cosA;
      const tex = over + sinA * T;
      const tey = eaveY + cosA * T;
      g.roof = extrude(
        roundedPoly(
          [
            [over, eaveY],
            [tex, tey],
            [0, topRidge],
            [-tex, tey],
            [-over, eaveY],
            [0, ridge],
          ],
          [1.5, 1.5, 2.5, 1.5, 1.5, 2],
        ),
        roofLen,
        1.3,
        { curveSegments: 3, bevelSegments: 2 },
      );

      const snowT = 7.2;
      const sRidge = topRidge + (snowT + 1.2) / cosA;
      const sex = tex + sinA * snowT;
      const sey = tey + cosA * snowT;
      const lipX = sex + 2.2;
      // convex (pillowy) slopes: extra points on a bulging quadratic between the lip top and the ridge
      const bulge = (P0, P1, amount, n) => {
        const dx = P1[0] - P0[0];
        const dy = P1[1] - P0[1];
        const len = Math.hypot(dx, dy);
        const c = [(P0[0] + P1[0]) / 2 + (dy / len) * amount, (P0[1] + P1[1]) / 2 + (-dx / len) * amount];
        const out = [];
        for (let i = 1; i < n; i++) {
          const t = i / n;
          const a = (1 - t) * (1 - t);
          const b = 2 * (1 - t) * t;
          out.push([a * P0[0] + b * c[0] + t * t * P1[0], a * P0[1] + b * c[1] + t * t * P1[1]]);
        }
        return out;
      };
      const E = [sex, sey + 0.6];
      const F = [0, sRidge];
      const El = [-sex, sey + 0.6];
      const upR = bulge(E, F, 3.2, 5);
      const upL = bulge(F, El, 3.2, 5);
      const pts = [
        [tex - 1.2, tey + 0.4],
        [tex + 1.0, tey - 3.2],
        [lipX, tey - 3.0],
        [lipX + 0.9, sey - 1.4],
        E,
        ...upR,
        F,
        ...upL,
        El,
        [-lipX - 0.9, sey - 1.4],
        [-lipX, tey - 3.0],
        [-tex - 1.0, tey - 3.2],
        [-tex + 1.2, tey + 0.4],
        [0, topRidge - 0.2],
      ];
      const radii = pts.map(() => 0.01);
      [0, 1, 2, 3, 4].forEach((i, k) => (radii[i] = [1.2, 2.6, 3.0, 3.4, 3.6][k]));
      radii[4 + upR.length + 1] = 9;
      const li = 4 + upR.length + 1 + upL.length + 1;
      [li, li + 1, li + 2, li + 3, li + 4].forEach((i, k) => (radii[i] = [3.6, 3.4, 3.0, 2.6, 1.2][k]));
      radii[pts.length - 1] = 3;
      // soft pillows: lift the upper surface with smooth low-frequency bumps
      const pillow = (P) => {
        for (let i = 0; i < P.count; i++) {
          const x = P.getX(i);
          const y = P.getY(i);
          const z = P.getZ(i);
          const h = y - (topRidge - Math.abs(x) * slope); // height above the roof surface
          const k = clamp((h - 2.5) / 3.5, 0, 1);
          if (k <= 0) continue;
          const side = x >= 0 ? 1 : -1;
          const n =
            0.9 * Math.sin(z * 0.34 + side * 1.7 + Math.abs(x) * 0.05) * Math.cos(Math.abs(x) * 0.16 - 0.4) +
            0.45 * Math.sin(z * 0.71 - Math.abs(x) * 0.21 + side * 0.6);
          const edge = 1 - clamp((Math.abs(z) - ((roofLen - 1.5) / 2 - 6)) / 5, 0, 1); // calm near the gable ends
          P.setY(i, y + k * edge * (0.9 + 1.5 * n));
        }
      };
      g.snow = extrude(roundedPoly(pts, radii), roofLen - 1.5, 3.0, {
        curveSegments: 3,
        bevelSegments: 2,
        crease: 50 * DEG,
        steps: 9,
        deform: pillow,
      });

      // soft drips: along both side eaves and a few on the front rake
      const lumps = [];
      const zl = (roofLen - 1.5) / 2 - 2.5;
      for (const sx of [-1, 1]) {
        for (let z = -zl; z <= zl + 0.1; z += 7.4) {
          const r = 2.2 + rand() * 1.2;
          lumps.push(
            tf(lumpySphere(r, 0.06, 3.2, 7, 5, z + sx), [sx * (lipX - 0.6), tey - 3.0 - r * 0.2, z + (rand() - 0.5) * 2], [0, 0, 0], [0.9, 0.95, 1.25]),
          );
        }
        for (let i = 0; i < 3; i++) {
          const f = 0.2 + i * 0.26;
          const x = sx * lerp(tex - 1, 6, f);
          const y = lerp(tey - 0.4, topRidge - 5, f);
          const r = 1.7 + rand() * 0.7;
          lumps.push(tf(lumpySphere(r, 0.06, 3.2, 7, 5, i * sx), [x, y - 0.6, roofLen / 2 - 1.6], [0, 0, 0], [1.1, 0.95, 0.8]));
        }
      }
      g.snowLumps = merge(lumps);
      g.roofInfo = { slope, ridge, over, eaveY, topRidge, sRidge, tex, tey, snowT, cosA };
    }

    /* chimney on the right slope (visible side) */
    {
      const { x, z } = POST.chimney;
      const { topRidge, slope, snowT, cosA } = g.roofInfo;
      const top = topRidge - Math.abs(x) * slope + snowT / cosA + 8; // chimney body top, ~8 above the snow
      g.chimney = merge([tf(roundedBox(9, 22, 9, 2.0, 1), [x, top - 11, z]), tf(roundedBox(11.6, 3.4, 11.6, 1.4, 1), [x, top + 0.4, z])]);
      g.soot = tf(roundedBox(7.2, 1.2, 7.2, 0.5, 1), [x, top + 1.6, z]);
      g.chimneyTop = new THREE.Vector3(x, top + 3.5, z);
    }

    /* the sign: big gift on the ridge (sign-local, origin at the gift's bottom centre) */
    {
      const gift = giftGeos(24, 18.5, 21, { r: 4, band: 5, lift: 0.8, bow: 1.25, seg: 2, ribbonSeg: 2, bowSeg: 14 });
      g.signBody = gift.body;
      g.signRibbon = gift.ribbon;
      g.signPos = new THREE.Vector3(0, g.roofInfo.sRidge - 3.2, POST.signZ);
    }

    /* door (arch) + frame + knob + step + wreath, centred on the facade */
    {
      const fz = hd;
      g.doorFrame = tf(extrude(archFramePath(20, 27.5, 15.6, 25.2), 2.4, 0.8, { curveSegments: 6, bevelSegments: 2 }), [0, POST.base + 0.6, fz + 0.4]);
      g.door = tf(extrude(archPath(15.9, 25.3), 1.8, 0.7, { curveSegments: 8, bevelSegments: 2 }), [0, POST.base + 0.5, fz + 0.2]);
      g.knob = tf(sphere(1.25, 8, 6), [4.6, 12.5, fz + 1.4]);
      g.step = tf(roundedBox(23, 3, 6.5, 1.3, 1), [0, 3.3, fz + 3.3]);
      g.wreath = tf(new THREE.TorusGeometry(2.8, 1.05, 6, 16), [0, 32, fz + 0.9]);
      g.wreathBow = merge([
        ellipsoid([1.05, 0.72, 0.6], [-0.95, 29.6, fz + 1.8], [0, 0, 0.5], 8, 6),
        ellipsoid([1.05, 0.72, 0.6], [0.95, 29.6, fz + 1.8], [0, 0, -0.5], 8, 6),
      ]);
      g.doorPoint = new THREE.Vector3(0, 0, fz + 10);
    }

    /* round gable window + small side window (right wall) */
    {
      const wy = 46;
      const fz = hd;
      g.glass = tf(new THREE.SphereGeometry(7, 16, 6, 0, TAU, 0, Math.PI / 2), [0, wy, fz + 0.1], [Math.PI / 2, 0, 0], [1, 0.24, 1]);
      g.windowFrame = merge([
        tf(new THREE.TorusGeometry(7.4, 1.55, 7, 22), [0, wy, fz + 0.5]),
        tf(roundedBox(14.2, 1.4, 1.3, 0.55, 1), [0, wy, fz + 2.0]),
        tf(roundedBox(1.4, 14.2, 1.3, 0.55, 1), [0, wy, fz + 2.0]),
      ]);
      g.halo = tf(new THREE.PlaneGeometry(36, 36), [0, wy - 1, fz + 0.25]);
    }

    /* fairy lights along the front rake edges */
    {
      const { ridge, over, eaveY } = g.roofInfo;
      const zf = roofLen / 2 - 0.8;
      const pts = [];
      const bulbs = [];
      const at = (f) => [lerp(-over + 1.5, over - 1.5, f), 0];
      const edgeY = (x) => ridge - Math.abs(x) * ((ridge - eaveY) / over) - 1.3;
      const spans = 8;
      for (let i = 0; i < spans; i++) {
        const xa = at(i / spans)[0];
        const xb = at((i + 1) / spans)[0];
        for (let k = 0; k < 5; k++) {
          const f = k / 5;
          const x = lerp(xa, xb, f);
          pts.push([x, lerp(edgeY(xa), edgeY(xb), f) - 2.4 * 4 * f * (1 - f), zf]);
        }
        const x = lerp(xa, xb, 0.5);
        bulbs.push([x, lerp(edgeY(xa), edgeY(xb), 0.5) - 2.4 - 1.5, zf + 0.2]);
      }
      pts.push([at(1)[0], edgeY(at(1)[0]), zf]);
      g.wire = tube(pts, () => 0.32, { tubular: 64, radial: 4, caps: false });
      const byColor = [[], [], [], []];
      bulbs.forEach((p, i) => byColor[i % 4].push(ellipsoid([1.25, 1.65, 1.25], p, [0, 0, 0], 8, 6)));
      g.bulbs = byColor.map((l) => merge(l));
    }

    /* gift stack (group frame): lime + pink on top, white beside */
    {
      const A = giftGeos(13, 11, 13, { r: 2.3, band: 3.1, bow: 1.05, seg: 2, ribbonSeg: 1, bowSeg: 10 });
      const B = giftGeos(9.6, 8.4, 9.6, { r: 1.8, band: 2.4, bow: 1.15, seg: 1, ribbonSeg: 1, bowSeg: 8 });
      const C = giftGeos(8.4, 7.2, 8.4, { r: 1.6, band: 2.1, bow: 1.1, seg: 1, ribbonSeg: 1, bowSeg: 8 });
      const put = (geo, p, ry) => tf(geo, p, [0, ry, 0]);
      const pA = [-44, 2.2, 22];
      const pB = [-43.2, 13.5, 21.4];
      const pC = [-31, 2.5, 34];
      g.stackLime = put(A.body, pA, 0.35);
      g.stackLimeRib = put(A.ribbon, pA, 0.35);
      g.stackPink = put(B.body, pB, -0.3);
      g.stackPinkRib = put(B.ribbon, pB, -0.3);
      g.stackWhite = put(C.body, pC, 0.55);
      g.stackWhiteRib = put(C.ribbon, pC, 0.55);
    }

    /* candy-cane lantern post (group frame) */
    {
      const bx = 41;
      const bz = 30;
      const R = 4.6;
      const pts = [
        [bx, 2, bz],
        [bx, 14, bz],
        [bx, 26, bz],
        [bx, 31, bz],
      ];
      for (let k = 1; k <= 6; k++) {
        const a = (k / 6) * Math.PI;
        pts.push([bx - R + R * Math.cos(a), 31 + R * Math.sin(a), bz]);
      }
      pts.push([bx - 2 * R, 29.2, bz]);
      g.cane = tube(pts, () => 1.6, { tubular: 36, radial: 7, uvPeriod: 7 });
      const lx = bx - 2 * R;
      g.lanternMetal = merge([
        tf(new THREE.TorusGeometry(0.9, 0.3, 5, 10), [lx, 28.3, bz]),
        tf(
          lathe(
            [
              [0.001, 0.4],
              [2.6, 0.3],
              [3.3, 0.6],
              [3.4, 1.4],
              [1.3, 3.3],
              [0.001, 3.8],
            ],
            12,
          ),
          [lx, 23.6, bz],
        ),
        tf(roundedBox(6.8, 1.5, 6.8, 0.6, 1), [lx, 16.4, bz]),
      ]);
      g.lanternGlass = tf(roundedBox(5.6, 6.8, 5.6, 1.4, 1), [lx, 20.3, bz]);
      g.caneSnow = tf(lumpySphere(1, 0.08, 3, 8, 6, 3), [bx - R, 31 + R + 1.3, bz], [0, 0, 0], [3.2, 1.3, 2.4]);
    }

    /* smoke puff (unit size) */
    g.puff = merge([
      sphere(1, 9, 6),
      tf(sphere(0.72, 7, 5), [0.78, 0.22, 0.1]),
      tf(sphere(0.66, 7, 5), [-0.72, 0.12, -0.12]),
    ]);

    g.blob = new THREE.PlaneGeometry(128, 112).rotateX(-Math.PI / 2);
    return g;
  });
}

function postMaterials() {
  return {
    wall: toy("wall", PAL.wall, { roughness: 0.42, clearcoat: 0.75, clearcoatRoughness: 0.18 }),
    roof: toy("roof", PAL.roof, { roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    snow: toy("snow", PAL.snow, {
      roughness: 0.7,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
      sheen: 0.35,
      sheenColor: 0xcfe2ff,
      sheenRoughness: 0.5,
    }),
    trim: toy("trim", PAL.trim, { roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.12 }),
    door: toy("door", PAL.door, { roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.1 }),
    soot: toy("soot", PAL.soot, { roughness: 0.9, clearcoat: 0 }),
    wire: toy("wire", PAL.wire, { roughness: 0.5, clearcoat: 0.3 }),
    wreath: toy("wreath", 0x2f8f4e, { roughness: 0.55, clearcoat: 0.5 }),
    iron: toy("iron", 0x2c3432, { roughness: 0.35, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.08 }),
    cane: toy("cane", 0xffffff, {
      map: stripeTexture("stripe-cane", "#e8283c", "#ffffff", true),
      roughness: 0.3,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    }),
  };
}

/**
 * Gift dispatch post («пункт отправки подарков»).
 * @returns {{ group: THREE.Group, update(dt:number, t?:number):void, pulse():void }}
 * group.userData.hit  – invisible box for taps; group.userData.door – ground point in front of the door (group-local).
 */
export function createDispatchPoint(_THREE) {
  checkThree(_THREE);
  const G = postGeometry();
  const S = sharedMaterials();
  const M = postMaterials();
  const rand = mulberry32(0xd15a7c);

  // per-instance animated materials
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x5c3f14,
    emissive: PAL.glow,
    emissiveIntensity: 1.35,
    roughness: 0.12,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
  });
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0xffb640,
    alphaMap: radialTexture(),
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const lanternMat = new THREE.MeshPhysicalMaterial({
    color: 0x5c3f14,
    emissive: 0xffc24a,
    emissiveIntensity: 1.6,
    roughness: 0.15,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  const bulbMats = [PAL.pink, PAL.lime, PAL.glow, 0x63cfff].map(
    (c) =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(c).multiplyScalar(0.35),
        emissive: c,
        emissiveIntensity: 0.8,
        roughness: 0.2,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      }),
  );

  const group = new THREE.Group();
  group.name = "ny-dispatch-point";
  const root = new THREE.Group(); // uniform scale of the whole post
  root.scale.setScalar(POST.scale);
  group.add(root);

  const blob = mk(G.blob, S.blob, { cast: false });
  blob.position.y = 0.12;
  blob.renderOrder = -1;
  root.add(blob);

  root.add(mk(G.mound, M.snow, { receive: true }), mk(G.moundLumps, M.snow, { receive: true }));

  const body = new THREE.Group();
  body.rotation.y = POST.yaw;
  root.add(body);

  // everything that squashes on pulse(); pivot at the base
  const house = new THREE.Group();
  body.add(house);
  house.add(
    mk(G.walls, M.wall, { receive: true }),
    mk(G.trim, M.trim, { receive: true }),
    mk(G.roof, M.roof, { receive: true }),
    mk(G.snow, M.snow, { receive: true }),
    mk(G.snowLumps, M.snow, { receive: true }),
    mk(G.chimney, M.wall, { receive: true }),
    mk(G.soot, M.soot, { cast: false }),
    mk(G.doorFrame, M.trim, { receive: true }),
    mk(G.door, M.door, { receive: true }),
    mk(G.knob, S.gold, { cast: false }),
    mk(G.step, M.trim, { receive: true }),
    mk(G.wreath, M.wreath, { cast: false }),
    mk(G.wreathBow, S.red, { cast: false }),
    mk(G.glass, glassMat, { cast: false }),
    mk(G.windowFrame, M.trim, { receive: true }),
    mk(G.wire, M.wire, { cast: false }),
    mk(G.halo, haloMat, { cast: false }),
  );
  G.bulbs.forEach((geo, i) => house.add(mk(geo, bulbMats[i], { cast: false })));

  // the sign: big gift on the ridge
  const sign = new THREE.Group();
  sign.position.copy(G.signPos);
  house.add(sign);
  const signBox = new THREE.Group();
  sign.add(signBox);
  signBox.add(mk(G.signBody, S.pink, { receive: true }), mk(G.signRibbon, S.lime));

  // props on the snow (jiggle a beat later)
  const props = new THREE.Group();
  root.add(props);
  props.add(
    mk(G.stackLime, S.lime, { receive: true }),
    mk(G.stackLimeRib, S.pink),
    mk(G.stackPink, S.pink, { receive: true }),
    mk(G.stackPinkRib, S.lime),
    mk(G.stackWhite, S.white, { receive: true }),
    mk(G.stackWhiteRib, S.red),
    mk(G.cane, M.cane),
    mk(G.caneSnow, M.snow, { cast: false }),
    mk(G.lanternMetal, M.iron),
    mk(G.lanternGlass, lanternMat, { cast: false }),
  );

  // chimney smoke (in the group frame)
  const up = new THREE.Vector3(0, 1, 0);
  const chimneyTop = G.chimneyTop.clone().applyAxisAngle(up, POST.yaw);
  const puffs = [];
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: PAL.smoke,
      roughness: 1,
      metalness: 0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const m = mk(G.puff, mat, { cast: false });
    m.visible = false;
    m.renderOrder = 2;
    root.add(m);
    puffs.push({ mesh: m, mat, age: 0, life: 1, size: 1, spin: 0, drift: 0, wob: 0, big: false, alive: false });
  }
  let puffIn = 0.2;
  function spawnPuff(big = false) {
    const p = puffs.find((q) => !q.alive) || puffs.reduce((a, b) => (a.age / a.life > b.age / b.life ? a : b));
    p.alive = true;
    p.age = 0;
    p.life = big ? 2.2 : 2.5 + rand() * 0.6;
    p.size = (big ? 7.5 : 5.2) + rand() * 1.4;
    p.spin = (rand() - 0.5) * 1.2;
    p.drift = 0.6 + rand() * 0.8;
    p.wob = rand() * TAU;
    p.big = big;
    p.mesh.visible = true;
    p.mesh.rotation.set(rand() * TAU, rand() * TAU, 0);
  }

  // hit box + door point
  const hit = hitProxy(new THREE.Box3(new THREE.Vector3(-58, -56, -50), new THREE.Vector3(58, 56, 50)), S.hit);
  hit.position.y = 56;
  root.add(hit);
  group.userData.hit = hit;
  group.userData.door = G.doorPoint.clone().applyAxisAngle(up, POST.yaw).multiplyScalar(POST.scale);
  group.userData.kind = "dispatch-point";

  /* ---------------------------------------------------------- animation */
  let time = 0;
  const sq = { x: 0, v: 0 };
  const pq = { x: 0, v: 0 };
  let signHop = 10;

  function pulse() {
    sq.x = Math.min(sq.x, 0) - 0.12;
    sq.v = 0;
    pq.v -= 1.2;
    signHop = 0;
    spawnPuff(true);
  }

  function update(dt, t) {
    dt = clamp(Number(dt) || 0, 0, 0.1);
    time = typeof t === "number" ? t : time + dt;

    // squash & stretch springs
    let rest = dt;
    while (rest > 1e-6) {
      const h = Math.min(rest, 1 / 120);
      sq.v += (-340 * sq.x - 11 * sq.v) * h;
      sq.x += sq.v * h;
      pq.v += (-260 * pq.x - 9 * pq.v) * h;
      pq.x += pq.v * h;
      rest -= h;
    }
    house.scale.set(1 - sq.x * 0.5, 1 + sq.x, 1 - sq.x * 0.5);
    props.scale.set(1 - pq.x * 0.35, 1 + pq.x * 0.7, 1 - pq.x * 0.35);

    // the sign gift floats, sways and hops on pulse
    signHop += dt;
    const hopY = signHop < 1.2 ? 7 * Math.abs(Math.sin(signHop * Math.PI * 2.2)) * Math.exp(-signHop * 3.2) : 0;
    signBox.position.y = 1.1 + 1.1 * Math.sin(time * 1.7) + hopY;
    signBox.rotation.set(0.04 * Math.sin(time * 1.1 + 1), 0.16 * Math.sin(time * 0.6), 0.05 * Math.sin(time * 1.3));

    // warm windows + lantern flicker
    const fl = 1 + 0.05 * Math.sin(time * 8.3) + 0.035 * Math.sin(time * 13.7 + 1.3) + 0.025 * Math.sin(time * 23.1 + 0.4);
    glassMat.emissiveIntensity = 1.35 * fl;
    haloMat.opacity = 0.8 * fl;
    lanternMat.emissiveIntensity = 1.6 * (1 + 0.06 * Math.sin(time * 9.1 + 2) + 0.04 * Math.sin(time * 17.3));

    // fairy lights twinkle in turn
    bulbMats.forEach((m, i) => {
      m.emissiveIntensity = 0.7 + 0.9 * Math.pow(0.5 + 0.5 * Math.sin(time * 2.4 - i * 1.57), 2);
    });

    // smoke
    puffIn -= dt;
    if (puffIn <= 0) {
      spawnPuff(false);
      puffIn = 0.62 + rand() * 0.3;
    }
    const lift = 1 + sq.x;
    for (const p of puffs) {
      if (!p.alive) continue;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        p.alive = false;
        p.mesh.visible = false;
        p.mat.opacity = 0;
        continue;
      }
      const rise = 44 * (1 - Math.pow(1 - k, 1.6));
      p.mesh.position.set(
        chimneyTop.x + p.drift * 13 * k + 2.2 * Math.sin(p.wob + p.age * 2.6) * k,
        chimneyTop.y * lift + rise,
        chimneyTop.z - 4 * k,
      );
      const grow = p.size * (0.35 + 0.75 * (1 - Math.pow(1 - Math.min(1, k * 1.6), 2))) * (1 - 0.25 * Math.max(0, k - 0.75) * 4);
      p.mesh.scale.setScalar(grow);
      p.mesh.rotation.y += p.spin * dt;
      p.mat.opacity = (p.big ? 0.92 : 0.82) * Math.min(1, k / 0.12) * (1 - Math.pow(Math.max(0, (k - 0.35) / 0.65), 1.4));
    }
  }

  update(0, 0);
  return { group, update, pulse };
}

/* ===================================================================== */
/*                        STANDALONE UI PROPS                             */
/* ===================================================================== */

function fitToHeight(root, height) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true);
  const k = height / (box.max.y - box.min.y);
  root.scale.multiplyScalar(k);
  root.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  root.updateMatrixWorld(true);
}

/**
 * Chunky glossy gift box with a ribbon and a bow (for hero stickers in UI images).
 * Origin at the centre of its base, ~40 units tall, faces +Z.
 * @returns {{ group: THREE.Group }}
 */
export function createGiftBox(_THREE, { color = "#FF75E1", ribbon = "#96E732" } = {}) {
  checkThree(_THREE);
  const G = memo(GEO, "prop:gift", () => {
    const w = 34;
    const h = 27;
    const d = 32;
    const gift = giftGeos(w, h, d, {
      r: 6,
      band: 7.2,
      lift: 1.0,
      bow: 1.1,
      bowFat: 0.46,
      bowTube: 10,
      bowSeg: 22,
      bowLean: 0.9,
      bowTwist: 0.5,
      bowSpread: 1.0,
      bowLift: 0.42,
      knot: 0.62,
      seg: 4,
      ribbonSeg: 3,
    });
    // two ribbon tails from the knot, splayed over the top towards the front corners
    const tails = [-1, 1].map((sd) =>
      tf(roundedBox(4.4, 1.1, 11, [2.0, 0.5, 2.0], 2), [sd * 4.6, h + 1.3, 4.6], [0.1, sd * 0.85, 0]),
    );
    return { body: gift.body, ribbon: merge([gift.ribbon, ...tails]) };
  });
  const bodyHex = hex(color);
  const ribbonHex = hex(ribbon);
  const bodyMat = toy(`gift:${bodyHex}`, bodyHex, { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
  const ribbonMat = toy(`gift:${ribbonHex}`, ribbonHex, { roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05 });
  const group = new THREE.Group();
  group.name = "ny-gift-box";
  const root = new THREE.Group();
  root.add(mk(G.body, bodyMat), mk(G.ribbon, ribbonMat));
  group.add(root);
  fitToHeight(root, 40);
  return { group };
}

/**
 * The elf's gift sack as a standalone prop: tied with the gold rope, a small gift peeking out.
 * Origin at the centre of its base, ~44 units tall; the rope bow faces +Z.
 * @returns {{ group: THREE.Group }}
 */
export function createSack(_THREE, { color } = {}) {
  checkThree(_THREE);
  const G = sackGeometry("hi");
  const S = sharedMaterials();
  const group = new THREE.Group();
  group.name = "ny-sack";
  const root = new THREE.Group();
  const turn = new THREE.Group();
  turn.rotation.y = Math.PI; // bow towards the viewer
  turn.add(mk(G.sack, sackMaterial(color)), mk(G.rope, S.gold));
  const gift = new THREE.Group();
  gift.position.fromArray(G.giftPos);
  gift.rotation.fromArray(G.giftRot);
  gift.add(mk(G.giftBody, S.pink), mk(G.giftRibbon, S.lime));
  turn.add(gift);
  root.add(turn);
  group.add(root);
  fitToHeight(root, 44);
  return { group };
}

/* ===================================================================== */
/*                                  INFO                                  */
/* ===================================================================== */

export const MODEL_INFO = {
  // measured in the preview: camera as in the header, 390×844 @ DPR 2, alpha bounding box, CSS px at 1×
  elfScreenHeight: 43, // walking/idle front, side, 3/4: 40–45; walking straight away: 33; top of a celebration hop: 47
  elfScreenWidth: 26,
  dispatchScreenWidth: 112,
  dispatchScreenHeight: 116, // without smoke
  triangles: { elf: 5082, dispatchPoint: 13704, giftBox: 3664, sack: 3644 }, // dispatch point incl. all 6 smoke puffs
  meshes: { elf: 26, dispatchPoint: 42, giftBox: 2, sack: 4 }, // draw calls (shadow casters: elf 18, post 22)
  walkSpeed: { pace1: 27, pace2: 62 }, // px/s at which the feet do not slide (≈ 27 · pace^1.2)
  elfPresets: [
    {},
    { hatColor: 0xff75e1, tunicColor: 0x2fae6a, sackColor: 0xb8783e },
    { hatColor: 0x3f7bff, tunicColor: 0x3fbf5b, sackColor: 0xd9343f },
    { hatColor: 0xe8283c, tunicColor: 0x96e732, sackColor: 0xb8783e },
  ],
  notes: [
    "Units: 1 world unit = 1 CSS px at 1×; ground y = 0; every model's origin is the centre of its footprint; models face +Z.",
    "Elf heading: setHeading(h) → rotation.y = π/2 − h, so h = Math.atan2(dz, dx) of the movement (0 → screen right, π/2 → screen down). The first call snaps, later calls ease (~0.25 s); setHeading(h, true) snaps.",
    "elf.update(dt, { walking, pace, celebrate }) every frame; celebrate wins over walking; pace scales the step rate (1 cycle = 2 steps per second at pace 1).",
    "post.update(dt, t) every frame (t = total seconds, optional); post.pulse() when an elf leaves. group.userData.door = ground point in front of the door (group-local) to spawn elves from.",
    "Picking: raycast group.userData.hit – an invisible proxy with an analytic sphere (elf, r 30) / box (post) raycast and an empty geometry, so Box3.setFromObject(group) measures only the visible model (plus the flat contact-shadow blob at the feet). All visual meshes have raycast disabled.",
    "createLighting(THREE, renderer, scene) sets renderer.shadowMap (PCFShadowMap + radius: r186 removed PCFSoftShadowMap and warns if it is used), NeutralToneMapping (exposure 0.9), sRGB output and scene.environment (procedural PMREM, one per renderer). Call lighting.update(cx, cz) with the ground point under the screen centre after panning; the shadow box is 600 × 1200 around it and snaps to texels.",
    "Put createShadowCatcher(THREE, 4000) in each scene: a ShadowMaterial plane (opacity 0.22) that only shows shadows. Models also carry a soft contact blob of their own.",
    "Geometries, materials and textures are shared module-wide (also across renderers); do not dispose them per instance. Animated materials (window, lantern, fairy lights, smoke) are per dispatch post.",
    "createGiftBox / createSack are standalone props for UI renders (40 and 44 units tall, origin at the base centre, facing +Z).",
  ],
};
