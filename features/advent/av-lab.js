/* Two playable alternatives; the original garland remains available for comparison. */
(() => {
  'use strict';
  const G=window.AV_GAME,E=window.AV_LAB_ENGINE;
  const original={render:G.render,click:G.click,pause:G.pause,cancel:G.cancel,state:G.state};
  const $=(s)=>document.querySelector(s),reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode=null,view='lobby',ctx=null,root=null,selected=[],wheel=null,run=null,frame=0,timer=0,last=0;
  const fmt=n=>n.toLocaleString('ru-RU'),rnd=()=>{const n=new Uint32Array(1);crypto.getRandomValues(n);return n[0]/4294967296;};
  const stop=()=>{cancelAnimationFrame(frame);clearTimeout(timer);frame=0;timer=0;};
  const track=(name,extra={})=>ctx.S.events.push({name,variant:mode,...extra});
  const icon=kind=>`<img src="renders/${kind==='snow'?'snowflake':'ticket'}.webp" alt="${kind==='snow'?'снежинок':'билетов'}">`;
  const bonusText=b=>`${b.value} ${b.kind==='snow'?'снежинок':ctx.plural(b.value,'билет','билета','билетов')}`;
  const tabs=()=>`<nav class="al-tabs" aria-label="варианты игры"><button data-game="lab-wheel" aria-pressed="${mode==='wheel'}">колесо</button><button data-game="lab-score" aria-pressed="${mode==='score'}">на рекорд</button></nav>`;
  const back=()=>'<button class="al-text" data-game="lab-classic">классическая гирлянда</button>';
  const canSpin=()=>ctx.S.balance>=30&&ctx.S.garland.attempts<3&&ctx.S.taken.length<ctx.D.POOL.length;
  function loadBest(){try{const n=Number(localStorage.getItem('blink-advent-best-v1'));return Number.isFinite(n)&&n>=0?Math.floor(n):0;}catch{return 0;}}
  let best=loadBest();
  function saveBest(){best=Math.max(best,run.score);try{localStorage.setItem('blink-advent-best-v1',String(best));}catch{/* Session best still works when storage is unavailable. */}}
  const demo=[{name:'наташка',score:7400},{name:'саша',score:5800},{name:'даня',score:4200},{name:'вася',score:2600},{name:'оля',score:1400}];
  function rows(){return [...demo,...(best?[{name:'ты',score:best,you:true}]:[])].sort((a,b)=>b.score-a.score);}
  function leaderboard(){return `<ol class="al-ranking">${rows().map((r,i)=>`<li class="${r.you?'is-you':''}"><span>${i+1}</span><span class="al-avatar" aria-hidden="true">${r.name.slice(0,1)}</span><strong>${r.name}</strong><b>${fmt(r.score)}</b></li>`).join('')}</ol>`;}
  function chooseMode(next){stop();original.cancel();mode=next;view='lobby';selected=[];wheel=null;run=null;render(root,ctx);}
  function wheelArt(){
    const sectors=E.SECTORS.map((s,i)=>{
      const a=(i*45-90)*Math.PI/180,x=50+Math.cos(a)*31,y=50+Math.sin(a)*31;
      const bx=50+Math.cos(a)*45,by=50+Math.sin(a)*45,on=selected.includes(i);
      return `<button class="al-wheel-bulb ${on?'is-on':''}" style="--x:${bx}%;--y:${by}%;--angle:${i*45}deg" data-game="lab-pick" data-index="${i}" aria-label="удвоить ${bonusText(s)}, сектор ${i+1}" aria-pressed="${on}" ${view==='spinning'?'disabled':''}><img src="renders/garland-bulb-${on?'lit-gold':'gold'}.webp" alt=""></button><span class="al-sector ${on?'is-on':''}" style="--x:${x}%;--y:${y}%">${icon(s.kind)}<b>${s.value}</b>${on?'<small>×2</small>':''}</span>`;
    }).join('');
    return `<div class="al-wheel"><span class="al-pointer" aria-hidden="true"></span><div class="al-rotor" style="--turn:${wheel?.turn||0}deg">${sectors}<svg class="al-wheel-lines" viewBox="0 0 320 320" aria-hidden="true"><circle cx="160" cy="160" r="144"/>${Array.from({length:8},(_,i)=>{const a=(i*45-67.5)*Math.PI/180;return `<path d="M ${160+Math.cos(a)*60} ${160+Math.sin(a)*60} L ${160+Math.cos(a)*128} ${160+Math.sin(a)*128}"/>`;}).join('')}</svg></div><div class="al-wheel-hub"><img src="renders/gift-pink.webp" alt="подарок"><span>${view==='spinning'?'крутится…':`${selected.length} из 2`}</span></div></div>`;
  }
  function wheelLobby(){
    const spinning=view==='spinning';
    root.innerHTML=`<div class="al al-wheel-screen">${spinning?'':tabs()}<header class="al-heading"><h3>колесо<br>подарков</h3><p>${spinning?'сейчас узнаем твой бонус':'зажги 2 лампочки —<br>удвой бонусы под ними'}</p></header><div class="al-wheel-scene">${wheelArt()}</div><footer class="al-bottom">${spinning?'<p class="al-note">подарок + билет гарантированы</p>':'<button class="al-text al-note" data-game="lab-rules">подарок + билет · правила</button>'}<button class="button button--primary" data-game="lab-spin" ${spinning||selected.length!==2||!canSpin()?'disabled':''}>${spinning?'крутится…':ctx.S.taken.length===ctx.D.POOL.length?'вся коллекция собрана':ctx.S.garland.attempts>=3?'на сегодня всё':ctx.S.balance<30?'не хватает снежинок':selected.length===2?'крутить · 30 снежинок':`выбери ещё ${2-selected.length}`}</button></footer></div>`;
  }
  function spin(){
    if(view!=='lobby'||selected.length!==2||!canSpin())return;
    const prize=G.choose(ctx);if(!prize)return;
    const index=E.sectorAt(rnd()),bonus=E.reward(index,selected);
    const reserved={prizeId:prize.id};const out=G.settle(ctx,reserved);if(!out)return;
    ctx.S.balance-=30;ctx.S.garland.attempts++;
    if(bonus.kind==='snow')ctx.S.balance+=bonus.value;else ctx.S.tickets+=bonus.value;
    wheel={index,bonus,out,turn:1440+(360-index*45)%360};view='spinning';ctx.renderBalance();track('wheel_spin',{index,selected:[...selected],bonus:bonus.value});
    // Reserve both awards before the animation, so leaving cannot reroll or lose them.
    const turn=wheel.turn;wheel.turn=0;wheelLobby();wheel.turn=turn;
    void $('.al-rotor').offsetWidth;
    requestAnimationFrame(()=>{if(view==='spinning'&&mode==='wheel')$('.al-rotor')?.style.setProperty('--turn',`${turn}deg`);});
    timer=setTimeout(()=>{if(view!=='spinning')return;view='result';if(window.AV.current()==='game')render(root,ctx);},reduced()?400:3400);
  }
  function wheelResult(){
    const {out,bonus}=wheel;
    root.innerHTML=`<div class="al al-wheel-result"><header class="al-heading"><h3>твой подарок</h3></header><div class="al-gift"><img src="${ctx.src(out.prize.img)}" alt="${out.prize.title}"></div><h4>${out.prize.title}</h4><p class="al-note">+1 билет в розыгрыш</p><div class="al-bonus">${icon(bonus.kind)}<b>+${bonusText(bonus)}</b>${bonus.doubled?'<span>×2 сработал</span>':''}</div>${out.star?'<p class="al-note">вся коллекция собрана — рамка со звездой твоя</p>':''}<footer class="al-bottom"><button class="button button--primary" data-game="lab-wheel">отлично</button><button class="al-text" data-game="lab-score">попробовать на рекорд</button></footer></div>`;
    ctx.announce(`твой подарок: ${out.prize.title}. Бонус колеса: ${bonusText(bonus)}`);
  }
  function prizeLadder(){return `<div class="al-prize-ladder" aria-label="награды за очки">${E.SCORE_PRIZES.map(p=>`<div><img src="${ctx.src(p.img)}" alt="${p.title}"><b>${p.at?fmt(p.at):'за игру'}</b></div>`).join('')}</div>`;}
  function paintPrize(){
    const el=$('#al-live-prize'),level=E.prizeLevel(run.score),prizes=E.scorePrizes(ctx.S,run.score),current=prizes[level],next=prizes.find(p=>!p.claimed&&!p.unlocked);
    if(el.dataset.score===String(run.score))return;
    const upgraded=el.dataset.level!==undefined&&Number(el.dataset.level)<level;
    el.dataset.score=String(run.score);el.dataset.level=String(level);
    const title=current.claimed?current.awarded.title:current.duplicate?'1 билет за повтор':current.title;
    const img=current.claimed?current.awarded.img:current.duplicate?'r:ticket':current.img;
    const pending=prizes.some(p=>p.unlocked&&!p.claimed);
    el.classList.toggle('is-upgraded',upgraded);
    el.innerHTML=`<div class="al-live-prize__main"><img src="${ctx.src(img)}" alt=""><div><span>${current.claimed?'уже получено':'твой приз сейчас'}</span><strong>${title}</strong></div><button data-game="lab-finish">${pending?'забрать':'завершить'}</button></div><div class="al-live-prize__next">${next?`ещё ${fmt(next.at-run.score)} очков до ${next.duplicate&&!next.claimed?'билета за повтор':next.goal}`:pending?'все призы открыты':'все призы уже получены'}</div><progress max="${next?next.at-current.at:1}" value="${next?run.score-current.at:1}" aria-label="${next?`прогресс до ${next.title}`:'все призы открыты'}"></progress>`;
    if(upgraded)ctx.announce(`новый приз: ${title}`);
  }
  function scoreLobby(){
    root.innerHTML=`<div class="al al-score-lobby"><header class="al-heading"><h3>зажги больше</h3><p>60 секунд · 3 ошибки<br>больше очков — больше подарков</p></header>${prizeLadder()}<div class="al-preview">${G.wire(ctx,true,true)}</div><div class="al-record"><span>твой рекорд</span><strong>${fmt(best)}</strong><button class="al-text" data-game="lab-ranking">демо-рейтинг <i class="icon icon--chevron" aria-hidden="true"></i></button></div><footer class="al-bottom"><button class="button button--primary" data-game="lab-start">играть бесплатно</button><button class="al-text" data-game="lab-score-rules">призы и правила</button></footer></div>`;
  }
  function startScore(){
    if(view!=='lobby'&&view!=='result')return;
    stop();run=E.create(Math.floor(rnd()*4294967296));view='playing';track('score_start');scorePlay();loop();
  }
  function scorePlay(){
    root.innerHTML=`<div class="ag al al-score-play">${G.atmosphere()}<div class="al-score-hud"><div><strong id="al-points">0</strong><span>очки · <b id="al-multiplier">×1</b></span></div><div><strong id="al-time">60 с</strong><span>осталось</span></div><div><strong id="al-lives">3</strong><span>жизни</span></div></div><div class="ag-scene">${G.wire(ctx,false,true)}<p class="ag-feedback" id="al-feedback" aria-live="polite"></p></div><footer class="al-bottom"><div class="al-live-prize" id="al-live-prize"></div><button class="button button--primary" data-game="${view==='paused'?'lab-resume':'lab-catch'}">${view==='paused'?'продолжить':'стоп'}</button></footer></div>`;
    const button=$('[data-game="lab-catch"]');
    button?.addEventListener('pointerdown',e=>{if(e.button===0)catchScore();});
    button?.addEventListener('click',e=>{if(e.detail>0)e.stopPropagation();});
    button?.addEventListener('keydown',e=>{if(e.repeat&&(e.key==='Enter'||e.key===' '))e.preventDefault();});
    paintScore();
  }
  function paintScore(){
    if(!$('.al-score-play'))return;
    $('#al-points').textContent=fmt(run.score);$('#al-time').textContent=`${Math.ceil(run.remaining/1000)} с`;$('#al-lives').textContent=String(run.lives);
    $('#al-multiplier').textContent=`×${E.multiplier(run)}`;paintPrize();
    $('#al-feedback').textContent=view==='paused'?'пауза':run.last?(run.last.hit?`+${run.last.points}`:'мимо'):'';
    $('#al-feedback').classList.toggle('is-hit',!!run.last?.hit);
    const active=run.last?.active??E.active(run),order=[4,3,5,6,7,8,2,1,0];
    root.querySelectorAll('[data-bulb]').forEach(el=>{const i=+el.dataset.bulb;el.classList.toggle('is-current',i===active);el.classList.toggle('is-target',i===run.target);el.classList.toggle('is-lit',order.indexOf(i)<Math.min(9,run.hits));});
    root.querySelectorAll('.ag-atmosphere span').forEach((el,i)=>el.classList.toggle('is-on',run.hits>i*3));
    const button=$('[data-game="lab-catch"]');if(button)button.setAttribute('aria-disabled',String(!!run.cooldown));
  }
  function tick(){const now=performance.now();E.advance(run,now-last);last=now;if(run.over)finishScore();else paintScore();}
  function loop(){last=performance.now();const next=()=>{if(view!=='playing')return;tick();if(view==='playing')frame=requestAnimationFrame(next);};frame=requestAnimationFrame(next);}
  function catchScore(){if(view!=='playing')return;tick();if(view!=='playing')return;const hit=E.tap(run);if(hit===null)return;track('score_catch',{hit,score:run.score,streak:run.streak});if(run.over)finishScore();else paintScore();}
  function finishScore(){if(!run||view==='result')return;stop();run.over=true;run.newBest=run.score>best;saveBest();E.settleScore(ctx.S,run);if(ctx.S.taken.length===ctx.D.POOL.length&&!ctx.S.star){ctx.S.star=true;run.completionStar=true;}ctx.renderBalance();view='result';track('score_finish',{score:run.score,hits:run.hits});render(root,ctx);ctx.announce(`${fmt(run.score)} очков. ${run.rewards.length?'получено: '+run.rewards.map(p=>p.title).join(', '):'награды за эти очки уже получены'}`);}
  function scoreResult(){
    const rank=rows().findIndex(r=>r.you)+1,rewards=run.rewards||[],prize=rewards[rewards.length-1];
    root.innerHTML=`<div class="al al-score-result"><header class="al-heading"><h3>${prize?'твой подарок':run.newBest?'новый рекорд':'твой результат'}</h3><p>${fmt(run.score)} очков${rank?` · ${rank}-е место в демо-рейтинге`:''}</p></header>${prize?`<div class="al-earned-art"><img src="${ctx.src(prize.img)}" alt="${prize.title}"></div><h4>${prize.title}</h4><span class="al-received">получено</span>${rewards.length>1?`<div class="al-earned-extras">${rewards.slice(0,-1).map(p=>`<span><img src="${ctx.src(p.img)}" alt="">${p.title}</span>`).join('')}</div>`:''}`:`<div class="al-score-art"><img src="renders/star-frame.webp" alt=""><strong>${fmt(run.score)}</strong><span>очков</span></div><p class="al-note">награды за эти очки уже получены<br>${E.SCORE_PRIZES.every(p=>ctx.S.scoreRewards?.[p.id])?'можно улучшить свой рекорд':'набери больше, чтобы открыть следующие'}</p>`}${run.completionStar?'<p class="al-note">вся коллекция собрана — рамка со звездой твоя</p>':''}<footer class="al-bottom"><button class="button button--primary" data-game="lab-start">ещё раз</button><button class="al-text" data-game="lab-ranking">посмотреть рейтинг</button></footer></div>`;
  }
  function ranking(){root.innerHTML=`<div class="al"><header class="al-heading"><h3>кто зажёг<br>больше всех</h3><p>демо-рейтинг · лучший результат</p></header>${leaderboard()}<p class="al-note">соперники — пример<br>твой рекорд сохраняется в этом браузере</p><footer class="al-bottom"><button class="button button--primary" data-game="lab-score">играть на рекорд</button></footer></div>`;}
  function rules(){root.innerHTML=`<div class="al al-rules">${mode==='wheel'?tabs():''}<header class="al-heading"><h3>${mode==='wheel'?'твой выбор —<br>двойной бонус':'попадай<br>подряд'}</h3></header><img class="al-rules-art" src="renders/${mode==='wheel'?'gift-gold':'star-frame'}.webp" alt=""><div class="al-rules-copy">${mode==='wheel'?'<p>Выбери две лампочки. Если выпадет одна из них, бонус под ней удвоится.</p><p>У каждого из восьми секторов одинаковый шанс: 1 из 8. Выбор меняет размер бонуса, но не вероятность.</p><p>Подарок из коллекции и один билет гарантированы. Колесо добавляет бонус сверху.</p><p>30 снежинок · до 3 вращений в день вместе с обычной гирляндой.</p>':'<p>Останови белый огонёк на отмеченной лампочке. За попадание — 100 очков.</p><p>Каждые 3 попадания подряд повышают множитель: ×2, ×3, максимум ×4. Огонёк постепенно ускоряется.</p><p>Промах сбрасывает серию. Раунд длится до 60 секунд или трёх ошибок.</p><p>Билет за завершённую игру. 500 очков — стикерпак, 1 500 — 3 дня VIP, 3 000 — хвост «кристалл». Все достигнутые награды начисляются в конце игры.</p><p>Каждая награда — один раз за адвент. За предмет, который уже есть, — билет. Повторные попытки бесплатные, в рейтинг идёт лучший результат.</p>'}</div><footer class="al-bottom"><button class="button button--primary" data-game="lab-back">понятно</button>${back()}</footer></div>`;}
  function render(el,c){root=el;ctx=c;if(!mode)return original.render(el,c);if(view==='ranking')return ranking();if(view==='rules')return rules();if(mode==='wheel')return view==='result'?wheelResult():wheelLobby();if(view==='playing'||view==='paused')return scorePlay();return view==='result'?scoreResult():scoreLobby();}
  function pause(){if(!mode)return original.pause();stop();if(view==='playing'){const now=performance.now();E.advance(run,now-last);if(run.over){finishScore();return;}run.paused=true;view='paused';}if(view==='spinning')view='result';}
  G.variant=next=>{stop();mode=next;view='lobby';selected=[];wheel=null;run=null;};
  G.render=render;G.pause=pause;
  G.cancel=()=>{stop();mode=null;view='lobby';wheel=null;run=null;selected=[];original.cancel();};
  G.state=()=>mode?{variant:mode,view,run,wheel,selected:[...selected],best}:original.state();
  G.click=(t,c)=>{
    const action=t.dataset.game;
    if(!action?.startsWith('lab-'))return original.click(t,c);
    ctx=c;root=$('#game');
    switch(action){
      case 'lab-wheel':return chooseMode('wheel');
      case 'lab-score':return chooseMode('score');
      case 'lab-classic':stop();mode=null;return original.render(root,c);
      case 'lab-pick':{if(view!=='lobby')return;const i=Number(t.dataset.index);if(!Number.isInteger(i)||i<0||i>7)return;selected=selected.includes(i)?selected.filter(n=>n!==i):selected.length<2?[...selected,i]:selected;wheelLobby();return;}
      case 'lab-spin':return spin();
      case 'lab-start':return startScore();
      case 'lab-catch':return catchScore();
      case 'lab-resume':if(view!=='paused')return;run.paused=false;view='playing';scorePlay();loop();return;
      case 'lab-finish':if(view==='playing'||view==='paused')return finishScore();return;
      case 'lab-ranking':view='ranking';return render(root,c);
      case 'lab-back':view='lobby';return render(root,c);
      case 'lab-rules':case 'lab-score-rules':view='rules';return render(root,c);
    }
  };
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode)pause();else if(mode&&ctx&&window.AV.current()==='game')render(root,ctx);});
})();
