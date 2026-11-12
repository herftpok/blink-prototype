// Содержимое страницы места. Афиша, часы и описание – с parkgorkogo.ru и garagemca.org на 12.11.2026
// (источники в README). Кто идёт, чекины и звёзды – демонстрационные, люди из набора прототипа.
window.parkData = {
  about: 'центральный парк москвы открылся в 1928 году. от арки главного входа аллея ведёт к фонтану, дальше – пруды, музей «гараж», народная обсерватория, зелёный театр и нескучный сад. зимой здесь заливают каток.',
  address: 'крымский вал, 9',
  hours: [
    { name: 'парк', time: 'круглосуточно' },
    { name: 'музей «гараж»', time: '11:00 – 22:00' },
    { name: 'каток', time: 'с декабря' }
  ],
  entry: 'вход свободный',
  // tag – наклейка на афише; when и where – строка под названием.
  events: [
    { id: 'two-parks', tag: '14.11', title: 'два разных парка', when: 'сб, 14:00', where: 'партер', price: 'от 900 ₽', age: '7+',
      photos: ['entrance-day', 'fountain-day', 'embankment'], sticker: 'go',
      text: 'экскурсия на электробусе по партеру: как парк выглядел в двадцатые и каким стал сейчас. идёт около часа.',
      going: ['vika', 'dasha', 'nikita'] },
    { id: 'architecture', tag: '15.11', title: 'история и архитектура парка горького', when: 'вс, 12:00', where: 'партер', price: '600 ₽', age: '10+',
      photos: ['entrance-columns', 'entrance-day', 'fountain-roses'], sticker: 'eyes',
      text: 'обзорная экскурсия на полтора часа: арка главного входа, партер и то, что осталось от первых павильонов.',
      going: ['masha'] },
    { id: 'neskuchny', tag: '17.11', title: 'дворянское наследие нескучного сада', when: 'вт, 11:00', where: 'нескучный сад', price: 'от 500 ₽', age: '6+',
      photos: ['neskuchny-palace', 'neskuchny-path', 'pond-swans'], sticker: 'diamond',
      text: 'полтора часа по усадьбам, из которых вырос нескучный сад.',
      going: [] },
    { id: 'krymsky', tag: '19.11', title: 'четыре века крымского вала', when: 'чт, 19:00', where: 'музеон', price: '1200 ₽', age: '12+',
      photos: ['krymsky-sunset', 'glass-wall-night', 'garage'], sticker: 'fire',
      text: 'вечерняя прогулка с александром усольцевым. встреча у входа в музеон со стороны садового кольца.',
      going: ['natasha', 'andrey', 'vika', 'masha'] },
    { id: 'sport', tag: 'весь год', title: 'спорткружок', when: 'по расписанию', where: 'центральная аллея', price: 'бесплатно', age: '0+',
      photos: ['embankment', 'pond-boats', 'pioneer-pond'], sticker: 'clap',
      text: 'спорт и танцы под открытым небом. расписание занятий – в чате спорткружка.',
      going: ['dasha', 'andrey'] },
    { id: 'rink', tag: 'декабрь', title: 'каток, 95-й сезон', when: 'в начале декабря', where: 'у фонтана и на набережной', price: 'цены объявят', age: '0+',
      photos: ['rink-night', 'glass-wall-night', 'fountain-day'], sticker: 'heart',
      text: 'больше 18 тысяч квадратных метров льда: дорожки вокруг фонтана и по пушкинской набережной, отдельный детский каток.',
      going: ['vika', 'natasha', 'masha', 'dasha', 'nikita', 'andrey'] }
  ],
  // Чекины гостей: фото и автор.
  checkins: [
    { id: 'c1', by: 'vika', photo: 'fountain-day', ago: '12 мин' },
    { id: 'c2', by: 'masha', photo: 'pond-boats', ago: '40 мин' },
    { id: 'c3', by: 'andrey', photo: 'glass-wall-night', ago: 'вчера' },
    { id: 'c4', by: 'natasha', photo: 'pond-swans', ago: 'вчера' },
    { id: 'c5', by: 'dasha', photo: 'garage', ago: '10.11' },
    { id: 'c6', by: 'nikita', photo: 'neskuchny-path', ago: '9.11' }
  ],
  myCheckin: 'fountain-roses',
  // Игра «лови звезду»: сколько звёзд сегодня у гостей парка.
  stars: { vika: 3, andrey: 2, dasha: 1 },
  friends: ['vika', 'natasha', 'andrey'],
  // Новость, которую кабинет парка предлагает разослать по умолчанию.
  news: { title: 'каток откроется в начале декабря', text: 'это 95-й сезон. больше 18 тысяч квадратных метров льда вокруг фонтана и на набережной.', photos: ['rink-night', 'glass-wall-night', 'fountain-day'] }
};
