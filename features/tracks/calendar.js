// Calendar arithmetic uses civil UTC dates; travelling across time zones cannot move a day.
export function routeCalendar(elements, entries, selectDay, initial=null) {
  const {grid,month,year,prev,next,periods}=elements;
  const form=grid.closest('form'),week=form.querySelector('.calendar-week');
  const byDate=new Map(entries.map(entry=>[entry.date,entry]));
  const months=[...new Set(entries.map(entry=>entry.date.slice(0,7)))].sort();
  const monthName=new Intl.DateTimeFormat('ru-RU',{month:'long',timeZone:'UTC'});
  const fullDate=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  const years=[...new Set(months.map(m=>m.slice(0,4)))].reverse();
  let visible='',active=null;
  function setPanel(trigger){
    // Reserve the day grid's height so the grabber and header stay under the finger.
    if(trigger && !active)periods.style.minHeight=(grid.offsetHeight+week.offsetHeight)+'px';
    active=trigger;
    periods.hidden=!active;grid.hidden=week.hidden=!!active;
    form.classList.toggle('choosing-period',!!active);
    month.setAttribute('aria-expanded',String(active===month));
    year.setAttribute('aria-expanded',String(active===year));
  }
  function choosePeriod(trigger){
    if(active===trigger){setPanel(null);return}
    const isMonth=trigger===month;
    const options=isMonth?months.filter(key=>key.startsWith(visible.slice(0,4))):years;
    const current=isMonth?visible:visible.slice(0,4);
    periods.setAttribute('aria-label',isMonth?'Выбор месяца':'Выбор года');
    periods.replaceChildren(...options.map(value=>{
      const button=document.createElement('button');
      button.type='button';button.className='period-option';
      button.textContent=isMonth?monthName.format(new Date(value+'-01T12:00:00Z')):value;
      button.setAttribute('aria-pressed',String(value===current));
      button.onclick=()=>{
        if(value!==current){
          let target=value;
          if(!isMonth){
            const choices=months.filter(key=>key.startsWith(value));
            const distance=key=>Math.abs(Number(key.slice(5))-Number(visible.slice(5)));
            target=choices.reduce((nearest,key)=>distance(key)<distance(nearest)?key:nearest);
          }
          show(target);
        }else setPanel(null);
        trigger.focus();
      };
      return button;
    }));
    setPanel(trigger);
    periods.querySelector('[aria-pressed="true"]').focus({preventScroll:true});
  }
  function show(key){
    visible=key;
    const [y,m]=key.split('-').map(Number);
    const start=new Date(Date.UTC(y,m-1,1));
    const days=new Date(Date.UTC(y,m,0)).getUTCDate();
    setPanel(null);
    month.textContent=monthName.format(start);year.textContent=String(y);
    month.setAttribute('aria-label','Месяц: '+month.textContent);
    year.setAttribute('aria-label','Год: '+y);
    prev.disabled=key===months[0];next.disabled=key===months.at(-1);
    const offset=(start.getUTCDay()+6)%7;
    grid.replaceChildren();
    for(let n=1;n<=days;n++){
      const date=key+'-'+String(n).padStart(2,'0');
      const entry=byDate.get(date);
      const cell=document.createElement(entry?'label':'span');
      cell.className='calendar-day';
      if(n===1)cell.style.gridColumnStart=String(offset+1);
      if(entry){
        const input=document.createElement('input');
        input.type='radio';input.name='privacy-date';input.value=entry.date;input.checked=entry.date===initial;
        if(entry.hasRoute)cell.classList.add('has-route');
        input.setAttribute('aria-label',fullDate.format(new Date(date+'T12:00:00Z')));
        const face=document.createElement('span');face.textContent=n;
        cell.append(input,face);
      }else{
        cell.classList.add('unavailable');cell.setAttribute('aria-hidden','true');cell.textContent=n;
      }
      grid.append(cell);
    }
    selectDay(grid.querySelector(':checked')?.value || null);
  }
  prev.onclick=()=>show(months[months.indexOf(visible)-1]);
  next.onclick=()=>show(months[months.indexOf(visible)+1]);
  month.onclick=()=>choosePeriod(month);
  year.onclick=()=>choosePeriod(year);
  form.onkeydown=e=>{
    if(active && e.key==='Escape'){
      const trigger=active;
      e.preventDefault();e.stopPropagation();setPanel(null);trigger.focus();
    }
    if(active && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key) && periods.contains(e.target)){
      e.preventDefault();
      const options=[...periods.children],step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3}[e.key];
      options[Math.max(0,Math.min(options.length-1,options.indexOf(e.target)+step))].focus();
    }
  };
  grid.onchange=e=>selectDay(e.target.value);
  return date=>show(date.slice(0,7));
}
