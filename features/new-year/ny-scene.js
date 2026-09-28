/*
 * 3D поверх карты (three.js): пункт отправки подарков и эльфы.
 * Модели – ny-models.js, здесь – сцена, камера и связь с 2D-картой.
 *
 * Карта – картинка-слой, который двигает 2D-камера (camX, camY – сдвиг слоя в px экрана,
 * k – во сколько раз слой крупнее холста 390 pt). 3D-камера ортографическая, наклонена на 50°
 * и едет вместе с 2D-камерой: точка карты (x, y) в pt стоит на экране ровно там же,
 * где и на картинке, а модели видны объёмными – крышей, боками и тенью на асфальте.
 */
import * as THREE from "three";
import {
  createLighting,
  createShadowCatcher,
  createDispatchPoint,
  createElf,
  createGiftBox,
  createSack,
} from "./ny-models.js";

const PITCH = THREE.MathUtils.degToRad(50);
const SIN = Math.sin(PITCH);
const COS = Math.cos(PITCH);

// эльфы разных подарков различимы по цвету колпака и курточки
const ELF_VARIANTS = [
  {},
  { hatColor: "#3FBF5B", tunicColor: "#E8283C" },
  { hatColor: "#FF75E1", tunicColor: "#3FBF5B" },
  { hatColor: "#E8283C", tunicColor: "#2F9FD9" },
];

function makeRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "low-power" });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

/** Невидимые меши для нажатий – у моделей в group.userData.hit */
function hitOf(group) {
  return group.userData.hit || group;
}

/**
 * Сцена карты одного телефона.
 *   const scene = createMapScene(canvas, { dispatch: { x: 176, y: 422 } });
 *   scene.resize(w, h, dpr);  scene.setView(camX, camY, k);
 *   scene.sync([{ id, x, y, heading, walking, running, pace, celebrate, variant, visible }]);
 *   scene.render(dt);  scene.pick(clientX, clientY) → { type: "elf", id } | { type: "dispatch" } | null
 */
