/** Reversible editor operations. Only explicitly understood component/wire records move. */
import {decode,encode,component,components,wirePoints,pins,updateComponent,makeWire,newUid,readString,countedString,type Doc,type Rec,type Point} from './codec.ts';
import {textRecord,updateText} from './native-text.ts';

export interface Snapshot {bytes:Uint8Array;analysis?:unknown;name?:string}
const cloneSnapshot=(s:Snapshot):Snapshot=>({bytes:Uint8Array.from(s.bytes),...(s.analysis===undefined?{}:{analysis:structuredClone(s.analysis)}),...(s.name===undefined?{}:{name:s.name})});
export function captureSnapshot(doc:Doc,analysis?:unknown,name?:string):Snapshot {return cloneSnapshot({bytes:encode(doc),analysis,name});}
export class History {
  private past:Snapshot[]=[];private future:Snapshot[]=[];readonly limit:number;
  constructor(limit=60){if(!Number.isInteger(limit)||limit<1||limit>60)throw Error('История должна содержать от 1 до 60 действий');this.limit=limit;}
  get canUndo(){return this.past.length>0;}get canRedo(){return this.future.length>0;}
  get undoCount(){return this.past.length;}get redoCount(){return this.future.length;}
  push(before:Snapshot){this.past.push(cloneSnapshot(before));if(this.past.length>this.limit)this.past.shift();this.future=[];}
  undo(current:Snapshot):Snapshot|null {const previous=this.past.at(-1);if(!previous)return null;const saved=cloneSnapshot(current),result=cloneSnapshot(previous);this.past.pop();this.future.push(saved);return result;}
  redo(current:Snapshot):Snapshot|null {const next=this.future.at(-1);if(!next)return null;const saved=cloneSnapshot(current),result=cloneSnapshot(next);this.future.pop();this.past.push(saved);if(this.past.length>this.limit)this.past.shift();return result;}
  reset(){this.past=[];this.future=[];}
}
export interface SelectionClipboard {format:'tina-web-selection-v1';records:Rec[]}
const cloneRecord=(r:Rec):Rec=>({type:r.type,version:r.version,data:Uint8Array.from(r.data)});
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
 requireEditable(doc.records[index]);
 const ww=doc.records.flatMap((r,i)=>{if(r.type!==256)return [];try{requireEditable(r);const pp=wirePoints(r);return [{i,r,pp,ends:[pp[0],pp.at(-1)!]}];}catch{return [];}}),cc=components(doc).flatMap(pins),chosen=new Set([index]),queue=[index];
 const style=(w:typeof ww[number])=>Array.from(w.r.data.subarray(10+4*w.pp.length,18+4*w.pp.length)).join(',');
 while(queue.length){const next=queue.shift();const w=ww.find(w=>w.i===next)!;for(const p of w.ends){if(cc.some(q=>same(p,q)))continue;const adjacent=ww.filter(o=>o.ends.some(q=>same(p,q)));if(adjacent.length!==2)continue;const other=adjacent.find(o=>o.i!==w.i)!;if(other.r.version!==w.r.version||style(other)!==style(w)||chosen.has(other.i))continue;chosen.add(other.i);queue.push(other.i);}}
 return [...chosen].sort((a,b)=>a-b);
}
function wireUidBounds(r:Rec):[number,number]{const points=wirePoints(r),start=10+4*points.length+8;const [,end]=readString(r.data,start);return [start,end];}
function translateWire(r:Rec,dx:number,dy:number){const pp=wirePoints(r).map(([x,y])=>[coordinate(x+dx),coordinate(y+dy)] as Point),d=Uint8Array.from(r.data),v=dataView(d);[...pp[0],...pp.at(-1)!].forEach((n,i)=>v.setInt16(2*i,n,true));pp.forEach(([x,y],i)=>{v.setInt16(10+4*i,x,true);v.setInt16(12+4*i,y,true);});r.data=d;}
/** Move the whole wire route while leaving its external electrical terminals anchored.
 * Unlike a handle drag, every free bend moves. The shared group route already
 * matches the native attached-wire oracle; a straight route has no interior bend,
 * so stretch it as one segment instead of collapsing both moved endpoints back. */
