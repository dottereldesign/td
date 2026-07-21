# Generated art record

The nine runtime images in `src/assets/generated/` were created with OpenAI image generation for this prototype. They are checked into the repository and loaded locally by Vite; the game has no runtime image hotlinks.

The visual brief was consistent across the set: exact top-down game assets, a polished modern RTS/city-builder material style, neutral or cool lighting, and no yellow, orange, golden-hour, sepia, or muddy warm grading. The designs are original rather than copies of an existing game's assets.

## Prompt record

| Output | Prompt summary |
|---|---|
| `grass-lush.webp` | Seamless orthographic square terrain texture of dense, healthy deep-green grass with subtle forest-green variation and tiny embedded clover-like leaves; even density, soft neutral overcast light, no objects, dirt, flowers, borders, horizon, or focal point. |
| `grass-trimmed.webp` | Seamless orthographic square texture of short maintained grass for a modern city-builder park verge; fine blades, restrained cool-green variation, uniform material response, no paths, objects, dirt patches, stripes, borders, or directional shadows. |
| `concrete-light.webp` | Seamless orthographic poured-concrete ground texture in light-to-mid cool grey; fine aggregate, restrained wear and pores, flat neutral illumination, no cracks, lane markings, panel seams, stains, borders, shadows, or props. |
| `concrete-panel.webp` | Seamless orthographic modular hardscape texture in cool charcoal grey; subtle geometric panel seams, fine mineral aggregate, restrained edge wear, flat neutral illumination, no painted markings, objects, dramatic cracks, or shadows. |
| `tower-vacuum.png` | Centered exact-top-down upright vacuum-cleaner defense turret, compact graphite and brushed-silver body with restrained cool-cyan indicators, readable silhouette, polished stylized 3D game render on perfectly flat `#ff00ff` chroma-key background. |
| `tower-brush.png` | Centered exact-top-down oval hairbrush defense turret, black/violet body with dense steel bristles arranged as a needle array, compact mechanical detailing and a readable silhouette, on flat `#ff00ff` chroma-key background. |
| `tower-toaster.png` | Centered exact-top-down armored two-slot toaster mortar, brushed silver and graphite casing with stout tactical feet and a clear appliance silhouette, cool neutral metal lighting, on flat `#ff00ff` chroma-key background. |
| `tower-sprayer.png` | Centered exact-top-down fly-spray defense turret, teal/green pressure canister with nozzle, hose, gauge, and compact base, polished stylized 3D game render with a readable silhouette, on flat `#ff00ff` chroma-key background. |
| `terrain-rock-fern.png` | Small centered top-down terrain-prop cluster of three cool-grey rocks and dark-green fern tufts, neutral soft lighting and a compact natural silhouette, on flat `#ff00ff` chroma-key background. |

Each sprite prompt also required no floor, cast shadow, gradient, background texture, text, logo, or watermark. Every prompt explicitly excluded warm yellow/orange light and filters.

## Processing workflow

The four opaque terrain generations were saved under their matching `.png` source names. The five magenta-backed generations were first converted to transparent RGBA images with the ImageGen skill's `remove_chroma_key.py` helper, using border auto-keying, a soft matte, despill, and transparent/opaque thresholds of 12/220:

```text
python <imagegen-skill>/scripts/remove_chroma_key.py \
  --input <source.png> --out <alpha.png> --auto-key border \
  --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

The repository's processing script then makes the texture boundaries repeat cleanly, exports 512×512 WebP terrain files, crops and pads sprite alpha bounds, and exports 384×384 optimized PNG sprites:

```text
python scripts/process_generated_assets.py \
  --source tmp/imagegen/source \
  --alpha tmp/imagegen/alpha \
  --output src/assets/generated
```

Expected source names are the output basenames shown above with `.png` used for all four terrain inputs. This keeps processing reproducible while leaving only browser-ready assets in the production bundle.
