import type {Curve,Cell} from './solver.ts';
import type {PlotAxisSettings} from './plot-settings.ts';
const real=(v:Cell)=>Array.isArray(v)?v[0]:v;
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function axisNumber(value:number,a:PlotAxisSettings){
 const v=value/a.divisor;if(a.format==='exponential')return v.toExponential(a.precision);
 if(a.format==='decimal')return v.toFixed(a.precision);
 const exponent=v?Math.max(-15,Math.min(12,Math.floor(Math.log10(Math.abs(v))/3)*3)):0;
 const prefixes:Record<number,string>={[-15]:'f',[-12]:'p',[-9]:'n',[-6]:'µ',[-3]:'m',0:'',3:'k',6:'M',9:'G',12:'T'};
 return (v/10**exponent).toFixed(a.precision)+prefixes[exponent];
}
export function curvePoint(curve:Curve,vector:string,x:number,value:(v:Cell)=>number){
 const col=curve.names.indexOf(vector),rows=curve.values;if(col<0||!rows.length)return null;
 let lo=0,hi=rows.length-1;x=Math.max(real(rows[0][0]),Math.min(real(rows[hi][0]),x));
 while(hi-lo>1){const mid=(lo+hi)>>1;if(real(rows[mid][0])<x)lo=mid;else hi=mid;}
 const a=rows[lo],b=rows[hi],dx=real(b[0])-real(a[0]),f=dx?(x-real(a[0]))/dx:0;
 return {x,y:value(a[col])+f*(value(b[col])-value(a[col]))};
}
export function curveXAtY(curve:Curve,vector:string,y:number,value:(v:Cell)=>number,near?:number|null){
 const col=curve.names.indexOf(vector),roots:number[]=[];if(col<0)throw Error('Кривая не найдена');
 for(let i=1;i<curve.values.length;i++){const a=curve.values[i-1],b=curve.values[i],ya=value(a[col]),yb=value(b[col]);if(y>=Math.min(ya,yb)&&y<=Math.max(ya,yb)&&ya!==yb)roots.push(real(a[0])+(y-ya)/(yb-ya)*(real(b[0])-real(a[0])));}
 if(!roots.length)throw Error('Заданное значение Y находится вне кривой');
 return near==null?roots[0]:roots.reduce((a,b)=>Math.abs(a-near)<Math.abs(b-near)?a:b);
}
function bounds(values:number[],a:PlotAxisSettings,zero:boolean){
 const valid=values.filter(v=>Number.isFinite(v)&&(a.scale!=='log'||v>0));let min=a.min??valid.reduce((a,b)=>Math.min(a,b),Infinity),max=a.max??valid.reduce((a,b)=>Math.max(a,b),-Infinity);
 if(!Number.isFinite(min)||!Number.isFinite(max)){min=a.scale==='log'?1:0;max=a.scale==='log'?10:1;}
 if(a.min===null&&a.scale==='linear'&&zero&&min>=-Math.abs(max)*1e-9)min=0;
 if(min===max)max=min+(Math.abs(min)||1)*.1;
 if(a.rounded&&a.scale==='linear'){
  const raw=(max-min)/(a.ticks-1),power=10**Math.floor(Math.log10(raw)),unit=raw/power,step=([1,2,2.5,5,10].find(n=>n>=unit)??10)*power;
  min=Math.floor(min/step)*step;max=Math.ceil(max/step)*step;
 }
 if(a.scale==='log'&&min<=0)min=valid.filter(v=>v>0).reduce((a,b)=>Math.min(a,b),Infinity);
 return [min,max];
}
export function renderScientificPlot(curves:Curve[],vector:string,axes:{x:PlotAxisSettings;y:PlotAxisSettings},value:(v:Cell)=>number,colors:string[],cursors:{x:number|null;curve:number;name:string;color:string}[],height=550){
 const xs=curves.flatMap(c=>c.values.map(r=>real(r[0]))),ys=curves.flatMap(c=>{const j=c.names.indexOf(vector);return j<0?[]:c.values.map(r=>value(r[j]));});
 const [xmin,xmax]=bounds(xs,axes.x,false),[ymin,ymax]=bounds(ys,axes.y,true);
 const top=40,bottom=height-60,plotHeight=bottom-top,clipId=`plot-data-clip-${height}`,ylabelY=(top+bottom)/2;
 const tx=(n:number)=>axes.x.scale==='log'?Math.log10(Math.max(1e-300,n)):n,ty=(n:number)=>axes.y.scale==='log'?Math.log10(Math.max(1e-300,n)):n;
 const lx=tx(xmin),hx=tx(xmax),ly=ty(ymin),hy=ty(ymax),xp=(x:number)=>85+(tx(x)-lx)/(hx-lx)*875,yp=(y:number)=>bottom-(ty(y)-ly)/(hy-ly)*plotHeight;
 let html=`<defs><clipPath id="${clipId}"><rect x="85" y="${top}" width="875" height="${plotHeight}"/></clipPath></defs><rect width="1000" height="${height}" fill="white"/>`;
 for(let i=0;i<axes.x.ticks;i++){const f=i/(axes.x.ticks-1),x=85+f*875,n=axes.x.scale==='log'?10**(lx+f*(hx-lx)):xmin+f*(xmax-xmin);html+=`<path d="M${x},${top}V${bottom}" stroke="#ccc" stroke-dasharray="3 3"/><text data-axis="x" x="${x}" y="${bottom+20}" text-anchor="middle" font-size="12">${esc(axisNumber(n,axes.x))}</text>`;}
 for(let i=0;i<axes.y.ticks;i++){const f=i/(axes.y.ticks-1),y=bottom-f*plotHeight,n=axes.y.scale==='log'?10**(ly+f*(hy-ly)):ymin+f*(ymax-ymin);html+=`<path d="M85,${y}H960" stroke="#ccc" stroke-dasharray="3 3"/><text data-axis="y" x="76" y="${y+4}" text-anchor="end" font-size="12">${esc(axisNumber(n,axes.y))}</text>`;}
 html+=`<path d="M85,${top}V${bottom}H960" stroke="#333" fill="none"/><g clip-path="url(#${clipId})">`;
 curves.forEach((c,i)=>{const j=c.names.indexOf(vector);if(j<0)return;const p=c.values.filter(r=>Number.isFinite(value(r[j]))&&(axes.y.scale!=='log'||value(r[j])>0)).map(r=>`${xp(real(r[0])).toFixed(3)},${yp(value(r[j])).toFixed(3)}`).join(' ');html+=`<polyline data-curve="${i}" points="${p}" fill="none" stroke="${colors[i%colors.length]}" stroke-width="1.1"/>`;});
 for(const c of cursors){if(c.x===null)continue;const point=curvePoint(curves[c.curve]??curves[0],vector,c.x,value);if(!point)continue;const x=xp(point.x),y=yp(point.y);html+=`<path d="M${x},${top}V${bottom}M85,${y}H960" stroke="${c.color}" stroke-dasharray="4 3"/><circle cx="${x}" cy="${y}" r="3" fill="${c.color}"/><text x="${x+5}" y="${top+14}" fill="${c.color}" font-size="13">${c.name}</text>`;}
 html+=`</g><text data-axis="x" x="520" y="${height-10}" text-anchor="middle" font-size="14">${esc(axes.x.title)}</text><text data-axis="y" x="18" y="${ylabelY}" transform="rotate(-90 18 ${ylabelY})" text-anchor="middle" font-size="14">${esc(axes.y.title)}</text>`;
 return {html,xAt:(fraction:number)=>axes.x.scale==='log'?10**(lx+fraction*(hx-lx)):xmin+fraction*(xmax-xmin)};
}
