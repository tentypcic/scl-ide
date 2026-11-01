import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {decodeImport} from '../dist/project-actions.js';

// Run the real layout controller with DOM/storage ports. No editor or runtime
// is needed to exercise panel transitions and persisted workspace settings.
const source = readFileSync(new URL('../dist/layout.js', import.meta.url), 'utf8');
function workspace({saved = null, failWrites = false} = {}) {
  const events = {}, elements = new Map(), classes = new Set(), properties = {};
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      value: '', textContent: '', attributes: {}, handlers: {}, dataset: {},
      classList: {toggle() {}},
      setAttribute(name, value) {this.attributes[name] = String(value);},
      addEventListener(name, handler) {this.handlers[name] = handler;},
    });
    return elements.get(selector);
  };
  const grips = ['sidebar', 'inspector', 'bottom'].map(kind => {
    const el = element('grip-' + kind); el.dataset.resize = kind; return el;
  });
  const storage = new Map(saved === null ? [] : [['scl-lab-layout-v1', saved]]);
  let dialog = false;
  const context = {
    document: {
      body: {classList: {toggle(name, enabled) {enabled ? classes.add(name) : classes.delete(name);}}},
      documentElement: {style: {setProperty(name, value) {properties[name] = value;}}},
      querySelector: selector => selector === 'dialog[open]' ? (dialog ? {} : null) : element(selector),
      querySelectorAll: () => grips,
      addEventListener: (name, handler) => {events[name] = handler;},
    },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => {if (failWrites) throw Error('quota'); storage.set(key, value);},
    },
    window: {addEventListener(name, handler) {events[name] = handler;}, dispatchEvent() {}},
    Event: class {constructor(type) {this.type = type;}},
  };
  vm.runInNewContext(source, context);
  return {
    classes, properties, element, grips, storage,
    setDialog(value) {dialog = value;},
    click(id) {element('#' + id).onclick();},
    key(key, ctrlKey = false) {events.keydown({key, ctrlKey, preventDefault() {}});},
    openPanel() {events['scl-open-panel']();},
  };
}

test('opening any panel from focus mode reveals that panel even if already enabled', () => {
  for (const [button, collapsed] of [['toggleSidebar', 'sidebar-collapsed'], ['toggleInspector', 'inspector-collapsed'], ['toggleBottom', 'bottom-collapsed']]) {
    const ui = workspace({saved: JSON.stringify({sidebar: true, inspector: true, bottom: true})});
    ui.click('focusMode'); assert.ok(ui.classes.has('focus-mode'));
    ui.click(button);
    assert.ok(!ui.classes.has('focus-mode')); assert.ok(!ui.classes.has(collapsed));
    assert.equal(ui.element('#' + button).attributes['aria-pressed'], 'true');
  }
});

test('panel choices and font survive reloading while focus stays temporary', () => {
  const ui = workspace(); ui.click('toggleSidebar'); ui.click('toggleBottom');
  ui.element('#fontSelect').value = '18'; ui.element('#fontSelect').onchange(); ui.click('focusMode');
  const reloaded = workspace({saved: ui.storage.get('scl-lab-layout-v1')});
  assert.ok(!reloaded.classes.has('sidebar-collapsed')); assert.ok(!reloaded.classes.has('bottom-collapsed'));
  assert.ok(!reloaded.classes.has('focus-mode')); assert.equal(reloaded.properties['--code-font'], '18px');
});

test('invalid saved dimensions are bounded and corrupt JSON uses defaults', () => {
  const ui = workspace({saved: JSON.stringify({sidebarWidth: -100, inspectorWidth: 900, bottomHeight: 'broken', font: 999})});
  assert.equal(ui.properties['--nav-width'], '160px'); assert.equal(ui.properties['--monitor-width'], '520px');
  assert.equal(ui.properties['--panel-height'], '160px'); assert.equal(ui.properties['--code-font'], '14px');
  assert.equal(workspace({saved: '{'}).properties['--monitor-width'], '320px');
});

test('keyboard resizing updates accessible size and persists it', () => {
  const ui = workspace(), grip = ui.grips[1];
  grip.handlers.keydown({key: 'ArrowLeft', preventDefault() {}});
  assert.equal(grip.attributes['aria-valuenow'], '336');
  assert.equal(workspace({saved: ui.storage.get('scl-lab-layout-v1')}).properties['--monitor-width'], '336px');
});

test('dialog keyboard shortcuts do not change workspace panels', () => {
  const ui = workspace(); ui.setDialog(true); ui.key('b', true); ui.key('F8');
  assert.ok(ui.classes.has('sidebar-collapsed')); assert.ok(!ui.classes.has('focus-mode'));
  ui.setDialog(false); ui.key('b', true); assert.ok(!ui.classes.has('sidebar-collapsed'));
});

test('bottom-panel request exits focus and unavailable storage does not block controls', () => {
  const ui = workspace({failWrites: true}); ui.click('focusMode'); ui.openPanel();
  assert.ok(!ui.classes.has('focus-mode')); assert.ok(!ui.classes.has('bottom-collapsed'));
  ui.click('toggleSidebar'); assert.ok(!ui.classes.has('sidebar-collapsed'));
});

test('JSON import rejects falsy values and invalid nested history before mutation', () => {
  for (const text of ['null', 'false', '0', '""', '[]', '{}', '{']) assert.throws(() => decodeImport('test.JSON', text));
  assert.throws(() => decodeImport('test.json', JSON.stringify({version: 3, code: '', revisionHistory: {format: 2, entries: []}})));
});

test('import preserves source files and round-trips valid legacy project settings', () => {
  assert.equal(decodeImport('Test.scl', 'IF TRUE THEN\nEND_IF;'), null);
  const project = {version: 3, code: '#x := 1;', dt: 50, speed: 4, revisionHistory: {format: 1, entries: []}};
  assert.deepEqual(decodeImport('Project.json', JSON.stringify(project)), project);
});
