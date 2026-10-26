import {bjtModels} from './bjt-library.ts';
import {component,modelParameters,readString,BJT_FIELDS,encode,decode,moveComponent,updateComponent,type Doc,type Changes,type Component} from './codec.ts';
import library from './library.json' with {type:'json'};
import {nativeGenerator,setNativeGenerator,type NativeGeneratorSettings} from './native-generator.ts';
import {showCatalogDialog} from './catalog-dialog.ts';
import {componentPropertyRows} from './component-property-profiles.ts';

// Keep numerical helpers importable in Node tests without loading browser CSS.
if(typeof document!=='undefined'){const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./props-dialog.css',import.meta.url).href;document.head.append(stylesheet);}
const escape=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const kindTitles:Record<string,string>={GND:'Земля',CONNECTOR:'Именованный соединитель',D:'Диод',ZENER:'Стабилитрон',SCHOTTKY:'Диод Шотки',MACRO:'Макрос SPICE',PROBE:'Пробник напряжения',R:'Резистор',C:'Конденсатор',L:'Катушка индуктивности',V:'Батарея',VS:'Источник напряжения',I:'Источник тока',IS:'Генератор тока',VG:'Генератор напряжения',VM:'Вольтметр',AM:'Указатель тока',AMV:'Амперметр',NPN:'NPN биполярный транзистор',PNP:'PNP биполярный транзистор'};
// Common native property rows are selected from family metadata. A row is
// editable only when its value has a lossless TSC mapping in this editor.
const propertyProfiles:Record<string,{value?:string;parameters?:boolean;mode?:boolean;error?:boolean;type?:boolean;signal?:boolean; bjt?:boolean}>={
 passive:{parameters:true}, source:{parameters:true}, meter:{parameters:true,mode:true,error:true}, semiconductor:{parameters:true,type:true,bjt:true}, macro:{parameters:true,type:true}, probe:{parameters:true}, named:{parameters:true}
};
const profileFor:Record<string,string>={R:'passive',C:'passive',L:'passive',V:'source',VS:'source',I:'source',IS:'source',VG:'source',VM:'meter',AM:'meter',AMV:'meter',D:'semiconductor',ZENER:'semiconductor',SCHOTTKY:'semiconductor',NPN:'semiconductor',PNP:'semiconductor',MACRO:'macro',PROBE:'probe',CONNECTOR:'named'};
const units:Record<string,string>={R:'Ом',C:'Ф',L:'Гн',V:'В',VS:'В',VG:'В',I:'А',IS:'А'};
const positive=new Set(['IS','NF','NR','NE','NC','NS','BF','BR','EG','VCEO','VCBO','VEBO','ICMAX','IBMAX','PMAX']);
const nonnegative=new Set(['RE','RC','RB','VAF','VAR','ISE','ISC','ISS','IKF','IKR','CJC','CJE','CJS','VJC','VJE','VJS','MJC','MJE','MJS','TF','TR','KF','AF']);

/** Property-field SI numbers: uppercase M means mega; lowercase m means milli.
 * These UI values are not raw SPICE tokens (SPICE's M has different semantics). */
export function parseEngineeringValue(input:string):number {
 let s=input.trim().replace(',','.').replace(/\s+/g,'');let multiplier=1;
 s=s.replace(/meg$/i,'meg');
 for(const [suffix,scale] of [['meg',1e6],['мк',1e-6],['М',1e6],['M',1e6],['G',1e9],['T',1e12],['k',1e3],['K',1e3],['к',1e3],['К',1e3],['m',1e-3],['м',1e-3],['u',1e-6],['µ',1e-6],['μ',1e-6],['n',1e-9],['н',1e-9],['p',1e-12],['п',1e-12],['f',1e-15]] as [string,number][]){if(s.endsWith(suffix)){s=s.slice(0,-suffix.length);multiplier=scale;break;}}
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))throw Error('Введите число, например 1к, 10мк или 1.26e-14');
 const n=Number(s)*multiplier;if(!Number.isFinite(n))throw Error('Число должно быть конечным');if(n===0&&/[1-9]/.test(s.split(/[eE]/)[0]))throw Error('Число слишком мало для сохранения');return n;
}
/** Parse a whole property form before handing a sparse edit to the host transaction. */
export function componentPropertyChanges(c:Component,fields:Record<string,string>):Changes {
 const result:Changes={};
 if(c.kind!=='GND'){
  const label=fields.label??'';if(!label.trim())throw Error('Введите обозначение элемента');if(label!==c.label)result.label=label;
  for(const key of ['label_dx','label_dy'] as const){const n=parseEngineeringValue(fields[key]??'');if(n!==c[key])result[key]=n;}
 }
 for(const key of ['x','y'] as const){const n=parseEngineeringValue(fields[key]??'');if(n!==c[key])result[key]=n;}
 if(!/^[0-3]$/.test(fields.orientation??''))throw Error('Поворот должен быть от 0 до 270°');
 const orientation=Number(fields.orientation);if(orientation!==c.orientation)result.orientation=orientation;
 if(c.value!==undefined){const value=parseEngineeringValue(fields.value??'');if(['R','C','L'].includes(c.kind)&&value<=0)throw Error('Номинал должен быть больше нуля');if(value!==c.value)result.value=value;}
 if(['NPN','PNP'].includes(c.kind)&&fields.model!==c.model)result.model=fields.model;
 for(const key of ['x','y','label_dx','label_dy'] as const)if(result[key]!==undefined&&(!Number.isInteger(result[key])||result[key]!< -32768||result[key]!>32767))throw Error('Координаты и смещения должны быть целыми числами от −32768 до 32767');
 return result;
}
function validateParameter(key:string,value:number):void {
 if(!BJT_FIELDS.includes(key))throw Error(`Неизвестный параметр ${key}`);
 if(!Number.isFinite(value))throw Error(`${key}: требуется конечное число`);
 if(positive.has(key)&&value<=0)throw Error(`${key}: значение должно быть больше нуля`);
 if(nonnegative.has(key)&&value<0)throw Error(`${key}: отрицательное значение недопустимо`);
}
/** Patches only selected native float64 slots; every other byte remains intact.
 * Validation is completed before the single record mutation. */
