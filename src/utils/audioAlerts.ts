/**
 * Synthesizes authentic maritime acoustic alert sounds using Web Audio API.
 * 100% self-contained, works offline, zero external asset dependencies.
 */

class MaritimeAudioEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    try {
      if (!this.ctx) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioContextClass) {
          this.ctx = new AudioContextClass();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * High-pitch sonar ping with characteristic acoustic reverberation
   */
  public playSonarPing(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.35);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 1.3);
  }

  /**
   * Deep maritime foghorn (Buzina de nevoeiro de navio)
   */
  public playFoghorn(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const baseFreq = 120; // Deep ship horn bass

    // Create dual harmonic oscillators for rich brass texture
    [1, 1.25, 1.5].forEach((multiplier, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = i === 0 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(baseFreq * multiplier, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.18 / (i + 1), now + 0.15);
      gain.gain.setValueAtTime(0.18 / (i + 1), now + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.9);
    });
  }

  /**
   * Maritime ship bell chime (Sino de bordo - double strike)
   */
  public playShipBell(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const strike = (startTime: number) => {
      const freqs = [840, 1260, 2100, 3150];
      freqs.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.001, startTime);
        gain.gain.linearRampToValueAtTime(0.15 / (index + 1), startTime + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.8);
      });
    };

    const now = ctx.currentTime;
    strike(now);
    strike(now + 0.22); // Second strike
  }

  /**
   * Pulsing nautical navigation emergency beep (Alerta de perigo de encalhe)
   */
  public playDangerAlarm(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const beepStart = now + i * 0.24;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, beepStart); // A5

      gain.gain.setValueAtTime(0.001, beepStart);
      gain.gain.linearRampToValueAtTime(0.18, beepStart + 0.01);
      gain.gain.linearRampToValueAtTime(0.18, beepStart + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, beepStart + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(beepStart);
      osc.stop(beepStart + 0.18);
    }
  }

  public playSound(soundType: 'sonar' | 'foghorn' | 'shipbell' | 'danger'): void {
    switch (soundType) {
      case 'sonar':
        this.playSonarPing();
        break;
      case 'foghorn':
        this.playFoghorn();
        break;
      case 'shipbell':
        this.playShipBell();
        break;
      case 'danger':
        this.playDangerAlarm();
        break;
    }
  }
}

export const maritimeAudio = new MaritimeAudioEngine();
