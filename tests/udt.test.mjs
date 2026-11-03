import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compile,Parser,SclError} from '../dist/engine.js';
import {collectSymbols,suggestions,snippets,expandSnippet} from '../dist/assist-core.js';
import {ioSignals,insertDeclaration} from '../dist/source-tools.js';
import {foldRanges} from '../dist/folding-core.js';
import {formatSCL} from '../dist/formatter.js';
import {ProjectHistory} from '../dist/project-history.js';

const type=(name,fields)=>`TYPE "${name}"\nVERSION : 1.0\nSTRUCT\n${fields}\nEND_STRUCT;\nEND_TYPE\n`;
const beamType=type('UDT_BelkaCisnienie','CzujnikCisnieniaZbiornik : REAL;');
const positionType=type('UDT_WybranaBelka','Pozycja : REAL;');
const typeSources=[{id:'pressure',name:'Pressure.scl',source:beamType},{id:'position',name:'Position.scl',source:positionType}];
const fb=readFileSync(new URL('fixtures/St1_WyborBelkiDoPompowania.scl',import.meta.url),'utf8');
const screenshotTypes=readFileSync(new URL('../dist/UDT_Belki.scl',import.meta.url),'utf8');
const variable='VAR_INPUT Belki : ARRAY[0..10] OF "UDT_BelkaCisnienie"; END_VAR\n';

