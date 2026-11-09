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
  const objects=[];
  for(const [height,rings] of data.buildings){
    const box=bounds(rings),roof=polygon(rings,height),foot=polygon(rings);
    const shade=Math.abs(Math.round(box[0]+box[1]))%4;
    const shadowBox=[box[0]-1,box[1]-1,box[2]+height*.47+1,box[3]+height*.25+1];
    add(shadowBox,ctx=>{ctx.save();ctx.translate(height*.47,height*.25);ctx.fillStyle='#222b42';ctx.fill(foot,'evenodd');ctx.restore()});
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
  data.trees.forEach(([x,y,r],i)=>{
    objects.push({depth:y,box:[x-r-1,y-2.8*r,x+r+1,y+1],draw(ctx){
      const glow=ctx.createRadialGradient(x-.38*r,y-1.8*r,0,x,y-1.05*r,1.4*r);
      glow.addColorStop(0,'#648e8e');glow.addColorStop(.45,'#477578');glow.addColorStop(1,'#284d57');
      ctx.fillStyle=glow;ctx.beginPath();ctx.ellipse(x,y-1.16*r,r,r*1.18,0,0,Math.PI*2);ctx.fill();
    }});
  });
  objects.sort((a,b)=>a.depth-b.depth).forEach(obj=>add(obj.box,obj.draw));
  return {index,tiles:new Map()};
}
export function loadCity(area){
  if(!maps.has(area))maps.set(area,fetch('art/'+area+'-vector.json').then(r=>{
    if(!r.ok)throw Error('Map unavailable: '+area);return r.json();
  }).then(data=>prepare(data,area)));
  return maps.get(area);
}
export function drawCity(ctx,map,view,height){
  const left=view.cx-300/view.scale,top=view.cy-height*.58/view.scale;
  const right=left+600/view.scale,bottom=top+height/view.scale;
  const density=Math.ceil(ctx.getTransform().a);
  for(let x=Math.floor(left/tileSize);x<=Math.floor(right/tileSize);x++){
    for(let y=Math.floor(top/tileSize);y<=Math.floor(bottom/tileSize);y++){
      const key=x+','+y,cacheKey=key+','+density;
      let tile=map.tiles.get(cacheKey);
      if(!tile){
        tile=document.createElement('canvas');
        // Bleed by one world unit on all sides for subpixel camera translations.
        tile.width=tile.height=(tileSize+2)*density;
        const brush=tile.getContext('2d');brush.scale(density,density);brush.translate(1-x*tileSize,1-y*tileSize);
        brush.fillStyle=colours.ground;brush.fillRect(x*tileSize-1,y*tileSize-1,tileSize+2,tileSize+2);
        for(const draw of map.index.get(key)||[])draw(brush);
        if(map.tiles.size>=48)map.tiles.delete(map.tiles.keys().next().value);
        map.tiles.set(cacheKey,tile);
      }
      ctx.drawImage(tile,density,density,tileSize*density,tileSize*density,x*tileSize,y*tileSize,tileSize+.03,tileSize+.03);
    }
  }
}
