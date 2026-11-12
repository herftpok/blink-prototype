"""Порог видимости места и двусторонняя переписка двух посетителей."""
from playwright.sync_api import expect


def check_feature(browser, port, errors, check):
    context = browser.new_context(viewport={'width': 1100, 'height': 920}, reduced_motion='reduce')
    def page_for_visitor():
        page = context.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('response', lambda r: errors.append(f'{r.status} {r.url}') if r.status >= 400 else None)
        return page

    url = f'http://127.0.0.1:{port}/features/gorky-park/'
    page = page_for_visitor()
    page.goto(url)
    screen = page.frame_locator('#frame')
    def move(page, preset):
        page.locator(f'label:has(input[value="{preset}"])').click()
    def open_room(page):
        page.locator('#entry').click()
        page.frame_locator('#frame').locator('#open-chat').click()
    def send(screen, text):
        screen.locator('#draft').fill(text)
        screen.locator('#draft').press('Enter')
        expect(screen.locator('#draft')).to_have_value('')

    move(page, 'far')
    check('парк: вдали метка скрыта', page.locator('#entry').is_hidden())
    move(page, 'near')
    open_room(page)
    expect(screen.locator('#locked')).to_be_visible()
    check('парк: рядом видны страница и история, поле закрыто', screen.locator('#draft').is_disabled())
    move(page, 'inside')
    expect(screen.locator('#draft')).to_be_enabled()
    send(screen, 'буду у фонтана через минуту')
    check('парк: вход открыл отправку в уже открытом чате',
          screen.locator('.park-msg--mine').last.inner_text().endswith('буду у фонтана через минуту'))
    screen.locator('#draft').fill('черновик с прогулки')
    move(page, 'near')
    expect(screen.locator('#compose')).to_be_hidden()
    check('парк: выход сразу блокирует и отправку, и поле',
          page.evaluate("!parkRoom.send('не отправлять')") and screen.locator('#draft').is_disabled())
    move(page, 'inside')
    expect(screen.locator('#draft')).to_have_value('черновик с прогулки')
    second = page_for_visitor()
    second.goto(url+'?visitor=leva')
    open_room(second)
    other = second.frame_locator('#frame')
    expect(other.locator('.park-msg:not(.park-msg--mine)').last).to_contain_text('буду у фонтана через минуту')
    send(other, 'окей, подожду здесь')
    expect(screen.locator('.park-msg:not(.park-msg--mine)').last).to_contain_text('окей, подожду здесь')
    check('парк: два посетителя получают сообщения друг друга', True)
    move(second, 'near')
    screen.locator('#show-people').click()
    expect(screen.locator('#home')).to_be_visible()
    expect(screen.locator('#others-list')).not_to_contain_text('лёва')
    check('парк: список отражает выход второго посетителя', screen.locator('#count').inner_text()=='7')
    move(second, 'inside')
    expect(screen.locator('#others-list')).to_contain_text('лёва')
    check('парк: вход возвращает участника и обновляет счётчик', screen.locator('#count').inner_text()=='8')
    second.close()
    screen.locator('#open-chat').click()
    screen.locator('#close-chat').click()
    expect(page.locator('#web')).to_be_hidden()
    check('парк: закрытие из чата возвращает фокус на метку', page.locator('#entry').evaluate('e=>e===document.activeElement'))
    move(page, 'far')
    page.reload()
    check('парк: после обновления вдали метка скрыта', page.locator('#entry').is_hidden())
    move(page,'inside')
    open_room(page)
    expect(screen.locator('#messages')).to_contain_text('окей, подожду здесь')
    check('парк: переписка сохранена при повторном входе', True)
    screen.locator('#back').click()
    expect(screen.locator('#home')).to_be_visible()
    screen.locator('#close-park').press('Escape')
    expect(page.locator('#web')).to_be_hidden()

    # Страница места: подписка, афиша с «пойду», список гостей, чекин.
    page.evaluate("document.getElementById('reset').click()")
    page.locator('#entry').click()
    check('место: название набрано шрифтом системы, подписки нет',
          screen.locator('.park-hero__title').inner_text() == 'парк горького' and screen.locator('#follow').count() == 0)
    check('место: страница не прокручивается вбок',
          screen.locator('#page-scroll').evaluate('e=>{e.scrollLeft=200;return e.scrollLeft===0}'))
    check('место: в афише шесть событий с фото', screen.locator('.park-event').count() == 6 and
          screen.locator('.park-event__photo').evaluate_all('a=>a.every(i=>i.getAttribute("src"))'))
    screen.locator('.park-event').first.click()
    expect(screen.locator('#sheet')).to_have_class(__import__('re').compile('is-open'))
    check('место: в шторке события нет крестика', screen.locator('#sheet .icon--close').count() == 0)
    screen.locator('#sheet-action').click()
    expect(screen.locator('#sheet-action')).to_have_text('иду')
    check('место: «пойду» добавляет тебя к тем, кто идёт', screen.locator('#sheet-going-label').inner_text() == 'идут 4')
    check('место: в шторке карусель из трёх фото на всю ширину',
          screen.locator('.park-gallery__slide').count() == 3 and
          screen.locator('.park-gallery__track').evaluate('e=>e.clientWidth>=innerWidth-16'))
    screen.locator('#sheet-title').press('Escape')
    expect(screen.locator('#sheet')).not_to_have_class(__import__('re').compile('is-open'))
    check('место: Esc закрывает шторку, страница остаётся', screen.locator('#home').is_visible() and page.locator('#web').is_visible())
    screen.locator('#show-all').click()
    expect(screen.locator('#people-screen')).to_be_visible()
    check('место: список гостей делит друзей и остальных',
          screen.locator('#friends-list li').count() == 3 and screen.locator('#others-list li').count() == 4)
    screen.locator('#people-back').click()
    expect(screen.locator('#home')).to_be_visible()
    before = screen.locator('.park-checkin').count()
    screen.locator('#checkin').click()
    check('место: кнопка чекина только отвечает на нажатие', screen.locator('.park-checkin').count() == before)
    check('игра: в блоке нет кнопки и огня у первого места',
          screen.locator('.park-game button').count() == 0 and screen.locator('.park-board img[src*=fire]').count() == 0)
    check('место: о парке – описание и часы работы', screen.locator('#hours dt').count() == 3 and
          len(screen.locator('#about').inner_text()) > 80)
    screen.locator('#close-park').click()
    expect(page.locator('#web')).to_be_hidden()

    # Игра «лови звезду» и пуш от парка.
    page.evaluate("document.getElementById('star-drop').click()")
    expect(page.locator('#star-walk')).to_be_enabled()
    check('игра: звезда упала – на карте нет плашки о ней', page.locator('#star-chip').count() == 0)
    page.evaluate("document.getElementById('star-walk').click()")
    expect(page.locator('#pins .pin__time-value').first).to_have_text('1')
    check('игра: кто дошёл – получает звезду на пин и в таблицу', page.evaluate("parkRoom.snapshot().stars.sasha") == 1)
    move(page, 'far')
    page.locator('#aud-near').uncheck(force=True)
    page.evaluate("document.getElementById('cabinet').requestSubmit()")
    expect(page.locator('#push')).to_have_class(__import__('re').compile('is-shown'))
    check('пуш: гость, который бывал в парке, получает его издалека',
          page.locator('#push-title').inner_text() == 'каток откроется в начале декабря')
    page.locator('#push').click()
    expect(screen.locator('#sheet')).to_have_class(__import__('re').compile('is-open'))
    check('пуш: нажатие открывает новость парка, она первая в афише',
          screen.locator('.park-event').first.locator('.park-tag').inner_text() == 'новость')
    screen.locator('#sheet-title').press('Escape')
    screen.locator('#close-park').click()
    expect(page.locator('#web')).to_be_hidden()
    page.locator('#was-here').uncheck(force=True)
    page.evaluate("document.getElementById('cabinet').requestSubmit()")
    page.wait_for_timeout(300)
    check('пуш: кто далеко и не бывал в парке, его не получает',
          'is-shown' not in page.locator('#push').get_attribute('class'))
    page.evaluate("document.getElementById('reset').click()")
    move(page, 'inside')

    for width in (375,390,430):
        page.set_viewport_size({'width':width, 'height':812})
        page.locator('#entry').click()
        expect(screen.locator('#open-chat')).to_be_visible()
        ok = screen.locator('body').evaluate('b=>b.scrollWidth<=innerWidth && [...document.images].every(i=>i.complete && i.naturalWidth)')
        screen.locator('#open-chat').click()
        move(page, 'near')
        expect(screen.locator('#locked')).to_be_visible()
        move(page, 'inside')
        expect(screen.locator('#draft')).to_be_visible()
        check(f'парк: карта, вебвью, список и ограничение чата на ширине {width}', ok and
              screen.locator('#draft').bounding_box()['y']+screen.locator('#draft').bounding_box()['height']<=812)
        screen.locator('#close-chat').click()
        expect(page.locator('#web')).to_be_hidden()
    context.close()


