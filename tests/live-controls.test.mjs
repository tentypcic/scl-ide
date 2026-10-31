import test from 'node:test';
import assert from 'node:assert/strict';
import {syncLiveControls, createValueEditor} from '../dist/live-controls.js';

// DOM ports for identity/focus invariants. Browser QA covers the real pointer
// events and HTML parsing; these tests exercise the production reconciler.
class Node {
  constructor(name, attrs = {}, children = []) {
    this.nodeName = name; this.nodeType = name === '#text' ? 3 : 1;
    this.attrs = new Map(Object.entries(attrs)); this.childNodes = [];
    for (const child of children) this.appendChild(child);
  }
  get attributes() {return [...this.attrs].map(([name, value]) => ({name, value}));}
  getAttribute(name) {return this.attrs.get(name) ?? null;}
  hasAttribute(name) {return this.attrs.has(name);}
  setAttribute(name, value) {this.attrs.set(name, value);}
  removeAttribute(name) {this.attrs.delete(name);}
  get value() {return this.draft ?? this.getAttribute('value') ?? '';}
  set value(value) {this.draft = value; this.selectionStart = this.selectionEnd = value.length;}
  get defaultValue() {return this.getAttribute('value') ?? '';}
  get lastChild() {return this.childNodes.at(-1);}
  appendChild(node) {node.parent?.removeChild(node); this.childNodes.push(node); node.parent = this;}
  removeChild(node) {this.childNodes.splice(this.childNodes.indexOf(node), 1); node.parent = null;}
  replaceChild(next, old) {next.parent?.removeChild(next); this.childNodes[this.childNodes.indexOf(old)] = next; old.parent = null; next.parent = this;}
}
const text = value => Object.assign(new Node('#text'), {nodeValue: value});
const root = (...children) => new Node('DIV', {}, children);
const bool = (value, path = '#Start') => new Node('BUTTON', {'data-toggle': path, class: value ? 'on' : ''}, [text(String(value))]);
const input = (value, path = '#Value') => new Node('INPUT', {'data-value': path, 'data-type': 'INT', value: String(value)});

test('scan renders preserve a BOOL button and its handlers throughout pointer interaction', () => {
  const button = bool(false), panel = root(button); let clicked = 0;
  button.onclick = () => {clicked++;};
  for (let n = 0; n < 20; n++) syncLiveControls(panel, root(bool(n % 2 === 0)));
  assert.equal(panel.childNodes[0], button); button.onclick(); assert.equal(clicked, 1);
  assert.equal(button.childNodes[0].nodeValue, 'false');
});

test('typing preserves draft, caret and default value while other signals continue refreshing', () => {
  const field = input(5), button = bool(false), panel = root(field, button);
  field.value = '123'; field.selectionStart = field.selectionEnd = 1;
  syncLiveControls(panel, root(input(6), bool(true)), field);
  assert.equal(panel.childNodes[0], field); assert.equal(field.value, '123');
  assert.equal(field.defaultValue, '5'); assert.equal(field.selectionStart, 1);
  assert.equal(panel.childNodes[1], button); assert.equal(button.childNodes[0].nodeValue, 'true');
});

test('unfocused numeric controls receive both the runtime value and new default', () => {
  const field = input(5), panel = root(field); field.value = '10';
  syncLiveControls(panel, root(input(6)));
  assert.equal(field.value, '6'); assert.equal(field.defaultValue, '6');
});

test('changed variable identities replace the control rather than reusing its handler', () => {
  const old = bool(false, '#First'), panel = root(old);
  syncLiveControls(panel, root(bool(true, '#Second')));
  assert.notEqual(panel.childNodes[0], old); assert.equal(panel.childNodes[0].getAttribute('data-toggle'), '#Second');
  const field = input(5), typedPanel = root(field), changed = input(5); changed.setAttribute('data-type', 'TIME');
  syncLiveControls(typedPanel, root(changed), field); assert.notEqual(typedPanel.childNodes[0], field);
});

test('panel structure and attributes can shrink without leaving stale controls', () => {
  const button = bool(false), panel = root(button, input(5)); button.setAttribute('disabled', '');
  syncLiveControls(panel, root(bool(true)));
  assert.equal(panel.childNodes.length, 1); assert.equal(panel.childNodes[0], button);
  assert.equal(button.hasAttribute('disabled'), false); assert.equal(button.getAttribute('class'), 'on');
});

function editorFixture() {
  let value = 5, writes = 0; const reports = [];
  const field = {value: '5', defaultValue: '5', blur() {this.onBlur?.();}};
  const editor = createValueEditor({
    decode(input) {const n = Number(input.value); if (!input.value.trim() || !Number.isFinite(n)) throw Error('invalid'); return n;},
    write(input, next) {if (next > 32767) throw Error('range'); value = next; writes++;},
    render() {field.value = field.defaultValue = String(value);},
    report(message) {reports.push(message);},
  });
  field.onBlur = () => editor.commit(field);
  return {field, editor, reports, get value() {return value;}, get writes() {return writes;}};
}

test('Enter plus the synchronous blur/change event commits exactly once', () => {
  const f = editorFixture(); f.field.value = '12';
  assert.equal(f.editor.commit(f.field), true); assert.equal(f.value, 12); assert.equal(f.writes, 1);
});

test('Escape cancels without writing even when blur dispatches change', () => {
  const f = editorFixture(); f.field.value = '99'; f.editor.cancel(f.field);
  assert.equal(f.value, 5); assert.equal(f.writes, 0); assert.equal(f.field.value, '5');
});

test('invalid and out-of-range edits preserve the runtime value and report failure', () => {
  for (const draft of ['', 'bad', '40000']) {
    const f = editorFixture(); f.field.value = draft;
    assert.equal(f.editor.commit(f.field), false); assert.equal(f.value, 5); assert.equal(f.writes, 0);
    assert.equal(f.field.value, '5'); assert.equal(f.reports.length, 1);
  }
});

test('flush skips unchanged controls and rejects an invalid pending value', () => {
  const f = editorFixture(); assert.equal(f.editor.flush([f.field]), true); assert.equal(f.writes, 0);
  f.field.value = '7'; assert.equal(f.editor.flush([f.field]), true); assert.equal(f.value, 7); assert.equal(f.writes, 1);
  f.field.value = 'bad'; assert.equal(f.editor.flush([f.field]), false); assert.equal(f.value, 7);
});
