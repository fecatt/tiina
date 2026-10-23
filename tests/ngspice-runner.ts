import create from '@o.z/ngspice-wasm';
import {parseRaw,resolveInitialBias,type Job} from '../src/solver.ts';
export async function runJob(job:Job){return run(await resolveInitialBias(job,run));}
export async function run(circuit:string){
 const logs:string[]=[];const m=await create({noInitialRun:true,print:(s:string)=>logs.push(s),printErr:(s:string)=>logs.push(s)});
 m.FS.writeFile('/proc/meminfo','MemTotal: 4194304 kB\nMemFree: 2097152 kB\nMemAvailable: 2097152 kB\n');
 m.FS.writeFile('/spinit','');m.ENV.SPICE_SCRIPTS='/';
 m.FS.writeFile('/test.cir',circuit+'\n.control\nset filetype=ascii\nrun\nwrite /result.raw all\nquit\n.endc\n.end\n');
 const args=['ngspice','-b','/test.cir'],argv=m.stackAlloc(16);
 args.forEach((s,i)=>{const b=new TextEncoder().encode(s+'\0'),p=m.stackAlloc(b.length);m.HEAPU8.set(b,p);m.HEAPU32[(argv>>2)+i]=p;});m.HEAPU32[(argv>>2)+3]=0;
 try{m._main(3,argv);}catch(e){if((e as {status:number}).status!==0)throw e;}
 try{return parseRaw(m.FS.readFile('/result.raw',{encoding:'utf8'}));}catch(e){throw Error(logs.join('\n')+'\n'+e);}
}
