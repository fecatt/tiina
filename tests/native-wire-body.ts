import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build,decode,encode,wires,connectivity,type Doc} from '../src/codec.ts';
import {moveWireObject,dragWireSegment,History,captureSnapshot} from '../src/editor-state.ts';

const fixture=(name:string):Doc=>decode(fs.readFileSync(new URL('../reports/oracle-cases/'+name,import.meta.url)));
for(const [beforeName,afterName] of [['attached_wire.TSC','attached_wire_native_moved.TSC'],['branch_wire_before.TSC','branch_wire_native_moved.TSC']]){
 const doc=fixture(beforeName),native=fixture(afterName),wire=wires(doc)[0],before=captureSnapshot(doc),history=new History(),nets=connectivity(doc).map(c=>c.nodes);
 const tail=Uint8Array.from(doc.records[wire.index].data.slice(10+4*wire.points.length)),untouched=doc.records.map(r=>Uint8Array.from(r.data));
 moveWireObject(doc,wire.index,0,-40);history.push(before);
 assert.deepEqual(wires(doc).map(w=>w.points),wires(native).map(w=>w.points),'whole-body move retains native anchored route');
 assert.deepEqual(connectivity(doc).map(c=>c.nodes),nets,'moving the route preserves electrical terminals');
 assert.equal(doc.records.length,untouched.length);
 doc.records.forEach((r,i)=>{if(i!==wire.index)assert.deepEqual(r.data,untouched[i],'unselected native records remain byte-identical');});
 assert.deepEqual(doc.records[wire.index].data.slice(10+4*wires(doc)[0].points.length),tail,'style, UID and opaque footer survive rerouting');
 const after=captureSnapshot(doc),undo=history.undo(after)!;assert.deepEqual(undo.bytes,before.bytes);assert.deepEqual(history.redo(undo)!.bytes,after.bytes);
 const stable=encode(doc);assert.throws(()=>moveWireObject(doc,wire.index,32767,0));assert.deepEqual(encode(doc),stable,'overflow rolls back the entire gesture');
}

// Sliding a branch along a trunk must create a native endpoint junction in
// the saved TSC, not just draw a crossing over the trunk's interior.
const branch=build({format:'tina-circuit-v1',components:[{kind:'GND',x:80,y:200},{kind:'R',x:160,y:280,label:'R1',value:1000}],wires:[[[80,200],[280,200]],[[160,200],[160,280]]]});
const branchWire=wires(branch).find(w=>w.points[0][1]===200&&w.points.at(-1)![1]===280)!;
dragWireSegment(branch,branchWire.index,0,40,0);
assert.deepEqual(wires(branch).map(w=>w.points),[[[80,200],[200,200]],[[200,200],[280,200]],[[200,200],[200,280],[160,280]]]);
const savedBranch=decode(encode(branch)),savedNets=connectivity(savedBranch),ground=savedNets.find(n=>n.component.kind==='GND')!,resistor=savedNets.find(n=>n.component.label==='R1')!;
assert.equal(resistor.nodes[0],ground.nodes[0],'slid branch is electrically joined to the horizontal trunk after TSC save/reload');
assert.equal(wires(savedBranch).length,3);

// A body moves all free bends; a handle moves only its local side.
const whole=fixture('notched_wire.TSC'),side=fixture('notched_wire.TSC'),original=wires(whole)[0],index=original.index;
moveWireObject(whole,index,0,-40);dragWireSegment(side,index,1,0,-40);
const full=wires(whole)[0].points,local=wires(side)[0].points;
assert.deepEqual(full,[[200,320],[200,200],[280,200],[280,280],[296,280],[296,200],[440,200],[440,320]]);
assert.deepEqual(local,wires(fixture('notched_wire_native_moved.TSC'))[0].points);
assert.notDeepEqual(full,local,'whole-body drag and explicit segment handles remain distinct');

const free=build({format:'tina-circuit-v1',components:[],wires:[[[80,80],[160,120],[240,120]]]});
const freeIndex=wires(free)[0].index;moveWireObject(free,freeIndex,16,-24);
assert.deepEqual(wires(free)[0].points,[[96,56],[176,96],[256,96]],'unattached route translates rigidly, preserving intentional diagonal');
console.log('Wire body: native attached/T-junction routing, all-bend versus handle movement, connectivity, byte preservation, undo/redo and transactional overflow passed');
