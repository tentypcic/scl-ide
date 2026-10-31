import test from 'node:test';
import assert from 'node:assert/strict';
import {Parser,compile,supportedFunctions,supportedTypes,declarationSections,languageKeywords} from '../dist/engine.js';
import {collectSymbols,suggestions,expandSnippet,snippets,signatureAt} from '../dist/assist-core.js';
import {standardSignatures} from '../dist/standard-functions.js';

const header='VAR Start:BOOL; Timer:TON_TIME; Off:TOF_TIME; Pulse:TP_TIME; Any:IEC_TIMER; Edge:F_TRIG; END_VAR\nBEGIN\n';
const symbols=collectSymbols(header);
const completion=(prefix,source=header)=>{const text=source+prefix;return suggestions(text,text.length,symbols)?.items||[];};

test('every executable function has completion, valid argument template and signature help',()=>{
  const standardArgs={LEN:["'ABC'"],CONCAT:["'A'","'B'"],LEFT:["'ABC'",'1'],RIGHT:["'ABC'",'1'],MID:["'ABC'",'1','1'],FIND:["'ABC'","'B'"],INSERT:["'ABC'","'X'",'1'],DELETE:["'ABC'",'1','1'],REPLACE:["'ABC'","'X'",'1','1'],SHL:['WORD#1','1'],SHR:['WORD#2','1'],ROL:['WORD#1','1'],ROR:['WORD#1','1'],NORM_X:['0','50','100'],SCALE_X:['0','0.5','100'],FRAC:['1.5']};
  const mathArgs={MIN:['1','2'],MAX:['1','2'],LIMIT:['0','1','2'],SEL:['FALSE','1','2'],MUX:['0','10','20']};
  const m=compile('BEGIN');
  for(const name of supportedFunctions){
    const item=completion(name).find(i=>i.label===name&&i.kind==='funkcja');assert.ok(item,name+' completion');
    const expanded=expandSnippet(item.insert);let expression=expanded.text;
    const args=standardArgs[name]||mathArgs[name]||[name.startsWith('BOOL_TO_')?'TRUE':name.startsWith('TIME_TO_')?'T#20ms':'1'];
    const fields=expanded.stops.filter(s=>s.index>0);assert.equal(fields.length,args.length,name+' arity');
    for(const stop of [...fields].sort((a,b)=>b.start-a.start))expression=expression.slice(0,stop.start)+args[stop.index-1]+expression.slice(stop.end);
    const p=new Parser(expression),ast=p.expression();p.need('EOF');
    assert.ok(ast.args.every(a=>Object.hasOwn(standardSignatures,name)?!!a.name:!a.name),name+' argument style');
    const result=m.eval(ast);assert.ok(['number','string','boolean'].includes(typeof result.v),name+' result');
    if(typeof result.v==='number')assert.ok(Number.isFinite(result.v),name);
    assert.ok(signatureAt(header+name+'(',header.length+name.length+1,symbols)?.startsWith(name+'('),name+' signature');
  }
  assert.ok(!completion('MC_Power').some(i=>i.kind==='funkcja'));
});
test('all declaration sections have usable snippets and their closing keyword',()=>{
  for(const name of declarationSections){const item=completion(name).find(i=>i.label===name&&i.kind==='szablon');assert.ok(item,name);const expanded=expandSnippet(item.insert);const parsed=new Parser(expanded.text+'\nBEGIN').parse();assert.equal(parsed.decls[0].section,name);assert.ok(expanded.text.includes('END_VAR'));}
  assert.ok(completion('END_V').some(i=>i.label==='END_VAR'));
});
test('all current data types are suggested in declarations and accepted by the parser',()=>{
  for(const name of supportedTypes){assert.ok(completion(name,'VAR\nValue : ').some(i=>i.label===name&&i.kind==='typ'),name);new Parser('VAR Value : '+name+'; END_VAR BEGIN').parse();}
  const colon=completion('TO','VAR\nTimer : ');assert.ok(colon.some(i=>i.label==='TON_TIME'));assert.ok(!colon.some(i=>i.kind==='funkcja'||i.label==='TOF'&&i.kind==='szablon'));
  assert.ok(completion('VO','FUNCTION "Fn" : ').some(i=>i.label==='VOID'));
  assert.ok(!completion('VO','VAR\nValue : ').some(i=>i.label==='VOID'));
});
test('all current grammar keywords are reachable and unsupported block families are absent',()=>{
  for(const name of languageKeywords)assert.ok(completion(name).some(i=>i.label===name),name);
  for(const name of ['DATA_BLOCK','TYPE','TONR','CTU','MC_Power'])assert.ok(!completion(name).some(i=>i.label===name),name);
});
test('REGION works from a partial prefix and expands with a selectable title and closing directive',()=>{
  const item=completion('reg').find(i=>i.label==='REGION');assert.ok(item);
  const result=expandSnippet(item.insert,'    ');assert.match(result.text,/^REGION Nazwa_regionu\n/);assert.match(result.text,/\n    END_REGION$/);
  assert.equal(result.text.slice(result.stops[0].start,result.stops[0].end),'Nazwa_regionu');
  const p=compile('VAR x:INT; END_VAR BEGIN\n'+result.text+'\n#x:=7;');p.scan();assert.equal(p.locals.x,7);
  const s=header+'REGION Moja nazwa';assert.equal(suggestions(s,s.length,symbols),null);
});
test('missing control, timer and program scaffolds expand to supported syntax',()=>{
  for(const name of ['IF ELSIF ELSE','FOR BY','TP','F_TRIG','FUNCTION_BLOCK','FUNCTION','ORGANIZATION_BLOCK']){
    const item=snippets.find(i=>i.label===name);assert.ok(item,name);const expanded=expandSnippet(item.insert);assert.ok(!expanded.text.includes('${'));
    if(['FUNCTION_BLOCK','FUNCTION','ORGANIZATION_BLOCK'].includes(name))compile(expanded.text);
    else new Parser(header+expanded.text).parse();
  }
});
test('timer member suggestions expose compatible call methods and signature help',()=>{
  for(const [instance,method]of [['Timer','TON'],['Off','TOF'],['Pulse','TP'],['Any','TON'],['Any','TOF'],['Any','TP']]){
    const list=completion('#'+instance+'.'+method);const item=list.find(i=>i.label===method&&i.kind==='metoda');assert.ok(item,instance+'.'+method);
    const text=header+'#'+instance+'.'+expandSnippet(item.insert).text;const m=compile(text);m.scan();
    const call=header+'#'+instance+'.'+method+'(';assert.match(signatureAt(call,call.length,symbols),/PT := TIME/);
  }
  assert.ok(!completion('#Edge.').some(i=>i.kind==='metoda'));
});
test('signature help supports the same Polish timer identifiers as the parser',()=>{
  const source='VAR Opóźnienie:TON_TIME; END_VAR\nBEGIN\n#Opóźnienie(';
  const data=collectSymbols(source);assert.match(signatureAt(source,source.length,data),/^#Opóźnienie\(IN := BOOL, PT := TIME/);
});
test('typed FUNCTION return variable is suggested as the implicit output while editing',()=>{
  const source='FUNCTION "Wynik_FC" : INT\nVAR_INPUT\nValue : INT;\nEND_VAR\nBEGIN\n#Wyn';
  const data=collectSymbols(source),item=suggestions(source,source.length,data).items.find(i=>i.label==='#Wynik_FC');
  assert.ok(item);assert.match(item.detail,/INT.*VAR_OUTPUT/);
});
