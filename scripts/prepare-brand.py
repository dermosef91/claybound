"""Build the share card and icons from the title artwork already in the game.

Usage: python scripts/prepare-brand.py

Everything here is derived, never drawn from scratch: the card is the shipped
title key art with the shipped logo composited on it, and the icons are the
logo's own leading C, because a 1600x456 wordmark is illegible at 32 pixels.
Re-run it whenever the logo or the key art changes.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'dist/assets/title'
OUT = ROOT / 'dist'

SKY_TOP = (137, 183, 219)
SKY_BOTTOM = (108, 158, 201)
CREAM = (255, 244, 223)
TAGLINE = 'SMALL FEET. BIGGER WORLDS.'


def trimmed(image):
    box = image.getbbox()
    return image.crop(box) if box else image


# The wordmark's letters touch, and its drop shadow joins them into a single
# alpha region, so the C cannot be found by looking for a gap. This is where the
# C ends as a fraction of the logo's width, measured off the shipped artwork.
C_EDGE = .1638


def leading_glyph(logo):
    """The logo's C, which is what a 32-pixel icon can actually show."""
    return trimmed(logo.crop((0, 0, round(logo.width * C_EDGE), logo.height)))


def sky(size):
    width, height = size
    gradient = Image.new('RGB', (1, height))
    for y in range(height):
        t = y / max(1, height - 1)
        gradient.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(SKY_TOP, SKY_BOTTOM)))
    return gradient.resize((width, height), Image.Resampling.BICUBIC)


def icon(glyph, size):
    """One artwork for every size: the C fills 58%, which clears the 80% safe
    circle Android masks with, so the same file serves `any` and `maskable`."""
    canvas = sky((size, size))
    target = round(size * .58)
    scale = min(target / glyph.width, target / glyph.height)
    art = glyph.resize((max(1, round(glyph.width * scale)), max(1, round(glyph.height * scale))), Image.Resampling.LANCZOS)
    canvas.paste(art, ((size - art.width) // 2, (size - art.height) // 2), art)
    return canvas


def load_font(size):
    for candidate in [ART.parent / 'completion/fonts/sans-bold.woff',
                      Path('/System/Library/Fonts/Supplemental/Futura.ttc'),
                      Path('/System/Library/Fonts/Avenir Next.ttc'),
                      Path('/System/Library/Fonts/Helvetica.ttc')]:
        try:
            return ImageFont.truetype(str(candidate), size)
        except Exception:
            continue
    return None


def share_card(logo, key_art, size=(1200, 630)):
    width, height = size
    ratio = width / height
    source = key_art.convert('RGB')
    crop_height = round(source.width / ratio)
    if crop_height <= source.height:
        # Trim the sky rather than the canyon: the horizon is the subject.
        top = round((source.height - crop_height) * .72)
        source = source.crop((0, top, source.width, top + crop_height))
    else:
        crop_width = round(source.height * ratio)
        left = round((source.width - crop_width) * .5)
        source = source.crop((left, 0, left + crop_width, source.height))
    card = source.resize(size, Image.Resampling.LANCZOS)

    # A soft wash on the left keeps the wordmark legible over the cliffs without
    # dulling the artwork the card is there to show.
    wash = Image.new('L', (width, 1))
    for x in range(width):
        t = min(1, max(0, x / (width * .62)))
        wash.putpixel((x, 0), round(120 * (1 - t) ** 1.6))
    shade = Image.new('RGB', size, (26, 52, 78))
    card.paste(shade, (0, 0), wash.resize(size, Image.Resampling.BILINEAR))

    mark_width = round(width * .46)
    mark = logo.resize((mark_width, round(logo.height * mark_width / logo.width)), Image.Resampling.LANCZOS)
    left, top = round(width * .066), round(height * .30)
    card.paste(mark, (left, top), mark)

    font = load_font(round(height * .036))
    if font:
        draw = ImageDraw.Draw(card)
        draw.text((left + round(width * .008), top + mark.height + round(height * .045)),
                  ' '.join(TAGLINE), font=font, fill=CREAM)
    return card


def main():
    logo = Image.open(ART / 'logo.webp').convert('RGBA')
    key_art = Image.open(ART / 'canyon-landscape.webp')
    glyph = leading_glyph(logo)

    written = []
    for size in (32, 180, 192, 512):
        path = OUT / f'icon-{size}.png'
        icon(glyph, size).save(path, optimize=True)
        written.append(path)
    # A share card is photographic and never needs alpha; JPEG keeps it small
    # enough that a preview renders before the reader has scrolled past.
    card = OUT / 'og-card.jpg'
    share_card(logo, key_art).save(card, quality=88, subsampling=1, optimize=True, progressive=True)
    written.append(card)
    for path in written:
        print(f'{path.relative_to(ROOT)}  {path.stat().st_size / 1024:.0f} KB')


if __name__ == '__main__':
    main()
