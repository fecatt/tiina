import './tool-help.css';
const help:Record<string,[string,string?]>={
 'insert:VS':['Источник напряжения задаёт напряжение в цепи; это не вольтметр. «+» указывает положительный вывод. После выбора щёлкните место установки.'],
 'insert:VM':['Вольтметр измеряет разность потенциалов между выводами: V(+) − V(−). Подключается параллельно участку цепи.'],
 'insert:AMV':['Амперметр включается последовательно. Положительное показание соответствует току, входящему в вывод «+».'],
 open:['Открыть схему TINA из файла .TSC.','Ctrl+O'],
 save:['Скачать текущую схему как .TSC для оригинальной TINA.','Ctrl+S'],
 'print-preview':['Посмотреть, как схема будет размещена на странице перед печатью.'],
 copy:['Скопировать выделенные компоненты, провода и текст.','Ctrl+C'],
 paste:['Вставить скопированные объекты на схему.','Ctrl+V'],
 select:['Выбирать и перемещать объекты. За линию перемещается провод, за чёрные точки — его отдельные участки.','Esc'],
 wire:['Соединить выводы. Щёлкните начало и конец; Shift задаёт изгиб, Backspace убирает его, Esc отменяет провод.','Ctrl+Space'],
 properties:['Открыть свойства выбранного объекта. У транзистора нажмите «Тип», чтобы выбрать модель в каталоге.'],
 text:['Открыть редактор текста. После ОК щёлкните на схеме, чтобы разместить надпись.','Ctrl+T'],
 junction:['Соединить или разъединить пересечение проводов. Выберите инструмент и щёлкните пересечение. Геометрическое пересечение само по себе не означает соединение.'],
 delete:['Удалить выделенные объекты. Отменить удаление можно командой «Отменить».','Delete'],
 undo:['Отменить последнее изменение схемы.','Ctrl+Z'],redo:['Повторить отменённое изменение.','Ctrl+Y'],
 rotate:['Повернуть выделенный компонент или вставляемый элемент налево на 90°. Выделенную подпись можно повернуть отдельно.','Ctrl+L'],
 'rotate-right':['Повернуть выделенный компонент или вставляемый элемент направо на 90°.','Ctrl+R'],
 mirror:['Отразить компонент зеркально.'],grid:['Показать или скрыть точки сетки.'],
 'zoom-window':['Обведите рамкой область схемы, которую нужно увеличить. Esc возвращает выбор.'],
};

/** One delegated help surface also covers dynamically rebuilt palette buttons. */
export function initializeToolHelp():void{
 const popup=document.createElement('div');popup.id='editor-tool-help';popup.className='tool-help';popup.setAttribute('role','tooltip');popup.hidden=true;document.body.append(popup);
 const titles=new WeakMap<HTMLElement,string>();let current:HTMLElement|null=null,timer:number|undefined,previousDescription:string|null=null;
 const hide=()=>{clearTimeout(timer);popup.hidden=true;if(current){if(previousDescription)current.setAttribute('aria-describedby',previousDescription);else current.removeAttribute('aria-describedby');}current=null;};
 const show=(element:HTMLElement,delay:number)=>{
  if(current===element)return;hide();current=element;previousDescription=element.getAttribute('aria-describedby');
  const title=titles.get(element)??element.getAttribute('title')??element.getAttribute('aria-label')??'';
  if(!title){current=null;return;}titles.set(element,title);element.removeAttribute('title');
  timer=window.setTimeout(()=>{
   if(current!==element||!element.isConnected)return;
   const action=element.dataset.action??'',disabled=element.matches(':disabled'),entry=help[action];
   const heading=document.createElement('strong');heading.textContent=title;const description=document.createElement('p');
   description.textContent=disabled?'Команда пока не перенесена и недоступна.':entry?.[0]??(action.startsWith('insert:')?'Выберите элемент, затем щёлкните на схеме, чтобы разместить его. R поворачивает элемент; Esc отменяет вставку.':title);
   popup.replaceChildren(heading,description);if(entry?.[1]){const key=document.createElement('kbd');key.textContent=entry[1];popup.append(key);}
   popup.hidden=false;element.setAttribute('aria-describedby',[previousDescription,popup.id].filter(Boolean).join(' '));
   const rect=element.getBoundingClientRect();popup.style.left=`${Math.max(8,Math.min(rect.left,window.innerWidth-popup.offsetWidth-8))}px`;popup.style.top=`${rect.bottom+8+popup.offsetHeight>innerHeight?Math.max(8,rect.top-popup.offsetHeight-8):rect.bottom+8}px`;
  },delay);
 };
 const target=(event:Event)=>(event.target as Element).closest<HTMLElement>('.toolbar button,.palette button,button[title]');
 document.addEventListener('pointerover',event=>{const element=target(event);if(element)show(element,450);});
 document.addEventListener('pointerout',event=>{if(current&&!current.contains(event.relatedTarget as Node))hide();});
 document.addEventListener('focusin',event=>{const element=target(event);if(element)show(element,150);});
 document.addEventListener('focusout',hide);document.addEventListener('pointerdown',hide);document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
 window.addEventListener('resize',hide);document.addEventListener('scroll',hide,true);
}
