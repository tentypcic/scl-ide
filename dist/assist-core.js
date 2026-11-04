import {standardSignatures} from './standard-functions.js';
import {Parser,globalsFromJSON,supportedFunctions,supportedTypes,declarationSections,languageKeywords,resolveProgramTypes} from './engine.js';
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
 {label:'TYPE',kind:'szablon',detail:'Definicja typu UDT; wklej przed blokiem lub w osobnym pliku projektu',insert:'TYPE \"${1:UDT_Nazwa}\"\nVERSION : 1.0\nSTRUCT\n    ${2:Pole} : ${3:REAL};\nEND_STRUCT;\nEND_TYPE${0}'},
 {label:'STRUCT',kind:'szablon',detail:'Struktura danych',insert:'Struct\n    ${1:Pole} : ${2:Bool};\nEND_STRUCT${0}'}
];
// Complete the executable function inventory, rather than a hand-picked subset.
const positionalParameters={MIN:['wartość1','wartość2'],MAX:['wartość1','wartość2'],LIMIT:['minimum','wartość','maksimum'],SEL:['warunek','gdy_FALSE','gdy_TRUE'],MUX:['indeks','wartość0','wartość1']};
export const signatures=Object.fromEntries(supportedFunctions.map(name=>[name,standardSignatures[name]||name+'('+(positionalParameters[name]||[name==='INT_TO_REAL'?'wartość_INT':name==='REAL_TO_INT'?'wartość_REAL':['TRUNC'].includes(name)?'wartość_REAL':'wartość']).join(', ')+')']));
export function functionTemplate(name){
 const params=Object.hasOwn(standardSignatures,name)?standardSignatures[name].slice(name.length+1,-1).split(', '):(positionalParameters[name]||['wartość']);
 return name+'('+params.map((param,i)=>Object.hasOwn(standardSignatures,name)?param+':= ${'+(i+1)+':wartość}':'${'+(i+1)+':'+param+'}').join(', ')+')${0}';
}
const sectionDetails={VAR:'Pamięć statyczna',VAR_INPUT:'Wejścia',VAR_OUTPUT:'Wyjścia',VAR_IN_OUT:'Wejście/wyjście — lokalna kopia',VAR_TEMP:'Zmienne tymczasowe',VAR_STAT:'Pamięć statyczna',VAR_CONSTANT:'Stałe'};
for(const section of declarationSections)if(!snippets.some(s=>s.label===section))snippets.push({label:section,kind:'szablon',detail:sectionDetails[section],insert:section+'\n    ${1:Nazwa} : ${2:INT}'+(section==='VAR_CONSTANT'?' := ${3:0}':'')+';\nEND_VAR${0}'});
snippets.push(
 {label:'REGION',kind:'szablon',detail:'Nazwany region kodu z END_REGION',insert:'REGION ${1:Nazwa_regionu}\n    ${2:// kod regionu}\nEND_REGION${0}'},
 {label:'IF ELSIF ELSE',kind:'szablon',detail:'Warunek z dodatkową gałęzią ELSIF',insert:'IF ${1:Warunek1} THEN\n    ${2:// pierwsza gałąź}\nELSIF ${3:Warunek2} THEN\n    ${4:// druga gałąź}\nELSE\n    ${5:// pozostałe przypadki}\nEND_IF;${0}'},
 {label:'FOR BY',kind:'szablon',detail:'Pętla z jawnym krokiem, również ujemnym',insert:'FOR ${1:#i} := ${2:10} TO ${3:1} BY ${4:-1} DO\n    ${5:// kod pętli}\nEND_FOR;${0}'},
 {label:'TP',kind:'szablon',detail:'Impuls czasowy — zadeklaruj TP_TIME',insert:'${1:#Timer}(IN := ${2:#Start}, PT := ${3:T#1s}, Q => ${4:#Wyjscie});${0}'},
 {label:'F_TRIG',kind:'szablon',detail:'Zbocze opadające — zadeklaruj F_TRIG',insert:'${1:#Zbocze}(CLK := ${2:#Start});\nIF ${3:#Zbocze}.Q THEN\n    ${4:// kod na zboczu}\nEND_IF;${0}'},
 {label:'FUNCTION_BLOCK',kind:'szablon',detail:'Nagłówek i ciało pojedynczego FB',insert:'FUNCTION_BLOCK "${1:FB_Nazwa}"\nVAR_INPUT\n    ${2:Start} : BOOL;\nEND_VAR\nVAR\n    ${3:Licznik} : INT;\nEND_VAR\nBEGIN\n    ${4:// kod bloku}\nEND_FUNCTION_BLOCK${0}'},
 {label:'FUNCTION',kind:'szablon',detail:'Nagłówek pojedynczej funkcji; VOID lub typ wyniku',insert:'FUNCTION "${1:FC_Nazwa}" : ${2:VOID}\nVAR_INPUT\n    ${3:Start} : BOOL;\nEND_VAR\nVAR_TEMP\n    ${4:i} : INT;\nEND_VAR\nBEGIN\n    ${5:// kod funkcji}\nEND_FUNCTION${0}'},
 {label:'ORGANIZATION_BLOCK',kind:'szablon',detail:'Nagłówek OB — wykonywany jako jeden blok, bez harmonogramu CPU',insert:'ORGANIZATION_BLOCK "${1:OB_Nazwa}"\nVAR_TEMP\n    ${2:i} : INT;\nEND_VAR\nBEGIN\n    ${3:// kod bloku}\nEND_ORGANIZATION_BLOCK${0}'}
);
const keywords=languageKeywords.filter(name=>!snippets.some(s=>s.label===name));
const types=supportedTypes;
function sectionPrefix(source){const re=/\/\*[\s\S]*?\*\/|\(\*[\s\S]*?\*\)|\/\/[^\n]*|"(?:[^"]|"")*"|'(?:[^']|'')*'|\bBEGIN\b/gi;for(const m of source.matchAll(re))if(m[0].toUpperCase()==='BEGIN')return source.slice(0,m.index);const ends=[...source.matchAll(/\bEND_VAR\b/gi)];if(ends.length){const last=ends.at(-1);return source.slice(0,last.index+last[0].length);}return '';}
export function collectSymbols(source,machine=null,globalsJSON='{}',typeSources=[]){
 let locals={...(machine?.schemas||{})},sections={...(machine?.sections||{})},globals={...(machine?.globals||{})},types={};
 // Keep type names available while an incomplete declaration/body is being typed.
 try{const parser=new Parser(source);parser.definitions();types=resolveProgramTypes({decls:[],body:[],typeDefinitions:parser.typeDefinitions},typeSources).types;}catch{try{types=resolveProgramTypes({decls:[],body:[],typeDefinitions:[]},typeSources).types;}catch{}}
 let program;
 try{program=new Parser(source,{typeSources}).parse();}catch{
  try{const prefix=sectionPrefix(source);if(prefix){const parser=new Parser(prefix);parser.definitions();const end={FUNCTION:'END_FUNCTION',ORGANIZATION_BLOCK:'END_ORGANIZATION_BLOCK',FUNCTION_BLOCK:'END_FUNCTION_BLOCK'}[parser.peek().u]||'';program=new Parser(prefix+'\nBEGIN\n'+end,{typeSources}).parse();}}catch{}
 }
 if(program){types=program.types;locals={};sections={};for(const d of program.decls){locals[d.name]=d.type;sections[d.name]=d.section;}if(program.returnType&&!Object.hasOwn(locals,program.name)){locals[program.name]=program.returnType;sections[program.name]='VAR_OUTPUT';}}
 try{globals={...globals,...globalsFromJSON(globalsJSON)};}catch{}
 return {locals,sections,globals,types};
}
const typeContext=context=>/^\s*[\w\u00c0-\u024f, ]+\s*:\s*(?:ARRAY\s*\[[^\]]*\]\s*OF\s*)?$/i.test(context)||/^\s*FUNCTION\s+(?:"[^"]+"|\w+)\s*:\s*$/i.test(context);
const quoteType=name=>'"'+name.replaceAll('"','""')+'"';
const udtItems=symbols=>Object.keys(symbols.types||{}).map(n=>({label:n,insert:quoteType(n),kind:'typ',detail:'Typ UDT z projektu'}));

