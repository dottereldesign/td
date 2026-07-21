# MONO//WARD — complete game context

This document is the primary context handoff for future developers and language
models. Read it before changing game rules, progression, content, UI, assets, or
architecture. When code and this document disagree, verify the code and update
this document in the same change.

## 1. Product summary

MONO//WARD is a single-player, browser-based tower-defence game for children.
Players protect imaginative learning worlds by placing six complementary tower
types beside a fixed enemy route. Each world introduces a school-age subject
through names, environments, short explanations, and eventually interactive
lesson moments embedded in normal play.

The guiding promise is:

> Build clever defences, discover how the world works, and protect six realms
> one lesson at a time.

The game should feel like a polished game first. Educational material must be
short, concrete, encouraging, and connected to what the player is already doing.
It must not become a worksheet pasted over the action.

### Intended audience

- Primary: children approximately 7–12 years old.
- Secondary: parents, teachers, and older players who enjoy approachable tower
  defence.
- Reading should use plain language, short sentences, and explain unfamiliar
  terms in context.
- Failure is feedback, not punishment. Retry loops should be quick.

### Product principles

1. **Play leads; learning supports it.** A player can understand the combat loop
   without reading a long lesson.
2. **Every world has a coherent idea.** Art, tower names, map names, and future
   learning interactions all reinforce the same subject.
3. **Readable beats busy.** Paths, enemies, ranges, and placement states must be
   understandable at a glance.
4. **Strategy comes from combinations.** No single affordable tower should be
   the correct answer to every wave.
5. **Progress feels visible.** Stars, completed maps, unlocked knowledge, and
   world totals show growth without an account or backend.
6. **No dark patterns.** There are no purchases, ads, accounts, loot boxes,
   streak pressure, or manipulative timers.

## 2. Current player journey

The intended screen flow is:

```text
Home
  -> World select
      -> Map select (three maps)
          -> Build phase
              -> Combat waves
                  -> Victory/defeat report
                      -> retry or return to worlds
```

### Home screen

The home screen is the first thing a player sees. It contains:

- the MONO//WARD title;
- a one-sentence explanation of the adventure;
- total stars earned out of 54;
- the total scope: 18 maps across six worlds;
- a prominent **Start adventure** button;
- three simple pillars: Learn, Build, Master.

The game battlefield is already initialized behind the home screen so entering
play is immediate. The home screen itself is an HTML/CSS interface, not a
flattened image.

### World select

All six world cards show:

- world number and name;
- subject theme;
- a one-sentence purpose;
- stars earned out of nine;
- whether its custom art pass is complete or still using placeholders.

Worlds are currently selectable without locks. If unlocking is added later, do
not make a child replay content excessively. A gentle star requirement or
previous-world completion is preferable.

### Map select

Each world contains exactly three maps. A map card shows:

- route preview;
- map number and name;
- topic/difficulty subtitle;
- short briefing;
- earned stars;
- best remaining integrity;
- wave count.

Selecting **Deploy to sector** starts that level and swaps the tower shop to the
selected world's roster.

## 3. Worlds and content plan

There are six worlds and eighteen maps total.

| # | World | Subject | Maps | Art status |
|---:|---|---|---|---|
| 1 | Forest World | Ecosystems and nature | Mossy Crossing; Sunpetal Grove; Elderwood Heart | First custom art pass |
| 2 | Workshop World | Machines and cause-and-effect | Cogworks Entry; Assembly Line; Boiler Core | Placeholder art |
| 3 | Word World | Literacy and language | Alphabet Avenue; Rhyme River; Storybook Keep | Placeholder art |
| 4 | Number World | Patterns, counting and logic | Counting Garden; Fraction Fields; Logic Lab | Placeholder art |
| 5 | Space World | Planets, gravity and science | Moonbase Approach; Orbit Junction; Nebula Gate | Placeholder art |
| 6 | Music World | Rhythm and sequencing | Rhythm Road; Harmony Hall; Finale Stage | Placeholder art |

Each world currently reuses the three proven route topologies with a unique
level ID, title, seed, difficulty scale, and roster. Bespoke terrain, waves, and
learning encounters can be authored later without changing progression APIs.

### Forest World

Learning themes include food webs, decomposers, pollination, plant adaptation,
forest layers, seed movement, and cooperation inside an ecosystem.

Forest tower roster:

1. **Mycelium Network** — reliable normal damage. Linked fungi communicate and
   share resources beneath the forest floor.
2. **Pollinator Post** — rapid pierce damage. Pollinators help flowering plants
   reproduce and connect habitats.
3. **Canopy Guardian** — siege splash. The canopy is the high leafy forest layer
   that captures light and shelters wildlife.
4. **Root Snare** — magic damage and slow. Roots anchor plants and collect water
   and nutrients.
