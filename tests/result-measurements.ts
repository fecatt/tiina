import assert from 'node:assert/strict';
import { transientStats, resultCsv } from '../src/result-measurements.ts';
import { transferCurve } from '../src/ac-measurements.ts';
import type { Curve } from '../src/solver.ts';

const makeCurve = (
  names: string[],
  values: unknown[][],
  parameter?: number,
  plot = 'test',
): Curve => ({ plot, names, values, parameter } as unknown as Curve);

const assertNear = (actual: number, expected: number, epsilon = 1e-12, message?: string) => {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    message ?? `Expected ${actual} to be within ${epsilon} of ${expected}`,
  );
};

const constant = makeCurve(
  ['time', 'v'],
  [
    [0, 5],
    [1, 5],
    [3, 5],
    [4, 5],
  ],
);

const constantStats = transientStats(constant, 'v', 0.5, 3.5);
assert.equal(constantStats.start, 0.5);
assert.equal(constantStats.stop, 3.5);
assert.equal(constantStats.min, 5);
assert.equal(constantStats.max, 5);
assert.equal(constantStats.peakToPeak, 0);
assertNear(constantStats.mean, 5);
assertNear(constantStats.rms, 5);

const ramp = makeCurve(
  ['time', 'v'],
  [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
  ],
);

const rampStats = transientStats(ramp, 'v', 0, 3);
assertNear(rampStats.mean, 1.5);
assertNear(rampStats.rms, Math.sqrt(3));
assert.equal(rampStats.min, 0);
assert.equal(rampStats.max, 3);
assert.equal(rampStats.peakToPeak, 3);

const interpolated = makeCurve(
  ['time', 'v'],
  [
    [0, 0],
    [10, 20],
  ],
);

const interpolationStats = transientStats(interpolated, 'v', 2, 8);
assertNear(interpolationStats.mean, 10);
assertNear(interpolationStats.rms, Math.sqrt(112));
assert.equal(interpolationStats.min, 4);
assert.equal(interpolationStats.max, 16);
assert.equal(interpolationStats.peakToPeak, 12);

assert.throws(
  () => transientStats(ramp, 'v', 1, 1),
  /Неверный вектор или интервал измерения/,
);
assert.throws(
  () => transientStats(ramp, 'missing', 0, 2),
  /Неверный вектор или интервал измерения/,
);
assert.throws(
  () => transientStats(ramp, 'v', -1, 2),
  /Интервал должен находиться внутри возрастающей временной развёртки/,
);
assert.throws(
  () => transientStats(ramp, 'v', 0, 4),
  /Интервал должен находиться внутри возрастающей временной развёртки/,
);

const nonMonotonic = makeCurve(
  ['time', 'v'],
  [
    [0, 0],
    [2, 2],
    [1, 1],
  ],
);
assert.throws(
  () => transientStats(nonMonotonic, 'v', 0, 2),
  /Интервал должен находиться внутри возрастающей временной развёртки/,
);

const complexTransient = makeCurve(
  ['time', 'v'],
  [
    [0, 0],
    [1, [1, 2]],
    [2, 3],
  ],
);
assert.throws(
  () => transientStats(complexTransient, 'v', 0, 2),
  /Нужен вещественный переходный сигнал/,
);

const mixedCsvCurve = makeCurve(
  ['time', 'v', 'i'],
  [
    [0, 10, 5],
    [1, 20, [3, 4]],
  ],
  1,
);

const csv = resultCsv([mixedCsvCurve]);
const expectedCsv =
  '\ufeff' +
  [
    '"Параметр";"time";"v";"i Re";"i Im"',
    '1;0;10;5;0',
    '1;1;20;3;4',
  ].join('\r\n');

assert.equal(csv, expectedCsv);

const capacitance = 1e-6;
const frequencies = [100, 1000, 5000];
const capacitorCurve = makeCurve(
  ['f', 'V', 'I'],
  frequencies.map((f) => {
    const omega = 2 * Math.PI * f;
    return [f, [1, 0], [0, omega * capacitance]];
  }),
);

const impedance = transferCurve(capacitorCurve, 'V', 'I', 'Z');
assert.equal(impedance.names[0], 'f');
assert.equal(impedance.names[1], 'Z(V/I)');

for (let i = 0; i < frequencies.length; i += 1) {
  const f = frequencies[i];
  const omega = 2 * Math.PI * f;
  const [re, im] = impedance.values[i][1] as [number, number];
  const expectedImaginary = -1 / (omega * capacitance);

  assertNear(re, 0, 1e-12);
  assertNear(im, expectedImaginary, Math.abs(expectedImaginary) * 1e-12);
  assertNear(Math.atan2(im, re), -Math.PI / 2, 1e-12);
  assertNear(Math.hypot(re, im), 1 / (omega * capacitance), 1e-12);
}
console.log('DeepSeek tests reviewed: time-weighted RMS, interval interpolation, CSV complex alignment, capacitor impedance passed');
