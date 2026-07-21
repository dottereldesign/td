# MONO//WARD

MONO//WARD is a complete single-player tower-defense prototype built for static hosting on GitHub Pages. It uses a full-viewport, high-DPI Canvas battlefield with responsive HTML controls layered over the map. No backend, account, or paid service is required.

The interface uses a playful green-and-cream molded-game style: rounded cards, inset highlights, short 3D button shadows, chunky icons, and illustrated household-object towers. The exact tower portraits are lossless crops from the supplied `ui-examples.png`; all interactive panels and controls are responsive HTML/CSS rather than flattened screenshots. Natural cool greens, neutral concrete, and local top-down sprites keep the battlefield readable beneath the UI.

## Play locally

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev
```

Windows note for this machine: its user-level npm configuration currently reports `script-shell=/bin/bash`, which is not present. Either remove that stale setting with `npm config delete script-shell`, or use a command-scoped override in PowerShell:

```powershell
$env:npm_config_script_shell='C:\Windows\System32\cmd.exe'
npm run dev
```

Production checks:

```bash
npm test
npm run build
npm run test:e2e
npm run test:perf
```

The build output is written to `dist/`.

## Included game systems

- Three data-driven tile maps: Switchback, Crosscut, and Gauntlet.
- Eight designed waves per map with Unarmored, Light, Medium, Heavy, and Fortified contacts.
- Six towers: Normal, Pierce, Siege, Magic + slow, Pierce + poison, and Chaos.
- Warcraft III: The Frozen Throne/Reforged-inspired attack-versus-armor multipliers.
- Warcraft III numerical armor reduction curve.
- Target priorities: First, Strong, and Last.
- Tier 1–3 upgrades, 72% sell refunds, kill bounties, and wave-clear bonuses.
- Projectile travel, siege splash, non-stacking slow, and up to three poison sources per enemy.
- Fullscreen terrain with opaque low-cost overlay controls, responsive safe areas, and a mobile command tray.
- Placement ghost, true range preview, faint grid, and text/pattern invalid-placement feedback.
- Pause and 1×/2×/3× simulation speed.
- Local completion records and best remaining integrity via `localStorage`.
- Generated Web Audio feedback with a persistent mute control.
- Responsive desktop/mobile layouts and auto-pause when the tab is hidden.
- Built-in F3 performance monitor with frame-time, subsystem, workload, canvas, long-task, and memory diagnostics.

## Performance diagnostics

Press `F3` or the activity icon in the top bar to open the performance monitor. Add `?perf=1` to the URL to open it automatically. The panel identifies UI-event, simulation, Canvas, long-task, and likely compositor pressure, and can copy a JSON report for comparison.

This work is called **performance profiling**, **frame-time analysis**, or **bottleneck analysis** in game development. The browser cannot read whole-system CPU/GPU percentages or temperatures; use Chrome Task Manager (`Shift+Esc`) or Windows Task Manager beside the in-game panel for those system-level numbers.

See [docs/PERFORMANCE.md](docs/PERFORMANCE.md) for the profiler guide, measured bottlenecks, optimization architecture, and stress-test commands.

## Controls

| Input | Action |
|---|---|
| `1`–`6` | Select a tower |
| Click/tap | Place or select |
| Hold `Shift` while placing | Keep building the same tower |
| Right-click or `Esc` | Cancel/deselect |
| `Space` | Send next wave or pause/resume |
| `F` | Cycle 1×/2×/3× speed |
| `U` | Upgrade selected tower |
| `T` | Cycle selected tower priority |
| `?` | Open the field manual |

## Tower roster

| Tower | Cost | Attack | Base damage / interval | Job |
|---|---:|---|---:|---|
| Vacuum Sentry | $90 | Normal | 24 / 0.82s | Reliable; counters Medium |
| Brush Array | $120 | Pierce | 13 / 0.38s | Rapid; counters Light and Unarmored |
| Toast Mortar | $175 | Siege | 58 / 1.70s | Splash; counters Fortified and Unarmored |
| Arcanum | $160 | Magic | 33 / 1.05s | Counters Heavy and applies a short slow |
| Fly Sprayer | $145 | Pierce | 8 / 0.75s | Adds 6 DPS poison for 4.5s |
| Null Engine | $280 | Chaos | 72 / 1.25s | Expensive armor-neutral generalist |

## Combat model

The prototype uses five armor classes and five attack classes. Multipliers are visible in the in-game field manual and the shop shows each tower's multiplier against the next wave's first armor class.

```text
final attack damage = base damage × class multiplier × armor factor
armor factor (armor >= 0) = 1 / (1 + 0.06 × armor)
armor factor (armor < 0)  = 2 - 0.94 ^ (-armor)
```

Poison is deliberately adapted for tower-defense readability: the same Fly Sprayer refreshes its own effect; different sprayers stack up to three times; poison bypasses numerical armor and can kill. This is documented as an adaptation, not a claim of exact Warcraft III status-effect behavior.

See [docs/DESIGN_AUDIT.md](docs/DESIGN_AUDIT.md) for the comparative game audit, source links, WC3 distinctions, and design decisions.

## Deploy to GitHub Pages

A Pages workflow is included at `.github/workflows/deploy.yml`.

1. Commit and push the project to the repository's `main` branch.
2. In GitHub, open **Settings → Pages**.
3. Set **Source** to **GitHub Actions**.
4. Push to `main` or run the workflow manually from the Actions tab.

The Vite base is `./`, so the single-page build works from a repository subpath such as `username.github.io/td/` without hard-coding the repository name. There are no client-side routes that require a Pages 404 workaround.

## Project structure

```text
src/data.ts             levels, waves, armor labels, tower balance
src/game/Game.ts        deterministic simulation, economy, targeting, status effects
src/game/damage.ts      matchup matrix and armor formula
src/render/Renderer.ts  fullscreen high-DPI Canvas terrain and combat rendering
src/render/assets.ts    local terrain and tower asset manifest/loading
src/terrain/TerrainMap.ts editable terrain grid, path networks, and 8-neighbour masks
src/assets/generated/  generated terrain textures, props, and tower sprites
src/assets/ui-reference/ exact tower portraits extracted from the supplied UI sheet
src/performance/        profiler core and in-game diagnostics panel
src/ui/UI.ts            HUD, shop, modals, local records, keyboard-facing controls
src/audio.ts            small generated Web Audio cues
scripts/                reproducible reference-asset extraction and generated-asset processing
tests/                  unit and Playwright browser tests
```

## Terrain authoring

Enemy movement still follows the ordered `LevelDefinition.path`. Optional
`level.terrain.pathBranches` cells extend only the visible/build-blocking path
network, so maps can contain dead ends, T-junctions, loops, and four-way
junctions without accidentally changing a wave's route. Optional
`level.terrain.dirt` cells form full-tile clearings using canonical
eight-neighbour blob masks.

`TerrainMap.fromArray()` accepts rectangular rows containing `.` (grass), `#`
(path), and `d` (dirt). `TerrainMap.generate()` accepts a coordinate callback
for procedural maps. At runtime, `game.terrain.set(x, y, kind)` updates local
neighbour masks and increments the terrain revision; the renderer notices that
revision and rebuilds its cached static terrain layer automatically.

All runtime art is bundled locally; the game does not hotlink image assets. The generated-art workflow and prompt record are in [docs/ASSET_GENERATION.md](docs/ASSET_GENERATION.md). Third-party icons and fonts are permissively licensed; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
