// A local fixture of timestamped samples. Coordinates refer to the demo map tile.
// Deterministic demo sensor readings. Guides define only the underlying journey;
// observed fixes have independent timestamps, accuracy and correlated drift.
const frameWidth=512,frameHeight=1108;
const scenarios=[
  {date:'2026-11-09',day:'9 ноября',weekday:'понедельник',area:'canal',title:'Обводный канал',latitude:59.909,zoom:14,seed:912,start:7*3600+35*60,zones:[],guides:[
    {points:[[28,87],[36,87],[47.7,87],[48.5,78],[48.2,62],[47.6,51.7],[55,50],[68,45.5],[82,40.5],[88,38]],pace:90,acceleration:[48,154],wait:45}]},
  {date:'2026-11-08',day:'8 ноября',weekday:'воскресенье',area:'island',title:'Васильевский остров',latitude:59.9445,zoom:15,seed:820,start:8*3600+12*60,zones:[{id:'home',x:18,y:77}],guides:[
    {points:[[18,77],[27,74.8],[30,73.7],[27,71.5],[39,68.2],[54,64.8]],pace:4.5,wait:410},
    {points:[[54,64.8],[64,62.3],[70,61],[66,57.5],[55,48],[49,42.7],[42,37.4],[36,32.4],[42,29.3],[49,27.9],[64,28.1]],pace:36,wait:90},
    {points:[[64,28.1],[66,30],[71,31.5],[69,33.4],[73,36],[78,35],[76,33.4],[74,34]],pace:3.8,wait:360}]},
  {date:'2026-11-07',day:'7 ноября',weekday:'суббота',area:'garden',title:'Песочная набережная',latitude:59.9705,zoom:16,seed:725,start:13*3600+47*60,zones:[],guides:[
    {points:[[19,83],[24,80],[25,77],[27,72],[31,69],[42,66.4],[55,66],[66,66],[76,65.9]],pace:4.3,wait:95},
    {points:[[76,65.9],[68,66.3],[55,66.7],[45,67.9],[35,70.8],[26,71.7],[30,66],[32,59],[34,53],[39,49],[44,44],[52,41],[68,36],[86,32.4]],pace:3.6,wait:185}]},
  {date:'2026-11-06',day:'6 ноября',weekday:'пятница',area:'canal',title:'Обводный канал',latitude:59.909,zoom:14,seed:637,start:18*3600+29*60,zones:[{id:'work',x:28,y:87}],guides:[
    {points:[[28,87],[36,87],[47.7,87],[48.5,78],[48.5,71],[48.2,63.5],[47.6,51.7],[54,50],[63,47],[74,43],[87,38.8],[83,34],[79,29]],pace:45,gap:[.40,.55],wait:38}]},
  {date:'2026-11-05',day:'5 ноября',weekday:'четверг',area:'island',title:'Васильевский остров',latitude:59.9445,zoom:15,seed:531,start:21*3600+7*60,zones:[],guides:[
    {points:[[74,34],[70,31],[65,28]],pace:4.1,wait:40},
    {points:[[65,28],[51,28],[43,29],[36,32.4],[43,38.6],[55,48],[69,60.8]],pace:84,acceleration:[66,146],wait:26}]}
];
// Sparse archive dates exercise month and year navigation in the demo.
for(const [date,example] of [
  ['2026-10-30',1],['2026-10-12',2],['2026-09-04',4],['2026-04-21',0],
  ['2026-01-13',1],['2025-12-31',3],['2025-11-06',2]
]){
  const timestamp=new Date(date+'T12:00:00Z');
  const day=timestamp.toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'});
  scenarios.push({...scenarios[example],date,day:date.slice(0,4)==='2026'?day:day+' '+date.slice(0,4),
    weekday:timestamp.toLocaleDateString('ru-RU',{weekday:'long',timeZone:'UTC'}),
    seed:Number(date.replaceAll('-',''))});
}
// A mixed day for the visit timeline. Older stored days keep their own observations.
scenarios.unshift({...scenarios[1],date:'2026-11-11',day:'11 ноября',weekday:'среда',seed:111126,
  start:7*3600+40*60,initialDwell:44*60,
  zones:[{id:'home',x:18,y:77},{id:'study',x:54,y:64.8},{id:'work',x:64,y:28.1}],
  guides:[
    {...scenarios[1].guides[0],wait:3*3600+18*60},
    {points:[[54,64.8],[64,62.3],[70,61],[66,57.5],[55,48],[49,42.7]],pace:37,wait:42*60},
    {points:[[49,42.7],[42,37.4],[36,32.4],[42,29.3],[49,27.9],[64,28.1]],pace:4.6,wait:4*3600+25*60},
    {...scenarios[1].guides[2],wait:90}
  ]});
