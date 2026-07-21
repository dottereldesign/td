import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-800.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';
import '@fontsource/ibm-plex-mono/latin-700.css';
import './style.css';
import { AudioEngine } from './audio';
import { TOWER_ORDER } from './data';
import { Game } from './game/Game';
import { Renderer } from './render/Renderer';
import type { TargetMode } from './types';
import { UI } from './ui/UI';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
if (!canvas) throw new Error('Missing game canvas.');

const game = new Game();
const audio = new AudioEngine();
const renderer = new Renderer(canvas, game);
let accumulator = 0;
let lastFrame = performance.now();
let lastUIRender = 0;

const ui = new UI(
  game,
  () => {
    accumulator = 0;
    lastFrame = performance.now();
    renderer.draw(performance.now());
  },
  () => audio.toggle(),
  audio.muted,
);

game.onEvent = (event) => {
  audio.handle(event);
  ui.handleGameEvent(event);
};

canvas.addEventListener('pointermove', (event) => {
  game.setHoverCell(renderer.cellFromPointer(event.clientX, event.clientY));
});

canvas.addEventListener('pointerleave', () => game.setHoverCell(null));

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  audio.unlock();
  const cell = renderer.cellFromPointer(event.clientX, event.clientY);
  game.setHoverCell(cell);
  if (game.selectedBuild) game.placeTower(cell, event.shiftKey);
  else game.selectTowerAt(cell);
  ui.render();
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  game.deselect();
  ui.render();
});

document.addEventListener('pointerdown', () => audio.unlock(), { once: true });

document.addEventListener('keydown', (event) => {
  if (event.repeat && event.key !== 'Escape') return;
  const key = event.key.toLowerCase();

  if (key === 'escape') {
    if (!ui.closeTopModal()) game.deselect();
    ui.render();
    return;
  }

  if (ui.hasOpenModal()) return;

  const towerIndex = Number.parseInt(key, 10) - 1;
  if (towerIndex >= 0 && towerIndex < TOWER_ORDER.length) {
    game.selectBuild(TOWER_ORDER[towerIndex]);
    ui.render();
    return;
  }

  if (key === ' ' || event.code === 'Space') {
    event.preventDefault();
    if (game.phase === 'build') game.startWave();
    else if (game.phase === 'wave') game.togglePause();
    ui.render();
  } else if (key === 'f') {
    game.cycleSpeed();
    ui.render();
  } else if (key === 'u') {
    game.upgradeSelected();
    ui.render();
  } else if (key === 't') {
    const tower = game.getSelectedTower();
    if (!tower) return;
    const modes: TargetMode[] = ['first', 'strong', 'last'];
    game.setTargetMode(modes[(modes.indexOf(tower.targetMode) + 1) % modes.length]);
    ui.render();
  } else if (key === '?' || key === '/') {
    ui.toggleHelp(true);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.phase === 'wave' && !game.paused) {
    game.togglePause(true);
    ui.toast('Auto-paused while this tab was hidden.');
    ui.render();
  }
});

const STEP = 1 / 60;
function frame(now: number): void {
  const elapsed = Math.min(0.1, Math.max(0, (now - lastFrame) / 1_000));
  lastFrame = now;
  accumulator += elapsed;

  let safety = 0;
  while (accumulator >= STEP && safety < 12) {
    for (let tick = 0; tick < game.speed; tick += 1) game.update(STEP);
    accumulator -= STEP;
    safety += 1;
  }

  renderer.draw(now);
  if (now - lastUIRender > 90) {
    ui.render();
    lastUIRender = now;
  }
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

declare global {
  interface Window {
    __MONO_WARD__: {
      game: Game;
      ui: UI;
    };
  }
}

window.__MONO_WARD__ = { game, ui };