test('UDTs before/after a block, quoted/unquoted names, versions and attributes',()=>{
 for(const source of [beamType+fb+positionType,positionType+beamType+fb]){
  const m=compile(source);assert.equal(m.schemas.BelkaCisnienie.of.udtName,'UDT_BelkaCisnienie');
  assert.equal(m.locals.BelkaCisnienie[0].CzujnikCisnieniaZbiornik,0);m.scan();assert.equal(m.locals.NrBelkiDoPompowania,0);
 }
 const m=compile('TYPE Sample : STRUCT A:INT; END_STRUCT; END_TYPE;\nVAR x:sample; END_VAR #x.a:=7;');m.scan();assert.equal(m.read('#x.A').v,7);
});
test('separate TYPE documents preserve active source ranges and ignore unrelated programs',()=>{
 const m=compile(fb,{typeSources:[...typeSources,{source:'FUNCTION_BLOCK "Other" BEGIN broken @'}]});
 assert.equal(m.program.body[0].tok.line,fb.slice(0,fb.indexOf('#NrBelkiDoPompowania')).split('\n').length);
 assert.equal(m.schemas.PozycjeBelek.of.fields[0].name,'Pozycja');
});
test('standalone TYPEs compile without an executable FB',()=>{
 const m=compile(beamType+positionType);assert.equal(m.program.body.length,0);assert.equal(m.program.decls.length,0);assert.equal(Object.keys(m.program.types).length,2);
});
test('full screenshot schemas resolve pressure, beam and all four nested magnets',()=>{
 const options={typeSources:[{id:'udt',source:screenshotTypes}]},m=compile(fb,options);
 assert.equal(m.schemas.BelkaCisnienie.of.fields.length,3);assert.equal(m.schemas.PozycjeBelek.of.fields.length,6);
 for(let i=0;i<=10;i++)for(let magnet=1;magnet<=4;magnet++){
  const base=`#PozycjeBelek[${i}].Magnes_${magnet}`;
  assert.equal(m.read(base+'.AktywnyKorekcja').v,false);m.write(base+'.Pozycja',i*100+magnet);
  assert.equal(m.read(base+'.Pozycja').v,i*100+magnet);
 }
 assert.equal(m.read('#BelkaCisnienie[0].CzujnikCisnieniaWyspaPneumatyczna').v,0);
 assert.ok(ioSignals(m).inputs.some(s=>s.path==='#PozycjeBelek[0].Magnes_1.Pozycja'));
 const source=fb.slice(0,fb.indexOf('BEGIN')+5)+'\n#PozycjeBelek[1].Magnes_1.';
 assert.ok(suggestions(source,source.length,collectSymbols(source,null,'{}',options.typeSources))?.items.some(s=>s.label==='AktywnyKorekcja'));
});
test('forward references, nested UDTs and multidimensional arrays execute with independent memory',()=>{
 const defs=type('Outer','Nested : ARRAY[-1..0,2..3] OF "Inner";')+type('Inner','Value : REAL := 2.5; Ready : BOOL := TRUE;');
 const m=compile(defs+'VAR a,b : Outer; END_VAR #a.Nested[-1,2].Value:=8.0;');m.scan();
 assert.equal(m.read('#a.Nested[-1,2].Value').v,8);assert.equal(m.read('#b.Nested[-1,2].Value').v,2.5);
 assert.equal(m.read('#a.Nested[0,3].Value').v,2.5);assert.equal(m.read('#a.Nested[0,3].Ready').v,true);
 assert.throws(()=>m.read('#a.Nested[1,2].Value'),/poza zakresem/);
 assert.throws(()=>m.read('#a.Nested[-1,2].Missing'),/Brak pola/);
});
test('UDT defaults support scalar constant expressions and reset VAR_TEMP each scan',()=>{
 const defs=type('Defaults',"Count:INT:=2+3; Flag:BOOL:=FALSE; Text:STRING[3]:='hello'; Delay:TIME:=T#2s;");
 const m=compile(defs+'VAR_TEMP x:Defaults; END_VAR #x.Count:=#x.Count+1;');m.scan();m.scan();
 assert.equal(m.read('#x.Count').v,6);assert.equal(m.read('#x.Text').v,'hel');assert.equal(m.read('#x.Delay').v,2000);
 assert.throws(()=>compile(type('Bad','Flag:BOOL:=1;')),/BOOL/);
 assert.throws(()=>compile(type('Bad','A:INT:=#Missing;')),/Nieznana/);
});
test('missing UDT reports its name and exact active token instead of guessing a schema',()=>{
 const name='UDT_BelkaCisnienie',at=fb.indexOf('"'+name+'"');
 assert.throws(()=>compile(fb),e=>e instanceof SclError&&e.message.includes(name)&&e.message.includes('TYPE')&&e.range.start===at&&e.range.end===at+name.length+2);
});
test('external type errors identify the source document and its token',()=>{
 const source=type('Bad','A : "Missing";');
 assert.throws(()=>compile('BEGIN',{typeSources:[{id:'bad',name:'Bad.scl',source}]}),e=>e.sourceId==='bad'&&e.sourceName==='Bad.scl'&&e.range.start===source.indexOf('"Missing"'));
 assert.throws(()=>compile('BEGIN',{typeSources:[{id:'bad',source:'TYPE "Bad" STRUCT A:INT; END_TYPE'}]}),e=>e.sourceId==='bad'&&e instanceof SclError);
});
test('duplicate UDT names and fields are rejected case-insensitively',()=>{
 assert.throws(()=>compile(beamType,{typeSources}),/dwukrotnie/);
 assert.throws(()=>compile(type('A','X:INT; x:REAL;')),/dwukrotnie/);
 assert.throws(()=>compile(type('A','X:INT;')+type('a','Y:INT;')),/dwukrotnie/);
 assert.throws(()=>compile(type('REAL','X:INT;')),/zarezerwowana/);
});
test('direct/indirect cycles and deeply nested cached definitions fail as SclError',()=>{
 for(const defs of [type('A','X:A;'),type('A','X:ARRAY[0..1] OF B;')+type('B','Y:A;')])assert.throws(()=>compile(defs),e=>e instanceof SclError&&/Cykliczna/.test(e.message));
 const defs=Array.from({length:90},(_,i)=>type('T'+i,i?'X:T'+(i-1)+';':'X:INT;')).join('');
 assert.throws(()=>compile(defs),e=>e instanceof SclError&&/głębokie/.test(e.message));
 const large=type('A','X:ARRAY[0..9999] OF INT;')+type('B','X:ARRAY[0..9] OF A;');
 assert.throws(()=>compile(large+'VAR x:B; END_VAR'),/50 000/);
});
test('UDT and field prototype-like identifiers are rejected',()=>{
 for(const name of ['__proto__','constructor','prototype']){
  assert.throws(()=>compile(type(name,'x:INT;')),/Niedozwolona/);
  assert.throws(()=>compile(type('A',name+':INT;')),/Niedozwolona/);
 }
});
test('completion resolves UDT array fields before compiling and during incomplete bodies',()=>{
 const header=variable+'BEGIN\n',symbols=collectSymbols(header,null,'{}',typeSources);
 const source=header+'#Belki[1].Cz';
 assert.ok(suggestions(source,source.length,symbols)?.items.some(i=>i.label==='CzujnikCisnieniaZbiornik'));
 for(const tail of ['VAR\nBelki : UDT_B','VAR\nBelki : ARRAY[0..10] OF UDT_B','VAR\nBelki : "UDT_B']){
  const s=collectSymbols(tail,null,'{}',typeSources),items=suggestions(tail,tail.length,s)?.items||[];
  assert.ok(items.some(i=>i.label==='UDT_BelkaCisnienie'),tail);
 }
 const inline=beamType+variable+'BEGIN\n#Belki[1].';
 assert.ok(suggestions(inline,inline.length,collectSymbols(inline))?.items.some(i=>i.label==='CzujnikCisnieniaZbiornik'));
});
test('TYPE snippet, formatter and folding preserve executable source',()=>{
 const sample=expandSnippet(snippets.find(s=>s.label==='TYPE').insert).text;compile(sample);
 const source=beamType+variable+'#Belki[1].CzujnikCisnieniaZbiornik:=4.5;';
 const formatted=formatSCL(source),m=compile(formatted);m.scan();assert.equal(m.read('#Belki[1].CzujnikCisnieniaZbiornik').v,4.5);
 assert.ok(foldRanges(formatted).some(r=>r.kind==='TYPE'&&r.start===1));assert.equal(formatSCL(formatted),formatted);
});
test('I/O, watches, writes and declaration wizard use resolved external types',()=>{
 const m=compile(variable,{typeSources});const signal=ioSignals(m).inputs.find(s=>s.path==='#Belki[10].CzujnikCisnieniaZbiornik');assert.equal(signal.type.name,'REAL');
 m.write(signal.path,3.5);assert.equal(m.read(signal.path).v,3.5);
 const updated=insertDeclaration(variable,{name:'Start',type:'BOOL'},{typeSources});assert.equal(compile(updated,{typeSources}).locals.Start,false);
});

