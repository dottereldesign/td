# Art pipeline and runtime layout

Image-generated source art is processed into semantic runtime folders. Only
files imported by the application remain under `src/assets`; combined sheets,
references, and unused materials live under `art`.

```text
src/assets/terrain/ground/       seamless runtime ground textures
src/assets/terrain/paths/dirt/   individual connection-mask tiles
src/assets/terrain/props/        transparent scenery sprites
src/assets/towers/battlefield/   transparent in-game tower sprites
src/assets/towers/portraits/     interface card portraits
art/reference/                   supplied visual references
art/source-materials/            processed materials not currently bundled
art/source-sheets/               combined authoring sheets, not bundled
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
| `tower-vacuum` | Exact-top-down compact vacuum defense turret with graphite, silver, and cool-cyan details. |
| `tower-brush` | Exact-top-down hairbrush turret with a dark body and dense steel bristle array. |
| `tower-toaster` | Exact-top-down armored two-slot toaster mortar with tactical feet. |
| `tower-sprayer` | Exact-top-down teal/green pressure-canister turret with nozzle, hose, and gauge. |
| `terrain-rock-fern` | Compact top-down cluster of cool-grey rocks and dark-green fern tufts. |

Sprite prompts used a flat magenta chroma-key background and excluded floors,
cast shadows, text, logos, and watermarks.

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
include a readable orientation, such as `10-straight-horizontal.png` and
`15-junction-four-way.png`. Mask zero is emitted as a real isolated dirt island.
