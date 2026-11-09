// The car points along +X. Its yaw is derived from the projected road tangent.
import * as THREE from '../../vendor/three/three.module.js';

// A quick pinch, a short held silhouette, then a slower release. Every panel
// and both axles sample the same phase, including paused and exported frames.
function compression(time){
  const phase=(time%0.82)/0.82;
  const close=THREE.MathUtils.smoothstep(phase,.10,.38);
  const release=THREE.MathUtils.smoothstep(phase,.56,.94);
  return close*(1-release);
}
export function makeCar() {
  const renderer = new THREE.WebGLRenderer({alpha:true, antialias:true});
  renderer.setSize(384, 320, false);
  renderer.setClearColor(0,0);
  const scene = new THREE.Scene();
  // Extra vertical room for the tall pose; retain the original pixels per unit.
  const halfW=74,halfH=halfW*320/384;
  const top=2.8*halfH/halfW;
  const camera = new THREE.OrthographicCamera(-2.8,2.8,top,-top,.1,40);
  camera.position.set(0,7,9);
  camera.lookAt(0,.76,0);
  const car = new THREE.Group();
  scene.add(car);
  scene.add(new THREE.HemisphereLight(0xfff8ff,0x546788,2.1));
  for (const [x,y,z,power] of [[-3,7,5,3],[4,3,-4,3.5]]) {
    const lamp=new THREE.DirectionalLight(0xffffff,power);
    lamp.position.set(x,y,z); scene.add(lamp);
  }
  const mat=(color,metalness=.12,roughness=.36)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
  const paint=mat(0xff4b1b,.32), gloss=mat(0x223749,.4,.19), rubber=mat(0x171925,0,.84);
  const chrome=mat(0xd9e4ed,.55), black=mat(0x272932), roof=mat(0xff7742,.28);
  // Pivot at the midpoint between the axles, at hub height.
  const sill=.42;
  const squeezeFrame=new THREE.Group(),panels=new THREE.Group();
  squeezeFrame.position.y=sill;panels.position.y=-sill;
  car.add(squeezeFrame);squeezeFrame.add(panels);
  function mesh(shape,material,x=0,y=0,z=0){
    const item=new THREE.Mesh(shape,material);
    item.position.set(x,y,z);panels.add(item);return item;
  }
  function box(x,y,z,width,height,depth,m) {
    return mesh(new THREE.BoxGeometry(width,height,depth),m,x,y,z);
  }
  // Each section has its own width and shoulder height, shaping the bonnet,
  // fenders and tail. The bevel catches highlights as the car turns.
  function shell(sections,m) {
    const shape=new THREE.Shape();
    sections.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));
    shape.closePath();
    return (depth,bevel)=>mesh(new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,
      bevelSegments:3,steps:1,bevelSize:bevel,bevelThickness:bevel}),m,0,0,-depth/2);
  }
  shell([[-1.89,.44],[-1.95,.69],[-1.76,.88],[-.84,.99],[.51,.95],[1.67,.85],[1.95,.69],[1.87,.44]],paint)(1.49,.09);
  shell([[-1.29,.94],[-.78,1.44],[-.52,1.51],[.20,1.50],[.88,.93]],gloss)(1.29,.065);
  box(-.22,1.586,0,.93,.072,1.35,roof);
  box(0,.38,0,3.55,.14,1.50,black);
  const wheels=[];
  for(const side of [-1,1]){
    box(-.27,1.21,side*.687,.075,.49,.04,black);
    box(-.45,.83,side*.843,.23,.038,.045,chrome);
    box(.58,1.01,side*.88,.27,.15,.18,paint);
    for(const x of [-1.23,1.23]){
      const wheel=new THREE.Group();
      const hub=new THREE.Vector3(x,sill,side*.80);
      wheel.position.copy(hub);car.add(wheel);wheels.push({wheel,hub});
      function disk(r,depth,m,z){
        const disk=new THREE.Mesh(new THREE.CylinderGeometry(r,r,depth,28),m);
        disk.rotation.x=Math.PI/2;disk.position.z=side*z;wheel.add(disk);
      }
      disk(.415,.25,rubber,0);disk(.265,.032,chrome,.14);disk(.20,.036,black,.158);
      for(let i=0;i<5;i++){
        const spoke=new THREE.Mesh(new THREE.BoxGeometry(.059,.35,.03),chrome);
        spoke.position.z=side*.186;spoke.rotation.z=i*Math.PI/5;wheel.add(spoke);
      }
      disk(.09,.04,chrome,.20);
    }
    box(1.91,.735,side*.57,.09,.14,.32,mat(0xfff1bd));
    box(-1.91,.73,side*.57,.075,.13,.32,mat(0xc51720));
  }
  box(1.97,.54,0,.06,.14,.76,black);
  box(1.999,.54,0,.03,.1,.31,chrome);
  // Both liveries share the same wheels and body mesh in one WebGL renderer.
  const patrolParts=[];
  const stripe=mat(0x1742a4), white=mat(0xf7fbff);
  for(const side of [-1,1]){
    patrolParts.push(box(-.02,.79,side*.851,2.73,.19,.035,stripe));
    patrolParts.push(box(.28,.80,side*.874,.24,.22,.017,white));
  }
  patrolParts.push(box(-.23,1.67,0,.31,.10,1.29,black));
  const red=mat(0xff173a),blue=mat(0x145dff);
  red.emissive.setHex(0xff1642);blue.emissive.setHex(0x186aff);
  const redLamp=box(-.23,1.79,.35,.30,.18,.56,red);
  const blueLamp=box(-.23,1.79,-.35,.30,.18,.56,blue);
  patrolParts.push(redLamp,blueLamp);
  renderer.compile(scene,camera);
  renderer.render(scene,camera);
  const lampPoint=new THREE.Vector3();
  const roofRest=new THREE.Vector3(-.22,1.622,0),roofScreen=new THREE.Vector3();


  return function paintCar(ctx,x,y,heading,rotation,beacon=null,motion=null){
    const patrol=beacon!==null;
    paint.color.setHex(patrol?0xeaf1ff:0xff4b1b);
    roof.color.setHex(patrol?0xf2f6ff:0xff7742);
    patrolParts.forEach(part=>{part.visible=patrol});
    if(patrol){
      red.emissiveIntensity=.22+beacon*2.2;
      blue.emissiveIntensity=.22+(1-beacon)*2.2;
    }
    const elevation=Math.atan2(camera.position.y-.76,camera.position.z);
    car.rotation.y=-Math.atan2(Math.sin(heading)/Math.sin(elevation),Math.cos(heading));
    const squeeze=motion?compression(motion.time)*motion.amount:0;
    // X runs from rear to front; only vertical (Y) and lateral (Z) extents vary.
    const width=1-(.40/1.3)*squeeze;
    squeezeFrame.scale.set(1,1+.76*squeeze,width);
    for(const {wheel,hub} of wheels){
      wheel.position.set(hub.x,hub.y,hub.z*width);
      wheel.rotation.z=-rotation;
    }
    renderer.render(scene,camera);
    ctx.save();ctx.translate(x,y);ctx.fillStyle='rgba(7,8,16,.37)';
    ctx.beginPath();ctx.ellipse(0,3,49,12*width,heading,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.drawImage(renderer.domElement,x-halfW,y-halfH,halfW*2,halfH*2);
    if(patrol){
      // Blue and red spill is anchored to the projected roof lights.
      for(const [lamp,colour,power] of [[redLamp,'255,38,69',beacon],[blueLamp,'48,130,255',1-beacon]]){
        lamp.getWorldPosition(lampPoint).project(camera);
        const lx=x+lampPoint.x*halfW,ly=y-lampPoint.y*halfH,r=12+23*power;
        const glow=ctx.createRadialGradient(lx,ly,0,lx,ly,r);
        glow.addColorStop(0,'rgba(255,255,255,'+(.5+.5*power)+')');
        glow.addColorStop(.18,'rgba('+colour+','+(.4+.52*power)+')');
        glow.addColorStop(1,'rgba('+colour+',0)');
        ctx.fillStyle=glow;ctx.fillRect(lx-r,ly-r,r*2,r*2);
      }
    }
    if(patrol)return;
    roofScreen.copy(roofRest).applyMatrix4(panels.matrixWorld).project(camera);
    return {x:x+roofScreen.x*halfW,y:y-roofScreen.y*halfH};
  };
}
