import {build,encode,exportSpice,toProject} from '../src/codec.ts';
import fs from 'node:fs';
const spec={format:'tina-circuit-v1',name:'RC laboratory verification',components:[{kind:'VG',label:'Vin',x:160,y:240,rotation:3,value:0},{kind:'R',label:'R1',x:240,y:240,value:1000},{kind:'C',label:'C1',x:360,y:240,rotation:3,value:1e-6},{kind:'VM',label:'Vout',x:440,y:240},{kind:'GND',label:'',x:160,y:360}],wires:[[[160,240],[240,240]],[[280,240],[360,240]],[[360,240],[440,240]],[[160,280],[160,360]],[[360,280],[360,360],[160,360]],[[440,280],[440,360],[160,360]]] as [number,number][][]};
const doc=build(spec);console.log(exportSpice(doc).text);
fs.mkdirSync('reports/oracle-cases',{recursive:true});fs.writeFileSync('reports/oracle-cases/RC_verified_pins.TSC',encode(doc));
fs.writeFileSync('reports/oracle-cases/RC_verified_pins.json',JSON.stringify(toProject(doc,{name:spec.name,analysis:{kind:'transient',input:'Vin',waveform:'pulse',amplitude:1,offset:1,frequency:100,delay:.001,stop:.025,step:1e-6}}),null,2));
