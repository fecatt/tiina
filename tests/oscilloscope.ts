import assert from 'node:assert';
import { test } from 'node:test';
import { scopeWindow } from '../src/oscilloscope.ts';
import type { Curve } from '../src/solver.ts';

function makeCurve(times: number[], data: { [name: string]: number[] }): Curve {
  const names = Object.keys(data);
  const values = times.map((t, i) => {
    const row: (number | [number, number])[] = [t];
    for (const nm of names) row.push(data[nm][i]);
    return row;
  });
  return { names:['time',...names], values, plot: 'test' };
}

test('rising trigger interpolation on irregular grid', () => {
  const c = makeCurve([0, 0.3, 0.55, 0.9, 1.4], { A: [0, 0.2, 0.6, 0.3, 0.1] });
  const r = scopeWindow(c, {
    channels: ['A'], timePerDivision: 0.1, divisions: 10,
    mode: 'normal', triggerSource: 'A', triggerLevel: 0.4, slope: 'rising',
  });
  assert.ok(r.triggerTime !== null);
  const expected = 0.3 + (0.55 - 0.3) * ((0.4 - 0.2) / (0.6 - 0.2));
  assert.ok(Math.abs(r.triggerTime! - expected) < 1e-12);
});

test('falling trigger interpolation on irregular grid', () => {
  const c = makeCurve([0, 0.2, 0.47, 0.8, 1.1], { A: [1.0, 0.9, 0.4, 0.1, 0.0] });
  const r = scopeWindow(c, {
    channels: ['A'], timePerDivision: 0.05, divisions: 10,
    mode: 'normal', triggerSource: 'A', triggerLevel: 0.5, slope: 'falling',
  });
  assert.ok(r.triggerTime !== null);
  const expected = 0.2 + (0.47 - 0.2) * ((0.9 - 0.5) / (0.9 - 0.4));
  assert.ok(Math.abs(r.triggerTime! - expected) < 1e-12);
});

test('normal mode throws when no trigger found', () => {
  const c = makeCurve([0, 0.2, 0.4, 0.6, 0.8, 1.0], { A: [0.1, 0.2, 0.15, 0.1, 0.2, 0.1] });
  assert.throws(() => scopeWindow(c, {
    channels: ['A'], timePerDivision: 0.05, divisions: 10,
    mode: 'normal', triggerSource: 'A', triggerLevel: 0.5, slope: 'rising',
  }), /Триггер не найден/);
});

test('auto mode with no trigger starts at first sample (respecting pretrigger clamp)', () => {
  const times = [0.1, 0.3, 0.5, 0.7, 0.9, 1.1];
  const c = makeCurve(times, { A: [0, 0, 0, 0, 0, 0] });
  const r = scopeWindow(c, {
    channels: ['A'], timePerDivision: 0.05, divisions: 10,
    mode: 'auto', triggerSource: 'A', triggerLevel: 0.5, slope: 'rising',
  });
  assert.equal(r.triggerTime, null);
  assert.equal(r.start, 0.1);
  assert.ok(Math.abs(r.stop - 0.6) < 1e-12);
});

test('pretrigger places start before trigger and clamps to domain', () => {
  const times = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  const A = times.map(t => t);
  const c = makeCurve(times, { A });
  const r = scopeWindow(c, {
    channels: ['A'], timePerDivision: 0.05, divisions: 10,
    mode: 'normal', triggerSource: 'A', triggerLevel: 0.5, slope: 'rising',
    pretrigger: 0.4,
  });
  assert.ok(r.triggerTime !== null);
  const span = 0.5;
  const expectedStart = Math.max(0, r.triggerTime! - 0.4 * span);
  assert.ok(Math.abs(r.start - expectedStart) < 1e-12);
  assert.ok(Math.abs(r.stop - r.start - span) < 1e-12);
  assert.equal(r.triggerTime, 0.5);
});

