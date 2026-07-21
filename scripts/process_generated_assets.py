"""Prepare ImageGen terrain and sprite output for the browser build.

The chroma-key step is intentionally handled by Codex's imagegen helper first.
This script only crops/pads transparent sprites and creates compact web textures.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


MATERIALS = {
    "grass-lush.png": "grass-lush.webp",
    "grass-trimmed.png": "grass-trimmed.webp",
    "concrete-light.png": "concrete-light.webp",
    "concrete-panel.png": "concrete-panel.webp",
}

TOWER_SPRITES = {
    "mycelium-network.png": "mycelium-network.png",
    "pollinator-post.png": "pollinator-post.png",
    "canopy-guardian.png": "canopy-guardian.png",
    "root-snare.png": "root-snare.png",
    "seed-slinger.png": "seed-slinger.png",
    "weathered-oak.png": "weathered-oak.png",
}


def prepare_texture(source: Path, destination: Path) -> None:
    with Image.open(source) as image:
        # Mirror a downsampled source across both axes. Opposing boundary pixels
        # are then identical, so Canvas repeat patterns have no visible edge.
        quarter = image.convert("RGB").resize((256, 256), Image.Resampling.LANCZOS)
        top = Image.new("RGB", (512, 256))
        top.paste(quarter, (0, 0))
        top.paste(ImageOps.mirror(quarter), (256, 0))
        texture = Image.new("RGB", (512, 512))
        texture.paste(top, (0, 0))
        texture.paste(ImageOps.flip(top), (0, 256))
        texture.save(destination, "WEBP", quality=88, method=6)


def prepare_sprite(source: Path, destination: Path) -> None:
    with Image.open(source) as image:
        sprite = image.convert("RGBA")
        alpha = sprite.getchannel("A")
        bounds = alpha.getbbox()
        if bounds is None:
            raise ValueError(f"No opaque subject found in {source}")

        sprite = sprite.crop(bounds)
        side = max(sprite.width, sprite.height)
        padding = max(16, round(side * 0.09))
        square_side = side + padding * 2
        square = Image.new("RGBA", (square_side, square_side), (0, 0, 0, 0))
        square.alpha_composite(
            sprite,
            ((square_side - sprite.width) // 2, (square_side - sprite.height) // 2),
        )
        square = square.resize((384, 384), Image.Resampling.LANCZOS)
        square.save(destination, "PNG", optimize=True)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--alpha", type=Path, required=True)
    parser.add_argument(
        "--materials-output",
        type=Path,
        default=root / "art" / "source-materials" / "terrain",
    )
    parser.add_argument(
        "--tower-output",
        type=Path,
        default=root / "src" / "assets" / "towers" / "worlds" / "forest",
    )
    parser.add_argument(
        "--prop-output",
        type=Path,
        default=root / "src" / "assets" / "terrain" / "props",
    )
    args = parser.parse_args()
    args.materials_output.mkdir(parents=True, exist_ok=True)
    args.tower_output.mkdir(parents=True, exist_ok=True)
    args.prop_output.mkdir(parents=True, exist_ok=True)

    for source_name, output_name in MATERIALS.items():
        prepare_texture(args.source / source_name, args.materials_output / output_name)
    for source_name, output_name in TOWER_SPRITES.items():
        prepare_sprite(args.alpha / source_name, args.tower_output / output_name)
    prepare_sprite(args.alpha / "terrain-rock-fern.png", args.prop_output / "rock-fern.png")


if __name__ == "__main__":
    main()
