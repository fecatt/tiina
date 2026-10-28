import {bjtOutputCallouts,calloutArrow,type GraphCallout} from './graph-annotations.ts';
/** Shared graphical construction built only from measured/simulated BJT curves. */
export type BjtGraphData={
 output:Array<{ib_A:number;points:Array<[uce_V:number,ic_A:number]>}>;
 input5V:Array<[ube_V:number,ib_A:number]>;
 load:{supply_V:number;rCollector_ohm:number;rEmitter_ohm:number};
 limits:{uceMax_V:number;icMax_A:number;pCollectorMax_W:number};
 stage?:{R1_ohm?:number;R2_ohm?:number;Ce_F?:number;Cp1_F?:number;Ck_F?:number};
 model:string;
};
export type BjtGraphPoint={x:number;y:number};
export type BjtGraphSeries={name:string;points:BjtGraphPoint[];color?:string;dash?:boolean};
export type BjtGraphMark={name:string;point:BjtGraphPoint;color?:string};
export type BjtGraphPanel={
 id:'output'|'transfer'|'input';title:string;xLabel:string;yLabel:string;
 rect:{x:number;y:number;width:number;height:number};
 x:{min:number;max:number;reverse?:boolean};y:{min:number;max:number;reverse?:boolean};
 series:BjtGraphSeries[];marks?:BjtGraphMark[];callouts?:GraphCallout[];
};
export type BjtTimePanel={title:string;yLabel:string;rect:{x:number;y:number;width:number;height:number};min:number;max:number;points:Array<[number,number]>};
export type BjtCalculationRow={label:string;value:number|null;unit:string;status:'computed'|'unavailable';method?:string};
export type BjtGraphScene={title:string;panels:BjtGraphPanel[];timePanels:BjtTimePanel[];projections:Array<{from:'output'|'transfer'|'input';to:'output'|'transfer'|'input';fromPoint:BjtGraphPoint;toPoint:BjtGraphPoint;name:string}>;notes:string[];q:{uce_V:number;ic_A:number;ib_A:number;ube_V:number};a:{uce_V:number;ic_A:number;ib_A:number;ube_V:number};b:{uce_V:number;ic_A:number;ib_A:number;ube_V:number};amplitudes:Record<'uce_V'|'ic_A'|'ib_A'|'ube_V',number>;equations:string[];calculations:BjtCalculationRow[];calculationWarnings:string[];};

const finite=(n:number)=>Number.isFinite(n);
function interpolate(points:Array<[number,number]>,x:number,clamp=false):number {
 if(points.length<2)throw Error('Для интерполяции нужны минимум две точки.');
 const p=[...points].sort((a,b)=>a[0]-b[0]);
 if(!clamp&&(x<p[0][0]-1e-12||x>p.at(-1)![0]+1e-12))throw Error(`Значение ${x} находится вне диапазона измерений.`);
 if(x<=p[0][0])return p[0][1];if(x>=p.at(-1)![0])return p.at(-1)![1];
 let i=1;while(i<p.length&&p[i][0]<x)i++;
 const [x0,y0]=p[i-1],[x1,y1]=p[i];return x1===x0?y0:y0+(y1-y0)*(x-x0)/(x1-x0);
}
function validate(d:BjtGraphData){
 if(!d.output.length||d.output.length<2||d.input5V.length<2)throw Error('Для построения нужны выходное семейство минимум из двух кривых и входная характеристика при 5 В.');
 const {supply_V,rCollector_ohm,rEmitter_ohm}=d.load,{uceMax_V,icMax_A,pCollectorMax_W}=d.limits;
 if(!(finite(supply_V)&&supply_V>0&&finite(rCollector_ohm)&&rCollector_ohm>0&&finite(rEmitter_ohm)&&rEmitter_ohm>=0))throw Error('Проверьте EК, RК и RЭ.');
 if(!(finite(uceMax_V)&&uceMax_V>0&&finite(icMax_A)&&icMax_A>0&&finite(pCollectorMax_W)&&pCollectorMax_W>0))throw Error('Проверьте паспортные ограничения.');
 for(const c of d.output)if(!finite(c.ib_A)||c.ib_A<0||c.points.length<2||c.points.some(([x,y])=>!finite(x)||!finite(y)))throw Error('Выходные кривые должны содержать конечные UКЭ, IК и IБ.');
 if(d.input5V.some(([u,i])=>!finite(u)||!finite(i)))throw Error('Входная кривая содержит нечисловые данные.');
}