test('boundary inclusion with interpolation on irregular data', () => {
  const times = [0, 0.13, 0.42, 0.61, 0.77, 1.05];
  const A = [0, 1, 2, 3, 4, 5];
  const c = makeCurve(times, { A });
  const r = scopeWindow(c, {
    channels: ['A'], timePerDivision: 0.04, divisions: 10,
    mode: 'auto', triggerSource: 'A', triggerLevel: 100, slope: 'rising',
  });
  const pts = r.channels[0].points;
  assert.equal(pts[0][0], r.start);
  assert.equal(pts[pts.length - 1][0], r.stop);
  // interpolated left boundary should lie between samples containing start
  assert.ok(pts[0][1] >= 0 && pts[0][1] <= 1 + 1e-9);
});

test('two channels are returned with identical time window boundaries', () => {
  const times = [0, 0.1, 0.25, 0.4, 0.6, 0.85, 1.0];
  const A = [0, 0.5, 1.0, 0.5, 0, -0.5, -1.0];
  const B = [1, 0.8, 0.4, 0.1, -0.2, -0.6, -1.2];
  const c = makeCurve(times, { A, B });
  const r = scopeWindow(c, {
    channels: ['A', 'B'], timePerDivision: 0.05, divisions: 10,
    mode: 'normal', triggerSource: 'A', triggerLevel: 0.4, slope: 'rising',
  });
  assert.equal(r.channels.length, 2);
  assert.equal(r.channels[0].name, 'A');
  assert.equal(r.channels[1].name, 'B');
  assert.equal(r.channels[0].points[0][0], r.start);
  assert.equal(r.channels[1].points[0][0], r.start);
  assert.equal(r.channels[0].points[r.channels[0].points.length - 1][0], r.stop);
  assert.equal(r.channels[1].points[r.channels[1].points.length - 1][0], r.stop);
});

test('invalid settings are rejected', () => {
  const c = makeCurve([0, 0.1, 0.2, 0.3, 0.4, 0.5], { A: [0, 1, 2, 3, 4, 5] });
  assert.throws(() => scopeWindow(c, {
    channels: [], timePerDivision: 0.1, mode: 'auto', triggerSource: 'A', triggerLevel: 0, slope: 'rising',
  }));
  assert.throws(() => scopeWindow(c, {
    channels: ['A', 'A', 'A'] as unknown as string[], timePerDivision: 0.1, mode: 'auto', triggerSource: 'A', triggerLevel: 0, slope: 'rising',
  }));
  assert.throws(() => scopeWindow(c, {
    channels: ['A'], timePerDivision: 0, mode: 'auto', triggerSource: 'A', triggerLevel: 0, slope: 'rising',
  }));
  assert.throws(() => scopeWindow(c, {
    channels: ['A'], timePerDivision: 0.1, divisions: 25, mode: 'auto', triggerSource: 'A', triggerLevel: 0, slope: 'rising',
  }));
  assert.throws(() => scopeWindow(c, {
    channels: ['A'], timePerDivision: 0.1, pretrigger: 1.5, mode: 'auto', triggerSource: 'A', triggerLevel: 0, slope: 'rising',
  }));
});

test('non-monotonic time is rejected', () => {
  const c = makeCurve([0, 0.2, 0.1, 0.3], { A: [0, 1, 2, 3] });
  assert.throws(() => scopeWindow(c, {
    channels: ['A'], timePerDivision: 0.05, mode: 'auto', triggerSource: 'A', triggerLevel: 0, slope: 'rising',
  }), /возрастать/);
});

test('span exceeding record is rejected', () => {
  const c = makeCurve([0, 0.05, 0.1, 0.15], { A: [0, 1, 2, 3] });
  assert.throws(() => scopeWindow(c, {
    channels: ['A'], timePerDivision: 0.1, divisions: 10, mode: 'auto', triggerSource: 'A', triggerLevel: 100, slope: 'rising',
  }), /интервал превышает/);
});

test('flat equality does not count as strict crossing', () => {
  const c = makeCurve([0, 0.1, 0.2, 0.3, 0.4, 0.5], { A: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5] });
  assert.throws(() => scopeWindow(c, {
    channels: ['A'], timePerDivision: 0.02, divisions: 10,
    mode: 'normal', triggerSource: 'A', triggerLevel: 0.5, slope: 'rising',
  }), /Триггер не найден/);
});
