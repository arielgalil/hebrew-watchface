"""Wraps the built zips (one per screen size) into ZAB files, the format the Zepp Console takes.

A ZAB is a zip holding one '<md5>.zpk' per build and a manifest.json that lists them with the devices
each one is for. A zpk is a zip holding 'device.zip' (the zip made by tools/build_v3.py: app.js, app.json,
assets/, watchface/) and 'app-side.zip' (only app.json: the Zepp Console refuses a zpk without it, even for a
watch face with no phone-side code). Layout checked against a ZAB produced by the official `zeus build`
(@zeppos/zeus-cli 1.9.3, @zeppos/zpm 3.4.2) and against the Console's own error messages.

Run after: python3 -I tools/build_v3.py ; FACE_SIZE=480 python3 -I tools/build_v3.py
    python3 -I tools/make_zab.py
Writes in new_face/dist/: Hebrew_Date-<version>-466.zab, -480.zab and -all.zab (both zpks, one submission),
and Hebrew_Date-<version>-466.zip, -480.zip: the plain zips for sideloading and for AmazFaces (one upload per
screen size there).
"""
import hashlib
import io
import json
import os
import shutil
import time
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'new_face')
DIST = os.path.join(OUT, 'dist')
ZIPS = {466: 'hebrew_date_face_v3.zip', 480: 'hebrew_date_face_v3_480.zip'}


def app_side_zip(device_zip):
    """app-side.zip: just the app.json of the device zip (what zeus puts there for a watch face)."""
    app_json = zipfile.ZipFile(io.BytesIO(device_zip)).read('app.json')
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('app.json', app_json)
    return buf.getvalue()


def entry(size):
    device_zip = open(os.path.join(OUT, ZIPS[size]), 'rb').read()
    app = json.loads(zipfile.ZipFile(os.path.join(OUT, ZIPS[size])).read('app.json'))
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('device.zip', device_zip)
        z.writestr('app-side.zip', app_side_zip(device_zip))
    data = buf.getvalue()
    md5 = hashlib.md5(data).hexdigest()
    zpk = {'name': md5 + '.zpk', 'version': app['app']['version'], 'appType': app['app']['appType'],
           'platforms': [{'deviceSource': p['deviceSource']} for p in app['platforms']], 'md5': md5}
    return zpk, data, app


def write(path, sizes):
    zpks, files, app = [], {}, None
    for size in sizes:
        zpk, data, app = entry(size)
        zpks.append(zpk)
        files[zpk['name']] = data
    manifest = {'configVersion': app['configVersion'], 'zpks': zpks,
                'bundleInfo': {'zpm': '3.4.2', 'timeStamp': int(time.time())}}
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        for name, data in files.items():
            z.writestr(name, data)
        z.writestr('manifest.json', json.dumps(manifest, separators=(',', ':')))
    print(path, os.path.getsize(path), 'bytes,', sum(len(z['platforms']) for z in zpks), 'devices')


os.makedirs(DIST, exist_ok=True)
version = entry(466)[2]['app']['version']['name']
for sizes, tag in (((466,), '466'), ((480,), '480'), ((466, 480), 'all')):
    write(os.path.join(DIST, 'Hebrew_Date-%s-%s.zab' % (version, tag)), sizes)
for size in (466, 480):
    zip_path = os.path.join(DIST, 'Hebrew_Date-%s-%d.zip' % (version, size))
    shutil.copy(os.path.join(OUT, ZIPS[size]), zip_path)
    print(zip_path, os.path.getsize(zip_path), 'bytes (AmazFaces / sideload)')
