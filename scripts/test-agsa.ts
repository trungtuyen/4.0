import assert from 'node:assert/strict';
import { AGSAStabilizer, FingerClassifier } from '../src/gesture-core/agsa.ts';
import type { HandLandmark } from '../src/gesture-core/types.ts';

function makeHand(extended: number[], thumb = false): HandLandmark[] {
  const points: HandLandmark[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.72, z: 0 }));
  points[0] = { x: 0.5, y: 0.92, z: 0 };
  points[1] = { x: 0.42, y: 0.78, z: 0 };
  points[2] = thumb ? { x: 0.34, y: 0.7, z: 0 } : { x: 0.43, y: 0.71, z: 0 };
  points[3] = thumb ? { x: 0.25, y: 0.64, z: 0 } : { x: 0.46, y: 0.68, z: 0 };
  points[4] = thumb ? { x: 0.14, y: 0.59, z: 0 } : { x: 0.48, y: 0.67, z: 0 };

  const fingers = [
    [5, 6, 7, 8, 0.41],
    [9, 10, 11, 12, 0.49],
    [13, 14, 15, 16, 0.57],
    [17, 18, 19, 20, 0.65],
  ] as const;

  fingers.forEach(([mcp, pip, dip, tip, x], index) => {
    points[mcp] = { x, y: 0.64, z: 0 };
    if (extended.includes(index)) {
      points[pip] = { x, y: 0.48, z: 0 };
      points[dip] = { x, y: 0.33, z: 0 };
      points[tip] = { x, y: 0.18, z: 0 };
    } else {
      points[pip] = { x, y: 0.53, z: 0 };
      points[dip] = { x: x + 0.04, y: 0.57, z: 0 };
      points[tip] = { x: x + 0.06, y: 0.65, z: 0 };
    }
  });
  return points;
}

const classifier = new FingerClassifier();
assert.equal(classifier.classify(makeHand([])).gesture, 'CONFIRM');
assert.equal(classifier.classify(makeHand([0])).gesture, 'SELECT_A');
assert.equal(classifier.classify(makeHand([0, 1])).gesture, 'SELECT_B');
assert.equal(classifier.classify(makeHand([0, 1, 2])).gesture, 'SELECT_C');
assert.equal(classifier.classify(makeHand([0, 1, 2, 3])).gesture, 'SELECT_D');
assert.equal(classifier.classify(makeHand([0, 1, 2, 3], true)).gesture, 'CANCEL');

const stabilizer = new AGSAStabilizer();
const firstEvents: string[] = [];
for (let now = 0; now <= 1_200; now += 40) {
  const decision = stabilizer.update('SELECT_B', 0.9, now);
  if (decision.event) firstEvents.push(decision.event);
}
assert.deepEqual(firstEvents, ['SELECT_B'], 'A held gesture must emit exactly one event.');

for (let now = 1_240; now <= 1_900; now += 40) stabilizer.update('UNKNOWN', 0, now);
const secondEvents: string[] = [];
for (let now = 1_940; now <= 3_000; now += 40) {
  const decision = stabilizer.update('SELECT_B', 0.9, now);
  if (decision.event) secondEvents.push(decision.event);
}
assert.deepEqual(secondEvents, ['SELECT_B'], 'The gesture must re-arm after release.');

stabilizer.reset();
const noisyEvents: string[] = [];
for (let now = 0; now <= 900; now += 40) {
  const noisyFrame = now === 160 || now === 520 ? 'SELECT_B' : 'SELECT_C';
  const decision = stabilizer.update(noisyFrame, noisyFrame === 'SELECT_B' ? 0.55 : 0.9, now);
  if (decision.event) noisyEvents.push(decision.event);
}
assert.deepEqual(noisyEvents, ['SELECT_C'], 'Temporal voting must reject isolated noisy frames.');

console.log('GestureCore AGSA: 9 checks passed.');

