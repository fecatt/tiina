import type {Curve,Cell} from './solver.ts';
export function transientStats(curve:Curve,vector:string,start:number,stop:number){
 const index=curve.names.indexOf(vector);
 if(index<1||!Number.isFinite(start)||!Number.isFinite(stop)||stop<=start)throw Error('Неверный вектор или интервал измерения');
 const rows=curve.values.map(r=>{if(typeof r[0]!=='number'||typeof r[index]!=='number'||!Number.isFinite(r[0])||!Number.isFinite(r[index]))throw Error('Нужен вещественный переходный сигнал');return [r[0],r[index]] as [number,number];});
 if(rows.length<2||start<rows[0][0]||stop>rows.at(-1)![0]||rows.some((r,i)=>i>0&&r[0]<=rows[i-1][0]))throw Error('Интервал должен находиться внутри возрастающей временной развёртки');
 const at=(t:number)=>{let i=1;while(i<rows.length-1&&rows[i][0]<t)i++;const a=rows[i-1],b=rows[i];return a[1]+(b[1]-a[1])*(t-a[0])/(b[0]-a[0]);};
 const points:[[number,number],...[number,number][]]=[[start,at(start)],...rows.filter(r=>r[0]>start&&r[0]<stop),[stop,at(stop)]];
 let area=0,square=0,min=Infinity,max=-Infinity;
 points.forEach(([t,v],i)=>{min=Math.min(min,v);max=Math.max(max,v);if(i){const [ta,a]=points[i-1],dt=t-ta;area+=dt*(a+v)/2;square+=dt*(a*a+a*v+v*v)/3;}});
 return {min,max,peakToPeak:max-min,mean:area/(stop-start),rms:Math.sqrt(square/(stop-start)),start,stop};
}
/** Every complex column always has two cells, including real-valued samples. */
export function resultCsv(curves:Curve[]):string{
 if(!curves.length)return '';
 const names=curves[0].names;if(curves.some(c=>c.names.join('\0')!==names.join('\0')))throw Error('Разные векторы в кривых');
 const complex=names.map((_,i)=>curves.some(c=>c.values.some(r=>Array.isArray(r[i]))));
 const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
 const rows=[['Параметр',...names.flatMap((n,i)=>complex[i]?[n+' Re',n+' Im']:[n])].map(quote).join(';')];
 for(const c of curves)for(const row of c.values){if(row.length!==names.length)throw Error('Неверная длина строки');rows.push([c.parameter??'',...row.flatMap((v:Cell,i)=>complex[i]?(Array.isArray(v)?v:[v,0]):[v])].join(';'));}
 return '\ufeff'+rows.join('\r\n');
}
