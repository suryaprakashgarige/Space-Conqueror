/**
 * Mission Audio Synthesizer (Web Audio API)
 * Provides realistic NASA Apollo/Artemis sound effects:
 * - Powered descent rocket thruster burn (filtered turbulent noise)
 * - Altimeter descent radar telemetry pings
 * - Touchdown confirmation melodic chime
 * - Lunar rover electric wheel servo drive hum
 * - Telemetry data packet chirp (Rover -> Lander -> Earth)
 */

class MissionAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private thrusterNode: AudioNode | null = null;
  private thrusterGain: GainNode | null = null;
  private roverHumNode: AudioNode | null = null;
  private roverHumGain: GainNode | null = null;

  private initContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopThruster();
      this.stopRoverHum();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Starts a low-frequency turbulent rocket thruster rumble
   */
  public startThruster() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx || this.thrusterNode) return;

    try {
      // Generate pink/brown noise buffer
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // Gain compensation
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Lowpass filter for deep rocket roar
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, ctx.currentTime);
      filter.Q.setValueAtTime(2.5, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.28, ctx.currentTime + 0.8);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start();
      this.thrusterNode = whiteNoise;
      this.thrusterGain = gain;
    } catch {}
  }

  public stopThruster() {
    if (this.thrusterGain && this.ctx) {
      try {
        this.thrusterGain.gain.setValueAtTime(this.thrusterGain.gain.value, this.ctx.currentTime);
        this.thrusterGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);
        const node = this.thrusterNode;
        window.setTimeout(() => {
          try {
            (node as AudioBufferSourceNode)?.stop();
            node?.disconnect();
          } catch {}
        }, 550);
      } catch {}
    }
    this.thrusterNode = null;
    this.thrusterGain = null;
  }

  /**
   * High-tech radar altimeter beep
   */
  public playAltimeterBeep(altitudeM: number) {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Pitch rises as altitude decreases: 880Hz down to 1400Hz
      const freq = Math.min(1600, Math.max(600, 1400 - altitudeM * 8));
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {}
  }

  /**
   * Melodic Apollo/Artemis touchdown chime
   */
  public playTouchdownChime() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = ctx.currentTime + i * 0.14;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.65);
      });
    } catch {}
  }

  /**
   * Lunar rover electric drivetrain servo hum
   */
  public startRoverHum() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx || this.roverHumNode) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(75, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, ctx.currentTime);

      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      this.roverHumNode = osc;
      this.roverHumGain = gain;
    } catch {}
  }

  public stopRoverHum() {
    if (this.roverHumGain && this.ctx) {
      try {
        this.roverHumGain.gain.setValueAtTime(this.roverHumGain.gain.value, this.ctx.currentTime);
        this.roverHumGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);
        const node = this.roverHumNode;
        window.setTimeout(() => {
          try {
            (node as OscillatorNode)?.stop();
            node?.disconnect();
          } catch {}
        }, 350);
      } catch {}
    }
    this.roverHumNode = null;
    this.roverHumGain = null;
  }

  /**
   * Dual-Hop comms telemetry chirp
   */
  public playCommsPulse() {
    if (this.isMuted) return;
    const ctx = this.initContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1850, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.035, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch {}
  }
}

export const missionAudio = new MissionAudioEngine();
