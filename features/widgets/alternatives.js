(() => {
  'use strict';
  const A = '../../assets';
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const tails = [
    { id: 'comet', name: 'комета', file: 'comet.webp' },
    { id: 'rocket', name: 'ракета', file: 'rocket.webp' },
    { id: 'dementor', name: 'тень', file: 'dementor.webp' },
  ];
  const seed = () => ['me','friend',null,'friend','me',null,null,null,null];
  const state = { visited: new Set([7,8,13,14]), target: 9, board: seed(), turn: 'me', tail: 'comet' };
  const photo = who => `${A}/people/photo-${who === 'me' ? '1' : '3'}.webp`;
  const pin = () => BlinkPin.markup({ name: 'ты', photo: `${A}/people/live-1.webp`, tag: 'span', assets: A });
  function outcome() {
    const line = lines.find(row => state.board[row[0]] && row.every(i => state.board[i] === state.board[row[0]]));
    return line ? { winner: state.board[line[0]], line } : state.board.every(Boolean) ? { winner: 'draw', line: [] } : null;
  }
  function frontier() {
    return Array.from({length:18}, (_, i) => i).filter(i => !state.visited.has(i) &&
      [i-6,i+6,...(i%6 ? [i-1] : []),...(i%6<5 ? [i+1] : [])].some(n => state.visited.has(n)));
  }
  function explore() {
    const complete = state.visited.size >= 5;
    return `<article class="widget widget--medium wg-map va-widget vx-explore" style="--map-x:-24px;--map-y:-400px" aria-label="карта открытий">
      <div class="vx-fog" aria-hidden="true">${Array.from({length:18}, (_, i) => `<span class="vx-fog__cell${state.visited.has(i) ? ' vx-fog__cell--open' : ''}${!complete && i===state.target ? ' vx-fog__cell--target' : ''}">${!complete && i===state.target ? '<i class="icon icon--plus"></i>' : ''}</span>`).join('')}</div>
      <h3 class="vx-explore__title">${complete ? 'пять клеток открыто!' : 'открой город'}</h3>
      <span class="vx-explore__you">${pin()}</span>
      <p class="vx-explore__progress">${complete ? '<i class="icon icon--check" aria-hidden="true"></i> цель выполнена' : `${state.visited.size} из 5 клеток`}</p>
      ${complete ? '' : '<button class="vx-explore__target pressable" type="button" data-action="target" aria-label="выбрать другую соседнюю клетку">другая цель</button>'}
    </article>`;
  }
  function game() {
    const result = outcome();
    const title = result ? result.winner === 'me' ? 'ты выиграл!' : result.winner === 'friend' ? 'лёва выиграл' : 'ничья' : state.turn === 'me' ? 'твой ход' : 'ход лёвы';
    return `<article class="widget widget--medium va-widget vx-game" aria-label="крестики-нолики с лёвой">
      <div class="vx-game__info"><h3 class="vx-game__title" role="status" tabindex="-1">${title}</h3>
        <div class="vx-game__players"><span><img src="${photo('me')}" alt="">ты</span><span><img src="${photo('friend')}" alt="">лёва</span></div>
        ${result ? '<button class="vx-game__again pressable" type="button" data-action="game-reset">ещё партию</button>' : `<p class="vx-game__hint">${state.turn === 'me' ? 'собери свои<br>три в ряд' : 'продолжишь после<br>его хода'}</p>`}
      </div>
      <div class="vx-game__board" role="group" aria-label="игровое поле">${state.board.map((who,i) => `<button class="vx-game__cell pressable${result?.line.includes(i) ? ' vx-game__cell--win' : ''}" type="button" data-cell="${i}" aria-label="клетка ${i+1}: ${who ? who === 'me' ? 'ты' : 'лёва' : 'свободна'}" ${who || result || state.turn !== 'me' ? 'disabled' : ''}>${who ? `<img src="${photo(who)}" alt="">` : ''}</button>`).join('')}</div>
    </article>`;
  }
  function wardrobe() {
    const tail = tails.find(t => t.id === state.tail);
    return `<article class="widget widget--medium wg-map va-widget vx-wardrobe" style="--map-x:0px;--map-y:-384px" aria-label="гардероб пина">
      <h3 class="vx-wardrobe__title">мой пин</h3>
      <span class="vx-rider"><img class="vx-rider__tail" src="${A}/tails/${tail.file}" alt="хвост ${tail.name}">${pin()}</span>
      <p class="vx-wardrobe__wearing"><i class="icon icon--check" aria-hidden="true"></i>${tail.name} на тебе</p>
      <div class="vx-wardrobe__options" role="group" aria-label="твои хвосты">${tails.map(t => `<button class="vx-tail pressable" type="button" data-tail="${t.id}" aria-pressed="${t.id===state.tail}" aria-label="надеть хвост ${t.name}"><span class="vx-tail__art"><img src="${A}/tails/${t.file}" alt=""></span><span>${t.name}</span></button>`).join('')}</div>
    </article>`;
  }
  const views = { explore, game, wardrobe };
  function render(id, focusSelector) {
    const root = document.getElementById(id);
    root.innerHTML = views[id]();
    if (focusSelector) root.querySelector(focusSelector)?.focus({preventScroll:true});
    if (id === 'game') document.querySelector('[data-action="friend-turn"]').disabled = state.turn !== 'friend' || !!outcome();
    if (id === 'explore') document.querySelector('[data-action="visit"]').disabled = state.visited.size >= 5;
  }
  function animateTail() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.querySelector('.vx-rider__tail').animate([{opacity:0, transform:'scaleX(0.85)'},{opacity:1, transform:'scaleX(1)'}],{duration:250,easing:'ease-out'});
  }
  document.addEventListener('click', event => {
    const b = event.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.cell !== undefined) {
      const i = Number(b.dataset.cell);
      if (state.turn !== 'me' || state.board[i] || outcome()) return;
      state.board[i] = 'me'; state.turn = 'friend'; render('game', outcome() ? '[data-action="game-reset"]' : '.vx-game__title');
    }
    if (b.dataset.tail) { state.tail = b.dataset.tail; render('wardrobe', `[data-tail="${state.tail}"]`); animateTail(); }
    const action = b.dataset.action;
    if (action === 'target') {
      const choices = frontier(); state.target = choices[(choices.indexOf(state.target)+1)%choices.length]; render('explore','[data-action="target"]');
    }
    if (action === 'visit') { state.visited.add(state.target); state.target = frontier()[0]; render('explore'); }
    if (action === 'explore-reset') { state.visited = new Set([7]); state.target = 8; render('explore'); }
    if (action === 'game-reset') { state.board = Array(9).fill(null); state.turn = 'me'; render('game', '[data-cell="0"]'); }
    if (action === 'friend-turn' && state.turn === 'friend' && !outcome()) {
      // Только пульт показа имитирует событие второго игрока. В продукте ход приходит от сервера.
      const empty = state.board.map((v,i) => v ? -1 : i).filter(i => i >= 0);
      const win = who => empty.find(i => { state.board[i]=who; const yes=outcome()?.winner===who; state.board[i]=null; return yes; });
      const i = win('friend') ?? win('me') ?? (state.board[4] ? empty[0] : 4);
      if (i !== undefined) state.board[i]='friend';
      state.turn='me'; render('game');
    }
  });
  Object.keys(views).forEach(id=>render(id));
})();
