import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decode,components,encode,pins,updateComponent,newComponent} from '../src/codec.ts';
import {prepareJobs,hParameterConfig} from '../src/solver.ts';
import {nativeRectangle,nativeGenerator} from '../src/native-generator.ts';
import {run,runJob} from './ngspice-runner.ts';
const root=new URL('../reports/oracle-cases/',import.meta.url);
const read=(name:string)=>fs.readFileSync(new URL(name,root));
const doc=decode(read('BF240_forward_bias.TSC'));
const {jobs,mapping}=prepareJobs(doc,{kind:'op'}),op=await run(jobs[0].netlist);
const value=(name:string)=>Number(op.values[0][op.names.indexOf(name)]);
const native=JSON.parse(read('BF240_native_forward_values.json').toString()).native;
assert.ok(Math.abs(value('i(vam_am1)')/native.ammeter_A-1)<.001);
assert.ok(Math.abs(value(`v(${mapping.nodes.T1[1]})`)-native.base_voltage_V)<.0001);
assert.ok(Math.abs(value(`v(${mapping.nodes.VS1[0]})`)-native.supply_V)<1e-6);
console.log('Native BF240 DC display: current within 0.1%, base voltage within 0.1 mV');

const bytes=read('RC_native_configured.TSC'),rcdoc=decode(bytes),c=components(rcdoc).find(c=>c.kind==='VG')!;
assert.deepEqual(nativeRectangle(c),{offset:1,amplitude:1,frequency:100,edge:1e-10});
assert.deepEqual(Buffer.from(encode(rcdoc)),bytes);
const prepared=prepareJobs(rcdoc,{kind:'transient',waveform:'native',stop:.025,step:1e-6});
const curve=await runJob(prepared.jobs[0]),out=curve.names.indexOf(`v(${prepared.mapping.nodes.Vout[0]})`);
assert.ok(out>=0);
// Native text export repeats a *time / vector header for every trace.
let inOutput=false;const samples:[number,number][]=[];
for(const line of read('RC_native_transient.txt').toString('latin1').split(/\r?\n/)){
 if(line.startsWith('*')){inOutput=line.includes('Vout');continue;}
 if(!inOutput||!line.trim())continue;
 const values=line.trim().split(/\s+/).map(s=>Number(s.replace(',','.')));
 if(values.length===2&&values.every(Number.isFinite))samples.push(values as [number,number]);
}
assert.ok(samples.length>50);
let i=0,maxError=0,checked=0;
for(const [t,v] of samples){
 while(i+1<curve.values.length&&Number(curve.values[i+1][0])<t)i++;
 const a=curve.values[i],b=curve.values[Math.min(i+1,curve.values.length-1)];
 const t0=Number(a[0]),t1=Number(b[0]),fraction=t1===t0?0:(t-t0)/(t1-t0);
 const interpolated=Number(a[out])+fraction*(Number(b[out])-Number(a[out]));
 maxError=Math.max(maxError,Math.abs(interpolated-v));checked++;
}
console.log(`Native RC transient: ${checked} points, maximum voltage difference ${maxError} V`);
assert.ok(maxError<.04,'Native adaptive integration and ngspice differ by more than 40 mV');

