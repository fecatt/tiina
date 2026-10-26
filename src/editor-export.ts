/** Local vector export of the visible schematic. Editor tools and selections stay in the live DOM. */
const NS='http://www.w3.org/2000/svg';
const CSS=`.schematic-export .symbol{fill:none;stroke:#008000;stroke-width:1.15;stroke-linecap:round;stroke-linejoin:round;color:#008000}
.schematic-export .wire{stroke:#3c0000;stroke-width:1.05;fill:none;stroke-linecap:round}
.schematic-export .label{fill:#008080;font:9px Arial,sans-serif;stroke:none}
.schematic-export .meterlabel{fill:#800080}
.schematic-export .annotation text{stroke:none;white-space:pre}`;
export interface SchematicExportOptions {
 padding?:number;
 title?:string;
 /** Original annotation fills, indexed by drawing data-index. Selected annotations
  * otherwise need data-export-color because the live selected fill replaced their original color. */
 annotationColors?:Readonly<Record<string,string>>;
}
const excluded='.pick,.pin,.wire-handle,.wire-handle-dot,[data-wire-handle],[data-editor-only],[data-export-exclude],.selection-box,.selectionBox,#selectionBox,.preview,.wire-preview,.cursor-preview,.node-marker,.node-number';
const allowed=new Set(['g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','title','desc','defs','clipPath','mask','linearGradient','radialGradient','stop','use','symbol','marker']);
const externalUrl=(value:string)=>Array.from(value.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)).some(match=>!match[2].trim().startsWith('#'));
function cleanDrawing(drawing:SVGGElement,opts:SchematicExportOptions):SVGGElement {
 const clone=drawing.cloneNode(true) as SVGGElement;clone.removeAttribute('id');
 clone.querySelectorAll(excluded).forEach(el=>el.remove());
 // Older drawing snapshots have untagged editor-only shapes; current callers should tag them.
 for(const el of Array.from(clone.children)){
  if(el.localName==='rect'&&el.getAttribute('stroke-dasharray')==='3 2'&&el.getAttribute('stroke')==='#000080')el.remove();
  if(el.localName==='circle'&&el.getAttribute('stroke')==='#d68d14'&&el.getAttribute('fill')==='none')el.remove();
 }
 for(const el of clone.querySelectorAll('.symbol rect[fill="transparent"][stroke="none"]'))el.remove();
 for(const element of [clone,...clone.querySelectorAll<SVGElement>('*')]){
  if(element!==clone&&!allowed.has(element.localName)){element.remove();continue;}
  for(const attr of Array.from(element.attributes)){
   if(/^on/i.test(attr.name)||attr.name==='tabindex'||attr.name==='pointer-events'||(/href$/i.test(attr.name)&&!attr.value.startsWith('#'))||externalUrl(attr.value))element.removeAttribute(attr.name);
  }
  element.classList.remove('selected','selected-label','selected-node','hover','focused');element.style.removeProperty('cursor');
  if(element.classList.contains('symbol')){element.style.color='#008000';element.style.removeProperty('stroke');}
  if(element.classList.contains('wire'))element.style.removeProperty('stroke');
  if(element.classList.contains('label')){element.style.fill=element.classList.contains('meterlabel')?'#800080':'#008080';element.style.removeProperty('text-decoration');}
  if(element.classList.contains('annotation')){
   const color=opts.annotationColors?.[element.getAttribute('data-index')??'']??element.getAttribute('data-export-color');if(color)element.style.fill=color;
  }
  for(const attr of Array.from(element.attributes))if(attr.name.startsWith('data-'))element.removeAttribute(attr.name);
 }
 return clone;
}

/** Synchronous: call after the editor has rendered. Measures a cleaned live clone,
 * so remote labels, rotated text, formulas and annotation fonts determine the bounds.
 * The source SVG, selection and viewport/pan/zoom are never changed. */
