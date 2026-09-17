// High-fidelity Web Audio Synthesizer for FPXstudio Soundtracks & Themes

class SynthEngine {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private timerId: number | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private currentPreset: string = 'epic-cinematic';
  private step: number = 0;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public getAnalyserData(): Uint8Array {
    if (!this.analyser) return new Uint8Array(32);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  public setVolume(val: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(Math.max(0, Math.min(1, val * 0.4)), this.ctx.currentTime, 0.05);
    }
  }

  public playTrack(preset: string = 'epic-cinematic') {
    this.init();
    this.currentPreset = preset;
    this.isPlaying = true;
    this.step = 0;

    if (this.timerId) {
      clearInterval(this.timerId);
    }

    const intervalMs = preset.includes('trap') || preset.includes('hiphop') ? 140 : 180;
    this.timerId = window.setInterval(() => {
      this.tick();
    }, intervalMs);
  }

  public stop() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  public getPlayingState(): boolean {
    return this.isPlaying;
  }

  private tick() {
    if (!this.ctx || !this.isPlaying || !this.masterGain) return;
    const t = this.ctx.currentTime;
    this.step = (this.step + 1) % 16;

    // Presets with note patterns
    if (this.currentPreset === 'epic-cinematic') {
      // Deep brass + strings chords + sub-kick
      const notes = [130.81, 155.56, 174.61, 196.00, 220.00, 196.00, 174.61, 155.56];
      if (this.step % 4 === 0) {
        this.playDrum(t, 'kick');
        this.playTone(notes[(this.step / 4) % notes.length] / 2, 'sawtooth', 0.8, 0.25);
      }
      if (this.step % 2 === 0) {
        const chordNote = notes[this.step % notes.length];
        this.playTone(chordNote, 'triangle', 0.4, 0.15);
      }
      if (this.step % 8 === 4) {
        this.playDrum(t, 'snare');
      }
    } else if (this.currentPreset === 'horror-drone') {
      // Dissonant dark cluster + heart pulse
      if (this.step % 8 === 0) {
        this.playTone(55, 'sine', 1.8, 0.35); // Deep sub
        this.playTone(58.27, 'sawtooth', 1.6, 0.12); // Minor 2nd dissonance
      }
      if (this.step % 4 === 0) {
        this.playTone(110 + Math.random() * 8, 'triangle', 0.6, 0.08);
      }
    } else if (this.currentPreset === 'trap-energetic' || this.currentPreset === 'hiphop-ambient') {
      // 808 sub + hi-hat + melodic pluck
      const bassNotes = [65.41, 65.41, 73.42, 87.31];
      if (this.step === 0 || this.step === 6 || this.step === 10) {
        this.playDrum(t, 'kick');
        this.playTone(bassNotes[Math.floor(this.step / 4) % bassNotes.length], 'sine', 0.4, 0.3);
      }
      if (this.step % 4 === 2) {
        this.playDrum(t, 'snare');
      }
      // Hi-hats
      this.playDrum(t, 'hat');
      if (this.step % 2 === 0) {
        const leadScale = [261.63, 311.13, 349.23, 392.00, 466.16];
        this.playTone(leadScale[this.step % leadScale.length], 'sine', 0.2, 0.12);
      }
    } else if (this.currentPreset === 'cyber-synth') {
      // Fast arpeggiated 16ths
      const arp = [110, 130.81, 164.81, 196, 220, 261.63, 329.63, 392];
      const note = arp[this.step % arp.length];
      this.playTone(note, 'sawtooth', 0.12, 0.15);
      if (this.step % 4 === 0) {
        this.playDrum(t, 'kick');
      }
    } else {
      // Melodic gentle ambient
      const scale = [196.00, 220.00, 261.63, 293.66, 329.63];
      if (this.step % 2 === 0) {
        this.playTone(scale[(this.step / 2) % scale.length], 'sine', 0.5, 0.15);
      }
      if (this.step % 8 === 0) {
        this.playTone(98, 'triangle', 1.2, 0.2);
      }
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, gainVal: number) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch {
      // Ignore audio glitches
    }
  }

  private playDrum(time: number, type: 'kick' | 'snare' | 'hat') {
    if (!this.ctx || !this.masterGain) return;
    try {
      if (type === 'kick') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(35, time + 0.12);
        gain.gain.setValueAtTime(0.4, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.15);
      } else if (type === 'snare') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(200, time);
        osc.frequency.exponentialRampToValueAtTime(70, time + 0.1);
        gain.gain.setValueAtTime(0.25, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.1);
      } else if (type === 'hat') {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(12000, time);
        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(time);
        osc.stop(time + 0.04);
      }
    } catch {
      // Ignore
    }
  }
}

export const globalSynth = new SynthEngine();