// Reloaded .TSC is the oracle: the first live run after editing phase differs
// from the saved/reopened file in this TINA build. Keep both traces as evidence.
for(const [file,trace,phase,resistance] of [['RC_native_sine.TSC','RC_native_sine_reloaded_transient.txt',30,0],['RC_sine_phase_probe.TSC','RC_sine_phase_probe_transient.txt',90,0],['VG_resistance50_aligned_probe.TSC','VG_resistance50_native_transient.txt',30,50]] as const){
 const d=decode(read(file)),g=components(d).find(c=>c.kind==='VG')!;
 assert.deepEqual(nativeGenerator(g),{waveform:'sine',offset:1,amplitude:2,frequency:200,phase,...(resistance?{resistance}:{})});
 const job=prepareJobs(d,{kind:'transient',waveform:'native',stop:.025,step:1e-6});
 const cr=await runJob(job.jobs[0]);
 // TINA's excitation trace shows the ideal waveform, before internal resistance.
 const indexes={Vin:cr.names.indexOf(`v(${resistance?'vg_internal_'+g.index:job.mapping.nodes.Vin[0]})`),Vout:cr.names.indexOf(`v(${job.mapping.nodes.Vout[0]})`)};
 let vector='',error={Vin:0,Vout:0},count=0,j=0;
 for(const line of read(trace).toString('latin1').split(/\r?\n/)){
  if(line.startsWith('*')){vector=line.includes('Vout')?'Vout':'Vin';j=0;continue;}
  if(!line.trim())continue;
  const [t,v]=line.trim().split(/\s+/).map(s=>Number(s.replace(',','.')));assert.ok(Number.isFinite(t)&&Number.isFinite(v));
  while(j+1<cr.values.length&&Number(cr.values[j+1][0])<t)j++;
  const a=cr.values[j],b=cr.values[Math.min(j+1,cr.values.length-1)],t0=Number(a[0]),t1=Number(b[0]),k=indexes[vector as keyof typeof indexes];
  const interpolated=Number(a[k])+(t1===t0?0:(t-t0)/(t1-t0))*(Number(b[k])-Number(a[k]));
  const key=vector as keyof typeof error;error[key]=Math.max(error[key],Math.abs(v-interpolated));count++;
 }
 // Also bound our own integration error independently of TINA's coarser steps.
 const w=2*Math.PI*200,tau=(1000+resistance)*1e-6,lag=Math.atan(w*tau),gain=2/Math.sqrt(1+(w*tau)**2),angle=phase*Math.PI/180;
 for(const row of cr.values){const t=Number(row[0]),expected=1+gain*Math.sin(w*t+angle-lag)-gain*Math.sin(angle-lag)*Math.exp(-t/tau);assert.ok(Math.abs(Number(row[indexes.Vout])-expected)<1e-5);}
 assert.ok(count>300);assert.ok(error.Vin<1e-5,`Native sine excitation differs: ${error.Vin}`);assert.ok(error.Vout<.05,`Native sine response differs: ${error.Vout}`);
 console.log(`Native reloaded sine ${phase}°, Rinternal=${resistance}: ${count} input/output points, errors ${JSON.stringify(error)}`);
}

// Exercise the actual native-order source convention for the lab h-parameter grid.
const hSettings={uCE:5,iB:10e-6,deltaIB:1e-6,deltaUCE:.1};
const hConfig=hParameterConfig(doc,hSettings);hConfig.step_values!.forEach((v,i)=>assert.ok(Math.abs(v-[-9e-6,-10e-6,-11e-6][i])<1e-18));
const hJobs=prepareJobs(doc,hConfig).jobs;
const hCurves=await Promise.all(hJobs.map(j=>run(j.netlist)));
const icIndex=hCurves[0].names.indexOf('i(@q_t1[ic])');
assert.ok(Number(hCurves[0].values[1][icIndex])<Number(hCurves[1].values[1][icIndex]));
assert.ok(Number(hCurves[1].values[1][icIndex])<Number(hCurves[2].values[1][icIndex]));
// Reverse the same current source geometrically; the generated step signs must reverse.
const reversed=decode(encode(doc)),base=components(reversed).find(c=>c.label==='IS1')!,end=pins(base)[1];
updateComponent(reversed,base.index,{x:end[0],y:end[1],orientation:(base.orientation+2)%4});
const reversedConfig=hParameterConfig(reversed,hSettings);
reversedConfig.step_values!.forEach((v,i)=>assert.ok(Math.abs(v-[9e-6,10e-6,11e-6][i])<1e-18));
const reverseCurve=await run(prepareJobs(reversed,reversedConfig).jobs[1].netlist);
assert.ok(Math.abs(Number(reverseCurve.values[1][reverseCurve.names.indexOf('i(@q_t1[ic])')])-Number(hCurves[1].values[1][icIndex]))<1e-10);
const floating=decode(read('BF240_explicit_vertex.TSC'));
assert.throws(()=>hParameterConfig(floating,hSettings),/подключения/);
// An unrelated ammeter must not make a disconnected supply appear valid.
const disconnected=decode(encode(doc)),meter=components(disconnected).find(c=>c.label==='AM1')!;
updateComponent(disconnected,meter.index,{x:meter.x+100});
disconnected.records.splice(-1,0,newComponent('AM',900,900,'stray'));
assert.throws(()=>hParameterConfig(disconnected,hSettings),/подключения|коллектор/);
console.log('H-parameter grid: native source sign, reversed-source equivalence and disconnected supply rejection passed');
