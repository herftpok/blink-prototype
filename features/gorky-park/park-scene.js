import * as THREE from 'three';
import { createLighting, createShadowCatcher } from '../new-year/ny-models.js';
import { createParkEnsemble, createStar } from './ensemble.js';

export function createParkScene(canvas, context, venue) {
  const renderer=new THREE.WebGLRenderer({canvas,context,alpha:true,antialias:true,powerPreference:'low-power'});
  renderer.setClearColor(0x000000,0);
  const scene=new THREE.Scene();
  const rig=createLighting(THREE,renderer,scene);
  const ensemble=createParkEnsemble({venue});
  const shadow=rig.key.shadow;
  // Новогодний свет, область тени – весь ансамбль от входа до фонтана и пруда.
  shadow.camera.left=-275; shadow.camera.right=275;
  shadow.camera.top=275; shadow.camera.bottom=-275;
  shadow.camera.updateProjectionMatrix();
  shadow.mapSize.set(2048,2048);
  shadow.normalBias=.05;
  shadow.radius=2.5;
  rig.update(...ensemble.centre);
  scene.add(createShadowCatcher(THREE,900));
  scene.add(ensemble.group);
  ensemble.group.updateMatrixWorld(true);
  // Кнопка входа на карте – сама колоннада без крыльев: её центр всегда попадает в здание.
  const bounds=new THREE.Box3(new THREE.Vector3(-22.6,0,-6.5),new THREE.Vector3(22.6,21,6.5));
  const corners=[];
  for (const x of [bounds.min.x,bounds.max.x])
    for (const y of [bounds.min.y,bounds.max.y])
      for (const z of [bounds.min.z,bounds.max.z]) corners.push(new THREE.Vector3(x,y,z));

  // Звезда игры: падает в точку парка и вращается над землёй, пока её не забрали. На экране она
  // размером с пин при любом масштабе карты.
  const STAR=11;                                 // полуширина модели 1.2 → около 26 pt на экране
  const star=createStar();
  star.visible=false;
  scene.add(star);
  let drop=null;

  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,8000);
  const elevation=THREE.MathUtils.degToRad(36);
  const sin=Math.sin(elevation),cos=Math.cos(elevation);
  const raycaster=new THREE.Raycaster();
  let width=0,height=0,dpr=0;
  let newShadow=true,lastZoom=null;
  const screenBounds=new THREE.Box2(), projected=new THREE.Vector3(), pixel=new THREE.Vector2();

  function animateStar(time,zoom) {
    if(!drop) return;
    const age=time-drop.since, size=STAR/zoom, lift=size*1.5;
    const [x,z]=[drop.at[0]-venue[0],drop.at[1]-venue[1]];
    star.scale.setScalar(size);
    star.rotation.set(0,time*2.1,0);              // полный оборот за три секунды
    if(drop.mode==='falling') {
      const t=Math.min(1,age/drop.duration), ease=t*t;
      star.position.set(x+(1-ease)*70,lift+(1-ease)*260,z-(1-ease)*40);
      if(t>=1) { drop.mode='landed'; drop.since=time; drop.onLand?.(); }
    } else if(drop.mode==='landed') {
      star.position.set(x,lift,z);
    } else {
      const t=Math.min(1,age/.45);
      star.position.set(x,lift+t*26,z);
      star.scale.setScalar(size*(1-t*t));
      if(t>=1) { star.visible=false; drop=null; }
    }
  }

  // Экранная земля и SVG-карта имеют одну матрицу. Сжатие по вертикали
  // компенсируется ортографической камерой; высота колонн остаётся объёмной.
  function render(view,time=0) {
    const density=Math.min(window.devicePixelRatio||1,2);
    const resized=width!==view.width || height!==view.height || dpr!==density;
    if(resized) {
      width=view.width; height=view.height; dpr=density;
      renderer.setPixelRatio(dpr);
      renderer.setSize(width,height,false);
    }
    const {bearing,zoom}=view;
    if(resized || lastZoom!==zoom) {
      camera.left=-width/(2*zoom); camera.right=-camera.left;
      camera.top=height*sin/(2*zoom); camera.bottom=-camera.top;
      camera.updateProjectionMatrix();
    }
    const cx=view.x-venue[0],cz=view.y-venue[1];
    camera.position.set(cx+1500*cos*Math.sin(bearing),1500*sin,cz+1500*cos*Math.cos(bearing));
    camera.lookAt(cx,0,cz);
    camera.updateMatrixWorld();
    ensemble.update(time);
    animateStar(time,zoom);
    // Солнце закреплено в мире. Тень неподвижных зданий и деревьев переиспользуется;
    // струи фонтана и звезда в карту теней не пишутся повторно.
    renderer.shadowMap.autoUpdate=false;
    if(newShadow) renderer.shadowMap.needsUpdate=true;
    renderer.render(scene,camera);
    lastZoom=zoom; newShadow=false;
    screenBounds.makeEmpty();
    for(const corner of corners) {
      projected.copy(corner).applyMatrix4(ensemble.entrance.children[0].matrixWorld).project(camera);
      screenBounds.expandByPoint(pixel.set((projected.x+1)*width/2,(1-projected.y)*height/2));
    }
    return screenBounds;
  }
  function hit(x,y) {
    raycaster.setFromCamera({x:x/width*2-1,y:1-y/height*2},camera);
    return raycaster.intersectObjects(ensemble.targets,true).length>0;
  }
  return {
    render, hit,
    invalidateShadow() {newShadow=true;},
    // mode: 'falling' → сама станет 'landed'; 'landed' – уже лежит; 'caught' – улетает; null – убрать.
    setStar(at,mode,time=0,onLand=null) {
      if(!at || !mode) { drop=null; star.visible=false; return; }
      if(drop && drop.mode===mode && drop.at[0]===at[0] && drop.at[1]===at[1]) return;
      drop={at,mode,since:time,duration:1.6,onLand};
      star.visible=true;
    }
  };
}
