// A small helper for building page elements without innerHTML.
// Text always goes in through textContent, so content can never inject markup.
//
//   makeElement("button", { className: "primary", text: "Next", attributes: { type: "button" },
//                           onClick: () => goNext() })

export function makeElement(tag, options = {}, children = []) {
  const element = document.createElement(tag);
  const { className, text, attributes, onClick, dataset } = options;
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  for (const [name, value] of Object.entries(attributes || {})) {
    if (value === false || value === null || value === undefined) continue;
    element.setAttribute(name, value === true ? "" : String(value));
  }
  for (const [name, value] of Object.entries(dataset || {})) element.dataset[name] = value;
  if (onClick) element.addEventListener("click", onClick);
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    element.append(child);
  }
  return element;
}

// A link that opens in a new tab ("more info" and sources).
export function makeExternalLink(label, url) {
  return makeElement("a", { text: label, attributes: { href: url, target: "_blank", rel: "noopener" } });
}

// A collapsible panel. "open" sets whether it starts expanded.
export function makeDetails(summaryText, children, { open = false, className = "panel" } = {}) {
  const details = makeElement("details", { className, attributes: { open } }, [
    makeElement("summary", { text: summaryText }),
    ...children
  ]);
  return details;
}
