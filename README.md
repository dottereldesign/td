# MONO//WARD

MONO//WARD is a complete single-player tower-defense prototype built for static hosting on GitHub Pages. It uses a full-viewport, high-DPI Canvas battlefield with translucent HTML controls layered over the map. No backend, account, or paid service is required.

The interface and combat language stay graphite, white, and grey, with restrained cool cyan, green, and violet cues for fast status recognition. Natural cool greens, neutral concrete, and local top-down sprites give the terrain an RTS-style material finish without warm yellow or orange grading. Shape, line style, labels, and patterns still carry the important gameplay meaning.

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
- Fullscreen terrain with translucent overlay controls, responsive safe areas, and a mobile command tray.
- Placement ghost, true range preview, faint grid, and text/pattern invalid-placement feedback.
- Pause and 1×/2×/3× simulation speed.
- Local completion records and best remaining integrity via `localStorage`.
- Generated Web Audio feedback with a persistent mute control.
- Responsive desktop/mobile layouts and auto-pause when the tab is hidden.

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
src/assets/generated/  generated terrain textures, props, and tower sprites
src/ui/UI.ts            HUD, shop, modals, local records, keyboard-facing controls
src/audio.ts            small generated Web Audio cues
scripts/                reproducible generated-asset processing
tests/                  unit and Playwright browser tests
```

All runtime art is bundled locally; the game does not hotlink image assets. The generated-art workflow and prompt record are in [docs/ASSET_GENERATION.md](docs/ASSET_GENERATION.md). Third-party icons and fonts are permissively licensed; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