/** Calculation order and interpolation follow tools/homework/methodology-data.py. */
export function buildBjtGraphScene(data:BjtGraphData):BjtGraphScene {
 validate(data);
 const E=data.load.supply_V,Rk=data.load.rCollector_ohm,Re=data.load.rEmitter_ohm,R=Rk+Re;
 const family=[...data.output].sort((a,b)=>a.ib_A-b.ib_A),levels=family.map(c=>c.ib_A);
 const getIc=(uce:number,ib:number)=>{
  let j=0;while(j<levels.length-2&&levels[j+1]<ib)j++;
  const lo=family[j],hi=family[j+1],weight=(ib-levels[j])/(levels[j+1]-levels[j]);
  const il=interpolate(lo.points,uce,true),ih=interpolate(hi.points,uce,true);
  return il*(1-weight)+ih*weight;
 };
 const intersection=(ib:number)=>{
  let lo=0,hi=E;
  for(let i=0;i<60;i++){const u=(lo+hi)/2,ic=getIc(u,ib);if(u+ic*R+ib*Re>E)hi=u;else lo=u;}
  const u=(lo+hi)/2;return {ib_A:ib,uce_V:u,ic_A:getIc(u,ib)};
 };
 const transfer=Array.from({length:801},(_,i)=>intersection(levels[0]+(levels.at(-1)!-levels[0])*i/800));
 const ibQ=interpolate(transfer.map(p=>[p.uce_V,p.ib_A]),E/2);
 const inputIB=data.input5V.map(([ube,ib])=>[ib,ube] as [number,number]);
 const point=(ib:number)=>({ib_A:ib,ic_A:interpolate(transfer.map(p=>[p.ib_A,p.ic_A]),ib),uce_V:interpolate(transfer.map(p=>[p.ib_A,p.uce_V]),ib),ube_V:interpolate(inputIB,ib)});
 const q=point(ibQ),eps=1e-5;
 const fromU=(ube:number)=>point(interpolate(data.input5V,ube));
 const slope=(fromU(q.ube_V+eps).ic_A-fromU(q.ube_V-eps).ic_A)/(2*eps);
 if(!(slope>0&&finite(slope)))throw Error('В окрестности Q не удалось определить положительный наклон переходной характеристики.');
 const inputSorted=[...data.input5V].sort((a,b)=>a[0]-b[0]);
 let lo=0,hi=Math.min(q.ube_V-inputSorted[0][0],inputSorted.at(-1)![0]-q.ube_V);
 const acceptable=(amp:number)=>{
  for(let i=0;i<=80;i++){
   const du=-amp+2*amp*i/80;let p:{ib_A:number;ic_A:number;uce_V:number;ube_V:number};
   try{p=fromU(q.ube_V+du);}catch{return false;}
   if(!(p.uce_V>=.2&&p.uce_V<=data.limits.uceMax_V&&p.ic_A>=0&&p.ic_A<=data.limits.icMax_A&&p.ic_A*p.uce_V<=data.limits.pCollectorMax_W))return false;
   if(Math.abs(p.ic_A-q.ic_A-slope*du)>.05*slope*amp)return false;
  }
  return true;
 };
 for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(acceptable(mid))lo=mid;else hi=mid;}
 const amp=lo,a=fromU(q.ube_V-amp),b=fromU(q.ube_V+amp);
 const amplitudes={ib_A:Math.min(q.ib_A-a.ib_A,b.ib_A-q.ib_A),ic_A:Math.min(q.ic_A-a.ic_A,b.ic_A-q.ic_A),ube_V:Math.min(q.ube_V-a.ube_V,b.ube_V-q.ube_V),uce_V:Math.min(a.uce_V-q.uce_V,q.uce_V-b.uce_V)};
 const stage=data.stage??{},validStage=(v:number|undefined)=>v!==undefined&&finite(v)&&v>0?v:null;
 const R1=validStage(stage.R1_ohm),R2=validStage(stage.R2_ohm),Ce=validStage(stage.Ce_F),Cp1=validStage(stage.Cp1_F),Ck=validStage(stage.Ck_F);
 const inputRange=data.input5V.map(p=>p[1]).sort((x,y)=>x-y),inputLeft=q.ib_A-inputRange[0],inputRight=inputRange.at(-1)!-q.ib_A;
 const outputLeft=q.ib_A-levels[0],outputRight=levels.at(-1)!-q.ib_A,deltaIB=Math.min(inputLeft,inputRight,outputLeft,outputRight)*.1;
 const uceRange=family.flatMap(c=>c.points.map(p=>p[0])),minUCE=Math.min(...uceRange),maxUCEdata=Math.max(...uceRange),deltaUCE=Math.min(q.uce_V-minUCE,maxUCEdata-q.uce_V)*.1;
 let h11:number|null=null,h21:number|null=null,h22:number|null=null;
 if(deltaIB>0){const uPlus=interpolate(inputIB,q.ib_A+deltaIB),uMinus=interpolate(inputIB,q.ib_A-deltaIB);h11=(uPlus-uMinus)/(2*deltaIB);h21=(getIc(q.uce_V,q.ib_A+deltaIB)-getIc(q.uce_V,q.ib_A-deltaIB))/(2*deltaIB);}
 if(deltaUCE>0)h22=(getIc(q.uce_V+deltaUCE,q.ib_A)-getIc(q.uce_V-deltaUCE,q.ib_A))/(2*deltaUCE);
 const beta=h21,RinTr=h11,RoutTr=h22&&h22>0?1/h22:null;
 const Rb=R1&&R2?R1*R2/(R1+R2):null,RinStage=Rb&&RinTr&&RinTr>0?Rb*RinTr/(Rb+RinTr):null,RoutStage=RoutTr?Rk*RoutTr/(Rk+RoutTr):null;
 const KuMethod=beta&&RinStage?-beta*Rk/RinStage:null,KiStage=amplitudes.ib_A>0?amplitudes.ic_A/amplitudes.ib_A:null,KpMethod=beta&&KuMethod?Math.abs(beta*KuMethod):null,KuRefined=beta&&RoutStage&&h11?-beta*RoutStage/h11:null,KpRefined=beta&&KuRefined?Math.abs(beta*KuRefined):null;
 const Pout=amplitudes.uce_V>0?.5*amplitudes.uce_V**2/Rk:null;
 let Psource:number|null=null,PsourceMethod:number|null=null,dividerResidual:number|null=null;
 if(R1&&R2){const vb=q.ube_V+(q.ic_A+q.ib_A)*Re,ir1=(E-vb)/R1,id=vb/R2;Psource=E*(q.ic_A+ir1);PsourceMethod=q.ic_A*E+id**2*(R1+R2)+q.ib_A**2*R1;dividerResidual=ir1-(q.ib_A+id);}
 const efficiency=Psource&&Psource>0&&Pout!==null?100*Pout/Psource:null;
 const parallel=RinStage&&RoutStage?RinStage*RoutStage/(RinStage+RoutStage):null,tauLow=Cp1&&RinStage&&RoutStage?Cp1*(RinStage+RoutStage):null,tauHigh=Ck&&parallel?Ck*parallel:null;
 const rows:BjtCalculationRow[]=[];
 const add=(label:string,value:number|null,unit:string,method?:string)=>rows.push({label,value:value!==null&&finite(value)?value:null,unit,status:value!==null&&finite(value)?'computed':'unavailable',method});
 add('h₁₁ — входное сопротивление',h11,'Ω','Локальная разность по входной кривой при 5 В, около Q');
 add('h₁₂ — обратная передача напряжения',null,'—','Недоступно: есть одна входная кривая при UКЭ=5 В');
 add('h₂₁ — коэффициент передачи тока транзистора',h21,'—','Локальная разность по выходному семейству около Q');
 add('h₂₂ — выходная проводимость',h22,'S','Локальная разность по выходному семейству около Q');
 add('β ≈ h₂₁',beta,'—');add('Rвх транзистора = h₁₁',RinTr,'Ω');add('Rвых транзистора = 1/h₂₂',RoutTr,'Ω');
 add('Rб = R₁ ∥ R₂',Rb,'Ω');add('Rвх каскада = Rб ∥ Rвх транзистора',RinStage,'Ω');add('Rвых каскада = Rк ∥ Rвых транзистора',RoutStage,'Ω');
 add('Kᵢ каскада ≈ β',beta,'—','Оценка по методичке');add('Kᵢ по выбранному размаху = IКm/IБm',KiStage,'—','По точкам a/b');
 add('Kᵤ по формуле методички = −βRк/Rвх',KuMethod,'—');add('Kₚ по методичке = |βKᵤ|',KpMethod,'—');
 add('Kᵤ с учётом Rвых транзистора = −β(Rк∥RвыхТ)/h₁₁',KuRefined,'—','Уточнённая оценка');add('Kₚ уточн. = |β Kᵤ уточн.|',KpRefined,'—');
 add('Pвых = UКЭm²/(2Rк)',Pout,'W');add('Pист, расчёт из Q и тока через R₁',Psource,'W','EК·(IК₀+IР₁); UБ=UБЭ+(IК+IБ)RЭ');add('Pист по приближённой формуле методички',PsourceMethod,'W');
 add('Разница мощностей источника: формула − Q',PsourceMethod!==null&&Psource!==null?PsourceMethod-Psource:null,'W','Согласование делителя и рабочей точки');add('η = Pвых/Pист(Q)',efficiency,'%');
 add('τн = Cр₁(Rвх+Rвых)',tauLow,'s','Приближённая постоянная времени на НЧ');add('fн = 1/(2πτн)',tauLow?1/(2*Math.PI*tauLow):null,'Hz');
 add('τв = Cк(Rвх∥Rвых)',tauHigh,'s','Приближённая постоянная времени на ВЧ');add('fв = 1/(2πτв)',tauHigh?1/(2*Math.PI*tauHigh):null,'Hz');
 add('Cэ задан',Ce,'F','В двухполюсную оценку полосы не входит');
 const calculationWarnings:string[]=[];
 if(!R1||!R2)calculationWarnings.push('Введите R₁ и R₂, чтобы получить сопротивление входного делителя, мощность источника и параметры каскада.');
 if(!Ce||!Cp1||!Ck)calculationWarnings.push('Для оценки граничных частот задайте Cр₁ и Cк; Cэ вводится отдельно и в двухполюсную оценку полосы не включён.');
 if(dividerResidual!==null&&R1&&R2){const id=(q.ube_V+(q.ic_A+q.ib_A)*Re)/R2;if(Math.abs(dividerResidual)>.05*Math.max(Math.abs(q.ib_A+id),1e-12))calculationWarnings.push('Ток делителя по R₁/R₂ отличается от тока базы в рабочей точке более чем на 5%; мощность источника и входное сопротивление требуют проверки режима.');}
 const maxUce=Math.max(data.limits.uceMax_V,E,...family.flatMap(c=>c.points.map(p=>p[0]))),maxIc=Math.max(E/R,data.limits.pCollectorMax_W/maxUce*1.5,...family.flatMap(c=>c.points.map(p=>p[1])))*1.08,maxIb=levels.at(-1)!;
 const outputSeries:BjtGraphSeries[]=family.map(c=>({name:`IБ=${c.ib_A} А`,points:c.points.map(([x,y])=>({x,y}))}));
 const loadIntercept=E-q.ib_A*Re;
 outputSeries.push({name:'Нагрузочная линия без RЭ',color:'#8952a8',dash:true,points:[{x:0,y:E/Rk},{x:E,y:0}]},{name:'Рабочая нагрузочная линия для IБ(Q)',color:'#c33',points:[{x:0,y:loadIntercept/R},{x:loadIntercept,y:0}]},
  {name:'UКЭ max',color:'#777',dash:true,points:[{x:data.limits.uceMax_V,y:0},{x:data.limits.uceMax_V,y:maxIc}]},
  {name:'IК max',color:'#777',dash:true,points:[{x:0,y:data.limits.icMax_A},{x:maxUce,y:data.limits.icMax_A}]},
  {name:'PК max',color:'#a65',dash:true,points:Array.from({length:161},(_,i)=>{const u=Math.max(1e-12,maxUce*i/160);return{x:u,y:data.limits.pCollectorMax_W/u};})});
 const keyPoints:[string,typeof q,string][]=[['A',q,'#aa2222'],['a',a,'#237447'],['b',b,'#237447']];
 const marks=(xKey:'ib_A'|'uce_V',yKey:'ic_A'|'ube_V')=>keyPoints.map(([name,p,color])=>({name,point:{x:p[xKey],y:p[yKey]},color}));
 const panels:BjtGraphPanel[]=[
  {id:'output',title:'Выходные характеристики',xLabel:'UКЭ, В',yLabel:'IК, А',rect:{x:520,y:55,width:420,height:270},x:{min:0,max:maxUce},y:{min:0,max:maxIc},series:outputSeries,marks:marks('uce_V','ic_A'),callouts:bjtOutputCallouts(data,q.ib_A,{xmin:0,xmax:maxUce,ymin:0,ymax:maxIc})},
  {id:'transfer',title:'Переходная характеристика IК(IБ)',xLabel:'IБ, А',yLabel:'IК, А',rect:{x:70,y:55,width:420,height:270},x:{min:0,max:maxIb,reverse:true},y:{min:0,max:maxIc},series:[{name:'Пересечения нагрузочной линии',points:transfer.map(p=>({x:p.ib_A,y:p.ic_A}))}],marks:marks('ib_A','ic_A')},
  {id:'input',title:'Входная характеристика · поворот 90°',xLabel:'IБ, А',yLabel:'UБЭ, В',rect:{x:70,y:390,width:420,height:245},x:{min:0,max:maxIb,reverse:true},y:{min:0,max:Math.max(...data.input5V.map(p=>p[0])),reverse:true},series:[{name:'Входная характеристика UКЭ=5 В',points:data.input5V.map(([ube,ib])=>({x:ib,y:ube}))}],marks:marks('ib_A','ube_V')}
 ];
 const projections:BjtGraphScene['projections']=keyPoints.flatMap(([name,p])=>[
  {from:'output',to:'transfer',fromPoint:{x:p.uce_V,y:p.ic_A},toPoint:{x:p.ib_A,y:p.ic_A},name},
  {from:'transfer',to:'input',fromPoint:{x:p.ib_A,y:p.ic_A},toPoint:{x:p.ib_A,y:p.ube_V},name}
 ]);
 const sine=(offset:number,amplitude:number,t:number,negative=false)=>offset+(negative?-1:1)*amplitude*Math.sin(2*Math.PI*1000*t);
 const times=Array.from({length:401},(_,i)=>i*.002/400);
 const timeValues=[
  {title:'Ток базы iБ(t)',ylabel:'А',v:(t:number)=>sine(q.ib_A,amplitudes.ib_A,t)},
  {title:'Ток коллектора iК(t)',ylabel:'А',v:(t:number)=>sine(q.ic_A,amplitudes.ic_A,t)},
  {title:'Напряжение UБЭ(t)',ylabel:'В',v:(t:number)=>sine(q.ube_V,amplitudes.ube_V,t)},
  {title:'Напряжение UКЭ(t)',ylabel:'В',v:(t:number)=>sine(q.uce_V,amplitudes.uce_V,t,true)}
 ];
 const timePanels:BjtTimePanel[]=timeValues.map((c,i)=>{const vals=times.map(t=>c.v(t)),span=Math.max(...vals)-Math.min(...vals)||1;return{title:c.title,yLabel:c.ylabel,rect:{x:25+i*242,y:705,width:220,height:220},min:Math.min(...vals)-span*.08,max:Math.max(...vals)+span*.08,points:times.map(t=>[t,c.v(t)])};});
 const equations=[`iБ(t) = ${(q.ib_A).toPrecision(7)} + ${(amplitudes.ib_A).toPrecision(5)}·sin(2π·1000t) А`,`iК(t) = ${(q.ic_A).toPrecision(7)} + ${(amplitudes.ic_A).toPrecision(5)}·sin(2π·1000t) А`,`uБЭ(t) = ${(q.ube_V).toPrecision(7)} + ${(amplitudes.ube_V).toPrecision(5)}·sin(2π·1000t) В`,`uКЭ(t) = ${(q.uce_V).toPrecision(7)} − ${(amplitudes.uce_V).toPrecision(5)}·sin(2π·1000t) В`];
 return {title:`Графоаналитическое построение · ${data.model}`,panels,timePanels,projections,q,a,b,amplitudes,equations,calculations:rows,calculationWarnings,notes:[`Расчёт по реальным кривым. Q найден при UКЭ=EК/2=${(E/2).toPrecision(6)} В; семейство интерполировано по IБ и UКЭ.`,`Нагрузочная линия: EК=UКЭ+IК(RК+RЭ)+IБRЭ; transfer: 801 расчётных точки по фактическим пересечениям.`,`a/b: максимум симметричного размаха UБЭ при отклонении от касательной ≤5% полной амплитуды; проверка на 81 точке, с учётом паспортных пределов.`]};
}

