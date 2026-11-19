export type AudioCueId =
  | 'player_joined'
  | 'time_running_out'
  | 'correct_answer'
  | 'final_podium_reveal'
  | 'question_start'
  | 'lock_in'
  | 'wrong_answer';

export type SynthWaveType = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface ToneStep {
  freq: number;
  freqEnd?: number;
  durationSec: number;
  type: SynthWaveType;
  gain: number;
  delaySec: number;
}

export const URGENT_COUNTDOWN_THRESHOLD_SEC = 5;

export const AUDIO_CUE_PRESETS: Record<AudioCueId, readonly ToneStep[]> = {
  player_joined: [
    { freq: 523.25, durationSec: 0.13, type: 'sine', gain: 0.12, delaySec: 0 },
    { freq: 659.25, durationSec: 0.15, type: 'sine', gain: 0.11, delaySec: 0.065 },
    { freq: 783.99, durationSec: 0.2, type: 'triangle', gain: 0.07, delaySec: 0.13 },
  ],
  time_running_out: [
    {
      freq: 880,
      freqEnd: 987.77,
      durationSec: 0.075,
      type: 'triangle',
      gain: 0.13,
      delaySec: 0,
    },
    {
      freq: 1174.66,
      durationSec: 0.065,
      type: 'sine',
      gain: 0.09,
      delaySec: 0.09,
    },
  ],
  correct_answer: [
    { freq: 523.25, durationSec: 0.13, type: 'triangle', gain: 0.14, delaySec: 0 },
    { freq: 659.25, durationSec: 0.13, type: 'triangle', gain: 0.14, delaySec: 0.08 },
    { freq: 783.99, durationSec: 0.16, type: 'triangle', gain: 0.14, delaySec: 0.16 },
    { freq: 1046.5, durationSec: 0.34, type: 'sine', gain: 0.16, delaySec: 0.24 },
  ],
  final_podium_reveal: [
    { freq: 261.63, durationSec: 0.45, type: 'triangle', gain: 0.09, delaySec: 0 },
    { freq: 392.0, durationSec: 0.14, type: 'triangle', gain: 0.13, delaySec: 0 },
    { freq: 523.25, durationSec: 0.14, type: 'triangle', gain: 0.13, delaySec: 0.11 },
    { freq: 659.25, durationSec: 0.16, type: 'triangle', gain: 0.14, delaySec: 0.22 },
    { freq: 783.99, durationSec: 0.2, type: 'triangle', gain: 0.14, delaySec: 0.33 },
    { freq: 1046.5, durationSec: 0.55, type: 'triangle', gain: 0.16, delaySec: 0.44 },
    { freq: 1318.51, durationSec: 0.65, type: 'sine', gain: 0.1, delaySec: 0.46 },
  ],
  question_start: [
    { freq: 392.0, durationSec: 0.12, type: 'triangle', gain: 0.12, delaySec: 0 },
    { freq: 523.25, durationSec: 0.12, type: 'triangle', gain: 0.12, delaySec: 0.09 },
    { freq: 783.99, durationSec: 0.24, type: 'triangle', gain: 0.13, delaySec: 0.18 },
  ],
  lock_in: [
    { freq: 440.0, durationSec: 0.09, type: 'triangle', gain: 0.09, delaySec: 0 },
    { freq: 587.33, durationSec: 0.11, type: 'triangle', gain: 0.09, delaySec: 0.05 },
  ],
  wrong_answer: [
    { freq: 293.66, freqEnd: 246.94, durationSec: 0.18, type: 'sawtooth', gain: 0.07, delaySec: 0 },
    { freq: 220.0, freqEnd: 174.61, durationSec: 0.26, type: 'sawtooth', gain: 0.07, delaySec: 0.14 },
  ],
};

/**
 * Determina si debe sonar el aviso de tiempo agotándose ("time running out")
 * exactamente una vez por cada segundo entero dentro de los últimos segundos.
 */
export function shouldTriggerUrgentTick(
  secondsLeft: number,
  lastTickedSecond: number | null,
  thresholdSec = URGENT_COUNTDOWN_THRESHOLD_SEC
): boolean {
  if (!Number.isFinite(secondsLeft)) return false;
  if (secondsLeft < 1 || secondsLeft > thresholdSec) return false;
  return lastTickedSecond !== secondsLeft;
}

/**
 * Escala el factor de intensidad/tono para los últimos segundos de cuenta regresiva.
 */
export function getUrgentTickPitchMultiplier(secondsLeft: number): number {
  const clamped = Math.max(1, Math.min(URGENT_COUNTDOWN_THRESHOLD_SEC, secondsLeft));
  return 1 + (URGENT_COUNTDOWN_THRESHOLD_SEC - clamped) * 0.045;
}
