import type {BjtGraphPanel,BjtGraphPoint,BjtGraphScene,BjtGraphSeries} from './bjt-graph-scene.ts';

/** Native TINA diagram viewer export. Every curve owns its own XY block. */
export type NativeGraphCurve={name:string;points:Array<[number,number]>;color?:number;dash?:boolean};
export type NativeGraphLabel={text:string;x:number;y:number;dx?:number;dy?:number};
export type NativeGraphSpec={
 title:string;xLabel:string;yLabel:string;
 bounds:{xmin:number;xmax:number;ymin:number;ymax:number};
 curves:NativeGraphCurve[];labels?:NativeGraphLabel[];
};

const MAGIC=Uint8Array.from([79,66,83,83,26,1,0,0,0,0,0]);
type Rec={type:number;version:number;data:Uint8Array};
const smokeHeader=hex('10416e616c7973697320726573756c74000656312e3030001330322f30392f39362031373a303020434554002b416e616c7973697320726573756c742026206469616772616d207669657765722073657474696e67732e001754494e4120392e332e3135302e3332382053462d5449004228632920436f7079726967687420313939332c39342c39352c39362044657369676e536f667420496e632e0a0d416c6c207269676874732072657365727665642e0000000000');
const archiveTemplate=hex('0100000044ac0000');
const archiveTableTemplate=hex('0100000088130000e8030000030100');
const curveTemplate=hex('020a4368616e6e656c5f31000100000000000000000000000000000040000003000000070000010001009a9999999999b93f000000000000f83f0000000000000000000000000000000000010000000000000000000000000000000001000000000000000000000000000000000100000000000000000000000000000000010000000000000000000000000000000001000000000000000000000000000000000100000000000000000000000000000000010000000000000000000000000000f03f000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000');
const scaleTemplate=hex('000000006400000032000000');
const pageTemplate=hex('020000000b545220726573756c7432009a9999999999b93f989999999999b93f9a9999999999b93f000000000000e03f0100');
const groupTemplate=hex('0300000002000000000000000000000b000000');
const xAxisTemplate=hex('040000000200000003000000000200000001000000000000f03f0200000006417269616c00080000ff0c0000000000000006417269616c00080000ff0c00000002000000000000000000000000000000000000400000000000000000000000000000004008c2f0e5ecff2028000373290000');
const yAxisTemplate=hex('050000000200000003000000000200000001000000000000f03f0200000006417269616c00080000ff0c0000000000000006417269616c00080000ff0c000000020000009a9999999999b93f000000000000f83f9a9999999999b93f000000000000f83f0dcde0eff0ffe6e5ede8e52028000356290001');
const curveVisualTemplate=hex('06000000020000000300000001800000000000000002000000000700000032000000070000000100000007000000010400000005000000');
const crossTemplate=hex('08000000030000000400000005000000');
// One font/text record created in TINA's text tool; only IDs and text placement change.
const textTemplate=hex('58000026035201723780a815d2e53f22feb8757907dc3f6eaf2587b8ca843fed83fbbb4df0913f0c00110006417269616c00080000ff0c0000000000000001000000024100000000000753796d626f6c0001000000ffffff000100000001000000000000000000e03f000000000000e03f000000000000e83f000000000000e83f333333333333d33f000000000000e03f0200ffffffffffffffffffff00000000000000000000000000000000');

