import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {decode,encode,build,presets,components,pins,updateComponent,connectivity,exportSpice,toProject,fromProject,moveComponent,modelParameters,makeWire,wirePoints} from '../src/codec.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const fixtures=path.join(path.dirname(fileURLToPath(import.meta.url)),'fixtures');
let tests=0;
function test(name:string,fn:()=>void){fn();tests++;console.log('OK',name);}
test('supplied native BF240 v02 file survives byte-identical roundtrip',()=>{
 const original=fs.readFileSync(path.join(fixtures,'BF240_output_v02.TSC'));
 assert.deepEqual(Buffer.from(encode(decode(original))),original);
});
test('three native presets survive byte-identical roundtrip',()=>{
 for(const spec of Object.values(presets)){const bytes=encode(build(spec));assert.deepEqual(encode(decode(bytes)),bytes);}
});
const oracleDir=process.env.TINA_PYTHON_ORACLES || path.join(root,'Tina_Editor/examples');
if(fs.existsSync(oracleDir))test('three native presets are byte-identical to Python builder',()=>{
 for(const [name,spec] of Object.entries(presets)){
  const bytes=encode(build(spec)),python=fs.readFileSync(path.join(oracleDir,`BF240_${name === 'output' ? 'output_v03' : name}.TSC`));
  assert.deepEqual(Buffer.from(bytes),python);assert.deepEqual(encode(decode(bytes)),bytes);
 }
});
else console.log('SKIP Python builder byte oracles: independent reference files unavailable; set TINA_PYTHON_ORACLES to their directory');
test('cp1251 variable length edits preserve unknown records and BJT parameters',()=>{
 const doc=build(presets.output),q=components(doc).find(c=>c.kind==='NPN')!,before=modelParameters(q);const untouched=doc.records.filter((_,i)=>i!==q.index).map(r=>r.data.slice());
 updateComponent(doc,q.index,{label:'Транзистор 59',uid:'Новая метка',label_dx:23,label_dy:17,orientation:2});
 const after=components(doc).find(c=>c.index===q.index)!;assert.equal(after.label,'Транзистор 59');assert.equal(after.uid,'Новая метка');assert.equal(after.label_dx,23);assert.equal(after.orientation,2);assert.deepEqual(modelParameters(after),before);
 assert.deepEqual(doc.records.filter((_,i)=>i!==q.index).map(r=>r.data),untouched);assert.deepEqual(encode(fromProject(toProject(doc))),encode(doc));
});
test('collector/base/emitter connectivity and current polarity',()=>{
 const doc=build(presets.output),nn=Object.fromEntries(connectivity(doc).map(({component:c,nodes})=>[c.label,nodes]));
 assert.equal(nn.T1[2],'0');assert.deepEqual(nn.IS1,[nn.T1[1],'0']);assert.notEqual(nn.VS1[1],'0');assert.deepEqual(nn.AM1,[nn.VS1[0],nn.T1[0]]);
 const result=exportSpice(doc);assert.match(result.text,new RegExp(`I_IS1 ${nn.T1[1]} 0 DC`));assert.match(result.text,/\.model M_BF240 NPN/);assert.equal(result.mapping.names.T1,'Q_T1');
});
test('rotation follows counted label; invalid orientation rejected',()=>{
 const doc=build(presets.output),c=components(doc).find(c=>c.kind==='I')!,oldByte=c.record.data[8];
 assert.deepEqual(pins(c),[[200,280],[200,320]]);updateComponent(doc,c.index,{orientation:1});assert.equal(c.record.data[8],oldByte);assert.deepEqual(pins(components(doc).find(x=>x.index===c.index)!),[[200,280],[200,240]]);
 c.record.data[components(doc).find(x=>x.index===c.index)!.orientation_offset]=4;assert.throws(()=>exportSpice(doc),/Зеркальное/);
});
test('moving pins moves matching wire vertices without changing unrelated data',()=>{
 const doc=build(presets.output),q=components(doc).find(c=>c.kind==='NPN')!,old=pins(q);moveComponent(doc,q.index,q.x+8,q.y+16);
 assert.deepEqual(pins(components(doc).find(c=>c.index===q.index)!),old.map(([x,y])=>[x+8,y+16]));
 assert.ok(doc.records.filter(r=>r.type===256).flatMap(wirePoints).some(p=>p[0]===312&&p[1]===256));
});
test('moving a wire tap or shared terminal preserves the electrical network and original junction records',()=>{
 for(const sharedTerminal of [false,true]){
  const doc=build({format:'tina-circuit-v1',components:[{kind:'GND',x:-40,y:0},{kind:'R',x:0,y:0,label:'R1',rotation:3,value:1000},{kind:'R',x:sharedTerminal?0:80,y:sharedTerminal?0:40,label:'R2',value:2000}],wires:sharedTerminal?[[[-40,0],[0,0]]]:[[[-40,0],[40,0]],[[0,40],[80,40]]]});
  const network=()=>{const terminals=connectivity(doc).flatMap(({component:c,nodes})=>nodes.map((node,i)=>({label:(c.label||'GND')+':'+i,node})));return terminals.flatMap(a=>terminals.map(b=>[a.label,b.label,a.node===b.node]));};
  const before=network(),junction=doc.records.find(r=>r.type===256)!,original=junction.data.slice();
  const r=components(doc).find(c=>c.label==='R1')!;moveComponent(doc,r.index,8,8);
  assert.deepEqual(network(),before);assert.deepEqual(junction.data,original);
  if(sharedTerminal)assert.equal(connectivity(doc).find(c=>c.component.label==='R1')!.nodes[0],'0');else assert.notEqual(connectivity(doc).find(c=>c.component.label==='R1')!.nodes[0],'0');
  assert.deepEqual(encode(decode(encode(doc))),encode(doc));
 }
});
test('new wires reject zero sections and preserve declared points',()=>{
 assert.throws(()=>makeWire([[0,0],[0,0]]));const p:[number,number][]=[[0,0],[16,0],[16,24]];assert.deepEqual(wirePoints(makeWire(p)),p);
});
test('corrupt bounds and unknown physical symbols fail closed',()=>{
 assert.throws(()=>decode(Uint8Array.of(79,66)));const data=encode(build(presets.output));assert.throws(()=>decode(data.slice(0,-1)));
 const doc=build(presets.output);doc.records.splice(2,0,{type:0x222,version:66,data:new Uint8Array(12)});assert.throws(()=>exportSpice(doc));
});
const corpus=process.argv[2];let count=0,bytes=0;
function scan(dir:string){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())scan(p);else if(/\.tsc$/i.test(entry.name)){const data=fs.readFileSync(p);assert.deepEqual(Buffer.from(encode(decode(data))),data,p);count++;bytes+=data.length;}}}
if(corpus){scan(corpus);console.log(`CORPUS ${count} files, ${bytes} bytes, byte-identical`);}
console.log(`${tests} focused checks passed`);

