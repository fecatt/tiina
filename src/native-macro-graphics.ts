/** Declared native symbol drawing arrays, independent of model data and image selection.
 * 102 rectangle: DAC6311 XML; 104 polygon / 103 text: LM741 first-image XML.
 * Unknown primitives, fills, text scales and framing are rejected explicitly. */
export type MacroGraphicBounds={x1:number;y1:number;x2:number;y2:number};
export type MacroSymbolRectangle=MacroGraphicBounds&{kind:'rectangle';stroke:string;fill:string;width:number};
export type MacroSymbolPolygon=MacroGraphicBounds&{kind:'polygon';points:[number,number][];stroke:string;fill:'none';width:number};
export type MacroSymbolText=MacroGraphicBounds&{kind:'text';text:string;x:number;y:number;fontName:string;fontSize:number;bold:boolean;italic:boolean;color:string};
export type MacroGraphic=MacroSymbolRectangle|MacroSymbolPolygon|MacroSymbolText;
const cp=new TextDecoder('windows-1251');
const fail=(reason:string):never=>{throw new Error('Непроверенный символ макроса TINA: '+reason);};
const color=(value:number)=>{if(value>0xffffff)fail('цвет графического объекта');return '#'+[value&255,(value>>>8)&255,(value>>>16)&255].map(b=>b.toString(16).padStart(2,'0')).join('');};

/** Offset points at u32 count; each following object has u32 type/version/bodySize. */
export function macroGraphics(data:Uint8Array,offset:number):{graphics:MacroGraphic[];end:number} {
 const v=new DataView(data.buffer,data.byteOffset,data.byteLength);
 const need=(p:number,n:number)=>{if(!Number.isSafeInteger(p)||!Number.isSafeInteger(n)||p<0||n<0||p+n>data.length)fail('усечённые данные');};
 const u32=(p:number)=>{need(p,4);return v.getUint32(p,true);};
 let p=offset;const count=u32(p);p+=4;if(count<1||count>256)fail('число графических объектов');
 const graphics:MacroGraphic[]=[];
 for(let i=0;i<count;i++){
  const type=u32(p),version=u32(p+4),size=u32(p+8),body=p+12;
  if(version!==259||![102,103,104].includes(type))fail('неподдержанный графический объект');
  if(size>65535)fail('размер графического объекта');need(body,size);const end=body+size;
  if(type===102){
   if(size!==19)fail('размер прямоугольника');
   if(data[body]!==0||u32(body+13)!==65535)fail('стиль прямоугольника');
   const x1=v.getInt16(body+1,true),y1=v.getInt16(body+3,true),x2=v.getInt16(body+5,true),y2=v.getInt16(body+7,true),width=v.getUint16(body+17,true);
   if(x1>=x2||y1>=y2||width<1||width>16)fail('геометрия прямоугольника');
   graphics.push({kind:'rectangle',x1,y1,x2,y2,stroke:color(u32(body+9)),fill:'#ffff00',width});
  }else if(type===104){
   if(size<32||u32(body+12)!==0xfffffffe)fail('стиль многоугольника');
   const x1=v.getInt16(body,true),y1=v.getInt16(body+2,true),x2=v.getInt16(body+4,true),y2=v.getInt16(body+6,true),width=v.getUint16(body+16,true),n=v.getUint16(body+18,true);
   if(n<3||n>256||size!==20+n*4||x1>=x2||y1>=y2||width<1||width>16)fail('геометрия многоугольника');
   const points:[number,number][]=[];
   for(let j=0;j<n;j++){const x=x1+v.getInt16(body+20+j*4,true),y=y1+v.getInt16(body+22+j*4,true);if(x<x1||x>x2||y<y1||y>y2)fail('вершина многоугольника');points.push([x,y]);}
   graphics.push({kind:'polygon',x1,y1,x2,y2,points,stroke:color(u32(body+8)),fill:'none',width});
  }else{
   let q=body;
   // Unlike the envelope strings, drawing text/font lengths exclude the NUL.
   const textString=()=>{if(q>=end)fail('строка графического текста');const n=data[q++];if(q+n>=end||data[q+n]!==0)fail('строка графического текста');const value=cp.decode(data.subarray(q,q+n));q+=n+1;if(/[\x00-\x1f]/.test(value))fail('символы графического текста');return value;};
   const text=textString(),fontName=textString();
   if(!fontName||q+18!==end)fail('размер графического текста');
   const x=v.getInt16(q,true),y=v.getInt16(q+2,true),scale=v.getFloat64(q+4,true),bold=data[q+12],italic=data[q+13];
   // Native first-image oracle establishes scale1 → fontsize11; other scales
   // need a separate unit conversion proof rather than an assumed multiplier.
   if(scale!==1||bold>1||italic>1)fail('стиль графического текста');
   graphics.push({kind:'text',x1:x,y1:y,x2:x,y2:y,text,x,y,fontName,fontSize:11,bold:bold===1,italic:italic===1,color:color(u32(q+14))});
  }
  p=end;
 }
 return {graphics,end:p};
}

/** Local SVG. Text coordinates follow native XML's top-edge legend convention. */
export function macroGraphicsSvg(graphics:MacroGraphic[]):string {
 const esc=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 return graphics.map(g=>{
  if(g.kind==='rectangle')return `<rect x="${g.x1}" y="${g.y1}" width="${g.x2-g.x1}" height="${g.y2-g.y1}" fill="${g.fill}" stroke="${g.stroke}" stroke-width="${g.width}"/>`;
  if(g.kind==='polygon')return `<polygon points="${g.points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${g.stroke}" stroke-width="${g.width}"/>`;
  return `<text x="${g.x}" y="${g.y}" dominant-baseline="text-before-edge" fill="${g.color}" stroke="none" font-family="${esc(g.fontName)}" font-size="${g.fontSize}" font-weight="${g.bold?'bold':'normal'}" font-style="${g.italic?'italic':'normal'}">${esc(g.text)}</text>`;
 }).join('');
}
