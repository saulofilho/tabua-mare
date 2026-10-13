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

  /**
   * Sound confirmation when anchor is successfully dropped
   */
  public playAnchorDropChime(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [520, 650, 780].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = now + i * 0.12;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.45);
    });
  }

  /**
   * High-urgency piercing nautical Anchor Drag Emergency Alarm (Alarme de Garreio)
   */
  public playAnchorDragAlarm(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Rapid alternating two-tone siren (980Hz and 1300Hz)
    const tones = [980, 1318, 980, 1318, 980];
    tones.forEach((freq, idx) => {
      const start = now + idx * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.015);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.16);
    });
  }

  /**
   * Warning ping when boat approaches 75% of safety radius
   */
  public playWarningBeep(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.2);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.26);
  }

  /**
   * International Morse Code SOS Distress Signal (... --- ...)
   * High-contrast piercing emergency acoustic tone (800Hz)
   */
  public playMorseSOS(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freq = 820; // 820 Hz maritime distress frequency

    // SOS pattern: 3 dits (0.1s), pause (0.2s), 3 dahs (0.3s), pause (0.2s), 3 dits (0.1s)
    const elements: { duration: number; gap: number }[] = [
      // S: ...
      { duration: 0.1, gap: 0.08 },
      { duration: 0.1, gap: 0.08 },
      { duration: 0.1, gap: 0.22 },
      // O: ---
      { duration: 0.32, gap: 0.08 },
      { duration: 0.32, gap: 0.08 },
      { duration: 0.32, gap: 0.22 },
      // S: ...
      { duration: 0.1, gap: 0.08 },
      { duration: 0.1, gap: 0.08 },
      { duration: 0.1, gap: 0.08 },
    ];

    let currentOffset = 0.05;

    elements.forEach((elem) => {
      const startTime = now + currentOffset;
      const stopTime = startTime + elem.duration;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.24, startTime + 0.01);
      gain.gain.setValueAtTime(0.24, stopTime - 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, stopTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(stopTime + 0.02);

      currentOffset += elem.duration + elem.gap;
    });
  }

  public playSound(
    soundType:
      | 'sonar'
      | 'foghorn'
      | 'shipbell'
      | 'danger'
      | 'anchor_drag'
      | 'anchor_drop'
      | 'sos'
  ): void {
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
      case 'anchor_drag':
        this.playAnchorDragAlarm();
        break;
      case 'anchor_drop':
        this.playAnchorDropChime();
        break;
      case 'sos':
        this.playMorseSOS();
        break;
    }
  }
}

export const maritimeAudio = new MaritimeAudioEngine();
