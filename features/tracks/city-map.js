// Isometric drawing in projected OSM world coordinates. Tiles are rasterized
// at the current output pixel density, including the portrait video canvas.
const tileSize=96;
const maps=new Map();
const colours={ground:'#2c3554',water:'#0e1645',park:'#244b50',road:'#5c6a97'};
const zoomFactor={island:1,garden:2,canal:.5};

function polygon(rings,offsetY=0){
  const path=new Path2D();
  for(const ring of rings){
    path.moveTo(ring[0],ring[1]-offsetY);
    for(let i=2;i<ring.length;i+=2)path.lineTo(ring[i],ring[i+1]-offsetY);
    path.closePath();
  }
  return path;
}
function bounds(rings,pad=0){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const ring of rings)for(let i=0;i<ring.length;i+=2){
    x0=Math.min(x0,ring[i]);x1=Math.max(x1,ring[i]);y0=Math.min(y0,ring[i+1]);y1=Math.max(y1,ring[i+1]);
  }
  return [x0-pad,y0-pad,x1+pad,y1+pad];
}
function prepare(data,area){
  const index=new Map(),factor=zoomFactor[area];
  function add(box,draw){
    for(let x=Math.floor(box[0]/tileSize);x<=Math.floor(box[2]/tileSize);x++){
      for(let y=Math.floor(box[1]/tileSize);y<=Math.floor(box[3]/tileSize);y++){
        const key=x+','+y;if(!index.has(key))index.set(key,[]);index.get(key).push(draw);
      }
    }
  }
  for(const [kind,rings] of data.land){
    const path=polygon(rings);add(bounds(rings,1),ctx=>{ctx.fillStyle=colours[kind];ctx.fill(path,'evenodd')});
  }
  for(const [kind,bridge,line] of data.roads){
    const path=new Path2D();path.moveTo(line[0],line[1]);for(let i=2;i<line.length;i+=2)path.lineTo(line[i],line[i+1]);
    const width=({motorway:9,trunk:8,primary:7,secondary:5.8,tertiary:5,minor:3.6,service:1.8,rail:1.4,path:1.2,waterway:4}[kind]||1.2)*factor;
    add(bounds([line],width),ctx=>{
      ctx.lineJoin=ctx.lineCap='round';
      if(width>=3){ctx.lineWidth=width+1.3*factor;ctx.strokeStyle=bridge==='bridge'?'#8290af':'#38425d';ctx.stroke(path)}
      ctx.lineWidth=width;ctx.strokeStyle=kind==='waterway'?colours.water:kind==='path'?'#405963':width<3?'#43506c':colours.road;ctx.stroke(path);
      if(['primary','secondary','trunk','motorway'].includes(kind)){
        ctx.strokeStyle='#95a1c1';ctx.lineWidth=.32*factor;ctx.setLineDash([2.8*factor,4.8*factor]);ctx.stroke(path);ctx.setLineDash([]);
      }
    });
  }
  const objects=[],orbitObjects=[];
  for(const [height,rings] of data.buildings){
    const box=bounds(rings),roof=polygon(rings,height),foot=polygon(rings);
    const shade=Math.abs(Math.round(box[0]+box[1]))%4;
    const shadowBox=[box[0]-1,box[1]-1,box[2]+height*.47+1,box[3]+height*.25+1];
    add(shadowBox,ctx=>{ctx.save();ctx.translate(height*.47,height*.25);ctx.fillStyle='#222b42';ctx.fill(foot,'evenodd');ctx.restore()});
    orbitObjects.push({box,height,rings,foot,shade,x:(box[0]+box[2])/2,y:(box[1]+box[3])/2});
    const walls=[];
    for(const ring of rings)for(let i=2;i<ring.length;i+=2){
      const ax=ring[i-2],ay=ring[i-1],bx=ring[i],by=ring[i+1];
      const dx=bx-ax,dy=by-ay,light=dx/Math.max(.01,Math.hypot(dx,dy));
      const path=polygon([[ax,ay,bx,by,bx,by-height,ax,ay-height]]);
      walls.push([path,'rgb('+Math.round(52+8*light)+' '+Math.round(63+9*light)+' '+Math.round(90+10*light)+')']);
    }
    objects.push({depth:box[3],box:[box[0]-1,box[1]-height-1,box[2]+1,box[3]+1],draw(ctx){
      for(const [wall,colour] of walls){ctx.fillStyle=colour;ctx.fill(wall)}
      ctx.fillStyle='rgb('+(70+shade*2)+' '+(85+shade*2)+' '+(118+shade*2)+')';ctx.fill(roof,'evenodd');
      ctx.strokeStyle='rgba(155,171,202,.26)';ctx.lineWidth=.24*factor;ctx.stroke(roof);
    }});
  }
  data.trees.forEach(([x,y,r])=>{
    orbitObjects.push({x,y,r,box:[x-r,y-r,x+r,y+r]});
    objects.push({depth:y,box:[x-r-1,y-2.8*r,x+r+1,y+1],draw(ctx){
      const glow=ctx.createRadialGradient(x-.38*r,y-1.8*r,0,x,y-1.05*r,1.4*r);
      glow.addColorStop(0,'#648e8e');glow.addColorStop(.45,'#477578');glow.addColorStop(1,'#284d57');
      ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(x,y-1.16*r,r,r*1.18,0,0,Math.PI*2);ctx.fill();
    }});
  });
  // Ground and shadows can be tiled once. Vertical scenery is projected anew for an orbit.
  const groundCounts=new Map([...index].map(([key,items])=>[key,items.length]));
  objects.sort((a,b)=>a.depth-b.depth).forEach(obj=>add(obj.box,obj.draw));
  return {index,tiles:new Map(),groundCounts,groundTiles:new Map(),orbitObjects,factor};
}
export function loadCity(area){
  if(!maps.has(area))maps.set(area,fetch('art/'+area+'-vector.json').then(r=>{
    if(!r.ok)throw Error('Map unavailable: '+area);return r.json();
  }).then(data=>prepare(data,area)));
  return maps.get(area);
}
export function drawCity(ctx,map,view,height){
  const [left,top,right,bottom]=view.bounds || [
    view.cx-300/view.scale,view.cy-height*.58/view.scale,
    view.cx+300/view.scale,view.cy+height*.42/view.scale
  ];
  const orbit=!!view.bounds;
  const density=Math.max(1,Math.ceil(orbit?ctx.canvas.width/600*view.scale:ctx.getTransform().a));
  const tiles=orbit?map.groundTiles:map.tiles;
  for(let x=Math.floor(left/tileSize);x<=Math.floor(right/tileSize);x++){
    for(let y=Math.floor(top/tileSize);y<=Math.floor(bottom/tileSize);y++){
      const key=x+','+y,cacheKey=key+','+density;
      let tile=tiles.get(cacheKey);
      if(!tile){
        tile=document.createElement('canvas');
        // Bleed by one world unit on all sides for subpixel camera translations.
        tile.width=tile.height=(tileSize+2)*density;
        const brush=tile.getContext('2d');brush.scale(density,density);brush.translate(1-x*tileSize,1-y*tileSize);
        brush.fillStyle=colours.ground;brush.fillRect(x*tileSize-1,y*tileSize-1,tileSize+2,tileSize+2);
        const items=map.index.get(key)||[];
        const count=orbit?(map.groundCounts.get(key)||0):items.length;
        for(let i=0;i<count;i++)items[i](brush);
        if(tiles.size>=64)tiles.delete(tiles.keys().next().value);
        tiles.set(cacheKey,tile);
      }
      ctx.drawImage(tile,density,density,tileSize*density,tileSize*density,x*tileSize,y*tileSize,tileSize+.03,tileSize+.03);
    }
  }
  if(orbit)drawOrbitScenery(ctx,map,view,height);
}

