// Match the bearing and ground-plane tilt used for each OSM district.
const bearings={island:-.43,garden:-.37,canal:.68};
export function projectDistrict(day,p){
  const angle=bearings[day.area],c=Math.cos(angle),s=Math.sin(angle);
  const x=(p.x-50)*7.68,y=(p.y-50)*16.62;
  return {x:950+c*x-s*y,y:1300+.57*(s*x+c*y)};
}

// Fit the display trajectory independently inside each continuous GPS segment.
// Stationary fixes share one centre; their scatter never shakes the camera.
export function prepareReplay(day){
  const points=day.fixes.map(p=>({...p}));
  for(let start=0;start<points.length;){
    let end=start+1;
    while(end<points.length && !points[end].gapBefore && points[end].mode===points[start].mode)end++;
    const stopped=points[start].mode==='still';
    for(let i=start;i<end;i++){
      let x=0,y=0,sum=0;
      for(let j=stopped?start:Math.max(start,i-7);j<(stopped?end:Math.min(end,i+8));j++){
        const fix=day.fixes[j],weight=(stopped?1:Math.exp(-.5*((i-j)/2.8)**2))/Math.max(5,fix.accuracy);
        x+=fix.x*weight;y+=fix.y*weight;sum+=weight;
      }
      points[i].x=x/sum;points[i].y=y/sum;
    }
    start=end;
  }
  for(const p of points)Object.assign(p,projectDistrict(day,p));
  const runs=[];
  for(let start=0;start<points.length-1;){
    const mode=points[start+1].mode,gap=!!points[start+1].gapBefore;
    let end=start+1;
    while(!gap && end+1<points.length && !points[end+1].gapBefore && points[end+1].mode===mode)end++;
    // Finish travelling to the stationary cluster before starting its short hold.
    if(!gap && mode!=='still' && points[end+1]?.mode==='still' && !points[end+1].gapBefore)end++;
    const source=points.slice(start,end+1);
    const anchors=simplify(source,mode==='drive'?6:8);
    const curve=roundCorners(anchors);
    const run={start:points[start].replay,end:points[end].replay,curve,mode,gap};
    // Map each reading back to the time its position is reached under the new
    // acceleration. Keep actual clock times and speed readings on the route.
    if(!gap && mode!=='still'){
      const measured=[0];
      for(let i=1;i<source.length;i++)measured.push(measured.at(-1)+distance(source[i-1],source[i]));
      if(measured.at(-1)>0){
        for(let i=1;i<source.length-1;i++){
          const fraction=measured[i]/measured.at(-1);
          const u=(Math.sqrt(.16+2.4*fraction)-.4)/1.2;
          source[i].replay=run.start+(run.end-run.start)*u;
        }
      }
    }
    for(let i=start;i<end;i++)runs[i+1]=run;
    start=end;
  }
  balanceReplay(points,runs);
  // Compute the actual threshold-crossing times once. Seeking into a chase
  // must yield the same entrance frame as uninterrupted playback.
  const chases=[];
  for(let i=1;i<points.length;i++){
    const run=runs[i],a=points[i-1],b=points[i];
    if(run.mode!=='drive'||run.gap||Math.max(a.speed,b.speed)<120.5)continue;
    const fraction=(120.5-a.speed)/(b.speed-a.speed || 1);
    const crossing=a.replay+fraction*(b.replay-a.replay);
    const start=a.speed<120.5?crossing:a.replay;
    const end=b.speed<120.5?crossing:b.replay;
    if(end<=start)continue;
    const last=chases.at(-1);
    if(last && last.run===run && last.end===start)last.end=end;
    else chases.push({start,end,run});
  }
  return {points,runs,chases};
}

