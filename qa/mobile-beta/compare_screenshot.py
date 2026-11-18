"""Compare a captured UI against an explicitly approved device/theme baseline.

Masks are optional normalized rectangles [left, top, right, bottom] in JSON.
Mask dynamic map tiles/clocks only; never mask prices, errors or action buttons.
Requires Pillow. No alignment or resizing hides layout changes.
"""
import argparse
import json
from PIL import Image, ImageChops, ImageDraw


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("baseline")
    p.add_argument("actual")
    p.add_argument("--masks")
    p.add_argument("--channel-tolerance", type=int, default=20)
    p.add_argument("--max-changed-ratio", type=float, default=0.01)
    args = p.parse_args()
    baseline, actual = Image.open(args.baseline).convert("RGB"), Image.open(args.actual).convert("RGB")
    if baseline.size != actual.size:
        print(json.dumps({"status": "FAIL", "reason": "image dimensions differ"}))
        return 1
    w, h = baseline.size
    mask = Image.new("L", (w, h), 255)
    draw = ImageDraw.Draw(mask)
    for rect in json.load(open(args.masks)) if args.masks else []:
        if len(rect) != 4 or not (0 <= rect[0] < rect[2] <= 1 and 0 <= rect[1] < rect[3] <= 1):
            raise ValueError("Invalid normalized mask rectangle")
        draw.rectangle((int(rect[0]*w), int(rect[1]*h), int(rect[2]*w)-1, int(rect[3]*h)-1), fill=0)
    diff = ImageChops.difference(baseline, actual)
    compared = changed = 0
    for rgb, visible in zip(diff.getdata(), mask.getdata()):
        if visible:
            compared += 1
            changed += max(rgb) > args.channel_tolerance
    if not compared:
        raise ValueError("Mask leaves no UI pixels to compare")
    ratio = changed / compared
    passed = ratio <= args.max_changed_ratio
    print(json.dumps({"status": "PASS" if passed else "FAIL", "changed_ratio": ratio,
                      "compared_pixels": compared, "limit": args.max_changed_ratio}))
    return 0 if passed else 1


if __name__ == "__main__":
    raise SystemExit(main())
