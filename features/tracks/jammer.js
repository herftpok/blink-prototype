// Keep the burst tied to replay time so seeking and video export show the same frame.
const sticker = new Image();
sticker.src = new URL('./art/jammer.svg?v=comic1', import.meta.url);

function makeHalo() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.translate(512, 512);
  ctx.globalCompositeOperation = 'screen';
  const blooms = [
    [-134,-134,254,'116,221,255'], [84,-132,246,'166,113,255'],
    [153,86,228,'133,255,224'], [-75,142,221,'210,252,91']
  ];
  for (const [x,y,r,rgb] of blooms) {
    const gradient = ctx.createRadialGradient(x,y,0,x,y,r);
    gradient.addColorStop(0,'rgba('+rgb+',.9)');
    gradient.addColorStop(.46,'rgba('+rgb+',.53)');
    gradient.addColorStop(1,'rgba('+rgb+',0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  // Overlapping tapered rays have soft edges and an uneven cadence, like the reference flash.
  const colors = ['#b565ff','#8276ff','#5cefff','#a4fffa','#ddff84'];
  for (let i=0; i<42; i++) {
    const angle = i * Math.PI * 2 / 42 + .05 * Math.sin(i * 15);
    const length = 216 + 238 * (.5 + .5*Math.cos(i*7.13));
    const halfWidth = 5 + 16*(.5 + .5*Math.sin(i*9.47));
    ctx.save();ctx.rotate(angle);
    const ray = ctx.createLinearGradient(0,0,length,0);
    const color = colors[(i+Math.floor(i/7))%colors.length];
    ray.addColorStop(0,color+'00');ray.addColorStop(.32,color+'cc');
    ray.addColorStop(.68,color+'77');ray.addColorStop(1,color+'00');
    ctx.fillStyle = ray;
    ctx.beginPath();ctx.moveTo(48,0);
    ctx.quadraticCurveTo(length*.35,-halfWidth,length,0);
    ctx.quadraticCurveTo(length*.39,halfWidth*.6,48,0);
    ctx.fill();ctx.restore();
  }
  return canvas;
}
const halo = makeHalo();
const flare = new Path2D('M0 -1 Q.12 -.14 .88 0 Q.13 .12 0 1 Q-.12 .13 -.88 0 Q-.12 -.13 0 -1Z');
const flares = [[-203,-82,25],[173,-105,19],[208,64,28],[-131,123,15]];

export function drawJammer(ctx,gaps,p,duration,height,reduced) {
  const fade = 320;
  const gap = gaps.find(g => p >= g.start && (p-g.end)*duration < fade);
  if (!gap || !sticker.naturalWidth) return;
  const age = (p-gap.start)*duration;
  const enter = Math.min(1, age/175);
  const leave = Math.max(0,(p-gap.end)*duration/fade);
  const spread = reduced ? 1 : 1 - Math.exp(-age/125);
  const pop = reduced ? 1 : 1 + .70*(enter-1)**3 + .96*enter*(1-enter)**2;

  ctx.save();
  ctx.globalAlpha *= (1-leave*leave*(3-2*leave))*Math.min(1,age/70);
  ctx.translate(300,height*.49);
  const extent = 780*(.66+.34*spread);
  ctx.drawImage(halo,-extent/2,-extent/2,extent,extent);
  for(const [x,y,r] of flares){
    ctx.save();ctx.translate(x*(.8+.2*spread),y*(.8+.2*spread));
    ctx.rotate(-.35);ctx.scale(r*spread,r*spread);
    ctx.fillStyle='#fff';ctx.fill(flare);ctx.restore();
  }
  ctx.scale(pop,pop);
  ctx.drawImage(sticker,-280,-175,560,350);
  ctx.restore();
}
