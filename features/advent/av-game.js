/*
 * Цу-е-фа – «камень, ножницы, бумага» на ставку с другом – и большой розыгрыш.
 *
 * Выбираешь ставку (30 / 100 / 300 / 500 снежинок), друг ставит столько же. Партия до двух побед:
 * руки в вязаных перчатках трясутся под «камень… ножницы… бумага… цу-е-фа!» и показывают жест.
 * Камень тупит ножницы, ножницы режут бумагу, бумага накрывает камень; одинаково – переигрываем.
 * Друг делает свои ходы, когда принимает вызов (на стенде – случайно). Победа – банк (обе ставки)
 * и подарок с ёлки из твоего пула (25 штук без повторов): чем больше ставка, тем чаще редкие и лучше
 * (ECONOMY.odds). Проигрыш – ставка уходит другу, утешение – билеты в розыгрыш по размеру ставки.
 * Обыграл пятерых разных друзей – золотая звезда, рамка пина: больше её никак не получить.
 *
 * Розыгрыш: шар на каждый приз, билеты кладёшь в любой, они остаются там до розыгрыша.
 */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NBSP = String.fromCharCode(160);
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ORDER = ["common", "rare", "epic", "legend"];

  // Жесты: кто кого бьёт и как это назвать
  const MOVES = ["rock", "scissors", "paper"];
  const MOVE = {
    rock: { label: "камень", beats: "scissors", verb: "камень тупит ножницы" },
    scissors: { label: "ножницы", beats: "paper", verb: "ножницы режут бумагу" },
    paper: { label: "бумага", beats: "rock", verb: "бумага накрывает камень" },
  };
  const CHANT = ["камень", "ножницы", "бумага", "цу-е-фа!"];
  const BEAT_MS = 360;

  let view = "lobby";        // lobby | duel | result
  let duel = null;           // текущий бой
  let timers = [];
  let raf = 0;

  const later = (ms, fn) => { timers.push(setTimeout(fn, reduced() ? 0 : ms)); };
  const leftOf = (ctx, tier) => ctx.D.POOL.filter((p) => p.tier === tier && !ctx.S.taken.includes(p.id)).length;
  const poolLeft = (ctx) => ctx.D.POOL.length - ctx.S.taken.length;
  const person = (ctx, id) => ({ ...ctx.D.PEOPLE[id], id, photo: `../../assets/people/photo-${ctx.D.PEOPLE[id].n}.webp` });
  const rival = (ctx, id) => ctx.D.RIVALS.find((r) => r.who === id);

  /** Вес уровня подарка при ставке */
  const weightOf = (ctx, tier, stake) => (ctx.D.ECONOMY.odds[stake] || ctx.D.ECONOMY.odds[ctx.D.ECONOMY.stake])[ORDER.indexOf(tier)];

  /** Шансы уровней при ставке – по тому, что ещё висит на ёлке; в процентах, целыми */
  function oddsAt(ctx, stake) {
    const w = ORDER.map((t) => leftOf(ctx, t) * weightOf(ctx, t, stake));
    const total = w.reduce((a, b) => a + b, 0) || 1;
    return ORDER.map((t, k) => ({ tier: t, pct: Math.round((w[k] / total) * 100), left: leftOf(ctx, t) }));
  }

  /** Подарок с ёлки: из оставшихся, вес уровня от ставки; после трёх обычных подряд – редкий или лучше */
  function pickPrize(ctx, R = Math.random, stake = ctx.D.ECONOMY.stake) {
    const { S, D } = ctx;
    const left = D.POOL.filter((p) => !S.taken.includes(p.id));
    if (!left.length) return null;
    const noCommon = S.streak >= D.ECONOMY.commonStreak;
    const cand = noCommon && left.some((p) => p.tier !== "common") ? left.filter((p) => p.tier !== "common") : left;
    const total = cand.reduce((s, p) => s + weightOf(ctx, p.tier, stake), 0);
    let r = R() * total;
    for (const p of cand) {
      r -= weightOf(ctx, p.tier, stake);
      if (r <= 0) return p;
    }
    return cand[cand.length - 1];
  }

  /** Забрать подарок с ёлки (победа) */
  function takePrize(ctx, R, stake) {
    const { S } = ctx;
    const p = pickPrize(ctx, R, stake);
    if (!p) return null;
    S.taken.push(p.id);
    S.streak = p.tier === "common" ? S.streak + 1 : 0;
    return p;
  }

  const ticketsFor = (ctx, stake) => Math.max(1, Math.round(stake / ctx.D.ECONOMY.ticketsPer));

  /** Итог боя: ставка уже списана при вызове. Победа – банк (×2) и подарок, ничья – ставка назад */
  function settle(ctx, who, mine, theirs, R, stake = ctx.D.ECONOMY.stake) {
    const { S, D } = ctx;
    if (mine > theirs) {
      S.balance += stake * 2;
      if (!S.beaten.includes(who)) S.beaten.push(who);
      if (S.beaten.length >= D.ECONOMY.starFriends) S.star = true;
      return { result: "win", prize: takePrize(ctx, R, stake), won: stake * 2, tickets: 0 };
    }
    if (mine === theirs) {
      S.balance += stake;
      S.tickets += D.ECONOMY.ticketsDraw;
      return { result: "draw", prize: null, won: 0, tickets: D.ECONOMY.ticketsDraw };
    }
    const t = ticketsFor(ctx, stake);
    S.tickets += t;
    return { result: "lose", prize: null, won: 0, tickets: t };
  }

  /** Бой целиком без анимации (предустановки стенда): списать ставку и подвести итог */
  function resolve(ctx, who, mine, theirs, stake = ctx.D.ECONOMY.stake, R) {
    ctx.S.balance -= stake;
    return settle(ctx, who, mine, theirs, R, stake);
  }

  function stopAll() {
    timers.forEach(clearTimeout);
    timers = [];
    cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ── экран: лобби, партия, итог ────────────────────────────────────── */

  function render(el, ctx) {
    stopAll();
    if (view === "duel" && duel) return renderDuel(el, ctx);
    if (view === "result" && duel) return renderResult(el, ctx);
    view = "lobby";
    return renderLobby(el, ctx);
  }

  function renderLobby(el, ctx) {
    const { S, D } = ctx;
    const slots = Array.from({ length: D.ECONOMY.starFriends }, (_, k) => {
      const id = S.beaten[k];
      return id
        ? `<img class="avsn-goal__face" src="${person(ctx, id).photo}" alt="${person(ctx, id).name}">`
        : `<span class="avsn-goal__slot" aria-hidden="true"><img src="renders/hand-rock.webp" alt=""></span>`;
    }).join("");
    // вызов от друга показываем, пока на ёлке есть что выиграть
    const incoming = poolLeft(ctx) ? D.RIVALS.find((r) => r.challenge && !S.beaten.includes(r.who)) : null;
    const stake = S.stake;
    const canStake = S.balance >= stake && poolLeft(ctx) > 0;
    el.innerHTML = `
      <div class="avsn-lobby">
        <section class="avsn-goal" aria-label="золотая звезда: обыграно ${S.beaten.length} из ${D.ECONOMY.starFriends} друзей">
          <img class="avsn-goal__star${S.star ? " is-done" : ""}" src="renders/star-frame.webp" alt="">
          <div class="avsn-goal__text">
            <p class="avsn-goal__title">${S.star ? "золотая звезда твоя" : "обыграй пятерых друзей"}</p>
            <p class="avsn-goal__slots">${slots}</p>
          </div>
        </section>
        ${incoming ? `<section class="avsn-call" aria-label="вызов">
          <img class="avsn-call__face" src="${person(ctx, incoming.who).photo}" alt="">
          <img class="avsn-call__ball" src="renders/hand-scissors-blue.webp" alt="">
          <p class="avsn-call__text"><b>${person(ctx, incoming.who).name}</b> ставит <span class="avsn-call__stake"><img src="renders/snowflake.webp" alt="">${incoming.challenge}</span></p>
          <button class="avsn-call__cta pressable" type="button" data-duel="${incoming.who}" data-stake="${incoming.challenge}" ${S.balance < incoming.challenge ? "disabled" : ""}>принять</button>
        </section>` : ""}
        ${poolLeft(ctx) ? betMarkup(ctx) : `<div class="avsn-empty">
          <p class="avsn-empty__title">с ёлки снято всё</p>
          <button class="button button--primary avsn-cta pressable" type="button" data-game="exchange" ${S.balance < D.ECONOMY.exchange * 2 ? "disabled" : ""}>обменять ${D.ECONOMY.exchange * 2} на 2 билета</button>
        </div>`}
        <h3 class="avsn-head"><span>кого вызвать</span></h3>
        <ul class="avsn-rows">${D.RIVALS.filter((r) => r !== incoming).map((r) => {
          const p = person(ctx, r.who);
          const won = S.beaten.includes(r.who);
          return `<li class="avsn-row">
            <span class="avsn-row__photo${r.online ? " is-online" : ""}"><img src="${p.photo}" alt=""></span>
            <span class="avsn-row__body"><span class="avsn-row__name">${p.name}</span>
              <span class="avsn-row__status">${won ? "уже обыграно" : r.status}</span></span>
            <button class="avsn-row__cta pressable" type="button" data-duel="${r.who}" aria-label="вызвать ${p.name} в цу-е-фа, ставка ${stake}" ${canStake ? "" : "disabled"}>вызвать</button>
          </li>`;
        }).join("")}</ul>
        <button class="avs-left pressable" type="button" data-game="pool" aria-label="подарки на ёлке: осталось ${poolLeft(ctx)} из ${D.POOL.length}">
          <img class="avs-left__tree" src="renders/xmas-tree.webp" alt="">
          ${ORDER.map((t) => `<span class="avs-left__tier${leftOf(ctx, t) ? "" : " is-out"}"><img src="renders/${D.TIERS[t].gift}.webp" alt="">${leftOf(ctx, t)}</span>`).join("")}
          <i class="icon icon--chevron" aria-hidden="true"></i>
        </button>
      </div>`;
  }

  /** Ставка: плитки, выигрыш (банк) и шансы подарка с ёлки при этой ставке */
  function betMarkup(ctx) {
    const { S, D } = ctx;
    const odds = oddsAt(ctx, S.stake);
    return `<section class="avsn-bet" aria-labelledby="bet-title">
      <h3 class="avsn-head" id="bet-title"><span>ставка</span>${S.balance < D.ECONOMY.stakes[0]
        ? `<button class="avsn-head__link pressable" type="button" data-game="earn">заработать снежинки</button>` : ""}</h3>
      <div class="choice-tiles avsn-bet__tiles" role="radiogroup" aria-labelledby="bet-title" style="--choice-count:${D.ECONOMY.stakes.length}">
        ${D.ECONOMY.stakes.map((v) => `<button class="choice-tile pressable" type="button" role="radio" data-stake-pick="${v}"
            aria-checked="${v === S.stake}" ${S.balance < v ? "disabled" : ""}>
          <span class="choice-tile__value"><img class="avsn-bet__flake" src="renders/snowflake.webp" alt="">${v}</span>
        </button>`).join("")}
      </div>
      <div class="avsn-win">
        <span class="avsn-win__label">выигрыш</span>
        <span class="avsn-win__value"><img src="renders/snowflake.webp" alt="снежинок">${S.stake * 2}</span>
        <span class="avsn-win__plus">и подарок с ёлки</span>
        <ul class="avsn-odds" aria-label="шансы подарка">${odds.map((o) => `<li class="avsn-odds__tier${o.left ? "" : " is-out"}">
          <img src="renders/${D.TIERS[o.tier].gift}.webp" alt="${D.TIERS[o.tier].label}"><span>${o.pct}${NBSP}%</span></li>`).join("")}</ul>
      </div>
    </section>`;
  }

  /* ── партия ─────────────────────────────────────────────────────────── */

  function startDuel(ctx, who, stake = ctx.S.stake) {
    const { S } = ctx;
    if (!poolLeft(ctx)) return;
    if (S.balance < stake) return ctx.toTasks();
    S.balance -= stake;
    ctx.renderBalance();
    duel = { who, stake, me: 0, them: 0, round: 1, busy: false, last: null };
    view = "duel";
    render($("#game"), ctx);
  }

  const handSrc = (move, mine) => `renders/hand-${move}${mine ? "" : "-blue"}.webp`;
  const pips = (n) => Array.from({ length: 2 }, (_, k) => `<i class="avsn-pip${k < n ? " is-on" : ""}"></i>`).join("");

  function renderDuel(el, ctx) {
    const p = person(ctx, duel.who);
    const l = duel.last;
    el.innerHTML = `
      <div class="avsn-duel" id="duel">
        <div class="avsn-score">
          <span class="avsn-score__side">
            <img class="avsn-score__me" src="../../assets/people/me-cutout.webp" alt="">
            <span class="avsn-score__pips" id="pips-me" aria-label="твоих побед: ${duel.me}">${pips(duel.me)}</span>
          </span>
          <span class="avsn-score__pot" aria-label="банк ${duel.stake * 2}"><span class="avsn-score__label">банк</span><img src="renders/snowflake.webp" alt="">${duel.stake * 2}</span>
          <span class="avsn-score__side">
            <span class="avsn-score__pips" id="pips-them" aria-label="побед ${p.gen}: ${duel.them}">${pips(duel.them)}</span>
            <img class="avsn-score__face" src="${p.photo}" alt="">
          </span>
        </div>
        <div class="avsn-ring">
          <img class="avsn-hand avsn-hand--them${l ? ` is-${l.out === "lose" ? "win" : l.out === "win" ? "lose" : "draw"}` : ""}" id="hand-them" src="${handSrc(l ? l.them : "rock", false)}" alt="">
          <p class="avsn-chant" id="chant" aria-live="polite">${l ? l.text : `раунд ${duel.round}`}</p>
          <img class="avsn-hand avsn-hand--me${l ? ` is-${l.out}` : ""}" id="hand-me" src="${handSrc(l ? l.me : "rock", true)}" alt="">
        </div>
        <div class="avsn-moves" role="group" aria-label="твой ход">
          ${MOVES.map((m) => `<button class="avsn-move pressable" type="button" data-move="${m}">
            <img src="${handSrc(m, true)}" alt=""><span>${MOVE[m].label}</span>
          </button>`).join("")}
        </div>
      </div>`;
  }

  /** Ход друга: на стенде случайно (в продукте друг делает ходы, когда принимает вызов) */
  const theirMove = () => MOVES[Math.floor(Math.random() * 3)];

  const outcome = (me, them) => (me === them ? "draw" : MOVE[me].beats === them ? "win" : "lose");

  /** Раунд: руки трясутся под «камень… ножницы… бумага… цу-е-фа!», потом показывают жесты */
  function playRound(ctx, me, them = theirMove(), { instant = false } = {}) {
    if (!duel || duel.busy || view !== "duel") return;
    duel.busy = true;
    $$(".avsn-move").forEach((b) => { b.disabled = true; b.classList.toggle("is-picked", b.dataset.move === me); });
    const hm = $("#hand-me");
    const ht = $("#hand-them");
    const chant = $("#chant");
    [hm, ht].forEach((h) => { h.className = h.className.replace(/ is-(win|lose|draw)/g, ""); });
    hm.src = handSrc("rock", true);
    ht.src = handSrc("rock", false);
    const reveal = () => {
      const out = outcome(me, them);
      hm.src = handSrc(me, true);
      ht.src = handSrc(them, false);
      hm.classList.remove("is-shaking");
      ht.classList.remove("is-shaking");
      if (out === "win") duel.me += 1;
      if (out === "lose") duel.them += 1;
      const p = person(ctx, duel.who);
      const text = out === "draw" ? "ничья – ещё раз" : out === "win" ? `${MOVE[me].verb} – раунд твой` : `${MOVE[them].verb} – раунд ${p.gen}`;
      duel.last = { me, them, out, text };
      chant.textContent = text;
      hm.classList.add(`is-${out}`);
      ht.classList.add(`is-${out === "win" ? "lose" : out === "lose" ? "win" : "draw"}`);
      $("#pips-me").innerHTML = pips(duel.me);
      $("#pips-them").innerHTML = pips(duel.them);
      later(1300, () => {
        duel.busy = false;
        if (duel.me >= 2 || duel.them >= 2) return finishDuel(ctx);
        if (out !== "draw") duel.round += 1;
        $$(".avsn-move").forEach((b) => { b.disabled = false; b.classList.remove("is-picked"); });
      });
    };
    if (instant || reduced()) return reveal();
    hm.classList.add("is-shaking");
    ht.classList.add("is-shaking");
    CHANT.forEach((w, k) => later(k * BEAT_MS, () => { chant.textContent = w; }));
    later(CHANT.length * BEAT_MS, reveal);
  }

  function finishDuel(ctx) {
    if (!duel) return;
    const out = settle(ctx, duel.who, duel.me, duel.them, undefined, duel.stake);
    duel.result = out.result;
    duel.prize = out.prize;
    duel.won = out.won;
    duel.tickets = out.tickets;
    duel.newStar = out.result === "win" && ctx.S.beaten.length === ctx.D.ECONOMY.starFriends && !duel.starShown;
    view = "result";
    render($("#game"), ctx);
    payout(ctx);
  }

  /* ── итог ───────────────────────────────────────────────────────────── */

  function renderResult(el, ctx) {
    const { S, D } = ctx;
    const p = person(ctx, duel.who);
    const win = duel.result === "win";
    const head = win ? "победа!" : `победа у${NBSP}${p.gen}`;
    const sum = win ? `+${duel.stake * 2}` : `−${duel.stake}`;
    const tickets = duel.tickets ?? ticketsFor(ctx, duel.stake);
    const prize = duel.prize;
    el.innerHTML = `
      <div class="avsn-result is-${duel.result}">
        <div class="avsn-vs">
          <span class="avsn-vs__side${win ? " is-winner" : ""}">
            <img class="avsn-vs__me" src="../../assets/people/me-cutout.webp" alt="">
            <span class="sticker-number avsn-vs__score">${duel.me}</span>
            <span class="avsn-vs__name">ты</span>
          </span>
          <img class="avsn-vs__ball" src="renders/hand-${win ? "paper" : "rock"}.webp" alt="">
          <span class="avsn-vs__side${win ? "" : " is-winner"}">
            <img class="avsn-vs__face" src="${p.photo}" alt="">
            <span class="sticker-number avsn-vs__score">${duel.them}</span>
            <span class="avsn-vs__name">${p.name}</span>
          </span>
        </div>
        <h2 class="avsn-result__title" id="result-title">${head}</h2>
        <p class="avsn-sum is-${duel.result}" id="result-sum"><img src="renders/snowflake.webp" alt="снежинок"><span class="sticker-number">${sum}</span></p>
        ${win && prize ? `<div class="avsn-gift">
            <img class="avsn-gift__glow" src="${ctx.src(prize.img)}" alt="">
            <img class="avsn-gift__img" src="${ctx.src(prize.img)}" alt="">
            <span class="avg-tier avg-tier--${prize.tier}">${D.TIERS[prize.tier].label}</span>
            <p class="avsn-gift__title">${prize.title}</p>
            <p class="avsn-gift__kind">${prize.kind}</p>
          </div>`
          : `<p class="avsn-result__line"><img src="renders/ticket.webp" alt="">+${tickets}${NBSP}${ctx.plural(tickets, "билет", "билета", "билетов")} в${NBSP}розыгрыш</p>`}
        <div class="avsn-result__actions">
          ${win
            ? (duel.newStar && !duel.starShown
              ? `<button class="button button--primary avsn-cta pressable" type="button" data-game="show-star">забрать звезду</button>`
              : `<button class="button button--primary avsn-cta pressable" type="button" data-game="lobby">ещё партия</button>`)
            : `<button class="button button--primary avsn-cta pressable" type="button" data-duel="${duel.who}" data-stake="${duel.stake}" ${S.balance < duel.stake ? "disabled" : ""}>реванш<span class="avs-cta__price"><img src="renders/snowflake.webp" alt="снежинок">${duel.stake}</span></button>
               <button class="button button--ghost avsn-cta pressable" type="button" data-game="lobby">к друзьям</button>`}
        </div>
      </div>`;
  }

  /** Выигрыш летит снежинками в баланс шапки, конфетти; проигрыш – сумма приглушена */
  function payout(ctx) {
    const sum = $("#result-sum");
    const bal = $(".av-balance", $("#screen-game"));
    if (duel.result === "win") {
      ctx.app.dispatchEvent(new CustomEvent("av:confetti"));
      ctx.flyFlakes(sum, bal, 8).then(() => {
        ctx.renderBalance();
        bal?.classList.remove("is-bump");
        void bal?.offsetWidth;
        bal?.classList.add("is-bump");
      });
    } else {
      ctx.renderBalance();
    }
  }

  /* ── шторки: подарок с ёлки и звезда ────────────────────────────────── */

  const tierChip = (ctx, tier) => `<span class="avg-tier avg-tier--${tier}">${ctx.D.TIERS[tier].label}</span>`;

  function prizeMarkup(prize, extra, ctx) {
    const { S, D } = ctx;
    if (extra.star) {
      return `<div class="avg-prize" data-star>
        <div class="avg-prize__art">
          <img class="avg-prize__glow" src="${ctx.src(D.STAR.img)}" alt="">
          <img class="avg-prize__img" src="${ctx.src(D.STAR.img)}" alt="">
        </div>
        <span class="avg-tier avg-tier--legend">пятеро друзей обыграно</span>
        <h2 class="avg-prize__title" id="prize-title">золотая звезда твоя</h2>
        <p class="avg-prize__kind">рамка пина – её увидят друзья на карте</p>
        <button class="button button--primary avg-prize__cta pressable" type="button" data-game="star">надеть на пин</button>
      </div>`;
    }
    return "";
  }

  function prizeEnter(prize, extra, ctx) {
    if (!reduced() && (extra.star || prize.tier !== "common")) ctx.app.dispatchEvent(new CustomEvent("av:confetti"));
  }

  function afterPrize(ctx) {
    if (window.AV.current() !== "game") return;
    if (view === "result" && duel?.starShown) {
      view = "lobby";
      duel = null;
    }
    render($("#game"), ctx);
  }

  /** Сброс: бой и таймеры не переезжают в другое состояние стенда */
  function cancel() {
    stopAll();
    view = "lobby";
    duel = null;
  }

  /* ── шторка «подарки на ёлке» ───────────────────────────────────────── */

  function renderPool(el, ctx) {
    const { S, D } = ctx;
    el.innerHTML = `
      <div class="avg-star">
        <img class="avg-star__img" src="renders/star-frame.webp" alt="">
        <div class="avg-star__text">
          <p class="avg-star__title">${S.star ? "золотая звезда твоя" : `${D.STAR.title} · ${S.beaten.length} из ${D.ECONOMY.starFriends}`}</p>
          <p class="avg-star__kind">${D.STAR.kind}</p>
        </div>
      </div>
      ${["legend", "epic", "rare", "common"].map((t) => {
        const items = D.POOL.filter((p) => p.tier === t);
        return `<section class="avg-pool__tier">
          <h3 class="avg-pool__head">${tierChip(ctx, t)}<span class="avg-pool__count">${leftOf(ctx, t)} из ${items.length}</span></h3>
          <ul class="avg-pool__grid">${items.map((p) => {
            const got = S.taken.includes(p.id);
            return `<li class="avg-item${got ? " is-got" : ""}">
              <img class="avg-item__img" src="${ctx.src(p.img)}" alt="">
              <span class="avg-item__title">${p.title}</span>
              ${got ? `<span class="avg-item__got"><i class="icon icon--check" aria-hidden="true"></i>твоё</span>` : ""}
            </li>`;
          }).join("")}</ul>
        </section>`;
      }).join("")}
      <p class="avg-pool__social">золотую звезду уже собрали ${ctx.fmt(D.starCollectors)}${NBSP}человек</p>`;
  }

  /* ── большой розыгрыш ───────────────────────────────────────────────── */

  let drawIndex = 1;
  let drawCount = 3;

  function renderDraw(el, ctx) {
    const { S, D } = ctx;
    const slides = D.DRAW.prizes.map((p, i) => {
      const mine = S.draw[p.id] || 0;
      return `<article class="avd-slide" data-prize="${i}" aria-label="${p.title}">
        <div class="avd-globe">
          <img class="avd-globe__back" src="renders/globe-back.webp" alt="">
          <img class="avd-globe__prize" src="${ctx.src(p.img)}" alt="">
          <img class="avd-globe__glass" src="renders/globe-glass.webp" alt="">
          ${mine ? `<span class="avd-globe__mine"><img src="renders/ticket.webp" alt="твоих билетов">${mine}</span>` : ""}
        </div>
      </article>`;
    }).join("");
    el.innerHTML = `
      <div class="avd-carousel" id="draw-carousel">${slides}</div>
      <div class="avd-info" id="draw-info"></div>`;
    const car = $("#draw-carousel", el);
    requestAnimationFrame(() => {
      const slide = car.children[drawIndex];
      if (slide) car.scrollLeft = slide.offsetLeft - (car.offsetWidth - slide.offsetWidth) / 2;
      renderDrawInfo(el, ctx);
    });
    let tm = 0;
    car.addEventListener("scroll", () => {
      clearTimeout(tm);
      tm = setTimeout(() => {
        const mid = car.scrollLeft + car.offsetWidth / 2;
        const dist = (c) => Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
        const best = [...car.children].reduce((b, c, i) => (dist(c) < dist(car.children[b]) ? i : b), 0);
        if (best !== drawIndex) {
          drawIndex = best;
          drawCount = Math.min(3, S.tickets) || 1;
          renderDrawInfo(el, ctx);
        }
      }, 90);
    });
  }

  /** Под шаром – только приз, когда розыгрыш, твой шанс и сколько билетов положить */
  function renderDrawInfo(root, ctx) {
    const { S, D } = ctx;
    const p = D.DRAW.prizes[drawIndex];
    const mine = S.draw[p.id] || 0;
    drawCount = Math.max(1, Math.min(drawCount, S.tickets || 1));
    const chance = mine
      ? `твой шанс – 1 из ${Math.max(1, Math.round((p.total + mine) / mine)).toLocaleString("ru-RU").replace(/\s/g, NBSP)}`
      : "";
    $("#draw-info", root).innerHTML = `
      <span class="avd-info__until">до 10.01</span>
      <h3 class="avd-info__title">${p.title}</h3>
      <p class="avd-info__when">${D.DRAW.when}</p>
      ${chance ? `<p class="avd-info__chance">${chance}</p>` : ""}
      ${S.tickets > 0 ? `<div class="avd-put">
          <button class="icon-button avd-step pressable" type="button" data-draw="minus" aria-label="меньше" ${drawCount <= 1 ? "disabled" : ""}><span aria-hidden="true">−</span></button>
          <span class="avd-put__count" aria-live="polite">${drawCount}</span>
          <button class="icon-button avd-step pressable" type="button" data-draw="plus" aria-label="больше" ${drawCount >= S.tickets ? "disabled" : ""}><i class="icon icon--plus" aria-hidden="true"></i></button>
        </div>
        <button class="button button--primary avd-cta pressable" type="button" data-draw="put">положить ${drawCount}${NBSP}${ctx.plural(drawCount, "билет", "билета", "билетов")}</button>`
        : `<button class="button button--primary avd-cta pressable" type="button" data-draw="earn">заработать билеты в цу-е-фа</button>`}`;
  }

  function putTickets(ctx) {
    const { S, D } = ctx;
    const p = D.DRAW.prizes[drawIndex];
    const n = Math.min(drawCount, S.tickets);
    if (!n) return;
    const from = $("[data-draw='put']");
    const slide = $(`.avd-slide[data-prize="${drawIndex}"] .avd-globe`);
    S.tickets -= n;
    S.draw[p.id] = (S.draw[p.id] || 0) + n;
    ctx.renderBalance();
    ctx.flyFlakes(from, slide, Math.min(6, n + 1), "renders/ticket.webp", 34).then(() => {
      renderDraw($("#draw"), ctx);
      $(`.avd-slide[data-prize="${drawIndex}"] .avd-globe`)?.classList.add("is-shaken");
    });
    ctx.announce(`${n} в шаре «${p.title}»`);
  }

  /* ── нажатия ────────────────────────────────────────────────────────── */

  function click(t, ctx) {
    if (t.dataset.move) return playRound(ctx, t.dataset.move);
    if (t.dataset.stakePick) {
      ctx.S.stake = Number(t.dataset.stakePick);
      render($("#game"), ctx);
      $(`[data-stake-pick="${ctx.S.stake}"]`)?.focus({ preventScroll: true });
      return undefined;
    }
    if (t.dataset.duel) {
      window.AV.closeSheet(true);
      return startDuel(ctx, t.dataset.duel, t.dataset.stake ? Number(t.dataset.stake) : ctx.S.stake);
    }
    switch (t.dataset.game) {
      case "lobby":
        window.AV.closeSheet(true);
        view = "lobby";
        duel = null;
        return render($("#game"), ctx);
      case "show-star":
        duel.starShown = true;
        return ctx.openPrize({ ...ctx.D.STAR, tier: "legend" }, { star: true });
      case "pool": return ctx.openPool();
      case "earn":
        window.AV.closeSheet(true);
        return ctx.toTasks();
      case "exchange":
        ctx.S.balance -= ctx.D.ECONOMY.exchange * 2;
        ctx.S.tickets += 2;
        ctx.renderBalance();
        return render($("#game"), ctx);
      case "star":
        window.AV.closeSheet();
        return undefined;
      default:
    }
    switch (t.dataset.draw) {
      case "minus": drawCount = Math.max(1, drawCount - 1); return renderDrawInfo($("#draw"), ctx);
      case "plus": drawCount = Math.min(ctx.S.tickets, drawCount + 1); return renderDrawInfo($("#draw"), ctx);
      case "put": return putTickets(ctx);
      case "earn": return ctx.toTree();
      default:
    }
    return undefined;
  }

  /** Для снимков и проверок: открыть экран в нужном виде без анимаций */
  function setView(ctx, v, opts = {}) {
    stopAll();
    view = v;
    duel = v === "lobby" ? null : { who: "natashka", stake: ctx.S.stake, me: 0, them: 0, round: 1, busy: false, last: null, ...opts };
    render($("#game"), ctx);
  }

  const state = () => ({ view, duel });

  window.AV_GAME = {
    render, renderDraw, renderPool, prizeMarkup, prizeEnter, afterPrize, click, cancel,
    pickPrize, takePrize, settle, resolve, oddsAt, setView, playRound, finishDuel, outcome, state, MOVES,
  };
})();