// A separate demo day keeps existing, possibly edited routes intact.
const travelExample=scenarios[0];
scenarios.splice(1,0,{...travelExample,date:'2026-11-10',day:'10 ноября',weekday:'вторник',seed:101126,
  start:0,initialDwell:6*3600+45*60,
  zones:[{id:'overnight',x:18,y:77},{id:'metro',x:54,y:64.8},
    {id:'study',x:49,y:42.7},{id:'airport',x:74,y:34}],
  guides:travelExample.guides.map((guide,i)=>({...guide,wait:[4*60,5*3600,80,52*60][i]}))
});
function generator(seed){
  return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
}
function buildDay(config){
  const rand=generator(config.seed),mPerX=frameWidth*156543.0339*Math.cos(config.latitude*Math.PI/180)/2**config.zoom/100;
  const aspect=frameHeight/frameWidth, distance=(a,b)=>mPerX*Math.hypot(a.x-b.x,(a.y-b.y)*aspect);
  let t=config.start,walked=0,metres=0,dx=0,dy=0;
  const fixes=[];
  function measure(x,y,speed,mode,accuracy){
    dx=.7*dx+(rand()-.5)*accuracy*1.3;dy=.7*dy+(rand()-.5)*accuracy*1.3;
    fixes.push({x:x+dx/mPerX,y:y+dy/(mPerX*aspect),t,speed,mode,accuracy:Math.round(accuracy)});
  }
  function dwell(point,seconds){
    for(let left=seconds;left>0;){
      const dt=Math.min(left,7+Math.round(rand()*17));left-=dt;t+=dt;
      measure(...point,0,'still',6+rand()*21);
    }
  }
  dwell(config.guides[0].points[0],config.initialDwell ?? (config.zones.length?275:32));
  for(const guide of config.guides){
    const line=guide.points.map(([x,y])=>({x,y})),lengths=[0];
    for(let i=1;i<line.length;i++)lengths.push(lengths.at(-1)+distance(line[i-1],line[i]));
    const total=lengths.at(-1),drive=guide.pace>15;
    let along=0,lastAlong=0,headingIndex=1,gapPending=false;
    while(along<total){
      const dt=drive?.25+rand()*.65:1.5+rand()*3;
      const speed=guide.acceleration?Math.sqrt(guide.acceleration[0]**2+(guide.acceleration[1]**2-guide.acceleration[0]**2)*along/total):guide.pace*(.68+.55*rand()+.20*Math.sin(along/total*7));
      const advance=Math.min(total-along,speed/3.6*dt);
      along+=advance;t+=advance/(speed/3.6);
      while(headingIndex<line.length-1 && along>lengths[headingIndex])headingIndex++;
      const a=line[headingIndex-1],b=line[headingIndex],f=(along-lengths[headingIndex-1])/(lengths[headingIndex]-lengths[headingIndex-1]);
      if(guide.gap && along/total>guide.gap[0] && along/total<guide.gap[1]){gapPending=true;continue}
      const accuracy=drive?5+rand()*11:5+rand()*17;
      measure(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f,speed,drive?'drive':'walk',rand()<.035?accuracy*2.7:accuracy);
      const fix=fixes.at(-1);
      fix.gapBefore=gapPending;
      if(!gapPending){metres+=along-lastAlong;if(!drive)walked+=along-lastAlong}
      lastAlong=along;gapPending=false;
    }
    dwell(guide.points.at(-1),guide.wait);
  }
  const {day,weekday,area,title,zones}=config;
  return finishDay({day,weekday,area,title,zones,mPerX},fixes,walked,metres);
}
// Collect observed stationary intervals; an interruption in fixes ends a visit.
function stationaryVisits(fixes,mPerX){
  const distance=(a,b)=>mPerX*Math.hypot(a.x-b.x,(a.y-b.y)*frameHeight/frameWidth);
  const visits=[];
  for(let i=0;i<fixes.length;){
    if(fixes[i].mode!=='still'){i++;continue}
    let j=i+1;
    while(j<fixes.length && fixes[j].mode==='still' && !fixes[j].gapBefore && distance(fixes[i],fixes[j])<55)j++;
    if(j-i>=2){
      const cluster=fixes.slice(i,j),mean=k=>cluster.reduce((sum,p)=>sum+p[k],0)/cluster.length;
      visits.push({x:mean('x'),y:mean('y'),accuracy:Math.round(mean('accuracy')),t:fixes[i].t,end:fixes[j-1].t,first:i,last:j-1});
    }
    i=j;
  }
  return visits;
}
function finishDay({day,weekday,area,title,zones,mPerX},fixes,walked,metres){
  const stops=stationaryVisits(fixes,mPerX)
    .filter(s=>s.end-s.t>=200 && s.last-s.first>=3)
    .map(({first,last,...s})=>{
      const zone=zones.find(z=>mPerX*Math.hypot(z.x-s.x,(z.y-s.y)*frameHeight/frameWidth)<35);
      return {...s,id:zone?.id||'unknown'};
    });
  let elapsed=0;
  fixes.forEach((fix,i)=>{
    if(i)elapsed+=(fix.t-fixes[i-1].t)*(fix.mode==='still'?.12:1);
    fix.replay=elapsed;
  });
  for(const fix of fixes)fix.replay/=elapsed;
  return {day,weekday,area,title,zones,fixes,stops,mPerX,steps:Math.round(walked/.74),km:metres/1000,peak:Math.round(Math.max(...fixes.map(p=>p.speed)))};
}
