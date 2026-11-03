/* Main holiday flow: one paid spin, one immediately reserved gift and a raffle ticket.
   The timing garland is retained in av-game.js for reuse as decoration. */
(() => {
  'use strict';
  const G=window.AV_GAME;
  const old={render:G.render,click:G.click,cancel:G.cancel,pause:G.pause,state:G.state,renderPool:G.renderPool};
  let root,ctx,view='wheel',offers=[],award=null,turn=0,timer=0,decoration=false;
  const random=()=>{const n=new Uint32Array(1);crypto.getRandomValues(n);return n[0]/4294967296;};
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function prepare(){
    const available=ctx.D.POOL.filter(p=>!ctx.S.taken.includes(p.id)),kept=new Set();
    const next=offers.slice(0,8).map(p=>{
      if(!available.some(a=>a.id===p.id)||kept.has(p.id))return null;
      kept.add(p.id);return p;
    });
    const reserve=available.filter(p=>!kept.has(p.id));
    for(let i=0;i<Math.min(8,available.length);i++){
      if(!next[i]&&reserve.length)next[i]=reserve.splice(Math.floor(random()*reserve.length),1)[0];
    }
    offers=next.filter(Boolean).slice(0,8);
  }
  const remaining=()=>offers.map((p,index)=>({p,index})).filter(({p})=>!ctx.S.taken.includes(p.id));
  function feed(){
    const names=['наташка','лёва','соня','саша','даня'];
    const demo=[ctx.D.POOL.find(p=>p.id==='vip-30'),ctx.D.POOL.find(p=>p.id==='tail-crystal'),ctx.D.POOL.find(p=>p.id==='beanie'),ctx.D.POOL.find(p=>p.id==='coins-500'),ctx.D.POOL.find(p=>p.id==='pack-snow')];
    const items=[...(ctx.S.wheelRecent||[]),...demo.map((prize,i)=>({name:names[i],prize}))].slice(0,8);
    return `<section class="nw-feed" aria-label="последние призы"><p class="nw-feed__label">последние призы</p><div class="nw-feed__track">${items.map(({name,prize})=>`<div class="nw-recent"><img src="${ctx.src(prize.img)}" alt=""><span><b>${name}</b><small>${prize.title}</small></span></div>`).join('')}</div></section>`;
  }
  function disk(prizes=offers,owned=ctx.S.taken,getSrc=ctx.src,rotation=turn){
    const n=Math.max(1,prizes.length),angle=360/n;
    const paths=n===1?'<circle cx="180" cy="180" r="166" fill="var(--color-surface-card)"/>':Array.from({length:n},(_,i)=>{const a=(i*angle-angle/2-90)*Math.PI/180,b=((i+1)*angle-angle/2-90)*Math.PI/180;return `<path d="M 180 180 L ${180+166*Math.cos(a)} ${180+166*Math.sin(a)} A 166 166 0 ${angle>180?1:0} 1 ${180+166*Math.cos(b)} ${180+166*Math.sin(b)} Z" fill="${i%2?'var(--color-surface)':'var(--color-surface-card)'}" stroke="var(--color-text-faint)" stroke-width="1"/>`;}).join('');
    return `<div class="nw-wheel" role="img" aria-label="колесо с ${prizes.length} подарками"><span class="nw-pointer"></span><div class="nw-rotor" style="--turn:${rotation}deg"><svg viewBox="0 0 360 360" aria-hidden="true">${paths}<circle cx="180" cy="180" r="172" fill="none" stroke="var(--color-text-faint)" stroke-width="2"/></svg>${prizes.map((p,i)=>{const a=(i*angle-90)*Math.PI/180,label=p.id==='coins-100'?'100':p.id==='coins-500'?'500':p.id==='vip-3'?'3 дня':p.id==='vip-30'?'30 дней':'';return `<span class="nw-sector" data-prize="${p.id}" style="--x:${50+Math.cos(a)*32}%;--y:${50+Math.sin(a)*32}%;--angle:${i*angle}deg"><img src="${getSrc(p.img)}" alt="${p.title}" title="${p.title}">${label?`<small>${label}</small>`:''}</span>`;}).join('')}</div><div class="nw-hub"><img src="renders/gift-pink.webp" alt=""></div></div>`;
  }
  // Та же геометрия и призы, без изменения состояния основного колеса.
  G.wheelPreview=(c)=>disk(c.D.POOL.filter(p=>!c.S.taken.includes(p.id)).slice(0,8),[],c.src,0);
  function renderWheel(){
    if(view==='wheel')prepare();
    const empty=!remaining().length,poor=ctx.S.balance<ctx.D.ECONOMY.attempt;
    root.innerHTML=`<div class="nw">${feed()}<div class="nw-scene">${disk()}</div><footer class="nw-bottom"><button class="button button--primary" data-game="wheel-spin" ${view==='spinning'||empty?'disabled':''}>${view==='spinning'?'крутится…':empty?'все подарки собраны':poor?'получить снежинки':`крутить <span class="nw-price">${ctx.D.ECONOMY.attempt}<img src="renders/snowflake.webp" alt="снежинок"></span>`}</button><button class="nw-link" data-game="pool">все призы и правила <i class="icon icon--chevron" aria-hidden="true"></i></button></footer></div>`;
  }
  function result(){
    if(!award.recorded){ctx.S.wheelRecent=[{name:'ты',prize:award.prize},...(ctx.S.wheelRecent||[])].slice(0,5);award.recorded=true;}
    root.innerHTML=`<div class="nw nw-result"><h3>твой подарок</h3><div class="nw-award"><img src="${ctx.src(award.prize.img)}" alt="${award.prize.title}"></div><h4>${award.prize.title}</h4><p class="nw-received">уже твой</p><p class="nw-ticket"><img src="renders/ticket.webp" alt="">+1 билет в розыгрыш</p><footer class="nw-bottom"><button class="button button--primary" data-game="wheel-again">отлично</button><button class="nw-link" data-game="wheel-draw">в розыгрыш <i class="icon icon--chevron" aria-hidden="true"></i></button></footer></div>`;
  }
  function spin(){
    if(view!=='wheel')return;
    const eligible=remaining();if(!eligible.length)return;
    if(ctx.S.balance<ctx.D.ECONOMY.attempt)return ctx.toTasks();
    const {index:i}=eligible[Math.floor(random()*eligible.length)],reserved={prizeId:offers[i].id};
    const out=G.settle(ctx,reserved);if(!out)return;
    ctx.S.balance-=ctx.D.ECONOMY.attempt;ctx.S.garland.attempts++;ctx.renderBalance();
    award=out;view='spinning';
    ctx.S.events.push({name:'wheel_spin',prizeId:out.prize.id,cost:ctx.D.ECONOMY.attempt});
    turn=0;renderWheel();void root.querySelector('.nw-rotor').offsetWidth;
    turn=1800+(360-i*360/offers.length)%360;
    requestAnimationFrame(()=>root.querySelector('.nw-rotor')?.style.setProperty('--turn',`${turn}deg`));
    timer=setTimeout(()=>{view='result';if(window.AV.current()==='game')result();ctx.announce(`твой подарок: ${out.prize.title}, плюс билет в розыгрыш`);},reduced()?450:4200);
  }
  G.render=(el,c)=>{root=el;ctx=c;if(decoration){el.innerHTML=`<div class="nw nw-decoration"><h3>пусть всё сияет</h3><div class="nw-garland">${G.wire(c)}</div><button class="button button--primary" data-game="wheel-home">к подаркам</button></div>`;el.querySelectorAll('[data-bulb]').forEach(b=>b.classList.add('is-lit'));el.querySelectorAll('[data-fairy]').forEach(b=>b.style.opacity=1);return;}return view==='result'?result():renderWheel();};
  G.renderPool=(el,c)=>{old.renderPool(el,c);el.querySelector('.avg-pool__social').innerHTML='подарки не повторяются';el.querySelector('.ag-rules').innerHTML='<p>30 снежинок — одно вращение</p><p>На колесе до 8 доступных подарков. Каждый показанный подарок имеет одинаковый шанс. После выигрыша его место занимает ещё не полученный подарок. Когда подарков остаётся меньше восьми, показываем все оставшиеся. Каждое вращение также даёт билет в розыгрыш.</p>';};
  G.click=(t,c)=>{ctx=c;root=document.querySelector('#game');switch(t.dataset.game){case 'wheel-spin':return spin();case 'wheel-home':decoration=false;return G.render(root,c);case 'wheel-again':view='wheel';award=null;turn=0;prepare();return G.render(root,c);case 'wheel-draw':return c.toDraw();default:return old.click(t,c);}};
  G.pause=()=>{if(view==='spinning'){clearTimeout(timer);view='result';}};
  G.cancel=()=>{clearTimeout(timer);view='wheel';offers=[];award=null;turn=0;decoration=false;old.cancel();};
  G.state=()=>({variant:'fortune-wheel',view,offers:offers.map(p=>p.id),award});
  G.decoration=()=>{decoration=true;};
  G.variant=()=>{};
})();
