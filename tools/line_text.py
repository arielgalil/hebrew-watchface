"""Prints the text of the face's lines (weekday, holiday, times) from simulate.cjs output on stdin.
Spaces between words are not drawn as images, so words run together."""
import json
import re
import sys

rows = {}
for w in json.load(sys.stdin):
    p = w['props']
    m = re.match(r'(w|e|n)_([0-9a-f]+)\.png$', p.get('src', ''))
    if m and p.get('visible') and p.get('show_level') == 'normal':
        rows.setdefault(m.group(1), []).append((p.get('pos_x', 0), chr(int(m.group(2), 16))))
for key, name in (('w', 'weekday'), ('e', 'holiday'), ('n', 'times')):
    print(name, ''.join(c for _, c in sorted(rows.get(key, []), key=lambda t: t[0])))
