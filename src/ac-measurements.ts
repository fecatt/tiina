import type {Cell,Curve} from './solver.ts';
const pair=(v:Cell):[number,number]=>typeof v==='number'?[v,0]:v;
export function transferCurve(curve:Curve,output:string,input:string,kind:'H'|'Z'='H'):Curve {
 const oi=curve.names.indexOf(output),ii=curve.names.indexOf(input);
 if(oi<1||ii<1)throw Error('Выберите входной и выходной векторы напряжения');
 return {plot:'Коэффициент передачи',names:[curve.names[0],`${kind}(${output}/${input})`],values:curve.values.map(row=>{
  const [a,b]=pair(row[oi]),[c,d]=pair(row[ii]),scale=Math.max(Math.abs(c),Math.abs(d));
  if(!Number.isFinite(scale)||scale===0)throw Error('Входной сигнал равен нулю: коэффициент передачи не определён');
  const cr=c/scale,di=d/scale,den=cr*cr+di*di;
  const h:[number,number]=[((a/scale)*cr+(b/scale)*di)/den,((b/scale)*cr-(a/scale)*di)/den];
  if(!h.every(Number.isFinite))throw Error('Коэффициент передачи вне числового диапазона');
  return [row[0],h];
 })};
}
/** Crossings relative to the measured peak; no extrapolation outside the sweep. */
export function bandwidth(curve:Curve){
 const points=curve.values.map(row=>{const [a,b]=pair(row[1]);return {f:pair(row[0])[0],db:20*Math.log10(Math.hypot(a,b))};});
 if(!points.length||points.some((p,i)=>!Number.isFinite(p.f)||p.f<=0||(i>0&&p.f<=points[i-1].f)))throw Error('Нужны возрастающие положительные частоты');
 const peakDb=Math.max(...points.map(p=>p.db));
 if(!Number.isFinite(peakDb))throw Error('Нет ненулевого выходного сигнала');
 const target=peakDb-20*Math.log10(Math.SQRT2),crossings:number[]=[];
 for(let i=0;i<points.length;i++){
  const a=points[i];if(a.db===target)crossings.push(a.f);
  if(i===0)continue;const b=points[i-1];
  if(Number.isFinite(a.db)&&Number.isFinite(b.db)&&(a.db-target)*(b.db-target)<0){const t=(target-b.db)/(a.db-b.db);crossings.push(10**(Math.log10(b.f)+t*Math.log10(a.f/b.f)));}
 }
 return {peakDb,targetDb:target,crossings};
}