export function setBjtParameters(doc:Doc,index:number,changes:Record<string,number>):void {
 const rec=doc.records[index];if(!rec)throw Error('Элемент больше не существует');const c=component(rec,index);
 if(!['NPN','PNP'].includes(c.kind))throw Error('Параметры SPICE BJT доступны только для транзистора');
 modelParameters(c);const d=rec.data;let p:number;[,p]=readString(d,c.parameter_offset);let family:string;[family,p]=readString(d,p);
 const v=new DataView(d.buffer,d.byteOffset,d.byteLength);if(family!=='SPICE-BJT'||d[p]!==0||d[p+1]!==1||v.getUint16(p+2,true)!==304||p+308>d.length)throw Error('Формат модели не поддерживается');
 for(const [key,value] of Object.entries(changes))validateParameter(key,value);
 const next=Uint8Array.from(d),out=new DataView(next.buffer,next.byteOffset,next.byteLength);for(const [key,value] of Object.entries(changes))out.setFloat64(p+4+BJT_FIELDS.indexOf(key)*8,value,true);rec.data=next;
}
const descriptors:Record<string,[string,string]>={IS:['Ток насыщения','А'],NF:['Коэффициент эмиссии прямой',''],NR:['Коэффициент эмиссии обратный',''],RE:['Сопротивление эмиттера','Ом'],RC:['Сопротивление коллектора','Ом'],RB:['Сопротивление базы','Ом'],VAF:['Напряжение Эрли прямое','В'],VAR:['Напряжение Эрли обратное','В'],ISE:['Ток утечки база–эмиттер','А'],ISC:['Ток утечки база–коллектор','А'],ISS:['Ток насыщения подложки','А'],NE:['Коэффициент эмиссии утечки БЭ',''],NC:['Коэффициент эмиссии утечки БК',''],NS:['Коэффициент эмиссии подложки',''],BF:['Коэффициент передачи прямой',''],BR:['Коэффициент передачи обратный',''],IKF:['Ток спада усиления прямой','А'],IKR:['Ток спада усиления обратный','А'],CJC:['Барьерная ёмкость БК при нуле','Ф'],CJE:['Барьерная ёмкость БЭ при нуле','Ф'],CJS:['Ёмкость подложки при нуле','Ф'],VJC:['Контактный потенциал БК','В'],VJE:['Контактный потенциал БЭ','В'],VJS:['Контактный потенциал подложки','В'],MJC:['Коэффициент градиента БК',''],MJE:['Коэффициент градиента БЭ',''],MJS:['Коэффициент градиента подложки',''],TF:['Время переноса прямое','с'],TR:['Время переноса обратное','с'],EG:['Ширина запрещённой зоны','эВ'],KF:['Коэффициент фликкерного шума',''],AF:['Показатель фликкерного шума',''],VCEO:['Предел напряжения КЭ модели','В'],VCBO:['Предел напряжения КБ модели','В'],VEBO:['Предел напряжения ЭБ модели','В'],ICMAX:['Предел тока коллектора модели','А'],IBMAX:['Предел тока базы модели','А'],PMAX:['Предел мощности модели','Вт']};
const parameterGroups:[string,string[]][]=[['Передача и насыщение',['IS','NF','NR','BF','BR','IKF','IKR','VAF','VAR']],['Сопротивления и утечки',['RE','RC','RB','ISE','ISC','ISS','NE','NC','NS']],['Ёмкости переходов',['CJC','CJE','CJS','VJC','VJE','VJS','MJC','MJE','MJS']],['Время переноса и шум',['TF','TR','EG','KF','AF']],['Модельные ограничения',['VCEO','VCBO','VEBO','ICMAX','IBMAX','PMAX']]];
function createDialog(title:string,content:string,wide=false):HTMLDialogElement {
 const dialog=document.createElement('dialog');dialog.className='component-dialog'+(wide?' component-dialog-wide':'');dialog.setAttribute('aria-label',title);
 dialog.innerHTML=`<header class="component-title"><span>${escape(title)}</span><button type="button" class="component-close" aria-label="Закрыть" data-close>×</button></header>${content}`;
 document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=()=>dialog.close();return dialog;
}
function showModelParameters(doc:Doc,index:number,onRawCommit:(mutate:()=>void)=>void):void {
 const c=component(doc.records[index],index),values=modelParameters(c);
 const dialog=createDialog(`Модель ${c.model??''}  SPICE BJT`,`<form class="component-model-form"><div class="component-model-scroll">${parameterGroups.map(([group,fields])=>`<fieldset><legend>${escape(group)}</legend><table class="component-properties-table"><tbody>${fields.map(key=>`<tr><th scope="row"><label for="bjt-${key}"><b>${key}</b> — ${escape(descriptors[key][0])}</label></th><td><input id="bjt-${key}" name="${key}" type="text" inputmode="decimal" value="${values[key]}" autocomplete="off" /></td><td class="component-unit">${escape(descriptors[key][1])}</td></tr>`).join('')}</tbody></table></fieldset>`).join('')}<p class="component-explanation">Модельные ограничения хранятся в записи TINA. Они могут отличаться от предельных значений в паспорте транзистора и не используются браузерным расчётом как паспортные ограничения.</p><p class="component-explanation">Параметры ISS и NS сохраняются в TSC. Расчёт модели с ненулевым ISS в браузере пока не поддерживается.</p></div><p class="component-error" role="alert" aria-live="polite"></p><footer><button type="submit">ОК</button><button type="button" data-cancel>Отмена</button></footer></form>`,true);
 dialog.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick=()=>dialog.close();
 dialog.querySelector<HTMLFormElement>('form')!.onsubmit=e=>{e.preventDefault();try{const fd=new FormData(e.currentTarget as HTMLFormElement),changes:Record<string,number>={};for(const key of BJT_FIELDS){const value=parseEngineeringValue(String(fd.get(key)));validateParameter(key,value);if(value!==values[key])changes[key]=value;}if(Object.keys(changes).length)onRawCommit(()=>setBjtParameters(doc,index,changes));dialog.close();}catch(error){dialog.querySelector<HTMLElement>('.component-error')!.textContent=error instanceof Error?error.message:String(error);}};
 dialog.showModal();
}