export function createMapScene(canvas, { dispatch }) {
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-195, 195, 422, -422, -8000, 8000);
  camera.rotation.x = -PITCH;
  const lighting = createLighting(THREE, renderer, scene) || { update() {} };
  scene.add(createShadowCatcher(THREE, 9000));

  const post = createDispatchPoint(THREE);
  scene.add(post.group);

  const elves = new Map();              // id → { model, state, heading, puffIn }
  const raycaster = new THREE.Raycaster();

  // снег из-под ног бегущего эльфа: облачка появляются за спиной, растут, поднимаются и тают
  const PUFF_EVERY = 0.07;
  const PUFF_LIFE = 0.6;
  const puffGeometry = new THREE.SphereGeometry(1, 10, 8);
  const puffs = Array.from({ length: 36 }, () => {
    // освещённый снег: у облачка есть тень снизу – видно и на светлой карте
    const mesh = new THREE.Mesh(puffGeometry, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, transparent: true, depthWrite: false }));
    mesh.visible = false;
    mesh.userData.age = PUFF_LIFE;
    scene.add(mesh);
    return mesh;
  });
  // снег летит из-под ног в стороны, попеременно влево и вправо: за спиной его закрыл бы сам эльф,
  // когда идёт к зрителю
  function spawnPuff(elf) {
    const puff = puffs.find((p) => p.userData.age >= PUFF_LIFE);
    if (!puff) return;
    const h = elf.heading || 0;
    elf.puffSide = -(elf.puffSide || 1);
    const back = 2 + Math.random() * 4;
    const side = elf.puffSide * (7 + Math.random() * 5);
    const at = elf.model.group.position;
    puff.position.set(
      at.x - Math.cos(h) * back - Math.sin(h) * side,
      1.5,
      at.z + (-Math.sin(h) * back + Math.cos(h) * side) / SIN
    );
    const out = 16 + Math.random() * 10;                       // разлёт в сторону, px/с
    puff.userData.vx = -Math.sin(h) * elf.puffSide * out;
    puff.userData.vz = (Math.cos(h) * elf.puffSide * out) / SIN;
    puff.userData.age = 0;
    puff.userData.size = 2.8 + Math.random() * 1.8;
    puff.visible = true;
  }
  function updatePuffs(dt) {
    for (const puff of puffs) {
      if (puff.userData.age >= PUFF_LIFE) continue;
      puff.userData.age += dt;
      const u = Math.min(1, puff.userData.age / PUFF_LIFE);
      puff.scale.setScalar(puff.userData.size * (1 + 1.8 * u));
      puff.position.x += dt * puff.userData.vx;
      puff.position.z += dt * puff.userData.vz;
      puff.position.y += dt * 9;
      puff.material.opacity = 0.9 * (1 - u) ** 1.5;
      puff.visible = u < 1;
    }
  }
  let W = 390;
  let H = 844;
  let k = 1;
  let t = 0;

  /** точка карты в pt → точка на земле 3D-сцены */
  const place = (object, x, y) => object.position.set(x * k - W / 2, 0, (y * k - H / 2) / SIN);

  let lastSize = "";

  function resize(w, h, dpr) {
    if (!w || !h) return;
    W = w;
    H = h;
    const size = `${w}×${h}@${dpr}`;             // зовут каждый кадр – холст пересоздаём только при смене
    if (size === lastSize) return;
    lastSize = size;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();
  }

  function setView(camX, camY, scale) {
    k = scale;
    camera.position.set(-camX, camY * COS, -camY * SIN);
    camera.updateMatrixWorld();
    place(post.group, dispatch.x, dispatch.y);
    lighting.update(-camX, -camY / SIN);
  }

  function sync(list) {
    const seen = new Set();
    for (const item of list) {
      seen.add(item.id);
      let elf = elves.get(item.id);
      if (!elf) {
        const model = createElf(THREE, ELF_VARIANTS[(item.variant || 0) % ELF_VARIANTS.length]);
        model.group.userData.elfId = item.id;
        hitOf(model.group).userData.elfId = item.id;
        scene.add(model.group);
        elf = { model, state: {} };
        elves.set(item.id, elf);
      }
      place(elf.model.group, item.x, item.y);
      elf.model.setHeading(item.heading || 0);
      elf.model.group.visible = item.visible !== false;
      elf.heading = item.heading || 0;
      elf.state = { walking: Boolean(item.walking), running: Boolean(item.running), pace: item.pace || 1, celebrate: Boolean(item.celebrate) };
    }
    for (const [id, elf] of elves) {
      if (seen.has(id)) continue;
      scene.remove(elf.model.group);
      elves.delete(id);
    }
  }

  function render(dt) {
    t += dt;
    post.update(dt, t);
    for (const elf of elves.values()) {
      elf.model.update(dt, elf.state);
      if (elf.state.running && elf.state.walking && elf.model.group.visible) {
        elf.puffIn = (elf.puffIn ?? 0) - dt;
        if (elf.puffIn <= 0) {
          spawnPuff(elf);
          elf.puffIn = PUFF_EVERY;
        }
      }
    }
    updatePuffs(dt);
    renderer.render(scene, camera);
  }

  /** Что под пальцем: эльф ближе к зрителю важнее пункта отправки */
  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return null;
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const targets = [...[...elves.values()].filter((e) => e.model.group.visible).map((e) => hitOf(e.model.group)), hitOf(post.group)];
    const hits = raycaster.intersectObjects(targets, true);
    let dispatch = false;
    for (const hit of hits) {
      let node = hit.object;
      while (node && node.userData.elfId == null && node !== post.group && node !== hitOf(post.group)) node = node.parent;
      if (!node) continue;
      if (node.userData.elfId != null) return { type: "elf", id: node.userData.elfId };
      dispatch = true;
    }
    return dispatch ? { type: "dispatch" } : null;
  }

  return {
    resize,
    setView,
    sync,
    render,
    pick,
    pulse: () => post.pulse(),
    /** сколько снежных облачков сейчас в воздухе – для проверок */
    puffCount: () => puffs.filter((p) => p.visible).length,
    dispose: () => renderer.dispose(),
  };
}

/**
 * Герой новогодней вкладки маркета: эльф с мешком стоит и дышит, иногда подпрыгивает.
 *   const hero = createHeroScene(canvas);  hero.resize(w, h, dpr);  hero.render(dt);
 */
