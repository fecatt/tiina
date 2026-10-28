import createNgspice from '@o.z/ngspice-wasm';
import {parseRaw,resolveInitialBias,validateAnalysisPlot,type Job,type Curve,type SimulationConfig} from './solver.ts';

self.onmessage=async(e:MessageEvent<{jobs:Job[];config:SimulationConfig}>)=>{
  const logs:string[]=[],curves:Curve[]=[],netlists:string[]=[];
  try {
   const execute=async(netlist:string):Promise<Curve>=>{
    const mod=await createNgspice({noInitialRun:true,print:(s:string)=>logs.push(s),printErr:(s:string)=>logs.push(s)});
    // Emscripten MEMFS has no host /proc. Ngspice requires a memory budget there.
    mod.FS.writeFile('/proc/meminfo','MemTotal:       4194304 kB\nMemFree:        2097152 kB\nMemAvailable:   2097152 kB\n');
    mod.FS.writeFile('/spinit','');mod.ENV.SPICE_SCRIPTS='/';mod.FS.writeFile('/circuit.cir',netlist);
    const args=['ngspice','-b','/circuit.cir'];
    const argv=mod.stackAlloc((args.length+1)*4);
    args.forEach((arg,n)=>{const bytes=new TextEncoder().encode(arg+'\0'),ptr=mod.stackAlloc(bytes.length);mod.HEAPU8.set(bytes,ptr);mod.HEAPU32[(argv>>2)+n]=ptr;});mod.HEAPU32[(argv>>2)+args.length]=0;
    try{mod._main(args.length,argv);}catch(error){const ex=error as {status?:number};if(ex.status!==0)throw new Error('ngspice не завершил расчёт.\n'+logs.slice(-15).join('\n'));}
    let raw:string;try{raw=mod.FS.readFile('/result.raw',{encoding:'utf8'});}catch{throw new Error('Движок не создал результат.\n'+logs.slice(-15).join('\n'));}
    return parseRaw(raw);
   };
   for(let i=0;i<e.data.jobs.length;i++){
    const job=e.data.jobs[i];logs.push(`--- Расчёт ${i+1} ---`);
    const netlist=await resolveInitialBias(job,execute);
    netlists.push(netlist);
    curves.push({...validateAnalysisPlot(await execute(netlist),e.data.config.kind),parameter:job.parameter});self.postMessage({type:'progress',done:i+1});
  }self.postMessage({type:'result',result:{curves,log:logs.join('\n'),netlist:netlists.join('\n')}});
  }catch(error){self.postMessage({type:'error',error:error instanceof Error?error.message:String(error)});}
};
