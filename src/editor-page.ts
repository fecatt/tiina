export type PageSettings={paper:'A4'|'A3'|'Letter';orientation:'portrait'|'landscape';margins:{top:number;right:number;bottom:number;left:number};showTitle:boolean};
export const DEFAULT_PAGE:PageSettings={paper:'A4',orientation:'landscape',margins:{top:12,right:12,bottom:12,left:12},showTitle:true};
const papers={A4:[210,297],A3:[297,420],Letter:[215.9,279.4]} as const;
export function pageSettings(value:unknown=DEFAULT_PAGE):PageSettings {
 if(!value||typeof value!=='object')throw Error('Недопустимые параметры страницы');
 const p=value as Partial<PageSettings>;
 if(!p.paper||!Object.hasOwn(papers,p.paper)||!['portrait','landscape'].includes(p.orientation??''))throw Error('Выберите формат и ориентацию страницы');
 if(typeof p.showTitle!=='boolean'||!p.margins||typeof p.margins!=='object')throw Error('Недопустимые параметры страницы');
 const margins={} as PageSettings['margins'];for(const key of ['top','right','bottom','left'] as const){const n=p.margins[key];if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>100)throw Error('Поля должны быть от 0 до 100 мм');margins[key]=n;}
 const result:PageSettings={paper:p.paper,orientation:p.orientation as PageSettings['orientation'],margins,showTitle:p.showTitle};
 const [w,h]=papers[result.paper],width=result.orientation==='portrait'?w:h,height=result.orientation==='portrait'?h:w;
 if(width-margins.left-margins.right<20||height-margins.top-margins.bottom<20)throw Error('Поля оставляют слишком мало места для схемы');return result;
}
export function pageLayout(value:PageSettings=DEFAULT_PAGE){
 const settings=pageSettings(value),[w,h]=papers[settings.paper],width=settings.orientation==='portrait'?w:h,height=settings.orientation==='portrait'?h:w;
 return {settings,width,height,contentWidth:width-settings.margins.left-settings.margins.right,contentHeight:height-settings.margins.top-settings.margins.bottom};
}
/** Browser print preferences never change unknown native TSC bytes. */
export function schematicPrintCss(value:PageSettings=DEFAULT_PAGE):string {
 const {settings:p,contentWidth,contentHeight}=pageLayout(value),m=p.margins;
 return `@page{size:${p.paper} ${p.orientation};margin:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm}html{background:white;color:black}body{margin:0;width:${contentWidth}mm;height:${contentHeight}mm;display:flex;flex-direction:column;font:12px Arial,sans-serif;background:white}h1{display:${p.showTitle?'block':'none'};font-size:14px;font-weight:normal;margin:0 0 5mm;overflow-wrap:anywhere;flex-shrink:0}main{flex:1;min-height:0;display:flex;align-items:center;justify-content:center}main>svg{display:block;width:100%;height:100%;max-width:100%;max-height:100%;overflow:visible}@media screen{body{padding:0;box-sizing:border-box}}`;
}
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function pagePreviewMarkup(svg:string,title:string,value:PageSettings=DEFAULT_PAGE):string {
 const {settings:p,width,height,contentWidth,contentHeight}=pageLayout(value);
 const parsed=new DOMParser().parseFromString(svg,'image/svg+xml');if(parsed.querySelector('parsererror')||parsed.documentElement.localName!=='svg')throw Error('Недопустимая схема для просмотра');
 const style=`position:relative;aspect-ratio:${width}/${height};width:100%;background:white;box-shadow:0 0 0 1px #888`;
 const inner=`position:absolute;left:${p.margins.left/width*100}%;top:${p.margins.top/height*100}%;width:${contentWidth/width*100}%;height:${contentHeight/height*100}%;display:flex;flex-direction:column;min-height:0`;
 return `<div class="schematic-page-preview" data-paper="${p.paper}" data-orientation="${p.orientation}" style="${style}"><div style="${inner}">${p.showTitle?`<div style="font:12px Arial;margin-bottom:8px;overflow-wrap:anywhere">${escape(title)}</div>`:''}<div style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center">${new XMLSerializer().serializeToString(parsed.documentElement)}</div></div></div>`;
}
export function showPageSettings(dialog:HTMLDialogElement,current:PageSettings,accept:(next:PageSettings)=>void):void {
 const value=pageSettings(current),field=(key:keyof PageSettings['margins'],title:string)=>`<label>${title}, мм<input name="${key}" type="number" required min="0" max="100" step="0.5" value="${value.margins[key]}"></label>`;
 dialog.innerHTML=`<header>Параметры печати</header><form id="page-settings-form"><div class="body"><div class="form"><label>Бумага<select name="paper">${Object.keys(papers).map(p=>`<option ${p===value.paper?'selected':''}>${p}</option>`).join('')}</select></label><label>Ориентация<select name="orientation"><option value="portrait" ${value.orientation==='portrait'?'selected':''}>Книжная</option><option value="landscape" ${value.orientation==='landscape'?'selected':''}>Альбомная</option></select></label>${field('top','Верхнее поле')}${field('right','Правое поле')}${field('bottom','Нижнее поле')}${field('left','Левое поле')}</div><label><input type="checkbox" name="showTitle" ${value.showTitle?'checked':''}> Печатать название схемы</label><p class="small-note">Настройки применяются к печати из браузера. Файл схемы TSC не изменяется.</p><p class="error" role="alert" id="page-settings-error"></p></div><footer><button type="submit">ОК</button><button type="button" id="page-settings-cancel">Отмена</button></footer></form>`;
 dialog.querySelector<HTMLButtonElement>('#page-settings-cancel')!.onclick=()=>dialog.close();
 dialog.querySelector<HTMLFormElement>('form')!.onsubmit=e=>{e.preventDefault();try{const data=new FormData(e.currentTarget as HTMLFormElement),next=pageSettings({paper:data.get('paper'),orientation:data.get('orientation'),showTitle:data.has('showTitle'),margins:Object.fromEntries(['top','right','bottom','left'].map(key=>[key,Number(data.get(key))]))});accept(next);dialog.close();}catch(error){dialog.querySelector('#page-settings-error')!.textContent=error instanceof Error?error.message:String(error);}};
 dialog.showModal();
}
