type Position = {x:number;y:number;time:number};
type Level = {active:HTMLElement|null;pending:HTMLElement|null;timer:ReturnType<typeof setTimeout>|null;anchor:Position|null};
const installed = new WeakMap<HTMLElement,()=>void>();

/** Keep an open branch while the pointer travels through its neighbours toward it. */
export function initializeMenuIntent(root:HTMLElement):()=>void {
 installed.get(root)?.();
 const controller=new AbortController(),options={signal:controller.signal};
 const levels=new Map<HTMLElement,Level>();
 let history:Position[]=[],keyboard=false,suppressFocus=false;
 const panelOf=(row:HTMLElement)=>row.parentElement!;
 const submenu=(row:HTMLElement|null)=>row?.classList.contains('menu-submenu')?row.querySelector<HTMLElement>(':scope > .dropdown')??null:null;
 const state=(panel:HTMLElement)=>{let s=levels.get(panel);if(!s){s={active:null,pending:null,timer:null,anchor:null};levels.set(panel,s);}return s;};
 const cancel=(s:Level)=>{if(s.timer!==null)clearTimeout(s.timer);s.timer=null;s.pending=null;};
 const close=(panel:HTMLElement)=>{
  const s=levels.get(panel);if(!s)return;cancel(s);
  if(s.active){const child=submenu(s.active);if(child)close(child);s.active.classList.remove('menu-active','submenu-open');s.active.querySelector(':scope > button')?.setAttribute('aria-expanded','false');}
  s.active=null;s.anchor=null;
 };
 const reset=()=>{for(const panel of levels.keys())close(panel);history=[];};
 const place=(row:HTMLElement,drop:HTMLElement)=>{
  // Open first: hidden dropdowns have zero dimensions on their first hover.
  row.classList.add('submenu-open');
  const rect=row.getBoundingClientRect(),width=drop.offsetWidth,height=drop.offsetHeight;
  const right=rect.right-2,left=rect.left-width+2;
  const x=right+width<=innerWidth-4?right:left>=4?left:Math.max(4,innerWidth-width-4);
  drop.style.left=x+'px';drop.style.top=Math.max(4,Math.min(rect.top,innerHeight-height-4))+'px';
 };
 const activate=(panel:HTMLElement,row:HTMLElement|null,point:Position|null=null)=>{
  const s=state(panel);cancel(s);
  if(s.active!==row){close(panel);s.active=row;row?.classList.add('menu-active');}
  s.anchor=point;
  const drop=submenu(row);if(row&&drop){place(row,drop);row.querySelector(':scope > button')?.setAttribute('aria-expanded','true');}
 };
 const aiming=(s:Level,p:Position)=>{
  const drop=submenu(s.active),a=s.anchor;if(!drop||!a||p.time-a.time>500)return false;
  const bounds=drop.getBoundingClientRect(),row=s.active!.getBoundingClientRect();
  const right=bounds.left>=row.left,edge=right?bounds.left:bounds.right,dx=edge-a.x;
  const previous=history.slice(0,-1).reverse().find(old=>old.x!==p.x||old.y!==p.y);
  if(previous&&(p.x-previous.x)*dx<0)return false;
  if(Math.abs(dx)<1||(p.x-a.x)*dx<=0||Math.abs(edge-p.x)>=Math.abs(dx))return false;
  const t=(p.x-a.x)/dx;
  const top=a.y+(bounds.top-8-a.y)*t,bottom=a.y+(bounds.bottom+8-a.y)*t;
  return t>=0&&t<=1&&p.y>=top&&p.y<=bottom;
 };
 const rowAt=(target:Element,panel:HTMLElement)=>{let row:HTMLElement|null=target as HTMLElement;while(row&&row.parentElement!==panel)row=row.parentElement;return row?.matches('button,.menu-submenu')?row:null;};
 const hover=(event:PointerEvent)=>{
  if(event.pointerType==='touch'||!(event.target instanceof Element))return;
  const p={x:event.clientX,y:event.clientY,time:performance.now()};
  history=history.filter(old=>p.time-old.time<160);history.push(p);
  const panel=event.target.closest<HTMLElement>('.dropdown');if(!panel||!root.contains(panel))return;
  // Reaching the intended child cancels every sibling switch queued on its ancestors.
  let parent=panel.parentElement;
  while(parent&&parent!==root){if(parent.classList.contains('menu-submenu'))cancel(state(panelOf(parent)));parent=parent.parentElement;}
  const row=rowAt(event.target,panel),s=state(panel);
  if(row===s.active){cancel(s);s.anchor=history[0]??p;return;}
  if(aiming(s,p)){
   if(s.timer!==null){s.pending=row;return;}
   cancel(s);s.pending=row;
   s.timer=setTimeout(()=>{const pending=s.pending;s.timer=null;if(root.isConnected&&panel.closest('details')?.hasAttribute('open'))activate(panel,pending,p);},300);
  }else activate(panel,row,p);
 };
 root.querySelectorAll('.menu-submenu > button').forEach(button=>button.setAttribute('aria-expanded','false'));
 root.addEventListener('pointerover',hover,options);
 root.addEventListener('pointermove',hover,options);
 root.addEventListener('pointerleave',reset,options);
 root.addEventListener('pointerdown',()=>{keyboard=false;},options);
 root.addEventListener('focusin',event=>{
  if(!keyboard||suppressFocus||!(event.target instanceof Element))return;
  const panel=event.target.closest<HTMLElement>('.dropdown');if(panel)activate(panel,rowAt(event.target,panel));
 },options);
 root.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLElement>('.menu-submenu > button');if(button){const row=button.parentElement!;activate(panelOf(row),row);}
 },options);
 const buttons=(panel:HTMLElement)=>Array.from(panel.querySelectorAll<HTMLButtonElement>(':scope > button:enabled,:scope > .menu-submenu > button:enabled'));
 root.addEventListener('keydown',event=>{
  keyboard=true;
  const target=event.target as HTMLElement,panel=target.closest<HTMLElement>('.dropdown');
  if(!['ArrowDown','ArrowUp','ArrowRight','ArrowLeft','Escape','Home','End'].includes(event.key))return;
  const details=target.closest<HTMLDetailsElement>('details');if(!details)return;
  if(!panel){if(event.key==='ArrowDown'||event.key==='ArrowUp'){details.open=true;const items=buttons(details.querySelector<HTMLElement>(':scope > .dropdown')!);(event.key==='ArrowUp'?items.at(-1):items[0])?.focus();}else if(event.key==='Escape'){details.open=false;reset();}else return;}
  else if(event.key==='ArrowDown'||event.key==='ArrowUp'||event.key==='Home'||event.key==='End'){
   const items=buttons(panel),index=items.indexOf(target as HTMLButtonElement);
   const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();
  }else if(event.key==='ArrowRight'){
   const row=rowAt(target,panel),drop=submenu(row);if(row&&drop){activate(panel,row);buttons(drop)[0]?.focus();}
  }else if(event.key==='ArrowLeft'||event.key==='Escape'){
   const parent=panel.parentElement!;
   if(parent.classList.contains('menu-submenu')){close(panelOf(parent));suppressFocus=true;parent.querySelector<HTMLButtonElement>(':scope > button')?.focus();suppressFocus=false;}
   else{details.open=false;reset();details.querySelector<HTMLElement>('summary')?.focus();}
  }
  event.preventDefault();event.stopPropagation();
 },{...options,capture:true});
 root.addEventListener('toggle',event=>{const details=event.target as HTMLDetailsElement;if(details.tagName==='DETAILS'&&!details.open){const panel=details.querySelector<HTMLElement>(':scope > .dropdown');if(panel)close(panel);}}, {...options,capture:true});
 root.addEventListener('scroll',()=>{for(const [panel,s] of levels)if(s.active){const drop=submenu(s.active);if(drop&&panel.closest('details')?.hasAttribute('open'))place(s.active,drop);}}, {...options,capture:true});
 window.addEventListener('blur',reset,options);window.addEventListener('resize',reset,options);
 const dispose=()=>{reset();controller.abort();installed.delete(root);};installed.set(root,dispose);return dispose;
}
