import {components,countedString,readString,type Doc,type Rec} from './codec.ts';
export type NativeDc={input:string;start:number;stop:number;intervals:number};
export type NativeControl={source:string;start:number;stop:number;count:number;unit:string};
const view=(d:Uint8Array)=>new DataView(d.buffer,d.byteOffset,d.byteLength);
const join=(...a:Uint8Array[])=>{const out=new Uint8Array(a.reduce((n,b)=>n+b.length,0));let p=0;for(const b of a){out.set(b,p);p+=b.length;}return out;};
const scalarKinds=['V','VS','VG','I','IS','R','C','L'];
function record(doc:Doc,type:number,version:number){const r=doc.records.find(r=>r.type===type);if(!r||r.version!==version)throw Error('Неподдерживаемая версия настроек анализа TSC');return r;}
export function nativeDc(doc:Doc):NativeDc|null{
 try{const r=record(doc,0xf281,19),v=view(r.data);return{input:readString(r.data,36)[0],start:v.getFloat64(12,true),stop:v.getFloat64(20,true),intervals:v.getUint16(0,true)};}catch{return null;}
}
export function setNativeDc(doc:Doc,next:NativeDc){
 if(!Number.isFinite(next.start)||!Number.isFinite(next.stop)||next.stop<=next.start||!Number.isInteger(next.intervals)||next.intervals<1||next.intervals>65535)throw Error('Неверный диапазон развёртки');
 if(!components(doc).some(c=>c.label===next.input&&['V','VS','VG','I','IS'].includes(c.kind)))throw Error('Выберите независимый источник');
 const r=record(doc,0xf281,19),end=readString(r.data,36)[1],d=join(r.data.slice(0,36),countedString(next.input),r.data.slice(end)),v=view(d);
 v.setUint16(0,next.intervals,true);v.setFloat64(12,next.start,true);v.setFloat64(20,next.stop,true);r.data=d;
}
export function nativeControl(doc:Doc):NativeControl|null{
 try{if(record(doc,0xf280,24).data[0]!==2)return null;const r=record(doc,0xf287,18),d=r.data,v=view(d);if(d.length<32||v.getUint16(0,true)!==1||v.getUint16(6,true)!==1||v.getUint16(8,true)!==1||d[28]!==0)return null;
  const c=components(doc).slice().reverse()[v.getUint32(2,true)];if(!c||!scalarKinds.includes(c.kind))return null;
  return{source:c.label,start:v.getFloat64(10,true),stop:v.getFloat64(18,true),count:v.getUint16(26,true),unit:readString(d,29)[0]};
 }catch{return null;}
}
export function setNativeControl(doc:Doc,next:NativeControl|null){
 const r=record(doc,0xf287,18),mode=record(doc,0xf280,24);
 if(mode.data.length!==56)throw Error('Неизвестный блок режима анализа');
 if(!next){r.data=new Uint8Array(2);mode.data=Uint8Array.from(mode.data);mode.data[0]=0;view(mode.data).setFloat64(2,1,true);mode.data[53]=0;return;}
 const list=components(doc).slice().reverse(),index=list.findIndex(c=>c.label===next.source&&scalarKinds.includes(c.kind));
 if(index<0||!Number.isFinite(next.start)||!Number.isFinite(next.stop)||next.start===next.stop||!Number.isInteger(next.count)||next.count<2||next.count>100)throw Error('Неверные параметры семейства');
 const d=join(new Uint8Array(29),countedString(next.unit),new Uint8Array(2)),v=view(d);
 v.setUint16(0,1,true);v.setUint32(2,index,true);v.setUint16(6,1,true);v.setUint16(8,1,true);v.setFloat64(10,next.start,true);v.setFloat64(18,next.stop,true);v.setUint16(26,next.count,true);r.data=d;
 mode.data=Uint8Array.from(mode.data);mode.data[0]=2;view(mode.data).setFloat64(2,next.count,true);mode.data[53]=1;
}
export function nativeControlValues(control:NativeControl){return Array.from({length:control.count},(_,i)=>control.start+(control.stop-control.start)*i/(control.count-1));}

export type NativeAc={start:number;stop:number;intervals:number;logarithmic:boolean};
/** v66 AC settings, checked by independent edits in the original AC dialog. */
export function nativeAc(doc:Doc):NativeAc|null{try{const r=record(doc,0xf282,21),v=view(r.data);if(r.data.length!==91)return null;return{intervals:v.getUint16(0,true),start:v.getFloat64(8,true),stop:v.getFloat64(40,true),logarithmic:r.data[89]===1};}catch{return null;}}
export function setNativeAc(doc:Doc,next:NativeAc){
 if(!Number.isFinite(next.start)||!Number.isFinite(next.stop)||next.start<=0||next.stop<=next.start||!Number.isInteger(next.intervals)||next.intervals<1||next.intervals>65535)throw Error('Неверный диапазон частот');
 const r=record(doc,0xf282,21);if(r.data.length!==91)throw Error('Неизвестный блок частотного анализа');const d=Uint8Array.from(r.data),v=view(d);v.setUint16(0,next.intervals,true);v.setFloat64(8,next.start,true);v.setFloat64(40,next.stop,true);d[89]=next.logarithmic?1:0;r.data=d;
}

export type NativeTransient={start:number;stop:number};
export function nativeTransient(doc:Doc):NativeTransient|null{try{const r=record(doc,0xf283,18),v=view(r.data);if(r.data.length!==30||![1,2,1,1,2,2].every((x,i)=>r.data[i]===x))return null;return{start:v.getFloat64(6,true),stop:v.getFloat64(14,true)};}catch{return null;}}
/** Only the verified DC-bias startup variant is edited; other modes remain opaque. */
export function setNativeTransient(doc:Doc,next:NativeTransient){
 if(!Number.isFinite(next.start)||!Number.isFinite(next.stop)||next.start<0||next.stop<=next.start)throw Error('Неверный диапазон времени');
 if(!nativeTransient(doc))throw Error('Этот режим начальных условий TSC пока не подтверждён');const r=record(doc,0xf283,18),d=Uint8Array.from(r.data),v=view(d);v.setFloat64(6,next.start,true);v.setFloat64(14,next.stop,true);r.data=d;
}
