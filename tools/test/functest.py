"""Функциональный смоук-тест Севастополиса в headless Chrome.
python3 functest.py URL OUT_PREFIX  -> OUT_PREFIX.json + скриншоты
"""
import asyncio, json, sys, time
from playwright.async_api import async_playwright
import os as _os
# Chrome: переменная CHROME_PATH или браузер Playwright по умолчанию (playwright install chromium)
CHROME = {'executable_path': _os.environ['CHROME_PATH']} if _os.environ.get('CHROME_PATH') else {}

URL, OUT = sys.argv[1], sys.argv[2]
_os.makedirs(_os.path.dirname(_os.path.abspath(OUT)), exist_ok=True)


async def enter(page, sc):
    await page.get_by_text('Играть').first.click(); await page.wait_for_timeout(3500)
    await page.evaluate("document.querySelector('button.pin--city').click()"); await page.wait_for_timeout(800)
    await page.evaluate("document.querySelector('.sheet__go') && document.querySelector('.sheet__go').click()"); await page.wait_for_timeout(3500)
    await page.evaluate("t=>{const b=[...document.querySelectorAll('#screens button.pin')].find(e=>e.textContent.includes(t)); b&&b.click()}", sc)
    await page.wait_for_timeout(800)
    await page.evaluate("()=>{const g=[...document.querySelectorAll('.sheet__go')].find(e=>e.offsetParent); g&&g.click()}")
    await page.wait_for_function("()=>window.__sevGame && window.__sev && document.getElementById('loading').hidden", timeout=300000)


POS = "(()=>{const c=window.__sevGame.player.collider.position;return [c.x,c.y,c.z]})()"


async def hold(page, key, ms):
    await page.keyboard.down(key); await page.wait_for_timeout(ms); await page.keyboard.up(key)


async def run():
    R = {'url': URL, 'checks': {}, 'errors': []}
    C = R['checks']
    async with async_playwright() as p:
        br = await p.chromium.launch(**CHROME, args=[
            '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
            '--autoplay-policy=no-user-gesture-required'])
        ctx = await br.new_context(viewport={'width': 412, 'height': 915}, is_mobile=False, has_touch=True)
        page = await ctx.new_page()
        page.on('pageerror', lambda e: R['errors'].append('PAGEERROR ' + str(e)[:250]))
        page.on('console', lambda m: R['errors'].append(m.text[:250]) if m.type == 'error' and 'favicon' not in m.text and 'Failed to load resource' not in m.text else None)
        bad = []
        page.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else None)

        await page.goto(URL); await page.wait_for_timeout(3000)
        C['splash_has_play'] = await page.get_by_text('Играть').count() > 0
        t = time.time(); await enter(page, 'Парк Победы'); C['pobedy_ready_sec'] = round(time.time() - t, 1)
        await page.wait_for_timeout(4000)
        await page.screenshot(path=OUT + '_1_pobedy.png')

        # 1. Управление персонажем (WASD)
        await page.mouse.click(206, 300)
        p0 = await page.evaluate(POS); await hold(page, 'KeyW', 2500); p1 = await page.evaluate(POS)
        await hold(page, 'KeyA', 1200); p2 = await page.evaluate(POS)
        d = lambda a, b: round(((a[0] - b[0]) ** 2 + (a[2] - b[2]) ** 2) ** .5, 2)
        C['move_W_dist'] = d(p0, p1); C['move_A_dist'] = d(p1, p2)
        # 2. Прыжок
        y0 = (await page.evaluate(POS))[1]
        await page.keyboard.press('Space'); await page.wait_for_timeout(250)
        C['jump_dy'] = round((await page.evaluate(POS))[1] - y0, 2)
        await page.wait_for_timeout(1500)
        # 3. NPC
        C['npc'] = await page.evaluate("""(()=>{const N=window.SevNPC;let all=[];try{all=N.getAll()}catch(e){};
            return {count:all.length, ids:all.slice(0,8).map(n=>n.id||n.name||'?'),
                    manager:!!N.manager, quests:Object.keys(N.quests||{}).length}})()""")
        # 4. Лассо
        await page.evaluate("document.getElementById('btnGrab').click()"); await page.wait_for_timeout(1200)
        C['lasso'] = await page.evaluate("""(()=>{const s=window.__grabState;let j;try{j=typeof s==='function'?String(s()):JSON.stringify(s)}catch(e){j='ERR '+e};return {state:String(j).slice(0,160), err:String(window.__grabErr||'')}})()""")
        await page.screenshot(path=OUT + '_2_lasso.png')
        await page.evaluate("document.getElementById('btnGrab').click()"); await page.wait_for_timeout(600)
        # 5. Транспорт: самокат (покупка за монеты, посадка, езда, высадка)
        C['vehicle'] = await page.evaluate("""(()=>{const S=window.__sevVehicleStore,r={};try{
            r.items=Object.keys(S.byLoc||{}).length; r.ownedBefore=String(JSON.stringify(S.owned)).slice(0,80);
            S.add(500); r.coins=S.coins;
            const ids=['scooter','kidcar','car','tank']; r.buy={};
            for(const id of ids){try{r.buy[id]=S.canBuy(id)?(S.buy(id),'bought'):(S.has(id)?'owned':'no')}catch(e){r.buy[id]='ERR '+e.message}}
            r.select=String(S.selectVehicle('scooter')); r.toggle=String(S.toggleRide());
            r.riding=S.riding; r.current=S.currentVehicle();}catch(e){r.err=String(e)} return r})()""")
        await page.wait_for_timeout(1500)
        q0 = await page.evaluate(POS); await hold(page, 'KeyW', 2000); q1 = await page.evaluate(POS)
        C['vehicle']['ride_dist'] = d(q0, q1)
        C['vehicle']['player_riding'] = await page.evaluate("window.__sevGame.player.riding")
        await page.screenshot(path=OUT + '_3_ride.png')
        C['vehicle']['dismount'] = await page.evaluate("(()=>{try{window.__sevVehicleStore.toggleRide();return window.__sevVehicleStore.riding}catch(e){return 'ERR '+e}})()")
        # 6. Звук: файлы шагов, музыки, двигателя загружаются без ошибок
        await page.wait_for_timeout(1500)
        C['audio'] = await page.evaluate("""(()=>{const g=window.__sevGame,out={};
            const feet=(g.steps&&g.steps.feet)||[];out.feet=feet.map(a=>({rs:a.readyState,err:a.error&&a.error.code}));
            const t=g._tankEngineAudio;out.tank=t?{rs:t.readyState,err:t.error&&t.error.code}:null;
            const n=window.__sevNature&&window.__sevNature.el||null;return out})()""")
        # 7. Стрельба водой
        await page.evaluate("document.getElementById('btnShoot').click()"); await page.wait_for_timeout(800)
        # 8. Другие локации (переход между районами)
        for sc, tag in (('Бухта Омега', '4_omega'), ('Херсонесский маяк', '5_mayak')):
            await page.goto(URL); await page.wait_for_timeout(2500)
            t = time.time()
            try:
                await enter(page, sc); C[tag + '_ready_sec'] = round(time.time() - t, 1)
                await page.wait_for_timeout(4000)
                C[tag + '_meshes'] = await page.evaluate("window.__sevGame.scene.meshes.length")
            except Exception as e:
                C[tag + '_ready_sec'] = 'FAIL ' + str(e)[:80]
            await page.screenshot(path=OUT + f'_{tag}.png')
        R['http_errors'] = bad[:30]
        await br.close()
    json.dump(R, open(OUT + '.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(R, ensure_ascii=False, indent=1))

asyncio.run(run())
