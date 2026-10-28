import {exportSpice, components, type Doc} from './codec.ts';
import {nativeGeneratorWaveform} from './native-generator.ts';

export type Cell = number | [number,number];
export interface Curve {parameter?:number; names:string[]; values:Cell[][]; plot:string}
export interface SimulationConfig {kind:'op'|'dc'|'dc-family'|'ac'|'transient';input?:string;start?:number;stop?:number;points?:number;points_per_decade?:number;ac_intervals?:number;ac_logarithmic?:boolean;ac_display?:'magnitude'|'phase'|'both';step_source?:string;step_values?:number[];amplitude?:number;frequency?:number;step?:number;waveform?:'sine'|'pulse'|'triangle'|'native';offset?:number;delay?:number;duty?:number;rise?:number;fall?:number;initial_conditions?:Record<string,number>;startup?:'op'|'uic'}
export interface SimulationResult {curves:Curve[];log:string;netlist:string;mapping:ReturnType<typeof exportSpice>['mapping'];engine:string}
export interface Job {netlist:string;parameter?:number;initialBias?:{netlist:string;nodes:string[]}}

const expectedPlot:Record<SimulationConfig['kind'],string>={op:'operating point',dc:'dc transfer characteristic','dc-family':'dc transfer characteristic',ac:'ac analysis',transient:'transient analysis'};
/** Reject ngspice's constants plot (and other unsupported plots) rather than presenting it as a successful requested analysis. */
export function validateAnalysisPlot(curve:Curve,kind:SimulationConfig['kind']):Curve {
 const expected=expectedPlot[kind];
 if(curve.plot.trim().toLowerCase()!==expected)throw new Error(`Расчёт ${kind} не выполнен: движок вернул «${curve.plot}» вместо «${expected}». Проверьте схему и подключения источников.`);
 return curve;
}

const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
function requireNumber(n:unknown,label:string):number {if(!finite(n))throw new Error('Неверное значение: '+label);return n;}
function setSource(lines:string[],name:string,value:number) {let found=false;const out=lines.map(l=>{const t=l.trim().split(/\s+/);if(t[0]!==name)return l;if(!/^[VI]/i.test(name)||t[3]?.toUpperCase()!=='DC')throw new Error('Нужен независимый источник постоянного тока или напряжения');found=true;return `${t.slice(0,3).join(' ')} DC ${value}`});if(!found)throw new Error('Источник не найден');return out;}
function setParameter(lines:string[],name:string,kind:string,value:number){
 if(!['R','C','L'].includes(kind))return setSource(lines,name,value);
 if(value<=0)throw Error('Номинал R, C, L должен быть положительным');let found=false;
 const out=lines.map(line=>{const t=line.trim().split(/\s+/);if(t[0]!==name)return line;found=true;t[3]=String(value);return t.join(' ');});if(!found)throw Error('Объект управления не найден');return out;
}

/** Source waveform shared by voltage and current generators. Values use SI units. */
export function transientWaveform(config:SimulationConfig,defaultOffset:number):string {
 const amplitude=requireNumber(config.amplitude,'амплитуда'),frequency=requireNumber(config.frequency,'частота');
 const offset=requireNumber(config.offset??defaultOffset,'смещение'),delay=requireNumber(config.delay??0,'задержка');
 if(amplitude<0||frequency<=0||delay<0)throw new Error('Неверные параметры генератора');
 const waveform=config.waveform??'sine',period=1/frequency;
 if(waveform==='sine')return `SIN(${offset} ${amplitude} ${frequency} ${delay})`;
 if(waveform==='triangle')return `PULSE(${offset-amplitude} ${offset+amplitude} ${delay} ${period/2} ${period/2} 0 ${period})`;
 if(waveform!=='pulse')throw new Error('Неизвестная форма сигнала');
 const duty=requireNumber(config.duty??50,'заполнение'),rise=requireNumber(config.rise??period*.001,'фронт'),fall=requireNumber(config.fall??period*.001,'спад');
 if(duty<=0||duty>=100||rise<=0||fall<=0||rise+fall>=period||period*duty/100<=rise||period*duty/100+fall>=period)throw new Error('Импульс: заполнение 0–100%, положительные фронт и спад должны помещаться в период');
 return `PULSE(${offset-amplitude} ${offset+amplitude} ${delay} ${rise} ${fall} ${period*duty/100-rise} ${period})`;
}

