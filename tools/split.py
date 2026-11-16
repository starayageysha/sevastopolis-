#!/usr/bin/env python3
"""Разделяет однофайловый Sevastopolis-3D-vNNN.html на модули и ресурсы.

Использование: python3 -I split.py ИСХОДНЫЙ.html ПАПКА_ПРОЕКТА

Что делает:
  * встроенные картинки/звуки/модели (data:...;base64) -> assets/...
    (только те, что код использует как обычный URL);
  * главный модуль (Vite-бандл с Babylon.js) -> src/core/game.bundle.js;
  * каждый дополнительный <script id="..."> -> src/addons/NN-id.js
    (данные -> src/data/NN-id.js);
  * каждый <style> -> src/styles/NN.css;
  * index.html остаётся точкой запуска, порядок подключения сохраняется.
Пишет manifest.json, по которому build_single.py собирает файл обратно.
"""
import base64, hashlib, json, os, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
html = open(SRC, encoding='utf-8').read()

EXT = {'image/png': 'png', 'image/webp': 'webp', 'image/jpeg': 'jpg',
       'audio/mpeg': 'mp3', 'model/gltf-binary': 'glb'}
DIR = {'png': 'images', 'webp': 'images', 'jpg': 'images', 'mp3': 'audio', 'glb': 'models'}
DATA_SCRIPTS = {'crimea3d-data', 'splash-audio', 'npc-portraits', 'glb-hero-data'}
# Текстуры BRDF самого Babylon.js: это часть движка, оставляем внутри.
KEEP_INLINE_VARS = {'DH', 'OH', 'kH'}

# Понятные имена для ресурсов, которые не удаётся назвать по коду.
RENAME = {'$8': 'ui/splash-background', 'crimea': 'maps/crimea', 'sevastopol': 'maps/sevastopol',
          'balaklava': 'maps/balaklava', 'yalta': 'maps/yalta',
          'src': 'buildings/hotel-akvamarin-front'}
SOUND_NAMES = ['footstep-1', 'footstep-2', 'nature-ambience', 'tank-engine']
assets = {}      # sha1 -> relpath
manifest = {'source': os.path.basename(SRC), 'assets': {}, 'parts': [], 'patches': []}
used_names = set()


def slug(t):
    t = re.sub(r'[^A-Za-z0-9_-]+', '-', t).strip('-').lower()
    return t or 'asset'


def name_from_context(before, owner):
    m = re.search(r'["\'`]\.\./assets/([A-Za-z0-9_/-]+)\.[a-z0-9]+["\'`]\s*:\s*["\'`]$', before)
    if m:
        return m.group(1)
    m = re.search(r'["\']?([A-Za-z_$][A-Za-z0-9_$]*)["\']?\s*[:=]\s*["\'`]$', before)
    if m:
        k = m.group(1)
        if owner == 'npc-portraits':
            return 'portraits/' + k
        if owner == 'chronicle':
            return 'chronicle/' + k
        if owner == 'crimea3d-data':
            return 'maps/crimea3d-' + {'h': 'height', 'c': 'color'}.get(k, k)
        if owner == 'splash-audio':
            return 'splash-music'
        return k
    if re.search(r'new Audio\(\s*`?$', before):
        return SOUND_NAMES.pop(0) if owner == 'main' and SOUND_NAMES else owner + '-sound'
    if re.search(r'\.src\s*=\s*`?$', before):
        return owner + '-image'
    return owner + '-asset'


