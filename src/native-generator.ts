import {component,generatorResistance,type Component,type Doc} from './codec.ts';

export type NativeGeneratorSettings={offset:number;amplitude:number;frequency:number;resistance?:number}&({waveform:'sine';phase:number}|{waveform:'rectangle';edge:number});

export function nativeGenerator(c:Component):NativeGeneratorSettings|null{
 const d=c.record.data,p=c.parameter_offset;
 if(c.kind!=='VG'||d.length<p+43||![0,1].includes(d[p+8])||![4,5].includes(d[p+9]))return null;
 const v=new DataView(d.buffer,d.byteOffset,d.byteLength);
 const offset=v.getFloat64(p,true),amplitude=v.getFloat64(p+10,true),frequency=v.getFloat64(p+18,true),parameter=v.getFloat64(p+26,true),resistance=generatorResistance(c);
 if(![offset,amplitude,frequency,parameter,1/frequency,offset-amplitude,offset+amplitude].every(Number.isFinite)||amplitude<0||frequency<=0||resistance===null)return null;
 const extra=resistance?{resistance}:{};
 if(d[p+9]===4)return {waveform:'sine' as const,offset,amplitude,frequency,phase:parameter+90,...extra};
 if(parameter<=0||parameter>=1/frequency/4)return null;
 return {waveform:'rectangle' as const,offset,amplitude,frequency,edge:parameter,...extra};
}

/** Change only the observed scalar slots, leaving all other record bytes intact. */
export function setNativeGenerator(doc:Doc,index:number,settings:NativeGeneratorSettings):void {
 const record=doc.records[index];if(!record)throw Error('Генератор больше не существует');
 const c=component(record,index);if(!nativeGenerator(c))throw Error('Формат генератора пока не поддерживается для редактирования');
 if(!['sine','rectangle'].includes(settings.waveform))throw Error('Неизвестная форма сигнала');
 const next=Uint8Array.from(record.data),v=new DataView(next.buffer,next.byteOffset,next.byteLength),p=c.parameter_offset;
 v.setFloat64(p,settings.offset,true);next[p+9]=settings.waveform==='sine'?4:5;
 v.setFloat64(p+10,settings.amplitude,true);v.setFloat64(p+18,settings.frequency,true);
 v.setFloat64(p+26,settings.waveform==='sine'?settings.phase-90:settings.edge,true);
 if(settings.resistance!==undefined)v.setFloat64(p+35,settings.resistance,true);
 if(!nativeGenerator(component({...record,data:next},index)))throw Error('Неверные параметры: амплитуда ≥ 0, частота > 0, фронт меньше четверти периода, сопротивление ≥ 0');
 record.data=next;
}

/** Narrow v66 rectangular VG layout, checked against native properties, XML and PSpice.
 * Other signal IDs remain opaque; their meaning must not be guessed. */
export function nativeRectangle(c:Component){
 const s=nativeGenerator(c);if(!s||s.waveform!=='rectangle')return null;
 const {offset,amplitude,frequency,edge}=s;return {offset,amplitude,frequency,edge};
}

export function nativeGeneratorWaveform(c:Component,stop:number):string {
 const s=nativeGenerator(c);if(!s)throw Error(`Генератор ${c.label}: форма сигнала или сопротивление TSC пока не подтверждены`);
 return s.waveform==='sine'?`SIN(${s.offset} ${s.amplitude} ${s.frequency} 0 0 ${s.phase})`:nativeRectangleWaveform(c,stop);
}

/** TINA's square starts at the DC offset, reaches +A after t, and changes
 * polarity across half-period ±t. This differs from a low-start SPICE PULSE. */
export function nativeRectangleWaveform(c:Component,stop:number):string {
 const s=nativeRectangle(c);if(!s)throw Error(`Генератор ${c.label}: форма сигнала или сопротивление TSC пока не подтверждены`);
 if(!Number.isFinite(stop)||stop<=0)throw Error('Неверное время расчёта');
 const period=1/s.frequency,cycles=Math.ceil(stop/period);
 if(cycles>16000)throw Error('Слишком много периодов генератора TSC');
 const points:[number,number][]=[];
 for(let i=0;i<=cycles;i++){
  const t=i*period;
  const local:[number,number][]=[[0,0],[s.edge,1],[period/2-s.edge,1],[period/2+s.edge,-1],[period-s.edge,-1]];
  for(const [dt,a] of local)points.push([t+dt,s.offset+a*s.amplitude]);
 }
 return `PWL(${points.map(([t,a])=>`${t} ${a}`).join(' ')})`;
}