export function moveWireObject(doc:Doc,index:number,dx:number,dy:number):void {
 delta(dx,dy);const r=doc.records[index];
 if(!r||r.type!==256)throw Error('Провод не найден');requireEditable(r);const pp=wirePoints(r);
 if(pp.length===2&&(pp[0][0]===pp[1][0]||pp[0][1]===pp[1][1])){
  const terminals=components(doc).flatMap(pins),otherEnds=doc.records.flatMap((other,i)=>{if(i===index||other.type!==256)return [];try{const points=wirePoints(other);return [points[0],points.at(-1)!];}catch{return [];}});
  if(pp.every(p=>[...terminals,...otherEnds].some(q=>same(p,q)))){dragWireSegment(doc,index,0,dx,dy);return;}
 }
 translateSelection(doc,[index],dx,dy);
}
function setWireUid(r:Rec,uid:string){const [start,end]=wireUidBounds(r);r.data=join(r.data.slice(0,start),countedString(uid),r.data.slice(end));}
function insertionIndex(doc:Doc){const i=doc.records.findIndex(r=>r.type>=0xf000||r.type===255);return i<0?doc.records.length:i;}
function commit(doc:Doc,staged:Doc){encode(staged);doc.records=staged.records;doc.trailer=staged.trailer;}
/** Remove exactly the validated selection. Remaining wires retain their endpoints and opaque bytes. */
export function deleteSelection(doc:Doc,indices:Iterable<number>):void {
 const selected=indicesOf(doc,indices);if(!selected.length)return;
 const staged=decode(encode(doc));for(const index of selected.reverse())staged.records.splice(index,1);
 commit(doc,staged);
}
/** Native group rotation proven for R symbols/wires. Text is not rotated by native command66. */
export function rotateSelection(doc:Doc,indices:Iterable<number>,direction:1|-1=1):number[] {
 if(direction!==1&&direction!==-1)throw Error('Направление поворота должно быть 1 или −1');
 const selected=indicesOf(doc,indices),electrical=selected.filter(i=>doc.records[i].type!==262);
 if(!electrical.length)return selected;
 // A group pivot depends on native symbol bounds: unknown component bounds must not be guessed.
 const selectedComponents=electrical.filter(i=>doc.records[i].type!==256);
 for(const i of selectedComponents){const c=component(doc.records[i],i);if(c.kind!=='R'||c.mirrored||!Number.isInteger(c.orientation)||c.orientation<0||c.orientation>3)throw Error('Поворот группы с этим видом элемента пока не проверен');}
 if(!selectedComponents.length)return selected; // Native command66 does not rotate a wire-only selection.
 if(selectedComponents.length!==2&&!(selectedComponents.length===1&&electrical.length===1))throw Error('Центр поворота этой группы пока не проверен');
 const staged=decode(encode(doc));
 if(electrical.length===1&&staged.records[electrical[0]].type!==256){const i=electrical[0],c=component(staged.records[i],i);updateComponent(staged,i,{orientation:(c.orientation+direction+4)%4});commit(doc,staged);return selected;}
 const low:Point=[Infinity,Infinity],high:Point=[-Infinity,-Infinity],include=([x,y]:Point)=>{low[0]=Math.min(low[0],x);low[1]=Math.min(low[1],y);high[0]=Math.max(high[0],x);high[1]=Math.max(high[1],y);};
 for(const i of electrical){const r=staged.records[i];if(r.type===256){for(const p of wirePoints(r))include(p);continue;}
  const c=component(r,i);
  for(const point of [[0,-4],[0,4],[40,-4],[40,4]] as Point[]){let [x,y]=point;if(c.mirrored)x=-x;for(let turn=0;turn<c.orientation;turn++)[x,y]=[y,-x];include([c.x+x,c.y+y]);}
 }
 const center:Point=[Math.round((low[0]+high[0])/16)*8,Math.round((low[1]+high[1])/16)*8];
 const turn=([x,y]:Point):Point=>[coordinate(center[0]+direction*(y-center[1])),coordinate(center[1]-direction*(x-center[0]))];
 for(const i of electrical){const r=staged.records[i];if(r.type===256){const old=wirePoints(r),pp=old.map(turn);r.data=join(makeWire(pp).data.slice(0,10+4*pp.length),r.data.slice(10+4*old.length));}
  else{const c=component(r,i),[x,y]=turn([c.x,c.y]);updateComponent(staged,i,{x,y,orientation:(c.orientation+direction+4)%4});}
 }
 commit(doc,staged);return selected;
}
export type SelectionTransform = {operation:'rotate-left'|'rotate-right'|'mirror-horizontal'|'mirror-vertical';pivot?:Point};
export type SelectionTransformResult = {indices:number[];pivot:Point};
/** Browser group transform using known native coordinate/orientation fields.
 * The pivot is a browser rule, not a claim of native group-centre parity. Keep the
 * returned pivot while transforming the same selection to avoid grid-rounding drift.
 * Only chosen geometry moves; unselected wires retain their exact bytes. Text moves
 * by its anchor and stays readable because native glyph rotation is not decoded. */
