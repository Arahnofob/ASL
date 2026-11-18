"""Draws the Signs app icon: a hand making the ASL "I love you" sign on deep teal.

Writes assets/icon.png (1024), assets/favicon.png (48), assets/splash-icon.png and the
Android adaptive icon layers. Usage:  python3 scripts/make-icon.py
"""
from PIL import Image, ImageDraw, ImageFilter

S = 4096  # draw large, then scale down for smooth edges
TEAL_TOP, TEAL_BOTTOM = (20, 122, 110), (8, 66, 60)
HAND = (255, 247, 236)
SHADOW = (4, 40, 36)
AMBER = (242, 181, 68)


def gradient(size):
    img = Image.new('RGB', (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(TEAL_TOP, TEAL_BOTTOM)))
    return img


def hand_mask(size):
    """White hand on black. Index, pinky and thumb up; middle and ring folded."""
    u = size / 1024
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    r = lambda box, rad: d.rounded_rectangle([v * u for v in box], radius=rad * u, fill=255)
    fw = 118  # finger width
    # Palm
    r((330, 470, 735, 860), 120)
    # Index finger (up)
    r((338, 150, 338 + fw, 560), fw / 2)
    # Middle and ring fingers (folded: short stubs over the palm)
    r((468, 400, 468 + fw - 6, 600), fw / 2)
    r((590, 412, 590 + fw - 8, 610), fw / 2)
    # Pinky (up)
    r((612 + 10, 205, 612 + 10 + fw - 10, 560), (fw - 10) / 2)
    # Thumb (out to the side), drawn as a rotated rounded bar
    thumb = Image.new('L', (size, size), 0)
    td = ImageDraw.Draw(thumb)
    td.rounded_rectangle([v * u for v in (180, 540, 520, 540 + fw + 6)], radius=(fw + 6) / 2 * u, fill=255)
    thumb = thumb.rotate(-28, center=(470 * u, 600 * u), resample=Image.BICUBIC)
    m = Image.composite(Image.new('L', (size, size), 255), m, thumb)
    # Wrist
    d = ImageDraw.Draw(m)
    r((400, 800, 680, 1024), 40)
    return m


def icon(size=1024, background=True):
    big = gradient(S) if background else Image.new('RGBA', (S, S), (0, 0, 0, 0))
    mask = hand_mask(S)
    shadow = mask.filter(ImageFilter.GaussianBlur(S / 90))
    off = Image.new('L', (S, S), 0)
    off.paste(shadow, (0, round(S * 0.012)))
    big = big.convert('RGBA')
    big.paste(Image.new('RGBA', (S, S), SHADOW + (110,)), (0, 0), off)
    big.paste(Image.new('RGBA', (S, S), HAND + (255,)), (0, 0), mask)
    # Small amber heart: the "love" in I-love-you.
    d = ImageDraw.Draw(big)
    u = S / 1024
    cx, cy, k = 860 * u, 150 * u, 40 * u
    d.ellipse([cx - 2 * k, cy - k, cx, cy + k], fill=AMBER)
    d.ellipse([cx, cy - k, cx + 2 * k, cy + k], fill=AMBER)
    d.polygon([(cx - 2 * k + 4 * u, cy + 0.35 * k), (cx + 2 * k - 4 * u, cy + 0.35 * k), (cx, cy + 2.3 * k)], fill=AMBER)
    out = big.resize((size, size), Image.LANCZOS)
    return out.convert('RGB') if background else out


icon(1024).save('assets/icon.png')
icon(48).save('assets/favicon.png')
icon(1024).save('assets/splash-icon.png')
icon(512, background=False).save('assets/android-icon-foreground.png')
gradient(512).save('assets/android-icon-background.png')
mono = hand_mask(432 * 4).resize((432, 432), Image.LANCZOS)
Image.merge('RGBA', (mono, mono, mono, mono)).save('assets/android-icon-monochrome.png')
print('icons written')
