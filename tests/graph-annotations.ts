import assert from 'node:assert/strict';import {calloutArrow,bjtOutputCallouts,leaderSegmentsCross}from'../src/graph-annotations.ts';
const bounds={xmin:0,xmax:50,ymin:0,ymax:.03};const c={text:'IБ = 20 мкА',x:20,y:.01,targetX:18,targetY:.002};const pts=calloutArrow(c,bounds);assert.deepEqual(pts[1],[18,.002]);assert.deepEqual(pts[3],[18,.002]);assert.ok(pts.flat().every(Number.isFinite));assert.notDeepEqual(pts[2],pts[4]);
const family=[0,20e-6,40e-6,60e-6].map(ib=>({ib_A:ib,points:[[0,0],[20,ib*100],[44,ib*120]] as Array<[number,number]>}));const labels=bjtOutputCallouts({output:family,limits:{pCollectorMax_W:.35}},30e-6,bounds);assert.equal(labels.length,3);assert.equal(labels[0].text,'Pmax = 350 мВт');assert.equal(labels[1].text,'IБ = 20 мкА');assert.equal(labels[2].text,'IБ = 40 мкА');assert.ok(labels.every(c=>Number.isFinite(c.targetY)));console.log('Leader labels: selected family curves, power boundary and exact arrow tips passed');
// Dense full-range families reproduce the former crossing-leader failure.
assert.ok(leaderSegmentsCross([0,0],[20,20],[0,20],[20,0]));
assert.ok(leaderSegmentsCross([0,0],[20,0],[10,0],[30,0]));
assert.equal(leaderSegmentsCross([0,0],[20,0],[0,2],[20,2]),false);
for(const [u,ic,p]of [[25,.1,.36],[40,.05,.35]]){
 const b={xmin:0,xmax:u*1.05,ymin:0,ymax:ic*1.05};
 const output=Array.from({length:11},(_,i)=>({ib_A:i*42e-6,points:Array.from({length:501},(_,j)=>{const x=u*j/500;return[x,ic*.89*i/10*(1-Math.exp(-x/.07))*(.6+.4*x/u)] as [number,number]})}));
 const labels=bjtOutputCallouts({output,limits:{pCollectorMax_W:p}},4*42e-6,b);
 assert.equal(labels.length,3);assert.deepEqual(labels,bjtOutputCallouts({output,limits:{pCollectorMax_W:p}},4*42e-6,b),'placement is deterministic');
 const pixel=([x,y]:[number,number]):[number,number]=>[x/b.xmax*1073,y/b.ymax*578];
 const arrows=labels.map(c=>calloutArrow(c,b));
 for(let i=0;i<arrows.length;i++){
  assert.deepEqual(arrows[i][1],[labels[i].targetX,labels[i].targetY]);
  const c=labels[i];if(c.text.startsWith('Pmax'))assert.ok(Math.abs(c.targetX*c.targetY-p)<1e-12);
  else {const ib=Number(c.text.match(/= ([\d.]+)/)![1])*1e-6,curve=output.find(v=>Math.abs(v.ib_A-ib)<1e-10)!;assert.ok(curve);const k=Math.min(499,Math.floor(c.targetX/u*500)),[x,y]=curve.points[k],[xx,yy]=curve.points[k+1];assert.ok(Math.abs(c.targetY-(y+(yy-y)*(c.targetX-x)/(xx-x)))<1e-12);}
  for(let j=0;j<i;j++)assert.equal(leaderSegmentsCross(pixel(arrows[i][0]),pixel(arrows[i][1]),pixel(arrows[j][0]),pixel(arrows[j][1])),false,'leaders must never cross');
 }
}
console.log('Dense-family tips, power binding, deterministic layout and non-crossing leaders passed');
