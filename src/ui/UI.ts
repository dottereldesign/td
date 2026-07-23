import { ARMOR_CODES, ARMOR_LABELS, LEVELS, TOWER_ORDER, WORLDS, getTowerDefinition, getWorld } from '../data';
import { UI_SOUND_PACKS, isUiSoundPack, type AudioChannels } from '../audio';
import { DAMAGE_MATRIX, matchupLabel } from '../game/damage';
import { Game } from '../game/Game';
import { COLLECTION_CARD_BACK } from '../collectionAssets';
import { HOME_WORLD_ART } from '../homeAssets';
import { refreshIcons } from '../icons';
import { LEARNING_CARDS, STARTER_CARDS, type CollectionCard } from '../learningCards';
import type { PerformanceMonitor } from '../performance/PerformanceMonitor';
import type { ArmorType, AttackType, GameEvent, LevelDefinition, TargetMode, TowerId } from '../types';
import type { WorldId } from '../types';
import { getTowerAssetUrl } from '../render/assets';
import {
  MISSIONS,
  canClaimDaily,
  claimDaily,
  claimMission,
  createDefaultProgress,
  loadPlayerProgress,
  recordTowerBuilt,
  recordVictory,
  recordWaveCleared,
  savePlayerProgress,
  starGlyphs,
  starsForVictory,
  type PlayerProgress,
  type VictoryReward,
} from '../progression';

const ATTACK_LABELS: Record<AttackType, string> = {
  normal: 'Normal',
  pierce: 'Pierce',
  siege: 'Siege',
  magic: 'Magic',
  chaos: 'Chaos',
};

export class UI {
  private selectedWorldId: WorldId;
  private selectedLevelId: string;
  private progress: PlayerProgress;
  private soundMuted: boolean;
  private lastVictoryReward: VictoryReward | null = null;
  private lastShopSignature = '';
  private levelModalOpenedFromGame = false;
  private homeIntroVariant: 'smash' | 'magic' = 'smash';

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
  private readonly worldSelectView = this.element('world-select-view');
  private readonly mapSelectView = this.element('map-select-view');
  private readonly helpModal = this.element('help-modal');
  private readonly outcomeModal = this.element('outcome-modal');
  private readonly levelGrid = this.element('level-grid');
  private readonly worldGrid = this.element('world-grid');
  private readonly homeScreen = this.element('home-screen');
  private readonly homeHero = this.element('home-hero');
  private readonly homeStatus = this.element('home-status');
  private readonly homePanelModal = this.element('home-panel-modal');
  private readonly homePanelContent = this.element('home-panel-content');
  private readonly toastRegion = this.element('toast-region');

  constructor(
    private readonly game: Game,
    private readonly onLevelReset: () => void,
    private readonly onSoundToggle: () => boolean,
    private readonly onAudioSettingsChange: (channels: AudioChannels) => void,
    initialMuted: boolean,
    private readonly profiler?: PerformanceMonitor,
  ) {
    this.selectedWorldId = game.level.worldId;
    this.selectedLevelId = game.level.id;
    this.progress = loadPlayerProgress();
    this.soundMuted = initialMuted;
    this.applyAudioSettings();
    this.applySettings();
    this.renderTowerShop();
    this.renderWorldGrid();
    this.renderLevelGrid();
    this.renderDamageMatrix();
    this.bindControls();
    this.updateSoundButton(this.soundMuted);
    refreshIcons();
    this.updateHomeProgress();
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
      recordWaveCleared(this.progress, event.wave + 1);
      this.persistProgress();
      this.toast(`Wave ${event.wave + 1} cleared · +$${event.bonus}`, 'success');
    }
    if (event.type === 'tower-built') {
      recordTowerBuilt(this.progress);
      this.persistProgress();
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
    this.selectedWorldId = this.game.level.worldId;
    this.levelModalOpenedFromGame = true;
    this.showWorldSelect();
    this.levelModal.classList.add('is-open');
  }

  private showWorldSelect(updateRoute = true): void {
    if (!this.isWorldUnlocked(this.selectedWorldId)) this.selectedWorldId = WORLDS[0].id;
    this.levelModal.dataset.selectionView = 'worlds';
    this.worldSelectView.hidden = false;
    this.mapSelectView.hidden = true;
    this.renderWorldGrid();
    this.renderWorldDetail();
    if (updateRoute) this.pushRoute('#/worlds');
  }

  private showMapSelect(worldId: WorldId, updateRoute = true): void {
    if (!this.isWorldUnlocked(worldId)) {
      this.selectedWorldId = WORLDS[0].id;
      this.showWorldSelect(false);
      window.history.replaceState({}, '', '#/worlds');
      return;
    }
    this.selectedWorldId = worldId;
    const world = getWorld(worldId);
    this.levelModal.dataset.selectionView = 'maps';
    this.worldSelectView.hidden = true;
    this.mapSelectView.hidden = false;
    this.mapSelectView.style.setProperty('--map-color', world.color);
    this.element('select-eyebrow').textContent = world.theme.toUpperCase();
    this.element('level-modal-title').textContent = world.name;
    this.element('select-copy').textContent = `${world.description} Select a map to deploy immediately.`;
    this.element('selection-hint').textContent = 'Choose any map card to deploy immediately.';
    if (!world.mapIds.includes(this.selectedLevelId)) this.selectedLevelId = world.mapIds[0];
    this.renderLevelGrid();
    if (updateRoute) this.pushRoute(`#/worlds/${worldId}/levels`);
  }

