/* TINA-UI: window=postprocess; status=partial; parity-gaps=Help, built-in functions, line editor, advanced editor and XY mode stay disabled; full-native-parity-checks=0; scenario-checks=1 (browser dialog flow with fixture, work/postprocess-dialog-qa.mjs, screenshots work/postprocess-dialog-collapsed.png, work/postprocess-dialog-expanded.png, work/postprocess-dialog-expanded-bottom.png, 2026-10-28); build=pass (parent resolved concurrent src/main.ts syntax issue, 2026-10-28); native reference=work/novice-tina-variant03/postprocessing-formula-ui-inserted.png. */
import type {Curve,SimulationResult} from './solver.ts';
import {parseCurveExpression} from './curve-expression.ts';
import './postprocess-dialog.css';

export type PostprocessCurve={name:string;expression:string;base:number;vector:string};
export type PostprocessDialogOptions={
 result:SimulationResult;
 initialCurve:number;
 vector:string;
 title:(name:string)=>string;
 getCurves:()=>PostprocessCurve[];
 onUpdate:(curves:PostprocessCurve[],vector:string)=>void;
};

const escapeHtml=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const real=(v:unknown)=>Array.isArray(v)?Number(v[0]):Number(v);
const template=`{This is a template}\n{Don't modify the functionname}\nFunction F(x);\nBegin\n  {Your expressions here}`;

