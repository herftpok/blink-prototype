/*
 * Моковые данные прототипа. Тексты сообщений и био – пользовательский контент
 * с референсов, их не редактируем. Интерфейсные строки живут в index.html и app.js.
 * Картинки – только из prototype/assets (собираются tools/build_assets.py).
 */
window.BLINK_DATA = {
  me: {
    name: "андрей зиновьев",
    username: "ecstasygirl",
    cutout: "assets/people/me-cutout.webp",
    bio: "дизайнер из санкт-петербурга. мне 23 года, люблю собак. квадробер 🐶 вы смотрели 2 girls 1 cup?",
    city: "санкт-петербург",
    coins: "50k",
    stats: { friends: 27, friendsNew: 37, views: 87, stars: 36, starsNew: 2, checkins: 455 },
    // подарки вокруг аватара: картинка уже содержит множитель „x2“, „x4.5k“…
    gifts: [
      // dx – от центра экрана, dy – от верха героя (96 pt), w – ширина в pt; сняты со скриншота
      { src: "assets/profile/gift-0.webp", label: "дельфин, 2 шт.", dx: -134, dy: 19.3, w: 56.3 },
      { src: "assets/profile/gift-3.webp", label: "кепка, 2,1 тыс.", dx: -190.3, dy: 68, w: 59.7 },
      { src: "assets/profile/gift-4.webp", label: "туфля, 456 шт.", dx: -144.7, dy: 112, w: 59 },
      { src: "assets/profile/gift-1.webp", label: "роза, 4,5 тыс.", dx: 68, dy: 13.3, w: 79 },
      { src: "assets/profile/gift-2.webp", label: "сердце, 16 тыс.", dx: 128.7, dy: 68, w: 58.7 },
      { src: "assets/profile/gift-5.webp", label: "кольцо, 200 шт.", dx: 82, dy: 112, w: 60 },
    ],
  },

  // Вырезка без фона → аватар на свечении (зелёное – в сети, серое – нет); фото → сквиркл
  friends: [
    { id: "vasya", name: "вася пупкин", distanceKm: 2.3, online: true, cutout: "assets/people/cutout-5.webp" },
    { id: "natashka", name: "наташка", distanceKm: 2.3, online: false, photo: "assets/people/natashka.webp" },
    { id: "lyova", name: "лёва", distanceKm: 0.85, online: true, cutout: "assets/people/cutout-3.webp" },
    { id: "tarakanus", name: "тараканус", distanceKm: 3.7, online: false, photo: "assets/people/tarakanus.webp" },
    { id: "sonya", name: "соня", distanceKm: 5.1, online: false, cutout: "assets/people/cutout-4.webp" },
    { id: "alesya", name: "алеся", distanceKm: 1.4, online: false, photo: "assets/people/alesya.webp" },
    { id: "valentin", name: "валентин", distanceKm: 0.35, online: false, photo: "assets/people/valentin.webp" },
    { id: "kapibar", name: "капибар", distanceKm: 7.8, online: false, photo: "assets/people/kapibar.webp" },
    { id: "kekova", name: "кекова", distanceKm: 12, online: false, photo: "assets/people/kekova.webp" },
  ],

  requestsCount: 2,

  // Возможные друзья: 5 карточек + „посмотреть всех“. Нет фото – сквиркл с ником.
  // faces – общие друзья (id из friends), в стопке показываются первые три
  suggestions: [
    { id: "kristina", name: "кристина самая сытая на районе", cutout: "assets/people/me-cutout.webp", mutual: 7, faces: ["alesya", "valentin", "kapibar"], added: false },
    { id: "maxklumchuk", name: "кристина сытая", username: "maxklumchuk", mutual: 7, faces: ["alesya", "tarakanus", "kapibar"], added: true },
    { id: "timur", name: "тимур", cutout: "assets/people/cutout-2.webp", mutual: 3, faces: ["tarakanus", "kekova", "valentin"], added: false },
    { id: "artem", name: "артём с третьего подъезда", username: "art.voronov", mutual: 1, faces: ["natashka"], added: false },
    { id: "polina", name: "полина", username: "polina.k", mutual: 12, faces: ["kekova", "alesya", "vasya"], added: false },
  ],

  folders: [
    { id: "all", name: "все чаты" },
    { id: "danya", name: "даняколбасен" },
    { id: "party", name: "пати" },
  ],

  birthday: { name: "maxklumchuk", art: "assets/chat/birthday-gift.png" },

  // pinned – закреплённые (одна-две штуки), над разделителем; остальные – по дате последнего сообщения.
  // last – что показать в мете строки.
  chats: [
    {
      id: "masha", name: "маша", avatar: "assets/people/masha.webp", online: true, ambassador: true,
      pinned: true, folders: ["all", "party"], status: "5 мин назад",
      last: { kind: "orb", text: "шар", date: "вчера" },
      location: "центральный район",
    },
    {
      id: "tarakanus", name: "тараканус", avatar: "assets/people/tarakanus.webp", pinned: true,
      folders: ["all", "party"], status: "был 27.06",
      last: { kind: "reply-checkin", text: "ответ на чекин", date: "27.06" },
    },
    {
      id: "valentin", name: "валентин", avatar: "assets/people/valentin.webp",
      folders: ["all", "danya"], unread: 1, status: "был вчера",
      last: { kind: "audio", text: "аудиостикер", date: "27.06" },
    },
    {
      id: "kapibar", name: "капибар", avatar: "assets/people/kapibar.webp",
      folders: ["all", "danya"], unreadMark: true, status: "был 27.06",
      last: { kind: "text", fromMe: true, text: "приветик", date: "27.06" },
    },
    {
      id: "alesya", name: "алеся", avatar: "assets/people/alesya.webp",
      folders: ["all"], status: "была 7.05",
      last: { kind: "reply", text: "ответ на сообщение", date: "7.05" },
    },
    {
      id: "kekova", name: "кекова", avatar: "assets/people/kekova.webp",
      folders: ["all", "party"], unread: 7, status: "была 7.05",
      last: { kind: "photo", text: "фото", date: "7.05", thumb: "assets/people/thumb-photo.webp" },
    },
    {
      id: "natashka", name: "наташка", avatar: "assets/people/natashka.webp",
      folders: ["all"], status: "дома", location: "щербаков переулок 17",
      last: { kind: "text", text: "я дома, заходи", date: "5.05" },
    },
  ],

  // Лента чата. from: "in" – собеседник, "out" – ты. style: "big" – крупный текст (кнопка „Aa“)
  messages: {
    masha: [
      { divider: "вчера, 15:07" },
      { from: "in", text: "хай!" },
      { from: "out", text: "здарова" },
      { from: "out", text: "го в компы)" },
      { from: "in", text: "го" },
      { from: "in", text: "во сколько?" },
      { divider: "сегодня" },
      { from: "in", text: "so...💀" },
      { from: "out", text: "блин сорри я заснул вчера, только ща встал" },
      { from: "in", text: "ладно, бывает", style: "big" },
      { from: "out", text: "короче го, через 1.5" },
      { from: "out", text: "возьми кэш плиз" },
      { from: "out", text: "а то у меня кончился" },
    ],
    valentin: [
      { divider: "27.06" },
      { from: "out", text: "ты где пропал" },
      { from: "in", sticker: "assets/stickers/go.webp", label: "стикер go!" },
    ],
    kapibar: [
      { divider: "27.06" },
      { from: "out", text: "приветик" },
    ],
    tarakanus: [
      { divider: "27.06" },
      { from: "in", text: "это где такой закат?" },
      { from: "out", text: "на крыше у дани, приходи в пятницу" },
    ],
    alesya: [
      { divider: "7.05" },
      { from: "out", text: "скинешь конспект?" },
      { from: "in", text: "да, вечером" },
    ],
    kekova: [
      { divider: "7.05" },
      { from: "in", text: "смотри что нашла" },
      { from: "in", text: "фото с моря, завтра пришлю остальные" },
    ],
    natashka: [
      { divider: "5.05" },
      { from: "in", text: "я дома, заходи" },
    ],
  },

  // Друзья на карте: x, y – низ кадра пина в pt холста 390×844 (с эталона карты).
  // size – 52 / 36 / 20, photo – живая аватарка, state – "staying" | "home" | "moving",
  // minutes – сколько на месте, speed – км/ч в пути. online – как в списке друзей.
  mapFriends: [
    { id: "natashka", name: "наташка", photo: "assets/people/live-1.webp", x: 268, y: 331, size: 52, online: false, state: "home", minutes: 22 },
    { id: "lyova", name: "лёва", photo: "assets/people/live-3.webp", x: 97, y: 396, size: 36, online: true, state: "moving", speed: 12 },
    { id: "sonya", name: "соня", photo: "assets/people/live-4.webp", x: 308, y: 442, size: 20, online: false, state: "staying" },
  ],

  map: { city: "москва", time: "09:53", weather: "☔", temperature: "−15 °C", steps: 345, rank: 9 },

  // панель стикеров в чате: файл из assets/stickers и подпись для скринридера
  stickers: [
    { name: "fire", label: "огонь" },
    { name: "heart", label: "сердце" },
    { name: "eyes", label: "глаза" },
    { name: "go", label: "go!" },
    { name: "clap", label: "аплодисменты" },
    { name: "rock", label: "коза" },
    { name: "thumbs-up", label: "лайк" },
    { name: "kiss", label: "поцелуй" },
    { name: "diamond", label: "бриллиант" },
    { name: "blink", label: "звёздочка блинк" },
  ],
};
