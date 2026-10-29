// TINA-UI: window=shared-controls; status=partial; full-parity-checks=0; scenario-checks=1 (work/shared-controls/check.mjs; 2026-10-28).
// Ordinary single-select dropdowns and single-selection listboxes use shared theme controls; multi-selects remain native.
const SELECTOR = 'select:not([multiple])';
type Control = { select: HTMLSelectElement; wrapper: HTMLElement; button: HTMLButtonElement; popup: HTMLElement; optionsObserver: MutationObserver; onChange: () => void; onInvalid: () => void; oldAriaHidden: string | null; oldTabindex: string | null; open: boolean; active: number; typeahead: string; typeaheadTimer: number };
const controls = new Map<HTMLSelectElement, Control>();
const byWrapper = new Map<HTMLElement, Control>();
let lifecycleObserver: MutationObserver | undefined;

function labelFor(select: HTMLSelectElement): string {
  const aria = select.getAttribute('aria-label');
  if (aria) return aria;
  const label = select.labels?.[0];
  if (!label) return 'Выберите значение';
  const copy = label.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('select').forEach(el => el.remove());
  return copy.textContent?.trim().replace(/\s+/g, ' ') || 'Выберите значение';
}

function installSelect(select: HTMLSelectElement): void {
  if (controls.has(select) || select.dataset.customControl === 'true') return;
  select.dataset.customControl = 'true';
  const computed = getComputedStyle(select);
  const wrapper = document.createElement('span');
  wrapper.className = 'custom-select';
  for (const prop of ['width','min-width','max-width','height','min-height','max-height','flex','flex-grow','flex-shrink','flex-basis','align-self']) {
    const value = computed.getPropertyValue(prop);
    if (value && value !== 'auto' && value !== 'normal') wrapper.style.setProperty(prop, value);
  }
  select.parentNode?.insertBefore(wrapper, select);
  wrapper.append(select);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'custom-select-button';
  button.setAttribute('role', 'combobox');
  button.setAttribute('aria-haspopup', 'listbox');
  button.setAttribute('aria-expanded', 'false');
  const popup = document.createElement('div');
  popup.className = 'custom-select-popup';
  popup.setAttribute('role', 'listbox');
  popup.tabIndex = 0;
  wrapper.append(button, popup);

  const control: Control = {select, wrapper, button, popup, optionsObserver: new MutationObserver(()=>{}), onChange:()=>{}, onInvalid:()=>{}, oldAriaHidden:select.getAttribute('aria-hidden'), oldTabindex:select.getAttribute('tabindex'), open:false, active:-1, typeahead:'', typeaheadTimer:0};
  controls.set(select, control); byWrapper.set(wrapper, control);
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;
  const options = () => [...select.options].filter(option => !option.hidden);
  const current = () => options().findIndex(option => option === select.selectedOptions[0]);
  function syncSelection() {
    button.textContent = select.selectedOptions[0]?.label ?? '';
    popup.querySelectorAll<HTMLElement>('.custom-select-option').forEach((item,index)=>{
      const option=options()[index], selected=option===select.selectedOptions[0];
      item.setAttribute('aria-selected',String(selected)); item.classList.toggle('selected',selected);
    });
  }
  const listbox = () => select.size > 1;
  function setActive(index: number) {
    const list = options();
    if (!list.length) { control.active = -1; (listbox() ? popup : button).removeAttribute('aria-activedescendant'); return; }
    control.active = Math.max(0, Math.min(index, list.length - 1));
    (listbox() ? popup : button).setAttribute('aria-activedescendant', `${popup.id}-option-${control.active}`);
    popup.querySelectorAll('.custom-select-option').forEach((el, i) => el.classList.toggle('active', i === control.active));
    popup.children[control.active]?.scrollIntoView({block:'nearest'});
  }
  function redraw() {
    const items = options(), isListbox = listbox(), label = labelFor(select);
    wrapper.classList.toggle('listbox', isListbox);
    button.hidden = isListbox;
    popup.classList.toggle('always-open', isListbox);
    popup.setAttribute('aria-label', label);
    button.textContent = select.selectedOptions[0]?.label ?? '';
    button.disabled = select.matches(':disabled');
    button.setAttribute('aria-required', String(select.required));
    popup.setAttribute('aria-required', String(select.required));
    popup.setAttribute('aria-disabled', String(select.matches(':disabled')));
    button.title = select.title;
    button.setAttribute('aria-label', label);
    popup.id ||= `custom-select-${Math.random().toString(36).slice(2)}`;
    button.setAttribute('aria-controls', popup.id);
    const optionElements=items.map((option, index) => {
      const item = (popup.children[index] as HTMLElement|undefined) ?? document.createElement('div');
      item.className = 'custom-select-option'; item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option === select.selectedOptions[0]));
      const disabled = option.disabled || (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled);
      item.setAttribute('aria-disabled', String(disabled)); item.id = `${popup.id}-option-${index}`; item.textContent = option.label;
      item.classList.toggle('selected',option === select.selectedOptions[0]);
      return item;
    });
    if(popup.children.length!==optionElements.length||optionElements.some((item,index)=>popup.children[index]!==item))popup.replaceChildren(...optionElements);
    if (isListbox) setActive(control.active >= 0 ? control.active : current());
    else if (control.open) setActive(control.active >= 0 ? control.active : current());
  }
  function close(restoreFocus = false) {
    control.open = false; wrapper.classList.remove('open'); button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus();
  }
  function show() {
    if (select.matches(':disabled') || !options().length) return;
    control.open = true; control.active = current(); wrapper.classList.add('open'); button.setAttribute('aria-expanded', 'true'); redraw();
    const rect = button.getBoundingClientRect();
    popup.classList.toggle('opens-up', window.innerHeight - rect.bottom < Math.min(240, options().length * 34 + 8) && rect.top > window.innerHeight - rect.bottom);
    setActive(control.active);
  }
  function commit(index: number) {
    const option = options()[index];
    if (!option || option.disabled || (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled) || select.matches(':disabled')) return;
    select.value = option.value;
    select.dispatchEvent(new Event('input', {bubbles:true})); select.dispatchEvent(new Event('change', {bubbles:true}));
    syncSelection();
    if (listbox()) setActive(index); else close(true);
  }
  function step(direction: number) {
    const items = options(); let next = control.active < 0 ? current() : control.active;
    for (let i=0;i<items.length;i++) {
      next = (next + direction + items.length) % items.length;
      const option=items[next];
      if (!option.disabled && !(option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled)) { setActive(next); return; }
    }
  }
  function handleKey(event: KeyboardEvent) {
    const isListbox = listbox();
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); if (isListbox) step(event.key === 'ArrowDown' ? 1 : -1); else if (!control.open) show(); else step(event.key === 'ArrowDown' ? 1 : -1); }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); if (!isListbox && !control.open) show(); setActive(event.key === 'Home' ? 0 : options().length - 1); }
    else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (isListbox) commit(control.active); else if (control.open) commit(control.active); else show(); }
    else if (event.key === 'Escape' && (isListbox || control.open)) { event.preventDefault(); if (!isListbox) close(); }
    else if (event.key === 'Tab' && control.open) close();
    else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      control.typeahead += event.key.toLocaleLowerCase(); window.clearTimeout(control.typeaheadTimer); control.typeaheadTimer = window.setTimeout(()=>control.typeahead='',700);
      const items=options(), start=Math.max(0,current()+1), found=[...items.slice(start),...items.slice(0,start)].findIndex(o=>o.label.toLocaleLowerCase().startsWith(control.typeahead));
      if (found >= 0) { const index=(start+found)%items.length; if (isListbox || control.open) setActive(index); else commit(index); }
    }
  }
  button.addEventListener('click',()=>control.open?close():show()); button.addEventListener('keydown',handleKey);
  popup.addEventListener('keydown',event=>{if(listbox())handleKey(event);});
  popup.addEventListener('mousedown',event=>event.preventDefault());
  popup.addEventListener('click',event=>{const item=(event.target as HTMLElement).closest<HTMLElement>('[role="option"]');if(item){const index=[...popup.children].indexOf(item);commit(index);if(listbox())popup.focus();}});
  popup.addEventListener('dblclick',event=>{if(listbox()&&(event.target as HTMLElement).closest('[role="option"]'))select.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));});
  control.onChange=syncSelection; select.addEventListener('change',control.onChange);
  control.onInvalid=()=>button.focus(); select.addEventListener('invalid',control.onInvalid);
  control.optionsObserver=new MutationObserver(redraw); control.optionsObserver.observe(select,{attributes:true,childList:true,subtree:true,characterData:true});
  redraw();
}