function pressureMachine(){const m=compile(fb,{typeSources,dt:20});m.input('IloscBelek',10);for(let i=0;i<=10;i++){m.write(`#BelkaCisnienie[${i}].CzujnikCisnieniaZbiornik`,6);m.write(`#PozycjeBelek[${i}].Pozycja`,i*250);}return m;}
test('user pressure FB waits 2 seconds and selects low pressure only at the carriage',()=>{
 const m=pressureMachine();m.input('PozycjaWodzika',500);m.write('#BelkaCisnienie[2].CzujnikCisnieniaZbiornik',4.5);
 for(let i=0;i<100;i++)m.scan();assert.equal(m.locals.NrBelkiDoPompowania,0);m.scan();assert.equal(m.locals.NrBelkiDoPompowania,2);
 m.input('PozycjaWodzika',502);m.scan();assert.equal(m.locals.NrBelkiDoPompowania,0);
 m.input('PozycjaWodzika',501);m.scan();assert.equal(m.locals.NrBelkiDoPompowania,2);
 m.write('#BelkaCisnienie[2].CzujnikCisnieniaZbiornik',5);m.scan();assert.equal(m.locals.NrBelkiDoPompowania,0);
});
test('user pressure FB prioritizes nearest critical beam, lower-index ties and timer reset',()=>{
 const m=pressureMachine();m.input('PozycjaWodzika',500);m.write('#BelkaCisnienie[2].CzujnikCisnieniaZbiornik',4.5);
 m.write('#BelkaCisnienie[1].CzujnikCisnieniaZbiornik',3);m.write('#BelkaCisnienie[3].CzujnikCisnieniaZbiornik',3);
 for(let i=0;i<=100;i++)m.scan();assert.equal(m.locals.NrBelkiDoPompowania,1);
 m.write('#BelkaCisnienie[1].CzujnikCisnieniaZbiornik',6);m.scan();assert.equal(m.locals.NrBelkiDoPompowania,3);
 m.write('#BelkaCisnienie[3].CzujnikCisnieniaZbiornik',6);m.scan();assert.equal(m.locals.NrBelkiDoPompowania,2);
 m.write('#BelkaCisnienie[1].CzujnikCisnieniaZbiornik',3);m.scan();assert.equal(m.locals.NrBelkiDoPompowania,2);
});
test('project JSON round-trip/history restore retains UDT source and FB references',()=>{
 const project={version:3,currentExample:'fb',filename:'FB.scl',code:fb,drafts:{fb,pressure:beamType,position:positionType},projectFiles:{fb:'FB.scl',pressure:'Pressure.scl',position:'Position.scl'},trash:{},watches:[],breakpoints:[],globals:'{}'};
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},history=new ProjectHistory(storage);history.save(project,{checkpoint:true,label:'UDT'});
 const restored=JSON.parse(JSON.stringify(history.export(project))),sources=Object.entries(restored.drafts).filter(([id])=>id!=='fb').map(([id,source])=>({id,source}));
 assert.equal(compile(restored.code,{typeSources:sources}).schemas.BelkaCisnienie.of.udtName,'UDT_BelkaCisnienie');
});