const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Reads tab/semicolon separated numeric columns and preserves comma decimals from native TINA text. */
export function parseBjtInputTable(text:string):Array<[number,number]> {
 const points:Array<[number,number]>=[];
 for(const raw of text.replace(/^\uFEFF/,'').split(/\r?\n/)){
  const line=raw.trim();if(!line||line.startsWith('*')||line.startsWith('#'))continue;
  const cells=/[\t;]/.test(line)?line.split(/[\t;]+/):line.split(/[\s,]+/);
  const pair=cells.slice(0,2).map(s=>Number(s.trim().replace(',','.')));
  if(pair.length===2&&pair.every(Number.isFinite))points.push(pair as [number,number]);
 }
 if(points.length<2)throw Error('Не прочитана числовая таблица. Нужны два столбца: UБЭ (В), затем IБ (А), минимум две строки.');
 return points;
}
export function showBjtGraphDialog(dialog:HTMLDialogElement,defaults:{supply_V?:number;rCollector_ohm?:number;rEmitter_ohm?:number;uceMax_V?:number;icMax_A?:number;pCollectorMax_W?:number;stage?:BjtGraphData['stage']},onApply:(values:{load:BjtGraphData['load'];limits:BjtGraphData['limits'];input5V:Array<[number,number]>;stage:BjtGraphData['stage']})=>void):void {
 dialog.classList.add('modal','bjt-graph-dialog');dialog.setAttribute('aria-label','Графоаналитическое построение');
 dialog.innerHTML=`<header><span>Графоаналитическое построение</span><button type="button" data-cancel aria-label="Закрыть">×</button></header><form novalidate><section><p>Семейство выходных характеристик берётся из текущего расчёта. Для входной характеристики при UКЭ=5 В выберите или вставьте таблицу UБЭ (В), IБ (А). Строки TINA с десятичными запятыми поддерживаются.</p><fieldset><legend>Цепь постоянного тока</legend><label>EК, В <input name="supply" value="${defaults.supply_V??''}" required></label><label>RК, Ом <input name="rk" value="${defaults.rCollector_ohm??''}" required></label><label>RЭ, Ом <input name="re" value="${defaults.rEmitter_ohm??0}" required></label></fieldset><fieldset><legend>Ограничения транзистора</legend><label>UКЭ max, В <input name="umax" value="${defaults.uceMax_V??''}" required></label><label>IК max, А <input name="imax" value="${defaults.icMax_A??''}" required></label><label>PК max, Вт <input name="pmax" value="${defaults.pCollectorMax_W??''}" required></label></fieldset><p class="small-note">Предзаполненные ограничения могут быть взяты из модели. Сверьте их с документацией на выбранный транзистор.</p><label>Таблица входной характеристики <input type="file" accept=".txt,.csv,.dat,text/plain,text/csv" data-table></label><label>UБЭ (В), затем IБ (А)<textarea name="input" rows="7" placeholder="0,55&#9;0,000001&#10;0,60&#9;0,00001"></textarea></label><details class="bjt-stage-inputs"><summary>Параметры усилительного каскада (необязательно)</summary><p class="small-note">Введите значения в СИ. Если параметр не задан, связанные расчёты в таблице будут отмечены как недоступные. Cк может быть предзаполнен значением CJC модели — сверьте его с документацией.</p><div class="bjt-stage-grid"><label>R₁, Ом<input name="R1" value="${defaults.stage?.R1_ohm??''}" placeholder="не задано"></label><label>R₂, Ом<input name="R2" value="${defaults.stage?.R2_ohm??''}" placeholder="не задано"></label><label>Cэ, Ф<input name="Ce" value="${defaults.stage?.Ce_F??''}" placeholder="не задано"></label><label>Cр₁, Ф<input name="Cp1" value="${defaults.stage?.Cp1_F??''}" placeholder="не задано"></label><label>Cк, Ф<input name="Ck" value="${defaults.stage?.Ck_F??''}" placeholder="не задано"></label></div></details><p role="alert" class="bjt-graph-error"></p></section><footer><button type="submit">Построить графики</button><button type="button" data-cancel>Отмена</button></footer></form>`;
 if(!dialog.isConnected)document.body.append(dialog);
 dialog.querySelectorAll('[data-cancel]').forEach(el=>el.addEventListener('click',()=>dialog.close()));
 const file=dialog.querySelector<HTMLInputElement>('[data-table]')!,area=dialog.querySelector<HTMLTextAreaElement>('[name=input]')!;
 file.onchange=async()=>{const selected=file.files?.[0];if(selected)area.value=await selected.text();};
 dialog.querySelector('form')!.addEventListener('submit',event=>{event.preventDefault();const error=dialog.querySelector<HTMLElement>('.bjt-graph-error')!;
  try{const form=new FormData(event.currentTarget as HTMLFormElement),value=(n:string)=>Number(String(form.get(n)).trim().replace(',','.'));
   const load={supply_V:value('supply'),rCollector_ohm:value('rk'),rEmitter_ohm:value('re')},limits={uceMax_V:value('umax'),icMax_A:value('imax'),pCollectorMax_W:value('pmax')};
   if(!Object.values(load).every(Number.isFinite)||load.supply_V<=0||load.rCollector_ohm<=0||load.rEmitter_ohm<0)throw Error('Укажите конечные значения EК>0, RК>0 и RЭ≥0.');
   if(!Object.values(limits).every(Number.isFinite)||limits.uceMax_V<=0||limits.icMax_A<=0||limits.pCollectorMax_W<=0)throw Error('Пределы UКЭ, IК и PК должны быть больше нуля.');
   const stage:BjtGraphData['stage']={};for(const [field,key] of [['R1','R1_ohm'],['R2','R2_ohm'],['Ce','Ce_F'],['Cp1','Cp1_F'],['Ck','Ck_F']] as const){const raw=String(form.get(field)??'').trim();if(raw){const n=Number(raw.replace(',','.'));if(!Number.isFinite(n)||n<=0)throw Error(`${field} должно быть больше нуля.`);stage[key]=n;}}
   onApply({load,limits,input5V:parseBjtInputTable(area.value),stage});dialog.close();
  }catch(reason){error.textContent=reason instanceof Error?reason.message:String(reason);}
 });dialog.showModal();
}

