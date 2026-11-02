"""Playable wheel/ranking regression checks, using the same local harness as smoke.py."""
from compare import serve
from playwright.sync_api import sync_playwright

def main():
    server,port=serve()
    errors=[]
    count=0
    def check(label,condition):
        nonlocal count
        assert condition,label
        count+=1
        print('ok '+label,flush=True)
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch()
            page=browser.new_page(viewport={'width':375,'height':667})
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{port}/features/advent/?state=garland-wheel')
            js=page.evaluate
            check('wheel has eight choices and requires two selections',page.locator('[data-game="lab-pick"]').count()==8 and not page.locator('[data-game="lab-spin"]').is_enabled())
            page.locator('[data-index="0"]').click();page.locator('[data-index="2"]').click();page.locator('[data-index="3"]').click()
            check('selection is capped at two',js('AV_GAME.state().selected')==[0,2])
            page.locator('[data-index="2"]').click()
            check('selection can be undone',not page.locator('[data-game="lab-spin"]').is_enabled())
            page.locator('[data-index="5"]').click()
            before=js('[AV.S.balance,AV.S.tickets,AV.S.taken.length]')
            page.locator('[data-game="lab-spin"]').click()
            check('wheel visibly rotates',page.locator('.al-rotor').evaluate("el=>el.getAnimations().some(a=>a.playState==='running')"))
            js("AV_GAME.click({dataset:{game:'lab-spin'}},AV.gameCtx())")
            w=js('AV_GAME.state().wheel')
            check('spin awards the exact visible sector once',js('[AV.S.balance,AV.S.tickets,AV.S.taken.length,AV.S.garland.attempts]')==[before[0]-30+(w['bonus']['value'] if w['bonus']['kind']=='snow' else 0),before[1]+1+(w['bonus']['value'] if w['bonus']['kind']=='ticket' else 0),before[2]+1,1])
            page.wait_for_selector('.al-wheel-result')
            check('wheel result fits the phone',js("() => {const el=document.querySelector('.al');return el.scrollHeight<=el.clientHeight+1;}"))
            check('wheel automatically opens the awarded gift',page.locator('.al-wheel-result h4').inner_text()==w['out']['prize']['title'])
            page.click('[data-game="lab-wheel"]');page.click('[data-index="0"]');page.click('[data-index="7"]');page.click('[data-game="lab-spin"]')
            reserved=js('[AV.S.balance,AV.S.tickets,AV.S.taken.length]')
            page.click('#screen-game [data-act="back"]');page.wait_for_timeout(400);page.click('[data-go="game"].av-entry')
            page.wait_for_selector('.al-wheel-result');page.wait_for_timeout(350)
            check('leaving a spin keeps the same award without rerolling',js('[AV.S.balance,AV.S.tickets,AV.S.taken.length]')==reserved)
            page.click('[data-game="lab-score"]')
            budget=js('[AV.S.balance,AV.S.tickets,AV.S.garland.attempts]')
            page.click('[data-game="lab-start"]')
            for i in range(3):
                page.wait_for_function("() => {const r=AV_GAME.state().run;return !r.cooldown&&AV_LAB_ENGINE.active(r)===r.target;}",timeout=6000)
                page.locator('[data-game="lab-catch"]').press('Enter')
                page.locator('[data-game="lab-catch"]').press('Enter')
            check('three timed hits build combo without duplicate scoring',js('[AV_GAME.state().run.hits,AV_GAME.state().run.score,AV_LAB_ENGINE.multiplier(AV_GAME.state().run)]')==[3,300,2])
            page.wait_for_function("() => {const r=AV_GAME.state().run;return !r.cooldown&&AV_LAB_ENGINE.active(r)===r.target;}",timeout=6000)
            page.locator('[data-game="lab-catch"]').press('Enter')
            check('live reward advances at 500 and shows the next threshold',js('AV_GAME.state().run.score')==500 and '1 000' in page.locator('.al-live-prize__next').inner_text().replace('\xa0',' '))
            check('playing screen and prize fit the phone',js("() => {const el=document.querySelector('.al');return el.scrollHeight<=el.clientHeight+1;}"))
            page.click('#screen-game [data-act="back"]');page.wait_for_timeout(400)
            remaining=js('AV_GAME.state().run.remaining');page.wait_for_timeout(300)
            check('leaving pauses the clock',js('AV_GAME.state().run.remaining')==remaining)
            page.click('[data-go="game"].av-entry');page.wait_for_timeout(350);page.click('[data-game="lab-resume"]')
            for i in range(3):
                page.wait_for_function("() => {const r=AV_GAME.state().run;return !r.cooldown&&Math.abs(AV_LAB_ENGINE.active(r)-r.target)>1;}",timeout=6000)
                page.locator('[data-game="lab-catch"]').press('Enter')
            page.wait_for_selector('.al-score-result')
            check('score result fits the phone',js("() => {const el=document.querySelector('.al');return el.scrollHeight<=el.clientHeight+1;}"))
            check('three errors automatically award the visible prize without spending',js('[AV.S.balance,AV.S.garland.attempts]')==[budget[0],budget[2]] and js('AV.S.tickets')>=budget[1]+1 and js('AV_GAME.state().run.lives')==0 and page.locator('.al-received').inner_text()=='получено')
            check('reward shown matches the credited reward',page.locator('.al-score-result h4').inner_text()==js('AV_GAME.state().run.rewards.at(-1).title'))
            check('best persists in local storage',js("localStorage.getItem('blink-advent-best-v1')")=='500')
            page.click('[data-game="lab-ranking"]')
            check('leaderboard labels demo data and includes the player',page.locator('.al-ranking .is-you b').inner_text()=='500' and 'демо-рейтинг' in page.locator('.al-heading').inner_text())
            page.click('[data-game="lab-score"]');page.click('[data-game="lab-start"]')
            awards=js('[AV.S.tickets,AV.S.taken.length]')
            page.click('[data-game="lab-finish"]')
            check('repeat low score cannot claim the same prize twice',js('[AV.S.tickets,AV.S.taken.length]')==awards and 'уже получены' in page.locator('.al-note').inner_text())
            page.click('[data-game="lab-start"]')
            js('AV_GAME.state().run.score=3000;AV_GAME.state().run.remaining=10')
            page.wait_for_selector('.al-received')
            check('timeout awards remaining milestones and shows the actual item',page.locator('.al-score-result h4').inner_text()==js('AV_GAME.state().run.rewards.at(-1).title') and js('AV.S.taken.includes("tail-crystal")&&AV.S.taken.includes("vip-3")'))
            check('maximum reward result fits the phone',js("() => {const el=document.querySelector('.al');return el.scrollHeight<=el.clientHeight+1;}"))
            page.reload();js("AV.showState('garland-score')")
            check('best survives reload',page.locator('.al-record strong').inner_text().replace('\xa0',' ' )=='3 000')
            for width,height in [(375,667),(390,844),(430,932)]:
                page.set_viewport_size({'width':width,'height':height})
                for sid in ['garland','garland-wheel','garland-score','garland-ranking']:
                    js(f"AV.showState('{sid}')")
                    check(f'{sid} fits {width}x{height}',js("() => {const el=document.querySelector('#game>.al,#game>.ag');return el.scrollHeight<=el.clientHeight+1&&document.documentElement.scrollWidth<=innerWidth;}"))
            js("AV.showState('garland-wheel');AV.S.balance=0;AV_GAME.render(document.querySelector('#game'),AV.gameCtx())")
            page.click('[data-index="0"]');page.click('[data-index="1"]')
            check('insufficient funds cannot spin',not page.locator('[data-game="lab-spin"]').is_enabled())
            page.emulate_media(reduced_motion='reduce');js("AV.showState('garland-wheel')")
            page.click('[data-index="0"]');page.click('[data-index="1"]');page.click('[data-game="lab-spin"]')
            page.wait_for_selector('.al-wheel-result',timeout=2000)
            check('reduced motion still awards the result',js('AV_GAME.state().view')=='result')
            check('no script errors',not errors)
            browser.close()
        print(f'{count} checks passed')
    finally:
        server.shutdown()

if __name__=='__main__':main()