export function prepareJobs(doc:Doc,config:SimulationConfig):{jobs:Job[];mapping:SimulationResult['mapping']} {
  const exported=exportSpice(doc),mapping=exported.mapping;
  const base=exported.text.split(/\r?\n/).filter(l=>!/^\s*\.(op|end)\s*$/i.test(l));
  const source=(label?:string)=>{const c=components(doc).find(c=>c.label===label),name=label&&mapping.names[label];if(!name||!c||!['V','VS','VG','I','IS'].includes(c.kind))throw new Error('Выберите независимый источник');return name;};
  const kind=config.kind;
  let command='.op',excitation:string|undefined;
  if(kind==='dc'||kind==='dc-family') {const a=requireNumber(config.start,'начало'),b=requireNumber(config.stop,'конец'),n=requireNumber(config.points,'число точек');if(!Number.isInteger(n)||n<2||n>100000||b<=a)throw new Error('Развёртка: от 2 до 100000 точек, конец больше начала');const step=(b-a)/(n-1);command=`.dc ${source(config.input)} ${a} ${b+Math.abs(step)*1e-6} ${step}`;}
  else if(kind==='ac') {const a=requireNumber(config.start,'начальная частота'),b=requireNumber(config.stop,'конечная частота'),n=config.points_per_decade??50;if(!(a>0&&b>a&&Number.isInteger(n)&&n>=1&&n<=1000)||Math.log10(b/a)*n>100000)throw new Error('Неверный диапазон частот');if(config.ac_intervals!==undefined){const total=config.ac_intervals;if(!Number.isInteger(total)||total<1||total>65535)throw new Error('Неверное число позиций');if(config.ac_logarithmic===false)command=`.ac lin ${total+1} ${a} ${b}`;else{const perDecade=total/Math.log10(b/a),exact=Math.abs(perDecade-Math.round(perDecade))<1e-9;command=`.ac dec ${exact?Math.round(perDecade):Math.ceil(perDecade)*4} ${a} ${b*(1+1e-12)}`;}}else command=`.ac dec ${n} ${a} ${b}`;excitation=source(config.input);}
  else if(kind==='transient') {const a=config.waveform==='native'?0:requireNumber(config.amplitude,'амплитуда'),f=config.waveform==='native'?1:requireNumber(config.frequency,'частота'),stop=requireNumber(config.stop,'время'),step=requireNumber(config.step,'шаг');if((config.start!==undefined&&(!finite(config.start)||config.start<0||config.start>=stop))||a<0||f<=0||step<=0||step>stop||stop/step>100000)throw new Error('Неверные параметры переходного процесса');if(config.startup!==undefined&&!['op','uic'].includes(config.startup))throw Error('Неизвестный режим запуска');command=`.tran ${step} ${stop} ${config.start??0} ${step}${config.startup==='uic'?' uic':''}`;excitation=config.waveform==='native'?undefined:source(config.input);}
  else if(kind!=='op')throw new Error('Неизвестный вид анализа');
  const vals=kind==='dc-family'?config.step_values:[undefined];
  if(!vals?.length||vals.length>100||vals.some(v=>v!==undefined&&!finite(v)))throw new Error('Семейство: от 1 до 100 конечных значений');
  if(kind==='dc-family'&&(config.input===config.step_source||(config.points??0)*vals.length>500000))throw new Error('Для семейства нужны разные источники; максимум 500000 точек во всех кривых');
  const jobs=vals.map(parameter=>{let lines=[...base];if(parameter!==undefined){const c=components(doc).find(c=>c.label===config.step_source),name=c&&mapping.names[c.label];if(!c||!name||!['V','VS','VG','I','IS','R','C','L'].includes(c.kind))throw Error('Выберите поддерживаемый объект управления');lines=setParameter(lines,name,c.kind,parameter);}
    if(kind==='transient'&&config.waveform==='native'){
      const generators=components(doc).filter(c=>c.kind==='VG');if(!generators.length)throw Error('В схеме нет генераторов TSC');
      for(const c of generators){const wave=nativeGeneratorWaveform(c,config.stop!);lines=lines.map(l=>l.trim().split(/\s+/)[0]===mapping.names[c.label]?l+' '+wave:l);}
    }
    if(excitation)lines=lines.map(l=>{const t=l.trim().split(/\s+/);if(t[0]!==excitation)return l;if(t[3]?.toUpperCase()!=='DC')throw new Error('Нужен независимый источник');return kind==='ac'?l+' AC 1':`${t.slice(0,3).join(' ')} ${transientWaveform(config,Number(t[4]))}`;});
    if(kind==='transient'&&config.initial_conditions)for(const [label,value] of Object.entries(config.initial_conditions)){
      requireNumber(value,'начальное условие '+label);
      const component=components(doc).find(c=>c.label===label),name=mapping.names[label];
      if(!component||!['C','L'].includes(component.kind)||!name)throw Error('Начальное условие только для C/L: '+label);
      let found=false;lines=lines.map(line=>{if(line.trim().split(/\s+/)[0]!==name)return line;found=true;return line+' IC='+value;});
      if(!found)throw Error('Не найден элемент '+label);
    }
    const save=Object.values(mapping.names).filter(n=>/^Q/i.test(n)).map(n=>` @${n.toLowerCase()}[ic] @${n.toLowerCase()}[ib] @${n.toLowerCase()}[ie]`).join('');
    const nodes=kind==='transient'&&config.waveform==='native'&&config.startup!=='uic'?components(doc).filter(c=>c.kind==='C'&&config.initial_conditions?.[c.label]===undefined).flatMap(c=>mapping.nodes[c.label]).filter(n=>n!=='0'):[];
    const initialBias=nodes.length?{netlist:prepareJobs(doc,{kind:'op'}).jobs[0].netlist,nodes:[...new Set(nodes)]}:undefined;
    return {parameter,initialBias,netlist:[...lines,'.options reltol=1e-6 abstol=1e-12 vntol=1e-8',command,'.save all'+save,'.control','set filetype=ascii','run','write /result.raw all','quit','.endc','.end',''].join('\n')};});
  return {jobs,mapping};
}