function showGeneratorParameters(doc:Doc,index:number,onRawCommit:(mutate:()=>void)=>void):void {
 const c=component(doc.records[index],index),settings=nativeGenerator(c);if(!settings)throw Error('Формат сигнала пока не поддерживается');
 const field=(label:string,key:string,value:number,unit:string)=>`<tr data-signal-row="${key}"><th><label for="signal-${key}">${label}</label></th><td><input id="signal-${key}" name="${key}" value="${value}" autocomplete="off"></td><td class="component-unit">${unit}</td></tr>`;
 const dialog=createDialog(`Сигнал ${c.label}`,`<form><div class="component-body"><table class="component-properties-table"><tbody><tr><th><label for="signal-waveform">Форма</label></th><td colspan="2"><select id="signal-waveform" name="waveform"><option value="sine" ${settings.waveform==='sine'?'selected':''}>Синусоидальная волна</option><option value="rectangle" ${settings.waveform==='rectangle'?'selected':''}>Прямоугольная волна</option></select></td></tr>${field('Внутреннее сопротивление','resistance',settings.resistance??0,'Ом')}${field('Амплитуда','amplitude',settings.amplitude,'В')}${field('Частота','frequency',settings.frequency,'Гц')}${field('Фаза','phase',settings.waveform==='sine'?settings.phase:0,'°')}${field('Фронт / спад','edge',settings.waveform==='rectangle'?settings.edge:1/settings.frequency*.001,'с')}</tbody></table><p class="component-explanation">Параметры сохраняются в файле TSC. Амплитуда задаётся относительно DC уровня генератора. Внутреннее сопротивление включено последовательно с источником.</p><p class="component-error" role="alert"></p></div><footer><button type="submit">ОК</button><button type="button" data-cancel>Отмена</button></footer></form>`);
 const shape=dialog.querySelector<HTMLSelectElement>('[name=waveform]')!;
 const update=()=>{for(const key of ['phase','edge']){const enabled=key==='phase'?shape.value==='sine':shape.value==='rectangle';dialog.querySelector<HTMLElement>(`[data-signal-row=${key}]`)!.hidden=!enabled;dialog.querySelector<HTMLInputElement>(`[name=${key}]`)!.disabled=!enabled;}};
 shape.onchange=update;update();dialog.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick=()=>dialog.close();
 dialog.querySelector<HTMLFormElement>('form')!.onsubmit=e=>{e.preventDefault();try{
  const fd=new FormData(e.currentTarget as HTMLFormElement),current=nativeGenerator(component(doc.records[index],index));if(!current)throw Error('Генератор изменён или больше не поддерживается');
  const common={offset:current.offset,resistance:parseEngineeringValue(String(fd.get('resistance'))),amplitude:parseEngineeringValue(String(fd.get('amplitude'))),frequency:parseEngineeringValue(String(fd.get('frequency')))};
  const next:NativeGeneratorSettings=shape.value==='sine'?{...common,waveform:'sine',phase:parseEngineeringValue(String(fd.get('phase')))}:{...common,waveform:'rectangle',edge:parseEngineeringValue(String(fd.get('edge')))};
  const same=next.waveform===current.waveform&&next.offset===current.offset&&next.amplitude===current.amplitude&&next.frequency===current.frequency&&(next.resistance??0)===(current.resistance??0)&&(next.waveform==='sine'&&current.waveform==='sine'?next.phase===current.phase:next.waveform==='rectangle'&&current.waveform==='rectangle'&&next.edge===current.edge);
  if(!same)onRawCommit(()=>setNativeGenerator(doc,index,next));dialog.close();
 }catch(error){dialog.querySelector<HTMLElement>('.component-error')!.textContent=error instanceof Error?error.message:String(error);}};
 dialog.showModal();
}

