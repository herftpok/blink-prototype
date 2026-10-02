/*
 * Приветственный квест: правила, люди и модель заявок. Экран – game.js, стенд – stand.js.
 *
 * Правила:
 *   – ты угадываешь, где сейчас знакомый – человек уже в blink, но ещё не твой друг, – и ставишь метку
 *     на карте. Пока он не твой друг, на карте его не видно;
 *   – чтобы узнать ответ, добавляешь его в друзья. Принял заявку – приходит пуш, и рядом с меткой
 *     появляется настоящий пин; чем ближе метка, тем больше огоньков;
 *   – угадать можно 10 знакомых;
 *   – огоньки идут в шкалу с подарками из маркета.
 *
 * Промах – в процентах от того, как далеко человек от тебя: 400 м мимо того, кто в соседнем доме, –
 * много, 400 м мимо того, кто на другом конце города, – почти в точку. Ближе километра считаем от
 * километра, иначе сосед за стенкой давал бы промах в сотни процентов.
 */

export const MAX_FRIENDS = 10;
const MISS_BASE_MIN = 1000;                      // м

/** промах в процентах: метры мимо / расстояние от тебя до человека */
export const missOf = (meters, away) => Math.round((meters / Math.max(away, MISS_BASE_MIN)) * 100);

/* Огоньки за метку: близко – 3, недалеко – 2, далеко – 1 (друг всё равно добавлен) */
export const HEAT = [
  { upTo: 20, word: "близко", fires: 3 },
  { upTo: 50, word: "недалеко", fires: 2 },
  { upTo: Infinity, word: "далеко", fires: 1 },
];
export const heatOf = (miss) => HEAT.find((h) => miss <= h.upTo);

/* Подарки из маркета по порядку шкалы, пороги – в огоньках: хвост „огонь“ – уже за первого друга, потом
   два стикерпака, хвост „тень“, в конце blink vip – десять друзей в среднем „недалеко“. Хвосты – живые
   упаковки (анимация), vip – звезда */
export const REWARDS = [
  { fires: 1, name: "огонь", kind: "хвост", art: "market/anim-tail-fire.webp" },
  { fires: 4, name: "тыквы", kind: "стикеры", art: "market/items/pumpkin.webp" },
  { fires: 8, name: "привидения", kind: "стикеры", art: "market/items/ghost.webp" },
  { fires: 14, name: "тень", kind: "хвост", art: "market/anim-tail-shadow.webp" },
  { fires: 20, name: "blink vip", kind: "подписка", art: "market/vip-star.png", vip: true },
];

/* ── карта: подложка map-hd 390 × 844 pt, точки – в её pt ──────────────── */

export const METERS_PER_PT = 6;                 // подложка – район примерно 2.3 × 5 км
export const HOME = { x: 205, y: 470 };         // ты дома
export const metersBetween = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) * METERS_PER_PT;

/** 480 → „0.5 км“, 1240 → „1.2 км“, 23 400 → „23 км“ – как дистанции в приложении */
export function distanceLabel(meters) {
  if (meters >= 9950) return `${Math.round(meters / 1000)}&nbsp;км`;
  return `${Math.max(0.1, Math.round(meters / 100) / 10).toFixed(1).replace(/\.0$/, "")}&nbsp;км`;
}

/* ── люди ─────────────────────────────────────────────────────────────
   Ты – наташка (вырезка p1). Остальные – знакомые: уже в blink, но ещё не в друзьях, у каждого причина.
   live – живая аватарка для пина (вырезка из avatars/), photo – фото для сквиркла и для пина, если
   вырезки нет (тогда оно лежит в кадре целиком – flat). pron – „он“ или „она“ для фразы „ты увидишь,
   где она на самом деле“: в продукте – из профиля, неизвестно – пишем имя. where – где человек на самом
   деле, когда примет заявку; answer – через сколько секунд стенда примет (null – не отвечает) */
export const ME = { name: "наташка", live: "people/live-1.webp" };