function hex(value:string):Uint8Array{return Uint8Array.from(value.match(/../g)!.map(v=>parseInt(v,16)));}
function clone(bytes:Uint8Array):Uint8Array{return bytes.slice();}
function pascal(value:string):Uint8Array{
 const data=cp1251(value);if(data.length>254)throw new RangeError('Native TINA labels are limited to 254 bytes.');
 return Uint8Array.from([data.length+1,...data,0]);
}
function cp1251(value:string):number[]{
 const out:number[]=[];
 for(const c of value){const n=c.codePointAt(0)!;
  if(n<0x80){out.push(n);continue;}
  if(n>=0x410&&n<=0x44f){out.push(n-0x350);continue;}
  const special:Record<number,number>={0x401:0xa8,0x451:0xb8,0x404:0xaa,0x454:0xba,0x406:0xb2,0x456:0xb3,0x407:0xaf,0x457:0xbf,0x408:0xa3,0x458:0xb3,0x490:0xa5,0x491:0xb4,0x20ac:0x88,0x201a:0x82,0x201e:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x2030:0x89,0x2039:0x8b,0x2018:0x91,0x2019:0x92,0x201c:0x93,0x201d:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,0x2122:0x99,0x203a:0x9b,0x2116:0xb9,0x00a0:0xa0,0x00a4:0xa4,0x00a7:0xa7,0x00a9:0xa9,0x00ab:0xab,0x00ac:0xac,0x00ad:0xad,0x00ae:0xae,0x00b0:0xb0,0x00b1:0xb1,0x00b5:0xb5,0x00b6:0xb6,0x00b7:0xb7,0x00bb:0xbb,0x00d7:0xd7,0x00f7:0xf7,0x03a9:0xa9,0x03bc:0xb5};
  const mapped=special[n];if(mapped===undefined)throw new Error(`Character U+${n.toString(16)} is not supported in TINA's native text encoding.`);out.push(mapped);
 }
 return out;
}
function putU16(d:Uint8Array,p:number,v:number){new DataView(d.buffer,d.byteOffset,d.byteLength).setUint16(p,v,true);}
function putU32(d:Uint8Array,p:number,v:number){new DataView(d.buffer,d.byteOffset,d.byteLength).setUint32(p,v,true);}
function putI16(d:Uint8Array,p:number,v:number){new DataView(d.buffer,d.byteOffset,d.byteLength).setInt16(p,v,true);}
function putF64(d:Uint8Array,p:number,v:number){if(!Number.isFinite(v))throw new Error('Native graph coordinates must be finite.');new DataView(d.buffer,d.byteOffset,d.byteLength).setFloat64(p,v,true);}
function readU32(d:Uint8Array,p:number){return new DataView(d.buffer,d.byteOffset,d.byteLength).getUint32(p,true);}
function join(...arrays:Uint8Array[]):Uint8Array{const out=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let p=0;for(const a of arrays){out.set(a,p);p+=a.length;}return out;}
function record(type:number,version:number,data:Uint8Array):Rec{return{type,version,data};}
function serialize(records:Rec[]):Uint8Array{
 const bytes=records.reduce((n,r)=>n+8+r.data.length, MAGIC.length);const out=new Uint8Array(bytes);out.set(MAGIC);let p=MAGIC.length;const v=new DataView(out.buffer);
 for(const r of records){v.setUint16(p,r.type,true);v.setUint16(p+2,r.version,true);v.setUint32(p+4,r.data.length,true);out.set(r.data,p+8);p+=8+r.data.length;}
 return out;
}
function curveMeta(curve:NativeGraphCurve,index:number,offset:number):Uint8Array{
 if(curve.points.length<2)throw new Error(`Curve “${curve.name}” must contain at least two points.`);
 const flat=curve.points.flat();if(flat.some(v=>!Number.isFinite(v)))throw new Error(`Curve “${curve.name}” contains non-finite coordinates.`);
 const minX=Math.min(...curve.points.map(p=>p[0])),maxX=Math.max(...curve.points.map(p=>p[0])),minY=Math.min(...curve.points.map(p=>p[1])),maxY=Math.max(...curve.points.map(p=>p[1]));
 const name=pascal(curve.name);let d=join(curveTemplate.slice(0,1),name,curveTemplate.slice(2+curveTemplate[1]));
 const end=2+d[1];
 putF64(d,end+1,minX);putF64(d,end+9,maxX);putU32(d,end+19,curve.points.length);putU16(d,end+23,7+2*index);putF64(d,end+30,minY);putF64(d,end+38,maxY);
 putU32(d,d.length-11,offset);putU16(d,d.length-7,1);putU16(d,d.length-5,0);putU16(d,d.length-3,0);d[d.length-1]=0;
 return d;
}
function curveData(curves:NativeGraphCurve[]):Uint8Array{
 const out=new Uint8Array(curves.reduce((n,c)=>n+c.points.length*16,0));let p=0;const view=new DataView(out.buffer);
 for(const c of curves)for(const [x,y] of c.points){view.setFloat64(p,x,true);view.setFloat64(p+8,y,true);p+=16;}
 return out;
}
function visualCurve(curve:NativeGraphCurve,index:number,axes:[number,number]):Uint8Array{
 const d=clone(curveVisualTemplate),curveId=6+2*index;putU32(d,0,curveId);putU32(d,4,2);putU32(d,8,3);putU32(d,13,curve.color??0x008040);putU32(d,17,curve.dash?1:0);putU32(d,38,1);putU32(d,42,7+2*index);putU32(d,47,axes[0]);putU32(d,51,axes[1]);return d;
}
function axisRecord(template:Uint8Array,id:number,label:string,bounds:[number,number]):Uint8Array{
 const d=clone(template);putU32(d,0,id);putU32(d,4,2);putF64(d,68,bounds[0]);putF64(d,76,bounds[1]);putF64(d,84,bounds[0]);putF64(d,92,bounds[1]);
 return join(d.slice(0,100),pascal(label),pascal(''),d.slice(-1));
}
function labelRecord(label:NativeGraphLabel,uid:number,plotId:number,bounds:NativeGraphSpec['bounds']):Uint8Array|undefined{
 const d=clone(textTemplate);putU16(d,0,uid);
 const px=85+(label.x-bounds.xmin)/(bounds.xmax-bounds.xmin)*(1158-85)+(label.dx??0);
 const py=646-(label.y-bounds.ymin)/(bounds.ymax-bounds.ymin)*(646-68)+(label.dy??0);
 if(!(px>30&&px<1150&&py>40&&py<690))return undefined;
 putI16(d,3,Math.round(px));putI16(d,5,Math.round(py));
 putF64(d,7,px/1182);putF64(d,15,(py-38)/685);putF64(d,23,Math.max(12,Math.min(650,label.text.length*7.6+4))/1182);putF64(d,31,12/685);
 putU16(d,39,12);putU16(d,41,plotId);
 const fontStart=43+1+d[43],textStart=fontStart+16,textEnd=textStart+1+d[textStart];
 return join(d.slice(0,textStart),pascal(label.text),d.slice(textEnd));
}

