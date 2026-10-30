"""Cut 2x2 character sheets into square transparent tiles.

usage: cut.py <sheet.png> <out_dir> <name1,name2,name3,name4> [--checker]
--checker: sheet has a baked-in light checkerboard instead of real alpha.
Pieces are grouped by which quadrant their centre falls in, so a prop that
crosses the sheet's midline (the dolphin's speech bubble) stays whole.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

src, out_dir, names = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
checker = "--checker" in sys.argv

a = np.array(Image.open(src).convert("RGBA"))
rgb = a[..., :3].astype(int)

if checker:
    mx, mn = rgb.max(-1), rgb.min(-1)
    fg = ~((mx - mn < 8) & (mn > 232))
    lab, n = ndimage.label(fg)
    sizes = ndimage.sum(fg, lab, range(1, n + 1))
    keep = np.isin(lab, np.where(sizes >= 3000)[0] + 1)
    keep = ndimage.binary_fill_holes(keep)
    keep = ndimage.binary_erosion(keep, iterations=1)
    a[..., 3] = np.array(Image.fromarray((keep * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)))
else:
    a[..., 3] = np.where(a[..., 3] < 8, 0, a[..., 3])
a[a[..., 3] == 0, :3] = 0

solid = a[..., 3] > 16
lab, n = ndimage.label(solid)
sizes = ndimage.sum(solid, lab, range(1, n + 1))
centres = ndimage.center_of_mass(solid, lab, range(1, n + 1))
h, w = solid.shape
quad = {}
for i, (size, (cy, cx)) in enumerate(zip(sizes, centres), start=1):
    if size < 500:
        continue
    quad.setdefault(int(cy >= h / 2) * 2 + int(cx >= w / 2), []).append(i)

for q, name in enumerate(names):
    mine = np.isin(lab, quad[q])
    region = ndimage.binary_dilation(mine, iterations=3)
    t = a.copy()
    t[~region] = 0
    ys, xs = np.where(mine)
    t = t[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    side = int(max(t.shape[:2]) * 1.08)
    sq = np.zeros((side, side, 4), np.uint8)
    y0, x0 = (side - t.shape[0]) // 2, (side - t.shape[1]) // 2
    sq[y0:y0 + t.shape[0], x0:x0 + t.shape[1]] = t
    Image.fromarray(sq).resize((512, 512), Image.LANCZOS).save(f"{out_dir}/{name}.webp", "WEBP", quality=86, method=6)
    print(name, len(quad[q]), "pieces")
