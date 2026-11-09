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

// Keep the complete day visible alongside the close-up camera. Gaps remain gaps.
export function overviewNavigator(runs){
  const path=new Path2D();let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const run of new Set(runs)){
    if(!run||run.gap)continue;
    run.curve.forEach((v,i)=>{
      minX=Math.min(minX,v.x);maxX=Math.max(maxX,v.x);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);
      i?path.lineTo(v.x,v.y):path.moveTo(v.x,v.y);
    });
  }
  const scale=104/Math.max(1,maxX-minX,maxY-minY),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  function draw(ctx,pos,height,p){
    ctx.save();ctx.translate(501,height-210);
    ctx.fillStyle='rgba(18,20,32,.93)';ctx.beginPath();ctx.arc(0,0,72,0,2*Math.PI);ctx.fill();
    ctx.lineWidth=3;ctx.strokeStyle='rgba(222,209,248,.34)';ctx.stroke();
    ctx.strokeStyle='#d2acff';ctx.beginPath();ctx.arc(0,0,72,-Math.PI/2,p*2*Math.PI-Math.PI/2);ctx.stroke();
    ctx.scale(scale,scale);ctx.translate(-cx,-cy);ctx.lineWidth=3.8/scale;ctx.lineJoin=ctx.lineCap='round';ctx.stroke(path);
    if(!pos.gap){
      ctx.fillStyle='#fff';ctx.shadowColor='#d6a4ff';ctx.shadowBlur=8;
      ctx.beginPath();ctx.arc(pos.x,pos.y,6/scale,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  draw.runs=[...new Set(runs)].filter(Boolean);
  return draw;
}
