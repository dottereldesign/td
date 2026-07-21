"""Extract exact, lossless UI art crops from the user-supplied reference sheet.

The tower portraits intentionally retain their pale card background. That keeps
the original soft shadows and light edge pixels intact; CSS masks each image to
the same rounded shape used by the rebuilt tower cards.
"""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art" / "reference" / "ui" / "shop-layout.png"
OUTPUT = ROOT / "src" / "assets" / "towers" / "portraits"

CROPS = {
    "vacuum-sentry.png": (1084, 80, 1193, 178),
    "brush-array.png": (1299, 81, 1404, 177),
    "toast-mortar.png": (1084, 232, 1191, 325),
    "arcanum.png": (1299, 232, 1402, 325),
    "fly-sprayer.png": (1084, 383, 1194, 474),
    "null-engine.png": (1299, 383, 1403, 474),
}


def main() -> None:
    with Image.open(SOURCE) as source:
        if source.size != (1536, 1024):
            raise ValueError(f"Expected a 1536x1024 reference sheet, got {source.size!r}")

        OUTPUT.mkdir(parents=True, exist_ok=True)
        for filename, box in CROPS.items():
            source.crop(box).save(OUTPUT / filename, optimize=True)


if __name__ == "__main__":
    main()
