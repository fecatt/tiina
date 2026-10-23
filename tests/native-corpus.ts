import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {decode,encode,components} from '../src/codec.ts';
const root=process.argv[2];if(!root)throw Error('Supply original TINA examples directory');
const files:string[]=[];function walk(dir:string){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.tsc$/i.test(p))files.push(p);}}walk(root);
const failures:{file:string;error:string}[]=[];let bytes=0;let recognised=0;
for(const file of files){try{const data=fs.readFileSync(file),doc=decode(data);assert.deepEqual(Buffer.from(encode(doc)),data);bytes+=data.length;try{recognised+=components(doc).length;}catch{}}catch(e){failures.push({file:path.relative(root,file),error:String(e)});}}
const report={date:new Date().toISOString().slice(0,10),root,files:files.length,passed:files.length-failures.length,bytes,recognised,failures,scope:'Byte-identical decode/encode only. Does not prove component simulation or original runtime.'};fs.writeFileSync('reports/native-corpus-current.json',JSON.stringify(report,null,2));console.log(JSON.stringify({files:files.length,passed:report.passed,bytes,failures:failures.length}));if(failures.length)process.exitCode=1;
