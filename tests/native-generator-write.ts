import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decode,encode,component,components,newComponent,exportSpice} from '../src/codec.ts';
import {nativeGenerator,setNativeGenerator,type NativeGeneratorSettings} from '../src/native-generator.ts';

const original=readFileSync(new URL('../reports/oracle-cases/RC_native_sine.TSC',import.meta.url));
const target:NativeGeneratorSettings={waveform:'sine',offset:.25,amplitude:.75,frequency:500,phase:45};
// Exercise both Node Buffer.slice aliasing and Uint8Array subviews. The setter
// must replace the record, never overwrite a shared backing buffer.
for(const buffer of [false,true]){
 const doc=decode(original),index=components(doc).find(c=>nativeGenerator(c)!==null)!.index;
 const rec=doc.records[index],p=component(rec,index).parameter_offset;
 const backing=buffer?Buffer.alloc(rec.data.length+64,0xa5):new Uint8Array(rec.data.length+64).fill(0xa5);
 backing.set(rec.data,32);rec.data=backing.subarray(32,32+rec.data.length);
 const before=Uint8Array.from(backing),recordBefore=Uint8Array.from(rec.data);
 setNativeGenerator(doc,index,target);
 assert.deepEqual(nativeGenerator(component(rec,index)),target);
 assert.deepEqual(Uint8Array.from(backing),before,'shared backing buffer must stay intact');
 const changed=Array.from(rec.data.keys()).filter(i=>rec.data[i]!==recordBefore[i]);
 assert.ok(changed.length>0);
 assert.ok(changed.every(i=>(i>=p&&i<p+8)||i===p+9||(i>=p+10&&i<p+34)));
 const reread=decode(encode(doc));
 assert.deepEqual(nativeGenerator(component(reread.records[index],index)),target);
 for(let i=0;i<doc.records.length;i++)if(i!==index)assert.deepEqual(doc.records[i],decode(original).records[i]);
 assert.deepEqual(doc.trailer,decode(original).trailer);
 for(const invalid of [{...target,frequency:0},{...target,amplitude:-1},{...target,offset:NaN},{...target,phase:Infinity},{...target,resistance:-1},{...target,resistance:NaN},{waveform:'rectangle',offset:0,amplitude:1,frequency:100,edge:.01}] as NativeGeneratorSettings[]){
  const bytes=encode(doc);assert.throws(()=>setNativeGenerator(doc,index,invalid));assert.deepEqual(encode(doc),bytes,'invalid edit must be atomic');
 }
 const square:NativeGeneratorSettings={waveform:'rectangle',offset:.4,amplitude:1.2,frequency:250,edge:5e-6};
 setNativeGenerator(doc,index,square);assert.deepEqual(nativeGenerator(component(rec,index)),square);
 setNativeGenerator(doc,index,target);assert.deepEqual(nativeGenerator(component(rec,index)),target);
 const beforeResistance=Uint8Array.from(rec.data);
 setNativeGenerator(doc,index,{...target,resistance:50});
 assert.deepEqual(nativeGenerator(component(rec,index)),{...target,resistance:50});
 for(let i=0;i<rec.data.length;i++)if(i<p+35||i>=p+43)assert.equal(rec.data[i],beforeResistance[i]);
 // User labels must never collide with the generated internal resistor.
 doc.records.splice(-1,0,newComponent('R',900,900,'vg_series_'+index));
 const names=exportSpice(doc).text.split('\n').filter(l=>l&&!/^[*.]/.test(l)).map(l=>l.split(' ')[0].toLowerCase());
 assert.equal(new Set(names).size,names.length);
 rec.data[p+34]=1;assert.equal(nativeGenerator(component(rec,index)),null);assert.throws(()=>exportSpice(doc));rec.data[p+34]=0;
 rec.data[p+9]=7;const opaque=encode(doc);
 assert.throws(()=>setNativeGenerator(doc,index,target));assert.deepEqual(encode(doc),opaque);
}
console.log('Native generator write: subviews, Buffer, preserved unknown bytes, round trip and atomic rejection passed');
