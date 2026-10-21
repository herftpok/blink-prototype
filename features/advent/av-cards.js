/*
 * Карточки статистики адвента: одна на день, на весь экран, как сторис.
 * Сверху – что это за день, потом стикер-число и строка под ним, одна строка-сравнение,
 * ниже – картинка-метафора с данными. Запасная карточка (мало данных) – тоже шутка, ей можно поделиться.
 *
 *   AV_CARDS.render(day, ctx)  → HTML карточки (ctx.story – превью сторис 9:16 без кнопок)
 *   AV_CARDS.enter(root)       → появление: число растёт с 1, картинка собирается по очереди
 */
(() => {
  "use strict";

  const tiltOf = (i, k = 8) => (((i * 53) % 13) / 12 - 0.5) * 2 * k;

  /** размер стикер-числа по длине: короткое – крупно, «2 450 000» – помельче, но в ширину экрана */
  function numberSize(text) {
    const len = text.replace(/\s/g, "").length + (text.match(/\s/g) || []).length * 0.4;
    return Math.round(Math.min(92, 330 / (len * 0.68)));
  }

  function numberBlock(value, unit, note, ctx, { prefix = "" } = {}) {
    const text = ctx.fmt(value);
    return `<div class="avc-total">
      <p class="avc-total__number"><span class="sticker-number" data-count="${value}" style="--sticker-size:${numberSize(prefix + text)}px">${prefix}${text}</span></p>
      <p class="avc-total__unit">${unit}</p>
      ${note ? `<p class="avc-total__note">${note}</p>` : ""}
    </div>`;
  }

  const photo = (ctx, who) => (who === "me" ? `${ctx.ASSETS}/people/me-cutout.webp` : ctx.person(who).photo);
  const nameOf = (ctx, who) => (who === "me" ? "ты" : ctx.person(who).name);

  /* ── картинки-метафоры ──────────────────────────────────────────────── */

  const GRAPHICS = {
    // заходы: иконка приложения с розовой звездой-счётчиком
    "app-icon": (g, day, ctx) => `<div class="avc-app">
      <img class="avc-app__icon" src="${ctx.ASSETS}/system/app-icon.png" alt="">
      <span class="badge-star avc-app__badge" aria-hidden="true"><i class="icon icon--badge-star"></i><span class="badge-star__value">2.8k</span></span>
    </div>`,

    // шаги: пьедестал из льда, ты – на своём месте
    podium: (g, day, ctx) => {
      const order = [1, 0, 2];          // второе место слева, первое по центру, третье справа
      return `<div class="avc-podium">${order.map((k) => {
        const r = g.rows[k];
        const me = r.who === "me";
        return `<div class="avc-podium__col avc-podium__col--${k + 1}" style="--i:${k}">
          <span class="avc-podium__face${me ? " is-me" : ""}">
            <img src="${photo(ctx, r.who)}" alt="">
            ${me ? `<span class="avc-me">ты</span>` : ""}
          </span>
          <span class="avc-podium__name">${nameOf(ctx, r.who)}</span>
          <span class="avc-podium__value">${r.value}</span>
          <span class="avc-podium__block"><span class="sticker-number" style="--sticker-size:40px">${k + 1}</span></span>
        </div>`;
      }).join("")}</div>
      <img class="avc-podium__boot" src="${ctx.src(day.obj)}" alt="">`;
    },

    // путь: от санок до луны – пунктир, пройдена восьмидесятая часть
    moon: (g, day, ctx) => `<div class="avc-moon">
      <svg class="avc-moon__path" viewBox="0 0 358 360" aria-hidden="true">
        <path d="M40 330 C 120 300, 210 250, 300 70" pathLength="100" />
        <path class="avc-moon__done" d="M40 330 C 120 300, 210 250, 300 70" pathLength="100" />
      </svg>
      <img class="avc-moon__moon" src="renders/moon.webp" alt="">
      <img class="avc-moon__sled" src="${ctx.src(day.obj)}" alt="">
      <span class="avc-me avc-moon__me">ты здесь</span>
    </div>`,

    // города: гирлянда ёлочных шаров с названиями
    garland: (g, day, ctx) => {
      const balls = ["ornament-earth", "ornament-pink", "ornament-violet"];
      const n = g.cities.length;
      return `<div class="avc-garland${n === 1 ? " avc-garland--one" : ""}">
        <svg class="avc-garland__wire" viewBox="0 0 358 80" preserveAspectRatio="none" aria-hidden="true"><path d="M-10 10 Q 179 90 368 10" /></svg>
        ${g.cities.map((c, i) => {
          const x = n === 1 ? 50 : 13 + (i / (n - 1)) * 74;
          const t = n === 1 ? 0.5 : i / (n - 1);
          const sag = 4 * t * (1 - t);                       // провис провода
          const drop = 20 + sag * 36 + (i % 3) * 66;
          return `<span class="avc-garland__ball" style="--x:${x}%;--drop:${drop}px;--i:${i};--tilt:${tiltOf(i, 10)}deg;z-index:${3 - (i % 3)}">
            <span class="avc-garland__string"></span>
            <img src="renders/${balls[i % 3]}.webp" alt="" style="filter:hue-rotate(${(i * 47) % 360}deg)">
            <span class="avc-garland__tag">${c}</span>
          </span>`;
        }).join("")}
      </div>`;
    },

    // ночлеги, ночной чат: друзья-лица с числами вразнобой
    faces: (g, day, ctx) => `<div class="avc-faces">
      <img class="avc-faces__sticker" src="${ctx.src(day.obj)}" alt="">
      ${g.rows.map((r, i) => `<div class="avc-face avc-face--${i + 1}" style="--i:${i};--tilt:${tiltOf(i + 2, 7)}deg">
        <img class="avc-face__img" src="${photo(ctx, r.who)}" alt="">
        <span class="sticker-number avc-face__value" style="--sticker-size:${30 - i * 3}px">${r.value}</span>
        <span class="avc-face__name">${nameOf(ctx, r.who)}</span>
      </div>`).join("")}
    </div>`,

    // просмотры: кто заходил чаще всех – видно с blink vip
    viewers: (g, day, ctx) => {
      const vip = ctx.S.vip;
      return `<div class="avc-faces avc-faces--viewers${vip ? "" : " is-locked"}">
        <img class="avc-faces__sticker" src="${ctx.src(day.obj)}" alt="">
        ${g.rows.map((r, i) => `<div class="avc-face avc-face--${i + 1}" style="--i:${i};--tilt:${tiltOf(i + 2, 7)}deg">
          <img class="avc-face__img" src="${photo(ctx, r.who)}" alt="">
          ${vip ? `<span class="sticker-number avc-face__value" style="--sticker-size:${30 - i * 3}px">${r.value}</span>
          <span class="avc-face__name">${nameOf(ctx, r.who)}</span>` : ""}
        </div>`).join("")}
        ${vip ? "" : `<div class="avc-vip">
          <img class="avc-vip__star" src="${ctx.ASSETS}/market/vip-star.png" alt="">
          <p class="avc-vip__text">кто заходил чаще всех, видно в blink vip</p>
          <button class="button button--secondary avc-vip__cta pressable" type="button" data-act="vip">blink vip</button>
        </div>`}
      </div>`;
    },

    // сообщения: переписка, которая не помещается в экран
    bubbles: (g, day, ctx) => {
      const lines = [
        ["in", "ты где"], ["out", "уже выхожу"], ["in", "го в кино?"], ["out", "давай!!"], ["in", "😂😂😂"],
        ["out", "скинь гео"], ["in", "я у метро"], ["out", "вижу тебя на карте"], ["in", "с новым годом 🎄"],
      ];
      return `<div class="avc-chat-wrap">
        <div class="avc-chat">
          ${lines.map(([dir, t], i) => `<div class="avc-chat__row avc-chat__row--${dir}" style="--i:${i}"><span class="bubble bubble--${dir}">${t}</span></div>`).join("")}
        </div>
        <img class="avc-chat__letter" src="${ctx.src(day.obj)}" alt="">
      </div>`;
    },

    // голосовые: одно голосовое на 9 часов
    wave: (g, day, ctx) => {
      const bars = Array.from({ length: 30 }, (_, i) => 8 + Math.round(Math.abs(Math.sin(i * 1.7) * 22 + Math.sin(i * 0.45) * 14)));
      return `<div class="avc-voice">
        <img class="avc-voice__mic" src="${ctx.src(day.obj)}" alt="">
        <div class="avc-voice__msg">
          <span class="avc-voice__play"><i class="icon icon--send" aria-hidden="true"></i></span>
          <span class="avc-voice__bars">${bars.map((h, i) => `<i style="--h:${h}px;--i:${i}"></i>`).join("")}</span>
          <span class="avc-voice__time">8:57:12</span>
        </div>
      </div>`;
    },

    // шары: горка ёлочных шаров
    pile: (g, day, ctx) => {
      // горка: внизу широко и крупно, наверху – пара шаров
      const spots = [[-4, 62, 112], [20, 66, 128], [46, 64, 118], [70, 62, 120], [90, 70, 96], [8, 40, 100], [32, 42, 108], [56, 40, 104], [78, 44, 92], [20, 18, 92], [44, 16, 100], [66, 22, 86], [34, -6, 88], [56, -4, 80]];
      const names = ["ornament-pink", "ornament-violet", "ornament-earth"];
      return `<div class="avc-pile">${spots.map(([x, y, s], i) => `<img class="avc-pile__ball" src="renders/${names[i % 3]}.webp" alt="" style="--x:${x}%;--y:${y}%;--s:${s}px;--i:${i};--tilt:${tiltOf(i, 18)}deg;filter:hue-rotate(${(i * 61) % 360}deg)">`).join("")}</div>`;
    },

    // звонки: таймер звонка, который шёл 54 часа
    timer: (g, day, ctx) => `<div class="avc-call">
      <img class="avc-call__bell" src="${ctx.src(day.obj)}" alt="">
      <p class="avc-call__time">${g.text}</p>
      <p class="avc-call__label"><span class="live-dot" aria-hidden="true"></span>на связи</p>
    </div>`,

    // стикеры: тройка любимых с множителями
    stickers: (g, day, ctx) => `<div class="avc-stickers">${g.rows.map((r, i) => `<div class="avc-stickers__item avc-stickers__item--${i + 1}" style="--i:${i};--tilt:${tiltOf(i + 4, 9)}deg">
        <img src="${ctx.src(`s:${r.s}`)}" alt="">
        <span class="sticker-number" style="--sticker-size:${34 - i * 5}px">x${r.value}</span>
      </div>`).join("")}</div>`,

    // друг по переписке: главный друг крупно, двое следом
    top3: (g, day, ctx) => `<div class="avc-top3">${g.rows.map((r, i) => `<div class="avc-top3__item avc-top3__item--${i + 1}" style="--i:${i};--tilt:${tiltOf(i + 1, 6)}deg">
        <img class="avc-top3__img" src="${photo(ctx, r.who)}" alt="">
        <span class="avc-top3__name">${nameOf(ctx, r.who)}</span>
        <span class="sticker-number avc-top3__value" style="--sticker-size:${i ? 22 : 30}px">${r.value}</span>
      </div>`).join("")}
      <img class="avc-top3__sticker" src="${ctx.src(day.obj)}" alt="">
    </div>`,

    // новые друзья: плотная стопка лиц и наклейка «+23»
    crowd: (g, day, ctx) => {
      const faces = [1, 2, 3, 4, 5].map((n) => `${ctx.ASSETS}/people/photo-${n}.webp`)
        .concat(["natashka", "tarakanus", "valentin", "kapibar", "kekova", "masha", "alesya"].map((n) => `${ctx.ASSETS}/people/${n}.webp`));
      const spots = [[6, 40, 74], [24, 16, 86], [44, 36, 96], [66, 14, 80], [78, 44, 74], [14, 66, 70], [36, 70, 80], [58, 64, 84], [80, 72, 66], [2, 10, 58], [92, 22, 54], [50, 4, 58]];
      return `<div class="avc-crowd">${spots.map(([x, y, s], i) => `<img class="avc-crowd__face" src="${faces[i % faces.length]}" alt="" style="--x:${x}%;--y:${y}%;--s:${s}px;--i:${i};--tilt:${tiltOf(i, 12)}deg">`).join("")}
        <span class="sticker-number avc-crowd__plus" style="--sticker-size:56px">+${g.count}</span>
        <img class="avc-crowd__sticker" src="${ctx.src(day.obj)}" alt="">
      </div>`;
    },

    // встречи: ночная карта, на ней друзья – пины с числом встреч
    map: (g, day, ctx) => `<div class="avc-map">
      <img class="avc-map__tiles" src="${ctx.ASSETS}/overnights/map-night.webp" alt="">
      <img class="avc-map__popper" src="${ctx.src(day.obj)}" alt="">
      <div class="avc-map__pins">${g.pins.map((p, i) => window.BlinkPin.markup({
        name: ctx.person(p.who).name, photo: ctx.person(p.who).live, size: p.size, sticker: p.value, unit: "встреч",
        title: p.size === 52 ? ctx.person(p.who).name : undefined,
        tag: "span", assets: ctx.ASSETS, attrs: `style="--x:${p.x};--y:${p.y};--i:${i}"`,
      })).join("")}</div>
    </div>`,

    // тусовка: на ночной карте девять друзей в одной точке
    party: (g, day, ctx) => {
      const ids = ["natashka", "leva", "sonya", "vasya", "masha", "natashka", "leva", "sonya", "vasya"];
      const ring = ids.slice(0, g.count).map((id, i) => {
        const a = (i / g.count) * Math.PI * 2 - Math.PI / 2;
        const r = i === 0 ? 0 : i % 2 ? 22 : 34;
        return { id, x: 50 + Math.cos(a) * r, y: 56 + Math.sin(a) * r * 0.75, size: i === 0 ? 52 : 36 };
      });
      return `<div class="avc-map avc-map--party">
        <img class="avc-map__tiles" src="${ctx.ASSETS}/overnights/map-night.webp" alt="">
        <img class="avc-map__popper" src="${ctx.src(day.obj)}" alt="">
        <div class="avc-map__pins">${ring.map((p, i) => window.BlinkPin.markup({
          name: ctx.person(p.id).name, photo: ctx.person(p.id).live, size: p.size, tag: "span",
          assets: ctx.ASSETS, attrs: `style="--x:${p.x};--y:${p.y};--i:${i}"`,
        })).join("")}</div>
      </div>`;
    },

    // друг года: большое фото-сквиркл с сердцем
    friend: (g, day, ctx) => {
      const p = ctx.person(g.who);
      return `<div class="avc-friend">
        <img class="avc-friend__img" src="${p.photo}" alt="">
        <img class="avc-friend__sticker" src="${ctx.src(day.obj)}" alt="">
        <span class="avc-friend__name">${p.name}</span>
      </div>`;
    },

    // тряхи: снежный шар, который трясут
    shake: (g, day, ctx) => `<div class="avc-shake">
      <img class="avc-shake__globe" src="${ctx.src(day.obj)}" alt="">
      <i class="icon icon--bump avc-shake__bump" aria-hidden="true"></i>
    </div>`,
  };

  /* ── карточки ───────────────────────────────────────────────────────── */

  function render(day, ctx) {
    const head = `<header class="avc-head">
      <span class="avc-head__date">${day.date}</span>
      <span class="avc-head__title">${day.title}</span>
    </header>`;
    const logo = ctx.story ? `<img class="avc-logo" src="${ctx.ASSETS}/brand/logo.png" alt="blink">` : "";

    if (day.prediction) {
      // печенье с предсказанием: целое → «разломить» → половинки в стороны, выезжает бумажка
      const i = ctx.D.DAYS.indexOf(day);
      const cracked = ctx.story || ctx.S.days[i]?.cracked;
      const c = day.cookie;
      return `<article class="avc avc--prediction${cracked ? " is-cracked" : ""}${ctx.story ? " avc--story" : ""}" aria-labelledby="stat-title">
        <img class="avc__glow" src="${ctx.src(day.obj)}" alt="">
        ${logo}${head}
        <h1 class="visually-hidden" id="stat-title">предсказание на 2027</h1>
        <button class="avc-cookie pressable" type="button" data-act="crack" aria-label="разломить печенье" ${cracked ? "disabled" : ""}>
          <img class="avc-cookie__whole" src="renders/${c}.webp" alt="">
          <img class="avc-cookie__half avc-cookie__half--left" src="renders/${c}-left.webp" alt="">
          <img class="avc-cookie__half avc-cookie__half--right" src="renders/${c}-right.webp" alt="">
          ${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<span class="avc-crumb" style="--k:${k}"></span>`).join("")}
        </button>
        <div class="avc-paper" aria-live="polite">
          <p class="avc-paper__kicker">в 2027</p>
          <p class="avc-paper__text">${day.prediction}</p>
        </div>
      </article>`;
    }

    const empty = ctx.S.empty;
    const st = empty ? day.empty : day.stat;
    let body = "";
    if (empty && st.title) {
      body = `<div class="avc-empty">
        <img class="avc-empty__sticker" src="${ctx.src(st.sticker)}" alt="">
        <h1 class="avc-empty__title" id="stat-title">${st.title}</h1>
        <p class="avc-empty__note">${st.note}</p>
      </div>`;
    } else {
      const g = st.graphic;
      body = `${numberBlock(st.number, st.unit, st.note, ctx)}
        <h1 class="visually-hidden" id="stat-title">${day.title}</h1>
        ${g ? `<div class="avc-graphic avc-graphic--${g.kind}">${GRAPHICS[g.kind](g, day, ctx)}</div>` : `<img class="avc-empty__sticker avc-empty__sticker--low" src="${ctx.src(st.sticker)}" alt="">`}`;
    }
    return `<article class="avc${ctx.story ? " avc--story" : ""}${empty ? " avc--empty" : ""}" aria-labelledby="stat-title">
      <img class="avc__glow" src="${ctx.src(day.obj === "fan" ? "s:fire" : day.obj)}" alt="">
      ${logo}${head}${body}
    </article>`;
  }

  /** Появление: число растёт с 1 до итога за ~0.9 s, картинка – по очереди */
  function enter(root) {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.querySelector(".avc")?.classList.add("is-in");
    if (reduced) return;
    root.querySelectorAll("[data-count]").forEach((el) => {
      const target = Number(el.dataset.count);
      const text = el.textContent;
      const t0 = performance.now();
      const dur = 900;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const v = Math.max(1, Math.round(target * (1 - Math.pow(1 - k, 3))));
        el.textContent = k < 1 ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, String.fromCharCode(160)) : text;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  /** Разломить печенье: дрожит, трескается, половинки разлетаются, бумажка разворачивается */
  function crack(root, onDone) {
    const card = root.querySelector(".avc--prediction");
    if (!card || card.classList.contains("is-cracked") || card.classList.contains("is-cracking")) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.classList.add("is-cracking");
    setTimeout(() => {
      card.classList.remove("is-cracking");
      card.classList.add("is-cracked", "is-breaking");
      card.querySelector(".avc-cookie").disabled = true;
      onDone?.();
    }, reduced ? 0 : 520);
  }

  window.AV_CARDS = { render, enter, crack };
})();
