/** Read-only extraction of bounded inline SPICE text arrays in observed macro records.
 * This does not decode symbol drawings, wire pin geometry, or import the macro into the solver. */
export type MacroRecord = {type:number;version:number;data:Uint8Array};
export type InlineMacro = {offset:number;end:number;lines:string[];lineFlags:number[];subcircuits:{name:string;pins:string[]}[]};
const decoder=new TextDecoder('windows-1251');
const admitted=new Map([[0x109,new Set([17])],[0x23a,new Set([54,66])]]);

/** Return only uniquely located, complete text arrays containing balanced SUBCKT/ENDS.
 * Bytes and original text remain unchanged. Callers must separately establish pin mapping
 * and SPICE dialect support before using an extracted model for simulation. */
export function inlineMacro(record:MacroRecord):InlineMacro {
 if(!admitted.get(record.type)?.has(record.version))throw new Error('Непроверенная версия макроса TINA');
 const d=record.data;if(d.length>16*1024*1024)throw new Error('Слишком большая запись макроса');
 const v=new DataView(d.buffer,d.byteOffset,d.byteLength),found:InlineMacro[]=[];
 for(let offset=0;offset+4<d.length;offset++){
  const count=v.getUint32(offset,true);if(count<2||count>100000||count*6>d.length-offset-4)continue;
  let p=offset+4,valid=true;const lines:string[]=[],lineFlags:number[]=[];
  for(let i=0;i<count;i++){
   if(p>=d.length){valid=false;break;}
   const len=d[p++];if(len<1||p+len+4>d.length||d[p+len-1]!==0){valid=false;break;}
   const line=decoder.decode(d.subarray(p,p+len-1));
   if(/[\x00-\x08\x0a-\x1f]/.test(line)){valid=false;break;}
   p+=len;const flags=v.getUint32(p,true);p+=4;
   // All observed text rows have zero flags; unknown flags must not be silently executed.
   if(flags!==0){valid=false;break;}lines.push(line);lineFlags.push(flags);
  }
  if(!valid)continue;
  const subcircuits:InlineMacro['subcircuits']=[];let active:string|undefined;
  for(const line of lines){
   const words=line.trim().split(/\s+/),command=words[0].toLowerCase();
   if(command==='.subckt'){
    if(active||words.length<3){valid=false;break;}
    active=words[1];const pins=words.slice(2);if(pins.some(s=>/[=:]/.test(s))){valid=false;break;}
    subcircuits.push({name:active,pins});
   }else if(command==='.ends'){
    if(!active||(words[1]&&words[1].toLowerCase()!==active.toLowerCase())){valid=false;break;}active=undefined;
   }
  }
  if(valid&&!active&&subcircuits.length)found.push({offset,end:p,lines,lineFlags,subcircuits});
 }
 if(found.length!==1)throw new Error(found.length?'Неоднозначный SPICE-текст макроса':'Полный SPICE-текст макроса не найден');
 return found[0];
}

export type NativeMacroPin={name:string;formal:string;x:number;y:number};
export type NativeMacro={label:string;uid:string;x:number;y:number;orientation:number;mirrored:boolean;model:InlineMacro;pins:NativeMacroPin[];homeLibrary:string};
/** Narrow LM741 layout supported by native XML/PSpice oracle on 2026-10-24.
 * Pins are returned in SUBCKT order, not drawing order. Only the observed
 * local symbol geometry is unchanged by native rotation/mirror: the native
 * 2026-10-24 transform oracles change only the outer orientation/mirror byte. */
