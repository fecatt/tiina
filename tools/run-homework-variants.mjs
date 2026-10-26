// All schematic creation and saving is through the actual browser editor UI.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {decode,components} from '../src/codec.ts';
import {createWorkflow} from './homework/browser-ui.mjs';
import {prepareJobs} from '../src/solver.ts';
import {runJob} from '../tests/ngspice-runner.ts';
import {summarize} from './homework/summarize.mjs';
import {designFromModel,tuneCapacitors} from './homework/calculations.mjs';
const variants=JSON.parse(fs.readFileSync(new URL('./homework/models.json',import.meta.url)));
const approved=JSON.parse(fs.readFileSync(new URL('./homework/variants.json',import.meta.url)));
const args=process.argv.slice(2);
function captureNative(ids){
 if(!args.includes('--capture-native'))return;
 const python=process.env.TINA_PYTHON_BIN??(process.platform==='win32'?'python':'python3');
 const cmd=[fileURLToPath(new URL('./capture-homework-native.py',import.meta.url)),'--variants',ids.join(',')];
 for(const [flag,dest] of [['--native-pid','--pid'],['--native-exe','--exe']])if(args.includes(flag))cmd.push(dest,args[args.indexOf(flag)+1]);
 const run=spawnSync(python,cmd,{stdio:'inherit'});if(run.error)throw run.error;if(run.status!==0)throw Error('Native screenshot batch failed; inspect its manifest');
}

if(args.includes('--config'))Object.assign(approved,JSON.parse(fs.readFileSync(args[args.indexOf('--config')+1])));
if(args.includes('--list')){console.log(JSON.stringify(Object.entries(variants).map(([variant,model])=>({variant:+variant,model,approved:!!approved[variant]})),null,2));process.exit();}
if(args.includes('--variants')||args.includes('--all')){
 const selected=args.includes('--all')?Object.keys(variants):args[args.indexOf('--variants')+1].split(',');
 if(args.includes('--dry-run')){console.log(JSON.stringify(selected.map(id=>({variant:+id,model:variants[id],configuration:approved[id]??null})),null,2));process.exit();}
 const missing=selected.filter(id=>!approved[id]);if(missing.length)throw Error('Reviewed supply/current configurations required for variants: '+missing.join(', '));
 for(const id of selected){const childArgs=['--experimental-strip-types',process.argv[1],'--variant',id];if(args.includes('--config'))childArgs.push('--config',args[args.indexOf('--config')+1]);const r=spawnSync(process.execPath,childArgs,{stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);}captureNative(selected);process.exit();
}
const index=args.indexOf('--variant'),id=Number(index<0?3:args[index+1]),cfg={...approved[id],variant:id,model:variants[id]};
if(!cfg.model)throw Error('Unknown variant');
// New devices must first have reviewed manufacturer limits and design values.
if(!approved[id])throw Error(`Variant ${id} (${cfg.model}) needs an approved design record in approved. The shared UI geometry needs no changes.`);
if(args.includes('--dry-run')){console.log(JSON.stringify(cfg,null,2));process.exit();}
const root=path.resolve(`output/variant${String(id).padStart(2,'0')}`);for(const dir of ['Browser','graphs'])fs.mkdirSync(path.join(root,dir),{recursive:true});
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE??path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1550,height:1050}});page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const {menu,click,component,wire,save,configureControl,analyze,exportPlot,analysisMenu}=createWorkflow(page,root,cfg);
const layout=JSON.parse(fs.readFileSync(new URL('./homework/layout.json',import.meta.url)));
async function assemble(stem){for(const [kind,x,y,rotation,label,value,offset]of layout[stem].components)await component(kind,x,y,rotation,label,value??undefined,offset);for(const points of layout[stem].wires)await wire(points);}
async function blank(){await menu('Файл','new');await menu('Вид','panel');}
async function schematic(stem){await menu('Вид','panel');await page.locator('#schematic-page').screenshot({path:path.join(root,'graphs',`browser-${stem}-schematic.png`)});}
try{
 await page.goto(process.env.HOMEWORK_URL??'http://127.0.0.1:5173/');await menu('Вид','panel');
 await assemble('output');
 await configureControl(200,300,0,cfg.ibStop,11,'output');await schematic('output');await analyze('output',cfg.outputStop,cfg.axisOutput);
 await blank();
 await assemble('input');
 await schematic('input_5V');await analyze('input_5V',cfg.inputStop,cfg.axisInput);
 await menu('Вид','panel');await configureControl(480,228,1,cfg.supply,2,'input');await schematic('input');await analyze('input',cfg.inputStop,cfg.axisInput);
 await designFromModel(root,cfg);
 await blank();
 const recipe=layout.amplifier;
 const kinds={'87':'NPN','67':'V','9':'R','10':'C','16':'VG','2':'GND','5':'VM'};
 for(const [type,label,x,y,angle,value] of recipe.specs){const val=label==='VS1'?cfg.supply:cfg[label]??value;await component(kinds[type],x,y,angle===90?3:0,label,val??undefined,[20,-20]);}
 for(const points of recipe.wires)await wire(points);
 if(cfg.autoDesign){
  await save('amplifier');await tuneCapacitors(root,cfg);
  await page.locator('.toolbar [data-action=select]').click();
  for(const [x,y,value]of [[520,380,cfg.Ce],[220,240,cfg.Cp1]]){await click(x,y);await page.locator('.toolbar [data-action=properties]').click();const d=page.locator('.component-dialog[open]').last();await d.locator('[name=value]').fill(String(value));await d.locator('button[type=submit]').click();}
 }
 await schematic('amplifier');
 await analysisMenu('ac');let d=page.locator('.native-analysis-dialog[open]');await d.locator('[name=start]').fill('1');await d.locator('[name=stop]').fill('100MEG');await d.locator('[name=intervals]').fill('400');await d.locator('[name=logarithmic][value=log]').check();await d.locator('button[type=submit]').click();await exportPlot('ac-db');await page.locator('#plot-mode').selectOption('phase');await exportPlot('ac-phase');await save('amplifier');
 await analysisMenu('transient');d=page.locator('.native-analysis-dialog[open]');await d.locator('[name=start]').fill('0');await d.locator('[name=stop]').fill('10m');await d.locator('button[type=submit]').click();await exportPlot('transient');await save('amplifier');
 const doc=decode(fs.readFileSync(path.join(root,'Browser',cfg.model+'_amplifier.TSC'))),jobs=prepareJobs(doc,{kind:'op'}),op=await runJob(jobs.jobs[0]);
 fs.writeFileSync(path.join(root,'parameters-results.json'),JSON.stringify({config:cfg,op:Object.fromEntries(op.names.map((n,i)=>[n,op.values[0][i]])),mapping:jobs.mapping,components:components(doc).map(c=>({kind:c.kind,label:c.label,value:c.value})),errors,nativeComparison:false},null,2));
 await summarize(root);
 if(errors.length)throw Error(errors.join('\n'));console.log('Completed '+root);captureNative([id]);
}catch(e){fs.mkdirSync('work/homework-errors',{recursive:true});await page.screenshot({path:path.resolve(`work/homework-errors/variant${id}-failure.png`)});throw e;}finally{await browser.close();}