  private isWorldComplete(worldId: WorldId): boolean {
    return getWorld(worldId).mapIds.every((levelId) => (this.progress.stars[levelId] ?? 0) > 0);
  }

  private isWorldUnlocked(worldId: WorldId): boolean {
    const index = WORLDS.findIndex((world) => world.id === worldId);
    return index <= 0 || this.isWorldComplete(WORLDS[index - 1].id);
  }

  private selectWorld(worldId: WorldId): void {
    if (!this.isWorldUnlocked(worldId)) return;
    this.selectedWorldId = worldId;
    this.renderWorldGrid();
    this.renderWorldDetail();
  }

  private renderWorldDetail(): void {
    const world = getWorld(this.selectedWorldId);
    const clearedMaps = world.mapIds.filter((levelId) => (this.progress.stars[levelId] ?? 0) > 0).length;
    const completedWorlds = WORLDS.filter((entry) => this.isWorldComplete(entry.id)).length;
    this.element('world-detail-icon').innerHTML = `<i data-lucide="${world.icon}" aria-hidden="true"></i>`;
    this.element('world-detail-number').textContent = `WORLD ${String(world.number).padStart(2, '0')}`;
    this.element('world-detail-name').textContent = world.name;
    this.element('world-detail-theme').textContent = world.theme;
    this.element('world-detail-description').textContent = world.description;
    this.element('world-complete-value').textContent = `${completedWorlds} / ${WORLDS.length}`;
    this.element('world-progress-fill').style.setProperty('--progress', `${completedWorlds / WORLDS.length * 100}%`);
    this.element('world-map-progress').textContent = `${clearedMaps} / ${world.mapIds.length} maps cleared`;
    refreshIcons();
  }

  private showHome(updateRoute = true): void {
    if (this.game.phase === 'wave' && !this.game.paused) this.game.togglePause(true);
    this.levelModal.classList.remove('is-open');
    this.homeScreen.classList.add('is-open');
    this.updateHomeProgress();
    if (updateRoute) this.pushRoute('#/home');
  }

  private playHomeIntro(variant: 'smash' | 'magic'): void {
    const button = this.button('home-intro-next');
    this.homeIntroVariant = variant;
    this.homeHero.dataset.introState = 'running';
    this.homeScreen.dataset.introState = 'running';
    this.homeHero.classList.remove('home-hero--intro-smash', 'home-hero--intro-magic');
    this.homeScreen.classList.remove('home-screen--intro-smash', 'home-screen--intro-magic');
    void this.homeScreen.offsetWidth;
    this.homeHero.classList.add(`home-hero--intro-${variant}`);
    this.homeScreen.classList.add(`home-screen--intro-${variant}`);
    const nextIsMagic = variant === 'smash';
    button.setAttribute('aria-label', nextIsMagic ? 'Play the alternate magical intro' : 'Replay the smash intro');
    button.title = nextIsMagic ? 'Play alternate intro animation' : 'Replay smash intro animation';
    if (this.progress.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.homeHero.dataset.introState = 'complete';
      this.homeScreen.dataset.introState = 'complete';
    }
  }

  hasOpenModal(): boolean {
    return document.querySelector('.modal-backdrop.is-open') !== null || this.levelModal.classList.contains('is-open');
  }

  closeTopModal(): boolean {
    if (this.homePanelModal.classList.contains('is-open')) {
      this.homePanelModal.classList.remove('is-open');
      return true;
    }
    if (this.helpModal.classList.contains('is-open')) {
      this.toggleHelp(false);
      return true;
    }
    if (this.levelModal.classList.contains('is-open')) {
      if (!this.mapSelectView.hidden) this.showWorldSelect();
      else if (this.levelModalOpenedFromGame) this.levelModal.classList.remove('is-open');
      else this.showHome();
      return true;
    }
    return false;
  }

