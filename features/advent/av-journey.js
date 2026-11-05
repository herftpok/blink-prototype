/* НГБЛИНК: два последовательных места и короткая хваталка за жетоны. */
(() => {
  'use strict';
  const A = name => `art/${name}.webp`;
  const atHome = index => index >= 18;
  const icon = name => `<i class="icon icon--${name}" aria-hidden="true"></i>`;
  const art = (day, i, seen, getSrc) => `<span class="ex-day-object"><img class="ex-day-object__base" src="${A(atHome(i) ? (seen ? 'cookie' : 'stocking') : (seen ? 'journal' : 'suitcase'))}" alt="">${i === 0 ? '' : `<img class="ex-day-object__topic" src="${getSrc((day.charm || day.hero || day.obj) === 'fan' ? 's:fire' : (day.charm || day.hero || day.obj))}" alt="">`}</span>`;
  const J = window.AV_JOURNEY = { A, atHome, art };
  J.hero = ({day,i,seen,src}) => {
    const home=atHome(i),step=home?i-17:i+1;
    const topic=(day.charm||day.hero||day.obj)==='fan'?'s:fire':(day.charm||day.hero||day.obj);
    return `<div class="ex-daily__copy"><p class="ex-daily__chapter">${home?'посиделки у камина':`остановка ${String(step).padStart(2,'0')} из 18`}</p><h2 id="today-title">${seen?day.title:home?'новый день — новое предсказание':'каждый день — новый факт о тебе'}</h2>${seen?`<p class="av-today__seen">${icon('check')}${home?'предсказание прочитано':'факт просмотрен'}</p>`:''}</div><button class="ex-daily__art pressable" type="button" data-act="open-today" aria-label="${home?'открыть предсказание':'смотреть воспоминание'}"><img class="ex-daily__base" src="${A(home?'cookie':'journal')}" alt="">${i===0?'':`<img class="ex-daily__topic" src="${src(topic)}" alt="">`}</button><button class="button ${seen?'button--secondary':'button--primary'} av-today__open pressable" type="button" data-act="open-today">${seen?'посмотреть ещё раз':home?'открыть предсказание':'смотреть'}</button>`;
  };
  J.entries = (S,D,plural) => atHome(S.today)
    ? `<button class="av-entry pressable" type="button" data-act="journey-collection"><img class="av-entry__art" src="${A('piggy')}" alt=""><span class="av-entry__text"><span class="av-entry__title">подарки</span><span class="av-entry__meta">из поездки</span></span>${icon('chevron')}</button><button class="av-entry pressable" type="button" data-calendar="train"><img class="av-entry__art" src="${A('journal')}" alt=""><span class="av-entry__text"><span class="av-entry__title">твой 2026</span><span class="av-entry__meta">итоги года</span></span>${icon('chevron')}</button>`
    : `<button class="av-entry pressable" type="button" data-go="game"><img class="av-entry__art ex-machine-mini" src="${A('machine')}" alt=""><span class="av-entry__text"><span class="av-entry__title">хваталка</span><span class="av-entry__meta">${D.ECONOMY.attempt}<img class="av-entry__flake" src="${A('coin')}" alt="жетонов"></span></span>${icon('chevron')}</button><button class="av-entry pressable" type="button" data-go="draw"><img class="av-entry__art" src="${A('ticket')}" alt=""><span class="av-entry__text"><span class="av-entry__title">розыгрыш</span><span class="av-entry__meta">${S.tickets} ${plural(S.tickets,'билет','билета','билетов')}</span></span>${icon('chevron')}</button>`;

  // Январское предсказание живёт в другой комнате, без игрового баланса.
  const cards=window.AV_CARDS, originalRender=cards.render;
  cards.render=(day,ctx)=>{
    if(!day.prediction)return originalRender(day,ctx);
    const i=ctx.D.DAYS.indexOf(day),open=ctx.story||ctx.S.days[i]?.cracked;
    return `<article class="avc ex-fortune${open?' is-cracked':''}${ctx.story?' avc--story':''}" aria-labelledby="stat-title"><img class="ex-fortune__room" src="${A('living-room')}" alt=""><header class="ex-fortune__head"><p>${day.date} · у камина</p><h1 id="stat-title">твоё предсказание<br>на 2027</h1></header><div class="ex-fortune__paper" aria-live="polite" ${open?'':'inert'}><p>в новом году</p><h2>${day.prediction}</h2><img src="${A('cookie')}" alt=""></div><button class="ex-fortune__cookie pressable" type="button" data-act="crack" aria-label="открыть предсказание" ${open?'disabled':''}><span class="visually-hidden">открыть предсказание</span></button></article>`;
  };
  const originalCrack=cards.crack;
  cards.crack=(root,done)=>{
    const card=root.querySelector('.ex-fortune');
    if(!card)return originalCrack(root,done);
    if(card.classList.contains('is-cracked')||card.classList.contains('is-opening'))return;
    card.classList.add('is-opening');
    const reveal=()=>{card.classList.remove('is-opening');card.classList.add('is-cracked');card.querySelector('.ex-fortune__paper').inert=false;card.querySelector('.ex-fortune__cookie').disabled=true;done?.();};
    setTimeout(reveal,matchMedia('(prefers-reduced-motion: reduce)').matches?0:420);
  };

  // Повторно используем выдачу и коллекцию: уникальность и билет сохраняются атомарно.
  const G=window.AV_GAME,old={...G};
  let root,ctx,view='ready',offers=[],award=null,frame=0,timer=0,generation=0,x=50,selected=1,decoration=false;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand=()=>{const n=new Uint32Array(1);crypto.getRandomValues(n);return n[0]/4294967296;};
  function prepare(){
    const free=ctx.D.POOL.filter(p=>!ctx.S.taken.includes(p.id));
    const kept=new Set();
    offers=offers.slice(0,3).map(p=>{if(!free.some(q=>q.id===p.id)||kept.has(p.id))return null;kept.add(p.id);return p;});
    const reserve=free.filter(p=>!kept.has(p.id));
    for(let i=0;i<Math.min(3,free.length);i++)if(!offers[i])offers[i]=reserve.splice(Math.floor(rand()*reserve.length),1)[0];
    offers=offers.filter(Boolean);
  }
  const positions=n=>n===1?[50]:n===2?[35,65]:[24,50,76];
  function feed(){
    const source=[...(ctx.S.wheelRecent||[]),...['vip-30','tail-crystal','beanie','coins-500'].map((id,i)=>({name:['наташка','лёва','соня','саша'][i],prize:ctx.D.POOL.find(p=>p.id===id)}))].slice(0,7);
    return `<section class="ex-feed" aria-label="последние призы"><p>последние призы</p><div>${source.map(({name,prize})=>`<span class="ex-feed__item"><img src="${ctx.src(prize.img)}" alt=""><span><b>${name}</b><small>${prize.title}</small></span></span>`).join('')}</div></section>`;
  }
  function closed(){root.innerHTML=`<div class="ex-closed"><img src="${A('suitcase')}" alt=""><h3>мы уже дома</h3><p>Автомат остался в поезде</p><button class="button button--primary" data-game="journey-home">к камину</button></div>`;}
  function idle(){
    cancelAnimationFrame(frame);
    if(view!=='ready'||!offers.length||reduced()||atHome(ctx.S.today))return;
    const epoch=performance.now();
    function tick(t){
      if(view!=='ready'||window.AV?.current()!=='game'){frame=0;return;}
      x=50+26*Math.sin((t-epoch)/850);
      const pos=positions(offers.length);selected=pos.reduce((best,v,i)=>Math.abs(v-x)<Math.abs(pos[best]-x)?i:best,0);
      const hand=root.querySelector('.ex-claw');hand?.style.setProperty('--claw-x',`${x}%`);
      root.querySelectorAll('.ex-machine-prize').forEach((p,i)=>p.classList.toggle('is-target',i===selected));
      frame=requestAnimationFrame(tick);
    }
    frame=requestAnimationFrame(tick);
  }
  function render(){
    cancelAnimationFrame(frame);
    if(atHome(ctx.S.today))return closed();
    if(decoration){root.innerHTML=`<div class="ex-decoration">${old.wire(ctx)}</div>`;root.querySelectorAll('[data-bulb]').forEach(e=>e.classList.add('is-lit'));return;}
    if(view==='result')return result();
    if(view==='ready')prepare();
    const empty=!offers.length,poor=ctx.S.balance<ctx.D.ECONOMY.attempt;
    selected=Math.min(selected,Math.max(0,offers.length-1));
    if(reduced())x=positions(offers.length)[selected]||50;
    root.innerHTML=`<div class="ex-arcade">${feed()}<div class="ex-machine-wrap"><div class="ex-machine" role="img" aria-label="аппарат с клешнёй и ${offers.length} подарками"><img class="ex-machine__case" src="${A('claw-window')}" alt="">${offers.map((p,i)=>`<span class="ex-machine-prize${i===selected?' is-target':''}" data-prize="${p.id}" style="--prize-x:${positions(offers.length)[i]}%"><img src="${ctx.src(p.img)}" alt="${p.title}"></span>`).join('')}<img class="ex-claw" src="${A('claw-hand')}" alt="" style="--claw-x:${x}%"></div></div><footer class="ex-arcade__footer"><p class="ex-arcade__hint">${empty?'все подарки уже твои':'останови клешню над подарком'}</p><button class="button button--primary" type="button" data-game="claw-grab" ${view==='grabbing'||empty?'disabled':''}>${view==='grabbing'?'достаём…':empty?'все подарки собраны':poor?'получить жетоны':`хватай <span>${ctx.D.ECONOMY.attempt}<img src="${A('coin')}" alt="жетонов"></span>`}</button><button class="ex-text-link" type="button" data-game="pool">все призы и правила ${icon('chevron')}</button></footer></div>`;
    if(view==='ready')idle();
  }
  function result(){
    if(!award)return;
    if(!award.recorded){ctx.S.wheelRecent=[{name:'ты',prize:award.prize},...(ctx.S.wheelRecent||[])].slice(0,5);award.recorded=true;}
    root.innerHTML=`<div class="ex-result"><p class="ex-result__kicker">из новогоднего экспресса</p><h3>подарок твой</h3><div class="ex-result__art"><img class="ex-result__case" src="${A('suitcase')}" alt=""><img class="ex-result__prize" src="${ctx.src(award.prize.img)}" alt="${award.prize.title}"></div><h4>${award.prize.title}</h4><p class="ex-result__ticket"><img src="${A('ticket')}" alt="">+1 билет в розыгрыш</p><footer><button class="button button--primary" data-game="claw-again">отлично</button><button class="ex-text-link" data-game="claw-draw">в розыгрыш ${icon('chevron')}</button></footer></div>`;
  }
  function grab(){
    if(view!=='ready'||atHome(ctx.S.today)||!offers.length)return;
    if(ctx.S.balance<ctx.D.ECONOMY.attempt)return ctx.toTasks();
    const picked=offers[selected],out=old.settle(ctx,{prizeId:picked.id});if(!out)return;
    ctx.S.balance-=ctx.D.ECONOMY.attempt;ctx.S.garland.attempts++;ctx.renderBalance();
    ctx.S.events.push({name:'express_claw_grab',prizeId:picked.id,cost:ctx.D.ECONOMY.attempt});
    award=out;view='grabbing';cancelAnimationFrame(frame);
    const hand=root.querySelector('.ex-claw'),machine=root.querySelector('.ex-machine');
    hand.style.setProperty('--claw-x',`${positions(offers.length)[selected]}%`);
    machine.style.setProperty('--grab-drop',`${machine.clientHeight*.22}px`);
    machine.classList.add('is-grabbing');root.querySelectorAll('.ex-machine-prize')[selected].classList.add('is-caught');
    const button=root.querySelector('[data-game="claw-grab"]');button.disabled=true;button.textContent='достаём…';
    const run=generation;
    timer=setTimeout(()=>{if(run!==generation)return;view='result';if(window.AV.current()==='game')result();ctx.announce(`твой подарок: ${picked.title}, плюс билет в розыгрыш`);},reduced()?120:2800);
  }
  G.render=(el,c)=>{root=el;ctx=c;render();};
  G.click=(t,c)=>{
    ctx=c;
    if(t.dataset.draw && atHome(c.S.today))return;
    switch(t.dataset.game){
      case 'claw-grab':return grab();
      case 'claw-again':view='ready';award=null;x=50;selected=1;return render();
      case 'claw-draw':return c.toDraw();
      case 'journey-home':return c.toHome();
      default:return old.click(t,c);
    }
  };
  G.pause=()=>{cancelAnimationFrame(frame);if(view==='grabbing'){clearTimeout(timer);view='result';}};
  G.cancel=()=>{generation++;cancelAnimationFrame(frame);clearTimeout(timer);view='ready';offers=[];award=null;x=50;selected=1;decoration=false;old.cancel();};
  G.state=()=>({variant:'express-claw',view,offers:offers.map(p=>p.id),award,selected,x});
  G.variant=()=>{};G.decoration=()=>{decoration=true;};
  G.renderPool=(el,c)=>{old.renderPool(el,c);el.querySelector('.ag-rules').innerHTML='<p>30 жетонов — одна попытка</p><p>Останови клешню над одним из подарков. Подарок и билет начислятся сразу, а полученный предмет больше не появится в автомате.</p><p>Автомат и приём билетов работают до 1 января</p>';el.querySelector('.avg-pool__social').textContent='подарки из твоей поездки';};
  const draw=old.renderDraw;
  G.renderDraw=(el,c)=>{
    if(!atHome(c.S.today))return draw(el,c);
    el.innerHTML=`<div class="ex-draw-closed"><img src="${A('ticket')}" alt=""><h3>розыгрыш завершён</h3><p>Билеты принимались до 1 января</p><ul>${c.D.DRAW.prizes.map(p=>`<li><span>${p.title}</span><b>${c.S.draw[p.id]||0} ${c.plural(c.S.draw[p.id]||0,'билет','билета','билетов')}</b></li>`).join('')}</ul></div>`;
  };
  document.addEventListener('visibilitychange',()=>{document.querySelector('#app').toggleAttribute('data-scene-paused',document.hidden);if(document.hidden)G.pause();else if(root&&ctx&&window.AV?.current()==='game'){if(view==='result')result();else if(view==='ready')idle();}});
})();
