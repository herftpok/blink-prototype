/* Pure rules for the two Advent experiments; browser and Node share the same rules. */
((root,factory)=>{const E=factory();if(typeof module==='object'&&module.exports)module.exports=E;else root.AV_LAB_ENGINE=E;})(typeof window==='undefined'?globalThis:window,()=>{
  const SECTORS=[{kind:'snow',value:20},{kind:'ticket',value:1},{kind:'snow',value:40},{kind:'ticket',value:1},{kind:'snow',value:60},{kind:'ticket',value:2},{kind:'snow',value:30},{kind:'ticket',value:3}];
  const sectorAt=random=>Math.min(7,Math.max(0,Math.floor(random*8)));
  const reward=(index,selected)=>({...SECTORS[index],value:SECTORS[index].value*(selected.includes(index)?2:1),doubled:selected.includes(index)});
  const SCORE_PRIZES=[
    {id:'finish',at:0,title:'1 билет в розыгрыш',img:'r:ticket',goal:'билета'},
    {id:'stickers',at:500,item:'pack-snow',title:'стикерпак «снежинки»',img:'r:snowflake',goal:'стикерпака'},
    {id:'vip',at:1500,item:'vip-3',title:'3 дня blink vip',img:'a:market/vip-star.png',goal:'3 дней VIP'},
    {id:'crystal',at:3000,item:'tail-crystal',title:'хвост «кристалл»',img:'a:market/tails/crystal.webp',goal:'хвоста «кристалл»'}
  ];
  const prizeLevel=score=>SCORE_PRIZES.reduce((level,p,i)=>score>=p.at?i:level,0);
  function scorePrizes(state,score){return SCORE_PRIZES.map(p=>({...p,unlocked:score>=p.at,claimed:!!state.scoreRewards?.[p.id],awarded:state.scoreRewards?.[p.id],duplicate:!!p.item&&state.taken.includes(p.item)}));}
  function settleScore(state,r){
    if(!r.over)return [];
    if(r.rewardsSettled)return r.rewards;
    state.scoreRewards ||= {};
    r.rewards=scorePrizes(state,r.score).filter(p=>p.unlocked&&!p.claimed).map(p=>{
      let award=p;
      if(!p.item||p.duplicate){state.tickets++;award={...p,title:p.duplicate?'1 билет за повтор':'1 билет в розыгрыш',img:'r:ticket'};}
      else state.taken.push(p.item);
      state.scoreRewards[p.id]={title:award.title,img:award.img};
      return award;
    });
    r.rewardsSettled=true;
    return r.rewards;
  }
  const create=(seed=1)=>({remaining:60000,cursor:0,cooldown:0,target:4,hits:0,streak:0,bestStreak:0,score:0,lives:3,paused:false,over:false,last:null,seed:seed>>>0});
  const step=r=>Math.max(110,260-r.hits*7);
  const active=r=>{const n=Math.floor(r.cursor/step(r))%16;return n<9?n:16-n;};
  const multiplier=r=>Math.min(4,1+Math.floor(r.streak/3));
  function nextTarget(r){r.seed=(Math.imul(r.seed,1664525)+1013904223)>>>0;const n=r.seed%8;r.target=n>=r.target?n+1:n;r.cursor=0;r.last=null;}
  function advance(r,ms){
    if(r.paused||r.over||!Number.isFinite(ms)||ms<=0)return;
    const used=Math.min(ms,r.remaining);r.remaining-=used;
    if(!r.remaining){r.over=true;return;}
    let move=used;
    if(r.cooldown){const wait=Math.min(move,r.cooldown);r.cooldown-=wait;move-=wait;if(!r.cooldown)nextTarget(r);}
    if(!r.cooldown)r.cursor+=move;
  }
  function tap(r){
    if(r.paused||r.over||r.cooldown)return null;
    const stopped=active(r),hit=stopped===r.target;
    if(hit){const points=100*multiplier(r);r.score+=points;r.hits++;r.streak++;r.bestStreak=Math.max(r.bestStreak,r.streak);r.last={hit,points,active:stopped};}
    else{r.lives--;r.streak=0;r.last={hit,points:0,active:stopped};}
    r.cooldown=350;if(!r.lives)r.over=true;
    return hit;
  }
  return {SECTORS,sectorAt,reward,SCORE_PRIZES,prizeLevel,scorePrizes,settleScore,create,step,active,multiplier,advance,tap};
});