  private bindControls(): void {
    const openAdventure = () => {
      this.homeScreen.classList.remove('is-open');
      this.levelModalOpenedFromGame = false;
      this.showWorldSelect();
      this.levelModal.classList.add('is-open');
    };
    this.button('home-play-button').addEventListener('click', openAdventure);
    this.button('home-adventure-button').addEventListener('click', openAdventure);
    const homeIntroNext = this.button('home-intro-next');
    homeIntroNext.addEventListener('click', () => {
      this.playHomeIntro(this.homeIntroVariant === 'smash' ? 'magic' : 'smash');
    });
    homeIntroNext.addEventListener('animationend', () => {
      this.homeHero.dataset.introState = 'complete';
      this.homeScreen.dataset.introState = 'complete';
    });
    if (this.progress.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.homeHero.dataset.introState = 'complete';
      this.homeScreen.dataset.introState = 'complete';
    }
    this.homeScreen.addEventListener('click', (event) => {
      const worldButton = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-home-world]');
      if (worldButton?.dataset.homeWorld) {
        const worldId = worldButton.dataset.homeWorld as WorldId;
        if (!this.isWorldUnlocked(worldId)) return;
        this.homeScreen.classList.remove('is-open');
        this.levelModalOpenedFromGame = false;
        this.showMapSelect(worldId);
        this.levelModal.classList.add('is-open');
        return;
      }

      const panelButton = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-home-panel]');
      if (panelButton?.dataset.homePanel) {
        this.openHomePanel(panelButton.dataset.homePanel);
        return;
      }

      const messageButton = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-home-message]');
      if (!messageButton?.dataset.homeMessage) return;
      this.homeStatus.textContent = messageButton.dataset.homeMessage;
      this.homeStatus.classList.remove('is-visible');
      window.requestAnimationFrame(() => this.homeStatus.classList.add('is-visible'));
      window.setTimeout(() => this.homeStatus.classList.remove('is-visible'), 2_400);
    });
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
    this.button('selection-home-button').addEventListener('click', () => this.showHome());
    this.button('selection-map-home-button').addEventListener('click', () => this.showHome());
    this.button('selection-settings-button').addEventListener('click', () => this.openHomePanel('settings'));
    this.button('world-view-maps-button').addEventListener('click', () => this.showMapSelect(this.selectedWorldId));
    this.button('world-back-button').addEventListener('click', () => this.showWorldSelect());
    this.button('selected-map-play').addEventListener('click', () => this.deployLevel(this.selectedLevelId));
    this.button('help-button').addEventListener('click', () => this.toggleHelp(true));
    this.button('help-close-button').addEventListener('click', () => this.toggleHelp(false));
    this.button('sound-button').addEventListener('click', () => {
      this.soundMuted = this.onSoundToggle();
      this.updateSoundButton(this.soundMuted);
    });
    this.button('home-panel-close').addEventListener('click', () => this.homePanelModal.classList.remove('is-open'));
    this.homePanelModal.addEventListener('click', (event) => {
      if (event.target === this.homePanelModal) {
        this.homePanelModal.classList.remove('is-open');
        return;
      }
      this.handleHomePanelAction(event);
    });
    this.homePanelContent.addEventListener('change', (event) => this.handleSettingChange(event));

    this.worldGrid.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-world]');
      if (button?.dataset.world) this.selectWorld(button.dataset.world as WorldId);
    });

    this.levelGrid.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-level]');
      if (!button?.dataset.level) return;
      this.selectLevel(button.dataset.level);
      this.deployLevel(button.dataset.level);
    });
    this.levelGrid.addEventListener('focusin', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-level]');
      if (button?.dataset.level) this.selectLevel(button.dataset.level);
    });

    window.addEventListener('popstate', () => {
      const levelRoute = window.location.hash.match(/^#\/worlds\/(forest|workshop|word|number|space|music)\/levels$/);
      if (levelRoute) {
        this.homeScreen.classList.remove('is-open');
        this.showMapSelect(levelRoute[1] as WorldId, false);
        this.levelModal.classList.add('is-open');
      } else if (window.location.hash === '#/worlds') {
        this.homeScreen.classList.remove('is-open');
        this.showWorldSelect(false);
        this.levelModal.classList.add('is-open');
      } else {
        this.showHome(false);
      }
    });

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
  }

  private deployLevel(levelId: string): void {
    const level = LEVELS.find((entry) => entry.id === levelId);
    if (!level || !this.isWorldUnlocked(level.worldId)) {
      this.showWorldSelect();
      return;
    }
    this.selectedLevelId = level.id;
    this.game.startLevel(levelId);
    this.levelModal.classList.remove('is-open');
    this.levelModalOpenedFromGame = true;
    this.pushRoute(`#/play/${levelId}`);
    this.onLevelReset();
    this.renderTowerShop();
    this.toast(`${this.game.level.name} sector loaded.`, 'success');
    this.render();
  }

  private renderTowerShop(): void {
    this.towerShop.innerHTML = TOWER_ORDER.map((id) => {
      const tower = getTowerDefinition(id, this.game.level.worldId);
      const art = getTowerAssetUrl(this.game.level.worldId, id);
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
      const definition = getTowerDefinition(id, this.game.level.worldId);
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

    const definition = getTowerDefinition(tower.definitionId, this.game.level.worldId);
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
      const tower = getTowerDefinition(this.game.selectedBuild, this.game.level.worldId);
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
    const levels = LEVELS.filter((level) => level.worldId === this.selectedWorldId);
    if (!levels.some((level) => level.id === this.selectedLevelId)) this.selectedLevelId = levels[0].id;
    this.levelGrid.innerHTML = levels.map((level) => this.levelCard(level)).join('');
    this.renderSelectedMap();
    refreshIcons();
  }

  private selectLevel(levelId: string): void {
    const level = LEVELS.find((entry) => entry.id === levelId && entry.worldId === this.selectedWorldId);
    if (!level || level.id === this.selectedLevelId) return;
    this.selectedLevelId = level.id;
    this.levelGrid.querySelectorAll<HTMLButtonElement>('[data-level]').forEach((button) => {
      const selected = button.dataset.level === level.id;
      button.classList.toggle('is-selected', selected);
      if (selected) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    this.renderSelectedMap();
  }

  private renderSelectedMap(): void {
    const level = LEVELS.find((entry) => entry.id === this.selectedLevelId)
      ?? LEVELS.find((entry) => entry.worldId === this.selectedWorldId)
      ?? LEVELS[0];
    const world = getWorld(level.worldId);
    const stars = this.progress.stars[level.id] ?? 0;
    const best = this.progress.bestLives[level.id];
    const focusIcons = [world.icon, 'brain', 'sparkles'];
    const focusTopics = world.learningFocus.split(',').map((topic) => topic.trim()).slice(0, 3);

    this.element('map-world-icon').innerHTML = `<i data-lucide="${world.icon}" aria-hidden="true"></i>`;
    this.element('map-select-summary').textContent = `${LEVELS.length} MAPS · ${LEVELS.filter((entry) => (this.progress.stars[entry.id] ?? 0) > 0).length} CLEARED`;
    this.element('selected-map-number').textContent = level.number;
    this.element('selected-map-name').textContent = level.name;
    this.element('selected-map-mode').textContent = this.levelMode(level);
    this.element('selected-map-preview').innerHTML = this.levelPreview(level, stars > 0 ? `${starGlyphs(stars)} CLEARED` : `RISK 0${level.difficulty}`);
    this.element('selected-map-about').textContent = level.briefing;
    this.element('selected-map-focus').innerHTML = focusTopics.map((topic, index) => `
      <div>
        <i data-lucide="${focusIcons[index]}" aria-hidden="true"></i>
        <span><strong>${topic}</strong><small>Discover this idea through play.</small></span>
      </div>
    `).join('');
    this.element('selected-map-difficulty').textContent = starGlyphs(level.difficulty);
    this.element('selected-map-difficulty-label').textContent = level.difficulty === 1
      ? 'Beginner friendly'
      : level.difficulty === 2
        ? 'Developing strategy'
        : 'Advanced challenge';
    this.element('selected-map-best').textContent = best === undefined ? 'No record' : `${best} HP`;
    this.button('selected-map-play').setAttribute('aria-label', `Play selected map: ${level.name}`);
    refreshIcons();
  }

  private renderWorldGrid(): void {
    this.worldGrid.innerHTML = WORLDS.map((world, index) => {
      const stars = world.mapIds.reduce((sum, id) => sum + (this.progress.stars[id] ?? 0), 0);
      const clearedMaps = world.mapIds.filter((id) => (this.progress.stars[id] ?? 0) > 0).length;
      const unlocked = this.isWorldUnlocked(world.id);
      const selected = this.selectedWorldId === world.id;
      const prerequisite = index > 0 ? WORLDS[index - 1].name : '';
      return `
        <button
          class="world-card${selected ? ' is-selected' : ''}${unlocked ? '' : ' is-locked'}"
          type="button"
          data-world="${world.id}"
          style="--world-color:${world.color}"
          aria-label="${unlocked ? `${world.name}, ${clearedMaps} of 3 maps cleared` : `${world.name}, locked. Complete the previous world first`}"
          ${unlocked ? '' : 'disabled'}
        >
          <span class="world-hex-body">
            <img class="selection-world-art" src="${HOME_WORLD_ART[world.id]}" alt="" />
            <span class="world-number">WORLD ${String(world.number).padStart(2, '0')}</span>
            <span class="selection-world-copy">
              <strong>${world.name}</strong>
              <small>${world.theme}</small>
              ${unlocked
                ? `<span class="world-record"><b>★ ${stars} / 9</b><em>${clearedMaps} / 3 MAPS</em></span>`
                : `<span class="world-lock"><i data-lucide="lock" aria-hidden="true"></i> Complete ${prerequisite}</span>`}
            </span>
          </span>
        </button>
      `;
    }).join('');
    refreshIcons();
  }

  private levelCard(level: LevelDefinition): string {
    const stars = this.progress.stars[level.id] ?? 0;
    const best = this.progress.bestLives[level.id];
    const selected = level.id === this.selectedLevelId;
    return `
      <button class="level-card${selected ? ' is-selected' : ''}" type="button" data-level="${level.id}" aria-label="Play ${level.name}"${selected ? ' aria-current="true"' : ''}>
        ${this.levelPreview(level, stars > 0 ? `${starGlyphs(stars)} CLEARED` : `RISK 0${level.difficulty}`)}
        <div class="level-card-info">
          <span class="level-number">${level.number}</span>
          <div class="level-copy">
            <strong>${level.name}</strong>
            <small>${this.levelMode(level)}</small>
          </div>
          <div class="level-record"><span>${starGlyphs(stars)}</span><span>${best === undefined ? 'BEST: --' : `BEST: ${best} HP`}</span></div>
        </div>
      </button>
    `;
  }

  private levelPreview(level: LevelDefinition, status: string): string {
    const points = level.path.map((cell) => `${cell.x + 0.5},${cell.y + 0.5}`).join(' ');
    return `
      <div class="level-preview" aria-hidden="true">
        <svg viewBox="0 0 ${level.cols} ${level.rows}" preserveAspectRatio="none">
          <polyline points="${points}" vector-effect="non-scaling-stroke" />
          <circle cx="${level.path[0].x + 0.5}" cy="${level.path[0].y + 0.5}" r="0.36" />
          <rect x="${level.path[level.path.length - 1].x + 0.15}" y="${level.path[level.path.length - 1].y + 0.15}" width="0.7" height="0.7" />
        </svg>
        <span>${status}</span>
      </div>
    `;
  }

  private levelMode(level: LevelDefinition): string {
    return level.difficulty === 1 ? 'Guided' : level.difficulty === 2 ? 'Standard' : 'Challenge';
  }

  private showOutcome(outcome: 'victory' | 'defeat'): void {
    this.element('outcome-eyebrow').textContent = outcome === 'victory' ? 'SECTOR REPORT / COMPLETE' : 'SECTOR REPORT / BREACH';
    this.element('outcome-title').textContent = outcome === 'victory' ? 'Sector held.' : 'Core integrity lost.';
    this.element('outcome-copy').textContent = outcome === 'victory'
      ? this.lastVictoryReward?.newHighScore
        ? `New local high score: ${this.lastVictoryReward.score.toLocaleString()}. Rewards and a learning card were saved.`
        : `Sector cleared. +${this.lastVictoryReward?.coins ?? 0} coins and +${this.lastVictoryReward?.gems ?? 0} gems were saved locally.`
      : `The route broke on wave ${this.game.currentWave + 1}. Recompose your damage types and try again.`;
    this.element('outcome-lives').textContent = String(this.game.lives);
    const earnedStars = outcome === 'victory' ? starsForVictory(this.game.lives, this.game.level.startLives) : 0;
    this.element('outcome-stars').textContent = starGlyphs(earnedStars);
    this.element('outcome-towers').textContent = String(this.game.towers.length);
    this.element('outcome-cash').textContent = `$${Math.floor(this.game.cash)}`;
    this.outcomeModal.classList.add('is-open');
  }

  private updateSoundButton(muted: boolean): void {
    const button = this.button('sound-button');
    button.innerHTML = `<i data-lucide="${muted ? 'volume-x' : 'volume-2'}" aria-hidden="true"></i>`;
    button.setAttribute('aria-label', muted ? 'Enable music' : 'Mute music');
    button.setAttribute('aria-pressed', String(!muted));
    button.title = muted ? 'Enable music' : 'Mute music';
    refreshIcons();
  }

  private saveVictory(): void {
    this.lastVictoryReward = recordVictory(this.progress, {
      levelId: this.game.level.id,
      levelName: this.game.level.name,
      lives: this.game.lives,
      startLives: this.game.level.startLives,
      cash: this.game.cash,
    });
    this.persistProgress();
    this.renderLevelGrid();
    this.renderWorldGrid();
    this.updateHomeProgress();
  }

  private updateHomeProgress(): void {
    this.element('home-player-name').textContent = this.progress.name;
    this.element('home-player-level').textContent = String(this.progress.level);
    this.element('home-energy-value').textContent = `${this.progress.energy}/100`;
    this.element('home-coins-value').textContent = this.progress.coins.toLocaleString();
    this.element('home-gems-value').textContent = this.progress.gems.toLocaleString();
    this.element('selection-energy-value').textContent = `${this.progress.energy}/100`;
    this.element('selection-coins-value').textContent = this.progress.coins.toLocaleString();
    this.element('selection-gems-value').textContent = this.progress.gems.toLocaleString();
    this.element('home-power-value').textContent = this.progress.squadPower.toLocaleString();
    this.element('home-streak-value').textContent = this.progress.streak > 0
      ? `${this.progress.streak} ${this.progress.streak === 1 ? 'day' : 'days'}`
      : 'Start today';
    this.element('home-best-wave-value').textContent = this.progress.bestWave > 0
      ? `Wave ${this.progress.bestWave}`
      : 'No waves';
    this.element('home-xp-fill').style.setProperty('--xp', `${(this.progress.xp % 1_000) / 10}%`);

    const claimableMissions = MISSIONS.filter((mission) => (
      mission.progress(this.progress) >= mission.target && !this.progress.claimedMissions.includes(mission.id)
    )).length;
    const achievements = this.achievementRecords().filter((entry) => entry.unlocked).length;
    const collection = STARTER_CARDS.length
      + LEARNING_CARDS.filter((card) => (this.progress.stars[card.levelId] ?? 0) > 0).length;
    this.setHomeBadge('home-missions-badge', claimableMissions);
    this.setHomeBadge('home-daily-badge', canClaimDaily(this.progress) ? 1 : 0);
    this.setHomeBadge('home-achievements-badge', achievements);
    this.setHomeBadge('home-collection-badge', collection);
    for (const world of WORLDS) {
      const worldTotal = world.mapIds.reduce((sum, levelId) => sum + (this.progress.stars[levelId] ?? 0), 0);
      const target = this.homeScreen.querySelector<HTMLElement>(`[data-home-stars="${world.id}"]`);
      if (target) target.textContent = String(worldTotal);
      const homeWorld = this.homeScreen.querySelector<HTMLButtonElement>(`[data-home-world="${world.id}"]`);
      if (homeWorld) {
        const unlocked = this.isWorldUnlocked(world.id);
        homeWorld.disabled = !unlocked;
        homeWorld.classList.toggle('is-locked', !unlocked);
        homeWorld.title = unlocked ? world.name : `Complete ${WORLDS[world.number - 2]?.name ?? 'the previous world'} to unlock`;
      }
    }
  }

  private openHomePanel(panel: string): void {
    const eyebrow = this.element('home-panel-eyebrow');
    const title = this.element('home-panel-title');
    const copy = this.element('home-panel-copy');
    const panelCopy: Record<string, [string, string, string]> = {
      profile: ['LOCAL GUEST PROFILE', this.progress.name, 'Progress is saved only in this browser. Clearing site data starts a fresh guest profile.'],
      settings: ['GAME SETTINGS', 'Settings', 'Choose how Wizino TD behaves on this device.'],
      missions: ['MISSION BOARD', 'Missions', 'Complete learning and defense goals to earn local rewards.'],
      daily: ['DAILY DROP', 'Daily rewards', 'Return each local calendar day for a fresh supply drop.'],
      achievements: ['MILESTONES', 'Achievements', 'Permanent milestones from your learning adventure.'],
      collection: ['STARTER ARCHIVE', 'Creature collection', 'Four guardians are already yours. Clear levels to discover more, then tap any card to reveal its answer.'],
      leaderboard: ['LOCAL RECORDS', 'Leaderboards', 'Each new level highscore is added to this browser-only leaderboard.'],
    };
    const text = panelCopy[panel] ?? panelCopy.profile;
    eyebrow.textContent = text[0];
    title.textContent = text[1];
    copy.textContent = text[2];
    this.homePanelContent.innerHTML = this.homePanelMarkup(panel);
    this.homePanelModal.dataset.panel = panel;
    this.homePanelModal.classList.add('is-open');
    refreshIcons();
    this.button('home-panel-close').focus();
  }

  private homePanelMarkup(panel: string): string {
    if (panel === 'settings') return this.settingsMarkup();
    if (panel === 'missions') return this.missionsMarkup();
    if (panel === 'daily') return this.dailyMarkup();
    if (panel === 'achievements') return this.achievementsMarkup();
    if (panel === 'collection') return this.collectionMarkup();
    if (panel === 'leaderboard') return this.leaderboardMarkup();
    return `
      <div class="progress-summary">
        <div><small>Level</small><strong>${this.progress.level}</strong></div>
        <div><small>XP</small><strong>${this.progress.xp.toLocaleString()}</strong></div>
        <div><small>Stars</small><strong>${Object.values(this.progress.stars).reduce((sum, value) => sum + value, 0)}</strong></div>
        <div><small>Power</small><strong>${this.progress.squadPower.toLocaleString()}</strong></div>
      </div>
      <div class="progress-summary">
        <div><small>Coins</small><strong>${this.progress.coins.toLocaleString()}</strong></div>
        <div><small>Gems</small><strong>${this.progress.gems.toLocaleString()}</strong></div>
        <div><small>Victories</small><strong>${this.progress.victories}</strong></div>
        <div><small>Best streak</small><strong>${this.progress.longestStreak || '—'}</strong></div>
      </div>
      <div class="empty-progress"><strong>Stored on this device</strong><p>No account or database is connected yet. This guest profile survives refreshes and browser restarts, but clearing site data resets it.</p></div>
    `;
  }

  private settingsMarkup(): string {
    const setting = (id: string, title: string, copy: string, checked: boolean) => `
      <label class="setting-row"><span><strong>${title}</strong><small>${copy}</small></span><input type="checkbox" data-setting="${id}" ${checked ? 'checked' : ''}></label>`;
    return `
      <div class="settings-list">
        ${setting('musicEnabled', 'Background music', 'The seamless magical soundtrack across every game screen.', this.progress.settings.musicEnabled)}
        ${setting('effectsEnabled', 'Game sounds', 'Button clicks, cards, towers, battle cues, and reward sounds.', this.progress.settings.effectsEnabled)}
        <label class="setting-row setting-row--select"><span><strong>Sound style</strong><small>Choose a pack—each change plays an instant preview.</small></span><select data-setting="soundPack" aria-label="Sound style">${UI_SOUND_PACKS.map((pack) => `<option value="${pack.id}" ${this.progress.settings.soundPack === pack.id ? 'selected' : ''}>${pack.name} — ${pack.description}</option>`).join('')}</select></label>
        ${setting('reducedMotion', 'Reduce motion', 'Minimize flips, transitions, and animated effects.', this.progress.settings.reducedMotion)}
        ${setting('gameplayTips', 'Gameplay tips', 'Show contextual guidance over the battlefield.', this.progress.settings.gameplayTips)}
      </div>
      <div class="settings-reset"><span>Reset stars, resources, records, cards, missions, and settings on this browser.</span><button class="panel-action panel-action--danger" type="button" data-reset-progress>Reset local progress</button></div>
    `;
  }

  private missionsMarkup(): string {
    return `<div class="panel-list">${MISSIONS.map((mission) => {
      const progress = Math.min(mission.target, mission.progress(this.progress));
      const complete = progress >= mission.target;
      const claimed = this.progress.claimedMissions.includes(mission.id);
      return `<article class="progress-card${complete ? ' is-complete' : ''}"><div><strong>${mission.title}</strong><p>${mission.copy}</p><small>Reward: ${mission.rewardCoins} coins${mission.rewardGems ? ` · ${mission.rewardGems} gem${mission.rewardGems === 1 ? '' : 's'}` : ''}</small></div><button class="panel-action" type="button" data-claim-mission="${mission.id}" ${!complete || claimed ? 'disabled' : ''}>${claimed ? 'Claimed' : complete ? 'Claim reward' : `${progress}/${mission.target}`}</button><span class="progress-meter"><i style="--progress:${progress / mission.target * 100}%"></i></span></article>`;
    }).join('')}</div>`;
  }

  private dailyMarkup(): string {
    const available = canClaimDaily(this.progress);
    return `<div class="daily-reward"><i data-lucide="gift" aria-hidden="true"></i><strong>${available ? '100 coins + 5 gems' : 'Reward collected'}</strong><p>${available ? 'Your daily supply drop is ready. Claim it once on this device today.' : 'Come back after your next local calendar day begins.'}</p><button class="panel-action" type="button" data-claim-daily ${available ? '' : 'disabled'}>${available ? 'Claim daily reward' : 'Collected today'}</button></div>`;
  }

  private achievementsMarkup(): string {
    return `<div class="panel-list">${this.achievementRecords().map((achievement) => `<article class="progress-card${achievement.unlocked ? ' is-complete' : ''}"><div><strong>${achievement.unlocked ? '✓' : '○'} ${achievement.title}</strong><p>${achievement.copy}</p></div><small>${achievement.unlocked ? 'UNLOCKED' : 'LOCKED'}</small></article>`).join('')}</div>`;
  }

  private collectionMarkup(): string {
    const unlocked = LEARNING_CARDS.filter((card) => (this.progress.stars[card.levelId] ?? 0) > 0);
    const cards: CollectionCard[] = [...STARTER_CARDS, ...unlocked];
    return `
      <div class="collection-deckbar">
        <span><small>Starter deck</small><strong>${STARTER_CARDS.length} guardians included</strong></span>
        <p>Every creature protects a learning answer. Flip one to study it.</p>
        <em>Swipe to browse</em>
      </div>
      <div class="collection-grid" aria-label="Collected learning cards">
        ${cards.map((card, index) => this.collectionCardMarkup(card, index)).join('')}
      </div>
    `;
  }

  private collectionCardMarkup(card: CollectionCard, index: number): string {
    const isStarter = 'starter' in card;
    const art = isStarter ? card.art : HOME_WORLD_ART[card.world];
    const origin = isStarter ? `Starter ${index + 1}/${STARTER_CARDS.length}` : 'Level reward';
    return `
      <button
        class="learning-card learning-card--${card.finish}"
        type="button"
        data-learning-card
        data-card-id="${card.id}"
        aria-label="Flip ${card.name} to reveal the answer"
        aria-pressed="false"
        style="--card-accent:${card.accent};--card-back-art:url(${COLLECTION_CARD_BACK})"
      >
        <span class="learning-card-inner">
          <span class="learning-card-face learning-card-front">
            <span class="learning-card-header">
              <span><small>${card.subject}</small><strong>${card.name}</strong></span>
              <b>${card.rarity}</b>
            </span>
            <span class="learning-card-art">
              <img src="${art}" alt="" loading="${isStarter ? 'eager' : 'lazy'}" decoding="async">
            </span>
            <span class="learning-card-question"><small>Knowledge challenge</small><strong>${card.prompt}</strong></span>
            <span class="learning-card-stats">
              <span><small>Toughness</small><b>${card.toughness}</b></span>
              <span><small>Defense</small><b>${card.defense}</b></span>
            </span>
            <span class="learning-card-footer"><small>${origin}</small><em>Tap to reveal</em></span>
          </span>
          <span class="learning-card-face learning-card-back">
            <span class="learning-card-answer">
              <small>${card.subject} answer</small>
              <b aria-hidden="true">✦</b>
              <strong>${card.answer}</strong>
              <i aria-hidden="true"></i>
              <em>Tap to return to ${card.name}</em>
            </span>
          </span>
        </span>
      </button>
    `;
  }

  private leaderboardMarkup(): string {
    if (this.progress.leaderboard.length === 0) return '<div class="empty-progress"><strong>No local records yet</strong><p>Win a level to post your first score. Improving that level score replaces its previous entry.</p></div>';
    return `<div class="leaderboard-list">${this.progress.leaderboard.map((entry) => `<article class="leaderboard-row"><span><strong>${entry.levelName}</strong><small>${starGlyphs(entry.stars)} · ${entry.lives} integrity</small></span><b>${entry.score.toLocaleString()}</b></article>`).join('')}</div>`;
  }

  private achievementRecords(): { title: string; copy: string; unlocked: boolean }[] {
    const unlockedCards = LEARNING_CARDS.filter((card) => (this.progress.stars[card.levelId] ?? 0) > 0).length;
    return [
      { title: 'First contact', copy: 'Clear one wave.', unlocked: this.progress.totalWaves >= 1 },
      { title: 'Learning defender', copy: 'Win your first level.', unlocked: this.progress.victories >= 1 },
      { title: 'Untouched core', copy: 'Win with full integrity.', unlocked: this.progress.flawlessVictories >= 1 },
      { title: 'Three-day rhythm', copy: 'Win on three consecutive days.', unlocked: this.progress.longestStreak >= 3 },
      { title: 'Growing memory', copy: 'Unlock three learning cards.', unlocked: unlockedCards >= 3 },
      { title: 'Squad architect', copy: 'Deploy ten towers across your runs.', unlocked: this.progress.totalTowers >= 10 },
    ];
  }

  private handleHomePanelAction(event: Event): void {
    const target = event.target as HTMLElement;
    const card = target.closest<HTMLElement>('[data-learning-card]');
    if (card) {
      const isFlipped = card.classList.toggle('is-flipped');
      card.setAttribute('aria-pressed', String(isFlipped));
      return;
    }
    const dailyButton = target.closest<HTMLButtonElement>('[data-claim-daily]');
    if (dailyButton) {
      const reward = claimDaily(this.progress);
      if (reward) {
        this.persistProgress();
        this.updateHomeProgress();
        this.toast(`Daily reward claimed · +${reward.coins} coins · +${reward.gems} gems`, 'success');
        this.openHomePanel('daily');
      }
      return;
    }
    const missionButton = target.closest<HTMLButtonElement>('[data-claim-mission]');
    if (missionButton?.dataset.claimMission && claimMission(this.progress, missionButton.dataset.claimMission)) {
      this.persistProgress();
      this.updateHomeProgress();
      this.toast('Mission reward claimed.', 'success');
      this.openHomePanel('missions');
      return;
    }
    const resetButton = target.closest<HTMLButtonElement>('[data-reset-progress]');
    if (!resetButton) return;
    if (resetButton.dataset.confirm !== 'true') {
      resetButton.dataset.confirm = 'true';
      resetButton.textContent = 'Click again to reset';
      return;
    }
    this.progress = createDefaultProgress();
    localStorage.removeItem('snack-squad-player-v1');
    localStorage.removeItem('mono-ward-progress');
    this.applyAudioSettings();
    this.applySettings();
    this.persistProgress();
    this.renderLevelGrid();
    this.renderWorldGrid();
    this.updateHomeProgress();
    this.toast('Local guest progress reset.', 'warning');
    this.openHomePanel('settings');
  }

  private handleSettingChange(event: Event): void {
    const input = (event.target as HTMLElement).closest<HTMLInputElement | HTMLSelectElement>('[data-setting]');
    if (!input?.dataset.setting) return;
    const setting = input.dataset.setting as keyof PlayerProgress['settings'];
    if (setting === 'soundPack' && input instanceof HTMLSelectElement && isUiSoundPack(input.value)) {
      this.progress.settings.soundPack = input.value;
    } else if (input instanceof HTMLInputElement && setting !== 'soundPack') {
      this.progress.settings[setting] = input.checked;
    }
    if (setting === 'musicEnabled' || setting === 'effectsEnabled' || setting === 'soundPack') this.applyAudioSettings();
    this.applySettings();
    this.persistProgress();
  }

  private applyAudioSettings(): void {
    this.onAudioSettingsChange({
      musicEnabled: this.progress.settings.musicEnabled,
      effectsEnabled: this.progress.settings.effectsEnabled,
      soundPack: this.progress.settings.soundPack,
    });
  }

  private applySettings(): void {
    document.body.classList.toggle('reduce-motion', this.progress.settings.reducedMotion);
    document.body.classList.toggle('tips-disabled', !this.progress.settings.gameplayTips);
    if (this.progress.settings.reducedMotion) this.homeHero.dataset.introState = 'complete';
  }

  private persistProgress(): void {
    savePlayerProgress(this.progress);
    this.updateHomeProgress();
  }

  private setHomeBadge(id: string, value: number): void {
    const badge = this.element(id);
    badge.textContent = String(value);
    badge.hidden = value <= 0;
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

  private pushRoute(hash: string): void {
    if (window.location.hash !== hash) window.history.pushState({}, '', hash);
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
