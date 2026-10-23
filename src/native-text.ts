/** Plain TINA text v257. Uninterpreted formatting and footer bytes are retained. */
import {readString,countedString,type Rec,type Doc} from './codec.ts';
import template from './native-text-template.json' with {type:'json'};
const view=(d:Uint8Array)=>new DataView(d.buffer,d.byteOffset,d.byteLength);
const join=(parts:Uint8Array[])=>{const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let i=0;for(const p of parts){out.set(p,i);i+=p.length;}return out;};
export function textRecord(r:Rec,index=-1){
 if(r.type!==262||r.version!==257||r.data.length<73)throw Error('Неизвестный формат текста');
 const d=r.data,v=view(d),[font,p]=readString(d,49);if(p+16>d.length)throw Error('Неполный шрифт текста');
 const size=v.getUint32(p+4,true),count=v.getUint32(p+12,true);if(!size||size>1000||count>10000)throw Error('Повреждён текст');
 let end=p+16;const lines:string[]=[],flags:Uint8Array[]=[];
 for(let i=0;i<count;i++){let line:string;[line,end]=readString(d,end);if(end+4>d.length)throw Error('Неполная строка текста');lines.push(line);flags.push(d.slice(end,end+4));end+=4;}
 const color=v.getUint32(p,true),cssColor='#'+[color&255,(color>>>8)&255,(color>>>16)&255].map(n=>n.toString(16).padStart(2,'0')).join('');
 return {index,x:v.getInt16(0,true),y:v.getInt16(2,true),font,size,style:v.getUint32(p+8,true),text:lines.join('\n'),lines,flags,fontEnd:p,end,cssColor};
}
export function texts(doc:Doc){return doc.records.flatMap((r,i)=>{try{return [textRecord(r,i)];}catch{return [];}});}
export function updateText(r:Rec,changes:{x?:number;y?:number;text?:string;size?:number;font?:string;color?:string;style?:number}){
 const t=textRecord(r);let d=Uint8Array.from(r.data),v=view(d);
 for(const [key,offset] of [['x',0],['y',2]] as const){const n=changes[key];if(n===undefined)continue;if(!Number.isInteger(n)||n< -32768||n>32767)throw Error('Координата текста вне диапазона TINA');v.setInt16(offset,n,true);v.setInt16(offset+9,n,true);}
 if(changes.size!==undefined){if(!Number.isInteger(changes.size)||changes.size<1||changes.size>72)throw Error('Размер шрифта: целое число от 1 до 72 пунктов');v.setUint32(t.fontEnd+4,changes.size,true);}
 if(changes.style!==undefined){if(!Number.isInteger(changes.style)||changes.style<0||changes.style>15)throw Error('Неизвестное начертание');v.setUint32(t.fontEnd+8,((t.style&~15)|changes.style)>>>0,true);}
 if(changes.color!==undefined){if(!/^#[0-9a-f]{6}$/i.test(changes.color))throw Error('Неверный цвет текста');if(changes.color.toLowerCase()!==t.cssColor){const rgb=changes.color.slice(1).match(/../g)!.map(s=>parseInt(s,16));v.setUint32(t.fontEnd,rgb[0]|rgb[1]<<8|rgb[2]<<16,true);}}
 if(changes.text!==undefined){const lines=changes.text.replace(/\r\n?/g,'\n').split('\n');if(lines.length>1000)throw Error('Слишком много строк');const chunks:Uint8Array[]=[d.slice(0,t.fontEnd+16)];view(chunks[0]).setUint32(t.fontEnd+12,lines.length,true);lines.forEach((line,i)=>chunks.push(countedString(line),t.flags[i]??new Uint8Array(4)));chunks.push(d.slice(t.end));d=join(chunks);}
 if(changes.font!==undefined){if(!changes.font.trim()||changes.font.length>100)throw Error('Укажите название шрифта');d=join([d.slice(0,49),countedString(changes.font),d.slice(t.fontEnd)]);}
 r.data=d;
}
export function newText(x:number,y:number,text:string,size=12):Rec{const r:Rec={type:262,version:257,data:Uint8Array.from(template.hex.match(/../g)!,s=>parseInt(s,16))};updateText(r,{x,y,text,size});return r;}