export function buildCleanSchematicSvg(svg:SVGSVGElement,drawing:SVGGElement,opts:SchematicExportOptions={}):string {
 if(!svg.contains(drawing))throw Error('Схема не принадлежит указанному SVG');
 const padding=opts.padding??12;if(!Number.isFinite(padding)||padding<0||padding>1000)throw Error('Недопустимый отступ SVG');
 const doc=svg.ownerDocument,clean=cleanDrawing(drawing,opts),output=doc.createElementNS(NS,'svg');
 output.setAttribute('xmlns',NS);output.setAttribute('class','schematic-export');output.setAttribute('preserveAspectRatio','xMidYMid meet');
 const style=doc.createElementNS(NS,'style');style.textContent=CSS;output.append(style,clean);
 const measuring=output.cloneNode(true) as SVGSVGElement;measuring.style.cssText='position:fixed;left:-100000px;top:-100000px;width:1px;height:1px;overflow:visible;visibility:hidden;pointer-events:none';
 let bounds:{x:number;y:number;width:number;height:number};
 try{doc.body.append(measuring);const group=measuring.querySelector('g')!;bounds=group.getBBox();}finally{measuring.remove();}
 const finite=[bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite);if(!finite)throw Error('Не удалось определить размеры схемы');
 if(!clean.children.length)bounds={x:0,y:0,width:800,height:600};
 const x=bounds.x-padding,y=bounds.y-padding,w=Math.max(1,bounds.width)+2*padding,h=Math.max(1,bounds.height)+2*padding;
 output.setAttribute('viewBox',`${x} ${y} ${w} ${h}`);output.setAttribute('width',String(w));output.setAttribute('height',String(h));
 const background=doc.createElementNS(NS,'rect');for(const [key,value] of Object.entries({x,y,width:w,height:h,fill:'white'}))background.setAttribute(key,String(value));output.insertBefore(background,clean);
 if(opts.title){const title=doc.createElementNS(NS,'title');title.textContent=opts.title;output.prepend(title);}
 return new XMLSerializer().serializeToString(output);
}

/** Prepare a local print document without opening the browser print dialog.
 * Useful for preview and tests. Caller may remove the returned frame when finished. */
export function prepareSchematicPrint(svgString:string,title='Схема',page:PageSettings=DEFAULT_PAGE):HTMLIFrameElement {
 const parsed=new DOMParser().parseFromString(svgString,'image/svg+xml');if(parsed.querySelector('parsererror')||parsed.documentElement.localName!=='svg'||parsed.documentElement.namespaceURI!==NS)throw Error('Недопустимый SVG для печати');
 const frame=document.createElement('iframe');frame.dataset.schematicPrint='';frame.title='Печать схемы';frame.setAttribute('aria-hidden','true');frame.setAttribute('sandbox','allow-same-origin allow-modals');frame.style.cssText='position:fixed;right:0;bottom:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none';
 document.body.append(frame);const doc=frame.contentDocument;if(!doc){frame.remove();throw Error('Не удалось подготовить печать');}
 doc.open();doc.write('<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body><h1></h1><main></main></body></html>');doc.close();
 doc.title=title;doc.querySelector('h1')!.textContent=title;
 const style=doc.createElement('style');style.textContent=schematicPrintCss(page);doc.head.append(style);
 doc.querySelector('main')!.append(doc.importNode(parsed.documentElement,true));return frame;
}

/** Opens only the browser's normal local print dialog, with automatic A4 landscape fit.
 * This is browser printing, not a claim of native TINA paper-layout parity. */
export async function printSchematic(svgString:string,title='Схема',page:PageSettings=DEFAULT_PAGE):Promise<void> {
 const frame=prepareSchematicPrint(svgString,title,page),win=frame.contentWindow!;
 const cleanup=()=>frame.remove();win.addEventListener('afterprint',cleanup,{once:true});
 try{await frame.contentDocument!.fonts.ready;win.focus();win.print();}catch(error){cleanup();throw error;}
}
import {schematicPrintCss,DEFAULT_PAGE,type PageSettings} from './editor-page.ts';
