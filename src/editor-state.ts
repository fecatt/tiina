/** Reversible editor operations. Only explicitly understood component/wire records move. */
import {decode,encode,component,components,wirePoints,pins,updateComponent,makeWire,newUid,readString,countedString,type Doc,type Rec,type Point} from './codec.ts';
import {textRecord,updateText} from './native-text.ts';

export interface Snapshot {bytes:Uint8Array;analysis?:unknown;name?:string}
const cloneSnapshot=(s:Snapshot):Snapshot=>({bytes:s.bytes.slice(),...(s.analysis===undefined?{}:{analysis:structuredClone(s.analysis)}),...(s.name===undefined?{}:{name:s.name})});
export function captureSnapshot(doc:Doc,analysis?:unknown,name?:string):Snapshot {return cloneSnapshot({bytes:encode(doc),analysis,name});}
export class History {
  private past:Snapshot[]=[];private future:Snapshot[]=[];readonly limit:number;
  constructor(limit=60){if(!Number.isInteger(limit)||limit<1||limit>60)throw Error('История должна содержать от 1 до 60 действий');this.limit=limit;}
  get canUndo(){return this.past.length>0;}get canRedo(){return this.future.length>0;}
  get undoCount(){return this.past.length;}get redoCount(){return this.future.length;}
  push(before:Snapshot){this.past.push(cloneSnapshot(before));if(this.past.length>this.limit)this.past.shift();this.future=[];}
  undo(current:Snapshot):Snapshot|null {const previous=this.past.pop();if(!previous)return null;this.future.push(cloneSnapshot(current));return cloneSnapshot(previous);}
  redo(current:Snapshot):Snapshot|null {const next=this.future.pop();if(!next)return null;this.past.push(cloneSnapshot(current));if(this.past.length>this.limit)this.past.shift();return cloneSnapshot(next);}
  reset(){this.past=[];this.future=[];}
}
export interface SelectionClipboard {format:'tina-web-selection-v1';records:Rec[]}
const cloneRecord=(r:Rec):Rec=>({type:r.type,version:r.version,data:r.data.slice()});
const dataView=(a:Uint8Array)=>new DataView(a.buffer,a.byteOffset,a.byteLength);
const join=(...chunks:Uint8Array[])=>{const out=new Uint8Array(chunks.reduce((n,b)=>n+b.length,0));let p=0;for(const b of chunks){out.set(b,p);p+=b.length;}return out;};
const same=(a:Point,b:Point)=>a[0]===b[0]&&a[1]===b[1];
const onSegment=(p:Point,a:Point,b:Point)=>(p[0]-a[0])*(b[1]-a[1])===(p[1]-a[1])*(b[0]-a[0])&&p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);
const onWire=(p:Point,pp:Point[])=>pp.some((b,i)=>i>0&&onSegment(p,pp[i-1],b));
function coordinate(n:number){if(!Number.isInteger(n)||n< -32768||n>32767)throw Error('Координата выходит за диапазон TINA: от −32768 до 32767');return n;}
function delta(dx:number,dy:number){if(!Number.isInteger(dx)||!Number.isInteger(dy))throw Error('Смещение должно быть целым числом');}
function requireEditable(r:Rec){if(r.type===262){textRecord(r);return;}if(r.type===256){wirePoints(r);wireUidBounds(r);return;}component(r);}
function indicesOf(doc:Doc,indices:Iterable<number>):number[]{const result=[...new Set(indices)].sort((a,b)=>a-b);for(const i of result){if(!Number.isInteger(i)||i<0||i>=doc.records.length)throw Error('Выбранный объект отсутствует');requireEditable(doc.records[i]);}return result;}
/** Select all drawable records supported by this editor; analysis/opaque metadata remain untouched. */
export function selectAll(doc:Doc):number[]{const found:number[]=[];doc.records.forEach((r,i)=>{try{requireEditable(r);found.push(i);}catch{/* Opaque records are preserved, but cannot be transformed. */}});return found;}
export function copySelection(doc:Doc,indices:Iterable<number>):SelectionClipboard {return {format:'tina-web-selection-v1',records:indicesOf(doc,indices).map(i=>cloneRecord(doc.records[i]))};}
/** Select a degree-two wire chain as one gesture, without rewriting native records. */
export function wireChain(doc:Doc,index:number):number[]{
 if(doc.records[index]?.type!==256)return [index];
 const ww=doc.records.flatMap((r,i)=>{if(r.type!==256)return [];try{const pp=wirePoints(r);return [{i,r,pp,ends:[pp[0],pp.at(-1)!]}];}catch{return [];}}),cc=components(doc).flatMap(pins),chosen=new Set([index]),queue=[index];
 const style=(w:typeof ww[number])=>Array.from(w.r.data.subarray(10+4*w.pp.length,18+4*w.pp.length)).join(',');
 while(queue.length){const next=queue.shift();const w=ww.find(w=>w.i===next)!;for(const p of w.ends){if(cc.some(q=>same(p,q)))continue;const adjacent=ww.filter(o=>o.ends.some(q=>same(p,q)));if(adjacent.length!==2)continue;const other=adjacent.find(o=>o.i!==w.i)!;if(other.r.version!==w.r.version||style(other)!==style(w)||chosen.has(other.i))continue;chosen.add(other.i);queue.push(other.i);}}
 return [...chosen].sort((a,b)=>a-b);
}
function wireUidBounds(r:Rec):[number,number]{const points=wirePoints(r),start=10+4*points.length+8;const [,end]=readString(r.data,start);return [start,end];}
function translateWire(r:Rec,dx:number,dy:number){const pp=wirePoints(r).map(([x,y])=>[coordinate(x+dx),coordinate(y+dy)] as Point),d=r.data.slice(),v=dataView(d);[...pp[0],...pp.at(-1)!].forEach((n,i)=>v.setInt16(2*i,n,true));pp.forEach(([x,y],i)=>{v.setInt16(10+4*i,x,true);v.setInt16(12+4*i,y,true);});r.data=d;}
function setWireUid(r:Rec,uid:string){const [start,end]=wireUidBounds(r);r.data=join(r.data.slice(0,start),countedString(uid),r.data.slice(end));}
function insertionIndex(doc:Doc){const i=doc.records.findIndex(r=>r.type>=0xf000||r.type===255);return i<0?doc.records.length:i;}
function commit(doc:Doc,staged:Doc){encode(staged);doc.records=staged.records;doc.trailer=staged.trailer;}
/** Native single-wire gesture stretches the grabbed orthogonal segment, keeping remote bends. */
export function dragWireSegment(doc:Doc,index:number,segment:number,dx:number,dy:number){
 delta(dx,dy);const staged=decode(encode(doc)),r=staged.records[index],old=wirePoints(r);
 if(!Number.isInteger(segment)||segment<0||segment>=old.length-1)throw Error('Участок провода отсутствует');
 const a=old[segment],b=old[segment+1];
 if(a[0]!==b[0]&&a[1]!==b[1]){translateSelection(doc,[index],dx,dy);return;}
 if(a[1]===b[1])dx=0;else dy=0;
 if(!dx&&!dy)return;
 const pp=old.map(p=>[...p] as Point);
 for(const i of [segment,segment+1])pp[i]=[coordinate(old[i][0]+dx),coordinate(old[i][1]+dy)];
 const fixed=(p:Point)=>components(staged).some(c=>pins(c).some(q=>same(p,q)))||staged.records.some((other,i)=>{if(i===index||other.type!==256)return false;const w=wirePoints(other);return same(w[0],p)||same(w.at(-1)!,p);});
 if(segment===0&&fixed(old[0]))pp.unshift(old[0]);
 if(segment===old.length-2&&fixed(old.at(-1)!))pp.push(old.at(-1)!);
 for(let i=1;i<pp.length;)if(same(pp[i-1],pp[i]))pp.splice(i,1);else if(i<pp.length-1&&((pp[i-1][0]===pp[i][0]&&pp[i][0]===pp[i+1][0])||(pp[i-1][1]===pp[i][1]&&pp[i][1]===pp[i+1][1])))pp.splice(i,1);else i++;
 if(pp.length<2)throw Error('Перемещение сворачивает провод в точку');
 r.data=join(makeWire(pp).data.slice(0,10+4*pp.length),r.data.slice(10+4*old.length));commit(doc,staged);
}
function uniqueLabel(label:string,used:Set<string>){let candidate=label;const taken=(s:string)=>used.has(s.toLocaleLowerCase());if(taken(candidate)){const m=label.match(/^(.*?)(\d+)$/),prefix=m?m[1]:label+'_';let n=m?BigInt(m[2])+1n:2n;do{const suffix=String(n++);candidate=prefix.slice(0,254-suffix.length)+suffix;}while(taken(candidate));}used.add(candidate.toLocaleLowerCase());return candidate;}

