import assert from 'node:assert/strict';
import {parseRaw,transientWaveform} from '../src/solver.ts';
import {transferCurve,bandwidth} from '../src/ac-measurements.ts';
import {run} from './ngspice-runner.ts';
const rc=await run('RC lowpass\nV1 in 0 AC 1\nR1 in out 1000\nC1 out 0 1u\n.ac dec 100 0.1 100000');
const h=transferCurve(rc,'v(out)','v(in)'),cut=bandwidth(h).crossings;
assert.equal(cut.length,1);assert.ok(Math.abs(cut[0]/(1/(2*Math.PI*.001))-1)<.001);
for(const row of h.values){const f=(row[0] as number[])[0]??row[0] as number,x=2*Math.PI*Number(f)*.001;const z=row[1] as number[];assert.ok(Math.abs(z[0]-1/(1+x*x))<1e-6);assert.ok(Math.abs(z[1]+x/(1+x*x))<1e-6);}
const wave=transientWaveform({kind:'transient',waveform:'pulse',amplitude:1,offset:1,frequency:100,delay:.001,rise:1e-6,fall:1e-6},0);
const tran=await run(`RC step\nV1 in 0 ${wave}\nR1 in out 1000\nC1 out 0 1u\n.options reltol=1e-6\n.tran 1u 4m 0 1u`);
const ti=tran.names.indexOf('time'),vi=tran.names.indexOf('v(out)');let checked=0;
for(const row of tran.values){const t=Number(row[ti]);if(t<.0011||t>.0039)continue;const expected=2*(1-Math.exp(-(t-.0010005)/.001));assert.ok(Math.abs(Number(row[vi])-expected)<.003);checked++;}
assert.ok(checked>100);console.log(`ngspice WASM: RC AC cutoff ${cut[0]} Hz and ${checked} RC transient points match analytic formulas`);
const discharge=await run('RC discharge\nR1 out 0 1000\nC1 out 0 1u IC=2\n.options reltol=1e-6\n.tran 1u 5m 0 1u uic');
const dv=discharge.names.indexOf('v(out)');
for(const row of discharge.values){assert.ok(Math.abs(Number(row[dv])-2*Math.exp(-Number(row[0])/.001))<.001);}
console.log('ngspice WASM: capacitor UIC discharge matches 2 exp(-t/RC)');
const zcap=await run('Capacitor impedance\nI1 0 out AC 1\nC1 out 0 1u\n.ac dec 10 10 10000');
const zi=zcap.names.indexOf('v(out)');
for(const row of zcap.values){const f=Array.isArray(row[0])?row[0][0]:row[0],z=row[zi] as [number,number];assert.ok(Math.abs(z[0])<1e-6);assert.ok(Math.abs(z[1]*2*Math.PI*f*1e-6+1)<1e-6);}
console.log('ngspice WASM: capacitor impedance modulus and -90 degree phase verified');
