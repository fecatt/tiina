import {bjtModels} from './bjt-library.ts';
/** Independent browser codec. Opaque OBSS records are preserved verbatim.
 * Semantic editing is deliberately limited to the explicitly listed v66 symbols. */
import library from './library.json' with { type: 'json' };
import presetData from './presets.json' with { type: 'json' };
import {DIODE_TEMPLATE,diodeSpiceModel} from './native-diode.ts';
import {DIODE_VARIANT_TEMPLATES} from './native-diode-variant-templates.ts';
import {nativeMacro,macroSpiceModel} from './native-macro.ts';
import {macroSymbol} from './native-macro-symbol.ts';
import {nativeConnector} from './native-connector.ts';

export type Point = [number, number];
export type Rec = { type: number; version: number; data: Uint8Array };
export type Doc = { records: Rec[]; trailer: Uint8Array };
export type CircuitComponent = {kind:string;x:number;y:number;label?:string;rotation?:number;value?:number;model?:string;label_dx?:number;label_dy?:number};
export type CircuitSpec = {format:string;name?:string;components:CircuitComponent[];wires:Point[][];analysis?:unknown};
export const presets = presetData as unknown as Record<'output'|'input'|'basics',CircuitSpec>;
export const KINDS: Record<number,string> = {0x203:'GND',0x204:'CONNECTOR',0x205:'PROBE',0x20a:'R',0x20b:'C',0x20c:'L',0x244:'V',0x20f:'VS',0x20e:'I',0x210:'IS',0x211:'VG',0x223:'AM',0x206:'VM',0x207:'AMV',0x218:'D',0x22c:'ZENER',0x241:'SCHOTTKY',0x23a:'MACRO',0x258:'NPN',0x259:'PNP'};
const scalar = new Set(['R','C','L','V','VS','I','IS','VG']);
const magic = Uint8Array.from([79,66,83,83,26,1,0,0,0,0,0]);
const maxSize = 128*1024*1024;
const view = (a:Uint8Array) => new DataView(a.buffer,a.byteOffset,a.byteLength);
const join = (...arrays:Uint8Array[]) => {const b=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let p=0;for(const a of arrays){b.set(a,p);p+=a.length;}return b;};
const from64 = (s:string) => Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const to64 = (a:Uint8Array) => {let s='';for(let p=0;p<a.length;p+=8192)s+=String.fromCharCode(...a.subarray(p,p+8192));return btoa(s);};
function fail(message:string):never {throw new Error(message);}
function i16(n:number) {if(!Number.isInteger(n)||n< -32768||n>32767)fail('Координата должна быть целым числом от −32768 до 32767');return n;}
const cp1251 = new TextDecoder('windows-1251');
const characterBytes = new Map<string,number>();
for(let b=0;b<256;b++)characterBytes.set(cp1251.decode(Uint8Array.of(b)),b);
export function countedString(text:string):Uint8Array {
 if(text.includes('\0')||text.length>254)fail('Недопустимая строка TINA (не более 254 символов)');
 const b=new Uint8Array(text.length+2);b[0]=text.length+1;
 for(let p=0;p<text.length;p++){const n=characterBytes.get(text[p]);if(n===undefined)fail('Символ не поддерживается кодировкой Windows-1251');b[p+1]=n;}return b;
}
export function readString(d:Uint8Array,p:number):[string,number] {
 if(p>=d.length)fail('Отсутствует строка');const end=p+1+d[p];if(end>d.length)fail('Строка выходит за границу записи');
 let tail=end;while(tail>p+1&&d[tail-1]===0)tail--;return [cp1251.decode(d.subarray(p+1,tail)),end];
}
export function decode(bytes:Uint8Array):Doc {
 if(bytes.length>maxSize||!magic.every((n,i)=>bytes[i]===n))fail('Неподдерживаемый заголовок TSC');
 const records:Rec[]=[];const d=view(bytes);let p=magic.length;
 while(p<bytes.length){if(p+8>bytes.length||records.length>=200000)fail('Повреждён заголовок записи');const type=d.getUint16(p,true),version=d.getUint16(p+2,true),size=d.getUint32(p+4,true);const end=p+8+size;if(end>bytes.length)fail('Запись выходит за границы файла');records.push({type,version,data:bytes.slice(p+8,end)});p=end;
  if(type===255){if(version||size)fail('Повреждена конечная запись');const trailer=bytes.slice(p);if(trailer.length>1||(trailer.length===1&&trailer[0]!==255))fail('Неизвестные данные после конца файла');return {records,trailer};}}
 return fail('В файле отсутствует конечная запись');
}
export function encode(doc:Doc):Uint8Array {
 if(!doc.records.length||doc.records.at(-1)!.type!==255||doc.records.length>200000)fail('Конечная запись должна быть последней');
 const total=magic.length+doc.trailer.length+doc.records.reduce((s,r)=>s+8+r.data.length,0);if(total>maxSize)fail('Файл слишком велик');
 const out=new Uint8Array(total);out.set(magic);const d=view(out);let p=magic.length;
 for(const r of doc.records){if(!Number.isInteger(r.type)||r.type<0||r.type>65535||!Number.isInteger(r.version)||r.version<0||r.version>65535)fail('Неверный тип записи');d.setUint16(p,r.type,true);d.setUint16(p+2,r.version,true);d.setUint32(p+4,r.data.length,true);out.set(r.data,p+8);p+=8+r.data.length;}out.set(doc.trailer,p);return out;
}
export type Component = {index:number;record:Rec;kind:string;x:number;y:number;label:string;orientation:number;mirrored:boolean;label_dx:number;label_dy:number;uid:string;package:string;pin_count:number;parameter_offset:number;value?:number;model?:string;orientation_offset:number;label_end:number;uid_start:number;uid_end:number};
const legacyPassiveTypes = new Set([0x203,0x20a,0x20b,0x20c]);
const legacyPassiveVersions = new Set([54,57]);
function macroPresentation(record:Rec){
 try{const m=macroSymbol(record);return {name:m.modelName,parameterOffset:-1,pins:m.pins.map(p=>[p.x,p.y] as Point)};}
 catch{const m=nativeMacro(record);return {name:m.model.subcircuits[0].name,parameterOffset:m.model.offset,pins:m.pins.map(p=>[p.x,p.y] as Point)};}
}
export function component(record:Rec,index=-1):Component {
 if(record.type===0x204)return {...nativeConnector(record),index,record};
 const kind=KINDS[record.type],d=record.data,v=view(d),legacy=legacyPassiveTypes.has(record.type)&&legacyPassiveVersions.has(record.version);if((record.version!==66&&!legacy)||!kind||d.length<10)fail('Тип элемента пока не декодирован');
 let p:number,label='',label_dx=0,label_dy=0,orientation_offset=4,label_end=0;
 if(kind==='GND')p=6;else {label_dx=v.getInt16(4,true);label_dy=v.getInt16(6,true);[label,p]=readString(d,9);label_end=p;orientation_offset=p;p+=2;}
 if(p+4>d.length)fail('Отсутствует число выводов');const pin_count=v.getUint32(p,true);p+=4;
 const uid_start=p;let uid:string;[uid,p]=readString(d,p);const uid_end=p;let pack:string;[pack,p]=readString(d,p);
 const parameter_offset=legacy?p+(kind==='GND'?51:52):p+(['GND','PROBE'].includes(kind)?53:54);if(parameter_offset>d.length)fail('Неполные свойства элемента');
 if(legacy){const expectedPins=kind==='GND'?1:2;if(pin_count!==expectedPins||p+4>d.length||d[p]!==0||d[p+1]!==0||d[p+2]!==255||d[p+3]!==255)fail('Непроверенный вариант legacy элемента');if(kind!=='GND'&&parameter_offset+8>d.length)fail('Неполный номинал legacy элемента');if(kind==='GND'&&parameter_offset!==d.length)fail('Непроверенный хвост legacy земли');}
 const c:Component={index,record,kind,x:v.getInt16(0,true),y:v.getInt16(2,true),label,orientation:d[orientation_offset],mirrored:d[orientation_offset+1]===1,label_dx,label_dy,uid,package:pack,pin_count,parameter_offset,orientation_offset,label_end,uid_start,uid_end};
 if(scalar.has(kind)&&parameter_offset+8<=d.length)c.value=v.getFloat64(parameter_offset,true);
 if(legacy&&kind!=='GND'&&(!Number.isFinite(c.value)||c.value!<=0))fail('Неверный номинал legacy элемента');
 if(['NPN','PNP','D','ZENER','SCHOTTKY'].includes(kind))[c.model]=readString(d,parameter_offset);
 if(kind==='MACRO'){const m=macroPresentation(record);c.model=m.name;c.parameter_offset=m.parameterOffset;}
 if(kind==='PROBE'&&(pin_count!==1||d.length!==parameter_offset+2||d[parameter_offset]!==1||d[parameter_offset+1]!==1))fail('Непроверенная структура пробника напряжения TINA');return c;
}
export function components(doc:Doc):Component[] {return doc.records.flatMap((r,index)=>{if(!KINDS[r.type]||(r.version!==66&&!(legacyPassiveTypes.has(r.type)&&legacyPassiveVersions.has(r.version))))return [];try{return [component(r,index)];}catch{return [];}});}
export type Changes = Partial<Pick<Component,'x'|'y'|'label'|'value'|'uid'|'label_dx'|'label_dy'|'model'|'orientation'|'mirrored'>> & {rotation?:number};
export function updateComponent(doc:Doc,index:number,changes:Changes):void {
 const r=doc.records[index];if(!r)fail('Элемент не найден');const c=component(r,index);let d=Uint8Array.from(r.data),v=view(d);
 v.setInt16(0,i16(changes.x??c.x),true);v.setInt16(2,i16(changes.y??c.y),true);
 const rotation=changes.orientation??changes.rotation;if(rotation!==undefined){if(!Number.isInteger(rotation)||rotation<0||rotation>3)fail('Поддерживаются повороты 0–3');d[c.orientation_offset]=rotation;}
 if(changes.mirrored!==undefined){if(typeof changes.mirrored!=='boolean')fail('Неверное отражение элемента');d[c.orientation_offset+1]=Number(changes.mirrored);}
 if(changes.label_dx!==undefined||changes.label_dy!==undefined){if(c.kind==='GND')fail('У земли нет подписи');v.setInt16(4,i16(changes.label_dx??c.label_dx),true);v.setInt16(6,i16(changes.label_dy??c.label_dy),true);}
 if(changes.value!==undefined){const n=changes.value;if(!scalar.has(c.kind)||!Number.isFinite(n)||(['R','C','L'].includes(c.kind)&&n<=0))fail('Недопустимый номинал');v.setFloat64(c.parameter_offset,n,true);}
 if(changes.uid!==undefined)d=join(d.slice(0,c.uid_start),countedString(changes.uid),d.slice(c.uid_end));
 if(changes.label!==undefined){if(c.kind==='GND')fail('У земли нет подписи');d=join(d.slice(0,9),countedString(changes.label),d.slice(c.label_end));}
 const updated={...r,data:d};if(changes.model!==undefined)useModel(updated,changes.model);if(c.kind==='MACRO')macroPresentation(updated);if(c.kind==='CONNECTOR')nativeConnector(updated);r.data=updated.data;
}
function jsonRecord(r:{type_id:number;version:number;data_b64:string}):Rec {return {type:r.type_id,version:r.version,data:from64(r.data_b64)};}
function useModel(r:Rec,name:string):void {
 if(r.type===0x23a){if(macroPresentation(r).name!==name)fail('Замена модели макроса пока не поддерживается');return;}
 if([0x218,0x22c,0x241].includes(r.type)){if(component(r).model!==name)fail('Замена модели диода пока не поддерживается');return;}
 const c=component(r),models=bjtModels(c.kind),m=models[name];
 if(!m||m.polarity!==c.kind)fail('Эта модель транзистора отсутствует в локальной библиотеке');
 const d=r.data,p=c.parameter_offset;let p1:number;[,p1]=readString(d,p);let p2:number;[,p2]=readString(d,p1);
 const embedded=d[p2]===0&&d[p2+1]===1&&view(d).getUint16(p2+2,true)===304&&p2+308<=d.length;
 const reference=d[p2]===0&&d[p2+1]===0&&view(d).getUint16(p2+2,true)===0;
 if(!embedded&&!reference)fail('Неизвестный формат модели');
 r.data=join(d.slice(0,p),countedString(name),countedString('SPICE-BJT'),Uint8Array.of(0,1,48,1),from64(m.parameters_b64),d.slice(p2+(embedded?308:4)));
}
let counter=0;
/** Creation is driven by admitted native templates, independently of import-only kinds. */
export const CREATABLE_KINDS=[...new Set([...Object.keys(library.components),'D',...Object.keys(DIODE_VARIANT_TEMPLATES)])];
const uid=()=>`T_${(++counter).toString(16).toUpperCase().padStart(8,'0')}20261022000000`;
/** Fresh native placement, shared by the palette and programmatic TSC builds.
 * Imported records keep their own offsets; explicit build offsets win. */
