import {
  AUDIO_CUE_PRESETS,
  type AudioCueId,
  type ToneStep,
  getUrgentTickPitchMultiplier,
} from './audioCues.ts';

const MUTE_STORAGE_KEY = 'kawin_audio_muted';

class StudioAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private muted = false;
  private unlockInstalled = false;
  private cueHistory: AudioCueId[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === '1';
      } catch {
        this.muted = false;
      }
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(next: boolean): void {
    this.muted = next;
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore storage quota errors
      }
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(next ? 0 : 0.85, this.ctx.currentTime);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.unlock();
    }
    return this.muted;
  }

  installAutoUnlock(): void {
    if (this.unlockInstalled || typeof window === 'undefined') return;
    this.unlockInstalled = true;

    const handleGesture = () => {
      this.unlock();
      if (this.ctx && this.ctx.state === 'running') {
        window.removeEventListener('pointerdown', handleGesture);
        window.removeEventListener('keydown', handleGesture);
      }
    };

    window.addEventListener('pointerdown', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
  }

  unlock(): void {
    const ctx = this.ensureContext(true);
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
  }

  getCueHistory(): readonly AudioCueId[] {
    return this.cueHistory;
  }

  private ensureContext(allowWhenMuted = false): AudioContext | null {
    if (this.muted && !allowWhenMuted) return null;
    if (typeof window === 'undefined') return null;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return null;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.muted ? 0 : 0.85,
        this.ctx.currentTime
      );

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  private scheduleStep(
    ctx: AudioContext,
    step: ToneStep,
    pitchMultiplier = 1
  ): void {
    if (!this.compressor) return;

    const now = ctx.currentTime + step.delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const startFreq = step.freq * pitchMultiplier;
    osc.type = step.type;
    osc.frequency.setValueAtTime(startFreq, now);
    if (step.freqEnd && step.freqEnd > 0) {
      osc.frequency.exponentialRampToValueAtTime(
        step.freqEnd * pitchMultiplier,
        now + step.durationSec
      );
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(step.gain, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + step.durationSec);

    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(now);
    osc.stop(now + step.durationSec + 0.025);
  }

  playCue(cue: AudioCueId, pitchMultiplier = 1): void {
    this.cueHistory = [...this.cueHistory.slice(-29), cue];
    const ctx = this.ensureContext();
    if (!ctx) return;

    const steps = AUDIO_CUE_PRESETS[cue];
    for (const step of steps) {
      this.scheduleStep(ctx, step, pitchMultiplier);
    }
  }

  /** Sonido cuando un jugador entra a la sala ('player joined') */
  playPlayerJoined(): void {
    this.playCue('player_joined');
  }

  playJoin(): void {
    this.playPlayerJoined();
  }

  /** Sonido de cuenta regresiva en los últimos segundos ('time running out') */
  playTimeRunningOut(secondsLeft = 3): void {
    this.playCue('time_running_out', getUrgentTickPitchMultiplier(secondsLeft));
  }

  playTick(urgent = false, secondsLeft = 3): void {
    if (urgent) {
      this.playTimeRunningOut(secondsLeft);
      return;
    }
    this.playCue('lock_in');
  }

  /** Sonido de acierto ('correct answer') */
  playCorrectAnswer(): void {
    this.playCue('correct_answer');
  }

  playCorrect(): void {
    this.playCorrectAnswer();
  }

  /** Fanfarria del podio final ('final podium reveal') */
  playFinalPodiumReveal(): void {
    this.playCue('final_podium_reveal');
  }

  playPodium(): void {
    this.playFinalPodiumReveal();
  }

  playQuestionStart(): void {
    this.playCue('question_start');
  }

  playLockIn(): void {
    this.playCue('lock_in');
  }

  playWrong(): void {
    this.playCue('wrong_answer');
  }
}

export const studioAudio = new StudioAudioEngine();
