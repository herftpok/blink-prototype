// One current record per day. Seeding and replacing records are atomic across tabs.
export async function openRoutes() {
  const db = await new Promise((resolve,reject)=>{
    const request = indexedDB.open('blink.tracks.routes',1);
    request.onupgradeneeded = ()=>{
      request.result.createObjectStore('days',{keyPath:'day'});
    };
    request.onsuccess = ()=>resolve(request.result);
    request.onerror = ()=>reject(request.error);
  });
  // Add new demo dates without rebuilding previously edited routes.
  await new Promise((resolve,reject)=>{
    const tx=db.transaction('days','readwrite'),store=tx.objectStore('days');
    const keys=store.getAllKeys();
    keys.onsuccess=()=>{
      const existing=new Set(keys.result);
      for(const config of scenarios)if(!existing.has(config.day))store.add(buildDay(config));
    };
    tx.oncomplete=resolve;
    tx.onabort=()=>reject(tx.error);
  });
  function readAll(){
    return new Promise((resolve,reject)=>{
      const request=db.transaction('days').objectStore('days').getAll();
      request.onsuccess=()=>{
        const days=new Map(request.result.map(d=>[d.day,d]));
        resolve(scenarios.map(s=>days.get(s.day)));
      };
      request.onerror=()=>reject(request.error);
    });
  }
  function replaceDay(key){
    return new Promise((resolve,reject)=>{
      const tx=db.transaction('days','readwrite'), store=tx.objectStore('days');
      const request=store.get(key);
      let next;
      request.onsuccess=()=>{
        next=distort(request.result);
        store.put(next);
      };
      tx.oncomplete=()=>resolve(next);
      tx.onabort=()=>reject(tx.error);
    });
  }
  return {readAll,replaceDay};
}

function distort(day){
  const fixes=day.fixes;
  const moving=fixes.map((f,i)=>f.mode==='still'?-1:i).filter(i=>i>=0);
  const rand=generator(crypto.getRandomValues(new Uint32Array(1))[0]);
  // Choose two separated windows amongst moving samples, even on a day with long stops.
  const windows=[.14,.57].map(base=>{
    const from=Math.floor((base+.13*rand())*moving.length);
    const to=Math.min(moving.length-2,from+Math.max(1,Math.floor((.08+.06*rand())*moving.length)));
    return [moving[from],moving[to]];
  });
  const phase=rand()*2*Math.PI, offset=(rand()<.5?-1:1)*(3+rand()*4);
  const drift=(rand()<.5?-1:1)*(2+rand()*3), speedFactor=.84+.13*rand();
  const visible=[];
  let gap=false,metres=0,walked=0;
  for(let i=0;i<fixes.length;i++){
    const f=fixes[i];
    if(moving.length>=12 && windows.some(([a,b])=>i>=a && i<=b)){
      gap=true;continue;
    }
    const wave=Math.sin(phase+f.x*.074+f.y*.028);
    const next={...f,x:Math.max(3,Math.min(97,f.x+offset+4*wave)),
      y:Math.max(3,Math.min(97,f.y+drift+2.2*Math.cos(phase+f.x*.048))),
      speed:f.speed*speedFactor,gapBefore:gap || !!f.gapBefore};
    const previous=visible.at(-1);
    if(previous && !next.gapBefore && next.mode!=='still'){
      const distance=(next.t-previous.t)*next.speed/3.6;
      metres+=distance;
      if(next.mode==='walk')walked+=distance;
    }
    visible.push(next);gap=false;
  }
  const result=finishDay({...day,zones:[]},visible,walked,metres);
  // Preserve a named place only if the new observations still support a visit there.
  result.zones=day.zones.filter(z=>result.stops.some(s=>
    day.mPerX*Math.hypot(z.x-s.x,(z.y-s.y)*frameHeight/frameWidth)<35));
  return result;
}
