/** Leader labels share data coordinates between the browser and native TINA export. */
export type GraphBounds={xmin:number;xmax:number;ymin:number;ymax:number};
export type GraphCallout={text:string;x:number;y:number;targetX:number;targetY:number};
export function calloutArrow(c:GraphCallout,b:GraphBounds,width=1073,height=578):Array<[number,number]>{
 const sx=(b.xmax-b.xmin)/width,sy=(b.ymax-b.ymin)/height;
 const start:[number,number]=[c.x+Math.min(95,c.text.length*3.4)*sx,c.y-14*sy];
 const vx=(c.targetX-start[0])/sx,vy=(c.targetY-start[1])/sy,length=Math.hypot(vx,vy)||1,ux=vx/length,uy=vy/length;
 const tip:[number,number]=[c.targetX,c.targetY],back:[number,number]=[tip[0]-ux*8*sx,tip[1]-uy*8*sy];
 return[start,tip,[back[0]-uy*3.5*sx,back[1]+ux*3.5*sy],tip,[back[0]+uy*3.5*sx,back[1]-ux*3.5*sy]];
}
export function bjtOutputCallouts(data:{output:Array<{ib_A:number;points:Array<[number,number]>}>;limits:{pCollectorMax_W:number}},ib:number,b:GraphBounds):GraphCallout[]{
 const family=[...data.output].sort((a,b)=>a.ib_A-b.ib_A);let upper=family.findIndex(c=>c.ib_A>=ib);upper=Math.max(1,upper<0?family.length-1:upper);const chosen=[family[upper-1],family[upper]];
 const sample=(pts:Array<[number,number]>,x:number)=>{let i=1;while(i<pts.length-1&&pts[i][0]<x)i++;const[a,y]=pts[i-1],[z,v]=pts[i];return y+(v-y)*(x-a)/(z-a||1);};
 const dx=b.xmax-b.xmin,dy=b.ymax-b.ymin;const powerTarget=Math.min(b.xmax*.72,family[0].points.at(-1)![0]*.82),powerY=data.limits.pCollectorMax_W/powerTarget;
 const labels:GraphCallout[]=[{text:`Pmax = ${Number((data.limits.pCollectorMax_W*1000).toPrecision(4))} мВт`,x:b.xmin+.12*dx,y:b.ymin+.90*dy,targetX:powerTarget,targetY:powerY}];
 chosen.forEach((c,i)=>{const targetX=Math.min(family[0].points.at(-1)![0],b.xmax*(.43+i*.17));labels.push({text:`IБ = ${Number((c.ib_A*1e6).toPrecision(5))} мкА`,x:b.xmin+(i?.66:.43)*dx,y:b.ymin+(i?.57:.42)*dy,targetX,targetY:sample(c.points,targetX)});});return labels;
}
