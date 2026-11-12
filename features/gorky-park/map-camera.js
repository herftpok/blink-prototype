// Координаты SVG – плоскость земли. Камера общая для карты, 3D-сцены и пинов людей.
export function createParkMap(viewport, world, entry, venue) {
  const glCanvas=viewport.querySelector('canvas');
  const view={x:venue[0],y:venue[1],zoom:1.75,bearing:0,width:0,height:0};
  const pointers=new Map();
  const limit=(n,low,high)=>Math.max(low,Math.min(high,n));
  let scene=null, tried=false, contextLost=false, active=false;
  let pins=[], pendingFrame=0, animation=null, dragged=false;
  let star=null, lastMatrix='', pinsDirty=true;
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');

  function groundDelta(dx,dy) {
    const c=Math.cos(view.bearing), s=Math.sin(view.bearing);
    return [(dx*c+dy*s)/view.zoom,(-dx*s+dy*c)/view.zoom];
  }
  function groundAt(point) {
    const [dx,dy]=groundDelta(point.x-view.width/2,point.y-view.height/2);
    return [view.x+dx,view.y+dy];
  }
  function setCenter(x,y) {
    const c=Math.abs(Math.cos(view.bearing)),s=Math.abs(Math.sin(view.bearing));
    const halfW=Math.min(world.offsetWidth/2,(view.width*c+view.height*s)/(2*view.zoom));
    const halfH=Math.min(world.offsetHeight/2,(view.width*s+view.height*c)/(2*view.zoom));
    view.x=limit(x,halfW,world.offsetWidth-halfW);
    view.y=limit(y,halfH,world.offsetHeight-halfH);
  }
  function atScreen(point) {
    const c=Math.cos(view.bearing)*view.zoom,s=Math.sin(view.bearing)*view.zoom;
    const x=point[0]-view.x,y=point[1]-view.y;
    return [view.width/2+c*x-s*y,view.height/2+s*x+c*y];
  }
  function reframe(anchor,point,zoom,bearing) {
    animation=null;
    view.zoom=limit(zoom,1,7);
    view.bearing=Math.atan2(Math.sin(bearing),Math.cos(bearing));
    const offset=groundDelta(point.x-view.width/2,point.y-view.height/2);
    setCenter(anchor[0]-offset[0],anchor[1]-offset[1]);
    redraw();
  }
  async function prepare() {
    if(tried || !active) return;
    tried=true;
    const context=glCanvas.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power'});
    if(!context) return;
    const {createParkScene}=await import('./park-scene.js');
    scene=createParkScene(glCanvas,context,venue);
    if(star) scene.setStar(star.at,star.mode,performance.now()/1000,star.onLand);
    redraw();
  }
  glCanvas.addEventListener('webglcontextlost',ev=>{
    ev.preventDefault(); contextLost=true; redraw();
  });
  glCanvas.addEventListener('webglcontextrestored',()=>{
    contextLost=false; scene?.invalidateShadow(); redraw();
  });

  function paint(now) {
    pendingFrame=0;
    if(!view.width || !view.height || document.hidden) return;
    if(animation) {
      const t=Math.min(1,(now-animation.start)/280);
      const f=1-(1-t)**3;
      setCenter(animation.x+(animation.to[0]-animation.x)*f,animation.y+(animation.to[1]-animation.y)*f);
      if(t<1)redraw(); else animation=null;
    }
    const c=Math.cos(view.bearing)*view.zoom,s=Math.sin(view.bearing)*view.zoom;
    const [left,top]=atScreen([0,0]);
    const matrix='matrix('+[c,s,-s,c,left,top].join(',')+')';
    // Сцена живая (фонтан, лодки, звезда): кадры идут постоянно, а DOM трогаем только при движении камеры.
    if(matrix!==lastMatrix || pinsDirty) {
      lastMatrix=matrix; pinsDirty=false;
      world.style.transform=matrix;
      for(const [node,xy] of pins) {
        const [px,py]=atScreen(xy);
        node.style.setProperty('--x',px); node.style.setProperty('--y',py);
      }
    }
    const live=active && scene && !contextLost;
    let [x,y]=atScreen(venue);
    let width=46,height=46;
    y-=12;
    if(live) {
      const {min,max}=scene.render(view,now/1000);
      x=(min.x+max.x)/2; y=(min.y+max.y)/2;
      width=Math.max(44,max.x-min.x); height=Math.max(44,max.y-min.y);
    }
    entry.style.setProperty('--place-x',x+'px');
    entry.style.setProperty('--place-y',y+'px');
    entry.style.setProperty('--place-width',width+'px');
    entry.style.setProperty('--place-height',height+'px');
    glCanvas.hidden=!live;
    entry.querySelector('img').hidden=Boolean(live);
    if(live && !reduced.matches) redraw();
  }
  function redraw() {
    if(!pendingFrame)pendingFrame=requestAnimationFrame(paint);
  }
  function resize() {
    view.width=viewport.clientWidth; view.height=viewport.clientHeight;
    setCenter(view.x,view.y); redraw();
  }
  new ResizeObserver(resize).observe(viewport);
  resize();
  function center(point,animate=true) {
    if(!animate || reduced.matches) {animation=null;setCenter(...point);}
    else animation={x:view.x,y:view.y,to:point,start:performance.now()};
    redraw();
  }
  function local(ev) {
    const r=viewport.getBoundingClientRect();
    return {x:(ev.clientX-r.left)*view.width/r.width,y:(ev.clientY-r.top)*view.height/r.height};
  }
  function pair(points) {
    const [a,b]=points;
    return {mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},dist:Math.hypot(b.x-a.x,b.y-a.y),angle:Math.atan2(b.y-a.y,b.x-a.x)};
  }
  viewport.addEventListener('pointerdown',ev=>{
    if(ev.button!==0 && ev.button!==2)return;
    if(!pointers.size) dragged=false;
    animation=null;
    const pos=local(ev);
    pointers.set(ev.pointerId,{...pos,start:pos,orbit:ev.shiftKey || ev.button===2});
    if(pointers.size>1) dragged=true;
    (ev.target.closest('button') || viewport).setPointerCapture(ev.pointerId);
  });
  viewport.addEventListener('pointermove',ev=>{
    const prev=pointers.get(ev.pointerId);
    if(!prev)return;
    const next=local(ev);
    if(!dragged && Math.hypot(next.x-prev.start.x,next.y-prev.start.y)<4)return;
    dragged=true;
    viewport.classList.add('is-dragging');
    const before=[...pointers.values()];
    pointers.set(ev.pointerId,{...prev,...next});
    if(before.length===1) {
      if(prev.orbit) {
        const middle={x:view.width/2,y:view.height/2};
        reframe([view.x,view.y],middle,view.zoom,view.bearing+(next.x-prev.x)*.012);
      } else reframe(groundAt(prev),next,view.zoom,view.bearing);
    } else if(before.length===2) {
      const a=pair(before),b=pair(pointers.values());
      if(a.dist>3 && b.dist>3) reframe(groundAt(a.mid),b.mid,view.zoom*b.dist/a.dist,view.bearing+b.angle-a.angle);
    }
  });
  function release(ev) {
    pointers.delete(ev.pointerId);
    if(!pointers.size)viewport.classList.remove('is-dragging');
  }
  viewport.addEventListener('pointerup',release);
  viewport.addEventListener('pointercancel',release);
  viewport.addEventListener('lostpointercapture',release);
  viewport.addEventListener('contextmenu',ev=>ev.preventDefault());
  viewport.addEventListener('click',ev=>{
    if(ev.detail===0)return; // Нативная кнопка доступна клавиатуре.
    if(dragged){ev.preventDefault();ev.stopPropagation();return;}
    if(!active || !scene || contextLost)return;
    const {x,y}=local(ev);
    const onButton=entry.contains(ev.target);
    // Окно между колоннами остаётся удобной целью даже на мелком масштабе.
    const centerTap=onButton && Math.abs(x-entry.offsetLeft)<=22 && Math.abs(y-entry.offsetTop)<=22;
    if(!centerTap && !scene.hit(x,y)) {
      if(onButton)ev.stopPropagation();
    } else if(!onButton) entry.click();
  },true);
  viewport.addEventListener('wheel',ev=>{
    ev.preventDefault();
    const point=local(ev);
    const pixels=ev.deltaY*(ev.deltaMode===1?16:ev.deltaMode===2?view.height:1);
    reframe(groundAt(point),point,view.zoom*Math.exp(-pixels*.0028),view.bearing);
  },{passive:false});
  entry.addEventListener('keydown',ev=>{
    const point=atScreen(venue),anchor={x:point[0],y:point[1]};
    if(ev.key==='ArrowLeft' || ev.key==='ArrowRight') {
      reframe(venue,anchor,view.zoom,view.bearing+(ev.key==='ArrowLeft'?-1:1)*Math.PI/8);
    } else if(['+','=','-'].includes(ev.key)) {
      reframe(venue,anchor,view.zoom*(ev.key==='-'?.8:1.25),view.bearing);
    } else return;
    ev.preventDefault();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)redraw();});
  return {
    center,
    setPins(nodes) {pins=nodes;pinsDirty=true;redraw();},
    // Звезда игры: точка карты и состояние ('falling' | 'landed' | 'caught' | null).
    setStar(at,mode,onLand=null) {
      // Без движения звезда сразу лежит на месте, а пойманная просто исчезает.
      if(reduced.matches && mode==='falling') {mode='landed';onLand?.();onLand=null;}
      if(reduced.matches && mode==='caught') mode=null;
      star=at && mode?{at,mode,onLand}:null;
      scene?.setStar(at,mode,performance.now()/1000,onLand);
      redraw();
    },
    screenOf:atScreen,
    get live() {return Boolean(active && scene && !contextLost);},
    setActive(value) {
      if(active===value)return;
      active=value;
      if(value)prepare().catch(e=>console.warn('3D парка недоступно:',e.message));
      redraw();
    }
  };
}
