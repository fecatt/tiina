import type {Curve,Cell} from './solver.ts';
type Node={kind:'number';value:number}|{kind:'x'}|{kind:'ref';name:string}|{kind:'unary';op:'+'|'-';value:Node}|{kind:'binary';op:'+'|'-'|'*'|'/';left:Node;right:Node};
/** Arithmetic only: no dynamic code, property access, or executable functions. */
export function parseCurveExpression(source:string,names:string[]):(x:number,curve:Curve)=>number{
 let p=0;const available=[...names].sort((a,b)=>b.length-a.length);
 const ws=()=>{while(p<source.length&&/\s/.test(source[p]))p++;};
 const expr=():Node=>{let n=term();ws();while(source[p]==='+'||source[p]==='-'){const op=source[p++] as '+'|'-';n={kind:'binary',op,left:n,right:term()};ws();}return n;};
 const term=():Node=>{let n=atom();ws();while(source[p]==='*'||source[p]==='/'){const op=source[p++] as '*'|'/';n={kind:'binary',op,left:n,right:atom()};ws();}return n;};
 const atom=():Node=>{ws();if(source[p]==='+'||source[p]==='-'){const op=source[p++] as '+'|'-';return{kind:'unary',op,value:atom()};}
  const ref=available.find(name=>source.slice(p,p+name.length)===name);if(ref){p+=ref.length;if(source.slice(p,p+3)==='(x)')p+=3;return{kind:'ref',name:ref};}
  if(source[p]==='('){p++;const n=expr();ws();if(source[p++]!==')')throw Error('Ожидается закрывающая скобка');return n;}
  const number=source.slice(p).match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);if(number){p+=number[0].length;return{kind:'number',value:Number(number[0])};}
  if(source[p]?.toLowerCase()==='x'){p++;return{kind:'x'};}throw Error('Ожидается число, x, величина из списка или скобка');};
 const tree=expr();ws();if(p!==source.length)throw Error(`Неизвестная величина или символ: ${source.slice(p)}`);
 const real=(v:Cell)=>{if(typeof v!=='number')throw Error('Для комплексных результатов сначала выберите действительную величину');return v;};
 const sample=(name:string,x:number,c:Curve)=>{const i=c.names.indexOf(name);if(i<0)throw Error(`В результате нет ${name}`);const rows=c.values;if(!rows.length)throw Error('Пустая кривая');let lo=0,hi=rows.length-1;const ascending=real(rows[hi][0])>=real(rows[lo][0]);while(hi-lo>1){const mid=(lo+hi)>>1;if((real(rows[mid][0])<x)===ascending)lo=mid;else hi=mid;}const a=rows[lo],b=rows[hi],dx=real(b[0])-real(a[0]);return real(a[i])+(dx?(x-real(a[0]))/dx:0)*(real(b[i])-real(a[i]));};
 const evaluate=(n:Node,x:number,c:Curve):number=>{switch(n.kind){case'number':return n.value;case'x':return x;case'ref':return sample(n.name,x,c);case'unary':return(n.op==='-'?-1:1)*evaluate(n.value,x,c);case'binary':{const a=evaluate(n.left,x,c),b=evaluate(n.right,x,c);return n.op==='+'?a+b:n.op==='-'?a-b:n.op==='*'?a*b:a/b;}}};
 return(x,c)=>evaluate(tree,x,c);
}
