import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {components,decode,encode} from '../src/codec.ts';
import {nativeAc,nativeControl,nativeDc,nativeTransient,setNativeAc,setNativeControl,setNativeDc,setNativeTransient,type NativeAc,type NativeControl} from '../src/native-analysis.ts';
import {prepareJobs,resampleAc,type Curve} from '../src/solver.ts';

const base=new URL('../output/variant59/TINA-original/',import.meta.url);
const outputBytes=readFileSync(new URL('BF240_output.TSC',base));
const inputBytes=readFileSync(new URL('BF240_input.TSC',base));
const equalExcept=(before:Uint8Array,after:Uint8Array,allowed:(i:number)=>boolean)=>{
 assert.equal(before.length,after.length);
 for(let i=0;i<before.length;i++)if(!allowed(i))assert.equal(after[i],before[i],`opaque byte ${i} changed`);
};

// Real TINA originals identify the independent sweep source and control object.
const output=decode(outputBytes),input=decode(inputBytes);
assert.deepEqual(nativeDc(output),{input:'VS1',start:0,stop:44,intervals:500});
assert.deepEqual(nativeControl(output),{source:'IS1',start:0,stop:-.00019999999999999998,count:11,unit:'A'});
assert.deepEqual(nativeDc(input),{input:'VS1',start:.55,stop:.74,intervals:500});
assert.deepEqual(nativeControl(input),{source:'VS2',start:1,stop:36,count:2,unit:'V'});
for(const bytes of [outputBytes,inputBytes])assert.deepEqual(encode(decode(bytes)),Uint8Array.from(bytes),'original TSC encode/decode is lossless');

// AC record offsets and logarithmic mode are read from the original TINA files.
for(const bytes of [outputBytes,inputBytes]){
 const doc=decode(bytes),r=doc.records.find(x=>x.type===0xf282)!;
 const original=Uint8Array.from(r.data),expected:NativeAc={intervals:100,start:10,stop:1_000_000,logarithmic:true};
 assert.deepEqual(nativeAc(doc),expected);
 const next:NativeAc={intervals:37,start:20,stop:250_000,logarithmic:false};
 setNativeAc(doc,next);
 assert.deepEqual(nativeAc(decode(encode(doc))),next,'AC values survive encode/decode');
 equalExcept(original,r.data,i=>(i===0||i===1||(i>=8&&i<16)||(i>=40&&i<48)||i===89));
 for(const invalid of [{...next,start:0},{...next,stop:10},{...next,intervals:0},{...next,intervals:65536}]){
  const snapshot=encode(doc);assert.throws(()=>setNativeAc(doc,invalid));assert.deepEqual(encode(doc),snapshot,'invalid AC update is atomic');
 }
}

// Transient mode only edits the confirmed TSC prefix and time fields.
for(const bytes of [outputBytes,inputBytes]){
 const doc=decode(bytes),r=doc.records.find(x=>x.type===0xf283)!;
 const before=Uint8Array.from(r.data);
 assert.deepEqual(nativeTransient(doc),{start:0,stop:1e-6});
 setNativeTransient(doc,{start:.002,stop:.01});
 assert.deepEqual(nativeTransient(decode(encode(doc))),{start:.002,stop:.01},'transient settings survive encode/decode');
 equalExcept(before,r.data,i=>(i>=6&&i<22));
 for(const invalid of [{start:-1,stop:.01},{start:.01,stop:.01},{start:0,stop:NaN}]){
  const snapshot=encode(doc);assert.throws(()=>setNativeTransient(doc,invalid));assert.deepEqual(encode(doc),snapshot,'invalid transient update is atomic');
 }
}
{
 const doc=decode(outputBytes),r=doc.records.find(x=>x.type===0xf283)!,before=Uint8Array.from(r.data);
 r.data[0]=9;
 const corrupted=encode(doc);
 assert.equal(nativeTransient(doc),null,'unknown transient prefix is not interpreted');
 assert.throws(()=>setNativeTransient(doc,{start:.002,stop:.01}));
 assert.deepEqual(encode(doc),corrupted,'unknown prefix refusal does not mutate the TSC');
 assert.notDeepEqual(r.data,before);
}

// The transient netlist uses the requested start, stop and step; start >= stop fails.
{
 const doc=decode(outputBytes),config={kind:'transient' as const,input:'VS1',start:.002,stop:.01,step:1e-5,amplitude:.1,frequency:1000};
 const {jobs}=prepareJobs(doc,config);
 assert.match(jobs[0].netlist,/^\.tran 0\.00001 0\.01 0\.002 0\.00001$/m);
 assert.throws(()=>prepareJobs(doc,{...config,start:.01}),/Неверные параметры переходного процесса/);
}