function textState(s){let state='code';for(let i=0;i<s.length;i++){let a=s[i],b=s[i+1];if(state==='line'){if(a==='\n')state='code';continue;}if(state==='block'){if(a==='*'&&b===')'){state='code';i++;}continue;}if(state==='cblock'){if(a==='*'&&b==='/'){state='code';i++;}continue;}if(state==='single'){if(a==='$'){i++;continue;}if(a==="'"){if(b==="'")i++;else state='code';}continue;}if(state==='double'){if(a==='"'){if(b==='"')i++;else state='code';}continue;}if(a==='/'&&b==='/'){state='line';i++;}else if(a==='/'&&b==='*'){state='cblock';i++;}else if(a==='('&&b==='*'){state='block';i++;}else if(a==="'")state='single';else if(a==='"')state='double';}return state;}
function memberBase(before,dot){let depth=0,quoted=false,i=dot-1;for(;i>=0;i--){const c=before[i];if(c==='"'){quoted=!quoted;continue;}if(quoted)continue;if(c===']'){depth++;continue;}if(c==='['){depth--;continue;}if(depth===0&&(/[\s;:=()+*/<>-]/.test(c)))break;}return before.slice(i+1,dot);}
function rootKey(obj,k){return Object.keys(obj).find(x=>x.toLowerCase()===k.toLowerCase());}
export function resolveMemberType(base,symbols){try{const p=new Parser(base),r=p.reference();p.need('EOF');let root=rootKey(r.global?symbols.globals:symbols.locals,r.root);let type=r.global?symbols.globals[root]?.type:symbols.locals[root];for(const seg of r.path){if(seg.indices){if(type?.kind!=='array')return null;type=type.of;}else if(type?.kind==='struct')type=type.fields.find(f=>f.name.toLowerCase()===seg.field.toLowerCase())?.type;else return null;}return type;}catch{return null;}}
function debugSuggestions(before, caret, symbols) {
 const line=before.split('\n').at(-1);
 const directive=/^\s*\/\/\s*(@[a-z]*)$/i.exec(line);
 const command=/^\s*\/\/\s*@debug\s+([a-z]*)$/i.exec(line);
 const operands=/^\s*\/\/\s*@debug\s+(print|input)\s+(.*)$/i.exec(line);
 let prefix, items;
 if(directive){
  prefix=directive[1];
  items=[{label:'@debug',insert:'@debug ',kind:'dyrektywa',detail:'Dyrektywa debugowania'}];
 }else if(command){
  prefix=command[1];
  items=[
   {label:'log',insert:'log "${1:Komunikat}"${0}',snippet:true,kind:'dyrektywa',detail:'Wypisz komunikat'},
   {label:'print',insert:'print ',kind:'dyrektywa',detail:'Wypisz wartości zmiennych'},
   {label:'input',insert:'input ',kind:'dyrektywa',detail:'Poproś o wartość w konsoli'},
  ];
 }else if(operands){
  const input=operands[1].toLowerCase()==='input';
  const match=/(?:^|,\s*)([#"]?[\w\u00c0-\u024f]*)$/.exec(operands[2]);
  if(!match||(input&&match.index>0))return null;
  prefix=match[1];
  const variable=(label,detail)=>({label,detail,kind:'zmienna',insert:input?label+' "${1:Podaj wartość}"${0}':label,snippet:input});
  items=[];
  if(!prefix.startsWith('"'))for(const [name,type] of Object.entries(symbols.locals))items.push(variable('#'+name,type.name||type.kind));
  if(!prefix.startsWith('#'))for(const name of Object.keys(symbols.globals))items.push(variable('"'+name+'"','Tag lub DB'));
 }else return null;
 const query=prefix.toLowerCase().replace(/^[#"]/, '');
 items=items.filter(item=>item.label.toLowerCase().replace(/^[#"]/, '').startsWith(query)).slice(0,40);
 return items.length?{start:caret-prefix.length,end:caret,prefix,items}:null;
}
export function suggestions(source,caret,symbols,{manual=false,snippetsOnly=false}={}){
 if(snippetsOnly)return {start:caret,end:caret,prefix:'',items:snippets.map(s=>({...s,snippet:true}))};
 const before=source.slice(0,caret),state=textState(before);if(state==='line')return debugSuggestions(before,caret,symbols);if(state==='code'&&/(?:^|\n)\s*REGION\s+[^\n]*$/i.test(before))return null;if(['line','block','cblock','single'].includes(state)&&!snippetsOnly)return null;
 const member=/\.([A-Za-z_\u00c0-\u024f\d]*)$/.exec(before);let items=[],prefix='',start=caret;
 if(member&&state==='code'){
  prefix=member[1];start=caret-prefix.length;const type=resolveMemberType(memberBase(before,caret-prefix.length-1),symbols);if(type?.kind==='struct')items=type.fields.map(f=>({label:f.name,insert:f.name,kind:'pole',detail:f.type.udtName||f.type.name||f.type.kind}));
  if(type?.kind==='timer')items=[['Q','Bool'],['ET','Time'],['IN','Bool'],['PT','Time'],...(type.name.includes('TRIG')?[['CLK','Bool']]:[])].map(([name,type])=>({label:name,insert:name,kind:'pole',detail:type}));
  if(type?.kind==='timer'&&!type.name.includes('TRIG')){const modes=type.name==='IEC_TIMER'?['TON','TOF','TP']:[type.name.replace('_TIME','')];items.push(...modes.map(n=>({label:n,kind:'metoda',detail:n+'(IN := BOOL, PT := TIME, Q => BOOL, ET => TIME)',insert:n+'(IN := ${1:FALSE}, PT := ${2:T#1s});${0}',snippet:true})));}
 }else if(state==='double'){
  const quote=before.lastIndexOf('"');prefix=before.slice(quote+1);start=quote+1;if(typeContext(before.slice(0,quote).split('\n').at(-1))){items=udtItems(symbols).map(item=>({...item,insert:item.label.replaceAll('"','""')+(source[caret]==='"'?'':'"')}));}else items=Object.keys(symbols.globals).map(n=>({label:n,insert:n+(source[caret]==='"'?'':'"'),kind:'globalna',detail:'Tag lub DB'}));
 }else{
  const match=/(#?[A-Za-z_\u00c0-\u024f][\w\u00c0-\u024f]*|#)$/.exec(before);if(match){prefix=match[1].replace(/^#/,'');start=caret-match[1].length;}else if(!manual&&!snippetsOnly)return null;
  const hasHash=match?.[1].startsWith('#');const context=source.slice(0,start).split('\n').at(-1);const declarationType=/^\s*[\w\u00c0-\u024f, ]+\s*:\s*(?:ARRAY\s*\[[^\]]*\]\s*OF\s*)?$/i.test(context);const functionType=/^\s*FUNCTION\s+(?:"[^"]+"|\w+)\s*:\s*$/i.test(context);if((declarationType||functionType)&&!hasHash){items=[...types.map(n=>({label:n,insert:n,kind:'typ',detail:'Typ obsługiwany w SCL Lab'})),...udtItems(symbols)];items.push(...snippets.filter(s=>['ARRAY','STRUCT'].includes(s.label)).map(s=>({...s,snippet:true})));if(functionType)items.push({label:'VOID',insert:'VOID',kind:'typ',detail:'Funkcja bez wyniku'});const query=prefix.toLowerCase();return {start,end:caret,prefix,items:items.filter(i=>i.label.toLowerCase().startsWith(query))};}if(!snippetsOnly){for(const [n,t]of Object.entries(symbols.locals))items.push({label:'#'+n,match:n,insert:'#'+n,kind:'zmienna',detail:(t.udtName||t.name||t.kind)+' · '+(symbols.sections[n]||'VAR')});if(!hasHash){for(const n of Object.keys(symbols.globals))items.push({label:'"'+n+'"',match:n,insert:'"'+n+'"',kind:'globalna',detail:'Tag lub DB'});items.push(...udtItems(symbols));for(const n of types)items.push({label:n,insert:n,kind:'typ',detail:'Typ danych SCL'});for(const [n,detail]of Object.entries(signatures))items.push({label:n,insert:functionTemplate(n),kind:'funkcja',detail,snippet:true});for(const n of keywords)items.push({label:n,insert:n,kind:'słowo',detail:'Słowo kluczowe SCL'});}}
  if(!hasHash)items.push(...snippets.map(s=>({...s,snippet:true})));
 }
 const query=prefix.toLowerCase();items=items.filter(i=>(i.match||i.label.replace(/^[#"]/, '')).toLowerCase().startsWith(query));const order={'zmienna':0,'pole':0,'metoda':1,'globalna':1,'szablon':2,'funkcja':3,'typ':4,'słowo':5};items.sort((a,b)=>(order[a.kind]??9)-(order[b.kind]??9)||a.label.localeCompare(b.label));
 return items.length?{start,end:caret,items:items.slice(0,40),prefix}:null;
}
export function expandSnippet(template,indent=''){
 const source=template.replace(/\n/g,'\n'+indent);let text='',last=0,stops=[];for(const m of source.matchAll(/\$\{(\d+)(?::([^}]*))?\}/g)){text+=source.slice(last,m.index);let start=text.length;text+=m[2]||'';stops.push({index:Number(m[1]),start,end:text.length});last=m.index+m[0].length;}text+=source.slice(last);stops.sort((a,b)=>(a.index===0?999:a.index)-(b.index===0?999:b.index));return {text,stops};
}
export function signatureAt(source,caret,symbols){const before=source.slice(0,caret);if(textState(before)!=='code')return null;const match=/(#?[A-Za-z_\u00c0-\u024f][\w\u00c0-\u024f]*)(?:\.TON|\.TOF|\.TP)?\([^()]*$/i.exec(before);if(!match)return null;const name=match[1],type=symbols.locals[rootKey(symbols.locals,name.replace(/^#/,''))];if(type?.kind==='timer')return type.name.includes('TRIG')?name+'(CLK := BOOL, Q => BOOL)':name+'(IN := BOOL, PT := TIME, Q => BOOL, ET => TIME)';return signatures[name.toUpperCase()]||null;}
