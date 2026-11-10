const byId = id => document.getElementById(id);
const search = byId('search');
const schoolView = byId('school');
const end = byId('end');
const query = byId('query');
const list = byId('rows');
const filters = Array.from(document.querySelectorAll('.filters button'));
const origin = location.protocol === 'file:' ? 'null' : location.origin;
const channel = 'blink.onboarding.school';
let snap = { query: '', type: '', scroll: 0 };
let frame = null;
let active = null;
let closing = false;
let ready = false;
let loadTimeout;
const webContent = byId('web-content');

function saveSearch() {
  snap.query = query.value;
  snap.scroll = byId('results').scrollTop;
  history.replaceState({ step: 'search', snap: { ...snap } }, '');
}

function filterResults() {
  const normalize = value => value.toLowerCase().replace(/ё/g, 'е').replace(/[№#]/g, ' ').trim();
  const words = normalize(query.value).split(/\s+/);
  const matches = schools.filter(school => {
    const description = normalize([school.name, school.city, school.type].join(' '));
    return (!snap.type || snap.type === school.type) && words.every(word => description.includes(word));
  });
  byId('clear').hidden = !query.value;
  filters.forEach(button => button.setAttribute('aria-pressed', button.textContent === snap.type));
  list.replaceChildren(...matches.map(school => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'row';
    button.dataset.id = school.id;
    button.innerHTML = '<img alt=""><span class="row__text"><span class="row__name"></span><span class="row__meta"></span></span>';
    button.querySelector('img').src = '../../assets/onboarding-school/' + school.icon + '.webp';
    button.querySelector('.row__name').textContent = school.name;
    button.querySelector('.row__meta').textContent = [school.city, school.distance, school.friends && school.friends + ' друзей'].filter(Boolean).join(' · ');
    button.addEventListener('click', () => openSchool(school));
    item.append(button);
    return item;
  }));
  byId('empty').hidden = matches.length > 0;
  byId('count').textContent = 'Найдено учебных заведений: ' + matches.length;
}

function updateSearch() {
  filterResults();
  byId('results').scrollTop = 0;
  saveSearch();
}

function show(panel) {
  [search, schoolView, end].forEach(element => { element.hidden = element !== panel; });
}

function post(type) {
  frame?.contentWindow.postMessage({ channel, type, id: active.id, joined: active.joined, requestIds: active.requestIds || [] }, origin === 'null' ? '*' : origin);
}

function mountSchool() {
  show(schoolView);
  frame = document.createElement('iframe');
  frame.title = schools.find(school => school.id === active.id).name;
  frame.src = 'school.html?id=' + encodeURIComponent(active.id);
  ready = false;
  byId('web-error').hidden = true;
  clearTimeout(loadTimeout);
  loadTimeout = setTimeout(() => { byId('web-error').hidden = false; }, 8000);
  webContent.replaceChildren(frame);
  byId('web-back').focus({ preventScroll: true });
}

function openSchool(school) {
  saveSearch();
  query.blur();
  active = { id: school.id, joined: false };
  history.pushState({ step: 'school', active, snap }, '', '#school/' + school.id);
  mountSchool();
}

function finish(joined) {
  const result = joined ? 'joined' : 'skipped';
  history.replaceState({ step: 'end', result }, '', '#' + result);
  byId('end-title').dataset.result = result;
  byId('end-title').textContent = joined ? 'учебное заведение добавлено' : 'шаг пропущен';
  show(end);
  byId('end-title').focus();
}

function closeSchool() {
  if (closing) return;
  closing = true;
  history.back();
}

window.addEventListener('message', event => {
  const data = event.data;
  if (!frame || event.source !== frame.contentWindow || event.origin !== origin ||
      data?.channel !== channel || data.id !== active.id) return;
  if (closing) {
    // Подтверждение, уже отправленное страницей до закрытия, учитываем при выходе.
    if (data.type === 'joined') active.joined = true;
    return;
  }
  if (data.type === 'ready') {
    ready = true;
    clearTimeout(loadTimeout);
    byId('web-error').hidden = true;
    post('state');
  }
  if (data.type === 'requestChanged' && Number.isInteger(data.studentId) && typeof data.pending === 'boolean') {
    const requests = new Set(active.requestIds);
    if (data.pending) requests.add(data.studentId);
    else requests.delete(data.studentId);
    active.requestIds = [...requests];
    history.replaceState({ step: 'school', active, snap }, '');
  }
  if (data.type === 'joined') {
    active.joined = true;
    history.replaceState({ step: 'school', active, snap }, '');
    post('state');
  }
  if (data.type === 'close' || (data.type === 'continue' && active.joined)) closeSchool();
});

function backInSchool() {
  if (ready) post('back');
  else closeSchool();
}
byId('retry').addEventListener('click', mountSchool);
byId('web-back').addEventListener('click', backInSchool);
byId('web-close').addEventListener('click', closeSchool);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && frame) backInSchool();
});

window.addEventListener('popstate', event => {
  if (frame && !closing) {
    // Системный Back проходит тот же путь, что стрелка вебвью.
    history.pushState({ step: 'school', active, snap }, '', '#school/' + active.id);
    backInSchool();
    return;
  }
  if (frame) {
    const { joined, id } = active;
    clearTimeout(loadTimeout);
    webContent.replaceChildren();
    frame = active = null;
    closing = false;
    if (joined) return finish(true);
    show(search);
    byId('results').scrollTop = snap.scroll;
    list.querySelector('[data-id="' + id + '"]')?.focus({ preventScroll: true });
    return;
  }
  if (!end.hidden && event.state?.step === 'school') return finish(byId('end-title').dataset.result === 'joined');
  restore(event.state);
});

function restore(state) {
  if (state?.step === 'end') return finish(state.result === 'joined');
  snap = { query: '', type: '', scroll: 0, ...state?.snap };
  query.value = snap.query;
  show(search);
  filterResults();
  byId('results').scrollTop = snap.scroll;
  if (state?.step === 'school' && schools.some(school => school.id === state.active.id)) {
    active = { ...state.active };
    mountSchool();
  } else saveSearch();
}

query.addEventListener('input', updateSearch);
query.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === 'Escape') query.blur(); });
byId('clear').addEventListener('click', () => { query.value = ''; query.focus(); updateSearch(); });
filters.forEach(button => button.addEventListener('click', () => {
  snap.type = snap.type === button.textContent ? '' : button.textContent;
  updateSearch();
}));
byId('skip').addEventListener('click', () => finish(false));
byId('replay').addEventListener('click', () => {
  history.replaceState(null, '', location.pathname + location.search);
  restore(null);
  byId('title').focus({ preventScroll: true });
});
function fitKeyboard() {
  const viewport = window.visualViewport;
  if (viewport && matchMedia('(max-width: 480px)').matches) {
    byId('app').style.height = viewport.height + 'px';
  }
}
window.visualViewport?.addEventListener('resize', fitKeyboard);
fitKeyboard();
restore(history.state);
