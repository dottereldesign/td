import { ARMOR_CODES, ARMOR_LABELS, LEVELS, TOWER_DEFINITIONS, TOWER_ORDER, getTowerDefinition } from '../data';
import { DAMAGE_MATRIX, matchupLabel } from '../game/damage';
import { Game } from '../game/Game';
import { refreshIcons } from '../icons';
import type { PerformanceMonitor } from '../performance/PerformanceMonitor';
import type { ArmorType, AttackType, GameEvent, LevelDefinition, TargetMode, TowerId } from '../types';

interface ProgressRecord {
  completed: string[];
  bestLives: Record<string, number>;
}

const ATTACK_LABELS: Record<AttackType, string> = {
  normal: 'Normal',
  pierce: 'Pierce',
  siege: 'Siege',
  magic: 'Magic',
  chaos: 'Chaos',
};

const TOWER_ART: Partial<Record<TowerId, string>> = {
  sentry: new URL('../assets/ui-reference/tower-vacuum.png', import.meta.url).href,
  needle: new URL('../assets/ui-reference/tower-brush.png', import.meta.url).href,
  mortar: new URL('../assets/ui-reference/tower-toaster.png', import.meta.url).href,
  arcanum: new URL('../assets/ui-reference/tower-arcanum.png', import.meta.url).href,
  toxin: new URL('../assets/ui-reference/tower-sprayer.png', import.meta.url).href,
  null: new URL('../assets/ui-reference/tower-null.png', import.meta.url).href,
};

export class UI {
  private selectedLevelId: string;
  private progress: ProgressRecord;
  private lastShopSignature = '';
  private levelModalOpenedFromGame = false;

  private readonly levelName = this.element('level-name');
  private readonly livesValue = this.element('lives-value');
  private readonly cashValue = this.element('cash-value');
  private readonly waveValue = this.element('wave-value');
  private readonly towerShop = this.element('tower-shop');
  private readonly selectionPanel = this.element('selection-panel');
  private readonly boardPrompt = this.element('board-prompt');
  private readonly phaseLabel = this.element('phase-label');
  private readonly cursorReadout = this.element('cursor-readout');
  private readonly nextWaveName = this.element('next-wave-name');
  private readonly nextWaveDetail = this.element('next-wave-detail');
  private readonly waveButton = this.button('wave-button');
  private readonly pauseButton = this.button('pause-button');
  private readonly speedButton = this.button('speed-button');
  private readonly upgradeButton = this.button('upgrade-button');
  private readonly sellButton = this.button('sell-button');
  private readonly levelModal = this.element('level-modal');
  private readonly helpModal = this.element('help-modal');
  private readonly outcomeModal = this.element('outcome-modal');
  private readonly levelGrid = this.element('level-grid');
  private readonly deployButton = this.button('deploy-button');
  private readonly toastRegion = this.element('toast-region');

  constructor(
    private readonly game: Game,
    private readonly onLevelReset: () => void,
    private readonly onSoundToggle: () => boolean,
    initialMuted: boolean,
    private readonly profiler?: PerformanceMonitor,
  ) {
    this.selectedLevelId = game.level.id;
    this.progress = this.loadProgress();
    this.renderTowerShop();
    this.renderLevelGrid();
    this.renderDamageMatrix();
    this.bindControls();
    this.updateSoundButton(initialMuted);
    refreshIcons();
    this.render();
  }

  render(): void {
    const renderMark = this.profiler?.beginPhase('ui') ?? Number.NaN;
    try {
    this.levelName.textContent = `${this.game.level.number} — ${this.game.level.name.toUpperCase()}`;
    this.livesValue.textContent = String(this.game.lives);
    this.cashValue.textContent = `$${Math.floor(this.game.cash)}`;
    this.waveValue.textContent = `${Math.max(0, this.game.currentWave + 1)} / ${this.game.level.waves.length}`;
    this.phaseLabel.textContent = this.game.paused
      ? 'SIMULATION PAUSED'
      : this.game.phase === 'wave'
        ? `WAVE ${String(this.game.currentWave + 1).padStart(2, '0')} ACTIVE`
        : this.game.phase === 'victory'
          ? 'SECTOR HELD'
          : this.game.phase === 'defeat'
            ? 'CORE LOST'
            : 'BUILD PHASE';

    this.updateCursorReadout();
    this.updateShopState();
    this.updateSelectionPanel();
    this.updateWavePanel();
    this.updatePrompt();
    this.updateIntel();
    } finally {
      this.profiler?.increment('uiRenders');
      this.profiler?.endPhase('ui', renderMark);
    }
  }

