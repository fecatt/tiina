import assert from 'node:assert/strict';
import {validateAnalysisPlot} from '../src/solver.ts';
import {run} from './ngspice-runner.ts';
const validDc=await run('DC transfer\nV1 in 0 DC 0\nR1 in 0 1k\n.dc V1 0 1 .1');
assert.equal(validateAnalysisPlot(validDc,'dc-family'),validDc);
const invalidDc=await run('Shorted sweep source\nV1 0 0 DC .6\n.dc V1 .5 .75 .0005');
assert.equal(invalidDc.plot,'constants');
for(const kind of ['dc','dc-family'] as const)assert.throws(()=>validateAnalysisPlot(invalidDc,kind),/вернул «constants» вместо «dc transfer characteristic»/);
console.log('DC transfer plot guard: valid sweep accepted; shorted-source constants rejected for single and family analyses');
