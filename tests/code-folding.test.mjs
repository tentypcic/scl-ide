import test from 'node:test';
import assert from 'node:assert/strict';
import {setupCodeFolding} from '../dist/code-folding.js';

class Element extends EventTarget {
  constructor() {super(); this.style = {}; this.children = [];}
  append(c) {this.children.push(c);}
  replaceChildren(...children) {this.children = children;}
  setAttribute() {}
}
class Textarea extends Element {
  constructor(text) {super(); this._value = text; this._start = this._end = 0; this.parentElement = new Element(); this.scrollTop = this.scrollLeft = 0; this.clientWidth = 1200; this.clientHeight = 600;}
  get value() {return this._value;} set value(v) {this._value = String(v);}
  get selectionStart() {return this._start;} set selectionStart(v) {this._start = v;}
  get selectionEnd() {return this._end;} set selectionEnd(v) {this._end = v;}
  setSelectionRange(a, b) {this._start = a; this._end = b;}
}
globalThis.HTMLTextAreaElement = Textarea;
globalThis.document = {createElement: name => name === 'canvas' ? {getContext: () => ({measureText: text => ({width: text.length * 8})})} : new Element()};
globalThis.window = new EventTarget();
globalThis.getComputedStyle = () => ({fontWeight: '400', fontSize: '14px', fontFamily: 'monospace', lineHeight: '24px', letterSpacing: '0px'});

const source = 'IF #a THEN\n#secret := 5;\nEND_IF;\n#x := 1;';
function editor(text = source) {const code = new Textarea(text); let doc = 'a'; const folding = setupCodeFolding(code, {onViewChange() {}, getDocumentId: () => doc}); return {code, folding, changeDoc: value => {doc = value;}};}
function event(type, fields = {}) {return Object.assign(new Event(type, {bubbles: true, cancelable: true}), fields);}
function nativeEdit(code, viewStart, viewEnd, text, inputType = 'insertText') {
  code._start = viewStart; code._end = viewEnd;
  if (!code.dispatchEvent(event('beforeinput', {inputType}))) return;
  code._value = code._value.slice(0, viewStart) + text + code._value.slice(viewEnd);
  code._start = code._end = viewStart + text.length;
  code.dispatchEvent(event('input', {inputType}));
}
test('folded editor remains editable and all public source APIs retain hidden text', () => {
  const {code, folding} = editor(); folding.toggle(1);
  assert.equal(code._value, 'IF #a THEN\n#x := 1;'); assert.equal(code.value, source);
  nativeEdit(code, code._value.indexOf('1;'), code._value.indexOf('1;') + 1, '20');
  assert.equal(code.value, source.replace('#x := 1', '#x := 20')); assert.ok(folding.collapsed.size);
  assert.equal(code.selectionStart, code.value.indexOf('20') + 2);
});
test('snippets/setRangeText use source offsets and reveal newly inserted hidden lines', () => {
  const {code, folding} = editor(); folding.toggle(1);
  const at = source.indexOf('1;'); code.setSelectionRange(at, at + 1); code.setRangeText('99', at, at + 1, 'end');
  assert.equal(code.value, source.replace('#x := 1', '#x := 99')); assert.equal(code.selectionStart, at + 2);
  const headerEnd = code.value.indexOf('\n'); code.setRangeText('\n#new := 2;', headerEnd, headerEnd, 'end');
  assert.match(code.value, /#new := 2;\n#secret := 5;/); assert.equal(folding.collapsed.size, 0);
});
test('Delete and Backspace at folded boundaries reveal code before allowing a destructive edit', () => {
  for (const backward of [false, true]) {
    const {code, folding} = editor(); folding.toggle(1);
    const at = backward ? code._value.indexOf('#x') : code._value.indexOf('\n');
    nativeEdit(code, at, at, '', backward ? 'deleteContentBackward' : 'deleteContentForward');
    assert.equal(code.value, source); assert.equal(folding.collapsed.size, 0);
  }
});
test('undo/redo after folding retain full code and return to the correct source cursor', () => {
  const {code, folding} = editor(); folding.toggle(1); const at = code._value.indexOf('1;');
  nativeEdit(code, at, at + 1, '9');
  code.dispatchEvent(event('keydown', {key: 'z', ctrlKey: true})); assert.equal(code.value, source);
  code.dispatchEvent(event('keydown', {key: 'z', ctrlKey: true, shiftKey: true})); assert.equal(code.value, source.replace('#x := 1', '#x := 9'));
});
test('consecutive typing remains a single undo group without losing a folded body', () => {
  const {code, folding} = editor(); folding.toggle(1);
  for (const c of 'abc') nativeEdit(code, code._value.length, code._value.length, c);
  assert.equal(code.value, source + 'abc');
  code.dispatchEvent(event('keydown', {key: 'z', ctrlKey: true})); assert.equal(code.value, source);
  code.dispatchEvent(event('keydown', {key: 'y', ctrlKey: true})); assert.equal(code.value, source + 'abc');
});
test('copy/cut across folded code include hidden source and cut remains undoable', () => {
  const {code, folding} = editor(); folding.foldAll(); code._start = 0; code._end = code._value.length;
  let copied; const clipboardData = {setData: (_, text) => {copied = text;}};
  code.dispatchEvent(event('copy', {clipboardData})); assert.equal(copied, source);
  code.dispatchEvent(event('cut', {clipboardData})); assert.equal(copied, source); assert.equal(code.value, '');
  code.dispatchEvent(event('keydown', {key: 'z', ctrlKey: true})); assert.equal(code.value, source);
});
test('debug/error navigation reveals a hidden source line and document switches reset view/undo', () => {
  const {code, folding, changeDoc} = editor(); folding.foldAll(); code.setSelectionRange(source.indexOf('#secret'), source.indexOf('#secret'));
  assert.equal(folding.collapsed.size, 0); assert.equal(code._start, source.indexOf('#secret'));
  folding.foldAll(); changeDoc('b'); code.value = '#other := 1;';
  assert.equal(folding.collapsed.size, 0); code.dispatchEvent(event('keydown', {key: 'z', ctrlKey: true}));
  assert.equal(code.value, '#other := 1;');
});
test('select-all copy/cut includes a collapsed block at EOF without a trailing newline', () => {
  const onlyBlock = 'IF #a THEN\n#x:=1;\nEND_IF;', {code, folding} = editor(onlyBlock); folding.foldAll();
  code._start = 0; code._end = code._value.length;
  let copied; const clipboardData = {setData: (_, text) => {copied = text;}};
  code.dispatchEvent(event('copy', {clipboardData})); assert.equal(copied, onlyBlock);
  code.dispatchEvent(event('cut', {clipboardData})); assert.equal(code.value, '');
  code.dispatchEvent(event('keydown', {key: 'z', ctrlKey: true})); assert.equal(code.value, onlyBlock);
});