/** Build one native TINA viewer document from independent XY curves. */
export function exportNativeGraphTdr(spec:NativeGraphSpec):Uint8Array{
 if(!spec.curves.length)throw new Error('A native graph needs at least one curve.');
 if(spec.curves.length>250)throw new Error('The native viewer supports at most 250 curves in one export.');
 if(!(spec.bounds.xmin<spec.bounds.xmax&&spec.bounds.ymin<spec.bounds.ymax))throw new Error('Native graph bounds must be increasing.');
 const curves=spec.curves,labels=spec.labels??[],plotId=2,archiveId=1,groupId=3,xAxisId=4,yAxisId=5,crossId=6+2*curves.length;
 const data=curveData(curves);let offset=0;const metas:Rec[]=[];
 for(let i=0;i<curves.length;i++){const d=curveMeta(curves[i],i,offset);metas.push(record(0x302,20,d));offset+=curves[i].points.length*16;}
 const countData=new Uint8Array(4);putU32(countData,0,curves.length+6+labels.length);
 const plot=clone(pageTemplate),title=pascal(spec.title);putU32(plot,0,plotId);const page=join(plot.slice(0,4),title,plot.slice(5+plot[4]));
 const graphCurveVisuals=curves.map((c,i)=>record(0x404,16,visualCurve(c,i,[xAxisId,yAxisId])));
 const annotationRecords:Rec[]=[];let uid=crossId+1;
 for(const label of labels){const d=labelRecord(label,uid,plotId,spec.bounds);if(d){annotationRecords.push(record(0x408,64,d));uid++;}}
 // Object count follows TINA's imported one-curve viewer convention: N+6,
 // with one extra native object per text annotation.
 putU32(countData,0,curves.length+6+annotationRecords.length);
 const records:Rec[]=[record(2,0,clone(smokeHeader)),record(0x400,16,countData)];
 const archive=clone(archiveTemplate);putU32(archive,0,archiveId);records.push(record(0x300,18,archive));
 const table=clone(archiveTableTemplate);putU32(table,0,curves.length);records.push(record(0x301,17,table));
 records.push(...metas,record(0x306,16,data),record(0x304,16,clone(scaleTemplate)),record(0x306,16,new Uint8Array()));
 records.push(record(0x401,32,page));
 const group=clone(groupTemplate);putU32(group,0,groupId);putU32(group,4,plotId);records.push(record(0x402,16,group));
 records.push(record(0x403,16,axisRecord(xAxisTemplate,xAxisId,spec.xLabel,[spec.bounds.xmin,spec.bounds.xmax])));
 records.push(record(0x403,16,axisRecord(yAxisTemplate,yAxisId,spec.yLabel,[spec.bounds.ymin,spec.bounds.ymax])));
 records.push(...graphCurveVisuals);
 const cross=clone(crossTemplate);putU32(cross,0,crossId);putU32(cross,4,groupId);putU32(cross,8,xAxisId);putU32(cross,12,yAxisId);records.push(record(0x409,16,cross),...annotationRecords,record(0xff,0,new Uint8Array()));
 return serialize(records);
}

