const smoothstep=t=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u)};

// The opacity, lateral approach and pin lift all follow this one replay clock.
export function vehiclePresence(pos,progress,duration){
  if(pos.mode!=='drive'||pos.gap)return 0;
  const ramp=Math.min(.38*1000/duration,(pos.runEnd-pos.runStart)/2);
  return smoothstep((progress-pos.runStart)/ramp)*smoothstep((pos.runEnd-progress)/ramp);
}

export function drawLightTrail(ctx,route,pos,scale,runs){
  ctx.save();ctx.lineWidth=3.5/scale;ctx.strokeStyle='#a493c5';ctx.globalAlpha=.40;
  ctx.stroke(route);ctx.restore();
  ctx.save();ctx.shadowColor='#cb8aff';ctx.shadowBlur=12;ctx.lineWidth=4.6/scale;ctx.strokeStyle='#dfbdff';
  ctx.beginPath();
  for(const run of runs){
    if(run.start>=pos.runEnd)break;
    if(run.gap)continue;
    ctx.moveTo(run.curve[0].x,run.curve[0].y);
    for(const q of run.curve){
      if(run.curve===pos.curve && q.d>pos.travelled)break;
      ctx.lineTo(q.x,q.y);
    }
    if(run.curve===pos.curve){ctx.lineTo(pos.x,pos.y);break}
  }
  ctx.stroke();ctx.restore();
  if(pos.gap)return;
  const points=pos.curve,tail=Math.max(0,pos.travelled-190/scale);
  let start=points.findIndex(v=>v.d>=tail);
  if(start<1)start=1;
  const from=points[start-1],to=points[start],f=(tail-from.d)/(to.d-from.d||1);
  const x=from.x+(to.x-from.x)*f,y=from.y+(to.y-from.y)*f;
  if(Math.hypot(x-pos.x,y-pos.y)<.01)return;
  const light=ctx.createLinearGradient(x,y,pos.x,pos.y);
  light.addColorStop(0,'rgba(195,148,255,0)');light.addColorStop(.45,'#b782ff');light.addColorStop(1,'#fbf2ff');
  ctx.save();ctx.shadowColor='#d4a3ff';ctx.shadowBlur=17;ctx.strokeStyle=light;ctx.lineWidth=7/scale;
  ctx.beginPath();ctx.moveTo(x,y);
  for(let i=start;i<points.length && points[i].d<pos.travelled;i++)ctx.lineTo(points[i].x,points[i].y);
  ctx.lineTo(pos.x,pos.y);ctx.stroke();ctx.restore();
}
