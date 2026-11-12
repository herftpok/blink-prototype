import { createParkMap } from './map-camera.js';

(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const phone=$('phone'), canvas=$('canvas'), world=$('world'), entry=$('entry'), frame=$('frame');
  const mobile=matchMedia('(max-width:680px)');
  const origin=location.origin==='null' ? '*' : location.origin;
  const guest=new URLSearchParams(location.search).get('visitor')==='leva' ? 'leva':'sasha';
  // Та же проекция, что у park-map.svg и контура OSM 2791365.
  const project=(lon,lat)=>[(lon-37.5855)*45000,(55.7407-lat)*80000];
  const positions={inside:project(37.60182,55.7300),near:project(37.6038,55.7326),far:project(37.5889,55.7355)};
  // Центр колоннады главного входа, объект OSM 6913335.
  const venue=project(37.603423,55.731438);
  const hints={inside:'Гость в парке: чат, чекин и игра открыты.',near:'Парк виден на карте. Чат, чекин и игра – только с территории.',far:'Парк далеко, на карте его нет. Страница откроется из пуша.'};
  // Куда падают звёзды: клумбы партера, памятник Горькому, обсерватория, причал.
  const spots=[[704,792],[748,868],[742,756],[852,830],[690,850]];
  const rules=new Intl.PluralRules('ru-RU');
  const plural=(n,one,few,many)=>({one,few,many,other:many})[rules.select(n)];
  const ROUND=15*60*1000;
  // В парке камера держит всю ось: вход сверху справа, фонтан снизу слева.
  const baseCamera={inside:[venue[0]-44,venue[1]+70], near:[venue[0]+10,venue[1]-20],far:positions.far};
  const locationKey='blink:gorky-park:location:'+guest;
  let preset='inside';
  try { const saved=sessionStorage.getItem(locationKey); if(Object.hasOwn(positions,saved)) preset=saved; } catch { /* без хранилища */ }
  let point=positions[preset], zone=detect(point), view='map', ready=false, scrollVisitors=false, openNews=false;
  let game={mode:'waiting',until:Date.now()+252000,at:null,round:0}, walking=0, seenNews=null, pushTimer=0;
  const map=createParkMap(canvas,world,entry,venue);
  const channel='blink-gorky-park';
  function detect([x,y]) {
    let inside=false, min=Infinity;
    const ring=window.parkBoundary;
    for (let i=1;i<ring.length;i++) {
      const [ax,ay]=ring[i-1], [bx,by]=ring[i], dx=bx-ax,dy=by-ay;
      if ((ay>y)!==(by>y) && x<ax+(y-ay)*dx/dy) inside=!inside;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));
      min=Math.min(min, Math.hypot(x-ax-t*dx,y-ay-t*dy));
    }
    return inside?'inside':min*1.4<=250?'near':'far';
  }
  function drawPins(){
    const stars=parkRoom.snapshot().stars[guest]||0;
    const pins=[
      ['ты',guest==='leva'?'photo-3':'photo-1',point,52,true],
      ['вика','live-2',project(37.60405,55.72955),36,false],
      ['наташка','live-4',project(37.5991,55.7321),36,true],
      ['андрей','live-3',project(37.5984,55.7284),20,false]
    ];
    $('pins').innerHTML=pins.map(([name,photo,,size,online])=>BlinkPin.markup({
      tag:'span',name,size,online,flat:photo.startsWith('photo-'),
      ...(name==='ты' && stars?{sticker:String(stars),unit:plural(stars,'звезда','звезды','звёзд')}:{}),
      photo:'../../assets/people/'+photo+'.webp',assets:'../../assets'
    })).join('');
    map.setPins([...$('pins').children].map((node,i)=>[node,pins[i][2]]));
  }
  function post(extra={}) {
    if (ready) frame.contentWindow.postMessage({channel,type:'state',view,framed:!mobile.matches,game:{mode:game.mode,until:game.until},...parkRoom.snapshot(),...extra},origin);
  }
  function render(){
    const wasOpen=!$('web').hidden;
    entry.hidden=zone==='far';
    map.setActive(view==='map' && zone!=='far');
    $('hint').textContent=hints[zone];
    $('web').hidden=view==='map';
    $('map').inert=view!=='map';
    $('tabs').inert=view!=='map';
    phone.dataset.status=view==='map'?'dark':'light';
    phone.dataset.home=view==='map'?'dark':'light';
    if (wasOpen && view==='map') (entry.hidden?document.querySelector('.map__city'):entry).focus({preventScroll:true});
    post({scrollVisitors,openNews});
    scrollVisitors=openNews=false;
    renderGame();
    const news=parkRoom.snapshot().news;
    if(seenNews===null) seenNews=news?.id||'';
    else if(news && news.id!==seenNews) { seenNews=news.id; deliver(news); }
  }
  // ── Игра «лови звезду»: звезда падает в точку парка, забирает тот, кто дошёл первым.
  function renderGame() {
    const landed=game.mode==='landed';
    $('star-drop').disabled=landed || game.mode==='falling';
    $('star-walk').disabled=!landed || zone!=='inside' || walking>0;
    $('star-lose').disabled=!landed || walking>0;
    map.setStar(zone==='far'?null:game.at, zone==='far'||game.mode==='waiting'?null:game.mode, ()=>{ game.mode='landed'; render(); });
  }
  function dropStar() {
    if(game.mode!=='waiting') return;
    game={mode:'falling',at:spots[game.round%spots.length],until:0,round:game.round+1};
    render();
  }
  function finishStar(winner) {
    map.setStar(game.at,'caught');
    game={mode:'waiting',at:null,until:Date.now()+ROUND,round:game.round};
    parkRoom.addStar(winner);
    drawPins(); render();
  }
  function walkToStar() {
    if(game.mode!=='landed' || zone!=='inside' || walking) return;
    const from=point, to=[game.at[0]+7,game.at[1]+9], start=performance.now();
    map.center(to);
    const step=now=>{
      const t=Math.min(1,(now-start)/900), f=1-(1-t)**3;
      point=[from[0]+(to[0]-from[0])*f,from[1]+(to[1]-from[1])*f];
      drawPins();
      if(t<1) walking=requestAnimationFrame(step); else { walking=0; finishStar(guest); }
    };
    walking=requestAnimationFrame(step);
    renderGame();
  }
  setInterval(()=>{ if(game.mode==='waiting' && Date.now()>=game.until) dropStar(); },1000);
  // ── Пуш от парка: приходит тем, кто бывал здесь или сейчас рядом. Нажатие открывает новость.
  function receives(audience) {
    const visited=parkRoom.snapshot().visited;
    return (audience.visited && visited) || (audience.near && zone!=='far');
  }
  function deliver(news) {
    if(!receives(news.audience)) return;
    $('push-title').textContent=news.title;
    $('push-text').textContent=news.text;
    $('push').classList.add('is-shown');
    clearTimeout(pushTimer);
    pushTimer=setTimeout(()=>$('push').classList.remove('is-shown'),6000);
  }
  function newsHint() {
    const audience={visited:$('aud-visited').checked,near:$('aud-near').checked};
    $('news-send').disabled=!audience.visited && !audience.near;
    $('news-hint').textContent=!audience.visited && !audience.near?'Выбери, кому отправить.'
      :receives(audience)?'Этому гостю пуш придёт. Новость встанет первой в афише.'
      :'Этому гостю пуш не придёт: он далеко и ещё не бывал в парке. Новость всё равно встанет в афишу.';
  }
  function setView(next, replace=false, invited=false) {
    if (!['park','chat','people'].includes(next)) next='map';
    // Издалека парка на карте нет: страницу открывает только пуш.
    if (view==='map' && next!=='map' && zone==='far' && !invited) return;
    const url=next==='map'?location.pathname+location.search:'#'+next;
    if (view!==next) history[replace?'replaceState':'pushState']({parkView:next},'',url);
    view=next;render();
  }
  function back() {
    if (view==='map') return;
    if (history.state?.parkView) history.back();
    else setView(view==='park'?'map':'park',true);
  }
  function closeWeb() {
    if (history.state?.parkView) history.go(view==='park'?-1:-2);
    else setView('map',true);
  }
  entry.addEventListener('click',()=>setView('park'));
  window.addEventListener('popstate',()=>{
    const target=location.hash.slice(1);
    view=zone==='far' && view==='map'?'map':['chat','park','people'].includes(target)?target:'map';
    render();
  });
  window.addEventListener('keydown',ev=>{if(ev.key==='Escape') back();});
  window.addEventListener('message',ev=>{
    if(ev.source!==frame.contentWindow || ev.origin!==location.origin || ev.data?.channel!==channel) return;
    const {type}=ev.data;
    if(type==='ready') {ready=true;post();return;}
    if(view==='map') return;
    if(type==='chat' && view==='park') setView('chat');
    if(type==='people' && view==='park') setView('people');
    if(type==='going') parkRoom.toggleGoing(ev.data.id);
    if(type==='route') { closeWeb(); map.center(venue); }
    if(type==='visitors' && view==='chat') {scrollVisitors=true;back();}
    if(type==='back') back();
    if(type==='close') closeWeb();
    if(type==='send' && view==='chat') {
      const accepted=parkRoom.send(ev.data.text);
      frame.contentWindow.postMessage({channel,type:'sent',accepted},origin);
    }
  });
  document.querySelectorAll('[name=zone]').forEach(input=>input.addEventListener('change',()=>{
    cancelAnimationFrame(walking); walking=0;
    point=positions[input.value]; zone=detect(point);
    try { sessionStorage.setItem(locationKey,input.value); } catch { /* без хранилища */ }
    map.center(baseCamera[zone]); drawPins(); parkRoom.move(zone); newsHint();
  }));
  $('star-drop').addEventListener('click',dropStar);
  $('star-walk').addEventListener('click',walkToStar);
  $('star-lose').addEventListener('click',()=>{ if(game.mode==='landed') finishStar('vika'); });
  $('push').addEventListener('click',()=>{
    $('push').classList.remove('is-shown');
    openNews=true;
    if(view==='map') setView('park',false,true); else render();
  });
  $('news-title').value=parkData.news.title; $('news-text').value=parkData.news.text;
  for(const id of ['aud-visited','aud-near']) $(id).addEventListener('change',newsHint);
  $('was-here').addEventListener('change',()=>{ parkRoom.setVisited($('was-here').checked); newsHint(); });
  $('cabinet').addEventListener('submit',ev=>{
    ev.preventDefault();
    const title=$('news-title').value.trim(), text=$('news-text').value.trim();
    if(!title || !text) return;
    parkRoom.publish({title,text,audience:{visited:$('aud-visited').checked,near:$('aud-near').checked}});
  });
  $('reset').addEventListener('click',()=>{
    cancelAnimationFrame(walking); walking=0;
    game={mode:'waiting',until:Date.now()+252000,at:null,round:0};
    seenNews='';
    parkRoom.reset(); $('was-here').checked=true; drawPins(); newsHint();
  });
  $('locate').addEventListener('click',()=>map.center(point));
  function fit(){
    document.documentElement.style.setProperty('--preview-scale',Math.max(0.45,Math.min(1,(innerHeight-52)/844)));
    post();
  }
  window.addEventListener('resize',fit);
  $('second').href=guest==='sasha'?'?visitor=leva':'?visitor=sasha';
  document.querySelector('[name=zone][value="'+preset+'"]').checked=true;
  const initial=location.hash.slice(1);
  if(['park','chat','people'].includes(initial) && zone!=='far') {
    if(!history.state?.parkView) {
      history.replaceState(null,'',location.pathname+location.search);
      history.pushState({parkView:'park'},'','#park');
      if(initial!=='park') history.pushState({parkView:initial},'','#'+initial);
    }
    view=initial;
  } else if(initial) history.replaceState(null,'',location.pathname+location.search);
  map.center(baseCamera[zone],false);
  parkRoom.start(guest,zone,render);
  frame.addEventListener('load',()=>frame.contentWindow.postMessage({channel,type:'hello'},origin));
  frame.contentWindow.postMessage({channel,type:'hello'},origin);
  $('was-here').checked=parkRoom.snapshot().visited;
  fit();drawPins(); render(); newsHint();
})();
