"""Builds the v3 Hebrew date watch face (Amazfit GTR 4, 466x466).

Draws every asset, computes the layout, writes index.js from new_face/index.template.js,
runs the face in the Node simulator, renders mockups and packs the zip.

Usage (from the project folder): python3 -I tools/build_v3.py
Outputs in new_face/: package/, png/ (viewable assets), mockup_normal.png, mockup_aod.png,
hebrew_date_face_v3.zip
"""
import json
import math
import os
import shutil
import subprocess
import sys
import time
import zipfile

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import zepp_img  # noqa: E402

OUT = os.path.join(ROOT, 'new_face')
PKG = os.path.join(OUT, 'package')
PNG = os.path.join(OUT, 'png')
FONT = os.path.join(ROOT, 'fonts', 'Heebo[wght].ttf')
SIZE = 466
C = SIZE // 2
SS = 4  # supersampling for drawn shapes

# ---- Palette ---------------------------------------------------------------
TIME = (246, 247, 250)
GOLD = (243, 196, 92)
GOLD_DIM = (150, 122, 62)
WEEKDAY = (204, 212, 224)
DATE = (198, 206, 218)
SLASH = (112, 122, 138)
VALUE = (240, 243, 247)
ICON = GOLD
AOD_TIME = (196, 199, 204)
AOD_GREY = (128, 132, 138)
AOD_GOLD = (170, 138, 72)
NEEDLE_N = (236, 88, 74)
NEEDLE_S = (214, 218, 226)

HEBREW_CHARS = [chr(c) for c in range(0x5d0, 0x5eb)] + ['׳', '״', '/', '-']


def font(weight, size):
    f = ImageFont.truetype(FONT, size)
    f.set_variation_by_name(weight.encode() if isinstance(weight, str) else weight)
    return f


def size_for_height(weight, ch, target):
    """Font size at which the ink of `ch` is `target` pixels tall."""
    for s in range(8, 300):
        b = font(weight, s).getbbox(ch)
        if b[3] - b[1] >= target:
            return s
    raise ValueError('no size fits')


def save(img, name):
    img.save(os.path.join(PNG, name))
    zepp_img.encode(img, os.path.join(PKG, 'assets', name))


def text_cell(text, f, w, h, colour, baseline, centre_by_ink=True):
    """One glyph/string in a w x h transparent cell, centred horizontally, on a fixed baseline."""
    img = Image.new('RGBA', (w, h))
    d = ImageDraw.Draw(img)
    if centre_by_ink:
        b = f.getbbox(text, anchor='ls')
        x = (w - (b[2] - b[0])) / 2 - b[0]
    else:
        x = (w - f.getlength(text)) / 2
    d.text((x, baseline), text, font=f, fill=colour + (255,), anchor='ls')
    return img


def digit_set(prefix, weight, ink_h, cell_w, cell_h, colour):
    f = font(weight, size_for_height(weight, '0', ink_h))
    baseline = (cell_h + ink_h) // 2
    for d in range(10):
        save(text_cell(str(d), f, cell_w, cell_h, colour, baseline), f'{prefix}{d}.png')
    return f, baseline


def max_digit_width(weight, ink_h):
    f = font(weight, size_for_height(weight, '0', ink_h))
    return max(f.getbbox(str(d))[2] - f.getbbox(str(d))[0] for d in range(10))


def colon_cell(w, h, colour, dot, gap):
    """Two round dots, centred; drawn supersampled."""
    big = Image.new('RGBA', (w * SS, h * SS))
    d = ImageDraw.Draw(big)
    cx = w * SS / 2
    for cy in (h * SS / 2 - gap * SS / 2, h * SS / 2 + gap * SS / 2):
        r = dot * SS / 2
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=colour + (255,))
    return big.resize((w, h), Image.LANCZOS)


