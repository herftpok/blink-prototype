// Ансамбль парка вокруг главной оси: вход – партер – фонтан. Координаты объектов –
// из OpenStreetMap (art/scene-data.js), единица модели = пункт карты ≈ 1.4 м.
// X и Z сцены совпадают с осями подложки, начало координат – центр колоннады.
import * as THREE from 'three';
import { createColonnade } from './colonnade.js';
import { parkSceneData as data } from './art/scene-data.js';

export const ENTRANCE_SCALE = 1.3;   // достопримечательность читается крупнее реального масштаба
const FACADE = -Math.atan2(21.61, 38.69);   // ось реального фасада на подложке OSM

// Детерминированный шум по координате: одно и то же дерево всегда одинаковое.
function noise(x, y, salt = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function glossy(color, roughness = .45, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, ...extra });
}

// Накопитель инстансов: одна геометрия и один материал – один вызов отрисовки.
function batcher() {
  const lists = new Map();
  const part = new THREE.Object3D();
  const tint = new THREE.Color();
  return {
    add(geometry, material, position, scale = [1, 1, 1], rotation = [0, 0, 0], color = null) {
      let byMaterial = lists.get(geometry);
      if (!byMaterial) lists.set(geometry, byMaterial = new Map());
      let items = byMaterial.get(material);
      if (!items) byMaterial.set(material, items = []);
      part.position.set(...position);
      part.scale.set(...scale);
      part.rotation.set(...rotation);
      part.updateMatrix();
      items.push([part.matrix.clone(), color]);
    },
    build(group, { shadow = true } = {}) {
      for (const [geometry, byMaterial] of lists) {
        for (const [material, items] of byMaterial) {
          const mesh = new THREE.InstancedMesh(geometry, material, items.length);
          items.forEach(([matrix, color], i) => {
            mesh.setMatrixAt(i, matrix);
            if (color != null) mesh.setColorAt(i, tint.set(color));
          });
          mesh.castShadow = shadow;
          mesh.receiveShadow = true;
          group.add(mesh);
        }
      }
    }
  };
}

function flatShape(points) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], i) => shape[i ? 'lineTo' : 'moveTo'](x, -z));
  shape.closePath();
  return shape;
}

