import type { GameEvent } from './types';

export type UiSound = 'click' | 'card' | 'confirm' | 'toggle' | 'back' | 'open' | 'tower';

export interface AudioChannels {
  musicEnabled: boolean;
  effectsEnabled: boolean;
}

const UI_SOUND_URLS: Record<UiSound, string> = {
  click: '/audio/ui/click.ogg',
  card: '/audio/ui/card.ogg',
  confirm: '/audio/ui/confirm.ogg',
  toggle: '/audio/ui/toggle.ogg',
  back: '/audio/ui/back.ogg',
  open: '/audio/ui/open.ogg',
  tower: '/audio/ui/tower.ogg',
};

export class AudioEngine {
  muted: boolean;
  private context: AudioContext | null = null;
  private readonly music = document.getElementById('background-music') as HTMLAudioElement | null;
  private readonly effectBuffers = new Map<UiSound, AudioBuffer>();
  private readonly effectLoads = new Map<UiSound, Promise<AudioBuffer | null>>();
  private musicEnabled = true;
  private effectsEnabled = true;
  private effectPlays = 0;
  private lastEffect: UiSound | null = null;
  private lastShotAt = 0;

  constructor() {
    const storedPreference = localStorage.getItem('wizino-td-muted') ?? localStorage.getItem('mono-ward-muted');
    this.muted = storedPreference === null ? true : storedPreference !== 'false';
    if (this.music) this.music.volume = 0.18;
  }

  unlock(): void {
    if (this.muted) return;
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
    if (this.musicEnabled && this.music?.paused) void this.music.play().catch(() => undefined);
    if (this.effectsEnabled) void this.preloadEffects();
  }

  configure(channels: AudioChannels): void {
    this.musicEnabled = channels.musicEnabled;
    this.effectsEnabled = channels.effectsEnabled;
    if (!this.musicEnabled) this.music?.pause();
    else if (!this.muted) this.unlock();
    if (this.effectsEnabled && !this.muted) void this.preloadEffects();
  }

  toggle(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('wizino-td-muted', String(this.muted));
    if (this.muted) {
      this.music?.pause();
    } else {
      this.unlock();
    }
    return this.muted;
  }

  playUi(sound: UiSound): void {
    if (this.muted || !this.effectsEnabled) return;
    this.unlock();
    const buffer = this.effectBuffers.get(sound);
    if (buffer) {
      this.playBuffer(sound, buffer);
      return;
    }
    void this.loadEffect(sound).then((loaded) => {
      if (loaded && !this.muted && this.effectsEnabled) this.playBuffer(sound, loaded);
    });
  }

  getDiagnostics(): { muted: boolean; musicEnabled: boolean; effectsEnabled: boolean; loadedEffects: number; effectPlays: number; lastEffect: UiSound | null } {
    return {
      muted: this.muted,
      musicEnabled: this.musicEnabled,
      effectsEnabled: this.effectsEnabled,
      loadedEffects: this.effectBuffers.size,
      effectPlays: this.effectPlays,
      lastEffect: this.lastEffect,
    };
  }

  handle(event: GameEvent): void {
    if (this.muted || !this.effectsEnabled || !this.context) return;
    if (event.type === 'tower-built') this.sequence([240, 360], 0.055, 0.045);
    if (event.type === 'tower-fired' && performance.now() - this.lastShotAt > 55) {
      this.lastShotAt = performance.now();
      this.tone(150 + (event.tower.id % 4) * 35, 0.025, 0.009, 'square');
    }
    if (event.type === 'enemy-killed') this.tone(520, 0.022, 0.008, 'triangle');
    if (event.type === 'enemy-leaked') this.sequence([150, 90], 0.11, 0.05);
    if (event.type === 'wave-started') this.sequence([260, 330, 420], 0.07, 0.04);
    if (event.type === 'wave-cleared') this.sequence([330, 440, 550], 0.065, 0.035);
    if (event.type === 'outcome') {
      this.sequence(event.outcome === 'victory' ? [330, 440, 660] : [220, 160, 100], 0.15, 0.055);
    }
  }

  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
    delay = 0,
  ): void {
    if (!this.context || this.muted || !this.effectsEnabled) return;
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  private sequence(frequencies: number[], duration: number, volume: number): void {
    frequencies.forEach((frequency, index) => {
      this.tone(frequency, duration, volume, 'triangle', index * duration * 0.72);
    });
  }

  private async preloadEffects(): Promise<void> {
    await Promise.all((Object.keys(UI_SOUND_URLS) as UiSound[]).map((sound) => this.loadEffect(sound)));
  }

  private loadEffect(sound: UiSound): Promise<AudioBuffer | null> {
    const cached = this.effectBuffers.get(sound);
    if (cached) return Promise.resolve(cached);
    const pending = this.effectLoads.get(sound);
    if (pending) return pending;
    if (!this.context) return Promise.resolve(null);

    const load = fetch(UI_SOUND_URLS[sound])
      .then((response) => {
        if (!response.ok) throw new Error(`Unable to load ${sound} sound.`);
        return response.arrayBuffer();
      })
      .then((data) => this.context?.decodeAudioData(data) ?? null)
      .then((buffer) => {
        if (buffer) this.effectBuffers.set(sound, buffer);
        return buffer;
      })
      .catch(() => null)
      .finally(() => this.effectLoads.delete(sound));
    this.effectLoads.set(sound, load);
    return load;
  }

  private playBuffer(sound: UiSound, buffer: AudioBuffer): void {
    if (!this.context) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = sound === 'confirm' ? 0.2 : sound === 'tower' ? 0.16 : 0.13;
    source.connect(gain);
    gain.connect(this.context.destination);
    source.start();
    this.effectPlays += 1;
    this.lastEffect = sound;
  }
}