// Extrude each roof toward screen-up and repaint far-to-near at the current bearing.
// Trees are billboards so their crowns stay above their trunks throughout the turn.
function drawOrbitScenery(ctx,map,view,height){
  if(!map.crown){
    const crown=document.createElement('canvas');crown.width=crown.height=64;
    const brush=crown.getContext('2d');
    const glow=brush.createRadialGradient(20,15,0,32,32,37);
    glow.addColorStop(0,'#648e8e');glow.addColorStop(.45,'#477578');glow.addColorStop(1,'#284d57');
    brush.fillStyle=glow;brush.beginPath();brush.arc(32,32,31,0,2*Math.PI);brush.fill();
    map.crown=crown;
  }
  const {a,b,c,d}=view,[left,top,right,bottom]=view.bounds;
  const visible=[];
  for(const obj of map.orbitObjects){
    const [x0,y0,x1,y1]=obj.box,pad=(obj.height||obj.r*3)*2;
    if(x1+pad<left || x0-pad>right || y1+pad<top || y0-pad>bottom)continue;
    const center=view.at(obj);
    const halfX=(x1-x0)*.5,halfY=(y1-y0)*.5;
    const rx=view.scale*(Math.abs(a)*halfX+Math.abs(c)*halfY);
    const ry=view.scale*(Math.abs(b)*halfX+Math.abs(d)*halfY);
    if(center.x+rx<0 || center.x-rx>600 || center.y+ry<0 ||
       center.y-ry-(obj.height||obj.r*3)*view.scale>height)continue;
    visible.push(obj);
  }
  visible.sort((u,v)=>b*(u.x-v.x)+d*(u.y-v.y));
  for(const obj of visible){
    if(obj.r){
      ctx.save();ctx.translate(obj.x,obj.y);ctx.transform(d,-b,-c,a,0,0);
      const r=obj.r;
      ctx.drawImage(map.crown,-r,-2.34*r,2*r,2.36*r);ctx.restore();
      continue;
    }
    const ex=c*obj.height,ey=-a*obj.height;
    for(const ring of obj.rings){
      for(let i=2;i<ring.length;i+=2){
        const ax=ring[i-2],ay=ring[i-1],bx=ring[i],by=ring[i+1];
        const dx=a*(bx-ax)+c*(by-ay),dy=b*(bx-ax)+d*(by-ay);
        const light=dx/Math.max(.01,Math.hypot(dx,dy));
        ctx.fillStyle='rgb('+Math.round(52+8*light)+' '+Math.round(63+9*light)+' '+Math.round(90+10*light)+')';
        ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.lineTo(bx+ex,by+ey);ctx.lineTo(ax+ex,ay+ey);ctx.closePath();ctx.fill();
      }
    }
    ctx.save();ctx.translate(ex,ey);const k=obj.shade*2;
    ctx.fillStyle='rgb('+(70+k)+' '+(85+k)+' '+(118+k)+')';ctx.fill(obj.foot,'evenodd');
    ctx.strokeStyle='rgba(155,171,202,.26)';ctx.lineWidth=.24*map.factor;ctx.stroke(obj.foot);ctx.restore();
  }
}
