// Paint the same stationery and instrument faces for the map, layout picker and video.
const faces=new WeakMap();
function ticket(ctx,w,h){
  const seam=Math.round(w*.58);
  ctx.beginPath();
  ctx.roundRect(0,0,w,h,13);
  for(const y of [0,h]){
    ctx.moveTo(seam+5,y);
    ctx.arc(seam,y,5,0,2*Math.PI);
  }
  ctx.clip('evenodd');
  ctx.fillStyle='#e7dcff';
  ctx.fillRect(0,0,w,h);
  ctx.fillStyle='#c5a4fa';
  ctx.fillRect(seam,0,w-seam,h);
  ctx.strokeStyle='#7b5e9e';
  ctx.setLineDash([2,3]);
  ctx.beginPath();ctx.moveTo(seam,6);ctx.lineTo(seam,h-6);ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle='#36234c';
  const bars=[2,1,3,1,1,2,3,1,2,1,3,2,1,1,2,1];
  const step=Math.min(1.7,(w-seam-26)/48);
  let x=seam+13;
  for(const width of bars){
    ctx.fillRect(x,h-18,width*step,8);
    x+=(width+1.3)*step;
  }
}
function speedometer(ctx,w,h,peak){
  const cx=w*.235,cy=47,r=34;
  ctx.beginPath();ctx.roundRect(0,0,w,h,19);ctx.fillStyle='#141721ed';ctx.fill();
  ctx.strokeStyle='#ffffff30';ctx.lineWidth=1;ctx.stroke();
  const turn=Math.PI/180;
  const angle=p=>(190+p*160)*turn;
  const ratio=Math.min(1,Math.max(0,peak/180));
  for(let i=0;i<20;i++){
    const start=i/20;
    ctx.beginPath();ctx.arc(cx,cy,r,angle(start),angle(start+.035));
    ctx.lineWidth=5;
    ctx.strokeStyle=start<ratio?(start>.67?'#ff92cf':'#94ffd0'):'#434553';
    ctx.stroke();
  }
  const a=angle(ratio),dx=Math.cos(a),dy=Math.sin(a);
  ctx.beginPath();ctx.moveTo(cx+dx*(r-4),cy+dy*(r-4));
  ctx.lineTo(cx-dy*3,cy+dx*3);ctx.lineTo(cx+dy*3,cy-dx*3);ctx.closePath();
  ctx.fillStyle='#fff';ctx.fill();
  ctx.beginPath();ctx.arc(cx,cy,4,0,2*Math.PI);ctx.fill();
  ctx.strokeStyle='#ffffff24';ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(w*.47,14);ctx.lineTo(w*.47,h-14);
  ctx.moveTo(w*.47+14,h/2);ctx.lineTo(w-14,h/2);ctx.stroke();
}
export function statsFace(list){
  const {stats,peak}=list.dataset,w=list.offsetWidth,h=list.offsetHeight;
  if((stats!=='ticket' && stats!=='gauge') || !w || !h || !list.childElementCount){
    list.style.removeProperty('background-image');
    faces.delete(list);
    return null;
  }
  const key=[stats,w,h,peak].join('/');
  if(faces.get(list)?.key===key)return faces.get(list).canvas;
  const canvas=document.createElement('canvas');
  canvas.width=w*2;canvas.height=h*2;
  const ctx=canvas.getContext('2d');ctx.scale(2,2);
  if(stats==='ticket')ticket(ctx,w,h);
  else speedometer(ctx,w,h,Number(peak));
  list.style.backgroundImage='url('+canvas.toDataURL()+')';
  faces.set(list,{key,canvas});
  return canvas;
}