export function transformSelection(doc:Doc,indices:Iterable<number>,options:SelectionTransform):SelectionTransformResult {
 const operations=['rotate-left','rotate-right','mirror-horizontal','mirror-vertical'];
 if(!options||!operations.includes(options.operation))throw Error('Неизвестное преобразование группы');
 const selected=indicesOf(doc,indices),points:Point[]=[];
 for(const index of selected){const r=doc.records[index];
  if(r.type===256){points.push(...wirePoints(r));continue;}
  if(r.type===262){const t=textRecord(r);points.push([t.x,t.y]);continue;}
  const c=component(r,index);
  if(!Number.isInteger(c.orientation)||c.orientation<0||c.orientation>3||![0,1].includes(r.data[c.orientation_offset+1]))throw Error('Неизвестное преобразование символа');
  points.push([c.x,c.y],...pins(c));
 }
 const bounds=points.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
 const pivot:Point=options.pivot?[...options.pivot]:points.length?[Math.round((bounds[0]+bounds[2])/2),Math.round((bounds[1]+bounds[3])/2)]:[0,0];
 if(pivot.length!==2)throw Error('Неверный центр преобразования');pivot.forEach(coordinate);
 if(!selected.length)return {indices:selected,pivot};
 const transform=([x,y]:Point):Point=>{
  const dx=x-pivot[0],dy=y-pivot[1];let nx:number,ny:number;
  if(options.operation==='rotate-left'){nx=dy;ny=-dx;}
  else if(options.operation==='rotate-right'){nx=-dy;ny=dx;}
  else if(options.operation==='mirror-horizontal'){nx=-dx;ny=dy;}
  else{nx=dx;ny=-dy;}
  return [coordinate(pivot[0]+nx),coordinate(pivot[1]+ny)];
 };
 const staged=decode(encode(doc));
 for(const index of selected){const r=staged.records[index];
  if(r.type===256){const old=wirePoints(r),next=old.map(transform);r.data=join(makeWire(next).data.slice(0,10+4*next.length),r.data.slice(10+4*old.length));}
  else if(r.type===262){const t=textRecord(r),[x,y]=transform([t.x,t.y]);updateText(r,{x,y});}
  else{const c=component(r,index),[x,y]=transform([c.x,c.y]);
   const orientation=options.operation==='rotate-left'?(c.orientation+1)%4:options.operation==='rotate-right'?(c.orientation+3)%4:((options.operation==='mirror-horizontal'?0:2)-c.orientation+4)%4;
   const mirrored=options.operation.startsWith('mirror-')?!c.mirrored:c.mirrored;
   updateComponent(staged,index,{x,y,orientation,mirrored});
  }
 }
 commit(doc,staged);return {indices:selected,pivot};
}
export type WireJunctionResult={connected:boolean;changed:boolean;indices:number[]};
/** Toggle an unambiguous crossing/T branch through native wire endpoints.
 * Does not invent marker flags: only already decoded polyline geometry is written.
 * Disconnect requires opposite, metadata-compatible pairs and refuses a pin/branch.
 * Original TINA accepts both outputs with matching electrical topology. The exact
 * native command84 gesture/internal algorithm is a separate oracle claim. */