// Плоский контур на земле → объём высотой height (после поворота Y контура смотрит в −Z).
function slab(points, height, bevel = 0) {
  const geometry = new THREE.ExtrudeGeometry(flatShape(points), bevel
    ? { depth: height - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3 }
    : { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  if (bevel) geometry.translate(0, bevel, 0);
  return geometry;
}

function roundedRect(u0, u1, v0, v1, radius, steps = 10) {
  const points = [];
  const corner = (cx, cy, from) => {
    for (let i = 0; i <= steps; i++) {
      const a = from + i / steps * Math.PI / 2;
      points.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
    }
  };
  corner(u1 - radius, v1 - radius, 0);
  corner(u0 + radius, v1 - radius, Math.PI / 2);
  corner(u0 + radius, v0 + radius, Math.PI);
  corner(u1 - radius, v0 + radius, Math.PI * 1.5);
  return points;
}

function createFountain(radius) {
  const group = new THREE.Group();
  group.name = 'фонтан';
  const stone = glossy(0xefe4cf, .6);
  const water = new THREE.MeshPhysicalMaterial({ color: 0x4fc3ee, roughness: .06, metalness: 0, clearcoat: 1, clearcoatRoughness: .08 });
  const foam = glossy(0xf4fcff, .25, { emissive: 0x9fdcff, emissiveIntensity: .25 });
  const rim = new THREE.LatheGeometry([[radius - 3, 0], [radius, 0], [radius + .2, 1.5], [radius - .3, 2.1],
    [radius - 2.5, 2.1], [radius - 3, 1.4]].map(([r, y]) => new THREE.Vector2(r, y)), 56);
  const basin = new THREE.Mesh(rim, stone);
  const pool = new THREE.Mesh(new THREE.CylinderGeometry(radius - 2.8, radius - 2.8, .3, 56), water);
  pool.position.y = 1.35;
  const tier = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [4.6, 0], [4.6, 1.9], [3.2, 2.5], [2.2, 4.4], [5.4, 5.6],
    [5.6, 6.2], [0, 6.2]].map(([r, y]) => new THREE.Vector2(r, y)), 32), stone);
  tier.position.y = 1.2;
  for (const mesh of [basin, pool, tier]) { mesh.castShadow = mesh !== pool; mesh.receiveShadow = true; group.add(mesh); }
  // Пена там, куда падают струи.
  const splash = new THREE.Mesh(new THREE.TorusGeometry(radius * .3, 1.5, 6, 40), foam);
  splash.rotation.x = Math.PI / 2;
  splash.scale.z = .25;
  splash.position.y = 1.55;
  group.add(splash);

  const jets = [];
  const outer = 26, inner = 12;
  for (let i = 0; i < outer; i++) {
    const a = i / outer * Math.PI * 2;
    jets.push({ x: Math.cos(a) * radius * .8, z: Math.sin(a) * radius * .8, dx: -Math.cos(a), dz: -Math.sin(a),
      reach: radius * .5, height: 15, phase: i / outer, drops: 8, size: .78, wave: a });
  }
  for (let i = 0; i < inner; i++) {
    const a = (i + .5) / inner * Math.PI * 2;
    jets.push({ x: Math.cos(a) * 3.4, z: Math.sin(a) * 3.4, dx: Math.cos(a), dz: Math.sin(a),
      reach: radius * .2, height: 12, phase: i / inner, drops: 6, size: .7, wave: a + 1.6, base: 7.4 });
  }
  jets.push({ x: 0, z: 0, dx: 1, dz: 0, reach: 0, height: 27, phase: 0, drops: 14, size: 1.05, wave: 0, base: 7.4, column: true });
  const count = jets.reduce((n, jet) => n + jet.drops, 0);
  const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), foam, count);
  drops.frustumCulled = false;
  group.add(drops);
  const part = new THREE.Object3D();
  function update(time) {
    let index = 0;
    for (const jet of jets) {
      // Музыкальный фонтан: высота идёт волной по кругу.
      const power = .72 + .28 * Math.sin(time * .9 + jet.wave * 2);
      for (let i = 0; i < jet.drops; i++) {
        const s = (time * .42 + jet.phase + i / jet.drops) % 1;
        const base = jet.base ?? 1.5;
        if (jet.column) {
          // Центральный столб: вверх по оси, вниз – раскрываясь зонтом.
          const spread = Math.max(0, s - .5) * 2, angle = i * 2.4;
          part.position.set(Math.cos(angle) * spread * 4.5, base + jet.height * power * Math.sin(Math.PI * Math.min(s, .5 + spread / 2)),
            Math.sin(angle) * spread * 4.5);
        } else {
          part.position.set(jet.x + jet.dx * jet.reach * s, base + 4 * jet.height * power * s * (1 - s), jet.z + jet.dz * jet.reach * s);
        }
        const size = jet.size * (.55 + .6 * Math.sin(Math.PI * s));
        part.scale.set(size, size * 1.25, size);
        part.updateMatrix();
        drops.setMatrixAt(index++, part.matrix);
      }
    }
    drops.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { group, update };
}

function createObservatory() {
  const group = new THREE.Group();
  group.name = 'Народная обсерватория';
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.9, 5, 28), glossy(0xf1e6d2, .6));
  wall.position.y = 2.5;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3.75, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), glossy(0xb9c8cf, .28, { metalness: .55 }));
  dome.position.y = 5;
  const slit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 3.4, 4.2), glossy(0x4d5a63, .5));
  slit.position.set(0, 6.6, 1.5);
  slit.rotation.x = -.62;
  for (const mesh of [wall, dome, slit]) { mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); }
  return group;
}

function createGazebo() {
  const group = new THREE.Group();
  group.name = 'Ажурная беседка';
  const white = glossy(0xfbf7ee, .4);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.6, .7, 24), white);
  floor.position.y = .35;
  const roof = new THREE.Mesh(new THREE.SphereGeometry(4.5, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), glossy(0x8fb39b, .35, { metalness: .2 }));
  roof.scale.y = .62;
  roof.position.y = 5.2;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, .5, 24), white);
  ring.position.y = 5.05;
  group.add(floor, roof, ring);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(.3, .34, 4.4, 10), white);
    column.position.set(Math.cos(a) * 3.8, 2.9, Math.sin(a) * 3.8);
    group.add(column);
  }
  group.traverse(mesh => { if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; } });
  return group;
}