/** TINA computes DC capacitor bias before applying the generator at t=0.
 * Ngspice otherwise starts its transient OP from the sine's initial phase. */
export async function resolveInitialBias(job:Job,run:(netlist:string)=>Promise<Curve>):Promise<string>{
 if(!job.initialBias)return job.netlist;
 const bias=await run(job.initialBias.netlist);
 const conditions=job.initialBias.nodes.map(node=>{
  const index=bias.names.indexOf(`v(${node})`),cell=bias.values[0]?.[index];
  if(index<0||typeof cell!=='number'||!Number.isFinite(cell))throw Error('Не получена DC рабочая точка узла '+node);
  return `v(${node})=${cell}`;
 });
 if(!/^\s*\.tran\s+/m.test(job.netlist))throw Error('Отсутствует команда переходного процесса');
 return job.netlist.replace(/^\s*\.tran\s+/m,`.ic ${conditions.join(' ')}\n.tran `);
}

export function parseRaw(text:string):Curve {
  const split=text.replace(/\r/g,'').split('Values:\n');if(split.length!==2)throw new Error('Движок не вернул численные данные');
  const [header,raw]=split,count=Number(header.match(/No\. Variables:\s*(\d+)/)?.[1]),points=Number(header.match(/No\. Points:\s*(\d+)/)?.[1]);
  if(!Number.isInteger(count)||count<1||count>10000||!Number.isInteger(points)||points<1||points*count>3000000)throw new Error('Слишком большой или неверный результат');
  const complex=/Flags:.*complex/.test(header),names=(header.split('Variables:\n')[1]??'').split('\n').filter(l=>l.trim()).map(l=>l.trim().split(/\s+/)[1].toLowerCase());
  const lines=raw.split('\n').filter(l=>l.trim());if(names.length!==count||lines.length!==points*count)throw new Error('Неполные данные расчёта');
  const values:Cell[][]=[];for(let p=0;p<points;p++){const row:Cell[]=[];for(let c=0;c<count;c++){const tokens=lines[p*count+c].trim().split(/\s+/);if(c===0&&Number(tokens.shift())!==p)throw new Error('Нарушен порядок точек');const nums=tokens[0].split(',').map(Number);if(nums.length!==(complex?2:1)||!nums.every(Number.isFinite))throw new Error('Нечисловой результат');row.push(complex?[nums[0],nums[1]]:nums[0]);}values.push(row);}
  return {plot:header.match(/Plotname:\s*([^\n]+)/)?.[1]??'Расчёт',names,values};
}

