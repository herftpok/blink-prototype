import {routeActionLayout} from './route-actions.js';
import {createVisitRail,durationText} from './visit-rail.js?v=dock1';
import {routeCalendar} from './calendar.js?v=period2';
import {openRoutes} from './privacy.js?v=calendar1';
import {drawJammer,stickerReady} from './jammer.js?v=brand1';
import {vehiclePresence,drawLightTrail} from './concepts.js?v=orbit1';
import {loadCity,drawCity} from './city-map.js?v=orbit1';
import {makeCar} from './car.js?v=replay-share2';
import {projectDistrict,prepareReplay,replayPoint,followView,orbitView,pursuitPoint,driveHeading} from './camera.js?v=visits1';
const $ = id => document.getElementById(id);
const clock = n => [Math.floor(n/60),Math.floor(n)%60].map(v=>String(v).padStart(2,'0')).join(':');
const number = n => n.toLocaleString('ru-RU',{maximumFractionDigits:1});
const query=new URLSearchParams(location.search);
const replayDuration=12000;
let repository,records;
try{
  repository=await openRoutes();
  records=await repository.readAll();
}catch(error){
  $('summary').textContent='Не удалось открыть маршруты. Проверь доступ к хранилищу браузера и обнови страницу.';
  for(const button of document.querySelectorAll('#screen button'))button.disabled=true;
  throw error;
}
const linkedDay=records.find(record=>record.day===query.get('day'));
const atSeconds=Number(query.get('at'));
const openAtFrame=linkedDay && query.has('at') && Number.isFinite(atSeconds);
let day=linkedDay||records[0];
const byDate=new Map(scenarios.map(s=>[s.date,records.find(record=>record.day===s.day)]));
const lastDate=scenarios[0].date;
const firstDate=scenarios.at(-1).date;
const viewDates=[];
for(let time=Date.parse(firstDate);time<=Date.parse(lastDate);time+=86400000){
  const date=new Date(time).toISOString().slice(0,10);
  viewDates.push({date,hasRoute:byDate.has(date)});
}
const dateLabel=iso=>new Date(iso+'T12:00:00Z').toLocaleDateString('ru-RU',{
  timeZone:'UTC',day:'numeric',month:'long',
  ...(iso.slice(0,4)!==lastDate.slice(0,4)?{year:'numeric'}:{})
}).replace(/ г\.$/,'');
let currentDate=scenarios.find(s=>s.day===day.day).date;
let progress=openAtFrame?Math.max(0,Math.min(1,atSeconds*1000/replayDuration)):0;
let playing=false,previous=0,selectedFix=null;
let saved=[];
try{
  saved=JSON.parse(localStorage.getItem('blink.tracks.zones')||'[]');
  if(!Array.isArray(saved))saved=[];
  const legacy=JSON.parse(localStorage.getItem('blink.tracks.spot'));
  if(!saved.length && legacy?.area && Number.isFinite(legacy.x) && Number.isFinite(legacy.y) && Object.hasOwn(zoneArt,legacy.icon)){
    saved.push(legacy);
  }
}catch{saved=[]}
const nearby=(a,b)=>Math.hypot(a.x-b.x,(a.y-b.y)*frameHeight/frameWidth)*day.mPerX<30;
const savedAt=s=>saved.find(z=>z.area===day.area && nearby(z,s));
function place(s){
  if(s.icon && s.duration)return [s.name,s.icon];
  const z=savedAt(s);
  if(z && Object.hasOwn(zoneArt,z.icon))return [z.name,zoneArt[z.icon][1]];
  const builtin=day.zones.find(z=>nearby(s,z));
  return builtin?zoneArt[builtin.id]:[s.end?'возможная остановка':'геоточка',null];
}
const backgrounds=new Map();
const asset = src => {const img=new Image(); img.src=src;img.onload=()=>{backgrounds.clear();render()};return img};
let city=null;
async function openDay(autoplay=true){
  const requested=day;pause();
  const next=await loadCity(requested.area);
  if(requested!==day)return;
  if(city && city!==next){city.tiles.clear();city.groundTiles.clear()}
  city=next;timeline();if(autoplay)start();
}
const portrait=asset('../../assets/people/live-1.webp');
const arrows=asset('../../assets/pin/arrows.png');
const reverseArrows=asset('../../assets/tails/arrows-reverse.png');
const flame=asset('../../assets/pin/fire-trail-atlas.webp');
const brandLogo=asset('../../assets/brand/logo.png');
const routes=new Map(),gaps=new Map(),sections=new Map();
const uiFamily=getComputedStyle(document.body).fontFamily;
function prepareDay(record){
  const replay=prepareReplay(record);
  routes.set(record,replay);
  const runs=[...new Set(replay.runs)].filter(Boolean);
  gaps.set(record,runs.filter(run=>run.gap));sections.set(record,runs);
}
records.forEach(prepareDay);
const mapHeader=document.querySelector('.map-header'),playback=document.querySelector('.playback');
let mapView=null,markerData=[];
const pinHost=$('traveller');
pinHost.innerHTML=BlinkPin.markup({name:'ты', photo:portrait.src, tag:'span', assets:'../../assets', state:'moving', speed:0, size:52});
const pinValue=pinHost.querySelector('.pin__time-value');
const motion=pinHost.querySelector('.pin__motion');
const liveArrows=pinHost.querySelector('.pin__badge--arrows');
const trailCanvas=document.createElement('canvas');
trailCanvas.className='pin__trail';
trailCanvas.width=160;trailCanvas.height=112;
motion.replaceChildren(trailCanvas);
let lastFlameFrame=-1;
function paintFlame(ctx,frame,x,y,width,height){
  ctx.drawImage(flame,frame%10*160,Math.floor(frame/10)*112,160,112,x,y,width,height);
}
function effectPhase(time){
  return {flameFrame:Math.floor(time*.03)%60,
    arrow:Math.floor(time/360)%2?reverseArrows:arrows};
}
let paintCar;
try { paintCar=makeCar(); }
catch(error) { console.warn('3D автомобиля недоступно',error); }
function fitPhone(){
  const reviewHeight=$('layout-review').hidden?0:$('layout-review').offsetHeight;
  const zoom=innerWidth<=480?1:Math.min(1,(innerHeight-36-reviewHeight)/844);
  document.documentElement.style.setProperty('--phone-zoom',zoom);
}
const actionLayout=routeActionLayout(query);
fitPhone();
window.addEventListener('resize',fitPhone);
const icons=Object.fromEntries(Object.values(zoneArt).map(([,src])=>[src,asset(src)]));
const loaded=img=>img?.complete && img.naturalWidth;
const mix=(a,b,t)=>a+(b-a)*t;
const stopIcon='art/stop.webp';
icons[stopIcon]=asset(stopIcon);
let visits=[];
const visitRail=createVisitRail(p=>{closePlace();progress=p;pause(true)},clock);
function sample(p){
  const route=routes.get(day),pos=replayPoint(route,p);
  if(pos.mode==='drive'){
    pos.heading=driveHeading(pos.curve,pos.travelled);
    return pos;
  }
  const before=replayPoint(route,Math.max(0,p-.009)),after=replayPoint(route,Math.min(1,p+.009));
  pos.heading=Math.atan2(after.y-before.y,after.x-before.x);
  return pos;
}
function drawStoryPlace(ctx,spot,stop,unit,atVisit){
  const [name,src]=place(stop);
  ctx.save();ctx.translate(spot.x,spot.y);ctx.scale(unit,unit);
  if(atVisit){
    if(loaded(icons[src]))ctx.drawImage(icons[src],-55.5,-50,43,43);
    ctx.restore();return;
  }
  ctx.fillStyle='#cc9eff';
  ctx.beginPath();ctx.arc(0,0,src?4.5:6,0,2*Math.PI);ctx.fill();
  if(src){
    if(loaded(icons[src]))ctx.drawImage(icons[src],-21.5,-50,43,43);
    ctx.font='700 12px '+uiFamily;
    let label=stop.duration?name+' · '+stop.duration:name;
    const fullLabel=label;
    while(label.length>1 && ctx.measureText(label+(label===fullLabel?'':'…')).width>94)label=label.slice(0,-1);
    if(label!==fullLabel)label+='…';
    const width=ctx.measureText(label).width+16;
    const left=stop.x<20?-24-width*.13:stop.x>80?24-width*.88:-width/2;
    ctx.fillStyle='#14141edd';ctx.beginPath();ctx.roundRect(left,6,width,22,10);ctx.fill();
    ctx.strokeStyle='#ffffff35';ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle='white';ctx.textAlign='center';ctx.fillText(label,left+width/2,21);
  }
  ctx.restore();
}
function drawStoryText(ctx,pos,height,unit){
  ctx.save();ctx.scale(unit,unit);
  const bottom=height/unit-28,width=600/unit;
  ctx.textAlign='left';ctx.fillStyle='white';ctx.shadowColor='#121225';ctx.shadowBlur=8;
  ctx.font='900 36px '+uiFamily;ctx.letterSpacing='-2px';
  ctx.fillText('где я был',16,49);
  ctx.letterSpacing='0px';
  const cols=[0,.25,.58,1],available=width-32;
  dayStats().forEach(([label,value],i)=>{
    const x=16+available*cols[i];
    ctx.fillStyle='white';ctx.font='750 18px '+uiFamily;ctx.fillText(value,x,78);
    ctx.font='600 11px '+uiFamily;ctx.fillStyle='#e0e0e6';
    const words=ctx.measureText(label).width>available*(cols[i+1]-cols[i])-3?label.split(' '):[label];
    words.forEach((line,row)=>ctx.fillText(line,x,94+row*13));
  });
  const visit=visits.find(v=>pos.time*60>=v.t && pos.time*60<=v.end);
  if(visit){
    ctx.fillStyle='white';ctx.font='750 18px '+uiFamily;
    ctx.fillText(visit.name+' · '+visit.duration,16,bottom-85,width-32);
    ctx.font='600 12px '+uiFamily;ctx.fillText(visit.hours,16,bottom-66);
  }
  ctx.shadowBlur=0;ctx.fillStyle='#14141edd';ctx.font='700 12px '+uiFamily;
  const box=Math.max(ctx.measureText(day.day).width,56)+24;
  ctx.beginPath();ctx.roundRect(16,bottom-53,box,53,15);ctx.fill();
  ctx.strokeStyle='#ffffff35';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle='#ddd6e7';ctx.fillText(day.day,28,bottom-33);
  ctx.fillStyle='white';ctx.font='750 21px '+uiFamily;ctx.fillText(clock(pos.time),28,bottom-10);
  if(loaded(brandLogo)){
    const logoWidth=76,logoHeight=logoWidth*brandLogo.naturalHeight/brandLogo.naturalWidth;
    ctx.shadowBlur=4;
    ctx.drawImage(brandLogo,width-16-logoWidth,bottom-4-logoHeight,logoWidth,logoHeight);
  }
  ctx.restore();
}
// captureStream records canvas pixels. Mirror the live component's layers here
// using its source images, 52-point frame and measured text styles.
function drawVideoPin(ctx,x,y,pos,phase,numberScale){
  ctx.save();
  ctx.translate(x,y);
  const unit=600/$('screen').clientWidth;ctx.scale(unit,unit);ctx.translate(-26,-52);
  if(pos.speed>20 && loaded(flame)){
    ctx.save();ctx.translate(26,26);ctx.rotate(pos.heading);
    paintFlame(ctx,phase.flameFrame,-96,-30,90,60);ctx.restore();
  }
  ctx.fillStyle='white';ctx.beginPath();ctx.roundRect(0,0,52,52,21);ctx.fill();
  if(loaded(portrait)){
    ctx.save();ctx.beginPath();ctx.roundRect(3.5,-31.5,45,80,[0,0,17.5,17.5]);ctx.clip();
    const scale=Math.max(62/portrait.width,80/portrait.height);
    const width=portrait.width*scale,height=portrait.height*scale;
    ctx.drawImage(portrait,26-width/2,8.5-height/2,width,height);ctx.restore();
  }
  if(pos.mode!=='still' && loaded(phase.arrow)){
    ctx.save();ctx.translate(6,40);ctx.rotate(pos.heading);
    ctx.drawImage(phase.arrow,-12,-12,24,24);ctx.restore();
  }
  ctx.textAlign='center';ctx.lineJoin='round';ctx.lineWidth=4;ctx.strokeStyle='white';
  const family=getComputedStyle(pinValue).fontFamily;
  ctx.save();ctx.translate(43.5,34);ctx.scale(numberScale,numberScale);
  ctx.font='italic 800 15px '+family;ctx.fillStyle='#15121f';
  ctx.strokeText(pos.speed,0,0);ctx.fillText(pos.speed,0,0);ctx.restore();
  ctx.font='italic 700 9px '+family;ctx.fillStyle='#62626b';
  ctx.strokeText('км/ч',43.5,48);ctx.fillText('км/ч',43.5,48);
  ctx.restore();
}
// Keep the road overlay vector-sharp as the camera follows the traveller.
function routePaths(){
  if(backgrounds.has(day))return backgrounds.get(day);
  const route=routes.get(day),path=new Path2D();
  for(const run of new Set(route.runs)){
    if(!run || run.gap)continue;
    run.curve.forEach((q,i)=>i?path.lineTo(q.x,q.y):path.moveTo(q.x,q.y));
  }
  backgrounds.set(day,path);return path;
}
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
function chasePhase(p){
  return reducedMotion.matches ? .5 : .5-.5*Math.cos(p*replayDuration/820*2*Math.PI);
}
function cameraAt(day,sample,p,height){
  if(reducedMotion.matches)return followView(day,sample,p,height);
  return orbitView(day,sample,p,height);
}
function draw(canvas,p,story=false){
  const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
  ctx.save();
  ctx.fillStyle='#15121f';ctx.fillRect(0,0,w,h);
  const unitsY=h/w*600,unit=600/$('screen').clientWidth;
  ctx.scale(w/600,w/600);
  const pos=sample(p),phase=effectPhase(p*replayDuration);
  const view=cameraAt(day,sample,p,unitsY);
  const origin=view.at({x:0,y:0});
  ctx.save();ctx.beginPath();ctx.rect(0,0,600,unitsY);ctx.clip();
  // Draw OSM geometry at the actual pixel scale of this canvas.
  ctx.save();ctx.translate(origin.x,origin.y);ctx.scale(view.scale,view.scale);
  if(view.bounds)ctx.transform(view.a,view.b,view.c,view.d,0,0);
  if(city)drawCity(ctx,city,view,unitsY);
  {
    const reach=370/view.scale;
    const halo=ctx.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,reach);
    halo.addColorStop(0,'rgba(149,90,225,.17)');halo.addColorStop(.5,'rgba(29,20,56,.18)');halo.addColorStop(1,'rgba(12,10,29,.55)');
    ctx.fillStyle=halo;
    const rect=view.bounds;
    if(rect)ctx.fillRect(rect[0],rect[1],rect[2]-rect[0],rect[3]-rect[1]);
    else ctx.fillRect(view.cx-300/view.scale,view.cy-unitsY*.58/view.scale,600/view.scale,unitsY/view.scale);
  }
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.strokeStyle=ctx.shadowColor='#cc9eff';ctx.lineWidth=4.3/view.scale;
  ctx.shadowBlur=5;
  drawLightTrail(ctx,routePaths(),pos,view.scale,sections.get(day));
  ctx.restore();
  const mist=ctx.createLinearGradient(0,0,0,unitsY*.45);
  mist.addColorStop(0,'rgba(14,24,44,.42)');mist.addColorStop(1,'rgba(22,35,58,0)');
  ctx.fillStyle=mist;ctx.fillRect(0,0,600,unitsY*.45);ctx.restore();
  const topLabel=(story?113:mapHeader.offsetTop+mapHeader.offsetHeight)*unit;
  const bottomLabel=story?unitsY-116*unit:playback.offsetTop*unit;
  for(const {stop,marker} of markerData){
    const spot=view.at(projectDistrict(day,stop));
    const outside=spot.y<topLabel+48*unit || spot.y>bottomLabel-30*unit || spot.x<0 || spot.x>600;
    const atVisit=stop.p!=null && p>=stop.from && p<=stop.to;
    if(story){
      if(outside)continue;
      drawStoryPlace(ctx,spot,stop,unit,atVisit);
    }else{
      marker.style.left=spot.x/6+'%';marker.style.top=spot.y/unitsY*100+'%';
      marker.hidden=outside;
      marker.classList.toggle('at-visit',atVisit);
    }
  }
  if(!story)mapView={view,unitsY};
  const {x,y}=view.at(pos);
  const chasing=!pos.gap && pos.mode==='drive' && pos.speed>120;
  const beacon=chasing?chasePhase(p):0;
  const numberScale=chasing?1.12+.30*beacon:1;
  if(chasing && paintCar){
    const follower=pursuitPoint(day,sample,routes.get(day),p,pos,view,unitsY,replayDuration,cameraAt);
    if(follower){
      const patrol=view.at(follower);
      ctx.save();ctx.beginPath();ctx.rect(0,0,600,unitsY);ctx.clip();
      paintCar(ctx,patrol.x,patrol.y,view.heading?view.heading(follower.heading):follower.heading,p*175,beacon);
      ctx.restore();
    }
  }
  if(view.heading)pos.heading=view.heading(pos.heading);
  const presence=paintCar?vehiclePresence(pos,p,replayDuration):0;
  let pinX=x,foot=y;
  if(presence>0){
    ctx.save();ctx.globalAlpha=presence;
    const offset=(1-presence)*20;
    const motion=reducedMotion.matches?null:{time:(p-pos.runStart)*replayDuration/1000,amount:presence};
    const roof=paintCar(ctx,x-Math.cos(pos.heading)*offset,y-Math.sin(pos.heading)*offset,pos.heading,p*175,null,motion);
    if(roof){pinX=mix(x,roof.x,presence);foot=mix(y,roof.y,presence)}
    ctx.restore();
  }
  if(story){if(!pos.gap)drawVideoPin(ctx,pinX,foot,pos,phase,numberScale);}
  else {
    pinHost.hidden=pos.gap;liveArrows.hidden=pos.mode==='still';
    pinHost.style.left=pinX/6+'%';
    pinHost.style.top=(foot/unitsY*100)+'%';
    pinHost.style.setProperty('--heading',pos.heading+'rad');
    motion.hidden=pos.speed<=20 || !loaded(flame);
    if(!motion.hidden && lastFlameFrame!==phase.flameFrame){
      const brush=trailCanvas.getContext('2d');
      brush.clearRect(0,0,160,112);
      paintFlame(brush,phase.flameFrame,0,0,160,112);
      lastFlameFrame=phase.flameFrame;
    }
    if(liveArrows.src!==phase.arrow.src)liveArrows.src=phase.arrow.src;
    pinValue.style.setProperty('--speed-scale',numberScale);
    pinValue.textContent=pos.speed;
  }
  drawJammer(ctx,gaps.get(day),p,replayDuration,unitsY,reducedMotion.matches);
  if(story)drawStoryText(ctx,pos,unitsY,unit);
  ctx.restore();
}
function render(){
  if(!day || $('map').width===0 || $('map').height===0)return;
  draw($('map'),progress);
  const s=sample(progress);visitRail.update(progress,s.time);$('current').textContent=clock(s.time);$('play').dataset.playing=String(playing);$('play').setAttribute('aria-label',playing?'Пауза':'Воспроизвести маршрут');
}
let frameRequest=0;
function tick(now){
  if(!playing)return;
  progress=Math.min(1,progress+Math.max(0,now-previous)/replayDuration);
  previous=now;
  playing=progress<1;
  render();
  if(playing)frameRequest=requestAnimationFrame(tick);
}
function pause(fromRail=false){
  if(!fromRail)visitRail.cancelMotion();
  playing=false;cancelAnimationFrame(frameRequest);render();
}
function start(){
  visitRail.cancelMotion();
  if(!day)return;
  cancelAnimationFrame(frameRequest);
  if(progress>=1)progress=0;
  playing=true;previous=performance.now();render();
  frameRequest=requestAnimationFrame(tick);
}
$('play').onclick=()=>{closePlace();if(playing)pause();else start()};
const info=$('place-info');
function closePlace(){info.hidden=true;}
$('dismiss-info').onclick=closePlace;
$('map').onclick=e=>{
  const r=e.currentTarget.getBoundingClientRect();
  const point=day.fixes.reduce((best,p,i)=>{
    const q=mapView.view.at(replayPoint(routes.get(day),routes.get(day).points[i].replay));
    const d=Math.hypot(r.left+q.x*r.width/600-e.clientX,r.top+q.y*r.height/mapView.unitsY-e.clientY);
    return d<best.d?{d,p}:best;
  },{d:Infinity});
  if(point.d>22)return closePlace();
  showPlace(point.p);
};
function showPlace(s){
  selectedFix=s;
  const nearest=day.fixes.reduce((a,b)=>Math.abs(a.t-s.t)<Math.abs(b.t-s.t)?a:b);
  progress=s.p ?? routes.get(day).points[day.fixes.indexOf(nearest)].replay;pause();
  $('place-name').textContent=place(s)[0];
  $('visit').textContent=clock(s.t/60)+(s.end?' — '+clock(s.end/60):'');
  $('trip').textContent='точность около '+s.accuracy+' м';
  $('edit').hidden=day.zones.some(z=>nearby(z,s));
  $('edit').textContent=savedAt(s)?'изменить место':'+ сохранить место';
  $('edit').onclick=openZone;
  const q=mapView.view.at(projectDistrict(day,s));
  info.style.left='clamp(110px,'+q.x/6+'%,calc(100% - 110px))';
  info.classList.toggle('above',q.y/mapView.unitsY>.65);
  info.style.top=q.y/mapView.unitsY*100+'%';info.hidden=false;
}
function dayStats(){
  return [['шаги',number(day.steps)],['расстояние',number(day.km)+' км'],['максимальная скорость',day.peak+' км/ч']];
}
function visiblePlaces(){
  const visible=[...visits,...day.stops.filter(stop=>!visits.some(v=>v.t===stop.t))];
  for(const zone of saved.filter(z=>z.area===day.area)){
    if(!visible.some(s=>nearby(zone,s))){
      const fix=day.fixes.find(p=>nearby(zone,p));
      if(fix)visible.push({...fix,x:zone.x,y:zone.y});
    }
  }
  return visible;
}
function timeline(){
  backgrounds.clear();closePlace();
  $('summary').replaceChildren(...dayStats().map(([label,value])=>{
    const block=document.createElement('div'),term=document.createElement('dt'),amount=document.createElement('dd');
    term.textContent=label;amount.textContent=value;block.append(term,amount);return block;
  }));
  const points=routes.get(day).points;
  visits=stationaryVisits(day.fixes,day.mPerX).flatMap(stop=>{
    const [zoneName,zoneIcon]=place(stop),seconds=stop.end-stop.t;
    if(!zoneIcon && seconds<=600)return [];
    const from=points[stop.first].replay,to=points[stop.last].replay;
    const name=zoneIcon?zoneName:'остановка',duration=durationText(seconds);
    const hours=clock(stop.t/60)+' — '+clock(stop.end/60);
    return [{...stop,from,to,p:(from+to)/2,name,icon:zoneIcon||stopIcon,duration,hours,detail:hours+' · '+duration}];
  });
  visitRail.setVisits(visits);
  $('places').replaceChildren();markerData=[];
  visiblePlaces().forEach(s=>{
    const [name,src]=place(s),marker=document.createElement('button');
    marker.className='place';marker.style.left=s.x+'%';marker.style.top=s.y+'%';
    marker.classList.toggle('near-left',s.x<20);marker.classList.toggle('near-right',s.x>80);
    marker.innerHTML='<span class="place-dot"></span><span class="tag"><strong></strong></span>';
    if(src){const img=new Image();img.src=src;img.alt='';marker.prepend(img)}
    else marker.classList.add('uncertain');
    marker.querySelector('strong').textContent=s.duration?name+' · '+s.duration:name;
    if(!src)marker.querySelector('.tag').remove();
    marker.setAttribute('aria-label',name+', '+clock(s.t/60));
    markerData.push({stop:s,marker});marker.onclick=()=>showPlace(s);$('places').append(marker);
  });
  render();
}
function updateDate(){
  $('date').querySelector('span').textContent=dateLabel(currentDate);
  $('date').setAttribute('aria-label','Выбрать дату: '+dateLabel(currentDate));
}
function selectDate(date){
  for(const sheet of [$('story'),$('zone')])if(sheet.open)sheet.close();
  pause();currentDate=date;day=byDate.get(date) || null;
  selectedFix=null;progress=0;closePlace();
  $('screen').classList.toggle('no-route',!day);
  $('empty-day').hidden=!!day;$('share').disabled=!day;
  updateDate();
  if(day){timeline();openDay()}
  else {$('summary').replaceChildren();$('places').replaceChildren();markerData=[];visits=[];visitRail.setVisits([])}
}
updateDate();
let selected='gym';
function openZone(){
  pause();const existing=savedAt(selectedFix);
  selected=existing?.icon||'gym';$('name').value=existing?.name||'';
  $('name').placeholder='например, спортзал';
  $('visits').textContent=day.title+' · '+clock(selectedFix.t/60);
  pick();openSheet($('zone'));
}
function pick(){
  $('icons').replaceChildren();
  for(const [key,[name,src]] of Object.entries(zoneArt)){const b=document.createElement('button');b.type='button';b.setAttribute('aria-label',name);b.setAttribute('aria-pressed',key===selected);const img=document.createElement('img');img.alt='';img.src=src;b.append(img);b.onclick=()=>{selected=key;pick()};$('icons').append(b)}
}
$('form').onsubmit=e=>{e.preventDefault();const name=$('name').value.trim();if(!name){$('name').focus();return}const zone={name,icon:selected,area:day.area,x:selectedFix.x,y:selectedFix.y};
const next=saved.filter(z=>z!==savedAt(selectedFix)).concat(zone);
try{localStorage.setItem('blink.tracks.zones',JSON.stringify(next));saved=next;localStorage.setItem('blink.tracks.spot',JSON.stringify(zone))}catch{$('visits').textContent='Сохранение недоступно в этом браузере.';return}$('zone').close();timeline()};
const openers=new WeakMap();
const topSheet=()=>[...document.querySelectorAll('dialog[open]')].at(-1);
function openSheet(sheet){
  actionLayout.closeMenu();
  openers.set(sheet,document.activeElement);
  const previousSheet=topSheet();
  if(previousSheet)previousSheet.inert=true;
  $('screen').inert=true;$('scrim').hidden=false;sheet.show();
  if(sheet.classList.contains('sheet')){
    $('scrim').classList.add('calendar-scrim');
    $('scrim').getBoundingClientRect();sheet.getBoundingClientRect();
    $('scrim').classList.add('is-open');sheet.classList.add('is-open');sheet.focus({preventScroll:true});
  }else sheet.querySelector('.close').focus();
}
for(const sheet of document.querySelectorAll('dialog')){
  sheet.addEventListener('close',()=>{
    const remaining=topSheet();
    if(remaining)remaining.inert=false;
    else{
      $('screen').inert=false;$('scrim').hidden=true;
      $('scrim').classList.remove('is-open','calendar-scrim');
    }
    openers.get(sheet)?.focus();
  });
  sheet.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();dismissSheet(sheet);return}
    if(event.key!=='Tab')return;
    const radio=sheet.querySelector('input[type=radio]:checked') || sheet.querySelector('input[type=radio]');
    const items=[...sheet.querySelectorAll('button:not(:disabled),input')].filter(el=>
      el.offsetWidth && getComputedStyle(el).visibility==='visible' && (el.type!=='radio' || el===radio));
    const first=items[0],last=items.at(-1);
    if(event.shiftKey && (document.activeElement===first || document.activeElement===sheet)){last.focus();event.preventDefault();}
    if(!event.shiftKey && document.activeElement===last){first.focus();event.preventDefault();}
  });
}
$('scrim').onclick=()=>dismissSheet(topSheet());
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
const privacy=$('privacy'),privacyNext=$('privacy-next');
const confirmation=$('confirm-day');
let calendarMode='privacy',selectedDate=null,savingDay=false;
function openCalendar(mode){
  calendarMode=mode;
  pause();closePlace();
  const browse=mode==='browse';
  $('privacy-title').textContent=browse?'выбрать день':'заглушить день';
  const reset=routeCalendar({
    periods:$('cal-periods'),grid:$('privacy-days'),month:$('cal-month'),year:$('cal-year'),prev:$('cal-prev'),next:$('cal-next')
  },browse?viewDates:scenarios,iso=>{
    selectedDate=iso;privacyNext.disabled=!iso;
    privacyNext.textContent=iso?(browse?'показать '+dateLabel(iso):'продолжить'):'выбери день';
  },browse?currentDate:null);
  const nearest=scenarios.reduce((a,b)=>Math.abs(Date.parse(b.date)-Date.parse(currentDate))<
    Math.abs(Date.parse(a.date)-Date.parse(currentDate))?b:a);
  reset(browse?currentDate:nearest.date);openSheet(privacy);
}
$('date').onclick=()=>openCalendar('browse');
$('privacy-open').onclick=()=>openCalendar('privacy');
async function dismissSheet(sheet){
  if(!sheet || savingDay)return;
  if(!sheet.classList.contains('sheet')){sheet.close();return}
  if(!sheet.classList.contains('is-open'))return;
  if(sheet!==confirmation)$('scrim').classList.remove('is-open');
  sheet.classList.remove('is-open');
  await Promise.allSettled(sheet.getAnimations().map(a=>a.finished));
  sheet.close();
}
for(const sheet of [privacy,confirmation]){
  const handle=sheet.querySelector('.sheet__handle');
  let drag=null;
  handle.onpointerdown=e=>{
    if(e.button!==0 || !sheet.classList.contains('is-open') || savingDay)return;
    handle.setPointerCapture(e.pointerId);
    drag={y:e.clientY,time:e.timeStamp,zoom:sheet.getBoundingClientRect().width/sheet.offsetWidth};
    sheet.classList.add('is-dragging');
  };
  handle.onpointermove=e=>{
    if(!drag)return;
    const offset=Math.max(0,(e.clientY-drag.y)/drag.zoom);
    sheet.style.transform='translateY('+offset+'px)';
  };
  handle.onpointerup=handle.onpointercancel=e=>{
    if(!drag)return;
    const offset=Math.max(0,(e.clientY-drag.y)/drag.zoom);
    const projected=offset+offset/Math.max(1,e.timeStamp-drag.time)*180;
    drag=null;sheet.classList.remove('is-dragging');sheet.style.transform='';
    if(e.type==='pointerup' && projected>sheet.offsetHeight*.4)dismissSheet(sheet);
  };
  sheet.addEventListener('close',()=>{
    drag=null;sheet.style.transform='';sheet.classList.remove('is-open','is-dragging');
    if(sheet===privacy){selectedDate=null;$('privacy-form').reset()}
  });
}
function updateRecord(next){
  const record=records.find(r=>r.day===next.day);
  if(JSON.stringify(next)===JSON.stringify(record))return;
  Object.assign(record,next);prepareDay(record);backgrounds.delete(record);
  if(record!==day)return;
  if($('story').open)$('story').close();
  if($('zone').open)$('zone').close();
  selectedFix=null;closePlace();timeline();
}
async function refreshRecords(){
  (await repository.readAll()).forEach(updateRecord);
}
const changes=new BroadcastChannel('blink.tracks.routes');
changes.onmessage=refreshRecords;
window.addEventListener('pageshow',event=>{if(event.persisted)refreshRecords()});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshRecords()});
$('privacy-form').onsubmit=async event=>{
  event.preventDefault();
  if(!selectedDate || !privacy.classList.contains('is-open') || confirmation.open)return;
  if(calendarMode==='browse'){
    const date=selectedDate;
    await dismissSheet(privacy);selectDate(date);
  }else{
    $('confirm-title').textContent='заглушить '+dateLabel(selectedDate)+'?';
    $('privacy-error').textContent='';openSheet(confirmation);
  }
};
$('confirm-cancel').onclick=()=>dismissSheet(confirmation);
$('confirm-apply').onclick=async()=>{
  if(savingDay || !confirmation.open || !selectedDate)return;
  savingDay=true;$('confirm-apply').disabled=true;
  try{
    const next=await repository.replaceDay(byDate.get(selectedDate).day);
    updateRecord(next);changes.postMessage('refresh');
    savingDay=false;await dismissSheet(confirmation);await dismissSheet(privacy);
  }catch{
    $('privacy-error').textContent='Не удалось обновить маршрут. Попробуй ещё раз.';
  }finally{savingDay=false;$('confirm-apply').disabled=false}
};
let recorder=null,videoFile=null,storyStart=0,previewFrame=0,storySession=0;
function animateStory(now){
  if(!$('story').open)return;
  const t=Math.max(0,(now-storyStart)/replayDuration);
  draw($('preview'),recorder?Math.min(t,1):t%1,true);
  if(recorder?.state==='recording'){
    const remaining=Math.ceil((1-t)*replayDuration/1000);
    $('export').textContent='готовим видео · '+Math.max(0,remaining)+' с';
    if(t>=1)recorder.stop();
  }
  previewFrame=requestAnimationFrame(animateStory);
}
async function prepareVideo(){
  const session=storySession;
  const canvas=$('preview'),action=$('export');
  action.disabled=true;
  if(!window.MediaRecorder || !canvas.captureStream){
    action.textContent='сохранение недоступно';
    $('status').textContent='В этом браузере доступен только предпросмотр.';
    return;
  }
  let stream;
  const failed=()=>{
    stream?.getTracks().forEach(t=>t.stop());
    recorder=null;action.disabled=false;action.textContent='попробовать снова';
    $('status').textContent='Не удалось подготовить видео.';
  };
  try{
    await brandLogo.decode();
    if(session!==storySession || !$('story').open)return;
    const type=['video/mp4;codecs=avc1.42002A','video/mp4','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    stream=canvas.captureStream(30);
    const recording=new MediaRecorder(stream,{...(type?{mimeType:type}:{}),videoBitsPerSecond:6500000});
    const parts=[];recorder=recording;
    recording.ondataavailable=e=>{if(e.data.size)parts.push(e.data)};
    recording.onerror=()=>{if(recorder===recording)failed()};
    recording.onstop=()=>{
      stream.getTracks().forEach(t=>t.stop());
      if(recorder!==recording)return;
      if(!parts.length)return failed();
      const mime=recording.mimeType.split(';')[0];
      videoFile=new File(parts,'blink-'+day.day.replace(' ','-')+(mime.includes('mp4')?'.mp4':'.webm'),{type:mime});
      recorder=null;action.disabled=false;
      action.textContent=navigator.canShare?.({files:[videoFile]})?'поделиться видео':'сохранить видео';
    };
    storyStart=performance.now();draw(canvas,0,true);recording.start();
    action.textContent='готовим видео · 12 с';
  }catch{if(session===storySession)failed()}
}
$('share').onclick=()=>{
  pause();
  const canvas=$('preview'),screen=$('screen');
  canvas.width=780;canvas.height=2*Math.round(390*screen.clientHeight/screen.clientWidth);
  videoFile=null;$('status').textContent='';openSheet($('story'));
  storyStart=performance.now();prepareVideo();animateStory(performance.now());
};
$('story').onclose=()=>{
  storySession++;
  cancelAnimationFrame(previewFrame);
  const active=recorder;recorder=null;videoFile=null;
  if(active?.state==='recording')active.stop();
  active?.stream.getTracks().forEach(t=>t.stop());
};
function download(){
  const a=document.createElement('a');a.href=URL.createObjectURL(videoFile);a.download=videoFile.name;
  a.click();setTimeout(()=>URL.revokeObjectURL(a.href),60000);
}
$('export').onclick=async()=>{
  if(!videoFile){$('status').textContent='';prepareVideo();return}
  if(!navigator.canShare?.({files:[videoFile]}))return download();
  try{await navigator.share({files:[videoFile],title:'Мой маршрут в Blink'})}
  catch(error){if(error.name!=='AbortError')download()}
};
await refreshRecords();
openDay(!openAtFrame);
if(openAtFrame)stickerReady.then(render);

new ResizeObserver(()=>{
  const canvas=$('map');
  const density=Math.min(3,Math.max(2,window.devicePixelRatio||1));
  canvas.width=Math.round($('screen').clientWidth*density);
  canvas.height=Math.round($('screen').clientHeight*density);
  render();
}).observe($('screen'));
