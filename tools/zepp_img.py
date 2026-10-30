"""Read and write Zepp OS compiled images (the .png files inside a watch face package).

The format is a TGA file: 8-bit colour-mapped, 256-entry palette, top-left origin.
The 46-byte image ID starts with b'SOMH' followed by the real width (uint16 LE);
the header width is padded up to a multiple of 16.

Palette entries are R, G, B, A (not the usual TGA B, G, R) with PREMULTIPLIED alpha:
every colour channel is at most its alpha. Verified on the v2 assets that worked on the
watch (gold letters 255,209,69; red needle 247,68,56; no entry with colour > alpha).
Getting either wrong shows on the watch as swapped red/blue and blurry, haloed edges.
"""
import struct
import numpy as np
from PIL import Image


def decode(path):
    data = open(path, 'rb').read()
    id_len, cmap_type, img_type = data[0], data[1], data[2]
    if cmap_type != 1 or img_type != 1 or data[18:22] != b'SOMH':
        raise ValueError('not a Zepp image: ' + path)
    cmap_len = struct.unpack('<H', data[5:7])[0]
    padded_w, h = struct.unpack('<HH', data[12:16])
    real_w = struct.unpack('<H', data[22:24])[0]
    pal_start = 18 + id_len
    pal = data[pal_start:pal_start + cmap_len * 4]
    pix = data[pal_start + cmap_len * 4:]
    colours = []
    for i in range(cmap_len):
        r, g, b, a = pal[i * 4:i * 4 + 4]
        if a:  # undo the premultiplication
            r, g, b = (min(255, round(c * 255 / a)) for c in (r, g, b))
        colours.append((r, g, b, a))
    img = Image.new('RGBA', (real_w, h))
    out = img.load()
    for y in range(h):
        row = y * padded_w
        for x in range(real_w):
            out[x, y] = colours[pix[row + x]]
    return img


def _palette_and_indices(img):
    """Returns (list of 256 RGBA tuples, 2-D uint8 index array)."""
    arr = np.asarray(img, dtype=np.uint8).reshape(-1, 4).copy()
    arr[arr[:, 3] == 0] = 0  # all fully transparent pixels share one entry
    colours, inverse = np.unique(arr, axis=0, return_inverse=True)
    if len(colours) <= 256:
        pal = [tuple(int(v) for v in c) for c in colours]
        return pal + [(0, 0, 0, 0)] * (256 - len(pal)), inverse.reshape(img.size[1], img.size[0])
    alpha = arr[:, 3]
    if np.all((alpha == 0) | (alpha == 255)):
        # Opaque (or cut-out) image: median cut on RGB, one extra entry for transparency.
        q = img.convert('RGB').quantize(colors=255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
        rgb = q.getpalette()[:255 * 3]
        rgb += [0] * (255 * 3 - len(rgb))
        pal = [(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2], 255) for i in range(255)] + [(0, 0, 0, 0)]
        idx = np.asarray(q, dtype=np.uint8).copy().reshape(-1)
        idx[alpha == 0] = 255
        return pal, idx.reshape(img.size[1], img.size[0])
    # Too many colours: k-means in RGBA, seeded from the most frequent colours.
    data = arr.astype(np.float32)
    counts = np.bincount(inverse.ravel())
    centres = colours[np.argsort(-counts)[:256]].astype(np.float32)
    for _ in range(12):
        labels = np.empty(len(data), dtype=np.int64)
        for s in range(0, len(data), 65536):
            chunk = data[s:s + 65536]
            d = ((chunk[:, None, :] - centres[None, :, :]) ** 2).sum(-1)
            labels[s:s + 65536] = d.argmin(1)
        for k in range(len(centres)):
            members = data[labels == k]
            if len(members):
                centres[k] = members.mean(0)
    pal = [tuple(int(round(v)) for v in c) for c in centres]
    return pal, labels.reshape(img.size[1], img.size[0])


def encode(img, path):
    img = img.convert('RGBA')
    w, h = img.size
    padded_w = (w + 15) // 16 * 16
    pal, idx = _palette_and_indices(img)
    # Padding columns point at a transparent entry, as in the original assets.
    clear = next((i for i, c in enumerate(pal) if c[3] == 0), 0)
    pixels = np.full((h, padded_w), clear, dtype=np.uint8)
    pixels[:, :w] = idx
    pixels = pixels.tobytes()
    palette = bytearray()
    for r, g, b, a in pal:
        palette += bytes((round(r * a / 255), round(g * a / 255), round(b * a / 255), a))
    image_id = b'SOMH' + struct.pack('<H', w) + bytes(40)
    header = struct.pack('<BBBHHBHHHHBB', len(image_id), 1, 1, 0, 256, 32, 0, 0, padded_w, h, 8, 0x20)
    with open(path, 'wb') as f:
        f.write(header + image_id + palette + pixels)
