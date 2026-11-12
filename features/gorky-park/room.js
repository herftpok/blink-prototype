// Демо-комната на одном origin. Свой ключ у каждой записи: параллельные отправки не затирают друг друга.
(() => {
  'use strict';
  const prefix = 'blink:gorky-park:v1:';
  const people = {
    sasha: {name:'саша', handle:'sashka', photo:'photo-1'},
    leva: {name:'лёва', handle:'leva.zip', photo:'photo-3'},
    masha: {name:'маша', handle:'mashulka', photo:'masha'},
    vika: {name:'вика', handle:'vika.wav', photo:'photo-2'},
    natasha: {name:'наташка', handle:'natashka', photo:'natashka'},
    andrey: {name:'андрей зиновьев', handle:'andreyzin', photo:'photo-4'},
    dasha: {name:'даша', handle:'dasha', photo:'photo-5'},
    nikita: {name:'никита', handle:'nikitos', photo:null}
  };
  const fixtures = ['masha','vika','natasha','andrey','dasha','nikita'];
  const seeds = [
    ['vika','есть кто в парке? я только пришла', '14:12'],
    ['dasha','мы тут! гуляем у пруда', '14:15'],
    ['natasha','кто сейчас у главного входа?', '14:19'],
    ['vika','я у фонтана. хотите на набережную?', '14:21'],
    ['andrey','давайте! я как раз взял кофе', '14:23'],
    ['masha','мы у колонн, подождём вас тут', '14:28']
  ].map(([author,text,time],i) => ({id:'seed'+i, author,text,time}));
  const memory = new Map();
  const uid = () => window.crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2);
  const session = 'presence:' + uid();
  let identity, zone, notify;
  function write(key, value) {
    memory.set(key,value);
    try { localStorage.setItem(prefix+key, JSON.stringify(value)); } catch { /* один экземпляр без хранилища */ }
  }
  function records() {
    const all = new Map(memory);
    try {
      for (let i=0; i<localStorage.length; i++) {
        const key=localStorage.key(i);
        if (key?.startsWith(prefix)) all.set(key.slice(prefix.length), JSON.parse(localStorage.getItem(key)));
      }
    } catch { /* частный просмотр с отключённым хранилищем */ }
    return all;
  }
  function beat() { write(session, {identity, zone, seen:Date.now()}); }
  function leave() {
    memory.delete(session);
    try { localStorage.removeItem(prefix+session); } catch { /* локальный режим */ }
  }
  function snapshot() {
    const active=new Set(fixtures), messages=[];
    for (const [key,data] of records()) {
      if (key.startsWith('presence:') && people[data?.identity] && data.zone==='inside' && Date.now()-data.seen < 75000) active.add(data.identity);
      if (key.startsWith('message:') && people[data?.author] && typeof data.text==='string') messages.push(data);
    }
    messages.sort((a,b)=>a.at-b.at || a.id.localeCompare(b.id));
    return {people, visitors:[...active], messages:seeds.concat(messages), identity, zone, ...place()};
  }
  // Всё, что гость делает на странице места: подписка, «пойду», чекин, звёзды игры, новость парка.
  function place() {
    const all=records(), data=window.parkData;
    const going={}, stars={...data.stars}, checkins=[];
    for (const event of data.events) going[event.id]=[...event.going];
    let news=null;
    for (const [key,value] of all) {
      const [kind,who]=key.split(':');
      if (kind==='going' && people[who]) for (const id of value) if (going[id] && !going[id].includes(who)) going[id].push(who);
      if (kind==='stars' && people[who]) stars[who]=(data.stars[who]||0)+value;
      if (kind==='checkin' && people[who]) checkins.push({id:'own-'+who, by:who, photo:data.myCheckin, ago:value.time, at:value.at});
      if (kind==='news') news=value;
    }
    checkins.sort((a,b)=>b.at-a.at);
    return {
      follow:Boolean(all.get('follow:'+identity)), visited:all.get('visited:'+identity)!==false,
      going, stars, news, checkins:checkins.concat(data.checkins.filter(c=>c.by!==identity)),
      checked:all.has('checkin:'+identity)
    };
  }
  const mine=(kind)=>kind+':'+identity;
  function toggleFollow() { write(mine('follow'), !records().get(mine('follow'))); notify(); }
  function toggleGoing(id) {
    const list=records().get(mine('going'))||[];
    write(mine('going'), list.includes(id)?list.filter(x=>x!==id):[...list,id]); notify();
  }
  function checkIn() {
    if (zone!=='inside' || records().has(mine('checkin'))) return false;
    const at=Date.now();
    write(mine('checkin'), {at, time:new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(at)});
    notify(); return true;
  }
  function addStar(who) { write('stars:'+who, (records().get('stars:'+who)||0)+1); notify(); }
  function setVisited(value) { write(mine('visited'), value); notify(); }
  function publish(news) { write('news', {...news, id:uid(), at:Date.now()}); notify(); }
  function reset() {
    memory.clear();
    try {
      for (let i=localStorage.length-1; i>=0; i--) {
        const key=localStorage.key(i);
        if (key?.startsWith(prefix)) localStorage.removeItem(key);
      }
    } catch { /* локальный режим */ }
    beat(); notify();
  }
  function send(value) {
    const text = String(value || '').trim().slice(0,1500);
    if (zone!=='inside' || !text) return false;
    const at=Date.now(), id=uid();
    const time=new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit'}).format(at);
    write('message:'+id, {id,author:identity,text,at,time});
    notify();
    return true;
  }
  function start(person, location, render) {
    identity=person; zone=location; notify=render;
    beat();
    window.addEventListener('storage', e=>{ if (!e.key || e.key.startsWith(prefix)) notify(); });
    window.addEventListener('pagehide',leave);
    window.addEventListener('pageshow',()=>{beat();notify();});
    window.setInterval(()=>{beat();notify();},20000);
  }
  function move(location) { zone=location; beat(); notify(); }
  window.parkRoom={start, move, send, snapshot, toggleFollow, toggleGoing, checkIn, addStar, setVisited, publish, reset};
})();
