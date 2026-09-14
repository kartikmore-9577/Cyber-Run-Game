export type SoundEffect =
  | 'jump'
  | 'playerShoot'
  | 'bossHit'
  | 'bossShoot'
  | 'playerHit'
  | 'bossDefeat'
  | 'gameOver';

export class AudioManager {
  private static context?: AudioContext;
  private static muted = window.localStorage.getItem('cyberRunSoundMuted') === 'true';
  private static readonly volumes: Record<SoundEffect, number> = {
    jump: 0.08,
    playerShoot: 0.1,
    bossHit: 0.12,
    bossShoot: 0.1,
    playerHit: 0.12,
    bossDefeat: 0.16,
    gameOver: 0.14,
  };

  public static resume(): void {
    const context = AudioManager.getContext();
    if (context.state === 'suspended') void context.resume();
  }

  public static toggleMute(): boolean {
    AudioManager.muted = !AudioManager.muted;
    window.localStorage.setItem('cyberRunSoundMuted', String(AudioManager.muted));
    return AudioManager.muted;
  }

  public static isMuted(): boolean {
    return AudioManager.muted;
  }

  public play(effect: SoundEffect): void {
    if (AudioManager.muted) return;
    const context = AudioManager.getContext();
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime;
    const settings = this.getSettings(effect);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = settings.type;
    oscillator.frequency.setValueAtTime(settings.startFrequency, now);
    if (settings.endFrequency !== settings.startFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(settings.endFrequency, now + settings.duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(AudioManager.volumes[effect], now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + settings.duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + settings.duration + 0.02);
  }

  private static getContext(): AudioContext {
    AudioManager.context ??= new AudioContext();
    return AudioManager.context;
  }

  private getSettings(effect: SoundEffect): {
    type: OscillatorType;
    startFrequency: number;
    endFrequency: number;
    duration: number;
  } {
    switch (effect) {
      case 'jump':
        return { type: 'sine', startFrequency: 280, endFrequency: 620, duration: 0.2 };
      case 'playerShoot':
        return { type: 'square', startFrequency: 760, endFrequency: 220, duration: 0.12 };
      case 'bossHit':
        return { type: 'sawtooth', startFrequency: 180, endFrequency: 70, duration: 0.16 };
      case 'bossShoot':
        return { type: 'triangle', startFrequency: 120, endFrequency: 65, duration: 0.24 };
      case 'playerHit':
        return { type: 'square', startFrequency: 150, endFrequency: 75, duration: 0.16 };
      case 'bossDefeat':
        return { type: 'sawtooth', startFrequency: 420, endFrequency: 45, duration: 0.7 };
      case 'gameOver':
        return { type: 'sine', startFrequency: 180, endFrequency: 55, duration: 0.7 };
    }
  }
}
