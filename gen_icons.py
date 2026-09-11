from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT = "/app/frontend/assets/fonts/Fraunces.ttf"
A = "/app/frontend/assets"

GRANITE = (7, 11, 14, 255)
BRASS = (203, 163, 101, 255)
BRASS_HI = (221, 183, 122, 255)
IVORY = (244, 244, 240, 255)


def emblem(size, bg=None, ring_margin=0.13, k_frac=0.52, glow=True,
           k_color=BRASS, ring_color=BRASS, letter="K", ring=True):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    if bg is not None:
        base = Image.new("RGBA", (size, size), bg)
        img = Image.alpha_composite(img, base)

    # soft brass glow behind the mark
    if glow:
        gl = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        gd = ImageDraw.Draw(gl)
        r = size * 0.30
        c = size / 2
        gd.ellipse([c - r, c - r, c + r, c + r], fill=(203, 163, 101, 70))
        gl = gl.filter(ImageFilter.GaussianBlur(size * 0.11))
        img = Image.alpha_composite(img, gl)

    d = ImageDraw.Draw(img)

    if ring:
        m = size * ring_margin
        w = max(2, int(size * 0.021))
        d.ellipse([m, m, size - m, size - m], outline=ring_color, width=w)

    fs = int(size * k_frac * 2.0)  # Fraunces cap-height is smaller than em
    font = ImageFont.truetype(FONT, fs)
    bbox = d.textbbox((0, 0), letter, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]
    # subtle drop shadow for depth
    off = size * 0.008
    d.text((x + off, y + off), letter, font=font, fill=(0, 0, 0, 130))
    d.text((x, y), letter, font=font, fill=k_color)
    return img


def save(img, path, opaque=False):
    if opaque:
        bg = Image.new("RGB", img.size, GRANITE[:3])
        bg.paste(img, (0, 0), img)
        bg.save(path)
    else:
        img.save(path)
    print("wrote", path, img.size)


# App Store / general app icon — OPAQUE, no transparency, no rounded corners
save(emblem(1024, bg=GRANITE, ring_margin=0.13, k_frac=0.26), f"{A}/icon.png", opaque=True)

# Android adaptive foreground — transparent, content inside center safe zone (~60%)
adaptive = emblem(1024, bg=None, ring_margin=0.21, k_frac=0.20, glow=False)
save(adaptive, f"{A}/adaptive-icon.png")
save(adaptive, f"{A}/android-icon-foreground.png")

# Android adaptive background — solid granite
save(Image.new("RGBA", (1024, 1024), GRANITE), f"{A}/android-icon-background.png")

# Android monochrome (themed icons) — white mark on transparent, no ring
mono = emblem(1024, bg=None, ring_margin=0.21, k_frac=0.24, glow=False,
              k_color=(255, 255, 255, 255), ring=False)
save(mono, f"{A}/android-icon-monochrome.png")

# Splash mark — transparent (splash bg is #070B0E in app.json)
save(emblem(1024, bg=None, ring_margin=0.13, k_frac=0.26, glow=True), f"{A}/splash-icon.png")

# Web favicon — opaque
save(emblem(256, bg=GRANITE, ring_margin=0.12, k_frac=0.28), f"{A}/favicon.png", opaque=True)

print("DONE")
