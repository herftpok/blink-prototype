#!/usr/bin/env python3
"""
Смоук-тест прототипа: прокликивает навигацию и ключевые сценарии в Chromium
и падает, если что-то сломалось или в консоли есть ошибки.

Запуск:  python3 prototype/tools/smoke.py
Нужно:   pip install playwright && python3 -m playwright install chromium
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare import serve  # noqa: E402  (тот же локальный сервер, что у сверки)

from playwright.sync_api import Page, sync_playwright

CHECKS: list[tuple[str, bool]] = []


def check(name: str, ok: bool) -> None:
    CHECKS.append((name, ok))
    print(("  ok   " if ok else "  FAIL ") + name)


def active_tab(page: Page) -> str | None:
    return page.evaluate("document.querySelector('.tabbar__item[aria-current]')?.dataset.tab")


def chat_open(page: Page) -> bool:
    return page.evaluate("!document.getElementById('screen-chat').hidden && "
                         "document.getElementById('screen-chat').classList.contains('is-open')")


def check_geo_share(browser, port: int, errors: list[str]) -> None:
    """Фича „шеринг геопозиции“: свой пин → шторки „поделиться“, ссылка от наташки к другу без blink."""
    page = browser.new_page(viewport={"width": 1300, "height": 1150}, device_scale_factor=1)
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"http://127.0.0.1:{port}/features/geo-share/index.html")
    page.wait_for_load_state("networkidle")

    is_open = lambda sel: page.evaluate(f"document.querySelector('{sel}').classList.contains('is-open')")
    # textContent, а не innerText: надписи кнопок капсом делает CSS, в разметке они строчные
    text = lambda sel: page.eval_on_selector(sel, "el => el.textContent").replace("\u00a0", " ").strip()
    visible = page.is_visible
    style = lambda sel, prop: page.eval_on_selector(sel, f"el => getComputedStyle(el).{prop}")
    server_active = lambda: visible("#s-live") or page.evaluate("document.getElementById('s-stop').hidden === false")
    mover_x = lambda: page.evaluate("parseFloat(getComputedStyle(document.getElementById('v-mover')).getPropertyValue('--x'))")
    # якорь своего пина (низ кадра) и верх верхней шторки – в долях высоты телефона
    pin_y = lambda: page.evaluate("""() => {
        const app = document.getElementById('sender').getBoundingClientRect();
        return (document.querySelector('#s-mover .pin').getBoundingClientRect().bottom - app.top) / app.height; }""")
    sheet_top = lambda sel: page.evaluate(f"""() => {{
        const app = document.getElementById('sender').getBoundingClientRect();
        return (document.querySelector('{sel}').getBoundingClientRect().top - app.top) / app.height; }}""")
    # свой пин всё время едет – ждать, пока он замрёт, бессмысленно
    tap_own_pin = lambda: page.click("#s-mover .pin", force=True)

    check("шеринг: оба телефона на месте, у друга пока пусто, отдельной кнопки шеринга нет",
          visible("#sender") and visible("#viewer") and visible("#v-idle") and not visible("#v-browser")
          and page.locator("#s-share").count() == 0 and not visible("#s-live")
          and page.locator("#sender .map__actions button").count() == 2)

    # клавиатура: Enter на своём пине открывает шторку, Esc закрывает верхнюю и возвращает фокус
    page.focus("#s-mover .pin")
    page.keyboard.press("Enter")
    page.wait_for_timeout(500)
    clear = style("#s-scrim", "backgroundColor") == "rgba(0, 0, 0, 0)"
    check("шеринг: свой пин открывает „поделиться“, камера ставит пин чуть выше центра, карта не темнеет",
          is_open("#s-sheet") and abs(pin_y() - 0.4) < 0.02 and pin_y() < sheet_top("#s-sheet") and clear)
    page.click("#s-geo-card")
    page.wait_for_timeout(500)
    page.focus("#s-durations [aria-checked='true']")
    page.keyboard.press("ArrowRight")
    by_keys = page.get_attribute("#s-durations [aria-checked='true']", "data-minutes")
    map_inert = page.evaluate("document.querySelector('#sender .screen.map').inert")
    menu_inert = page.evaluate("document.getElementById('s-sheet').inert")
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    back_on_card = page.evaluate("document.activeElement.id") == "s-geo-card" and is_open("#s-sheet")
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    on_pin = page.evaluate("Boolean(document.activeElement.closest('#s-mover'))")
    check("шеринг: с клавиатуры – стрелки, Esc закрывает верхнюю шторку, потом нижнюю; фокус возвращается",
          by_keys == "30" and map_inert and menu_inert and back_on_card and on_pin and not is_open("#s-sheet"))
    page.click("[data-demo='reset']")

    tap_own_pin()
    page.wait_for_timeout(500)
    check("шеринг: в меню геопозиция по ссылке с глазами, профиль и qr-код; „закрыть“ в шапке",
          text("#s-menu-title") == "поделиться" and text("#s-geo-card-text") == "транслируй геопозицию друзьям без blink"
          and text("#s-profile-label") == "профиль" and visible("#s-sheet .share-card__sticker")
          and visible("#s-sheet [data-close]"))

    page.click("#s-profile")
    page.wait_for_timeout(150)
    copied = text("#s-profile-label") == "скопировано"
    page.wait_for_timeout(2200)
    check("шеринг: „профиль“ копирует ссылку, надпись меняется на месте и возвращается",
          copied and text("#s-profile-label") == "профиль")

    # вторая шторка выезжает снизу: в середине анимации сдвиг только по вертикали
    page.click("#s-qr")
    page.wait_for_timeout(90)
    motion = page.evaluate("(m => [m.m41, m.m42])(new DOMMatrix(getComputedStyle(document.getElementById('s-qr-sheet')).transform))")
    page.wait_for_timeout(500)
    qr = (is_open("#s-qr-sheet") and is_open("#s-sheet") and text("#s-qr-name") == "наташка"
          and text("#s-qr-link") == "blinkmap.com/@natashka" and visible("#s-qr-avatar"))
    check("шеринг: qr-код с аватаром – шторка поверх „поделиться“, едет строго снизу",
          qr and motion[0] == 0 and motion[1] > 0)
    page.click("#s-qr-sheet [data-close]")
    page.wait_for_timeout(500)
    check("шеринг: „закрыть“ убирает только верхнюю шторку, фокус – на плитке qr-кода",
          not is_open("#s-qr-sheet") and is_open("#s-sheet") and page.evaluate("document.activeElement.id") == "s-qr")

    page.click("#s-geo-card")
    page.wait_for_timeout(500)
    checked = page.get_attribute("#s-durations [aria-checked='true']", "data-minutes")
    # под кнопкой ничего: CTA – последний видимый элемент шторки
    last = page.evaluate("[...document.querySelectorAll('#s-geo-sheet > *')].filter(el => el.offsetParent).pop().id")
    font = page.evaluate("(s => [s.fontWeight, s.fontSize])(getComputedStyle(document.getElementById('s-cta')))")
    check("шеринг: геопозиция – глаза, новый текст, 15 мин, под кнопкой ничего, кнопка 700 14.5",
          visible("#s-geo-sheet .share-hero__eyes") and checked == "15" and last == "s-cta"
          and text("#s-geo-text") == "транслируй геопозицию друзьям без blink" and font == ["700", "14.5px"])
    check("шеринг: шторка поверх – пин остался над её краем", pin_y() < sheet_top("#s-geo-sheet"))

    page.click("#s-cta")
    page.wait_for_timeout(800)
    ring = page.eval_on_selector("#s-ring .ring__fill", "el => getComputedStyle(el).stroke")
    ring_share = float(page.eval_on_selector("#s-ring", "el => el.style.getPropertyValue('--progress')"))
    check("шеринг: одно нажатие создаёт и копирует ссылку; глаза в розовом кольце с зазором с первой секунды",
          text("#s-geo-title") == "ты на карте по ссылке" and text("#s-cta-label") == "скопировано"
          and text("#s-time-badge") in ("15:00", "14:59") and ring == "rgb(255, 117, 225)" and ring_share < 0.95
          and page.locator("#s-link, .link-field").count() == 0)
    check("шеринг: „перестать делиться гео“ – под главной кнопкой, красным #FF4A31",
          text("#s-stop") == "перестать делиться гео" and visible("#s-stop")
          and style("#s-stop", "color") == "rgb(255, 74, 49)")
    bottoms = page.evaluate("""() => {
        const app = document.getElementById('sender').getBoundingClientRect();
        return (app.bottom - document.getElementById('s-stop').getBoundingClientRect().bottom) / app.height * 844; }""")
    check("шеринг: продлевать нельзя; обе кнопки опущены – красная у самого низа",
          page.locator("[data-extend], #s-extend").count() == 0 and bottoms <= 27)
    check("шеринг: в трансляции пин тоже над шторкой", pin_y() < sheet_top("#s-geo-sheet"))
    page.wait_for_timeout(2200)
    check("шеринг: „скопировано“ возвращается в „скопировать ссылку“", text("#s-cta-label") == "скопировать ссылку")
    page.click("#s-geo-sheet [data-close]")
    page.wait_for_timeout(500)
    check("шеринг: в меню карточка – зелёная live-точка и „транслируется ещё“",
          text("#s-geo-card-text").startswith("транслируется ещё 14:") and page.locator("#s-geo-card-text .live-dot").count() == 1)

    page.click("#s-scrim", force=True)
    page.wait_for_timeout(500)
    in_bounds = page.evaluate("""() => {
        const layer = document.getElementById('s-layer');
        const y = parseFloat(layer.style.getPropertyValue('--cam-y'));
        return y >= document.getElementById('sender').clientHeight - layer.offsetHeight - 0.5; }""")
    page.wait_for_timeout(200)
    above_pin = page.evaluate("""() => document.getElementById('s-live').getBoundingClientRect().bottom
        < document.querySelector('#s-mover .pin').getBoundingClientRect().top""")
    chip = (visible("#s-live") and text("#s-live-text").startswith("транслируется ещё 14:") and above_pin
            and page.locator("#sender .map__header .map-chip").count() == 1)
    check("шеринг: карта – шторки закрылись, карта в своих краях; „транслируется ещё“ – над твоим пином, не в шапке",
          not is_open("#s-sheet") and in_bounds and chip)

    page.click("#stage-send")
    page.wait_for_timeout(900)
    check("шеринг: друг сразу видит карту – шапка как в приложении и понятная плашка со временем потолще",
          text("#v-city") == "москва" and text("#v-time") == "09:53" and text("#v-temperature") == "−15 °C"
          and text("#v-left-text").startswith("трансляция закончится через 14:")
          and int(style("#v-left", "fontWeight")) >= 600 and page.locator("#v-left .ring, #v-battery").count() == 0
          and page.locator("#v-onboarding, #v-countdown").count() == 0
          and visible("#v-browser") and text("#v-browser") == "web.blinkmap.com")
    pin_parts = page.evaluate("""() => {
        const pin = document.querySelector('#v-mover .pin').getBoundingClientRect();
        const title = document.querySelector('#v-mover .pin__title');
        const battery = document.querySelector('#v-mover .pin__battery');
        return [title.textContent, title.getBoundingClientRect().bottom < pin.top,
                battery.getAttribute('src').endsWith('pin/battery.png'), battery.getBoundingClientRect().top > pin.bottom]; }""")
    check("шеринг: у друга имя с обводкой над пином, плашка заряда Battery.png под ним",
          pin_parts == ["наташка", True, True, True])
    radii = page.evaluate("""() => {
        const banner = document.getElementById('v-banner');
        const button = banner.querySelector('.install-banner__button');
        const r = (el) => Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius), el.offsetHeight / 2);
        return [r(banner), r(button), (banner.offsetHeight - button.offsetHeight) / 2]; }""")
    fits = page.evaluate("""() => [...document.querySelectorAll('#v-banner .ellipsis')].every(el => el.scrollWidth <= el.clientWidth)""")
    inside = page.evaluate("""() => {
        const img = document.getElementById('v-banner-photo').getBoundingClientRect();
        const banner = document.getElementById('v-banner').getBoundingClientRect();
        return img.top >= banner.top - 3 && img.left >= banner.left && img.bottom > banner.bottom; }""")
    check("шеринг: баннер без свечения – аватар внутри, за край уходит только низ; тексты целиком; скругления вложены",
          text("#v-banner-title") == "наташка уже в blink"
          and text("#v-banner .install-banner__text") == "общение и друзья на карте"
          and page.locator("#v-banner .pin").count() == 0 and inside and fits
          and abs(radii[0] - radii[2] - radii[1]) <= 1)

    x0 = mover_x()
    page.wait_for_timeout(2300)
    check("шеринг: пин друга едет по карте", mover_x() != x0)

    page.mouse.move(700, 700)
    cam0 = page.evaluate("getComputedStyle(document.getElementById('v-layer')).getPropertyValue('--cam-y')")
    box = page.locator("#viewer").bounding_box()
    page.mouse.move(box["x"] + 200, box["y"] + 520)
    page.mouse.down()
    page.mouse.move(box["x"] + 200, box["y"] + 620, steps=6)
    page.mouse.up()
    cam1 = page.evaluate("getComputedStyle(document.getElementById('v-layer')).getPropertyValue('--cam-y')")
    page.click("#v-recenter")
    page.wait_for_timeout(700)
    cam2 = page.evaluate("getComputedStyle(document.getElementById('v-layer')).getPropertyValue('--cam-y')")
    check("шеринг: карту друга двигает палец, кнопка возвращает к пину",
          float(cam1) != float(cam0) and abs(float(cam2) - float(cam0)) < 20)

    page.click("[data-demo='arrive']")
    page.wait_for_timeout(400)
    staying = (page.locator("#v-mover .pin__time--speed").count() == 0
               and text("#v-mover .pin__time-value") == "1" and text("#v-mover .pin__time-unit") == "мин"
               and text("#s-mover .pin__time-value") == "1")
    words = page.inner_text("#viewer")
    check("шеринг: наташка дошла – оба пина показывают минуты, мигающих статусов в шапке нет",
          staying and "на месте" not in words and "в пути" not in words)

    page.click("[data-demo='minute']")
    page.wait_for_timeout(1300)
    check("шеринг: последняя минута – „0:5x“ у обоих, стикер со временем стучит",
          text("#v-left-text").startswith("трансляция закончится через 0:5")
          and text("#s-live-text").startswith("транслируется ещё 0:5")
          and "is-urgent" in page.get_attribute("#s-hero", "class"))

    page.click("[data-demo='lost']")
    page.wait_for_timeout(200)
    lost_pin = page.evaluate("""() => {
        const pin = document.querySelector('#v-mover .pin');
        const badge = pin.querySelector('.pin__badge--approximate');
        return [pin.classList.contains('pin--stale'), Boolean(badge) && badge.getAttribute('src').endsWith('pin/approximate.png'),
                getComputedStyle(pin.querySelector('.pin__title')).opacity]; }""")
    check("шеринг: гео перестало приходить – „проблемы с геолокацией“, у пина бейдж „место примерное“",
          lost_pin == [True, True, "1"] and text("#v-left-text") == "проблемы с геолокацией"
          and "live-dot--off" in page.get_attribute("#v-left-dot", "class")
          and page.locator("[data-demo='waiting'], [data-demo='offline'], #v-waiting").count() == 0)
    page.click("[data-demo='lost']")

    page.click("#s-live", force=True)
    page.wait_for_timeout(500)
    from_pill = is_open("#s-geo-sheet") and not is_open("#s-sheet") and style("#s-live", "opacity") == "0"
    page.click("#s-stop")
    page.wait_for_timeout(200)
    confirm = (text("#s-stop") == "точно перестать?" and style("#s-stop", "backgroundColor") == "rgb(255, 74, 49)"
               and server_active())
    page.wait_for_timeout(4200)
    reverted = text("#s-stop") == "перестать делиться гео"
    check("шеринг: остановка – с подтверждением на месте: „точно перестать?“, через 4 s кнопка возвращается",
          confirm and reverted)
    page.click("#s-stop")
    page.wait_for_timeout(150)
    page.click("#s-stop")
    page.wait_for_timeout(600)
    ended_img = page.eval_on_selector("#v-ended .cutout__img", "el => getComputedStyle(el).objectFit")
    check("шеринг: плашка на карте открывает шторку геопозиции; „перестать делиться гео“ – у друга экран конца",
          from_pill and is_open("#v-ended") and text("#v-left-text") == "трансляцию остановили"
          and not visible("#s-live") and text("#s-geo-text") == "прошлая ссылка больше не работает")
    check("шеринг: конец трансляции – вырезка целиком с дугой свечения, текст про blink, кнопка 700",
          ended_img == "contain" and visible("#v-ended .cutout__rim")
          and text("#v-ended-text") == "а в приложении всегда видно, где наташка"
          and style("#v-ended .viewer-ended__cta", "fontWeight") == "700")

    # шторку смахивают вниз
    handle = page.locator("#s-geo-sheet [data-drag]").bounding_box()
    page.mouse.move(handle["x"] + 120, handle["y"] + 8)
    page.mouse.down()
    page.mouse.move(handle["x"] + 120, handle["y"] + 460, steps=8)
    page.mouse.up()
    page.wait_for_timeout(500)
    check("шеринг: шторку можно смахнуть вниз", not is_open("#s-geo-sheet"))

    page.click("[data-demo='old']")
    page.wait_for_timeout(900)
    check("шеринг: старая ссылка – „ссылка больше не работает“ в рамке браузера",
          visible("#v-invalid") and visible("#v-browser"))

    page.click("[data-demo='reset']")
    page.click("[data-demo='fail']")
    tap_own_pin()
    page.wait_for_timeout(450)
    page.click("#s-geo-card")
    page.wait_for_timeout(450)
    page.click("#s-cta")
    page.wait_for_timeout(700)
    failed = visible("#s-error")
    page.click("[data-demo='fail']")
    page.click("#s-cta")
    page.wait_for_timeout(700)
    check("шеринг: ссылка не создалась – ошибка в шторке, повтор работает",
          failed and text("#s-geo-title") == "ты на карте по ссылке")

    page.click("#s-scrim", force=True)
    page.click("#stage-send")
    page.wait_for_timeout(900)
    page.click("[data-demo='expire']")
    page.wait_for_timeout(300)
    check("шеринг: время вышло – у друга экран конца, у тебя плашки на карте нет",
          is_open("#v-ended") and text("#v-left-text") == "время вышло" and not visible("#s-live"))

    page.set_viewport_size({"width": 375, "height": 812})
    page.wait_for_timeout(300)
    overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth")
    check("шеринг: 375×812 – телефоны друг под другом, без горизонтального скролла", not overflow)
    page.close()


def check_geo_share_locate(browser, port: int, errors: list[str]) -> None:
    """Шеринг через „где я“: А – кнопки над пином, Б – „где я“ становится „поделиться“, В – только „поделиться гео“."""
    page = browser.new_page(viewport={"width": 1300, "height": 1150}, device_scale_factor=1)
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    url = f"http://127.0.0.1:{port}/features/geo-share/index.html"
    page.goto(url)
    page.wait_for_load_state("networkidle")

    is_open = lambda sel: page.evaluate(f"document.querySelector('{sel}').classList.contains('is-open')")
    text = lambda sel: page.eval_on_selector(sel, "el => el.textContent").replace(" ", " ").strip()
    focused = lambda: page.evaluate("document.activeElement.id")
    actions_open = lambda: is_open("#s-actions")
    alt = lambda: page.evaluate("document.getElementById('s-locate').classList.contains('is-alt')")
    # якорь своего пина (низ кадра по центру) – в долях телефона
    pin_at = lambda: page.evaluate("""() => {
        const app = document.getElementById('sender').getBoundingClientRect();
        const pin = document.querySelector('#s-mover .pin').getBoundingClientRect();
        return [(pin.left + pin.width / 2 - app.left) / app.width, (pin.bottom - app.top) / app.height]; }""")
    centered = lambda: all(abs(v - 0.5) < 0.03 for v in pin_at())
    app = page.locator("#sender").bounding_box()
    # пустое место карты: слева внизу, вдали от пинов, шапки и нижнего ряда кнопок
    spot = (app["x"] + app["width"] * 0.15, app["y"] + app["height"] * 0.72)

    def drag_map() -> None:
        page.mouse.move(*spot)
        page.mouse.down()
        page.mouse.move(spot[0] + 90, spot[1] - 70, steps=6)
        page.mouse.up()

    check("шеринг через „где я“: по умолчанию вариант А, кнопок над пином нет",
          page.get_attribute("[data-entry='pin']", "aria-checked") == "true" and not actions_open()
          and page.evaluate("document.getElementById('s-actions').inert"))

    page.click("#s-locate")
    page.wait_for_timeout(800)
    bar_above = page.evaluate("""() => document.getElementById('s-actions').getBoundingClientRect().bottom
        < document.querySelector('#s-mover .pin__frame').getBoundingClientRect().top""")
    labels = [t.replace("\u00a0", " ") for t in page.locator("#s-actions .pin-actions__label").all_inner_texts()]
    check("вариант А: „где я“ ставит пин в центр, над ним – „профиль“, „гео по ссылке“ с меткой и „qr-код“",
          actions_open() and centered() and bar_above and labels == ["профиль", "гео по ссылке", "qr-код"]
          and page.locator("#s-act-geo .icon--pin").count() == 1 and not alt())
    glass = page.evaluate("""() => {
        const bar = document.getElementById('s-actions');
        const cs = getComputedStyle(bar);
        const alpha = parseFloat((cs.backgroundColor.match(/[\\d.]+(?=\\))/) || [1])[0]);
        const items = [...bar.querySelectorAll('.pin-actions__item')];
        const dividers = items.map(i => getComputedStyle(i, '::before')).filter(d => d.content !== 'none');
        const widths = items.map(i => Math.round(i.getBoundingClientRect().width));
        return { alpha, blur: (cs.backdropFilter || cs.webkitBackdropFilter).includes('blur'),
                 dividers: dividers.length, short: dividers.every(d => parseFloat(d.height) < items[0].offsetHeight / 2),
                 equal: new Set(widths).size === 1 }; }""")
    check("вариант А: стекло полупрозрачное с блюром, между кнопками – две короткие полоски, колонки равные",
          glass["alpha"] <= 0.6 and glass["blur"] and glass["dividers"] == 2 and glass["short"] and glass["equal"])

    page.click("#s-act-profile", force=True)
    page.wait_for_timeout(150)
    copied = text("#s-act-profile-label") == "скопировано" and text("#s-profile-label") == "скопировано"
    # „скопировано“ целиком внутри своей кнопки, с полями, и не шире стекла
    inside = page.evaluate("""() => {
        const item = document.getElementById('s-act-profile').getBoundingClientRect();
        const label = document.getElementById('s-act-profile-label').getBoundingClientRect();
        const bar = document.getElementById('s-actions').getBoundingClientRect();
        return label.left - item.left >= 4 && item.right - label.right >= 4 && label.left > bar.left; }""")
    page.wait_for_timeout(2200)
    check("вариант А: „профиль“ копирует ссылку на месте – „скопировано“ не вылезает за край, потом возвращается",
          copied and inside and text("#s-act-profile-label") == "профиль" and actions_open())

    page.click("#s-act-geo", force=True)
    page.wait_for_timeout(500)
    geo = is_open("#s-geo-sheet") and not is_open("#s-sheet") and not actions_open()
    page.keyboard.press("Escape")
    page.wait_for_timeout(600)
    check("вариант А: „гео“ – сразу шторка геопозиции; закрылась – кнопки и центр возвращаются, фокус на „гео“",
          geo and actions_open() and centered() and focused() == "s-act-geo")

    page.click("#s-act-qr", force=True)
    page.wait_for_timeout(500)
    qr = is_open("#s-qr-sheet") and not is_open("#s-sheet")
    page.click("#s-scrim", force=True)
    page.wait_for_timeout(600)
    check("вариант А: „qr-код“ – шторка с кодом, после неё кнопки на месте", qr and actions_open())

    page.mouse.click(*spot)
    page.wait_for_timeout(2300)
    check("вариант А: нажатие по карте закрывает кнопки, камера всё ещё держит пин в центре",
          not actions_open() and centered())

    page.click("#s-locate")
    page.wait_for_timeout(700)
    reopened = actions_open()
    drag_map()
    page.wait_for_timeout(2300)
    check("вариант А: карту сдвинули пальцем – кнопки закрылись, камера отпустила пин",
          reopened and not actions_open() and not centered())

    page.focus("#s-locate")
    page.keyboard.press("Enter")
    page.wait_for_timeout(600)
    on_first = focused() == "s-act-profile" and actions_open()
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    check("вариант А: с клавиатуры фокус переходит на кнопки, Esc закрывает их и возвращает на „где я“",
          on_first and not actions_open() and focused() == "s-locate")

    # вариант Б: камера уже держит пин в центре – кнопка сразу становится „поделиться“
    page.click("[data-entry='button']")
    page.wait_for_timeout(400)
    icons = page.evaluate("""() => [...document.querySelectorAll('#s-locate .icon')].map(i => getComputedStyle(i).opacity)""")
    check("вариант Б: переключатель на стенде, пока ты в центре – вместо „где я“ кнопка „поделиться“",
          page.evaluate("location.hash") == "#share-button" and alt() and icons == ["0", "1"]
          and page.get_attribute("#s-locate", "aria-label") == "поделиться" and not actions_open())

    drag_map()
    page.wait_for_timeout(400)
    back = not alt() and page.get_attribute("#s-locate", "aria-label") == "показать, где я"
    page.click("#s-locate")
    page.wait_for_timeout(800)
    check("вариант Б: сдвинул карту – снова „где я“; нажал – пин в центре, кнопка опять „поделиться“",
          back and alt() and centered() and not actions_open())

    page.click("#s-locate")
    page.wait_for_timeout(500)
    menu = is_open("#s-sheet")
    page.keyboard.press("Escape")
    page.wait_for_timeout(600)
    check("вариант Б: „поделиться“ открывает шторку „поделиться“, после неё фокус на кнопке",
          menu and not is_open("#s-sheet") and focused() == "s-locate" and alt() and centered())

    # вариант В: над пином одна кнопка „поделиться гео“ – пока трансляции нет
    page.click("[data-entry='geo']")
    page.wait_for_timeout(500)
    single = (is_open("#s-geo-actions") and not actions_open() and not alt()
              and text("#s-geo-cta") == "поделиться гео" and page.locator("#s-geo-cta .icon--pin").count() == 1)
    check("вариант В: пока ты в центре – над пином только „поделиться гео“ с меткой",
          single and page.evaluate("location.hash") == "#geo-only")
    page.click("#s-geo-cta", force=True)
    page.wait_for_timeout(500)
    geo_only = is_open("#s-geo-sheet") and not is_open("#s-sheet") and not is_open("#s-geo-actions")
    page.keyboard.press("Escape")
    page.wait_for_timeout(600)
    check("вариант В: „поделиться гео“ – сразу шторка геопозиции; закрылась – кнопка снова над пином",
          geo_only and is_open("#s-geo-actions") and focused() == "s-geo-cta")
    drag_map()
    page.wait_for_timeout(400)
    dragged = not is_open("#s-geo-actions")
    page.click("#s-locate")
    page.wait_for_timeout(700)
    check("вариант В: сдвинул карту – кнопка ушла; „где я“ – снова пин в центре и „поделиться гео“",
          dragged and is_open("#s-geo-actions") and centered())

    # трансляция в варианте А: плашка над пином уступает место кнопкам, live-точка – на „гео“
    page.click("[data-entry='pin']")
    page.wait_for_timeout(400)
    page.click("#s-act-geo", force=True)
    page.wait_for_timeout(500)
    page.click("#s-cta")
    page.wait_for_timeout(900)
    page.keyboard.press("Escape")
    page.wait_for_timeout(600)
    chip_hidden = page.eval_on_selector("#s-live", "el => getComputedStyle(el).opacity") == "0"
    # трансляция на 15 мин идёт секунду-другую: „ещё 15:00“ или „ещё 14:59“
    left = text("#s-act-geo-label")
    badge = page.is_visible("#s-act-live") and (left.startswith("ещё 14:") or left == "ещё 15:00")
    page.mouse.click(*spot)
    page.wait_for_timeout(400)
    check("вариант А в трансляции: кнопки на месте плашки, у „гео“ live-точка и „ещё 14:xx“; закрылись – плашка вернулась",
          chip_hidden and badge and not actions_open()
          and page.eval_on_selector("#s-live", "el => getComputedStyle(el).opacity") == "1")

    # вариант В в трансляции: „поделиться гео“ не нужна – над пином плашка со временем
    page.click("[data-entry='geo']")
    page.wait_for_timeout(500)
    check("вариант В в трансляции: вместо „поделиться гео“ над пином плашка „транслируется ещё“",
          not is_open("#s-geo-actions") and page.eval_on_selector("#s-live", "el => getComputedStyle(el).opacity") == "1"
          and text("#s-live-text").startswith("транслируется ещё"))

    # сменили адрес на открытой странице – вариант переключается без перезагрузки
    page.evaluate("location.hash = 'share-button'")
    page.wait_for_timeout(300)
    live_switch = page.get_attribute("[data-entry='button']", "aria-checked") == "true"
    page.goto("about:blank")
    page.goto(url + "#share-button")
    page.wait_for_load_state("networkidle")
    check("вариант Б открывается по ссылке #share-button – и новой страницей, и сменой адреса",
          live_switch and page.get_attribute("[data-entry='button']", "aria-checked") == "true" and not alt())
    page.goto("about:blank")
    page.goto(url + "#geo-only")
    page.wait_for_load_state("networkidle")
    check("вариант В открывается по ссылке #geo-only",
          page.get_attribute("[data-entry='geo']", "aria-checked") == "true" and not is_open("#s-geo-actions"))
    page.close()


def check_overnights(browser, port: int, errors: list[str]) -> None:
    """Фича „ночлеги“: ночная карта, коллажи, список-столбики, сторис и шеринг."""
    page = browser.new_page(viewport={"width": 600, "height": 960}, device_scale_factor=1)
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(f"http://127.0.0.1:{port}/features/overnights/index.html")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1300)
    text = lambda sel: page.eval_on_selector(sel, "el => el.textContent").replace("\u00a0", " ").strip()

    page.wait_for_timeout(700)
    pins = page.evaluate("""() => [...document.querySelectorAll('#map-pins .pin')].map(el =>
        [el.querySelector('.pin__title').textContent, el.querySelector('.pin__time-value').textContent,
         el.classList.contains('pin--36') ? 36 : 52, el.querySelector('.pin__badge').getAttribute('src').endsWith('pin/overnight.png')])""")
    check("ночлеги: в герое 68 ночей не дома (растёт с 1); на карте дома друзей – пины с лицом, ночёвкой и числом ночей",
          text("#away-nights") == "68" and text("#away-unit") == "ночей не дома"
          and pins == [["наташка", "25", 52, True], ["лёва", "9", 36, True], ["соня", "4", 36, True], ["вася", "2", 36, True]]
          and page.locator("#unique-places, .overnights__city").count() == 0)
    split = [text(f"#split .split--{g} .split__number") + " " + text(f"#split .split--{g} .split__title") for g in ("friend", "friends", "cities")]
    overlap = page.evaluate("""() => [...document.querySelectorAll('#split .split')].every(el =>
        el.querySelector('.split__number').getBoundingClientRect().top < el.querySelector('.split__art').getBoundingClientRect().bottom)""")
    check("ночлеги: коллажи – ночей с наташкой, дома друзей (стопка вырезок), города (плотная стопка); число наезжает на картинку",
          split == ["25 ночей с наташкой", "4 дома друзей", "3 города"] and overlap
          and page.locator("#split .split__head").count() == 3
          and page.locator("#split .split__cutout .cutout__rim").count() == 1
          and page.locator("#split .split__trip").count() == 3 and page.locator(".split__percent").count() == 0)
    rows = page.locator("#list .night-row")
    shares = page.evaluate("[...document.querySelectorAll('#list .night-row')].map(el => parseFloat(el.style.getPropertyValue('--share')))")
    arts = page.evaluate("""() => [...document.querySelectorAll('#list .night-row')].slice(0, 2).map(el =>
        [...el.querySelectorAll('.night-row__art img')].map(i => i.getAttribute('src').split('/').pop()))""")
    check("ночлеги: в списке 6 мест с шевронами, подложка – по числу ночей; дом – домик, у друга – вырезка без фона и ночёвка в углу",
          rows.count() == 6 and shares[0] == 1 and shares == sorted(shares, reverse=True) and text("#more") == "показать все 15"
          and page.locator("#list .night-row__chevron").count() == 6
          and arts == [["home.webp"], ["cutout-1.webp", "rim-offline.png", "nighthouse.webp"]]
          and page.locator("#list img[src*='photo-']").count() == 0)
    page.click("#more")
    check("ночлеги: „показать все“ раскрывает 15 мест и становится „свернуть“",
          rows.count() == 15 and text("#more") == "свернуть")
    page.click("#share")
    page.wait_for_timeout(500)
    opened = page.evaluate("document.getElementById('story-sheet').classList.contains('is-open')")
    story = page.evaluate("""() => { const st = document.getElementById('story-summary');
        return [st.querySelector('.screen-title').textContent, st.querySelector('.night-map__number').textContent,
                st.querySelectorAll('.pin').length, st.querySelectorAll('.split').length,
                st.querySelectorAll('.night-row, [data-story-hide], [id]').length]; }""")
    fill = page.evaluate("""() => {
        const story = document.getElementById('story').getBoundingClientRect();
        const box = document.querySelector('#story-summary > *').getBoundingClientRect();
        const logo = document.querySelector('#story .story__logo').getBoundingClientRect();
        const title = document.querySelector('#story .screen-title').getBoundingClientRect();
        return box.height / story.height > 0.85 && logo.bottom <= title.top && logo.left <= title.left + 1; }""")
    check("ночлеги: сторис – та же сводка без списка на всю высоту 9:16, лого BLINK над „мои ночлеги“",
          opened and story == ["мои ночлеги", "68", 4, 3, 0] and fill
          and "blinkmap.com" not in text("#story") and text("#story-title") == "поделиться" and text("#share") == "поделиться"
          and abs(page.evaluate("(r => r.width / r.height)(document.getElementById('story').getBoundingClientRect())") - 9 / 16) < 0.01)
    has_share = page.evaluate("Boolean(navigator.share)")
    page.click("#story-share")
    page.wait_for_timeout(300)
    check("ночлеги: „поделиться“ – системное меню, а без него текст со ссылкой копируется, кнопка говорит „скопировано“",
          has_share or text("#story-share-label") == "скопировано")
    page.keyboard.press("Escape")
    page.wait_for_timeout(500)
    check("ночлеги: Esc закрывает сторис, фокус – на кнопке шеринга",
          not page.evaluate("document.getElementById('story-sheet').classList.contains('is-open')")
          and page.evaluate("document.activeElement.id") == "share")
    for w in (375, 430):
        page.set_viewport_size({"width": w, "height": 812})
        page.wait_for_timeout(200)
        check(f"ночлеги: {w} – без горизонтального скролла", not page.evaluate("document.documentElement.scrollWidth > innerWidth"))
    page.close()


def main() -> int:
    server, port = serve()
    errors: list[str] = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, has_touch=True)
            page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: errors.append(str(e)))
            base = f"http://127.0.0.1:{port}/index.html"

            page.goto(base)
            page.wait_for_load_state("networkidle")
            check("по умолчанию открыта карта", active_tab(page) == "map")

            for tab in ["friends", "chats", "checkins", "profile", "map"]:
                page.click(f".tabbar__item[data-tab='{tab}']")
                check(f"таб „{tab}“ открывается", active_tab(page) == tab and page.is_visible(f"#screen-{tab}"))

            page.click(".tabbar__item[data-tab='chats']")
            page.click("#chat-list [data-go='#/chat/valentin']")
            page.wait_for_timeout(500)
            check("чат открывается из списка", chat_open(page))
            page.fill("#composer-input", "го сегодня в 8?")
            check("с текстом „фото“ меняется на „отправить“", page.is_visible("#composer-send") and not page.is_visible("#composer-photo"))
            page.press("#composer-input", "Enter")
            check("Enter отправляет сообщение", page.locator("#chat-feed .bubble--out").last.inner_text() == "го сегодня в 8?")
            page.click("#composer-style")
            page.fill("#composer-input", "ок")
            page.click("#composer-send")
            check("„Aa“ отправляет крупный текст", page.locator("#chat-feed .bubble--big").last.inner_text() == "ок")
            page.click("#composer-sticker")
            page.wait_for_timeout(400)
            page.click("[data-sticker='fire']")
            page.wait_for_timeout(200)
            last = page.locator("#chat-feed .message-row").last
            box = last.bounding_box()
            footer = page.locator(".chat__footer").bounding_box()
            check("стикер отправлен и виден над футером", last.locator("img").count() == 1 and box["y"] + box["height"] <= footer["y"] + 30)
            page.click("#chat-back")
            page.wait_for_timeout(600)
            check("„назад“ закрывает чат", not chat_open(page) and page.evaluate("document.getElementById('screen-chat').hidden"))
            check("счётчик непрочитанных снят", page.locator("#chat-list [data-go='#/chat/valentin'] .badge-star").count() == 0)

            page.click("[data-folder='danya']")
            names = page.locator("#chat-list .row__title").all_inner_texts()
            check("папка фильтрует чаты", [n.strip() for n in names] == ["валентин", "капибар"])
            page.click("[data-folder='all']")
            page.fill("#chats-search", "zzz")
            check("поиск без результатов показывает пустое состояние", "таких чатов нет" in page.inner_text("#chat-list"))
            page.fill("#chats-search", "")
            page.click("#birthday-close")
            page.wait_for_timeout(500)
            check("баннер „др“ закрывается", page.evaluate("document.getElementById('birthday-banner').offsetHeight") == 0)

            page.click(".tabbar__item[data-tab='friends']")
            page.click("[data-suggestion='kristina']")
            check("„добавить“ переключается в „добавлен“", page.get_attribute("[data-suggestion='kristina']", "aria-pressed") == "true")
            page.fill("#friends-search", "ната")
            check("поиск друзей фильтрует", page.locator(".friend-row__name").all_inner_texts() == ["наташка"])
            page.fill("#friends-search", "")
            check("в „мои друзья“ девять человек", page.locator(".friend-row").count() == 9 and page.inner_text("#friends-count") == "9")
            check("в „возможных“ пять карточек и „посмотреть всех“", page.locator(".suggestion").count() == 6)
            page.click(".tabbar__item[data-tab='chats']")
            pinned = page.evaluate("[...document.querySelectorAll('#chat-list li')].findIndex(li => li.classList.contains('chat-list__divider'))")
            check("закреплены два чата", pinned == 2)
            page.click(".tabbar__item[data-tab='friends']")
            page.fill("#friends-search", "")
            page.click("#friends-list [data-go='#/chat/vasya']")
            page.wait_for_timeout(500)
            check("кнопка „написать“ открывает новый чат", chat_open(page) and page.inner_text("#chat-name") == "вася пупкин")
            page.keyboard.press("Escape")
            page.wait_for_timeout(600)
            check("Esc закрывает чат", not chat_open(page) and active_tab(page) == "friends")

            page.click(".tabbar__item[data-tab='map']")
            page.click(".pin[data-go='#/chat/natashka']")
            page.wait_for_timeout(500)
            check("пин на карте открывает чат", chat_open(page) and page.inner_text("#chat-location-text") == "щербаков переулок 17")
            page.click("#chat-location")
            page.wait_for_timeout(600)
            check("локация в чате ведёт на карту", not chat_open(page) and active_tab(page) == "map")

            page.click(".tabbar__item[data-tab='profile']")
            page.click("#stat-friends")
            check("коллаж „друзья“ в профиле ведёт в друзей", active_tab(page) == "friends")

            page.goto(f"{base}#/chat/masha")
            page.wait_for_timeout(600)
            check("прямая ссылка #/chat/masha открывает чат", chat_open(page) and page.inner_text("#chat-name") == "маша")

            page.set_viewport_size({"width": 375, "height": 667})
            page.goto(f"{base}#/friends")
            page.wait_for_timeout(300)
            overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth")
            check("375×667: нет горизонтального скролла", not overflow)

            check_geo_share(browser, port, errors)
            check_geo_share_locate(browser, port, errors)
            check_overnights(browser, port, errors)
            browser.close()
    finally:
        server.shutdown()

    check("в консоли нет ошибок", not errors)
    for e in errors:
        print("    console:", e)
    failed = [n for n, ok in CHECKS if not ok]
    print(f"\n{len(CHECKS) - len(failed)}/{len(CHECKS)} проверок прошли")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
