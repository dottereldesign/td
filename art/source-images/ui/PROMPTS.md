# Magical modal frame

## Production asset

- Runtime file: `src/assets/ui/frames/modal-frame.webp`
- Source format: one square nine-slice frame containing four fixed corners,
  four compatible edge rails, and an empty transparent center.
- Integration: CSS `border-image` with 342px top/bottom and 334px left/right
  source slices, positioned just beyond the source artwork's corner cuffs. The browser
  preserves the corners and independently stretches the horizontal and vertical
  rails to fit each dialog.
- Generation workflow: OpenAI built-in image generation, flat magenta chroma
  background, then local soft-matte removal and WebP alpha export.

## Prompt

```text
Use case: stylized-concept
Asset type: production game UI nine-slice modal frame source atlas
Primary request: Create one complete square magical fantasy game UI frame,
designed specifically to be sliced into four fixed corners, four repeatable edge
rails, and an empty transparent center for responsive modal dialogs.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background covering both
the outside and the open center; no gradient, texture, shadow, reflection, or
lighting variation in the chroma area.
Style/medium: polished premium 3D-painted children's learning adventure game UI;
magical but subtle, refined rather than gaudy.
Composition/framing: perfectly front-facing symmetrical square frame filling a
1024x1024 canvas. Frame thickness exactly about 150 pixels. Four substantial
matching corner ornaments. Horizontal top/bottom rails must be straight,
consistent thickness, and visually repeatable across their middle 60%; vertical
left/right rails must be straight, consistent thickness, and visually repeatable
across their middle 60%. All rail-to-corner joins must align flawlessly. Large
completely empty chroma-key center.
Lighting/mood: soft cyan moon glow, faint violet magic, tiny restrained warm-gold
highlights; elegant low-intensity bloom.
Color palette: deep midnight navy, translucent sapphire blue, muted violet, small
champagne-gold accents, pale cyan edge light. Do not use #ff00ff in the frame.
Materials/textures: layered enamel, subtly faceted crystal, brushed gold filigree,
tiny star-dust specks confined to the frame.
Constraints: no text, letters, icons, emblems, characters, buttons, or watermark.
No cast shadow outside the frame. Frame only; chroma background must remain
uniform #ff00ff. Corners must be crisp and clearly separable for nine-slice use.
Avoid busy ornament, large gems, thick medieval stone, sci-fi circuitry, neon
arcade styling, and asymmetry.
```

# Modal close button

## Production asset

- Runtime file: `src/assets/ui/buttons/modal-close.webp`
- Generation workflow: OpenAI built-in image generation using the modal frame
  as a style reference, flat magenta chroma background, local soft-matte removal,
  alpha trim, and 256px lossless WebP export.

## Prompt

```text
Use case: stylized-concept
Asset type: compact game UI close-button icon, intended to display at 38–48 CSS pixels
Input images: Image 1 is a style and material reference only; do not edit or reproduce the whole frame
Primary request: create one compact magical close-button medallion that belongs to the same UI family as Image 1
Subject: a bold, unmistakable ivory X centered inside a small deep midnight-blue faceted crystal medallion, thin warm-gold rim, tiny cool-cyan edge glints
Style/medium: polished hand-painted 3D mobile game UI icon, chunky readable silhouette, restrained detail at small size
Composition/framing: single centered square-ish medallion, front-facing, symmetrical, generous empty padding around the entire object
Lighting/mood: subtle enchanted glow, crisp highlights, premium but not flashy
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local removal; exactly uniform edge to edge
Constraints: background must have no shadow, gradient, texture, reflection, floor plane, or lighting variation; no cast shadow outside the medallion; crisp edges; do not use #ff00ff in the icon; no words or extra symbols; no frame corner; no watermark
Avoid: green, beige, oversized flourishes, thin X strokes, circular fantasy scene, busy detail, drop shadow extending into the background
```

# Enchanted vellum modal texture

## Production asset

- Runtime file: `src/assets/ui/textures/enchanted-vellum.webp`
- Generation workflow: OpenAI built-in image generation using the modal frame
  as a palette reference, then a 1024px optimized WebP export.

## Prompt

```text
Use case: stylized-concept
Asset type: seamless tileable game UI panel texture for modal interiors
Input images: Image 1 is a palette and material-style reference only; do not reproduce the frame or its ornaments
Primary request: create a seamless deep-midnight enchanted vellum texture for the inside surface of fantasy game dialogs, like premium magical scroll paper dyed navy
Style/medium: hand-painted game UI material texture, refined and subtle, soft parchment fibers, minute paper grain, faint cloudy dye variation, extremely sparse tiny cool-blue magical dust flecks
Composition/framing: square edge-to-edge material swatch, perfectly seamless on all four edges, uniform visual density, no focal point
Lighting/mood: neutral diffuse material lighting, dark calm magical atmosphere
Color palette: near-black navy, ink blue, muted indigo; very restrained cyan pinpricks; no bright areas
Materials/textures: fine vellum fibers and gently mottled natural pigment, enough detail to feel tactile but quiet behind white UI text
Constraints: seamless tiling; uniform average brightness edge to edge; no directional gradient; no vignette; no border; no frame; no corners; no symbols; no runes; no readable marks; no text; no objects; no lighting hotspot; no watermark
Avoid: beige or brown parchment, leather, stone, wood, fabric weave, dramatic nebula, large stars, high contrast, busy detail, visible repeating motif
```
