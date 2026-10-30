"""Draws the widgets printed by simulate.cjs into a mockup image of the watch screen.

Usage: python3 render.py <widgets.json> <png assets dir> <out.png> <normal|aod> [HH:MM] [DD/MM] [taps]
'taps' outlines the BUTTON tap areas.
Values the system supplies (sun times, battery, altitude) use fixed sample values.
"""
import json
import sys
from PIL import Image, ImageDraw

SECONDS = 18  # sample second for the seconds dot
SAMPLE = {'BATTERY': '87', 'ALTITUDE': '812'}


def main():
    widgets_path, assets, out, level = sys.argv[1:5]
    hhmm = sys.argv[5] if len(sys.argv) > 5 else '10:42'
    ddmm = sys.argv[6] if len(sys.argv) > 6 else '28/10'
    global TAPS
    TAPS = len(sys.argv) > 7 and sys.argv[7] == 'taps'
    cache = {}

    def load(name):
        if name not in cache:
            cache[name] = Image.open(f'{assets}/{name}').convert('RGBA')
        return cache[name]

    canvas = Image.new('RGBA', (466, 466), (0, 0, 0, 255))

    def put(name, x, y):
        canvas.alpha_composite(load(name), (int(round(x)), int(round(y))))

    def digits_run(arr, text, x, y, space):
        for ch in text:
            im = load(arr[int(ch)])
            put(arr[int(ch)], x, y)
            x += im.width + space
        return x

    for w in json.load(open(widgets_path)):
        p = w['props']
        if p.get('show_level') != level or not p.get('visible', True):
            continue
        t = w['type']
        if t == 'IMG':
            im = load(p['src'])
            if 'pos_x' in p:
                angle = p.get('angle', 0) or 0
                x, y = p['x'] + p['pos_x'], p['y'] + p['pos_y']
                if angle:
                    layer = Image.new('RGBA', (466, 466))
                    layer.alpha_composite(im, (int(x), int(y)))
                    # Positive angles turn clockwise on the watch.
                    layer = layer.rotate(-angle, resample=Image.BICUBIC, center=(p['center_x'], p['center_y']))
                    canvas.alpha_composite(layer)
                else:
                    put(p['src'], x, y)
            else:
                put(p['src'], p['x'], p['y'])
        elif t == 'IMG_TIME':
            hh, mm = hhmm.split(':')
            x = digits_run(p['hour_array'], hh, p['hour_startX'], p['hour_startY'], p['hour_space'])
            put(p['hour_unit_en'], x, p['hour_startY'])
            digits_run(p['minute_array'], mm, p['minute_startX'], p['minute_startY'], p['minute_space'])
        elif t == 'IMG_DATE':
            dd, mo = ddmm.split('/')
            digits_run(p['day_en_array'], dd, p['day_startX'], p['day_startY'], p['day_space'])
            digits_run(p['month_en_array'], mo, p['month_startX'], p['month_startY'], p['month_space'])
        elif t == 'TIME_POINTER' and 'second_path' in p:
            im = load(p['second_path'])
            layer = Image.new('RGBA', (466, 466))
            layer.alpha_composite(im, (p['second_centerX'] - p['second_posX'], p['second_centerY'] - p['second_posY']))
            layer = layer.rotate(-SECONDS * 6, resample=Image.BICUBIC, center=(p['second_centerX'], p['second_centerY']))
            canvas.alpha_composite(layer)
        elif t == 'BUTTON':
            if TAPS:  # outline the tap areas for a debug view
                ImageDraw.Draw(canvas).rectangle((p['x'], p['y'], p['x'] + p['w'] - 1, p['y'] + p['h'] - 1),
                                                 outline=(80, 200, 255, 255), width=2)
        elif t == 'TEXT_IMG':
            x, y = p['x'], p['y']
            for ch in SAMPLE[p['type']]:
                name = {'.': p.get('dot_image'), '-': p.get('negative_image')}.get(ch) or p['font_array'][int(ch) if ch.isdigit() else 0]
                put(name, x, y)
                x += load(name).width + p.get('h_space', 0)
            if p.get('unit_en'):
                put(p['unit_en'], x, y)

    mask = Image.new('L', (466, 466), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 465, 465), fill=255)
    framed = Image.new('RGBA', (466, 466), (52, 52, 56, 255))
    framed.paste(canvas, (0, 0), mask)
    framed.save(out)


main()
