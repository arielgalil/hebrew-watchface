"""Makes the animated preview GIF of the watch face: new_face/dist/hebrew_date_360_portal.gif.

360 x 360, round, TRANSPARENT outside the watch face (the corners are not painted), one frame per state,
2 seconds each, looping. The frames are the real face: simulate.cjs runs new_face's index.js at the
given time and render.py draws the widgets, so the GIF follows whatever the code shows.

Run after: python3 -I tools/build_v3.py
    python3 -I tools/make_gif.py
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'new_face')
INDEX = os.path.join(OUT, 'package', 'watchface', 'default-target', 'index.js')
PNG = os.path.join(OUT, 'png')
TARGET = 360
SIZE = 466
DURATION = 2000  # ms per frame

# (ISO time in Jerusalem, level, HH:MM, DD/MM)
FRAMES = [
    ('2026-10-28T10:42:00', 'normal', '10:42', '28/10'),  # an ordinary day
    ('2026-10-30T16:40:00', 'normal', '16:40', '30/10'),  # Friday after candle lighting: 'ערב שבת'
    ('2026-10-31T10:00:00', 'normal', '10:00', '31/10'),  # Shabbat
    ('2026-10-31T17:20:00', 'normal', '17:20', '31/10'),  # Shabbat, after sunset, before it ends
    ('2026-10-31T18:00:00', 'normal', '18:00', '31/10'),  # after Shabbat: 'מוצאי שבת'
    ('2026-10-31T17:20:00', 'aod', '17:20', '31/10'),     # always-on screen
    ('2026-09-21T19:00:00', 'normal', '19:00', '21/09'),  # a holiday evening
    ('2026-11-01T06:30:00', 'normal', '06:30', '01/11'),  # Sunday morning
]


def frame(tmp, iso, level, hhmm, ddmm):
    widgets = os.path.join(tmp, 'widgets.json')
    shot = os.path.join(tmp, 'shot.png')
    with open(widgets, 'w') as f:
        subprocess.run(['node', os.path.join(ROOT, 'tools', 'simulate.cjs'), INDEX, iso, '8432', '35', '1'],
                       stdout=f, check=True, env=dict(os.environ, TZ='Asia/Jerusalem'))
    subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'tools', 'render.py'), widgets, PNG, shot, level,
                    hhmm, ddmm], check=True)
    img = Image.open(shot).convert('RGBA').resize((TARGET, TARGET), Image.LANCZOS)
    # Round, and transparent outside the circle (a GIF has one bit of transparency, so the edge is hard).
    big = Image.new('L', (TARGET * 4, TARGET * 4), 0)
    ImageDraw.Draw(big).ellipse((0, 0, TARGET * 4 - 1, TARGET * 4 - 1), fill=255)
    mask = big.resize((TARGET, TARGET), Image.LANCZOS).point(lambda v: 255 if v >= 128 else 0)
    img.putalpha(mask)
    return img


def to_gif_frame(img):
    """Palette image whose index 255 is the transparent colour."""
    alpha = img.getchannel('A')
    pal = img.convert('RGB').quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    px, a = pal.load(), alpha.load()
    for y in range(TARGET):
        for x in range(TARGET):
            if a[x, y] < 128:
                px[x, y] = 255
    return pal


def main():
    with tempfile.TemporaryDirectory() as tmp:
        frames = [to_gif_frame(frame(tmp, *spec)) for spec in FRAMES]
    dist = os.path.join(OUT, 'dist')
    os.makedirs(dist, exist_ok=True)
    path = os.path.join(dist, 'hebrew_date_360_portal.gif')
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=DURATION, loop=0, transparency=255,
                   disposal=2, optimize=False)
    print(path, os.path.getsize(path), 'bytes,', len(frames), 'frames')


main()
