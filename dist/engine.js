import {snapshotRefs} from './debug-values.js';
import {primitiveTypes,timerTypes,declarationSections} from './language-catalog.js';
export {supportedTypes,declarationSections,languageKeywords} from './language-catalog.js';
import {supportsStandard,callStandard,standardSignatures} from './standard-functions.js';
/* SCL Lab: bounded, AST-based educational interpreter. No eval or generated JS. */
export class SclError extends Error {
  constructor(message, token={line:1,col:1}) { super(message); this.line=token.line||1;this.col=token.col||1;this.name='SclError';this.range=Number.isInteger(token.start)&&Number.isInteger(token.end)?{start:token.start,end:token.end}:null;this.endLine=token.endLine||this.line;this.endCol=token.endCol||this.col; }
}
const primitive=new Set(primitiveTypes);
const timers=new Set(timerTypes);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const safeKey=(k,tok)=>{if(['__proto__','prototype','constructor'].includes(String(k).toLowerCase()))throw new SclError('Niedozwolona nazwa: '+k,tok);return k;};
export function lex(source) {
 let p=0,line=1,col=1,out=[];
 // All offsets/columns use UTF-16 code units, matching textarea selections.
 const position=(length=1)=>{const raw=source.slice(p,p+length),parts=raw.split('\n');return {line,col,start:p,end:p+raw.length,endLine:line+parts.length-1,endCol:parts.length>1?parts.at(-1).length+1:col+raw.length};};
 const add=(kind,text,length=text.length)=>out.push({kind,text,...position(length),u:kind==='id'?text.toUpperCase():kind==='op'?text:undefined});
 const advance=s=>{for(let i=0;i<s.length;i++){if(s[i]==='\n'){line++;col=1;}else col++;}p+=s.length;};
 const invalidLiteral=(raw)=>{throw new SclError('Nieprawidłowy literał liczbowy: '+raw,position(Math.max(1,raw.length)));};
 const boundary=raw=>{const after=source.slice(p+raw.length);if(/^[\w\u00c0-\u024f#]/.test(after)||(after[0]==='.'&&!after.startsWith('..')))invalidLiteral(raw+after[0]);};
 const numeric=raw=>{const parts=raw.split('#'),typed=parts.length>1&&!/^(2|8|16)$/.test(parts[0]);const type=typed?parts.shift().toUpperCase():null;
  if(type==='BOOL'){if(!/^(TRUE|FALSE)$/i.test(parts[0]))invalidLiteral(raw);return;}
  if(parts.length===2){const patterns={2:/^[01](?:_?[01])*$/,8:/^[0-7](?:_?[0-7])*$/,16:/^[0-9a-f](?:_?[0-9a-f])*$/i};if(!patterns[parts[0]]?.test(parts[1]))invalidLiteral(raw);}
  else{const value=parts[0];if(!/^[+-]?\d(?:_?\d)*(?:\.\d(?:_?\d)*)?(?:[eE][+-]?\d(?:_?\d)*)?$/.test(value)||!Number.isFinite(Number(value.replaceAll('_',''))))invalidLiteral(raw);if(type&&!['REAL','LREAL'].includes(type)&&/[.eE]/.test(value))invalidLiteral(raw);}
 };
 while(p<source.length){
  if(out.length>200000)throw new SclError('Program jest zbyt duży.',position());
  const tail=source.slice(p);let m;
  if((m=/^\s+/.exec(tail))){advance(m[0]);continue;}
  if(tail.startsWith('//')){advance(tail.split('\n')[0]);continue;}
  if(tail.startsWith('(*')||tail.startsWith('/*')){let end=source.indexOf(tail.startsWith('(*')?'*)':'*/',p+2);if(end<0)throw new SclError('Niezamknięty komentarz.',position(2));advance(source.slice(p,end+2));continue;}
  if(tail[0]==='{'){let end=source.indexOf('}',p+1);if(end<0)throw new SclError('Niezamknięty atrybut bloku.',position());advance(source.slice(p,end+1));continue;}
  if((m=/^(?:LTIME|TIME|LT|T)#[+-]?(?:\d+(?:\.\d+)?(?:ms|us|ns|d|h|m|s))+/i.exec(tail))){add('time',m[0]);advance(m[0]);continue;}
  const typedPrefix=/^(?:BOOL|SINT|INT|DINT|LINT|USINT|UINT|UDINT|ULINT|BYTE|WORD|DWORD|LWORD|REAL|LREAL)#/i.exec(tail);
  if(typedPrefix){const value=/^(?:TRUE|FALSE|(?:2|8|16)#[0-9a-z_]*|[+-]?\d[\d_]*(?:\.(?!\.)\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?)/i.exec(tail.slice(typedPrefix[0].length));if(!value)invalidLiteral(typedPrefix[0]);const raw=typedPrefix[0]+value[0];boundary(raw);numeric(raw);add('typed',raw);advance(raw);continue;}
  if((m=/^(?:2|8|16)#[0-9a-z_]*/i.exec(tail))){boundary(m[0]);numeric(m[0]);add('base',m[0]);advance(m[0]);continue;}
  if(tail[0]==='"'||tail[0]==="'"){
   const q=tail[0];let i=1,text='';let closed=false;
   while(i<tail.length){if(tail[i]===q){if(tail[i+1]===q){text+=q;i+=2;continue;}i++;closed=true;break;}if(tail[i]==='$'&&i+1<tail.length){text+=tail[i+1];i+=2;}else text+=tail[i++];}
   if(!closed)throw new SclError('Niezamknięty tekst lub symbol.',position());add(q==='"'?'global':'string',text,i);advance(tail.slice(0,i));continue;
  }
  if((m=/^(?:REGION\b[^\n]*|END_REGION\b[ \t]*;?)/i.exec(tail))){advance(m[0]);continue;}
  if((m=/^#?[A-Za-z_\u00c0-\u024f][\w\u00c0-\u024f]*/.exec(tail))){add('id',m[0]);advance(m[0]);continue;}
  if((m=/^\d[\d_]*(?:\.(?!\.)\d[\d_]*)?(?:[eE][+-]?\d[\d_]*)?/.exec(tail))){boundary(m[0]);numeric(m[0]);add('number',m[0]);advance(m[0]);continue;}
  if((m=/^(?::=|=>|<>|<=|>=|\.\.\.|\.\.|\*\*|[+\-*/=<>()[\],;:.])/.exec(tail))){add('op',m[0]);advance(m[0]);continue;}
  throw new SclError('Nieobsługiwany znak: '+String.fromCodePoint(tail.codePointAt(0)),position(String.fromCodePoint(tail.codePointAt(0)).length));
 }
 out.push({kind:'eof',text:'EOF',u:'EOF',...position(0)});return out;
}
function timeValue(s){let v=0;const sign=s.includes('#-')?-1:1;const units={d:86400000,h:3600000,m:60000,s:1000,ms:1,us:.001,ns:.000001};for(const m of s.matchAll(/(\d+(?:\.\d+)?)(ms|us|ns|d|h|m|s)/gi))v+=Number(m[1])*units[m[2].toLowerCase()];return sign*v;}
const lit=(v,t='DINT',tok={})=>({k:'lit',v,t,tok});
const powers={OR:1,XOR:2,AND:3,'=':4,'<>':4,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6,MOD:6,DIV:6,'**':7};
export class Parser {
 constructor(source){this.tokens=lex(source);this.i=0;this.decls=[];this.name='Program';this.returnType=null;this.depth=0;this.expressionDepth=0;this.typeDepth=0;this.expressionHeights=new WeakMap();}
 peek(n=0){return this.tokens[this.i+n]||this.tokens.at(-1);} is(x){return this.peek().u===x;} next(){const t=this.peek();this.i=Math.min(this.i+1,this.tokens.length);return t;}
 eat(x){if(this.is(x)){return this.next();}return null;}
 need(x){if(!this.is(x))throw new SclError('Oczekiwano '+x+', znaleziono '+this.peek().text,this.peek());return this.next();}
 ident(){let t=this.next();if(!['id','global'].includes(t.kind))throw new SclError('Oczekiwano nazwy zmiennej.',t);safeKey(t.text.replace(/^#/,''),t);return t;}
 signed(){let sign=this.eat('-')?-1:1;if(sign===1)this.eat('+');let t=this.next();if(t.kind!=='number'||!Number.isSafeInteger(Number(t.text.replaceAll('_',''))))throw new SclError('Granica tablicy musi być liczbą całkowitą w bezpiecznym zakresie symulatora.',t);return sign*Number(t.text.replaceAll('_',''));}
 type(){if(++this.typeDepth>80){this.typeDepth--;throw new SclError('Zbyt głębokie zagnieżdżenie typu.',this.peek());}try{return this.parseType();}finally{this.typeDepth--;}}
 parseType(){let t=this.next(),u=t.text.toUpperCase();
  if(u==='ARRAY'){this.need('[');let dims=[];do{let lo=this.signed();this.need('..');let hi=this.signed();if(hi<lo||hi-lo>10000)throw new SclError('Nieprawidłowy zakres tablicy.',t);dims.push([lo,hi]);}while(this.eat(','));this.need(']');this.need('OF');if(dims.reduce((n,[a,b])=>n*(b-a+1),1)>10000)throw new SclError('Tablica może mieć najwyżej 10 000 elementów.',t);return {kind:'array',dims,of:this.type()};}
  if(u==='STRUCT'){let fields=this.declarationList('field','END_STRUCT');this.need('END_STRUCT');return {kind:'struct',fields};}
  if(u==='STRING'&&this.eat('[')){let n=this.signed();this.need(']');return {kind:'scalar',name:u,length:n};}
  if(primitive.has(u))return {kind:'scalar',name:u};
  if(timers.has(u))return {kind:'timer',name:u};
  if(u==='SILOWNIK')return cylinderSchema();
  throw new SclError('Nieobsługiwany typ '+t.text+'. Zdefiniuj strukturę inline (STRUCT) lub użyj podstawowego typu.',t);
 }
 declarationList(section,end='END_VAR'){
  let list=[];
  while(!this.is(end)&&!this.is('EOF')){
   if(this.eat(';'))continue;
   const names=[this.ident()];while(this.eat(','))names.push(this.ident());this.need(':');const type=this.type();let init=null;if(this.eat(':='))init=this.expression();this.need(';');for(const n of names)list.push({name:n.text.replace(/^#/,''),type,init,section,tok:n});
  }return list;
 }
 parse(){
  let blockEnd=null;
  if(this.is('FUNCTION_BLOCK')||this.is('FUNCTION')||this.is('ORGANIZATION_BLOCK')){const kind=this.next().u;blockEnd={FUNCTION_BLOCK:'END_FUNCTION_BLOCK',FUNCTION:'END_FUNCTION',ORGANIZATION_BLOCK:'END_ORGANIZATION_BLOCK'}[kind];this.name=this.ident().text;if(kind==='FUNCTION'){this.need(':');if(!this.eat('VOID'))this.returnType=this.type();}}
  if(this.eat('VERSION')){this.need(':');this.next();}
  while(declarationSections.includes(this.peek().u)){
   const section=this.next().u;this.eat('RETAIN');this.eat('NON_RETAIN');this.decls.push(...this.declarationList(section));this.need('END_VAR');this.eat(';');
  }
  if(blockEnd)this.need('BEGIN');else this.eat('BEGIN');const body=this.block(new Set(['END_FUNCTION_BLOCK','END_FUNCTION','END_ORGANIZATION_BLOCK','EOF']));
  if(blockEnd){this.need(blockEnd);this.eat(';');}else if(!this.is('EOF')){this.next();this.eat(';');}this.need('EOF');
  const seen=new Set();for(const d of this.decls){let key=d.name.toLowerCase();if(seen.has(key))throw new SclError('Zmienna zadeklarowana dwukrotnie: '+d.name,d.tok);seen.add(key);}
  return {body,decls:this.decls,name:this.name,returnType:this.returnType,sourceLines:this.tokens.at(-1).line};
 }
 block(stops,caseBody=false){if(++this.depth>80){this.depth--;throw new SclError('Zbyt głębokie zagnieżdżenie.',this.peek());}try{let b=[];while(!stops.has(this.peek().u)&&!this.is('EOF')&&(!caseBody||!this.caseLabelAhead())){if(this.eat(';'))continue;b.push(this.statement());}return b;}finally{this.depth--;}}
 statement(){let t=this.peek(),u=t.u;
  if(u==='IF'){this.next();const branches=[];let c=this.expression();this.need('THEN');branches.push({c,b:this.block(new Set(['ELSIF','ELSE','END_IF']))});while(this.eat('ELSIF')){c=this.expression();this.need('THEN');branches.push({c,b:this.block(new Set(['ELSIF','ELSE','END_IF']))});}let other=[];if(this.eat('ELSE'))other=this.block(new Set(['END_IF']));this.need('END_IF');this.need(';');return {k:'if',branches,other,tok:t};}
  if(u==='CASE'){this.next();let value=this.expression();this.need('OF');let cases=[];while(!this.is('END_CASE')&&!this.is('ELSE')&&!this.is('EOF')){const labels=this.caseLabels();this.need(':');const b=this.block(new Set(['ELSE','END_CASE']),true);cases.push({labels,b});}let other=[];if(this.eat('ELSE'))other=this.block(new Set(['END_CASE']));this.need('END_CASE');this.need(';');return {k:'case',value,cases,other,tok:t};}
  if(u==='FOR'){this.next();const target=this.reference();this.need(':=');let lo=this.expression();this.need('TO');let hi=this.expression();let by=lit(1);if(this.eat('BY'))by=this.expression();this.need('DO');let b=this.block(new Set(['END_FOR']));this.need('END_FOR');this.need(';');return {k:'for',target,lo,hi,by,b,tok:t};}
  if(u==='WHILE'){this.next();let c=this.expression();this.need('DO');let b=this.block(new Set(['END_WHILE']));this.need('END_WHILE');this.need(';');return {k:'while',c,b,tok:t};}
  if(u==='REPEAT'){this.next();let b=this.block(new Set(['UNTIL']));this.need('UNTIL');let c=this.expression();this.need('END_REPEAT');this.need(';');return {k:'repeat',c,b,tok:t};}
  if(['EXIT','CONTINUE','RETURN'].includes(u)){this.next();this.need(';');return {k:u.toLowerCase(),tok:t};}
  const target=this.reference();
  if(this.eat(':=')){const value=this.expression();this.need(';');return {k:'assign',target,value,tok:t};}
  if(this.is('(')){const args=this.arguments();this.need(';');return {k:'call',target,args,tok:t};}
  throw new SclError('Oczekiwano przypisania := lub wywołania bloku.',this.peek());
 }
 caseLabels(){const labels=[];do{let lo=this.expression(5),hi=lo;if(this.eat('..')||this.eat('...'))hi=this.expression(5);labels.push([lo,hi]);}while(this.eat(','));return labels;}
 caseLabelAhead(){const saved=this.i;try{this.caseLabels();return this.is(':');}catch(error){if(!(error instanceof SclError))throw error;return false;}finally{this.i=saved;}}
 reference(){const t=this.ident();let path=[];while(true){if(this.eat('.'))path.push({field:this.ident().text});else if(this.eat('[')){const indices=[this.expression()];while(this.eat(','))indices.push(this.expression());this.need(']');path.push({indices});}else break;}return {k:'ref',root:t.text.replace(/^#/,''),global:t.kind==='global',path,tok:t};}
 arguments(){this.need('(');let args=[];if(!this.is(')'))do{let name=null,out=false;if(this.peek().kind==='id'&&[':=','=>'].includes(this.peek(1).u)){name=this.next().text;out=this.next().u==='=>';}const value=this.expression();args.push({name,out,value});}while(this.eat(','));this.need(')');return args;}
 expression(min=0){if(++this.expressionDepth>120){this.expressionDepth--;throw new SclError('Zbyt głębokie zagnieżdżenie wyrażenia.',this.peek());}try{return this.parseExpression(min);}finally{this.expressionDepth--;}}
 boundExpression(e){let children=[];if(e.k==='binary')children=[e.a,e.b];else if(e.k==='unary')children=[e.a];else if(e.k==='func')children=e.args.map(a=>a.value);else if(e.k==='ref')children=e.path.flatMap(s=>s.indices||[]);const height=1+children.reduce((max,c)=>Math.max(max,this.expressionHeights.get(c)||1),0);if(height>120)throw new SclError('Zbyt głębokie zagnieżdżenie wyrażenia.',e.tok);this.expressionHeights.set(e,height);return e;}
 parseExpression(min=0){let t=this.peek(),left;
  if(this.eat('NOT')||this.eat('-')||this.eat('+'))left={k:'unary',op:t.u,a:this.expression(7),tok:t};
  else if(this.eat('(')){left=this.expression();this.need(')');}
  else if(t.kind==='number'){this.next();left=lit(Number(t.text.replaceAll('_','')),/[.eE]/.test(t.text)?'REAL':'DINT',t);}
  else if(t.kind==='time'){this.next();left=lit(timeValue(t.text),'TIME',t);}
  else if(t.kind==='base'){this.next();let [base,n]=t.text.split('#');left=lit(parseInt(n.replaceAll('_',''),Number(base)),'DINT',t);}
  else if(t.kind==='typed'){this.next();let [typ,...tail]=t.text.split('#');let s=tail.join('#'),v=/^(TRUE|FALSE)$/i.test(s)?s.toUpperCase()==='TRUE':s.includes('#')?parseInt(s.split('#')[1].replaceAll('_',''),Number(s.split('#')[0])):Number(s.replaceAll('_',''));left=lit(v,typ.toUpperCase(),t);}
  else if(t.kind==='string'){this.next();left=lit(t.text,'STRING',t);}
  else if(this.eat('TRUE')||this.eat('FALSE'))left=lit(t.u==='TRUE','BOOL',t);
  else if(t.kind==='id'||t.kind==='global'){left=this.reference();if(this.is('('))left={k:'func',target:left,args:this.arguments(),tok:t};}
  else throw new SclError('Oczekiwano wyrażenia, znaleziono '+t.text,t);
  this.boundExpression(left);while(own(powers,this.peek().u)&&powers[this.peek().u]>=min){let op=this.next();const p=powers[op.u];const right=this.expression(p+(op.u==='**'?0:1));left=this.boundExpression({k:'binary',op:op.u,a:left,b:right,tok:op});}return left;
 }
}
export const scalar=name=>({kind:'scalar',name});
export function cylinderSchema(){return {kind:'struct',fields:['Wysuw','Zasuw','CzujnikWysuw','CzujnikZasuw'].map(name=>({name,type:scalar('BOOL')}))};}
export function defaultGlobals(){const beam={kind:'struct',fields:[1,2,3,4].map(m=>({name:'SilownikMagnes'+m,type:cylinderSchema()}))};const type={kind:'struct',fields:[{name:'Belka',type:{kind:'array',dims:[[0,10]],of:beam}}]};const g=Object.create(null);g.St1_Urzadzenia_A_DB={type,value:makeValue(type)};for(let b=0;b<=10;b++)for(let m=1;m<=4;m++)g.St1_Urzadzenia_A_DB.value.Belka[b]['SilownikMagnes'+m].CzujnikZasuw=true;return g;}
export function makeValue(type,budget={n:0}){if(++budget.n>50000)throw new SclError('Struktura danych przekracza limit 50 000 elementów.');if(type.kind==='scalar'){if(type.name==='BOOL')return false;if(['STRING','CHAR'].includes(type.name))return '';return 0;}if(type.kind==='timer')return {__timer:type.name,IN:false,PT:0,Q:false,ET:0,CLK:false,prev:false,start:null,active:false};if(type.kind==='struct'){const o=Object.create(null);for(const f of type.fields)o[f.name]=makeValue(f.type,budget);return o;}if(type.kind==='array'){const rec=i=>{let a=Object.create(null);let [lo,hi]=type.dims[i];for(let j=lo;j<=hi;j++)a[j]=i===type.dims.length-1?makeValue(type.of,budget):rec(i+1);return a;};return rec(0);}throw new SclError('Nieprawidłowy typ.');}
const clone=x=>structuredClone(x);
const findKey=(o,k)=>{safeKey(k);if(own(o,k))return k;return Object.keys(o).find(s=>s.toLowerCase()===k.toLowerCase());};
const isReal=t=>t==='REAL'||t==='LREAL';
const range={SINT:[-128,127],INT:[-32768,32767],DINT:[-2147483648,2147483647],UINT:[0,65535],USINT:[0,255],UDINT:[0,4294967295],BYTE:[0,255],WORD:[0,65535],DWORD:[0,4294967295]};
function coerce(v,type,tok){if(type.kind!=='scalar')return clone(v);const t=type.name;if(t==='BOOL'){if(typeof v!=='boolean')throw new SclError('BOOL wymaga TRUE lub FALSE.',tok);return v;}if(['STRING','CHAR'].includes(t)){if(typeof v!=='string')throw new SclError('Wymagany tekst.',tok);return v.slice(0,type.length||254);}if(typeof v!=='number'||!Number.isFinite(v))throw new SclError('Nieprawidłowa wartość liczbowa.',tok);if(!isReal(t))v=Math.trunc(v);if(range[t]&&(v<range[t][0]||v>range[t][1]))throw new SclError('Wartość '+v+' poza zakresem '+t+'.',tok);if(!Number.isSafeInteger(v)&&!isReal(t))throw new SclError('Wartość przekracza precyzję symulatora.',tok);return v;}
const mathFns=new Set(['ABS','MIN','MAX','LIMIT','SEL','MUX','SQRT','SQR','SIN','COS','TAN','ASIN','ACOS','ATAN','LN','LOG','EXP','TRUNC','ROUND','CEIL','FLOOR','BOOL_TO_INT','INT_TO_BOOL','INT_TO_REAL','DINT_TO_REAL','REAL_TO_INT','REAL_TO_DINT','TIME_TO_DINT','DINT_TO_TIME','INT_TO_DINT','DINT_TO_INT','REAL_TO_LREAL','LREAL_TO_REAL']);
for(const n of ['SINT_TO_INT','USINT_TO_INT','UINT_TO_DINT','UDINT_TO_REAL','INT_TO_LREAL','REAL_TO_UINT','REAL_TO_UDINT','DINT_TO_LREAL','DINT_TO_LINT','LINT_TO_DINT','TIME_TO_REAL','REAL_TO_TIME','WORD_TO_INT','INT_TO_WORD'])mathFns.add(n);
export const supportedFunctions=[...mathFns,...Object.keys(standardSignatures)].sort();
const timerFields=new Set(['IN','PT','Q','ET','CLK']);
export class Machine {
 constructor(program,{globals,dt=20,maxOps=50000}={}){this.program=program;this.globals=globals?clone(globals):defaultGlobals();this.locals=Object.create(null);this.schemas=Object.create(null);this.sections=Object.create(null);this.dt=dt;this.now=0;this.scans=0;this.maxOps=maxOps;this.ops=0;this.generator=null;this.nextLine=null;this.lastLine=null;this.writes=[];this.debugEnabled=false;this.debugPending=new Map();this.debugCompleted=new Map();
  for(const d of program.decls){this.schemas[d.name]=d.type;this.locals[d.name]=makeValue(d.type);this.sections[d.name]=d.section;}
  if(program.returnType&&!own(this.locals,program.name)){this.schemas[program.name]=program.returnType;this.locals[program.name]=makeValue(program.returnType);this.sections[program.name]='VAR_OUTPUT';}
  for(const d of program.decls)if(d.init)this.locals[d.name]=coerce(this.eval(d.init).v,d.type,d.tok);
  this.initial=clone(this.locals);this.validate();
 }
 resolve(ref){const root=ref.global?this.globals:this.locals;let key=findKey(root,ref.root);if(key===undefined)throw new SclError('Nieznana '+(ref.global?'zmienna globalna':'zmienna')+': '+ref.root,ref.tok);let obj=root,type=ref.global?root[key].type:this.schemas[key];if(ref.global){obj=root[key];key='value';}
  for(const seg of ref.path){if(seg.field){if(type.kind==='timer'){let f=seg.field.toUpperCase();if(!timerFields.has(f))throw new SclError('Nieznane pole timera: '+seg.field,ref.tok);obj=obj[key];key=f;type=scalar(['IN','Q','CLK'].includes(f)?'BOOL':'TIME');}
    else{if(type.kind!=='struct')throw new SclError('To nie jest struktura.',ref.tok);obj=obj[key];let f=type.fields.find(f=>f.name.toLowerCase()===seg.field.toLowerCase());if(!f)throw new SclError('Brak pola: '+seg.field,ref.tok);key=f.name;type=f.type;}}
   else{if(type.kind!=='array'||seg.indices.length!==type.dims.length)throw new SclError('Niezgodna liczba indeksów tablicy.',ref.tok);let cur=obj[key];for(let i=0;i<seg.indices.length;i++){let ix=this.eval(seg.indices[i]).v,[lo,hi]=type.dims[i];if(!Number.isInteger(ix)||ix<lo||ix>hi)throw new SclError('Indeks '+ix+' poza zakresem '+lo+'..'+hi,ref.tok);if(i===seg.indices.length-1){obj=cur;key=ix;}else cur=cur[ix];}type=type.of;}
  }return {obj,key,type};
 }
 set(ref,v){if(!ref.global){const key=findKey(this.locals,ref.root);if(key&&this.sections[key]==='VAR_CONSTANT')throw new SclError('Nie można zmieniać stałej '+ref.root+'.',ref.tok);}const r=this.resolve(ref);r.obj[r.key]=coerce(v,r.type,ref.tok);this.writes.push({line:ref.tok?.line,name:ref.root,value:typeof v==='object'?'…':v});if(this.writes.length>200)this.writes.shift();}
 get(ref){const r=this.resolve(ref);return {v:r.obj[r.key],t:r.type.name||r.type.kind};}
 eval(e){switch(e.k){
  case 'lit':return {v:e.v,t:e.t};
  case 'ref':return this.get(e);
  case 'unary':{const a=this.eval(e.a);if(e.op==='NOT')return {v:typeof a.v==='boolean'?!a.v:~a.v,t:a.t};return {v:e.op==='-'?-a.v:+a.v,t:a.t};}
  case 'binary':{const a=this.eval(e.a),b=this.eval(e.b);let v,t=isReal(a.t)||isReal(b.t)?'REAL':a.t==='TIME'||b.t==='TIME'?'TIME':'DINT';switch(e.op){case '+':v=a.v+b.v;break;case '-':v=a.v-b.v;break;case '*':v=a.v*b.v;break;case '**':v=a.v**b.v;break;case '/':if(b.v===0)throw new SclError('Dzielenie przez zero.',e.tok);v=isReal(t)?a.v/b.v:Math.trunc(a.v/b.v);break;case 'DIV':if(b.v===0)throw new SclError('Dzielenie przez zero.',e.tok);v=Math.trunc(a.v/b.v);break;case 'MOD':if(b.v===0)throw new SclError('MOD przez zero.',e.tok);v=a.v%b.v;break;
   case 'AND':v=typeof a.v==='boolean'&&typeof b.v==='boolean'?a.v&&b.v:a.v&b.v;t=typeof v==='boolean'?'BOOL':'DINT';break;case 'OR':v=typeof a.v==='boolean'&&typeof b.v==='boolean'?a.v||b.v:a.v|b.v;t=typeof v==='boolean'?'BOOL':'DINT';break;case 'XOR':v=typeof a.v==='boolean'&&typeof b.v==='boolean'?a.v!==b.v:a.v^b.v;t=typeof v==='boolean'?'BOOL':'DINT';break;
   case '=':v=a.v===b.v;t='BOOL';break;case '<>':v=a.v!==b.v;t='BOOL';break;case '<':v=a.v<b.v;t='BOOL';break;case '>':v=a.v>b.v;t='BOOL';break;case '<=':v=a.v<=b.v;t='BOOL';break;case '>=':v=a.v>=b.v;t='BOOL';break;}return {v,t};}
  case 'func':return this.functionCall(e);
 }throw new SclError('Nieobsługiwane wyrażenie.',e.tok);}
 functionCall(e){let name=e.target.root.toUpperCase();if(supportsStandard(name)){try{return callStandard(name,e.args.map(a=>({...a,result:this.eval(a.value)})));}catch(error){throw new SclError(error.message,e.tok);}}if(!mathFns.has(name))throw new SclError('Nieobsługiwana funkcja '+e.target.root+'. Wywołania własnych FC/FB nie są obsługiwane.',e.tok);if(e.args.some(a=>a.name||a.out))throw new SclError('Funkcje matematyczne przyjmują argumenty pozycyjne.',e.tok);let args=e.args.map(a=>this.eval(a.value)),a=args.map(x=>x.v),v,t=args.some(x=>isReal(x.t))?'REAL':'DINT';
  const arity={ABS:1,MIN:2,MAX:2,LIMIT:3,SEL:3,SQRT:1,SQR:1,SIN:1,COS:1,TAN:1,ASIN:1,ACOS:1,ATAN:1,LN:1,LOG:1,EXP:1,TRUNC:1,ROUND:1,CEIL:1,FLOOR:1};if((arity[name]&&a.length!==arity[name])||(!arity[name]&&name!=='MUX'&&a.length!==1)||name==='MUX'&&a.length<2)throw new SclError('Nieprawidłowa liczba argumentów '+name+'.',e.tok);
  if(name.includes('_TO_')){let target=name.split('_TO_')[1];v=target==='BOOL'?a[0]!==0:typeof a[0]==='boolean'?Number(a[0]):target==='INT'||target==='DINT'?roundEven(a[0]):a[0];return {v:coerce(v,scalar(target),e.tok),t:target};}
  switch(name){case 'ABS':v=Math.abs(a[0]);break;case 'MIN':v=Math.min(...a);break;case 'MAX':v=Math.max(...a);break;case 'LIMIT':v=Math.min(a[2],Math.max(a[0],a[1]));break;case 'SEL':return args[a[0]?2:1];case 'MUX':if(!Number.isInteger(a[0])||a[0]<0||a[0]>=a.length-1)throw new SclError('MUX: indeks poza zakresem.',e.tok);return args[a[0]+1];case 'SQR':v=a[0]**2;break;case 'TRUNC':v=Math.trunc(a[0]);t='DINT';break;case 'ROUND':v=roundEven(a[0]);t='DINT';break;case 'CEIL':v=Math.ceil(a[0]);t='DINT';break;case 'FLOOR':v=Math.floor(a[0]);t='DINT';break;default:{const fn={SQRT:'sqrt',SIN:'sin',COS:'cos',TAN:'tan',ASIN:'asin',ACOS:'acos',ATAN:'atan',LN:'log',LOG:'log10',EXP:'exp'}[name];v=Math[fn](a[0]);t='REAL';}}
  if(!Number.isFinite(v))throw new SclError('Wynik funkcji nie jest liczbą skończoną.',e.tok);return {v,t};
 }
 timerCall(s){let ref={...s.target,path:[...s.target.path]},mode=null;const last=ref.path.at(-1);if(last?.field&&['TON','TOF','TP'].includes(last.field.toUpperCase())){mode=last.field.toUpperCase();ref.path.pop();}const r=this.resolve(ref),timer=r.obj[r.key];if(r.type.kind!=='timer')throw new SclError('Wywołanie wymaga instancji TON_TIME, TOF_TIME, TP_TIME, R_TRIG lub F_TRIG.',s.tok);mode=mode||timer.__timer.replace('_TIME','');if(mode==='IEC_TIMER')mode='TON';let input={},outputs=[];for(const a of s.args){if(!a.name)throw new SclError('Wywołanie timera wymaga nazw parametrów.',s.tok);const name=a.name.toUpperCase();if(!timerFields.has(name))throw new SclError('Nieobsługiwany parametr timera: '+name,s.tok);if(a.out){if(a.value.k!=='ref'||!['Q','ET'].includes(name))throw new SclError('Nieprawidłowe wyjście timera.',s.tok);outputs.push(a);}else{if(!['IN','PT','CLK'].includes(name))throw new SclError('Parametr '+name+' jest wyjściem.',s.tok);input[name]=this.eval(a.value).v;}}
  if(mode==='R_TRIG'||mode==='F_TRIG'){if(typeof input.CLK!=='boolean')throw new SclError('CLK wymaga BOOL.',s.tok);timer.Q=mode==='R_TRIG'?input.CLK&&!timer.prev:!input.CLK&&timer.prev;timer.prev=input.CLK;timer.CLK=input.CLK;}
  else{if(typeof input.IN!=='boolean'||typeof input.PT!=='number'||input.PT<0)throw new SclError('Timer wymaga IN: BOOL i PT: nieujemny TIME.',s.tok);const active=input.IN,pt=input.PT,rise=active&&!timer.prev;
   if(mode==='TON'){if(!active){timer.start=null;timer.Q=false;timer.ET=0;}else{if(timer.start===null)timer.start=this.now;timer.ET=Math.min(pt,this.now-timer.start);timer.Q=timer.ET>=pt;}}
   else if(mode==='TOF'){if(active){timer.Q=true;timer.start=null;timer.ET=0;}else if(timer.prev){timer.start=this.now;timer.ET=0;timer.Q=pt>0;}else if(timer.start!==null){timer.ET=Math.min(pt,this.now-timer.start);timer.Q=timer.ET<pt;}}
   else if(mode==='TP'){if(rise&&!timer.active){timer.start=this.now;timer.active=true;}if(timer.active){timer.ET=Math.min(pt,this.now-timer.start);timer.Q=timer.ET<pt;if(!timer.Q)timer.active=false;}else if(!active){timer.ET=0;timer.Q=false;}}
   else throw new SclError('Nieobsługiwany timer: '+mode,s.tok);timer.prev=active;timer.IN=active;timer.PT=pt;
  }for(const a of outputs)this.set(a.value,timer[a.name.toUpperCase()]);
 }
 validate(){const expr=e=>{if(!e)return;if(e.k==='ref'){let root=e.global?this.globals:this.locals;let key=findKey(root,e.root);if(key===undefined)throw new SclError('Nieznana zmienna '+(e.global?'"'+e.root+'"':'#'+e.root)+'. Dodaj deklarację lub global w JSON.',e.tok);for(const p of e.path)for(const ix of p.indices||[])expr(ix);}
   else if(e.k==='func'){if(!mathFns.has(e.target.root.toUpperCase())&&!supportsStandard(e.target.root.toUpperCase()))throw new SclError('Nieobsługiwana funkcja: '+e.target.root,e.tok);e.args.forEach(a=>expr(a.value));}else if(e.k==='binary'){expr(e.a);expr(e.b);}else if(e.k==='unary')expr(e.a);};
  const walk=(b,inLoop=false)=>{for(const s of b){if(s.k==='assign'){expr(s.target);expr(s.value);}else if(s.k==='call'){expr(s.target);s.args.forEach(a=>expr(a.value));}else if(s.k==='if'){s.branches.forEach(x=>{expr(x.c);walk(x.b,inLoop);});walk(s.other,inLoop);}else if(s.k==='case'){expr(s.value);s.cases.forEach(x=>{x.labels.forEach(([a,b])=>{expr(a);expr(b);});walk(x.b,inLoop);});walk(s.other,inLoop);}else if(s.k==='for'){expr(s.target);expr(s.lo);expr(s.hi);expr(s.by);walk(s.b,true);}else if(s.k==='while'||s.k==='repeat'){expr(s.c);walk(s.b,true);}else if((s.k==='exit'||s.k==='continue')&&!inLoop)throw new SclError(s.k.toUpperCase()+' wymaga pętli.',s.tok);}};walk(this.program.body);
 }
 recordDebug(line,expressions){if(!this.debugEnabled)return;const values=snapshotRefs(this,expressions);if(values.length)this.debugPending.set(line,{line,cycle:this.scans+1,values});}
 tick(tok){if(++this.ops>this.maxOps)throw new SclError('Przekroczono limit '+this.maxOps+' instrukcji w cyklu. Sprawdź pętle.',tok);}
 bool(e){const v=this.eval(e).v;if(typeof v!=='boolean')throw new SclError('Warunek wymaga BOOL.',e.tok);return v;}
 *execute(block){for(const s of block){this.tick(s.tok);yield s.tok.line;
  switch(s.k){case 'assign':this.set(s.target,this.eval(s.value).v);this.recordDebug(s.tok.line,[s.target,s.value]);break;case 'call':this.timerCall(s);this.recordDebug(s.tok.line,[s.target,...s.args.map(a=>a.value)]);break;
   case 'if':{let chosen=s.other;for(const br of s.branches){const result=this.bool(br.c);this.recordDebug(br.c.tok?.line||s.tok.line,[br.c]);if(result){chosen=br.b;break;}}const flow=yield* this.execute(chosen);if(flow)return flow;break;}
   case 'case':{let v=this.eval(s.value).v,chosen=s.other;this.recordDebug(s.tok.line,[s.value]);outer:for(const c of s.cases)for(const [lo,hi] of c.labels)if(v>=this.eval(lo).v&&v<=this.eval(hi).v){chosen=c.b;break outer;}const flow=yield* this.execute(chosen);if(flow)return flow;break;}
   case 'for':{let lo=this.eval(s.lo).v,hi=this.eval(s.hi).v,by=this.eval(s.by).v;if(!Number.isInteger(lo)||!Number.isInteger(hi)||!Number.isInteger(by)||by===0)throw new SclError('FOR wymaga całkowitych granic i BY różnego od 0.',s.tok);for(let i=lo;by>0?i<=hi:i>=hi;i+=by){this.tick(s.tok);this.set(s.target,i);this.recordDebug(s.tok.line,[s.target,s.lo,s.hi]);const flow=yield* this.execute(s.b);if(flow==='return')return flow;if(flow==='exit')break;}break;}
   case 'while':while(this.bool(s.c)){this.tick(s.tok);let flow=yield* this.execute(s.b);if(flow==='return')return flow;if(flow==='exit')break;yield s.tok.line;}break;
   case 'repeat':do{this.tick(s.tok);let flow=yield* this.execute(s.b);if(flow==='return')return flow;if(flow==='exit')break;if(this.bool(s.c))break;yield s.tok.line;}while(true);break;
   case 'exit':return 'exit';case 'continue':return 'continue';case 'return':return 'return';
  }
 }}
 beginScan(){this.ops=0;this.debugPending=new Map();for(const d of this.program.decls)if(d.section==='VAR_TEMP'){this.locals[d.name]=makeValue(d.type);if(d.init)this.locals[d.name]=coerce(this.eval(d.init).v,d.type,d.tok);}this.generator=this.execute(this.program.body);const n=this.generator.next();this.nextLine=n.value??null;if(n.done)this.finishScan();}
 finishScan(){if(this.debugEnabled)this.debugCompleted=new Map(this.debugPending);this.generator=null;this.nextLine=null;this.scans++;this.now+=this.dt;this.onScan?.(this);}
 step(){if(!this.generator){this.beginScan();if(!this.generator)return {scanDone:true,line:null};}this.lastLine=this.nextLine;const n=this.generator.next();if(n.done)this.finishScan();else this.nextLine=n.value;return {scanDone:!this.generator,line:this.lastLine,nextLine:this.nextLine};}
 scan(){const scan=this.scans;while(this.scans===scan)this.step();}
 input(name,value){const key=findKey(this.locals,name);if(key===undefined)throw new SclError('Nieznana zmienna: '+name);this.locals[key]=coerce(value,this.schemas[key]);}
 ref(text){let p=new Parser(text);const r=p.reference();p.need('EOF');return r;}
 read(text){return this.get(this.ref(text));}write(text,value){this.set(this.ref(text),value);}
}
function roundEven(x){let floor=Math.floor(x),f=x-floor;return f===.5?(floor%2===0?floor:floor+1):Math.round(x);}
export function compile(source,options){if(source.length>1000000)throw new SclError('Program może mieć najwyżej 1 MB.');return new Machine(new Parser(source).parse(),options);}
export function globalsFromJSON(text){const data=JSON.parse(text),g=Object.create(null);const infer=v=>{if(v===null)throw new SclError('JSON nie może zawierać null.');if(typeof v==='boolean')return scalar('BOOL');if(typeof v==='number')return scalar(Number.isInteger(v)?'DINT':'REAL');if(typeof v==='string')return scalar('STRING');if(Array.isArray(v)){if(!v.length)throw new SclError('Tablica JSON nie może być pusta.');let type=infer(v[0]);for(const x of v)if(JSON.stringify(infer(x))!==JSON.stringify(type))throw new SclError('Elementy tablicy JSON muszą mieć ten sam typ.');return {kind:'array',dims:[[0,v.length-1]],of:type};}if(typeof v==='object')return {kind:'struct',fields:Object.entries(v).map(([name,val])=>({name:safeKey(name),type:infer(val)}))};throw new SclError('Nieobsługiwana wartość JSON.');};if(!data||Array.isArray(data)||typeof data!=='object')throw new SclError('Globalne dane muszą być obiektem JSON.');for(const [name,value]of Object.entries(data)){safeKey(name);g[name]={type:infer(value),value};}return g;}
export class MagnetPlant {
 constructor(machine,{travel=180,auto=true,fault='none'}={}){this.machine=machine;this.travel=travel;this.auto=auto;this.fault=fault;this.positions=new Map();for(let b=1;b<=8;b++)for(let m=1;m<=4;m++)this.positions.set(b+':'+m,{pos:0,target:0});this.conflict=false;}
 cylinder(b,m){return this.machine.globals.St1_Urzadzenia_A_DB?.value?.Belka?.[b]?.['SilownikMagnes'+m];}
 update(){if(!this.auto)return;this.conflict=false;for(let b=1;b<=8;b++)for(let m=1;m<=4;m++){const c=this.cylinder(b,m);if(!c)continue;const p=this.positions.get(b+':'+m);if(c.Wysuw&&c.Zasuw)this.conflict=true;else if(c.Wysuw)p.target=1;else if(c.Zasuw)p.target=0;
  const jam=this.fault==='jam'&&b===1&&m===1;if(!jam){const step=this.machine.dt/Math.max(20,this.travel);p.pos=p.target>p.pos?Math.min(p.target,p.pos+step):Math.max(p.target,p.pos-step);}c.CzujnikWysuw=p.pos>=1;c.CzujnikZasuw=p.pos<=0;if(this.fault==='sensor'&&b===1&&m===1)c.CzujnikWysuw=false;if(this.fault==='both'&&b===1&&m===1){c.CzujnikWysuw=true;c.CzujnikZasuw=true;}}
 }
}
