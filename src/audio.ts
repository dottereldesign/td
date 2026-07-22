import type { GameEvent } from './types';

export class AudioEngine {
  muted: boolean;
  private context: AudioContext | null = null;
  private lastShotAt = 0;

  constructor() {
    this.muted = (localStorage.getItem('wizino-td-muted') ?? localStorage.getItem('mono-ward-muted')) === 'true';
  }

  unlock(): void {
    if (this.muted) return;
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') void this.context.resume();
  }

  toggle(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('wizino-td-muted', String(this.muted));
    if (!this.muted) {
      this.unlock();
      this.tone(420, 0.05, 0.035, 'sine');
    }
    return this.muted;
  }

  handle(event: GameEvent): void {
    if (this.muted || !this.context) return;
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
    if (!this.context || this.muted) return;
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
}
