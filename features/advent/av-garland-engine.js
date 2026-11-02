/* Light bounces indefinitely. Only a deliberate tap resolves an attempt. */
((root, factory) => {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.AV_GARLAND = engine;
})(typeof window === 'undefined' ? globalThis : window, () => {
  const BULBS=9, TARGET_BULBS=[4,6,2], STEP_MS=[200,170,140], FEEDBACK_MS=500;
  const TARGETS=TARGET_BULBS.map(i=>(i+.5)/BULBS);
  const create=()=>({elapsed:0,roundElapsed:0,feedbackRemaining:0,round:0,results:[null,null,null],stopped:[null,null,null],over:false,paused:false});
  const phase=r=>Math.floor(r.roundElapsed/STEP_MS[r.round])%(2*(BULBS-1));
  const activeBulb=r=>{const n=phase(r);return n<BULBS?n:2*(BULBS-1)-n;};
  const direction=r=>phase(r)<BULBS-1?1:-1;
  const position=r=>(activeBulb(r)+.5)/BULBS;
  const bulbAt=p=>p<0||p>=1?-1:Math.floor(p*BULBS);
  const hits=r=>r.results.filter(v=>v===true).length;
  function advance(r,ms){
    if(r.over||r.paused||!Number.isFinite(ms)||ms<=0)return;
    r.elapsed+=ms;
    if(r.feedbackRemaining>0){
      const used=Math.min(ms,r.feedbackRemaining);
      r.feedbackRemaining-=used;ms-=used;
      if(r.feedbackRemaining>0)return;
      r.round++;r.roundElapsed=0;
    }
    r.roundElapsed+=ms;
  }
  function tap(r){
    if(r.over||r.paused||r.results[r.round]!==null)return null;
    const hit=activeBulb(r)===TARGET_BULBS[r.round];
    r.results[r.round]=hit;r.stopped[r.round]=position(r);
    if(r.round===2)r.over=true;else r.feedbackRemaining=FEEDBACK_MS;
    return hit;
  }
  return {BULBS,TARGET_BULBS,STEP_MS,FEEDBACK_MS,TARGETS,create,position,bulbAt,activeBulb,direction,hits,advance,tap};
});
