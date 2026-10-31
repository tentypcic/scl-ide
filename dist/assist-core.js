import {standardSignatures} from './standard-functions.js';
import {Parser,globalsFromJSON} from './engine.js';
export const snippets=[
 {label:'IF',kind:'szablon',detail:'Warunek IF / THEN',insert:'IF ${1:Warunek} THEN\n    ${2:// kod}\nEND_IF;${0}'},
 {label:'IF ELSE',kind:'szablon',detail:'Dwie gałęzie warunku',insert:'IF ${1:Warunek} THEN\n    ${2:// gdy TRUE}\nELSE\n    ${3:// gdy FALSE}\nEND_IF;${0}'},
 {label:'CASE',kind:'szablon',detail:'Sekwencja krokowa CASE / OF',insert:'CASE ${1:#Krok} OF\n    ${2:0}:\n        ${3:// kod kroku}\n    ${4:10}:\n        ${5:// kod kroku}\n    ELSE\n        ${6:// nieznany stan}\nEND_CASE;${0}'},
 {label:'FOR',kind:'szablon',detail:'Pętla z licznikiem',insert:'FOR ${1:#i} := ${2:1} TO ${3:10} DO\n    ${4:// kod pętli}\nEND_FOR;${0}'},
 {label:'WHILE',kind:'szablon',detail:'Pętla wykonywana, gdy warunek jest TRUE',insert:'WHILE ${1:Warunek} DO\n    ${2:// kod pętli}\nEND_WHILE;${0}'},
 {label:'REPEAT',kind:'szablon',detail:'Pętla do spełnienia warunku',insert:'REPEAT\n    ${1:// kod pętli}\nUNTIL ${2:Warunek}\nEND_REPEAT;${0}'},
 {label:'TON',kind:'szablon',detail:'Opóźnienie załączenia — zadeklaruj TON_TIME',insert:'${1:#Timer}(IN := ${2:#Start},\n           PT := ${3:T#1s},\n           Q => ${4:#Gotowe});${0}'},
 {label:'TOF',kind:'szablon',detail:'Opóźnienie wyłączenia — zadeklaruj TOF_TIME',insert:'${1:#Timer}(IN := ${2:#Start},\n           PT := ${3:T#1s},\n           Q => ${4:#Wyjscie});${0}'},
 {label:'R_TRIG',kind:'szablon',detail:'Zbocze narastające — zadeklaruj R_TRIG',insert:'${1:#Zbocze}(CLK := ${2:#Start});\nIF ${3:#Zbocze}.Q THEN\n    ${4:// kod na zboczu}\nEND_IF;${0}'},
 {label:'VAR_INPUT',kind:'szablon',detail:'Deklaracja wejść',insert:'VAR_INPUT\n    ${1:Nazwa} : ${2:Bool};\nEND_VAR${0}'},
 {label:'VAR_OUTPUT',kind:'szablon',detail:'Deklaracja wyjść',insert:'VAR_OUTPUT\n    ${1:Nazwa} : ${2:Bool};\nEND_VAR${0}'},
 {label:'ARRAY',kind:'szablon',detail:'Typ tablicowy z jawnymi granicami',insert:'Array[${1:1}..${2:10}] of ${3:Int}${0}'},
 {label:'STRUCT',kind:'szablon',detail:'Struktura danych',insert:'Struct\n    ${1:Pole} : ${2:Bool};\nEND_STRUCT${0}'}
];
const keywords='TRUE FALSE AND OR NOT XOR MOD ELSIF ELSE THEN END_IF END_CASE END_FOR RETURN EXIT CONTINUE BEGIN END_VAR END_FUNCTION_BLOCK'.split(' ');
const types='Bool Int DInt Real LReal Time String TON_TIME TOF_TIME TP_TIME R_TRIG F_TRIG'.split(' ');
export const signatures={...standardSignatures,ABS:'ABS(wartość)',MIN:'MIN(wartość1, wartość2)',MAX:'MAX(wartość1, wartość2)',LIMIT:'LIMIT(minimum, wartość, maksimum)',SEL:'SEL(warunek, gdy_FALSE, gdy_TRUE)',INT_TO_REAL:'INT_TO_REAL(wartość_INT)',REAL_TO_INT:'REAL_TO_INT(wartość_REAL)',SQRT:'SQRT(wartość)',TRUNC:'TRUNC(wartość_REAL)'};
function sectionPrefix(source){const re=/\/\*[\s\S]*?\*\/|\(\*[\s\S]*?\*\)|\/\/[^\n]*|"(?:[^"]|"")*"|'(?:[^']|'')*'|\bBEGIN\b/gi;for(const m of source.matchAll(re))if(m[0].toUpperCase()==='BEGIN')return source.slice(0,m.index);const ends=[...source.matchAll(/\bEND_VAR\b/gi)];if(ends.length){const last=ends.at(-1);return source.slice(0,last.index+last[0].length);}return '';}
export function collectSymbols(source,machine=null,globalsJSON='{}'){
 let locals={...(machine?.schemas||{})},sections={...(machine?.sections||{})},globals={...(machine?.globals||{})};
 try{const prefix=sectionPrefix(source);if(prefix){const p=new Parser(prefix+'\nBEGIN\nEND_FUNCTION_BLOCK').parse();locals={};sections={};for(const d of p.decls){locals[d.name]=d.type;sections[d.name]=d.section;}}}catch{}
 try{globals={...globals,...globalsFromJSON(globalsJSON)};}catch{}
 return {locals,sections,globals};
}
function textState(s){let state='code';for(let i=0;i<s.length;i++){let a=s[i],b=s[i+1];if(state==='line'){if(a==='\n')state='code';continue;}if(state==='block'){if(a==='*'&&b===')'){state='code';i++;}continue;}if(state==='cblock'){if(a==='*'&&b==='/'){state='code';i++;}continue;}if(state==='single'){if(a==='$'){i++;continue;}if(a==="'"){if(b==="'")i++;else state='code';}continue;}if(state==='double'){if(a==='"'){if(b==='"')i++;else state='code';}continue;}if(a==='/'&&b==='/'){state='line';i++;}else if(a==='/'&&b==='*'){state='cblock';i++;}else if(a==='('&&b==='*'){state='block';i++;}else if(a==="'")state='single';else if(a==='"')state='double';}return state;}
function memberBase(before,dot){let depth=0,quoted=false,i=dot-1;for(;i>=0;i--){const c=before[i];if(c==='"'){quoted=!quoted;continue;}if(quoted)continue;if(c===']'){depth++;continue;}if(c==='['){depth--;continue;}if(depth===0&&(/[\s;:=()+*/<>-]/.test(c)))break;}return before.slice(i+1,dot);}
function rootKey(obj,k){return Object.keys(obj).find(x=>x.toLowerCase()===k.toLowerCase());}
export function resolveMemberType(base,symbols){try{const p=new Parser(base),r=p.reference();p.need('EOF');let root=rootKey(r.global?symbols.globals:symbols.locals,r.root);let type=r.global?symbols.globals[root]?.type:symbols.locals[root];for(const seg of r.path){if(seg.indices){if(type?.kind!=='array')return null;type=type.of;}else if(type?.kind==='struct')type=type.fields.find(f=>f.name.toLowerCase()===seg.field.toLowerCase())?.type;else return null;}return type;}catch{return null;}}
export function suggestions(source,caret,symbols,{manual=false,snippetsOnly=false}={}){
 if(snippetsOnly)return {start:caret,end:caret,prefix:'',items:snippets.map(s=>({...s,snippet:true}))};
 const before=source.slice(0,caret),state=textState(before);if(['line','block','cblock','single'].includes(state)&&!snippetsOnly)return null;
 const member=/\.([A-Za-z_\u00c0-\u024f\d]*)$/.exec(before);let items=[],prefix='',start=caret;
 if(member&&state==='code'){
  prefix=member[1];start=caret-prefix.length;const type=resolveMemberType(memberBase(before,caret-prefix.length-1),symbols);if(type?.kind==='struct')items=type.fields.map(f=>({label:f.name,insert:f.name,kind:'pole',detail:f.type.name||f.type.kind}));
  if(type?.kind==='timer')items=[['Q','Bool'],['ET','Time'],['IN','Bool'],['PT','Time'],...(type.name.includes('TRIG')?[['CLK','Bool']]:[])].map(([name,type])=>({label:name,insert:name,kind:'pole',detail:type}));
 }else if(state==='double'){
  const quote=before.lastIndexOf('"');prefix=before.slice(quote+1);start=quote+1;items=Object.keys(symbols.globals).map(n=>({label:n,insert:n+(source[caret]==='"'?'':'"'),kind:'globalna',detail:'Tag lub DB'}));
 }else{
  const match=/(#?[A-Za-z_\u00c0-\u024f][\w\u00c0-\u024f]*|#)$/.exec(before);if(match){prefix=match[1].replace(/^#/,'');start=caret-match[1].length;}else if(!manual&&!snippetsOnly)return null;
  const hasHash=match?.[1].startsWith('#');if(!snippetsOnly){for(const [n,t]of Object.entries(symbols.locals))items.push({label:'#'+n,match:n,insert:'#'+n,kind:'zmienna',detail:(t.name||t.kind)+' · '+(symbols.sections[n]||'VAR')});if(!hasHash){for(const n of Object.keys(symbols.globals))items.push({label:'"'+n+'"',match:n,insert:'"'+n+'"',kind:'globalna',detail:'Tag lub DB'});for(const n of types)items.push({label:n,insert:n,kind:'typ',detail:'Typ danych SCL'});for(const [n,detail]of Object.entries(signatures))items.push({label:n,insert:Object.hasOwn(standardSignatures,n)?n+'('+standardSignatures[n].slice(n.length+1,-1).split(', ').map((p,i)=>p+':= ${'+(i+1)+':wartość}').join(', ')+')${0}':['MIN','MAX'].includes(n)?n+'(${1:wartość1}, ${2:wartość2})${0}':n==='LIMIT'?n+'(${1:min}, ${2:wartość}, ${3:max})${0}':n==='SEL'?n+'(${1:warunek}, ${2:gdy_FALSE}, ${3:gdy_TRUE})${0}':n+'(${1:wartość})${0}',kind:'funkcja',detail,snippet:true});for(const n of keywords)items.push({label:n,insert:n,kind:'słowo',detail:'Słowo kluczowe SCL'});}}
  if(!hasHash)items.push(...snippets.map(s=>({...s,snippet:true})));
 }
 const query=prefix.toLowerCase();items=items.filter(i=>(i.match||i.label.replace(/^[#"]/, '')).toLowerCase().startsWith(query));const order={'zmienna':0,'pole':0,'globalna':1,'szablon':2,'funkcja':3,'typ':4,'słowo':5};items.sort((a,b)=>(order[a.kind]??9)-(order[b.kind]??9)||a.label.localeCompare(b.label));
 return items.length?{start,end:caret,items:items.slice(0,40),prefix}:null;
}
export function expandSnippet(template,indent=''){
 const source=template.replace(/\n/g,'\n'+indent);let text='',last=0,stops=[];for(const m of source.matchAll(/\$\{(\d+)(?::([^}]*))?\}/g)){text+=source.slice(last,m.index);let start=text.length;text+=m[2]||'';stops.push({index:Number(m[1]),start,end:text.length});last=m.index+m[0].length;}text+=source.slice(last);stops.sort((a,b)=>(a.index===0?999:a.index)-(b.index===0?999:b.index));return {text,stops};
}
export function signatureAt(source,caret,symbols){const before=source.slice(0,caret);if(textState(before)!=='code')return null;const match=/(#?[A-Za-z_][\w]*)(?:\.TON|\.TOF|\.TP)?\([^()]*$/i.exec(before);if(!match)return null;const name=match[1],type=symbols.locals[rootKey(symbols.locals,name.replace(/^#/,''))];if(type?.kind==='timer')return type.name.includes('TRIG')?name+'(CLK := BOOL, Q => BOOL)':name+'(IN := BOOL, PT := TIME, Q => BOOL, ET => TIME)';return signatures[name.toUpperCase()]||null;}
