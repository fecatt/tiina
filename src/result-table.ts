import type {Curve,Cell} from './solver.ts';
const escape=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Selected plot, in the same block-per-curve text layout as TINA diagrams. */
export function resultCurveText(curves:Curve[],vector:string,value:(cell:Cell)=>number){
 return curves.map((curve,i)=>{const column=curve.names.indexOf(vector);if(column<0)throw Error('Величина не найдена');return `*${curve.names[0]}\t${vector}${curves.length>1?'['+(i+1)+']':''}\n`+curve.values.map(row=>`${Array.isArray(row[0])?row[0][0]:row[0]}\t${value(row[column])}`).join('\n')+'\n';}).join('\n');
}
export function resultCell(cell:Cell,vector:string):string {
 const real=Array.isArray(cell)?cell[0]:cell,imag=Array.isArray(cell)?cell[1]:0;
 return `<td data-vector="${escape(vector)}" data-real="${real}" data-imag="${imag}">${Array.isArray(cell)?`<span>Re: ${real}</span><br><span>Im: ${imag}</span>`:String(real)}</td>`;
}
/** A bounded on-screen view of all curves, preserving full double precision. */
export function resultTablePage(curves:Curve[],requestedPage=0,pageSize=500,title:(name:string)=>string=name=>name){
 if(!Number.isInteger(requestedPage)||requestedPage<0||!Number.isInteger(pageSize)||pageSize<1||pageSize>500)throw Error('Недопустимая страница результатов');
 const total=curves.reduce((count,curve)=>count+curve.values.length,0),pages=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(requestedPage,pages-1),start=page*pageSize,end=Math.min(total,start+pageSize);
 const names=[...new Set(curves.flatMap(curve=>curve.names))];let skip=start,remaining=end-start,rows='';
 for(let ci=0;ci<curves.length&&remaining;ci++){
  const curve=curves[ci];if(skip>=curve.values.length){skip-=curve.values.length;continue;}
  const indices=names.map(name=>curve.names.indexOf(name));
  for(let sample=skip;sample<curve.values.length&&remaining;sample++,remaining--){const row=curve.values[sample];if(row.length!==curve.names.length)throw Error('Неверная длина строки результатов');rows+=`<tr data-curve="${ci}" data-sample="${sample}"><td>${ci+1}</td><td>${curve.parameter===undefined?'—':String(curve.parameter)}</td><td>${sample+1}</td>${indices.map((index,i)=>index<0?'<td>—</td>':resultCell(row[index],names[i])).join('')}</tr>`;}skip=0;
 }
 const html=`<table id="result-values"><thead><tr><th>Кривая</th><th>Параметр, СИ</th><th>Точка</th>${names.map(name=>`<th>${escape(title(name))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>`;
 return {html,page,pages,total,start,end};
}
