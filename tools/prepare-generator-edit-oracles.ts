import fs from 'node:fs';
import {decode,encode,components} from '../src/codec.ts';
import {setNativeGenerator,type NativeGeneratorSettings} from '../src/native-generator.ts';
const root='reports/oracle-cases/';
for(const [name,settings] of [
 ['VG_browser_sine',{waveform:'sine',offset:.25,amplitude:.75,frequency:500,phase:45}],
 ['VG_browser_square',{waveform:'rectangle',offset:.4,amplitude:1.2,frequency:250,edge:5e-6}],
] as [string,NativeGeneratorSettings][]){
 const doc=decode(fs.readFileSync(root+'RC_native_sine.TSC'));
 setNativeGenerator(doc,components(doc).find(c=>c.kind==='VG')!.index,settings);
 fs.writeFileSync(root+name+'.TSC',encode(doc));
}
