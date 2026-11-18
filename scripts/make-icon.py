"""Draws the Mano app icon: a hand making the ASL "I love you" sign in front of a warm sun,
on deep teal.

Writes assets/icon.png (1024), assets/favicon.png (48), assets/splash-icon.png and the
Android adaptive icon layers. Usage:  python3 scripts/make-icon.py
"""
from PIL import Image, ImageDraw, ImageFilter

S = 4096  # draw large, then scale down for smooth edges
U = S / 1024
TEAL_TOP, TEAL_BOTTOM = (22, 128, 115), (7, 58, 53)
SUN_IN, SUN_OUT = (255, 206, 102), (242, 160, 60)
HAND = (255, 248, 238)
SHADOW = (3, 33, 30)


def vgradient(size, top, bottom):
    img = Image.new('RGB', (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    return img


def finger(mask, x0, y0, x1, y1, angle, pivot):
    """A rounded finger from (x0,y0) to (x1,y1) (unrotated), rotated `angle` degrees about `pivot`."""
    layer = Image.new('L', (S, S), 0)
    ImageDraw.Draw(layer).rounded_rectangle([x0 * U, y0 * U, x1 * U, y1 * U], radius=(x1 - x0) / 2 * U, fill=255)
    if angle:
        layer = layer.rotate(angle, center=(pivot[0] * U, pivot[1] * U), resample=Image.BICUBIC)
    return Image.composite(Image.new('L', (S, S), 255), mask, layer)


def hand_mask():
    """White hand on black: index and pinky up, thumb out, middle and ring folded."""
    m = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(m)
    # Palm and wrist
    d.rounded_rectangle([352 * U, 470 * U, 708 * U, 820 * U], radius=150 * U, fill=255)
    d.rounded_rectangle([408 * U, 700 * U, 652 * U, 1024 * U], radius=60 * U, fill=255)
    # Index (tilted slightly left) and pinky (tilted slightly right)
    m = finger(m, 366, 168, 476, 600, 6, (421, 560))
    m = finger(m, 600, 228, 700, 600, -9, (650, 560))
    # Folded middle and ring: knuckles curled over the palm
    m = finger(m, 478, 420, 584, 560, 0, (0, 0))
    m = finger(m, 560, 440, 660, 575, 0, (0, 0))
    # Thumb: out to the side and a little up
    m = finger(m, 190, 575, 470, 685, -24, (440, 630))
    return m


def icon(size=1024, background=True):
    if background:
        big = vgradient(S, TEAL_TOP, TEAL_BOTTOM).convert('RGBA')
        # Sun behind the hand: radial amber glow
        sun = Image.new('L', (S, S), 0)
        ImageDraw.Draw(sun).ellipse([212 * U, 150 * U, 812 * U, 750 * U], fill=255)
        glow = sun.filter(ImageFilter.GaussianBlur(70 * U))
        big.paste(Image.new('RGBA', (S, S), SUN_OUT + (90,)), (0, 0), glow)
        big.paste(vgradient(S, SUN_IN, SUN_OUT).convert('RGBA'), (0, 0), sun)
    else:
        big = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    mask = hand_mask()
    shadow = mask.filter(ImageFilter.GaussianBlur(S / 80))
    off = Image.new('L', (S, S), 0)
    off.paste(shadow, (round(S * 0.008), round(S * 0.016)))
    big.paste(Image.new('RGBA', (S, S), SHADOW + (120,)), (0, 0), off)
    big.paste(Image.new('RGBA', (S, S), HAND + (255,)), (0, 0), mask)
    out = big.resize((size, size), Image.LANCZOS)
    return out.convert('RGB') if background else out


icon(1024).save('assets/icon.png')
icon(48).save('assets/favicon.png')
icon(1024).save('assets/splash-icon.png')
icon(512, background=False).save('assets/android-icon-foreground.png')
vgradient(512, TEAL_TOP, TEAL_BOTTOM).save('assets/android-icon-background.png')
mono = hand_mask().resize((432, 432), Image.LANCZOS)
Image.merge('RGBA', (mono, mono, mono, mono)).save('assets/android-icon-monochrome.png')
print('icons written')