5. **Seed Slinger** — pierce damage over time. Seeds spread in many ways and can
   cling, glide, float, or be carried.
6. **Weathered Oak** — expensive armor-neutral damage. An old tree supports many
   organisms at once.

### Workshop World

Learning themes include forces, cause and effect, simple machines, energy
transfer, mechanical sequences, and chain reactions.

Roster: **Gearbox Turret**, **Magnet Crane**, **Pressure Piston**, **Spark Relay**,
**Conveyor Cannon**, **Chain-Reaction Engine**.

### Word World

Learning themes include letters and sounds, rhyme, punctuation, narrative,
syllables, context, and vocabulary.

Roster: **Letter Launcher**, **Rhymecaster**, **Punctuation Station**,
**Storykeeper**, **Syllable Splitter**, **Dictionary Dragon**.

### Number World

Learning themes include operations, patterns, counting, fractions, sequences,
comparison, and logical reasoning.

Roster: **Plus Pulse**, **Divider Array**, **Pattern Prism**, **Sequence Sentry**,
**Fraction Fortress**, **Logic Engine**.

### Space World

Learning themes include gravity, planets, orbits, comets, solar energy,
satellites, stars, and nebulae.

Roster: **Gravity Well**, **Comet Cannon**, **Orbit Array**, **Solar Flare**,
**Satellite Sentry**, **Nebula Forge**.

### Music World

Learning themes include steady beat, tempo, pitch, melody, bass, echo,
arrangement, and conducting sequences.

Roster: **Beat Blaster**, **Tempo Tower**, **Bass Bastion**, **Melody Mortar**,
**Echo Chamber**, **Conductor Core**.

## 4. Progression and stars

Every map awards up to three stars after victory. Defeat awards none.

| Remaining integrity | Stars |
|---|---:|
| Less than 50% of starting integrity | 1 |
| At least 50% | 2 |
| At least 80% | 3 |

The best result is retained; replaying a map can increase but never reduce its
star record. With 18 maps, the current maximum is 54 stars. Each world has a
maximum of nine.

Progress is stored locally under `mono-ward-progress`:

```ts
interface ProgressRecord {
  stars: Record<levelId, number>;
  bestLives: Record<levelId, number>;
}
```

The loader migrates the earlier `completed: string[]` format by giving each old
completion one star. Corrupt or missing data falls back to an empty record.
There is no cloud save or account.

## 5. Core gameplay loop

1. Choose a world and map.
2. Begin in a build phase with starting credits and integrity.
3. Inspect the next wave's first armor type.
4. Choose one of six towers and place it on a non-path, unoccupied tile.
5. Send the next wave manually.
6. Towers automatically acquire targets according to First, Strong, or Last.
7. Earn credits from defeated enemies and a bonus for clearing a wave.
8. Build, upgrade, retarget, or sell between and during waves.
9. Clear all eight waves to win; let too many enemies reach the core to lose.
10. Receive stars and retry or choose another map.

### Placement

- Towers occupy one grid cell.
- A tower cannot be placed outside the map, on any visual path-network cell, on
  another tower, or without enough credits.
- Selecting a tower displays the grid, placement ghost, and true range.
- Holding Shift after placement keeps the same tower selected.

### Economy

- Each world uses the same six balanced costs and combat-role values for now.
- Kills pay the enemy's bounty.
- Every cleared wave grants a defined clear bonus.
- Towers have three tiers.
- Upgrade costs are based on original tower cost and current tier.
- Selling returns 72% of total invested credits, rounded down to a multiple of
  five.

## 6. Towers and combat roles

World rosters are thematic skins over six stable internal role IDs. Keeping the
roles stable preserves balance and lets art/names vary per world.

| Slot | Internal ID | Attack | Job |
|---:|---|---|---|
| 1 | `sentry` | Normal | affordable reliable damage; strong into Medium |
| 2 | `needle` | Pierce | fast shots; strong into Light and Unarmored |
| 3 | `mortar` | Siege | slower splash; strong into Fortified and groups |
| 4 | `arcanum` | Magic | Heavy counter with temporary slow |
| 5 | `toxin` | Pierce | low direct hit plus stacking damage over time |
| 6 | `null` | Chaos | expensive armor-neutral generalist |

Do not rename these internal IDs casually. They are referenced by combat visual
effects, projectile drawing, tests, and saved in live tower entities. Player-
facing names come from `WORLD_TOWER_DEFINITIONS`.

### Upgrades

Each tower begins at tier one and can reach tier three. Every tier:

- increases damage by 34% of base per tier above one;
- reduces interval by multiplying it by 0.88 per tier;
- adds 0.22 tiles of range.

### Target priorities

- **First:** enemy furthest along the route.
- **Strong:** enemy with the highest current health.
- **Last:** enemy least far along the route.

### Projectiles and effects

