const clamp = (n,min,max) => Math.max(min,Math.min(max,n));

export function durationText(seconds){
  const minutes=Math.round(seconds/60);
  if(seconds<60)return 'меньше минуты';
  const hours=Math.floor(minutes/60),rest=minutes%60;
  return [hours && hours+' ч',rest && rest+' мин'].filter(Boolean).join(' ');
}

// The map and rail share replay positions. Give adjacent stops enough room for
// separate touch targets without changing the clock or the playback duration.
export function createVisitRail(seekTo,clock){
  const el=id=>document.getElementById(id);
  const rail=el('visit-rail'),track=el('visit-track'),slider=el('seek');
  const previous=el('prev-visit'),next=el('next-visit'),context=el('visit-context');
  let visits=[],anchors=[],progress=0,drag=null,active=null,offset=0;
  function interpolate(value,from,to){
    const i=anchors.findIndex(a=>a[from]>=value);
    if(i<0)return anchors.at(-1)[to];
    if(!i)return anchors[0][to];
    const a=anchors[i-1],b=anchors[i];
    return a[to]+(b[to]-a[to])*(value-a[from])/(b[from]-a[from]);
  }
  function setVisits(list){
    visits=list;active=null;drag=null;context.hidden=true;
    anchors=[{p:0,x:0}];
    track.replaceChildren();
    for(const visit of visits){
      const last=anchors.at(-1);
      const x=last.x+Math.max(last.p===0?12:62,(visit.p-last.p)*420);
      anchors.push({p:visit.p,x});
      const button=document.createElement('button'),img=new Image();
      button.type='button';button.className='rail-stop';button.style.left=x+'px';
      button.setAttribute('aria-label',visit.name+', '+visit.detail);
      button.title=visit.name+' · '+visit.detail;
      img.src=visit.icon;img.alt='';button.append(img);track.append(button);
      button.onclick=e=>{if(e.detail===0)seekTo(visit.p)};
      // Keep offscreen landmarks reachable without letting focus scroll the clipped rail.
      button.onfocus=()=>{if(button.matches(':focus-visible'))seekTo(visit.p)};
      visit.button=button;
    }
    const last=anchors.at(-1);
    const width=last.x+Math.max(12,(1-last.p)*420);
    anchors.push({p:1,x:width});track.style.width=width+'px';
  }
  function update(p,time){
    if(!anchors.length)return;
    progress=p;offset=interpolate(p,'p','x');
    track.style.transform='translateX('+(-offset)+'px)';
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
    previous.disabled=!visits.some(v=>v.p<p-.00001);
    next.disabled=!visits.some(v=>v.p>p+.00001);
    slider.setAttribute('aria-valuetext',clock(time)+(visit?', '+visit.name+', '+visit.duration:''));
  }
  function seekOffset(x){seekTo(interpolate(clamp(x,0,anchors.at(-1).x),'x','p'))}
  previous.onclick=()=>{const v=visits.filter(v=>v.p<progress-.00001).at(-1);if(v)seekTo(v.p)};
  next.onclick=()=>{const v=visits.find(v=>v.p>progress+.00001);if(v)seekTo(v.p)};
  slider.oninput=()=>seekTo(Number(slider.value)/10000);
  rail.onpointerdown=e=>{
    if(e.button!==0 || !e.isPrimary || !anchors.length)return;
    const rect=rail.getBoundingClientRect();
    drag={id:e.pointerId,x:e.clientX,center:rect.left+rect.width/2,scale:rail.offsetWidth/rect.width,
      start:offset,visit:visits.find(v=>v.button.contains(e.target)),moved:false};
    rail.setPointerCapture(e.pointerId);seekTo(progress);
  };
  rail.onpointermove=e=>{
    if(!drag || drag.id!==e.pointerId)return;
    const dx=(drag.x-e.clientX)*drag.scale;
    if(Math.abs(dx)>3)drag.moved=true;
    if(drag.moved)seekOffset(drag.start+dx);
  };
  rail.onpointerup=e=>{
    if(!drag || drag.id!==e.pointerId)return;
    if(!drag.moved){
      if(drag.visit)seekTo(drag.visit.p);
      else seekOffset(drag.start+(e.clientX-drag.center)*drag.scale);
    }
    drag=null;
  };
  rail.onlostpointercapture=rail.onpointercancel=()=>{drag=null};
  rail.addEventListener('wheel',e=>{
    if(!anchors.length)return;
    e.preventDefault();seekOffset(offset+(e.deltaX||e.deltaY)*(e.deltaMode===1?16:1));
  },{passive:false});
  return {setVisits,update};
}