def hebrew_set(prefix, weight, ink_h, cell_w, cell_h, colour, slash_colour, tracking, word_gap, extra=''):
    """Glyph images h_<hex>.png centred on their advance; returns the font metrics for JS."""
    f = font(weight, size_for_height(weight, 'ה', ink_h))
    baseline = (cell_h + ink_h) // 2 + 1
    # Keep descenders (ק ן ך ף ץ) at least 2 px above the bottom of the cell.
    descent = max(f.getbbox(ch, anchor='ls')[3] for ch in 'קןךףץ')
    baseline = min(baseline, cell_h - 2 - descent)
    advances = {}
    for ch in HEBREW_CHARS + list(extra):
        col = slash_colour if ch == '/' else colour
        save(text_cell(ch, f, cell_w, cell_h, col, baseline, centre_by_ink=False),
             f'{prefix}{ord(ch):x}.png')
        advances[ch] = round(f.getlength(ch), 1)
    advances['/'] = round(advances['/'] + 3, 1)  # air around the separators
    return {'advances': advances, 'imageW': cell_w, 'tracking': tracking, 'wordGap': word_gap}


# ---- Shapes ------------------------------------------------------------------

def canvas(w, h):
    big = Image.new('RGBA', (w * SS, h * SS))
    return big, ImageDraw.Draw(big)


def finish(big, w, h):
    return big.resize((w, h), Image.LANCZOS)


def icon_battery(size):
    big, d = canvas(size, size)
    s = SS * size / 32
    col = ICON + (255,)
    lw = int(2.2 * s)
    d.rounded_rectangle((3 * s, 10 * s, 26 * s, 23 * s), radius=3 * s, outline=col, width=lw)
    d.rounded_rectangle((26.5 * s, 13.5 * s, 29.5 * s, 19.5 * s), radius=1 * s, fill=col)
    d.rounded_rectangle((6.5 * s, 13.5 * s, 19 * s, 19.5 * s), radius=1 * s, fill=col)
    return finish(big, size, size)


def icon_steps(size):
    big, d = canvas(size, size)
    s = SS * size / 32
    col = ICON + (255,)
    for ox, oy in ((9, 7), (21, 13)):
        d.ellipse(((ox - 4) * s, oy * s, (ox + 4) * s, (oy + 11) * s), fill=col)
        d.ellipse(((ox - 3.2) * s, (oy + 12.5) * s, (ox + 3.2) * s, (oy + 17) * s), fill=col)
    return finish(big, size, size)


def seconds_dot(radius, dot_r):
    """Second-hand image: one dot at the top, the rotation point `radius` px below its centre."""
    w = int(dot_r * 2 + 4)
    top = w // 2
    h = top + radius + 2
    big, d = canvas(w, h)
    s = SS
    cx, cy = w * s / 2, top * s
    d.ellipse((cx - (dot_r + 1) * s, cy - (dot_r + 1) * s, cx + (dot_r + 1) * s, cy + (dot_r + 1) * s), fill=(6, 8, 12, 255))
    d.ellipse((cx - dot_r * s, cy - dot_r * s, cx + dot_r * s, cy + dot_r * s), fill=GOLD + (255,))
    return finish(big, w, h), w // 2, top + radius


def background():
    img = Image.new('RGB', (SIZE, SIZE))
    px = img.load()
    inner, outer = (21, 27, 38), (3, 4, 7)
    for y in range(SIZE):
        for x in range(SIZE):
            t = min(1.0, math.hypot(x - C, y - C) / (C * 1.08))
            t = t ** 1.6
            px[x, y] = tuple(int(inner[i] + (outer[i] - inner[i]) * t) for i in range(3))
    big = img.resize((SIZE * 2, SIZE * 2), Image.NEAREST).convert('RGBA')
    d = ImageDraw.Draw(big)
    s = 2
    # minute ring
    for i in range(60):
        a = math.radians(i * 6)
        hour = i % 5 == 0
        r2 = (C - 5) * s
        r1 = r2 - (11 if hour else 5) * s
        if i == 0:
            col, wdt = GOLD + (255,), 3
        elif hour:
            col, wdt = (104, 112, 128, 255), 2
        else:
            col, wdt = (52, 58, 70, 255), 1
        d.line((C * s + math.sin(a) * r1, C * s - math.cos(a) * r1, C * s + math.sin(a) * r2, C * s - math.cos(a) * r2),
               fill=col, width=wdt * s)
    return big.resize((SIZE, SIZE), Image.LANCZOS).convert('RGBA')