/** Ideal VM probes add no circuit load: their displayed voltage is first pin minus second. */
export function addMeterVectors(curves:Curve[],mapping:SimulationResult['mapping']):Curve[] {
  const meters=Object.entries(mapping.names).filter(([,name])=>name.startsWith('VM_')||name.startsWith('VP_'));
  if(!meters.length)return curves;
  return curves.map(curve=>{
    const names=[...curve.names],values=curve.values.map(row=>[...row]);
    for(const [label,name] of meters){
      const terminals=mapping.nodes[label],pair=name.startsWith('VP_')&&terminals?.length===1?[terminals[0],'0']:terminals,vector=`v(${name.toLowerCase()})`;
      if(!pair||pair.length!==2)throw new Error('Не определены выводы измерителя напряжения '+label);
      if(names.includes(vector))throw new Error('Совпало имя вектора вольтметра '+label);
      const indexes=pair.map(node=>node==='0'?-1:curve.names.indexOf(`v(${node.toLowerCase()})`));
      if(pair[0]!==pair[1]&&indexes.some((index,k)=>index<0&&pair[k]!=='0'))throw new Error('Не найден потенциал узла для вольтметра '+label);
      names.push(vector);
      for(let i=0;i<values.length;i++){
        if(pair[0]===pair[1]){values[i].push(curve.values[i].some(Array.isArray)?[0,0]:0);continue;}
        const a:Cell=indexes[0]<0?0:curve.values[i][indexes[0]],b:Cell=indexes[1]<0?0:curve.values[i][indexes[1]];
        if(Array.isArray(a)||Array.isArray(b)){const aa=Array.isArray(a)?a:[a,0],bb=Array.isArray(b)?b:[b,0];values[i].push([aa[0]-bb[0],aa[1]-bb[1]]);}else values[i].push(a-b);
      }
    }
    return {...curve,names,values};
  });
}

/** Each calculation owns a worker; cancel and timeout really stop WASM execution. */
export async function simulate(doc:Doc,config:SimulationConfig,onProgress?:(done:number,total:number)=>void,signal?:AbortSignal):Promise<SimulationResult> {
  const {jobs,mapping}=prepareJobs(doc,config);if(signal?.aborted)throw new DOMException('Расчёт отменён','AbortError');
  return new Promise((resolve,reject)=>{const worker=new Worker(new URL('./spice.worker.ts',import.meta.url),{type:'module'});let settled=false;
    const finish=(error?:Error,result?:SimulationResult)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);worker.terminate();if(error)reject(error);else resolve(result!);};
    const cancel=()=>finish(new DOMException('Расчёт отменён','AbortError'));
    const timer=setTimeout(()=>finish(new Error('Превышено время расчёта (90 секунд). Уменьшите число точек или кривых.')),90000);
    signal?.addEventListener('abort',cancel,{once:true});worker.onerror=e=>finish(new Error('Ошибка расчётного движка: '+e.message));
    worker.onmessage=e=>{const d=e.data;if(d.type==='progress')onProgress?.(d.done,jobs.length);else if(d.type==='error')finish(new Error(d.error));else if(d.type==='result'){try{finish(undefined,{...d.result,curves:addMeterVectors(d.result.curves.map((curve:Curve)=>resampleAc(curve,config)),mapping),mapping,netlist:d.result.netlist??jobs.map(j=>j.netlist).join('\n'),engine:'ngspice 46 / WebAssembly'});}catch(error){finish(error instanceof Error?error:new Error(String(error)));}}};worker.postMessage({jobs,config});
  });
}

