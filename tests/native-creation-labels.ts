import assert from 'node:assert/strict';
import {build,component,components,decode,encode,newComponent,updateComponent} from '../src/codec.ts';

// The native R placement is also recorded by the existing native-text oracle.
// Batch creation must use the same presentation as placing a palette element.
for(const kind of ['R','ZENER','SCHOTTKY','VM','AMV','VS','VG']) {
 for(const rotation of [0,1,2,3]) {
  const palette={records:[newComponent(kind,200,240,kind+'1')],trailer:new Uint8Array()};
  updateComponent(palette,0,{orientation:rotation});
  const doc=build({format:'tina-circuit-v1',components:[{kind,x:200,y:240,label:kind+'1',rotation}],wires:[]});
  const actual=components(doc)[0],expected=component(palette.records[0]);
  assert.deepEqual([actual.label_dx,actual.label_dy,actual.record.data[8]],
   [expected.label_dx,expected.label_dy,expected.record.data[8]],`${kind}, rotation ${rotation}`);
 }
}
const doc=build({format:'tina-circuit-v1',components:[
 {kind:'R',x:100,y:100,label:'R1'},
 {kind:'R',x:200,y:100,label:'R2',label_dx:0,label_dy:24},
],wires:[]});
const [fresh,custom]=components(doc);
assert.deepEqual([fresh.label_dx,fresh.label_dy,fresh.record.data[8]],[8,-20,0]);
assert.deepEqual([custom.label_dx,custom.label_dy],[0,24],'explicit placement remains intentional');
const imported=decode(encode(doc)),before=Uint8Array.from(imported.records[custom.index].data);
assert.deepEqual(encode(decode(encode(imported))),encode(imported));
assert.deepEqual(imported.records[custom.index].data,before,'opening a TSC never normalizes existing labels');
console.log('Native creation labels: palette/build parity in four rotations, native R defaults, explicit offsets and lossless import passed');
