"""Эталонные кадры: день / вечер / ночь × Парк Победы, Омега, маяк.

Снять кадры:   python3 tools/test/visualtest.py shoot URL ПАПКА [сцены] [время суток]
Сравнить:      python3 tools/test/visualtest.py compare ПАПКА_ЭТАЛОН ПАПКА_НОВАЯ [ПАПКА_ШУМ]
Погода фиксируется «солнечно», интерфейс (верх и низ экрана) в сравнение не входит.
Жители, волны и монеты двигаются, поэтому кадры никогда не совпадают до пикселя: порог берётся
из «шума» — разницы между двумя съёмками одной и той же версии.
"""
import asyncio, json, os, sys
SCENES = ['Парк Победы', 'Бухта Омега', 'Херсонесский маяк']
TODS = ['day', 'evening', 'night']
SLUG = {'Парк Победы': 'pobedy', 'Бухта Омега': 'omega', 'Херсонесский маяк': 'mayak'}
BOX = (0, 130, 412, 700)          # область сравнения: без HUD сверху и кнопок снизу


async def shoot(url, out, scenes, tods):
    from playwright.async_api import async_playwright
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from nav import enter
    chrome = {'executable_path': os.environ['CHROME_PATH']} if os.environ.get('CHROME_PATH') else {}
    os.makedirs(out, exist_ok=True)
    async with async_playwright() as p:
        br = await p.chromium.launch(**chrome, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
        for sc in scenes:
            for tod in tods:
                ctx = await br.new_context(viewport={'width': 412, 'height': 915}, has_touch=True)
                pg = await ctx.new_page()
                await pg.goto(f'{url}?debug&tod={tod}'); await pg.wait_for_timeout(2000)
                await pg.evaluate("window.__sevSetWx&&window.__sevSetWx('sunny')")
                await enter(pg, sc)
                await pg.evaluate("window.__sevSetWx&&window.__sevSetWx('sunny')")
                await pg.wait_for_timeout(20000)
                await pg.screenshot(path=os.path.join(out, f'{SLUG[sc]}-{tod}.png'))
                await ctx.close()
                print('кадр', SLUG[sc], tod, flush=True)
        await br.close()


def diff(a, b):
    from PIL import Image, ImageFilter
    import numpy as np
    A = Image.open(a).convert('RGB').crop(BOX); B = Image.open(b).convert('RGB').crop(BOX)
    sa = np.asarray(A.resize((103, 143)).filter(ImageFilter.GaussianBlur(1)), dtype=float)
    sb = np.asarray(B.resize((103, 143)).filter(ImageFilter.GaussianBlur(1)), dtype=float)
    ma = np.asarray(A, dtype=float).reshape(-1, 3).mean(0); mb = np.asarray(B, dtype=float).reshape(-1, 3).mean(0)
    return {'shape': round(float(np.abs(sa - sb).mean()), 2), 'color': round(float(np.abs(ma - mb).max()), 2)}


def compare(ref, new, noise=None):
    res, floor = {}, None
    if noise:
        fl = [diff(os.path.join(ref, f), os.path.join(noise, f)) for f in sorted(os.listdir(noise)) if f.endswith('.png')]
        floor = {'shape': max(x['shape'] for x in fl), 'color': max(x['color'] for x in fl)}
    lim = {'shape': max(8.0, (floor or {}).get('shape', 0) * 1.5), 'color': max(4.0, (floor or {}).get('color', 0) * 1.5)}
    for f in sorted(os.listdir(ref)):
        if f.endswith('.png') and os.path.exists(os.path.join(new, f)):
            d = diff(os.path.join(ref, f), os.path.join(new, f))
            d['ok'] = d['shape'] <= lim['shape'] and d['color'] <= lim['color']
            res[f[:-4]] = d
    out = {'noise_floor': floor, 'limits': lim, 'frames': res, 'passed': bool(res) and all(v['ok'] for v in res.values())}
    print(json.dumps(out, ensure_ascii=False, indent=1))
    return out


if __name__ == '__main__':
    if sys.argv[1] == 'shoot':
        sc = sys.argv[4].split(',') if len(sys.argv) > 4 else SCENES
        td = sys.argv[5].split(',') if len(sys.argv) > 5 else TODS
        asyncio.run(shoot(sys.argv[2], sys.argv[3], sc, td))
    else:
        r = compare(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
        json.dump(r, open(os.path.join(sys.argv[3], 'compare.json'), 'w'), ensure_ascii=False, indent=1)