  handleGameEvent(event: GameEvent): void {
    if (event.type === 'toast') {
      this.toast(event.message, event.tone ?? 'default');
    }
    if (event.type === 'wave-cleared') {
      this.toast(`Wave ${event.wave + 1} cleared · +$${event.bonus}`, 'success');
    }
    if (event.type === 'outcome') {
      if (event.outcome === 'victory') this.saveVictory();
      window.setTimeout(() => this.showOutcome(event.outcome), 320);
    }

    // Combat produces very hot events (especially poison at 3× speed). HUD
    // state is already refreshed on a short cadence in the main loop, so
    // synchronously re-rendering the DOM for every hit/fire would starve rAF.
    if (event.type !== 'enemy-hit' && event.type !== 'tower-fired' && event.type !== 'enemy-killed') {
      this.render();
    }
  }

  toast(message: string, tone: 'default' | 'warning' | 'success' = 'default'): void {
    const toast = document.createElement('div');
    toast.className = `toast toast--${tone}`;
    toast.textContent = message;
    this.toastRegion.append(toast);
    window.setTimeout(() => toast.classList.add('is-leaving'), 2_300);
    window.setTimeout(() => toast.remove(), 2_700);
  }

  toggleHelp(open?: boolean): void {
    const shouldOpen = open ?? !this.helpModal.classList.contains('is-open');
    if (shouldOpen && this.game.phase === 'wave' && !this.game.paused) this.game.togglePause(true);
    this.helpModal.classList.toggle('is-open', shouldOpen);
  }

  openLevelSelect(): void {
    if (this.game.phase === 'wave' && !this.game.paused) this.game.togglePause(true);
    this.selectedLevelId = this.game.level.id;
    this.levelModalOpenedFromGame = true;
    this.renderLevelGrid();
    this.levelModal.classList.add('is-open');
  }

  hasOpenModal(): boolean {
    return document.querySelector('.modal-backdrop.is-open') !== null;
  }

  closeTopModal(): boolean {
    if (this.helpModal.classList.contains('is-open')) {
      this.toggleHelp(false);
      return true;
    }
    if (this.levelModal.classList.contains('is-open') && this.levelModalOpenedFromGame) {
      this.levelModal.classList.remove('is-open');
      return true;
    }
    return false;
  }

