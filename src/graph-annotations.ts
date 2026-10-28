/** Curve-bound labels with deterministic, collision-aware placement. */
export type GraphBounds={xmin:number;xmax:number;ymin:number;ymax:number};
export type GraphCallout={text:string;x:number;y:number;targetX:number;targetY:number;leaderX?:number;leaderY?:number};
export function calloutArrow(c:GraphCallout,b:GraphBounds,width=1073,height=578):Array<[number,number]>{
 const sx=(b.xmax-b.xmin)/width,sy=(b.ymax-b.ymin)/height;
 const start:[number,number]=[c.leaderX??c.x+Math.min(95,c.text.length*3.4)*sx,c.leaderY??c.y-14*sy];
 const vx=(c.targetX-start[0])/sx,vy=(c.targetY-start[1])/sy,length=Math.hypot(vx,vy)||1,ux=vx/length,uy=vy/length;
 const tip:[number,number]=[c.targetX,c.targetY],back:[number,number]=[tip[0]-ux*8*sx,tip[1]-uy*8*sy];
 return[start,tip,[back[0]-uy*3.5*sx,back[1]+ux*3.5*sy],tip,[back[0]+uy*3.5*sx,back[1]-ux*3.5*sy]];
}
type Point=[number,number];type Rect={x:number;y:number;w:number;h:number};
const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
export function leaderSegmentsCross(a:Point,b:Point,c:Point,d:Point){const z=[cross(a,b,c),cross(a,b,d),cross(c,d,a),cross(c,d,b)];if(z[0]*z[1]<-1e-6&&z[2]*z[3]<-1e-6)return true;const on=(p:Point,q:Point,r:Point)=>Math.abs(cross(p,q,r))<1e-6&&r[0]>=Math.min(p[0],q[0])-1e-6&&r[0]<=Math.max(p[0],q[0])+1e-6&&r[1]>=Math.min(p[1],q[1])-1e-6&&r[1]<=Math.max(p[1],q[1])+1e-6;return on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);}
const inside=(p:Point,r:Rect)=>p[0]>=r.x&&p[0]<=r.x+r.w&&p[1]>=r.y&&p[1]<=r.y+r.h;
function hitsRect(a:Point,b:Point,r:Rect){if(inside(a,r)||inside(b,r))return true;const p:Point[]=[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h]];return p.some((c,i)=>leaderSegmentsCross(a,b,c,p[(i+1)%4]));}
const overlap=(a:Rect,b:Rect)=>a.x<b.x+b.w+4&&a.x+a.w+4>b.x&&a.y<b.y+b.h+4&&a.y+a.h+4>b.y;
const valueAt=(pts:Point[],x:number)=>{let lo=0,hi=pts.length-1;while(hi-lo>1){const i=(lo+hi)>>1;if(pts[i][0]<x)lo=i;else hi=i;}const[a,y]=pts[lo],[z,v]=pts[hi];return y+(v-y)*(x-a)/(z-a||1);};
export function bjtOutputCallouts(data:{output:Array<{ib_A:number;points:Point[]}>;limits:{pCollectorMax_W:number}},ib:number,b:GraphBounds,viewport={width:1073,height:578,charWidth:7,heightText:18}):GraphCallout[]{
 const family=[...data.output].sort((a,b)=>a.ib_A-b.ib_A).map(c=>({...c,points:[...c.points].sort((a,b)=>a[0]-b[0])}));if(family.length<2)return[];
 const W=viewport.width,H=viewport.height,sx=(b.xmax-b.xmin)/W,sy=(b.ymax-b.ymin)/H;
 const pixel=(p:Point):Point=>[(p[0]-b.xmin)/sx,(b.ymax-p[1])/sy],physical=(p:Point):Point=>[b.xmin+p[0]*sx,b.ymax-p[1]*sy];
 let upper=family.findIndex(c=>c.ib_A>=ib);upper=Math.min(family.length-1,Math.max(family.length>2?2:1,upper<0?family.length-1:upper));
 const xmax=Math.min(b.xmax,...family.map(c=>c.points.at(-1)![0])),xmin=Math.max(b.xmin,...family.map(c=>c.points[0][0]));
 const power:Point[]=Array.from({length:241},(_,i)=>{const x=Math.max(1e-12,xmin+(xmax-xmin)*i/240);return[x,data.limits.pCollectorMax_W/x];});
 const sources=[...family.map(c=>({name:`IБ = ${Number((c.ib_A*1e6).toPrecision(5))} мкА`,points:c.points})),{name:`Pmax = ${Number((data.limits.pCollectorMax_W*1000).toPrecision(4))} мВт`,points:power}];
 const requested=[sources.length-1,upper-1,upper].filter((n,i,a)=>a.indexOf(n)===i);
 const curves=sources.map(c=>c.points.map(pixel));const placed:Array<{rect:Rect;start:Point;tip:Point}>=[],out:GraphCallout[]=[];
 for(const own of requested){const text=sources[own].name,w=text.length*viewport.charWidth+8,h=viewport.heightText;let best:{score:number;rect:Rect;start:Point;tip:Point;u:number;v:number}|undefined;
  for(let n=0;n<19;n++){const u=xmin+(xmax-xmin)*(.12+n*.043),v=own===sources.length-1?data.limits.pCollectorMax_W/u:valueAt(sources[own].points,u);const tip=pixel([u,v]);if(tip[0]<10||tip[0]>W-10||tip[1]<14||tip[1]>H-12)continue;
   const separation=Math.min(...sources.map((c,i)=>i===own?Infinity:Math.abs(pixel([u,valueAt(c.points,u)])[1]-tip[1])));if(separation<10)continue; // Never target an intersection of two curves.
   const offsets:Point[]=[[-w/2,-h-13],[-w/2,13],[-w-13,-h/2],[13,-h/2],[-w/2,-h-35],[-w/2,35],[-w-30,-h-20],[30,-h-20],[-w-30,20],[30,20],[-w/2,-h-70],[-w/2,70]];
   for(const [dx,dy]of offsets){const rect={x:tip[0]+dx,y:tip[1]+dy,w,h};if(rect.x<7||rect.y<7||rect.x+w>W-7||rect.y+h>H-7||placed.some(p=>overlap(rect,p.rect)))continue;
    const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));let start:Point;
    if(tip[1]>=rect.y+h)start=[clamp(tip[0],rect.x+4,rect.x+w-4),rect.y+h+2];else if(tip[1]<=rect.y)start=[clamp(tip[0],rect.x+4,rect.x+w-4),rect.y-2];else if(tip[0]>=rect.x+w)start=[rect.x+w+2,clamp(tip[1],rect.y+3,rect.y+h-3)];else start=[rect.x-2,clamp(tip[1],rect.y+3,rect.y+h-3)];
    if(placed.some(p=>leaderSegmentsCross(start,tip,p.start,p.tip)||hitsRect(start,tip,p.rect)||hitsRect(p.start,p.tip,rect)))continue;
    let boxes=0,crossings=0;for(let ci=0;ci<curves.length;ci++){const pts=curves[ci];let box=false,hit=false;for(let j=1;j<pts.length;j++){const a=pts[j-1],z=pts[j];if(z[0]<Math.min(rect.x,start[0],tip[0])-2||a[0]>Math.max(rect.x+w,start[0],tip[0])+2)continue;if(hitsRect(a,z,rect))box=true;if(ci!==own&&leaderSegmentsCross(start,tip,a,z))hit=true;}if(box)boxes++;if(hit)crossings++;}
    const score=boxes*100000+crossings*80+Math.hypot(start[0]-tip[0],start[1]-tip[1])+n*.025+1/Math.max(1,separation);
    if(!best||score<best.score)best={score,rect,start,tip,u,v};
   }
  }
  if(best){placed.push(best);const[x,y]=physical([best.rect.x+3,best.rect.y+3]),[leaderX,leaderY]=physical(best.start);out.push({text,x,y,targetX:best.u,targetY:best.v,leaderX,leaderY});}
 }
 return out;
}
