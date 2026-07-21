#!/usr/bin/env python3
"""Split the authored 16-mask dirt-path sheet into named runtime tiles."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


CORE = 256
GUTTER = 4
PITCH = CORE + GUTTER * 2

TILE_NAMES = {
    0: "isolated",
    1: "end-north",
    2: "end-east",
    3: "corner-north-east",
    4: "end-south",
    5: "straight-vertical",
    6: "corner-east-south",
    7: "junction-t-missing-west",
    8: "end-west",
    9: "corner-north-west",
    10: "straight-horizontal",
    11: "junction-t-missing-south",
    12: "corner-south-west",
    13: "junction-t-missing-east",
    14: "junction-t-missing-north",
    15: "junction-four-way",
}


def extract_core(atlas: Image.Image, mask: int) -> Image.Image:
    x = (mask % 4) * PITCH + GUTTER
    y = (mask // 4) * PITCH + GUTTER
    return atlas.crop((x, y, x + CORE, y + CORE)).convert("RGBA")


def make_isolated_tile(four_way: Image.Image) -> Image.Image:
    """Turn the layered centre of the four-way frame into a round dirt island."""

    scale = 4
    mask = Image.new("L", (CORE * scale, CORE * scale), 0)
    draw = ImageDraw.Draw(mask)
    radius = 83 * scale
    centre = CORE * scale // 2
    draw.ellipse(
        (centre - radius, centre - radius, centre + radius, centre + radius),
        fill=255,
    )
    mask = mask.resize((CORE, CORE), Image.Resampling.LANCZOS)
    isolated = four_way.copy()
    isolated.putalpha(ImageChops.multiply(four_way.getchannel("A"), mask))
    return isolated


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--atlas",
        type=Path,
        default=root / "art" / "source-sheets" / "terrain" / "dirt-path-16-mask-atlas.png",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=root / "src" / "assets" / "terrain" / "paths" / "dirt",
    )
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    with Image.open(args.atlas) as source:
        atlas = source.convert("RGBA")
    expected = (PITCH * 4, PITCH * 4)
    if atlas.size != expected:
        raise ValueError(f"Expected atlas size {expected}, got {atlas.size}")

    four_way = extract_core(atlas, 15)
    for mask, name in TILE_NAMES.items():
        tile = make_isolated_tile(four_way) if mask == 0 else extract_core(atlas, mask)
        destination = args.output / f"{mask:02d}-{name}.png"
        tile.save(destination, "PNG", optimize=True)
        print(destination.relative_to(root))


if __name__ == "__main__":
    main()
