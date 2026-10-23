import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decode,encode,connectivity,exportSpice,addConnectedWire,wires,components,pins,moveComponent,wirePoints,labelGeometry} from '../src/codec.ts';
import {checkCircuit} from '../src/erc.ts';
import {translateSelection,dragWireSegment} from '../src/editor-state.ts';
const root=new URL('../reports/oracle-cases/',import.meta.url);
{
 const doc=decode(fs.readFileSync(new URL('notched_wire.TSC',root))),native=decode(fs.readFileSync(new URL('notched_wire_native_moved.TSC',root))),count=doc.records.length;
 dragWireSegment(doc,wires(doc)[0].index,1,0,-40);
 assert.deepEqual(wires(doc).map(w=>w.points),wires(native).map(w=>w.points));assert.equal(doc.records.length,count);
 console.log('Native notched wire: only grabbed segment stretches; remote notch and terminals stay fixed');
}
{
 const doc=decode(fs.readFileSync(new URL('attached_wire.TSC',root))),native=decode(fs.readFileSync(new URL('attached_wire_native_moved.TSC',root)));
 const before=encode(doc),ww=wires(doc)[0],tail=Uint8Array.from(doc.records[ww.index].data.slice(10+4*ww.points.length)),count=doc.records.length;
 const terminals=components(doc).map(c=>pins(c)),nets=connectivity(doc).map(c=>c.nodes);
 translateSelection(doc,[ww.index],0,-40);
 assert.deepEqual(wires(doc).map(w=>w.points),wires(native).map(w=>w.points),'attached GND–VM wire drag matches original TINA');
 assert.equal(doc.records.length,count,'drag must not append bridging stubs');
 assert.deepEqual(doc.records[ww.index].data.slice(10+4*wires(doc)[0].points.length),tail,'opaque wire style/UID/footer survives');
 assert.deepEqual(components(doc).map(c=>pins(c)),terminals);
 assert.deepEqual(connectivity(doc).map(c=>c.nodes),nets);
 assert.deepEqual(encode(decode(before)),before);
 console.log('Native attached GND–VM drag: exact route, fixed pins, one wire, preserved opaque tail and connectivity');
}
{
 const browser=decode(fs.readFileSync(new URL('attached_wire_browser_label.TSC',root))),native=decode(fs.readFileSync(new URL('attached_wire_browser_label_native_resaved.TSC',root)));
 const labels=(doc:typeof browser)=>components(doc).map(c=>[c.uid,c.x,c.y,labelGeometry(c)]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 assert.deepEqual(labels(browser),labels(native),'original resave retains browser-dragged component label');
 assert.deepEqual(wires(browser).map(w=>w.points),wires(native).map(w=>w.points));
 console.log('Browser-dragged label: original TINA reload/resave retains label, symbol position and wire geometry');
}
{
 const native=decode(fs.readFileSync(new URL('wire_native_two_sections.TSC',root))),doc=decode(fs.readFileSync(new URL('wire_native_continuous.TSC',root)));
 // Begin with no wire records; author the same two native gestures.
 doc.records=doc.records.filter(r=>r.type!==256);addConnectedWire(doc,[[200,200],[280,200]]);addConnectedWire(doc,[[280,200],[360,200]]);
 assert.deepEqual(wires(doc).map(w=>w.points),wires(native).map(w=>w.points),'two straight strokes must merge like original TINA');
 const original=decode(fs.readFileSync(new URL('wire_native_continuous.TSC',root)));const old=original.records.find(r=>r.type===256)!,oldBytes=Uint8Array.from(old.data);addConnectedWire(original,[[280,200],[360,200]]);assert.deepEqual(Uint8Array.from(old.data),oldBytes,'native T_ wire must remain opaque on continuation');
 console.log('Native wire continuation: two gestures produce one wire; imported native record remains untouched');
}
{
 const doc=decode(fs.readFileSync(new URL('RC_native_sine.TSC',root)));
 const reference=decode(fs.readFileSync(new URL('RC_native_resistor_moved.TSC',root)));
 const c=components(doc).find(c=>c.label==='R1')!;
 const tails=doc.records.filter(r=>r.type===256).map(r=>Uint8Array.from(r.data.subarray(10+4*wirePoints(r).length)));
 moveComponent(doc,c.index,c.x+40,c.y+40);
 assert.deepEqual(wires(doc).map(w=>w.points),wires(reference).map(w=>w.points),'native drag must produce the same orthogonal geometry');
 doc.records.filter(r=>r.type===256).forEach((r,i)=>assert.deepEqual(Uint8Array.from(r.data.subarray(10+4*wirePoints(r).length)),tails[i]));
 moveComponent(doc,c.index,c.x,c.y);
 const returned=decode(fs.readFileSync(new URL('RC_native_resistor_returned.TSC',root)));
 assert.deepEqual(wires(doc).map(w=>w.points),wires(returned).map(w=>w.points),'return movement must remove redundant elbows like native');
 const diagonalBytes=fs.readFileSync(new URL('VG_browser_ui_square_resistance50.TSC',root));
 const diagonal=decode(diagonalBytes);
 assert.ok(wires(diagonal).some(w=>w.points.some((p,i)=>i&&p[0]!==w.points[i-1][0]&&p[1]!==w.points[i-1][1])));
 assert.deepEqual(Buffer.from(encode(diagonal)),diagonalBytes,'existing diagonal wires must remain intact');
 const authored=decode(fs.readFileSync(new URL('diagonal_browser.TSC',root))),saved=decode(fs.readFileSync(new URL('diagonal_native_resaved.TSC',root)));
 assert.deepEqual(wires(authored).map(w=>w.points),wires(saved).map(w=>w.points),'native must preserve browser-authored diagonal');
 console.log('Native resistor drag: exact orthogonal route, opaque tails preserved; diagonal TSC retained');
}
for(const [tsc,cir] of [['../../tests/fixtures/BF240_output_v02.TSC','BF240_native_pspice.cir'],['BF240_explicit_vertex.TSC','BF240_vertex_native.cir'],['BF240_split_endpoint.TSC','BF240_split_native.cir']]){
 const file=tsc.startsWith('../')?new URL('../tests/fixtures/BF240_output_v02.TSC',import.meta.url):new URL(tsc,root);
 const doc=decode(fs.readFileSync(file));const native=fs.readFileSync(new URL(cir,root),'utf8');
 const rows=Object.fromEntries(connectivity(doc).filter(r=>r.component.kind!=='GND').map(r=>[r.component.label,r.nodes]));
 const nativeRows:Record<string,string[]>={};for(const [label,prefix,n] of [['T1','QT1',3],['IS1','IS1',2],['VS1','VS1',2],['AM1','VAM1',2]] as const){const line=native.split(/\r?\n/).find(l=>l.split(/\s+/)[0]===prefix)!;assert(line);nativeRows[label]=line.trim().split(/\s+/).slice(1,n+1);}
 const terminals=Object.keys(rows).flatMap(k=>rows[k].map((_,i)=>[k,i] as const));
 for(const [ka,ia] of terminals)for(const [kb,ib] of terminals)assert.equal(rows[ka][ia]===rows[kb][ib],nativeRows[ka][ia]===nativeRows[kb][ib],`${tsc}: ${ka}.${ia} / ${kb}.${ib}`);
 for(const k of Object.keys(rows))rows[k].forEach((v,i)=>assert.equal(v==='0',nativeRows[k][i]==='0'));
 assert.match(exportSpice(doc).text,new RegExp(`I_IS1 ${rows.IS1.join(' ')} DC`));
}
const doc=decode(fs.readFileSync(new URL('../tests/fixtures/BF240_output_v02.TSC',import.meta.url)));assert(checkCircuit(doc).some(i=>i.code==='dangling-pin'));
const before=wires(doc).length;addConnectedWire(doc,[[336,360],[336,368]]);assert.equal(wires(doc).length,before+2);assert.equal(connectivity(doc).find(r=>r.component.label==='VS1')!.nodes[1],'0');assert.deepEqual(encode(decode(encode(doc))),encode(doc));
console.log('Native TINA exported node partitions match original, interior-vertex and split-endpoint fixtures; current polarity and authored junction verified');
const rc=decode(fs.readFileSync(new URL('RC_native_configured.TSC',root)));
for(const [label,expected] of Object.entries({R1:[[240,240],[280,240]],C1:[[360,240],[360,280]],Vin:[[160,240],[160,280]],Vout:[[440,240],[440,280]]}))assert.deepEqual(pins(components(rc).find(c=>c.label===label)!),expected);
const mirrored=decode(fs.readFileSync(new URL('RC_reference.TSC',root))),r=components(mirrored).find(c=>c.label==='R1')!;
assert.equal(r.mirrored,true);assert.deepEqual(pins(r),[[240,240],[200,240]]);
console.log('Native XML / live RC geometry: VG rotation, capacitor and mirrored resistor pins verified');
