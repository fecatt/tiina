/** Read-only symbol geometry for the observed single-image v66 macro envelope.
 * Its model suffix stays opaque; drawing pin order is NOT SPICE formal pin order.
 * The older LM741 dual-image polygon layout remains in native-macro.ts. */
import type {MacroRecord} from './native-macro.ts';
import {macroGraphics,macroGraphicsSvg,type MacroGraphic} from './native-macro-graphics.ts';
export type {MacroSymbolRectangle} from './native-macro-graphics.ts';

export type MacroSymbolPin={name:string;order:number;localX:number;localY:number;x:number;y:number;direction:number;length:number};
export type NativeMacroSymbol={label:string;uid:string;package:string;modelName:string;symbolId:string;x:number;y:number;labelDx:number;labelDy:number;orientation:number;mirrored:boolean;pinCount:number;pins:MacroSymbolPin[];graphics:MacroGraphic[];symbolOffset:number;symbolEnd:number;orientationOffset:number;labelEnd:number;uidStart:number;uidEnd:number};
const cp=new TextDecoder('windows-1251');
const fail=(message:string):never=>{throw new Error('Непроверенный символ макроса TINA: '+message);};

/** Parse declared arrays from their established header boundaries, without signature scanning. */
export function macroSymbol(record:MacroRecord):NativeMacroSymbol {
 if(record.type!==0x23a||record.version!==66)fail('тип или версия');
 const d=record.data,v=new DataView(d.buffer,d.byteOffset,d.byteLength);
 if(d.length<20||d.length>16*1024*1024)fail('размер записи');
 const need=(p:number,n:number)=>{if(!Number.isSafeInteger(p)||!Number.isSafeInteger(n)||p<0||n<0||p+n>d.length)fail('усечённые данные');};
 const u32=(p:number)=>{need(p,4);return v.getUint32(p,true);};
 const string=(p:number):[string,number]=>{
  need(p,1);const n=d[p];need(p+1,n);if(n<1||d[p+n]!==0)fail('границы строки');
  const text=cp.decode(d.subarray(p+1,p+n));if(/[\x00-\x1f]/.test(text))fail('символы строки');return [text,p+n+1];
 };
 const matches=(p:number,bytes:number[])=>{need(p,bytes.length);return bytes.every((b,i)=>d[p+i]===b);};
 const [label,labelEnd]=string(9),orientationOffset=labelEnd,orientation=d[labelEnd],mirrored=d[labelEnd+1]===1;
 // Byte8 belongs to the independently rotated label, not the symbol/model.
 need(labelEnd,6);if(d[8]>1||orientation>3||d[labelEnd+1]>1)fail('преобразование');
 const pinCount=u32(labelEnd+2);if(pinCount<1||pinCount>256)fail('число выводов');
 const uidStart=labelEnd+6,[uid,uidEnd]=string(uidStart),[pack,propertyEnd]=string(uidEnd);
 if(!uid||!matches(propertyEnd,[0,9,1,23,0]))fail('общий заголовок');
 const [modelName,nameEnd]=string(propertyEnd+5),[symbolId,idEnd]=string(nameEnd);
 if(!modelName||!symbolId)fail('имя символа');
 // Source-path metadata and model instance name are counted strings. The following
 // u32-length parameter text excludes its trailing NUL, unlike the short strings.
 const [,pathEnd]=string(idEnd),[,instanceEnd]=string(pathEnd);
 const parameterBytes=u32(instanceEnd);if(parameterBytes>65535)fail('длина параметров');
 let p=instanceEnd+4;need(p,parameterBytes+1);if(d[p+parameterBytes]!==0)fail('окончание параметров');p+=parameterBytes+1;
 // Observed single-image envelope. A dual-image flag is deliberately refused;
 // flattening both variants would duplicate pins and mix different drawings.
 if(!matches(p,[2,1,1,3,0,0,0,1]))fail('контейнер рисунка');p+=8;
 need(p,1);if(d[p++]!==0)fail('несколько вариантов рисунка');
 const [,imageNameEnd]=string(p),[,imageLabelEnd]=string(imageNameEnd);p=imageLabelEnd;
 // Fixed v66 image metadata contains bounds/label settings; it is preserved, not rewritten.
 need(p,50);p+=50;
 const symbolOffset=p,count=u32(p);p+=4;if(count!==pinCount)fail('число выводов рисунка');
 const pins:MacroSymbolPin[]=[],names=new Set<string>();
 for(let order=0;order<count;order++){
  if(u32(p)!==100||u32(p+4)!==259||u32(p+8)!==42)fail('тип объекта вывода');
  const body=p+12;need(body,42);const n=d[body];if(n<1||n>17)fail('имя вывода');
  const name=cp.decode(d.subarray(body+1,body+1+n));if(/[\x00-\x1f]/.test(name)||names.has(name))fail('неоднозначное имя вывода');names.add(name);
  const localX=v.getInt16(body+21,true),localY=v.getInt16(body+23,true),direction=d[body+20],length=v.getFloat64(body+34,true);
  if(direction>3||!Number.isFinite(length)||length<=0||length>256)fail('геометрия вывода');
  let dx=mirrored?-localX:localX,dy=localY;for(let turn=0;turn<orientation;turn++)[dx,dy]=[dy,-dx];
  pins.push({name,order,localX,localY,x:v.getInt16(0,true)+dx,y:v.getInt16(2,true)+dy,direction,length});p=body+42;
 }
 const drawing=macroGraphics(d,p),graphics=drawing.graphics;p=drawing.end;
 return {label,uid,package:pack,modelName,symbolId,x:v.getInt16(0,true),y:v.getInt16(2,true),labelDx:v.getInt16(4,true),labelDy:v.getInt16(6,true),orientation,mirrored,pinCount,pins,graphics,symbolOffset,symbolEnd:p,orientationOffset,labelEnd,uidStart,uidEnd};
}

/** Local SVG only: caller applies instance translate/rotation/mirror once, as for other symbols. */
export function macroSymbolSvg(symbol:NativeMacroSymbol):string {
 const esc=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const shapes=macroGraphicsSvg(symbol.graphics);
 const pins=symbol.pins.map(pin=>{
  const [dx,dy]=[[1,0],[0,1],[-1,0],[0,-1]][pin.direction],x=pin.localX+dx*pin.length,y=pin.localY+dy*pin.length;
  const tx=x+(dx?dx*3:0),ty=y+(dy?dy*3:3),anchor=dx>0?'start':dx<0?'end':'middle';
  return `<path d="M${pin.localX},${pin.localY}L${x},${y}"/><text x="${tx}" y="${ty}" text-anchor="${anchor}" style="fill:currentColor;stroke:none;font:8px Arial">${esc(pin.name)}</text>`;
 }).join('');
 return shapes+pins;
}
