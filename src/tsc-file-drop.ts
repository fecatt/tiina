/** Installs page-wide TSC file dropping and returns a listener cleanup function. */
export function installTscFileDrop(
  target:HTMLElement,
  onFiles:(files:File[])=>Promise<void>,
  onError:(error:unknown)=>void,
):()=>void {
  const overlay=document.createElement('div');
  overlay.setAttribute('role','status');
  overlay.setAttribute('aria-live','polite');
  overlay.textContent='Отпустите файл TINA (.TSC), чтобы открыть';
  Object.assign(overlay.style,{
    position:'fixed',inset:'12px',zIndex:'2147483647',display:'none',
    alignItems:'center',justifyContent:'center',pointerEvents:'none',
    border:'2px dashed var(--ui-muted, #5f6368)',borderRadius:'var(--ui-radius, 6px)',
    background:'color-mix(in srgb, var(--ui-chrome, #f8f9fa) 88%, transparent)',
    color:'var(--ui-ink, #202124)',font:'600 18px Arial, sans-serif',textAlign:'center',
  });
  target.append(overlay);
  let queue=Promise.resolve();
  let disposed=false;
  const hasFiles=(event:DragEvent)=>Array.from(event.dataTransfer?.types??[]).includes('Files');
  const show=()=>{overlay.style.display='flex';};
  const hide=()=>{overlay.style.display='none';};
  const enter=(event:DragEvent)=>{if(!hasFiles(event))return;event.preventDefault();show();};
  const over=(event:DragEvent)=>{
    if(!hasFiles(event))return;
    event.preventDefault();
    if(event.dataTransfer)event.dataTransfer.dropEffect='copy';
    show();
  };
  const leave=(event:DragEvent)=>{
    if(!hasFiles(event))return;
    const related=event.relatedTarget;
    if((related instanceof Node&&!document.documentElement.contains(related))||
      (event.clientX<=0||event.clientY<=0||event.clientX>=innerWidth||event.clientY>=innerHeight))hide();
  };
  const drop=(event:DragEvent)=>{
    if(!hasFiles(event))return;
    event.preventDefault();
    hide();
    const files=Array.from(event.dataTransfer?.files??[]);
    if(!files.length)return;
    const supported=files.filter(file=>file.name.toLowerCase().endsWith('.tsc'));
    const unsupported=files.filter(file=>!file.name.toLowerCase().endsWith('.tsc'));
    if(unsupported.length)onError(new Error(`Поддерживаются только файлы TINA .TSC: ${unsupported.map(file=>file.name).join(', ')}`));
    if(!supported.length)return;
    queue=queue.then(async()=>{
      for(const file of supported){
        if(disposed)return;
        try{await onFiles([file]);}catch(error){onError(error);}
      }
    }).catch(onError);
  };
  const blur=()=>hide();
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')hide();};
  window.addEventListener('dragenter',enter);
  window.addEventListener('dragover',over);
  window.addEventListener('dragleave',leave);
  window.addEventListener('drop',drop);
  window.addEventListener('blur',blur);
  window.addEventListener('dragend',blur);
  window.addEventListener('keydown',escape);
  return()=>{
    disposed=true;hide();overlay.remove();
    window.removeEventListener('dragenter',enter);
    window.removeEventListener('dragover',over);
    window.removeEventListener('dragleave',leave);
    window.removeEventListener('drop',drop);
    window.removeEventListener('blur',blur);
    window.removeEventListener('dragend',blur);
    window.removeEventListener('keydown',escape);
  };
}