- Projectiles travel rather than applying instant damage.
- Siege attacks can damage multiple enemies in a radius with falloff.
- Slow refreshes a temporary movement multiplier.
- Poison refreshes per source; different poison towers may stack up to three
  sources. Poison bypasses numerical armor and can kill.
- Visual projectile vocabulary still follows internal role IDs, so a world can
  reskin towers without duplicating the combat simulation.

## 7. Damage and armor

Attack types: Normal, Pierce, Siege, Magic, Chaos.

Armor classes: Unarmored, Light, Medium, Heavy, Fortified.

Final direct damage is:

```text
base damage × attack/armor multiplier × numerical armor factor
```

For non-negative armor:

```text
armor factor = 1 / (1 + 0.06 × armor)
```

For negative armor:

```text
armor factor = 2 - 0.94 ^ (-armor)
```

The field manual exposes the type matchup matrix. The shop also shows each
tower's multiplier against the next wave's first armor class. This teaches
comparison and composition through immediate feedback.

## 8. Enemies and waves

Every current map has eight designed wave definitions. Groups specify:

- armor class and numerical armor;
- count;
- health;
- movement speed;
- spawn interval;
- bounty;
- optional visual scale.

Enemies move along the ordered `LevelDefinition.path`. Their position is stored
as a segment index plus progress within the segment. Reaching the final route
cell removes integrity. The simulation runs at a deterministic fixed 60 Hz step
and supports 1×, 2×, and 3× speed.

Current enemy visuals are procedural. World-specific enemy art and educational
enemy identities are future content, not an implemented system.

## 9. Maps, routes, and terrain

Maps are 18 columns by 11 rows. A level contains:

- identity, world, title, number, and briefing;
- dimensions;
- starting economy and integrity;
- an ordered enemy path;
- optional visual terrain data;
- eight waves;
- a displayed difficulty value.

The ordered enemy path and visual path network are intentionally separate.
Enemies follow only the ordered path. `terrain.pathBranches` may create dead
ends, loops, T-junctions, and four-way intersections without silently changing
enemy navigation.

### Terrain system

`TerrainMap` supports:

- `grass`, `path`, and `dirt` cells;
- construction from an ordered route;
- rectangular text arrays using `.`, `#`, and `d`;
- procedural generation callbacks;
- runtime cell editing;
- four-direction path masks;
- canonical eight-neighbour blob masks for dirt regions;
- revision tracking that invalidates the static render cache.

Path masks use `N=1`, `E=2`, `S=4`, and `W=8`. The sixteen runtime PNGs are
stored individually under `src/assets/terrain/paths/dirt` and named with their
numeric mask and orientation.

### Rendering layers

1. Repeating grass backdrop.
2. Board grass and lighting variation.
3. Eight-neighbour dirt clearings.
4. Individual path tiles.
5. Deterministic static props and grass marks.
6. Build/path-flow overlays.
7. Towers and enemies.
8. Projectiles, impacts, selection, and placement effects.

Static terrain renders to a separate cached canvas. Dynamic combat renders to a
transparent canvas above it.

## 10. Interface and controls

### Keyboard and pointer

| Input | Action |
|---|---|
| `1`–`6` | choose tower slot |
| click/tap | build or select |
| Shift + build | keep building the same tower |
| right-click or Escape | cancel/deselect |
| Space | send wave, pause, or resume |
| `F` | cycle speed |
| `U` | upgrade selected tower |
| `T` | cycle target priority |
| `?` or `/` | field manual |
| `F3` | performance monitor |

### HUD

The top bar shows current map, integrity, credits, wave, performance, sound, and
help. The side panel contains six tower cards, selected-tower controls, and armor
intel. The bottom command bar describes the next/current wave and provides
pause, speed, and send-wave controls.

The interface is responsive. Desktop uses a battlefield plus side shop. Narrow
screens turn the shop into a lower tray and preserve the command controls.

### Accessibility expectations

- Every interactive element must be a real button with an accessible name.
- Images used decoratively have empty alt text.
- Keyboard controls must not fire through an open modal.
- Reduced-motion preference disables or minimizes ambient motion.
- Color is reinforced by text, symbols, or patterns where it conveys state.
- Touch targets remain usable on a 390 × 844 viewport.

## 11. Art direction and asset rules

The visual style is cheerful polished 3D game art with:

- rounded, chunky silhouettes;
- soft bevels and molded materials;
- cream highlights and restrained dark outlines;
- readable shapes at small sizes;
- friendly rather than aggressive character;
- cohesive green-and-cream interface framing.

Forest tower art should match the established portrait feeling: a centered
three-quarter elevated object on a compact circular base, with enough padding to
work both in a shop card and on the battlefield. The same authored image is used
in both places to keep identity consistent.

Runtime assets are organized by game domain:

