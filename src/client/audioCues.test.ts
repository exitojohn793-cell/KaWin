import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_CUE_PRESETS,
  type AudioCueId,
  getUrgentTickPitchMultiplier,
  shouldTriggerUrgentTick,
} from './audioCues.ts';

test('AUDIO_CUE_PRESETS defines distinct valid synth cues for all core game events', () => {
  const requiredCues: AudioCueId[] = [
    'player_joined',
    'time_running_out',
    'correct_answer',
    'final_podium_reveal',
  ];

  const signatures = new Set<string>();
  for (const cue of requiredCues) {
    const steps = AUDIO_CUE_PRESETS[cue];
    assert.ok(Array.isArray(steps) && steps.length >= 2, `${cue} needs >= 2 tone steps`);
    for (const step of steps) {
      assert.ok(step.freq > 50 && step.freq < 5000);
      assert.ok(step.durationSec > 0 && step.durationSec <= 1.5);
      assert.ok(step.gain > 0 && step.gain <= 0.3);
      assert.ok(step.delaySec >= 0);
    }
    const sig = steps.map((s) => `${s.freq}:${s.type}:${s.delaySec}`).join('|');
    assert.ok(!signatures.has(sig), `${cue} must have a distinct sonic signature`);
    signatures.add(sig);
  }
});

test('shouldTriggerUrgentTick fires once per second in final 5 seconds only', () => {
  assert.equal(shouldTriggerUrgentTick(10, null), false);
  assert.equal(shouldTriggerUrgentTick(6, null), false);
  assert.equal(shouldTriggerUrgentTick(5, null), true);
  assert.equal(shouldTriggerUrgentTick(5, 5), false);
  assert.equal(shouldTriggerUrgentTick(4, 5), true);
  assert.equal(shouldTriggerUrgentTick(1, 2), true);
  assert.equal(shouldTriggerUrgentTick(0, 1), false);
});

test('getUrgentTickPitchMultiplier rises as countdown approaches 1 second', () => {
  const at5 = getUrgentTickPitchMultiplier(5);
  const at3 = getUrgentTickPitchMultiplier(3);
  const at1 = getUrgentTickPitchMultiplier(1);
  assert.equal(at5, 1);
  assert.ok(at3 > at5);
  assert.ok(at1 > at3);
});
