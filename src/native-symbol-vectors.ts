import type {ComponentSymbolState} from './component-symbols.ts';
type Shape={tag:string;points?:number[][];box?:number[];radii?:number[];large?:number;fill?:string;stroke?:string;width?:number;text?:string;color?:string;font?:{height:number;weight:number;angle:number}};
let symbols:Record<string,Shape[]>={};
function joinLeadsToOutline(shapes:Shape[]):Shape[]{
 // GDI's quantised export lets one lead end slightly inside the circle.
 // Trim only lines crossing from outside to inside a transparent outline;
 // internal arrows/waveforms and white-filled meters are unaffected.
 const outlines=shapes.filter(s=>(s.tag==='ellipse'||s.tag==='rect')&&s.fill==='none');
 return shapes.filter(shape=>shape.tag!=='line'||Math.hypot(shape.points![1][0]-shape.points![0][0],shape.points![1][1]-shape.points![0][1])>1e-6).map(shape=>{
  if(shape.tag!=='line')return shape;
  let points=shape.points!;
  for(const outline of outlines){
   const [l,t,r,b]=outline.box!,cx=(l+r)/2,cy=(t+b)/2,rx=(r-l)/2,ry=(b-t)/2;
   const norm=(p:number[])=>outline.tag==='rect'?Math.max(Math.abs((p[0]-cx)/rx),Math.abs((p[1]-cy)/ry)):((p[0]-cx)/rx)**2+((p[1]-cy)/ry)**2;
   const inside=points.map(p=>norm(p)<1-1e-6),outside=points.map(p=>norm(p)>1+1e-6);
   const inner=inside[0]&&outside[1]?0:inside[1]&&outside[0]?1:-1;
   if(inner<0)continue;
   const a=points[1-inner],z=points[inner],dx=(z[0]-a[0])/rx,dy=(z[1]-a[1])/ry,x=(a[0]-cx)/rx,y=(a[1]-cy)/ry;
   const A=dx*dx+dy*dy,B=2*(x*dx+y*dy),C=x*x+y*y-1;
   const fraction=outline.tag==='rect'
    ?Math.max(...[[a[0],z[0]-a[0],l,r],[a[1],z[1]-a[1],t,b]].map(([v,d,low,high])=>Math.abs(d)<1e-9?-Infinity:Math.min((low-v)/d,(high-v)/d)))
    :(-B-Math.sqrt(Math.max(0,B*B-4*A*C)))/(2*A);
   const end=[a[0]+fraction*(z[0]-a[0]),a[1]+fraction*(z[1]-a[1])];
   points=points.map((p,i)=>i===inner?end:p);
  }
  return {...shape,points};
 });
}
export async function loadNativeSymbolVectors(){
 const response=await fetch('/tina/component-symbols.json');
 if(!response.ok)throw Error('Native symbol vectors unavailable');
 const data=await response.json();if(!data.symbols||typeof data.symbols!=='object')throw Error('Invalid native symbol vectors');
 symbols=Object.fromEntries(Object.entries(data.symbols as Record<string,Shape[]>).map(([kind,shapes])=>[kind,joinLeadsToOutline(shapes)]));
}
const pair=(p:number[])=>p.join(',');
export function nativeSymbolVector(kind:string,state?:ComponentSymbolState):string{
 const shapes=symbols[kind];if(!shapes)return '';
 const rotation=((state?.orientation??0)&3)*90,mirror=state?.mirrored?-1:1;
 return `<g data-native-symbol="${kind}" style="stroke:currentColor;stroke-linecap:round;stroke-linejoin:round">`+shapes.map(s=>{
  const style=`stroke-width:1;fill:${s.fill==='#ffffff'?'#ffffff':s.fill&&s.fill!=='none'?'currentColor':'none'}`;
  if(s.tag==='line')return `<path d="M${pair(s.points![0])}L${pair(s.points![1])}" style="${style}"/>`;
  if(s.tag==='polygon'||s.tag==='polyline')return `<${s.tag} points="${s.points!.map(pair).join(' ')}" style="${style}"/>`;
  if(s.tag==='ellipse'||s.tag==='rect'){
   const [l,t,r,b]=s.box!;
   return s.tag==='ellipse'?`<ellipse cx="${(l+r)/2}" cy="${(t+b)/2}" rx="${(r-l)/2}" ry="${(b-t)/2}" style="${style}"/>`:`<rect x="${l}" y="${t}" width="${r-l}" height="${b-t}" style="${style}"/>`;
  }
  if(s.tag==='arc')return `<path d="M${pair(s.points![0])}A${pair(s.radii!)} 0 ${s.large} 0 ${pair(s.points![1])}" style="${style}"/>`;
  if(s.tag==='text'){
   // GDI text starts at its top left. Keep glyph upright under body rotation.
   const [x,y]=s.points![0],f=s.font!,isPlus=s.text==='+';
   const size=isPlus?8:16,cx=isPlus?x+3:0,cy=isPlus?y+5:20;
   return `<g ${isPlus?'data-polarity="positive" data-terminal="0"':''} transform="translate(${cx} ${cy}) scale(${mirror} 1) rotate(${rotation-f.angle})"><text x="0" y="0" text-anchor="middle" dominant-baseline="central" style="stroke:none;fill:${isPlus?s.color:'var(--meter-glyph,#000080)'};font:${f.weight} ${size}px Arial">${s.text}</text></g>`;
  }
  return '';
 }).join('')+'</g>';
}