export interface HParameters {uCE:number;iB:number;iC:number;uBE:number;deltaIB:number;deltaUCE:number;h11:number;h12:number;h21:number;h22:number;rIn:number;rOut:number;beta:number;simulation:SimulationResult}
export interface HSettings {transistor?:string;baseSource?:string;collectorSource?:string;uCE?:number;iB?:number;deltaIB?:number;deltaUCE?:number}
/** Validate the actual CE circuit, traversing only the connected collector ammeters. */
export function hParameterConfig(doc:Doc,settings:HSettings={}):SimulationConfig {
 const transistor=settings.transistor??'T1',baseSource=settings.baseSource??'IS1',collectorSource=settings.collectorSource??'VS1';
 const uCE=settings.uCE??16,iB=settings.iB??40e-6,deltaIB=settings.deltaIB??1e-6,deltaUCE=settings.deltaUCE??.1;
 if(![uCE,iB,deltaIB,deltaUCE].every(Number.isFinite)||deltaIB<=0||deltaUCE<=0||iB<=deltaIB||uCE<=deltaUCE)throw Error('Неверная рабочая точка для h-параметров');
 if(components(doc).find(c=>c.label===transistor)?.kind!=='NPN')throw Error('Расчёт h-параметров предназначен для NPN с положительными IБ и UКЭ');
 const map=exportSpice(doc).mapping,qp=map.nodes[transistor],bp=map.nodes[baseSource],vp=map.nodes[collectorSource];
 if(!qp||!bp||!vp||qp.length!==3||qp[2]!=='0'||!map.names[baseSource]?.startsWith('I_')||!map.names[collectorSource]?.startsWith('V_')||vp[1]!==qp[2])throw Error('Проверьте подключения источников h-параметров: отрицательный вывод питания и эмиттер должны соединяться с землёй');
 const sign=bp[0]===qp[1]&&bp[1]===qp[2]?-1:bp[1]===qp[1]&&bp[0]===qp[2]?1:0;
 if(!sign||qp[1]==='0')throw Error('Источник тока базы должен быть подключён между базой и эмиттером');
 for(const [label,ns] of Object.entries(map.nodes))if(label!==transistor&&label!==baseSource&&!map.names[label]?.startsWith('VM_')&&ns.includes(qp[1]))throw Error('К базе должны быть подключены только транзистор, источник тока и идеальный вольтметр');
 const reached=new Set([qp[0]]);
 for(let pass=0;pass<Object.keys(map.nodes).length;pass++){
  let changed=false;
  for(const [label,name] of Object.entries(map.names))if(name.startsWith('VAM_')){
   const ns=map.nodes[label];if(!ns||ns.includes('0')||ns.includes(qp[1]))continue;
   if(ns.some(n=>reached.has(n)))for(const n of ns)if(!reached.has(n)){reached.add(n);changed=true;}
  }
  if(!changed)break;
 }
 if(!reached.has(vp[0])||vp[0]==='0')throw Error('Источник питания не соединён с коллектором через провод или амперметр');
 return {kind:'dc-family',input:collectorSource,start:uCE-deltaUCE,stop:uCE+deltaUCE,points:3,step_source:baseSource,step_values:[sign*(iB-deltaIB),sign*iB,sign*(iB+deltaIB)]};
}
/** Small-signal central differences at a chosen common-emitter operating point. */
export async function estimateH(doc:Doc,settings:{transistor?:string;baseSource?:string;collectorSource?:string;uCE?:number;iB?:number;deltaIB?:number;deltaUCE?:number}={},signal?:AbortSignal):Promise<HParameters> {
  const transistor=settings.transistor??'T1',baseSource=settings.baseSource??'IS1',collectorSource=settings.collectorSource??'VS1';
  const uCE=settings.uCE??16,iB=settings.iB??40e-6,deltaIB=settings.deltaIB??1e-6,deltaUCE=settings.deltaUCE??.1;
  const simulation=await simulate(doc,hParameterConfig(doc,settings),undefined,signal);
  const pins=simulation.mapping.nodes[transistor],q=simulation.mapping.names[transistor]?.toLowerCase();if(!pins||pins.length!==3||!q?.startsWith('q'))throw new Error('Для h-параметров нужен биполярный транзистор');
  const real=(cell:Cell)=>typeof cell==='number'?cell:cell[0];
  const vector=(curve:Curve,p:number,name:string)=>{const k=curve.names.indexOf(name.toLowerCase());if(k<0)throw new Error('Не найден расчётный вектор '+name);return real(curve.values[p][k]);};
  const voltage=(curve:Curve,p:number,node:string)=>node==='0'?0:vector(curve,p,`v(${node})`);
  const ube=(curve:Curve,p:number)=>voltage(curve,p,pins[1])-voltage(curve,p,pins[2]);
  const ic=(curve:Curve,p:number)=>vector(curve,p,`i(@${q}[ic])`);
  const [minus,center,plus]=simulation.curves;
  const h11=(ube(plus,1)-ube(minus,1))/(2*deltaIB),h12=(ube(center,2)-ube(center,0))/(2*deltaUCE),h21=(ic(plus,1)-ic(minus,1))/(2*deltaIB),h22=(ic(center,2)-ic(center,0))/(2*deltaUCE);
  return {uCE,iB,iC:ic(center,1),uBE:ube(center,1),deltaIB,deltaUCE,h11,h12,h21,h22,rIn:h11,rOut:1/h22,beta:h21,simulation};
}