function showGenericParameters(label:string):void {
 const rows=[1,2,3,4].map(n=>`<tr class="component-unavailable"><th scope="row">Параметр #${n}</th><td><input disabled value="" aria-label="Значение параметра #${n}"></td></tr>`).join('');
 const dialog=createDialog('Параметры',`<form><div class="component-body"><table class="component-properties-table"><thead><tr><th scope="col">Name</th><th scope="col">Value</th></tr></thead><tbody>${rows}</tbody></table></div><footer><button type="button" data-cancel><span class="component-button-icon component-ok">✓</span>ОК</button><button type="button" data-dismiss><span class="component-button-icon component-cancel">✕</span>Отмена</button><button type="button" disabled><span class="component-button-icon component-help">?</span>Помощь</button></footer></form>`);
 dialog.classList.add('component-parameters-dialog');dialog.setAttribute('aria-description',`Дополнительные параметры ${label}; запись этих полей пока недоступна`);
 dialog.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick=()=>dialog.close();dialog.querySelector<HTMLButtonElement>('[data-dismiss]')!.onclick=()=>dialog.close();dialog.showModal();
}

/** The host owns undo/history. Nested model/signal edits and native wire movement
 * are staged on a detached document; final OK commits one complete transaction.
 * Cancel never mutates the source document. Common-only hosts retain commit(changes). */
