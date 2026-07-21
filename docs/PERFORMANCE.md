# Performance profiling guide

The game-development name for this work is **performance profiling**, with **frame-time analysis** and **bottleneck analysis** describing the specific workflow. The built-in tool is a **performance HUD** or **profiler overlay**.

## Open the profiler

- Press `F3` or select the activity icon in the top bar.
- Add `?perf=1` to the URL to open it on startup.
- Select **Copy report** to copy a JSON snapshot with no player or personal data.

The panel updates twice per second and is disabled when closed. It reports:

- FPS, average frame time, P95 frame time, and missed-frame percentage.
- Average simulation, Canvas-render, and HUD/DOM time.
- Long tasks over 50 ms.
- Canvas CSS/backing sizes, effective pixel ratio, and megapixels.
- Towers, enemies, projectiles, impacts, poison stacks, events, simulation ticks, Canvas frames, and static-terrain rebuilds.
- JavaScript heap when Chromium exposes it, otherwise logical CPU cores.
- A rule-based diagnosis such as UI event storm, simulation CPU pressure, Canvas pressure, or likely GPU/compositor pressure.

The browser sandbox cannot read total PC CPU/GPU utilization, temperatures, fan speed, VRAM usage, or other processes. For those values, use the profiler beside Chrome Task Manager (`Shift+Esc`) or Windows Task Manager. Chrome DevTools' Performance recording is the detailed flame-chart tool when a copied report identifies a recurring spike.

## What caused the slowdown

The generated images were not the sustained problem. They are loaded and decoded once. The expensive paths were architectural:

1. Poison damage emitted a hit event every simulation tick. At 3× speed, each poisoned enemy could produce 180 events per second, and every event forced a complete HUD render.
2. A full-screen Canvas was redrawing grass, gradients, every path tile, curbs, and props on every animation frame—even on 120–240 Hz monitors.
3. The backing buffer could reach device-pixel-ratio 2 without a pixel budget: 1920×1080 at DPR 2 is 8.3 million pixels per Canvas surface.
4. Three large translucent UI surfaces used live `backdrop-filter` blur over the moving Canvas, adding continuous compositor work.
5. Slow frames could accumulate extra fixed simulation updates and prolong a catch-up spiral.

## Changes made

- High-frequency hit, fire, and kill events no longer synchronously redraw the HUD; HUD state is coalesced to 5 Hz.
- Poison's continuous damage no longer emits thousands of public hit callbacks.
- Terrain and combat use separate Canvas layers. Grass, concrete, curbs, props, and gradients rebuild only for a resize, level change, or asset load.
- Combat drawing is capped at 60 FPS; build and paused states use 30 FPS.
- Canvas backing resolution follows a 2.2-megapixel budget, with a 1.35× maximum and dynamic downscaling on very large displays.
- Large live backdrop blurs were replaced with denser translucent surfaces.
- Cached geometry avoids forced layout reads every frame, and catch-up work is bounded.

## Repeatable tests

Run the representative 28-tower/48-enemy deterministic workload:

```bash
npm run test:perf
```

The test validates the pixel budget, HUD-render rate, Canvas-frame cap, static-cache stability, frame timing, active entities, and page errors. It saves a JSON report as a Playwright attachment and prints `PERF_REPORT` for automation.

For a deliberately excessive 40-tower/80-enemy, DPR 1.5, CPU-throttled diagnostic run in PowerShell:

```powershell
$env:PERF_STRESS='1'
$env:PERF_CPU_THROTTLE='2'
npm run test:perf
```

Stress mode records the timings without applying hardware-dependent FPS gates. Headless Chromium may use software rendering, so absolute GPU-sensitive FPS varies by machine; structural budgets and before/after reports are the reliable regression signals.
