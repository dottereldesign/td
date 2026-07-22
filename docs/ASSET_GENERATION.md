# Art pipeline and runtime layout

Image-generated source art is processed into semantic runtime folders. Only
files imported by the application remain under `src/assets`; combined sheets,
references, and unused materials live under `art`.

```text
src/assets/terrain/ground/       seamless runtime ground textures
src/assets/terrain/paths/dirt/   individual connection-mask tiles
src/assets/terrain/props/        transparent scenery sprites
src/assets/towers/worlds/        shared shop/battlefield cutouts by world
src/assets/home/                 home background, icons, panels, and world cards
art/reference/                   supplied visual references
art/source-materials/            processed materials not currently bundled
art/source-sheets/               combined authoring sheets, not bundled
art/legacy/                      retired runtime art kept only as reference
```

## Prompt record

The original image-generation brief called for exact top-down game assets, a
polished modern RTS/city-builder material style, neutral or cool lighting, and
no yellow, orange, golden-hour, sepia, or muddy grading.

| Source name | Prompt summary |
|---|---|
| `grass-lush` | Seamless dense deep-green grass with restrained variation and no objects or borders. |
| `grass-trimmed` | Seamless short maintained grass with uniform material response and no directional shadows. |
| `concrete-light` | Seamless cool-grey poured concrete with fine aggregate and restrained wear. |
| `concrete-panel` | Seamless charcoal modular hardscape with subtle panel seams and mineral texture. |
| `mycelium-network` | Linked purple and cream mushroom cluster on a mossy defence base. |
| `pollinator-post` | Wooden hive post, honeycomb launcher, flowers, and bee motifs. |
| `canopy-guardian` | Layered leafy treetop lookout with a branch launcher. |
| `root-snare` | Knotted roots around a glowing seed core. |
| `seed-slinger` | Leaf-powered sling with a seed-pod hopper. |
| `weathered-oak` | Ancient oak guardian with an acorn energy core. |
| `terrain-rock-fern` | Compact top-down cluster of cool-grey rocks and dark-green fern tufts. |

Sprite prompts used a flat magenta chroma-key background and excluded floors,
cast shadows, text, logos, and watermarks.

The complete Forest prompt set and current generation status live in
`art/source-images/towers/forest/PROMPTS.md`. Retired household-tower prompts and
art are historical references only and must not be restored to runtime folders.

The complete home-screen prompt set lives in
`art/source-images/home/PROMPTS.md`. Its generated labels and borders are kept
out of raster art so they remain responsive and editable in HTML/CSS.

## Processing workflow

Convert chroma-key source images to transparent RGBA first, then run:

```text
python scripts/process_generated_assets.py \
  --source tmp/imagegen/source \
  --alpha tmp/imagegen/alpha
```

The script routes tower sprites, terrain props, and non-runtime source materials
to their appropriate folders. Tower-card portraits can be reproduced from the
supplied UI reference with:

```text
python scripts/extract_ui_reference_assets.py
```

The dirt-path builder writes its combined authoring sheet to
`art/source-sheets/terrain/dirt-path-16-mask-atlas.png`. After rebuilding that
sheet, split it into named runtime files with:

```text
python scripts/split_terrain_path_tiles.py
```

Runtime path filenames begin with the numeric `N=1, E=2, S=4, W=8` bitmask and
include a readable orientation, such as `10-straight-horizontal.webp` and
`15-junction-four-way.webp`. Mask zero is emitted as a real isolated dirt island.

After chroma-removing the five home-screen icons, rebuild all home runtime art
with `python scripts/process_home_assets.py`.
