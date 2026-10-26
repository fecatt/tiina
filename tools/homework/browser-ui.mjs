import path from 'node:path';
export function createWorkflow(page,root,cfg){
const menu=async(label,action)=>{await page.locator('.menu summary').filter({hasText:new RegExp('^'+label+'$')}).click();const target=page.locator(`.menu button[data-action="${action}"]`);const parent=target.locator('xpath=ancestor::div[contains(@class,"menu-submenu")][1]');if(await parent.count())await parent.locator(':scope > button').first().hover();await target.click();};
const point=(x,y)=>page.locator('#field').evaluate((el,p)=>{const m=el.getScreenCTM();return{x:m.a*p[0]+m.c*p[1]+m.e,y:m.b*p[0]+m.d*p[1]+m.f};},[x,y]);
const click=async(x,y,options)=>{const p=await point(x,y);if(options?.modifiers)for(const key of options.modifiers)await page.keyboard.down(key);await page.mouse.click(p.x,p.y);if(options?.modifiers)for(const key of options.modifiers)await page.keyboard.up(key);};
async function component(kind,x,y,rotation,label,value,offset){
 await page.locator('.category[data-category="'+({NPN:'Полупроводники',I:'Источники',AM:'Измерительные приборы',VM:'Измерительные приборы',VG:'Источники'}[kind]??'Основные')+'"]').click();await page.locator('#component-picker').selectOption(kind);for(let i=0;i<(rotation-(['VS','VG'].includes(kind)?3:0)+4)%4;i++)await page.locator('.toolbar [data-action=rotate]').click();await click(x,y);
 if(kind==='GND')return;
 await page.locator('.toolbar [data-action=properties]').click();const dialog=page.locator('.component-dialog[open]').last();await dialog.locator('[name=label]').fill(label);
 if(value!==undefined)await dialog.locator('[name=value]').fill(String(value));
 if(kind==='VG'){await dialog.locator('[data-generator]').click();const signal=page.locator('.component-dialog[open]').last();await signal.locator('[name=waveform]').selectOption('sine');for(const [key,val] of Object.entries({amplitude:'5m',frequency:'1000',phase:'0',resistance:'0'}))await signal.locator(`[name=${key}]`).fill(val);await signal.locator('button[type=submit]').click();}
 if(kind==='NPN'){await dialog.locator('[data-model]').click();const catalog=page.locator('.catalog-dialog[open]');await catalog.locator('[data-search]').fill(cfg.model);await catalog.locator('[data-types]').selectOption(cfg.model);await catalog.locator('button[type=submit]').click();}
 await dialog.locator('button[type=submit]').click();
 if(offset){const form=page.locator('#props-form');await form.locator('[name=label_dx]').fill(String(offset[0]));await form.locator('[name=label_dy]').fill(String(offset[1]));await form.locator('button[type=submit]').click();}
}
async function wire(points){await page.locator('.toolbar [data-action=wire]').click();for(let i=0;i<points.length;i++)await click(...points[i],i>0&&i<points.length-1?{modifiers:['Shift']}:undefined);await page.keyboard.press('Escape');}
async function save(stem){await menu('Файл','save-as');const dialog=page.locator('#dialog[open]');await dialog.locator('[name=filename]').fill(cfg.model+'_'+stem);const download=page.waitForEvent('download');await dialog.locator('button[type=submit]').click();await(await download).saveAs(path.join(root,'Browser',cfg.model+'_'+stem+'.TSC'));}
async function configureControl(x,y,start,stop,count,stem){await page.locator('.toolbar [data-action=control-object]').click();await click(x,y);const dialog=page.locator('dialog.native-analysis-dialog[open]');await dialog.locator('[data-next]').click();await dialog.locator('[name=start]').fill(String(start));await dialog.locator('[name=stop]').fill(String(stop));await dialog.locator('[name=count]').fill(String(count));await dialog.screenshot({path:path.join(root,'graphs','browser-'+stem+'-control.png')});await dialog.locator('button[type=submit]').click();}
async function analyze(stem,stop,axisY){
 await page.locator('.menu summary').filter({hasText:/^Анализ$/}).click();await page.locator('.menu-submenu>button').filter({hasText:'Анализ постоянного тока'}).hover();await page.locator('.menu button[data-action="analysis:dc"]').click();
 const dialog=page.locator('dialog.native-analysis-dialog[open]');await dialog.locator('[name=start]').fill(stem==='output'?'0':String(cfg.inputStart));await dialog.locator('[name=stop]').fill(String(stop));await dialog.locator('[name=intervals]').fill('500');await dialog.locator('[name=input]').selectOption('VS1');await dialog.screenshot({path:path.join(root,'graphs','browser-'+stem+'-analysis.png')});await dialog.locator('button[type=submit]').click();
 await page.locator('#vector').waitFor({timeout:30000});await page.locator('#vector').selectOption('i(vam_am1)');
 for(const [axis,title,min,max,ticks] of [['y',stem==='output'?'Ток коллектора, Iк (A)':'Ток базы, Iб (A)',0,axisY,stem==='output'?7:6],['x',stem==='output'?'Напряжение коллектор-эмиттер, Uкэ (V)':'Напряжение база-эмиттер, Uбэ (V)',stem==='output'?0:cfg.inputStart,stem==='output'?cfg.outputStop:cfg.inputStop,stem==='output'?12:5]]){
  await page.locator('#axis-'+axis).click();const d=page.locator('.plot-axis-dialog[open]');await d.locator('[name=title]').fill(title);await d.locator('[name=min]').fill(String(min));await d.locator('[name=max]').fill(String(max));await d.locator('[name=ticks]').fill(String(ticks));await d.locator('[name=rounded]').uncheck();await d.locator('button[type=submit]').click();
 }
 await page.locator('#plot').screenshot({path:path.join(root,'graphs','browser-'+stem+'.png')});
 for(const [button,extension] of [['#result-text','txt'],['#plot-svg','svg']]){const event=page.waitForEvent('download');await page.locator(button).click();await(await event).saveAs(path.join(root,'Browser',cfg.model+'_'+stem+'.'+extension));}
 await save(stem);
}

async function exportPlot(stem){await page.locator('#cancel').waitFor({state:'hidden',timeout:60000});await page.locator('#vector').waitFor({timeout:30000});await page.locator('#vector').selectOption('v(vm_vout)');await page.locator('#plot').screenshot({path:path.join(root,'graphs','browser-amplifier-'+stem+'.png')});const event=page.waitForEvent('download');await page.locator('#result-text').click();await(await event).saveAs(path.join(root,'Browser',cfg.model+'_amplifier_'+stem+'.txt'));}
async function analysisMenu(action){await page.locator('.menu summary').filter({hasText:/^Анализ$/}).click();const target=page.locator('.menu button[data-action="analysis:'+action+'"]');const parent=target.locator('xpath=ancestor::div[contains(@class,"menu-submenu")][1]');if(await parent.count())await parent.locator(':scope > button').first().hover();await target.click();}

return {menu,click,component,wire,save,configureControl,analyze,exportPlot,analysisMenu};
}
