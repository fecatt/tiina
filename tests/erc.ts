import assert from 'node:assert/strict';
import {build,presets,components,updateComponent,type CircuitSpec} from '../src/codec.ts';
import {checkCircuit} from '../src/erc.ts';
const codes=(s:CircuitSpec)=>checkCircuit(build(s)).map(i=>i.code);
assert(codes(presets.output).includes('dangling-pin')); // Native TINA warns on the disconnected return wire.
const base:CircuitSpec={format:'tina-circuit-v1',components:[{kind:'R',label:'R1',x:0,y:0,value:1000},{kind:'GND',x:0,y:0}],wires:[]};
assert(codes(base).includes('dangling-pin'));
assert(codes({...base,components:base.components.filter(c=>c.kind!=='GND')}).includes('missing-ground'));
assert(codes({...base,wires:[[[0,0],[40,0]]]}).includes('shorted-component'));
const d=build(presets.output),cc=components(d).filter(c=>c.kind!=='GND');updateComponent(d,cc[1].index,{label:cc[0].label});assert(checkCircuit(d).some(i=>i.code==='duplicate-label'));
const u=build(base);u.records.splice(0,0,{type:0x234,version:66,data:new Uint8Array()});assert(checkCircuit(u).some(i=>i.code==='unsupported-component'));
console.log('ERC checks passed');
