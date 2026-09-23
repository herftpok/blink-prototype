/*
 * Blink – прототип: навигация и поведение.
 *
 * Навигация:
 *   #/map  #/friends  #/chats  #/checkins  #/profile  – табы (таб-бар внизу)
 *   #/chat/<id>                                      – чат поверх табов (въезжает справа)
 * Назад из чата: кнопка „назад“, Esc, свайп от левого края.
 *
 * Правила прототипа (см. CLAUDE.md): никаких тостов и заглушек-алертов.
 * Кнопка либо ведёт на экран, либо меняет состояние на месте, либо только
 * отвечает на нажатие, если её экрана нет в прототипе.
 */
(() => {
  "use strict";

  const data = window.BLINK_DATA;
  const app = document.getElementById("app");
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  /* ── утилиты ─────────────────────────────────────────────────────────── */

  const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  /** 1 друг / 2 друга / 5 друзей */
  const plural = (n, [one, few, many]) => {
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  const icon = (name, extra = "") => `<i class="icon icon--${name} ${extra}" aria-hidden="true"></i>`;

  const stickerNumber = (value, extra = "") =>
    `<span class="sticker-number ${extra}">${escapeHtml(value)}</span>`;

  const chatById = (id) => data.chats.find((chat) => chat.id === id);

  /** 0.85 → „850 м“, 2.3 → „2.3 км“: как в приложении, дробь через точку */
  const formatDistance = (km) => (km < 1 ? `${Math.round(km * 1000)} м` : `${km} км`);

  const friendAvatar = (id) => {
    const f = data.friends.find((friend) => friend.id === id);
    return f ? f.photo || f.cutout : null;
  };

  /** Чат с человеком, у которого ещё нет переписки (друг с карты или из списка) */
  const ensureChat = (id) => {
    let chat = chatById(id);
    if (chat) return chat;
    const person = data.mapFriends.find((p) => p.id === id) || data.friends.find((f) => f.id === id);
    if (!person) return null;
    // у друга с карты для шапки чата берём фото из списка друзей: живая аватарка – для пина
    const friend = data.friends.find((f) => f.id === id);
    chat = {
      id,
      name: person.name,
      avatar: (friend && (friend.photo || friend.cutout)) || person.photo || person.cutout,
      online: Boolean(person.online),
      folders: ["all"],
      // статусы без рода: пол человека мы не знаем
      status: person.online
        ? "в сети"
        : person.state === "moving"
          ? "в пути"
          : person.state === "home"
            ? `дома ${person.minutes} мин`
            : "недавно в сети",
      location: person.state === "home" ? "дома" : null,
    };
    data.chats.push(chat);
    data.messages[id] = [];
    return chat;
  };

  /* ── таб-бар и роутер ────────────────────────────────────────────────── */

  const TABS = ["map", "friends", "chats", "checkins", "profile"];
  const DARK_STATUS = new Set(["map", "profile"]);   // светлый верх → чёрный статус-бар
  const DARK_HOME = new Set(["map"]);                 // светлый низ → чёрный индикатор „домой“
  const scrollMemory = {};
  let activeTab = null;
  let openChatId = null;

  function showTab(tab) {
    if (!TABS.includes(tab)) tab = "map";
    if (tab === activeTab) return;

    if (activeTab) {
      const prevScroll = $(`#screen-${activeTab} .screen__scroll`);
      if (prevScroll) scrollMemory[activeTab] = prevScroll.scrollTop;
      $(`#screen-${activeTab}`).hidden = true;
    }
    const screen = $(`#screen-${tab}`);
    screen.hidden = false;
    const scroll = $(".screen__scroll", screen);
    if (scroll) scroll.scrollTop = scrollMemory[tab] || 0;

    $$(".tabbar__item").forEach((item) => {
      if (item.dataset.tab === tab) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    activeTab = tab;
    syncStatusBar();
  }

  function syncStatusBar() {
    app.dataset.status = !openChatId && DARK_STATUS.has(activeTab) ? "dark" : "light";
    app.dataset.home = !openChatId && DARK_HOME.has(activeTab) ? "dark" : "light";
  }

  function route() {
    const [, section, id] = location.hash.split("/");
    if (section === "chat" && id === openChatId) return;   // popstate и hashchange приходят парой
    if (section === "chat" && id && ensureChat(id)) {
      if (!activeTab) showTab("chats");
      openChat(id);
      return;
    }
    if (openChatId) closeChat({ updateHash: false });
    showTab(section || "map");
  }

  // Переход без ожидания hashchange: экран меняется в том же кадре, что и нажатие
  const navigate = (hash) => {
    if (location.hash !== hash) history.pushState(null, "", hash);
    route();
  };

  $$(".tabbar__item").forEach((item) =>
    item.addEventListener("click", () => navigate(`#/${item.dataset.tab}`))
  );

  // Любой элемент с data-go ведёт на таб или в чат: data-go="#/friends", data-go="#/chat/natashka"
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-go]");
    if (target) navigate(target.dataset.go);
  });

  window.addEventListener("popstate", route);      // „назад“ / „вперёд“ браузера
  window.addEventListener("hashchange", route);    // ручная правка адреса

  /* ── карта ───────────────────────────────────────────────────────────── */

  function renderMap() {
    const m = data.map;
    $("#map-city").textContent = m.city;
    $("#map-time").textContent = m.time;
    $("#map-weather").textContent = m.weather;
    $("#map-temperature").textContent = m.temperature;
    $("#map-steps").textContent = `${m.steps} ${plural(m.steps, ["шаг", "шага", "шагов"])} · ${m.rank} место`;

    // пины – общий компонент (scripts/pin.js): размеры 52 / 36 / 20, живая аватарка в маске 62×80
    $("#map-pins").innerHTML = data.mapFriends
      .map((p) =>
        window.BlinkPin.markup({
          ...p,
          className: "pressable",
          attrs: `style="--x:${p.x};--y:${p.y}" data-go="#/chat/${p.id}"`,
        })
      )
      .join("");
  }

  /* ── друзья ──────────────────────────────────────────────────────────── */

  function renderFriends(filter = "") {
    const query = filter.trim().toLowerCase();
    const list = data.friends.filter((f) => f.name.includes(query));
    $("#friends-count").textContent = data.friends.length;
    $("#requests-count").textContent = data.requestsCount;

    $("#friends-list").innerHTML = list.length
      ? list
          .map((f) => {
            const glow = f.online ? "online" : "offline";
            const avatar = f.cutout
              ? `<span class="cutout">
                   <img class="cutout__glow" src="assets/friends/glow-${glow}.webp" alt="">
                   <span class="cutout__person"><img class="cutout__img" src="${f.cutout}" alt=""></span>
                   <img class="cutout__rim" src="assets/friends/rim-${glow}.png" alt="">
                 </span>`
              : `<span class="avatar ${f.online ? "avatar--online" : ""}">
                   <img class="avatar__img" src="${f.photo}" alt="">
                 </span>`;
            return `
              <li class="friend-row">
                <span class="friend-row__avatar">${avatar}</span>
                <span class="friend-row__body">
                  <span class="friend-row__name ellipsis">${escapeHtml(f.name)}</span>
                  <span class="friend-row__distance">${formatDistance(f.distanceKm)}</span>
                </span>
                <span class="friend-row__actions">
                  <button class="icon-button icon-button--row pressable" data-go="#/chat/${f.id}"
                          aria-label="написать: ${escapeHtml(f.name)}">${icon("chat")}</button>
                  <button class="icon-button icon-button--row icon-button--row-outline pressable" data-go="#/map"
                          aria-label="показать на карте: ${escapeHtml(f.name)}">${icon("navigate")}</button>
                </span>
              </li>`;
          })
          .join("")
      : `<li class="friends__empty">никого с таким именем</li>`;
  }

  function renderSuggestions() {
    const cards = data.suggestions
      .map((s) => {
        const faces = s.faces
          .slice(0, 3)
          .map((id) => `<img class="face-stack__img" src="${friendAvatar(id)}" alt="">`)
          .join("");
        const photo = s.cutout
          ? `<img class="suggestion__photo" src="${s.cutout}" alt="">`
          : `<span class="suggestion__placeholder" aria-hidden="true"><span>${escapeHtml(s.username)}</span></span>`;
        const action = s.added
          ? `<button class="button button--secondary suggestion__action pressable" data-suggestion="${s.id}"
                     aria-pressed="true" aria-label="заявка отправлена: ${escapeHtml(s.name)}">${icon("check")}</button>`
          : `<button class="button button--primary suggestion__action pressable" data-suggestion="${s.id}"
                     aria-pressed="false">добавить</button>`;
        return `
          <li class="suggestion">
            <div class="suggestion__card">
              <img class="suggestion__pattern" src="assets/icons/star-pattern.svg" alt="">
              <span class="suggestion__name">${escapeHtml(s.name)}</span>
              ${photo}
              ${action}
            </div>
            <span class="suggestion__mutual">
              <span class="face-stack" aria-hidden="true">${faces}</span>
              ${s.mutual} ${plural(s.mutual, ["общий", "общих", "общих"])}
            </span>
          </li>`;
      })
      .join("");

    $("#suggestions").innerHTML = `${cards}
      <li class="suggestion">
        <button class="suggestion__card suggestion__card--all pressable" type="button">
          <img class="suggestion__pattern" src="assets/icons/star-pattern.svg" alt="">
          <img class="suggestion__eyes" src="assets/friends/eyes.webp" alt="">
          <span class="suggestion__all-label">посмотреть<br>всех</span>
        </button>
      </li>`;
  }

  $("#suggestions").addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggestion]");
    if (!button) return;
    const suggestion = data.suggestions.find((s) => s.id === button.dataset.suggestion);
    suggestion.added = !suggestion.added;
    renderSuggestions();
  });

  $("#friends-search").addEventListener("input", (event) => renderFriends(event.target.value));

  /* ── чаты ────────────────────────────────────────────────────────────── */

  let activeFolder = "all";

  function lastMessageMeta(chat) {
    const last = chat.last;
    if (!last) return "";
    const dot = `<span class="row__dot" aria-hidden="true">•</span>`;
    const date = `<span>${escapeHtml(last.date)}</span>`;
    const text = escapeHtml(last.text);
    switch (last.kind) {
      case "orb":
        return `${icon("orb")}<span class="ellipsis">${text}</span>${dot}${date}`;
      case "audio":
        return `<img class="row__audio" src="assets/icons/audio-note.svg" alt=""><span class="row__meta-accent ellipsis">${text}</span>${dot}${date}`;
      case "photo":
        return `<img class="row__thumb" src="${last.thumb}" alt=""><span class="row__meta-accent ellipsis">${text}</span>${dot}${date}`;
      case "reply-checkin":
        return `${icon("reply-checkin")}<span class="ellipsis">${text}</span>${dot}${date}`;
      case "reply":
        return `${icon("reply")}<span class="ellipsis">${text}</span>${dot}${date}`;
      default:
        return `<span class="ellipsis">${last.fromMe ? '<span class="row__meta-you">ты:</span> ' : ""}${text}</span>${dot}${date}`;
    }
  }

  function trailing(chat) {
    if (chat.unread) {
      return `<span class="badge-star" aria-label="${chat.unread} ${plural(chat.unread, ["непрочитанное", "непрочитанных", "непрочитанных"])}">
                ${icon("badge-star")}<span class="badge-star__value">${chat.unread}</span></span>`;
    }
    if (chat.unreadMark) return `<span class="row__unread-dot" aria-label="не прочитано"></span>`;
    if (chat.pinned) return icon("pinned", "row__pinned");
    return "";
  }

  function chatRow(chat) {
    const name = chat.ambassador
      ? `<span class="gradient-text ellipsis">${escapeHtml(chat.name)}</span>
         <img class="row__ambassador" src="assets/icons/ambassador.svg" alt="амбассадор">`
      : `<span class="ellipsis">${escapeHtml(chat.name)}</span>`;
    return `
      <li>
        <button class="row pressable" type="button" data-go="#/chat/${chat.id}">
          <span class="avatar ${chat.online ? "avatar--online" : ""}">
            <img class="avatar__img" src="${chat.avatar}" alt="">
          </span>
          <span class="row__body">
            <span class="row__title">${name}</span>
            <span class="row__meta">${lastMessageMeta(chat)}</span>
          </span>
          <span class="row__trailing">${trailing(chat)}</span>
        </button>
      </li>`;
  }

  function renderChats(filter = "") {
    const query = filter.trim().toLowerCase();
    const visible = data.chats.filter(
      (chat) => chat.last && chat.folders.includes(activeFolder) && chat.name.includes(query)
    );
    const pinned = visible.filter((chat) => chat.pinned);
    const rest = visible.filter((chat) => !chat.pinned);

    let html = pinned.map(chatRow).join("");
    if (pinned.length && rest.length) html += `<li class="chat-list__divider" role="separator"></li>`;
    html += rest.map(chatRow).join("");
    $("#chat-list").innerHTML = html || `<li class="chats__empty">таких чатов нет</li>`;

    const unreadCount = data.chats.filter((chat) => chat.unread || chat.unreadMark).length;
    $$(".folder-tab").forEach((tab) => {
      const counter = $(".folder-tab__count", tab);
      if (counter) counter.hidden = unreadCount === 0 || tab.dataset.folder !== "all";
      if (counter) counter.textContent = unreadCount;
    });
  }

  function renderFolders() {
    $("#folders").insertAdjacentHTML(
      "beforeend",
      data.folders
        .map(
          (f) => `
          <button class="folder-tab pressable" role="tab" data-folder="${f.id}"
                  aria-selected="${f.id === activeFolder}">
            ${escapeHtml(f.name)}${f.id === "all" ? '<span class="folder-tab__count"></span>' : ""}
          </button>`
        )
        .join("")
    );
  }

  $("#folders").addEventListener("click", (event) => {
    const tab = event.target.closest(".folder-tab");
    if (!tab) return;
    activeFolder = tab.dataset.folder;
    $$(".folder-tab").forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
    renderChats($("#chats-search").value);
  });

  $("#birthday-close").addEventListener("click", () => {
    const banner = $("#birthday-banner");
    banner.classList.add("is-dismissed");
    banner.setAttribute("aria-hidden", "true");
  });

  $("#chats-search").addEventListener("input", (event) => renderChats(event.target.value));

  /* ── чат ─────────────────────────────────────────────────────────────── */

  const chatScreen = $("#screen-chat");
  const feed = $("#chat-feed");
  const input = $("#composer-input");
  const composer = $("#composer");
  const stickerPanel = $("#sticker-panel");
  let bigText = false;
  let hideTimer = 0;

  // Низ ленты всегда над футером: футер растёт (локация, панель стикеров, многострочный текст) –
  // отступ ленты растёт вместе с ним, последнее сообщение не прячется
  const footer = $(".chat__footer");
  new ResizeObserver(() => {
    const scroll = $("#chat-scroll");
    const atEnd = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 40;
    feed.style.paddingBottom = `${footer.offsetHeight + 4}px`;     // последний пузырь – на 4 pt выше футера
    if (atEnd) scrollFeedToEnd();
  }).observe(footer);

  function renderMessages(id) {
    const messages = data.messages[id] || [];
    if (!messages.length) {
      feed.innerHTML = `<p class="chat__empty">скажи привет</p>`;
      return;
    }
    let previous = null;
    feed.innerHTML = messages
      .map((m) => {
        if (m.divider) {
          previous = null;
          return `<p class="chat-divider">${escapeHtml(m.divider)}</p>`;
        }
        const continued = previous === m.from ? "is-continued" : "";
        previous = m.from;
        const body = m.sticker
          ? `<div class="bubble bubble--sticker"><img src="${m.sticker}" alt="${escapeHtml(m.label || "стикер")}"></div>`
          : `<div class="bubble bubble--${m.from} ${m.style === "big" ? "bubble--big" : ""}">${escapeHtml(m.text)}</div>`;
        return `<div class="message-row message-row--${m.from} ${continued}">${body}</div>`;
      })
      .join("");
  }

  function scrollFeedToEnd() {
    const scroll = $("#chat-scroll");
    scroll.scrollTop = scroll.scrollHeight;
  }

  function openChat(id) {
    const chat = ensureChat(id);
    openChatId = id;

    $("#chat-avatar").src = chat.avatar;
    $("#chat-name").textContent = chat.name;
    const status = $("#chat-status");
    status.textContent = chat.online ? "в сети" : chat.status || "";

    const locationLine = $("#chat-location");
    locationLine.hidden = !chat.location;
    $("#chat-location-text").textContent = chat.location || "";

    renderMessages(id);
    resetComposer();

    // прочитали – снимаем счётчики в списке
    chat.unread = 0;
    chat.unreadMark = false;
    renderChats($("#chats-search").value);

    clearTimeout(hideTimer);
    chatScreen.hidden = false;
    requestAnimationFrame(() => {
      if (openChatId !== id) return;                // чат успели закрыть до первого кадра
      syncComposer();
      scrollFeedToEnd();
      requestAnimationFrame(() => {
        if (openChatId !== id) return;
        chatScreen.classList.add("is-open");
        app.classList.add("has-push");
      });
    });
    syncStatusBar();
  }

  function closeChat({ updateHash = true } = {}) {
    if (!openChatId) return;
    openChatId = null;
    const wasOpen = chatScreen.classList.contains("is-open");
    chatScreen.classList.remove("is-open");
    app.classList.remove("has-push");
    chatScreen.style.transform = "";
    // прячем после того, как экран уехал; таймер – страховка, если transitionend не придёт
    const hide = () => {
      clearTimeout(hideTimer);
      chatScreen.removeEventListener("transitionend", onEnd);
      if (!openChatId) chatScreen.hidden = true;
    };
    const onEnd = (event) => {
      if (event.target === chatScreen) hide();
    };
    if (wasOpen) {
      chatScreen.addEventListener("transitionend", onEnd);
      hideTimer = setTimeout(hide, 450);
    } else {
      hide();
    }
    syncStatusBar();
    if (updateHash) history.replaceState(null, "", `#/${activeTab || "chats"}`);
  }

  $("#chat-back").addEventListener("click", () => closeChat());

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openChatId) closeChat();
  });

  // Локация собеседника над композером ведёт на карту
  $("#chat-location").addEventListener("click", () => {
    closeChat({ updateHash: false });
    navigate("#/map");
  });

  // Свайп назад от левого края: палец и экран двигаются 1:1, решение – по скорости и расстоянию
  (() => {
    let startX = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    let tracking = false;

    chatScreen.addEventListener("pointerdown", (event) => {
      if (event.clientX - app.getBoundingClientRect().left > 24 || event.pointerType === "mouse") return;
      tracking = true;
      startX = lastX = event.clientX;
      lastT = event.timeStamp;
      velocity = 0;
      chatScreen.setPointerCapture(event.pointerId);
      chatScreen.classList.add("is-dragging");
    });

    chatScreen.addEventListener("pointermove", (event) => {
      if (!tracking) return;
      const dx = Math.max(0, event.clientX - startX);
      const dt = Math.max(1, event.timeStamp - lastT);
      velocity = ((event.clientX - lastX) / dt) * 1000;
      lastX = event.clientX;
      lastT = event.timeStamp;
      chatScreen.style.transform = `translateX(${dx}px)`;
    });

    const finish = (event) => {
      if (!tracking) return;
      tracking = false;
      chatScreen.classList.remove("is-dragging");
      const dx = event.clientX - startX;
      const width = app.clientWidth;
      // проекция броска (apple-design.md, §6): куда экран „доедет“ с текущей скоростью
      const projected = dx + (velocity / 1000) * 0.998 / (1 - 0.998);
      if (projected > width / 2) {
        closeChat();
      } else {
        chatScreen.style.transform = "";
      }
    };
    chatScreen.addEventListener("pointerup", finish);
    chatScreen.addEventListener("pointercancel", finish);
  })();

  /* композер */

  function resetComposer() {
    input.value = "";
    bigText = false;
    composer.classList.remove("is-big");
    stickerPanel.classList.remove("is-open");
    $("#composer-sticker").setAttribute("aria-pressed", "false");
    $("#composer-sticker-icon").className = "icon icon--sticker";
    $("#composer-style").setAttribute("aria-pressed", "false");
    $("#composer-style-icon").className = "icon icon--text-style";
    syncComposer();
  }

  function syncComposer() {
    const hasText = input.value.trim().length > 0;
    $("#composer-photo").hidden = hasText;
    $("#composer-send").hidden = !hasText;
    // высота поля растёт с текстом до 120 pt; пока экран скрыт, scrollHeight = 0 – не трогаем
    if (!input.scrollHeight) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  function pushMessage(message) {
    const list = data.messages[openChatId] || (data.messages[openChatId] = []);
    list.push({ from: "out", ...message });
    const chat = chatById(openChatId);
    chat.last = message.sticker
      ? { kind: "text", fromMe: true, text: "стикер", date: "сейчас" }
      : { kind: "text", fromMe: true, text: message.text, date: "сейчас" };
    renderMessages(openChatId);
    renderChats($("#chats-search").value);
    requestAnimationFrame(scrollFeedToEnd);
  }

  function sendText() {
    const text = input.value.trim();
    if (!text) return;
    pushMessage({ text, style: bigText ? "big" : undefined });
    resetComposer();
    input.focus();
  }

  input.addEventListener("input", syncComposer);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendText();
    }
  });
  $("#composer-send").addEventListener("click", sendText);

  // „Aa“ – стиль „крупно“ для следующего сообщения; в активном состоянии кнопка показывает крестик
  $("#composer-style").addEventListener("click", (event) => {
    bigText = !bigText;
    composer.classList.toggle("is-big", bigText);
    event.currentTarget.setAttribute("aria-pressed", String(bigText));
    $("#composer-style-icon").className = `icon icon--${bigText ? "close" : "text-style"}`;
    input.focus();
  });

  // Стикеры: панель из 3D-стикеров проекта, иконка меняется на клавиатуру
  stickerPanel.innerHTML = data.stickers
    .map(
      (s) => `
      <button class="sticker-panel__item pressable" type="button" data-sticker="${s.name}" aria-label="стикер ${s.label}">
        <img src="assets/stickers/${s.name}.webp" alt="">
      </button>`
    )
    .join("");

  $("#composer-sticker").addEventListener("click", (event) => {
    const open = !stickerPanel.classList.contains("is-open");
    stickerPanel.classList.toggle("is-open", open);
    event.currentTarget.setAttribute("aria-pressed", String(open));
    $("#composer-sticker-icon").className = `icon icon--${open ? "keyboard" : "sticker"}`;
    if (!open) input.focus();
  });

  stickerPanel.addEventListener("click", (event) => {
    const item = event.target.closest("[data-sticker]");
    if (!item) return;
    const sticker = data.stickers.find((s) => s.name === item.dataset.sticker);
    pushMessage({ sticker: `assets/stickers/${sticker.name}.webp`, label: `стикер ${sticker.label}` });
  });

  /* ── профиль ─────────────────────────────────────────────────────────── */

  function renderProfile() {
    const me = data.me;
    const s = me.stats;
    $("#profile-name").textContent = me.name;
    $("#profile-bio").textContent = me.bio;
    $("#profile-city").textContent = me.city;
    $("#profile-username").textContent = me.username;
    $("#profile-coins").textContent = me.coins;
    $("#profile-avatar").src = me.cutout;
    $("#tab-avatar").src = me.cutout;

    $("#profile-gifts").innerHTML = me.gifts
      .map(
        (g) =>
          `<img class="gift" src="${g.src}" alt="${escapeHtml(g.label)}" style="--dx:${g.dx};--dy:${g.dy};--w:${g.w}">`
      )
      .join("");

    $("#stat-friends").insertAdjacentHTML("beforeend", stickerNumber(s.friends));
    $("#stat-friends-new").textContent = `+${s.friendsNew}`;
    $("#stat-views").insertAdjacentHTML("beforeend", stickerNumber(s.views));
    $("#stat-stars").insertAdjacentHTML("beforeend", stickerNumber(s.stars));
    $("#stat-stars-new").textContent = `+${s.starsNew}`;
    $("#stat-checkins").insertAdjacentHTML("beforeend", stickerNumber(s.checkins));

    $("#stat-friends").setAttribute(
      "aria-label",
      `${s.friends} ${plural(s.friends, ["друг", "друга", "друзей"])}, ${s.friendsNew} новых`
    );
    $("#stat-views").setAttribute("aria-label", `${s.views} ${plural(s.views, ["просмотр", "просмотра", "просмотров"])}`);
    $("#stat-stars").setAttribute("aria-label", `${s.stars} ${plural(s.stars, ["звезда", "звезды", "звёзд"])}, +${s.starsNew}`);
    $("#stat-checkins").setAttribute("aria-label", `${s.checkins} ${plural(s.checkins, ["чекин", "чекина", "чекинов"])}`);
  }

  /* ── превью на десктопе: телефон целиком помещается в окно ─────────────── */

  function fitDevice() {
    const framed = window.matchMedia("(min-width: 481px)").matches;
    const scale = framed ? Math.min(1, (window.innerHeight - 48) / 844) : 1;
    app.style.zoom = scale < 1 ? String(Math.max(scale, 0.5)) : "";
  }
  window.addEventListener("resize", fitDevice);
  fitDevice();

  /* ── старт ───────────────────────────────────────────────────────────── */

  renderMap();
  renderFriends();
  renderSuggestions();
  renderFolders();
  renderChats();
  renderProfile();
  route();
})();
