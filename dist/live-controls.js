// Keep controls alive across scan renders: replacing a pressed button between
// pointerdown and pointerup discards its click (and replacing an input loses IME,
// selection and keyboard focus). The generated markup is already escaped.
const identityAttributes = ['data-value', 'data-type', 'data-toggle', 'data-pulse', 'data-watch', 'data-remove', 'data-expand', 'data-add-section'];
function sameControl(a, b) {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) return false;
  if (a.nodeType !== 1) return true;
  return identityAttributes.every(name => a.getAttribute(name) === b.getAttribute(name));
}

export function syncLiveControls(current, desired, activeElement = null) {
  const children = [...desired.childNodes];
  children.forEach((next, index) => {
    const node = current.childNodes[index];
    if (!node) {current.appendChild(next); return;}
    if (!sameControl(node, next)) {current.replaceChild(next, node); return;}
    if (node.nodeType === 3) {if (node.nodeValue !== next.nodeValue) node.nodeValue = next.nodeValue; return;}
    if (node.nodeType !== 1) return;
    const editing = node === activeElement && node.nodeName === 'INPUT';
    for (const attr of [...node.attributes]) {
      if (editing && attr.name === 'value') continue;
      if (!next.hasAttribute(attr.name)) node.removeAttribute(attr.name);
    }
    for (const attr of [...next.attributes]) {
      if (editing && attr.name === 'value') continue;
      if (node.getAttribute(attr.name) !== attr.value) node.setAttribute(attr.name, attr.value);
    }
    if (node.nodeName === 'INPUT' && !editing && node.value !== next.value) node.value = next.value;
    syncLiveControls(node, next, activeElement);
  });
  while (current.childNodes.length > children.length) current.removeChild(current.lastChild);
}

export function renderLiveControls(container, html) {
  const template = container.ownerDocument.createElement('template');
  template.innerHTML = html;
  syncLiveControls(container, template.content, container.ownerDocument.activeElement);
}

// A blur can synchronously dispatch change while Enter is being handled. Guard
// both commit and cancel so an edit is written once, and Escape never writes it.
export function createValueEditor({decode, write, render, report}) {
  const busy = new WeakSet();
  return {
    commit(input) {
      if (busy.has(input)) return true;
      busy.add(input); let success = false;
      try {write(input, decode(input)); success = true;}
      catch (error) {report(error.message);}
      finally {input.blur(); render(); busy.delete(input);}
      return success;
    },
    cancel(input) {
      busy.add(input);
      try {input.value = input.defaultValue; input.blur(); render();}
      finally {busy.delete(input);}
    },
    flush(inputs) {
      for (const input of inputs) if (input.value !== input.defaultValue && !this.commit(input)) return false;
      return true;
    },
  };
}