function dispose(control: Control) {
  control.optionsObserver.disconnect(); control.select.removeEventListener('change',control.onChange); control.select.removeEventListener('invalid',control.onInvalid); window.clearTimeout(control.typeaheadTimer);
  if (control.oldAriaHidden === null) control.select.removeAttribute('aria-hidden'); else control.select.setAttribute('aria-hidden',control.oldAriaHidden);
  if (control.oldTabindex === null) control.select.removeAttribute('tabindex'); else control.select.setAttribute('tabindex',control.oldTabindex);
  delete control.select.dataset.customControl; controls.delete(control.select); byWrapper.delete(control.wrapper);
}

export function initializeCustomControls(): void {
  document.querySelectorAll<HTMLSelectElement>(SELECTOR).forEach(installSelect);
  document.addEventListener('pointerdown',event=>{for(const control of controls.values())if(control.open&&!control.wrapper.contains(event.target as Node)){control.open=false;control.wrapper.classList.remove('open');control.button.setAttribute('aria-expanded','false');}});
  lifecycleObserver=new MutationObserver(records=>{
    const removed: Control[]=[];
    for(const record of records){
      if(record.type==='attributes' && record.target instanceof Element && record.attributeName==='disabled'){
        const scope=record.target; scope.querySelectorAll<HTMLSelectElement>(`${SELECTOR}[data-custom-control="true"]`).forEach(select=>controls.get(select) && redrawControl(select));
      }
      for(const node of record.addedNodes)if(node instanceof Element){if(node instanceof HTMLSelectElement&&node.matches(SELECTOR))installSelect(node);node.querySelectorAll<HTMLSelectElement>(SELECTOR).forEach(installSelect);}
      for(const node of record.removedNodes)if(node instanceof Element){if(node instanceof HTMLSelectElement){const c=controls.get(node);if(c)removed.push(c);}node.querySelectorAll<HTMLSelectElement>('[data-custom-control="true"]').forEach(select=>{const c=controls.get(select);if(c)removed.push(c);});}
    }
    queueMicrotask(()=>removed.forEach(control=>{if(!control.wrapper.isConnected)dispose(control);}));
  });
  lifecycleObserver.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled']});
}

function redrawControl(select: HTMLSelectElement) {
  const control=controls.get(select); if(!control)return;
  control.button.disabled=select.matches(':disabled'); control.popup.setAttribute('aria-disabled',String(select.matches(':disabled')));
}
