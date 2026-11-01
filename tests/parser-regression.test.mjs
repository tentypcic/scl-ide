import test from 'node:test';
import assert from 'node:assert/strict';
import {compile, Parser} from '../dist/engine.js';
const wrap=body=>'FUNCTION_BLOCK "Test"\nVAR x:INT; y:INT; i:INT; END_VAR\nBEGIN\n'+body+'\nEND_FUNCTION_BLOCK';
for(const [name,body,expected] of [
 ['nested CASE','CASE #x OF 0: CASE #x OF 0: #y:=7; ELSE #y:=99; END_CASE; 1: #y:=88; END_CASE;',7],
 ['CASE FOR CASE','CASE #x OF 0: FOR #i:=1 TO 3 DO CASE #i OF 1,2: #y:=#y+1; 3: #y:=#y+10; END_CASE; END_FOR; END_CASE;',12],
 ['CASE WHILE REPEAT','CASE #x OF 0: WHILE #y<2 DO #y:=#y+1; END_WHILE; REPEAT #y:=#y+1; UNTIL #y=4 END_REPEAT; END_CASE;',4],
 ['signed and parenthesized labels','#x:=-2; CASE #x OF (-3)..(-1): #y:=9; ELSE #y:=99; END_CASE;',9],
 ['long label list','CASE #x OF '+Array.from({length:40},(_,i)=>i).join(',')+': #y:=11; END_CASE;',11],
 ['typed radix literal','#y:=INT#16#7F;',127],
 ['raw body','#y:=5;',5],
]) test(name,()=>{const m=compile(wrap(body));m.scan();assert.equal(m.locals.y,expected);});
for(const literal of ['2#102','8#89','16#GG','WORD#2#102','WORD#16#FG','INT#12foo'])
 test('reject malformed literal '+literal,()=>assert.throws(()=>compile(wrap('#y:='+literal+';')),/literał/i));
for(const [start,end] of [['FUNCTION_BLOCK "X"','END_FUNCTION'],['FUNCTION "X" : VOID','END_ORGANIZATION_BLOCK'],['ORGANIZATION_BLOCK "X"','END_FUNCTION_BLOCK']])
 test('reject mismatched '+start,()=>assert.throws(()=>new Parser(start+' BEGIN '+end).parse(),/Oczekiwano END_/));
test('explicit block requires terminator',()=>assert.throws(()=>new Parser('FUNCTION_BLOCK "X" BEGIN').parse(),/END_FUNCTION_BLOCK/));
test('matching block headers remain accepted',()=>{for(const [start,end] of [['FUNCTION_BLOCK "X"','END_FUNCTION_BLOCK'],['FUNCTION "X" : VOID','END_FUNCTION'],['ORGANIZATION_BLOCK "X"','END_ORGANIZATION_BLOCK']])new Parser(start+' BEGIN '+end).parse();});
test('raw body remains accepted',()=>new Parser('VAR x:INT; END_VAR #x:=1;').parse());
test('nested CASE AST preserves arm boundaries',()=>{const p=new Parser(wrap('CASE #x OF 0: CASE #x OF 0: #y:=7; END_CASE; 1: #y:=8; END_CASE;')).parse();assert.equal(p.body[0].cases.length,2);assert.equal(p.body[0].cases[0].b[0].k,'case');});
