# Вторая половина проверки цветов таджвида (см. colors.mjs): считает по снимкам, у скольких раскрашенных
# фрагментов в каждом шрифте действительно есть пиксели нужного цвета.   python tools/audit/colors.py
import json, re, os, sys, collections
from PIL import Image

D = os.path.join(os.path.dirname(__file__), "shots", "colors")
index = json.load(open(os.path.join(D, "index.json"), encoding="utf-8"))
rgb = lambda s: tuple(int(float(x)) for x in re.findall(r"[\d.]+", s)[:3])
near = lambda a, b, t=60: sum((x - y) ** 2 for x, y in zip(a, b)) < t * t
S = 2  # deviceScaleFactor
stats = collections.defaultdict(lambda: [0, 0, 0])  # (theme, font) -> всего, без цвета, цвет одинаков с текстом
by_code = collections.defaultdict(lambda: collections.defaultdict(lambda: [0, 0]))
missing = []
for shot in index:
    im = Image.open(os.path.join(D, shot["name"] + ".png")).convert("RGB")
    px = im.load()
    key = (shot["theme"], shot["font"])
    for sp in shot["spans"]:
        col, ink = rgb(sp["color"]), rgb(sp["ink"])
        stats[key][0] += 1
        by_code[shot["font"]][sp["code"]][0] += 1
        if near(col, ink, 12):
            stats[key][2] += 1
            continue
        # ищем цвет в прямоугольнике слова: знак может быть нарисован выше или ниже «коробки» самого фрагмента
        found = 0
        for (x, y, w, h) in sp["rects"]:
            wx, wy, ww, wh = sp["word"]
            x0, x1 = int((x - 2) * S), int((x + w + 2) * S)
            y0, y1 = int(min(y, wy) * S) - 8, int(max(y + h, wy + wh) * S) + 8
            for yy in range(max(0, y0), min(im.height, y1)):
                for xx in range(max(0, x0), min(im.width, x1)):
                    if near(px[xx, yy], col, 45):
                        found += 1
                        if found > 6: break
                if found > 6: break
            if found > 6: break
        if found <= 6:
            stats[key][1] += 1
            by_code[shot["font"]][sp["code"]][1] += 1
            if len(missing) < 400: missing.append((shot["name"], sp["code"], sp["text"], [hex(ord(c)) for c in sp["text"]]))
for key in sorted(stats):
    t, m, same = stats[key]
    print(f"{key[0]:5} {key[1]:13} фрагментов: {t:5}  без видимого цвета: {m:4}  цвет совпадает с цветом текста: {same}")
print()
for font in by_code:
    bad = {c: v for c, v in by_code[font].items() if v[1]}
    print(font, "по правилам (всего/без цвета):", {c: tuple(v) for c, v in sorted(by_code[font].items())} if not bad else {c: tuple(v) for c, v in sorted(bad.items())})
print()
seen = collections.Counter((m[0].split("-")[1], m[1], " ".join(m[3])) for m in missing)
for (font, code, chars), n in seen.most_common(40):
    print(f"  {font:13} правило {code}: {chars}  ×{n}")
