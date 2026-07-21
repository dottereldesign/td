#!/usr/bin/env python3
"""Build the repeat-safe grass texture and cardinal-mask road atlas.

The atlas layout is deliberately renderer-friendly:

* mask bits: N=1, E=2, S=4, W=8
* frame index: the numeric mask value
* layout: 4 columns by 4 rows
* frame core: 256 x 256 px
* duplicated-edge gutter: 4 px on every side
* frame pitch: 264 px
* atlas: 1056 x 1056 px

The generated source artwork is treated as material, not cropped into finished
tiles.  A mirrored-quadrant transform first makes each material repeat exactly;
the road, soil edge, and raised grass verge are then rebuilt from deterministic
cardinal masks so every connector has identical geometry.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


CORE = 256
GUTTER = 4
PITCH = CORE + GUTTER * 2
ATLAS_COLUMNS = 4
ATLAS_ROWS = 4
ATLAS_SIZE = (PITCH * ATLAS_COLUMNS, PITCH * ATLAS_ROWS)

NORTH = 1
EAST = 2
SOUTH = 4
WEST = 8

# 112 / 256 = 43.75%, matching the requested approximately 44% road width.
ROAD_WIDTH = 112
SOIL_WIDTH = 130
VERGE_WIDTH = 154
OUTLINE_WIDTH = 160
SHADOW_WIDTH = 166

# Supersampling keeps the curved corners polished while preserving exact,
# centered connector widths after the final downsample.
SUPERSAMPLE = 4


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(
        description="Build a seamless grass texture and a 16-mask road atlas."
    )
    parser.add_argument("--grass", required=True, type=Path, help="Grass material image")
    parser.add_argument("--path", required=True, type=Path, help="Neutral path material image")
    parser.add_argument(
        "--grass-output",
        type=Path,
        default=project_root / "src" / "assets" / "terrain" / "ground" / "grass.webp",
    )
    parser.add_argument(
        "--atlas-output",
        type=Path,
        default=project_root / "art" / "source-sheets" / "terrain" / "dirt-path-16-mask-atlas.png",
    )
    return parser.parse_args()


def mirrored_quadrant(source: Image.Image, size: int) -> Image.Image:
    """Return a square texture whose opposite edges match pixel-for-pixel.

    The entire supplied material is fit into one quadrant, then reflected into
    the remaining quadrants.  This creates continuity at both the internal
    joins and the outer repeat boundary without smearing or cross-fading the
    authored detail.
    """

    if size % 2:
        raise ValueError("Mirrored texture size must be even")

    half = size // 2
    base = ImageOps.fit(
        source.convert("RGB"),
        (half, half),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    texture = Image.new("RGB", (size, size))
    texture.paste(base, (0, 0))
    texture.paste(ImageOps.mirror(base), (half, 0))
    texture.paste(ImageOps.flip(base), (0, half))
    texture.paste(ImageOps.flip(ImageOps.mirror(base)), (half, half))
    return texture


def rgba_texture(texture: Image.Image, size: int = CORE) -> Image.Image:
    """Fit a repeat-safe material to one atlas core as RGBA."""

    return ImageOps.fit(
        texture.convert("RGBA"),
        (size, size),
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )


def cardinal_mask(bits: int, width: int) -> Image.Image:
    """Create a rounded cardinal union, extending connected arms off-canvas."""

    size = CORE * SUPERSAMPLE
    center = size // 2
    radius = width * SUPERSAMPLE // 2
    overshoot = radius + SUPERSAMPLE * 2

    mask = Image.new("L", (size, size), 0)
    if bits == 0:
        return mask.resize((CORE, CORE), Image.Resampling.LANCZOS)

    draw = ImageDraw.Draw(mask)
    # A round central hub gives turns, T-junctions, and dead ends a consistent
    # friendly radius.  Rectangular arms preserve exact connector geometry.
    draw.ellipse(
        (center - radius, center - radius, center + radius, center + radius),
        fill=255,
    )
    if bits & NORTH:
        draw.rectangle(
            (center - radius, -overshoot, center + radius, center), fill=255
        )
    if bits & EAST:
        draw.rectangle(
            (center, center - radius, size + overshoot, center + radius), fill=255
        )
    if bits & SOUTH:
        draw.rectangle(
            (center - radius, center, center + radius, size + overshoot), fill=255
        )
    if bits & WEST:
        draw.rectangle(
            (-overshoot, center - radius, center, center + radius), fill=255
        )

    return mask.resize((CORE, CORE), Image.Resampling.LANCZOS)


def masked_fill(canvas: Image.Image, fill: Image.Image, mask: Image.Image) -> None:
    canvas.alpha_composite(Image.composite(fill, Image.new("RGBA", canvas.size), mask))


def color_layer(color: tuple[int, int, int, int]) -> Image.Image:
    return Image.new("RGBA", (CORE, CORE), color)


def build_frame(
    bits: int,
    verge_texture: Image.Image,
    path_texture: Image.Image,
) -> Image.Image:
    frame = Image.new("RGBA", (CORE, CORE), (0, 0, 0, 0))
    if bits == 0:
        return frame

    shadow = cardinal_mask(bits, SHADOW_WIDTH)
    outline = cardinal_mask(bits, OUTLINE_WIDTH)
    verge = cardinal_mask(bits, VERGE_WIDTH)
    soil = cardinal_mask(bits, SOIL_WIDTH)
    road = cardinal_mask(bits, ROAD_WIDTH)

    # A narrow, direction-neutral shadow sells the raised verge without becoming
    # a separate tile frame.  Keeping it symmetric makes opposing connector
    # edges pixel-identical, so no seam appears between adjacent cells.
    masked_fill(frame, color_layer((74, 89, 45, 92)), shadow)

    # Thin olive outline, followed by the authored green material.  The outline
    # remains visible only in the 3 px outer band.
    masked_fill(frame, color_layer((92, 119, 48, 224)), outline)
    masked_fill(frame, verge_texture, verge)

    # Soft top highlight across the verge and a muted taupe inner soil edge.
    # Keeping these as nested deterministic masks ensures every N/E/S/W join is
    # exactly identical regardless of the tile's other connections.
    verge_inner = cardinal_mask(bits, VERGE_WIDTH - 8)
    verge_highlight = ImageChops.subtract(verge, verge_inner)
    masked_fill(frame, color_layer((220, 245, 129, 88)), verge_highlight)

    masked_fill(frame, color_layer((143, 128, 105, 255)), soil)
    soil_inner = cardinal_mask(bits, SOIL_WIDTH - 8)
    soil_highlight = ImageChops.subtract(soil, soil_inner)
    masked_fill(frame, color_layer((188, 170, 137, 142)), soil_highlight)

    masked_fill(frame, path_texture, road)

    # A restrained ivory rim keeps the neutral path legible against the taupe
    # edge while leaving the generated material itself untouched in the middle.
    road_inner = cardinal_mask(bits, ROAD_WIDTH - 5)
    road_rim = ImageChops.subtract(road, road_inner)
    masked_fill(frame, color_layer((255, 252, 239, 72)), road_rim)
    return frame


def add_duplicated_gutter(core: Image.Image) -> Image.Image:
    """Pad a core frame by copying edge pixels, including transparent pixels."""

    padded = Image.new("RGBA", (PITCH, PITCH), (0, 0, 0, 0))
    padded.paste(core, (GUTTER, GUTTER))

    top = core.crop((0, 0, CORE, 1)).resize((CORE, GUTTER))
    bottom = core.crop((0, CORE - 1, CORE, CORE)).resize((CORE, GUTTER))
    left = core.crop((0, 0, 1, CORE)).resize((GUTTER, CORE))
    right = core.crop((CORE - 1, 0, CORE, CORE)).resize((GUTTER, CORE))
    padded.paste(top, (GUTTER, 0))
    padded.paste(bottom, (GUTTER, GUTTER + CORE))
    padded.paste(left, (0, GUTTER))
    padded.paste(right, (GUTTER + CORE, GUTTER))

    corners = (
        ((0, 0, 1, 1), (0, 0)),
        ((CORE - 1, 0, CORE, 1), (GUTTER + CORE, 0)),
        ((0, CORE - 1, 1, CORE), (0, GUTTER + CORE)),
        (
            (CORE - 1, CORE - 1, CORE, CORE),
            (GUTTER + CORE, GUTTER + CORE),
        ),
    )
    for crop_box, destination in corners:
        corner = core.crop(crop_box).resize((GUTTER, GUTTER))
        padded.paste(corner, destination)
    return padded


def assert_repeatable(image: Image.Image, label: str) -> None:
    if ImageChops.difference(image.crop((0, 0, 1, image.height)), image.crop((image.width - 1, 0, image.width, image.height))).getbbox():
        raise RuntimeError(f"{label} left/right edges do not repeat")
    if ImageChops.difference(image.crop((0, 0, image.width, 1)), image.crop((0, image.height - 1, image.width, image.height))).getbbox():
        raise RuntimeError(f"{label} top/bottom edges do not repeat")


def assert_gutter(frame: Image.Image) -> None:
    core = frame.crop((GUTTER, GUTTER, GUTTER + CORE, GUTTER + CORE))
    checks = (
        (
            frame.crop((GUTTER, 0, GUTTER + CORE, GUTTER)),
            core.crop((0, 0, CORE, 1)).resize((CORE, GUTTER)),
        ),
        (
            frame.crop((GUTTER, GUTTER + CORE, GUTTER + CORE, PITCH)),
            core.crop((0, CORE - 1, CORE, CORE)).resize((CORE, GUTTER)),
        ),
        (
            frame.crop((0, GUTTER, GUTTER, GUTTER + CORE)),
            core.crop((0, 0, 1, CORE)).resize((GUTTER, CORE)),
        ),
        (
            frame.crop((GUTTER + CORE, GUTTER, PITCH, GUTTER + CORE)),
            core.crop((CORE - 1, 0, CORE, CORE)).resize((GUTTER, CORE)),
        ),
        (
            frame.crop((0, 0, GUTTER, GUTTER)),
            core.crop((0, 0, 1, 1)).resize((GUTTER, GUTTER)),
        ),
        (
            frame.crop((GUTTER + CORE, 0, PITCH, GUTTER)),
            core.crop((CORE - 1, 0, CORE, 1)).resize((GUTTER, GUTTER)),
        ),
        (
            frame.crop((0, GUTTER + CORE, GUTTER, PITCH)),
            core.crop((0, CORE - 1, 1, CORE)).resize((GUTTER, GUTTER)),
        ),
        (
            frame.crop((GUTTER + CORE, GUTTER + CORE, PITCH, PITCH)),
            core.crop((CORE - 1, CORE - 1, CORE, CORE)).resize((GUTTER, GUTTER)),
        ),
    )
    if any(actual.tobytes() != expected.tobytes() for actual, expected in checks):
        raise RuntimeError("Atlas frame gutter is not an exact duplicated edge")


def assert_connector_edges(atlas: Image.Image) -> None:
    """Ensure every connected core edge is identical to its opposing edge."""

    frames: list[Image.Image] = []
    for bits in range(16):
        x = (bits % ATLAS_COLUMNS) * PITCH + GUTTER
        y = (bits // ATLAS_COLUMNS) * PITCH + GUTTER
        frames.append(atlas.crop((x, y, x + CORE, y + CORE)))

    def edge(frame: Image.Image, direction: int) -> Image.Image:
        if direction == NORTH:
            return frame.crop((0, 0, CORE, 1))
        if direction == EAST:
            return frame.crop((CORE - 1, 0, CORE, CORE))
        if direction == SOUTH:
            return frame.crop((0, CORE - 1, CORE, CORE))
        return frame.crop((0, 0, 1, CORE))

    for direction in (NORTH, EAST, SOUTH, WEST):
        reference = edge(frames[direction], direction).tobytes()
        for bits, frame in enumerate(frames):
            if bits & direction and edge(frame, direction).tobytes() != reference:
                raise RuntimeError(
                    f"Mask {bits} has inconsistent connector edge {direction}"
                )

    if edge(frames[NORTH], NORTH).tobytes() != edge(frames[SOUTH], SOUTH).tobytes():
        raise RuntimeError("North and south connector edges do not match")
    if edge(frames[EAST], EAST).tobytes() != edge(frames[WEST], WEST).tobytes():
        raise RuntimeError("East and west connector edges do not match")


def main() -> None:
    args = parse_args()
    if not args.grass.is_file():
        raise FileNotFoundError(args.grass)
    if not args.path.is_file():
        raise FileNotFoundError(args.path)

    grass_output = args.grass_output
    atlas_output = args.atlas_output
    grass_output.parent.mkdir(parents=True, exist_ok=True)
    atlas_output.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(args.grass) as grass_source:
        grass_repeat = mirrored_quadrant(grass_source, 1024)
    with Image.open(args.path) as path_source:
        path_repeat = mirrored_quadrant(path_source, CORE)

    assert_repeatable(grass_repeat, "Grass")
    assert_repeatable(path_repeat, "Path")

    # The verge reuses a softened version of the grass material.  Softening
    # removes clipped flowers from the narrow band while retaining its painted
    # texture and recognizable palette.
    verge = rgba_texture(mirrored_quadrant(grass_repeat, CORE))
    verge = verge.filter(ImageFilter.GaussianBlur(radius=1.4))
    verge = ImageEnhance.Color(verge).enhance(1.08)
    verge = ImageEnhance.Brightness(verge).enhance(0.94)
    path_fill = rgba_texture(path_repeat)

    atlas = Image.new("RGBA", ATLAS_SIZE, (0, 0, 0, 0))
    for bits in range(16):
        frame = add_duplicated_gutter(build_frame(bits, verge, path_fill))
        assert_gutter(frame)
        x = (bits % ATLAS_COLUMNS) * PITCH
        y = (bits // ATLAS_COLUMNS) * PITCH
        atlas.paste(frame, (x, y))

    if atlas.size != ATLAS_SIZE:
        raise RuntimeError(f"Unexpected atlas size: {atlas.size}")
    # Mask zero must remain fully transparent, including its gutter.
    if atlas.crop((0, 0, PITCH, PITCH)).getchannel("A").getbbox() is not None:
        raise RuntimeError("Mask-zero frame is not transparent")
    assert_connector_edges(atlas)

    grass_repeat.save(
        grass_output,
        format="WEBP",
        lossless=True,
        quality=100,
        method=6,
    )
    atlas.save(atlas_output, format="PNG", optimize=True)

    print(f"grass: {grass_output} ({grass_repeat.width}x{grass_repeat.height})")
    print(f"atlas: {atlas_output} ({atlas.width}x{atlas.height})")
    print(f"layout: 16 masks, core={CORE}, gutter={GUTTER}, pitch={PITCH}")


if __name__ == "__main__":
    main()