def externalize(text, owner, url_prefix=''):
    """Заменяет data URI на файлы. Возвращает новый текст."""
    out, pos = [], 0
    for m in re.finditer(r'data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=]{800,})', text):
        mime, b64 = m.group(1), m.group(2)
        before = text[max(0, m.start() - 160):m.start()]
        vm = re.search(r'([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*`$', before)
        if mime not in EXT or (owner == 'main' and vm and vm.group(1) in KEEP_INLINE_VARS):
            continue
        raw = base64.b64decode(b64)
        h = hashlib.sha1(raw).hexdigest()
        ext = EXT[mime]
        if h not in assets:
            base = name_from_context(before, owner)
            if owner == 'main' and vm and vm.group(1) == 'L4':
                base = 'fox-hero'
            base = RENAME.get(base, base)
            parts = [slug(p) for p in base.split('/')]
            rel = 'assets/' + DIR[ext] + '/' + '/'.join(parts)
            cand, i = rel + '.' + ext, 2
            while cand in used_names:
                cand, i = f'{rel}-{i}.{ext}', i + 1
            used_names.add(cand)
            p = os.path.join(OUT, cand)
            os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, 'wb').write(raw)
            assets[h] = cand
            manifest['assets'][cand] = {'mime': mime, 'sha1': h, 'bytes': len(raw)}
        out.append(text[pos:m.start()])
        out.append(url_prefix + assets[h])
        pos = m.end()
    out.append(text[pos:])
    return ''.join(out)


# --- разбор верхнего уровня: <script> и <style> по порядку ---
blocks, pos = [], 0
tag_re = re.compile(r'<(script|style)\b([^>]*)>', re.I)
while True:
    m = tag_re.search(html, pos)
    if not m:
        break
    kind, attrs = m.group(1).lower(), m.group(2)
    end = html.find(f'</{kind}>', m.end())
    assert end > 0, 'unclosed ' + kind
    blocks.append((m.start(), end + len(kind) + 3, kind, attrs, html[m.end():end]))
    pos = end + len(kind) + 3

os.makedirs(OUT, exist_ok=True)
index, last, n_style, n_script = [], 0, 0, 0
for start, stop, kind, attrs, body in blocks:
    index.append(externalize(html[last:start], 'markup'))
    last = stop
    if kind == 'style':
        n_style += 1
        rel = f'src/styles/{n_style:02d}.css'
        os.makedirs(os.path.join(OUT, 'src/styles'), exist_ok=True)
        open(os.path.join(OUT, rel), 'w', encoding='utf-8').write(body)
        index.append(f'<link rel="stylesheet" href="{rel}" data-split="style"{attrs}>')
        manifest['parts'].append({'kind': 'style', 'file': rel, 'attrs': attrs})
        continue
    n_script += 1
    idm = re.search(r'id="([^"]+)"', attrs)
    sid = idm.group(1) if idm else None
    if 'type="module"' in attrs:
        owner, rel = 'main', 'src/core/game.bundle.js'
    elif sid in DATA_SCRIPTS:
        owner, rel = sid, f'src/data/{n_script:02d}-{sid}.js'
    else:
        owner = sid or 'inline'
        rel = f'src/addons/{n_script:02d}-{sid or "vehicle-store-hook"}.js'
    new = externalize(body, owner)
    if owner == 'main':
        old_z4 = ('async function z4(){if(R4)return R4;{let e=atob(L4.slice(L4.indexOf(`,`)+1)),'
                  't=new Uint8Array(e.length);for(let n=0;n<e.length;n++)t[n]=e.charCodeAt(n);R4=t}return R4}')
        new_z4 = ('async function z4(){if(R4)return R4;{let r=await fetch(L4);'
                  'if(!r.ok)throw Error(`fox-hero.glb: HTTP `+r.status);R4=new Uint8Array(await r.arrayBuffer())}return R4}')
        assert new.count(old_z4) == 1, 'z4 pattern not found'
        new = new.replace(old_z4, new_z4)
        manifest['patches'].append({'file': rel, 'old': old_z4, 'new': new_z4,
                                    'why': 'модель лисы грузится из файла, а не раскодируется из base64'})
    p = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(new)
    index.append(f'<script{attrs} src="{rel}"></script>')
    manifest['parts'].append({'kind': 'script', 'file': rel, 'attrs': attrs, 'id': sid})
index.append(externalize(html[last:], 'markup'))

open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(''.join(index))
json.dump(manifest, open(os.path.join(OUT, 'assets-manifest.json'), 'w'), ensure_ascii=False, indent=1)
print('scripts', n_script, 'styles', n_style, 'assets', len(assets))
