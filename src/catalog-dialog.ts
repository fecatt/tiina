import {bjtModels} from './bjt-library.ts';
import {BJT_FIELDS} from './codec.ts';

type Model={polarity:string;parameters_b64:string;description?:string};

const names=BJT_FIELDS;
const captions:Record<string,[string,string]>={
 IS:['Ток насыщения','A'],NF:['Прямой. коэффициент эмиссии.','-'],NR:['Обратный. коэффициент эмиссии.','-'],RE:['Сопротивление эмиттера','Ohm'],RC:['Сопротивление коллектора','Ohm'],RB:['Базовое сопротивление','Ohm'],VAF:['Прямое. раннее напряжение','V'],VAR:['Обратное. раннее напряжение','V'],ISE:['Ток насыщения b-e','A'],ISC:['Ток насыщения b-c','A'],ISS:['Ток насыщения подложки','A'],
 NE:['Коэффициент эмиссии b-e','-'],NC:['Коэффициент эмиссии b-c','-'],NS:['Коэффициент эмиссии подложки','-'],BF:['Прямой коэффициент передачи','-'],BR:['Обратный коэффициент передачи','-'],IKF:['Ток перегиба прямой','A'],IKR:['Ток перегиба обратный','A'],CJC:['Емкость перехода b-c','F'],CJE:['Емкость перехода b-e','F'],CJS:['Емкость перехода подложки','F'],VJC:['Контактный потенциал b-c','V'],VJE:['Контактный потенциал b-e','V'],VJS:['Контактный потенциал подложки','V'],MJC:['Коэффициент градации b-c','-'],MJE:['Коэффициент градации b-e','-'],MJS:['Коэффициент градации подложки','-'],TF:['Время переноса прямое','s'],TR:['Время переноса обратное','s'],EG:['Ширина запрещенной зоны','eV'],KF:['Коэффициент шума','-'],AF:['Показатель шума','-'],VCEO:['Предельное напряжение CE','V'],VCBO:['Предельное напряжение CB','V'],VEBO:['Предельное напряжение EB','V'],ICMAX:['Максимальный ток коллектора','A'],IBMAX:['Максимальный ток базы','A'],PMAX:['Максимальная мощность','W']
};
const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function nativeNumber(n:number):string {
 if(n===0)return '0';
 for(const [scale,suffix] of [[1e12,'T'],[1e9,'G'],[1e6,'M'],[1e3,'k'],[1,''],[1e-3,'m'],[1e-6,'u'],[1e-9,'n'],[1e-12,'p'],[1e-15,'f']] as [number,string][]){
  if(Math.abs(n)>=scale&&Math.abs(n)<1e15)return new Intl.NumberFormat('ru-RU',{maximumSignificantDigits:6,useGrouping:false}).format(n/scale)+suffix;
 }
 return String(n).replace('.',',');
}
function decodeParameters(model:Model):number[]{const bytes=Uint8Array.from(atob(model.parameters_b64),c=>c.charCodeAt(0));const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);return names.map((_,i)=>view.getFloat64(i*8,true));}
function stylesheet():void {if(document.querySelector('link[data-catalog-style]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./catalog-dialog.css',import.meta.url).href;link.dataset.catalogStyle='';document.head.append(link);}

/** Preview the component's polarity-compatible native models; only OK returns a choice. */
export function showCatalogDialog(polarity:string,current:string,onChoose:(model:string)=>void):void {
 stylesheet();const models=bjtModels(polarity),available=Object.keys(models);if(current&&!available.includes(current))available.unshift(current);
 const dialog=document.createElement('dialog');dialog.className='catalog-dialog';dialog.setAttribute('aria-label','Редактор каталога');
 dialog.innerHTML=`<header class="catalog-title">Редактор каталога<button type="button" data-close aria-label="Закрыть">×</button></header><form><main class="catalog-main"><section class="catalog-left"><label>Библиотека<select disabled><option>Tina</option></select></label><label>Модель<select disabled><option>SPICE-BJT</option><option>SPICE-BJT (3F5)</option><option>Hibrid-P</option><option>SymbBTrMod1</option></select></label><label class="catalog-search-label">Поиск типа<input type="search" data-search aria-label="Поиск типа" placeholder="Поиск типа…" autocomplete="off"></label><label class="catalog-type-label">Тип<select data-types size="13" aria-label="Тип модели"></select><small data-no-matches hidden>Совпадений нет</small></label><div class="catalog-count" data-count></div></section><section class="catalog-right"><fieldset class="catalog-stability"><legend>Модель устойчивости</legend><label><input type="radio" name="stability" checked>Ничего</label><label class="catalog-disabled"><input type="radio" name="stability" disabled>Главное</label></fieldset><div class="catalog-param-title">Параметры модели</div><div class="catalog-description" data-description></div><div class="catalog-params" data-params></div></section></main><footer><button type="submit"><span class="catalog-ok">✓</span> ОК</button><button type="button" data-cancel><span class="catalog-cancel">✕</span> Отмена</button><button type="button" disabled><span class="catalog-help">?</span> Помощь</button></footer></form>`;
 document.body.append(dialog);
 const list=dialog.querySelector<HTMLSelectElement>('[data-types]')!,search=dialog.querySelector<HTMLInputElement>('[data-search]')!,noMatches=dialog.querySelector<HTMLElement>('[data-no-matches]')!,count=dialog.querySelector<HTMLElement>('[data-count]')!,description=dialog.querySelector<HTMLElement>('[data-description]')!,params=dialog.querySelector<HTMLElement>('[data-params]')!;
 let chosen=current||available[0]||'';search.value='';
 const renderOptions=()=>{const query=search.value.trim().toLocaleLowerCase();const matches=available.filter(name=>name.toLocaleLowerCase().includes(query));list.replaceChildren(...matches.map(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;return option;}));list.value=matches.includes(chosen)?chosen:'';if(!list.value)list.selectedIndex=-1;noMatches.hidden=matches.length>0;};
 const preview=()=>{const name=chosen,model=models[name];const index=available.indexOf(name)+1;count.textContent=`${index}/${available.length}`;description.textContent=`Загрузка: ${model?.description??name}`;const values=model?decodeParameters(model):[];params.innerHTML=names.map((key,i)=>{const [caption,unit]=captions[key]??[key,''];return `<div class="catalog-param" data-parameter="${key}"><span class="catalog-param-name"><small>${esc(caption)}${unit?` [${esc(unit)}]`:''}</small></span><span class="catalog-param-value">${Number.isFinite(values[i])?nativeNumber(values[i]):'—'}</span></div>`;}).join('');};
 renderOptions();preview();
 search.addEventListener('input',renderOptions);
 search.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();const first=list.options[0];if(first){chosen=first.value;list.value=chosen;preview();list.focus();}}});
 list.addEventListener('change',()=>{if(list.value){chosen=list.value;preview();}});
 const close=()=>dialog.close();dialog.querySelector<HTMLButtonElement>('[data-close]')!.onclick=close;dialog.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick=close;
 dialog.querySelector<HTMLFormElement>('form')!.onsubmit=e=>{e.preventDefault();if(chosen)onChoose(chosen);close();};
 dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
}