function creationLabel(kind:string):{label_dx?:number;label_dy?:number;direction?:number} {
 if(['R','ZENER','SCHOTTKY'].includes(kind))return {label_dx:8,label_dy:-20,direction:0};
 // AMV uses the fresh native donor; VM shares its drawing family.
 // A separate fresh-VM placement oracle remains pending.
 if(['VM','AMV'].includes(kind))return {label_dx:11,label_dy:31,direction:0};
 if(kind==='VS')return {label_dx:0,label_dy:-34,direction:1};
 if(kind==='VG')return {label_dx:8,label_dy:-12,direction:1};
 return {};
}
function createComponent(s:CircuitComponent):Rec {
 const entry=s.kind==='D'?{record:{type_id:0x218,version:66,data_b64:DIODE_TEMPLATE}}:DIODE_VARIANT_TEMPLATES[s.kind]?{record:DIODE_VARIANT_TEMPLATES[s.kind]}:(library.components as Record<string,{record:{type_id:number;version:number;data_b64:string}}>)[s.kind];if(!entry)fail('Неизвестный вид элемента');
 const r=jsonRecord(entry.record),doc={records:[r],trailer:new Uint8Array()};
 r.data[component(r).orientation_offset+1]=0; // New symbols start unmirrored; imported bytes are preserved.
 const label=creationLabel(s.kind);
 updateComponent(doc,0,{x:s.x,y:s.y,orientation:s.rotation??0,uid:uid(),...(s.kind==='GND'?{}:{label:s.label??s.kind,label_dx:s.label_dx??label.label_dx,label_dy:s.label_dy??label.label_dy}),...(s.value!==undefined?{value:s.value}:{}),...(['NPN','PNP'].includes(s.kind)?{model:s.model??(s.kind==='NPN'?'BF240':'!PNP')}:(s.kind==='D'&&s.model?{model:s.model}:{}))});
 if(label.direction!==undefined)r.data[8]=label.direction;
 return r;
}
export const newUid=()=>`W_${crypto.randomUUID().replace(/-/g,'').slice(0,22)}`;
export function newComponent(kind:string,x:number,y:number,label:string):Rec {
 const r=createComponent({kind,x,y,label});
 updateComponent({records:[r],trailer:new Uint8Array()},0,{uid:newUid(),...(['VS','VG'].includes(kind)?{orientation:3}:{})});
 return r;
}
/** Position is relative to the symbol; label direction has its own native byte. */
export function labelGeometry(c:Component,width=0,height=0){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<0||height<0)fail('Неверный размер подписи');
 // Native WMF oracle: direction 3 has the same upright text anchor as 1.
 // Upper bits are flags, not additional quarter turns of the text rectangle.
 const direction=c.record.data[8]&1;
 const points:Point[]=[[0,0],[width,0],[0,height],[width,height]].map(([a,b])=>{
  for(let i=0;i<direction%4;i++)[a,b]=[b,-a];a+=c.label_dx;b+=c.label_dy;
  if(c.mirrored)a=-a;for(let i=0;i<c.orientation;i++)[a,b]=[b,-a];return [c.x+a,c.y+b];
 });
 const vertical=(c.orientation+direction)%2===1;
 return {x:Math.min(...points.map(p=>p[0])),y:(vertical?Math.max:Math.min)(...points.map(p=>p[1])),angle:vertical?-90:0};
}
export function translateLabel(doc:Doc,index:number,dx:number,dy:number){const c=component(doc.records[index],index);for(let i=0;i<c.orientation;i++)[dx,dy]=[-dy,dx];if(c.mirrored)dx=-dx;updateComponent(doc,index,{label_dx:c.label_dx+dx,label_dy:c.label_dy+dy});}
/** Native left/right actions toggle only the selected label's direction byte. */
export function rotateLabel(doc:Doc,index:number){
 const r=doc.records[index],c=component(r,index);
 if(c.kind==='GND'||!c.label)fail('У элемента нет подписи');
 if(r.data[8]!==0&&r.data[8]!==1)fail('Направление подписи пока не поддерживается');
 const d=Uint8Array.from(r.data);d[8]=1-d[8];r.data=d;
}
export function wirePoints(r:Rec):Point[] {
 const d=r.data,v=view(d);if(r.type!==256||![21,22].includes(r.version)||d.length<10)fail('Неизвестный формат провода');const n=v.getUint16(8,true);if(n<2||n>8192||10+4*n>d.length)fail('Повреждены точки провода');return Array.from({length:n},(_,i)=>[v.getInt16(10+4*i,true),v.getInt16(12+4*i,true)]);
}
export function wires(doc:Doc):{index:number;points:Point[]}[] {return doc.records.flatMap((r,index)=>{if(r.type!==256)return [];try{return [{index,points:wirePoints(r)}];}catch{return [];}});}
export function makeWire(points:Point[],wireUid=newUid()):Rec {
 if(points.length<2||points.length>8192)fail('Провод должен содержать от 2 до 8192 точек');points.forEach((p,i)=>{i16(p[0]);i16(p[1]);if(i&&p[0]===points[i-1][0]&&p[1]===points[i-1][1])fail('Нулевой участок провода');});
 const d=new Uint8Array(10+4*points.length),v=view(d);[...points[0],...points.at(-1)!].forEach((n,i)=>v.setInt16(i*2,n,true));v.setUint16(8,points.length,true);points.forEach(([x,y],i)=>{v.setInt16(10+4*i,x,true);v.setInt16(12+4*i,y,true);});
 return {type:256,version:22,data:join(d,Uint8Array.from([255,255,0,0,0,0,255,255]),countedString(wireUid),Uint8Array.from([1,0,1,0,0,0,0]))};
}
/** Author a junction as separate native wire records. Imported records stay untouched. */
export function addConnectedWire(doc:Doc,points:Point[]):void {
 const same=(a:Point,b:Point)=>a[0]===b[0]&&a[1]===b[1];
 const on=(p:Point,a:Point,b:Point)=>(p[0]-a[0])*(b[1]-a[1])===(p[1]-a[1])*(b[0]-a[0])&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
 const candidate=makeWire(points); // validate before mutation
 const replacements: {index:number;records:Rec[]}[]=[];
 for(let index=0;index<doc.records.length;index++){
  const record=doc.records[index];if(record.type!==256)continue;
  let parts=[wirePoints(record)];
  for(const p of [points[0],points.at(-1)!])parts=parts.flatMap(part=>{
   if(same(p,part[0])||same(p,part.at(-1)!))return [part];
   const j=part.findIndex((b,j)=>j>0&&on(p,part[j-1],b));if(j<1)return [part];
   const left=part.slice(0,j);if(!same(left.at(-1)!,p))left.push(p);
   const right=part.slice(j);if(!same(right[0],p))right.unshift(p);return [left,right];
  });
  if(parts.length===1)continue;
  // Preserve opaque wire properties while assigning fresh object identities to branches.
  const tailStart=10+4*wirePoints(record).length;
  const [,uidEnd]=readString(record.data,tailStart+8);
  const records=parts.map((part,i)=>{const fresh=makeWire(part),geometry=fresh.data.slice(0,10+4*part.length);return {...record,data:join(geometry,record.data.slice(tailStart,tailStart+8),i?countedString(newUid()):record.data.slice(tailStart+8,uidEnd),record.data.slice(uidEnd))};});
  replacements.push({index,records});
 }
 for(const r of replacements.reverse())doc.records.splice(r.index,1,...r.records);
 let insertAt=doc.records.findIndex(r=>r.type>=0xf000);if(insertAt<0)insertAt=doc.records.length-1;doc.records.splice(insertAt,0,candidate);
 mergeAuthoredWire(doc,candidate);
}
/** Native joins consecutive strokes. Only browser W_ identities with identical opaque tails qualify. */
function mergeAuthoredWire(doc:Doc,initial:Rec){
 let current=initial;
 const same=(a:Point,b:Point)=>a[0]===b[0]&&a[1]===b[1];
 const metadata=(r:Rec)=>{const pp=wirePoints(r),start=10+4*pp.length,[id,end]=readString(r.data,start+8);return {pp,start,id,style:Array.from(join(r.data.slice(start,start+8),r.data.slice(end))).join(',')};};
 for(;;){const a=metadata(current);if(!/^W_[0-9a-f]{22}$/.test(a.id))return;let merged=false;
  for(const p of [a.pp[0],a.pp.at(-1)!]){
   if(components(doc).some(c=>pins(c).some(q=>same(p,q))))continue;
   const touching=doc.records.filter(r=>r.type===256).filter(r=>{const pp=wirePoints(r);return same(p,pp[0])||same(p,pp.at(-1)!);});
   if(touching.length!==2)continue;const other=touching.find(r=>r!==current);if(!other)continue;const b=metadata(other);
   if(other.version!==current.version||!/^W_[0-9a-f]{22}$/.test(b.id)||a.style!==b.style)continue;
   const left=same(b.pp.at(-1)!,p)?b.pp:[...b.pp].reverse(),right=same(a.pp[0],p)?a.pp:[...a.pp].reverse();let pp=[...left,...right.slice(1)];
   // Only remove a redundant straight continuation; keep deliberate diagonal/bent geometry.
   const i=left.length-1;if(i>0&&i+1<pp.length){const q=pp[i-1],r=pp[i],s=pp[i+1];if(((q[0]===r[0]&&r[0]===s[0])||(q[1]===r[1]&&r[1]===s[1]))&&r[0]>=Math.min(q[0],s[0])&&r[0]<=Math.max(q[0],s[0])&&r[1]>=Math.min(q[1],s[1])&&r[1]<=Math.max(q[1],s[1]))pp.splice(i,1);}
   if(pp.length>8192)continue;const geometry=makeWire(pp).data.slice(0,10+4*pp.length);other.data=join(geometry,other.data.slice(b.start));doc.records.splice(doc.records.indexOf(current),1);current=other;merged=true;break;
  }
  if(!merged)return;
 }
}
export function build(spec:CircuitSpec):Doc {
 if(spec.format!=='tina-circuit-v1')fail('Неизвестный формат схемы');counter=0;const labels=spec.components.filter(c=>c.kind!=='GND').map(c=>c.label);if(new Set(labels).size!==labels.length)fail('Обозначения элементов должны различаться');
 const defaults=library.document_defaults.map(jsonRecord),cc=spec.components.map(createComponent),ww=(spec.wires??[]).map(p=>makeWire(p,uid()));
 return decode(encode({records:[...defaults.filter(r=>[2,512].includes(r.type)),...ww,...cc,...defaults.filter(r=>![2,512].includes(r.type))],trailer:new Uint8Array()}));
}
/** Stretch unique wire ends; keep shared junctions in place and extend a branch to the moved pin. */
export function moveComponent(doc:Doc,index:number,x:number,y:number,orientation?:number):void {
 const before=pins(component(doc.records[index],index));
 const same=(a:Point,b:Point)=>a[0]===b[0]&&a[1]===b[1];
 const originalWires=doc.records.filter(r=>r.type===256).map(record=>({record,points:wirePoints(record)}));
 const otherPins=components(doc).filter(c=>c.index!==index).flatMap(pins);
 const branches=before.map(p=>{
  // Use the same electrical rule as connectivity(): only record endpoints
  // attach. Crossing a lead or its interior bend must not capture a free pin
  // on the next drag (e.g. the lower terminal of a raised voltmeter).
  const touching=originalWires.filter(w=>same(p,w.points[0])||same(p,w.points.at(-1)!));
  const shared=otherPins.some(q=>same(p,q))||touching.length>1;
  return {connected:touching.length>0||otherPins.some(q=>same(p,q)),shared};
 });
 updateComponent(doc,index,{x,y,orientation});const after=pins(component(doc.records[index],index));
 for(const {record:r,points:pp} of originalWires){
  let changed=false;
  const next=pp.map((p,j)=>{
   // Interior bends are geometry, not electrical attachment points.
   if(j!==0&&j!==pp.length-1)return p;
   const i=before.findIndex(a=>same(a,p));if(i<0||branches[i].shared||same(before[i],after[i]))return p;
   changed=true;return after[i];
  });
  if(!changed)continue;
  const routed:Point[]=[next[0]];
  for(let j=1;j<next.length;j++){
   const a=next[j-1],b=next[j],oldA=pp[j-1],oldB=pp[j];
   if(a[0]!==b[0]&&a[1]!==b[1]){
    const startMoved=j===1&&!same(a,oldA);
    // Preserve the old lead direction at the moved endpoint, as observed
    // in native RC resistor dragging. Existing diagonal segments stay opaque.
    if(oldA[1]===oldB[1])routed.push(startMoved?[b[0],a[1]]:[a[0],b[1]]);
    else if(oldA[0]===oldB[0])routed.push(startMoved?[a[0],b[1]]:[b[0],a[1]]);
   }
   if(!same(routed.at(-1)!,b))routed.push(b);
  }
  if(pp.every((p,j)=>!j||p[0]===pp[j-1][0]||p[1]===pp[j-1][1])){
   // Native removes redundant elbows when the component returns to its
   // old position. Do not normalize imported diagonal geometry.
   for(let j=1;j<routed.length;){
    if(same(routed[j-1],routed[j])){routed.splice(j,1);j=Math.max(1,j-1);continue;}
    if(j+1<routed.length){const a=routed[j-1],b=routed[j],c=routed[j+1];if((a[0]===b[0]&&b[0]===c[0])||(a[1]===b[1]&&b[1]===c[1])){routed.splice(j,1);j=Math.max(1,j-1);continue;}}
    j++;
   }
  }
  if(routed.length===1)routed.push(routed[0]);
  const geometry=new Uint8Array(10+4*routed.length),v=view(geometry);
  [...routed[0],...routed.at(-1)!].forEach((n,i)=>v.setInt16(2*i,i16(n),true));v.setUint16(8,routed.length,true);
  routed.forEach(([a,b],i)=>{v.setInt16(10+4*i,i16(a),true);v.setInt16(12+4*i,i16(b),true);});
  r.data=join(geometry,r.data.subarray(10+4*pp.length));
 }
 for(let i=0;i<before.length;i++)if(branches[i].connected&&branches[i].shared&&!same(before[i],after[i])){
  const route:Point[]=[before[i]];if(before[i][0]!==after[i][0]&&before[i][1]!==after[i][1])route.push([after[i][0],before[i][1]]);route.push(after[i]);
  let insertion=doc.records.findIndex(r=>r.type>=0xf000||r.type===255);if(insertion<0)insertion=doc.records.length;doc.records.splice(insertion,0,makeWire(route));
 }
}
export function pins(c:Component):Point[] {
 if(c.kind==='CONNECTOR')return [[c.x,c.y]];
 if(c.kind==='MACRO')return macroPresentation(c.record).pins;
 if(!Number.isInteger(c.orientation)||c.orientation<0||c.orientation>3)fail('Зеркальное отображение выводов пока не поддерживается');
 const pp:Point[]=['GND','PROBE'].includes(c.kind)?[[0,0]]:['NPN','PNP'].includes(c.kind)?[[16,-24],[-16,0],[16,24]]:['V','VM','AMV'].includes(c.kind)?[[0,0],[0,40]]:[[0,0],[40,0]];
 return pp.map(([a,b])=>{if(c.mirrored)a=-a;for(let k=0;k<c.orientation;k++)[a,b]=[b,-a];return [c.x+a,c.y+b];});
}
export const BJT_FIELDS='IS NF NR RE RC RB VAF VAR ISE ISC ISS NE NC NS BF BR IKF IKR CJC CJE CJS VJC VJE VJS MJC MJE MJS TF TR EG KF AF VCEO VCBO VEBO ICMAX IBMAX PMAX'.split(' ');
export function modelParameters(c:Component):Record<string,number> {
 const d=c.record.data;let p:number;[,p]=readString(d,c.parameter_offset);let family:string;[family,p]=readString(d,p);
 if(family==='SPICE-BJT'&&d[p]===0&&d[p+1]===0&&view(d).getUint16(p+2,true)===0){
  const model=bjtModels(c.kind)[c.model??''];if(!model)fail('Модель отсутствует в локальном каталоге: '+c.model);
  const bytes=from64(model.parameters_b64);if(bytes.length!==304)fail('Неверная длина каталожной модели');
  return Object.fromEntries(BJT_FIELDS.map((name,i)=>[name,view(bytes).getFloat64(i*8,true)]));
 }
 if(family!=='SPICE-BJT'||d[p]!==0||d[p+1]!==1||view(d).getUint16(p+2,true)!==304||p+308>d.length)fail('Модель транзистора пока не поддерживается');
 return Object.fromEntries(BJT_FIELDS.map((s,i)=>[s,view(d).getFloat64(p+4+8*i,true)]));
}
export function connectivity(doc:Doc):{component:Component;nodes:string[]}[] {
 for(const r of doc.records)if(r.type>=0x201&&r.type<0x300)component(r);
 const cc=components(doc),ww=doc.records.filter(r=>r.type===256).map(wirePoints),pp=cc.map(pins),points=new Map<string,Point>();const key=(p:Point)=>p.join(',');
 [...ww.flatMap(w=>[w[0],w.at(-1)!]),...pp.flat()].forEach(p=>points.set(key(p),p));const parent=new Map([...points.keys()].map(k=>[k,k]));
 const find=(k:string):string=>{let root=k;while(parent.get(root)!==root)root=parent.get(root)!;while(parent.get(k)!==k){const next=parent.get(k)!;parent.set(k,root);k=next;}return root;};
 const union=(a:Point,b:Point)=>{const aa=find(key(a)),bb=find(key(b));if(aa!==bb)parent.set(bb,aa);};
 // Native TINA joins separate wire records at their endpoints, not at interior bends/taps.
 // Interior vertices remain geometry only; give each wire its endpoint equivalence.
 for(const w of ww)union(w[0],w.at(-1)!);
 // TJumper labels are net aliases, not unique device references. Native PSpice
 // proves exact repeated labels join otherwise disconnected wire endpoints.
 const namedNets=new Map<string,Point>();cc.forEach((c,i)=>{if(c.kind!=='CONNECTOR'||!c.label)return;const point=pp[i][0],prior=namedNets.get(c.label);if(prior)union(prior,point);else namedNets.set(c.label,point);});
 const ground=cc.flatMap((c,i)=>c.kind==='GND'?[pp[i][0]]:[]);if(!ground.length)fail('В схеме нет общего узла (земли)');ground.slice(1).forEach(p=>union(ground[0],p));const ids=new Map([[find(key(ground[0])),'0']]);
 [...points.values()].sort((a,b)=>a[0]-b[0]||a[1]-b[1]).forEach(p=>{const root=find(key(p));if(!ids.has(root))ids.set(root,String(ids.size));});return cc.map((component,i)=>({component,nodes:pp[i].map(p=>ids.get(find(key(p)))!)}));
}
/** v66 sine/square VG: native properties show float64 resistance after a
 * separate opaque zero byte. Nonzero resistance changes native transient
 * results even though TINA's PSpice exporter omits the series resistor. */
