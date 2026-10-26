import {components,component,connectivity,type Doc} from './codec.ts';

export type ElectricalIssue = {severity:'error'|'warning';code:string;message:string;records:number[]};
/** Conservative structural checks; warnings do not claim a circuit cannot simulate. */
export function checkCircuit(doc:Doc):ElectricalIssue[] {
 const issues:ElectricalIssue[]=[],cc=components(doc);
 const add=(severity:ElectricalIssue['severity'],code:string,message:string,records:number[]=[])=>issues.push({severity,code,message,records});
 for(let i=0;i<doc.records.length;i++){
  const r=doc.records[i];if(r.type<0x201||r.type>=0x300)continue;
  try{component(r,i);}catch{add('error','unsupported-component',`Элемент записи ${i+1} пока не поддерживается для расчёта (тип 0x${r.type.toString(16)}).`,[i]);}
 }
 if(!cc.some(c=>c.kind==='GND'))add('error','missing-ground','Добавьте общий узел (землю) для расчёта.');
 const labels=new Map<string,number[]>();
 for(const c of cc){if(['GND','CONNECTOR'].includes(c.kind)||!c.label.trim())continue;const label=c.label.trim().toLowerCase();labels.set(label,[...(labels.get(label)??[]),c.index]);}
 for(const [label,records] of labels)if(records.length>1)add('error','duplicate-label',`Повторяется обозначение «${label}».`,records);
 if(issues.some(i=>i.code==='missing-ground'||i.code==='unsupported-component'))return issues;
 try{
  const rows=connectivity(doc),counts=new Map<string,number>();
  // Voltage probes do not provide a conducting path for another component.
  for(const {component:c,nodes} of rows)if(!['VM','PROBE','CONNECTOR'].includes(c.kind))for(const node of nodes)counts.set(node,(counts.get(node)??0)+1);
  for(const {component:c,nodes} of rows){
   if(['GND','VM','PROBE','CONNECTOR'].includes(c.kind))continue;
   nodes.forEach((node,p)=>{if(node!=='0'&&counts.get(node)===1)add('warning','dangling-pin',`${c.label||c.kind}: вывод ${p+1} не соединён с другим элементом.`,[c.index]);});
   if(new Set(nodes).size===1)add('warning','shorted-component',`${c.label||c.kind}: все выводы соединены с одним узлом.`,[c.index]);
  }
 }catch(e){add('error','connectivity',e instanceof Error?e.message:String(e));}
 return issues;
}
