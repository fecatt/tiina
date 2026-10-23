import fs from 'node:fs';
import {decode,encode,components} from '../src/codec.ts';
const doc=decode(fs.readFileSync('reports/oracle-cases/RC_native_sine.TSC'));
const c=components(doc).find(c=>c.kind==='VG')!,r=doc.records[c.index];
r.data=Uint8Array.from(r.data);
new DataView(r.data.buffer).setFloat64(c.parameter_offset+35,50,true);
fs.writeFileSync('reports/oracle-cases/VG_resistance50_aligned_probe.TSC',encode(doc));

