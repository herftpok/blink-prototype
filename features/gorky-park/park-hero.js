// Главный вход парка для шапки страницы места: статичный кадр того же здания, что на карте.
// Композицию задают параметры: с крыльями или без, с какой стороны и высоты смотреть, насколько крупно.
import * as THREE from 'three';
import { createLighting } from '../new-year/ny-models.js';
import { createColonnade } from './colonnade.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} view
 * @param {boolean} [view.wings]     показывать полукруглые крылья
 * @param {boolean} [view.street]    смотреть со стороны Крымского Вала (крылья раскрыты к зрителю)
 * @param {number}  [view.yaw]       поворот вокруг здания, радианы (0 – анфас)
 * @param {number}  [view.tilt]      высота взгляда, градусы
 * @param {number}  [view.span]      сколько единиц модели помещается в ширину холста
 * @param {number[]} [view.target]   точка, на которую смотрит камера
 */
export function mountHero(canvas, { wings = true, street = false, yaw = .34, tilt = 17, span = 86, target = [0, 11.5, -6] } = {}) {
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power', preserveDrawingBuffer: true });
  if (!context) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const rig = createLighting(THREE, renderer, scene);
  const building = createColonnade({ wings });
  if (street) building.rotation.y = Math.PI;
  scene.add(building);
  const shadow = rig.key.shadow;
  shadow.camera.left = -70; shadow.camera.right = 70;
  shadow.camera.top = 70; shadow.camera.bottom = -70;
  shadow.camera.updateProjectionMatrix();
  shadow.normalBias = .05;
  shadow.radius = 2.5;
  rig.update(0, street ? 20 : -20);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 4000);
  const elevation = THREE.MathUtils.degToRad(tilt);
  const aim = new THREE.Vector3(...target);
  function draw() {
    const box = canvas.getBoundingClientRect();
    const w = Math.round(box.width), h = Math.round(box.height);
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
    renderer.setSize(w, h, false);
    const scale = w / span;
    camera.left = -w / (2 * scale); camera.right = -camera.left;
    camera.top = h / (2 * scale); camera.bottom = -camera.top;
    camera.updateProjectionMatrix();
    const cos = Math.cos(elevation);
    camera.position.set(aim.x + 900 * cos * Math.sin(yaw), aim.y + 900 * Math.sin(elevation), aim.z + 900 * cos * Math.cos(yaw));
    camera.lookAt(aim);
    renderer.render(scene, camera);
    canvas.dataset.ready = 'true';
  }
  canvas.addEventListener('webglcontextrestored', () => requestAnimationFrame(draw));
  new ResizeObserver(() => requestAnimationFrame(draw)).observe(canvas);
  requestAnimationFrame(draw);
  return { draw };
}
