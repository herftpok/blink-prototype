/* A short timing game: three catches, a guaranteed gift, one bonus for 3/3. */
(() => {
  "use strict";
  const $ = (s, root = document) => root.querySelector(s);
  const E=window.AV_GARLAND;
  const NBSP = String.fromCharCode(160);
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let view='lobby', run=null, timers=[], prizeQueue=[], frame=0, lastTime=0, activeCtx=null;
  const stopAll=()=>{timers.forEach(clearTimeout);timers=[];cancelAnimationFrame(frame);frame=0;};
  const leftOf=(ctx,tier)=>ctx.D.POOL.filter(p=>p.tier===tier&&!ctx.S.taken.includes(p.id)).length;
  const remaining=ctx=>ctx.D.POOL.filter(p=>!ctx.S.taken.includes(p.id));
  const track=(ctx,name,props={})=>ctx.S.events.push({name,day:ctx.D.DAYS[ctx.S.today].date,at:Date.now(),...props});
  const untilMidnight=ctx=>{const [h,m]=ctx.S.clock.split(':').map(Number),left=1440-h*60-m;return `${Math.floor(left/60)}${NBSP}ч ${left%60}${NBSP}мин`;};
  const available=ctx=>ctx.S.balance>=ctx.D.ECONOMY.attempt && ctx.S.garland.attempts<ctx.D.ECONOMY.attemptsPerDay && remaining(ctx).length>0;
  function cta(ctx){
    if(!remaining(ctx).length)return '<button class="button button--primary pressable" type="button" data-game="pool">вся коллекция твоя</button>';
    if(ctx.S.garland.attempts>=ctx.D.ECONOMY.attemptsPerDay)return `<p class="ag-wait">новые попытки через ${untilMidnight(ctx)}</p>`;
    if(ctx.S.balance<ctx.D.ECONOMY.attempt)return `<button class="button button--secondary pressable" type="button" data-game="earn">не хватает ${ctx.D.ECONOMY.attempt-ctx.S.balance} – к заданиям</button>`;
    return `<button class="button button--primary pressable" type="button" data-game="start">зажечь<span class="avs-cta__price">${ctx.D.ECONOMY.attempt}<img src="renders/snowflake.webp" alt="снежинок"></span></button>`;
  }
  // Full-bleed 390 × 320 scene. One cable runs beyond both frame edges.
  // Attachment points share the cubic curve; unequal drops and tilt avoid a mirrored necklace.
  const cable='M -40 0 C 32 18 58 172 175 175 C 270 180 280 100 430 110';
  const cubic=(a,b,c,d,t)=>(1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d;
  const point=p=>p<.5?{x:cubic(-40,32,58,175,p*2),y:cubic(0,18,172,175,p*2)}:
    {x:cubic(175,270,280,430,(p-.5)*2),y:cubic(175,180,100,110,(p-.5)*2)};
  const atX=x=>{let lo=0,hi=1;for(let i=0;i<24;i++){const mid=(lo+hi)/2;if(point(mid).x<x)lo=mid;else hi=mid;}return point((lo+hi)/2);};
  const hangers=[
    [26,8,-3,.93],[68,20,-4,1.02],[108,10,-1,.96],
    [150,24,6,1.03],[193,14,-3,1],[235,6,-2,.92],
    [276,22,-1,1.02],[317,10,-4,.98],[360,17,-1,1.02]
  ];
  // Botanical decoration follows the same cable. Deterministic needles stay still during play.
  function evergreen(){
    let needles='';
    for(let x=-12;x<406;x+=4){
      const q=atX(x),next=atX(x+1),angle=Math.atan2(next.y-q.y,next.x-q.x);
      for(const side of [-1,1]){
        const n=13+7*Math.sin(x*.19+side),a=angle+side*(.72+.2*Math.sin(x*.13));
        const end={x:q.x-Math.cos(a)*n,y:q.y-Math.sin(a)*n};
        needles+=`<path d="M ${q.x} ${q.y} Q ${(q.x+end.x)/2} ${(q.y+end.y)/2-2} ${end.x} ${end.y}" stroke="${x%12===0?'#538b69':side===1?'#2c6047':'#183e30'}" stroke-width="${x%12===0?1.4:2.1}"/>`;
      }
    }
    const berries=[12,89,249,334].map((x,i)=>{const q=atX(x);return `<g transform="translate(${q.x} ${q.y-6})"><circle cx="0" cy="0" r="3.6" fill="#bc3447"/><circle cx="5" cy="4" r="3" fill="#7e182e"/><circle cx="-1" cy="-1" r="1" fill="#f9a1a8"/></g>`;}).join('');
    const frost=[33,73,120,167,214,292,365].map(x=>{const q=atX(x);return `<path d="M ${q.x-6} ${q.y-5} l 5 -2 4 1" stroke="#cee4df" stroke-opacity=".55" stroke-width="2.6"/>`;}).join('');
    return `<g class="ag-evergreen" fill="none" stroke-linecap="round">${needles}${berries}${frost}</g>
      <g class="ag-ribbon" transform="translate(14 62) rotate(-26)">
        <path d="M 0 0 Q -14 12 -12 38 L -5 31 1 36 Q -4 12 4 2 M 3 1 Q 18 8 25 28 L 27 18 35 20 Q 23 2 7 -2" fill="#9b2338"/>
        <path d="M 1 0 C -34 -25 -36 14 -3 7 L 4 0 C 24 -29 41 -2 8 6 Z" fill="#c8344b" stroke="#e66677" stroke-width=".7"/>
        <path d="M -4 -4 Q 1 -7 7 -3 L 8 6 Q 2 9 -3 5 Z" fill="#e04a5c"/>
      </g>`;
  }
  const bulbColors=['red','gold','cyan','red','gold','red','cyan','gold','red'];
  const bulbGlow={red:'#ff526c',gold:'#ffd074',cyan:'#79eaff'};
  const lightGroups=[[3,4,5],[6,7,8],[0,1,2]];
  const atmosphere=()=>'<div class="ag-atmosphere" aria-hidden="true"><span></span><span></span><span></span></div>';
  function wire(ctx,preview=false,compact=false){
    return `<div class="ag-wire" aria-hidden="true"><svg viewBox="0 0 390 320" preserveAspectRatio="${compact?'none':'xMidYMid meet'}" class="ag-cable"><path class="ag-cable__shadow" d="${cable}"/><path d="${cable}"/>${evergreen()}<g class="ag-fairy-lights">${Array.from({length:27},(_,i)=>{const x=8+i*14,q=atX(x);return `<circle data-fairy="${i}" cx="${x}" cy="${q.y-5+(i%3)*4}" r="1.6"/>`;}).join('')}</g></svg>
      <span class="ag-anchor ag-anchor--left"></span><span class="ag-anchor ag-anchor--right"></span>
      ${hangers.map(([x,drop,tilt,size],i)=>{const q=atX(x);return `<span class="ag-bulb${preview&&i===4?' is-target':''}${preview&&i===1?' is-current':''}" data-bulb="${i}" style="--x:${q.x/390*100}%;--y:${q.y/320*100}%;--drop:${drop}px;--tilt:${tilt}deg;--size:${size};--bulb-glow:${bulbGlow[bulbColors[i]]};--ignite-delay:${Math.abs(i-E.TARGET_BULBS[lightGroups.findIndex(group=>group.includes(i))])*110}ms">
        <span class="ag-bulb__halo"></span><span class="ag-bulb__socket"></span><span class="ag-bulb__glass">
        <img class="ag-bulb__off" src="renders/garland-bulb-${['off','gold','cyan','off','gold','off','cyan','gold','off'][i]}.webp" alt="" draggable="false">
        <img class="ag-bulb__pink" src="renders/garland-bulb-lit-${bulbColors[i]}.webp" alt="" draggable="false">
        <img class="ag-bulb__white" src="renders/garland-bulb-white.webp" alt="" draggable="false"></span><span class="ag-bulb__mark"></span></span>`;}).join('')}</div>`;
  }
  function render(el,ctx){
    activeCtx=ctx;
    if(view==='playing'||view==='paused'||view==='finish')return renderPlay(el,ctx);
    if(view==='over'&&run)return renderResult(el,ctx);
    view='lobby';
    el.innerHTML=`<div class="ag ag--compare"><nav class="ag-variants" aria-label="новые варианты"><button type="button" data-game="lab-score">игра на очки и подарки</button></nav>${atmosphere()}<div class="ag-heading"><h3>зажги<br>гирлянду</h3><p>останови свет<br>на отмеченной лампочке</p></div>
      <div class="ag-scene ag-scene--preview">${wire(ctx,true)}</div>
      <div class="ag-bottom"><button class="ag-rewards pressable" type="button" data-game="pool"><img src="art/ticket.webp" alt="">подарки и правила<i class="icon icon--chevron" aria-hidden="true"></i></button>${cta(ctx)}</div></div>`;
    track(ctx,'garland_open');
  }
  function choose(ctx,random){
    const pool=remaining(ctx);if(!pool.length)return null;
    let value;if(random)value=random();else{const n=new Uint32Array(1);crypto.getRandomValues(n);value=n[0]/4294967296;}
    return pool[Math.min(pool.length-1,Math.floor(Math.max(0,value)*pool.length))];
  }
  // Reserve/grant the guaranteed gift before play, so navigation cannot lose it.
  function settle(ctx,result){
    if(result.settled)return result.out;
    const prize=ctx.D.POOL.find(p=>p.id===result.prizeId);
    if(!prize||ctx.S.taken.includes(prize.id))return null;
    result.settled=true;ctx.S.taken.push(prize.id);ctx.S.tickets++;
    const star=ctx.S.taken.length===ctx.D.POOL.length&&!ctx.S.star;
    if(star)ctx.S.star=true;
    result.out={prize,tickets:1,star};return result.out;
  }
  function bonus(ctx,result){
    if(!result.play?.over||result.bonusGranted||E.hits(result.play)!==3)return false;
    result.bonusGranted=true;ctx.S.tickets++;result.out.tickets++;return true;
  }
  function start(ctx){
    if(view!=='lobby'||!available(ctx))return;
    const prize=choose(ctx);if(!prize)return;
    stopAll();activeCtx=ctx;ctx.S.balance-=ctx.D.ECONOMY.attempt;ctx.S.garland.attempts++;
    run={prizeId:prize.id,play:E.create()};settle(ctx,run);
    view='playing';track(ctx,'garland_start',{attempt:ctx.S.garland.attempts});
    ctx.renderBalance();renderPlay($('#game'),ctx);$('[data-game="catch"]')?.focus({preventScroll:true});loop(ctx);
  }
  function sync(ctx){
    if(view!=='playing')return;
    const now=performance.now();E.advance(run.play,now-lastTime);lastTime=now;
    if(run.play.over)finish(ctx);else paint();
  }
  function loop(ctx){
    lastTime=performance.now();
    const next=()=>{sync(ctx);if(view==='playing')frame=requestAnimationFrame(next);};
    frame=requestAnimationFrame(next);
  }
  function catchLight(ctx){
    if(view!=='playing')return;
    sync(ctx);if(view!=='playing')return;
    const hit=E.tap(run.play);if(hit===null)return;
    track(ctx,'garland_catch',{round:run.play.round+1,hit});paint();
    ctx.announce(hit?'попал!':'чуть мимо');
    if(run.play.over)finish(ctx);
  }
  function paint(){
    const p=run.play,root=$('#game'),round=p.round,done=p.results[round]!==null;
    const pos=p.stopped[round]??E.position(p),current=E.bulbAt(pos),target=E.TARGET_BULBS[round];
    root.querySelectorAll('[data-bulb]').forEach(el=>{
      const i=+el.dataset.bulb,lit=lightGroups.some((group,r)=>group.includes(i)&&p.results[r]===true);
      el.classList.toggle('is-lit',lit);
      el.classList.toggle('is-target',i===target&&!p.over);
      el.classList.toggle('is-current',i===current&&!p.over);
      el.classList.toggle('is-missed',i===target&&p.results[round]===false);
    });
    const hits=E.hits(p);
    root.querySelectorAll('.ag-atmosphere span').forEach((el,i)=>el.classList.toggle('is-on',p.results[i]===true));
    $('.ag',root).classList.toggle('is-finale',p.over);
    root.querySelectorAll('[data-fairy]').forEach(el=>{
      const bulb=Math.min(8,Math.floor(+el.dataset.fairy/3));
      el.classList.toggle('is-lit',lightGroups.some((group,r)=>group.includes(bulb)&&p.results[r]===true));
    });
    if(p.over)$('.ag-heading h3',root).innerHTML=hits===3?'гирлянда<br>готова':hits?'готово':'твой подарок';
    root.querySelectorAll('[data-round]').forEach((el,i)=>{el.classList.toggle('is-active',i===round&&!p.over);el.classList.toggle('is-hit',p.results[i]===true);el.classList.toggle('is-miss',p.results[i]===false);el.setAttribute('aria-label',`${i+1}: ${p.results[i]===true?'попадание':p.results[i]===false?'мимо':'ожидает'}`);});
    const feedback=$('#garland-feedback',root);
    feedback.textContent=p.over?'':done?(p.results[round]?'ещё ярче!':'мимо'):'';
    feedback.classList.toggle('is-hit',p.results[round]===true);
    const button=$('[data-game="catch"]',root);
    if(button){button.setAttribute('aria-disabled',String(done||view!=='playing'));button.textContent=p.over?'открываем подарок…':done?(round===2?'готово':'дальше…'):'стоп';}
    root.classList.toggle('is-caught',done);
  }
  function renderPlay(el,ctx){
    el.innerHTML=`<div class="ag ag-play">${atmosphere()}<div class="ag-heading"><h3>${view==='paused'?'продолжим?':'зажги гирлянду'}</h3></div>
      <div class="ag-scene">${wire(ctx)}<p class="ag-feedback" id="garland-feedback" aria-live="polite"></p></div>
      <div class="ag-bottom"><div class="ag-rounds" aria-label="три попытки">${[0,1,2].map(i=>`<span class="ag-round" data-round="${i}"><i class="icon icon--check" aria-hidden="true"></i></span>`).join('')}</div>
      ${view==='paused'?'<button class="button button--primary pressable" type="button" data-game="resume">продолжить</button>':'<button class="button button--primary pressable ag-catch" type="button" data-game="catch">стоп</button>'}</div></div>`;
    const button=$('[data-game="catch"]',el);
    button?.addEventListener('pointerdown',e=>{if(e.button===0)catchLight(ctx);});
    // A pointer press must not create a second catch on release in the next window.
    button?.addEventListener('click',e=>{if(e.detail>0)e.stopPropagation();});
    button?.addEventListener('keydown',e=>{if(e.repeat&&(e.key==='Enter'||e.key===' '))e.preventDefault();});
    paint();
  }
  function finish(ctx){
    if(view!=='playing')return;
    view='finish';stopAll();bonus(ctx,run);ctx.renderBalance();paint();
    track(ctx,'garland_finish',{hits:E.hits(run.play),tickets:run.out.tickets,elapsed:run.play.elapsed});
    if(!reduced()&&E.hits(run.play)===3)ctx.app.dispatchEvent(new CustomEvent('av:confetti'));
    ctx.announce('готово! открываем подарок');
    queueGift(ctx);
  }
  function queueGift(ctx){
    const completed=run;
    timers.push(setTimeout(()=>{
      if(view!=='finish'||run!==completed)return;
      view='over';
      if(window.AV.current()==='game')renderResult($('#game'),ctx);
    },reduced()?600:1200));
  }
  function pause(){
    if(view==='playing'){
      sync(activeCtx);
      if(view==='playing'){view='paused';run.play.paused=true;stopAll();renderPlay($('#game'),activeCtx);}
    }
    // Leaving during the reveal keeps the awarded gift ready for return.
    if(view==='finish'){stopAll();view='over';}
  }
  function resume(ctx){if(view!=='paused')return;run.play.paused=false;view='playing';renderPlay($('#game'),ctx);$('[data-game="catch"]')?.focus({preventScroll:true});loop(ctx);}
  function cancel(){stopAll();view='lobby';run=null;prizeQueue=[];}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else if(activeCtx&&window.AV.current()==='game'&&view==='over')renderResult($('#game'),activeCtx);});
  function renderResult(el,ctx){
    const {prize,star,tickets}=run.out,hits=run.play?E.hits(run.play):0;
    el.innerHTML=`<div class="ap ap-result"><p class="ap-result__label">${hits===3?'точно в цель!':'твой подарок!'}</p>
      <p class="ag-result-score">${hits*3} из 9 огоньков зажжены</p>
      <div class="ap-prize-art"><img class="ap-prize-glow" src="${ctx.src(prize.img)}" alt=""><img class="ap-prize-img" src="${ctx.src(prize.img)}" alt="${prize.title}"></div>
      <div class="ap-result__copy">${tierChip(ctx,prize.tier)}<h3 id="result-title">${prize.title}</h3>
      <button class="ap-ticket pressable" type="button" data-game="draw"><img src="art/ticket.webp" alt="">+${tickets} ${tickets===1?'билет':'билета'} в розыгрыш<i class="icon icon--chevron" aria-hidden="true"></i></button>
      ${tickets===2?'<p class="ag-bonus">+1 за точность</p>':''}
      ${star?'<p class="ap-star-note">вся коллекция собрана! рамка со звездой тоже твоя</p>':''}</div>
      <div class="ap-bottom"><button class="button button--primary pressable" type="button" data-game="lobby">отлично</button><button class="ap-pool-link pressable" type="button" data-game="share">поделиться подарком<i class="icon icon--share" aria-hidden="true"></i></button></div></div>`;
    ctx.announce(`твой подарок: ${prize.title}, ${hits} из 3 попаданий`);
  }
  function storyMarkup(ctx){
    const prize=run?.out?.prize||ctx.D.POOL.find(p=>ctx.S.taken.includes(p.id))||ctx.D.POOL[0];
    return `<article class="avc avc--story ap-story" aria-label="сторис: подарок за гирлянду"><img class="avc-logo" src="../../assets/brand/logo.png" alt="blink"><header class="avc-head"><span class="avc-head__date">мой новогодний подарок</span></header><img class="ap-story__prize" src="${ctx.src(prize.img)}" alt=""><h3>${prize.title}</h3><p>${run?.play?E.hits(run.play)*3:0} из 9 огоньков зажжены</p></article>`;
  }
  function renderBoard(el,ctx){renderPool(el,ctx);}
  function afterPrize(){}
  function nextPrize(){}
  function setRun(ctx,{prizeId=null,playing=false,paused=false,hits=2,finale=false}={}){
    stopAll();activeCtx=ctx;
    const prize=ctx.D.POOL.find(p=>p.id===prizeId)||remaining(ctx)[0]||ctx.D.POOL[0];
    run={prizeId:prize.id,play:E.create()};settle(ctx,run);
    if(!run.out)run.out={prize,tickets:1,star:false};
    if(playing||paused){
      run.play.elapsed=3200;run.play.roundElapsed=700;run.play.round=1;run.play.results[0]=true;
      run.play.paused=true;view='paused';renderPlay($('#game'),ctx);
      if(playing){view='playing';run.play.paused=false;renderPlay($('#game'),ctx);$('[data-game="catch"]')?.focus({preventScroll:true});loop(ctx);}
    }else{run.play.results=[hits>0,hits>1,hits>2];run.play.over=true;run.play.elapsed=3500;bonus(ctx,run);view=finale?'finish':'over';if(finale){renderPlay($('#game'),ctx);queueGift(ctx);}else renderResult($('#game'),ctx);}
    ctx.renderBalance();
  }
  /* ── шторки: подарок за гирлянду и звезда ─────────────────────────────── */

  const tierChip = (ctx, tier) => `<span class="avg-tier avg-tier--${tier}">${ctx.D.TIERS[tier].label}</span>`;

  function prizeMarkup(prize, extra, ctx) {
    const { D } = ctx;
    const more = prizeQueue.length > 0;
    const cta = more
      ? `<button class="button button--primary avg-prize__cta pressable" type="button" data-game="next-prize">дальше</button>`
      : `<button class="button button--primary avg-prize__cta pressable" type="button" data-game="close-prize">отлично</button>`;
    if (extra.star) {
      return `<div class="avg-prize" data-star>
        <div class="avg-prize__art">
          <img class="avg-prize__glow" src="${ctx.src(D.STAR.img)}" alt="">
          <img class="avg-prize__img" src="${ctx.src(D.STAR.img)}" alt="">
        </div>
        <span class="avg-tier avg-tier--legend">${ctx.D.POOL.length} подарков</span>
        <h2 class="avg-prize__title" id="prize-title">звезда на верхушке</h2>
        <p class="avg-prize__kind">вся коллекция твоя – и эта рамка тоже</p>
        ${cta}
      </div>`;
    }
    return `<div class="avg-prize">
      <div class="avg-prize__art">
        <img class="avg-prize__glow" src="${ctx.src(prize.img)}" alt="">
        <img class="avg-prize__img" src="${ctx.src(prize.img)}" alt="">
      </div>
      ${tierChip(ctx, prize.tier)}
      <h2 class="avg-prize__title" id="prize-title">${prize.title}</h2>
      <p class="avg-prize__kind">${prize.kind}</p>
      ${cta}
    </div>`;
  }

  function prizeEnter(prize, extra, ctx) {
    if (!reduced()) ctx.app.dispatchEvent(new CustomEvent("av:confetti"));
  }

  /* ── шторка «коллекция подарков» ───────────────────────────────────────── */

  function renderPool(el, ctx) {
    const { S, D } = ctx;
    el.innerHTML = `
      <div class="ag-rules"><p>3 нажатия · без таймера</p><p>Останови свет на лампочке с белой обводкой. Каждое попадание зажигает ещё три огонька и добавляет свет на экран. Огонёк движется туда-обратно, пока не нажмёшь. Подарок и билет – за каждый раунд, ещё один билет – за 3 попадания.</p><p>30 снежинок за раунд · до 3 раундов в день</p></div>
      <div class="avg-star">
        <img class="avg-star__img" src="renders/star-frame.webp" alt="">
        <div class="avg-star__text">
          <p class="avg-star__title">${S.star ? "звезда на верхушке" : D.STAR.title}</p>
          <p class="avg-star__kind">${D.STAR.kind}</p>
        </div>
      </div>
      ${["legend", "epic", "rare", "common"].map((t) => {
        const items = D.POOL.filter((p) => p.tier === t);
        return `<section class="avg-pool__tier">
          <h3 class="avg-pool__head">${tierChip(ctx, t)}<span class="avg-pool__count">${leftOf(ctx, t)} из ${items.length}</span></h3>
          <ul class="avg-pool__grid">${items.map((p) => {
            const got = S.taken.includes(p.id);
            return `<li class="avg-item${got ? " is-got" : ""}">
              <img class="avg-item__img" src="${ctx.src(p.img)}" alt="">
              <span class="avg-item__title">${p.title}</span>
              ${got ? `<span class="avg-item__got"><i class="icon icon--check" aria-hidden="true"></i>твоё</span>` : ""}
            </li>`;
          }).join("")}</ul>
        </section>`;
      }).join("")}
      <p class="avg-pool__social">каждый оставшийся подарок равновероятен<br>в каждом раунде подарок, без повторов</p>`;
  }

  /* ── большой розыгрыш ───────────────────────────────────────────────── */

  let drawIndex = 1;
  let drawCount = 3;
  let drawSending = false;

  function renderDraw(el, ctx) {
    const { S, D } = ctx;
    const choices = D.DRAW.prizes.map((p, i) => {
      const mine = S.draw[p.id] || 0;
      return `<button class="avd-prize pressable${i === drawIndex ? " is-selected" : ""}" type="button" data-draw="select" data-prize="${i}" aria-pressed="${i === drawIndex}" aria-label="${p.title}">
        <img class="avd-prize__art" src="${ctx.src(p.img)}" alt="">
        <span class="avd-prize__title">${p.title}</span>
        <span class="avd-prize__tickets">${mine ? `${mine} ${ctx.plural(mine, "билет", "билета", "билетов")}` : "нет билетов"}</span>
      </button>`;
    }).join("");
    el.innerHTML = `
      <p class="avd-when">${D.DRAW.when}</p>
      <div class="avd-prizes" role="group" aria-label="выбери приз">${choices}</div>
      <div class="avd-info" id="draw-info"></div>`;
    renderDrawInfo(el, ctx);
  }

  /** Выбор приза не меняет геометрию сетки и нижних контролов. */
  function renderDrawInfo(root, ctx) {
    const { S, D } = ctx;
    const p = D.DRAW.prizes[drawIndex];
    const mine = S.draw[p.id] || 0;
    drawCount = Math.max(1, Math.min(drawCount, S.tickets || 1));
    const chance = mine
      ? `твой шанс – 1 из ${Math.max(1, Math.round((p.total + mine) / mine)).toLocaleString("ru-RU").replace(/\s/g, NBSP)}`
      : "ещё не участвуешь";
    root.querySelectorAll(".avd-prize").forEach((card, index) => {
      const selected = index === drawIndex;
      card.classList.toggle("is-selected", selected);
      card.setAttribute("aria-pressed", String(selected));
      const count = S.draw[D.DRAW.prizes[index].id] || 0;
      $(".avd-prize__tickets", card).textContent = count ? `${count} ${ctx.plural(count, "билет", "билета", "билетов")}` : "нет билетов";
    });
    $("#draw-info", root).innerHTML = `
      <p class="avd-info__chance">${chance}</p>
      ${S.tickets > 0 ? `<div class="avd-put">
          <span class="avd-put__label">билеты</span>
          <button class="icon-button avd-step pressable" type="button" data-draw="minus" aria-label="меньше" ${drawCount <= 1 ? "disabled" : ""}><span aria-hidden="true">−</span></button>
          <span class="avd-put__count" aria-live="polite">${drawCount}</span>
          <button class="icon-button avd-step pressable" type="button" data-draw="plus" aria-label="больше" ${drawCount >= S.tickets ? "disabled" : ""}><i class="icon icon--plus" aria-hidden="true"></i></button>
        </div>
        <button class="button button--primary avd-cta pressable" type="button" data-draw="put" ${drawSending ? "disabled" : ""}>участвовать за ${drawCount}${NBSP}${ctx.plural(drawCount, "билет", "билета", "билетов")}</button>`
        : `<button class="button button--primary avd-cta pressable" type="button" data-draw="earn">к хваталке</button>`}`;
  }

  function putTickets(ctx) {
    const { S, D } = ctx;
    const p = D.DRAW.prizes[drawIndex];
    const n = Math.min(drawCount, S.tickets);
    const from = $("[data-draw='put']");
    if (!n || !from || from.disabled || drawSending) return;
    drawSending = true;
    const target = $(`.avd-prize[data-prize="${drawIndex}"] .avd-prize__art`);
    S.tickets -= n;
    S.draw[p.id] = (S.draw[p.id] || 0) + n;
    ctx.renderBalance();
    ctx.S.events.push({ name: "raffle_tickets", prizeId: p.id, count: n });
    const flight = ctx.flyFlakes(from, target, Math.min(6, n + 1), "art/ticket.webp", 34);
    renderDrawInfo($("#draw"), ctx);
    const finish = () => {
      drawSending = false;
      renderDrawInfo($("#draw"), ctx);
    };
    flight.then(finish, finish);
    ctx.announce(`${n} билетов на «${p.title}»`);
  }


  function click(t,ctx){
    switch(t.dataset.game){
      case 'start':return start(ctx);
      case 'catch':return catchLight(ctx);
      case 'resume':return resume(ctx);
      case 'earn':return ctx.toTasks();
      case 'lobby':view='lobby';return render($('#game'),ctx);
      case 'pool':return ctx.openPool();
      case 'draw':return ctx.toDraw();
      case 'share':track(ctx,'garland_share');return ctx.openStory(storyMarkup(ctx));
      case 'close-prize':return window.AV.closeSheet();
      default:break;
    }
    switch(t.dataset.draw){
      case 'select':drawIndex=Number(t.dataset.prize);drawCount=Math.min(3,ctx.S.tickets)||1;return renderDrawInfo($('#draw'),ctx);
      case 'minus':drawCount=Math.max(1,drawCount-1);return renderDrawInfo($('#draw'),ctx);
      case 'plus':drawCount=Math.min(ctx.S.tickets,drawCount+1);return renderDrawInfo($('#draw'),ctx);
      case 'put':return putTickets(ctx);
      case 'earn':return ctx.toTree();
      default:return undefined;
    }
  }
  const state=()=>({view,run});
  window.AV_GAME={render,renderPool,renderDraw,renderBoard,prizeMarkup,prizeEnter,afterPrize,nextPrize,
    click,cancel,pause,state,start,settle,bonus,choose,setRun,storyMarkup,wire,atmosphere};
})();
