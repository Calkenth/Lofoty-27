// Pomocnicze funkcje do tworzenia elementów DOM i SVG.
const SVG_NS = 'http://www.w3.org/2000/svg';

export function h(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  setAttrs(node, attrs);
  append(node, children);
  return node;
}

export function s(tag, attrs = {}, parent = null) {
  const node = document.createElementNS(SVG_NS, tag);
  setAttrs(node, attrs);
  if (parent) parent.appendChild(node);
  return node;
}

function setAttrs(node, attrs) {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
}

function append(node, children) {
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
}
