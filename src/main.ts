import {buildCleanSchematicSvg,printSchematic} from './editor-export.ts';
import {WireDraft} from './wire-draft.ts';
import {DEFAULT_PAGE,pageSettings,pagePreviewMarkup,showPageSettings,type PageSettings} from './editor-page.ts';
import {showTextDialog} from './text-dialog.ts';
import {initializeMenuIntent} from './menu-intent.ts';
import {texts,textRecord,newText,updateText} from './native-text.ts';
import {formulaLineSvg} from './native-formula.ts';
import liveMenus from './native-menus.json';
import {nativeGenerator} from './native-generator.ts';
import {showScope} from './scope-dialog.ts';
import {transientStats} from './result-measurements.ts';
import {resultTablePage,resultCurveText} from './result-table.ts';
import {transferCurve,bandwidth} from './ac-measurements.ts';
import {checkCircuit} from './erc.ts';
import './style.css';
import './theme.css';
import './dialog-theme.css';
import './menu-layout.css';
import './button-feedback.css';
import {initializeToolHelp} from './tool-help.ts';
import nativeCatalog from './native-catalog.json';
import {toolbarIcon,componentIcon} from './icons.ts';
import {editorToolbar} from './ui-layout.ts';
import {componentSymbol,type ComponentSymbolState} from './component-symbols.ts';
import {loadNativeSymbolVectors} from './native-symbol-vectors.ts';
import {loadNativePalette} from './native-palette.ts';
import {nativeDc,nativeControl,nativeControlValues,nativeAc,setNativeAc,nativeTransient,setNativeTransient,setNativeControl,setNativeDc} from './native-analysis.ts';
import {showControlProperty,showDcTransferDialog,showAcTransferDialog,showTransientDialog} from './native-analysis-dialogs.ts';
import {defaultPlotAxis,showPlotAxisDialog,type PlotAxisSettings} from './plot-settings.ts';
import {curvePoint,curveXAtY,renderScientificPlot} from './plot-renderer.ts';
import {parseCurveExpression} from './curve-expression.ts';
import {exportNativeGraphTdr,exportBjtNativeTdr} from './native-graph-export.ts';
import {buildBjtGraphScene,renderBjtGraphScene,showBjtGraphDialog,type BjtGraphScene,type BjtGraphData} from './bjt-graph-scene.ts';
import './plot-cursors.css';
import {macroSymbol,macroSymbolSvg} from './native-macro-symbol.ts';
import {showComponentProperties,componentPropertyChanges} from './properties-dialog.ts';
import {copySelection,pasteSelection,selectAll,translateSelection,dragWireSegment,moveWireObject,deleteSelection,rotateSelection,transformSelection,toggleWireJunction,type SelectionClipboard} from './editor-state.ts';
import {build,CREATABLE_KINDS,decode,encode,labelGeometry,translateLabel,rotateLabel,components,wires,pins,presets,updateComponent,newComponent,makeWire,addConnectedWire,moveComponent,exportSpice,connectivity,modelParameters,type Doc,type Component,type Point,type Rec} from './codec.ts';
import {simulate,type SimulationConfig,type SimulationResult,type Curve,type Cell} from './solver.ts';