function createMemorial() {
  const group = new THREE.Group();
  group.name = 'памятник Горькому';
  const granite = glossy(0x9c8f8a, .5), bronze = glossy(0x5d5346, .38, { metalness: .6 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.4, 3.4), granite);
  base.position.y = 2.2;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(1.05, 3.4, 4, 12), bronze);
  body.position.y = 7.1;
  const head = new THREE.Mesh(new THREE.SphereGeometry(.82, 14, 10), bronze);
  head.position.y = 10.2;
  for (const mesh of [base, body, head]) { mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); }
  return group;
}

function createBoats(pier) {
  const group = new THREE.Group();
  group.name = 'прокат лодок';
  const wood = glossy(0xc9a57b, .7);
  const deck = new THREE.Mesh(slab(pier, .8), wood);
  deck.castShadow = deck.receiveShadow = true;
  group.add(deck);
  const tip = pier[2];                       // конец причала, который стоит в воде
  const hull = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const seat = new THREE.BoxGeometry(1, 1, 1);
  const colors = [0xff6f61, 0xffd34d, 0xffffff, 0x58b7ff, 0xff8fd8];
  const boats = [[9, -6, .5], [15, 4, -.4], [7, 9, 1.2], [20, -7, 2.3], [24, 9, .2]].map(([dx, dz, turn], i) => {
    const boat = new THREE.Group();
    const shell = new THREE.Mesh(hull, glossy(colors[i], .3));
    shell.scale.set(3.3, 1.5, 1.45);
    shell.position.y = 1.5;
    const bench = new THREE.Mesh(seat, wood);
    bench.scale.set(.5, .22, 2.3);
    bench.position.y = 1.35;
    boat.add(shell, bench);
    boat.position.set(tip[0] + dx, .1, tip[1] + dz);
    boat.rotation.y = turn;
    boat.userData = { turn, phase: i * 1.7 };
    boat.traverse(mesh => { if (mesh.isMesh) mesh.castShadow = true; });
    group.add(boat);
    return boat;
  });
  function update(time) {
    for (const boat of boats) {
      const { turn, phase } = boat.userData;
      boat.position.y = .1 + Math.sin(time * 1.3 + phase) * .22;
      boat.rotation.z = Math.sin(time * 1.1 + phase) * .07;
      boat.rotation.y = turn + Math.sin(time * .35 + phase) * .18;
    }
  }
  return { group, update };
}

// Звезда игры «лови звезду»: пухлая, жемчужно-белая, без лица.
export function createStar() {
  const group = new THREE.Group();
  group.name = 'звезда';
  // Подушка без единой грани: сфера, растянутая по контуру звезды. Контур скруглён, как у звезды
  // в логотипе blink, а толщина плавно сходит к краю – звезда выпуклая со всех сторон.
  const geometry = new THREE.SphereGeometry(1, 120, 48);
  geometry.rotateX(Math.PI / 2);                   // полюса – на оси Z: лицо и спина звезды
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i);
    const a = Math.atan2(y, x) - Math.PI / 2;
    const star = .78 + .19 * Math.cos(5 * a) + .03 * Math.cos(10 * a);
    // К середине лица и спины контур плавно становится кругом: лучи не сходятся в пик по центру.
    const edge = Math.min(1, Math.hypot(x, y)), t = Math.min(1, Math.max(0, (edge - .35) / .6));
    const r = .78 + (star - .78) * t * t * (3 - 2 * t);
    position.setXYZ(i, x * r, y * r, position.getZ(i) * .4);
  }
  geometry.computeVertexNormals();
  const pearl = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .22, clearcoat: 1, clearcoatRoughness: .12,
    iridescence: .35, iridescenceIOR: 1.35, sheen: .4, sheenColor: new THREE.Color(0xff9fe6), sheenRoughness: .4 });
  const body = new THREE.Mesh(geometry, pearl);
  body.castShadow = true;
  group.add(body);
  return group;
}

/**
 * @param {{venue:[number,number], diorama?:boolean}} options  diorama – остров для шапки страницы места:
 *   своё основание, аллея и только то, что стоит на оси. На карте основание – сама подложка.
 */