export function showPostprocessDialog(options:PostprocessDialogOptions){
 const {result,title}=options;
 if(!result.curves.length)return;
 let base=Math.max(0,Math.min(options.initialCurve,result.curves.length-1));
 let selectedInsert='';
 const vectors=result.curves.flatMap((curve,curveIndex)=>curve.names.map(name=>({base:curveIndex,name,id:`${curveIndex}:${name}`})));
 let selectedVectorId=vectors.find(v=>v.base===base&&v.name===options.vector)?.id??vectors[0]?.id??'';
 let filterText='';
 let expressionDraft='',nameDraft='';
 let draftCurves=options.getCurves().map(c=>({...c}));
 const d=document.createElement('dialog');d.className='modal postprocess-dialog';d.setAttribute('aria-label','Постпроцессинг');
 document.body.append(d);
 d.addEventListener('close',()=>d.remove(),{once:true});
 const esc=escapeHtml;
 const categories=[['pins','Выводы'],['node-voltage','Узловые напряжения'],['other-voltage','Другие напряжения'],['currents','Токи'],['user','Определяемые пользователем'],['measurements','Измерение']] as const;
 const getBase=()=>result.curves[base];
 const nodeNames=new Set(Object.values(result.mapping.nodes).flat().map(n=>`v(${n.toLowerCase()})`));
 const categoryOf=(name:string)=>{
  if(name==='time'||name==='frequency'||name==='v-sweep'||name==='i-sweep')return 'measurements';
  if(name.startsWith('i('))return 'currents';
  if(name.startsWith('v('))return nodeNames.has(name.toLowerCase())?'node-voltage':'other-voltage';
  if(name.startsWith('V_')||name.startsWith('I_'))return 'pins';
  return 'user';
 };
 const categoryHasItems=(key:string)=>vectors.some(v=>categoryOf(v.name)===key);
 const vectorLabel=(name:string)=>{const translated=title(name);if(translated!==name)return translated;return /^v[_(]/i.test(name)?'Напряжение':/^i[_(]/i.test(name)?'Ток':name;};
 const shown=new Set<string>(categories.filter(([key])=>categoryHasItems(key)).map(([key])=>key));
 const available=()=>vectors.filter(v=>shown.has(categoryOf(v.name))).filter(v=>v.name.toLocaleLowerCase().includes(filterText.trim().toLocaleLowerCase()));
 const render=()=>{
  const curve=getBase(),items=available(),user=draftCurves;
  d.innerHTML=`
   <form class="postprocess-form">
    <header class="postprocess-title">Постпроцессинг</header>
    <div class="postprocess-main">
     <section class="postprocess-left" aria-label="Выбор кривых">
      <label class="postprocess-list-label">Доступные кривые:
       <select name="available" size="10" aria-label="Доступные кривые">${items.map(v=>`<option value="${esc(v.id)}" ${v.id===selectedVectorId?'selected':''}>${esc(vectorLabel(v.name))} · ${esc(v.name)} · семейство ${v.base+1}</option>`).join('')}</select>
      </label>
     </section>
     <div class="postprocess-transfer">
      <button type="button" data-add ${items.length?'':'disabled'}>Добавить &gt;&gt;</button>
      <button type="button" data-remove-one ${user.length?'':'disabled'}>&lt;&lt; Удалить</button>
      <button type="button" data-remove-all ${user.length?'':'disabled'}>Удалить</button>
      <fieldset class="postprocess-filters"><legend>Показать</legend>
       <label class="postprocess-filter-name">Curve Name: <input name="curve-name-filter" autocomplete="off"></label>
       <div class="postprocess-checks">${categories.map(([key,label])=>`<label><input type="checkbox" name="show-${key}" ${shown.has(key)?'checked':''} ${categoryHasItems(key)?'':'disabled'}>${label}</label>`).join('')}</div>
      </fieldset>
     </div>
     <label class="postprocess-list-label postprocess-insert-label">Кривые для вставки:
      <select name="inserted" size="10" aria-label="Кривые для вставки">${user.map((c,i)=>`<option value="${i}" ${c.name===selectedInsert?'selected':''}>${esc(c.name)} = ${esc(c.expression)}</option>`).join('')}</select>
     </label>
     <aside class="postprocess-actions">
      <button type="button" class="postprocess-ok" data-ok>OK</button>
      <button type="button" data-cancel>Отмена</button>
      <button type="button" disabled title="Справка пока недоступна">Помощь</button>
      <button type="button" class="postprocess-more" data-more aria-expanded="${d.dataset.expanded==='true'}">${d.dataset.expanded==='true'?'Меньше':'Больше'} &gt;&gt;</button>
     </aside>
    </div>
    <section class="postprocess-lower" ${d.dataset.expanded==='true'?'':'hidden'}>
     <div class="postprocess-lower-heading"><span>Кривые задаваемые пользователем</span></div>
     <div class="postprocess-functions"><button type="button" class="postprocess-down-arrow" data-insert-selected ${items.length?'':'disabled'} aria-label="Вставить выбранную кривую в формулу" title="Вставить выбранную кривую в формулу">▼</button><label>Встроенные функции <select disabled aria-label="Встроенные функции"><option>Функция…</option></select></label><button type="button" class="postprocess-down-arrow" data-insert-function disabled aria-label="Вставить встроенную функцию">▼</button><button type="button" class="postprocess-edit-lines" disabled>Редактировать линии</button></div>
     <label class="postprocess-expression-label">Редактировать линию<textarea name="expression" rows="2" spellcheck="false"></textarea></label>
     <div class="postprocess-lower-grid">
      <label class="postprocess-advanced-label">Расширенный редактор<textarea disabled rows="5" spellcheck="false">${esc(template)}</textarea></label>
      <div class="postprocess-create">
       <label>Новое имя функции: <input name="new-name" autocomplete="off"></label>
       <button type="button" data-create>Создать</button>
       <label class="postprocess-disabled"><input type="checkbox" disabled> Расширенный редактор</label>
       <label class="postprocess-disabled"><input type="checkbox" disabled> XY График</label>
      </div>
     </div>
     <p class="postprocess-context">Семейство ${base+1} из ${result.curves.length} · Ось X: ${esc(title(curve.names[0]))}. Формулы: числа, x, величины из списка, + − * / и скобки. Значения в СИ.</p>
     <p class="postprocess-error" role="alert"></p>
    </section>
   </form>`;
  const expressionField=d.querySelector<HTMLTextAreaElement>('[name="expression"]');
  const nameField=d.querySelector<HTMLInputElement>('[name="new-name"]');
  if(expressionField)expressionField.value=expressionDraft;
  if(nameField)nameField.value=nameDraft;
  expressionField?.addEventListener('input',()=>expressionDraft=expressionField.value);
  nameField?.addEventListener('input',()=>nameDraft=nameField.value);
  const filter=d.querySelector<HTMLInputElement>('[name="curve-name-filter"]')!;
  filter.value=filterText;
  filter.addEventListener('input',()=>{filterText=filter.value;render();d.querySelector<HTMLInputElement>('[name="curve-name-filter"]')!.focus();});
  d.querySelectorAll<HTMLInputElement>('.postprocess-checks input').forEach((cb,i)=>cb.addEventListener('change',()=>{if(cb.checked)shown.add(categories[i][0]);else shown.delete(categories[i][0]);render();}));
  const inserted=d.querySelector<HTMLSelectElement>('[name="inserted"]')!;
  inserted.onchange=()=>{const item=draftCurves[Number(inserted.value)];if(!item)return;expressionDraft=item.expression;nameDraft=item.name;d.querySelector<HTMLTextAreaElement>('[name="expression"]')!.value=expressionDraft;d.querySelector<HTMLInputElement>('[name="new-name"]')!.value=nameDraft;selectedInsert=item.name;};
  d.querySelector<HTMLSelectElement>('[name="available"]')!.onchange=e=>{const item=vectors.find(v=>v.id===(e.currentTarget as HTMLSelectElement).value);if(!item)return;base=item.base;selectedVectorId=item.id;const context=d.querySelector('.postprocess-context');if(context)context.textContent=`Семейство ${base+1} из ${result.curves.length} · Ось X: ${title(getBase().names[0])}. Формулы: числа, x, величины из списка, + − * / и скобки. Значения в СИ.`;};
  d.querySelector('[data-insert-selected]')!.addEventListener('click',insertSelected);
  d.querySelector('[data-add]')!.addEventListener('click',()=>{const item=vectors.find(v=>v.id===d.querySelector<HTMLSelectElement>('[name="available"]')!.value);if(!item)return;base=item.base;selectedVectorId=item.id;const curve=result.curves[item.base],name=`${item.name} — семейство ${item.base+1}`,expression=`${item.name}(x)`;try{parseCurveExpression(expression,curve.names);draftCurves=[...draftCurves.filter(c=>c.name!==name),{name,expression,base:item.base,vector:options.vector}];selectedInsert=name;render();const list=d.querySelector<HTMLSelectElement>('[name="inserted"]')!;list.value=String(list.options.length-1);list.dispatchEvent(new Event('change'));}catch(e){showError(e);}});
  d.querySelector('[data-remove-one]')!.addEventListener('click',()=>{if(!inserted.value)return;const index=Number(inserted.value);draftCurves=draftCurves.filter((_,i)=>i!==index);selectedInsert='';render();});
  d.querySelector('[data-remove-all]')!.addEventListener('click',()=>{draftCurves=[];selectedInsert='';render();});
  d.querySelector('[data-create]')!.addEventListener('click',create);
  d.querySelectorAll('[data-ok]').forEach(b=>b.addEventListener('click',()=>{options.onUpdate(draftCurves,options.vector);d.close();}));
  d.querySelectorAll('[data-cancel]').forEach(b=>b.addEventListener('click',()=>d.close()));
  d.querySelector('[data-more]')!.addEventListener('click',()=>{d.dataset.expanded=d.dataset.expanded==='true'?'false':'true';render();});
  if(selectedInsert){const i=draftCurves.findIndex(c=>c.name===selectedInsert);if(i>=0){inserted.value=String(i);inserted.dispatchEvent(new Event('change'));}}
 };
 const showError=(error:unknown)=>{const node=d.querySelector<HTMLElement>('.postprocess-error');if(node)node.textContent=error instanceof Error?error.message:String(error);};
 const insertSelected=()=>{const item=vectors.find(v=>v.id===d.querySelector<HTMLSelectElement>('[name="available"]')!.value);if(!item)return;base=item.base;selectedVectorId=item.id;const input=d.querySelector<HTMLTextAreaElement>('[name="expression"]');if(!input){d.dataset.expanded='true';render();}const target=d.querySelector<HTMLTextAreaElement>('[name="expression"]')!;target.setRangeText(`${item.name}(x)`,target.selectionStart??target.value.length,target.selectionEnd??target.value.length,'end');expressionDraft=target.value;target.focus();};
 const create=()=>{try{const curve=getBase(),input=d.querySelector<HTMLTextAreaElement>('[name="expression"]')!,name=d.querySelector<HTMLInputElement>('[name="new-name"]')!.value.trim(),expression=input.value.trim();expressionDraft=input.value;nameDraft=d.querySelector<HTMLInputElement>('[name="new-name"]')!.value;if(!name)throw Error('Введите имя функции');if(!expression)throw Error('Введите выражение кривой');const evaluate=parseCurveExpression(expression,curve.names);if(!curve.values.every(row=>Number.isFinite(evaluate(real(row[0]),curve))))throw Error('Формула даёт неопределённые значения на выбранной кривой');const item={name,expression,base,vector:options.vector};draftCurves=[...draftCurves.filter(c=>c.name!==name),item];selectedInsert=name;render();}catch(e){showError(e);}};
 render();d.showModal();
}
