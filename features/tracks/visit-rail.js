const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

export function durationText(seconds){
  const minutes=Math.round(seconds/60);
  if(seconds<60)return 'меньше минуты';
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return [hours && hours+' ч',rest && rest+' мин'].filter(Boolean).join(' ');
}

// Replay time and landmark positions share a piecewise linear scale.
export function createVisitRail(seekTo,clock){
  const el=id=>document.getElementById(id);
  const rail=el('visit-rail'),track=el('visit-track'),slider=el('seek');
  const context=el('visit-context');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  // The diagonal pattern repeats about every 12 px along the horizontal axis.
  const endTicks=44;
  const edgeIconRadius=25;
  const inset=endTicks+edgeIconRadius;
  let visits=[],anchors=[],progress=0,drag=null,active=null,offset=0;
  let width=0,scroll=0,minScroll=0,maxScroll=0,frame=0;
  function cancelMotion(){
    cancelAnimationFrame(frame);frame=0;
  }
  // Travel between two dwell positions with smooth velocity ramps. Integrating
  // smoothstep gives zero velocity and acceleration where the ring comes to rest.
  function rampArea(t){return t*t*t*(1-.5*t)}
  function headPosition(p){
    let startTime=0,startX=0;
    for(const [i,v] of visits.entries()){
      const x=anchors[i+1].x;
      if(p<v.from)return travelPosition(p,startTime,v.from,startX,x);
      if(p<=v.to)return x;
      startTime=v.to;startX=x;
    }
    return travelPosition(p,startTime,1,startX,anchors.at(-1).x);
  }
  function travelPosition(p,start,end,x0,x1){
    const span=end-start;
    if(span<=0)return x1;
    const t=clamp((p-start)/span,0,1);
    // Long journeys cruise in the middle; short transfers flow from ease-in to ease-out.
    const ramp=Math.min(.5,.014/span); // At most 168 ms of the 12-second replay.
    let distance=t-ramp/2;
    if(t<ramp)distance=ramp*rampArea(t/ramp);
    else if(t>1-ramp)distance=1-ramp-ramp*rampArea((1-t)/ramp);
    return x0+(x1-x0)*distance/(1-ramp);
  }
  function position(){
    if(!anchors.length)return;
    offset=visits.length?headPosition(progress):progress*anchors.at(-1).x;
    const head=offset+inset;
    scroll=clamp(head-width/2,minScroll,maxScroll);
    track.style.transform='translate3d('+(-scroll)+'px,0,0)';
    for(const [i,visit] of visits.entries()){
      const distance=Math.abs(anchors[i+1].x-offset);
      const proximity=clamp(1-distance/visit.focusRadius,0,1);
      const focus=proximity*proximity*(3-2*proximity);
      // The circle, rim and artwork are lifted together, with a common baseline.
      if(visit.focus!==focus){
        visit.button.style.setProperty('--focus',focus);
        visit.focus=focus;
      }
    }
  }
  function layout(){
    width=rail.clientWidth;
    const length=Math.max(420,width-2*inset);
    anchors=[{p:0,x:0}];
    for(const v of visits){
      const last=anchors.at(-1);
      const x=last.x+Math.max(last.p===0?12:62,(v.p-last.p)*length);
      anchors.push({p:v.p,x});
    }
    // Keep room for the other visible stops on short, tightly clustered itineraries.
    if(visits.length>=2){
      const first=anchors[1],last=anchors.at(-1);
      const span=last.x-first.x,required=width-2*inset;
      if(span<required){
        for(let i=2;i<anchors.length;i++){
          anchors[i].x=first.x+(anchors[i].x-first.x)*required/span;
        }
      }
    }
    const last=anchors.at(-1),end=last.x+Math.max(12,(1-last.p)*length);
    anchors.push({p:1,x:end});track.style.width=(end+2*inset)+'px';
    for(const [i,visit] of visits.entries()){
      const x=anchors[i+1].x;
      visit.button.style.left=(x+inset)+'px';
      const left=i?x-anchors[i].x:Infinity;
      const right=i+1<visits.length?anchors[i+2].x-x:Infinity;
      visit.focusRadius=Math.min(64,.85*Math.min(left,right));
    }
    if(visits.length>=2){
      minScroll=anchors[1].x;
      maxScroll=Math.max(minScroll,anchors[visits.length].x+2*inset-width);
    }else{
      // With one or zero landmarks the observed day itself defines the bounds.
      const first=visits[0];
      minScroll=headPosition(0)+inset-endTicks-(first?.from===0?edgeIconRadius:0);
      maxScroll=Math.max(minScroll,headPosition(1)+inset+endTicks+(first?.to===1?edgeIconRadius:0)-width);
    }
    position();
  }
  new ResizeObserver(layout).observe(rail);
  function progressAt(x){
    const end=anchors.at(-1).x;
    if(x<=0)return 0;
    if(x>=end)return 1;
    if(!visits.length)return x/end;
    // Invert the same travel curve used by playback. A 40-pixel drag moves
    // the visible strip by 40 pixels even when it starts close to a visit.
    let low=0,high=1;
    for(let i=0;i<18;i++){
      const mid=(low+high)/2;
      if(headPosition(mid)<x)low=mid;else high=mid;
    }
    return (low+high)/2;
  }
  function setVisits(list){
    cancelMotion();visits=list;active=null;drag=null;context.hidden=true;
    track.replaceChildren();
    for(const visit of visits){
      const button=document.createElement('button'),img=new Image();
      button.type='button';button.className='rail-stop';
      button.setAttribute('aria-label',visit.name+', '+visit.detail);
      button.title=visit.name+' · '+visit.detail;
      const disc=document.createElement('span');disc.className='stop-disc';
      img.src=visit.icon;img.alt='';disc.append(img);button.append(disc);track.append(button);
      button.onclick=e=>{if(e.detail===0)glideTo(visit.p)};
      // Keep offscreen landmarks reachable without letting focus scroll the clipped rail.
      button.onfocus=()=>{if(button.matches(':focus-visible')){cancelMotion();seekTo(visit.p)}};
      visit.button=button;
    }
    layout();
  }
  function update(p,time){
    if(!anchors.length)return;
    progress=p;position();
    slider.value=Math.round(p*10000);
    const visit=visits.find(v=>p>=v.from && p<=v.to);
    if(visit!==active){
      active?.button.removeAttribute('aria-current');
      active=visit;context.hidden=!visit;
      if(visit){
        visit.button.setAttribute('aria-current','location');
        el('visit-label').textContent=visit.name;
        el('visit-hours').textContent=visit.detail;
      }
    }
    slider.setAttribute('aria-valuetext',clock(time)+(visit?', '+visit.name+', '+visit.duration:''));
  }
  function seekOffset(x){seekTo(progressAt(x))}
  function glideTo(target,coastDuration=0){
    cancelMotion();
    if(reducedMotion.matches || Math.abs(progress-target)<.0001){seekTo(target);return}
    // Interpolate in strip pixels so motion stays even between closely spaced visits.
    const from=offset,to=headPosition(target),start=performance.now();
    if(Math.abs(to-from)<.1){seekTo(target);return}
    const duration=coastDuration || clamp(280+Math.abs(to-from)*.7,300,490);
    function step(now){
      const t=clamp((now-start)/duration,0,1);
      if(t>=1){frame=0;seekTo(target);return}
      // Quick traverse with a short, gentle settle at the next icon.
      const eased=coastDuration?1-(1-t)**3:t*t*(3-2*t);
      seekOffset(from+(to-from)*eased);
      frame=requestAnimationFrame(step);
    }
    frame=requestAnimationFrame(step);
  }
  slider.oninput=()=>{cancelMotion();seekTo(Number(slider.value)/10000)};
  rail.onpointerdown=e=>{
    if(e.button!==0 || !e.isPrimary || !anchors.length)return;
    cancelMotion();
    const rect=rail.getBoundingClientRect();
    drag={id:e.pointerId,x:e.clientX,left:rect.left,scale:rail.offsetWidth/rect.width,
      start:offset,scroll,visit:visits.find(v=>v.button.contains(e.target)),moved:false,
      lastX:e.clientX,lastTime:e.timeStamp,velocity:0};
    drag.visit?.button.classList.add('pressed');
    rail.setPointerCapture(e.pointerId);seekTo(progress);
  };
  rail.onpointermove=e=>{
    if(!drag || drag.id!==e.pointerId)return;
    const dx=(drag.x-e.clientX)*drag.scale;
    if(Math.abs(dx)>3)drag.moved=true;
    if(!drag.moved)return;
    drag.visit?.button.classList.remove('pressed');
    const dt=Math.max(1,e.timeStamp-drag.lastTime);
    const speed=(drag.lastX-e.clientX)*drag.scale/dt;
    drag.velocity=dt>100?0:.45*drag.velocity+.55*speed;
    drag.lastTime=e.timeStamp;drag.lastX=e.clientX;
    seekOffset(drag.start+dx);
  };
  function release(){
    drag?.visit?.button.classList.remove('pressed');
    drag=null;
  }
  rail.onpointerup=e=>{
    if(!drag || drag.id!==e.pointerId)return;
    const gesture=drag;release();
    if(!gesture.moved){
      const tapX=gesture.scroll+(e.clientX-gesture.left)*gesture.scale-inset;
      glideTo(gesture.visit?.p ?? progressAt(tapX));
    }else if(!reducedMotion.matches){
      const speed=e.timeStamp-gesture.lastTime<85?gesture.velocity:0;
      const travel=clamp(speed*120,-width*.55,width*.55);
      const landing=clamp(offset+travel,0,anchors.at(-1).x);
      const i=visits.findIndex((v,i)=>Math.abs(anchors[i+1].x-landing)<v.focusRadius*.50);
      if(i>=0)glideTo(visits[i].p,250);
      else if(Math.abs(travel)>5)glideTo(progressAt(landing),clamp(Math.abs(travel)*2,125,300));
    }
  };
  rail.onlostpointercapture=rail.onpointercancel=release;
  rail.addEventListener('wheel',e=>{
    if(!anchors.length)return;
    e.preventDefault();cancelMotion();
    seekOffset(offset+(e.deltaX||e.deltaY)*(e.deltaMode===1?16:1));
  },{passive:false});
  return {setVisits,update,cancelMotion};
}
