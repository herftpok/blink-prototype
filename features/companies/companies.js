/*
 * Компании: вебвью внутри blink. Компании твоего города, анонимные лайки,
 * взаимный лайк – экран „это взаимно“ и общий чат, когда по одному человеку
 * с каждой стороны за. Состоять можно только в одной компании.
 * Пульт рядом с телефоном – стенд, в продукт не идёт.
 */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const A = "../../assets/";
  const NBSP = " ";

  function plural(n, one, few, many) {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }
  const people = (n) => `${n}${NBSP}${plural(n, "человек", "человека", "человек")}`;
  const years = (n) => `${n}${NBSP}${plural(n, "год", "года", "лет")}`;
  const days = (n) => `${n}${NBSP}${plural(n, "день", "дня", "дней")}`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  // ── Данные ─────────────────────────────────────────────────────────────
  // Люди – из пака avatars/ (веб-копии в assets/people). Без фото – буква имени.
  const P = {
    me: { name: "ты", photo: "people/me-cutout.webp", age: 23 },
    natashka: { name: "наташка", photo: "people/natashka.webp", sq: true, age: 22 },
    valentin: { name: "валентин", photo: "people/valentin.webp", sq: true, age: 24 },
    kapibar: { name: "капибар", photo: "people/kapibar.webp", sq: true, age: 21 },
    liza: { name: "лиза", photo: "people/photo-1.webp", age: 19 },
    alesya: { name: "алеся", photo: "people/alesya.webp", sq: true, age: 20 },
    sonya: { name: "соня", photo: "people/photo-4.webp", age: 19 },
    kekova: { name: "кекова", photo: "people/kekova.webp", sq: true, age: 18 },
    masha: { name: "маша", photo: "people/masha.webp", sq: true, age: 19 },
    tyoma: { name: "тёма", photo: "people/photo-2.webp", age: 25 },
    tarakanus: { name: "тараканус", photo: "people/tarakanus.webp", sq: true, age: 27 },
    gosha: { name: "гоша", age: 23 },
    lyova: { name: "лёва", photo: "people/photo-3.webp", age: 18 },
    vasya: { name: "вася", photo: "people/photo-5.webp", age: 18 },
    katya: { name: "катя", age: 18 },
    dan: { name: "даня", age: 19 },
    nika: { name: "ника", age: 18 },
    rita: { name: "рита", age: 18 },
    egor: { name: "егор", age: 19 },
    misha: { name: "миша", age: 18 },
    artur: { name: "артур", age: 28 },
    timofey: { name: "тимофей с очень длинной фамилией", age: 26 },
    // ещё компании города: фото в паке мало, часть людей – без фото, с буквой имени
    yana: { name: "яна", photo: "people/photo-4.webp", age: 21 }, kira: { name: "кира", age: 20 }, mila: { name: "мила", age: 21 },
    roma: { name: "рома", photo: "people/photo-2.webp", age: 24 }, igor: { name: "игорь", age: 25 }, seva: { name: "сева", age: 23 }, oleg: { name: "олег", age: 26 },
    polina: { name: "полина", photo: "people/photo-1.webp", age: 17 }, dasha: { name: "даша", age: 17 }, vera: { name: "вера", age: 18 },
    max: { name: "макс", photo: "people/photo-5.webp", age: 20 }, ilya: { name: "илья", photo: "people/photo-3.webp", age: 21 }, gleb: { name: "глеб", age: 20 }, ann: { name: "аня", age: 19 }, zhenya: { name: "женя", age: 20 },
    sasha: { name: "саша", photo: "people/kekova.webp", sq: true, age: 22 }, lera: { name: "лера", photo: "people/masha.webp", sq: true, age: 22 },
    fedya: { name: "федя", photo: "people/tarakanus.webp", sq: true, age: 30 }, stas: { name: "стас", age: 29 }, kostya: { name: "костя", age: 31 }, lyosha: { name: "лёша", age: 28 },
  };

  const COMPANIES = [
    { id: "kotiki", theme: ["#ff75e1", "#cf91ff", "#ff6ac8"], name: "котики", plan: { what: "на концерт", day: 6 }, desc: "ищем, с кем сходить на концерт в субботу, потом караоке до утра", interests: ["концерты", "караоке", "кофе", "кино"], members: ["liza", "alesya", "sonya", "kekova", "masha"] },
    { id: "boardgames", theme: ["#adff58", "#ccff39", "#30e593"], name: "настолки на патриках", plan: { what: "поиграть в настолки", day: 5 }, desc: "каждую пятницу играем в мафию и кодовые имена. новичков научим", interests: ["настолки", "квизы", "пицца"], members: ["tyoma", "tarakanus", "gosha"] },
    { id: "hse", theme: ["#e0c195", "#ff6ac8", "#e5a0d3"], name: "второй курс вшэ и все, кто к нам прибился", plan: { what: "в бар", day: 0 }, desc: "после пар идём куда угодно, лишь бы не в библиотеку", interests: ["тусовки", "бары", "кино", "клубы", "учёба"], members: ["lyova", "vasya", "katya", "dan", "nika", "rita", "egor", "misha"] },
    { id: "brothers", theme: ["#74e4fa", "#9ea4ef", "#73edff"], name: "мы с братом", plan: null, desc: "футбол по воскресеньям, ищем ещё одну команду", interests: ["футбол"], members: ["artur", "timofey"] },
    { id: "kpop", theme: ["#ff75e1", "#73edff", "#cf91ff"], name: "k-pop пати", plan: { what: "на вечеринку", day: 6 }, desc: "танцуем каверы и ходим на все k-pop вечеринки", interests: ["k-pop", "танцы", "музыка"], members: ["yana", "kira", "mila"] },
    { id: "runners", theme: ["#adff58", "#74e4fa", "#30e593"], name: "бегаем по утрам", plan: { what: "на пробежку", day: 1 }, desc: "10 км по набережной, потом кофе. темп любой", interests: ["бег", "кофе", "спорт"], members: ["roma", "igor", "seva", "oleg"] },
    { id: "school", theme: ["#cf91ff", "#ff6ac8", "#73edff"], name: "11 б", plan: null, desc: "заканчиваем школу и хотим тусить с кем-то кроме одноклассников", interests: ["тусовки", "кино", "мемы"], members: ["polina", "dasha", "vera"] },
    { id: "gamers", theme: ["#73edff", "#9ea4ef", "#adff58"], name: "катаем в доту", plan: { what: "в компьютерный клуб", day: 3 }, desc: "ищем пятёрку на турнир и просто поиграть вечером", interests: ["видеоигры", "киберспорт", "пицца"], members: ["max", "ilya", "gleb", "ann", "zhenya"] },
    { id: "wine", theme: ["#e0c195", "#e5a0d3", "#ff75e1"], name: "винные пятницы", plan: { what: "в бар", day: 5 }, desc: "пробуем новые бары каждую пятницу", interests: ["вино", "бары", "стендап"], members: ["sasha", "lera"] },
    { id: "fishing", theme: ["#88e3da", "#74e4fa", "#e0c195"], name: "рыбаки с юго-запада", plan: null, desc: "за город на рыбалку и шашлыки, места в машине есть", interests: ["рыбалка", "походы", "машины"], members: ["fedya", "stas", "kostya", "lyosha"] },
  ];

  const MINE_DEFAULT = {
    id: "mine",
    // свечение профиля компании – три цвета системы (main-design-system.md 3.2 C)
    theme: ["#ccff39", "#73edff", "#cf91ff"],
    name: "тусовка с района",
    plan: null,
    desc: "гуляем по району до утра, иногда доходим до кино",
    interests: ["прогулки", "кино", "настолки"],
    members: ["me", "natashka", "valentin", "kapibar"],
  };

  // Компания есть всегда, план – по желанию: куда и в какой день. day – через сколько дней
  // от сегодня (0 – сегодня). Фраза: „в бар сегодня“, „на концерт в сб 10.10“
  // В шторке видно пять ключевых вариантов, остальные – поиском
  const WHAT_KEY = ["в бар", "в кино", "на концерт", "погулять", "поиграть в настолки"];
  const WHAT = [...WHAT_KEY, "в караоке", "на квиз", "на футбол", "в кафе", "куда угодно", "на каток", "в боулинг", "на вечеринку",
    "в клуб", "на стендап", "в театр", "в музей", "на выставку", "на рейв", "кататься на великах", "на пикник", "в парк",
    "на шашлыки", "в баню", "в бассейн", "на скалодром", "в аквапарк", "на матч", "в антикафе", "на хакатон", "в лазертаг",
    "в квест", "на лекцию", "на маркет", "поиграть в волейбол", "в падел", "поиграть в приставку", "на рыбалку", "за город",
    "на дачу", "на крышу", "встречать рассвет", "на фестиваль", "на картинг", "в планетарий", "на пробежку", "в компьютерный клуб"];
  const MAX_DAYS = 30;             // план – на ближайший месяц, дата из календаря
  const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
  function dayLabel(day) {
    if (day === 0) return "сегодня";
    if (day === 1) return "завтра";
    const d = new Date();
    d.setDate(d.getDate() + day);
    return `${WEEKDAYS[d.getDay()]} ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const whenText = (day) => (day < 2 ? dayLabel(day) : `${dayLabel(day).startsWith("вт") ? "во" : "в"} ${dayLabel(day)}`);
  const planText = (p) => (p && p.what && p.day != null ? `${p.what} ${whenText(p.day)}` : "");
  // План – пузырём сообщения собеседника: компания „говорит“, куда зовёт
  const planBubble = (c, cls = "") => (planText(c.plan) ? `<span class="plan ${cls}">${esc(planText(c.plan))}</span>` : "");

  const INTERESTS_KEY = ["музыка", "кино", "спорт", "игры", "путешествия"];
  const INTERESTS = [...INTERESTS_KEY, "прогулки", "концерты", "караоке", "настолки", "квизы", "бары", "клубы", "футбол", "кофе",
    "аниме", "бег", "техно", "рэп", "рок", "инди", "джаз", "k-pop", "театр", "стендап", "искусство", "фотография", "мода",
    "книги", "сериалы", "кулинария", "вино", "йога", "фитнес", "бокс", "баскетбол", "волейбол", "теннис", "сноуборд", "скейт",
    "велосипед", "походы", "кемпинг", "рыбалка", "собаки", "кошки", "косплей", "комиксы", "видеоигры", "киберспорт",
    "программирование", "стартапы", "дизайн", "танцы", "вечеринки", "рейвы", "фестивали", "учёба", "языки", "волонтёрство",
    "астрология", "мемы", "подкасты", "стритфуд", "пикники", "тусовки", "пицца", "машины", "мотоциклы", "шахматы", "мафия"];
  // друзья для новой компании: кто уже в другой компании, того не позвать
  const FRIENDS = [
    { id: "natashka" }, { id: "valentin" }, { id: "kapibar" },
    { id: "alesya", busy: "kotiki" }, { id: "sonya", busy: "kotiki" },
    { id: "tarakanus", busy: "boardgames" }, { id: "lyova", busy: "hse" }, { id: "vasya", busy: "hse" },
  ];
  const WEEK = 7;
  const FRIEND_IDS = FRIENDS.map((f) => f.id);

  // ── Состояние ──────────────────────────────────────────────────────────
  let S;
  function initial() {
    return {
      mine: "none",                // none | pending | active – по умолчанию своей компании нет
      own: { ...MINE_DEFAULT },
      accepted: ["me"],            // в „ждём друзей“ – кто уже согласился
      city: "full",                // full | one | empty
      liked: {},                   // кого лайкнула твоя компания и кто именно
      likesUs: 0,
      matches: [],                 // { id, state: new | they | waiting | ready | expired, daysLeft }
      draft: { interests: new Set(), friends: new Set(), what: "", day: null, desc: "" },
      confirm: false,              // „выйти из компании“ / „скрыть компанию“ ждёт второго нажатия
      hidden: [],                  // скрытые из выдачи компании
      feed: "plans",               // plans – ближайшие планы, all – все компании
      requests: [],                // кому из участников чужих компаний отправлена заявка в друзья
    };
  }

  const company = (id) => (id === "mine" ? S.own : COMPANIES.find((c) => c.id === id));
  // в ленте выше – компании, у которых больше фото: лица продают компанию лучше букв
  const photos = (c) => c.members.filter((id) => P[id].photo).length / c.members.length;
  const visible = () => (S.city === "empty" ? [] : S.city === "one" ? COMPANIES.slice(0, 1) : COMPANIES)
    .filter((c) => !S.hidden.includes(c.id))
    .map((c, i) => [c, i]).sort((a, b) => photos(b[0]) - photos(a[0]) || a[1] - b[1]).map(([c]) => c);
  const match = (id) => S.matches.find((m) => m.id === id);
  const avgAge = (c) => Math.round(c.members.reduce((s, id) => s + P[id].age, 0) / c.members.length);

  // ── Разметка ───────────────────────────────────────────────────────────
  function face(id, cls) {
    const p = P[id];
    return p.photo
      ? `<img class="${cls}${p.sq ? ` ${cls}--squircle` : ""}" src="${A}${p.photo}" alt="">`
      : `<span class="${cls} ${cls}--initial">${esc(p.name[0])}</span>`;
  }

  // Компания – кучка лиц-наклеек, как витрина-герой в профиле: сквирклы разного размера
  // с наклоном, первый – крупнее. x, y – центр в % коробки, s – сторона в % ширины, r – наклон.
  // Больше четырёх – стикер-число „+N“
  const CREW = {
    1: [[50, 50, 74, -4]],
    2: [[38, 44, 62, -6], [73, 64, 46, 8]],
    3: [[38, 42, 58, -6], [77, 27, 38, 9], [73, 74, 42, 4]],
    4: [[37, 40, 54, -6], [78, 24, 34, 10], [76, 66, 40, 5], [26, 80, 30, -10]],
  };

  function crew(c, cls = "") {
    const n = c.members.length;
    const shown = c.members.slice(0, 4);
    const faces = shown.map((id, i) => {
      const [x, y, size, r] = CREW[shown.length][i];
      return `<span class="crew__face" style="--x: ${x}%; --y: ${y}%; --s: ${size}%; --r: ${r}deg; --z: ${9 - i}">${face(id, "crew__img")}</span>`;
    }).join("");
    const more = n > 4 ? `<span class="sticker-number crew__more">+${n - 4}</span>` : "";
    return `<div class="crew ${cls}" aria-hidden="true">${faces}${more}</div>`;
  }

  // Мелко (баннер, строки, шапка чата) – стопка лиц из системы
  const stack = (ids, cls = "") =>
    `<span class="face-stack ${cls}" aria-hidden="true">${ids.slice(0, 3).map((id) => face(id, "face-stack__img")).join("")}</span>`;

  function interests(list, max = 99) {
    const shown = list.slice(0, max);
    const rest = list.length - shown.length;
    return shown.map((t) => `<li class="tag">${esc(t)}</li>`).join("") + (rest > 0 ? `<li class="tag tag--more">+${rest}</li>` : "");
  }

  const meta = (c) => `${people(c.members.length)} · ${years(avgAge(c))}`;

  // ── Экран списка ───────────────────────────────────────────────────────
  function renderMine() {
    const el = $("#mine");
    if (S.mine === "none") {
      el.innerHTML = `
        <button class="mine-card pressable" type="button" data-act="create">
          <img class="mine-card__sticker" src="${A}stickers/rock.webp" alt="">
          <span class="mine-card__body">
            <span class="mine-card__title">собери свою компанию</span>
            <span class="mine-card__text">до 15 человек</span>
          </span>
          <i class="icon icon--chevron mine-card__chevron" aria-hidden="true"></i>
        </button>`;
      return;
    }
    const c = S.own;
    if (S.mine === "pending") {
      const waiting = c.members.length - S.accepted.length;
      el.innerHTML = `
        <div class="mine-card">
          <span class="face-stack mine-card__faces" aria-hidden="true">${c.members.slice(0, 4).map((id) => face(id, `face-stack__img${S.accepted.includes(id) ? "" : " is-waiting"}`)).join("")}</span>
          <div class="mine-card__body">
            <p class="mine-card__title ellipsis">${esc(c.name)}</p>
            <p class="mine-card__text">ждём ответа от ${waiting}${NBSP}${plural(waiting, "друга", "друзей", "друзей")}</p>
          </div>
        </div>`;
      return;
    }
    el.innerHTML = `
      <button class="mine-card pressable" type="button" data-open="mine" aria-label="твоя компания: ${esc(c.name)}">
        ${stack(c.members, "mine-card__faces")}
        <div class="mine-card__body">
          <p class="mine-card__title ellipsis">${esc(c.name)}</p>
          <p class="mine-card__text">${S.likesUs ? "вас лайкнули" : people(c.members.length)}</p>
        </div>
        ${S.likesUs ? `<span class="badge-star mine-card__likes" aria-hidden="true"><i class="icon icon--badge-star"></i><span class="badge-star__value">${S.likesUs}</span></span>` : ""}
        <i class="icon icon--chevron mine-card__chevron" aria-hidden="true"></i>
      </button>`;
  }

  function matchMeta(m) {
    const name = company(m.id).name;
    const left = `ещё ${days(m.daysLeft)}`;
    return {
      new: `создайте общий чат · ${left}`,
      they: `они за общий чат · ${left}`,
      waiting: `ждём ответа · ${left}`,
      ready: "общий чат готов",
      expired: "неделя прошла",
    }[m.state];
  }

  function renderMatches() {
    const list = S.matches;
    $("#matches-section").hidden = !list.length;
    $("#matches-count").textContent = list.length;
    $("#matches").innerHTML = list.map((m) => {
      const c = company(m.id);
      const hot = m.state === "new" || m.state === "they";
      return `
        <li>
          <button class="match-row pressable${m.state === "expired" ? " is-expired" : ""}" type="button" data-match="${m.id}">
            ${stack(c.members, "match-row__faces")}
            <span class="match-row__body">
              <span class="match-row__title ellipsis">${esc(c.name)}</span>
              <span class="match-row__meta ellipsis">${matchMeta(m)}</span>
            </span>
            ${hot ? '<span class="match-row__dot" aria-label="новое"></span>' : ""}
          </button>
        </li>`;
    }).join("");
  }

  function likeButton(c) {
    const by = S.liked[c.id];
    const label = by ? `лайк отправлен: ${c.name}` : `лайкнуть: ${c.name}`;
    return `
      <button class="like-button pressable${by ? " is-liked" : ""}" type="button" data-like="${c.id}" aria-pressed="${!!by}" aria-label="${esc(label)}">
        <img class="like-button__heart" src="${A}stickers/heart.webp" alt="">
      </button>`;
  }

  // Две ленты: „ближайшие“ – у кого есть план, по дате; „все“ – все компании города с описанием
  const withPlans = () => visible().filter((c) => c.plan).sort((a, b) => a.plan.day - b.plan.day || photos(b) - photos(a));

  function renderList() {
    const plans = S.feed === "plans";
    const list = plans ? withPlans() : visible();
    $("#count-plans").textContent = withPlans().length || "";
    $("#count-all").textContent = visible().length || "";
    $$("[data-feed]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.feed === S.feed)));
    const cityEmpty = !visible().length;
    $("#list-empty").hidden = !cityEmpty;
    $("#plans-empty").hidden = cityEmpty || list.length > 0;
    // „с планами“ – по дням: заголовок дня, под ним компании с пузырём „куда“.
    // „все“ – та же вёрстка с описанием вместо пузыря. Подложки нет: за лицами пятно цвета компании
    let lastDay = null;
    $("#list").innerHTML = list.map((c) => {
      const head = plans && c.plan.day !== lastDay
        ? `<li class="feed-day${c.plan.day === 0 ? " feed-day--today" : ""}">${dayLabel(c.plan.day)}</li>` : "";
      if (plans) lastDay = c.plan.day;
      return `${head}
      <li class="company-row" style="--c1: ${c.theme[0]}">
        <span class="company-row__aura" aria-hidden="true"></span>
        <button class="company-row__open" type="button" data-open="${c.id}" aria-label="${esc(c.name)}"></button>
        <div class="company-row__body">
          ${plans ? `<span class="plan company-row__plan">${esc(c.plan.what)}</span>` : ""}
          <span class="company-row__name">${esc(c.name)}</span>
          <span class="company-row__meta">${meta(c)}</span>
          ${plans ? "" : `<span class="company-row__desc">${esc(c.desc)}</span>`}
          ${match(c.id) ? "" : likeButton(c)}
        </div>
        ${crew(c, "company-row__crew")}
      </li>`;
    }).join("");
  }

  function renderAll() {
    renderMine();
    renderMatches();
    renderList();
    renderPanel();
    if (current.company) renderCompany(current.company);
    if (current.match) renderMatch(current.match);
  }

  // ── Профиль компании ───────────────────────────────────────────────────
  function renderCompany(id) {
    const c = company(id);
    $("#company-crew").innerHTML = crew(c, "company__crew");
    const [c1, c2, c3] = c.theme;
    const theme = $(".company__theme");
    theme.style.setProperty("--c1", c1);
    theme.style.setProperty("--c2", c2);
    theme.style.setProperty("--c3", c3);
    $("#company-edit").hidden = id !== "mine";
    $("#company-plan").innerHTML = id === "mine" && !c.plan
      ? `<button class="chip pressable" type="button" data-act="edit-plan"><i class="icon icon--plus" aria-hidden="true"></i>добавить план</button>`
      : planBubble(c, "plan--big");
    $("#company-name").textContent = c.name;
    $("#company-meta").textContent = meta(c);
    $("#company-desc").textContent = c.desc;
    $("#company-interests").innerHTML = interests(c.interests);
    $("#company-count").textContent = c.members.length;
    $("#company-members").innerHTML = c.members.map((m) => `
      <li class="member">
        ${face(m, "member__face")}
        <span class="member__body">
          <span class="member__name ellipsis">${esc(P[m].name)}</span>
          <span class="member__age">${years(P[m].age)}</span>
        </span>
        ${memberAction(m)}
      </li>`).join("");

    const foot = $("#company-footer");
    if (id === "mine") {
      foot.innerHTML = S.confirm
        ? `<button class="button button--danger is-confirm pressable" type="button" data-act="leave">точно выйти?</button>`
        : `<button class="button button--danger pressable" type="button" data-act="leave">выйти из компании</button>`;
      return;
    }
    const m = match(id);
    let main;
    if (m) {
      main = `<button class="button button--primary pressable" type="button" data-match="${id}"><img class="button__sticker" src="${A}stickers/heart.webp" alt="">это взаимно</button>`;
    } else if (S.liked[id]) {
      main = `<button class="button button--secondary pressable" type="button" data-unlike="${id}" aria-pressed="true"><img class="button__sticker" src="${A}stickers/heart.webp" alt="">убрать лайк</button>`;
    } else {
      main = `<button class="button button--primary pressable" type="button" data-like="${id}" aria-pressed="false"><img class="button__sticker" src="${A}stickers/heart.webp" alt="">лайкнуть</button>`;
    }
    // Скрыть из выдачи – аналог жалобы: красная под главной, подтверждение той же кнопкой
    const hide = S.confirm
      ? `<button class="button button--danger is-confirm pressable" type="button" data-act="hide">точно скрыть?</button>`
      : `<button class="button button--danger pressable" type="button" data-act="hide">скрыть компанию</button>`;
    foot.innerHTML = main + hide;
  }

  // Справа у участника: не друг – „добавить“ (заявка – галочка на #242424, как в „возможных“),
  // друг – „написать“, как в строке друга; у себя – ничего
  function memberAction(m) {
    if (m === "me") return "";
    if (FRIEND_IDS.includes(m)) {
      return `<button class="icon-button icon-button--row pressable" type="button" data-act="write" aria-label="написать: ${esc(P[m].name)}"><i class="icon icon--chat" aria-hidden="true"></i></button>`;
    }
    return S.requests.includes(m)
      ? `<button class="add-button add-button--sent pressable" type="button" data-add="${m}" aria-label="отменить заявку: ${esc(P[m].name)}">отменить</button>`
      : `<button class="add-button pressable" type="button" data-add="${m}" aria-label="добавить в друзья: ${esc(P[m].name)}">добавить</button>`;
  }

  // ── Взаимно ────────────────────────────────────────────────────────────
  function renderMatch(id) {
    const m = match(id);
    const c = company(id);
    const name = c.name;
    $("#match-mine").innerHTML = crew(S.own, "match__crew");
    $("#match-theirs").innerHTML = crew(c, "match__crew");
    const hero = $(".match__hero");
    hero.style.setProperty("--c-mine", S.own.theme[0]);
    hero.style.setProperty("--c-theirs", c.theme[0]);
    const shared = c.interests.filter((t) => S.own.interests.includes(t));
    $("#match-shared").innerHTML = shared.length
      ? `<p class="caps-label match__shared-label">общие интересы</p><ul class="tags match__tags">${interests(shared)}</ul>` : "";
    const all = S.own.members.length + c.members.length;
    const text = {
      new: `${name} тоже лайкнули вашу компанию`,
      they: `${P[c.members[0]].name} из компании ${name} уже за общий чат`,
      waiting: `${name} тоже лайкнули вашу компанию`,
      ready: `общий чат на ${people(all)} готов`,
      expired: `${name} тоже лайкнули вашу компанию`,
    }[m.state];
    $("#match-title").textContent = m.state === "expired" ? "неделя прошла" : "это взаимно";
    $("#match-text").textContent = text;
    const time = $("#match-time");
    time.hidden = m.state === "ready" || m.state === "expired";
    time.textContent = `предложение действует ещё ${days(m.daysLeft)}`;

    const cta = $("#match-cta");
    cta.className = "button match__cta pressable";
    cta.disabled = false;
    if (m.state === "new" || m.state === "they") {
      cta.classList.add("button--primary");
      cta.innerHTML = "создать общий чат";
      cta.dataset.act = "agree";
    } else if (m.state === "waiting") {
      cta.classList.add("button--secondary");
      cta.innerHTML = "ждём ответа";
      cta.dataset.act = "";
    } else if (m.state === "ready") {
      cta.classList.add("button--primary");
      cta.innerHTML = "открыть чат";
      cta.dataset.act = "open-chat";
    } else {
      cta.disabled = true;
      cta.innerHTML = "время вышло";
      cta.dataset.act = "";
    }
  }

  // ── Новая компания: вёрстка готового профиля ───────────────────────────
  const addChip = (sheet, text) =>
    `<button class="chip create__add pressable" type="button" data-sheet="${sheet}"><i class="icon icon--plus" aria-hidden="true"></i>${text}</button>`;

  function draftPlanText(d) {
    if (!d.what) return "";
    return d.day == null ? d.what : `${d.what} ${whenText(d.day)}`;
  }

  function renderCreate() {
    const d = S.draft;
    const theme = $(".create__theme");
    S.own.theme.forEach((c, i) => theme.style.setProperty(`--c${i + 1}`, c));
    // шапка: кучка лиц и квадрат с плюсом; пока никого – только квадрат
    const ids = editing ? S.own.members : ["me", ...d.friends];
    const add = `<button class="crew-add pressable" type="button" data-sheet="friends" aria-label="позвать друзей"><i class="icon icon--plus" aria-hidden="true"></i></button>`;
    $("#create-crew").innerHTML = ids.length > 1
      ? `<div class="create__crew-box">${crew({ members: ids }, "company__crew")}${editing ? "" : add}</div>`
      : add.replace("crew-add", "crew-add crew-add--big");
    $("#create-crew").classList.toggle("is-empty", ids.length < 2);
    $("#create-meta").textContent = ids.length > 1 ? meta({ members: ids }) : "";
    $("#create-plan").innerHTML = d.what
      ? `<button class="plan plan--big pressable" type="button" data-sheet="plan">${esc(draftPlanText(d))}</button>`
      : addChip("plan", "план");
    const desc = $("#create-desc");
    if (desc.value !== d.desc) desc.value = d.desc;
    requestAnimationFrame(() => grow(desc));
    $("#create-interests-slot").innerHTML = d.interests.size
      ? `<button class="create__filled pressable" type="button" data-sheet="interests"><ul class="tags company__interests">${interests([...d.interests])}</ul></button>`
      : addChip("interests", "интересы");
    $("#create-submit").disabled = !($("#create-name").value.trim() && (editing || d.friends.size));
    renderSheets();
  }

  // поиск: пусто – пять ключевых и уже выбранные; есть запрос – все совпадения
  function options(all, key, selected, query) {
    const q = query.trim().toLowerCase();
    if (q) return all.filter((t) => t.includes(q));
    return [...new Set([...selected.filter((t) => !key.includes(t)), ...key])];
  }

  function renderSheets() {
    const d = S.draft;
    $("#create-count").textContent = d.friends.size ? d.friends.size + 1 : "";
    $("#create-friends").innerHTML = FRIENDS.map((f) => {
      const p = P[f.id];
      const on = d.friends.has(f.id);
      const status = f.busy ? `уже в компании ${company(f.busy).name}` : years(p.age);
      return `
        <li>
          <button class="pick-row pressable" type="button" data-friend="${f.id}" aria-pressed="${on}" ${f.busy ? "disabled" : ""}>
            ${face(f.id, "pick-row__face")}
            <span class="pick-row__body">
              <span class="pick-row__name ellipsis">${esc(p.name)}</span>
              <span class="pick-row__status ellipsis">${esc(status)}</span>
            </span>
            <span class="pick-row__check" aria-hidden="true"><i class="icon icon--check"></i></span>
          </button>
        </li>`;
    }).join("");

    // своё занятие: если набранного нет в списке, оно – первое предложение (а если ничего не нашлось – единственное)
    const query = $("#what-search").value.trim().toLowerCase();
    let what = options(WHAT, WHAT_KEY, d.what ? [d.what] : [], query);
    if (query && !what.includes(query)) what = [query, ...what];
    $("#create-what").innerHTML = what.length ? what.map((t) => `
      <button class="tag tag--toggle pressable" type="button" role="radio" aria-pressed="${d.what === t}" data-what="${esc(t)}">${esc(t)}</button>`).join("")
      : `<p class="sheet__empty">такого нет – попробуй по-другому</p>`;
    const other = d.day != null && d.day > 1;
    $("#create-when").innerHTML = [0, 1].map((day) => `
      <button class="tag tag--toggle pressable" type="button" role="radio" aria-pressed="${d.day === day}" data-day="${day}">${dayLabel(day)}</button>`).join("") + `
      <button class="tag tag--toggle pressable" type="button" role="radio" aria-pressed="${other || calendarOpen}" data-act="calendar" aria-expanded="${other || calendarOpen}">${other ? dayLabel(d.day) : "другой день"}</button>`;
    renderCalendar(other || calendarOpen);

    const ints = options(INTERESTS, INTERESTS_KEY, [...d.interests], $("#interest-search").value);
    $("#create-interests").innerHTML = ints.length ? ints.map((t) => `
      <button class="tag tag--toggle pressable" type="button" aria-pressed="${d.interests.has(t)}" data-interest="${t}">${t}</button>`).join("")
      : `<p class="sheet__empty">такого нет – попробуй по-другому</p>`;
  }

  // Свой календарь: месяц сеткой, неделя с понедельника; можно выбрать день от сегодня до +30
  const MONTHS = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  let calendarOpen = false;
  let calMonth = 0;              // сдвиг месяца от текущего
  function renderCalendar(show) {
    const el = $("#calendar");
    el.hidden = !show;
    if (!show) return;
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const first = new Date(t.getFullYear(), t.getMonth() + calMonth, 1);
    const lead = (first.getDay() + 6) % 7;
    const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const maxMonth = new Date(t.getTime() + MAX_DAYS * 86400000).getMonth() !== t.getMonth() ? 1 : 0;
    const cells = [];
    for (let k = 0; k < lead; k++) cells.push('<span class="calendar__cell" aria-hidden="true"></span>');
    for (let n = 1; n <= total; n++) {
      const date = new Date(first.getFullYear(), first.getMonth(), n);
      const day = Math.round((date - t) / 86400000);
      const off = day < 0 || day > MAX_DAYS;
      cells.push(`<button class="calendar__cell calendar__day pressable${day === 0 ? " is-today" : ""}" type="button" data-cal="${day}"
        aria-pressed="${S.draft.day === day}" ${off ? "disabled" : ""} aria-label="${n} ${MONTHS[first.getMonth()]}">${n}</button>`);
    }
    el.innerHTML = `
      <div class="calendar__head">
        <button class="calendar__nav calendar__nav--prev pressable" type="button" data-cal-nav="-1" ${calMonth <= 0 ? "disabled" : ""} aria-label="прошлый месяц"><i class="icon icon--chevron" aria-hidden="true"></i></button>
        <span class="calendar__month">${MONTHS[first.getMonth()]}</span>
        <button class="calendar__nav pressable" type="button" data-cal-nav="1" ${calMonth >= maxMonth ? "disabled" : ""} aria-label="следующий месяц"><i class="icon icon--chevron" aria-hidden="true"></i></button>
      </div>
      <div class="calendar__grid">${["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((w) => `<span class="calendar__wd">${w}</span>`).join("")}${cells.join("")}</div>`;
  }

  // ── Шторки ─────────────────────────────────────────────────────────────
  let sheetOpen = null;
  function openSheet(name) {
    sheetOpen = $(`#sheet-${name}`);
    $("#what-search").value = "";
    $("#interest-search").value = "";
    calendarOpen = false;
    calMonth = 0;
    renderSheets();
    sheetOpen.classList.add("is-open");
    $("#scrim").classList.add("is-open");
    $("#screen-create").inert = true;
    requestAnimationFrame(() => sheetOpen && sheetOpen.focus({ preventScroll: true }));
  }

  function closeSheet() {
    if (!sheetOpen) return;
    sheetOpen.classList.remove("is-open", "is-dragging");
    sheetOpen.style.removeProperty("transform");
    $("#scrim").classList.remove("is-open");
    $("#screen-create").inert = false;
    sheetOpen = null;
    renderCreate();
  }

  $("#scrim").addEventListener("click", closeSheet);
  // жест вниз за грэббер и заголовок: шторка идёт за пальцем, закрытие – по проекции броска
  $$(".sheet__handle").forEach((handle) => {
    let start = null;
    const sheet = handle.closest(".sheet");
    handle.addEventListener("pointerdown", (e) => {
      start = { y: e.clientY, t: performance.now(), dy: 0, v: 0 };
      handle.setPointerCapture(e.pointerId);
      sheet.classList.add("is-dragging");
    });
    handle.addEventListener("pointermove", (e) => {
      if (!start) return;
      const z = $("#app").getBoundingClientRect().height / $("#app").offsetHeight || 1;
      start.dy = Math.max(0, (e.clientY - start.y) / z);
      start.v = start.dy / Math.max(1, performance.now() - start.t);
      sheet.style.transform = `translateY(${start.dy}px)`;
    });
    const end = () => {
      if (!start) return;
      sheet.classList.remove("is-dragging");
      sheet.style.removeProperty("transform");
      if (start.dy + start.v * 200 > sheet.offsetHeight / 3) closeSheet();
      start = null;
    };
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  });
  $("#what-search").addEventListener("input", renderSheets);
  $("#interest-search").addEventListener("input", renderSheets);
  // всё, что пишут о компании, – строчными, как весь интерфейс blink
  const lower = (el) => {
    const pos = el.selectionStart;
    if (el.value !== el.value.toLowerCase()) {
      el.value = el.value.toLowerCase();
      el.setSelectionRange(pos, pos);
    }
  };
  $("#create-desc").addEventListener("input", (e) => {
    lower(e.target);
    S.draft.desc = e.target.value;
    grow(e.target);
  });
  const grow = (el) => { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; };

  // ── Онбординг ──────────────────────────────────────────────────────────
  const INTRO = [
    ["знакомься компаниями", "создавайте компании, лайкайте других и если это взаимно – то переходите в общий чат"],
    ["собери свою компанию", "позови друзей, укажите свои планы и интересы"],
    ["лайки анонимные", "о лайке узнают, только если он взаимный. тогда у обеих компаний появится общий чат"],
  ];
  let introAt = 0;
  function introStep(n) {
    if (n >= INTRO.length) return hideIntro();
    introAt = n;
    const el = $("#screen-intro");
    el.dataset.step = n;
    $("#intro-title").textContent = INTRO[n][0];
    $("#intro-text").textContent = INTRO[n][1];
    $("#intro-cta").textContent = n === INTRO.length - 1 ? "погнали" : "дальше";
    // сцена шага разыгрывается заново при каждом показе
    el.classList.remove("is-playing");
    void el.offsetWidth;
    el.classList.add("is-playing");
  }

  function showIntro() {
    const el = $("#screen-intro");
    $("#intro-left").innerHTML = crew(COMPANIES[0], "intro__crew");
    $("#intro-right").innerHTML = crew(COMPANIES[1], "intro__crew");
    $("#intro-build").innerHTML = `${crew(MINE_DEFAULT, "intro__crew")}<span class="crew-add intro__add"><i class="icon icon--plus" aria-hidden="true"></i></span>`;
    $("#intro-a").innerHTML = crew(MINE_DEFAULT, "intro__crew intro__crew--small");
    $("#intro-b").innerHTML = crew(COMPANIES[0], "intro__crew intro__crew--small");
    el.hidden = false;
    el.classList.remove("is-leaving");
    list.inert = true;
    introStep(0);
  }

  function hideIntro() {
    const el = $("#screen-intro");
    el.classList.add("is-leaving");
    list.inert = false;
    setTimeout(() => { el.hidden = true; }, 300);
  }

  // ── Навигация ──────────────────────────────────────────────────────────
  const current = { company: null, match: null };
  const screens = [];
  const list = $("#screen-list");

  function open(screen) {
    const el = $(`#screen-${screen}`);
    el.hidden = false;
    screens.push(el);
    list.inert = true;
    screens.slice(0, -1).forEach((s) => { s.inert = true; });
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-open")));
  }

  function close() {
    const el = screens.pop();
    if (!el) return;
    el.classList.remove("is-open");
    const top = screens[screens.length - 1];
    if (top) top.inert = false;
    else list.inert = false;
    setTimeout(() => { if (!el.classList.contains("is-open")) el.hidden = true; }, 320);
    if (el.id === "screen-company") { current.company = null; S.confirm = false; }
    if (el.id === "screen-match") current.match = null;
  }

  function closeAll() {
    while (screens.length) close();
  }

  function openCompany(id) {
    current.company = id;
    S.confirm = false;
    renderCompany(id);
    $("#screen-company .screen__scroll").scrollTop = 0;
    open("company");
  }

  function openMatch(id) {
    const m = match(id);
    if (m.state === "ready") return openChat(id);
    current.match = id;
    renderMatch(id);
    open("match");
  }

  function openChat(id) {
    const c = company(id);
    const faces = [c.members[0], "me", c.members[1]];
    $("#chat-faces").outerHTML = stack(faces, "group-chat__faces").replace("<span ", '<span id="chat-faces" ');
    $("#chat-name").textContent = `${c.name} и ${S.own.name}`;
    $("#chat-status").textContent = `${S.own.members.length + c.members.length} ${plural(S.own.members.length + c.members.length, "участник", "участника", "участников")}`;
    $("#chat-text").textContent = `тут обе компании: ${c.name} и ${S.own.name}`;
    // чат – экран мессенджера: из „это взаимно“ уходим сразу в него
    if (screens.length && screens[screens.length - 1].id === "screen-match") close();
    open("chat");
  }

  // ── Пуш ────────────────────────────────────────────────────────────────
  let pushTimer = 0;
  let pushTarget = null;
  function push(title, text, target) {
    const el = $("#push");
    $("#push-title").textContent = title;
    $("#push-text").textContent = text;
    pushTarget = target;
    el.classList.add("is-shown");
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => el.classList.remove("is-shown"), 6000);
  }

  $("#push").addEventListener("click", () => {
    $("#push").classList.remove("is-shown");
    if (!pushTarget) return;
    closeAll();
    setTimeout(() => pushTarget(), 120);
  });

  // ── Действия в телефоне ────────────────────────────────────────────────
  function like(id) {
    if (S.mine === "none") return startCreate();
    if (S.mine === "pending") {
      const card = $(".mine-card");
      card.classList.remove("is-nudged");
      void card.offsetWidth;
      card.classList.add("is-nudged");
      $("#screen-list .screen__scroll").scrollTo({ top: 0, behavior: "smooth" });
      if (screens.length) closeAll();
      return;
    }
    if (S.liked[id]) {               // второе нажатие снимает лайк
      delete S.liked[id];
      renderAll();
      $("#announce").textContent = `лайк убран: ${company(id).name}`;
      return;
    }
    S.liked[id] = "me";
    renderAll();
    const btn = $(`.like-button[data-like="${id}"]`);
    if (btn) btn.classList.add("is-popping");
    $("#announce").textContent = `лайк отправлен: ${company(id).name}`;
  }

  // Новая компания и правка своей – один экран. В правке – только информация о компании:
  // название, о вас, интересы; состав здесь не меняется
  let editing = false;
  function startCreate(edit = false) {
    editing = edit;
    if (!edit) S.own = { ...MINE_DEFAULT, members: ["me"] };
    S.draft = { interests: new Set(edit ? S.own.interests : []), friends: new Set(),
      what: edit && S.own.plan ? S.own.plan.what : "", day: edit && S.own.plan ? S.own.plan.day : null,
      desc: edit ? S.own.desc : "" };
    $("#create-name").value = edit ? S.own.name : "";
    $("#create-title").textContent = edit ? "о компании" : "новая компания";
    $("#create-submit").textContent = edit ? "сохранить" : "собрать компанию";
    renderCreate();
    $("#screen-create .screen__scroll").scrollTop = 0;
    open("create");
  }

  function submitCreate() {
    const d = S.draft;
    if (editing) {
      S.own = { ...S.own, name: $("#create-name").value.trim(), desc: d.desc.trim(), interests: [...d.interests],
        plan: d.what && d.day != null ? { what: d.what, day: d.day } : null };
      close();
      return renderAll();
    }
    S.own = {
      id: "mine",
      theme: MINE_DEFAULT.theme,
      plan: d.what && d.day != null ? { what: d.what, day: d.day } : null,
      name: $("#create-name").value.trim(),
      desc: d.desc.trim(),
      interests: [...d.interests],
      members: ["me", ...d.friends],
    };
    S.accepted = ["me"];
    S.mine = "pending";
    S.liked = {};
    S.likesUs = 0;
    close();
    renderAll();
  }

  function agree() {
    const m = match(current.match);
    m.state = m.state === "they" ? "ready" : "waiting";
    renderAll();
    if (m.state === "ready") setTimeout(() => openChat(m.id), 450);
  }

  document.addEventListener("click", (event) => {
    const t = event.target.closest("button");
    if (!t || t.closest(".panel")) return;
    if (t.dataset.like) return like(t.dataset.like);
    if (t.dataset.open) return openCompany(t.dataset.open);
    if (t.dataset.match) return openMatch(t.dataset.match);
    if (t.dataset.sheet) return openSheet(t.dataset.sheet);
    if (t.dataset.friend) {
      const set = S.draft.friends;
      set.has(t.dataset.friend) ? set.delete(t.dataset.friend) : set.add(t.dataset.friend);
      return renderSheets();
    }
    if (t.dataset.what) {
      S.draft.what = S.draft.what === t.dataset.what ? "" : t.dataset.what;
      return renderSheets();
    }
    if (t.dataset.day) {
      const day = Number(t.dataset.day);
      S.draft.day = S.draft.day === day ? null : day;
      calendarOpen = false;
      return renderSheets();
    }
    if (t.dataset.cal) {
      S.draft.day = Number(t.dataset.cal);
      return renderSheets();
    }
    if (t.dataset.calNav) {
      calMonth += Number(t.dataset.calNav);
      return renderCalendar(true);
    }
    if (t.dataset.feed) {
      S.feed = t.dataset.feed;
      $("#screen-list .screen__scroll").scrollTop = 0;
      return renderList();
    }
    if (t.dataset.add) {
      const i = S.requests.indexOf(t.dataset.add);
      i < 0 ? S.requests.push(t.dataset.add) : S.requests.splice(i, 1);
      return renderCompany(current.company);
    }
    if (t.dataset.unlike) {
      delete S.liked[t.dataset.unlike];
      return renderAll();
    }
    if (t.dataset.interest) {
      const set = S.draft.interests;
      set.has(t.dataset.interest) ? set.delete(t.dataset.interest) : set.add(t.dataset.interest);
      return renderSheets();
    }
    switch (t.dataset.act) {
      case "back": case "close-create": case "close-match": return close();
      case "create": return startCreate();
      case "edit": return startCreate(true);
      case "edit-plan":
        startCreate(true);
        return setTimeout(() => openSheet("plan"), 320);
      case "sheet-done": return closeSheet();
      case "calendar":
        calendarOpen = !(calendarOpen || (S.draft.day != null && S.draft.day > 1));
        if (!calendarOpen && S.draft.day > 1) S.draft.day = null;
        return renderSheets();
      case "help": return showIntro();
      case "intro-next": return introStep(introAt + 1);
      case "intro-done": return hideIntro();
      case "write": return;   // чат с другом – экран мессенджера, в этой задаче его нет
      case "agree": return agree();
      case "open-chat": return openChat(current.match);
      case "close-webview": return;   // вебвью закрывает приложение: в прототипе – только отклик
      case "hide":
        if (!S.confirm) return askConfirm();
        S.hidden.push(current.company);
        delete S.liked[current.company];
        S.matches = S.matches.filter((m) => m.id !== current.company);
        S.confirm = false;
        close();
        return renderAll();
      case "leave":
        if (!S.confirm) return askConfirm();
        S.mine = "none";
        S.liked = {};
        S.matches = [];
        S.confirm = false;
        close();
        return renderAll();
    }
    if (t.id === "create-submit") submitCreate();
  });

  // Второе нажатие подтверждает; не нажали за 4 s – кнопка возвращается
  let confirmTimer = 0;
  function askConfirm() {
    const id = current.company;
    S.confirm = true;
    renderCompany(id);
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => { S.confirm = false; if (current.company === id) renderCompany(id); }, 4000);
  }

  $("#create-name").addEventListener("input", (e) => { lower(e.target); renderCreate(); });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (sheetOpen) return closeSheet();
    if (screens.length) close();
  });

  // ── Пульт ──────────────────────────────────────────────────────────────
  function renderPanel() {
    $$("[data-mine]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.mine === S.mine)));
    $$("[data-city]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.city === S.city)));
    const k = match("kotiki");
    $('[data-event="mutual"]').disabled = !!k || S.city === "empty";
    $('[data-event="they-agree"]').disabled = !k || !["new", "waiting"].includes(k.state);
    $('[data-event="friend-agree"]').disabled = S.mine !== "pending";
    $('[data-event="like-us"]').disabled = S.mine !== "active";
    $('[data-event="week"]').disabled = !S.matches.some((m) => m.state !== "ready" && m.state !== "expired");
  }

  function setMine(state) {
    S.mine = state;
    S.own = { ...MINE_DEFAULT };
    S.accepted = ["me"];
    S.liked = state === "active" ? { boardgames: "natashka" } : {};
    S.likesUs = state === "active" ? 3 : 0;
    if (state !== "active") S.matches = [];
  }

  $(".panel").addEventListener("click", (event) => {
    const b = event.target.closest("button");
    if (!b) return;
    if (b.dataset.mine) { closeAll(); setMine(b.dataset.mine); return renderAll(); }
    if (b.dataset.city) { S.city = b.dataset.city; return renderAll(); }
    switch (b.dataset.event) {
      case "mutual":
        if (S.mine !== "active") setMine("active");
        S.liked.kotiki = S.liked.kotiki || "me";
        S.matches.unshift({ id: "kotiki", state: "new", daysLeft: WEEK });
        renderAll();
        return push("это взаимно", "котики тоже лайкнули вашу компанию", () => openMatch("kotiki"));
      case "they-agree": {
        const m = match("kotiki");
        m.state = m.state === "waiting" ? "ready" : "they";
        renderAll();
        if (m.state === "ready") return push("общий чат готов", `котики и ${S.own.name} теперь в одном чате`, () => openChat("kotiki"));
        return push("котики за общий чат", "лиза уже за. остался кто-нибудь из вас", () => openMatch("kotiki"));
      }
      case "friend-agree": {
        const next = S.own.members.find((id) => !S.accepted.includes(id));
        if (next) S.accepted.push(next);
        // компания видна городу, когда в ней двое
        if (S.accepted.length >= 2) S.mine = "active";
        return renderAll();
      }
      case "like-us":
        S.likesUs += 1;
        renderAll();
        return push("вашу компанию лайкнули", `уже ${S.likesUs}${NBSP}${plural(S.likesUs, "раз", "раза", "раз")}. может, это взаимно`, () => {});
      case "week":
        S.matches.forEach((m) => { if (m.state !== "ready") { m.state = "expired"; m.daysLeft = 0; } });
        return renderAll();
      case "intro":
        closeAll();
        return showIntro();
      case "reset":
        closeAll();
        S = initial();
        return renderAll();
    }
  });

  // Стенд: телефон целиком помещается в окно по высоте
  function fit() {
    const body = $(".stage__body");
    if (innerWidth <= 480) return body.style.removeProperty("--stage-zoom");
    const room = innerHeight - $(".stage__head").offsetHeight - 56;
    body.style.setProperty("--stage-zoom", Math.min(1, room / 844).toFixed(3));
  }
  fit();
  addEventListener("resize", fit);

  // ?state=… – сразу нужное состояние (для снимков)
  S = initial();
  const q = new URLSearchParams(location.search);
  if (q.get("mine")) setMine(q.get("mine"));
  if (q.get("city")) S.city = q.get("city");
  if (q.get("feed")) S.feed = q.get("feed");
  renderAll();
  const st = q.get("state");
  if (!st && q.get("intro") !== "0") showIntro();
  if (q.get("introStep")) introStep(Number(q.get("introStep")));
  if (st === "calendar") { startCreate(); setTimeout(() => { openSheet("plan"); calendarOpen = true; S.draft.day = 6; renderSheets(); }, 350); }
  if (st === "company") openCompany(q.get("id") || "kotiki");
  if (st === "create") startCreate();
  if (st === "create-filled") {
    startCreate();
    $("#create-name").value = "ночные велики";
    Object.assign(S.draft, { what: "кататься на великах", day: 5, desc: "катаемся по набережным, пока город спит" });
    ["natashka", "valentin", "kapibar"].forEach((f) => S.draft.friends.add(f));
    ["велосипед", "музыка", "кофе"].forEach((i) => S.draft.interests.add(i));
    renderCreate();
  }
  if (st && st.startsWith("sheet-")) { startCreate(); setTimeout(() => openSheet(st.slice(6)), 350); }
  if (st === "edit") { openCompany("mine"); startCreate(true); }
  if (st && st.startsWith("match")) {
    S.liked.kotiki = "me";
    S.matches.unshift({ id: "kotiki", state: st.split("-")[1] || "new", daysLeft: WEEK });
    renderAll();
    openMatch("kotiki");
  }
  if (st === "chat") {
    S.matches.unshift({ id: "kotiki", state: "ready", daysLeft: WEEK });
    renderAll();
    openChat("kotiki");
  }
})();