export function renderBjtGraphScene(scene:BjtGraphScene,width=1000,height=1050):string {
 const byId=new Map(scene.panels.map(p=>[p.id,p]));let html=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(scene.title)}"><rect width="100%" height="100%" fill="white"/><text x="500" y="25" text-anchor="middle" font-size="16">${esc(scene.title)}</text>`;
 const map=(panel:BjtGraphPanel,p:BjtGraphPoint)=>{const r=panel.rect,xf=(p.x-panel.x.min)/(panel.x.max-panel.x.min),yf=(p.y-panel.y.min)/(panel.y.max-panel.y.min);return{x:r.x+(panel.x.reverse?1-xf:xf)*r.width,y:r.y+(panel.y.reverse?yf:1-yf)*r.height};};
 for(const panel of scene.panels){const r=panel.rect,clip=`bjt-${panel.id}`;html+=`<defs><clipPath id="${clip}"><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"/></clipPath></defs><g data-panel="${panel.id}"><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="none" stroke="#333"/>`;
  for(let i=0;i<=5;i++){const x=r.x+r.width*i/5,y=r.y+r.height*i/5,xv=panel.x.min+(panel.x.max-panel.x.min)*(panel.x.reverse?1-i/5:i/5),yv=panel.y.min+(panel.y.max-panel.y.min)*(panel.y.reverse?i/5:1-i/5);html+=`<path d="M${x},${r.y}V${r.y+r.height}M${r.x},${y}H${r.x+r.width}" stroke="#ddd" stroke-dasharray="3 3"/><text x="${x}" y="${r.y+r.height+14}" text-anchor="middle" font-size="9">${esc(xv.toExponential(1))}</text><text x="${r.x-5}" y="${y+3}" text-anchor="end" font-size="9">${esc(yv.toExponential(1))}</text>`;}
  html+=`<text x="${r.x+r.width/2}" y="${r.y-9}" text-anchor="middle" font-size="12">${esc(panel.title)}</text><text x="${r.x+r.width/2}" y="${r.y+r.height+28}" text-anchor="middle" font-size="10">${esc(panel.xLabel)}</text><text x="${r.x-35}" y="${r.y+r.height/2}" transform="rotate(-90 ${r.x-35} ${r.y+r.height/2})" text-anchor="middle" font-size="10">${esc(panel.yLabel)}</text><g clip-path="url(#${clip})">`;
  for(const series of panel.series){const pts=series.points.map(p=>map(panel,p)).filter(p=>finite(p.x)&&finite(p.y)).map(p=>`${p.x},${p.y}`).join(' ');html+=`<polyline points="${pts}" fill="none" stroke="${series.color??'#1769aa'}" stroke-width="1.35"${series.dash?' stroke-dasharray="5 3"':''} data-series="${esc(series.name)}"/>`;}
  html+='</g>';
  for(const mark of panel.marks??[]){const p=map(panel,mark.point);html+=`<circle cx="${p.x}" cy="${p.y}" r="3.4" fill="${mark.color??'#a22'}"/><text x="${p.x+5}" y="${p.y-4}" font-size="11" fill="${mark.color??'#a22'}">${esc(mark.name)}</text>`;}html+='</g>';
 }
 for(const p of scene.projections){const a=byId.get(p.from),b=byId.get(p.to);if(!a||!b)continue;const x=map(a,p.fromPoint),y=map(b,p.toPoint);html+=`<path d="M${x.x},${x.y}L${y.x},${y.y}" stroke="#555" stroke-dasharray="4 4" fill="none" data-projection="${p.name}"/>`;}
 const outputPanel=scene.panels.find(p=>p.id==='output');
 if(outputPanel){const overlays=outputPanel.series,x=outputPanel.rect.x,y=390,w=420,rows=Math.ceil(overlays.length/2),h=rows*16+12;html+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="white" fill-opacity=".88" stroke="#bbb"/>`;
  overlays.forEach((s,i)=>{const xx=x+Math.floor(i/rows)*210,yy=y+15+(i%rows)*16;const label=s.name.startsWith('IБ=')?'IБ = '+Number((Number(s.name.slice(3).split(' ')[0])*1e6).toPrecision(5))+' мкА':s.name;html+=`<path d="M${xx+6},${yy-3}h19" stroke="${s.color??'#1769aa'}" stroke-width="1.4"${s.dash?' stroke-dasharray="4 2"':''}/><text x="${xx+29}" y="${yy}" font-size="8">${esc(label)}</text>`;});
 }
 for(const panel of scene.panels)for(const c of panel.callouts??[]){const pos=map(panel,{x:c.x,y:c.y}),pts=calloutArrow(c,{xmin:panel.x.min,xmax:panel.x.max,ymin:panel.y.min,ymax:panel.y.max},panel.rect.width,panel.rect.height).map(([x,y])=>map(panel,{x,y}));const w=c.text.length*5.2+8;html+=`<g data-callout="${esc(c.text)}"><polyline points="${pts.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="#222" stroke-width="1.1"/><rect x="${pos.x-3}" y="${pos.y-3}" width="${w}" height="15" fill="white" stroke="#777"/><text x="${pos.x+1}" y="${pos.y+8}" font-size="9">${esc(c.text)}</text></g>`;}
 for(const [i,p] of scene.timePanels.entries()){const r=p.rect,clip=`time-${i}`,loX=0,hiX=.002,py=(v:number)=>r.y+r.height-(v-p.min)/(p.max-p.min)*r.height;html+=`<defs><clipPath id="${clip}"><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}"/></clipPath></defs><g><text x="${r.x+r.width/2}" y="${r.y-9}" text-anchor="middle" font-size="11">${esc(p.title)}</text><rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="none" stroke="#333"/><path d="M${r.x},${r.y+r.height/2}H${r.x+r.width}" stroke="#ddd" stroke-dasharray="3 3"/><text x="${r.x-3}" y="${r.y+r.height/2+3}" text-anchor="end" font-size="8">${((p.min+p.max)/2).toExponential(1)}</text><text x="${r.x+r.width/2}" y="${r.y+r.height+14}" text-anchor="middle" font-size="9">t, с</text><g clip-path="url(#${clip})"><polyline points="${p.points.map(([t,v])=>`${r.x+(t-loX)/(hiX-loX)*r.width},${py(v)}`).join(' ')}" fill="none" stroke="#1769aa" stroke-width="1.2"/></g></g>`;}
 scene.equations.forEach((e,i)=>html+=`<text x="35" y="950" dy="${i*17}" font-size="10">${esc(e)}</text>`);
 scene.notes.forEach((n,i)=>html+=`<text x="35" y="1018" dy="${i*15}" font-size="9">${esc(n)}</text>`);
 return html+'</svg>';
}

