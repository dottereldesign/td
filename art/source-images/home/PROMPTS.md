# Home-screen image generation prompts

These assets were generated individually with the built-in image-generation
workflow. All interface borders, labels, counters, badges, buttons, and the
`SNACK SQUAD` wordmark are HTML/CSS; generated images intentionally contain no
text. The supplied composition reference is stored at
`art/reference/ui/home-screen-reference.png`.

Runtime outputs are organized under `src/assets/home/`:

- `background/` — full-screen environment art
- `icons/` — transparent profile and activity cutouts
- `panels/` — event and squad illustrations
- `worlds/` — portrait illustrations for the six learning worlds

## Shared visual direction

> Polished glossy 3D mobile-game art for a family-friendly educational
> tower-defense game. Use chunky rounded toy forms, clean dark navy outlines,
> beveled materials, saturated color, strong readable silhouettes, cinematic
> cyan and gold rim lighting, and an original cast. No letters, numbers,
> readable text, interface chrome, logos, or watermarks.

Transparent icons use a perfectly flat solid `#ff00ff` chroma-key background
with no gradient, floor, shadow, texture, reflection, or magenta in the subject.

## Background

### `home-background.png`

> Cinematic whimsical command room inside a magical learning fortress, viewed
> straight-on toward a huge warm glowing central portal. Shadowy toy-like
> shelves and oversized learning objects at the side edges; lush leaves and
> subtle blue crystals along the bottom corners. Deep navy framing around a
> radiant peach, lavender, cyan, and golden central glow. Landscape composition
> with the brightest center reserved as clean negative space for a coded logo
> and play controls, quiet side zones for panels, and a darker lower card band.
> Environment only; no characters or UI.

## Profile and activity icons

Use the shared transparent-icon setup and one centered object with generous
padding for each prompt:

- `profile-avatar-magenta.png` — Friendly heroic acorn explorer mascot from the
  chest up, oversized teal adventure goggles, tiny navy cape collar, confident
  joyful grin; amber-brown, cream, teal, cyan, navy, and gold.
- `missions-magenta.png` — Chunky mission clipboard, cream checklist paper,
  three teal check marks, gold star badge, sky-blue clip.
- `daily-rewards-magenta.png` — Wrapped turquoise reward chest, wide golden
  ribbon and bow, small glowing cream star charm.
- `achievements-magenta.png` — Golden trophy with an embossed star, short
  handles, cyan jewel, and dark navy pedestal.
- `collection-magenta.png` — Fanned stack of three collectible learning cards;
  front card has a cyan shield and gold star, rear cards have teal and orange
  abstract shapes.

## Feature panels

### `summer-event.png`

> Landscape event card: a mischievous fuzzy lime-green mold monster emerging
> from a chilled summer picnic cooler, surrounded by sparkling icy mist, tiny
> bouncing spores, tropical leaves, and a bright sun flare. Put the monster on
> the right half and leave calmer dark-blue/teal space on the left for coded
> event text. Saturated lime, aqua, cyan rim light, and warm gold highlights.

### `squad.png`

> Landscape squad card: tight heroic lineup of four original friendly
> learning-world defenders from the shoulders up — amber acorn explorer with
> teal goggles, bright cyan crystal sprite, cheerful orange wooden-block
> inventor, and tiny lime-green sprout guardian. Arrange faces in a shallow arc
> against a dark navy-to-teal glowing background with cyan and gold rim lights.

## World cards

All world prompts use a portrait-friendly, full-bleed card composition with a
centered focal character, layered foreground and background, safe margins, and
no generated border.

- `world-forest.png` — Enchanted forest with a wise enormous oak guardian,
  friendly mushroom scouts, bright ferns, flowers, and a winding sunlit path;
  emerald foliage, warm golden rays, and magical cyan accents.
- `world-workshop.png` — Whimsical workshop with a cheerful compact robot
  inventor, toolbox helpers, brass gears, pipes, pulleys, conveyors, and a
  glowing energy core; warm orange/brass light and teal energy.
- `world-word.png` — Magical language realm inside an enormous open storybook,
  friendly purple book guardian, completely blank parchment, speech ribbons,
  quills, library towers, and blank colorful blocks; violet, raspberry, coral,
  and cyan sparkle accents.
- `world-number.png` — Logic-and-pattern garden with friendly geometric
  guardians, counting beads, nested shapes, balance scales, blank tiles,
  pattern paths, and a crystalline puzzle tower; no digits or operators.
- `world-space.png` — Space-science realm with a friendly tiny rocket explorer,
  smiling moon-like companion, ringed planets, asteroids, orbit trails,
  satellites, and a glowing nebula gateway; indigo, cyan, violet, and coral.
- `world-music.png` — Music realm with friendly drum, keyboard, brass-horn, and
  string-instrument guardians performing on a glowing stage, surrounded by
  rhythmic light ribbons, colored orbs, speaker flowers, and wave patterns; no
  musical-note glyphs.

After removing chroma keys into `tmp/imagegen/home-alpha/`, rebuild optimized
runtime assets with `python scripts/process_home_assets.py`.