# ---- Build ---------------------------------------------------------------------

def build():
    for p in (PKG, PNG):
        shutil.rmtree(p, ignore_errors=True)
    os.makedirs(os.path.join(PKG, 'assets'))
    os.makedirs(os.path.join(PKG, 'watchface', 'default-target'))
    os.makedirs(PNG)

    L = {'CENTER_X': C}

    # Above the time, all the date information: weekday (or 'אור ל...'), Hebrew date, Gregorian date.
    weekday_font = hebrew_set('w_', 'Medium', 17, 26, 34, WEEKDAY, WEEKDAY, 0.5, 9)
    hebrew_set('aw_', 'Medium', 17, 26, 34, AOD_GREY, AOD_GREY, 0.5, 9)
    # Sized so the longest night line ('אור ל-כ״א/אדר א׳/תשצ״ח') still fits (tools/check_dates.cjs).
    date_ink = int(os.environ.get('DATE_INK', 19))
    date_font = hebrew_set('h_', 'SemiBold', date_ink, 30, 40, GOLD, GOLD_DIM, 0.4, 9)
    hebrew_set('ah_', 'SemiBold', date_ink, 30, 40, AOD_GOLD, (96, 80, 44), 0.4, 9)
    # Below everything: the holiday, small and in gold.
    holiday_font = hebrew_set('e_', 'SemiBold', 15, 24, 30, GOLD, GOLD, 0.4, 8)
    hebrew_set('ae_', 'SemiBold', 15, 24, 30, AOD_GOLD, AOD_GOLD, 0.4, 8)
    # Last line: candle lighting / end of Shabbat (Hebrew with digits), light grey.
    times_font = hebrew_set('n_', 'Medium', 14, 22, 28, WEEKDAY, WEEKDAY, 0.4, 7, extra='0123456789:')
    hebrew_set('an_', 'Medium', 14, 22, 28, AOD_GREY, AOD_GREY, 0.4, 7, extra='0123456789:')
    L.update(WEEKDAY_Y=58, WEEKDAY_SLOTS=10, HEBREW_Y=98, HEBREW_SLOTS=22, HOLIDAY_Y=366 - 15, HOLIDAY_SLOTS=14,
             TIMES_Y=394 - 14, TIMES_SLOTS=16)

    # Time: the centre of the screen, bold, tabular cells.
    time_ink = 88
    tw = max_digit_width('SemiBold', time_ink) + 4
    th = 96
    digit_set('time_', 'SemiBold', time_ink, tw, th, TIME)
    digit_set('at_', 'Regular', time_ink, tw, th, AOD_TIME)
    colon_w = 24
    save(colon_cell(colon_w, th, TIME, 12, 34), 'colon.png')
    save(colon_cell(colon_w, th, AOD_TIME, 9, 34), 'ac.png')
    ts = 2
    total = 4 * tw + 4 * ts + colon_w
    L.update(TIME_Y=C - th // 2, TIME_SPACE=ts, TIME_X=C - total // 2)
    L['MINUTE_X'] = L['TIME_X'] + 2 * tw + 3 * ts + colon_w

    # Gregorian date DD/MM/YY, centred.
    dw, dh, ds, slw, gap = max_digit_width('Medium', 21) + 3, 30, 1, 12, 2
    digit_set('sd_', 'Medium', 21, dw, dh, DATE)
    digit_set('as_', 'Medium', 21, dw, dh, AOD_GREY)
    slash_f = font('Light', size_for_height('Light', '/', 24))
    save(text_cell('/', slash_f, slw, dh, SLASH, (dh + 22) // 2), 'slash.png')
    save(text_cell('/', slash_f, slw, dh, (70, 72, 76), (dh + 22) // 2), 'asl.png')
    group = 2 * dw + ds
    total = 3 * group + 2 * slw + 4 * gap
    day_x = C - total // 2
    s1 = day_x + group + gap
    month_x = s1 + slw + gap
    s2 = month_x + group + gap
    year_x = s2 + slw + gap
    L.update(DATE_Y=144, DATE_W=dw, DATE_H=dh, DATE_SPACE=ds, SLASH_W=slw, DAY_X=day_x, MONTH_X=month_x,
             SLASH_XS=[s1, s2], YEAR_XS=[year_x, year_x + dw + ds])

    # Small values: digits, colon, comma, units.
    small_ink = 20  # battery and steps in the status row
    sw, sh = max_digit_width('SemiBold', small_ink) + 2, 28
    digit_set('sm_', 'SemiBold', small_ink, sw, sh, VALUE)
    small_colon_w = 9
    save(colon_cell(small_colon_w, sh, VALUE, 3.6, 9), 'smc.png')
    small_f = font('SemiBold', size_for_height('SemiBold', '0', small_ink))
    base = (sh + small_ink) // 2
    comma_w = 8
    save(text_cell(',', small_f, comma_w, sh, VALUE, base), 'sm_comma.png')
    unit_f = font('Medium', size_for_height('Medium', '0', 14))
    save(text_cell('%', unit_f, 18, sh, DATE, base), 'pct.png')
    L.update(SMALL_W=sw, COMMA_W=comma_w, SMALL_COLON_W=small_colon_w)

    # Status row under the time: battery (icon + %) on the left, steps (icon + count) on the right.
    # Only these two: sunrise/sunset, compass and altitude were taken off the face (user's decision).
    icon = 32
    save(icon_battery(icon), 'ic_battery.png')
    save(icon_steps(icon), 'ic_steps.png')
    row_y = 322
    bat_icon_x, steps_icon_x = 62, 244
    bat_x, steps_x = bat_icon_x + icon + 8, steps_icon_x + icon + 8
    assert bat_x + 3 * sw + 18 <= steps_icon_x - 14, 'battery runs into steps'
    assert steps_x + 5 * sw + comma_w <= 2 * C - 60, 'steps run out of the screen'
    L.update(ICON_SIZE=icon, ROW_Y=row_y - sh // 2, BATTERY_X=bat_x, STEPS_X=steps_x, STEP_SLOTS=8,
             ICONS=[['ic_battery.png', bat_icon_x, row_y - icon // 2], ['ic_steps.png', steps_icon_x, row_y - icon // 2]])

    save(background(), 'bg.png')

    # Mark under the 12 o'clock tick: where the times come from (GPS, Zepp sync, Jerusalem).
    place = 8
    for name, col in (('place_on.png', GOLD), ('place_sync.png', (96, 170, 240)), ('place_off.png', (92, 98, 110))):
        big, d = canvas(place, place)
        d.ellipse((SS, SS, (place - 1) * SS, (place - 1) * SS), fill=col + (255,))
        save(finish(big, place, place), name)
    L.update(PLACE_X=C - place // 2, PLACE_Y=26, PLACE_SIZE=place)

    # Seconds dot on the minute ring (ticks run from radius 217 to 228).
    dot, pos_x, pos_y = seconds_dot(222, 4.5)
    save(dot, 'sec_dot.png')
    L.update(SEC_POS_X=pos_x, SEC_POS_Y=pos_y)

    # Tap areas: [x, y, w, h, native screen]. Screen names as used by GTR 4 faces in the store.
    save(Image.new('RGBA', (16, 16)), 'transparent.png')
    L['SHORTCUTS'] = [[80, 56, 306, 124, 'ScheduleCalScreen'],                       # dates -> calendar
                      [L['TIME_X'] - 6, L['TIME_Y'], SIZE - 2 * (L['TIME_X'] - 6), 96, 'CountdownAppScreen']]  # time -> timers

    # index.js
    tpl = open(os.path.join(OUT, 'index.template.js'), encoding='utf-8').read()
    js = (tpl.replace('__LAYOUT__', json.dumps(L))
             .replace('__DATE_FONT__', json.dumps(date_font))
             .replace('__WEEKDAY_FONT__', json.dumps(weekday_font))
             .replace('__HOLIDAY_FONT__', json.dumps(holiday_font))
             .replace('__TIMES_FONT__', json.dumps(times_font)))
    # Hebrew text as \u escapes, as in v2: the file stays plain ASCII.
    js = ''.join(ch if ord(ch) < 128 else '\\u%04x' % ord(ch) for ch in js)
    index_js = os.path.join(PKG, 'watchface', 'default-target', 'index.js')
    open(index_js, 'w', encoding='utf-8').write(js)

    # app.js unchanged. app.json keeps v2's appId (1900181) with a higher version code, so it
    # installs as an update of the face already published on AmazFaces, not as a second face.
    shutil.copy(os.path.join(ROOT, 'src', 'app.js'), os.path.join(PKG, 'app.js'))
    app = json.load(open(os.path.join(ROOT, 'src', 'app.json'), encoding='utf-8'))
    app['app'].update(appId=1900181, appName='Hebrew Date', version={'code': 11, 'name': '2.4.0'},
                      description='Digital watch face with the Hebrew date, holidays and sunset date change.')
    app['i18n']['en-US']['appName'] = 'Hebrew Date'
    # Position and height for the sun times come from @zos/sensor (API 2.1); the face checks at run time
    # and keeps minVersion 1.0, so older firmware still installs it and falls back to Jerusalem.
    app['permissions'] = ['gps', 'device:os.geolocation', 'device:os.barometer', 'device:os.local_storage']
    app['runtime']['apiVersion']['target'] = '3.0.0'
    app['packageInfo']['timeStamp'] = int(time.time())
    # All GTR 4 variants from docs.zepp.com device list (7864577 was missing in v2).
    app['platforms'] = [{'name': 'Amazfit GTR 4', 'deviceSource': ds} for ds in (7930112, 7930113, 7864577)]
    app['packageInfo']['timeStamp'] = int(time.time())
    json.dump(app, open(os.path.join(PKG, 'app.json'), 'w', encoding='utf-8'), separators=(',', ':'))

    # Simulate and render.
    sim = os.path.join(ROOT, 'tools', 'simulate.cjs')
    render = os.path.join(ROOT, 'tools', 'render.py')
    widgets = os.path.join(OUT, 'widgets.json')
    with open(widgets, 'w') as f:
        subprocess.run(['node', sim, index_js, '2026-10-28T10:42:00', '12345', '35', '1'], stdout=f, check=True,
                       env=dict(os.environ, TZ='Asia/Jerusalem'))
    for level in ('normal', 'aod'):
        subprocess.run([sys.executable, '-I', render, widgets, PNG, os.path.join(OUT, f'mockup_{level}.png'), level],
                       check=True)

    # Preview: the normal mockup, round, 314 px (same size as v2).
    mock = Image.open(os.path.join(OUT, 'mockup_normal.png')).convert('RGBA')
    mask = Image.new('L', (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, SIZE - 1, SIZE - 1), fill=255)
    mock.putalpha(mask)
    prev = mock.resize((314, 314), Image.LANCZOS)
    a = prev.getchannel('A').point(lambda v: 255 if v >= 128 else 0)
    prev.putalpha(a)
    save(prev, 'preview.png')

    # Zip, laid out like the store packages (directory entries included).
    zpath = os.path.join(OUT, 'hebrew_date_face_v3.zip')
    if os.path.exists(zpath):
        os.remove(zpath)
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(os.path.join(PKG, 'app.js'), 'app.js')
        z.write(os.path.join(PKG, 'app.json'), 'app.json')
        z.writestr(zipfile.ZipInfo('assets/'), '')
        for name in sorted(os.listdir(os.path.join(PKG, 'assets'))):
            z.write(os.path.join(PKG, 'assets', name), 'assets/' + name)
        z.writestr(zipfile.ZipInfo('watchface/'), '')
        z.writestr(zipfile.ZipInfo('watchface/default-target/'), '')
        z.write(index_js, 'watchface/default-target/index.js')
    print('layout:', json.dumps(L))
    print('assets:', len(os.listdir(os.path.join(PKG, 'assets'))), 'zip bytes:', os.path.getsize(zpath))


build()