export async function calculateH(doc:Doc,options:{baseSource?:string;collectorSource?:string;transistor?:string;ib?:number;uce?:number;dib?:number;duce?:number}={},onProgress?:(done:number,total:number)=>void,signal?:AbortSignal) {
  const transistor=options.transistor??'T1',baseSource=options.baseSource??'IS1',collectorSource=options.collectorSource??'VS1';
  onProgress?.(0,1);
  const result=await estimateH(doc,{transistor,baseSource,collectorSource,iB:options.ib,uCE:options.uce,deltaIB:options.dib,deltaUCE:options.duce},signal);onProgress?.(1,1);
  return {...result,RinTr:result.rIn,RoutTr:result.rOut,point:{ib:result.iB,uce:result.uCE,ic:result.iC,ube:result.uBE},measurements:result.simulation.curves,formulas:{h11:'ΔUБЭ / ΔIБ при UКЭ = const, Ом',h12:'ΔUБЭ / ΔUКЭ при IБ = const',h21:'ΔIК / ΔIБ при UКЭ = const',h22:'ΔIК / ΔUКЭ при IБ = const, См',RinTr:'h11, Ом',RoutTr:'1 / h22, Ом',beta:'h21'},method:'Центральные разности по сетке 3 × 3: рабочая точка и симметричные приращения IБ и UКЭ. Движок ngspice WebAssembly.'};
}

/** TINA specifies total intervals; ngspice specifies integer points per decade.
 * Interpolate complex values on log-frequency only when the requested grids differ. */
export function resampleAc(curve:Curve,config:SimulationConfig):Curve{
 if(config.kind!=='ac'||config.ac_intervals===undefined)return curve;
 const a=config.start!,b=config.stop!,n=config.ac_intervals,log=config.ac_logarithmic!==false,frequency=(row:Cell[])=>Array.isArray(row[0])?row[0][0]:row[0];
 const coordinate=(x:number)=>log?Math.log(x):x;let at=0;
 const values=Array.from({length:n+1},(_,i)=>{const x=i===n?b:log?a*Math.pow(b/a,i/n):a+(b-a)*i/n;
 while(at+1<curve.values.length-1&&frequency(curve.values[at+1])<x)at++;
 const lo=curve.values[at],hi=curve.values[Math.min(at+1,curve.values.length-1)],f0=frequency(lo),f1=frequency(hi),t=f1===f0?0:(coordinate(x)-coordinate(f0))/(coordinate(f1)-coordinate(f0));
 return lo.map((v,j):Cell=>{if(j===0)return Array.isArray(v)?[x,0]:x;const w=hi[j];if(Array.isArray(v)&&Array.isArray(w))return[v[0]+t*(w[0]-v[0]),v[1]+t*(w[1]-v[1])];return Number(v)+t*(Number(w)-Number(v));});});
 return {...curve,values};
}
