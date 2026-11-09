// Calendar arithmetic uses civil UTC dates; travelling across time zones cannot move a day.
export function routeCalendar(elements, entries, selectDay) {
  const {grid,month,year,prev,next}=elements;
  const byDate=new Map(entries.map(entry=>[entry.date,entry]));
  const months=[...new Set(entries.map(entry=>entry.date.slice(0,7)))].sort();
  const monthName=new Intl.DateTimeFormat('ru-RU',{month:'long',timeZone:'UTC'});
  const fullDate=new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  const years=[...new Set(months.map(m=>m.slice(0,4)))];
  year.replaceChildren(...years.reverse().map(y=>new Option(y,y)));
  let visible='';
  function show(key){
    visible=key;
    const [y,m]=key.split('-').map(Number);
    const start=new Date(Date.UTC(y,m-1,1));
    const days=new Date(Date.UTC(y,m,0)).getUTCDate();
    const inYear=months.filter(v=>v.startsWith(key.slice(0,4)));
    month.replaceChildren(...inYear.map(v=>new Option(monthName.format(new Date(v+'-01T12:00:00Z')),v)));
    year.value=key.slice(0,4);month.value=key;
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
        input.type='radio';input.name='privacy-date';input.value=entry.day;
        input.setAttribute('aria-label',fullDate.format(new Date(date+'T12:00:00Z')));
        const face=document.createElement('span');face.textContent=n;
        cell.append(input,face);
      }else{
        cell.classList.add('unavailable');cell.setAttribute('aria-hidden','true');cell.textContent=n;
      }
      grid.append(cell);
    }
    selectDay(null);
  }
  prev.onclick=()=>show(months[months.indexOf(visible)-1]);
  next.onclick=()=>show(months[months.indexOf(visible)+1]);
  month.onchange=()=>show(month.value);
  year.onchange=()=>{
    const previousMonth=Number(visible.slice(5));
    const choices=months.filter(m=>m.startsWith(year.value));
    const distance=m=>Math.abs(Number(m.slice(5))-previousMonth);
    show(choices.reduce((nearest,m)=>distance(m)<distance(nearest)?m:nearest));
  };
  grid.onchange=e=>selectDay(e.target.value);
  return date=>show(date.slice(0,7));
}
