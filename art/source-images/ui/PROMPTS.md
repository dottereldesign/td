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
