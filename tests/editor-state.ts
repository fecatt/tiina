import assert from 'node:assert/strict';
import {History,captureSnapshot,copySelection,pasteSelection,selectAll,translateSelection,wireChain} from '../src/editor-state.ts';
import {build,presets,component,components,wires,wirePoints,encode,readString,updateComponent,connectivity,modelParameters,labelGeometry,translateLabel,type Doc} from '../src/codec.ts';

const doc=build(presets.output),original=encode(doc),all=selectAll(doc);assert.equal(all.length,components(doc).length+wires(doc).length);
const clipboard=copySelection(doc,all),pasted=pasteSelection(doc,clipboard,800,0);assert.equal(pasted.length,all.length);assert.equal(components(doc).filter(c=>c.kind==='NPN').length,2);
const cc=components(doc),uids=cc.map(c=>c.uid);assert.equal(new Set(uids).size,uids.length);assert.equal(new Set(cc.filter(c=>c.kind!=='GND').map(c=>c.label)).size,cc.filter(c=>c.kind!=='GND').length);
const firstQ=cc.find(c=>c.label==='T1')!,secondQ=cc.find(c=>c.label==='T2')!;assert.deepEqual(modelParameters(secondQ),modelParameters(firstQ));assert.equal(secondQ.x-firstQ.x,800);
assert(pasted.every(i=>i<doc.records.findIndex(r=>r.type>=0xf000)));
assert.equal(encode(build(presets.output)).length,original.length);
// Internal connectivity of the whole pasted circuit is unchanged (node numbering may change).
const con=connectivity(doc),oldT=con.find(r=>r.component.label==='T1')!,newT=con.find(r=>r.component.label==='T2')!;
assert.equal(oldT.nodes[2],'0');assert.equal(newT.nodes[2],'0');assert.notEqual(oldT.nodes[0],newT.nodes[0]);

// Cyrillic labels and unknown trailing component properties survive exact raw copying.
const raw=build(presets.output),q=components(raw).find(c=>c.label==='T1')!;updateComponent(raw,q.index,{label:'Транзистор1'});const qr=raw.records[q.index];qr.data=Uint8Array.from([...qr.data,19,27,255,88]);
const qBefore=component(qr),parameterBytes=qr.data.slice(qBefore.parameter_offset);const [copyIndex]=pasteSelection(raw,copySelection(raw,[q.index]),16,24),qCopy=component(raw.records[copyIndex]);
assert.equal(qCopy.label,'Транзистор2');assert.deepEqual(qCopy.record.data.slice(qCopy.parameter_offset),parameterBytes);assert.notEqual(qCopy.uid,qBefore.uid);

// Wire color/style prefix and opaque tail survive; only geometry and counted UID change.
const wd=build(presets.basics),wi=wires(wd)[0].index,wr=wd.records[wi],pp=wirePoints(wr),uidStart=10+4*pp.length+8;wr.data[uidStart-8]=73;wr.data=Uint8Array.from([...wr.data,62,91,201]);const [,uidEnd]=readString(wr.data,uidStart),tail=wr.data.slice(uidEnd),style=wr.data.slice(uidStart-8,uidStart),oldUid=readString(wr.data,uidStart)[0];
const [newWi]=pasteSelection(wd,copySelection(wd,[wi]),24,-16),nwr=wd.records[newWi],nstart=10+4*wirePoints(nwr).length+8,[newWireUid,nend]=readString(nwr.data,nstart);
assert.deepEqual(nwr.data.slice(nstart-8,nstart),style);assert.deepEqual(nwr.data.slice(nend),tail);assert.notEqual(newWireUid,oldUid);assert.deepEqual(wirePoints(nwr),pp.map(([x,y])=>[x+24,y-16]));

