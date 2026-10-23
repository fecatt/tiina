import {component,modelParameters,readString,BJT_FIELDS,type Doc,type Changes} from './codec.ts';
import library from './library.json' with {type:'json'};
import {nativeGenerator,setNativeGenerator,type NativeGeneratorSettings} from './native-generator.ts';

// Keep numerical helpers importable in Node tests without loading browser CSS.
if(typeof document!=='undefined'){const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./props-dialog.css',import.meta.url).href;document.head.append(stylesheet);}
const escape=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const kindTitles:Record<string,string>={GND:'Общий узел',R:'Резистор',C:'Конденсатор',L:'Катушка индуктивности',V:'Батарея',VS:'Источник напряжения',I:'Источник тока',IS:'Генератор тока',VG:'Генератор напряжения',VM:'Вольтметр',AM:'Указатель тока',AMV:'Амперметр',NPN:'Транзистор NPN',PNP:'Транзистор PNP'};
const units:Record<string,string>={R:'Ом',C:'Ф',L:'Гн',V:'В',VS:'В',VG:'В',I:'А',IS:'А'};
const positive=new Set(['IS','NF','NR','NE','NC','NS','BF','BR','EG','VCEO','VCBO','VEBO','ICMAX','IBMAX','PMAX']);
const nonnegative=new Set(['RE','RC','RB','VAF','VAR','ISE','ISC','ISS','IKF','IKR','CJC','CJE','CJS','VJC','VJE','VJS','MJC','MJE','MJS','TF','TR','KF','AF']);

/** SI numbers with the common Russian and SPICE engineering suffixes. */
export function parseEngineeringValue(input:string):number {
 let s=input.trim().replace(',','.').replace(/\s+/g,'');let multiplier=1;
 for(const [suffix,scale] of [['meg',1e6],['мк',1e-6],['М',1e6],['k',1e3],['K',1e3],['к',1e3],['m',1e-3],['м',1e-3],['u',1e-6],['µ',1e-6],['n',1e-9],['н',1e-9],['p',1e-12],['п',1e-12]] as [string,number][]){if(s.endsWith(suffix)){s=s.slice(0,-suffix.length);multiplier=scale;break;}}
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))throw Error('Введите число, например 1к, 10мк или 1.26e-14');
 const n=Number(s)*multiplier;if(!Number.isFinite(n))throw Error('Число должно быть конечным');return n;
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
 const next=d.slice(),out=new DataView(next.buffer);for(const [key,value] of Object.entries(changes))out.setFloat64(p+4+BJT_FIELDS.indexOf(key)*8,value,true);rec.data=next;
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
  onRawCommit(()=>setNativeGenerator(doc,index,next));dialog.close();
 }catch(error){dialog.querySelector<HTMLElement>('.component-error')!.textContent=error instanceof Error?error.message:String(error);}};
 dialog.showModal();
}

/** The host callback owns undo/history and wire movement. This dialog never
 * changes common component properties before that callback accepts them. */
