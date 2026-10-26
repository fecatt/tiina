/** Only native-observed TINA inline commands are interpreted. Unknown syntax stays literal. */
export type FormulaNode={kind:'text';value:string}|{kind:'power'|'index'|'fraction';base:string;argument:string;source:string};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const MAX_LINE=4096,MAX_COMMAND=512;
/** e/i/f are proven by native TSC/XML. Nesting/escaping are unproven and stay literal. */
export function parseFormulaLine(line:string):FormulaNode[]{
 if(line.length>MAX_LINE||/[\r\n]/.test(line))return [{kind:'text',value:line}];
 const nodes:FormulaNode[]=[];let plain='',i=0;
 const flush=()=>{if(plain){nodes.push({kind:'text',value:plain});plain='';}};
 while(i<line.length){
  if(line[i]!=='\\'){plain+=line[i++];continue;}
  // Doubled slashes and unsupported commands are never partially reinterpreted.
  if(line[i+1]==='\\'){plain+=line.slice(i,i+2);i+=2;continue;}
  const head=/^\\[a-zA-Z]+\(/.exec(line.slice(i));
  if(!head){plain+=line[i++];continue;}
  let end=i+head[0].length,depth=1;
  while(end<line.length&&depth){if(line[end]==='(')depth++;else if(line[end]===')')depth--;end++;}
  const source=line.slice(i,end),match=depth===0&&source.length<=MAX_COMMAND?/^\\([eif])\(([^\\(),]+),([^\\(),]+)\)$/.exec(source):null;
  if(match){flush();nodes.push({kind:match[1]==='e'?'power':match[1]==='i'?'index':'fraction',base:match[2],argument:match[3],source});}else plain+=source;
  i=end;
 }
 flush();return nodes;
}
export type FormulaMeasure=(text:string,fontSize:number)=>number;
/** Native command semantics; approximate SVG metrics. Caller can supply actual browser font widths. */
export function formulaLineSvg(line:string,x:number,baseline:number,fontSize:number,measureText:FormulaMeasure=(text,size)=>text.length*size*.6):{svg:string;width:number;ascent:number;descent:number;hasFormula:boolean} {
 if(![x,baseline,fontSize].every(Number.isFinite)||fontSize<=0||fontSize>4096)throw Error('Неверные метрики формулы');
 const nodes=parseFormulaLine(line),hasFormula=nodes.some(n=>n.kind!=='text');
 const width=(text:string,size:number)=>{const w=measureText(text,size);if(!Number.isFinite(w)||w<0||w>1e8)throw Error('Неверная ширина формулы');return w;};
 const text=(value:string,xx:number,y:number,size=fontSize)=>`<text x="${xx}" y="${y}"${size===fontSize?'':` font-size="${size}"`}>${esc(value)||'&#160;'}</text>`;
 if(!hasFormula)return {svg:text(line,x,baseline),width:width(line,fontSize),ascent:fontSize*.85,descent:fontSize*.25,hasFormula};
 let cursor=x,ascent=fontSize*.85,descent=fontSize*.25,svg='';
 for(const node of nodes){
  if(node.kind==='text'){svg+=text(node.value,cursor,baseline);cursor+=width(node.value,fontSize);continue;}
  if(node.kind==='fraction'){
   const size=fontSize*.9,pad=fontSize*.15,nw=width(node.base,size),dw=width(node.argument,size),w=Math.max(nw,dw)+pad*2;
   svg+=text(node.base,cursor+(w-nw)/2,baseline-fontSize*.65,size);
   svg+=`<rect x="${cursor}" y="${baseline-fontSize*.3}" width="${w}" height="${Math.max(.5,fontSize*.06)}" stroke="none"/>`;
   svg+=text(node.argument,cursor+(w-dw)/2,baseline+fontSize*.65,size);cursor+=w;ascent=Math.max(ascent,fontSize*1.415);descent=Math.max(descent,fontSize*.875);
  }else{
   const size=fontSize*.7,shift=node.kind==='power'?-fontSize*.4:fontSize*.25;
   svg+=text(node.base,cursor,baseline);cursor+=width(node.base,fontSize);
   svg+=text(node.argument,cursor,baseline+shift,size);cursor+=width(node.argument,size);
   if(node.kind==='power')ascent=Math.max(ascent,fontSize*.995);else descent=Math.max(descent,fontSize*.425);
  }
 }
 return {svg,width:cursor-x,ascent,descent,hasFormula};
}
