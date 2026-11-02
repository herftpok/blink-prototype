/* node prototype/tools/test_advent_garland.cjs */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const root = path.join(__dirname, '../features/advent');
const fakeEl = { innerHTML:'', dataset:{}, style:{setProperty(){}},classList:{toggle(){}},setAttribute(){},querySelector:()=>fakeEl,querySelectorAll:()=>[],addEventListener(){},focus(){} };
const sandbox = {window: {matchMedia:()=>({matches:false}), AV:{current:()=> 'game'}}, document: {querySelector:()=>fakeEl,addEventListener(){}}, performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){},crypto:webcrypto, setTimeout:()=>1, clearTimeout(){}, CustomEvent:class{}};
vm.createContext(sandbox);
for(const file of ['av-garland-engine.js','av-data.js','av-game.js']) vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox);
const D=sandbox.window.AV_DATA, G=sandbox.window.AV_GAME;
const ctx=()=>({D,S:{today:0,balance:90,tickets:0,taken:[],star:false,garland:{attempts:0},events:[]},src:x=>x,announce(){},renderBalance(){},app:{dispatchEvent(){}}});
let count=0;
function test(name,fn){G.cancel();fn();console.log('ok '+name);count++;}
test('grant is idempotent and rejects duplicate or missing prizes',()=>{
 const c=ctx(),r={prizeId:D.POOL[0].id};
 assert.equal(G.settle(c,r).tickets,1);G.settle(c,r);
 assert.equal(c.S.tickets,1);assert.equal(c.S.taken.length,1);
 assert.equal(G.settle(c,{prizeId:r.prizeId}),null);
 assert.equal(G.settle(c,{prizeId:'missing'}),null);
 assert.equal(c.S.tickets,1);
});
test('25 opens grant all unique gifts, completion star and 25 tickets',()=>{
 const c=ctx();
 for(let i=0;i<25;i++){
  const prize=G.choose(c,()=>.5);assert.ok(prize);
  G.settle(c,{prizeId:prize.id});assert.equal(c.S.star,i===24);
 }
 assert.equal(c.S.taken.length,25);assert.equal(new Set(c.S.taken).size,25);
 assert.equal(c.S.tickets,25);assert.equal(G.choose(c,()=>0),null);
});
test('every remaining gift occupies an equal random interval',()=>{
 const c=ctx(); c.S.taken=[D.POOL[2].id];
 const remaining=D.POOL.filter(p=>!c.S.taken.includes(p.id));
 remaining.forEach((p,i)=>assert.equal(G.choose(c,()=>(i+.5)/remaining.length).id,p.id));
});
test('start charges once and grants immediately, navigation preserves reward',()=>{
 const c=ctx();G.start(c);G.start(c);
 assert.equal(c.S.balance,60);assert.equal(c.S.garland.attempts,1);
 assert.equal(c.S.taken.length,1);assert.equal(c.S.tickets,1);
 assert.equal(G.state().view,'playing');G.pause();
 assert.equal(G.state().view,'paused');assert.equal(G.state().run.out.prize.id,c.S.taken[0]);
 assert.equal(c.S.events.filter(e=>e.name==='garland_start').length,1);
});
test('insufficient balance, daily limit and empty pool never charge',()=>{
 for(const variant of ['poor','done','empty']){
  G.cancel();const c=ctx();
  if(variant==='poor')c.S.balance=29;
  if(variant==='done')c.S.garland.attempts=3;
  if(variant==='empty')c.S.taken=D.POOL.map(p=>p.id);
  const before=JSON.stringify(c.S);G.start(c);assert.equal(JSON.stringify(c.S),before);
 }
});
const E=require(path.join(root,'av-garland-engine.js'));
test('three deliberate hits finish; repeated taps do nothing',()=>{
 const r=E.create();
 for(let i=0;i<3;i++){
  E.advance(r,(E.TARGET_BULBS[i]+.5)*E.STEP_MS[i]);
  assert.equal(E.tap(r),true);assert.equal(E.tap(r),null);
  if(i<2){assert.equal(r.over,false);E.advance(r,E.FEEDBACK_MS);}
 }
 assert.equal(E.hits(r),3);assert.equal(r.over,true);assert.equal(r.results.length,3);
});
test('waiting never advances an attempt or awards a miss, even after an hour',()=>{
 const r=E.create();E.advance(r,3600000);
 assert.equal(r.round,0);assert.equal(r.over,false);assert.deepEqual(r.results,[null,null,null]);
 E.tap(r);E.advance(r,E.FEEDBACK_MS+3600000);
 assert.equal(r.round,1);assert.equal(r.over,false);assert.equal(r.results[1],null);
 E.tap(r);E.advance(r,E.FEEDBACK_MS+3600000);
 assert.equal(r.round,2);assert.equal(r.over,false);assert.equal(r.results[2],null);
 E.tap(r);assert.equal(r.over,true);
});
test('light reverses at both ends without disappearing or repeating an endpoint',()=>{
 const r=E.create(),seen=[];
 for(let i=0;i<19;i++){seen.push(E.activeBulb(r));E.advance(r,E.STEP_MS[0]);}
 assert.deepEqual(seen,[0,1,2,3,4,5,6,7,8,7,6,5,4,3,2,1,0,1,2]);
});
test('only the marked bulb wins in either direction',()=>{
 for(let round=0;round<3;round++)for(let step=0;step<16;step++){
  const r=E.create();r.round=round;
  E.advance(r,(step+.5)*E.STEP_MS[round]);
  const bulb=step<9?step:16-step;
  assert.equal(E.activeBulb(r),bulb);assert.equal(E.tap(r),bulb===E.TARGET_BULBS[round]);
 }
 assert.deepEqual(E.STEP_MS,[200,170,140]);
});
test('hit boundaries match the visible bulb; pause also freezes feedback',()=>{
 for(let round=0;round<3;round++){
  const width=E.STEP_MS[round],start=E.TARGET_BULBS[round]*width;
  for(const [offset,expected] of [[-.01,false],[.01,true],[width-.01,true],[width+.01,false]]){
   const r=E.create();r.round=round;E.advance(r,start+offset);assert.equal(E.tap(r),expected);
  }
 }
 const r=E.create();E.advance(r,900);r.paused=true;E.advance(r,10000);
 assert.equal(r.elapsed,900);assert.equal(E.tap(r),null);
 r.paused=false;assert.equal(E.tap(r),true);E.advance(r,100);r.paused=true;
 E.advance(r,10000);assert.equal(r.feedbackRemaining,400);assert.equal(r.round,0);
 r.paused=false;E.advance(r,400);assert.equal(r.round,1);assert.equal(r.roundElapsed,0);
});
test('large frames preserve bouncing and cannot manufacture a result',()=>{
 const a=E.create(),b=E.create();E.advance(a,12345);
 for(let i=0;i<12345;i++)E.advance(b,1);
 assert.equal(E.activeBulb(a),E.activeBulb(b));assert.equal(E.direction(a),E.direction(b));
 assert.deepEqual(a.results,b.results);assert.equal(a.round,b.round);
});
test('bonus requires completed 3/3 and is granted once',()=>{
 for(let hits=0;hits<=3;hits++){
  const c=ctx(),r={prizeId:D.POOL[0].id,play:E.create()};G.settle(c,r);
  r.play.results=[hits>0,hits>1,hits>2];assert.equal(G.bonus(c,r),false);
  r.play.over=true;G.bonus(c,r);G.bonus(c,r);
  assert.equal(c.S.tickets,hits===3?2:1);assert.equal(r.out.tickets,c.S.tickets);
 }
});
console.log(`${count} checks passed`);
