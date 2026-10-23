import assert from 'node:assert/strict';
import fs from 'node:fs';
import {decode,encode,components,labelGeometry,newComponent,component} from '../src/codec.ts';
import {texts,textRecord,updateText,newText} from '../src/native-text.ts';
import {copySelection,pasteSelection,translateSelection} from '../src/editor-state.ts';
const doc=decode(fs.readFileSync(new URL('../reports/oracle-cases/text_native18.TSC',import.meta.url)));
const tt=texts(doc),small=tt.find(t=>t.size===8)!,large=tt.find(t=>t.size===18)!;
assert.equal(small.lines[0],'Грибанов');assert.equal(large.text,'Текст проверки\nФёдор');
assert.equal(large.x,400);assert.equal(large.y,160);assert.equal(large.font,'Arial');assert.equal(large.cssColor,'#0000ff');
const xml=fs.readFileSync(new URL('../reports/oracle-cases/text_native18.XML',import.meta.url),'utf8');
assert.match(xml,/<text[^>]+position="400,160"[^>]+fontsize="24"/);
for(const [name,x,y] of [['R1',832,324],['R4',1124,488],['R5',1036,504]] as const){const c=components(doc).find(c=>c.label===name)!;const pos=labelGeometry(c);assert.deepEqual([pos.x,pos.y],[x,y]);assert.match(xml,new RegExp(`position="${x},${y}" textroot="${name}"`));}
const fresh=component(newComponent('R',100,100,'R1'));assert.deepEqual([fresh.label_dx,fresh.label_dy,fresh.record.data[8]],[8,-20,0]);
const r={...doc.records[small.index],data:Uint8Array.from(doc.records[small.index].data)};
updateText(r,{x:400,y:160,text:large.text,size:18});
assert.deepEqual(r.data,Uint8Array.from(doc.records[large.index].data),'8pt native text rewritten to native18 must exactly match original record');
const original=Uint8Array.from(r.data);for(const changes of [{size:0},{size:73},{x:40000},{text:'😀'},{text:'a'.repeat(255)}]){assert.throws(()=>updateText(r,changes));assert.deepEqual(r.data,original);}
const created=newText(400,160,large.text,18);assert.deepEqual(created.data,original);
const bytes=encode(doc);assert.deepEqual(encode(decode(bytes)),bytes);
const pasted=pasteSelection(doc,copySelection(doc,[large.index]),16,24)[0];assert.equal(textRecord(doc.records[pasted]).x,416);
translateSelection(doc,[pasted],8,-8);assert.equal(textRecord(doc.records[pasted]).x,424);assert.equal(textRecord(doc.records[pasted]).y,176);
assert.equal(textRecord(doc.records[large.index]).x,400,'copy must not alias original text');
const browser=decode(fs.readFileSync(new URL('../reports/oracle-cases/text_browser18.TSC',import.meta.url)));
const nativeResaved=decode(fs.readFileSync(new URL('../reports/oracle-cases/text_browser18_resaved.TSC',import.meta.url)));
assert.deepEqual(browser.records.filter(r=>r.type===262).map(r=>r.data),nativeResaved.records.filter(r=>r.type===262).map(r=>r.data),'original TINA must preserve browser text bytes');
console.log('Native text: original8→18 exact record match, Cyrillic/multiline, font XML, atomic validation, copy and movement passed');
