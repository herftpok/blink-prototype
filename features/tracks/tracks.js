import {drawJammer,stickerReady} from './jammer.js?v=brand1';
import {vehiclePresence,drawLightTrail,overviewNavigator} from './concepts.js';
import {loadCity,drawCity} from './city-map.js';
import {makeCar} from './car.js?v=replay-share2';
import {projectDistrict,prepareReplay,replayPoint,followView,pursuitPoint,driveHeading} from './camera.js?v=replay-share2';
const $ = id => document.getElementById(id);
const clock = n => [Math.floor(n/60),Math.floor(n)%60].map(v=>String(v).padStart(2,'0')).join(':');
const number = n => n.toLocaleString('ru-RU',{maximumFractionDigits:1});
const query=new URLSearchParams(location.search);
const look=['light','atlas'].includes(query.get('look'))?query.get('look'):'main';
document.documentElement.dataset.look=look;
const board=query.has('compare') && parent!==window && document.referrer.startsWith(location.origin+'/')?parent.routeComparison:null;
if(board)document.documentElement.dataset.embedded='';
const replayDuration=12000;
const linkedDay=records.find(record=>record.day===query.get('day'));
const atSeconds=Number(query.get('at'));
const openAtFrame=!board && linkedDay && query.has('at') && Number.isFinite(atSeconds);
let day=board?records.at(-1):(linkedDay||records[0]);
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
  const next=await (board?board.loadCity(requested.area):loadCity(requested.area));
  if(requested!==day)return;
  if(city && city!==next)city.tiles.clear();
  city=next;timeline();if(board)board.ready(window);else if(autoplay)start();
}
const portrait=asset('../../assets/people/live-1.webp');
const arrows=asset('../../assets/pin/arrows.png');
const reverseArrows=asset('../../assets/tails/arrows-reverse.png');
const flame=asset('../../assets/pin/fire-trail-atlas.webp');
const brandLogo=asset('../../assets/brand/logo.png');
const routes=new Map(records.map(r=>[r,prepareReplay(r)]));
const gaps=new Map([...routes].map(([d,r])=>[d,[...new Set(r.runs)].filter(run=>run?.gap)]));
const uiFamily=getComputedStyle(document.body).fontFamily;
const navigators=new Map([...routes].map(([d,r])=>[d,overviewNavigator(r.runs)]));
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
try { paintCar=board?board.car():makeCar(); }
catch(error) { console.warn('3D автомобиля недоступно',error); }
function fitPhone(){
  const zoom=innerWidth<=480?1:Math.min(1,(innerHeight-36)/844);
  document.documentElement.style.setProperty('--phone-zoom',zoom);
}
fitPhone();
window.addEventListener('resize',fitPhone);
const icons=Object.fromEntries(Object.values(zoneArt).map(([,src])=>[src,asset(src)]));
const loaded=img=>img?.complete && img.naturalWidth;
const mix=(a,b,t)=>a+(b-a)*t;
const modeLabel=pos=>pos.gap?'нет сигнала':({drive:'на машине',walk:'пешком',still:'на месте'}[pos.mode]);
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
function drawStoryPlace(ctx,spot,stop,unit){
  const [name,src]=place(stop);
  ctx.save();ctx.translate(spot.x,spot.y);ctx.scale(unit,unit);
  ctx.fillStyle='#cc9eff';
  ctx.beginPath();ctx.arc(0,0,src?4.5:6,0,2*Math.PI);ctx.fill();
  if(src){
    if(loaded(icons[src]))ctx.drawImage(icons[src],-21.5,-50,43,43);
    ctx.font='700 12px '+uiFamily;
    let label=name;
    while(label.length>1 && ctx.measureText(label+(label===name?'':'…')).width>94)label=label.slice(0,-1);
    if(label!==name)label+='…';
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
  ctx.letterSpacing='0px';ctx.font='650 13px '+uiFamily;
  ctx.fillText($('summary').textContent,16,70,width-32);
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
  const view=followView(day,sample,p,height);
  if(look!=='atlas')return view;
  const now=sample(p),ahead=sample(Math.min(1,p+.055));
  const dx=(ahead.x-now.x)*view.scale,dy=(ahead.y-now.y)*view.scale;
  const k=Math.min(.65,76/Math.max(1,Math.hypot(dx,dy)));
  const cx=view.cx+dx*k/view.scale,cy=view.cy+dy*k/view.scale;
  const scale=view.scale*.86;
  return {scale,cx,cy,at(q){return {x:300+(q.x-cx)*scale,y:height*.58+(q.y-cy)*scale}}};
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
  if(city)drawCity(ctx,city,view,unitsY);
  if(look==='light'){
    const reach=370/view.scale;
    const halo=ctx.createRadialGradient(pos.x,pos.y,0,pos.x,pos.y,reach);
    halo.addColorStop(0,'rgba(149,90,225,.17)');halo.addColorStop(.5,'rgba(29,20,56,.18)');halo.addColorStop(1,'rgba(12,10,29,.55)');
    ctx.fillStyle=halo;
    ctx.fillRect(view.cx-300/view.scale,view.cy-unitsY*.58/view.scale,600/view.scale,unitsY/view.scale);
  }
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.strokeStyle=ctx.shadowColor='#cc9eff';ctx.lineWidth=4.3/view.scale;
  ctx.shadowBlur=5;
  if(look==='light')drawLightTrail(ctx,routePaths(),pos,view.scale,navigators.get(day).runs);
  else ctx.stroke(routePaths());
  ctx.restore();
  const mist=ctx.createLinearGradient(0,0,0,unitsY*.45);
  mist.addColorStop(0,'rgba(14,24,44,.42)');mist.addColorStop(1,'rgba(22,35,58,0)');
  ctx.fillStyle=mist;ctx.fillRect(0,0,600,unitsY*.45);ctx.restore();
  for(const {stop,marker} of markerData){
    const spot=view.at(projectDistrict(day,stop));
    if(story){
      if(spot.y<20 || spot.y>unitsY-28 || spot.x<0 || spot.x>600)continue;
      drawStoryPlace(ctx,spot,stop,unit);
    }else{
      marker.style.left=spot.x/6+'%';marker.style.top=spot.y/unitsY*100+'%';
      marker.hidden=spot.x<0||spot.x>600||spot.y<0||spot.y>unitsY;
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
      paintCar(ctx,patrol.x,patrol.y,follower.heading,p*175,beacon);
      ctx.restore();
    }
  }
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
  if(look==='atlas')navigators.get(day)(ctx,pos,unitsY,p);
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
    $('seek').setAttribute('aria-valuetext',clock(pos.time)+', '+modeLabel(pos)+', '+pos.speed+' км/ч');
  }
  drawJammer(ctx,gaps.get(day),p,replayDuration,unitsY,reducedMotion.matches);
  if(story)drawStoryText(ctx,pos,unitsY,unit);
  ctx.restore();
}
function render(){
  if($('map').width===0 || $('map').height===0)return;
  draw($('map'),progress);
  const s=sample(progress);$('seek').value=Math.round(progress*1000);$('current').textContent=clock(s.time);$('play').dataset.playing=String(playing);$('play').setAttribute('aria-label',playing?'Пауза':'Воспроизвести маршрут');
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
function pause(){
  playing=false;cancelAnimationFrame(frameRequest);render();
}
function start(){
  cancelAnimationFrame(frameRequest);
  if(progress>=1)progress=0;
  playing=true;previous=performance.now();render();
  frameRequest=requestAnimationFrame(tick);
}
$('play').onclick=()=>{closePlace();if(playing)pause();else start();syncComparison()};
$('seek').oninput=e=>{closePlace();progress=Number(e.target.value)/1000;pause();syncComparison()};
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
$('clock').onclick=()=>{
  $('time-picker').hidden=!$('time-picker').hidden;
  $('clock').setAttribute('aria-expanded',String(!$('time-picker').hidden));
  closePlace();
};
function showPlace(s){
  selectedFix=s;
  const nearest=day.fixes.reduce((a,b)=>Math.abs(a.t-s.t)<Math.abs(b.t-s.t)?a:b);
  progress=routes.get(day).points[day.fixes.indexOf(nearest)].replay;pause();syncComparison();
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
  $('time-picker').hidden=true;$('clock').setAttribute('aria-expanded','false');
}
function stepLabel(n){
  if(n%100>=11 && n%100<=14)return 'шагов';
  if(n%10===1)return 'шаг';
  return n%10>=2 && n%10<=4?'шага':'шагов';
}
function visiblePlaces(){
  const visible=[...day.stops];
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
  $('summary').textContent=number(day.steps)+' '+stepLabel(day.steps)+' · '+number(day.km)+' км · макс. '+day.peak+' км/ч';
  $('district').textContent=day.title;
  $('time-range').textContent=day.weekday+' · '+clock(day.fixes[0].t/60)+' — '+clock(day.fixes.at(-1).t/60);
  $('places').replaceChildren();markerData=[];
  visiblePlaces().forEach(s=>{
    const [name,src]=place(s),marker=document.createElement('button');
    marker.className='place';marker.style.left=s.x+'%';marker.style.top=s.y+'%';
    marker.classList.toggle('near-left',s.x<20);marker.classList.toggle('near-right',s.x>80);
    marker.innerHTML='<span class="place-dot"></span><span class="tag"><strong></strong></span>';
    if(src){const img=new Image();img.src=src;img.alt='';marker.prepend(img)}
    else marker.classList.add('uncertain');
    marker.querySelector('strong').textContent=name;
    if(!src)marker.querySelector('.tag').remove();
    marker.setAttribute('aria-label',name+', '+clock(s.t/60));
    markerData.push({stop:s,marker});marker.onclick=()=>showPlace(s);$('places').append(marker);
  });
  render();
}
function updateDate(){
  const index=records.indexOf(day);
  $('date').textContent=day.day;
  $('older').disabled=index===records.length-1;
  $('newer').disabled=index===0;
}
function changeDay(delta){
  const next=records[records.indexOf(day)+delta];
  if(!next)return;
  day=next;
  selectedFix=null;
  progress=0;
  $('time-picker').hidden=true;$('clock').setAttribute('aria-expanded','false');
  updateDate();if(board)board.changeDay(window,records.indexOf(day));openDay();
}
$('older').onclick=()=>changeDay(1);
$('newer').onclick=()=>changeDay(-1);
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
let sheetOpener;
function openSheet(sheet){
  sheetOpener=document.activeElement;
  $('screen').inert=true;$('scrim').hidden=false;sheet.show();
  sheet.querySelector('.close').focus();
}
for(const sheet of document.querySelectorAll('dialog')){
  sheet.addEventListener('close',()=>{
    $('screen').inert=false;$('scrim').hidden=true;sheetOpener?.focus();
  });
  sheet.addEventListener('keydown',event=>{
    if(event.key==='Escape')sheet.close();
    if(event.key!=='Tab')return;
    const items=[...sheet.querySelectorAll('button:not(:disabled),input')].filter(el=>el.offsetWidth);
    const first=items[0],last=items.at(-1);
    if(event.shiftKey && document.activeElement===first){last.focus();event.preventDefault();}
    if(!event.shiftKey && document.activeElement===last){first.focus();event.preventDefault();}
  });
}
$('scrim').onclick=()=>document.querySelector('dialog[open]')?.close();
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
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
  pause();syncComparison();
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
function syncComparison(){if(board)board.seek(window,progress,playing)}
if(board){
  window.routeDemo={
    seek(value,run){progress=value;run?start():pause()},
    day(index){day=records[index];progress=0;selectedFix=null;closePlace();updateDate();openDay()}
  };
}
openDay(!openAtFrame);
if(openAtFrame)stickerReady.then(render);

new ResizeObserver(()=>{
  const canvas=$('map');
  const density=Math.min(3,Math.max(2,window.devicePixelRatio||1));
  canvas.width=Math.round($('screen').clientWidth*density);
  canvas.height=Math.round($('screen').clientHeight*density);
  render();
}).observe($('screen'));
