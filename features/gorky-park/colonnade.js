// Главный вход, OSM 6913335 (1955, Ю. Щуко и А. Спасов). Одна единица модели соответствует одному
// пункту локальной карты. X – вдоль фасада, Z – в глубину (−Z – Крымский Вал, +Z – парк), Y – высота.
// 24 колонны в четыре ряда, два пилона со ступенчатым завершением, кованые ворота, смотровая
// на крыше и полукруглые крылья-циркумференции 1956 года, которые обнимают площадь перед входом.
import * as THREE from 'three';

export function createColonnade({ wings = true } = {}) {
  const building = new THREE.Group();
  building.name = 'Главный вход Парка Горького';
  const stone = new THREE.MeshStandardMaterial({ color: 0xd3bb99, roughness: .79 });
  const limestone = new THREE.MeshStandardMaterial({ color: 0xe9d2af, roughness: .72 });
  const base = new THREE.MeshStandardMaterial({ color: 0xad9e91, roughness: .88 });
  const recess = new THREE.MeshStandardMaterial({ color: 0xa9937e, roughness: .91 });
  const roof = new THREE.MeshStandardMaterial({ color: 0xa4998b, roughness: .9 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x685d4b, roughness: .67, metalness: .25 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2f33, roughness: .5, metalness: .6 });
  const lamp = new THREE.MeshStandardMaterial({ color: 0xfff4d6, roughness: .2, emissive: 0xffd98a, emissiveIntensity: .9 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x51606b, roughness: .18, metalness: .35 });

  // Общие геометрии и инстансы позволяют нарисовать все капители, балясины
  // и орнаменты за несколько вызовов даже при максимальном приближении.
  const block = new THREE.BoxGeometry();
  const bead = new THREE.SphereGeometry(1, 12, 8);
  const ring = new THREE.TorusGeometry(1, .085, 6, 32);
  const batches = new Map();
  const part = new THREE.Object3D();
  function add(geo, mat, x, y, z, w=1, h=1, d=1, rz=0, ry=0) {
    let materials = batches.get(geo);
    if (!materials) batches.set(geo, materials = new Map());
    let matrices = materials.get(mat);
    if (!matrices) materials.set(mat, matrices = []);
    part.position.set(x,y,z);
    part.rotation.set(0,ry,rz);
    part.scale.set(w,h,d);
    part.updateMatrix();
    matrices.push(part.matrix.clone());
  }
  function slab(mat, x, bottom, z, w, h, d) {
    add(block,mat,x,bottom+h/2,z,w,h,d);
  }
  // Протяжённые каменные тяги имеют скошенную кромку со всех четырёх сторон.
  function moulding(mat, width, depth, bottom, height, bevel) {
    const outline=new THREE.Shape();
    outline.moveTo(-width/2,-depth/2);
    outline.lineTo(width/2,-depth/2);
    outline.lineTo(width/2,depth/2);
    outline.lineTo(-width/2,depth/2);
    outline.closePath();
    const shape=new THREE.ExtrudeGeometry(outline,{
      depth:height-2*bevel,bevelEnabled:true,bevelThickness:bevel,bevelSize:bevel,bevelSegments:2
    });
    shape.rotateX(-Math.PI/2);
    add(shape,mat,0,bottom+bevel,0);
  }
  // Кольца профиля образуют базу, сужающийся ствол и выступающую капитель.
  const profile = [[1.08,0],[1.08,.18],[1.2,.25],[1.2,.42],[1.06,.59],
    [.93,.7],[.9,1.05],[.9,2.6],[.86,6.1],[.77,9.5],[.79,9.62],
    [.89,9.67],[.89,9.82],[.82,9.85],[.88,10.02],[1.07,10.18],[1.16,10.42],[1.16,10.55]];
  const shaft = new THREE.LatheGeometry(profile.map(([r,y]) => new THREE.Vector2(r,y)), 32);
  moulding(base,45,12.8,0,.28,.065);
  slab(base,0,.28,0,44.5,.28,12.12);
  moulding(limestone,44,11.45,.56,.28,.065);

  const columns=[-12.6,-7.56,-2.52,2.52,7.56,12.6];
  for (const x of columns) {
    // Наружные ряды – гранёные пилоны, как на фасаде; за ними два ряда круглых колонн.
    for (const z of [-3.95,3.95]) {
      slab(base,x,.84,z,2.5,.26,2.5);
      slab(limestone,x,1.1,z,1.9,10.55,1.9);
      slab(stone,x,1.1,z+Math.sign(z)*.98,1.1,10.55,.08);
      slab(limestone,x,11.65,z,2.42,.34,2.42);
    }
    for (const z of [-1.32,1.32]) {
      slab(base,x,.84,z,2.2,.26,2.2);
      add(shaft,limestone,x,1.1,z,.82,1,.82);
      slab(limestone,x,11.65,z,2.1,.34,2.1);
    }
  }
  // Кованые ворота между пилонами наружного ряда: решётка, пояс и навершия.
  for (let i=0;i<columns.length-1;i++) {
    const x=(columns[i]+columns[i+1])/2, span=columns[i+1]-columns[i]-2.1;
    if(i===2) continue;                                   // центральный пролёт открыт
    slab(iron,x,.84,-3.95,span,.16,.14);
    slab(iron,x,4.5,-3.95,span,.16,.14);
    for (let k=0;k<7;k++) slab(iron,x-span/2+span*(k+.5)/7,.84,-3.95,.1,4.1,.1);
    add(ring,iron,x,3.2,-3.95,.62,.62,.9);
  }
  // Два фонаря перед входом: чугунная стойка и три матовых шара.
  for (const x of [-5.04,5.04]) {
    slab(base,x,0,-9.2,1.5,.9,1.5);
    slab(iron,x,.9,-9.2,.34,5.2,.34);
    add(bead,lamp,x,6.7,-9.2,.62,.62,.62);
    for (const side of [-1,1]) {
      slab(iron,x+side*.55,5.3,-9.2,1.1,.12,.12);
      add(bead,lamp,x+side*1.1,5.75,-9.2,.46,.46,.46);
    }
  }
  // Торцы – два каменных павильона. Рельеф декорирует и лицевую, и парковую стороны.
  for (const x of [-18.15,18.15]) {
    slab(base,x,.84,0,6.8,.55,10.65);
    slab(stone,x,1.39,0,6.5,10.6,10.25);
    slab(limestone,x,1.39,0,6.63,.32,10.38);
    for (const sign of [-1,1]) {
      const face=sign*5.16;
      for (const side of [-1,1]) {
        slab(limestone,x+side*2.76,1.68,face,.46,9.95,.24);
        slab(base,x+side*2.1,2.2,face,.18,4.25,.16);
      }
      slab(recess,x,2.15,face,3.95,4.35,.10);
      slab(stone,x,2.38,sign*5.26,3.53,3.89,.12);
      slab(limestone,x,6.42,face,4.43,.24,.31);
      slab(limestone,x,2,face,4.43,.23,.31);
      add(ring,base,x,9.15,sign*5.37,1.23,1.40,.72);
      add(bead,stone,x,9.15,sign*5.34,.96,1.08,.17);
      // Стилизованный лавровый венок, участок ленты под медальоном.
      for (let i=0;i<12;i++) {
        const angle=(i/11*1.55+.21)*Math.PI;
        add(bead,limestone,x+1.44*Math.cos(angle),9.13+1.65*Math.sin(angle),
          sign*5.44,.22,.42,.14,angle-.75);
      }
      slab(base,x,7.28,face,2.65,.21,.36);
    }
    const side=x+Math.sign(x)*3.27;
    for (const z of [-2.65,0,2.65]) {
      slab(recess,side,2.27,z,.10,5.35,1.90);
      slab(stone,side+Math.sign(x)*.065,2.48,z,.1,4.93,1.54);
    }
  }
  // Архитрав, фриз с дентикулами, ступенчатый карниз, парапет и настил смотровой.
  moulding(limestone,43.75,11.03,11.98,.58,.12);
  slab(base,0,12.56,0,43.55,.2,10.75);
  slab(stone,0,12.76,0,43.25,1.48,10.56);
  for (const sign of [-1,1]) {
    for (let i=-25;i<=25;i++)
      slab(limestone,i*.82,13.85,sign*5.39,.43,.31,.31);
    for (const x of [-13,-6.5,0,6.5,13])
      add(ring,limestone,x,13.28,sign*5.30,.36,.36,.55);
  }
  moulding(limestone,44.45,11.42,14.24,.36,.11);
  slab(base,0,14.60,0,44.70,.12,11.65);
  moulding(limestone,44.95,11.86,14.72,.27,.08);
  slab(roof,0,14.99,0,43.96,.12,10.9);
  // Тонкие швы крупноформатных плит читаются на смотровой только вблизи.
  for (let i=-5;i<=5;i++) slab(recess,i*3.7,15.11,0,.055,.028,9.8);
  for (const z of [-2.9,0,2.9]) slab(recess,0,15.11,z,43,.028,.055);
  for (const sign of [-1,1]) {
    slab(stone,0,14.99,sign*5.39,44,.59,.43);
    slab(limestone,0,15.58,sign*5.39,44.15,.18,.59);
    slab(stone,sign*21.72,14.99,0,.45,.59,10.5);
    slab(limestone,sign*21.72,15.58,0,.57,.18,10.59);
    for (const x of [-16,-8,0,8,16]) {
      slab(limestone,x,15.76,sign*5.39,1.48,.22,.76);
      add(bead,stone,x,16.07,sign*5.39,.62,.70,.29);
      add(ring,limestone,x,16.10,sign*5.65,.39,.44,.5);
    }
  }
  // Ступенчатые аттики пилонов – узнаваемый силуэт входа.
  for (const x of [-18.15,18.15]) {
    slab(stone,x,14.99,0,6.2,2.2,9.2);
    slab(limestone,x,17.19,0,6.45,.3,9.45);
    slab(stone,x,17.49,0,4.6,1.7,7);
    slab(limestone,x,19.19,0,4.85,.26,7.25);
    slab(stone,x,19.45,0,3,1.2,4.8);
    slab(limestone,x,20.65,0,3.25,.22,5.05);
    for (const sign of [-1,1]) {
      add(ring,limestone,x,16.1,sign*4.66,.72,.72,.6);
      add(bead,stone,x,18.3,sign*3.56,.5,.62,.2);
    }
  }
  for (const x of [-12.4,12.4]) {
    slab(base,x,15.12,0,5.65,.48,4.80);
    slab(roof,x,15.60,0,5.98,.16,5.10);
    for (let i=-2;i<=2;i++) slab(bronze,x+i*.86,15.77,0,.11,.09,3.64);
  }
  // Бинокуляры смотровой площадки вдоль парапета со стороны парка.
  for (const x of [-9,-3,3,9]) {
    slab(iron,x,15.11,4.3,.16,1.25,.16);
    add(bead,bronze,x,16.5,4.3,.34,.26,.5);
  }
  // Циркумференции: полукруглые крылья бывших касс, по 21 окну в каждом, шишки на парапете.
  const court={z:-33,radius:40.5}, bays=21;
  for (const side of wings?[-1,1]:[]) {
    for (let i=0;i<bays;i++) {
      const sweep=(51-i*3.35)*Math.PI/180;
      const cx=side*Math.cos(sweep)*court.radius, cz=court.z+Math.sin(sweep)*court.radius;
      const turn=side*(Math.PI/2-sweep)+(side<0?0:Math.PI);
      const out=[side*Math.cos(sweep),Math.sin(sweep)];
      add(block,base,cx,.45,cz,2.5,.9,5.3,0,turn);
      add(block,limestone,cx,3.75,cz,2.45,5.7,4.7,0,turn);
      add(block,limestone,cx,6.85,cz,2.5,.5,5.4,0,turn);
      add(block,stone,cx,7.35,cz,2.5,.5,4.9,0,turn);
      for (const face of [-1,1]) {
        const wx=cx+out[0]*face*2.37, wz=cz+out[1]*face*2.37;
        add(block,glass,wx,3.6,wz,1.15,3.1,.12,0,turn);
        add(block,stone,wx,5.45,wz,1.5,.22,.2,0,turn);
        add(ring,stone,wx,6.2,wz,.3,.3,.5,0,turn);
      }
      if(i%2===0) add(bead,limestone,cx,8.05,cz,.42,.62,.42);
    }
    // Торцевой павильон крыла.
    const sweep=(51-bays*3.35)*Math.PI/180;
    const ex=side*Math.cos(sweep)*court.radius, ez=court.z+Math.sin(sweep)*court.radius;
    const turn=side*(Math.PI/2-sweep);
    add(block,stone,ex,4.6,ez,4.4,9.2,6.4,0,turn);
    add(block,limestone,ex,9.45,ez,4.8,.5,6.8,0,turn);
    add(block,roof,ex,10.1,ez,3.4,.8,5.2,0,turn);
    add(bead,limestone,ex,11.1,ez,.6,.9,.6);
  }
  for (const [geometry,materials] of batches) {
    for (const [material,matrices] of materials) {
      const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);
      matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
      mesh.castShadow=true;
      mesh.receiveShadow=true;
      building.add(mesh);
    }
  }
  return building;
}
