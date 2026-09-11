import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT = "/app/frontend/assets/fonts/Fraunces.ttf"
OUT = "/app/frontend/store-assets"
os.makedirs(OUT, exist_ok=True)

GRAN_TOP = (11, 17, 22)
GRAN_BOT = (5, 8, 10)
BRASS = (203, 163, 101)
BRASS_HI = (221, 183, 122)
IVORY = (244, 244, 240)
MUTED = (150, 162, 172)


def font(sz):
    return ImageFont.truetype(FONT, sz)


def gradient_bg(W, H):
    base = Image.new("RGB", (W, H), GRAN_TOP)
    top = Image.new("RGB", (1, H))
    for y in range(H):
        t = y / max(1, H - 1)
        top.putpixel((0, y), tuple(int(GRAN_TOP[i] + (GRAN_BOT[i] - GRAN_TOP[i]) * t) for i in range(3)))
    base = top.resize((W, H))
    return base.convert("RGBA")


def add_glow(img, cx, cy, r, alpha):
    gl = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(gl)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(203, 163, 101, alpha))
    gl = gl.filter(ImageFilter.GaussianBlur(r * 0.4))
    return Image.alpha_composite(img, gl)


def rounded(img, radius):
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, img.size[0], img.size[1]], radius=radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def center_text(d, text, f, fill, y, W):
    b = d.textbbox((0, 0), text, font=f)
    d.text(((W - (b[2] - b[0])) / 2 - b[0], y), text, font=f, fill=fill)
    return b[3] - b[1]


def make_frame(W, H, shot_path, title_lines, sub):
    bg = gradient_bg(W, H)
    bg = add_glow(bg, W // 2, int(H * 0.10), int(W * 0.55), 70)
    d = ImageDraw.Draw(bg)

    ft = font(int(W * 0.086))
    y = int(H * 0.055)
    for ln in title_lines:
        h = center_text(d, ln, ft, IVORY, y, W)
        y += int(W * 0.10)
    fs = font(int(W * 0.037))
    b = d.textbbox((0, 0), sub, font=fs)
    d.text(((W - (b[2] - b[0])) / 2 - b[0], y + int(H * 0.006)), sub, font=fs, fill=MUTED)

    shot = Image.open(shot_path).convert("RGB")
    screen_h = int(H * 0.60)
    screen_w = int(screen_h * shot.width / shot.height)
    shot = shot.resize((screen_w, screen_h))
    bezel = max(6, int(W * 0.016))
    radius = int(W * 0.07)
    dev_w, dev_h = screen_w + 2 * bezel, screen_h + 2 * bezel
    device = Image.new("RGBA", (dev_w, dev_h), (0, 0, 0, 0))
    dd = ImageDraw.Draw(device)
    dd.rounded_rectangle([0, 0, dev_w, dev_h], radius=radius + bezel, fill=(12, 18, 22, 255),
                         outline=(203, 163, 101, 150), width=3)
    device.paste(rounded(shot, radius), (bezel, bezel), rounded(shot, radius))

    px = (W - dev_w) // 2
    py = int(H * 0.30)
    sh = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([px, py + 18, px + dev_w, py + dev_h + 18],
                                         radius=radius + bezel, fill=(0, 0, 0, 170))
    sh = sh.filter(ImageFilter.GaussianBlur(34))
    bg = Image.alpha_composite(bg, sh)
    bg.paste(device, (px, py), device)
    return bg.convert("RGB")


def wordmark(d, cx, y, size):
    f = font(size)
    parts = [("KJ", IVORY), ("A", BRASS), ("PP", IVORY)]
    widths = [d.textlength(t, font=f) for t, _ in parts]
    total = sum(widths)
    x = cx - total / 2
    for (t, c), w in zip(parts, widths):
        d.text((x, y), t, font=f, fill=c)
        x += w


def feature_graphic():
    W, H = 1024, 500
    bg = gradient_bg(W, H)
    bg = add_glow(bg, int(W * 0.72), int(H * 0.5), int(W * 0.34), 90)
    d = ImageDraw.Draw(bg)
    # left text block
    wm = font(96)
    parts = [("KJ", IVORY), ("A", BRASS), ("PP", IVORY)]
    x = 70
    yb = 150
    for t, c in parts:
        d.text((x, yb), t, font=wm, fill=c)
        x += d.textlength(t, font=wm)
    d.text((74, 268), "N O R D I C   T A X I", font=font(26), fill=BRASS)
    d.text((74, 320), "Enklere. Tryggere. Kjappere.", font=font(40), fill=IVORY)
    d.text((74, 384), "Bestill en bil på sekunder – med fast pris.", font=font(26), fill=MUTED)
    # right emblem (ring + K)
    cx, cy, r = int(W * 0.80), int(H * 0.5), 150
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=BRASS, width=6)
    fk = font(190)
    b = d.textbbox((0, 0), "K", font=fk)
    d.text((cx - (b[2] - b[0]) / 2 - b[0], cy - (b[3] - b[1]) / 2 - b[1]), "K", font=fk, fill=BRASS)
    bg.convert("RGB").save(f"{OUT}/play-feature-graphic-1024x500.png")
    print("wrote feature graphic")


SHOTS = [
    ("/app/frontend/store-assets/raw/onboarding.png", ["Nordisk taxi,", "reimaginert"], "Bestill en bil på sekunder"),
    ("/app/frontend/store-assets/raw/home.png", ["Se biler", "i nærheten"], "Sanntidskart med ledige biler rundt deg"),
    ("/app/frontend/store-assets/raw/booking.png", ["Fast pris,", "ingen overraskelser"], "Velg bil og betaling før du bestiller"),
    ("/app/frontend/store-assets/raw/tracking.png", ["Følg sjåføren", "live"], "Se bilen komme mot deg i sanntid"),
]

feature_graphic()
for i, (path, title, sub) in enumerate(SHOTS, 1):
    if not os.path.exists(path):
        print("skip missing", path); continue
    make_frame(1080, 1920, path, title, sub).save(f"{OUT}/play-screenshot-{i}-1080x1920.png")
    make_frame(1290, 2796, path, title, sub).save(f"{OUT}/appstore-screenshot-{i}-1290x2796.png")
    print("wrote screenshot", i)
print("DONE ->", OUT)
