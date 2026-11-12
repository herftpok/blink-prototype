(() => {
  'use strict';
  const A = '../../assets';
  const state = { radius: 1, empty: false, month: false, noMeetings: false, place: 0 };
  const places = [
    { name: 'парк у воды', meta: '800 м · погулять', mapX: -24, mapY: -400 },
    { name: 'скейт-парк', meta: '1.2 км · покататься', mapX: -4, mapY: -300 },
    { name: 'тихий двор', meta: '450 м · посидеть', mapX: -40, mapY: -460 },
  ];
  const people = [
    { name: 'соня', photo: 'live-4.webp', distance: '240 м' },
    { name: 'лёва', photo: 'live-3.webp', distance: '680 м' },
    { name: 'наташка', photo: 'live-1.webp', distance: '2.3 км' },
  ];
  const control = (action, text, label) => `<button class="va-control pressable" type="button" data-action="${action}" aria-label="${label}">${text}</button>`;

  function nearby() {
    const shown = state.empty ? [] : people.slice(0, state.radius === 1 ? 2 : 3);
    const xs = shown.length === 2 ? [100, 246] : [58, 173, 288];
    return `<article class="widget widget--medium wg-map va-widget va-nearby${state.empty ? ' va-nearby--empty' : ''}" style="--map-x:-24px;--map-y:-400px" aria-label="кто рядом">
      <header class="wg-head"><h3 class="wg-head__name">${shown.length ? `${shown.length} друга рядом` : 'кто рядом'}</h3><p class="wg-head__meta">гео 5 мин назад</p></header>
      ${control('radius', `${state.radius} км`, `сменить радиус с ${state.radius} на ${state.radius === 1 ? 3 : 1} км`)}
      ${shown.map((person, i) => `<a class="va-person" href="../../index.html#/map" aria-label="${person.name}, ${person.distance}, открыть карту" style="--person-x:${xs[i]}">
        ${BlinkPin.markup({ name: person.name, title: person.name, photo: `${A}/people/${person.photo}`, size: 36, tag: 'span', assets: A })}
        <span class="va-distance">${person.distance}</span></a>`).join('')}
      ${state.empty ? '<p class="va-empty"><strong>пока никого</strong><span>друзья дальше выбранного радиуса</span></p>' : ''}
    </article>`;
  }

  function recap() {
    return `<article class="widget widget--medium va-widget va-recap${state.noMeetings ? ' va-recap--empty' : ''}" aria-label="время с друзьями">
      <h3 class="va-recap__title">с друзьями</h3>
      ${control('period', state.month ? 'месяц' : 'неделя', state.month ? 'показать неделю' : 'показать месяц')}
      ${state.noMeetings ? '<p class="va-empty"><strong>ещё не виделись</strong><span>здесь появится время ваших встреч</span></p>' : `
        <p class="va-recap__hours">${state.month ? '28' : '7'} ч<small>вместе за ${state.month ? 'месяц' : 'неделю'}</small></p>
        <p class="va-recap__meetings">${state.month ? '11 встреч' : '3 встречи'}</p>
        <div class="va-recap__photos" aria-label="чаще всего с лёвой и соней">
          <img class="va-recap__photo" src="${A}/people/photo-3.webp" alt="лёва" style="--photo-turn:-10deg">
          <img class="va-recap__photo" src="${A}/people/photo-4.webp" alt="соня" style="--photo-turn:10deg">
        </div>`}
    </article>`;
  }

  function place() {
    const p = places[state.place];
    return `<article class="widget widget--medium wg-map va-widget va-place" style="--map-x:${p.mapX}px;--map-y:${p.mapY}px" aria-label="куда сходить">
      <header class="wg-head"><h3 class="wg-head__name">куда сходить?</h3></header>
      ${control('place', 'другое', 'показать другое место')}
      <div class="va-place__info"><h4 class="va-place__name">${p.name}</h4><p class="va-place__meta">${p.meta}</p></div>
      <span class="va-place__marker" aria-hidden="true"><i class="icon icon--places"></i></span>
      <a class="va-place__map pressable" href="../../index.html#/map" aria-label="${p.name}, открыть карту">на карте<i class="icon icon--navigate" aria-hidden="true"></i></a>
    </article>`;
  }

  function render(id, markup, focusAction) {
    const root = document.getElementById(id);
    root.innerHTML = markup();
    if (focusAction) root.querySelector(`[data-action="${focusAction}"]`)?.focus({ preventScroll: true });
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches && focusAction) {
      const content = root.querySelector('.va-place__info, .va-recap__hours, .va-person');
      content?.animate([{ opacity: 0.5, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 200, easing: 'ease-out' });
    }
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'radius') { state.radius = state.radius === 1 ? 3 : 1; render('nearby', nearby, action); }
    if (action === 'period') { state.month = !state.month; render('recap', recap, action); }
    if (action === 'place') { state.place = (state.place + 1) % places.length; render('place', place, action); }
    if (action === 'empty') { state.empty = !state.empty; button.setAttribute('aria-pressed', state.empty); render('nearby', nearby); }
    if (action === 'no-meetings') { state.noMeetings = !state.noMeetings; button.setAttribute('aria-pressed', state.noMeetings); render('recap', recap); }
  });

  render('nearby', nearby);
  render('recap', recap);
  render('place', place);
})();