const esc=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const fmt=(n:number,d=5)=>Number.isFinite(n)?Number(n.toPrecision(d)).toString():'—';
function eng(n:number){if(n===0)return '0';for(const [v,s] of [[1e6,'М'],[1e3,'к'],[1,''],[1e-3,'м'],[1e-6,'мк'],[1e-9,'н'],[1e-12,'п']] as [number,string][])if(Math.abs(n)>=v)return fmt(n/v)+s;return fmt(n);}
function number(s:string){s=s.trim().replace(',','.').replace(/\s/g,'');let scale=1;for(const [suffix,m] of [['meg',1e6],['мк',1e-6],['u',1e-6],['µ',1e-6],['М',1e6],['k',1e3],['к',1e3],['m',1e-3],['м',1e-3],['n',1e-9],['н',1e-9],['p',1e-12],['п',1e-12]] as [string,number][])if(s.endsWith(suffix)){s=s.slice(0,-suffix.length);scale=m;break;}if(!s||!Number.isFinite(Number(s)*scale))throw Error('Введите число, например 1к или 10мк');return Number(s)*scale;}
function download(name:string,data:BlobPart,type='application/octet-stream'){const url=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function base64(a:Uint8Array){let s='';for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(s);}
const un64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const catalogGroups=nativeCatalog.groups;
const groups:Record<string,[string,string][]>=Object.fromEntries(catalogGroups.map(g=>[g.label,g.items.map(item=>[(item as {kind?:string}).kind??'native:'+item.typeId,item.label])])) as Record<string,[string,string][]>;
const supportedKinds=new Set(CREATABLE_KINDS);
const kindNames=Object.fromEntries(Object.values(groups).flat().map(([k,n])=>[k,n]));
function symbol(k:string,c?:ComponentSymbolState){
 if(k==='MACRO'&&c&&'record' in c)try{return macroSymbolSvg(macroSymbol(c.record));}catch{/* The proven LM741 drawing uses the legacy profile. */}
 return componentSymbol(k,c)||legacySymbol(k);
}
function symbolHitArea(c:Component){
 const hit=(shape:string)=>`<g data-component-hit data-export-exclude="true" fill="transparent" stroke="none">${shape}</g>`;
 if(['VM','AMV'].includes(c.kind))return hit('<circle cx="0" cy="20" r="13.5"/>');
 if(['VS','VG','I','IS'].includes(c.kind))return hit('<circle cx="20" cy="0" r="13.5"/>');
 const bodyBounds:Record<string,[number,number,number,number]>={R:[7,-5,26,11],C:[14,-10,12,20],L:[7,-7,26,9],V:[-9,10,18,16],GND:[-9,7,18,10],AM:[16,-5,11,10],D:[13,-9,15,18],ZENER:[13,-13,18,26],SCHOTTKY:[13,-11,19,22]};
 const bounds=bodyBounds[c.kind];if(bounds){const [x,y,width,height]=bounds;return hit(`<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`);}
 if(['NPN','PNP'].includes(c.kind))return hit('<polygon points="-6,-12 17,-20 17,20 -6,12"/>');
 if(c.kind==='CONNECTOR')return '<rect x="-5" y="-5" width="10" height="10" fill="transparent" stroke="none"/>';
 if(c.kind==='MACRO')try{const g=macroSymbol(c.record).graphics;const x=Math.min(...g.map(r=>r.x1)),y=Math.min(...g.map(r=>r.y1)),right=Math.max(...g.map(r=>r.x2)),bottom=Math.max(...g.map(r=>r.y2));return `<rect x="${x}" y="${y}" width="${right-x}" height="${bottom-y}" fill="transparent" stroke="none"/>`;}catch{/* Legacy hit bounds below. */}
 return hit('<circle cx="0" cy="0" r="4"/>');
}
function legacySymbol(k:string){
 const line=(x1:number,y1:number,x2:number,y2:number)=>`<path d="M${x1},${y1}L${x2},${y2}"/>`;
 if(k==='GND')return '<path d="M0,0V7M-9,7H9M-6,11H6M-2,15H2"/>';
 if(k==='PROBE')return '<circle cx="0" cy="0" r="2.4"/>';
 if(k==='R')return '<path d="M0,0H11M29,0H40"/><rect x="11" y="-4" width="18" height="8"/>';
 if(k==='C')return '<path d="M0,0H17M17,-9V9M23,-9V9M23,0H40"/>';
 if(k==='L')return '<path d="M0,0H8Q8,-10 14,0Q14,-10 20,0Q20,-10 26,0Q26,-10 32,0H40"/>';
 if(k==='D')return '<path d="M0,0H14M26,0H40M26,-8V8M14,-8L26,0L14,8Z"/>';
 if(k==='MACRO')return '<path d="M-32,16H-24M-32,-16H-24M24,0H32M-8,24V16M-8,-24V-16"/><path d="M-24,-24L24,0L-24,24Z" style="stroke:#000080;stroke-width:2"/><text x="-22" y="19" style="fill:currentColor;stroke:none;font:11px Courier New">+</text><text x="-22" y="-12" style="fill:currentColor;stroke:none;font:11px Courier New">−</text><text x="-11" y="13" style="fill:currentColor;stroke:none;font:11px Courier New">+</text>';
 if(k==='V')return '<path d="M0,0V12M-9,12H9M-5,17H5M-9,22H9M-5,27H5M0,27V40"/><text x="9" y="7" style="fill:#333;stroke:none;font:8px Arial">+</text>';
 if(k==='NPN'||k==='PNP')return '<path d="M-16,0H-4M-4,-11V11M-4,-7L16,-18V-24M-4,7L16,18V24"/>'+(k==='NPN'?'<path d="M6,14L13,17L10,10Z" fill="currentColor"/>':'<path d="M4,10L10,13L8,16Z" fill="currentColor"/>');
 if(k==='VS'||k==='VG')return '<path d="M0,0H8M32,0H40"/><circle cx="20" cy="0" r="12"/><text x="20" y="4" text-anchor="middle" style="fill:currentColor;stroke:none;font:11px Arial">∿</text>';
 if(k==='AM')return '<path d="M0,0H40M24,0L17,-4V4Z"/>';
 if(k==='I'||k==='IS')return '<path d="M0,0H8M32,0H40M26,-6L18,0L26,6M21,-6L13,0L21,6"/><circle cx="20" cy="0" r="12"/>';
 return line(0,0,0,8)+line(0,32,0,40)+'<circle cx="0" cy="20" r="12"/>'+`<text x="0" y="24" text-anchor="middle" style="fill:currentColor;stroke:none;font:11px Arial">${k==='VM'?'V':k==='AMV'?'A':'∿'}</text>`;
}
function mini(k:string){return componentIcon(k);}
function blank(){return build({...presets.basics,components:[],wires:[]});}
let doc:Doc=blank(),analysis:SimulationConfig={kind:'op'};
const allPresets=presets;
let resultProject:ReturnType<typeof project>|null=null,resultName='';
let cursorCurve=0;
let cursorCurveA=0,cursorCurveB=0,cursorTarget:'a'|'b'='a';
const axesByDocument=new Map<number,{x:PlotAxisSettings;y:PlotAxisSettings}>();
function plotAxes(){let axes=axesByDocument.get(activeDocument);if(!axes){axes={x:defaultPlotAxis(''),y:defaultPlotAxis('')};axesByDocument.set(activeDocument,axes);}return axes;}
function freshAnalysisDialog(){const d=document.createElement('dialog');d.className='modal';document.body.append(d);d.addEventListener('close',()=>d.remove(),{once:true});return d;}
let selected=-1,selectedPart:'object'|'label'='object',mode='select',category='Основные',zoom=1,offset:Point=[0,0],grid=true,pinMarkers=true,dirty=false,showProps=false,name='Схема1';
let repeatInsert=false,lastInsertion='R',insertionRotation=0,insertionMirrored=false;let wireCursor:Point|null=null,placementCursor:Point|null=null;
let pendingText:Rec|null=null,lastCanvasCursor:Point|null=null;
let wireDraft:WireDraft|null=null,wireStroke:{origin:Point;moved:boolean;finishes:boolean}|null=null;
let wireCommitTime=0,wireCommitPoint:Point|null=null;
let showLabels=true,showValues=true,showElements=true,showToolbar=true,showPalette=true;
let redoHistory:Uint8Array[]=[],selectedIndices=new Set<number>(),clipboard:SelectionClipboard|null=null,pasteCount=0,selectionBox:{start:Point,end:Point}|null=null;
let history:Uint8Array[]=[],wireStart:Point|null=null,drag:{origin:Point,snapshot:Uint8Array,index:number,label?:boolean,segment?:number}|null=null,pan:{x:number,y:number,offset:Point}|null=null;
let groupTransformPivot:{indices:string;bytes:Uint8Array;pivot:Point}|null=null;
let result:SimulationResult|null=null,lastConfig:SimulationConfig|null=null,abort:AbortController|null=null,currentTab='schematic';
let plotVector='',plotMode='magnitude',cursorA:number|null=null,cursorB:number|null=null;
let bjtGraphScene:BjtGraphScene|null=null;
let hReport:Record<string,unknown>|null=null;
let printPage:PageSettings=pageSettings();try{const saved=localStorage.getItem('tina-print-preferences-v1');if(saved)printPage=pageSettings(JSON.parse(saved));}catch{printPage=pageSettings(DEFAULT_PAGE);}
type OpenDocument={id:number;name:string;bytes:Uint8Array;analysis:SimulationConfig;history:Uint8Array[];redo:Uint8Array[];dirty:boolean;zoom:number;offset:Point;result:SimulationResult|null;lastConfig:SimulationConfig|null;resultProject:ReturnType<typeof project>|null;resultName:string;hReport:Record<string,unknown>|null;plotVector:string};
let activeDocument=1,nextDocument=2;const openDocuments:OpenDocument[]=[];
function persistWorkspace(){
 try{const data=JSON.stringify({format:'tina-web-workspace-v1',activeDocument,nextDocument,documents:openDocuments.map(d=>({id:d.id,name:d.name,tsc:base64(d.bytes),analysis:d.analysis,dirty:d.dirty,zoom:d.zoom,offset:d.offset}))});if(data.length>8_000_000)throw Error('workspace too large');localStorage.setItem('tina-web-workspace-v1',data);}catch{status('Не удалось сохранить все вкладки в браузере. Сохраните важные схемы в файлы.');}
}
function resetInteraction(){selectedPart='object';selected=-1;selectedIndices.clear();wireStart=null;drag=null;pan=null;selectionBox=null;setMode('select');}
function storeActive(){const stored:OpenDocument={id:activeDocument,name,bytes:encode(doc),analysis:structuredClone(analysis),history:[...history],redo:[...redoHistory],dirty,zoom,offset:[...offset],result,lastConfig,resultProject,resultName,hReport,plotVector};const i=openDocuments.findIndex(d=>d.id===activeDocument);if(i<0)openDocuments.push(stored);else openDocuments[i]=stored;persistWorkspace();}
function documentTabs(){const holder=$('#document-tabs');if(!holder)return;holder.innerHTML=openDocuments.map(d=>`<button class="document-tab ${d.id===activeDocument?'active':''}" data-document="${d.id}" title="${esc(d.name)}">${esc(d.name)}${d.dirty?' *':''}<span data-close-document="${d.id}" title="Закрыть схему">×</span></button>`).join('')+`<button class="document-add" data-action="new" title="Новая схема (Ctrl+N)" aria-label="Новая схема">+</button>`;}
function loadActive(stored:OpenDocument){activeDocument=stored.id;name=stored.name;doc=decode(stored.bytes);analysis=structuredClone(stored.analysis);history=[...stored.history];redoHistory=[...stored.redo];dirty=stored.dirty;zoom=stored.zoom;offset=[...stored.offset];result=stored.result;lastConfig=stored.lastConfig;resultProject=stored.resultProject;resultName=stored.resultName;hReport=stored.hReport;plotVector=stored.plotVector;bjtGraphScene=null;resetInteraction();resetCalculationViews();$('#title').textContent=name+(dirty?' *':'')+' — Схемный редактор';switchTab('schematic');renderProperties();documentTabs();}
function switchDocument(id:number){if(abort){status('Сначала завершите или остановите текущий расчёт.');return;}storeActive();const stored=openDocuments.find(d=>d.id===id);if(stored)loadActive(stored);persistWorkspace();}
function addDocument(loaded:Doc,title:string,config:SimulationConfig){storeActive();activeDocument=nextDocument++;name=title;doc=loaded;analysis=config;history=[];redoHistory=[];selected=-1;selectedIndices.clear();dirty=false;result=null;lastConfig=null;hReport=null;resultProject=null;resultName='';plotVector='';bjtGraphScene=null;resetInteraction();resetCalculationViews();$('#title').textContent=name+' — Схемный редактор';switchTab('schematic');fit();renderProperties();storeActive();documentTabs();}
function createEmptyDocument(){openDocuments.length=0;activeDocument=nextDocument++;doc=blank();name='Схема'+activeDocument;analysis={kind:'op'};history=[];redoHistory=[];dirty=false;result=null;lastConfig=null;hReport=null;resultProject=null;resultName='';plotVector='';storeActive();loadActive(openDocuments[0]);}
function closeDocument(id:number){if(abort){status('Остановите расчёт перед закрытием схемы.');return;}storeActive();const i=openDocuments.findIndex(d=>d.id===id);if(i<0)return;if(openDocuments[i].dirty&&!confirm('Закрыть схему «'+openDocuments[i].name+'» без сохранения?'))return;openDocuments.splice(i,1);if(!openDocuments.length)createEmptyDocument();else if(id===activeDocument)loadActive(openDocuments[Math.min(i,openDocuments.length-1)]);documentTabs();persistWorkspace();}
function closeAllDocuments(){if(abort){status('Остановите расчёт перед закрытием схем.');return;}storeActive();const count=openDocuments.filter(d=>d.dirty).length;if(count&&!confirm('Закрыть все схемы? Несохранённых схем: '+count+'. Изменения будут потеряны.'))return;createEmptyDocument();persistWorkspace();}
function saveAllDocuments(){storeActive();const used=new Set<string>();for(const item of openDocuments){let filename=item.name,number=2;while(used.has(filename.toLocaleLowerCase()))filename=item.name+' ('+(number++)+')';used.add(filename.toLocaleLowerCase());download(filename+'.TSC',Uint8Array.from(item.bytes).buffer);item.dirty=false;}dirty=false;documentTabs();$('#title').textContent=name+' — Схемный редактор';persistWorkspace();status('Файлы TSC переданы в загрузки браузера: '+openDocuments.length+'.');}
function saveDocumentAs(){const dialog=$<HTMLDialogElement>('#dialog');dialog.innerHTML=`<header>Сохранить как</header><form id="save-as-form"><div class="body"><label>Имя файла TSC<input name="filename" required maxlength="180" value="${esc(name)}" autocomplete="off"></label><p class="error" id="save-as-error" role="alert"></p></div><footer><button type="submit">Сохранить</button><button type="button" id="save-as-cancel">Отмена</button></footer></form>`;$('#save-as-cancel').onclick=()=>dialog.close();$('#save-as-form').onsubmit=e=>{e.preventDefault();const value=String(new FormData(e.target as HTMLFormElement).get('filename')??'').trim().replace(/\.tsc$/i,'');if(!value||/[<>:"/\\|?*\x00-\x1f]/.test(value)||/[. ]$/.test(value)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value)){$('#save-as-error').textContent='Введите допустимое имя файла.';return;}name=value;dialog.close();action('save');};dialog.showModal();dialog.querySelector<HTMLInputElement>('input')!.select();}
function selection(){return selectedIndices.size?[...selectedIndices]:selected>=0?[selected]:[];}
function rotateGroup(direction:1|-1){
 const indices=selection(),before=encode(doc),signature=indices.join(','),cache=groupTransformPivot;
 const pivot=cache&&cache.indices===signature&&cache.bytes.length===before.length&&cache.bytes.every((v,i)=>v===before[i])?cache.pivot:undefined;
 let nextPivot:Point|undefined;
 commitEdit(()=>{try{rotateSelection(doc,indices,direction);}catch(error){
  if(!(error instanceof Error)||!/(пока не проверен|Центр поворота)/.test(error.message))throw error;
  // Native text glyphs stay fixed under command66. Transform only electrical geometry.
  const electrical=indices.filter(i=>doc.records[i].type!==262);
  nextPivot=transformSelection(doc,electrical,{operation:direction===1?'rotate-left':'rotate-right',pivot}).pivot;
 }});
 groupTransformPivot=nextPivot?{indices:signature,bytes:encode(doc),pivot:nextPivot}:null;
}
function setSelection(indices:number[],part:'object'|'label'='object'){selectedPart=part;selectedIndices=new Set(indices);selected=indices.at(-1)??-1;renderProperties();draw();status(part==='label'?'Выбрана подпись: R — повернуть, мышью — переместить.':indices.length?'Выбрано объектов: '+indices.length:'Готово.');}
const menus:Record<string,[string,string,string?][]>={
 'Файл':[['Новая схема','new','Ctrl+N'],['Открыть…','open','Ctrl+O'],['Сохранить .TSC','save','Ctrl+S'],['Экспорт SPICE','spice']],
 'Правка':[['Отменить','undo','Ctrl+Z'],['Повторить','redo','Ctrl+Y'],['Вырезать','cut','Ctrl+X'],['Копировать','copy','Ctrl+C'],['Вставить','paste','Ctrl+V'],['Выделить всё','select-all','Ctrl+A'],['Повернуть','rotate','R'],['Свойства элемента','properties'],['Удалить выбранное','delete','Delete']],
 'Вставить':[['Текст','text','Ctrl+T'],['Провод','wire'],['Прямой провод — расширение браузера','wire-direct'],['Резистор','insert:R'],['Конденсатор','insert:C'],['Катушка','insert:L'],['Транзистор NPN','insert:NPN'],['Источник напряжения','insert:VS'],['Батарея','insert:V'],['Источник тока','insert:I'],['Общий узел','insert:GND']],
 'Вид':[['Свойства элемента','panel'],['Показать всю схему','fit']],
 'Анализ':[['Рабочая точка','analysis:op'],['Характеристика постоянного тока…','analysis:dc'],['Семейство характеристик…','analysis:dc-family'],['Частотная характеристика…','analysis:ac'],['Переходный процесс…','analysis:transient'],['h-параметры транзистора…','analysis:h']],
 'Инструменты':[['Проверить схему','validate'],['Сохранить текущий этап','checkpoint']],
 'Помощь':[['Управление редактором','help'],['Совместимость и ограничения','limits']],
};
const nativeActions:Record<number,string>={5:'new',6:'open',9:'save',10:'save-as',11:'save-all',12:'close',13:'close-all',25:'spice',51:'page-settings',52:'print-preview',53:'print',57:'undo',58:'redo',60:'cut',61:'copy',62:'paste',63:'delete',64:'select-all',66:'rotate',67:'rotate-right',68:'mirror',69:'properties',84:'junction',87:'last-component',88:'wire',92:'text',109:'repeat-insert',112:'normal',113:'page-layout',116:'zoom-normal',117:'fit',118:'zoom-window',119:'zoom-in',120:'zoom-out',124:'grid',125:'pins',126:'values',127:'elements',129:'labels',133:'refresh',140:'toolbar',141:'palette',149:'validate',156:'control-object',160:'analysis:op',162:'analysis:dc',167:'analysis:ac',171:'analysis:transient',236:'scope',261:'graph',297:'help',313:'limits'};
const checkActions=new Set(['normal','grid','pins','values','elements','labels','toolbar','palette','panel','repeat-insert']);
function menuItem(label:string,act?:string,key?:string){return `<button ${act?`data-action="${act}"`:'disabled'} ${act&&checkActions.has(act)?'role="menuitemcheckbox" aria-checked="false"':''}><span class="menu-check" aria-hidden="true"></span><span class="menu-label">${esc(label)}</span>${key?`<kbd>${esc(key)}</kbd>`:''}</button>`;}
function renderMenus(){return liveMenus.map(menu=>{const used=new Set<string>();const render=(items:typeof menu.children):string=>items.map(item=>{const [label,key]=item.label.split('\t');if(!label)return '<hr>';if(item.children.length)return `<div class="menu-submenu"><button aria-haspopup="menu"><span class="menu-check"></span><span class="menu-label">${esc(label)}</span><kbd>▶</kbd></button><div class="dropdown" role="menu">${render(item.children)}</div></div>`;const act=nativeActions[item.id];if(act)used.add(act);return menuItem(label,act,key);}).join('');const native=render(menu.children),extra=(menus[menu.label]??[]).filter(([,act])=>!used.has(act));return `<details><summary>${esc(menu.label)}</summary><div class="dropdown">${native}${extra.length?'<hr>'+extra.map(([label,act,key])=>menuItem(label,act,key)).join(''):''}</div></details>`;}).join('');}
function updateMenuChecks(){const checks:Record<string,boolean>={normal:true,grid,pins:pinMarkers,values:showValues,elements:showElements,labels:showLabels,toolbar:showToolbar,palette:showPalette,panel:showProps,'repeat-insert':repeatInsert};document.querySelectorAll<HTMLElement>('[role="menuitemcheckbox"]').forEach(b=>{const on=!!checks[b.dataset.action!];b.setAttribute('aria-checked',String(on));const mark=b.querySelector('.menu-check');if(mark)mark.textContent=on?'✓':'';});}
$('#app').innerHTML=`
 <div class="titlebar"><span class="logo">ϟ</span><span id="title">Схема1 — Схемный редактор</span><span class="version">Браузерная версия 0.11</span></div>
 <nav class="menu" aria-label="Главное меню">${renderMenus()}</nav>
 <div class="toolbar" role="toolbar" aria-label="Инструменты схемы">
 ${editorToolbar.map(([title,act])=>title==='|'?'<span class="sep"></span>':`<button class="tool ${act==='select'?'active':''}" ${act&&['select','wire'].includes(act)?`id="${act}-tool"`:''} ${act?`data-action="${act}"`:'disabled'} title="${esc(title)}" aria-label="${esc(title)}">${toolbarIcon(act??(title==='Open from the Web...'?'web':'symbol-editor'))}</button>`).join('')}
 <select id="zoom" aria-label="Масштаб">${[50,75,100,125,150,200,300].map(n=>`<option value="${n}">${n}%</option>`).join('')}</select><button class="tool" data-action="control-object" title="Объект управления: выберите параметр компонента для семейства характеристик" aria-label="Объект управления"><span class="macro-editor-icon">MK</span></button>
 <div class="component-picker"><span aria-hidden="true">${componentIcon('GND')}</span><select id="component-picker" aria-label="Выбор компонента"></select></div>

 </div>
 <div class="categories" role="tablist" aria-label="Группы элементов"></div><div class="palette" aria-label="Элементы"></div>
 <main class="workspace"><div class="center"><div class="viewport" id="schematic-page"><svg class="sheet" tabindex="0" aria-label="Редактор электрической схемы" id="sheet"><defs><pattern id="grid" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="0" cy="0" r=".6" fill="#c0c0c0"/></pattern></defs><g id="field"><rect id="gridRect" fill="url(#grid)"/><g id="drawing"></g></g></svg></div><div class="viewport" id="graph-page" hidden></div><div class="viewport" id="info-page" hidden></div><div class="bottom-navigation"><div class="document-tabs" id="document-tabs"></div><div class="tabs"><button class="tab active" data-tab="schematic">Схема</button><button class="tab" data-tab="graph">Графики</button><button class="tab" data-tab="info">Параметры и проверка</button></div></div></div><aside class="right-panel" id="properties" hidden></aside></main>
 <footer class="footer"><span class="indicator" id="indicator"></span><span id="status">Готово.</span><span id="mode-status">Режим: выбор</span><span id="counts"></span><span id="coordinates">X: 0 Y: 0</span><button data-action="run" id="run" hidden>Анализ</button><button data-action="cancel" id="cancel" hidden>Остановить</button></footer>
 <input type="file" id="file" class="file-input" accept=".tsc"><dialog class="modal" id="dialog"></dialog>`;
const sheet=$<SVGSVGElement & HTMLElement>('#sheet');
$('#wire-tool').title='Провод: два щелчка или перетаскивание; Shift+щелчок — изгиб; Enter — конец; Backspace — убрать изгиб; Esc — отмена';
function closeContextMenu(){document.querySelector('#editor-context')?.remove();}
function showContextMenu(e:MouseEvent){
 closeContextMenu();const el=e.target as Element,label=el.closest<SVGElement>('[data-label-index]'),hit=el.closest<SVGElement>('[data-index]');
 if(label)setSelection([Number(label.dataset.labelIndex)],'label');
 else if(hit&&!selectedIndices.has(Number(hit.dataset.index)))setSelection([Number(hit.dataset.index)]);
 else if(!hit)setSelection([]);
 const c=currentComponent(),has=selection().length>0,entries:([string,string,boolean]|null)[]=[
  ['Отменить режим','cancel-mode',mode!=='select'||!!drag],null,
  ['Последний компонент','last-component',true],['Автоповтор','repeat-insert',true],['Провод','wire',true],['Скрыть / Соединить','junction',true],null,
  ['Удалить','delete',has],null,
  ['Повернуть влево','rotate',!!c],['Повернуть вправо','rotate-right',!!c],['Отражение','mirror',!!c&&selectedPart!=='label'&&selection().length===1],['Свойства…','properties',!!c||doc.records[selected]?.type===262],['Редактировать схему…','edit-subcircuit',false],null,
  ['Войти в подсхему','enter-subcircuit',false]
 ];
 const menu=document.createElement('div');menu.id='editor-context';menu.className='editor-context';menu.setAttribute('role','menu');
 menu.innerHTML=entries.map(entry=>{if(!entry)return '<hr role="separator">';const [caption,act,enabled]=entry;return `<button role="${act==='repeat-insert'?'menuitemcheckbox':'menuitem'}" ${act==='repeat-insert'?`aria-checked="${repeatInsert}"`:''} data-action="${act}" ${enabled?'':'disabled'}><span class="context-check" aria-hidden="true">${act==='repeat-insert'&&repeatInsert?'✓':''}</span><span class="context-label">${caption}</span></button>`;}).join('');
 menu.onkeydown=event=>{const buttons=[...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const i=buttons.indexOf(document.activeElement as HTMLButtonElement),next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();}else if(event.key==='Escape'){event.preventDefault();event.stopPropagation();closeContextMenu();sheet.focus();}else if(event.key==='Tab')closeContextMenu();};
 document.body.append(menu);const r=menu.getBoundingClientRect();menu.style.left=Math.max(0,Math.min(e.clientX,innerWidth-r.width-4))+'px';menu.style.top=Math.max(0,Math.min(e.clientY,innerHeight-r.height-4))+'px';menu.tabIndex=-1;menu.focus({preventScroll:true});
}
document.addEventListener('pointerdown',e=>{if(!(e.target as Element).closest('#editor-context'))closeContextMenu();},true);
function status(s:string){$('#status').textContent=s;}
function tell(title:string,body:string){const d=$<HTMLDialogElement>('#dialog');d.innerHTML=`<header>${esc(title)}</header><div class="body">${body}</div><footer><button id="close-dialog">Закрыть</button></footer>`;$('#close-dialog').onclick=()=>d.close();if(!d.open)d.showModal();}
function error(e:unknown){status('Ошибка: '+(e instanceof Error?e.message:String(e)));tell('Не удалось выполнить действие',`<p>${esc(e instanceof Error?e.message:e)}</p>`);}
function project(){return {format:'tina-web-project-v1',name,tsc:base64(encode(doc)),analysis,saved:new Date().toISOString()};}
function change(){dirty=true;$('#title').textContent=name+' * — Схемный редактор';try{if(encode(doc).length<2e6)localStorage.setItem('bf240-project-v1',JSON.stringify(project()));}catch{status('Изменения есть в памяти. Сохраните схему в файл .TSC.');}draw();renderProperties();storeActive();documentTabs();}
function commitEdit(fn:()=>void){
 const before=encode(doc),control=nativeControl(doc),source=control?components(doc).find(c=>c.label===control.source):undefined,controlBytes=doc.records.find(r=>r.type===0xf287)?.data.slice();
 const dc=nativeDc(doc),dcSource=dc?components(doc).find(c=>c.label===dc.input):undefined,dcBytes=doc.records.find(r=>r.type===0xf281)?.data.slice();
 try{fn();
  const same=(type:number,old?:Uint8Array)=>{const current=doc.records.find(r=>r.type===type)?.data;return !!old&&!!current&&old.length===current.length&&old.every((b,i)=>b===current[i]);};
  if(control&&source&&same(0xf287,controlBytes)){const next=components(doc).find(c=>c.uid===source.uid);setNativeControl(doc,next?{...control,source:next.label}:null);}
  if(dc&&dcSource&&same(0xf281,dcBytes)){const next=components(doc).find(c=>c.uid===dcSource.uid);if(next&&next.label!==dc.input)setNativeDc(doc,{...dc,input:next.label});}
  const after=encode(doc);if(after.length===before.length&&after.every((b,i)=>b===before[i])){draw();return;}history.push(before);history=history.slice(-60);redoHistory=[];change();}
 catch(e){Object.assign(doc,decode(before));draw();throw e;}
}
function edit(fn:()=>void){try{commitEdit(fn);}catch(e){error(e);}}
function rotatePoint(c:Component,p:Point):Point{let [x,y]=p;for(let i=0;i<(c.orientation&3);i++)[x,y]=[y,-x];return [c.x+x,c.y+y];}
const annotationMeasure=document.createElement('canvas').getContext('2d');
function annotationLayout(t:ReturnType<typeof texts>[number]){
 const px=t.size*4/3,measure=(line:string,size:number)=>{
  if(!annotationMeasure)return line.length*size*.7;
  annotationMeasure.font=`${t.style&2?'italic ':''}${t.style&1?'bold ':''}${size}px ${JSON.stringify(t.font)}`;
  return annotationMeasure.measureText(line).width;
 };
 let top=t.y,width=0,svg='';
 for(const line of t.lines){const metrics=formulaLineSvg(line,0,0,px,measure),baseline=top+metrics.ascent;
  svg+=formulaLineSvg(line,t.x+8,baseline,px,measure).svg;width=Math.max(width,metrics.width);
  top+=Math.max(px*1.15,metrics.ascent+metrics.descent+px*.05);
 }
 return {svg,width:width+16,height:top-t.y};
}
function draw(){
 for(const button of document.querySelectorAll<HTMLButtonElement>('.toolbar button[data-action]')){const a=button.dataset.action!,state=a==='grid'?grid:['select','wire','text','junction','zoom-window','control-object'].includes(a)?mode===(a==='control-object'?'analysis-control':a):undefined;if(state!==undefined){button.classList.toggle('active',state);button.setAttribute('aria-pressed',String(state));}}
 const cc=components(doc),ww=wires(doc);let html=ww.map(w=>`<g data-index="${w.index}"><polyline class="wire ${selectedIndices.has(w.index)||selected===w.index?'selected':''}" points="${w.points.map(p=>p.join(',')).join(' ')}"/>${w.points.slice(1).map((b,i)=>`<path class="pick" data-wire-segment="${i}" d="M${w.points[i].join(',')}L${b.join(',')}"/>`).join('')}</g>`).join('');
 // Black dots denote real branches, not every component terminal.
 const pinMap=new Map(cc.map(c=>[c.index,pins(c)]));
 const branches=new Map<string,{point:Point;directions:Set<string>;components:number}>();
 const branch=(p:Point)=>{const key=p.join(',');let entry=branches.get(key);if(!entry){entry={point:p,directions:new Set(),components:0};branches.set(key,entry);}return entry;};
 for(const w of ww)for(const end of [0,w.points.length-1]){const p=w.points[end],q=w.points[end===0?1:w.points.length-2];if(q[0]!==p[0]||q[1]!==p[1])branch(p).directions.add([Math.sign(q[0]-p[0]),Math.sign(q[1]-p[1])].join(','));}
 for(const points of pinMap.values())for(const key of new Set(points.map(p=>p.join(','))))branch(points.find(p=>p.join(',')===key)!).components++;
 for(const {point:p,directions,components:count} of branches.values())if(directions.size+count>=3)html+=`<circle data-junction="${p.join(',')}" cx="${p[0]}" cy="${p[1]}" r="1.8" fill="#222"/>`;
 for(const c of showElements?cc:[]){let pp:Point[];try{pp=pinMap.get(c.index)!;}catch{continue;}const caption=(showLabels?c.label:'')+(showValues?(c.model?' '+c.model:c.value!==undefined?' '+eng(c.value):''):'');if(annotationMeasure)annotationMeasure.font='9px Arial';const label=labelGeometry(c,annotationMeasure?.measureText(caption).width??caption.length*5,11);html+=`<g data-index="${c.index}"><g class="symbol ${selectedPart!=='label'&&(selectedIndices.has(c.index)||selected===c.index)?'selected':''}" style="color:${selectedPart!=='label'&&(selectedIndices.has(c.index)||selected===c.index)?'#ff0000':c.kind==='V'?'#000000':'#008000'};--meter-glyph:${selectedPart!=='label'&&(selectedIndices.has(c.index)||selected===c.index)?'#ff0000':'#000080'}" transform="translate(${c.x} ${c.y}) rotate(${-90*(c.orientation&3)}) scale(${c.mirrored?-1:1} 1)">${symbol(c.kind,c)}${symbolHitArea(c)}</g>${pinMarkers?pp.map(p=>`<path class="pin" d="M${p[0]-1.1},${p[1]-1.1}l2.2,2.2m-2.2,0l2.2,-2.2"/>`).join(''):''}${c.label&&(showLabels||showValues)?`<text data-label-index="${c.index}" class="label ${['AM','VM','AMV'].includes(c.kind)?'meterlabel':''} ${selectedPart==='label'&&selected===c.index?'selected-label':''}" x="${label.x}" y="${label.y}" dominant-baseline="text-before-edge" transform="rotate(${label.angle} ${label.x} ${label.y})">${esc(caption)}</text>`:''}</g>`;}
 for(const t of texts(doc)){const px=t.size*4/3;html+=`<g data-index="${t.index}" class="annotation" data-export-color="${t.cssColor}" style="font-family:${esc(JSON.stringify(t.font))};font-size:${px}px;font-weight:${t.style&1?'bold':'normal'};font-style:${t.style&2?'italic':'normal'};text-decoration:${[t.style&4?'underline':'',t.style&8?'line-through':''].filter(Boolean).join(' ')};fill:${selected===t.index?'#ff0000':t.cssColor}">${annotationLayout(t).svg}</g>`;}
 if(supportedKinds.has(mode)&&placementCursor)html+=`<g class="symbol" data-editor-only="component-preview" opacity=".55" pointer-events="none" transform="translate(${placementCursor[0]} ${placementCursor[1]}) rotate(${-90*insertionRotation}) scale(${insertionMirrored?-1:1} 1)">${symbol(mode,{orientation:insertionRotation,mirrored:insertionMirrored})}</g>`;
 if(mode==='text'&&pendingText&&placementCursor){const t={...textRecord(pendingText),x:placementCursor[0],y:placementCursor[1]};html+=`<g class="annotation" data-editor-only="text-preview" opacity=".55" pointer-events="none" style="font-family:${esc(JSON.stringify(t.font))};font-size:${t.size*4/3}px;font-weight:${t.style&1?'bold':'normal'};font-style:${t.style&2?'italic':'normal'};text-decoration:${[t.style&4?'underline':'',t.style&8?'line-through':''].filter(Boolean).join(' ')};fill:${t.cssColor}">${annotationLayout(t).svg}</g>`;}
 if(mode==='select'&&selectedPart!=='label')for(const w of ww.filter(w=>selectedIndices.has(w.index)||selected===w.index))for(let i=0;i<w.points.length-1;i++){
  const a=w.points[i],b=w.points[i+1];if(a[0]!==b[0]&&a[1]!==b[1])continue;
  const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2,hit=14/zoom,size=6/zoom;
  html+=`<g class="wire-handle" data-wire-handle="segment" data-index="${w.index}" data-wire-segment="${i}" style="cursor:${a[1]===b[1]?'ns-resize':'ew-resize'}"><title>Переместить участок провода</title><rect x="${x-hit/2}" y="${y-hit/2}" width="${hit}" height="${hit}" fill="transparent"/><rect class="wire-handle-dot" x="${x-size/2}" y="${y-size/2}" width="${size}" height="${size}" pointer-events="none"/></g>`;
 }
 if(selectionBox){const a=selectionBox.start,b=selectionBox.end;html+=`<rect x="${Math.min(a[0],b[0])}" y="${Math.min(a[1],b[1])}" width="${Math.abs(b[0]-a[0])}" height="${Math.abs(b[1]-a[1])}" fill="#0000800b" stroke="#000080" stroke-width=".5" stroke-dasharray="3 2" data-editor-only="selection-box"/>`;}if(wireStart&&wireCursor&&wireCursor.toString()!==wireStart.toString()){const pp:Point[]=wireDraft?wireDraft.preview(wireCursor):[wireStart,wireCursor];html+=`<polyline data-editor-only="wire-preview" points="${pp.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#3c0000" stroke-width="1" stroke-dasharray="4 2" pointer-events="none"/>`;}if(wireDraft)for(const p of wireDraft.points.slice(1))html+=`<circle data-editor-only="wire-preview" cx="${p[0]}" cy="${p[1]}" r="2.5" fill="#800000" pointer-events="none"/>`;if(wireStart)html+=`<circle data-editor-only="wire-preview" cx="${wireStart[0]}" cy="${wireStart[1]}" r="4" fill="none" stroke="#d68d14"/>`;
 $('#drawing').innerHTML=html;const field=$('#field');field.setAttribute('transform',`translate(${offset[0]} ${offset[1]}) scale(${zoom})`);const rect=$('#gridRect');rect.setAttribute('x',String(-offset[0]/zoom));rect.setAttribute('y',String(-offset[1]/zoom));rect.setAttribute('width',String(sheet.clientWidth/zoom));rect.setAttribute('height',String(sheet.clientHeight/zoom));rect.style.display=grid?'':'none';$('#counts').textContent=`${cc.length} эл. · ${ww.length} проводов${texts(doc).length?' · '+texts(doc).length+' надп.':''}`;
 updateMenuChecks();
 const z=$<HTMLSelectElement>('#zoom');if(![...z.options].some(o=>Number(o.value)===Math.round(zoom*100))){let o=z.querySelector('[data-custom]');o?.remove();o=document.createElement('option');o.setAttribute('data-custom','');(o as HTMLOptionElement).value=String(Math.round(zoom*100));o.textContent=Math.round(zoom*100)+'%';z.append(o);}z.value=String(Math.round(zoom*100));
}
function fit(){
 if(!components(doc).length&&!wires(doc).length&&!texts(doc).length)return;
 draw();const svg=new DOMParser().parseFromString(exportSvg(),'image/svg+xml').documentElement;
 const [x,y,w,h]=svg.getAttribute('viewBox')!.split(/\s+/).map(Number);if(![x,y,w,h].every(Number.isFinite))return;
 zoom=Math.max(.001,Math.min(2.25,(sheet.clientWidth-60)/Math.max(1,w),(sheet.clientHeight-70)/Math.max(1,h)));
 offset=[sheet.clientWidth/2-(x+w/2)*zoom,sheet.clientHeight/2-(y+h/2)*zoom];draw();
}
function setZoom(z:number,at?:Point){z=Math.max(.001,Math.min(4,z));const p=at??[sheet.clientWidth/2,sheet.clientHeight/2],n=[(p[0]-offset[0])/zoom,(p[1]-offset[1])/zoom];offset=[p[0]-n[0]*z,p[1]-n[1]*z];zoom=z;draw();}
function setMode(m:string){if(supportedKinds.has(m)&&m!==mode){insertionRotation=['VS','VG'].includes(m)?3:0;insertionMirrored=false;}mode=m;sheet.dataset.mode=m;pendingText=null;wireStart=null;wireCursor=null;wireDraft=null;wireStroke=null;wireCommitTime=0;wireCommitPoint=null;placementCursor=null;if(supportedKinds.has(m))lastInsertion=m;$('#mode-status').textContent='Режим: '+(m==='select'?'выбор':m==='zoom-window'?'масштаб рамкой':m==='text'?'текст':m==='junction'?'соединение пересечения':m==='wire'?'провод: Shift — изгиб; Enter — конец; Esc — отмена':m==='wire-direct'?'прямой провод (расширение браузера)':kindNames[m]??m);$('#select-tool').classList.toggle('active',m==='select');$('#wire-tool').classList.toggle('active',m==='wire'||m==='wire-direct');for(const button of document.querySelectorAll<HTMLButtonElement>('button[data-action="text"]')){button.classList.toggle('active',m==='text');button.setAttribute('aria-pressed',String(m==='text'));}sheet.style.cursor=m==='select'?'default':'crosshair';palette();draw();}
function palette(){
 $('.categories').innerHTML=Object.keys(groups).map(g=>`<button class="category ${g===category?'active':''}" data-category="${g}" role="tab" aria-selected="${g===category}">${g}</button>`).join('');
 $('.palette').innerHTML=groups[category].map(([k,n])=>`<button class="component-button ${mode===k?'active':''}" title="${esc(n)}" aria-label="${esc(n)}" data-action="insert:${k}" ${supportedKinds.has(k)?'':'disabled'}>${mini(k)}<span>${esc(n)}</span></button>`).join('');
 const picker=$<HTMLSelectElement>('#component-picker');picker.disabled=!groups[category].some(([k])=>supportedKinds.has(k));picker.innerHTML=groups[category].map(([k,n])=>`<option value="${esc(k)}" ${supportedKinds.has(k)?'':'disabled'}>${esc(n)}</option>`).join('');
 const chosen=groups[category].find(([k])=>k===mode)?.[0]??groups[category][0][0];picker.value=chosen;picker.previousElementSibling!.innerHTML=mini(chosen);
}

function openProperties(){
 if(doc.records[selected]?.type===262){textDialog(undefined,selected);return;}
 const c=currentComponent();if(!c)return;
 showComponentProperties(doc,c.index,changes=>commitEdit(()=>{
  if((changes.x??c.x)!==c.x||(changes.y??c.y)!==c.y)moveComponent(doc,c.index,changes.x??c.x,changes.y??c.y,changes.orientation??c.orientation);updateComponent(doc,c.index,changes);
 }),mutate=>commitEdit(mutate));
}
function textDialog(position?:Point,index?:number){
 const old=index===undefined?undefined:doc.records[index];
 setMode('text');
 showTextDialog($<HTMLDialogElement>('#dialog'),old,changes=>{
  const r=old?{...old,data:Uint8Array.from(old.data)}:newText(0,0,changes.text,changes.size);
  updateText(r,changes);
  if(old){edit(()=>{doc.records[index!]=r;});setMode('select');}
  else{pendingText=r;placementCursor=position??lastCanvasCursor;draw();status('Укажите место текста щелчком. Esc — отменить.');}
 },()=>setMode('select'));
}

function currentComponent(){return components(doc).find(c=>c.index===selected);}
function renderProperties(){const p=$('#properties');p.hidden=!showProps;if(!showProps)return;const c=currentComponent();if(!c){p.innerHTML='<h3>Свойства элемента</h3><p class="empty">Выберите элемент на схеме.<br>Двойной щелчок открывает свойства.</p>';return;}
 const field=(label:string,key:string,value:string,full=false)=>`<label class="${full?'full':''}">${label}<input name="${key}" value="${esc(value)}" autocomplete="off"></label>`;
 p.innerHTML=`<h3>${esc(kindNames[c.kind]??c.kind)}${c.model?' · '+esc(c.model):''}</h3><form id="props-form"><div class="props-grid">${c.kind==='GND'?'':field('Обозначение','label',c.label,true)}${c.value===undefined?'':field('Номинал, в единицах СИ','value',String(c.value),true)}${field('Координата X','x',String(c.x))}${field('Координата Y','y',String(c.y))}<label class="full">Поворот<select name="orientation">${[0,1,2,3].map(r=>`<option value="${r}" ${r===c.orientation?'selected':''} >${r*90}°</option>`).join('')}</select></label>${c.kind==='GND'?'':field('Подпись X','label_dx',String(c.label_dx))+field('Подпись Y','label_dy',String(c.label_dy))}</div><button class="full-button" type="submit">Применить</button><button class="full-button" type="button" data-action="delete">Удалить элемент</button></form><div class="small-note">Можно вводить номиналы: 1к, 10мк, 100н.<br>Смещения подписи задаются относительно элемента до поворота.</div>`;
 $('#props-form').onsubmit=e=>{e.preventDefault();const fields=Object.fromEntries([...new FormData(e.target as HTMLFormElement)].map(([k,v])=>[k,String(v)]));if(c.model)fields.model=c.model;edit(()=>{const changes=componentPropertyChanges(c,fields);if(c.kind!=='CONNECTOR'&&changes.label!==undefined&&components(doc).some(o=>o.index!==c.index&&o.label===changes.label))throw Error('Укажите уникальное обозначение');if((changes.x??c.x)!==c.x||(changes.y??c.y)!==c.y)moveComponent(doc,c.index,changes.x??c.x,changes.y??c.y,changes.orientation??c.orientation);updateComponent(doc,c.index,changes);});};
}
function switchTab(tab:string){currentTab=tab;document.querySelectorAll<HTMLElement>('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));for(const t of ['schematic','graph','info'])$('#'+t+'-page').hidden=t!==tab;if(tab==='graph')renderGraph();if(tab==='schematic')draw();}
function resetCalculationViews(){
 $('#info-page').innerHTML='<div class="info-page"><h2>Параметры и проверка</h2><p>Для этой схемы ещё не выполнены расчёты. Выберите «Анализ» или «Инструменты → Проверить схему».</p></div>';
 $('#graph-page').innerHTML='';
}
function validate(){const cc=components(doc);let text='';try{if(encode(decode(encode(doc))).toString()!==encode(doc).toString())throw Error('Не совпали байты файла');const issues=checkCircuit(doc);const n=issues.some(i=>i.severity==='error')?[]:connectivity(doc);text=issues.map(i=>`<p><strong>${i.severity==='error'?'Ошибка':'Предупреждение'}:</strong> ${esc(i.message)}</p>`).join('')+(issues.length?'':'<p>Замечаний по правилам соединения нет.</p>');text+=`<p>Структура файла и электрические соединения проверены. Распознано ${cc.length} элементов.</p><table><tr><th>Элемент</th><th>Тип</th><th>Узлы по порядку выводов</th></tr>${n.map(r=>`<tr><td>${esc(r.component.label||'Земля')}</td><td>${r.component.kind}</td><td>${r.nodes.join(', ')}</td></tr>`).join('')}</table>`;for(const c of cc)if(c.kind==='NPN'||c.kind==='PNP'){const m=modelParameters(c);text+=`<p>${esc(c.model)}: BF = ${m.BF}, VAF = ${m.VAF} В, IS = ${m.IS} А.</p>`;}}catch(e){text=`<p>${esc(e instanceof Error?e.message:e)}</p>`;}$('#info-page').innerHTML=`<div class="info-page"><h2>Проверка схемы</h2>${text}<p>Нумерация узлов — внутренняя нумерация редактора. Порядок выводов транзистора: коллектор, база, эмиттер.</p><button class="full-button" style="max-width:250px" data-action="spice">Сохранить схему SPICE</button></div>`;switchTab('info');}
function showLimits(){tell('Совместимость',`<p>Чтение и обратная запись проверены на 1482 файлах TINA: все байты сохраняются. Это не означает поддержку всех элементов.</p><p>Создаются R, C, L, источники, измерители, общий узел, NPN/PNP и диод 1N4148. Импортируется проверенный вариант LM741 с пробником. Неизвестные записи сохраняются; неподдерживаемые модели и варианты символов явно отклоняются при расчёте.</p><p>Файлы схем сохраняются в формате TINA .TSC. Новые параметры расчёта действуют в текущем сеансе; их запись в native настройки анализа пока не перенесена.</p><p>Расчёты выполняет ngspice в браузере. Это независимый движок. Отдельные схемы сверены с оригиналом; полное совпадение всех режимов не доказано.</p><p>Библиотека содержит локальные шаблоны установленной TINA. Этот сайт предназначен для личной работы пользователя.</p>`);}
function openPreset(key:string){const spec=allPresets[key as keyof typeof allPresets];if(spec)addDocument(build(spec),spec.name??'Пример',(spec.analysis??{kind:'op'}) as SimulationConfig);}

function action(a:string){closeContextMenu();if(drag){Object.assign(doc,decode(drag.snapshot));drag=null;}selectionBox=null;try{
 if(a.startsWith('insert:')){if(supportedKinds.has(a.slice(7)))setMode(a.slice(7));return;}if(a.startsWith('preset:')){openPreset(a.slice(7));return;}if(a.startsWith('analysis:')){analysisDialog(a.slice(9));return;}
 if(a==='new'){addDocument(blank(),'Схема'+nextDocument,{kind:'op'});}
 else if(a==='open')$<HTMLInputElement>('#file').click();
 else if(a==='save'){download(name+'.TSC',encode(doc).slice().buffer);dirty=false;storeActive();documentTabs();$('#title').textContent=name+' — Схемный редактор';status('Файл .TSC передан в загрузки браузера.');}
 else if(a==='save-as')saveDocumentAs();
 else if(a==='save-all')saveAllDocuments();
 else if(a==='close')closeDocument(activeDocument);
 else if(a==='close-all')closeAllDocuments();
 else if(a==='checkpoint'){download(name+'_этап_'+new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')+'.TSC',encode(doc).slice().buffer);status('Этап схемы сохранён в формате TINA .TSC.');}
 else if(a==='spice'){const x=exportSpice(doc);download(name+'.cir',x.text,'text/plain');}
 else if(a==='undo'){if(history.length){redoHistory.push(encode(doc));doc=decode(history.pop()!);selectedPart='object';selected=-1;selectedIndices.clear();change();}}
 else if(a==='redo'){if(redoHistory.length){history.push(encode(doc));doc=decode(redoHistory.pop()!);selectedPart='object';selected=-1;selectedIndices.clear();change();}}
 else if(a==='copy'||a==='cut'){const indices=selection();if(indices.length){clipboard=copySelection(doc,indices);pasteCount=0;status('Скопировано объектов: '+indices.length);if(a==='cut')edit(()=>{deleteSelection(doc,indices);selected=-1;selectedIndices.clear();});}}
 else if(a==='paste'){if(clipboard){edit(()=>{pasteCount++;const indices=pasteSelection(doc,clipboard!,16*pasteCount,16*pasteCount);selectedPart='object';selectedIndices=new Set(indices);selected=indices.at(-1)??-1;});}}
 else if(a==='select-all'){setSelection(selectAll(doc));}
 else if(a==='text'){switchTab('schematic');textDialog();}
 else if(a==='select'||a==='wire'||a==='wire-direct'||a==='junction'){setMode(a);switchTab('schematic');if(a==='junction')status('Щёлкните пересечение двух проводов: поставить или убрать соединение.');}
 else if(a==='rotate'||a==='rotate-right'){if(supportedKinds.has(mode)){insertionRotation=(insertionRotation+(a==='rotate-right'?3:1))%4;draw();return;}if(mode!=='select')return;if(selectedPart!=='label'&&selection().length>1){rotateGroup(a==='rotate-right'?-1:1);return;}const c=currentComponent();if(c)edit(()=>{if(selectedPart==='label')rotateLabel(doc,c.index);else updateComponent(doc,c.index,{orientation:(c.orientation+(a==='rotate-right'?3:1))%4});});}
 else if(a==='mirror'){if(supportedKinds.has(mode)){insertionMirrored=!insertionMirrored;draw();return;}const c=currentComponent();if(c&&selectedPart!=='label'&&selection().length===1)edit(()=>updateComponent(doc,c.index,{mirrored:!c.mirrored}));}
 else if(a==='delete'&&selection().length){edit(()=>{deleteSelection(doc,selection());selected=-1;selectedIndices.clear();});}
 else if(a==='properties'){openProperties();}
 else if(a==='panel'){showProps=!showProps;renderProperties();updateMenuChecks();}
 else if(a==='last-component')setMode(lastInsertion);
 else if(a==='repeat-insert'){repeatInsert=!repeatInsert;updateMenuChecks();}
 else if(a==='zoom-window'){setMode('zoom-window');switchTab('schematic');}
 else if(a==='cancel-mode'){selectionBox=null;setMode('select');}
 else if(a==='normal'||a==='refresh'){draw();}
 else if(a==='zoom-normal')setZoom(1);else if(a==='zoom-in')setZoom(zoom*1.25);else if(a==='zoom-out')setZoom(zoom/1.25);
 else if(a==='values'||a==='labels'||a==='elements'){if(a==='values')showValues=!showValues;if(a==='labels')showLabels=!showLabels;if(a==='elements')showElements=!showElements;draw();}
 else if(a==='toolbar'||a==='palette'){if(a==='toolbar'){showToolbar=!showToolbar;$('.toolbar').hidden=!showToolbar;}else{showPalette=!showPalette;$('.palette').hidden=!showPalette;$('.categories').hidden=!showPalette;}updateMenuChecks();}
 else if(a==='graph'){switchTab('graph');}
 else if(a==='scope'){if(result&&lastConfig?.kind==='transient')showScope($<HTMLDialogElement>('#dialog'),result.curves[cursorCurve]??result.curves[0]);else tell('Осциллограф','<p>Сначала выполните расчёт переходного процесса.</p>');}
 else if(a==='grid'){grid=!grid;draw();}else if(a==='pins'){pinMarkers=!pinMarkers;draw();}else if(a==='fit')fit();else if(a==='validate')validate();
 else if(a==='control-object'){switchTab('schematic');setMode('analysis-control');status('Выберите компонент, параметр которого будет изменяться.');}
 else if(a==='run')analysisDialog(analysis.kind);else if(a==='cancel')abort?.abort();else if(a==='limits')showLimits();
 else if(a==='page-settings'){showPageSettings($<HTMLDialogElement>('#dialog'),printPage,next=>{printPage=next;try{localStorage.setItem('tina-print-preferences-v1',JSON.stringify(next));}catch{status('Параметры печати действуют до закрытия страницы.');}});}
 else if(a==='print-preview'||a==='page-layout'){printPreview();}
 else if(a==='print'){void printSchematic(exportSvg(),name,printPage).catch(error);}

 else if(a==='help')tell('Работа со схемой','<p>Выберите группу и элемент сверху, затем щёлкните на рабочем поле. Провод строится двумя щелчками или перетаскиванием с привязкой к сетке. Для маршрута с несколькими изгибами удерживайте Shift при щелчках в промежуточных точках; обычный щелчок, двойной щелчок или Enter завершает провод. Backspace убирает последний изгиб, пробел меняет направление текущего колена, Esc отменяет весь незавершённый провод.</p><p>Элемент и его подпись выбираются отдельно. R или Ctrl+L/Ctrl+R поворачивает выбранное. Подпись можно перетащить мышью. У выбранного провода чёрные ручки двигают один участок, сохраняя остальные изгибы. Ctrl/Shift добавляет объекты к выделению, рамка выбирает группу. Delete удаляет выбранное; Escape отменяет текущий жест. Колесо меняет масштаб, средняя кнопка перемещает поле.</p><p>Меню «Анализ» запускает расчёты. После расчёта доступны графики, курсоры A/B и таблица всех численных результатов на экране.</p><p>Правый щелчок открывает команды редактора. Ctrl+Space — провод, Ctrl+Insert — последний компонент. В меню «Вид» доступен масштаб рамкой; Ctrl+P открывает просмотр печати. Печать включает схему без маркеров выделения.</p><p>Последний проект автоматически сохраняется в этом браузере. Для работы в оригинальной TINA или переноса на другой компьютер сохраните схему в .TSC.</p>');
 }catch(e){error(e);}}
document.addEventListener('click',e=>{const t=e.target as Element;const close=t.closest<HTMLElement>('[data-close-document]');if(close){closeDocument(Number(close.dataset.closeDocument));return;}const docTab=t.closest<HTMLElement>('[data-document]');if(docTab){switchDocument(Number(docTab.dataset.document));return;}const b=t.closest<HTMLElement>('[data-action]');if(b&&!b.matches(':disabled')){document.querySelectorAll<HTMLDetailsElement>('.menu details').forEach(d=>d.open=false);action(b.dataset.action!);}const c=t.closest<HTMLElement>('[data-category]');if(c){category=c.dataset.category!;palette();}const tab=t.closest<HTMLElement>('[data-tab]');if(tab)switchTab(tab.dataset.tab!);if(!t.closest('.menu'))document.querySelectorAll<HTMLDetailsElement>('.menu details').forEach(d=>d.open=false);});
initializeMenuIntent($('.menu'));
initializeToolHelp();
document.querySelectorAll<HTMLDetailsElement>('.menu details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll<HTMLDetailsElement>('.menu details').forEach(o=>{if(o!==d)o.open=false;});}));
$<HTMLSelectElement>('#zoom').onchange=e=>setZoom(Number((e.target as HTMLSelectElement).value)/100);
$<HTMLSelectElement>('#component-picker').onchange=e=>action('insert:'+(e.target as HTMLSelectElement).value);
sheet.addEventListener('pointermove',e=>{const [x,y]=native(e);$('#coordinates').textContent=`X: ${x} Y: ${y}`;});
function native(e:PointerEvent|MouseEvent):Point{const b=sheet.getBoundingClientRect();return [Math.round((e.clientX-b.left-offset[0])/zoom/8)*8,Math.round((e.clientY-b.top-offset[1])/zoom/8)*8];}
sheet.addEventListener('pointermove',e=>{lastCanvasCursor=native(e);if(mode==='text'&&pendingText){placementCursor=lastCanvasCursor;draw();}});
function finishWireDraft(end?:Point){
 if(!wireDraft)return;let points:Point[];
 try{points=wireDraft.finish(end);}catch(e){status(e instanceof Error?e.message:String(e));return;}
 let committed=false;edit(()=>{addConnectedWire(doc,points);committed=true;});
 if(committed){wireCommitPoint=points.at(-1)!;wireCommitTime=performance.now();wireDraft=null;wireStroke=null;wireStart=null;wireCursor=null;draw();status('Провод добавлен. Укажите начало следующего провода или нажмите Esc.');}
}
function wireDraftKey(e:KeyboardEvent):boolean {
 if(e.key==='Enter'){e.preventDefault();finishWireDraft(wireCursor??undefined);return true;}
 if(e.key==='Backspace'||((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'&&!e.shiftKey)){
  e.preventDefault();wireStroke=null;if(wireDraft!.back()){wireCursor=wireDraft!.points.at(-1)!;}else{wireDraft=null;wireStart=null;wireCursor=null;}draw();return true;
 }
 if(e.code==='Space'&&!e.ctrlKey&&!e.metaKey){e.preventDefault();wireDraft!.toggleElbow();draw();return true;}return false;
}
sheet.onpointerdown=e=>{if(e.button===1){pan={x:e.clientX,y:e.clientY,offset:[...offset]};sheet.setPointerCapture(e.pointerId);e.preventDefault();return;}if(e.button!==0)return;if(abort){status('Сначала завершите или остановите расчёт.');return;}sheet.focus();const p=native(e);
 if(mode==='zoom-window'){selectionBox={start:p,end:p};sheet.setPointerCapture(e.pointerId);return;}
 if(mode==='analysis-control'){const hit=(e.target as Element).closest<SVGElement>('[data-index]'),c=hit?components(doc).find(c=>c.index===Number(hit.dataset.index)):undefined;if(c){setMode('select');showControlProperty(freshAnalysisDialog(),doc,c.index,next=>commitEdit(()=>setNativeControl(doc,next)));}return;}
 if(mode==='junction'){edit(()=>{toggleWireJunction(doc,p);selected=-1;selectedIndices.clear();});return;}
 if(mode==='text'){if(pendingText){const r={...pendingText,data:Uint8Array.from(pendingText.data)};updateText(r,{x:p[0],y:p[1]});edit(()=>insert(r));setMode('select');}return;}
 if(mode==='wire'){if(!wireDraft&&wireCommitPoint&&wireCommitPoint.toString()===p.toString()&&performance.now()-wireCommitTime<500)return;try{wireCursor=p;if(!wireDraft){wireDraft=new WireDraft(p);wireStart=p;wireStroke={origin:p,moved:false,finishes:false};sheet.setPointerCapture(e.pointerId);status('Укажите конец; Shift+щелчок — изгиб, Enter — завершить, Backspace — убрать изгиб, Esc — отменить.');}else if(e.shiftKey){wireDraft.add(p);status('Изгиб закреплён. Щелчок или Enter — завершить, Backspace — убрать изгиб, Esc — отменить.');}else{wireStroke={origin:p,moved:false,finishes:true};sheet.setPointerCapture(e.pointerId);}draw();}catch(e){error(e);}return;}
 if(mode==='wire-direct'){if(!wireStart){wireStart=p;draw();status('Укажите второй конец провода.');}else if(p.toString()!==wireStart.toString()){edit(()=>{const points:Point[]=[wireStart!];if(mode==='wire'&&p[0]!==wireStart![0]&&p[1]!==wireStart![1])points.push([p[0],wireStart![1]]);points.push(p);addConnectedWire(doc,points);wireStart=null;});}return;}
 if(mode!=='select'){edit(()=>{const prefix=['NPN','PNP'].includes(mode)?'T':mode==='ZENER'?'Z':mode==='SCHOTTKY'?'SD':mode==='AMV'?'AM':mode==='I'?'IS':mode==='V'?'VS':mode;let n=1;const labels=components(doc).map(c=>c.label);while(labels.includes(prefix+n))n++;const r=newComponent(mode,p[0],p[1],prefix+n);updateComponent({records:[r],trailer:new Uint8Array()},0,{orientation:insertionRotation,mirrored:insertionMirrored});insert(r);});if(!repeatInsert)setMode('select');return;}
 const labelTarget=(e.target as Element).closest<SVGElement>('[data-label-index]');if(labelTarget){const index=Number(labelTarget.dataset.labelIndex);setSelection([index],'label');drag={origin:p,snapshot:encode(doc),index,label:true};sheet.setPointerCapture(e.pointerId);return;}
 const handleTarget=(e.target as Element).closest<SVGElement>('[data-wire-handle]');if(handleTarget){const index=Number(handleTarget.dataset.index),segment=Number(handleTarget.dataset.wireSegment);setSelection([index]);drag={origin:p,snapshot:encode(doc),index,segment};sheet.setPointerCapture(e.pointerId);e.preventDefault();return;}
 const target=(e.target as Element).closest<SVGElement>('[data-index]'),index=target?Number(target.dataset.index):-1;
 if(e.shiftKey||e.ctrlKey){if(index>=0){const next=new Set(selectedIndices);if(next.has(index))next.delete(index);else next.add(index);setSelection([...next]);}return;}
 if(index<0){setSelection([]);selectionBox={start:p,end:p};sheet.setPointerCapture(e.pointerId);return;}
 if(!selectedIndices.has(index)||selectedPart==='label')setSelection([index]);else selected=index;
 drag={origin:p,snapshot:encode(doc),index};sheet.setPointerCapture(e.pointerId);

};
function insert(r:Rec){let i=doc.records.findIndex(r=>r.type>=0xf000);if(i<0)i=doc.records.length-1;doc.records.splice(i,0,r);selectedPart='object';selected=i;selectedIndices=new Set([i]);}
sheet.onpointermove=e=>{if(supportedKinds.has(mode)){placementCursor=native(e);draw();return;}if((mode==='wire'||mode==='wire-direct')&&wireStart){wireCursor=native(e);if(mode==='wire'&&wireDraft&&wireStroke&&(e.buttons&1)){if(wireCursor.toString()!==wireStroke.origin.toString())wireStroke.moved=true;try{if(wireStroke.moved)wireDraft.trace(wireCursor);}catch(e){status(e instanceof Error?e.message:String(e));}}draw();return;}if(pan){offset=[pan.offset[0]+e.clientX-pan.x,pan.offset[1]+e.clientY-pan.y];draw();return;}if(selectionBox){selectionBox.end=native(e);draw();return;}if(drag){const p=native(e);try{doc=decode(drag.snapshot);if(drag.label)translateLabel(doc,drag.index,p[0]-drag.origin[0],p[1]-drag.origin[1]);else if(drag.segment!==undefined)dragWireSegment(doc,drag.index,drag.segment,p[0]-drag.origin[0],p[1]-drag.origin[1]);else if(selectedIndices.size===1&&doc.records[drag.index]?.type===256)moveWireObject(doc,drag.index,p[0]-drag.origin[0],p[1]-drag.origin[1]);else if(selectedIndices.size>1||[256,262].includes(doc.records[drag.index]?.type))translateSelection(doc,selection(),p[0]-drag.origin[0],p[1]-drag.origin[1]);else{const c=components(doc).find(c=>c.index===drag!.index)!;moveComponent(doc,c.index,c.x+p[0]-drag.origin[0],c.y+p[1]-drag.origin[1]);}draw();}catch{doc=decode(drag.snapshot);drag=null;}}};
sheet.onpointerup=e=>{if(mode==='wire'&&wireStroke){const stroke=wireStroke;wireStroke=null;if(stroke.moved||stroke.finishes)finishWireDraft(native(e));if(sheet.hasPointerCapture(e.pointerId))sheet.releasePointerCapture(e.pointerId);return;}pan=null;if(selectionBox){const a=selectionBox.start,b=selectionBox.end;if(mode==='zoom-window'){const w=Math.abs(b[0]-a[0]),h=Math.abs(b[1]-a[1]);selectionBox=null;if(w>=8&&h>=8){zoom=Math.max(.001,Math.min(4,(sheet.clientWidth-24)/w,(sheet.clientHeight-24)/h));offset=[sheet.clientWidth/2-(a[0]+b[0])*zoom/2,sheet.clientHeight/2-(a[1]+b[1])*zoom/2];}setMode('select');if(sheet.hasPointerCapture(e.pointerId))sheet.releasePointerCapture(e.pointerId);return;}const inside=(p:Point)=>p[0]>=Math.min(a[0],b[0])&&p[0]<=Math.max(a[0],b[0])&&p[1]>=Math.min(a[1],b[1])&&p[1]<=Math.max(a[1],b[1]);const indices=components(doc).filter(c=>inside([c.x,c.y])).map(c=>c.index);indices.push(...texts(doc).filter(t=>inside([t.x,t.y])).map(t=>t.index));indices.push(...wires(doc).filter(w=>w.points.every(inside)).map(w=>w.index));selectionBox=null;setSelection(indices);}if(drag){if(encode(doc).toString()!==drag.snapshot.toString()){history.push(drag.snapshot);history=history.slice(-60);redoHistory=[];change();}drag=null;}if(sheet.hasPointerCapture(e.pointerId))sheet.releasePointerCapture(e.pointerId);};
sheet.onpointercancel=()=>{wireDraft=null;wireStroke=null;wireStart=null;wireCursor=null;if(drag)doc=decode(drag.snapshot);drag=null;pan=null;selectionBox=null;draw();};sheet.oncontextmenu=e=>{e.preventDefault();showContextMenu(e);};
sheet.ondblclick=()=>{if(mode==='wire'){if(wireDraft&&wireDraft.points.length===1&&wireCommitPoint&&wireDraft.points[0].toString()===wireCommitPoint.toString()&&performance.now()-wireCommitTime<600){wireDraft=null;wireStroke=null;wireStart=null;wireCursor=null;draw();}else finishWireDraft();return;}drag=null;openProperties();};sheet.addEventListener('wheel',e=>{e.preventDefault();const b=sheet.getBoundingClientRect();setZoom(zoom*(e.deltaY<0?1.12:1/1.12),[e.clientX-b.left,e.clientY-b.top]);},{passive:false});
document.addEventListener('keydown',e=>{if((e.target as HTMLElement).matches('input,select,textarea')||document.querySelector('dialog[open]'))return;if(mode==='wire'&&wireDraft&&wireDraftKey(e))return;if(e.ctrlKey&&e.code==='F4'){e.preventDefault();action('close');return;}if(e.ctrlKey&&e.shiftKey&&e.code==='KeyS'){e.preventDefault();action('save-as');return;}if(e.ctrlKey&&e.code==='KeyP'){e.preventDefault();action('print-preview');return;}if(e.ctrlKey&&e.code==='Space'){e.preventDefault();action('wire');return;}if(e.ctrlKey&&e.key==='Insert'){e.preventDefault();action('last-component');return;}if(e.ctrlKey&&(e.code==='KeyR'||e.code==='KeyL')){e.preventDefault();action(e.code==='KeyR'?'rotate-right':'rotate');return;}const shortcuts:Record<string,string>={t:'text',s:'save',o:'open',z:e.shiftKey?'redo':'undo',y:'redo',n:'new',c:'copy',x:'cut',v:'paste',a:'select-all'};const key=/^Key[A-Z]$/.test(e.code)?e.code.slice(3).toLowerCase():e.key.toLowerCase();if((e.ctrlKey||e.metaKey)&&shortcuts[key]){e.preventDefault();if(drag)doc=decode(drag.snapshot);drag=null;selectionBox=null;wireStart=null;wireDraft=null;wireStroke=null;wireCursor=null;action(shortcuts[key]);}else if(e.key==='Escape'){closeContextMenu();document.querySelectorAll<HTMLDetailsElement>('.menu details').forEach(d=>d.open=false);if(drag)doc=decode(drag.snapshot);drag=null;pan=null;selectionBox=null;wireStart=null;setMode('select');draw();}else if(e.key==='F5'){e.preventDefault();action('refresh');}else if(e.code==='KeyR'||e.key.toLowerCase()==='r')action('rotate');else if(e.key==='Delete')action('delete');});
$<HTMLInputElement>('#file').onchange=async e=>{const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;try{if(file.size>128*1024*1024)throw Error('Файл слишком большой');if(!file.name.toLowerCase().endsWith('.tsc'))throw Error('Выберите файл схемы TINA с расширением .TSC');const loaded=decode(new Uint8Array(await file.arrayBuffer()));addDocument(loaded,file.name.replace(/\.[^.]+$/,''),{kind:'op'});status('Файл TINA .TSC открыт. Неизвестные записи сохраняются без изменения.');}catch(e){error(e);}finally{(e.target as HTMLInputElement).value='';}};
function exportSvg(){return buildCleanSchematicSvg(sheet,document.querySelector<SVGGElement>('#drawing')!,{title:name});}
function printPreview(){
 const svg=exportSvg(),d=$<HTMLDialogElement>('#dialog');d.innerHTML=`<header>Предварительный просмотр · ${esc(name)}</header><div class="body schematic-print-preview">${pagePreviewMarkup(svg,name,printPage)}</div><footer><button id="print-schematic">Печать…</button><button id="close-dialog">Закрыть</button></footer>`;
 $('#close-dialog').onclick=()=>d.close();$('#print-schematic').onclick=()=>{void printSchematic(svg,name,printPage).catch(error);};d.showModal();
}

function analysisDialog(kind:string){
 if(abort){status('Дождитесь завершения расчёта или остановите его.');return;}
 if(kind==='h'){hDialog();return;}
 if(kind==='ac'){const initial=nativeAc(doc)??{start:1,stop:1e8,intervals:400,logarithmic:true};showAcTransferDialog(freshAnalysisDialog(),{...initial,display:'both'},next=>{const input=components(doc).find(c=>c.kind==='VG')?.label??components(doc).find(c=>['V','VS','I','IS'].includes(c.kind))?.label;if(!input)throw Error('В схеме нет источника');commitEdit(()=>setNativeAc(doc,next));const config:SimulationConfig={kind:'ac',input,start:next.start,stop:next.stop,ac_intervals:next.intervals,ac_logarithmic:next.logarithmic,ac_display:next.display};plotMode=next.display==='phase'?'phase':'db';analysis=config;void runAnalysis(config);});return;}
 if(kind==='transient'&&nativeTransient(doc)){const generators=components(doc).filter(c=>c.kind==='VG'),signals=generators.map(nativeGenerator);if(generators.length&&signals.every(Boolean)){showTransientDialog(freshAnalysisDialog(),nativeTransient(doc)!,next=>{const frequency=Math.max(...signals.map(s=>s!.frequency)),step=Math.max(next.stop/100000,Math.min(next.stop/1000,1/frequency/100));commitEdit(()=>setNativeTransient(doc,next));const config:SimulationConfig={kind:'transient',waveform:'native',startup:'op',start:next.start,stop:next.stop,step};analysis=config;void runAnalysis(config);});return;}}
 if(kind==='dc'){showDcTransferDialog(freshAnalysisDialog(),doc,next=>{const control=nativeControl(doc);if(control?.source===next.input)throw Error('Источник развёртки и объект управления должны различаться');commitEdit(()=>setNativeDc(doc,next));const config:SimulationConfig={kind:control?'dc-family':'dc',input:next.input,start:next.start,stop:next.stop,points:next.intervals+1,...(control?{step_source:control.source,step_values:nativeControlValues(control)}:{})};analysis=config;void runAnalysis(config);});return;}
 const sources=components(doc).filter(c=>['V','VS','VG','I','IS'].includes(c.kind)),sameKind=analysis.kind===kind,current={...(sameKind?analysis:{}),kind} as SimulationConfig;
 const titles:Record<string,string>={op:'Рабочая точка',dc:'Характеристика постоянного тока','dc-family':'Семейство характеристик',ac:'Частотная характеристика',transient:'Переходный процесс'};
 const input=current.input??sources.find(c=>c.label==='Vin')?.label??sources.find(c=>['V','VS','VG'].includes(c.kind))?.label??sources[0]?.label;
 const isCurrent=['I','IS'].includes(sources.find(c=>c.label===input)?.kind??'');
 const dcStop=isCurrent?'100мк':input==='VS1'&&components(doc).some(c=>c.label==='VS2')?.9:40;
 const select=(label:string,key:string,value?:string)=>`<label class="full">${label}<select name="${key}">${sources.map(c=>`<option ${c.label===value?'selected':''}>${esc(c.label)}</option>`).join('')}</select></label>`;
 const field=(label:string,key:string,value:unknown)=>`<label>${label}<input name="${key}" value="${esc(value)}" required></label>`;
 let body=kind==='op'?'<p>Будут рассчитаны напряжения узлов и токи при заданных постоянных источниках.</p>':select('Изменяемый источник','input',input);
 if(kind==='dc'||kind==='dc-family')body+=field('Начало, СИ','start',current.start??0)+field('Конец, СИ','stop',current.stop??dcStop)+field('Количество точек','points',current.points??500);
 if(kind==='dc-family')body+=select('Источник параметра семейства','step_source',current.step_source??sources.find(c=>c.label!==input)?.label)+`<label class="full">Значения параметра, СИ (через ;)<input name="step_values" value="${esc((current.step_values??[1e-5,2e-5,3e-5,4e-5,5e-5]).map(eng).join('; '))}" required></label>`;
 if(kind==='ac')body+=field('Начальная частота, Гц','start',current.start??10)+field('Конечная частота, Гц','stop',current.stop??1e7)+field('Точек на декаду','points_per_decade',current.points_per_decade??50);
 if(kind==='transient')body+=`<label class="full">Форма сигнала<select name="waveform">${[['native','Из генераторов TSC (синус / прямоугольный)'],['sine','Синус'],['pulse','Прямоугольный'],['triangle','Треугольный']].map(([value,label])=>`<option value="${value}" ${(current.waveform??(sources.some(c=>nativeGenerator(c))?'native':'sine'))===value?'selected':''}>${label}</option>`).join('')}</select></label>`+field('Амплитуда источника, СИ','amplitude',current.amplitude??(input==='Vin'?.0024:isCurrent?1e-6:.01))+field('Частота, Гц','frequency',current.frequency??1000)+field('Время, с','stop',current.stop??.005)+field('Шаг, с','step',current.step??1e-6)+field('Смещение, СИ (пусто: DC источника)','offset',current.offset??'')+field('Задержка, с','delay',current.delay??0)+field('Заполнение импульса, %','duty',current.duty??50)+field('Фронт импульса, с (пусто: 0,1% периода)','rise',current.rise??'')+field('Спад импульса, с (пусто: 0,1% периода)','fall',current.fall??'')+`<p id="waveform-help" class="full small-note">Амплитуда — отклонение от смещения: импульс и треугольник меняются от U₀ − A до U₀ + A. Фронт и спад прямоугольника: 0,1% периода.</p>`;
 if(kind==='transient')body+=`<label class="full">Начальное состояние<select name="startup"><option value="op" ${current.startup!=='uic'?'selected':''}>Рабочая точка</option><option value="uic" ${current.startup==='uic'?'selected':''}>Заданные условия (UIC)</option></select></label><label class="full">Условия C/L (C1=1; L1=0, В / А)<input name="initial_conditions" value="${esc(Object.entries(current.initial_conditions??{}).map(([k,v])=>k+'='+v).join('; '))}"></label><p class="full small-note">Полярность C и направление тока L следуют порядку выводов SPICE. UIC пропускает расчёт рабочей точки. Эти настройки действуют в текущем сеансе; их запись в TSC пока не перенесена.</p>`;
 const d=$<HTMLDialogElement>('#dialog');d.innerHTML=`<form id="analysis-form"><header>${titles[kind]}</header><div class="body"><div class="form">${body}</div><div class="error" id="analysis-error"></div><p class="small-note">ngspice / WebAssembly. Расчёт выполняется в браузере без установленной TINA.</p></div><footer><button type="button" id="analysis-cancel">Отмена</button><button class="primary" type="submit">Рассчитать</button></footer></form>`;
 const waveformSelect=d.querySelector<HTMLSelectElement>('[name=waveform]');
 const updateWaveformFields=()=>{
  const imported=waveformSelect?.value==='native';
  for(const key of ['amplitude','frequency','offset','delay','duty','rise','fall','input']){const input=d.querySelector<HTMLInputElement|HTMLSelectElement>(`[name=${key}]`);if(input){input.disabled=imported;input.closest('label')!.hidden=imported;}}
  const help=d.querySelector<HTMLElement>('#waveform-help');if(help)help.textContent=imported?'Сигналы всех генераторов берутся из схемы. Поддерживаются синус и прямоугольная волна с учётом внутреннего сопротивления.':'Амплитуда — отклонение от смещения: импульс и треугольник меняются от U₀ − A до U₀ + A. Фронт и спад прямоугольника по умолчанию: 0,1% периода.';
 };

 if(waveformSelect){waveformSelect.onchange=updateWaveformFields;updateWaveformFields();}
 d.querySelectorAll<HTMLInputElement>('[name=offset],[name=rise],[name=fall]').forEach(input=>input.removeAttribute('required'));$('#analysis-cancel').onclick=()=>d.close();$('#analysis-form').onsubmit=e=>{e.preventDefault();try{const f=new FormData(e.target as HTMLFormElement),config:SimulationConfig={kind:kind as SimulationConfig['kind']};for(const [k,v] of f){if(['input','step_source','waveform','startup'].includes(k))(config as any)[k]=String(v);else if(['offset','rise','fall'].includes(k)&&!String(v).trim())continue;else if(k==='initial_conditions'){const entries=String(v).split(';').map(s=>s.trim()).filter(Boolean).map(s=>{const m=s.match(/^([^=]+)=(.+)$/);if(!m)throw Error('Формат: C1=1; L1=0');return [m[1].trim(),number(m[2])] as [string,number];});if(new Set(entries.map(e=>e[0])).size!==entries.length)throw Error('Повтор элемента');config.initial_conditions=Object.fromEntries(entries);}else if(k==='step_values')config.step_values=String(v).split(/[;\n]+/).map(number);else(config as any)[k]=number(String(v));}if(kind==='dc-family'&&config.input===config.step_source)throw Error('Для семейства выберите два разных источника');analysis=config;d.close();void runAnalysis(config);}catch(e){$('#analysis-error').textContent=e instanceof Error?e.message:String(e);}};d.showModal();
}
function busy(on:boolean){$('#run').hidden=on;$('#cancel').hidden=!on;$('#indicator').classList.toggle('busy',on);}
async function runAnalysis(config:SimulationConfig){bjtGraphScene=null;abort=new AbortController();busy(true);status('Запуск расчётного движка…');try{const snapshot=decode(encode(doc));resultProject=project();resultName=name;result=await simulate(snapshot,config,(n,total)=>status(`Расчёт: ${n} из ${total} кривых`),abort.signal);lastConfig={...config};plotVector=defaultVector(result,config);cursorA=null;cursorB=null;cursorCurve=0;cursorCurveA=cursorCurveB=0;axesByDocument.set(activeDocument,{x:{...defaultPlotAxis(vectorTitle(result.curves[0].names[0])),scale:config.kind==='ac'&&config.ac_logarithmic!==false?'log':'linear'},y:defaultPlotAxis(config.kind==='ac'?(plotMode==='phase'?'Фаза, °':plotMode==='db'?'Модуль, дБ':'Коэффициент передачи'):vectorTitle(plotVector))});status(`Расчёт завершён: ${result.curves.length} кривых · ${result.curves.reduce((s,c)=>s+c.values.length,0)} точек · ${result.engine}`);if(config.kind==='op')renderOp();else switchTab('graph');}catch(e){if((e as Error).name==='AbortError')status('Расчёт остановлен.');else error(e);}finally{abort=null;busy(false);}}
function defaultVector(r:SimulationResult,c:SimulationConfig){
 const names=r.curves[0]?.names??[];
 if(c.kind==='dc-family')return names.find(n=>/vam_am1/.test(n))??names.at(-1)??'';
 if(c.kind==='dc'){const meter=names.find(n=>/^i\(vam_/.test(n));if(meter)return meter;}
 const sourceNodes=r.mapping.nodes[c.input??'']??[];
 const vm=Object.entries(r.mapping.names).find(([,name])=>name.startsWith('VM_'));
 if(vm){const meter=`v(${vm[1].toLowerCase()})`;if(names.includes(meter))return meter;}
 const transistor=Object.entries(r.mapping.names).find(([,name])=>name.startsWith('Q_'));
 if(transistor){const collector=r.mapping.nodes[transistor[0]]?.[0];if(collector&&!sourceNodes.includes(collector)&&names.includes(`v(${collector})`))return `v(${collector})`;}
 return names.find(n=>n.startsWith('v(')&&!sourceNodes.includes(n.slice(2,-1))&&n!==names[0])??names.filter(n=>n.startsWith('v(')&&n!==names[0]).at(-1)??names.at(-1)??'';
}
const real=(c:Cell)=>Array.isArray(c)?c[0]:c;
function phaseCurves(curves:Curve[],vector:string):Curve[]{return curves.map(c=>{const j=c.names.indexOf(vector);let previous:number|null=null;return {...c,values:c.values.map(row=>{const cell=row[j];if(j<0||!Array.isArray(cell))return row;let angle=Math.atan2(cell[1],cell[0])*180/Math.PI;if(previous!==null){while(angle-previous>180)angle-=360;while(angle-previous< -180)angle+=360;}previous=angle;const next=[...row];next[j]=angle;return next;})};});}
type UserCurve={name:string;expression:string;base:number;vector:string};
const userCurves=new WeakMap<SimulationResult,UserCurve[]>();
function displayedCurves(){
 if(!result)return[];const source=lastConfig?.kind==='ac'&&plotMode==='phase'?phaseCurves(result.curves,plotVector):result.curves;
 const extra=(userCurves.get(result)??[]).filter(d=>d.vector===plotVector).map(d=>{const c=result!.curves[d.base],evaluate=parseCurveExpression(d.expression,c.names);return{plot:d.name,names:[c.names[0],plotVector],values:c.values.map(row=>{const x=real(row[0]);return[x,evaluate(x,c)];})} as Curve;});return[...source,...extra];
}
function postprocessDialog(){
 if(!result)return;const source=result,d=freshAnalysisDialog(),base=Math.min(cursorCurve,source.curves.length-1),curve=source.curves[base];
 d.setAttribute('aria-label','Постпроцессинг');d.innerHTML=`<header>Постпроцессинг<button type="button" data-close aria-label="Закрыть">×</button></header><form class="postprocess-form"><div class="postprocess-content"><label>Доступные величины<select name="reference" size="8">${curve.names.map(n=>`<option value="${esc(n)}">${esc(vectorTitle(n))} · ${esc(n)}</option>`).join('')}</select></label><div><p>Кривые для вставки</p><ul>${(userCurves.get(source)??[]).map((c,i)=>`<li>${esc(c.name)} = ${esc(c.expression)} <button type="button" data-remove="${i}" aria-label="Удалить ${esc(c.name)}">×</button></li>`).join('')}</ul><p>Расчёт по кривой ${base+1}. Поддерживаются + − * /, скобки и x. Значения в СИ.</p><button type="button" id="insert-reference">Вставить величину ↓</button></div></div><label>Редактировать линию<input name="expression" value="0.35/x" required autocomplete="off"></label><label>Новое имя функции<input name="curve-name" value="Pmax" required autocomplete="off"></label><p role="alert" class="error" id="postprocess-error"></p><footer><button type="submit">Создать</button><button type="button" data-close>Отмена</button></footer></form>`;
 d.querySelectorAll<HTMLElement>('[data-close]').forEach(b=>b.onclick=()=>d.close());
 d.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(b=>b.onclick=()=>{userCurves.set(source,(userCurves.get(source)??[]).filter((_,i)=>i!==Number(b.dataset.remove)));d.close();renderGraph();postprocessDialog();});
 const form=d.querySelector('form')!,input=form.elements.namedItem('expression') as HTMLInputElement;
 d.querySelector<HTMLButtonElement>('#insert-reference')!.onclick=()=>{const select=form.elements.namedItem('reference') as HTMLSelectElement;input.setRangeText(select.value,input.selectionStart??input.value.length,input.selectionEnd??input.value.length,'end');input.focus();};
 form.onsubmit=e=>{e.preventDefault();try{const expression=input.value.trim(),name=(form.elements.namedItem('curve-name') as HTMLInputElement).value.trim();if(!name)throw Error('Введите имя функции');const evaluate=parseCurveExpression(expression,curve.names);if(!curve.values.some(row=>Number.isFinite(evaluate(real(row[0]),curve))))throw Error('Формула не даёт конечных значений на выбранной развёртке');const previous=userCurves.get(source)??[];userCurves.set(source,[...previous.filter(c=>c.name!==name),{name,expression,base,vector:plotVector}]);d.close();renderGraph();}catch(e){d.querySelector('#postprocess-error')!.textContent=e instanceof Error?e.message:String(e);}};d.showModal();
}
function exportCurrentGraph(){
 const curves=displayedCurves().map((c,i)=>({name:`${i+1}_${c.plot||'Curve'}`,points:c.values.map(row=>[real(row[0]),yValue(row[c.names.indexOf(plotVector)])] as [number,number]).filter(p=>p.every(Number.isFinite)),color:parseInt(colors[i%colors.length].slice(1).match(/../g)!.reverse().join(''),16)})).filter(c=>c.points.length>1);
 const xs=curves.flatMap(c=>c.points.map(p=>p[0])),ys=curves.flatMap(c=>c.points.map(p=>p[1])),axes=plotAxes();if(!xs.length)throw Error('Нет данных для диаграммы');const minmax=(v:number[])=>v.reduce(([a,b],x)=>[Math.min(a,x),Math.max(b,x)],[Infinity,-Infinity]);const [xmin,xmax]=minmax(xs),[ymin,ymax]=minmax(ys);
 download(name+'_graph.tdr',exportNativeGraphTdr({title:resultName||name,xLabel:axes.x.title,yLabel:axes.y.title,bounds:{xmin:axes.x.min??xmin,xmax:axes.x.max??xmax,ymin:axes.y.min??ymin,ymax:axes.y.max??(ymax===ymin?ymax+1:ymax)},curves}) as BlobPart);
}
function yValue(c:Cell){if(!Array.isArray(c))return c;const mag=Math.hypot(...c);return plotMode==='phase'?Math.atan2(c[1],c[0])*180/Math.PI:plotMode==='db'?20*Math.log10(Math.max(1e-300,mag)):mag;}
function vectorTitle(s:string){if(s==='frequency')return 'Частота, Гц';if(s==='time')return 'Время, с';if(s==='v-sweep'||s==='v(v-sweep)')return 'Напряжение источника, В';if(s==='i-sweep'||s==='i(i-sweep)')return 'Ток источника, А';if(s.startsWith('i(@'))return s.includes('[ic]')?'Ток коллектора, А':s.includes('[ib]')?'Ток базы, А':s;for(const [label,name] of Object.entries(result?.mapping.names??{})){if(s===`i(${name.toLowerCase()})`)return `Ток ${label}, А`;if(name.startsWith('VM_')&&s===`v(${name.toLowerCase()})`)return `Вольтметр ${label}, В`;}return s.startsWith('v(')?`Напряжение узла ${s.slice(2,-1)}, В`:s;}
function resultDetails(source:SimulationResult){return `<details><summary>Соединения, схема SPICE и журнал расчёта</summary><table id="result-connections"><thead><tr><th>Элемент</th><th>Имя SPICE</th><th>Узлы по порядку выводов</th></tr></thead><tbody>${Object.entries(source.mapping.nodes).map(([label,nodes])=>`<tr data-label="${esc(label)}" data-spice-name="${esc(source.mapping.names[label]??'')}" data-nodes="${esc(nodes.join(','))}"><td>${esc(label)}</td><td>${esc(source.mapping.names[label]??'')}</td><td>${esc(nodes.join(', '))}</td></tr>`).join('')}</tbody></table><pre id="result-netlist">${esc(source.netlist)}</pre><pre id="result-log">${esc(source.log)}</pre></details>`;}
function renderOp(){if(!result)return;const c=result.curves[0];$('#info-page').innerHTML=`<div class="info-page"><h2>Рабочая точка · ${esc(resultName)}</h2><p>${esc(result.engine)} · расчёт выполнен в браузере</p><table id="op-results"><thead><tr><th>Величина</th><th>Значение, СИ</th></tr></thead><tbody>${c.names.map((n,i)=>`<tr data-vector="${esc(n)}" data-real="${real(c.values[0][i])}" data-imag="${Array.isArray(c.values[0][i])?(c.values[0][i] as [number,number])[1]:0}"><td>${esc(vectorTitle(n))}</td><td>${fmt(real(c.values[0][i]),8)}</td></tr>`).join('')}</tbody></table><p><button class="full-button" style="max-width:250px" id="op-results-table">Таблица результатов</button></p>${resultDetails(result)}</div>`;$('#op-results-table').onclick=()=>showResultTable();switchTab('info');}
const colors=['#ff0000','#008000','#808000','#000080','#800080','#008080','#808080','#c0c0c0','#00ff00','#ffff00','#0000ff','#000000'];
function bjtOutputData(source:SimulationResult):{output:BjtGraphData['output'];model:string;defaults:{uceMax_V?:number;icMax_A?:number;pCollectorMax_W?:number}}{
 const transistor=components(doc).find(c=>c.kind==='NPN'||c.kind==='PNP');if(!transistor)throw Error('В схеме не найден NPN- или PNP-транзистор.');
 const spice=source.mapping.names[transistor.label]?.toLowerCase(),pins=source.mapping.nodes[transistor.label];if(!spice||!pins||pins.length!==3)throw Error('Не удалось определить выводы транзистора в результатах.');
 const icName=`i(@${spice}[ic])`,ibName=`i(@${spice}[ib])`,curves=source.curves;
 const groundVoltage=(curve:Curve,node:string)=>{if(node==='0')return curve.values.map(()=>0);const j=curve.names.indexOf(`v(${node.toLowerCase()})`);if(j<0)throw Error('В расчёте нет напряжения на выводе '+node);return curve.values.map(row=>{const cell=row[j];return Array.isArray(cell)?cell[0]:cell;});};
 const rows=curves.map(curve=>{
  const ic=curve.names.indexOf(icName),ib=curve.names.indexOf(ibName),collector=groundVoltage(curve,pins[0]),emitter=groundVoltage(curve,pins[2]);
  if(ic<0||ib<0)throw Error('В текущем расчёте нет токов IК и IБ транзистора. Повторите DC-семейство.');
  const real=(v:Cell)=>Array.isArray(v)?v[0]:v;
  const points=curve.values.map((row,i)=>[Math.abs(collector[i]-emitter[i]),Math.abs(real(row[ic]))] as [number,number]);
  const ibValues=curve.values.map(row=>Math.abs(real(row[ib]))),ib_A=ibValues.reduce((a,b)=>a+b,0)/Math.max(1,ibValues.length),span=Math.max(...ibValues)-Math.min(...ibValues),uceSpan=Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]));
  if(span>Math.max(1e-12,ib_A*.05))throw Error('Текущий DC-family не похож на выходную характеристику: IБ заметно меняется внутри каждой кривой. Запустите выходное семейство, где свипируется UКЭ.');
  if(uceSpan<Math.max(.1,Math.abs(points.at(-1)![0])*.1))throw Error('Текущий DC-family почти не меняет UКЭ внутри кривых. Это не выходное семейство; свипируйте UКЭ.');
  return {ib_A,points};
 });
 if(rows.length<2||Math.max(...rows.map(r=>r.ib_A))-Math.min(...rows.map(r=>r.ib_A))<=1e-15)throw Error('Для выходного семейства нужны разные уровни тока базы.');
 const valueOf=(label:string,kind:string)=>{const c=components(doc).find(c=>c.label===label&&c.kind===kind);return c?.value&&c.value>0?c.value:undefined;};
 const stage:BjtGraphData['stage']={R1_ohm:valueOf('R1','R'),R2_ohm:valueOf('R2','R'),Ce_F:valueOf('Ce','C'),Cp1_F:valueOf('Cp1','C')};
 let defaults:{uceMax_V?:number;icMax_A?:number;pCollectorMax_W?:number;stage?:BjtGraphData['stage']}={stage};
 try{const p=modelParameters(transistor);defaults={uceMax_V:p.VCEO||p.VCBO||undefined,icMax_A:p.ICMAX||undefined,pCollectorMax_W:p.PMAX||undefined,stage:{...stage,Ck_F:p.CJC>0?p.CJC:undefined}};}catch{}
 return {output:rows,model:`${transistor.model??transistor.label} (${transistor.kind})`,defaults};
}
function openBjtGraph(){if(!result||lastConfig?.kind!=='dc-family')throw Error('Сначала выполните расчёт семейства выходных характеристик.');const normalized=bjtOutputData(result);showBjtGraphDialog($<HTMLDialogElement>('#dialog'),normalized.defaults,values=>{const scene=buildBjtGraphScene({...normalized,...values,model:normalized.model});bjtGraphScene=scene;renderGraph();});}
function bjtCalculationTable(scene:BjtGraphScene){const numberText=(v:number)=>Math.abs(v)>0&&(Math.abs(v)<.001||Math.abs(v)>=1e5)?v.toExponential(3):String(Number(v.toPrecision(5)));return `<section class="bjt-calculations"><h3>Оценка параметров усилительного каскада</h3><p>Приближённый расчёт по локальным наклонам интерполированных характеристик около Q. Значения зависят от шага и диапазона исходных кривых; это оценка для проверки режима.</p><div class="bjt-calculation-scroll"><table><thead><tr><th>Параметр</th><th>Оценка</th><th>Единица</th><th>Метод / ограничение</th></tr></thead><tbody>${scene.calculations.map(r=>`<tr class="${r.status==='unavailable'?'unavailable':''}"><th>${esc(r.label)}</th><td>${r.value===null?'—':esc(numberText(r.value))}</td><td>${esc(r.unit)}</td><td>${esc(r.method??'')}</td></tr>`).join('')}</tbody></table></div>${scene.calculationWarnings.length?`<ul class="bjt-calculation-warnings">${scene.calculationWarnings.map(w=>`<li>${esc(w)}</li>`).join('')}</ul>`:''}</section>`;}
function renderGraph(){const page=$('#graph-page');if(bjtGraphScene){page.innerHTML=`<div class="graph-page"><div class="graph-tools"><button id="bjt-graph-back">Назад к результатам</button><button id="bjt-graph-export">Сохранить SVG…</button><button data-bjt-tdr="combined">Построение TINA (.TDR)…</button><button data-bjt-tdr="detail">Рабочая точка TINA (.TDR)…</button><button data-bjt-tdr="waveforms">Сигналы TINA (.TDR)…</button><span>${esc(bjtGraphScene.title)}</span></div><div class="bjt-scene-holder">${renderBjtGraphScene(bjtGraphScene)}</div>${bjtCalculationTable(bjtGraphScene)}<div class="graph-note">${bjtGraphScene.notes.map(esc).join(' · ')}</div></div>`;page.querySelectorAll<HTMLButtonElement>('[data-bjt-tdr]').forEach(b=>b.onclick=()=>{try{download(name+'_'+b.dataset.bjtTdr+'.tdr',exportBjtNativeTdr(bjtGraphScene!,b.dataset.bjtTdr as 'combined'|'detail'|'waveforms') as BlobPart);}catch(e){error(e);}});$('#bjt-graph-back').onclick=()=>{bjtGraphScene=null;renderGraph();};$('#bjt-graph-export').onclick=()=>download(name+'_графоаналитический.svg',renderBjtGraphScene(bjtGraphScene!),'image/svg+xml');return;}if(!result||!result.curves.length||!lastConfig||lastConfig.kind==='op'){page.innerHTML='<div class="info-page"><h2>Графики</h2><p>Выберите расчёт в меню «Анализ». Параметры расчёта задаются для открытой схемы.</p><button class="full-button" style="max-width:260px" data-action="analysis:dc-family">Построить семейство характеристик</button></div>';return;}const c=result.curves[0];if(!c.names.includes(plotVector))plotVector=c.names.at(-1)!;page.innerHTML=`<div class="graph-page"><div class="graph-tools"><label>Величина <select id="vector">${c.names.slice(1).map(n=>`<option value="${esc(n)}" ${n===plotVector?'selected':''}>${esc(vectorTitle(n))}</option>`).join('')}</select></label>${lastConfig.kind==='ac'?'<select id="plot-mode" aria-label="Вид частотного графика"><option value="magnitude">Модуль</option><option value="db">Модуль, дБ</option><option value="phase">Фаза, °</option></select>':''}<label>Курсоры <select id="cursor-curve">${result.curves.map((c,i)=>`<option value="${i}" ${i===cursorCurve?'selected':''}>${c.parameter===undefined?'Результат':esc((lastConfig?.step_source??'Параметр')+' = '+eng(c.parameter))}</option>`).join('')}</select></label>${lastConfig.kind==='ac'?'<button id="transfer">Коэффициент передачи</button>':''}${lastConfig.kind==='transient'?'<button id="scope-open">Осциллограф</button><button id="signal-stats">Измерения сигнала</button>':''}${lastConfig.kind==='dc-family'?'<button id="bjt-graph">Графоаналитическое построение…</button>':''}<button id="postprocess" ${lastConfig.kind==='ac'?'disabled title="Выражения для комплексных кривых ещё недоступны"':''}>Добавить больше кривых…</button><button id="native-graph-export">График TINA (.TDR)…</button><button id="cursor-a">Курсор a</button><button id="cursor-b">Курсор b</button><button id="axis-x">Ось X…</button><button id="axis-y">Ось Y…</button><button id="result-table">Таблица результатов</button><button id="result-text">Экспорт как текст…</button><button id="plot-svg">Рисунок SVG…</button><span>Щелчок: A · Shift + щелчок: B</span><span>${esc(resultName)}${lastConfig.kind==='ac'?' · AC-возбуждение '+esc(lastConfig.input??'')+' = 1 '+(result.mapping.names[lastConfig.input??'']?.startsWith('I_')?'А':'В'): ''}</span></div><div class="plot-holder"><svg class="plot" id="plot" viewBox="0 0 1000 550" preserveAspectRatio="none" aria-label="График результатов расчёта"></svg></div><div class="legend">${result.curves.map((c,i)=>`<span><i style="background:${colors[i%colors.length]}"></i>${c.parameter===undefined?'Результат':esc((lastConfig?.step_source??'Параметр')+' = '+eng(c.parameter))}</span>`).join('')}</div><div class="graph-note" id="cursor-readout">Выберите точки на графике для измерения разностей.</div></div>`;
 $<HTMLSelectElement>('#vector').onchange=e=>{plotVector=(e.target as HTMLSelectElement).value;cursorA=cursorB=null;drawPlot();};if($('#plot-mode')){$<HTMLSelectElement>('#plot-mode').value=plotMode;$<HTMLSelectElement>('#plot-mode').onchange=e=>{plotMode=(e.target as HTMLSelectElement).value;plotAxes().y=defaultPlotAxis(plotMode==='phase'?'Фаза, °':plotMode==='db'?'Коэффициент передачи, дБ':'Коэффициент передачи');drawPlot();};}
 $<HTMLSelectElement>('#cursor-curve').onchange=e=>{cursorCurve=Number((e.target as HTMLSelectElement).value);drawPlot();};if($('#bjt-graph'))$('#bjt-graph').onclick=()=>{try{openBjtGraph();}catch(e){error(e);}};if($('#transfer'))$('#transfer').onclick=transferDialog;if($('#scope-open'))$('#scope-open').onclick=()=>{if(result)showScope($<HTMLDialogElement>('#dialog'),result.curves[cursorCurve]??result.curves[0]);};if($('#signal-stats'))$('#signal-stats').onclick=signalStatsDialog;$('#postprocess').onclick=postprocessDialog;$('#native-graph-export').onclick=()=>{try{exportCurrentGraph();}catch(e){error(e);}};$('#result-table').onclick=()=>showResultTable();$('#result-text').onclick=()=>{if(result)download(name+'_graph.txt',resultCurveText(displayedCurves(),plotVector,yValue),'text/plain;charset=utf-8');};$('#plot-svg').onclick=()=>{const svg=document.querySelector<SVGSVGElement>('#plot')!.cloneNode(true) as SVGSVGElement;svg.setAttribute('width','1000');svg.setAttribute('height','550');const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='text{font-family:Arial,sans-serif;fill:#202124}';svg.prepend(style);download(name+'_graph.svg',new XMLSerializer().serializeToString(svg),'image/svg+xml');};for(const which of ['a','b'] as const)$('#cursor-'+which).onclick=()=>{cursorTarget=which;$('#cursor-a').setAttribute('aria-pressed',String(which==='a'));$('#cursor-b').setAttribute('aria-pressed',String(which==='b'));};for(const axis of ['x','y'] as const)$('#axis-'+axis).onclick=()=>showPlotAxisDialog(freshAnalysisDialog(),plotAxes()[axis],next=>{plotAxes()[axis]=next;drawPlot();});drawPlot();}
function drawPlot(){
 if(!result||!lastConfig)return;
 const curves=displayedCurves(),axes=plotAxes(),both=lastConfig.kind==='ac'&&lastConfig.ac_display==='both'&&plotMode!=='phase';
 const drawing=renderScientificPlot(curves,plotVector,axes,yValue,colors,[{x:cursorA,curve:cursorCurveA,name:'a',color:'#c03434'},{x:cursorB,curve:cursorCurveB,name:'b',color:'#315caa'}],both?275:550);
 const phase=both?renderScientificPlot(phaseCurves(result.curves,plotVector),plotVector,{x:axes.x,y:defaultPlotAxis('Фаза, °')},v=>Number(v),colors,[],275):null;
 const legend=$('.legend');if(legend)legend.innerHTML=curves.map((c,i)=>`<span><i style="background:${colors[i%colors.length]}"></i>${esc(i>=result!.curves.length?c.plot:c.parameter===undefined?'Результат':(lastConfig?.step_source??'Параметр')+' = '+eng(c.parameter))}</span>`).join('');
 $('#plot').innerHTML=drawing.html+(phase?`<g data-phase-panel transform="translate(0 275)"><title>Для измерений курсорами выберите режим «Фаза, °»</title>${phase.html}</g>`:'');
 if(phase)$('#plot').querySelectorAll('[data-phase-panel] [data-axis]').forEach(e=>e.removeAttribute('data-axis'));
 const openAxis=(axis:'x'|'y')=>showPlotAxisDialog(freshAnalysisDialog(),axes[axis],next=>{axes[axis]=next;drawPlot();});
 $('#plot').ondblclick=e=>{const axis=(e.target as Element).closest<SVGElement>('[data-axis]')?.dataset.axis;if(axis==='x'||axis==='y')openAxis(axis);};
 $('#plot').onclick=e=>{if((e.target as Element).closest('[data-axis],[data-phase-panel]'))return;const ev=e as MouseEvent,b=$('#plot').getBoundingClientRect(),fraction=Math.max(0,Math.min(1,((ev.clientX-b.left)/b.width*1000-85)/875)),x=drawing.xAt(fraction);if(ev.shiftKey||cursorTarget==='b'){cursorB=x;cursorCurveB=cursorCurve;}else{cursorA=x;cursorCurveA=cursorCurve;}drawPlot();};
 const point=(which:'a'|'b')=>{const x=which==='a'?cursorA:cursorB,index=which==='a'?cursorCurveA:cursorCurveB;return x===null?null:curvePoint(curves[index]??curves[0],plotVector,x,yValue);};
 const a=point('a'),b=point('b');
 const row=(which:'a'|'b',index:number,p:{x:number;y:number}|null)=>`<tr><th>${which}</th><td><select data-cursor-curve="${which}" aria-label="Кривая курсора ${which}">${curves.map((c,i)=>`<option value="${i}" ${i===index?'selected':''}>${i+1}${c.parameter===undefined?'':': '+eng(c.parameter)}</option>`).join('')}</select></td><td><input data-cursor="${which}" data-coordinate="x" aria-label="Курсор ${which}: x" value="${p?fmt(p.x,10):''}"></td><td><input data-cursor="${which}" data-coordinate="y" aria-label="Курсор ${which}: y" value="${p?fmt(p.y,10):''}"></td></tr>`;
 $('#cursor-readout').innerHTML=`<table class="cursor-measurements"><thead><tr><th>Курсор</th><th>Кривая</th><th>x</th><th>y</th></tr></thead><tbody>${row('a',cursorCurveA,a)}${row('b',cursorCurveB,b)}</tbody></table><div class="cursor-difference">${a&&b?`Δx = ${fmt(b.x-a.x,8)}; Δy = ${fmt(b.y-a.y,8)}; Δy/Δx = ${b.x===a.x?'—':fmt((b.y-a.y)/(b.x-a.x),8)}`:'Укажите x или y и нажмите Enter; курсоры могут находиться на разных кривых.'}</div>`;
 $('#cursor-readout').querySelectorAll<HTMLSelectElement>('[data-cursor-curve]').forEach(select=>select.onchange=()=>{if(select.dataset.cursorCurve==='a')cursorCurveA=Number(select.value);else cursorCurveB=Number(select.value);drawPlot();});
 $('#cursor-readout').querySelectorAll<HTMLInputElement>('[data-cursor]').forEach(input=>input.onkeydown=e=>{if(e.key!=='Enter')return;e.preventDefault();try{const which=input.dataset.cursor as 'a'|'b',index=which==='a'?cursorCurveA:cursorCurveB,previous=which==='a'?cursorA:cursorB,value=number(input.value),x=input.dataset.coordinate==='y'?curveXAtY(curves[index]??curves[0],plotVector,value,yValue,previous):value;if(which==='a')cursorA=x;else cursorB=x;drawPlot();}catch(error){status(error instanceof Error?error.message:String(error));}});
}
function showResultTable(source:SimulationResult|null=result,page=0,back?:()=>void){
 if(!source)return;const view=resultTablePage(source.curves,page,500,vectorTitle);
 $('#info-page').innerHTML=`<div class="info-page"><h2>Таблица результатов · ${esc(resultName||name)}</h2><p>${esc(source.engine)}. Все величины в единицах СИ; для комплексных значений показаны Re и Im.</p><div class="result-page-tools"><button id="result-back">Назад</button><button id="result-previous" ${view.page===0?'disabled':''}>Предыдущие</button><span id="result-page-range">${view.total?view.start+1:0}–${view.end} из ${view.total} точек · страница ${view.page+1} из ${view.pages}</span><button id="result-next" ${view.page+1>=view.pages?'disabled':''}>Следующие</button></div><div style="max-width:100%;overflow:auto">${view.html}</div>${resultDetails(source)}</div>`;
 $('#result-back').onclick=back??(()=>lastConfig?.kind==='op'?renderOp():switchTab('graph'));
 $('#result-previous').onclick=()=>showResultTable(source,view.page-1,back);$('#result-next').onclick=()=>showResultTable(source,view.page+1,back);switchTab('info');
}
function renderH(){
 if(!hReport)return;const h=hReport as Record<string,any>;
 const rows=[['h11','Входное сопротивление',h.h11,'Ом'],['h12','Обратная связь по напряжению',h.h12,''],['h21 = β','Передача тока',h.h21,''],['h22','Выходная проводимость',h.h22,'См'],['Rвх.тр','h11',h.RinTr,'Ом'],['Rвых.тр','1 / h22',h.RoutTr,'Ом']];
 $('#info-page').innerHTML=`<div class="info-page"><h2>h-параметры транзистора</h2><p>Рабочая точка: Iб = ${eng(h.iB)} А, Uкэ = ${fmt(h.uCE)} В, Iк = ${eng(h.iC)} А, Uбэ = ${fmt(h.uBE)} В.</p><table><tr><th>Параметр</th><th>Смысл</th><th>Значение</th><th>Единица</th></tr>${rows.map(([key,title,value,unit])=>`<tr data-h-parameter="${esc(key)}" data-real="${Number(value)}"><td>${key}</td><td>${title}</td><td>${fmt(Number(value),8)}</td><td>${unit}</td></tr>`).join('')}</table><p>Центральные разности: отклонение тока базы ±${eng(h.deltaIB)} А и напряжения коллектора ±${fmt(h.deltaUCE)} В. При больших отклонениях это усреднённые значения на выбранном участке.</p><p>${esc(h.method)}</p><details><summary>Формулы</summary><table>${Object.entries(h.formulas??{}).map(([key,value])=>`<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`).join('')}</table></details>${h.simulation?'<button id="h-measurements" class="full-button" style="max-width:260px">Таблица численных измерений</button>':''}</div>`;
 if(h.simulation)$('#h-measurements').onclick=()=>showResultTable(h.simulation,0,renderH);switchTab('info');status('h-параметры рассчитаны.');
}
function hDialog(){void import('./solver.ts').then(s=>{if(!('calculateH' in s)){tell('h-параметры','<p>Модуль определения h-параметров ещё подключается. Доступны рабочая точка и семейства характеристик.</p>');return;}const d=$<HTMLDialogElement>('#dialog');d.innerHTML='<form id="h-form"><header>h-параметры транзистора</header><div class="body"><p>Нужна выходная схема: IS1 задаёт ток базы, VS1 — напряжение коллектор–эмиттер, T1 — транзистор.</p><div class="form"><label>Iб рабочей точки, А<input name="ib" value="40мк" required></label><label>Uкэ рабочей точки, В<input name="uce" value="16" required></label><label>Отклонение Iб, А<input name="dib" value="1мк" required></label><label>Отклонение Uкэ, В<input name="duce" value="0.1" required></label></div><div class="error" id="h-error"></div></div><footer><button type="button" id="h-cancel">Отмена</button><button class="primary">Рассчитать</button></footer></form>';$('#h-cancel').onclick=()=>d.close();$('#h-form').onsubmit=async e=>{e.preventDefault();try{const f=new FormData(e.target as HTMLFormElement),opts=Object.fromEntries([...f].map(([k,v])=>[k,number(String(v))]));d.close();abort=new AbortController();busy(true);status('Определение h-параметров…');hReport=await (s as any).calculateH(doc,opts,(n:number,t:number)=>status(`h-параметры: ${n} из ${t} точек`),abort.signal);renderH();}catch(e){if((e as Error).name==='AbortError')status('Расчёт остановлен.');else error(e);}finally{abort=null;busy(false);}};d.showModal();}).catch(error);}
window.addEventListener('beforeunload',e=>{if(dirty||openDocuments.some(d=>d.dirty)){e.preventDefault();e.returnValue='';}});
new ResizeObserver(()=>{if(currentTab==='schematic')draw();}).observe($('#schematic-page'));
const savedWorkspaceAtStartup=localStorage.getItem('tina-web-workspace-v1');
palette();renderProperties();resetCalculationViews();
documentTabs();if(!savedWorkspaceAtStartup)requestAnimationFrame(fit);
try{
 const saved=localStorage.getItem('tina-web-workspace-v1');
 if(saved){const workspace=JSON.parse(saved);if(workspace.format!=='tina-web-workspace-v1'||!Array.isArray(workspace.documents)||!workspace.documents.length)throw Error('Invalid workspace');
 const restored:OpenDocument[]=workspace.documents.map((d:any)=>{if(!Number.isSafeInteger(d.id)||typeof d.name!=='string'||typeof d.tsc!=='string')throw Error('Invalid document');const bytes=encode(decode(un64(d.tsc)));return {id:d.id,name:d.name,bytes,analysis:d.analysis??{kind:'op'},dirty:!!d.dirty,zoom:Number.isFinite(d.zoom)?Math.max(.001,Math.min(4,d.zoom)):1,offset:Array.isArray(d.offset)&&d.offset.length===2&&d.offset.every(Number.isFinite)?d.offset:[0,0],history:[],redo:[],result:null,lastConfig:null,resultProject:null,resultName:'',hReport:null,plotVector:''};});
 if(new Set(restored.map(d=>d.id)).size!==restored.length)throw Error('Duplicate document IDs');openDocuments.splice(0,openDocuments.length,...restored);nextDocument=Math.max(...restored.map(d=>d.id))+1;loadActive(restored.find(d=>d.id===workspace.activeDocument)??restored[0]);status('Восстановлены открытые схемы: '+restored.length+'. Результаты расчётов нужно получить заново.');
 }else{const legacy=localStorage.getItem('bf240-project-v1');if(legacy){const p=JSON.parse(legacy);doc=decode(un64(p.tsc));analysis=p.analysis??analysis;name=p.name??name;dirty=true;storeActive();loadActive(openDocuments[0]);status('Восстановлен последний проект из этого браузера.');requestAnimationFrame(fit);}}
}catch{status('Автосохранение не удалось прочитать. Исходные данные оставлены в браузере.');}
if(!openDocuments.length){openDocuments.push({id:activeDocument,name,bytes:encode(doc),analysis,history:[],redo:[],dirty,zoom,offset,result:null,lastConfig:null,resultProject:null,resultName:'',hReport:null,plotVector:''});documentTabs();}
window.addEventListener('pagehide',()=>{storeActive();});

function transferDialog(){
 if(!result||lastConfig?.kind!=='ac')return;
 const curve=result.curves[0],vectors=curve.names.filter(n=>n.startsWith('v('));
 const options=vectors.map(n=>`<option value="${esc(n)}">${esc(vectorTitle(n))}</option>`).join('');
 tell('Коэффициент передачи / импеданс',`<label>Измерение<select id="ratio-kind"><option value="H">H = Uвыход / Uвход</option><option value="Z">Z = U / I, Ом</option></select></label><p>Выберите измерения напряжения входа и выхода. H = Uвыход / Uвход.</p><div class="form"><label>Вход<select id="transfer-in">${options}${curve.names.filter(n=>n.startsWith('i(')).map(n=>`<option value="${esc(n)}">${esc(vectorTitle(n))}</option>`).join('')}</select></label><label>Выход<select id="transfer-out">${options}</select></label></div><button id="transfer-apply">Построить H(f)</button><div id="transfer-error" class="error"></div>`);
 $('#transfer-apply').onclick=()=>{try{
  const ratioKind=$<HTMLSelectElement>('#ratio-kind').value as 'H'|'Z';const inputVector=$<HTMLSelectElement>('#transfer-in').value;if(ratioKind==='Z'&&!inputVector.startsWith('i('))throw Error('Для Z выберите ток в поле входа; знак тока следует направлению SPICE');if(ratioKind==='H'&&!inputVector.startsWith('v('))throw Error('Для H выберите напряжение входа');const h=transferCurve(curve,$<HTMLSelectElement>('#transfer-out').value,$<HTMLSelectElement>('#transfer-in').value,ratioKind),report=bandwidth(h),vector=h.names[1];
  for(const c of result!.curves){const derived=transferCurve(c,$<HTMLSelectElement>('#transfer-out').value,$<HTMLSelectElement>('#transfer-in').value,ratioKind);let i=c.names.indexOf(vector);if(i<0){i=c.names.length;c.names.push(vector);}c.values.forEach((r,k)=>r[i]=derived.values[k][1]);}
  plotVector=vector;plotMode='db';$<HTMLDialogElement>('#dialog').close();renderGraph();
  status(`Пик H: ${fmt(report.peakDb)} дБ; пересечения уровня −3.01 дБ от пика: ${report.crossings.length?report.crossings.map(f=>eng(f)+' Гц').join(', '):'нет в диапазоне'}.`);
 }catch(e){$('#transfer-error').textContent=(e as Error).message;}};
}

function signalStatsDialog(){
 if(!result||lastConfig?.kind!=='transient')return;
 const c=result.curves[cursorCurve]??result.curves[0];
 const start=cursorA===null?real(c.values[0][0]):cursorA,stop=cursorB===null?real(c.values.at(-1)![0]):cursorB;
 tell('Измерения сигнала',`<p>${esc(vectorTitle(plotVector))}. Среднее и RMS учитывают длительность интервалов и линейную интерполяцию между отсчётами.</p><label>Начало, с<input id="stats-start" value="${Math.min(start,stop)}"></label><label>Конец, с<input id="stats-stop" value="${Math.max(start,stop)}"></label><button id="stats-apply">Измерить</button><div id="stats-result"></div>`);
 $('#stats-apply').onclick=()=>{try{const r=transientStats(c,plotVector,number($<HTMLInputElement>('#stats-start').value),number($<HTMLInputElement>('#stats-stop').value));$('#stats-result').textContent=`Минимум: ${eng(r.min)}; максимум: ${eng(r.max)}; размах: ${eng(r.peakToPeak)}; среднее: ${eng(r.mean)}; RMS: ${eng(r.rms)}`;}catch(e){$('#stats-result').textContent=(e as Error).message;}};
}

updateMenuChecks();
Promise.allSettled([loadNativeSymbolVectors(),loadNativePalette()]).then(()=>{palette();draw();});