export function generatorResistance(c:Component):number|null {
 const d=c.record.data,p=c.parameter_offset;
 if(c.kind!=='VG'||d.length<p+43||![0,1].includes(d[p+8])||![4,5].includes(d[p+9])||d[p+34]!==0)return null;
 const r=view(d).getFloat64(p+35,true);return Number.isFinite(r)&&r>=0?r:null;
}
export function exportSpice(doc:Doc):{text:string;mapping:{names:Record<string,string>;nodes:Record<string,string[]>}} {
 for(const c of components(doc).filter(c=>c.kind==='MACRO'))try{nativeMacro(c.record);}catch{fail(`Расчёт модели макроса ${c.label} (${c.model??'неизвестна'}) пока не поддерживается. Его символ, выводы и исходная модель сохраняются в TSC для оригинальной TINA.`);}
 const unsupportedDiode=components(doc).find(c=>['ZENER','SCHOTTKY'].includes(c.kind));
 if(unsupportedDiode)fail(`Расчёт и экспорт SPICE: ${unsupportedDiode.kind==='ZENER'?'стабилитрон':'диод Шотки'} ${unsupportedDiode.label}, модель ${unsupportedDiode.model??''} пока не сверена с оригинальной TINA. Редактирование и сохранение TSC доступны.`);
 const rows=['* Independent TINA-compatible editor export','.options TEMP=27'],names:Record<string,string>={},nodes:Record<string,string[]>={},models=new Map<string,string>(),used=new Set<string>();
 const name=(prefix:string,label:string)=>prefix+'_'+label.replace(/[^a-zA-Z0-9_]/g,'_');
 for(const {component:c,nodes:n} of connectivity(doc)){const k=c.kind;if(k==='GND'||k==='CONNECTOR')continue;let label:string;
  if(['R','C','L'].includes(k)){label=name(k,c.label);rows.push(`${label} ${n.join(' ')} ${c.value}`);}
  else if(['V','VS','VG','I','IS'].includes(k)){
   const prefix=['I','IS'].includes(k)?'I':'V';label=name(prefix,c.label);
   const resistance=k==='VG'?generatorResistance(c):0;
   if(resistance===null)fail('Внутреннее сопротивление генератора '+c.label+' пока не распознано');
   if(resistance>0){
    const internal='vg_internal_'+c.index;let resistor='R_vg_series_'+c.index;
    const occupied=new Set(components(doc).filter(c=>c.kind==='R').map(c=>name('R',c.label).toLowerCase()));
    while(occupied.has(resistor.toLowerCase()))resistor+='_';
    rows.push(`${label} ${internal} ${n[1]} DC ${c.value}`,`${resistor} ${internal} ${n[0]} ${resistance}`);
   }else rows.push(`${label} ${n.join(' ')} DC ${c.value}`);
  }
  else if(['AM','AMV'].includes(k)){label=name('VAM',c.label);rows.push(`${label} ${n.join(' ')} 0`);}
  else if(k==='VM'){label=name('VM',c.label);rows.push(`* ${label} measures V(${n.join(',')}); ideal infinite input impedance`);}
  else if(k==='PROBE'){label=name('VP',c.label);rows.push(`* ${label} measures V(${n[0]}); ideal infinite input impedance`);}
  else if(k==='D'){label=name('D',c.label);const m=name('MD',c.model!),text=diodeSpiceModel(c.record,m);if(models.has(m)&&models.get(m)!==text)fail('Разные модели диода с одинаковым именем');models.set(m,text);rows.push(`${label} ${n.join(' ')} ${m}`);}
  else if(k==='MACRO'){label=name('X',c.label);const m=`TM_${c.index}_LM741`;models.set(m,macroSpiceModel(nativeMacro(c.record),m));rows.push(`${label} ${n.join(' ')} ${m}`);}
  else if(['NPN','PNP'].includes(k)){label=name('Q',c.label);const m=name('M',c.model!),p=modelParameters(c);if(p.ISS!==0)fail('Модель с ненулевым током подложки пока не экспортируется');const excluded=['ISS','NS','VCEO','VCBO','VEBO','ICMAX','IBMAX','PMAX'];const text=`.model ${m} ${k} (${Object.entries(p).filter(([key])=>!excluded.includes(key)).map(([key,value])=>`${key}=${value}`).join(' ')})`;if(models.has(m)&&models.get(m)!==text)fail('Разные модели с одинаковым именем');models.set(m,text);rows.push(`${label} ${n.join(' ')} ${m}`);}
  else return fail(`Экспорт элемента ${k} не реализован`);
  if(used.has(label.toLowerCase())||Object.hasOwn(names,c.label))fail('Совпадают обозначения элементов');used.add(label.toLowerCase());names[c.label]=label;nodes[c.label]=n;
 }
 return {text:[...rows,...models.values(),'.op','.end',''].join('\n'),mapping:{names,nodes}};
}
export function toProject(doc:Doc,extra:Record<string,unknown>={}):Record<string,unknown> {return {...extra,format:'tina-obss-lossless-v1',records:doc.records.map(r=>({type_id:r.type,version:r.version,data_b64:to64(r.data)})),trailer_b64:to64(doc.trailer)};}
export function fromProject(project:unknown):Doc {const p=project as {format:string;records:{type_id:number;version:number;data_b64:string}[];trailer_b64?:string};if(p.format!=='tina-obss-lossless-v1'||!Array.isArray(p.records))fail('Неизвестный формат проекта');return decode(encode({records:p.records.map(jsonRecord),trailer:from64(p.trailer_b64??'')}));}
