# Runtime assets

Only assets imported by the application belong in this directory.

```text
terrain/
  ground/       seamless board materials
  paths/dirt/   one named PNG for each path connection mask
  props/        transparent scenery sprites
towers/
  battlefield/  transparent sprites drawn on the game board
  portraits/    tower-card artwork used by the HTML interface
```

Path filenames begin with their numeric `N=1, E=2, S=4, W=8` bitmask. The
descriptive suffix makes each orientation understandable without opening it.
Combined sheets, original references, and unused source materials live under
the repository-level `art/` directory and are not bundled by Vite.