```text
src/assets/terrain/ground/
src/assets/terrain/paths/dirt/
src/assets/terrain/props/
src/assets/towers/worlds/<world>/
```

References, source images, source sheets, unused materials, and retired assets
belong under `art`, never in runtime folders. Do not recreate a generic
`generated` directory.

Combined sheets may exist as authoring sources under `art/source-sheets`, but
runtime tiles and sprites must be separate, descriptively named files.

## 12. Audio

Audio is generated locally with Web Audio after the first user gesture. It
includes UI, build, combat, wave, and outcome feedback. The mute preference is
persistent. The game does not download music or sound assets at runtime.

## 13. Performance architecture

- TypeScript and Canvas 2D; no runtime game engine.
- Fixed-step deterministic simulation.
- Static terrain cached separately from dynamic combat.
- Device pixel ratio capped by a roughly 2.2-megapixel backing-store budget.
- Effects reduce automatically for large canvases, reduced-motion users, or
  heavy entity counts.
- DOM UI updates are throttled; hot combat events do not synchronously rerender
  the entire interface.
- F3 opens an in-game performance monitor for frame, simulation, render, canvas,
  event, and long-task diagnostics.

## 14. Codebase map

```text
index.html                         application and modal structure
src/main.ts                        bootstrap, input, and fixed-step loop
src/types.ts                       shared domain types
src/data.ts                        worlds, maps, waves, towers, and balance
src/game/Game.ts                   simulation, economy, placement, targeting
src/game/damage.ts                 attack/armor matrix and armor formula
src/progression.ts                 star thresholds and display helpers
src/terrain/TerrainMap.ts          editable terrain and mask calculation
src/render/Renderer.ts             static and dynamic Canvas rendering
src/render/assets.ts               runtime image manifest and world tower lookup
src/ui/UI.ts                       home, selection flow, HUD, shop, results, saves
src/audio.ts                       procedural Web Audio feedback
src/performance/                   diagnostics and performance panel
src/assets/                        runtime-only art
art/                               references, source art, sheets, and retired art
scripts/                           reproducible art processing
tests/                             unit and Playwright coverage
```

## 15. Data-authoring rules

### Adding a world

1. Add its ID to `WorldId` and `WORLD_IDS`.
2. Add metadata to `WORLD_CONTENT`.
3. Add six names in the same role order to `WORLD_TOWER_NAMES`.
4. Add or generate three level definitions.
5. Add six separate runtime images under `src/assets/towers/worlds/<id>`.
6. Register images in `src/render/assets.ts` for both shop and battlefield use.
7. Add learning goals and concise player-facing descriptions.
8. Extend tests for world count, maps, names, assets, and navigation.

### Adding a map

1. Give it a stable globally unique ID such as `forest-4`.
2. Set the correct `worldId`.
3. Validate every ordered path step is an in-bounds cardinal neighbour.
4. Keep enough buildable cells for multiple strategies.
5. Use visual branches only when a junction is intended.
6. Provide eight waves and verify an affordable mixed strategy can finish.
7. Add a topic-specific briefing and map name.

### Adding tower art

1. Generate one distinct image per tower; do not use a multi-object runtime
   sheet.
2. Preserve the world's style and the shared readable silhouette rules.
3. Use a flat removable chroma-key background when transparency is needed.
4. Validate alpha, crop, padding, and small-size readability.
5. Save the source under `art/source-images` and optimized runtime PNG under
   `src/assets/towers/worlds/<world>`.
6. Use the same asset in the HTML shop and Canvas battlefield.

## 16. Testing and release

Required checks for ordinary feature work:

```text
vitest run
tsc -b
vite build
playwright test
```

Key coverage includes damage math, economy, balance smoke tests, path masks,
terrain editing, world/map data integrity, star thresholds, main gameplay flow,
mobile usability, asset loading, and canvas pixel budgets.

The Vite build uses relative paths and deploys as a static site. The repository
workflow requires completed, verified work to be committed and pushed to
`origin/main` without force-pushing.

## 17. Current implementation boundary

Implemented now:

- six world definitions;
- three playable maps per world;
- all requested player-facing tower names;
- home, world, and map selection flow;
- three-star local progression;
- existing full combat/economy loop across every world;
- Forest Mycelium Network authored art;
- plain procedural glyph fallback for art slots not yet authored.

Planned but not yet implemented:

- bespoke routes, terrain palettes, enemies, and waves for worlds 2–6;
- individual authored art for every non-Forest tower;
- formal interactive lesson prompts, glossary collection, or teacher reporting;
- profiles, cloud saves, classroom accounts, localization, and narration;
- world unlocking rules;
- world-specific audio and enemy art.

Do not describe planned items as shipped features. Add them to the implemented
list only when code, assets, tests, and player-facing UI are all complete.
