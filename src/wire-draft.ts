/** Browser waypoint interaction. Output is an ordinary native TINA orthogonal polyline. */
import type {Point} from './codec.ts';
const point=(p:Point):Point=>{if(!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isInteger(n)||n< -32768||n>32767))throw Error('Координата провода вне диапазона TINA');return [p[0],p[1]];};
const same=(a:Point,b:Point)=>a[0]===b[0]&&a[1]===b[1];
const copy=(pp:Point[])=>pp.map(p=>[...p] as Point);
export class WireDraft {
 private geometry:Point[];private steps:Point[][]=[];private horizontal=true;readonly limit:number;
 constructor(start:Point,limit=8192){if(!Number.isInteger(limit)||limit<2||limit>8192)throw Error('Неверный предел точек провода');this.limit=limit;this.geometry=[point(start)];}
 get points():Point[]{return copy(this.geometry);}
 get waypointCount(){return this.steps.length;}
 toggleElbow(){this.horizontal=!this.horizontal;}
 trace(end:Point):boolean {const p=point(end),last=this.geometry.at(-1)!,dx=p[0]-last[0],dy=p[1]-last[1];return this.add(Math.abs(dx)>=Math.abs(dy)?[p[0],last[1]]:[last[0],p[1]]);}
 preview(end:Point):Point[]{
  const p=point(end),pp=copy(this.geometry),last=pp.at(-1)!;
  if(same(last,p))return pp;
  if(last[0]!==p[0]&&last[1]!==p[1])pp.push(this.horizontal?[p[0],last[1]]:[last[0],p[1]]);
  pp.push(p);
  // Backtracking retracts the current section; no zero or redundant collinear sections are emitted.
  for(let i=1;i<pp.length;){if(same(pp[i-1],pp[i])){pp.splice(i,1);i=Math.max(1,i-1);continue;}if(i+1<pp.length&&((pp[i-1][0]===pp[i][0]&&pp[i][0]===pp[i+1][0])||(pp[i-1][1]===pp[i][1]&&pp[i][1]===pp[i+1][1]))){pp.splice(i,1);i=Math.max(1,i-1);continue;}i++;}
  if(pp.length>this.limit)throw Error('Слишком много изгибов провода');return pp;
 }
 add(end:Point):boolean {const pp=this.preview(end);if(JSON.stringify(pp)===JSON.stringify(this.geometry))return false;this.steps.push(copy(this.geometry));this.geometry=pp;return true;}
 back():boolean {const previous=this.steps.pop();if(!previous)return false;this.geometry=previous;return true;}
 finish(end?:Point):Point[]{const pp=end===undefined?this.points:this.preview(end);if(pp.length<2)throw Error('Укажите второй конец провода');return pp;}
}