  private bindControls(): void {
    this.towerShop.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tower]');
      if (!button) return;
      this.game.selectBuild(button.dataset.tower as TowerId);
      this.render();
    });

    this.waveButton.addEventListener('click', () => {
      if (this.game.phase === 'build') this.game.startWave();
      this.render();
    });
    this.pauseButton.addEventListener('click', () => {
      this.game.togglePause();
      this.render();
    });
    this.speedButton.addEventListener('click', () => {
      this.game.cycleSpeed();
      this.render();
    });
    this.upgradeButton.addEventListener('click', () => {
      this.game.upgradeSelected();
      this.render();
    });
    this.sellButton.addEventListener('click', () => {
      this.game.sellSelected();
      this.render();
    });
    this.button('deselect-button').addEventListener('click', () => {
      this.game.deselect();
      this.render();
    });
    this.element('target-controls').addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-target]');
      if (!button) return;
      this.game.setTargetMode(button.dataset.target as TargetMode);
      this.render();
    });

    this.button('level-menu-button').addEventListener('click', () => this.openLevelSelect());
    this.button('help-button').addEventListener('click', () => this.toggleHelp(true));
    this.button('help-close-button').addEventListener('click', () => this.toggleHelp(false));
    this.button('sound-button').addEventListener('click', () => this.updateSoundButton(this.onSoundToggle()));

    this.levelGrid.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-level]');
      if (!button) return;
      this.selectedLevelId = button.dataset.level ?? LEVELS[0].id;
      this.renderLevelGrid();
    });
    this.deployButton.addEventListener('click', () => this.deploySelectedLevel());

    this.button('outcome-retry').addEventListener('click', () => {
      this.outcomeModal.classList.remove('is-open');
      this.game.startLevel(this.game.level.id);
      this.onLevelReset();
      this.render();
    });
    this.button('outcome-levels').addEventListener('click', () => {
      this.outcomeModal.classList.remove('is-open');
      this.openLevelSelect();
    });

    this.helpModal.addEventListener('click', (event) => {
      if (event.target === this.helpModal) this.toggleHelp(false);
    });
    this.levelModal.addEventListener('click', (event) => {
      if (event.target === this.levelModal && this.levelModalOpenedFromGame) {
        this.levelModal.classList.remove('is-open');
      }
    });
  }

  private deploySelectedLevel(): void {
    this.game.startLevel(this.selectedLevelId);
    this.levelModal.classList.remove('is-open');
    this.levelModalOpenedFromGame = true;
    this.onLevelReset();
    this.toast(`${this.game.level.name} sector loaded.`, 'success');
    this.render();
  }

  private renderTowerShop(): void {
    this.towerShop.innerHTML = TOWER_ORDER.map((id) => {
      const tower = TOWER_DEFINITIONS[id];
      const art = TOWER_ART[id];
      const attacksPerSecond = (1 / tower.interval).toFixed(1).replace('.0', '');
      return `
        <button class="tower-card" type="button" data-tower="${tower.id}" aria-pressed="false">
          <span class="tower-hotkey">${tower.hotkey}</span>
          <span class="tower-copy">
            <strong>${tower.name}</strong>
            <small>${tower.role}</small>
          </span>
          <span class="tower-icon${art ? ' tower-icon--art' : ''}">
            ${art
              ? `<img class="tower-art" src="${art}" alt="" aria-hidden="true" draggable="false">`
              : `<i data-lucide="${tower.icon}" aria-hidden="true"></i>`}
          </span>
          <span class="tower-stats">
            <span class="tower-stat tower-stat--price"><i data-lucide="coins"></i><b>$${tower.cost}</b></span>
            <span class="tower-stat" title="Attacks per second"><i data-lucide="zap"></i><b>${attacksPerSecond}×</b></span>
            <span class="tower-stat" title="Range in tiles"><i data-lucide="crosshair"></i><b>${tower.range.toFixed(1)}</b></span>
          </span>
          <em class="matchup" data-matchup="${tower.id}">1×</em>
        </button>
      `;
    }).join('');
  }

  private updateShopState(): void {
    const armor = this.intelArmor();
    const signature = `${this.game.cash}|${this.game.selectedBuild}|${armor}`;
    if (signature === this.lastShopSignature) return;
    this.lastShopSignature = signature;

    for (const button of this.towerShop.querySelectorAll<HTMLButtonElement>('[data-tower]')) {
      const id = button.dataset.tower as TowerId;
      const definition = getTowerDefinition(id);
      const isActive = this.game.selectedBuild === id;
      const affordable = this.game.cash >= definition.cost;
      button.classList.toggle('is-active', isActive);
      button.classList.toggle('is-unaffordable', !affordable);
      button.setAttribute('aria-pressed', String(isActive));
      button.disabled = !affordable && !isActive;
      const matchup = DAMAGE_MATRIX[definition.attackType][armor];
      const matchupElement = button.querySelector<HTMLElement>('[data-matchup]');
      if (matchupElement) {
        matchupElement.textContent = `${this.formatMultiplier(matchup)}×`;
        matchupElement.dataset.rating = matchupLabel(matchup).toLowerCase();
        matchupElement.title = `${matchupLabel(matchup)} against ${ARMOR_LABELS[armor]} armor`;
      }
    }
  }

  private updateSelectionPanel(): void {
    const tower = this.game.getSelectedTower();
    this.selectionPanel.hidden = !tower;
    if (!tower) return;

    const definition = getTowerDefinition(tower.definitionId);
    const stats = this.game.getTowerStats(tower);
    this.element('selected-name').textContent = `${definition.name} · T${tower.level}`;
    this.element('selected-damage').textContent = `${Math.round(stats.damage)} ${definition.attackType.toUpperCase()}`;
    this.element('selected-rate').textContent = `${(1 / stats.interval).toFixed(2)}/s`;
    this.element('selected-range').textContent = `${stats.range.toFixed(1)} tiles`;
    this.element('selected-output').textContent = `${this.compact(tower.totalDamage)} · ${tower.kills}K`;

    const upgradeCost = this.game.getUpgradeCost(tower);
    this.element('upgrade-cost').textContent = upgradeCost === null ? 'MAX' : `$${upgradeCost}`;
    this.upgradeButton.disabled = upgradeCost === null || this.game.cash < upgradeCost;
    this.sellButton.disabled = false;
    this.element('sell-value').textContent = `+$${this.game.getSellValue(tower)}`;

    for (const button of this.element('target-controls').querySelectorAll<HTMLButtonElement>('[data-target]')) {
      button.classList.toggle('is-active', button.dataset.target === tower.targetMode);
      button.setAttribute('aria-pressed', String(button.dataset.target === tower.targetMode));
    }
  }

  private updateWavePanel(): void {
    const isWave = this.game.phase === 'wave';
    const nextIndex = isWave ? this.game.currentWave : this.game.currentWave + 1;
    const wave = this.game.level.waves[Math.min(nextIndex, this.game.level.waves.length - 1)];
    const count = wave.groups.reduce((total, group) => total + group.count, 0);
    const armors = [...new Set(wave.groups.map((group) => ARMOR_LABELS[group.armorType]))].join(' + ');

    this.nextWaveName.textContent = isWave
      ? `W${String(this.game.currentWave + 1).padStart(2, '0')} · ${wave.name}`
      : `W${String(nextIndex + 1).padStart(2, '0')} · ${wave.name}`;
    this.nextWaveDetail.textContent = isWave
      ? `${this.game.enemies.length} on map · ${armors}`
      : `${count} contacts · ${armors}`;

    this.pauseButton.disabled = !isWave;
    this.pauseButton.querySelector('span')!.textContent = this.game.paused ? 'Resume' : 'Pause';
    this.speedButton.querySelector('span')!.textContent = `${this.game.speed}×`;

    const waveSpan = this.waveButton.querySelector('span')!;
    if (this.game.phase === 'build') {
      waveSpan.textContent = `Send wave ${String(this.game.currentWave + 2).padStart(2, '0')}`;
      this.waveButton.disabled = false;
    } else if (this.game.phase === 'wave') {
      waveSpan.textContent = 'Wave active';
      this.waveButton.disabled = true;
    } else {
      waveSpan.textContent = this.game.phase === 'victory' ? 'Sector held' : 'Core lost';
      this.waveButton.disabled = true;
    }
  }

  private updatePrompt(): void {
    if (this.game.selectedBuild) {
      const tower = getTowerDefinition(this.game.selectedBuild);
      this.boardPrompt.classList.remove('is-hidden');
      this.boardPrompt.querySelector('strong')!.textContent = `Place ${tower.name}`;
      this.boardPrompt.querySelector('span')!.textContent = 'Click an open tile · hold Shift to repeat · Esc to cancel';
      return;
    }
    if (this.game.towers.length === 0 && this.game.phase === 'build') {
      this.boardPrompt.classList.remove('is-hidden');
      this.boardPrompt.querySelector('strong')!.textContent = 'Select a tower';
      this.boardPrompt.querySelector('span')!.textContent = 'Use the build roster or press keys 1–6';
      return;
    }
    this.boardPrompt.classList.add('is-hidden');
  }

  private updateIntel(): void {
    const armor = this.intelArmor();
    const waveIndex = this.game.phase === 'wave' ? this.game.currentWave : this.game.currentWave + 1;
    const wave = this.game.level.waves[Math.min(waveIndex, this.game.level.waves.length - 1)];
    const firstGroup = wave.groups[0];
    const entries = (Object.keys(ATTACK_LABELS) as AttackType[])
      .map((attack) => ({ attack, value: DAMAGE_MATRIX[attack][armor] }))
      .sort((a, b) => b.value - a.value);
    const best = entries[0];

    this.element('intel-icon').textContent = ARMOR_CODES[armor];
    this.element('intel-title').textContent = `${ARMOR_LABELS[armor]} · ${firstGroup.armor} armor`;
    this.element('intel-copy').textContent = `${ATTACK_LABELS[best.attack]} leads at ${this.formatMultiplier(best.value)}× type damage. ${wave.description}`;
  }

  private updateCursorReadout(): void {
    const hover = this.game.hoverCell;
    this.cursorReadout.textContent = hover
      ? `GRID ${String(hover.x + 1).padStart(2, '0')}:${String(hover.y + 1).padStart(2, '0')}`
      : 'GRID --:--';
  }

  private renderDamageMatrix(): void {
    const armors = Object.keys(ARMOR_LABELS) as ArmorType[];
    const attacks = Object.keys(ATTACK_LABELS) as AttackType[];
    this.element('manual-matrix').innerHTML = `
      <table class="damage-matrix">
        <thead><tr><th>Attack</th>${armors.map((armor) => `<th title="${ARMOR_LABELS[armor]}">${ARMOR_CODES[armor]}</th>`).join('')}</tr></thead>
        <tbody>
          ${attacks.map((attack) => `
            <tr><th>${ATTACK_LABELS[attack]}</th>${armors.map((armor) => {
              const value = DAMAGE_MATRIX[attack][armor];
              return `<td data-rating="${matchupLabel(value).toLowerCase()}">${Math.round(value * 100)}%</td>`;
            }).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
      <div class="matrix-key">U Unarmored · L Light · M Medium · H Heavy · F Fortified</div>
    `;
  }

  private renderLevelGrid(): void {
    this.levelGrid.innerHTML = LEVELS.map((level) => this.levelCard(level)).join('');
    refreshIcons();
  }

  private levelCard(level: LevelDefinition): string {
    const selected = level.id === this.selectedLevelId;
    const completed = this.progress.completed.includes(level.id);
    const points = level.path.map((cell) => `${cell.x + 0.5},${cell.y + 0.5}`).join(' ');
    const best = this.progress.bestLives[level.id];
    return `
      <button class="level-card${selected ? ' is-selected' : ''}" type="button" data-level="${level.id}" aria-pressed="${selected}">
        <div class="level-preview" aria-hidden="true">
          <svg viewBox="0 0 ${level.cols} ${level.rows}" preserveAspectRatio="none">
            <polyline points="${points}" vector-effect="non-scaling-stroke" />
            <circle cx="${level.path[0].x + 0.5}" cy="${level.path[0].y + 0.5}" r="0.36" />
            <rect x="${level.path[level.path.length - 1].x + 0.15}" y="${level.path[level.path.length - 1].y + 0.15}" width="0.7" height="0.7" />
          </svg>
          <span>${completed ? '<i data-lucide="check"></i> CLEARED' : `RISK 0${level.difficulty}`}</span>
        </div>
        <span class="level-number">${level.number}</span>
        <div class="level-copy">
          <strong>${level.name}</strong>
          <small>${level.subtitle}</small>
          <p>${level.briefing}</p>
        </div>
        <div class="level-record"><span>${level.waves.length} WAVES</span><span>${best === undefined ? 'NO RECORD' : `BEST ${best} HP`}</span></div>
      </button>
    `;
  }

  private showOutcome(outcome: 'victory' | 'defeat'): void {
    this.element('outcome-eyebrow').textContent = outcome === 'victory' ? 'SECTOR REPORT / COMPLETE' : 'SECTOR REPORT / BREACH';
    this.element('outcome-title').textContent = outcome === 'victory' ? 'Sector held.' : 'Core integrity lost.';
    this.element('outcome-copy').textContent = outcome === 'victory'
      ? 'All eight waves have been neutralized. The sector record was saved locally.'
      : `The route broke on wave ${this.game.currentWave + 1}. Recompose your damage types and try again.`;
    this.element('outcome-lives').textContent = String(this.game.lives);
    this.element('outcome-towers').textContent = String(this.game.towers.length);
    this.element('outcome-cash').textContent = `$${Math.floor(this.game.cash)}`;
    this.outcomeModal.classList.add('is-open');
  }

  private updateSoundButton(muted: boolean): void {
    const button = this.button('sound-button');
    button.innerHTML = `<i data-lucide="${muted ? 'volume-x' : 'volume-2'}" aria-hidden="true"></i>`;
    button.setAttribute('aria-label', muted ? 'Enable sound' : 'Mute sound');
    button.title = muted ? 'Enable sound' : 'Mute sound';
    refreshIcons();
  }

  private saveVictory(): void {
    if (!this.progress.completed.includes(this.game.level.id)) this.progress.completed.push(this.game.level.id);
    this.progress.bestLives[this.game.level.id] = Math.max(
      this.progress.bestLives[this.game.level.id] ?? 0,
      this.game.lives,
    );
    localStorage.setItem('mono-ward-progress', JSON.stringify(this.progress));
    this.renderLevelGrid();
  }

  private loadProgress(): ProgressRecord {
    try {
      const value = JSON.parse(localStorage.getItem('mono-ward-progress') ?? '') as ProgressRecord;
      if (Array.isArray(value.completed) && typeof value.bestLives === 'object') return value;
    } catch {
      // A corrupt or absent local record should never block play.
    }
    return { completed: [], bestLives: {} };
  }

  private intelArmor(): ArmorType {
    const index = this.game.phase === 'wave' ? this.game.currentWave : this.game.currentWave + 1;
    const safeIndex = Math.min(Math.max(0, index), this.game.level.waves.length - 1);
    return this.game.level.waves[safeIndex].groups[0].armorType;
  }

  private compact(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return `${Math.round(value)}`;
  }

  private formatMultiplier(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
  }

  private element(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing required element #${id}`);
    return element;
  }

  private button(id: string): HTMLButtonElement {
    return this.element(id) as HTMLButtonElement;
  }
}