// Moving a complete circuit creates no branches and preserves all component net relations.
const moved=build(presets.output),beforeLength=moved.records.length,moveAll=selectAll(moved),beforeGeometry=wires(moved).map(w=>w.points);
translateSelection(moved,moveAll,80,48);assert.equal(moved.records.length,beforeLength);assert.deepEqual(wires(moved).map(w=>w.points),beforeGeometry.map(pp=>pp.map(([x,y])=>[x+80,y+48])));assert.equal(components(moved).find(c=>c.label==='T1')!.x,400);
// Moving one transistor preserves its three external connections through exactly three bridges.
const single=build(presets.output),singleT=components(single).find(c=>c.label==='T1')!,singleBefore=single.records.length;translateSelection(single,[singleT.index],80,48);assert.equal(single.records.length,singleBefore+3);const sn=connectivity(single).find(r=>r.component.label==='T1')!;assert.equal(sn.nodes[2],'0');
// Mutations are transactional on malformed/unsupported selection or coordinate overflow.
const stable=encode(single);assert.throws(()=>copySelection(single,[0]));assert.throws(()=>pasteSelection(single,copySelection(single,selectAll(single)),32767,0));assert.deepEqual(encode(single),stable);assert.throws(()=>translateSelection(single,[singleT.index],32767,0));assert.deepEqual(encode(single),stable);

const history=new History(2),s0=captureSnapshot(build(presets.basics),{kind:'op'},'Начало'),s1=captureSnapshot(moved,{kind:'dc'},'После'),s2=captureSnapshot(single,{kind:'ac'},'Конец');history.push(s0);history.push(s1);assert.equal(history.canUndo,true);const undo=history.undo(s2)!;assert.equal(undo.name,'После');assert.deepEqual(undo.analysis,{kind:'dc'});const redo=history.redo(undo)!;assert.equal(redo.name,'Конец');history.undo(redo);history.push(s0);assert.equal(history.canRedo,false);history.push(s1);history.push(s2);assert.equal(history.undoCount,2);history.reset();assert.equal(history.canUndo,false);assert.equal(history.canRedo,false);
const isolated=new History();isolated.push(s0);s0.bytes[0]=0;assert.equal(isolated.undo(s1)!.bytes[0],79);
for(let rotation=0;rotation<4;rotation++){
 const doc=build({format:'tina-circuit-v1',components:[{kind:'R',label:'R1',x:200,y:200,rotation}],wires:[]});
 const before=components(doc)[0],label=labelGeometry(before),bytes=encode(doc);
 translateLabel(doc,before.index,24,-16);const after=components(doc)[0],moved=labelGeometry(after);
 assert.deepEqual([moved.x,moved.y,moved.angle],[label.x+24,label.y-16,label.angle]);
 assert.deepEqual(pinsForLabel(after),pinsForLabel(before));
 translateLabel(doc,before.index,-24,16);assert.deepEqual(encode(doc),bytes,'label-only round trip preserves all bytes');
 assert.throws(()=>translateLabel(doc,before.index,65536,0));assert.deepEqual(encode(doc),bytes);
}
function pinsForLabel(c:ReturnType<typeof component>){return [c.x,c.y,c.orientation,c.uid,c.value];}
{
 const doc=build({format:'tina-circuit-v1',components:[{kind:'GND',x:200,y:360}],wires:[[[200,360],[240,320],[280,320]]]});
 translateSelection(doc,[wires(doc)[0].index],16,-16);
 assert.deepEqual(wires(doc)[0].points,[[200,360],[256,304],[296,304]],'intentional diagonal remains diagonal at anchored endpoint');
}
console.log('Editor state: clipboard/group topology, fresh IDs, labels/models/opaque wire styles, rollback and undo/redo passed');
{
 const chain=build({format:'tina-circuit-v1',components:[],wires:[[[0,0],[40,0]],[[40,0],[40,-40],[80,-40],[80,0]],[[40,-40],[40,-80]]]});
 const ww=wires(chain),selected=wireChain(chain,ww[0].index);assert.deepEqual(selected,[ww[0].index,ww[1].index]);
 const n=chain.records.length;translateSelection(chain,selected,0,-16);
 assert.equal(chain.records.length,n,'an endpoint on an interior bend must not generate phantom bridges');
 assert.deepEqual(wires(chain).at(-1)!.points,[[40,-40],[40,-80]],'unconnected wire at interior bend stays put');
 console.log('Wire chain: whole path selected; no phantom interior-bend branch on drag');
}
