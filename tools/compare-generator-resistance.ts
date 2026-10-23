import fs from 'node:fs';
import {decode,components} from '../src/codec.ts';
import {prepareJobs} from '../src/solver.ts';
import {runJob} from '../tests/ngspice-runner.ts';
const doc=decode(fs.readFileSync('reports/oracle-cases/RC_native_sine.TSC'));
const c=components(doc).find(c=>c.kind==='VG')!;
for(const r of [0,50]){
 const {jobs,mapping}=prepareJobs(doc,{kind:'transient',waveform:'native',stop:.025,step:1e-6});
 const source=mapping.names[c.label],positive=mapping.nodes[c.label][0];
 const add=(text:string)=>text.replace(new RegExp('^'+source+' '+positive+' ','m'),source+' vg_internal ').replace(/^\.options /m,`R_vg_internal vg_internal ${positive} ${r}\n.options `);
 if(r){jobs[0].netlist=add(jobs[0].netlist);if(jobs[0].initialBias)jobs[0].initialBias.netlist=add(jobs[0].initialBias.netlist);}
 const curve=await runJob(jobs[0]),out=curve.names.indexOf(`v(${mapping.nodes.Vout[0]})`);
 let selected=false,max=0,i=0;
 for(const line of fs.readFileSync('reports/oracle-cases/VG_resistance50_native_transient.txt','latin1').split(/\r?\n/)){
  if(line.startsWith('*')){selected=line.includes('Vout');continue;}if(!selected||!line.trim())continue;
  const [t,v]=line.trim().split(/\s+/).map(x=>Number(x.replace(',','.')));
  while(i+1<curve.values.length&&Number(curve.values[i+1][0])<t)i++;
  const a=curve.values[i],b=curve.values[Math.min(i+1,curve.values.length-1)],t0=Number(a[0]),t1=Number(b[0]);
  const predicted=Number(a[out])+(t1===t0?0:(t-t0)/(t1-t0))*(Number(b[out])-Number(a[out]));
  max=Math.max(max,Math.abs(predicted-v));
 }
 console.log({resistance:r,maxError:max});
}
