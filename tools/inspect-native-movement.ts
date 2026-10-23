import fs from 'node:fs';
import {decode,components,wires} from '../src/codec.ts';
for(const name of ['RC_native_sine','RC_native_resistor_moved','RC_native_resistor_returned']){
 const d=decode(fs.readFileSync('reports/oracle-cases/'+name+'.TSC'));
 console.log(name,components(d).map(c=>({label:c.label,kind:c.kind,x:c.x,y:c.y})));
 console.log(JSON.stringify(wires(d).map(w=>w.points)));
}
