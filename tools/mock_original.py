"""Renders the original v2 layout (from src/watchface index.js constants) to a PNG mockup."""
import sys
from PIL import Image, ImageDraw
P = sys.argv[1]  # folder of decoded pngs
out = sys.argv[2]
def L(n): return Image.open(f'{P}/{n}')
c = Image.new('RGBA', (466, 466), (0, 0, 0, 255))
def put(n, x, y):
    im = L(n); c.alpha_composite(im, (int(x), int(y)))
put('bg.png', 0, 0)
TIME_Y=78; DATE_Y=184; SUN_Y=332; INFO_Y=372; ALT_Y=408; DL=105
# time 10:42 : hour at 81, 64px cells + space 4, colon 32
x=81
for d in '10': put(f'time_{d}.png', x, TIME_Y); x+=64+4
put('colon.png', x, TIME_Y)
x=253
for d in '42': put(f'time_{d}.png', x, TIME_Y); x+=64+4
# date 28/10/26
for i,d in enumerate('28'): put(f'sd_{d}.png', DL+i*36, DATE_Y)
for i,d in enumerate('10'): put(f'sd_{d}.png', DL+92+i*36, DATE_Y)
put('slash.png', DL+76, DATE_Y); put('slash.png', DL+168, DATE_Y)
put('sd_2.png', DL+184, DATE_Y); put('sd_6.png', DL+216, DATE_Y)
# hebrew lines via glyph slots: simplified fixed 22px advance
ADV = {"א": 23.0, "ב": 20.2, "ג": 14.0, "ד": 19.4, "ה": 22.4, "ו": 11.5, "ז": 12.6, "ח": 23.4, "ט": 22.4, "י": 11.3, "ך": 19.4, "כ": 18.0, "ל": 18.9, "ם": 23.9, "מ": 23.9, "ן": 12.1, "נ": 13.7, "ס": 23.1, "ע": 21.4, "ף": 22.2, "פ": 21.4, "ץ": 20.0, "צ": 20.1, "ק": 22.2, "ר": 18.4, "ש": 26.8, "ת": 24.5, "׳": 7.6, "״": 15.1, "/": 14.1}
def line(text, y):
    ws=[22 if ch==' ' else ADV[ch] for ch in text]; right=233+sum(ws)/2
    for ch,w in zip(text,ws):
        left=right-w
        if ch!=' ': put('h_%x.png'%ord(ch), left+w/2-16, y)
        right=left
line('יום שלישי', 230)
line('ז׳/חשוון/תשפ״ז', 276)
for n,x,y in [('ic_sunrise.png',103,SUN_Y-4),('ic_sunset.png',247,SUN_Y-4),('ic_battery.png',111,INFO_Y-4),('ic_steps.png',239,INFO_Y-4),('ic_altitude.png',173,ALT_Y-4)]: put(n,x,y)
def small(s, x, y):
    for ch in s:
        n={'.':'smc.png',',':'sm_comma.png','%':'pct.png','m':'m.png'}.get(ch, f'sm_{ch}.png'); put(n,x,y); x+=16
small('06.31',139,SUN_Y); small('17.02',283,SUN_Y); small('87%',147,INFO_Y); small('8,432',275,INFO_Y); small('312m',209,ALT_Y)
put('compass_dial.png',193,2); put('compass_needle.png',217,10)
mask=Image.new('L',(466,466),0); ImageDraw.Draw(mask).ellipse((0,0,465,465),fill=255)
o=Image.new('RGBA',(466,466),(40,40,40,255)); o.paste(c,(0,0),mask); o.save(out)
