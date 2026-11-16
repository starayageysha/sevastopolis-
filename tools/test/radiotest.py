"""Проверка радио: автозапуск в локации, воспроизведение, переключение станций, все файлы песен доступны.
python3 tools/test/radiotest.py "http://localhost:8080/index.html?debug" tools/test/out/radio
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav import enter  # noqa: E402
CHROME = {'executable_path': os.environ['CHROME_PATH']} if os.environ.get('CHROME_PATH') else {}
URL, OUT = sys.argv[1], sys.argv[2]
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)

INIT = """(()=>{const L=window.__media=[];const p=HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play=function(){if(!L.includes(this))L.push(this);return p.apply(this,arguments)}})();"""
RADIO = """(()=>{const a=window.__media.filter(m=>/assets\\/radio\\//.test(m.currentSrc||m.src));
return {name:(document.getElementById('rdName')||{}).textContent,title:(document.getElementById('rdTitle')||{}).textContent,
 players:a.map(m=>({src:decodeURIComponent((m.currentSrc||m.src).split('/assets/')[1]||''),paused:m.paused,t:+m.currentTime.toFixed(1),rs:m.readyState,err:m.error&&m.error.code})),
 radioOn:!!window.__radioOn}})()"""


async def main():
    R = {'errors': [], 'checks': {}}
    async with async_playwright() as p:
        br = await p.chromium.launch(**CHROME, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader',
                                                     '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'])
        pg = await (await br.new_context(viewport={'width': 412, 'height': 915}, has_touch=True)).new_page()
        await pg.add_init_script(INIT)
        pg.on('pageerror', lambda e: R['errors'].append(str(e)[:200]))
        bad = []
        pg.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.status >= 400 and 'favicon' not in r.url else None)
        await pg.goto(URL); await pg.wait_for_timeout(3000)
        await enter(pg, 'Парк Победы'); await pg.wait_for_timeout(8000)
        R['checks']['1_auto_in_scene'] = await pg.evaluate(RADIO)
        await pg.wait_for_timeout(5000)
        R['checks']['2_after_5s'] = await pg.evaluate(RADIO)
        for i in range(3):
            await pg.evaluate("document.getElementById('rdChNext').click()"); await pg.wait_for_timeout(4000)
            R['checks'][f'3_next_channel_{i + 1}'] = await pg.evaluate(RADIO)
        await pg.evaluate("document.getElementById('rdNext').click()"); await pg.wait_for_timeout(4000)
        R['checks']['4_next_song'] = await pg.evaluate(RADIO)
        await pg.screenshot(path=OUT + '_panel.png')
        # все файлы песен из списка отдаются сервером
        R['checks']['5_all_files'] = await pg.evaluate("""(async()=>{if(location.protocol==='file:')return 'пропущено: fetch недоступен для file://';const T=window.SEV_RADIO_TRACKS,bad=[];let n=0;
            for(const ch in T)for(const t of T[ch]){n++;const r=await fetch(t.src,{method:'HEAD'});if(!r.ok)bad.push(t.src+' '+r.status)}
            return {tracks:n,bad}})()""")
        R['http_errors'] = bad
        await br.close()
    json.dump(R, open(OUT + '.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(R, ensure_ascii=False, indent=1))

asyncio.run(main())