// DC edits preserve the opaque prefix/tail while patching only its values and source string.
{
 const doc=decode(outputBytes),r=doc.records.find(x=>x.type===0xf281)!;
 const before=Uint8Array.from(r.data),oldEnd=before[36]+37;
 setNativeDc(doc,{input:'VS1',start:2,stop:8,intervals:17});
 const after=r.data;
 assert.deepEqual(nativeDc(decode(encode(doc))),{input:'VS1',start:2,stop:8,intervals:17});
 const reread=decode(encode(doc)),dcRecord=reread.records.find(x=>x.type===0xf281)!;
 const dcView=new DataView(dcRecord.data.buffer,dcRecord.data.byteOffset,dcRecord.data.byteLength);
 assert.equal(dcView.getFloat64(4,true),2,'native display range uses the updated DC start');
 assert.equal(dcView.getFloat64(12,true),2,'analysis sweep uses the updated DC start');
 equalExcept(before,after,i=>(i<2)||(i>=4&&i<28)||(i>=36&&i<oldEnd));
 assert.deepEqual(after.slice(36+1+after[36]),before.slice(oldEnd),'DC record suffix remains byte-for-byte intact');
 for(const invalid of [{input:'VS1',start:5,stop:4,intervals:4},{input:'VS1',start:0,stop:1,intervals:0},{input:'missing',start:0,stop:1,intervals:2}]){
  const snapshot=encode(doc);assert.throws(()=>setNativeDc(doc,invalid));assert.deepEqual(encode(doc),snapshot,'invalid DC update is atomic');
 }
}

// Reverse ordinal is based on decoded components, regardless of their record order.
for(const bytes of [outputBytes,inputBytes]){
 const doc=decode(bytes),prior=nativeControl(doc)!;
 const items=doc.records.filter(r=>[0x203,0x204,0x205,0x20a,0x20b,0x20c,0x244,0x20f,0x20e,0x210,0x211,0x223,0x206,0x207,0x218,0x22c,0x241,0x23a,0x258,0x259].includes(r.type));
 const rest=doc.records.filter(r=>!items.includes(r));items.reverse();
 doc.records=[...rest.slice(0,1),...items,...rest.slice(1)];
 const order=components(doc).slice().reverse(),target=order.findIndex(c=>c.label===prior.source);
 assert.ok(target>=0);
 const rec=doc.records.find(r=>r.type===0xf287)!,mode=doc.records.find(r=>r.type===0xf280)!;
 const unrelated=doc.records.filter(r=>r!==rec&&r!==mode).map(r=>[r,Uint8Array.from(r.data)] as const);
 const oldRec=Uint8Array.from(rec.data),oldMode=Uint8Array.from(mode.data);
 const next:NativeControl={...prior,start:prior.start+1,stop:prior.stop-1,count:Math.max(prior.count,2)};
 setNativeControl(doc,next);
 assert.deepEqual(nativeControl(doc),next);
 const encoded=encode(doc),reread=decode(encoded);
 assert.deepEqual(nativeControl(reread),next,'control source survives encode/decode');
 assert.equal(new DataView(rec.data.buffer,rec.data.byteOffset,rec.data.byteLength).getUint32(2,true),target,'stored reverse ordinal selects the requested source');
 equalExcept(oldMode,mode.data,i=>i===0||(i>=2&&i<10)||i===53);
 for(const [r,before] of unrelated)assert.deepEqual(Uint8Array.from(r.data),before,'unrelated TSC records stay untouched');
 const snapshot=encode(doc),bad={...next,count:101};
 assert.throws(()=>setNativeControl(doc,bad));assert.deepEqual(encode(doc),snapshot,'invalid control update is atomic');
 // An invalid unit encoding is rejected before either record is replaced.
 assert.throws(()=>setNativeControl(doc,{...next,unit:'🙂'}));assert.deepEqual(encode(doc),snapshot);
 const controlBytes=Uint8Array.from(rec.data),modeBytes=Uint8Array.from(mode.data);
 setNativeControl(doc,null);
 assert.equal(nativeControl(doc),null);
 assert.equal(mode.data[0],0,'control mode is disabled');
 assert.deepEqual(encode(decode(encode(doc))),encode(doc),'disabled state survives encode/decode');
 assert.deepEqual(mode.data.slice(0,1),Uint8Array.of(0));
 assert.ok(controlBytes.length>0&&modeBytes.length>0);
}

// AC output is sampled uniformly in log frequency. Complex values interpolate
// both components, and the requested first/last frequencies remain exact.
{
 const curve:Curve={names:['frequency','v(out)'],plot:'AC',values:[[[1,0],[0,0]],[[10,0],[10,20]],[[100,0],[20,40]]]};
 const config={kind:'ac' as const,start:2,stop:50,ac_intervals:2,ac_logarithmic:true};
 const sampled=resampleAc(curve,config),t0=Math.log(2)/Math.log(10),t1=Math.log(5)/Math.log(10);
 assert.equal(sampled.values.length,3);
 assert.equal((sampled.values[0][0] as [number,number])[0],2);
 assert.deepEqual(sampled.values[0][1],[10*t0,20*t0]);
 assert.equal((sampled.values[1][0] as [number,number])[0],10);
 assert.deepEqual(sampled.values[1][1],[10,20]);
 assert.equal((sampled.values[2][0] as [number,number])[0],50);
 assert.deepEqual(sampled.values[2][1],[10+10*t1,20+20*t1]);
 assert.equal(resampleAc(curve,{kind:'ac',start:2,stop:50}),curve,'ordinary AC result is unchanged without ac_intervals');
}

console.log('Native analysis: BF240 source selection, reverse ordinals, opaque data, atomic validation, disable and round trip passed');