export const PEOPLE = [
  { id: "leva", name: "лёва", pron: "он", username: "lev.a", photo: "people/photo-3.webp", live: "people/live-3.webp", reason: "есть твой номер", where: { x: 92, y: 312, state: "staying", minutes: 14 }, answer: 4 },
  { id: "sonya", name: "соня", pron: "она", username: "sonyaaa", photo: "people/photo-4.webp", live: "people/live-4.webp", reason: "из твоей школы", where: { x: 312, y: 352, state: "home" }, answer: 6 },
  { id: "timur", name: "тимур", pron: "он", username: "timur.r", photo: "people/photo-2.webp", live: "people/live-2.webp", reason: "у тебя в контактах", where: { x: 80, y: 236, state: "moving", speed: 12 }, answer: 5 },
  { id: "vasya", name: "вася пупкин", pron: "он", username: "vasyan", photo: "people/photo-5.webp", live: "people/live-5.webp", reason: "из твоей школы", where: { x: 318, y: 242, state: "staying", minutes: 40 }, answer: 7 },
  { id: "masha", name: "маша", pron: "она", username: "mashuly", photo: "people/masha.webp", reason: "есть твой номер", where: { x: 160, y: 222, state: "home" }, answer: 5 },
  { id: "artem", name: "артём", pron: "он", username: "art.voronov", reason: "из твоей школы", where: { x: 52, y: 404, state: "staying", minutes: 5 }, answer: 8 },
  { id: "valentin", name: "валентин", pron: "он", username: "valentin", photo: "people/valentin.webp", reason: "у тебя в контактах", where: { x: 262, y: 280, state: "home" }, answer: 6 },
  { id: "kekova", name: "кекова", pron: null, username: "kekova", photo: "people/kekova.webp", reason: "есть твой номер", where: { x: 330, y: 430, state: "staying", minutes: 22 }, answer: 4 },
  { id: "polina", name: "полина", pron: "она", username: "polina.k", reason: "у тебя в контактах", where: { x: 230, y: 214, state: "staying", minutes: 8 }, answer: 9 },
  { id: "kapibar", name: "капибар", pron: null, username: "kapibar", photo: "people/kapibar.webp", reason: "из твоей школы", where: { x: 140, y: 300, state: "home" }, answer: 7 },
  { id: "tarakanus", name: "тараканус", pron: null, username: "tarakanus", photo: "people/tarakanus.webp", reason: "есть твой номер", where: { x: 236, y: 330, state: "staying", minutes: 31 }, answer: 5 },
  { id: "alesya", name: "алеся", pron: "она", username: "alesya", photo: "people/alesya.webp", reason: "есть твой номер", where: { x: 48, y: 330, state: "home" }, answer: null },
];
export const personById = (id) => PEOPLE.find((p) => p.id === id);

/* ── форматирование ─────────────────────────────────────────────────── */

export const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

/** 1 огонёк / 2 огонька / 5 огоньков */
export function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/* ── модель: метки, заявки и огоньки ───────────────────────────────────
   Метка – это ход: { x, y } – где ты её поставил, status – sent (заявка ушла, ждём ответа), accepted
   (принял, раскрытие ещё не показали), revealed (показали). События: send, accept, reveal, claim, reset */
export class Quest extends EventTarget {
  constructor() {
    super();
    this.auto = true;                            // знакомые сами отвечают на заявки (стенд)
    this.timers = [];
    this.reset();
  }

  emit(type, detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  reset() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.guesses = new Map();
    this.fires = 0;
    this.claimed = new Set();                    // индексы REWARDS, которые уже выданы
    this.emit("reset");
  }

  get canGuess() {
    return this.guesses.size < MAX_FRIENDS;
  }

  ids(status) {
    return [...this.guesses].filter(([, g]) => g.status === status).map(([id]) => id);
  }

  send(id, at) {
    if (this.guesses.has(id) || !this.canGuess) return;
    this.guesses.set(id, { x: at.x, y: at.y, status: "sent" });
    this.emit("send", { id });
    const person = personById(id);
    if (this.auto && person.answer != null) this.timers.push(setTimeout(() => this.accept(id), person.answer * 1000));
  }

  accept(id) {
    const g = this.guesses.get(id);
    if (!g || g.status !== "sent") return;
    g.status = "accepted";
    this.emit("accept", { id });
  }

  /** раскрытие: метры, промах, огоньки. Возвращает итог для экрана */
  reveal(id) {
    const g = this.guesses.get(id);
    if (!g || g.status !== "accepted") return null;
    const where = personById(id).where;
    const meters = metersBetween(g, where);
    const heat = heatOf(missOf(meters, metersBetween(HOME, where)));
    Object.assign(g, { status: "revealed", meters, heat });
    const before = this.fires;
    this.fires += heat.fires;
    this.emit("reveal", { id, before });
    return { id, meters, heat, before, after: this.fires };
  }

  /** подарки, до которых дошли огоньки и которых ещё не выдали */
  due() {
    return REWARDS.map((r, i) => i).filter((i) => !this.claimed.has(i) && this.fires >= REWARDS[i].fires);
  }

  claim(indexes) {
    indexes.forEach((i) => this.claimed.add(i));
    this.emit("claim", { indexes });
  }
}
