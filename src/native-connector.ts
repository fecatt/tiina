import {readString,type Rec,type Point} from './codec.ts';

/** TJumper v66: one-terminal named net connector, not a crossing or two-pin link.
 * Native DAC5311 XML and PSpice prove repeated exact labels identify one node.
 * Drawing bytes stay opaque; this reader neither joins nodes nor invents a symbol.
 */
export function nativeConnector(record:Rec){
 const bad=():never=>{throw Error('Непроверенная запись соединителя TINA');};
 if(record.type!==0x204||record.version!==66||record.data.length<10)return bad();
 const d=record.data,v=new DataView(d.buffer,d.byteOffset,d.byteLength);
 let p:number,label:string,uid:string,pack:string;
 [label,p]=readString(d,9);const label_end=p,orientation_offset=p;
 if(p+6>d.length||d[p]>3||d[p+1]>1||v.getUint32(p+2,true)!==1)return bad();
 const orientation=d[p],mirrored=d[p+1]===1;p+=6;
 const uid_start=p;[uid,p]=readString(d,p);const uid_end=p;[pack,p]=readString(d,p);
 // All 90 records in the two native XML-correlated donors have this profile.
 // A legacy layout or an additional payload requires separate evidence.
 if(!uid||d.length-p!==53)return bad();
 const x=v.getInt16(0,true),y=v.getInt16(2,true);
 return {kind:'CONNECTOR' as const,nativeClass:'TJumper' as const,x,y,label,orientation,mirrored,
  label_dx:v.getInt16(4,true),label_dy:v.getInt16(6,true),uid,package:pack,pin_count:1 as const,
  pins:[[x,y] as Point],orientation_offset,label_end,uid_start,uid_end,drawing_offset:p,
  parameter_offset:d.length,opaqueDrawing:Uint8Array.from(d.subarray(p))};
}