/** Clone raw properties, assign fresh identity, and insert before native analysis settings. */
export function pasteSelection(doc:Doc,clipboard:SelectionClipboard,dx=16,dy=16):number[]{
  delta(dx,dy);if(clipboard.format!=='tina-web-selection-v1'||!Array.isArray(clipboard.records))throw Error('Неверный буфер схемы');
  clipboard.records.forEach(requireEditable);const staged=decode(encode(doc)),records=clipboard.records.map(cloneRecord);
  const used=new Set(components(staged).filter(c=>c.kind!=='GND').map(c=>c.label.toLocaleLowerCase()));
  for(const r of records){if(r.type===262){const t=textRecord(r);updateText(r,{x:coordinate(t.x+dx),y:coordinate(t.y+dy)});}else if(r.type===256){translateWire(r,dx,dy);setWireUid(r,newUid());}else{const c=component(r);updateComponent({records:[r],trailer:new Uint8Array()},0,{x:coordinate(c.x+dx),y:coordinate(c.y+dy),uid:newUid(),...(c.kind==='GND'?{}:{label:uniqueLabel(c.label,used)})});}}
  const at=insertionIndex(staged);staged.records.splice(at,0,...records);commit(doc,staged);return records.map((_,i)=>at+i);
}

/** Move a group simultaneously. Fixed geometry retains its junctions; cut connections stretch via one bridge per junction. */
export function translateSelection(doc:Doc,indices:Iterable<number>,dx:number,dy:number):number[]{
  delta(dx,dy);const selected=indicesOf(doc,indices);if(!selected.length||(!dx&&!dy))return selected;
  const staged=decode(encode(doc)),chosen=new Set(selected),all=selectAll(staged);
  const geometries=all.filter(index=>staged.records[index].type!==262).map(index=>{const r=staged.records[index];if(r.type===256){const pp=wirePoints(r);return {index,wire:pp,points:[pp[0],pp.at(-1)!]};}return {index,wire:null,points:pins(component(r,index))};});
  const candidates=new Map<string,Point>();for(const g of geometries)for(const p of g.points)candidates.set(p.join(','),p);
  const touches=(g:typeof geometries[number],p:Point)=>g.points.some(q=>same(p,q));
  const boundary:Point[]=[];for(const p of candidates.values())if(geometries.some(g=>chosen.has(g.index)&&touches(g,p))&&geometries.some(g=>!chosen.has(g.index)&&touches(g,p)))boundary.push(p);
  if(selected.every(i=>staged.records[i].type===256)){
   // Drag wire geometry while its external electrical terminals stay anchored.
   for(const index of selected){const r=staged.records[index],old=wirePoints(r),pp=old.map(([x,y])=>[coordinate(x+dx),coordinate(y+dy)] as Point);
    for(const end of [0,old.length-1]){const p=old[end];if(!boundary.some(q=>same(p,q)))continue;const start=end===0,j=start?1:pp.length-2,next=pp[j],neighbor=old[start?1:old.length-2];pp[start?0:pp.length-1]=p;
     if(p[0]!==next[0]&&p[1]!==next[1]&&(neighbor[0]===p[0]||neighbor[1]===p[1])){const corner:Point=neighbor[1]===p[1]?[p[0],next[1]]:[next[0],p[1]];pp.splice(start?1:pp.length-1,0,corner);}
    }
    if(old.every((p,i)=>!i||p[0]===old[i-1][0]||p[1]===old[i-1][1]))for(let i=1;i<pp.length;){if(same(pp[i-1],pp[i])){pp.splice(i,1);i=Math.max(1,i-1);continue;}if(i+1<pp.length){const a=pp[i-1],b=pp[i],c=pp[i+1];if((a[0]===b[0]&&b[0]===c[0])||(a[1]===b[1]&&b[1]===c[1])){pp.splice(i,1);i=Math.max(1,i-1);continue;}}i++;}
    if(pp.length<2||pp.length>8192)throw Error('Перемещение создаёт вырожденный провод');const geometry=makeWire(pp).data.slice(0,10+4*pp.length);r.data=join(geometry,r.data.slice(10+4*old.length));
   }
   commit(doc,staged);return selected;
  }
  for(const index of selected){const r=staged.records[index];if(r.type===262){const t=textRecord(r);updateText(r,{x:coordinate(t.x+dx),y:coordinate(t.y+dy)});}else if(r.type===256)translateWire(r,dx,dy);else{const c=component(r,index);updateComponent(staged,index,{x:coordinate(c.x+dx),y:coordinate(c.y+dy)});}}
  const branches=boundary.map(p=>{const end:Point=[coordinate(p[0]+dx),coordinate(p[1]+dy)],route:Point[]=[p];if(dx&&dy)route.push([end[0],p[1]]);route.push(end);return makeWire(route);});
  staged.records.splice(insertionIndex(staged),0,...branches);commit(doc,staged);return selected;
}
