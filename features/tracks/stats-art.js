// Capture the live metrics in handset coordinates so the story follows its selected layout.
export function captureStats(list){
  const bounds=list.getBoundingClientRect();
  const zoom=bounds.width/list.offsetWidth;
  function box(rect){
    return {x:(rect.left-bounds.left)/zoom,y:(rect.top-bounds.top)/zoom,w:rect.width/zoom,h:rect.height/zoom};
  }
  const parts=[];
  for(const block of list.children){
    if(block.classList.contains('map-chip')){
      parts.push({type:'chip',color:getComputedStyle(block).backgroundColor,...box(block.getBoundingClientRect())});
    }
    const img=block.querySelector('img');
    if(img)parts.push({type:'image',img,filter:getComputedStyle(img).filter,...box(img.getBoundingClientRect())});
    for(const field of block.querySelectorAll('dt,dd')){
      const style=getComputedStyle(field),range=document.createRange();
      for(const match of field.textContent.matchAll(/[^ ]+/g)){
        range.setStart(field.firstChild,match.index);
        range.setEnd(field.firstChild,match.index+match[0].length);
        parts.push({type:'text',text:match[0],...box(range.getBoundingClientRect()),
          font:style.fontWeight+' '+style.fontSize+' '+style.fontFamily,color:style.color,
          spacing:style.letterSpacing==='normal'?'0px':style.letterSpacing,sticker:field.classList.contains('sticker-number')});
      }
    }
  }
  return parts;
}
export function paintStats(ctx,parts,x,y){
  ctx.save();ctx.translate(x,y);ctx.textBaseline='middle';
  const glass=parts.some(part=>part.type==='chip');
  for(const part of parts){
    if(part.type==='chip'){
      ctx.save();ctx.shadowBlur=0;
      ctx.beginPath();ctx.roundRect(part.x,part.y,part.w,part.h,part.h/2);ctx.clip();
      const matrix=ctx.getTransform();
      const pad=40;
      const sx=Math.max(0,Math.floor((part.x-pad)*matrix.a+matrix.e));
      const sy=Math.max(0,Math.floor((part.y-pad)*matrix.d+matrix.f));
      const sw=Math.min(ctx.canvas.width-sx,Math.ceil((part.w+2*pad)*matrix.a));
      const sh=Math.min(ctx.canvas.height-sy,Math.ceil((part.h+2*pad)*matrix.d));
      ctx.save();ctx.resetTransform();ctx.filter='blur('+Math.round(20*matrix.a)+'px)';
      ctx.drawImage(ctx.canvas,sx,sy,sw,sh,sx,sy,sw,sh);ctx.restore();
      ctx.fillStyle=part.color;ctx.fillRect(part.x,part.y,part.w,part.h);ctx.restore();
    }else if(part.type==='image'){
      ctx.save();ctx.filter=part.filter;ctx.shadowBlur=0;
      if(part.img.naturalWidth)ctx.drawImage(part.img,part.x,part.y,part.w,part.h);
      ctx.restore();
    }else{
      ctx.font=part.font;ctx.letterSpacing=part.spacing;ctx.fillStyle=part.color;
      ctx.save();
      if(part.sticker || glass)ctx.shadowBlur=0;
      if(part.sticker){
        ctx.lineWidth=6;ctx.lineJoin='round';ctx.strokeStyle='white';
        ctx.strokeText(part.text,part.x,part.y+part.h/2);
      }
      ctx.fillText(part.text,part.x,part.y+part.h/2);ctx.restore();
    }
  }
  ctx.restore();
}