export function toggleWireJunction(doc:Doc,point:Point,mode:'toggle'|'connect'|'disconnect'='toggle'):WireJunctionResult {
 if(!['toggle','connect','disconnect'].includes(mode)||point.length!==2)throw Error('Неверная команда соединения');point.forEach(coordinate);
 const endpointArms:{index:number;points:Point[];near:Point}[]=[],interior:{index:number;left:Point[];right:Point[];near:Point[]}[]=[];
 for(let index=0;index<doc.records.length;index++){const r=doc.records[index];if(r.type!==256)continue;
  // A wire of unknown layout cannot safely be classified as disjoint from this crossing.
  requireEditable(r);const pp=wirePoints(r);
  if(same(point,pp[0])||same(point,pp.at(-1)!)){
   if(same(pp[0],pp.at(-1)!))throw Error('Соединение замкнутого провода неоднозначно');
   for(let j=1;j<pp.length;j++)if(onSegment(point,pp[j-1],pp[j])&&!((j===1&&same(point,pp[0]))||(j===pp.length-1&&same(point,pp.at(-1)!))))throw Error('Самопересечение провода неоднозначно');
   endpointArms.push({index,points:pp,near:same(point,pp[0])?pp[1]:pp[pp.length-2]});continue;
  }
  const cuts:number[]=[];
  for(let j=1;j<pp.length;j++)if(onSegment(point,pp[j-1],pp[j])){const key=same(point,pp[j-1])?j-1:same(point,pp[j])?j:j-.5;if(!cuts.includes(key))cuts.push(key);}
  if(!cuts.length)continue;if(cuts.length!==1)throw Error('Самопересечение провода неоднозначно');
  const cut=cuts[0],j=Math.ceil(cut),left=pp.slice(0,Number.isInteger(cut)?j+1:j),right=pp.slice(j);
  if(!same(left.at(-1)!,point))left.push([...point]);if(!same(right[0],point))right.unshift([...point]);
  interior.push({index,left,right,near:[left[left.length-2],right[1]]});
 }
 const vector=(p:Point):Point=>[p[0]-point[0],p[1]-point[1]];
 const opposite=(a:Point,b:Point)=>{const [x,y]=vector(a),[u,v]=vector(b);return x*v-y*u===0&&x*u+y*v<0;};
 const bytesEqual=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
 const properties=(r:Rec)=>{const [start,end]=wireUidBounds(r);return join(r.data.slice(start-8,start),r.data.slice(end));};
 const withGeometry=(r:Rec,pp:Point[],freshIdentity=false):Rec=>{const [start,end]=wireUidBounds(r),geometry=makeWire(pp).data.slice(0,10+4*pp.length);return {...r,data:join(geometry,r.data.slice(start-8,start),freshIdentity?countedString(newUid()):r.data.slice(start,end),r.data.slice(end))};};
 if([3,4].includes(endpointArms.length)&&!interior.length){
  const pairs:typeof endpointArms[]=[];for(let i=0;i<endpointArms.length;i++)for(let j=i+1;j<endpointArms.length;j++)if(opposite(endpointArms[i].near,endpointArms[j].near))pairs.push([endpointArms[i],endpointArms[j]].sort((u,v)=>u.index-v.index));
  const used=new Set(pairs.flatMap(pair=>pair.map(arm=>arm.index))),remaining=endpointArms.filter(arm=>!used.has(arm.index));
  if(endpointArms.length===4?(pairs.length!==2||used.size!==4):(pairs.length!==1||remaining.length!==1))throw Error('Пересечение не имеет однозначных прямых направлений');
  if(remaining.length){const a=vector(pairs[0][0].near),b=vector(remaining[0].near);if(a[0]*b[1]-a[1]*b[0]===0)throw Error('Совпадающие ветви не образуют T-соединение');}
  if(mode==='connect')return {connected:true,changed:false,indices:endpointArms.map(a=>a.index)};
  if(components(doc).some(c=>pins(c).some(p=>same(p,point))))throw Error('Нельзя разъединить пересечение на выводе элемента');
  const replacements=pairs.map(([a,b])=>{
   const ra=doc.records[a.index],rb=doc.records[b.index];if(ra.version!==rb.version||!bytesEqual(properties(ra),properties(rb)))throw Error('Свойства встречных проводов различаются');
   let aa=a.points,bb=b.points;if(same(aa[0],point)){aa=[...bb];bb=a.points;if(same(aa[0],point))aa=[...aa].reverse();}else if(!same(bb[0],point))bb=[...bb].reverse();
   const pp=[...aa,...bb.slice(1)],j=aa.length-1;
   // At this crossing the adjacent segments are proven collinear; remove the junction vertex.
   pp.splice(j,1);return {index:a.index,remove:b.index,record:withGeometry(ra,pp)};
  });
  const staged=decode(encode(doc));for(const replacement of replacements)staged.records[replacement.index]=replacement.record;
  const removed=replacements.map(r=>r.remove).sort((a,b)=>b-a);for(const index of removed)staged.records.splice(index,1);
  const retained=[...replacements.map(r=>r.index),...remaining.map(arm=>arm.index)].map(index=>index-removed.filter(i=>i<index).length).sort((a,b)=>a-b);commit(doc,staged);return {connected:false,changed:true,indices:retained};
 }
 if(!((interior.length===2&&!endpointArms.length)||(interior.length===1&&endpointArms.length===1))||!interior.every(w=>opposite(w.near[0],w.near[1])))throw Error('Выберите простое пересечение или T-ответвление');
 const a=vector(interior[0].near[0]),b=vector(interior.length===2?interior[1].near[0]:endpointArms[0].near);if(a[0]*b[1]-a[1]*b[0]===0)throw Error('Совпадающие провода не образуют пересечение');
 if(mode==='disconnect')return {connected:false,changed:false,indices:[...interior.map(w=>w.index),...endpointArms.map(w=>w.index)].sort((a,b)=>a-b)};
 const staged=decode(encode(doc)),newIndices:number[]=[];
 for(const w of [...interior].reverse()){const r=staged.records[w.index];staged.records.splice(w.index,1,withGeometry(r,w.left),withGeometry(r,w.right,true));}
 for(const w of interior){const offset=interior.filter(other=>other.index<w.index).length;newIndices.push(w.index+offset,w.index+offset+1);}
 for(const arm of endpointArms)newIndices.push(arm.index+interior.filter(other=>other.index<arm.index).length);newIndices.sort((a,b)=>a-b);
 commit(doc,staged);return {connected:true,changed:true,indices:newIndices};
}
/** Native single-wire gesture stretches the grabbed orthogonal segment, keeping remote bends. */
export function dragWireSegment(doc:Doc,index:number,segment:number,dx:number,dy:number){
 delta(dx,dy);const staged=decode(encode(doc)),r=staged.records[index],old=wirePoints(r);
 if(!Number.isInteger(segment)||segment<0||segment>=old.length-1)throw Error('Участок провода отсутствует');
 const a=old[segment],b=old[segment+1];
 if(a[0]!==b[0]&&a[1]!==b[1]){translateSelection(doc,[index],dx,dy);return;}
 if(a[1]===b[1])dx=0;else dy=0;
 if(!dx&&!dy)return;
 // When a branch endpoint slides along another route, split that route at
 // the new endpoint. TINA's electrical graph joins wire-record endpoints;
 // merely drawing the branch over the middle of a trunk leaves it open.
 const pointOn=(p:Point,x:Point,y:Point)=>
  (p[0]-x[0])*(y[1]-x[1])===(p[1]-x[1])*(y[0]-x[0])&&
  p[0]>=Math.min(x[0],y[0])&&p[0]<=Math.max(x[0],y[0])&&p[1]>=Math.min(x[1],y[1])&&p[1]<=Math.max(x[1],y[1]);
 const slideTargets=new Map<number,{point:Point;points:Point[]}>();
 for(const end of [0,old.length-1]){
  if(end===0?segment!==0:segment!==old.length-2)continue;
  const from=old[end],to:Point=[coordinate(from[0]+dx),coordinate(from[1]+dy)];
  for(let wi=0;wi<staged.records.length;wi++){
   if(wi===index||staged.records[wi].type!==256)continue;
   let route:Point[];try{route=wirePoints(staged.records[wi]);}catch{continue;}
   if(route.some((q,j)=>j>0&&pointOn(from,route[j-1],q)&&pointOn(to,route[j-1],q))){slideTargets.set(wi,{point:to,points:route});}
  }
 }
 const pp=old.map(p=>[...p] as Point);
 for(const i of [segment,segment+1])pp[i]=[coordinate(old[i][0]+dx),coordinate(old[i][1]+dy)];
 const otherEnds=staged.records.flatMap((other,i)=>{if(i===index||other.type!==256)return [];try{const w=wirePoints(other);return [w[0],w.at(-1)!];}catch{return [];}});
 const terminals=components(staged).flatMap(pins);
 const sliding=(p:Point)=>[...slideTargets.values()].some(v=>same(v.points[0],p)||same(v.points.at(-1)!,p)||v.points.some((q,j)=>j>0&&pointOn(p,v.points[j-1],q)));
 const fixed=(p:Point)=>terminals.some(q=>same(p,q))||(!sliding(p)&&otherEnds.some(q=>same(p,q)));
 if(segment===0&&fixed(old[0]))pp.unshift(old[0]);
 if(segment===old.length-2&&fixed(old.at(-1)!))pp.push(old.at(-1)!);
 for(let i=1;i<pp.length;)if(same(pp[i-1],pp[i]))pp.splice(i,1);else if(i<pp.length-1&&((pp[i-1][0]===pp[i][0]&&pp[i][0]===pp[i+1][0])||(pp[i-1][1]===pp[i][1]&&pp[i][1]===pp[i+1][1])))pp.splice(i,1);else i++;
 if(pp.length<2)throw Error('Перемещение сворачивает провод в точку');
 r.data=join(makeWire(pp).data.slice(0,10+4*pp.length),r.data.slice(10+4*old.length));
 for(const [wi,{point,points}] of [...slideTargets].sort((a,b)=>b[0]-a[0])){
  const target=staged.records[wi],vertex=points.findIndex(p=>same(p,point));let cut=vertex>0&&vertex<points.length-1?vertex:-1;
  if(cut<0)for(let j=1;j<points.length;j++)if(pointOn(point,points[j-1],points[j])&&!same(point,points[j-1])&&!same(point,points[j])){cut=j;break;}
  if(cut<0)continue;
  const parts=[points.slice(0,cut),points.slice(cut)];
  if(!same(parts[0].at(-1)!,point))parts[0].push(point);if(!same(parts[1][0],point))parts[1].unshift(point);
  const tailStart=10+4*points.length,[,uidEnd]=readString(target.data,tailStart+8);
  const replacements=parts.map((route,i)=>{const geometry=makeWire(route).data.slice(0,10+4*route.length);return {...target,data:join(geometry,target.data.slice(tailStart,tailStart+8),i?countedString(newUid()):target.data.slice(tailStart+8,uidEnd),target.data.slice(uidEnd))};});
  staged.records.splice(wi,1,...replacements);
 }
 commit(doc,staged);
}
function uniqueLabel(label:string,used:Set<string>){let candidate=label;const taken=(s:string)=>used.has(s.toLocaleLowerCase());if(taken(candidate)){const m=label.match(/^(.*?)(\d+)$/),prefix=m?m[1]:label+'_';let n=m?BigInt(m[2])+1n:2n;do{const suffix=String(n++);candidate=prefix.slice(0,254-suffix.length)+suffix;}while(taken(candidate));}used.add(candidate.toLocaleLowerCase());return candidate;}

