import assert from 'node:assert/strict';
import {transferCurve,bandwidth} from '../src/ac-measurements.ts';
import type {Curve} from '../src/solver.ts';
const c:Curve={plot:'AC',names:['frequency','v(in)','v(out)'],values:[[1,[0,2],[0,1]],[10,[0,2],[0,1]]]};
const h=transferCurve(c,'v(out)','v(in)');assert.deepEqual(h.values[0][1],[.5,0]);assert.equal(bandwidth(h).crossings.length,0);
assert.throws(()=>transferCurve({...c,values:[[1,0,1]]},'v(out)','v(in)'),/нулю/);
const rc:Curve={plot:'RC',names:['frequency','v(in)','v(out)'],values:[]};
for(let i=0;i<=600;i++){const f=10**(-3+i/100),x=f;rc.values.push([f,[1,0],[1/(1+x*x),-x/(1+x*x)]]);}
const r=transferCurve(rc,'v(out)','v(in)'),b=bandwidth(r);assert.equal(b.crossings.length,1);assert.ok(Math.abs(b.crossings[0]-1)<.001);
const mid=r.values[300][1] as [number,number];assert.ok(Math.abs(Math.atan2(mid[1],mid[0])*180/Math.PI+45)<1e-10);
const tiny=transferCurve({...c,values:[[1,[1e-200,0],[2e-200,0]]]},'v(out)','v(in)');assert.deepEqual(tiny.values[0][1],[2,0]);
assert.throws(()=>bandwidth({...h,values:[h.values[1],h.values[0]]}),/возрастающие/);
console.log('AC transfer: divider, complex phase, RC cutoff, zero input, tiny signals and invalid sweep passed');
