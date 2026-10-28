import {parseEngineeringValue} from './properties-dialog.ts';
import './native-analysis-dialogs.css';

export interface BjtAutoOptions {
  uceMax_V: number;
  icMax_A: number;
  pCollectorMax_W: number;
  cases: number;
}

export interface BjtAutoDefaults {
  uceMax_V?: number;
  icMax_A?: number;
  pCollectorMax_W?: number;
  cases?: number;
  ratingSource?: string;
}

const esc=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

/** Opens the BJT automatic curve setup dialog. The callback reports progress while it runs. */
export function showBjtAutoDialog(
  dialog:HTMLDialogElement,
  defaults:BjtAutoDefaults,
  onApply:(options:BjtAutoOptions,report:(text:string)=>void)=>Promise<void>,
):void {
  const title='Подобрать значения';
  dialog.classList.add('modal','native-analysis-dialog');
  dialog.setAttribute('aria-label',title);
  if(!dialog.isConnected)document.body.append(dialog);
  const value=(key:keyof BjtAutoOptions,fallback?:number)=>esc(defaults[key]??fallback??'');
  dialog.innerHTML=`<header><span>${title}</span></header><form novalidate>
    <section class="native-analysis-content">
      <p style="margin:0;font-size:13px;line-height:1.45">Кнопка подберёт реальный размах тока базы для построения семейства с помощью моделирования, а пределы осей установит по допустимым значениям прибора. Используется модель, выбранная в текущей схеме. Сверьте значения с полями паспорта производителя. Семейство характеризует модель; рабочие режимы выбираются внутри границы PК max/UКЭ.</p><p>${esc(defaults.ratingSource??'Проверенного паспорта для этой модели в каталоге пока нет. Введите пределы своего прибора.')}</p>
      <fieldset><div class="native-analysis-grid">
        <label for="bjt-auto-uce">UКЭ max, В</label><input id="bjt-auto-uce" name="uceMax_V" value="${value('uceMax_V')}" autocomplete="off">
        <label for="bjt-auto-ic">IК max, А</label><input id="bjt-auto-ic" name="icMax_A" value="${value('icMax_A')}" autocomplete="off">
        <label for="bjt-auto-power">PК max, Вт</label><input id="bjt-auto-power" name="pCollectorMax_W" value="${value('pCollectorMax_W')}" autocomplete="off">
        <label for="bjt-auto-cases">Число характеристик</label><input id="bjt-auto-cases" name="cases" inputmode="numeric" value="${value('cases',11)}">
      </div></fieldset>
    </section><p class="native-analysis-error" role="alert" aria-live="polite"></p>
    <footer><button type="submit" class="primary">Подобрать</button><button type="button" data-cancel>Отмена</button></footer>
  </form>`;

  const form=dialog.querySelector<HTMLFormElement>('form')!;
  const status=dialog.querySelector<HTMLElement>('.native-analysis-error')!;
  const apply=form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const cancel=form.querySelector<HTMLButtonElement>('[data-cancel]')!;
  let busy=false;
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  cancel.addEventListener('click',()=>{if(!busy&&dialog.open)dialog.close();});
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(busy)return;
    status.textContent='';
    try {
      const fd=new FormData(form);
      const uceMax_V=parseEngineeringValue(String(fd.get('uceMax_V')??''));
      const icMax_A=parseEngineeringValue(String(fd.get('icMax_A')??''));
      const pCollectorMax_W=parseEngineeringValue(String(fd.get('pCollectorMax_W')??''));
      const cases=Number(String(fd.get('cases')??''));
      if(!(Number.isFinite(uceMax_V)&&uceMax_V>0))throw Error('UКЭ max должно быть больше нуля');
      if(!(Number.isFinite(icMax_A)&&icMax_A>0))throw Error('IК max должно быть больше нуля');
      if(!(Number.isFinite(pCollectorMax_W)&&pCollectorMax_W>0))throw Error('PК max должно быть больше нуля');
      if(!Number.isInteger(cases)||cases<3||cases>31)throw Error('Число характеристик должно быть целым от 3 до 31');
      busy=true;apply.disabled=true;cancel.disabled=true;
      await onApply({uceMax_V,icMax_A,pCollectorMax_W,cases},text=>{status.textContent=text;});
      if(dialog.open)dialog.close();
    } catch(error) {
      status.textContent=error instanceof Error?error.message:String(error);
    } finally {
      busy=false;apply.disabled=false;cancel.disabled=false;
    }
  });
  if(!dialog.open)dialog.showModal();
}
