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
import { PerformanceMonitor } from './performance/PerformanceMonitor';
import { PerformancePanel } from './performance/PerformancePanel';
import { Renderer } from './render/Renderer';
import type { TargetMode } from './types';
import { UI } from './ui/UI';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
if (!canvas) throw new Error('Missing game canvas.');

const game = new Game();
const audio = new AudioEngine();
const performanceMonitor = new PerformanceMonitor({
  open: new URLSearchParams(window.location.search).get('perf') === '1',
  warmupMs: 750,
});
const renderer = new Renderer(canvas, game);
renderer.setProfiler(performanceMonitor);
let accumulator = 0;
let lastFrame = performance.now();
let lastUIRender = 0;
let nextCanvasDraw = 0;

const ui = new UI(
  game,
  () => {
    accumulator = 0;
    lastFrame = performance.now();
    if (performanceMonitor.enabled) performanceMonitor.reset();
    renderer.draw(performance.now());
  },
  () => audio.toggle(),
  audio.muted,
  performanceMonitor,
);
const performancePanel = new PerformancePanel(performanceMonitor, game, renderer);

game.onEvent = (event) => {
  performanceMonitor.incrementEvent(event.type);
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

  const simulationMark = performanceMonitor.beginPhase('simulation');
  let safety = 0;
  let simulationTicks = 0;
  while (accumulator >= STEP && safety < 5) {
    for (let tick = 0; tick < game.speed; tick += 1) {
      game.update(STEP);
      simulationTicks += 1;
    }
    accumulator -= STEP;
    safety += 1;
  }
  if (accumulator >= STEP) accumulator %= STEP;
  performanceMonitor.increment('simTicks', simulationTicks);
  performanceMonitor.endPhase('simulation', simulationMark);

  const drawInterval = game.phase === 'wave' && !game.paused ? 1_000 / 60 : 1_000 / 30;
  performanceMonitor.setTargetFps(game.phase === 'wave' && !game.paused ? 60 : 30);
  if (nextCanvasDraw === 0 || now - nextCanvasDraw > drawInterval * 2) nextCanvasDraw = now;
  if (now + 0.25 >= nextCanvasDraw) {
    performanceMonitor.beginFrame(now);
    const renderMark = performanceMonitor.beginPhase('render');
    renderer.draw(now);
    performanceMonitor.endPhase('render', renderMark);
    performanceMonitor.increment('canvasFrames');
    nextCanvasDraw += drawInterval;
  }
  if (now - lastUIRender > 200) {
    ui.render();
    lastUIRender = now;
  }
  performancePanel.update(now);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

declare global {
  interface Window {
    __WIZINO_TD__: {
      game: Game;
      ui: UI;
      renderer: Renderer;
      profiler: PerformanceMonitor;
    };
  }
}

window.__WIZINO_TD__ = { game, ui, renderer, profiler: performanceMonitor };
