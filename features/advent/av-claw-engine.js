/*
 * Хватайка v2 – логика выдачи без интерфейса. Источник: «Blink · Новый год 2026/2027», раздел 4
 * (копия в new year event/контент, задания, призы и правила.md). Описание для разработки – algorithm.html.
 *
 * Одна попытка = одна награда: предмет A, приз S или билетики B.
 * Порядок: резерв под недостающие A → случайный тир → мягкая защита A (1-я попытка и серия из 3 B) → номинал B.
 * Работает в браузере (window.AV_CLAW) и в node (module.exports) – для теста и симуляции.
 */
(function (root) {
  "use strict";

  const CONFIG = {
    attempts: 18,               // круток за этап: 18 дней × 100 монеток
    cost: 100,                  // монеток за крутку
    tiers: { B: 74.46, A: 25, S: 0.54 },   // базовые веса, %
    maxBStreak: 3,              // пока A не собрана – не больше 3 билетных результатов подряд
    tickets: [                  // номинал после выбора B, вес внутри билетного пула
      { amount: 25, weight: 20 },
      { amount: 50, weight: 45 },
      { amount: 75, weight: 25 },
      { amount: 100, weight: 10 },
    ],
  };

  // 11 уникальных наград из документа: 6 A (весь набор гарантирован за 18 попыток) и 5 S (случайные, без гаранта).
  // Названий и креативов в документе нет – только тип. Предмет определяется номером в этом списке (0–10).
  // img – картинка-заглушка стенда: подарок цвета тира, у VIP – значок blink vip из маркета.
  const PRIZES = [
    ...Array.from({ length: 4 }, () => ({ tier: "A", kind: "sticker", title: "стикер", img: "r:gift-pink" })),
    ...Array.from({ length: 2 }, () => ({ tier: "A", kind: "tail", title: "хвост", img: "r:gift-cyan" })),
    ...Array.from({ length: 2 }, () => ({ tier: "S", kind: "sticker", title: "главный стикер", img: "r:gift-violet", weight: 0.13 })),
    ...Array.from({ length: 2 }, () => ({ tier: "S", kind: "tail", title: "главный хвост", img: "r:gift-gold", weight: 0.13 })),
    { tier: "S", kind: "vip", title: "blink vip на год", img: "a:market/vip-star.png", weight: 0.02 },
  ].map((p, n) => ({ ...p, n }));

  /** Новый игрок: что уже выпало и сколько попыток сделано. */
  function create() {
    return { attempt: 0, got: [], bStreak: 0, tickets: 0, history: [] };
  }

  const missingA = (st) => PRIZES.filter((p) => p.tier === "A" && !st.got.includes(p.n));
  const missingS = (st) => PRIZES.filter((p) => p.tier === "S" && !st.got.includes(p.n));

  /** Взвешенный выбор: items – [{weight}], r – число [0, 1). */
  function pick(items, r) {
    const total = items.reduce((t, x) => t + x.weight, 0);
    let x = r * total;
    for (const it of items) {
      x -= it.weight;
      if (x < 0) return it;
    }
    return items[items.length - 1];
  }

  /** Веса тиров на этой попытке: доля собранных A и S переходит в B. */
  function tierWeights(st) {
    const A = missingA(st).length ? CONFIG.tiers.A : 0;
    const S = missingS(st).length ? CONFIG.tiers.S : 0;
    return { A, S, B: 100 - A - S };
  }

  /**
   * Одна попытка. rand() → [0, 1). Возвращает результат и меняет st.
   * Сервер делает это в одной транзакции со списанием монеток: повтор запроса с тем же attemptNo
   * возвращает сохранённый результат, а не новый.
   */
  function spin(st, rand = secureRandom) {
    const n = st.attempt + 1;                       // номер попытки, с 1
    const needA = missingA(st);
    const slotsLeft = Math.max(0, CONFIG.attempts - n + 1);   // включая текущую
    let tier;
    let reason = "random";

    // 1–2. Резерв: недостающих A столько же, сколько осталось попыток – S на них не разыгрывается
    if (needA.length && needA.length >= slotsLeft) {
      tier = "A";
      reason = "reserved";
    } else {
      // 3. Случайный тир
      const w = tierWeights(st);
      tier = pick([{ t: "B", weight: w.B }, { t: "A", weight: w.A }, { t: "S", weight: w.S }], rand()).t;
      // 3–4. Мягкая защита A: на 1-й попытке и после 3 B подряд B меняется на A. Случайный S сохраняется
      if (tier === "B" && needA.length && (n === 1 || st.bStreak >= CONFIG.maxBStreak)) {
        tier = "A";
        reason = n === 1 ? "first" : "streak";
      }
    }

    let out;
    if (tier === "A") {
      // внутри A все недостающие равновероятны
      const p = needA[Math.min(needA.length - 1, Math.floor(rand() * needA.length))];
      out = { tier, prize: p };
    } else if (tier === "S") {
      // внутри S – стартовые веса оставшихся, нормированные
      out = { tier, prize: pick(missingS(st), rand()) };
    } else {
      out = { tier, tickets: pick(CONFIG.tickets, rand()).amount };
    }

    st.attempt = n;
    st.bStreak = tier === "B" ? st.bStreak + 1 : 0;
    if (out.prize) st.got.push(out.prize.n);
    if (out.tickets) st.tickets += out.tickets;
    const record = { attempt: n, tier, reason, prize: out.prize ? out.prize.n : null, tickets: out.tickets || 0 };
    st.history.push(record);
    return { ...out, attempt: n, reason };
  }

  /** Случайность по умолчанию – crypto. На проде результат считает сервер. */
  function secureRandom() {
    const n = new Uint32Array(1);
    (globalThis.crypto || require("crypto").webcrypto).getRandomValues(n);
    return n[0] / 4294967296;
  }

  /** Детерминированный генератор для симуляции и стенда. */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Симуляция: users игроков по attempts круток. Возвращает сводку как в разделе 4.4. */
  function simulate(users = 1000, seed = 2026, attempts = CONFIG.attempts) {
    const R = rng(seed);
    let fullA = 0, sAny = 0, vip = 0, lastReserved = 0, bTotal = 0, spins = 0, longB = 0;
    const tickets = [];
    const doneAt = [];
    for (let u = 0; u < users; u++) {
      const st = create();
      let streak = 0, maxStreak = 0, aDone = 0;
      for (let k = 0; k < attempts; k++) {
        const r = spin(st, R);
        spins++;
        if (r.tier === "B") { bTotal++; streak++; maxStreak = Math.max(maxStreak, streak); } else streak = 0;
        if (!aDone && !missingA(st).length) aDone = r.attempt;
        if (r.attempt === attempts && r.reason === "reserved") lastReserved++;
      }
      if (!missingA(st).length) fullA++;
      if (st.got.some((n) => PRIZES[n].tier === "S")) sAny++;
      if (st.got.some((n) => PRIZES[n].kind === "vip")) vip++;
      if (maxStreak >= 4) longB++;
      tickets.push(st.tickets);
      doneAt.push(aDone || attempts + 1);
    }
    tickets.sort((a, b) => a - b);
    doneAt.sort((a, b) => a - b);
    const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * arr.length))];
    return {
      users, attempts, fullA, sAny, vip, lastReserved,
      bShare: bTotal / spins,
      longB,
      ticketsMean: tickets.reduce((t, x) => t + x, 0) / users,
      ticketsMedian: q(tickets, 0.5), ticketsP10: q(tickets, 0.1), ticketsP90: q(tickets, 0.9),
      ticketsMin: tickets[0], ticketsMax: tickets[tickets.length - 1],
      aDoneMedian: q(doneAt, 0.5),
    };
  }

  const API = { CONFIG, PRIZES, create, spin, tierWeights, missingA, missingS, rng, simulate };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.AV_CLAW = API;
})(typeof window !== "undefined" ? window : globalThis);
