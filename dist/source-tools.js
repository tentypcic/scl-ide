import {Parser,compile,SclError} from './engine.js';
const sections=new Set(['VAR_INPUT','VAR_OUTPUT','VAR_IN_OUT','VAR','VAR_TEMP']);
const valueTypes=new Set(['BOOL','INT','DINT','REAL','LREAL','TIME','STRING','TON_TIME','TOF_TIME','TP_TIME','R_TRIG','F_TRIG']);
function offset(source,token){const lines=source.split('\n');return lines.slice(0,token.line-1).reduce((n,l)=>n+l.length+1,0)+token.col-1;}
export function insertDeclaration(source,{name,section='VAR_INPUT',type='BOOL',initial='',array=false,lower=1,upper=8}){
 name=name.trim();type=type.toUpperCase();
 if(!/^[A-Za-z_\u00c0-\u024f][\w\u00c0-\u024f]*$/.test(name))throw new SclError('Nazwa musi zaczynać się literą lub _ i nie może zawierać spacji.');
 if(!sections.has(section)||!valueTypes.has(type))throw new SclError('Nieobsługiwana sekcja lub typ.');
 const parser=new Parser(source),program=parser.parse();if(program.decls.some(d=>d.name.toLowerCase()===name.toLowerCase()))throw new SclError('Zmienna '+name+' już istnieje.');
 let spec=type;
 if(array){lower=Number(lower);upper=Number(upper);if(!Number.isInteger(lower)||!Number.isInteger(upper)||upper<lower||upper-lower>=10000)throw new SclError('Podaj całkowite granice tablicy, maksymalnie 10 000 elementów.');spec='Array['+lower+'..'+upper+'] of '+type;}
 let declaration=name+' : '+spec;
 if(initial.trim()&&!array){if(['TON_TIME','TOF_TIME','TP_TIME','R_TRIG','F_TRIG'].includes(type))throw new SclError('Instancja timera nie wymaga wartości początkowej.');declaration+=' := '+initial.trim();}
 declaration+=';';
 // Parse and evaluate the proposed initializer before changing the user's code.
 compile('VAR\n'+declaration+'\nEND_VAR');
 const tokens=parser.tokens;let result;let existing=tokens.findIndex(t=>t.u===section);
 if(existing>=0){const end=tokens.slice(existing+1).find(t=>t.u==='END_VAR');if(!end)throw new SclError('Brak END_VAR.');const pos=offset(source,end);result=source.slice(0,pos)+'    '+declaration+'\n'+source.slice(pos);}
 else{const target=tokens.find(t=>t.u==='BEGIN')||program.body[0]?.tok||tokens.find(t=>['END_FUNCTION_BLOCK','END_FUNCTION','END_ORGANIZATION_BLOCK'].includes(t.u))||tokens.at(-1);const pos=offset(source,target);result=source.slice(0,pos)+'\n'+section+'\n    '+declaration+'\nEND_VAR\n'+source.slice(pos);}
 new Parser(result).parse();return result;
}
export function ioSignals(machine,max=80){if(!machine)return {inputs:[],outputs:[],truncated:false};const result={inputs:[],outputs:[],truncated:false};let count=0;
 const visit=(name,type,value,path,destination)=>{if(count>=max){result.truncated=true;return;}if(type.kind==='scalar'){result[destination].push({name,type,value,path});count++;return;}if(type.kind==='struct'){for(const f of type.fields)visit(name+'.'+f.name,f.type,value[f.name],path+'.'+f.name,destination);return;}if(type.kind==='array'){const rec=(dims,obj,indices=[])=>{const[lo,hi]=dims[0];for(let i=lo;i<=hi&&count<max;i++){if(dims.length===1){const ix=[...indices,i].join(',');visit(name+'['+ix+']',type.of,obj[i],path+'['+ix+']',destination);}else rec(dims.slice(1),obj[i],[...indices,i]);}if(count>=max)result.truncated=true;};rec(type.dims,value);}}
 for(const name of Object.keys(machine.locals)){const section=machine.sections[name];if(['VAR_INPUT','VAR_IN_OUT','VAR_OUTPUT'].includes(section))visit(name,machine.schemas[name],machine.locals[name],'#'+name,section==='VAR_OUTPUT'?'outputs':'inputs');}
 return result;
}