export function showComponentProperties(doc:Doc,index:number,commit:(changes:Changes)=>void,onRawCommit?:(mutate:()=>void)=>void):void {
 const c=component(doc.records[index],index),isBjt=['NPN','PNP'].includes(c.kind);
 const field=(label:string,key:string,value:unknown,unit='')=>`<tr><th scope="row"><label for="component-${key}">${escape(label)}</label></th><td><input id="component-${key}" type="text" name="${key}" value="${escape(value)}" autocomplete="off" /></td><td class="component-unit">${escape(unit)}</td></tr>`;
 const models=Object.entries(library.bjt_models).filter(([,m])=>m.polarity===c.kind).map(([name])=>name);if(c.model&&!models.includes(c.model))models.unshift(c.model);
 const modelRow=isBjt?`<tr><th scope="row"><label for="component-model">Модель</label></th><td colspan="2"><div class="component-model-picker"><select id="component-model" name="model">${models.map(name=>`<option value="${escape(name)}" ${name===c.model?'selected':''}>${escape(name)}</option>`).join('')}</select><button type="button" data-model ${onRawCommit?'':'disabled'} title="Параметры модели SPICE BJT">…</button></div></td></tr>`:'';
 const signal=nativeGenerator(c),signalRow=c.kind==='VG'?`<tr><th>Сигнал</th><td colspan="2"><button type="button" data-generator ${signal&&onRawCommit?'':'disabled'}>${signal?(signal.waveform==='sine'?'Синусоидальная волна':'Прямоугольная волна')+'…':'Формат пока не поддерживается'}</button></td></tr>`:'';
 const dialog=createDialog(kindTitles[c.kind]??c.kind,`<form class="component-common-form"><div class="component-body"><div class="component-tab-title">Основные параметры</div><table class="component-properties-table"><tbody>${c.kind==='GND'?'':field('Обозначение','label',c.label)}${c.value===undefined?'':field(c.kind==='VG'?'DC уровень':'Номинал','value',c.value,units[c.kind]??'')}${modelRow}${signalRow}</tbody></table>${c.value===undefined?'':'<p class="component-explanation">Приставки: к, М, м, мк, н, п. Например: 1к, 10мк.</p>'}<details class="component-advanced"><summary>Расположение и подпись</summary><table class="component-properties-table"><tbody>${field('Координата X','x',c.x)}${field('Координата Y','y',c.y)}<tr><th scope="row"><label for="component-orientation">Поворот</label></th><td colspan="2"><select id="component-orientation" name="orientation">${[0,1,2,3].map(n=>`<option value="${n}" ${n===c.orientation?'selected':''}>${n*90}°</option>`).join('')}</select></td></tr>${c.kind==='GND'?'':field('Смещение подписи X','label_dx',c.label_dx)+field('Смещение подписи Y','label_dy',c.label_dy)}</tbody></table></details><p class="component-error" role="alert" aria-live="polite"></p></div><footer><button type="submit">ОК</button><button type="button" data-cancel>Отмена</button><button type="button" data-help>Справка</button></footer></form>`);
 function readChanges():Changes {
  const fd=new FormData(dialog.querySelector('form')!);const result:Changes={};
  if(c.kind!=='GND'){const label=String(fd.get('label')??'');if(!label.trim())throw Error('Введите обозначение элемента');result.label=label;result.label_dx=parseEngineeringValue(String(fd.get('label_dx')));result.label_dy=parseEngineeringValue(String(fd.get('label_dy')));}
  result.x=parseEngineeringValue(String(fd.get('x')));result.y=parseEngineeringValue(String(fd.get('y')));result.orientation=Number(fd.get('orientation'));
  if(c.value!==undefined){const value=parseEngineeringValue(String(fd.get('value')));if(['R','C','L'].includes(c.kind)&&value<=0)throw Error('Номинал должен быть больше нуля');result.value=value;}
  if(isBjt){const model=String(fd.get('model'));if(model!==c.model)result.model=model;}
  for(const key of ['x','y','label_dx','label_dy'] as const)if(result[key]!==undefined&&(!Number.isInteger(result[key])||result[key]!< -32768||result[key]!>32767))throw Error('Координаты и смещения должны быть целыми числами от −32768 до 32767');
  return result;
 }
 function report(error:unknown){dialog.querySelector<HTMLElement>('.component-error')!.textContent=error instanceof Error?error.message:String(error);}
 dialog.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick=()=>dialog.close();
 dialog.querySelector<HTMLButtonElement>('[data-help]')!.onclick=()=>{const message=document.createElement('p');message.className='component-explanation';message.textContent='Изменения применяются кнопкой ОК. Многоточие рядом с моделью открывает её параметры. Поворот и координаты доступны в разделе «Расположение и подпись».';dialog.querySelector('.component-body')!.append(message);};
 dialog.querySelector<HTMLFormElement>('form')!.onsubmit=e=>{e.preventDefault();try{commit(readChanges());dialog.close();}catch(error){report(error);}};
 const modelButton=dialog.querySelector<HTMLButtonElement>('[data-model]');if(modelButton&&onRawCommit)modelButton.onclick=()=>{try{const changes=readChanges();const commonChanged=changes.model!==undefined||changes.label!==c.label||changes.x!==c.x||changes.y!==c.y||changes.orientation!==c.orientation||changes.label_dx!==c.label_dx||changes.label_dy!==c.label_dy;if(commonChanged)commit(changes);dialog.close();showModelParameters(doc,index,onRawCommit);}catch(error){report(error);}};
 const generatorButton=dialog.querySelector<HTMLButtonElement>('[data-generator]');if(generatorButton&&onRawCommit)generatorButton.onclick=()=>{try{
  const changes=readChanges();if(changes.value!==c.value||changes.label!==c.label||changes.x!==c.x||changes.y!==c.y||changes.orientation!==c.orientation||changes.label_dx!==c.label_dx||changes.label_dy!==c.label_dy)commit(changes);
  dialog.close();showGeneratorParameters(doc,index,onRawCommit);
 }catch(error){report(error);}};
 dialog.showModal();dialog.querySelector<HTMLInputElement>('input')?.select();
}
