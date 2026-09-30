# Правка вертикальных метрик шрифта Amiri Quran для веба.
# В оригинале ascent = 1.815 em (запас под знаки остановки), descent = 0.634 em, а обычные буквы
# со знаками занимают ≈ +1.12 / −0.5 em. Из-за этого арабский текст «сидит» низко в своей строке,
# хвосты букв вылезают из блока и наезжают на соседний текст, а по центру кнопок его не выровнять.
# Новые метрики (+1.40 / −0.80 em) центрированы по реальным буквам; очертания букв не меняются.
# Запуск (нужны fonttools и brotli):  python tools/font/fix-metrics.py
from pathlib import Path
from fontTools.ttLib import TTFont

here = Path(__file__).parent
font = TTFont(here / "amiri-quran.original.woff2")
ASC, DESC = 1400, -800
font["hhea"].ascent, font["hhea"].descent, font["hhea"].lineGap = ASC, DESC, 0
os2 = font["OS/2"]
os2.sTypoAscender, os2.sTypoDescender, os2.sTypoLineGap = ASC, DESC, 0
os2.fsSelection |= 1 << 7  # USE_TYPO_METRICS — одинаково во всех браузерах
font.flavor = "woff2"
font.save(here.parent.parent / "fonts" / "amiri-quran.woff2")
print("fonts/amiri-quran.woff2: ascent", ASC, "descent", DESC)