/** Clone raw properties, assign fresh identity, and insert before native analysis settings. */
export function pasteSelection(doc:Doc,clipboard:SelectionClipboard,dx=16,dy=16):number[]{
  delta(dx,dy);if(clipboard.format!=='tina-web-selection-v1'||!Array.isArray(clipboard.records))throw Error('Неверный буфер схемы');
  clipboard.records.forEach(requireEditable);const staged=decode(encode(doc)),records=clipboard.records.map(cloneRecord);
  const used=new Set(components(staged).filter(c=>c.kind!=='GND').map(c=>c.label.toLocaleLowerCase()));
  for(const r of records){if(r.type===262){const t=textRecord(r);updateText(r,{x:coordinate(t.x+dx),y:coordinate(t.y+dy)});}else if(r.type===256){translateWire(r,dx,dy);setWireUid(r,newUid());}else{const c=component(r);updateComponent({records:[r],trailer:new Uint8Array()},0,{x:coordinate(c.x+dx),y:coordinate(c.y+dy),uid:newUid(),...(['GND','CONNECTOR'].includes(c.kind)?{}:{label:uniqueLabel(c.label,used)})});}}
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
  const electricalSelection=selected.filter(i=>staged.records[i].type!==262);
  if(electricalSelection.length&&electricalSelection.every(i=>staged.records[i].type===256)){
   // Drag wire geometry while its external electrical terminals stay anchored.
   for(const index of electricalSelection){const r=staged.records[index],old=wirePoints(r),pp=old.map(([x,y])=>[coordinate(x+dx),coordinate(y+dy)] as Point);
    for(const end of [0,old.length-1]){const p=old[end];if(!boundary.some(q=>same(p,q)))continue;const start=end===0,j=start?1:pp.length-2,next=pp[j],neighbor=old[start?1:old.length-2];pp[start?0:pp.length-1]=p;
     if(p[0]!==next[0]&&p[1]!==next[1]&&(neighbor[0]===p[0]||neighbor[1]===p[1])){const corner:Point=neighbor[1]===p[1]?[p[0],next[1]]:[next[0],p[1]];pp.splice(start?1:pp.length-1,0,corner);}
    }
    if(old.every((p,i)=>!i||p[0]===old[i-1][0]||p[1]===old[i-1][1]))for(let i=1;i<pp.length;){if(same(pp[i-1],pp[i])){pp.splice(i,1);i=Math.max(1,i-1);continue;}if(i+1<pp.length){const a=pp[i-1],b=pp[i],c=pp[i+1];if((a[0]===b[0]&&b[0]===c[0])||(a[1]===b[1]&&b[1]===c[1])){pp.splice(i,1);i=Math.max(1,i-1);continue;}}i++;}
    if(pp.length<2||pp.length>8192)throw Error('Перемещение создаёт вырожденный провод');const geometry=makeWire(pp).data.slice(0,10+4*pp.length);r.data=join(geometry,r.data.slice(10+4*old.length));
   }
   for(const index of selected){const r=staged.records[index];if(r.type!==262)continue;const t=textRecord(r);updateText(r,{x:coordinate(t.x+dx),y:coordinate(t.y+dy)});}
   commit(doc,staged);return selected;
  }
  for(const index of selected){const r=staged.records[index];if(r.type===262){const t=textRecord(r);updateText(r,{x:coordinate(t.x+dx),y:coordinate(t.y+dy)});}else if(r.type===256)translateWire(r,dx,dy);else{const c=component(r,index);updateComponent(staged,index,{x:coordinate(c.x+dx),y:coordinate(c.y+dy)});}}
  const branches=boundary.map(p=>{const end:Point=[coordinate(p[0]+dx),coordinate(p[1]+dy)],route:Point[]=[p];if(dx&&dy)route.push([end[0],p[1]]);route.push(end);return makeWire(route);});
  staged.records.splice(insertionIndex(staged),0,...branches);commit(doc,staged);return selected;
}