export function showComponentProperties(doc:Doc,index:number,commit:(changes:Changes)=>void,onRawCommit?:(mutate:()=>void)=>void):void {
 const c=component(doc.records[index],index),isBjt=['NPN','PNP'].includes(c.kind);
 const profile=propertyProfiles[profileFor[c.kind]??'passive'];
 const openedBytes=encode(doc);let staged=decode(openedBytes),hasNestedEdits=false;
 const sameBytes=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((value,i)=>value===b[i]);
 const field=(label:string,key:string,value:unknown,unit='')=>`<tr><th scope="row"><label for="component-${key}">${escape(label)}${unit?` [${escape(unit)}]`:''}</label></th><td><input id="component-${key}" type="text" name="${key}" value="${escape(value)}" autocomplete="off" /></td><td class="component-property-flag"></td></tr>`;
 // The native dialog has no coordinate/label-layout page. Keep the current
 // native header values in the form so a property edit cannot move the symbol.
 const geometry=['x','y','orientation','label_dx','label_dy'].map(key=>`<input type="hidden" name="${key}" value="${c[key as keyof Component]}">`).join('');
 // These native controls are visible in the supplied TINA dialog, but their
 // record fields are not decoded yet. Do not present guessed defaults as data.
 const unavailable=(label:string,flag=false)=>`<tr class="component-unavailable"><th scope="row">${escape(label)}</th><td><input disabled value="—" aria-label="${escape(label)}" title="Значение пока не прочитано; исходные данные сохраняются в TSC"></td><td class="component-property-flag">${flag?'<input type="checkbox" disabled aria-label="Флажок параметра: функция пока не перенесена" title="Функция флажка пока не перенесена">':''}</td></tr>`;
 const models=Object.keys(bjtModels(c.kind));if(c.model&&!models.includes(c.model))models.unshift(c.model);
 const paramsRow=profile.parameters?`<tr><th scope="row">Параметры</th><td><button type="button" class="component-value-link" data-parameters>[Параметры]</button></td><td class="component-property-flag"></td></tr>`:'';
 const typeRow=isBjt?`<tr><th scope="row"><label for="component-model">Тип</label></th><td><div class="component-model-picker"><select id="component-model" name="model" hidden>${models.map(name=>`<option value="${escape(name)}" ${name===c.model?'selected':''}>${escape(name)}</option>`).join('')}</select><button type="button" id="component-model-choice" class="component-model-combo" data-model aria-label="Выбрать тип модели" ${onRawCommit?'':'disabled'}><span data-model-current>${escape(c.model??'')}</span><span aria-hidden="true">▾</span></button></div></td><td class="component-property-flag"><input type="checkbox" checked disabled aria-label="Флажок типа: функция пока не перенесена" title="Флажок оригинального окна. Его назначение и запись в TSC пока не подтверждены"></td></tr>`:['D','ZENER','SCHOTTKY','MACRO'].includes(c.kind)?`<tr><th scope="row">Тип</th><td data-diode-model>${escape(c.model??'')}</td><td class="component-property-flag"></td></tr>`:'';
 const signal=nativeGenerator(c),signalRow=['VG','IS'].includes(c.kind)?`<tr><th scope="row">Сигнал</th><td><button type="button" class="component-value-link" data-generator ${signal&&onRawCommit?'':'disabled'}>${signal?(signal.waveform==='sine'?'Синусоидальная волна':'Прямоугольная волна')+'…':'—'}</button></td><td class="component-property-flag"></td></tr>`:'';
 const nativeValueTitles:Record<string,string>={R:'Сопротивление',C:'Емкость',L:'Индуктивность',V:'Напряжение',VS:'Напряжение',I:'Ток',IS:'DC уровень',VG:'DC уровень'};
 const familyRows=componentPropertyRows(c.kind).map(row=>unavailable(row.label,row.flag)).join('');
 // Exact three-byte VM/round-AM donor profile corroborated by native XML.
 // Other profiles remain visible without inventing decoded enum meanings.
 const meterTail=c.record.data.slice(c.parameter_offset),knownOutput=['VM','AMV'].includes(c.kind)&&meterTail.length===3&&meterTail[0]===1&&meterTail[1]===0&&meterTail[2]===0;
 const readonlyRow=(label:string,value:string)=>`<tr class="component-unavailable"><th scope="row">${label}</th><td><input disabled value="${value}" aria-label="${label}"></td><td class="component-property-flag"></td></tr>`;
 const meterRows=profile.mode?(knownOutput?readonlyRow('Режим ввода/вывода','Вывод')+readonlyRow('Ошибка','Нет'):unavailable('Режим ввода/вывода')+unavailable('Ошибка')):'';
 const dialog=createDialog(`${c.label?c.label+' - ':''}${kindTitles[c.kind]??c.kind}`,`<form class="component-common-form">${geometry}<div class="component-body"><table class="component-properties-table" aria-label="Свойства компонента"><tbody>${c.kind==='GND'?readonlyRow('Тип','Земля'):field('Метка','label',c.label)}${paramsRow}${c.value===undefined?'':field(nativeValueTitles[c.kind]??'Значение','value',c.value,units[c.kind]??'')}${typeRow}${signalRow}${meterRows}${familyRows}</tbody></table><p class="component-error" role="alert" aria-live="polite"></p></div><footer><button type="submit"><span class="component-button-icon component-ok">✓</span>ОК</button><button type="button" data-cancel><span class="component-button-icon component-cancel">✕</span>Отмена</button><button type="button" data-help disabled><span class="component-button-icon component-help">?</span>Помощь</button></footer></form>`);
 function readChanges(current=c):Changes {
  return componentPropertyChanges(current,Object.fromEntries([...new FormData(dialog.querySelector('form')!).entries()].map(([key,value])=>[key,String(value)])));
 }
 function stageCommon():Doc {
  const next=decode(encode(staged)),current=component(next.records[index],index),changes=readChanges(current);
  // Match the host's native wire movement rule. Label/value-only edits do not reroute wires.
  if((changes.x??current.x)!==current.x||(changes.y??current.y)!==current.y)moveComponent(next,index,changes.x??current.x,changes.y??current.y,changes.orientation??current.orientation);
  updateComponent(next,index,changes);return next;
 }
 function commitStaged(){
  if(!onRawCommit||!hasNestedEdits){const changes=readChanges();if(Object.keys(changes).length){if(!sameBytes(encode(doc),openedBytes))throw Error('Схема изменилась. Закройте окно и откройте свойства снова.');commit(changes);}return;}
  const next=stageCommon();if(sameBytes(encode(next),openedBytes))return;
  if(!sameBytes(encode(doc),openedBytes))throw Error('Схема изменилась. Закройте окно и откройте свойства снова.');
  onRawCommit(()=>{if(!sameBytes(encode(doc),openedBytes))throw Error('Схема изменилась. Закройте окно и откройте свойства снова.');doc.records=next.records;doc.trailer=next.trailer;});
 }
 function report(error:unknown){dialog.querySelector<HTMLElement>('.component-error')!.textContent=error instanceof Error?error.message:String(error);}
 dialog.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick=()=>dialog.close();
 dialog.querySelector<HTMLFormElement>('form')!.onsubmit=e=>{e.preventDefault();try{commitStaged();dialog.close();}catch(error){report(error);}};
 const modelSelect=dialog.querySelector<HTMLSelectElement>('#component-model');
 const modelButton=dialog.querySelector<HTMLButtonElement>('[data-model]');if(modelButton&&isBjt)modelButton.onclick=()=>showCatalogDialog(c.kind,modelSelect?.value??c.model??'',model=>{try{const next=stageCommon();updateComponent(next,index,{model});staged=next;hasNestedEdits=true;modelSelect!.value=model;dialog.querySelector<HTMLElement>('[data-model-current]')!.textContent=model;}catch(error){report(error);}});
 const parametersButton=dialog.querySelector<HTMLButtonElement>('[data-parameters]');if(parametersButton)parametersButton.onclick=()=>showGenericParameters(c.label);
 const generatorButton=dialog.querySelector<HTMLButtonElement>('[data-generator]');if(generatorButton&&onRawCommit)generatorButton.onclick=()=>{try{
  staged=stageCommon();const child=decode(encode(staged));showGeneratorParameters(child,index,mutate=>{mutate();staged=child;hasNestedEdits=true;const signal=nativeGenerator(component(staged.records[index],index));if(signal)generatorButton.textContent=(signal.waveform==='sine'?'Синусоидальная волна':'Прямоугольная волна')+'…';});
 }catch(error){report(error);}};
 dialog.showModal();const firstField=dialog.querySelector<HTMLInputElement>('input:not([type=hidden]):not(:disabled)');firstField?.focus();firstField?.select();
}
