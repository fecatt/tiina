import assert from 'node:assert/strict';
import {exportBjtNativeTdr,exportNativeGraphTdr,type NativeGraphSpec} from '../src/native-graph-export.ts';
import type {BjtGraphScene} from '../src/bjt-graph-scene.ts';

const magic=Buffer.from([79,66,83,83,26,1,0,0,0,0,0]);
function parse(bytes:Uint8Array){
 const b=Buffer.from(bytes);assert.deepEqual(b.subarray(0,magic.length),magic);const records:{type:number;version:number;data:Buffer}[]=[];let p=magic.length;
 while(p<b.length){assert.ok(p+8<=b.length,'complete record header');const type=b.readUInt16LE(p),version=b.readUInt16LE(p+2),n=b.readUInt32LE(p+4);p+=8;assert.ok(p+n<=b.length,'record within file');records.push({type,version,data:b.subarray(p,p+n)});p+=n;if(type===0xff)break;}
 assert.equal(p,b.length,'no trailing bytes');assert.equal(records.at(-1)?.type,0xff);return records;
}
const spec:NativeGraphSpec={title:'Native graph proof',xLabel:'Voltage (V)',yLabel:'Current (mA)',bounds:{xmin:-2,xmax:2,ymin:-3,ymax:3},curves:[
 {name:'ascending',points:[[-1,0],[0,2],[1,1]],color:0x0000ff},
 {name:'descending',points:[[0,3],[.5,2],[2,-1]],color:0x008000,dash:true},
],labels:[{text:'A',x:0,y:2}]};
const generated=parse(exportNativeGraphTdr(spec));
const find=(type:number)=>generated.filter(r=>r.type===type);
assert.equal(find(0x302).length,2);assert.equal(find(0x404).length,2);assert.equal(find(0x408).length,1);
assert.equal(find(0x400)[0].data.readUInt32LE(0),9,'graph object count includes two curves and one text record');
assert.equal(find(0x301)[0].data.readUInt32LE(0),2,'channel count');
const curveMeta=find(0x302),xy=find(0x306)[0].data;
for(let i=0,offset=0;i<2;i++){
 const d=curveMeta[i].data,end=2+d[1];assert.equal(d[end-1],0,'Pascal name includes its terminating NUL');assert.equal(d[end],1,'native metadata bool follows the full name');assert.equal(d.readUInt32LE(end+19),spec.curves[i].points.length);
 assert.equal(d.readUInt16LE(end+23),7+2*i);assert.equal(d.readUInt32LE(d.length-11),offset);assert.equal(d.readUInt16LE(d.length-7),1);
 for(let j=0;j<spec.curves[i].points.length;j++){const p=offset+j*16;assert.equal(xy.readDoubleLE(p),spec.curves[i].points[j][0]);assert.equal(xy.readDoubleLE(p+8),spec.curves[i].points[j][1]);}
 offset+=spec.curves[i].points.length*16;
}
const visual=find(0x404);assert.equal(visual[0].data.readUInt32LE(38),1);assert.equal(visual[1].data.readUInt32LE(38),1);assert.equal(visual[0].data.readUInt32LE(42),7);assert.equal(visual[1].data.readUInt32LE(42),9);
assert.equal(visual[0].data.readUInt32LE(47),4);assert.equal(visual[0].data.readUInt32LE(51),5);
const xAxis=find(0x403)[0].data;assert.equal(xAxis.readDoubleLE(68),-2);assert.equal(xAxis.readDoubleLE(76),2);

const panel=(id:'output'|'transfer'|'input',series:BjtGraphScene['panels'][number]['series']):BjtGraphScene['panels'][number]=>({id,title:id,xLabel:'x',yLabel:'y',rect:{x:0,y:0,width:1,height:1},x:{min:0,max:10,reverse:false},y:{min:0,max:10,reverse:false},series,marks:[{name:'A',point:{x:5,y:5}}]});
const scene:BjtGraphScene={title:'Scene',panels:[panel('output',[{name:'out',points:[{x:0,y:0},{x:10,y:10}]}]),panel('transfer',[{name:'transfer',points:[{x:0,y:10},{x:10,y:0}]}]),panel('input',[{name:'input',points:[{x:0,y:0},{x:10,y:10}]}])],timePanels:[0,1,2,3].map(i=>({title:`signal ${i}`,yLabel:`unit ${i}`,rect:{x:0,y:0,width:1,height:1},min:-1,max:1,points:[[0,-1],[.001,1],[.002,-1]]})),projections:[],notes:[],q:{uce_V:5,ic_A:5,ib_A:5,ube_V:5},a:{uce_V:4,ic_A:4,ib_A:4,ube_V:4},b:{uce_V:6,ic_A:6,ib_A:6,ube_V:6},amplitudes:{uce_V:1,ic_A:1,ib_A:1,ube_V:1},equations:[],calculations:[],calculationWarnings:[]};
for(const kind of ['combined','waveforms','detail'] as const){const records=parse(exportBjtNativeTdr(scene,kind));assert.ok(records.filter(r=>r.type===0x302).length>0,`${kind} channels`);assert.equal(records.filter(r=>r.type===0x302).length,records.filter(r=>r.type===0x404).length,`${kind} presentation/data channels match`);}
console.log('native graph exporter records, pointers, independent XY arrays, text labels, axes and scene variants passed');
