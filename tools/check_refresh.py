"""Regression test: the face redrawn by the minute event must show what a fresh draw shows.

For every 20-minute window of some days (Shabbat, Friday, holidays in mid-week, a two-day holiday, an
ordinary day), draws the face at the start of the window, moves the clock to its end with the minute
event (simulate.cjs, THEN=...), and compares the weekday/holiday/times lines with a fresh draw at the end.
A difference means some change on the screen is not part of the key in updateHebrewDate.

    python3 -I tools/check_refresh.py          (after tools/build_v3.py; needs Node; takes a couple of minutes)
"""
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(ROOT, 'new_face', 'package', 'watchface', 'default-target', 'index.js')
DAYS = ['2026-09-12', '2026-09-13', '2026-09-21', '2026-09-25', '2026-10-28', '2026-10-29', '2026-10-30',
        '2026-10-31', '2026-12-04', '2027-04-02']
STEP = 20  # minutes


def lines(iso, then=None):
    env = dict(os.environ, TZ='Asia/Jerusalem')
    if then:
        env['THEN'] = then
    sim = subprocess.run(['node', os.path.join(ROOT, 'tools', 'simulate.cjs'), JS, iso], env=env, check=True,
                         capture_output=True)
    return subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'tools', 'line_text.py')], input=sim.stdout,
                          check=True, capture_output=True).stdout.decode()


def check(window):
    start, end = window
    a = lines(start.isoformat(), end.isoformat())
    b = lines(end.isoformat())
    return None if a == b else (start, end, a, b)


windows = []
for day in DAYS:
    t = datetime.fromisoformat(day + 'T00:00:00')
    for _ in range(24 * 60 // STEP):
        windows.append((t, t + timedelta(minutes=STEP)))
        t += timedelta(minutes=STEP)
with ThreadPoolExecutor(max_workers=6) as pool:
    bad = [r for r in pool.map(check, windows) if r]
for start, end, a, b in bad:
    print('STALE', start, '->', end, '\n  minute event:', a.replace('\n', ' | '), '\n  fresh draw  :', b.replace('\n', ' | '))
print(len(windows), 'windows,', len(bad), 'stale')
sys.exit(1 if bad else 0)
