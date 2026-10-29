import './plot-settings.css';
import {parseEngineeringValue} from './properties-dialog.ts';

export type PlotAxisSettings={
 title:string;
 min:number|null;
 max:number|null;
 ticks:number;
 scale:'linear'|'log';
 format:'engineering'|'decimal'|'exponential';
 precision:number;
 divisor:number;
 rounded:boolean;
};

export function defaultPlotAxis(title:string):PlotAxisSettings {
 return {title,min:null,max:null,ticks:5,scale:'linear',format:'engineering',precision:2,divisor:1,rounded:true};
}

const esc=(value:string)=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

// TINA-UI: window=plot-axis; status=partial; full-parity-checks=0 (полная приёмка не подтверждена).
// Осталось: Проверить все native-поля, формат чисел и сохранение графика. Реестр и правила проверки: docs/UI_WINDOWS.md.
export function showPlotAxisDialog(dialog:HTMLDialogElement,axis:PlotAxisSettings,onApply:(next:PlotAxisSettings)=>void):void {
 dialog.classList.add('modal','plot-axis-dialog');
 dialog.setAttribute('aria-label','Настройка осей');
 dialog.innerHTML=`<header><span>Настройка осей</span><button type="button" class="plot-axis-close" aria-label="Закрыть" data-cancel>×</button></header>
  <form class="plot-axis-form" novalidate>
   <div class="plot-axis-content">
    <fieldset><legend>Метки</legend>
     <div class="plot-axis-grid plot-axis-labels"><label for="axis-title">Текст:</label><input id="axis-title" name="title" type="text" value="${esc(axis.title)}" autocomplete="off"><button type="button" disabled>Шрифт…</button><span class="plot-axis-font">Name: Arial Размер: 12 Style: Normal</span></div>
    </fieldset>
    <fieldset><legend>Числа</legend>
     <div class="plot-axis-grid">
      <label for="axis-format">Формат:</label><select id="axis-format" name="format"><option value="engineering">Инженерный</option><option value="decimal">Десятичный</option><option value="exponential">Экспоненциальный</option></select>
      <label for="axis-divisor">Делить на коэфф.:</label><input id="axis-divisor" name="divisor" type="number" step="any" value="${axis.divisor}">
      <label for="axis-precision">Точность:</label><input id="axis-precision" name="precision" type="number" min="0" max="10" step="1" value="${axis.precision}">
      <button type="button" disabled>Шрифт…</button><span class="plot-axis-font">Name: Arial Размер: 12 Стиль: Italic</span>
     </div>
    </fieldset>
    <fieldset><legend>Масштаб</legend>
     <div class="plot-axis-grid plot-axis-scale">
      <label for="axis-scale">Масштаб:</label><select id="axis-scale" name="scale"><option value="linear">Линейный</option><option value="log">Логарифмический</option></select>
      <label for="axis-ticks">Отметки:</label><input id="axis-ticks" name="ticks" type="number" min="2" max="30" step="1" value="${axis.ticks}">
      <label for="axis-min">Нижний предел:</label><input id="axis-min" name="min" type="text" inputmode="decimal" value="${axis.min===null?'':axis.min}" placeholder="Авто" autocomplete="off">
      <label for="axis-max">Верхний предел:</label><input id="axis-max" name="max" type="text" inputmode="decimal" value="${axis.max===null?'':axis.max}" placeholder="Авто" autocomplete="off">
     </div>
    </fieldset>
    <label class="plot-axis-check disabled"><input type="checkbox" disabled>При изменении размера окна, изменять настройки размера</label>
    <label class="plot-axis-check"><input type="checkbox" name="rounded" ${axis.rounded?'checked':''}>Округленный масштаб осей</label>
    <p class="plot-axis-error" role="alert" aria-live="polite"></p>
   </div>
   <footer><button type="submit">ОК</button><button type="button" data-cancel>Отмена</button><button type="button" disabled>Помощь</button></footer>
  </form>`;

 const form=dialog.querySelector<HTMLFormElement>('form')!;
 const close=()=>{if(dialog.open)dialog.close();};
 dialog.querySelectorAll<HTMLButtonElement>('[data-cancel]').forEach(button=>button.onclick=close);
 form.onsubmit=event=>{
  event.preventDefault();
  const error=dialog.querySelector<HTMLElement>('.plot-axis-error')!;
  try {
   const fd=new FormData(form), val=(key:string)=>String(fd.get(key)??'').trim();
   const parseOptional=(key:string):number|null=>val(key)===''?null:parseEngineeringValue(val(key));
   const min=parseOptional('min'),max=parseOptional('max');
   const ticks=Number(val('ticks')),precision=Number(val('precision')),divisor=Number(val('divisor'));
   if(!Number.isInteger(ticks)||ticks<2||ticks>30)throw Error('Число отметок должно быть целым от 2 до 30');
   if(!Number.isInteger(precision)||precision<0||precision>10)throw Error('Точность должна быть целым числом от 0 до 10');
   if(!Number.isFinite(divisor)||divisor<=0)throw Error('Делитель должен быть конечным числом больше нуля');
   if(min!==null&&max!==null&&min>=max)throw Error('Нижний предел должен быть меньше верхнего');
   const scale=val('scale') as PlotAxisSettings['scale'];
   if(scale==='log'&&((min!==null&&min<=0)||(max!==null&&max<=0)))throw Error('Для логарифмического масштаба пределы должны быть больше нуля');
   const format=val('format') as PlotAxisSettings['format'];
   if(!['linear','log'].includes(scale)||!['engineering','decimal','exponential'].includes(format))throw Error('Выберите допустимый масштаб и формат чисел');
   const next:PlotAxisSettings={title:val('title'),min,max,ticks,scale,format,precision,divisor,rounded:fd.get('rounded')==='on'};
   error.textContent='';onApply(next);close();
  }catch(reason){error.textContent=reason instanceof Error?reason.message:String(reason);}
 };
 if(!dialog.isConnected)document.body.append(dialog);
 dialog.showModal();
 dialog.querySelector<HTMLInputElement>('#axis-title')?.focus();
}
