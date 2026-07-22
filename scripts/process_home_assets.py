"""Build optimized browser assets from generated home-screen source art."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

from process_generated_assets import prepare_sprite


ICON_NAMES = ("missions", "daily-rewards", "achievements", "collection", "profile-avatar")
WORLD_NAMES = ("forest", "workshop", "word", "number", "space", "music")


def prepare_webp(source: Path, destination: Path, size: tuple[int, int], quality: int) -> None:
    with Image.open(source) as image:
        output = image.convert("RGB")
        output.thumbnail(size, Image.Resampling.LANCZOS)
        output.save(destination, "WEBP", quality=quality, method=6)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=root / "art" / "source-images" / "home")
    parser.add_argument("--alpha", type=Path, default=root / "tmp" / "imagegen" / "home-alpha")
    parser.add_argument("--output", type=Path, default=root / "src" / "assets" / "home")
    args = parser.parse_args()

    for folder in ("background", "icons", "panels", "worlds"):
        (args.output / folder).mkdir(parents=True, exist_ok=True)

    for name in ICON_NAMES:
        prepare_sprite(args.alpha / f"{name}.png", args.output / "icons" / f"{name}.png")

    prepare_webp(args.source / "home-background.png", args.output / "background" / "learning-fortress.webp", (1536, 1024), 88)
    prepare_webp(args.source / "summer-event.png", args.output / "panels" / "summer-event.webp", (768, 512), 88)
    prepare_webp(args.source / "squad.png", args.output / "panels" / "squad.webp", (768, 512), 88)
    for world in WORLD_NAMES:
        prepare_webp(args.source / f"world-{world}.png", args.output / "worlds" / f"{world}.webp", (512, 768), 86)


if __name__ == "__main__":
    main()