def check_scene(browser, port, errors, check):
    """WebGL слой, общая камера, два пальца, тап и восстановление контекста."""
    from math import hypot
    context = browser.new_context(viewport={'width':390,'height':844}, has_touch=True, reduced_motion='reduce')
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type=='error' else None)
    page.goto(f'http://127.0.0.1:{port}/features/gorky-park/')
    layer=page.locator('#park-gl')
    entry=page.locator('#entry')
    expect(layer).to_be_visible(timeout=30000)
    check('парк 3D: WebGL2 рисует модель на карте, растровый резерв скрыт',
          layer.evaluate("c=>!!c.getContext('webgl2')") and entry.locator('img').is_hidden())
    check('парк 3D: у геометрии есть глубина, высота и повторяющиеся архитектурные детали',
          page.evaluate("""async () => {
            const {createColonnade}=await import('./colonnade.js');
            const THREE=await import('three');
            const obj=createColonnade(), box=new THREE.Box3().setFromObject(obj);
            const size=box.getSize(new THREE.Vector3());
            return size.x>40 && size.y>15 && size.z>10 && obj.children.every(m=>m.isInstancedMesh) &&
                   obj.children.reduce((n,m)=>n+m.count,0)>200;
          }"""))
    def matrix():
        return page.locator('#world').evaluate("e=>Array.from(new DOMMatrix(getComputedStyle(e).transform).toFloat64Array())")
    def frames():
        page.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    bounds=entry.bounding_box()
    cx,cy=bounds['x']+bounds['width']/2,bounds['y']+bounds['height']/2
    page.mouse.move(cx,cy)
    page.mouse.wheel(0,-180)
    frames()
    check('парк 3D: колесо приближает геометрию',entry.bounding_box()['width']>bounds['width']*1.2)
    # Два пальца одновременно меняют масштаб и азимут. Масштаб и угол читаем с земли.
    before=matrix()
    touch=context.new_cdp_session(page)
    def gesture(kind,points):
        touch.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[
            {'x':x,'y':y,'id':i+1} for i,(x,y) in enumerate(points)]})
    gesture('touchStart',[(cx-40,cy),(cx+40,cy)])
    gesture('touchMove',[(cx-55,cy-37),(cx+55,cy+37)])
    gesture('touchEnd',[])
    frames()
    turned=matrix()
    check('парк 3D: разворот и увеличение двумя пальцами оставляют карту открытой',
          abs(turned[1]-before[1])>1 and hypot(*turned[:2])>hypot(*before[:2])*1.3 and page.locator('#web').is_hidden())
    start=entry.bounding_box()
    page.mouse.move(65,270);page.mouse.down();page.mouse.move(95,310,steps=5);page.mouse.up()
    frames()
    moved=entry.bounding_box()
    check('парк 3D: модель смещается вместе с картой', abs(moved['x']-start['x']-30)<1.5 and abs(moved['y']-start['y']-40)<1.5)
    entry.click()
    expect(page.frame_locator('#frame').locator('#open-chat')).to_be_visible()
    page.frame_locator('#frame').locator('#close-park').click()
    expect(layer).to_be_visible()
    loss_test=layer.evaluate("""c=>{
      const ext=c.getContext('webgl2').getExtension('WEBGL_lose_context');
      if(!ext) return false;
      window.restoreParkTestContext=()=>ext.restoreContext();
      ext.loseContext();return true;
    }""")
    if loss_test:
        expect(entry.locator('img')).to_be_visible()
        page.evaluate('window.restoreParkTestContext()')
        expect(layer).to_be_visible(timeout=15000)
        check('парк 3D: после восстановления WebGL снова видна живая сцена',entry.locator('img').is_hidden())
    page.locator('label:has(input[value="far"])').click()
    expect(layer).to_be_hidden()
    check('парк 3D: вдали слой и кнопка скрыты',entry.is_hidden())
    context.close()