// Allocate screen time by visible route length. The square root gives short
// journeys time to register while reserving most of the replay for long ones.
function balanceReplay(points,runs){
  const sections=[...new Set(runs)].filter(Boolean);
  const moving=sections.filter(run=>!run.gap && run.mode!=='still');
  if(!moving.length)return;
  const weight=run=>Math.sqrt(Math.max(1,run.curve.at(-1).d));
  const totalWeight=moving.reduce((sum,run)=>sum+weight(run),0);
  const pauseShare=run=>run.gap ? .04 : run.mode==='still' ? .016 : 0;
  const pauses=sections.reduce((sum,run)=>sum+pauseShare(run),0);
  const pauseBudget=Math.min(.12,pauses);
  let cursor=0,index=1;
  for(const run of sections){
    const originalStart=run.start,originalSpan=run.end-run.start;
    const hold=pauseShare(run);
    const share=hold?pauseBudget*hold/pauses:(1-pauseBudget)*weight(run)/totalWeight;
    run.start=cursor;
    run.end=run===sections.at(-1)?1:cursor+share;
    while(index<points.length && runs[index]===run){
      const fraction=(points[index].replay-originalStart)/originalSpan;
      points[index].replay=run.start+(run.end-run.start)*fraction;
      index++;
    }
    cursor=run.end;
  }
}

// Drop GPS deviations that fit inside the display tolerance. Preserve the two
// endpoints and significant turns, then join those turns with tangent curves.
function simplify(points,tolerance){
  const first=points[0],last=points.at(-1),dx=last.x-first.x,dy=last.y-first.y;
  const length2=dx*dx+dy*dy;
  let split=0,worst=tolerance;
  for(let i=1;i<points.length-1;i++){
    const p=points[i],t=length2?Math.max(0,Math.min(1,((p.x-first.x)*dx+(p.y-first.y)*dy)/length2)):0;
    const error=Math.hypot(p.x-first.x-t*dx,p.y-first.y-t*dy);
    if(error>worst){worst=error;split=i}
  }
  if(!split)return [first,last];
  return simplify(points.slice(0,split+1),tolerance).slice(0,-1).concat(simplify(points.slice(split),tolerance));
}
const blend=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function roundCorners(anchors){
  const line=[{...anchors[0],d:0}];
  function add(p){const prev=line.at(-1);line.push({...p,d:prev.d+distance(prev,p)})}
  for(let i=1;i<anchors.length-1;i++){
    const a=anchors[i-1],b=anchors[i],c=anchors[i+1],ab=distance(a,b),bc=distance(b,c);
    if(!ab||!bc)continue;
    const trim=Math.min(32,ab*.43,bc*.43),left=blend(b,a,trim/ab),right=blend(b,c,trim/bc);
    add(left);
    for(let j=1;j<=24;j++){
      const t=j/24;add(blend(blend(left,b,t),blend(b,right,t),t));
    }
  }
  add(anchors.at(-1));return line;
}
function upperIndex(items,key,value){
  let lo=1,hi=items.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(items[mid][key]<value)lo=mid+1;else hi=mid}
  return lo;
}
export function replayPoint(route,p){
  const {points,runs}=route;
  const i=upperIndex(points,'replay',p),a=points[i-1],b=points[i],run=runs[i];
  const t=Math.max(0,Math.min(1,(p-run.start)/(run.end-run.start)));
  // s = v0*t + a*t²/2, measured along the rounded path, not along its chords.
  const fraction=run.gap?t:(.4*t+.6*t*t);
  const d=run.curve.at(-1).d*fraction,j=upperIndex(run.curve,'d',d);
  const left=run.curve[j-1],right=run.curve[j];
  const point=blend(left,right,(d-left.d)/(right.d-left.d||1));
  const u=Math.max(0,Math.min(1,(p-a.replay)/(b.replay-a.replay||1)));
  return {...point,runStart:run.start,runEnd:run.end,curve:run.curve,travelled:d,mode:run.mode,speed:Math.round(a.speed+(b.speed-a.speed)*u),
    time:(a.t+(b.t-a.t)*u)/60,gap:run.gap && t>0 && t<1};
}

