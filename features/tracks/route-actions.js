// These layouts move the same two actions, keeping their sheet handlers and state.
export function routeActionLayout(query){
  const el=id=>document.getElementById(id);
  const review=el('layout-review'),actions=el('route-actions'),more=el('more-actions');
  const choices=[...review.querySelectorAll('button')];
  review.hidden=query.get('review')!=='1';
  document.body.classList.toggle('review-layout',!review.hidden);
  let layout,expanded=false;
  function closeMenu(restoreFocus=true){
    if(!expanded)return;
    expanded=false;more.setAttribute('aria-expanded','false');actions.hidden=true;
    if(restoreFocus)more.focus({preventScroll:true});
  }
  function openMenu(last=false){
    if(expanded || layout!=='menu')return;
    expanded=true;more.setAttribute('aria-expanded','true');actions.hidden=false;
    const items=actions.querySelectorAll('button:not(:disabled)');
    items[last?items.length-1:0]?.focus({preventScroll:true});
  }
  function select(value){
    closeMenu(false);
    layout=value;document.body.dataset.actions=value;
    (value==='heading'?el('heading-actions'):el('footer-actions')).append(actions);
    const menu=value==='menu';
    more.hidden=!menu;actions.hidden=menu;
    if(menu)actions.setAttribute('role','menu');else actions.removeAttribute('role');
    for(const button of actions.children){
      if(menu)button.setAttribute('role','menuitem');else button.removeAttribute('role');
    }
    for(const button of choices)button.setAttribute('aria-pressed',String(button.dataset.layout===value));
  }
  const requested=query.get('actions');
  select(choices.some(b=>b.dataset.layout===requested)?requested:'menu');
  for(const button of choices){
    button.onclick=()=>{
      select(button.dataset.layout);
      const url=new URL(location.href);url.searchParams.set('actions',layout);
      history.replaceState(history.state,'',url);
    };
  }
  more.onclick=()=>expanded?closeMenu():openMenu();
  more.onkeydown=e=>{
    if(expanded && e.key==='Escape'){e.preventDefault();closeMenu();return}
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();openMenu(e.key==='ArrowUp')}
  };
  actions.onkeydown=e=>{
    if(!expanded)return;
    if(e.key==='Escape'){e.preventDefault();closeMenu();return}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;
    const items=[...actions.querySelectorAll('button:not(:disabled)')];
    let index=items.indexOf(document.activeElement);
    if(e.key==='Home')index=0;
    else if(e.key==='End')index=items.length-1;
    else index=(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;
    e.preventDefault();items[index]?.focus();
  };
  document.addEventListener('pointerdown',e=>{
    if(expanded && !more.contains(e.target) && !actions.contains(e.target))closeMenu(false);
  });
  document.addEventListener('focusin',e=>{
    if(expanded && e.target!==more && !actions.contains(e.target))closeMenu(false);
  });
  return {closeMenu};
}
