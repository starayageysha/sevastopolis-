#!/usr/bin/env python3
"""Собирает список песен радио из папок assets/radio/<станция>/.

Использование:  python3 tools/radio_playlist.py
Результат:      src/data/radio-playlist.js  (window.SEV_RADIO_TRACKS)

Как добавить песню: положите .mp3 / .m4a / .ogg в нужную папку станции
(memory, ladies, sevfm, rock, funcrimea …) и запустите скрипт ещё раз.
Песни играют по порядку номера в имени файла. Название берётся из тега
title, если его нет — «Песня NNNN».
Длительность считает ffprobe (из ffmpeg) или библиотека mutagen
(pip install mutagen) — что-то одно должно быть установлено.

В игру и в репозиторий кладём только свою музыку (Suno и т. п.) или
музыку с разрешением на использование.
"""
import json, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RADIO = os.path.join(ROOT, 'assets', 'radio')
OUT = os.path.join(ROOT, 'src', 'data', 'radio-playlist.js')
EXTS = ('.mp3', '.m4a', '.ogg')


def probe(path):
    """(длительность в секундах, название или None)"""
    try:
        import mutagen  # noqa
        from mutagen import File
        f = File(path, easy=True)
        if f is not None and f.info and f.info.length:
            title = (f.tags or {}).get('title', [None])[0] if f.tags else None
            return float(f.info.length), title
    except ImportError:
        pass
    if shutil.which('ffprobe'):
        r = subprocess.run(['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_format', path],
                           capture_output=True, text=True)
        fmt = json.loads(r.stdout or '{}').get('format', {})
        return float(fmt.get('duration', 0)), (fmt.get('tags') or {}).get('title')
    sys.exit('Нужен ffprobe (ffmpeg) или mutagen: pip install mutagen')


def main():
    data = {}
    for ch in sorted(os.listdir(RADIO)):
        d = os.path.join(RADIO, ch)
        if not os.path.isdir(d):
            continue
        tracks = []
        for name in sorted(os.listdir(d)):
            if not name.lower().endswith(EXTS):
                continue
            dur, title = probe(os.path.join(d, name))
            stem = os.path.splitext(name)[0]
            num = re.match(r'\d+', stem)
            if not title or title.strip().lower() == 'untitled':
                title = 'Песня ' + (num.group(0) if num else stem)
            tracks.append({'id': f'{ch}_{stem}', 'title': title.strip(), 'dur': round(dur, 2),
                           'src': f'assets/radio/{ch}/{name}'})
        data[ch] = tracks
        print(f'{ch:12} {len(tracks):3} песен, {sum(t["dur"] for t in tracks) / 60:.0f} мин')
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('/* Создано tools/radio_playlist.py — не править вручную, а перезапустить скрипт. */\n')
        f.write('window.SEV_RADIO_TRACKS=' + json.dumps(data, ensure_ascii=False) + ';\n')
    print('→', os.path.relpath(OUT, ROOT))


if __name__ == '__main__':
    main()
