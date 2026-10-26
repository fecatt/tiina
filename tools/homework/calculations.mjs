import fs from 'node:fs';
import path from 'node:path';
import {decode} from '../../src/codec.ts';
import {prepareJobs} from '../../src/solver.ts';
import {runJob} from '../../tests/ngspice-runner.ts';
const parallel=(a,b)=>a*b/(a+b);
function e6up(v){let p=10**Math.floor(Math.log10(v));for(const n of [1,1.5,2.2,3.3,4.7,6.8,10])if(n*p>=v*(1-1e-12))return n*p;}
function e24(v){const p=10**Math.floor(Math.log10(v));return [1,1.1,1.2,1.3,1.5,1.6,1.8,2,2.2,2.4,2.7,3,3.3,3.6,3.9,4.3,4.7,5.1,5.6,6.2,6.8,7.5,8.2,9.1,10].map(n=>n*p).sort((a,b)=>Math.abs(a-v)-Math.abs(b-v))[0];}
export async function designFromModel(root,cfg){
 const doc=decode(fs.readFileSync(path.join(root,'Browser',cfg.model+'_output.TSC'))),mapping=prepareJobs(doc,{kind:'op'}).mapping;
 const [collector,base,emitter]=mapping.nodes.T1;
 async function point(ib,uce){const {jobs}=prepareJobs(doc,{kind:'dc-family',input:'VS1',start:uce,stop:uce+1e-6,points:2,step_source:'IS1',step_values:[-ib]});const c=await runJob(jobs[0]),r=Object.fromEntries(c.names.map((n,i)=>[n.toLowerCase(),Number(c.values[0][i])])),v=n=>n==='0'?0:r[`v(${n})`];return {ib:r['i(@q_t1[ib])'],ic:r['i(@q_t1[ic])'],ube:v(base)-v(emitter),uce:v(collector)-v(emitter)};}
 const targetIc=cfg.supply/(2*(cfg.Rk+cfg.Re)),targetUce=cfg.supply/2;
 let ib=Math.abs(cfg.ibStop)/5;for(let i=0;i<7;i++){const p=await point(ib,targetUce);ib*=targetIc/p.ic;}
 const p=await point(ib,targetUce),dib=ib*.05,du=targetUce*.05,l=await point(ib-dib,targetUce),h=await point(ib+dib,targetUce),a=await point(ib,targetUce-du),b=await point(ib,targetUce+du);
 const h11=(h.ube-l.ube)/(2*dib),h21=(h.ic-l.ic)/(2*dib),h12=(b.ube-a.ube)/(2*du),h22=(b.ic-a.ic)/(2*du),vb=p.ube+(p.ic+p.ib)*cfg.Re;
 const id=5*ib,r2a=vb/id,r1a=(cfg.supply-vb)/(id+ib),rb=4*h11,vth=vb+ib*rb,r1b=rb*cfg.supply/vth,r2b=rb*cfg.supply/(cfg.supply-vth);
 const options=[{name:'A: ID=5*IB',R1:r1a,R2:r2a},{name:'B: Rb=4*h11',R1:r1b,R2:r2b}].map(o=>({...o,Rb:parallel(o.R1,o.R2),dividerCurrent:vb/o.R2,Rin:parallel(parallel(o.R1,o.R2),h11)}));
 if(cfg.autoDesign){cfg.R1=e24(r1b);cfg.R2=e24(r2b);cfg.Ce=e6up(10/(2*Math.PI*50*cfg.Re));cfg.Cp1=e6up(10/(2*Math.PI*50*parallel(parallel(cfg.R1,cfg.R2),h11)));}
 const rin=parallel(parallel(cfg.R1,cfg.R2),h11),ku=h21*parallel(cfg.Rk,1/h22)/h11,ki=h21*rin/h11;
 const result={target:{ic_A:targetIc,uce_V:targetUce},point:p,finiteDifferences:{deltaIB_A:dib,deltaUCE_V:du},h:{h11_ohm:h11,h12,h21,h22_S:h22,rIn_ohm:h11,rOut_ohm:1/h22},dividerOptions:options,selected:{R1:cfg.R1,R2:cfg.R2,Ce:cfg.Ce,Cp1:cfg.Cp1,Rin_ohm:rin,Ku_magnitude:ku,Ki:ki,Kp:ku*ki},method:'Local central finite differences in installed catalog model; E24 resistors, E6 capacitors; target IC=E/[2(Rk+Re)].'};
 fs.writeFileSync(path.join(root,'design-calculations.json'),JSON.stringify(result,null,2));return result;
}
export async function tuneCapacitors(root,cfg){
 const doc=decode(fs.readFileSync(path.join(root,'Browser',cfg.model+'_amplifier.TSC'))),history=[];
 const nextE6=v=>e6up(v*1.01);
 for(let attempt=0;attempt<10;attempt++){
  const {jobs,mapping}=prepareJobs(doc,{kind:'ac',input:'Vin',start:50,stop:100000,points_per_decade:40});
  let net=jobs[0].netlist;for(const [label,value]of [['Ce',cfg.Ce],['Cp1',cfg.Cp1]])net=net.replace(new RegExp(`^(C_${label} \\S+ \\S+ )[^\\s]+`,'m'),(_,pre)=>pre+value);
  const c=await runJob({...jobs[0],netlist:net}),column=c.names.indexOf(`v(${mapping.nodes.Vout[0]})`),db=c.values.map(r=>{const z=r[column];return 20*Math.log10(Array.isArray(z)?Math.hypot(...z):Math.abs(z));}),peak=Math.max(...db),loss=peak-db[0];history.push({Ce_F:cfg.Ce,Cp1_F:cfg.Cp1,lossAt50Hz_dB:loss});
  if(loss<=2.5){fs.writeFileSync(path.join(root,'capacitor-tuning.json'),JSON.stringify({goal:'Lower -3dB cutoff <50Hz, with 0.5dB margin at 50Hz',history,selected:{Ce:cfg.Ce,Cp1:cfg.Cp1}},null,2));const p=path.join(root,'design-calculations.json'),d=JSON.parse(fs.readFileSync(p));d.selected.Ce=cfg.Ce;d.selected.Cp1=cfg.Cp1;d.selected.capacitorSelection='AC-verified E6 search, see capacitor-tuning.json';fs.writeFileSync(p,JSON.stringify(d,null,2));return;}
  cfg.Ce=nextE6(cfg.Ce);cfg.Cp1=nextE6(cfg.Cp1);
 }
 throw Error('Capacitor search did not meet 50Hz target');
}
