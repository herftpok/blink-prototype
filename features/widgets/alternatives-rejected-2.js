(() => {
  'use strict';
  const A = '../../assets';
  const state = { small: false, newFriend: false, oneFriend: false, visible: true };
  const people = [
    { id: 'lyova', name: 'лёва', photo: 'photo-3.webp' },
    { id: 'sonya', name: 'соня', photo: 'photo-4.webp' },
    { id: 'natashka', name: 'наташка', photo: 'photo-1.webp' },
    { id: 'vasya', name: 'вася', photo: 'photo-5.webp' },
  ];
  const widgetClass = type => `widget ${state.small ? 'widget--small va-small' : 'widget--medium'} va-widget va-${type}`;
  function friendship() {
    return `<article class="${widgetClass('friendship')}" aria-label="дни дружбы с лёвой">
      <h3 class="va-friendship__names">ты и лёва</h3>
      <div class="va-friendship__portraits" aria-hidden="true">
        <img src="${A}/people/photo-1.webp" alt="" style="--portrait-turn:-9deg">
        <img src="${A}/people/photo-3.webp" alt="" style="--portrait-turn:9deg">
      </div>
      <p class="va-friendship__number sticker-number">${state.newFriend ? '1' : '365'}</p>
      <p class="va-friendship__label">${state.newFriend ? 'день дружбы' : 'дней дружбы'}</p>
    </article>`;
  }
  function shortcuts() {
    const list = state.oneFriend ? people.slice(0, 1) : people;
    return `<article class="${widgetClass('shortcuts')}" aria-label="избранные друзья">
      <h3 class="va-shortcuts__title">мои люди</h3>
      <a class="va-shortcuts__all" href="../../index.html#/friends">все <i class="icon icon--chevron" aria-hidden="true"></i></a>
      <div class="va-shortcuts__grid">
        ${list.map(person => `<a class="va-person pressable" href="../../index.html#/chat/${person.id}" aria-label="открыть чат: ${person.name}">
          <img src="${A}/people/${person.photo}" alt=""><span>${person.name}</span>
        </a>`).join('')}
        ${state.oneFriend ? Array.from({ length: 3 }, () => `<a class="va-person va-person--add pressable" href="../../index.html#/friends" aria-label="выбрать друга"><span class="va-person__placeholder"><i class="icon icon--plus" aria-hidden="true"></i></span><span>добавить</span></a>`).join('') : ''}
      </div>
    </article>`;
  }
  function card() {
    return `<article class="${widgetClass('card')}" aria-label="QR-код профиля наташки">
      <h3 class="va-card__title">добавь<br>меня</h3>
      <img class="va-card__avatar" src="${A}/people/photo-1.webp" alt="наташка">
      <p class="va-card__handle">@natashka</p>
      <div class="va-card__qr"><img src="${A}/share/qr-natashka.svg" alt="QR-код ссылки на профиль наташки"></div>
    </article>`;
  }
  function privacy() {
    return `<article class="${widgetClass('privacy')}${state.visible ? '' : ' va-privacy--hidden'}" aria-label="видимость геопозиции">
      <h3 class="va-privacy__title">${state.visible ? 'ты на карте' : 'ты невидимка'}</h3>
      <p class="va-privacy__status">${state.visible ? 'гео доступно друзьям' : 'геопозиция скрыта'}</p>
      <img class="va-privacy__art" src="${A}/${state.visible ? 'stickers/eyes.webp' : 'market/sticker-ghost.webp'}" alt="">
      <button class="va-privacy__toggle pressable" type="button" role="switch" aria-checked="${state.visible}" aria-label="показывать геопозицию друзьям" data-action="visibility">${state.visible ? 'скрыть гео' : 'показывать гео'}</button>
    </article>`;
  }
  const views = { friendship, shortcuts, card, privacy };
  function render(id, focusAction) {
    const root = document.getElementById(id);
    root.innerHTML = views[id]();
    if (focusAction) root.querySelector(`[data-action="${focusAction}"]`)?.focus({ preventScroll: true });
  }
  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.size) {
      state.small = button.dataset.size === 'small';
      document.body.dataset.size = button.dataset.size;
      document.querySelectorAll('button[data-size]').forEach(b => b.setAttribute('aria-pressed', b === button));
      Object.keys(views).forEach(id => render(id));
    }
    if (button.dataset.action === 'new-friend') {
      state.newFriend = !state.newFriend;
      button.setAttribute('aria-pressed', state.newFriend);
      render('friendship');
    }
    if (button.dataset.action === 'one-friend') {
      state.oneFriend = !state.oneFriend;
      button.setAttribute('aria-pressed', state.oneFriend);
      render('shortcuts');
    }
    if (button.dataset.action === 'visibility') {
      state.visible = !state.visible;
      render('privacy', 'visibility');
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.querySelector('.va-privacy__art').animate([{ opacity: 0, transform: 'scale(0.9)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 250, easing: 'ease-out' });
      }
    }
  });
  Object.keys(views).forEach(id => render(id));
})();