export function createParkEnsemble({ venue, diorama = false }) {
  const root = new THREE.Group();
  root.name = 'Парк Горького';
  const raw = ([x, y]) => [x - venue[0], y - venue[1]];
  const realFountain = raw(data.fountain.at);
  const realLength = Math.hypot(...realFountain);
  const axis = [realFountain[0] / realLength, realFountain[1] / realLength];
  // Координаты вдоль оси (u) и поперёк (v): по ним вырезается остров.
  const along = ([x, z]) => [x * axis[0] + z * axis[1], x * axis[1] - z * axis[0]];
  // Остров – наклейка парка, а не карта: аллея сжата вдвое, чтобы вход и фонтан были крупными.
  const squeeze = diorama ? .52 : 1;
  const local = at => {
    const [u, v] = along(raw(at));
    const near = u > 0 ? u * squeeze : u;
    return [near * axis[0] + v * axis[1], near * axis[1] - v * axis[0]];
  };
  const fountainAt = local(data.fountain.at);
  const axisLength = realLength * squeeze;
  const island = { u0: -92, u1: axisLength + 50, v: 80, radius: 46 };   // сзади помещаются крылья входа
  const onIsland = point => {
    const [u, v] = along(point);
    const du = Math.max(island.u0 + island.radius - u, 0, u - (island.u1 - island.radius));
    const dv = Math.max(Math.abs(v) - (island.v - island.radius), 0);
    return Math.hypot(du, dv) < island.radius - 5;
  };
  const keep = point => !diorama || onIsland(point);

  const entrance = new THREE.Group();
  entrance.name = 'главный вход';
  const colonnade = createColonnade();
  entrance.add(colonnade);
  const entranceScale = diorama ? 1.55 : ENTRANCE_SCALE;
  entrance.scale.setScalar(entranceScale);
  entrance.rotation.y = FACADE;
  root.add(entrance);

  const fountain = createFountain(data.fountain.radius);
  fountain.group.position.set(fountainAt[0], 0, fountainAt[1]);
  root.add(fountain.group);

  const targets = [entrance, fountain.group];
  const animated = [fountain];
  const place = (object, at) => {
    const [x, z] = local(at);
    if (!keep([x, z])) return;
    object.position.set(x, 0, z);
    root.add(object);
    targets.push(object);
  };
  place(createObservatory(), data.observatory);
  place(createMemorial(), data.memorial);
  if (!diorama) {
    place(createGazebo(), data.gazebo);
    const boats = createBoats(data.pier.map(local));
    root.add(boats.group);
    animated.push(boats);
  }

  // Деревья: узлы и ряды из OSM. Крона – два глянцевых шара, как игрушка.
  const batch = batcher();
  const crown = new THREE.SphereGeometry(1, 10, 7);
  const trunk = new THREE.CylinderGeometry(.34, .5, 1, 7);
  const leaves = glossy(0xffffff, .42), bark = glossy(0x8b684c, .8);
  const greens = [0x58b548, 0x6fc24c, 0x86cf52, 0x4aa653, 0x7cc95a];
  const half = [22.5 * entranceScale + 3, 6.4 * entranceScale + 3];
  const facade = [Math.cos(FACADE), -Math.sin(FACADE)];
  const seen = [];
  for (const at of [...data.trees, ...data.rows]) {
    const [x, z] = local(at);
    if (!keep([x, z])) continue;
    const fx = x * facade[0] + z * facade[1], fz = -x * facade[1] + z * facade[0];
    if (Math.abs(fx) < half[0] && Math.abs(fz) < half[1]) continue;                       // под колоннадой
    if (fz < half[1] && Math.hypot(fx, fz + 33 * entranceScale) < 45 * entranceScale) continue;   // площадь в крыльях
    if (Math.hypot(x - fountainAt[0], z - fountainAt[1]) < data.fountain.radius + 2) continue;
    if (seen.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 3.2)) continue;               // узел и ряд совпали
    seen.push([x, z]);
    const grow = diorama ? 1 : .78;                      // на карте кроны мельче: дорожки остаются видны
    const size = (3.1 + noise(at[0], at[1]) * 1.9) * grow, height = (4.2 + noise(at[0], at[1], 1) * 2.6) * grow;
    const color = greens[Math.floor(noise(at[0], at[1], 2) * greens.length)];
    batch.add(trunk, bark, [x, height / 2, z], [1, height, 1]);
    batch.add(crown, leaves, [x, height + size * .62, z], [size, size * .92, size], [0, noise(at[0], at[1], 3) * 6, 0], color);
    const lean = noise(at[0], at[1], 4) * Math.PI * 2;
    batch.add(crown, leaves, [x + Math.cos(lean) * size * .55, height + size * 1.18, z + Math.sin(lean) * size * .55],
      [size * .62, size * .6, size * .62], [0, 0, 0], color);
  }
  batch.build(root);

  // Клумбы партера по контурам OSM: зелёная подушка и цветы россыпью, у каждой клумбы своя пара цветов.
  const petals = [[0xff7fd6, 0xffffff], [0xff5d5d, 0xffc94a], [0xffc94a, 0xffffff], [0xff9a4d, 0xff7fd6], [0xffffff, 0xff5d5d]];
  const flowers = batcher();
  const bloom = new THREE.SphereGeometry(1, 6, 4);
  const petal = glossy(0xffffff, .5);
  const within = (x, z, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [ax, az] = polygon[i], [bx, bz] = polygon[j];
      if ((az > z) !== (bz > z) && x < ax + (z - az) * (bx - ax) / (bz - az)) inside = !inside;
    }
    return inside;
  };
  data.beds.forEach((bed, i) => {
    const points = bed.map(local);
    if (!points.every(keep)) return;
    const cushion = new THREE.Mesh(slab(points, .7, .25), glossy(0x7cc65a, .6));
    cushion.receiveShadow = true;
    root.add(cushion);
    const xs = points.map(p => p[0]), zs = points.map(p => p[1]);
    const pair = petals[i % petals.length];
    for (let x = Math.min(...xs) + .9; x < Math.max(...xs); x += 2.1) {
      for (let z = Math.min(...zs) + .9; z < Math.max(...zs); z += 2.1) {
        const fx = x + (noise(x, z, 5) - .5) * 1.3, fz = z + (noise(x, z, 6) - .5) * 1.3;
        if (!within(fx, fz, points)) continue;
        const size = .62 + noise(x, z, 7) * .38;
        flowers.add(bloom, petal, [fx, .75 + size * .5, fz], [size, size * .8, size], [0, 0, 0], pair[noise(x, z, 8) > .38 ? 0 : 1]);
      }
    }
  });
  flowers.build(root, { shadow: false });

  if (diorama) {
    // Остров: газон на светлом основании, аллея от входа к фонтану и площадь вокруг чаши.
    const base = new THREE.Group();
    base.rotation.y = Math.atan2(-axis[1], axis[0]);
    const { u0, u1, v, radius } = island;
    const lawn = new THREE.Mesh(slab(roundedRect(u0, u1, -v, v, radius), 4.5, 1.1), glossy(0xa6dc7c, .55));
    lawn.position.y = -4.5;
    const plinth = new THREE.Mesh(slab(roundedRect(u0 - 5, u1 + 5, -v - 5, v + 5, radius + 5), 5, 1.4), glossy(0xf2ead9, .5));
    plinth.position.y = -8.6;
    const paving = glossy(0xf6efdf, .7);
    const alley = new THREE.Mesh(slab(roundedRect(0, axisLength, -13, 13, 6), .22), paving);
    const forecourt = new THREE.Mesh(slab(roundedRect(-84, 22, -62, 62, 30), .2), paving);
    const circle = [];
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * Math.PI * 2;
      circle.push([axisLength + Math.cos(a) * (data.fountain.radius + 13), Math.sin(a) * (data.fountain.radius + 13)]);
    }
    const ring = new THREE.Mesh(slab(circle, .24), paving);
    for (const mesh of [lawn, plinth, alley, forecourt, ring]) { mesh.receiveShadow = true; base.add(mesh); }
    lawn.castShadow = plinth.castShadow = true;
    root.add(base);
  }

  return {
    group: root,
    entrance,
    targets,
    centre: [fountainAt[0] / 2, fountainAt[1] / 2],
    axis,
    axisLength,
    update(time) { for (const part of animated) part.update(time); }
  };
}
