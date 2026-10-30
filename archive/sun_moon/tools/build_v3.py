"""Builds the v3 Hebrew date watch face (Amazfit GTR 4, 466x466).

Draws every asset, computes the layout, writes index.js from new_face/index.template.js,
runs the face in the Node simulator, renders mockups and packs the zip.

Usage (from the project folder): python3 -I tools/build_v3.py
Outputs in new_face/: package/, png/ (viewable assets), mockup_{normal,aod,night_normal,night_aod}.png,
hebrew_sun_moon.zip
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

SKY_R = 212          # radius of the sky arc (sun / moon path) and of the lower progress arcs
SILVER = (214, 220, 230)
TRACK = (40, 44, 54)
LABEL = (138, 146, 158)


def canvas(w, h):
    big = Image.new('RGBA', (w * SS, h * SS))
    return big, ImageDraw.Draw(big)


def finish(big, w, h):
    return big.resize((w, h), Image.LANCZOS)


def full_canvas():
    """Supersampled transparent canvas of the whole screen, for shapes placed by screen angle."""
    big = Image.new('RGBA', (SIZE * SS, SIZE * SS))
    return big, ImageDraw.Draw(big)


def screen_arc(d, a0, a1, colour, width, r=SKY_R):
    """Arc on a full_canvas, screen degrees (0 = 3 o'clock, clockwise)."""
    c, rr = C * SS, r * SS
    d.arc((c - rr, c - rr, c + rr, c + rr), a0, a1, fill=colour + (255,), width=int(width * SS))


def crop_box(big):
    """Downsampled full-screen image and the bounding box of what is drawn on it."""
    img = big.resize((SIZE, SIZE), Image.LANCZOS)
    return img, img.getbbox()


ARC_W = 3  # width of the ambient battery / steps arcs


def background(arcs):
    """Black (AMOLED) with the sky arc track, its horizon ticks and the battery/steps tracks."""
    big, d = full_canvas()
    d.rectangle((0, 0, SIZE * SS, SIZE * SS), fill=(4, 5, 8, 255))
    screen_arc(d, 180, 360, TRACK, 2)
    for deg in (180, 360):
        a = math.radians(deg)
        d.line([(C * SS + r * SS * math.cos(a), C * SS + r * SS * math.sin(a)) for r in (SKY_R - 7, SKY_R + 7)],
               fill=(112, 118, 130, 255), width=2 * SS)
    for a0, a1 in arcs:
        screen_arc(d, a0, a1, TRACK, ARC_W)
    return big.resize((SIZE, SIZE), Image.LANCZOS)


def sky_segment(deg, colour):
    """A piece of the sky arc `deg` wide, centred at 12 o'clock; returns image and its screen origin."""
    big, d = full_canvas()
    screen_arc(d, 270 - deg / 2 - 0.3, 270 + deg / 2 + 0.3, colour, 3)
    img, box = crop_box(big)
    return img.crop(box), box[0], box[1]


def level_frames(prefix, a_from, a_span, frames, colour):
    """IMG_LEVEL frames of a progress arc growing from a_from by a_span degrees (negative = anticlockwise)."""
    big, d = full_canvas()
    screen_arc(d, min(a_from, a_from + a_span), max(a_from, a_from + a_span), colour, ARC_W)
    box = crop_box(big)[1]
    for i in range(frames):
        big, d = full_canvas()
        if i:
            end = a_from + a_span * i / (frames - 1)
            screen_arc(d, min(a_from, end), max(a_from, end), colour, ARC_W)
        save(big.resize((SIZE, SIZE), Image.LANCZOS).crop(box), f'{prefix}{i}.png')
    return [box[0], box[1]]


def glow(size, r, colour, alpha):
    from PIL import ImageFilter
    g = Image.new('RGBA', (size, size))
    ImageDraw.Draw(g).ellipse((size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r), fill=colour + (alpha,))
    return g.filter(ImageFilter.GaussianBlur(r / 2.2))


def sun(size, colour, rays=True):
    img = glow(size, 15, colour, 110) if rays else Image.new('RGBA', (size, size))
    big = Image.new('RGBA', (size * SS, size * SS))
    d = ImageDraw.Draw(big)
    c = size * SS / 2
    r = (6.5 if rays else 5) * SS
    d.ellipse((c - r, c - r, c + r, c + r), fill=colour + (255,))
    if rays:
        for k in range(8):
            a = math.radians(k * 45 + 22.5)
            d.line([(c + q * SS * math.cos(a), c + q * SS * math.sin(a)) for q in (9.5, 13.5)],
                   fill=colour + (255,), width=int(2 * SS))
    img.alpha_composite(big.resize((size, size), Image.LANCZOS))
    return img


def moon(size, phase, lit, dark, with_glow=True):
    """Moon disc in `phase` (0 new, 0.5 full): waxing lit on the right, as seen from Israel."""
    r = 9.5
    img = glow(size, 14, lit, 50) if with_glow else Image.new('RGBA', (size, size))
    big = Image.new('RGBA', (size * SS, size * SS))
    px = big.load()
    c = size * SS / 2
    k = math.cos(2 * math.pi * phase)
    for y in range(size * SS):
        for x in range(size * SS):
            nx, ny = (x + 0.5 - c) / (r * SS), (y + 0.5 - c) / (r * SS)
            if nx * nx + ny * ny > 1:
                continue
            s = math.sqrt(1 - ny * ny)
            on = nx > k * s if phase < 0.5 else nx < -k * s
            px[x, y] = (lit if on else dark) + (255,)
    img.alpha_composite(big.resize((size, size), Image.LANCZOS))
    return img


def icon_battery(size):
    big, d = canvas(size, size)
    s = SS * size / 32
    col = GOLD + (255,)
    lw = int(2.2 * s)
    d.rounded_rectangle((3 * s, 10 * s, 26 * s, 23 * s), radius=3 * s, outline=col, width=lw)
    d.rounded_rectangle((26.5 * s, 13.5 * s, 29.5 * s, 19.5 * s), radius=1 * s, fill=col)
    d.rounded_rectangle((6.5 * s, 13.5 * s, 19 * s, 19.5 * s), radius=1 * s, fill=col)
    return finish(big, size, size)


def icon_steps(size):
    big, d = canvas(size, size)
    s = SS * size / 32
    col = GOLD + (255,)
    for ox, oy in ((9, 7), (21, 13)):
        d.ellipse(((ox - 4) * s, oy * s, (ox + 4) * s, (oy + 11) * s), fill=col)
        d.ellipse(((ox - 3.2) * s, (oy + 12.5) * s, (ox + 3.2) * s, (oy + 17) * s), fill=col)
    return finish(big, size, size)


# ---- Build ---------------------------------------------------------------------

def build():
    for p in (PKG, PNG):
        shutil.rmtree(p, ignore_errors=True)
    os.makedirs(os.path.join(PKG, 'assets'))
    os.makedirs(os.path.join(PKG, 'watchface', 'default-target'))
    os.makedirs(PNG)

    # SAFE_R: the Hebrew lines stay inside the sky arc and the lower arcs (tools/check_dates.cjs).
    L = {'CENTER_X': C, 'SKY_R': SKY_R, 'SAFE_R': SKY_R - 6}

    # Centre column, top: weekday (civil), Hebrew date in gold ('אור ל...' at night).
    weekday_font = hebrew_set('w_', 'Medium', 17, 26, 34, WEEKDAY, WEEKDAY, 0.5, 9)
    hebrew_set('aw_', 'Medium', 17, 26, 34, AOD_GREY, AOD_GREY, 0.5, 9)
    # Sized so the longest night line ('אור ל-כ״א אדר א׳ תשצ״ח') still fits (tools/check_dates.cjs).
    date_ink = int(os.environ.get('DATE_INK', 18))
    date_font = hebrew_set('h_', 'SemiBold', date_ink, 30, 40, GOLD, GOLD_DIM, 0.4, 10)
    hebrew_set('ah_', 'SemiBold', date_ink, 30, 40, AOD_GOLD, (96, 80, 44), 0.4, 10)
    # Under the date: the holiday (gold) and candle lighting / end of Shabbat (grey).
    holiday_font = hebrew_set('e_', 'SemiBold', 16, 26, 30, GOLD, GOLD, 0.4, 8)
    hebrew_set('ae_', 'SemiBold', 16, 26, 30, AOD_GOLD, AOD_GOLD, 0.4, 8)
    times_font = hebrew_set('n_', 'Medium', 14, 22, 28, WEEKDAY, WEEKDAY, 0.4, 7, extra='0123456789:')
    hebrew_set('an_', 'Medium', 14, 22, 28, AOD_GREY, AOD_GREY, 0.4, 7, extra='0123456789:')
    L.update(WEEKDAY_Y=112 - 17, WEEKDAY_SLOTS=10, HEBREW_Y=152 - 20, HEBREW_SLOTS=22,
             HOLIDAY_Y=352 - 15, HOLIDAY_SLOTS=14, TIMES_Y=382 - 14, TIMES_SLOTS=16)

    # Time: the hero. 104 px digits (the store faces for this watch have 95 px at the median, ours
    # was 72), centred on the screen (the colon on the centre), tabular cells.
    time_ink = 104
    # Heebo's digits are tabular: the advance box (80 px at this size) has about 5 px of air on each side, so
    # the cells are narrower than the advance and the glyph is centred in them.
    tw = max_digit_width('Medium', time_ink) - 6
    th = 120
    digit_set('time_', 'Medium', time_ink, tw, th, TIME)
    digit_set('at_', 'Light', time_ink, tw, th, AOD_TIME)
    colon_w = 28
    save(colon_cell(colon_w, th, TIME, 13, 40), 'colon.png')
    save(colon_cell(colon_w, th, AOD_TIME, 10, 40), 'ac.png')
    ts = 2
    total = 4 * tw + 4 * ts + colon_w
    L.update(TIME_Y=C - th // 2, TIME_SPACE=ts, TIME_X=C - total // 2)
    L['MINUTE_X'] = L['TIME_X'] + 2 * tw + 3 * ts + colon_w
    # Seconds: small, gold, top-aligned with the minutes, just after them.
    sec_ink, sec_h = 18, 26
    sec_w = max_digit_width('Medium', sec_ink) - 3
    digit_set('ss_', 'Medium', sec_ink, sec_w, sec_h, GOLD)
    L.update(SECOND_X=L['MINUTE_X'] + 2 * tw + 2 * ts + 6, SECOND_Y=193 - sec_h // 2)
    sec_end = L['SECOND_X'] + 2 * sec_w
    print('time block', L['TIME_X'], '-', L['MINUTE_X'] + 2 * tw + 2 * ts, '| seconds end at', sec_end)
    assert sec_end <= 436, 'seconds run into the sky arc'

    # Gregorian date DD.MM.YYYY under the time, larger and brighter than before.
    date_col, aod_date_col = (206, 212, 222), (140, 146, 156)
    dw, dh, ds, dotw, gap = max_digit_width('Medium', 17) + 1, 28, 1, 8, 1
    digit_set('sd_', 'Medium', 17, dw, dh, date_col)
    digit_set('as_', 'Medium', 17, dw, dh, aod_date_col)
    base = (dh + 17) // 2
    for name, col in (('dot.png', date_col), ('adot.png', aod_date_col)):
        big, d = canvas(dotw, dh)
        r = 1.8 * SS
        cx, cy = dotw * SS / 2, (base - 1.8) * SS
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=col + (255,))
        save(finish(big, dotw, dh), name)
    group = 2 * dw + ds
    total = 2 * group + 4 * dw + 3 * ds + 2 * dotw + 4 * gap
    day_x = C - total // 2
    d1 = day_x + group + gap
    month_x = d1 + dotw + gap
    d2 = month_x + group + gap
    year_x = d2 + dotw + gap
    L.update(DATE_Y=314 - dh // 2, DATE_W=dw, DATE_H=dh, DATE_SPACE=ds, DOT_W=dotw, DAY_X=day_x, MONTH_X=month_x,
             DOT_XS=[d1, d2], YEAR_XS=[year_x + i * (dw + ds) for i in range(4)])

    # Small values: digits, colon, comma, units.
    small_ink = 15  # battery and steps in the status row
    sw, sh = max_digit_width('SemiBold', small_ink) + 2, 28
    digit_set('sm_', 'SemiBold', small_ink, sw, sh, VALUE)
    small_colon_w = 9
    save(colon_cell(small_colon_w, sh, VALUE, 3.4, 9), 'smc.png')
    small_f = font('SemiBold', size_for_height('SemiBold', '0', small_ink))
    base = (sh + small_ink) // 2
    comma_w = 8
    save(text_cell(',', small_f, comma_w, sh, VALUE, base), 'sm_comma.png')
    unit_f = font('Medium', size_for_height('Medium', '0', 12))
    save(text_cell('%', unit_f, 15, sh, LABEL, base), 'pct.png')
    save(text_cell('−', small_f, 12, sh, VALUE, base), 'minus.png')
    L.update(SMALL_W=sw, COMMA_W=comma_w)

    # ---- Sky arc: track in the background, lit segments, the sun and the moon phases ----
    seg_deg = 5
    for name, col in (('seg_day.png', (172, 138, 60)), ('seg_night.png', (104, 110, 126))):
        seg, sx, sy = sky_segment(seg_deg, col)
        save(seg, name)
    L.update(SEG_DEG=seg_deg, SEG_COUNT=180 // seg_deg, SEG_POS_X=sx, SEG_POS_Y=sy)
    body = 40
    save(sun(body, GOLD), 'sun.png')
    save(sun(body, (150, 122, 60), rays=False), 'asun.png')
    for i in range(16):
        save(moon(body, i / 16, SILVER, (46, 50, 60)), f'moon_{i}.png')
        save(moon(body, i / 16, (120, 126, 136), (30, 32, 38), with_glow=False), f'amoon_{i}.png')
    L['BODY_SIZE'] = body

    # ---- Status row (y = 314): battery (icon + %) left of the Gregorian date, steps (icon + count) right.
    # The date is 135 px wide, centred; the row stays inside the round screen (half chord 185 at y 314). ----
    icon = 20
    save(icon_battery(icon), 'ic_battery.png')
    save(icon_steps(icon), 'ic_steps.png')
    row_y = 314
    L.update(ICON_SIZE=icon, ROW_ICON_Y=row_y - icon // 2, BAT_ICON_X=66, BATTERY_X=90, STEPS_ICON_X=316, STEPS_X=340,
             VALUE_Y=row_y - sh // 2, STEP_SLOTS=8)
    print('status row: sw', sw, '| battery ends', 90 + 3 * sw + 15, '(date starts', day_x, ') | steps end', 340 + 5 * sw + comma_w)
    assert 340 + 5 * sw + comma_w <= 416, 'steps run into the right arc'
    assert 90 + 3 * sw + 15 <= day_x - 8, 'battery runs into the date'

    # ---- Ambient arcs in the lower corners: battery (left, silver) and steps (right, gold), no numbers ----
    frames = 11
    bat_arc = level_frames('bat_', 158, -46, frames, (120, 128, 142))
    stp_arc = level_frames('stp_', 22, 46, frames, GOLD_DIM)
    L.update(LEVEL_FRAMES=frames, BATTERY_ARC=bat_arc, STEPS_ARC=stp_arc)
    save(background([(112, 158), (22, 68)]), 'bg.png')

    # Tap areas: [x, y, w, h, native screen]. Screen names as used by GTR 4 faces in the store.
    save(Image.new('RGBA', (16, 16)), 'transparent.png')
    L['SHORTCUTS'] = [[96, 96, SIZE - 2 * 96, 72, 'ScheduleCalScreen'],                     # Hebrew date -> calendar
                      [day_x - 6, 296, 2 * (C - day_x + 6), 36, 'ScheduleCalScreen'],       # Gregorian date -> calendar
                      [L['TIME_X'] - 6, L['TIME_Y'], SIZE - 2 * (L['TIME_X'] - 6), th, 'CountdownAppScreen']]  # time -> timers

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

    # app.js unchanged. A new appId (1900182, not used by any earlier package) so this face
    # installs next to the published 'Hebrew Date' (1900181) instead of replacing it.
    shutil.copy(os.path.join(ROOT, 'src', 'app.js'), os.path.join(PKG, 'app.js'))
    app = json.load(open(os.path.join(ROOT, 'src', 'app.json'), encoding='utf-8'))
    app['app'].update(appId=1900182, appName='Hebrew Sun & Moon', version={'code': 3, 'name': '1.2.0'},
                      description='Hebrew date watch face: the sun and moon on a sky arc, battery, steps, holidays and candle lighting.')
    app['i18n']['en-US']['appName'] = 'Hebrew Sun & Moon'
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
    # Night: the moon in its phase (the evening of 17 Heshvan -> 18, nearly full).
    night = os.path.join(OUT, 'widgets_night.json')
    with open(night, 'w') as f:
        subprocess.run(['node', sim, index_js, '2026-10-28T21:30:00', '12345', '125', '1'], stdout=f, check=True,
                       env=dict(os.environ, TZ='Asia/Jerusalem'))
    for level in ('normal', 'aod'):
        subprocess.run([sys.executable, '-I', render, night, PNG, os.path.join(OUT, f'mockup_night_{level}.png'), level,
                        '21:30'], check=True)

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
    zpath = os.path.join(OUT, 'hebrew_sun_moon.zip')
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