export function createHeroScene(canvas) {
  const renderer = makeRenderer(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-100, 100, 60, -60, -2000, 2000);
  camera.rotation.x = -THREE.MathUtils.degToRad(14);
  const lighting = createLighting(THREE, renderer, scene) || { update() {} };
  lighting.update(0, 0);
  scene.add(createShadowCatcher(THREE, 600));

  const elf = createElf(THREE, {});
  elf.setHeading(Math.PI / 2 + 0.35);             // стоит почти лицом к зрителю, чуть вполоборота
  scene.add(elf.group);

  const box = new THREE.Box3().setFromObject(elf.group);
  const size = box.getSize(new THREE.Vector3());
  const heroPitch = THREE.MathUtils.degToRad(14);
  let zoomBase = 1;
  let t = 0;
  let hop = 0;

  let lastSize = "";

  function resize(w, h, dpr) {
    if (!w || !h) return;
    const key = `${w}×${h}@${dpr}`;
    if (key === lastSize) return;
    lastSize = key;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    // эльф – на три четверти высоты холста
    zoomBase = (h * 0.8) / Math.max(size.y * Math.cos(heroPitch) + size.z * Math.sin(heroPitch), 1);
    camera.left = -w / 2 / zoomBase;
    camera.right = w / 2 / zoomBase;
    camera.top = h / 2 / zoomBase;
    camera.bottom = -h / 2 / zoomBase;
    camera.position.set(0, size.y * 0.5, 0);
    camera.updateProjectionMatrix();
  }

  function render(dt) {
    t += dt;
    // раз в несколько секунд – радостный прыжок, остальное время дышит и оглядывается
    hop = (t % 5.2) < 1.1;
    elf.update(dt, { walking: false, pace: 1, celebrate: hop });
    renderer.render(scene, camera);
  }

  return { resize, render, dispose: () => renderer.dispose() };
}

/**
 * Картинки подарка, мешка и эльфа для шторок – один раз, тем же рендером, что и карта.
 * → { gift, sack, elf }: data-URL PNG с прозрачным фоном
 */
export function renderProps(size = 240) {
  const canvas = document.createElement("canvas");
  const renderer = makeRenderer(canvas);
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);

  function shot(make, pitch = 22) {
    const scene = new THREE.Scene();
    const lighting = createLighting(THREE, renderer, scene) || { update() {} };
    lighting.update(0, 0);
    const { group } = make();
    scene.add(group);
    const box = new THREE.Box3().setFromObject(group);
    const center = box.getCenter(new THREE.Vector3());
    const ext = box.getSize(new THREE.Vector3());
    const half = Math.max(ext.x, ext.y, ext.z) * 0.62;
    const camera = new THREE.OrthographicCamera(-half, half, half, -half, -2000, 2000);
    camera.rotation.x = -THREE.MathUtils.degToRad(pitch);
    camera.position.copy(center);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    return canvas.toDataURL("image/png");
  }

  // эльф идёт (или бежит) вправо вполоборота к зрителю: кадры для дорожки в шторке эльфа.
  // Сначала разгоняем походку, потом снимаем один цикл шага
  function walkFrames(count = 6, running = false) {
    const scene = new THREE.Scene();
    const lighting = createLighting(THREE, renderer, scene) || { update() {} };
    lighting.update(0, 0);
    const elf = createElf(THREE, {});
    elf.setHeading(0.55);
    elf.update(0.016, { walking: false });
    scene.add(elf.group);
    const box = new THREE.Box3().setFromObject(elf.group);
    const center = box.getCenter(new THREE.Vector3());
    const ext = box.getSize(new THREE.Vector3());
    const half = Math.max(ext.x, ext.y, ext.z) * 0.62;
    const camera = new THREE.OrthographicCamera(-half, half, half, -half, -2000, 2000);
    camera.rotation.x = -THREE.MathUtils.degToRad(14);
    camera.position.copy(center);
    camera.updateProjectionMatrix();
    // рамка – по стоящему эльфу, одна для шага и бега: при смене походки он не меняется в размере
    const gait = { walking: true, pace: 1, running };
    for (let i = 0; i < 40; i += 1) elf.update(0.03, gait);
    const cycle = running ? 1 / (1.15 * 2.1) : 1;        // секунд на цикл шага – как в createElf
    const frames = [];
    for (let i = 0; i < count; i += 1) {
      renderer.render(scene, camera);
      frames.push(canvas.toDataURL("image/png"));
      elf.update(cycle / count, gait);
    }
    return frames;
  }

  const out = {
    elfWalk: walkFrames(6, false),
    elfRun: walkFrames(6, true),
    gift: shot(() => createGiftBox(THREE, {})),
    sack: shot(() => createSack(THREE, {})),
    elf: shot(() => {
      const elf = createElf(THREE, {});
      elf.setHeading(Math.PI / 2 + 0.35);
      elf.update(0.016, { walking: false, pace: 1 });
      return elf;
    }, 14),
  };
  renderer.dispose();
  return out;
}
