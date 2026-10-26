import {readString, type Rec} from './codec.ts';

/** TLC555_ASTABLE.TSC record43, preserved native donor. */
export const DIODE_TEMPLATE='UAFYAQwARwABA0QxAAMAAgAAABlUXzA4QzcxOUEwMjAxMTA2MTYxNjAzMjQAEURPMzUtMTAgKDFONDE0OCkAAAD//wAAAAAAAAAAAAEAAAD/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAQABBzFONDE0OAAJU3RhbmRhcmQAAAAAAAAAAAAAAAAAAAAAAAAAAAAA8D8AAAAAAAAAAAAAAAEAAA==';

/** Verified v66 Standard diode payload; drawing and property tails stay opaque.
 * Evidence: reports/native_component_inference.json, all fourteen v66 records.
 * This reader deliberately makes no claim about anode/cathode drawing order. */
export interface NativeDiode {
 model:string; family:'Standard'; parameterOffset:number;
 embedded:boolean; lines:{text:string;flags:number}[]; group?:string;
 opaqueTail:Uint8Array;
}
export function nativeDiode(record:Rec):NativeDiode {
 if(record.type!==0x218||record.version!==66)throw Error('Поддерживается только диод TSC v66');
 const d=record.data,v=new DataView(d.buffer,d.byteOffset,d.byteLength);
 const bad=()=>{throw Error('Повреждены или не поддерживаются свойства диода TSC');};
 let p:number;
 if(d.length<10)return bad();
 [,p]=readString(d,9);
 if(p+6>d.length||v.getUint32(p+2,true)!==2)return bad();
 p+=6;[,p]=readString(d,p);[,p]=readString(d,p);p+=54;
 if(p>=d.length)return bad();
 const parameterOffset=p;let model:string,family:string;
 [model,p]=readString(d,p);[family,p]=readString(d,p);
 if(family!=='Standard'||p>=d.length||![0,1].includes(d[p]))return bad();
 const embedded=d[p++]===1,lines:{text:string;flags:number}[]=[];
 let group:string|undefined;
 if(embedded){
  if(p+4>d.length)return bad();const count=v.getUint32(p,true);p+=4;
  if(count<1||count>4096||count>(d.length-p)/5)return bad();
  for(let i=0;i<count;i++){
   let text:string;[text,p]=readString(d,p);
   if(p+4>d.length)return bad();const flags=v.getUint32(p,true);p+=4;lines.push({text,flags});
  }
  [group,p]=readString(d,p);
 }
 return {model,family,parameterOffset,embedded,lines,group,opaqueTail:d.slice(p)};
}

/** Export only one literal embedded D model. Never execute arbitrary saved
 * SPICE directives or silently replace catalogue-only TINA models. */
export function embeddedDiodeModel(record:Rec,spiceName:string):string {
 const m=nativeDiode(record);
 if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(spiceName))throw Error('Недопустимое имя модели диода');
 if(!m.embedded)throw Error('Диод '+m.model+' требует модели из каталога TINA; численная совместимость не подтверждена');
 if(m.lines.some(l=>l.flags!==0)||m.group!=='[All]')throw Error('Неизвестные флаги встроенной модели диода');
 const first=m.lines[0].text.match(/^\s*\.model\s+(\S+)\s+D\s*(\(.*)$/i);
 if(!first||first[1].toLowerCase()!==m.model.toLowerCase()||m.lines.slice(1).some(l=>!/^\s*\+/.test(l.text)))throw Error('Нужна одна встроенная SPICE-модель диода D');
 const body=[first[2],...m.lines.slice(1).map(l=>l.text.replace(/^\s*\+/,''))].join(' ');
 // The two native models use only numeric assignments; no functions, comments,
 // expressions, extra statements, or nested parentheses are admitted.
 if(!/^\(\s*(?:[A-Za-z][A-Za-z0-9_]*\s*=\s*[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?[a-z]*\s*)+\)$/i.test(body))throw Error('Неподдерживаемый синтаксис встроенной модели диода');
 return `.model ${spiceName} D ${body}`;
}

/** Catalogue mapping is admitted only where the native PSpice exporter has
 * supplied the exact model. Do not infer the swapped AF/KF catalogue labels. */
export function diodeSpiceModel(record:Rec,spiceName:string):string {
 const m=nativeDiode(record);
 if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(spiceName))throw Error('Недопустимое имя модели диода');
 if(m.embedded)return embeddedDiodeModel(record,spiceName);
 if(m.model==='1N4148')return `.model ${spiceName} D (IS=1e-9 N=1.7 BV=75 IBV=5e-6 RS=.002 CJO=4e-12 VJ=.75 M=.33 FC=.5 TT=25.9e-9 EG=1.11 XTI=3 KF=0 AF=1)`;
 throw Error('Модель диода '+m.model+' пока не сверена с экспортом оригинальной TINA');
}
