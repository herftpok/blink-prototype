(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const channel='blink-gorky-park';
  const origin=location.origin==='null'?'*':location.origin;
  const post=(type,extra={})=>window.parent.postMessage({channel,type,...extra},origin);
  const rules=new Intl.PluralRules('ru-RU');
  const plural=(n,one,few,many)=>({one,few,many,other:many})[rules.select(n)];
  const data=window.parkData;
  const el=(tag,cls,text)=>{
    const node=document.createElement(tag);
    if(cls) node.className=cls;
    if(text!=null) node.textContent=text;
    return node;
  };
  const photo=name=>'../../assets/gorky-park/photos/'+name+'.webp';
  const sticker=name=>'../../assets/stickers/'+name+'.webp';
  let state=null, waiting=false, lastFeed='', lastKey='', opened=null, sheetFrom=null;
  const field=$('draft'), sheet=$('sheet'), scrim=$('scrim');

  function avatar(person,size){
    const wrap=el('span','avatar');
    if(size) wrap.style.setProperty('--avatar-size',size+'px');
    wrap.setAttribute('aria-hidden','true');
    const initial=()=>{wrap.replaceChildren(el('span','avatar__img park-initial',person.name[0]));};
    if(!person.photo){ initial();return wrap; }
    const img=el('img','avatar__img'); img.alt='';
    img.addEventListener('error',initial,{once:true});
    img.src='../../assets/people/'+person.photo+'.webp';wrap.append(img);
    return wrap;
  }
  function faces(node,ids){
    node.replaceChildren(...ids.slice(0,3).map(id=>{
      const person=state.people[id];
      if(!person.photo) return el('span','face-stack__img park-initial park-initial--small',person.name[0]);
      const img=el('img','face-stack__img'); img.alt=''; img.src='../../assets/people/'+person.photo+'.webp';
      return img;
    }));
  }
  const isFriend=id=>data.friends.includes(id);
  const sorted=()=>[...state.visitors].sort((a,b)=>(b===state.identity)-(a===state.identity) || isFriend(b)-isFriend(a));
  const name=id=>id===state.identity?'ты':state.people[id].name;

  function personRow(id){
    const row=el('li','park-person'), info=el('div','park-person__info'), person=state.people[id];
    info.append(el('strong','',person.name+(id===state.identity?' · ты':'')),el('small','','@'+person.handle));
    row.append(avatar(person,56),info);
    return row;
  }
  function updatePeople(){
    const order=sorted();
    $('crowd').replaceChildren(...order.slice(0,7).map(id=>{
      const item=el('li','park-crowd__item');
      item.append(avatar(state.people[id],56),el('span','park-crowd__name',name(id)));
      return item;
    }));
    if(order.length){
      const all=el('li','park-crowd__item'), button=el('button','park-crowd__all pressable');
      button.type='button'; button.id='show-all';
      const eyes=el('img','park-crowd__eyes'); eyes.src=sticker('eyes'); eyes.alt='';
      button.append(eyes,el('span','park-crowd__name','все '+order.length));
      button.onclick=()=>post('people');
      all.append(button); $('crowd').append(all);
    }
    $('empty').hidden=order.length>0;
    $('count').textContent=order.length;
    $('chat-count').textContent=order.length+' '+plural(order.length,'человек','человека','человек')+' в парке';
    faces($('chat-faces'),order);
    const friends=order.filter(isFriend), others=order.filter(id=>!isFriend(id));
    $('friends-list').replaceChildren(...friends.map(personRow));
    $('others-list').replaceChildren(...others.map(personRow));
    $('friends-title').hidden=!friends.length; $('friends-count').textContent=friends.length;
    $('others-title').hidden=!others.length; $('others-count').textContent=others.length;
    $('others-title').firstChild.textContent=friends.length?'ещё ':'гости ';
  }

  const goingLine=list=>(list.length===1?'идёт ':'идут ')+list.length;
  function card(item,i){
    const li=el('li','park-afisha__item'), button=el('button','park-event pressable');
    button.type='button'; button.dataset.id=item.id;
    button.style.setProperty('--tilt',(i%2?1.6:-1.6)+'deg');
    const poster=el('span','park-event__poster');
    const img=el('img','park-event__photo'); img.alt=''; img.src=photo(item.photos[0]); img.loading='lazy';
    poster.append(img,el('span','park-tag'+(item.news?' park-tag--news':''),item.tag));
    button.append(poster,el('strong','park-event__title',item.title),el('span','park-event__meta',item.news?'новость парка':item.when+' · '+item.where));
    if(!item.news){
      const going=el('span','park-event__going'), stack=el('span','face-stack');
      const list=state.going[item.id]||[];
      faces(stack,list);
      going.append(stack,el('span','',goingLine(list)));
      if(list.includes(state.identity)) going.classList.add('is-mine');
      if(list.length) button.append(going);
    }
    button.onclick=()=>openSheet(item.id,button);
    li.append(button); return li;
  }
  const items=()=>[...(state.news?[{id:'news',news:true,tag:'новость',title:state.news.title,text:state.news.text,photos:data.news.photos,sticker:'eyes'}]:[]),...data.events];
  function updateAfisha(){ $('afisha').replaceChildren(...items().map(card)); }

  function openSheet(id,from){
    const item=items().find(x=>x.id===id);
    if(!item) return;
    opened=id; sheetFrom=from||null;
    fillSheet();
    sheet.classList.add('is-open'); scrim.classList.add('is-open');
    for(const screen of [$('home'),$('chat'),$('people-screen')]) screen.inert=true;
    sheet.focus({preventScroll:true});
  }
  function fillSheet(){
    const item=items().find(x=>x.id===opened);
    if(!item){ closeSheet(); return; }
    if($('sheet-photos').dataset.id!==item.id){
      $('sheet-photos').dataset.id=item.id;
      $('sheet-photos').replaceChildren(...item.photos.map(name=>{
        const li=el('li','park-gallery__slide'), img=el('img','park-gallery__photo');
        img.alt=''; img.src=photo(name); li.append(img); return li;
      }));
      $('sheet-photos').scrollLeft=0;
      $('sheet-dots').replaceChildren(...item.photos.map((_,i)=>el('i',i?'':'is-on')));
      $('sheet-dots').hidden=item.photos.length<2;
    }
    $('sheet-tag').textContent=item.tag;
    $('sheet-tag').classList.toggle('park-tag--news',Boolean(item.news));
    $('sheet-sticker').src=sticker(item.sticker);
    $('sheet-title').textContent=item.title;
    $('sheet-text').textContent=item.text;
    const action=$('sheet-action');
    if(item.news){
      $('sheet-when').textContent='';
      $('sheet-chips').hidden=true;
      $('sheet-going').hidden=true;
      action.hidden=true;
    } else {
      action.hidden=false;
      const list=state.going[item.id]||[], mine=list.includes(state.identity);
      $('sheet-when').textContent=item.when;
      $('sheet-where').textContent=item.where;
      $('sheet-price').textContent=item.price;
      $('sheet-age').textContent=item.age;
      $('sheet-chips').hidden=false;
      $('sheet-going').hidden=!list.length;
      faces($('sheet-faces'),list);
      $('sheet-going-label').textContent=goingLine(list);
      action.className='button '+(mine?'button--secondary is-done':'button--primary')+' park-wide pressable';
      action.replaceChildren(...(mine?[check(),document.createTextNode('иду')]:[document.createTextNode('пойду')]));
    }
  }
  function check(){ const i=el('i','icon icon--check'); i.setAttribute('aria-hidden','true'); return i; }
  function closeSheet(){
    if(!opened) return;
    opened=null;
    sheet.classList.remove('is-open'); scrim.classList.remove('is-open');
    sheet.style.transform='';
    applyView();
    sheetFrom?.focus({preventScroll:true});
  }
  $('sheet-action').onclick=()=>post('going',{id:opened});
  // Точки под каруселью идут за прокруткой.
  $('sheet-photos').addEventListener('scroll',()=>{
    const track=$('sheet-photos'), index=Math.round(track.scrollLeft/track.clientWidth);
    [...$('sheet-dots').children].forEach((dot,i)=>dot.classList.toggle('is-on',i===index));
  },{passive:true});
  scrim.onclick=closeSheet;
  // Шторку тянут вниз за грэббер: идёт за пальцем, отпустили ниже трети – закрывается.
  let pull=null;
  $('sheet-handle').addEventListener('pointerdown',ev=>{ pull=ev.clientY; sheet.classList.add('is-dragging'); $('sheet-handle').setPointerCapture(ev.pointerId); });
  $('sheet-handle').addEventListener('pointermove',ev=>{ if(pull!=null) sheet.style.transform='translateY('+Math.max(0,ev.clientY-pull)+'px)'; });
  const drop=ev=>{
    if(pull==null) return;
    const moved=ev.clientY-pull; pull=null;
    sheet.classList.remove('is-dragging'); sheet.style.transform='';
    if(moved>sheet.offsetHeight/3) closeSheet();
  };
  $('sheet-handle').addEventListener('pointerup',drop);
  $('sheet-handle').addEventListener('pointercancel',drop);

  function updateGame(){
    const rows=Object.entries(state.stars).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1] || (a[0]===state.identity)-(b[0]===state.identity)).slice(0,4);
    $('board').replaceChildren(...rows.map(([id,n],i)=>{
      const row=el('li','park-board__row'+(id===state.identity?' is-mine':''));
      const score=el('span','park-board__score');
      const star=el('img','park-board__star'); star.src=sticker('blink'); star.alt='';
      score.append(el('b','',String(n)),star);
      row.append(avatar(state.people[id]),el('strong','park-board__name',name(id)),score);
      return row;
    }));
    tick();
  }
  function tick(){
    if(!state?.game) return;
    const landed=state.game.mode==='landed';
    $('game-next-label').textContent=landed?'звезда уже в парке':'следующая через';
    $('game-timer').hidden=landed;
    const left=Math.max(0,Math.round((state.game.until-Date.now())/1000));
    $('game-timer').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
  }
  setInterval(tick,1000);

  function updateCheckins(){
    $('checkins-count').textContent=state.checkins.length;
    $('checkins').replaceChildren(...state.checkins.map(item=>{
      const li=el('li','park-checkin');
      const img=el('img','park-checkin__photo'); img.alt=''; img.src=photo(item.photo); img.loading='lazy';
      const by=el('span','park-checkin__by');
      by.append(avatar(state.people[item.by],32));
      by.setAttribute('aria-label',name(item.by));
      li.append(img,by); return li;
    }));
  }
  function updateStatic(){
    $('address').textContent=data.address; $('route-address').textContent='москва, '+data.address;
    $('about').textContent=data.about;
    $('hours').replaceChildren(...data.hours.flatMap(row=>[el('dt','',row.name),el('dd','',row.time)]));
  }

  function updateMessages(opening){
    const {messages,people,identity}=state;
    const key=identity+'|'+messages.map(m=>m.id).join('|');
    const log=$('chat-scroll');
    if(key!==lastFeed){
      const pinned=log.scrollHeight-log.scrollTop-log.clientHeight<70 || messages.at(-1)?.author===identity;
      lastFeed=key;
      $('messages').replaceChildren(...messages.map((m,i)=>{
        const mine=m.author===identity, person=people[m.author], follows=messages[i-1]?.author===m.author;
        const row=el('div','park-msg'+(mine?' park-msg--mine':'')+(follows?' is-continued':''));
        if(!mine) row.append(follows?el('span','park-msg__gap'):avatar(person,32));
        const body=el('div','park-msg__body');
        if(!follows){
          const byline=el('span','park-msg__name',mine?'':person.name);
          byline.append(el('time','park-msg__time',m.time));
          body.append(byline);
        }
        body.append(el('p','bubble '+(mine?'bubble--out':'bubble--in'),m.text));row.append(body);return row;
      }));
      const last=messages.at(-1);
      $('latest').textContent=last?(last.author===identity?'ты':people[last.author].name)+': '+last.text:'начать переписку';
      if(pinned) log.scrollTop=log.scrollHeight;
    }
    if(opening) log.scrollTop=log.scrollHeight;
  }
  function syncSend(){ $('send').disabled=waiting || state?.zone!=='inside' || !field.value.trim(); }
  function sizeField(){field.style.height='auto';field.style.height=Math.min(field.scrollHeight,110)+'px';}
  function applyView(){
    const view=state.view, sheetOpen=Boolean(opened);
    $('home').hidden=view!=='park'; $('chat').hidden=view!=='chat'; $('people-screen').hidden=view!=='people';
    for(const screen of [$('home'),$('chat'),$('people-screen')]) screen.inert=sheetOpen;
  }
  function render(next){
    const previous=state;
    state=next;
    document.body.dataset.framed=String(state.framed);
    document.body.dataset.zone=state.zone;
    const inChat=state.view==='chat', inside=state.zone==='inside';
    applyView();
    $('compose').hidden=!inside;field.disabled=!inside;
    if(!inside && document.activeElement===field) field.blur();
    $('locked').hidden=inside;
    syncSend();
    // Списки перерисовываются только когда меняются их данные: иначе карусели прыгают при каждом сообщении.
    const key=JSON.stringify([state.identity,state.visitors,state.going,state.stars,state.news,state.checkins,state.checked,state.zone,state.follow]);
    if(key!==lastKey){
      lastKey=key;
      updatePeople();updateAfisha();updateGame();updateCheckins();
      if(opened) fillSheet();
    }
    tick();
    updateMessages(inChat && previous?.view!=='chat');
    if(state.view!==previous?.view){
      if(inChat) $('chat-title').focus({preventScroll:true});
      else if(state.view==='people') $('people-title').focus({preventScroll:true});
      else if(state.view==='park' && previous?.view==='chat') $('open-chat').focus({preventScroll:true});
      else if(state.view==='park' && previous?.view==='people') $('show-all')?.focus({preventScroll:true});
      else if(state.view==='park') { $('page-scroll').scrollTop=0; $('home').focus({preventScroll:true}); }
    }
    if(state.scrollVisitors){
      $('visitors-title').scrollIntoView({block:'start'});
      $('visitors-title').focus({preventScroll:true});
    }
    if(state.openNews && state.news){
      $('afisha-title').scrollIntoView({block:'start'});
      openSheet('news',null);
    }
  }
  window.addEventListener('message',ev=>{
    if(ev.source!==window.parent || ev.origin!==location.origin || ev.data?.channel!==channel)return;
    if(ev.data.type==='hello')post('ready');
    if(ev.data.type==='state')render(ev.data);
    if(ev.data.type==='sent'){
      if(ev.data.accepted){field.value='';sizeField();}
      waiting=false;syncSend();
    }
  });
  updateStatic();
  // Затемнение под крестиком нужно, только когда лента ушла под него: в начале оно гасило бы свечение шапки.
  $('page-scroll').addEventListener('scroll',()=>document.body.classList.toggle('is-scrolled',$('page-scroll').scrollTop>24),{passive:true});
  $('open-chat').onclick=()=>post('chat');
  $('back').onclick=$('people-back').onclick=()=>post('back');
  $('close-park').onclick=$('close-chat').onclick=$('people-close').onclick=()=>post('close');
  $('show-people').onclick=()=>post('visitors');
  $('route').onclick=()=>post('route');
  $('compose').addEventListener('submit',ev=>{
    ev.preventDefault();
    if(state?.zone!=='inside'||state.view!=='chat'||waiting||!field.value.trim())return;
    waiting=true;syncSend();post('send',{text:field.value});
  });
  field.addEventListener('input',()=>{sizeField();syncSend();});
  field.addEventListener('keydown',ev=>{
    if(ev.key==='Enter' && !ev.shiftKey && !ev.isComposing){ev.preventDefault();$('compose').requestSubmit();}
  });
  window.addEventListener('keydown',ev=>{
    if(ev.key!=='Escape') return;
    ev.preventDefault();
    if(opened) closeSheet(); else post('back');
  });
  let edge=null;
  window.addEventListener('touchstart',ev=>{
    const p=ev.touches[0];edge=p.clientX<24?[p.clientX,p.clientY]:null;
  },{passive:true});
  window.addEventListener('touchend',ev=>{
    const p=ev.changedTouches[0];
    if(edge && !opened && p.clientX-edge[0]>75 && Math.abs(p.clientY-edge[1])<45)post('back');
    edge=null;
  },{passive:true});
  post('ready');
})();
