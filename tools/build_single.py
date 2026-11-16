#!/usr/bin/env python3
"""Собирает модульный проект обратно в один HTML-файл (для офлайна и проверки).

Использование: python3 -I build_single.py ПАПКА_ПРОЕКТА ВЫХОД.html [--revert-patches]
С --revert-patches откатывает служебные правки split.py; тогда результат
должен совпасть с исходным файлом байт в байт (это проверка разделения).
"""
import base64, json, os, re, sys

ROOT, OUT = sys.argv[1], sys.argv[2]
revert = '--revert-patches' in sys.argv
man = json.load(open(os.path.join(ROOT, 'assets-manifest.json'), encoding='utf-8'))
html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()

uris = {}
for rel, a in man['assets'].items():
    raw = open(os.path.join(ROOT, rel), 'rb').read()
    uris[rel] = 'data:' + a['mime'] + ';base64,' + base64.b64encode(raw).decode()
asset_re = re.compile('|'.join(re.escape(r) for r in sorted(uris, key=len, reverse=True)))


def embed(text):
    return asset_re.sub(lambda m: uris[m.group(0)], text)


def read(rel):
    t = open(os.path.join(ROOT, rel), encoding='utf-8').read()
    if revert:
        for p in man['patches']:
            if p['file'] == rel:
                assert t.count(p['new']) == 1
                t = t.replace(p['new'], p['old'])
    return t


out, pos = [], 0
part_re = re.compile(r'<link rel="stylesheet" href="([^"]+)" data-split="style"([^>]*)>'
                     r'|<script([^>]*) src="(src/[^"]+)"></script>')
for m in part_re.finditer(html):
    out.append(embed(html[pos:m.start()]))
    if m.group(1):
        out.append(f'<style{m.group(2)}>' + read(m.group(1)) + '</style>')
    else:
        out.append(f'<script{m.group(3)}>' + embed(read(m.group(4))) + '</script>')
    pos = m.end()
out.append(embed(html[pos:]))
open(OUT, 'w', encoding='utf-8').write(''.join(out))
print('written', OUT, os.path.getsize(OUT))