// Sample the driven road, extending its initial tangent only if the entire
// visible history is shorter than the distance to the screen edge.
function onRoad(curve,d){
  if(d<0){
    const a=curve[0],b=curve.find(point=>point.d>0);
    return b?blend(a,b,d/b.d):a;
  }
  const bounded=Math.min(curve.at(-1).d,d);
  const i=upperIndex(curve,'d',bounded),a=curve[i-1],b=curve[i];
  return blend(a,b,(bounded-a.d)/(b.d-a.d||1));
}
// Steering follows a car-length chord of the road, even at a mode boundary.
export function driveHeading(curve,d){
  const radius=Math.min(15,curve.at(-1).d/3);
  const a=onRoad(curve,Math.max(0,d-radius)),b=onRoad(curve,d+radius);
  return Math.atan2(b.y-a.y,b.x-a.x);
}
function entryDistance(curve,followDistance,view,height){
  const margin=80; // whole car, shadow and beacon outside the clipped map
  const inside=d=>{
    const q=view.at(onRoad(curve,d));
    return q.x>=-margin && q.x<=600+margin && q.y>=-margin && q.y<=height+margin;
  };
  // Walk backwards from the trailing position to the first edge on its road.
  let d=followDistance;
  for(let i=upperIndex(curve,'d',Math.max(0,d))-1;i>=0 && inside(d);i--){
    d=curve[i].d;
  }
  if(inside(d)){
    const first=curve[0],next=curve.find(point=>point.d>0);
    if(!next)return d;
    const q=view.at(first),ahead=view.at(next),dx=(q.x-ahead.x)/next.d,dy=(q.y-ahead.y)/next.d;
    const toX=dx===0?Infinity:((dx>0?600+margin:-margin)-q.x)/dx;
    const toY=dy===0?Infinity:((dy>0?height+margin:-margin)-q.y)/dy;
    return -Math.max(0,Math.min(toX,toY));
  }
  // Straight spans may be much longer than the visible map.
  let outside=d,inner=followDistance;
  for(let i=0;i<18;i++){
    const mid=(outside+inner)/2;
    if(inside(mid))inner=mid;else outside=mid;
  }
  return outside;
}
export function pursuitPoint(day,sample,route,p,leader,view,height,duration,cameraAt=followView){
  const chase=route.chases.find(span=>p>=span.start && p<=span.end);
  if(!chase)return null;
  const curve=leader.curve,lag=150/view.scale;
  const follow=leader.travelled-lag;
  const entryProgress=Math.min(1,(p-chase.start)*duration/950);
  let d=follow;
  if(entryProgress<1){
    const onset=sample(chase.start);
    const initialView=cameraAt(day,sample,chase.start,height);
    const outside=entryDistance(curve,onset.travelled-lag,initialView,height);
    // Ease out into the normal following speed with a continuous velocity.
    d=follow-Math.max(0,onset.travelled-lag-outside)*(1-entryProgress)**2;
  }
  const back=onRoad(curve,d-2),front=onRoad(curve,d+2);
  return {...onRoad(curve,d),heading:Math.atan2(front.y-back.y,front.x-back.x)};
}

const districtScale={island:3.3,garden:2.15,canal:4.4};
export function followView(day,sample,p,height){
  const target=sample(p),past=sample(Math.max(0,p-.016)),future=sample(Math.min(1,p+.016));
  // Symmetric look-ahead keeps camera motion independent of refresh rate and seeking.
  const scale=districtScale[day.area];
  const cx=(past.x+target.x*3+future.x)/5,cy=(past.y+target.y*3+future.y)/5;
  return {scale,cx,cy,at(q){return {x:300+(q.x-cx)*scale,y:height*.58+(q.y-cy)*scale}}};
}

// Y in the district data is already foreshortened by the map pitch.
// Undo that projection, turn on the ground plane, then project at the same pitch.
export function orbitView(day,sample,p,height){
  const target=sample(p),scale=districtScale[day.area];
  const pitch=.57,angle=Math.PI*(p-Math.sin(2*Math.PI*p)*.68/(2*Math.PI));
  const a=Math.cos(angle),b=pitch*Math.sin(angle),c=-Math.sin(angle)/pitch,d=a;
  const cx=target.x,cy=target.y,anchorY=height*.58;
  function at(q){
    const x=q.x-cx,y=q.y-cy;
    return {x:300+scale*(a*x+c*y),y:anchorY+scale*(b*x+d*y)};
  }
  function ground(x,y){
    const u=(x-300)/scale,v=(y-anchorY)/scale;
    return {x:cx+d*u-c*v,y:cy-b*u+a*v};
  }
  const corners=[ground(0,0),ground(600,0),ground(0,height),ground(600,height)];
  return {a,b,c,d,cx,cy,scale,at,angle,
    bounds:[Math.min(...corners.map(v=>v.x)),Math.min(...corners.map(v=>v.y)),
      Math.max(...corners.map(v=>v.x)),Math.max(...corners.map(v=>v.y))],
    heading(t){return Math.atan2(b*Math.cos(t)+d*Math.sin(t),a*Math.cos(t)+c*Math.sin(t))}
  };
}