export function nativeMacro(record:MacroRecord):NativeMacro {
 if(record.type!==0x23a||record.version!==66)throw new Error('Непроверенный символ макроса TINA');
 const d=record.data,v=new DataView(d.buffer,d.byteOffset,d.byteLength);
 const fail=():never=>{throw new Error('Непроверенная структура символа LM741');};
 const string=(p:number):[string,number]=>{if(p>=d.length)fail();const n=d[p];if(n<1||p+n>=d.length||d[p+n]!==0)fail();return [decoder.decode(d.subarray(p+1,p+n)),p+n+1];};
 if(d.length<20)fail();const [label,le]=string(9),orientation=d[le],mirrored=d[le+1]!==0;
 if(orientation>3||d[le+1]>1)throw new Error('Непроверенное преобразование символа LM741');
 if(le+6>d.length||v.getUint32(le+2,true)!==5)fail();const [uid,ue]=string(le+6),[,pe]=string(ue);
 if(![0,9,1,23,0].every((b,i)=>d[pe+i]===b))fail();
 const [name,ne]=string(pe+5),[symbol]=string(ne);if(name!=='LM741'||symbol!=='<Amplifier5>')fail();
 const model=inlineMacro(record);if(model.subcircuits.length!==1||model.subcircuits[0].name!=='LM741'||model.subcircuits[0].pins.join(' ')!=='1 2 99 50 28')fail();
 const drawing=[['In+',-32,16],['In-',-32,-16],['Out',32,0],['V+',-8,24],['V-',-8,-24]] as const;
 const objects:{name:string;x:number;y:number}[]=[];
 for(let p=0;p+54<=model.offset;p++)if(v.getUint32(p,true)===100&&v.getUint32(p+4,true)===259&&v.getUint32(p+8,true)===42){
  const body=p+12,n=d[body];if(n<1||n>3)fail();objects.push({name:decoder.decode(d.subarray(body+1,body+1+n)),x:v.getInt16(body+21,true),y:v.getInt16(body+23,true)});
 }
 if(objects.length!==10||objects.some((o,i)=>{const row=drawing[i%5];return o.name!==row[0]||o.x!==row[1]||o.y!==row[2];}))fail();
 let p=model.end;if(d[p++]!==0)fail();const [homeLibrary,he]=string(p);p=he;if(d[p++]!==1)fail();
 const ordered=['In+','In-','V+','V-','Out'];
 for(let set=0;set<2;set++){
  if(p+4>d.length||v.getUint32(p,true)!==5)fail();p+=4;
  for(const expected of ordered){const [actual,next]=string(p);p=next;if(actual!==expected||p+4>d.length||v.getUint32(p,true)!==0)fail();p+=4;}
 }
 const x=v.getInt16(0,true),y=v.getInt16(2,true);
 const pins=ordered.map((name,i)=>{const o=objects.find(o=>o.name===name)!;let px=mirrored?-o.x:o.x,py=o.y;for(let turn=0;turn<orientation;turn++)[px,py]=[py,-px];return {name,formal:model.subcircuits[0].pins[i],x:x+px,y:y+py};});
 return {label,uid,x,y,orientation,mirrored,model,pins,homeLibrary};
}

/** Namespace each admitted LM741 instance and its local model definitions.
 * External libraries and unfamiliar SPICE directives/devices are explicitly refused. */
export function macroSpiceModel(macro:NativeMacro,namespace:string):string {
 if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(namespace))throw new Error('Недопустимое SPICE-имя макроса');
 const occupied=new Set(macro.model.lines.flatMap(row=>row.split(/[^A-Za-z0-9_]+/)).map(s=>s.toLowerCase()));
 const fresh=(base:string)=>{let candidate=base;while(occupied.has(candidate.toLowerCase()))candidate+='_';occupied.add(candidate.toLowerCase());return candidate;};
 const names=new Map<string,string>();
 for(const row of macro.model.lines){const words=row.trim().split(/\s+/);if(words[0].toLowerCase()==='.model'){
  const key=words[1]?.toLowerCase();if(!key||names.has(key))throw new Error('Конфликт моделей внутри LM741');names.set(key,`${namespace}_${words[1]}`);
 }}
 return macro.model.lines.map(row=>{
  if(/[\r\n]/.test(row))throw new Error('Несколько SPICE-команд в строке LM741 не допускаются');
  const text=row.trim(),words=text.split(/\s+/),head=words[0].toLowerCase();if(!text||text.startsWith('*'))return row;
  if(head==='.subckt')return `.subckt ${namespace} ${macro.model.subcircuits[0].pins.join(' ')}`;
  if(head==='.ends')return `.ends ${namespace}`;
  if(head==='.model'){words[1]=names.get(words[1].toLowerCase())!;return words.join(' ');}
  if(text.startsWith('+'))return row;
  if(!/^[rclviqdefgh]/i.test(text)||text.startsWith('.'))throw new Error('Неподдержанная SPICE-команда внутри LM741: '+words[0]);
  // This WASM build has no XSPICE POLY devices. The donor uses only two
  // affine single-control sources; decompose them without approximating gain/offset.
  const number=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?[a-z]*$/i;
  if(words.some(s=>/^poly\(/i.test(s))){
   if(head==='eos'&&words.length===8&&/^poly\(1\)$/i.test(words[3])&&number.test(words[6])&&number.test(words[7])){
    const internal=fresh(`${namespace}_eos_offset`),source=fresh(`V_${namespace}_eos_offset`);return `${words[0]} ${words[1]} ${internal} ${words[4]} ${words[5]} ${words[7]}\n${source} ${internal} ${words[2]} DC ${words[6]}`;
   }
   if(head==='f6'&&words.length===7&&/^poly\(1\)$/i.test(words[3])&&/^v6$/i.test(words[4])&&number.test(words[5])&&number.test(words[6]))return `${words[0]} ${words[1]} ${words[2]} ${words[4]} ${words[6]}\n${fresh(`I_${namespace}_f6_offset`)} ${words[1]} ${words[2]} DC ${words[5]}`;
   throw new Error('Неподдержанная POLY-модель внутри LM741');
  }
  if(/^[dq]/i.test(head)){
   const last=words.length-1,replacement=names.get(words[last].toLowerCase());if(!replacement)throw new Error('Внешняя модель внутри LM741 не разрешается');words[last]=replacement;return words.join(' ');
  }
  return row;
 }).join('\n');
}
