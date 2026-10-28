import {components,decode,encode,exportSpice,type Doc} from './codec.ts';
import {nativeControl,nativeDc,setNativeControl,setNativeDc,type NativeDc} from './native-analysis.ts';
import {simulate,type SimulationConfig,type SimulationResult} from './solver.ts';
import type {BjtAutoOptions} from './bjt-auto-dialog.ts';
export type BjtSweepSetup={transistor:string;baseSource:string;collectorSource:string;currentSign:number;voltageSign:number;icVector:string;polarity:number};
export function bjtSweepSetup(doc:Doc,config:SimulationConfig):BjtSweepSetup{
 const map=exportSpice(doc).mapping,parts=components(doc),base=parts.find(c=>c.label===config.step_source),supply=parts.find(c=>c.label===config.input);
 if(!base||!['I','IS'].includes(base.kind)||!supply||!['V','VS'].includes(supply.kind))throw Error('Для подбора нужны источник тока базы и источник напряжения коллектора. Выберите выходное DC-семейство.');
 const bp=map.nodes[base.label],vp=map.nodes[supply.label];
 const candidates=parts.filter(c=>['NPN','PNP'].includes(c.kind)&&map.nodes[c.label]?.length===3&&bp?.includes(map.nodes[c.label][1]));
 if(candidates.length!==1)throw Error('Нужно однозначно определить транзистор, подключённый к источнику тока базы.');
 const q=candidates[0],[collector,b,e]=map.nodes[q.label];if(e!=='0'||b==='0')throw Error('Автоподбор выходного семейства требует схемы ОЭ: эмиттер соединён с землёй.');
 const direction=bp[0]===b&&bp[1]===e?-1:bp[1]===b&&bp[0]===e?1:0;
 if(!direction)throw Error('Источник тока должен быть подключён между базой и эмиттером.');
 const reached=new Set([collector]);for(let n=0;n<parts.length;n++)for(const c of parts)if(map.names[c.label]?.startsWith('VAM_')){const ns=map.nodes[c.label];if(ns.some(x=>reached.has(x)))ns.forEach(x=>reached.add(x));}
 const vDirection=reached.has(vp[0])&&vp[1]===e?1:reached.has(vp[1])&&vp[0]===e?-1:0;if(!vDirection)throw Error('Источник напряжения должен питать коллектор через провод или идеальный амперметр.');
 const polarity=q.kind==='PNP'?-1:1;return{transistor:q.label,baseSource:base.label,collectorSource:supply.label,currentSign:direction*polarity,voltageSign:vDirection*polarity,polarity,icVector:`i(@${map.names[q.label].toLowerCase()}[ic])`};
}
/** Locate a supported CE testbench even before the first calculation. */
export function bjtAutoConfig(doc:Doc,preferredInput?:string):SimulationConfig{
 const control=nativeControl(doc),dc=nativeDc(doc),parts=components(doc),candidates:SimulationConfig[]=[];
 for(const current of parts.filter(c=>['I','IS'].includes(c.kind)))for(const voltage of parts.filter(c=>['V','VS'].includes(c.kind))){if(preferredInput&&voltage.label!==preferredInput)continue;const candidate:SimulationConfig={kind:'dc-family',input:voltage.label,step_source:current.label,start:0,stop:1,points:501,step_values:control?.source===current.label?[control.start,control.stop]:[0,current.value||1e-5]};try{bjtSweepSetup(doc,candidate);candidates.push(candidate);}catch{}}
 const preferred=candidates.filter(c=>c.input===dc?.input&&c.step_source===control?.source);if(preferred.length===1)return preferred[0];if(candidates.length!==1)throw Error('Не удалось однозначно выбрать источники для выходного семейства. Выберите вход и объект управления.');return candidates[0];
}
/** Solve from real model samples; no fixed beta or model-specific table. */
export async function fitBaseCurrent(target:number,initial:number,maxIb:number,sample:(ib:number)=>Promise<number>,report?:(message:string)=>void){
 if(![target,initial,maxIb].every(v=>Number.isFinite(v)&&v>0))throw Error('Некорректные пределы подбора');let ib=Math.min(initial,maxIb),low=0,high=Infinity;const probes:Array<{ib:number;ic:number}>=[];
 for(let attempt=0;attempt<16;attempt++){
  const ic=await sample(ib);if(!Number.isFinite(ic)||ic<0)throw Error('Модель вернула некорректный ток коллектора');probes.push({ib,ic});report?.(`Подбор ${attempt+1}: IБ=${(ib*1e6).toPrecision(4)} мкА, IК=${(ic*1000).toPrecision(4)} мА`);
  if(Math.abs(ic-target)/target<=.025)return{ib,ic,target,probes};
  if(ic<target)low=ib;else high=ib;
  let next=ic>1e-15?ib*Math.max(.2,Math.min(5,target/ic)):ib*5;
  if(Number.isFinite(high))next=low>0?Math.sqrt(low*high):high/2;
  next=Math.min(maxIb,next);if(next===ib)throw Error('Не удалось достичь требуемого тока в пределах поиска тока базы. Проверьте модель и заданные пределы.');ib=next;
 }
 throw Error('Модель не дала устойчивого диапазона за 16 итераций. Подбор не применён.');
}
export type AutoSimulator=(doc:Doc,config:SimulationConfig,onProgress?:((done:number,total:number)=>void),signal?:AbortSignal)=>Promise<SimulationResult>;
export async function autoBjtRange(doc:Doc,config:SimulationConfig,limits:BjtAutoOptions,report:(message:string)=>void=()=>{},engine:AutoSimulator=simulate,signal?:AbortSignal){
 if(![limits.uceMax_V,limits.icMax_A,limits.pCollectorMax_W].every(v=>Number.isFinite(v)&&v>0)||!Number.isInteger(limits.cases)||limits.cases<3||limits.cases>31)throw Error('Укажите положительные паспортные пределы и 3…31 кривую.');
 const setup=bjtSweepSetup(doc,config),snapshot=decode(encode(doc)),probeU=setup.voltageSign*limits.uceMax_V,epsilon=Math.max(1e-7,limits.uceMax_V*1e-7);
 const initial=Math.max(...(config.step_values??[]).map(Math.abs),limits.icMax_A/1000),target=.9*limits.icMax_A;
 const fit=await fitBaseCurrent(target,initial,limits.icMax_A,async ib=>{
  if(signal?.aborted)throw new DOMException('Расчёт отменён','AbortError');const r=await engine(snapshot,{kind:'dc-family',input:setup.collectorSource,start:probeU,stop:probeU+epsilon,points:2,step_source:setup.baseSource,step_values:[setup.currentSign*ib]},undefined,signal);const c=r.curves[0],j=c.names.indexOf(setup.icVector);if(j<0)throw Error('Нет тока коллектора в результатах модели.');const cell=c.values[0][j],ic=setup.polarity*(Array.isArray(cell)?cell[0]:cell);if(ic< -1e-10)throw Error('Полярность токов не соответствует типу транзистора.');return Math.max(0,ic);
 },report);
 const dc:NativeDc={input:setup.collectorSource,start:setup.voltageSign>0?0:-limits.uceMax_V,stop:setup.voltageSign>0?limits.uceMax_V:0,intervals:500};
 const control={source:setup.baseSource,start:0,stop:setup.currentSign*fit.ib,count:limits.cases,unit:'A'};setNativeControl(snapshot,control);setNativeDc(snapshot,dc);
 const next:SimulationConfig={kind:'dc-family',input:dc.input,start:dc.start,stop:dc.stop,points:501,step_source:control.source,step_values:Array.from({length:limits.cases},(_,i)=>control.stop*i/(limits.cases-1))};
 report('Пересчёт полного семейства…');const result=await engine(snapshot,next,(n,total)=>report(`Пересчёт семейства: ${n}/${total}`),signal);
 const maxIc=Math.max(...result.curves.flatMap(c=>{const j=c.names.indexOf(setup.icVector);if(j<0)throw Error('В семействе отсутствует ток коллектора');return c.values.map(r=>Math.abs(Array.isArray(r[j])?(r[j] as [number,number])[0]:r[j] as number));}));
 if(maxIc<limits.icMax_A*.7||maxIc>limits.icMax_A*1.02)throw Error('Полный пересчёт не подтвердил диапазон токов. Настройки схемы не изменены.');
 return{snapshot,result,config:next,setup,limits,fit,maxIc,dc,control};
}

