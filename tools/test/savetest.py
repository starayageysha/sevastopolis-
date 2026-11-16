"""Тест сохранений: прогресс, сделанный в старой версии, открывается в новой.

Обе версии должны отдаваться с ОДНОГО адреса (localStorage у браузера свой для каждого адреса):
  python3 tools/test/savetest.py http://localhost:8805/v176/index.html http://localhost:8805/v179/index.html tools/test/out/save
Шаги: в старой версии зайти в Парк Победы и набрать прогресс (монеты, покупки, станция радио, настройки) →
снимок всех ключей «sev…» → открыть новую версию → те же ключи с теми же значениями, монеты видны в игре,
есть резервная копия; кнопки «Прогресс» есть в настройках; выгрузка в файл → очистка → загрузка вернула всё.
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from nav import enter  # noqa: E402
CHROME = {'executable_path': os.environ['CHROME_PATH']} if os.environ.get('CHROME_PATH') else {}
OLD, NEW, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
SNAP = """(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);
  if(k.startsWith('sev')&&!k.startsWith('sevbackup:')&&k!=='sevdiag')o[k]=localStorage.getItem(k)}return o})()"""


async def main():
    R = {'checks': {}, 'errors': []}
    C = R['checks']
    ok = lambda name, cond, info='': C.__setitem__(name, {'ok': bool(cond), 'info': info})
    async with async_playwright() as p:
        br = await p.chromium.launch(**CHROME, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        ctx = await br.new_context(viewport={'width': 412, 'height': 915}, has_touch=True, accept_downloads=True)
        pg = await ctx.new_page()
        pg.on('pageerror', lambda e: R['errors'].append(str(e)[:200]))
        # 1. прогресс в старой версии
        await pg.goto(OLD + '?debug'); await pg.wait_for_timeout(2500)
        await enter(pg, 'Парк Победы'); await pg.wait_for_timeout(4000)
        await pg.evaluate("""(()=>{const S=window.__sevVehicleStore;S.add(777);S.buy('scooter');S.buy('kidcar');
            localStorage.setItem('sevradio',JSON.stringify({ch:3,vol:0.55}));})()""")
        await pg.wait_for_timeout(1500)
        await pg.goto('about:blank')
        await pg.goto(OLD); await pg.wait_for_timeout(2000)
        old = await pg.evaluate(SNAP)
        R['old_keys'] = sorted(old)
        ok('1_old_progress_saved', 'sevcoins' in old and 'sevshop' in old, f"{len(old)} ключей, монет {old.get('sevcoins')}")
        # 2. новая версия видит тот же прогресс
        await pg.goto(NEW); await pg.wait_for_timeout(3000)
        new = await pg.evaluate(SNAP)
        same = [k for k in old if new.get(k) == old[k]]
        changed = [k for k in old if k in new and new[k] != old[k]]
        lost = [k for k in old if k not in new]
        ok('2_keys_preserved', not lost and not changed, f"совпало {len(same)}/{len(old)}, изменено {changed}, пропало {lost}")
        bks = await pg.evaluate("window.Sev&&Sev.save.backups()")
        bk_ok = False
        if bks:
            data = json.loads(await pg.evaluate("k=>localStorage.getItem(k)", [b for b in bks if b != 'sevbackup:version'][-1]))
            bk_ok = all(data.get(k) == old[k] for k in old)
        ok('3_backup_made', bk_ok, f"копии: {bks}")
        await pg.goto(NEW + '?debug'); await pg.wait_for_timeout(2500)
        await enter(pg, 'Парк Победы'); await pg.wait_for_timeout(4000)
        coins = await pg.evaluate("window.__sevVehicleStore.coins")
        owned = await pg.evaluate("['scooter','kidcar'].map(id=>window.__sevVehicleStore.has(id))")
        ok('4_coins_and_purchases_in_game', str(coins) == str(old.get('sevcoins')) and all(owned),
           f"монет в игре {coins}, в сохранении {old.get('sevcoins')}, куплено {owned}")
        # 3. кнопки в настройках + выгрузка в файл
        await pg.goto(NEW); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('.splash__rb[data-pn=set]').click()"); await pg.wait_for_timeout(800)
        has_ui = await pg.evaluate("!!document.querySelector('.splash__pb .sevsave')")
        await pg.screenshot(path=OUT + '_settings.png')
        dl_ok, path = False, None
        if has_ui:
            async with pg.expect_download() as dl:
                await pg.evaluate("document.querySelector('.sevsave [data-sv=out]').click()")
            d = await dl.value; path = OUT + '_export.json'; await d.save_as(path)
            exp = json.load(open(path, encoding='utf-8'))
            dl_ok = exp.get('game') == 'Sevastopolis' and exp['keys'].get('sevcoins') == old.get('sevcoins')
        ok('5_settings_buttons', has_ui, 'блок «Прогресс» в настройках')
        ok('6_export_file', dl_ok, path or '')
        # 4. очистка → загрузка из файла
        if dl_ok:
            await pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('sev')&&!k.startsWith('sevbackup:')).forEach(k=>localStorage.removeItem(k))")
            cleared = await pg.evaluate(SNAP)
            n = await pg.evaluate("d=>Sev.save.importData(d)", json.load(open(path, encoding='utf-8')))
            back = await pg.evaluate(SNAP)
            ok('7_import_restores', not cleared and all(back.get(k) == old[k] for k in old), f"очищено → загружено {n} записей")
        # 5. счётчик ошибок в ?debug
        await pg.goto(NEW + '?debug'); await pg.wait_for_timeout(2500)
        ok('8_debug_counter', await pg.evaluate("!!document.getElementById('sevDiag')"), await pg.evaluate("(document.getElementById('sevDiag')||{}).textContent"))
        await br.close()
    R['passed'] = all(v['ok'] for v in C.values())
    json.dump(R, open(OUT + '.json', 'w'), ensure_ascii=False, indent=1)
    print(json.dumps(R, ensure_ascii=False, indent=1))

asyncio.run(main())
