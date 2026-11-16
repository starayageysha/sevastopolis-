"""Длительный прогон: ищем утечки памяти при переходах между локациями.
python3 tools/test/soaktest.py URL МИНУТ tools/test/out/soak
Круг: войти в локацию → гулять ~40 с → вернуться на карту → следующая локация.
После каждого круга: сборка мусора, память JS, объекты сцены, элементы страницы, аудиоконтексты.
Утечка = рост от круга к кругу без возврата (сравниваем начало и конец прогона).
"""
import asyncio, json, os, random, sys, time
from playwright.async_api import async_playwright
CHROME = {'executable_path': os.environ['CHROME_PATH']} if os.environ.get('CHROME_PATH') else {}
URL, MINUTES, OUT = sys.argv[1], float(sys.argv[2]), sys.argv[3]
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
SCENES = ['Парк Победы', 'Бухта Омега', 'Херсонесский маяк']
INIT = """(()=>{const W=window;W.__ac=0;for(const n of ['AudioContext','webkitAudioContext']){const A=W[n];if(!A)continue;
 W[n]=function(...a){W.__ac++;return new A(...a)};W[n].prototype=A.prototype}})();"""
STATS = """(()=>{const g=window.__sevGame,s=g&&g.scene;return {
 heapMB:performance.memory?+(performance.memory.usedJSHeapSize/1e6).toFixed(1):null,
 meshes:s?s.meshes.length:null, materials:s?s.materials.length:null, textures:s?s.textures.length:null,
 geometries:s?s.geometries.length:null, dom:document.getElementsByTagName('*').length,
 npcMarkers:document.querySelectorAll('.npcm').length, audioCtx:window.__ac,
 engineScenes:g&&g.engine?g.engine.scenes.length:null, errors:window.Sev&&Sev.errors?Sev.errors().count:null}})()"""


async def go(page, sc):
    # с заставки, карты Крыма или карты города — до нужной локации
    if await page.get_by_text('Играть').count() and await page.evaluate("!!document.querySelector('.screen--splash.on')"):
        await page.get_by_text('Играть').first.click(); await page.wait_for_timeout(3000)
    if await page.evaluate("!!document.querySelector('button.pin--city')"):
        await page.evaluate("document.querySelector('button.pin--city').click()"); await page.wait_for_timeout(800)
        await page.evaluate("document.querySelector('.sheet__go') && document.querySelector('.sheet__go').click()"); await page.wait_for_timeout(3000)
    await page.evaluate("t=>{const b=[...document.querySelectorAll('#screens button.pin')].find(e=>e.textContent.includes(t)); b&&b.click()}", sc)
    await page.wait_for_timeout(800)
    await page.evaluate("()=>{const g=[...document.querySelectorAll('.sheet__go')].find(e=>e.offsetParent); g&&g.click()}")
    await page.wait_for_function("()=>document.body.dataset.mode==='scene' && window.__sevGame && document.getElementById('loading').hidden", timeout=300000)


async def main():
    rows, t0 = [], time.time()
    async with async_playwright() as p:
        br = await p.chromium.launch(**CHROME, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
                                                     '--js-flags=--expose-gc', '--enable-precise-memory-info'])
        pg = await (await br.new_context(viewport={'width': 412, 'height': 915}, has_touch=True)).new_page()
        await pg.add_init_script(INIT)
        await pg.goto(URL + '?debug'); await pg.wait_for_timeout(2500)
        i = 0
        while time.time() - t0 < MINUTES * 60:
            sc = SCENES[i % 3]
            await go(pg, sc); await pg.wait_for_timeout(3000)
            await pg.mouse.click(206, 300)
            for _ in range(8):                      # прогулка ~40 с
                k = random.choice(['KeyW', 'KeyW', 'KeyA', 'KeyD', 'Space'])
                await pg.keyboard.down(k); await pg.wait_for_timeout(random.randint(2500, 5000)); await pg.keyboard.up(k)
            await pg.evaluate("window.gc&&(gc(),gc())"); await pg.wait_for_timeout(1000)
            st = await pg.evaluate(STATS); st.update(cycle=i + 1, scene=sc, minute=round((time.time() - t0) / 60, 1))
            rows.append(st); print(json.dumps(st, ensure_ascii=False), flush=True)
            await pg.evaluate("document.getElementById('btnBack').click()"); await pg.wait_for_timeout(3500)
            i += 1
            json.dump({'rows': rows}, open(OUT + '.json', 'w'), ensure_ascii=False, indent=1)
        await br.close()
    # вердикт: одинаковая локация в начале и в конце прогона
    verdict = {}
    for sc in SCENES:
        r = [x for x in rows if x['scene'] == sc]
        if len(r) >= 2:
            a, b = r[0], r[-1]
            verdict[sc] = {k: [a[k], b[k]] for k in ('heapMB', 'meshes', 'materials', 'textures', 'dom', 'npcMarkers', 'audioCtx', 'engineScenes')}
    json.dump({'rows': rows, 'first_vs_last_same_scene': verdict}, open(OUT + '.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(verdict, ensure_ascii=False, indent=1))

asyncio.run(main())
