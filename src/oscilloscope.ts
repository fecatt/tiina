export type Curve = import("./solver.ts").Curve;

export interface ScopeOptions {
  channels: string[];
  timePerDivision: number;
  divisions?: number;
  mode: 'auto' | 'normal';
  triggerSource: string;
  triggerLevel: number;
  slope: 'rising' | 'falling';
  triggerAfter?: number;
  pretrigger?: number;
}

export interface ScopeResult {
  start: number;
  stop: number;
  triggerTime: number | null;
  channels: { name: string; points: [number, number][] }[];
}

export function scopeWindow(curve: Curve, options: ScopeOptions): ScopeResult {
  if(!['auto','normal'].includes(options.mode)||!['rising','falling'].includes(options.slope)||!Number.isFinite(options.triggerLevel)||(options.triggerAfter!==undefined&&!Number.isFinite(options.triggerAfter)))throw Error('Неверные параметры синхронизации');
  const channels = options.channels;
  if (!Array.isArray(channels) || channels.length < 1 || channels.length > 2) {
    throw new Error('Необходимо указать от 1 до 2 каналов');
  }
  if (!(options.timePerDivision > 0) || !isFinite(options.timePerDivision)) {
    throw new Error('timePerDivision должно быть положительным конечным числом');
  }
  const divisions = options.divisions ?? 10;
  if (!(divisions >= 1 && divisions <= 20)) {
    throw new Error('divisions должно быть в диапазоне от 1 до 20');
  }
  const pretrigger = options.pretrigger ?? 0.2;
  if (!(pretrigger >= 0 && pretrigger <= 1)) {
    throw new Error('pretrigger должно быть в диапазоне от 0 до 1');
  }
  if (!Array.isArray(curve.names) || !Array.isArray(curve.values)) {
    throw new Error('Некорректная структура кривой');
  }
  const names = curve.names;
  const values = curve.values;
  if (values.length < 2) {
    throw new Error('Недостаточно временных отсчётов');
  }
  const n = values.length;
  for (let i = 0; i < n; i++) {
    const t = values[i][0];
    if (typeof t !== 'number' || !isFinite(t)) {
      throw new Error('Некорректный временной отсчёт');
    }
    if (i > 0 && !(t > (values[i - 1][0] as number))) {
      throw new Error('Временные отсчёты должны строго возрастать');
    }
    for (let j = 1; j < names.length; j++) {
      const v = values[i][j];
      if(typeof v !== 'number'||!Number.isFinite(v))throw Error('Нужен конечный вещественный сигнал');
    }
  }
  const idxOf = (name: string): number => {
    const i = names.indexOf(name);
    if (i < 1) throw new Error(`Канал не найден: ${name}`);
    return i;
  };
  const trigIdx = idxOf(options.triggerSource);
  for (const ch of channels) idxOf(ch);
  const getVal = (i: number, col: number): number => {
    const v = values[i][col];
    return typeof v === 'number' ? v : (v as [number, number])[0];
  };
  const timeAt = (i: number): number => values[i][0] as number;
  const t0 = timeAt(0);
  const tN = timeAt(n - 1);
  const span = options.timePerDivision * divisions;
  if (!(tN - t0 >= span)) {
    throw new Error('Запрошенный временной интервал превышает длительность записи');
  }
  const triggerAfter = options.triggerAfter ?? t0;
  let triggerTime: number | null = null;
  const rising = options.slope === 'rising';
  const level = options.triggerLevel;
  const strictlyCross = (a: number, b: number): boolean => {
    if (rising) return a < level && b >= level;
    return a > level && b <= level;
  };
  for (let i = 1; i < n; i++) {
    const ta = timeAt(i - 1);
    const tb = timeAt(i);
    if (tb <= triggerAfter) continue;
    const va = getVal(i - 1, trigIdx);
    const vb = getVal(i, trigIdx);
    if (!strictlyCross(va, vb)) continue;
    // linear interpolation
    const frac = (level - va) / (vb - va);
    const tc = ta + (tb - ta) * frac;
    if (tc >= triggerAfter) {
      triggerTime = tc;
      break;
    }
  }
  let start: number;
  if (triggerTime !== null) {
    start = triggerTime - pretrigger * span;
  } else {
    if (options.mode === 'normal') {
      throw new Error('Триггер не найден: нет пересечения уровня при заданном фронте');
    }
    start = t0;
  }
  if (start < t0) start = t0;
  if (start + span > tN) start = tN - span;
  const stop = start + span;
  const clampIndexLeft = (): number => {
    let lo = 0, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (timeAt(mid) < start) lo = mid + 1; else hi = mid;
    }
    return lo;
  };
  const leftIdx = clampIndexLeft();
  const resultChannels: { name: string; points: [number, number][] }[] = [];
  for (const chName of channels) {
    const col = idxOf(chName);
    const pts: [number, number][] = [];
    // interpolation at left boundary
    if (timeAt(leftIdx) === start) {
      pts.push([start, getVal(leftIdx, col)]);
    } else {
      const i0 = leftIdx - 1;
      const i1 = leftIdx;
      if (i0 >= 0) {
        const t0v = timeAt(i0), t1v = timeAt(i1);
        const v0 = getVal(i0, col), v1 = getVal(i1, col);
        const f = (start - t0v) / (t1v - t0v);
        pts.push([start, v0 + (v1 - v0) * f]);
      } else {
        pts.push([start, getVal(0, col)]);
      }
    }
    for (let i = Math.max(leftIdx, 1); i < n; i++) {
      const t = timeAt(i);
      if (t <= start) continue;
      if (t < stop) {
        pts.push([t, getVal(i, col)]);
      } else if (t === stop) {
        pts.push([t, getVal(i, col)]);
        break;
      } else {
        const t0v = timeAt(i - 1), t1v = timeAt(i);
        const v0 = getVal(i - 1, col), v1 = getVal(i, col);
        const f = (stop - t0v) / (t1v - t0v);
        pts.push([stop, v0 + (v1 - v0) * f]);
        break;
      }
    }
    resultChannels.push({ name: chName, points: pts });
  }
  return { start, stop, triggerTime, channels: resultChannels };
}
