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
  const previous=el('prev-visit'),next=el('next-visit'),context=el('visit-context');
  const lens=rail.querySelector('.rail-lens');
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  const inset=26;
  let visits=[],anchors=[],progress=0,drag=null,active=null,offset=0;
  let width=0,scroll=0,frame=0,animationTarget=null;
  function cancelMotion(){
    cancelAnimationFrame(frame);frame=0;animationTarget=null;
  }
  // Only the reading head settles on a landmark. The underlying time and drag
  // offset keep advancing, including through the entire stationary interval.
  function headProgress(p){
    for(const visit of visits){
      if(p<visit.approach)return p;
      if(p>visit.release)continue;
      if(p>=visit.from && p<=visit.to)return visit.p;
      const t=p<visit.from ? (p-visit.approach)/(visit.from-visit.approach)
                           : (visit.release-p)/(visit.release-visit.to);
      const pull=t*t*(3-2*t);
      return p+(visit.p-p)*pull;
    }
    return p;
  }
  function position(){
    if(!anchors.length)return;
    offset=interpolate(progress,'p','x');
    const head=interpolate(headProgress(progress),'p','x')+inset;
    scroll=clamp(head-width/2,0,Math.max(0,anchors.at(-1).x+2*inset-width));
    track.style.transform='translate3d('+(-scroll)+'px,0,0)';
    lens.style.transform='translate3d('+(head-scroll)+'px,-50%,0) translateX(-50%)';
  }
  function layout(){
    width=rail.clientWidth;
    const length=Math.max(420,width-2*inset);
    anchors=[{p:0,x:0}];
    for(const v of visits){
      const last=anchors.at(-1);
      const x=last.x+Math.max(last.p===0?12:62,(v.p-last.p)*length);
      anchors.push({p:v.p,x});v.button.style.left=(x+inset)+'px';
    }
    const last=anchors.at(-1),end=last.x+Math.max(12,(1-last.p)*length);
    anchors.push({p:1,x:end});track.style.width=(end+2*inset)+'px';
    position();
  }
  new ResizeObserver(layout).observe(rail);
  function interpolate(value,from,to){
    const i=anchors.findIndex(a=>a[from]>=value);
    if(i<0)return anchors.at(-1)[to];
    if(!i)return anchors[0][to];
    const a=anchors[i-1],b=anchors[i];
    return a[to]+(b[to]-a[to])*(value-a[from])/(b[from]-a[from]);
  }
  function setVisits(list){
    cancelMotion();visits=list;active=null;drag=null;context.hidden=true;
    track.replaceChildren();
    // Use up to 350 ms of the 12-second replay on each side. Neighbouring
    // transitions meet at most halfway through the travel between visits.
    const reach=.35/12;
    for(const [i,visit] of visits.entries()){
      const before=i ? (visits[i-1].to+visit.from)/2 : 0;
      const after=i+1<visits.length ? (visit.to+visits[i+1].from)/2 : 1;
      visit.approach=Math.max(before,visit.from-reach);
      visit.release=Math.min(after,visit.to+reach);
      const button=document.createElement('button'),img=new Image();
      button.type='button';button.className='rail-stop';
      button.setAttribute('aria-label',visit.name+', '+visit.detail);
      button.title=visit.name+' · '+visit.detail;
      img.src=visit.icon;img.alt='';button.append(img);track.append(button);
      button.onclick=e=>{if(e.detail===0)glideTo(visit.p,240)};
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
        el('visit-label').textContent=visit.name+' · '+visit.duration;
        el('visit-hours').textContent=visit.hours;
      }
    }
    previous.disabled=!visits.some(v=>v.p<(visit?.from ?? p)-.00001);
    next.disabled=!visits.some(v=>v.p>(visit?.to ?? p)+.00001);
    slider.setAttribute('aria-valuetext',clock(time)+(visit?', '+visit.name+', '+visit.duration:''));
  }
  function seekOffset(x){seekTo(interpolate(clamp(x,0,anchors.at(-1).x),'x','p'))}
  function glideTo(target,duration){
    cancelMotion();
    if(reducedMotion.matches || Math.abs(progress-target)<.0001){seekTo(target);return}
    // Interpolate in strip pixels so motion stays even between closely spaced visits.
    const from=offset,to=interpolate(target,'p','x'),start=performance.now();
    animationTarget=target;
    function step(now){
      const t=clamp((now-start)/duration,0,1);
      if(t>=1){frame=0;animationTarget=null;seekTo(target);return}
      seekOffset(from+(to-from)*(1-(1-t)**3));
      frame=requestAnimationFrame(step);
    }
    frame=requestAnimationFrame(step);
  }
  function pageVisit(direction){
    const origin=animationTarget ?? (direction>0?active?.to:active?.from) ?? progress;
    const visit=direction>0 ? visits.find(v=>v.p>origin+.00001)
                            : visits.filter(v=>v.p<origin-.00001).at(-1);
    if(visit)glideTo(visit.p,260);
  }
  previous.onclick=()=>pageVisit(-1);next.onclick=()=>pageVisit(1);
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
      glideTo(gesture.visit?.p ?? interpolate(tapX,'x','p'),210);
    }else if(!reducedMotion.matches && e.timeStamp-gesture.lastTime<85){
      const travel=clamp(gesture.velocity*130,-width*.55,width*.55);
      if(Math.abs(travel)>5)glideTo(interpolate(offset+travel,'x','p'),clamp(Math.abs(travel)*2.5,170,350));
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
