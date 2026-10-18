"""Make drawings-scan.pdf: the clean sheets rasterised at 150 dpi and degraded like a
paper copy run through an office scanner (grey, slightly rotated and shifted, blur,
noise, specks, uneven lighting, a binding shadow, JPEG). No text layer.

Usage: python -I scan.py <drawings.pdf> <out.pdf> <work dir>
Needs Pillow + numpy (tools/.venv) and pdftoppm (poppler-utils).
"""
import glob
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter

DPI = 150


def degrade(img, rng, page):
    g = img.convert('L')
    w, h = g.size
    # slight blur from scanner optics, then toner spread
    g = g.filter(ImageFilter.GaussianBlur(0.55))
    a = np.asarray(g).astype(np.float32)
    # lighter ink, off-white paper
    a = 238 - (255 - a) * 0.86
    # rotate + shift (paper not square on the glass)
    ang = float(rng.uniform(0.45, 1.25)) * (1 if page % 2 else -1)
    g = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    g = g.rotate(ang, resample=Image.BICUBIC, expand=False, fillcolor=236,
                 translate=(int(rng.integers(-14, 15)), int(rng.integers(-10, 11))))
    a = np.asarray(g).astype(np.float32)
    # uneven illumination + binding shadow on the left edge
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    light = 1.0 - 0.05 * ((xx / w - 0.55) ** 2 + (yy / h - 0.45) ** 2)
    shadow = 1.0 - 0.28 * np.exp(-xx / (w * 0.012))
    a = a * light * shadow
    # sensor noise
    a += rng.normal(0, 7.5, a.shape).astype(np.float32)
    # dust specks
    n = int(rng.integers(250, 450))
    ys = rng.integers(0, h, n)
    xs = rng.integers(0, w, n)
    for y, x in zip(ys, xs):
        r = int(rng.integers(1, 3))
        a[max(0, y - r):y + r, max(0, x - r):x + r] -= float(rng.uniform(60, 140))
    # a faint vertical fold line
    fx = int(w * rng.uniform(0.48, 0.52))
    a[:, fx:fx + 2] -= 22
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def main():
    src, out, work = sys.argv[1:4]
    os.makedirs(work, exist_ok=True)
    for f in glob.glob(os.path.join(work, 'raw-*.png')):
        os.remove(f)
    subprocess.run(['pdftoppm', '-r', str(DPI), '-gray', '-png', src, os.path.join(work, 'raw')], check=True)
    pages = sorted(glob.glob(os.path.join(work, 'raw-*.png')))
    rng = np.random.default_rng(20220915)
    imgs = []
    for i, p in enumerate(pages, 1):
        im = degrade(Image.open(p), rng, i)
        jp = os.path.join(work, f'scan-{i}.jpg')
        im.save(jp, quality=62, optimize=True)
        imgs.append(Image.open(jp))
    imgs[0].save(out, save_all=True, append_images=imgs[1:], resolution=DPI)
    print(f'{out}: {len(imgs)} pages at {DPI} dpi')


if __name__ == '__main__':
    main()
