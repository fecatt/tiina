// Isolated browser regression; never attaches to the user's browser/profile.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE || path.join(process.env.USERPROFILE || process.env.HOME,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {decode,wires,components,labelGeometry}=await import('../src/codec.ts');
const root=path.resolve('reports/oracle-cases');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});page.setDefaultTimeout(7000);
 await page.goto('http://127.0.0.1:5173/');
 await page.locator('#file').setInputFiles(path.join(root,'attached_wire.TSC'));
 await page.waitForFunction(()=>document.querySelector('#counts')?.textContent.includes('2 эл. · 1 проводов'));
 const saved=async(name)=>{const [d]=await Promise.all([page.waitForEvent('download'),page.locator('.toolbar button[data-action="save"]').click()]);const out=path.join(root,name);await d.saveAs(out);return decode(fs.readFileSync(out));};
 const point=async(x,y)=>page.locator('#field').evaluate((el,p)=>{const m=el.getScreenCTM();return {x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f};},{x,y});
 const drag=async(a,b)=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();};
 const base=decode(fs.readFileSync(path.join(root,'attached_wire.TSC'))),native=decode(fs.readFileSync(path.join(root,'attached_wire_native_moved.TSC')));
 await drag(await point(320,360),await point(320,320));
 const moved=await saved('attached_wire_browser_moved.TSC');
 assert.deepEqual(wires(moved).map(w=>w.points),wires(native).map(w=>w.points));
 assert.equal(wires(moved).length,1);
 await page.screenshot({path:'reports/browser-attached-wire-drag.png'});
 // Physical KeyZ must work when e.key is Cyrillic я.
 await page.locator('#sheet').focus();
 await page.evaluate(()=>document.querySelector('#sheet').dispatchEvent(new KeyboardEvent('keydown',{key:'я',code:'KeyZ',ctrlKey:true,bubbles:true,cancelable:true})));
 const undone=await saved('attached_wire_browser_undo.TSC');assert.deepEqual(wires(undone).map(w=>w.points),wires(base).map(w=>w.points));
 await page.locator('#sheet').focus();await page.keyboard.press('Control+y');
 const redone=await saved('attached_wire_browser_redo.TSC');assert.deepEqual(wires(redone).map(w=>w.points),wires(native).map(w=>w.points));
 const label=page.locator('[data-label-index]').filter({hasText:'VM1'});const box=await label.boundingBox();assert(box);
 await drag({x:box.x+box.width/2,y:box.y+box.height/2},{x:box.x+box.width/2+64,y:box.y+box.height/2-32});
 const labelled=await saved('attached_wire_browser_label.TSC');
 const a=components(redone).find(c=>c.label==='VM1'),b=components(labelled).find(c=>c.label==='VM1');
 assert.deepEqual([a.x,a.y,a.orientation],[b.x,b.y,b.orientation]);assert.notDeepEqual(labelGeometry(a),labelGeometry(b));
 assert.deepEqual(wires(labelled).map(w=>w.points),wires(redone).map(w=>w.points));
 await page.screenshot({path:'reports/browser-label-drag.png'});
 await page.locator('#sheet').focus();await page.keyboard.press('Control+z');
 const labelUndo=await saved('attached_wire_browser_label_undo.TSC');assert.deepEqual(labelGeometry(components(labelUndo).find(c=>c.label==='VM1')),labelGeometry(a));
 await page.locator('#file').setInputFiles(path.join(root,'notched_wire.TSC'));
 await page.waitForFunction(()=>document.querySelector('#title')?.textContent.includes('notched_wire'));
 await drag(await point(240,240),await point(240,200));
 const notched=await saved('notched_wire_browser_moved.TSC'),notchedNative=decode(fs.readFileSync(path.join(root,'notched_wire_native_moved.TSC')));
 assert.deepEqual(wires(notched).map(w=>w.points),wires(notchedNative).map(w=>w.points));
 await page.screenshot({path:'reports/browser-notched-wire-drag.png'});
 assert.deepEqual(errors,[]);console.log('Browser passed: native attached-wire and notched-wire routes; Cyrillic Ctrl+Z; Ctrl+Y; label-only drag and Ctrl+Z; no page errors');
}finally{await browser.close();}
