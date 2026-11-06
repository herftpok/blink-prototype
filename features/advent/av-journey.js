/* НГБЛИНК: пейзажи поездки, случайный захват и печенье у камина. */
(() => {
  'use strict';
  const A = name => `art/${name}.webp`;
  const atHome = index => index >= 18;
  const icon = name => `<i class="icon icon--${name}" aria-hidden="true"></i>`;
  const art = (day, i, seen, getSrc) => `<span class="ex-day-object"><img class="ex-day-object__base" src="${A(atHome(i) ? (seen ? 'cookie' : 'stocking') : 'suitcase')}" alt="">${i === 0 ? '' : `<img class="ex-day-object__topic" src="${getSrc((day.charm || day.hero || day.obj) === 'fan' ? 's:fire' : (day.charm || day.hero || day.obj))}" alt="">`}</span>`;
  const J = window.AV_JOURNEY = { A, atHome, art };
  // 14–31 December: the same date always returns the same view, with no adjacent repeats.
  const route = ['panorama','village','river','viaduct','mountains','lake','city','panorama','mountains','village','lake','river','viaduct','city','mountains','panorama','village','city'];
  J.landscape = index => atHome(index) ? null : A(`winter-${route[index] || 'panorama'}`);
  J.hero = ({day,i,seen}) => atHome(i)
    ? `<h2 class="visually-hidden" id="today-title">предсказание дня</h2><button class="ex-fortune-hotspot pressable" type="button" data-act="open-today" aria-label="${seen?'прочитать предсказание ещё раз':'открыть предсказание'}"></button>${seen?`<p class="av-today__seen">${icon('check')}предсказание прочитано</p>`:''}<button class="button ${seen?'button--secondary':'button--primary'} av-today__open pressable" type="button" data-act="open-today">${seen?'прочитать ещё раз':'открыть предсказание'}</button>`
    : '';
  J.entries = (S,D,plural) => atHome(S.today)
    ? `<button class="av-entry pressable" type="button" data-act="journey-collection"><img class="av-entry__art" src="${A('piggy')}" alt=""><span class="av-entry__text"><span class="av-entry__title">подарки</span><span class="av-entry__meta">из поездки</span></span>${icon('chevron')}</button><button class="av-entry pressable" type="button" data-calendar="train"><img class="av-entry__art" src="${A('suitcase')}" alt=""><span class="av-entry__text"><span class="av-entry__title">твой 2026</span><span class="av-entry__meta">итоги года</span></span>${icon('chevron')}</button>`
    : `<button class="av-entry pressable" type="button" data-go="game"><img class="av-entry__art ex-machine-mini" src="${A('machine')}" alt=""><span class="av-entry__text"><span class="av-entry__title">хваталка</span><span class="av-entry__meta">${D.ECONOMY.attempt}<img class="av-entry__flake" src="${A('coin')}" alt="жетонов"></span></span>${icon('chevron')}</button><button class="av-entry pressable" type="button" data-go="draw"><img class="av-entry__art" src="${A('ticket')}" alt=""><span class="av-entry__text"><span class="av-entry__title">розыгрыш</span><span class="av-entry__meta">${S.tickets} ${plural(S.tickets,'билет','билета','билетов')}</span></span>${icon('chevron')}</button>`;

  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards=window.AV_CARDS, originalRender=cards.render, originalCrack=cards.crack;
  let fortuneRun=null;
  cards.cancel=()=>{if(fortuneRun){fortuneRun.timers.forEach(clearTimeout);fortuneRun.card.classList.remove('is-presenting','is-opening','is-broken','is-cracked');fortuneRun.card.querySelector('.ex-fortune__paper').inert=true;fortuneRun=null;}};
  cards.render=(day,ctx)=>{
    if(!day.prediction)return originalRender(day,ctx);
    const i=ctx.D.DAYS.indexOf(day),open=ctx.story||ctx.S.days[i]?.cracked;
    return `<article class="avc ex-fortune${open?' is-presenting is-broken is-cracked':''}${ctx.story?' avc--story':''}" aria-labelledby="stat-title"><div class="ex-fortune__backdrop"><img class="ex-fortune__room" src="${A('living-room')}" alt=""></div><h1 class="visually-hidden" id="stat-title">предсказание на 2027</h1><p class="ex-fortune__date">${day.date} · у камина</p><div class="ex-fortune__cookie" aria-hidden="true"><img class="ex-fortune__whole" src="renders/fortune-cookie.webp" alt=""><img class="ex-fortune__half ex-fortune__half--left" src="renders/fortune-cookie-broken.webp" alt=""><img class="ex-fortune__half ex-fortune__half--right" src="renders/fortune-cookie-broken.webp" alt="">${Array.from({length:6},(_,k)=>`<span class="ex-fortune__crumb" style="--crumb:${k}"></span>`).join('')}</div><div class="ex-fortune__paper" aria-live="polite" ${open?'':'inert'}><p>в 2027</p><h2>${day.prediction}</h2></div></article>`;
  };
  cards.crack=(root,done)=>{
    const card=root.querySelector('.ex-fortune');
    if(!card)return originalCrack(root,done);
    if(card.classList.contains('is-cracked')||fortuneRun?.card===card)return false;
    cards.cancel();
    const run=fortuneRun={card,timers:[]};
    const later=(ms,fn)=>run.timers.push(setTimeout(()=>{if(fortuneRun===run&&card.isConnected)fn();},ms));
    card.classList.add('is-presenting');
    if(reduced()){
      card.classList.add('is-broken','is-cracked');card.querySelector('.ex-fortune__paper').inert=false;fortuneRun=null;done?.();return true;
    }
    later(600,()=>card.classList.add('is-opening'));
    later(1000,()=>{card.classList.remove('is-opening');card.classList.add('is-broken');});
    later(1300,()=>{card.classList.add('is-cracked');card.querySelector('.ex-fortune__paper').inert=false;});
    later(1900,()=>{fortuneRun=null;done?.();});
    return true;
  };

  // Atomic reward and collection behavior stay shared with the archived game.
  const G=window.AV_GAME,old={...G};
  let root,ctx,view='ready',award=null,timer=0,generation=0,decoration=false;
  const remaining=()=>ctx.D.POOL.filter(p=>!ctx.S.taken.includes(p.id));
  function closed(){root.innerHTML=`<div class="ex-closed"><img src="${A('suitcase')}" alt=""><h3>мы уже дома</h3><p>Автомат остался в поезде</p><button class="button button--primary" data-game="journey-home">к камину</button></div>`;}
  function render(){
    if(atHome(ctx.S.today))return closed();
    if(decoration){root.innerHTML=`<div class="ex-decoration">${old.wire(ctx)}</div>`;root.querySelectorAll('[data-bulb]').forEach(e=>e.classList.add('is-lit'));return;}
    if(view==='result')return result();
    const empty=!remaining().length,poor=ctx.S.balance<ctx.D.ECONOMY.attempt;
    root.innerHTML=`<div class="ex-arcade"><div class="ex-machine-wrap"><div class="ex-machine${view==='grabbing'?' is-grabbing':''}" role="img" aria-label="стеклянный аппарат в игровом вагоне" aria-busy="${view==='grabbing'}" style="--grab-drop:32cqh"><img class="ex-machine__car" src="${A('arcade-car')}" alt=""><img class="ex-machine__case" src="${A('claw-frame')}" alt=""><div class="ex-machine__well" aria-hidden="true"></div><div class="ex-machine__depth"><span class="ex-machine__cable" aria-hidden="true"></span><img class="ex-claw" src="${A('claw-hand')}" alt="">${view==='grabbing'?`<span class="ex-caught-prize"><img src="${ctx.src(award.prize.img)}" alt=""></span>`:''}</div><div class="ex-machine__console" aria-hidden="true"><img src="${A('claw-frame')}" alt=""></div></div></div><footer class="ex-arcade__footer"><button class="button button--primary" type="button" data-game="claw-grab" ${view==='grabbing'||empty?'disabled':''}>${view==='grabbing'?'достаём…':empty?'все подарки собраны':poor?'получить жетоны':`схватить <span>${ctx.D.ECONOMY.attempt}<img src="${A('coin')}" alt="жетонов"></span>`}</button><button class="ex-text-link" type="button" data-game="pool">все призы и правила ${icon('chevron')}</button></footer></div>`;
  }
  function result(){
    if(!award)return;
    root.innerHTML=`<div class="ex-result"><h3>подарок твой</h3><div class="ex-result__art"><img class="ex-result__case" src="${A('suitcase')}" alt=""><img class="ex-result__prize" src="${ctx.src(award.prize.img)}" alt="${award.prize.title}"></div><h4>${award.prize.title}</h4><p class="ex-result__ticket"><img src="${A('ticket')}" alt="">+1 билет в розыгрыш</p><footer><button class="button button--primary" data-game="claw-again">отлично</button><button class="ex-text-link" data-game="claw-draw">в розыгрыш ${icon('chevron')}</button></footer></div>`;
  }
  function grab(){
    if(view!=='ready'||atHome(ctx.S.today)||!remaining().length)return;
    if(ctx.S.balance<ctx.D.ECONOMY.attempt)return ctx.toTasks();
    const picked=old.choose(ctx),out=old.settle(ctx,{prizeId:picked.id});if(!out)return;
    ctx.S.balance-=ctx.D.ECONOMY.attempt;ctx.S.garland.attempts++;ctx.renderBalance();
    ctx.S.events.push({name:'express_claw_grab',prizeId:picked.id,cost:ctx.D.ECONOMY.attempt});
    award=out;view='grabbing';render();
    const run=generation;
    timer=setTimeout(()=>{if(run!==generation)return;view='result';if(window.AV.current()==='game')result();ctx.announce(`твой подарок: ${picked.title}, плюс билет в розыгрыш`);},reduced()?120:2600);
  }
  G.render=(el,c)=>{root=el;ctx=c;render();};
  G.click=(t,c)=>{
    ctx=c;
    if(t.dataset.draw&&atHome(c.S.today))return;
    switch(t.dataset.game){
      case 'claw-grab':return grab();
      case 'claw-again':view='ready';award=null;return render();
      case 'claw-draw':return c.toDraw();
      case 'journey-home':return c.toHome();
      default:return old.click(t,c);
    }
  };
  G.pause=()=>{if(view==='grabbing'){clearTimeout(timer);view='result';}};
  G.cancel=()=>{generation++;clearTimeout(timer);view='ready';award=null;decoration=false;old.cancel();};
  G.state=()=>({variant:'express-claw',view,award,remaining:ctx?remaining().length:0});
  G.variant=()=>{};G.decoration=()=>{decoration=true;};
  G.renderPool=(el,c)=>{old.renderPool(el,c);el.querySelector('.ag-rules').innerHTML='<p>30 жетонов — одна попытка</p><p>Нажми «схватить», чтобы получить случайный подарок из оставшихся. Полученный предмет больше не выпадет, а к подарку добавится билет в розыгрыш.</p><p>Автомат и приём билетов работают до 1 января</p>';el.querySelector('.avg-pool__social').textContent='подарки из твоей поездки';};
  const draw=old.renderDraw;
  G.renderDraw=(el,c)=>{
    if(!atHome(c.S.today))return draw(el,c);
    el.innerHTML=`<div class="ex-draw-closed"><img src="${A('ticket')}" alt=""><h3>розыгрыш завершён</h3><p>Билеты принимались до 1 января</p><ul>${c.D.DRAW.prizes.map(p=>`<li><span>${p.title}</span><b>${c.S.draw[p.id]||0} ${c.plural(c.S.draw[p.id]||0,'билет','билета','билетов')}</b></li>`).join('')}</ul></div>`;
  };
  document.addEventListener('visibilitychange',()=>{document.querySelector('#app').toggleAttribute('data-scene-paused',document.hidden);if(document.hidden){G.pause();cards.cancel();}else if(root&&ctx&&window.AV?.current()==='game'&&view==='result')result();});
})();