const nativeColor=(color:string|undefined,index:number):number=>{
 if(!color)return [0x0000b0,0x008000,0x00a040,0x800080,0x404040,0x000080,0x008080][index%7];
 const m=/^#([0-9a-f]{6})$/i.exec(color);if(!m)return 0x008040;const n=parseInt(m[1],16),r=n>>16,g=(n>>8)&255,b=n&255;return (b<<16)|(g<<8)|r;
};
function mapPoint(panel:BjtGraphPanel,p:BjtGraphPoint):[number,number]{
 if(panel.id==='output')return[p.x/panel.x.max,p.y/panel.y.max];
 if(panel.id==='transfer')return[-p.x/panel.x.max,p.y/panel.y.max];
 return[-p.x/panel.x.max,-p.y/panel.y.max];
}
function mapSeries(panel:BjtGraphPanel,s:BjtGraphSeries,index:number):NativeGraphCurve{
 return{name:`${panel.id}_${s.name}`.slice(0,96),points:s.points.map(p=>mapPoint(panel,p)),color:nativeColor(s.color,index),dash:s.dash};
}
function markerRadii(panel:BjtGraphPanel,scene:BjtGraphScene):[number,number]{
 const rx=Math.min(.007,(panel.id==='output'?scene.amplitudes.uce_V:scene.amplitudes.ib_A)/panel.x.max*.2);
 const ry=Math.min(.005,(panel.id==='input'?scene.amplitudes.ube_V:scene.amplitudes.ic_A)/panel.y.max*.2);
 return[rx,ry];
}
function combinedSpec(scene:BjtGraphScene):NativeGraphSpec{
 const panels=new Map(scene.panels.map(p=>[p.id,p]));const curves:NativeGraphCurve[]=[],labels:NativeGraphLabel[]=[];
 let colorIndex=0;
 for(const panel of scene.panels){for(const s of panel.series)curves.push(mapSeries(panel,s,colorIndex++));
  const [dx,dy]=markerRadii(panel,scene);
  for(const mark of panel.marks??[]){const [x,y]=mapPoint(panel,mark.point);const markName=mark.name==='Q'?'A':mark.name;
   const pts:[[number,number],[number,number],[number,number],[number,number],[number,number]]=[[x-dx,y],[x+dx,y],[x,y],[x,y-dy],[x,y+dy]];
   curves.push({name:`${panel.id}_${markName}_mark`,points:pts,color:nativeColor(mark.color,colorIndex++),dash:false});labels.push({text:markName,x,y,dx:5,dy:-17});
  }
 }
 for(const p of scene.projections){const a=panels.get(p.from),b=panels.get(p.to);if(!a||!b)continue;curves.push({name:`projection_${p.name}`.slice(0,96),points:[mapPoint(a,p.fromPoint),mapPoint(b,p.toPoint)],color:0x606060,dash:true});}
 curves.push({name:'coordinate axes',points:[[-1.05,0],[1.05,0],[0,0],[0,-1.05],[0,1.05]],color:0x202020});
 const output=panels.get('output')!,transfer=panels.get('transfer')!,input=panels.get('input')!;
 labels.push({text:'Выходные характеристики',x:.52,y:.78},{text:'Передаточная характеристика',x:-.97,y:.82},{text:'Входная характеристика при 5 В',x:-.98,y:-.82});
 return{title:scene.title.slice(0,100),xLabel:`${output.xLabel} ->; ${transfer.xLabel} <- (${transfer.x.max} ед.)`,yLabel:`${output.yLabel} up; ${input.yLabel} down`,bounds:{xmin:-1.1,xmax:1.1,ymin:-1.1,ymax:1.1},curves,labels};
}
function waveSpec(scene:BjtGraphScene):NativeGraphSpec{
 const curves:NativeGraphCurve[]=[],labels:NativeGraphLabel[]=[];
 const waveInfo=[
  {key:'ib_A' as const,scale:1e6,unit:'мкА'},
  {key:'ic_A' as const,scale:1e3,unit:'мА'},
  {key:'ube_V' as const,scale:1,unit:'В'},
  {key:'uce_V' as const,scale:1,unit:'В'},
 ];
 const fmt=(v:number)=>Number(v.toPrecision(4)).toString().replace('.',',');
 scene.timePanels.forEach((p,i)=>{const mid=(p.min+p.max)/2,amp=(p.max-p.min)/2;if(!(amp>0))return;
  curves.push({name:`wave${i}_${p.title}`,points:p.points.map(([t,y])=>[t*1000,3-i+(y-mid)/amp*.38]),color:[0x0000b0,0x008000,0x00a040,0x800080][i],dash:false});
  curves.push({name:`reference${i}`,points:[[0,3-i],[2,3-i]],color:0xc0c0c0,dash:true});
  const info=waveInfo[i],q=scene.q[info.key]*info.scale,a=scene.amplitudes[info.key]*info.scale;
  labels.push({text:`${p.title}: Q=${fmt(q)} ${info.unit}; A=${fmt(a)} ${info.unit}`,x:.08,y:3-i+.43});
 });
 return{title:`${scene.title} — 3.3`,xLabel:'Время, мс',yLabel:'Сигналы: iБ, iК, uБЭ, uКЭ (разнесены по полосам)',bounds:{xmin:0,xmax:2,ymin:-.5,ymax:3.5},curves,labels};
}
type Box={xmin:number;xmax:number;ymin:number;ymax:number};
function clipSegment(a:BjtGraphPoint,b:BjtGraphPoint,box:Box):[[number,number],[number,number]]|undefined{
 const dx=b.x-a.x,dy=b.y-a.y;let lo=0,hi=1;
 const tests:[number,number][]=[[-dx,a.x-box.xmin],[dx,box.xmax-a.x],[-dy,a.y-box.ymin],[dy,box.ymax-a.y]];
 for(const [p,q]of tests){if(p===0){if(q<0)return undefined;continue;}const r=q/p;if(p<0){if(r>hi)return undefined;if(r>lo)lo=r;}else{if(r<lo)return undefined;if(r<hi)hi=r;}}
 return[[a.x+lo*dx,a.y+lo*dy],[a.x+hi*dx,a.y+hi*dy]];
}
function clipPolyline(points:BjtGraphPoint[],box:Box):Array<Array<[number,number]>>{
 const pieces:Array<Array<[number,number]>>=[];let current:Array<[number,number]>=[];
 const same=(a:[number,number],b:[number,number])=>Math.abs(a[0]-b[0])<1e-10&&Math.abs(a[1]-b[1])<1e-10;
 const flush=()=>{if(current.length>1)pieces.push(current);current=[];};
 for(let i=1;i<points.length;i++){
  const clipped=clipSegment(points[i-1],points[i],box);if(!clipped){flush();continue;}
  const [start,end]=clipped;if(current.length&&same(current.at(-1)!,start)){if(!same(current.at(-1)!,end))current.push(end);}else{flush();current=[start,end];}
  const endsAtOriginal= same(end,[points[i].x,points[i].y]);
  if(!endsAtOriginal)flush();
 }
 flush();return pieces;
}
function detailSpec(scene:BjtGraphScene):NativeGraphSpec{
 const panel=scene.panels.find(p=>p.id==='output');if(!panel)throw new Error('The scene has no output characteristics.');
 const x0=scene.q.uce_V-3*scene.amplitudes.uce_V,x1=scene.q.uce_V+3*scene.amplitudes.uce_V,y0=scene.q.ic_A-3*scene.amplitudes.ic_A,y1=scene.q.ic_A+3*scene.amplitudes.ic_A;
 const box={xmin:x0,xmax:x1,ymin:y0,ymax:y1};const curves:NativeGraphCurve[]=[];
 panel.series.forEach((s,i)=>clipPolyline(s.points,box).forEach((piece,j)=>curves.push({name:`${s.name}${j?` segment ${j+1}`:''}`.slice(0,96),points:piece,color:nativeColor(s.color,i),dash:s.dash})));
 const dx=(x1-x0)*.012,dy=(y1-y0)*.012;
 for(const [name,p]of [['a',scene.a],['A',scene.q],['b',scene.b]] as const)curves.push({name,points:[[p.uce_V-dx,p.ic_A],[p.uce_V+dx,p.ic_A],[p.uce_V,p.ic_A],[p.uce_V,p.ic_A-dy],[p.uce_V,p.ic_A+dy]],color:name==='A'?0x0000ff:0x000000});
 const px=(p:{uce_V:number;ic_A:number})=>({text:p===scene.q?'A':p===scene.a?'a':'b',x:p.uce_V,y:p.ic_A,dx:5,dy:-15});
 return{title:`${scene.title} — рабочая точка`,xLabel:panel.xLabel,yLabel:panel.yLabel,bounds:{xmin:x0,xmax:x1,ymin:y0,ymax:y1},curves,labels:[px(scene.a),px(scene.q),px(scene.b)]};
}
/** Export a computed BJT construction as a native TINA graph viewer document. */
export function exportBjtNativeTdr(scene:BjtGraphScene,kind:'combined'|'waveforms'|'detail'='combined'):Uint8Array{
 const spec=kind==='combined'?combinedSpec(scene):kind==='waveforms'?waveSpec(scene):detailSpec(scene);spec.labels=spec.labels?.filter(label=>label.text.length===1);return exportNativeGraphTdr(spec);
}
